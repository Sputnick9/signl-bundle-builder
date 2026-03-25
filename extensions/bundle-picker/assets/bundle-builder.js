(function () {
  "use strict";

  var SVG = {
    check: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 8 6.5 11.5 13 5"/></svg>',
    cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
    zap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
  };

  function el(tag, props, children) {
    var node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        if (k === "className") { node.className = props[k]; }
        else if (k === "innerHTML") { node.innerHTML = props[k]; }
        else if (k === "style") { node.style.cssText = props[k]; }
        else if (k.startsWith("on") && typeof props[k] === "function") {
          node.addEventListener(k.slice(2).toLowerCase(), props[k]);
        } else {
          node.setAttribute(k, props[k]);
        }
      });
    }
    if (Array.isArray(children)) {
      children.forEach(function (c) {
        if (c instanceof Node) node.appendChild(c);
        else if (c != null) node.appendChild(document.createTextNode(String(c)));
      });
    } else if (typeof children === "string") {
      node.textContent = children;
    }
    return node;
  }

  function formatMoney(cents, currency) {
    if (currency) {
      try {
        return new Intl.NumberFormat(undefined, { style: "currency", currency: currency }).format(cents / 100);
      } catch (_) {}
    }
    return "$" + (cents / 100).toFixed(2);
  }

  // ── SignlBundleBuilder ──────────────────────────────────────────────────────

  function SignlBundleBuilder(container) {
    this.container = container;
    this.shop = container.dataset.shop || "";
    this.appUrl = (container.dataset.appUrl || "").replace(/\/$/, "");
    this.discountKey = container.dataset.discountKey || "";
    this.bundleId = container.dataset.bundleId || "theme-bundle";
    this.heading = container.dataset.heading || "Build Your Bundle";
    this.subheading = container.dataset.subheading || "";
    this.ctaText = container.dataset.ctaText || "Add Bundle to Cart";
    this.currency = (window.Shopify && window.Shopify.currency && window.Shopify.currency.active) || "USD";

    this.categories = [];
    this.selections = {};
    this.activeTab = 0;
    this.discountConfig = null;
    this.isSubmitting = false;
    this.productsCache = {};

    this._init();
  }

  SignlBundleBuilder.prototype._init = function () {
    var self = this;

    if (!this.appUrl) {
      this.container.innerHTML = "";
      return;
    }

    var categoryEls = this.container.querySelectorAll("[data-signl-category]");
    if (!categoryEls.length) {
      this.container.innerHTML = "";
      return;
    }

    categoryEls.forEach(function (el, idx) {
      var cat = {
        id: idx,
        name: el.dataset.name || ("Category " + (idx + 1)),
        collectionHandle: el.dataset.collectionHandle || "",
        collectionId: el.dataset.collectionId || "",
        minQty: parseInt(el.dataset.minQty, 10) || 1,
        maxQty: parseInt(el.dataset.maxQty, 10) || 0,
        products: [],
      };
      self.categories.push(cat);
      self.selections[idx] = {};
    });

    var fetches = [];

    // Fetch products for each category
    self.categories.forEach(function (cat) {
      if (!cat.collectionHandle) {
        fetches.push(Promise.resolve([]));
        return;
      }
      var url = "/collections/" + encodeURIComponent(cat.collectionHandle) + "/products.json?limit=250";
      fetches.push(
        fetch(url)
          .then(function (r) { return r.ok ? r.json() : { products: [] }; })
          .catch(function () { return { products: [] }; })
          .then(function (data) {
            return (data.products || []).map(function (p) {
              var variants = (p.variants || []).map(function (v) {
                return {
                  id: v.id,
                  title: v.title,
                  price: v.price,
                  available: v.available,
                };
              });
              var image = (p.images && p.images.length) ? p.images[0].src : null;
              return {
                id: String(p.id),
                shopifyProductId: String(p.id),
                shopifyVariantId: variants.length === 1 && variants[0].title === "Default Title"
                  ? String(variants[0].id)
                  : null,
                productTitle: p.title,
                productImage: image,
                availableVariants: variants,
              };
            });
          })
      );
    });

    // Fetch discount config from app API
    var discountFetch = Promise.resolve(null);
    if (self.discountKey && self.shop) {
      var dcUrl = self.appUrl + "/api/storefront/discount-configs/" + encodeURIComponent(self.discountKey)
        + "?shop=" + encodeURIComponent(self.shop);
      discountFetch = fetch(dcUrl)
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; });
    }

    // Fetch storefront settings for theming
    var settingsFetch = Promise.resolve(null);
    if (self.shop) {
      var sUrl = self.appUrl + "/api/storefront/settings?shop=" + encodeURIComponent(self.shop);
      settingsFetch = fetch(sUrl)
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; });
    }

    Promise.all([Promise.all(fetches), discountFetch, settingsFetch])
      .then(function (results) {
        var productArrays = results[0];
        var discountConfig = results[1];
        var settings = results[2];

        productArrays.forEach(function (products, idx) {
          self.categories[idx].products = products;
        });
        self.discountConfig = discountConfig;
        self._applySettings(settings);
        self._render();
      })
      .catch(function (err) {
        console.error("SignlBundleBuilder: init error", err);
        self.container.innerHTML = "";
      });
  };

  var COLOR_PROPS = [
    ["buttonPrimary", "--bp-primary"],
    ["buttonSecondary", "--bp-primary-light"],
    ["themeAccent", "--bp-primary-dark"],
    ["borderColor", "--bp-border"],
    ["fontColor", "--bp-text"],
    ["stickyCartBg", "--bp-cart-bg"],
    ["stickyCartText", "--bp-cart-text"],
    ["progressBarFill", "--bp-progress-fill"],
    ["progressBarBg", "--bp-progress-bg"],
  ];

  SignlBundleBuilder.prototype._applySettings = function (settings) {
    if (!settings) return;
    var root = this.container;
    COLOR_PROPS.forEach(function (pair) {
      var val = settings[pair[0]];
      if (val) root.style.setProperty(pair[1], val);
    });
  };

  SignlBundleBuilder.prototype._trackEvent = function (eventType) {
    if (!this.appUrl || !this.shop) return;
    try {
      fetch(this.appUrl + "/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop: this.shop, bundleId: 0, eventType: eventType }),
        keepalive: true,
      }).catch(function () {});
    } catch (_) {}
  };

  // ── Discount helpers ────────────────────────────────────────────────────────

  SignlBundleBuilder.prototype._getMaxTier = function () {
    var dc = this.discountConfig;
    if (!dc || !dc.tiers || !dc.tiers.length) return null;
    return dc.tiers.reduce(function (best, t) { return (!best || t.minQty > best.minQty) ? t : best; }, null);
  };

  SignlBundleBuilder.prototype._getCurrentTier = function (total) {
    var dc = this.discountConfig;
    if (!dc || !dc.tiers || !dc.tiers.length) return null;
    return dc.tiers.slice().sort(function (a, b) { return b.minQty - a.minQty; })
      .find(function (t) { return total >= t.minQty; }) || null;
  };

  SignlBundleBuilder.prototype._getNextTier = function (total) {
    var dc = this.discountConfig;
    if (!dc || !dc.tiers || !dc.tiers.length) return null;
    return dc.tiers.slice().sort(function (a, b) { return a.minQty - b.minQty; })
      .find(function (t) { return t.minQty > total; }) || null;
  };

  SignlBundleBuilder.prototype._getTotals = function () {
    var totalQty = 0;
    var self = this;
    self.categories.forEach(function (cat) {
      var slotSel = self.selections[cat.id] || {};
      Object.values(slotSel).forEach(function (item) { totalQty += item.qty; });
    });
    var currentTier = self._getCurrentTier(totalQty);
    return { totalQty: totalQty, currentTier: currentTier, discountValue: currentTier ? currentTier.discountValue : 0 };
  };

  SignlBundleBuilder.prototype._allCatsValid = function () {
    var self = this;
    return self.categories.every(function (cat) {
      var slotSel = self.selections[cat.id] || {};
      var total = Object.values(slotSel).reduce(function (s, x) { return s + x.qty; }, 0);
      return total >= cat.minQty;
    });
  };

  // ── Rendering ───────────────────────────────────────────────────────────────

  SignlBundleBuilder.prototype._render = function () {
    this.container.innerHTML = "";
    var root = el("div", { className: "signl-bp" });

    // Header
    var maxTier = this._getMaxTier();
    var discountType = this.discountConfig ? this.discountConfig.discountType : "percentage";
    var header = el("div", { className: "signl-bp__header" });
    var headerContent = el("div", { className: "signl-bp__header-content" });
    headerContent.appendChild(el("h3", { className: "signl-bp__title" }, this.heading));
    if (this.subheading) {
      headerContent.appendChild(el("p", { className: "signl-bp__subtitle" }, this.subheading));
    }
    header.appendChild(headerContent);
    if (maxTier) {
      var badgeLabel = discountType === "fixed"
        ? "Save $" + (maxTier.discountValue / 100).toFixed(2)
        : "Up to " + maxTier.discountValue + "% off";
      header.appendChild(el("span", { className: "signl-bp__discount-badge" }, [
        el("span", { innerHTML: SVG.tag, style: "display:flex;width:0.875rem;height:0.875rem" }),
        document.createTextNode(badgeLabel),
      ]));
    }
    root.appendChild(header);

    // Tab bar
    if (this.categories.length > 1) {
      root.appendChild(this._renderTabBar());
    }

    // Active category slot
    var activeCat = this.categories[this.activeTab] || this.categories[0];
    if (activeCat) {
      var slotsWrap = el("div", { className: "signl-bp__slots" });
      slotsWrap.appendChild(this._renderCategory(activeCat, this.activeTab));
      root.appendChild(slotsWrap);
    }

    // Cart bar
    root.appendChild(this._buildCartBar());

    this.container.appendChild(root);
    this._trackEvent("view");
  };

  SignlBundleBuilder.prototype._refresh = function () {
    this._render();
  };

  SignlBundleBuilder.prototype._renderTabBar = function () {
    var self = this;
    var bar = el("div", { className: "signl-bp__tab-bar" });
    self.categories.forEach(function (cat, idx) {
      var isActive = idx === self.activeTab;
      var slotSel = self.selections[cat.id] || {};
      var slotTotal = Object.values(slotSel).reduce(function (s, x) { return s + x.qty; }, 0);
      var done = slotTotal >= cat.minQty;

      var tabClass = "signl-bp__tab signl-bp__tab--text-only"
        + (isActive ? " signl-bp__tab--active" : "")
        + (done ? " signl-bp__tab--done" : "");
      var tab = el("button", { className: tabClass, type: "button" }, cat.name);

      var indicator = el("span", { className: done ? "signl-bp__tab-check" : "signl-bp__tab-progress" });
      if (done) {
        indicator.innerHTML = SVG.check;
      } else if (slotTotal > 0) {
        indicator.textContent = slotTotal + "/" + cat.minQty;
      }
      if (done || slotTotal > 0) tab.appendChild(indicator);

      tab.addEventListener("click", function () {
        if (self.activeTab === idx) return;
        self.activeTab = idx;
        self._refresh();
      });

      bar.appendChild(tab);
    });
    return bar;
  };

  SignlBundleBuilder.prototype._renderCategory = function (cat, num) {
    var self = this;
    var slotSel = self.selections[cat.id] || {};
    var slotTotal = Object.values(slotSel).reduce(function (s, x) { return s + x.qty; }, 0);
    var done = slotTotal >= cat.minQty;
    var maxQty = cat.maxQty || 0;

    var slotEl = el("div", { className: "signl-bp__slot" });

    var hdr = el("div", { className: "signl-bp__slot-header" });
    var left = el("div", { className: "signl-bp__slot-header-left" });
    var numEl = el("div", { className: "signl-bp__slot-number" + (done ? " signl-bp__slot-number--done" : "") });
    if (done) { numEl.innerHTML = SVG.check; numEl.querySelector("svg").style.cssText = "width:0.875rem;height:0.875rem"; }
    else { numEl.textContent = num + 1; }
    left.appendChild(numEl);
    left.appendChild(el("span", { className: "signl-bp__slot-name" }, cat.name));
    hdr.appendChild(left);

    var reqText = maxQty > 0
      ? "Choose " + cat.minQty + "\u2013" + maxQty
      : "Choose at least " + cat.minQty;
    hdr.appendChild(el("span", { className: "signl-bp__slot-req" }, reqText));
    hdr.appendChild(el("span", {
      className: "signl-bp__slot-progress" + (done ? " signl-bp__slot-progress--done" : "")
    }, slotTotal + "/" + cat.minQty + " selected"));
    slotEl.appendChild(hdr);

    var body = el("div", { className: "signl-bp__slot-body" });
    var grid = el("div", { className: "signl-bp__products" });

    if (!cat.products.length) {
      grid.appendChild(el("p", { style: "font-size:0.875rem;color:#6b7280;padding:1rem" }, "No products available in this collection."));
    }

    cat.products.forEach(function (product) {
      var productSel = slotSel[product.id];
      var isSelected = !!productSel && productSel.qty > 0;
      var qty = productSel ? productSel.qty : 0;
      var maxReached = maxQty > 0 && slotTotal >= maxQty && !isSelected;

      var card = el("div", {
        className: "signl-bp__product"
          + (isSelected ? " signl-bp__product--selected" : "")
          + (maxReached ? " signl-bp__product--max-reached" : "")
      });
      card.dataset.productId = product.id;

      var imgWrap = el("div", { className: "signl-bp__product-img-wrap" });
      if (product.productImage) {
        var img = new Image();
        img.alt = product.productTitle;
        img.src = product.productImage;
        imgWrap.appendChild(img);
      } else {
        imgWrap.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="signl-bp__product-img-placeholder"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
      }
      var checkOverlay = el("div", { className: "signl-bp__product-check" });
      checkOverlay.innerHTML = '<div class="signl-bp__product-check-icon">' + SVG.check + "</div>";
      imgWrap.appendChild(checkOverlay);
      card.appendChild(imgWrap);

      var info = el("div", { className: "signl-bp__product-info" });
      info.appendChild(el("span", { className: "signl-bp__product-title" }, product.productTitle));
      card.appendChild(info);

      if (isSelected && product.availableVariants && product.availableVariants.length > 1) {
        var selectedVariantId = productSel ? productSel.resolvedVariantId : null;
        var selectedVariant = product.availableVariants.find(function (v) { return String(v.id) === String(selectedVariantId); });
        if (selectedVariant && selectedVariant.title !== "Default Title") {
          info.appendChild(el("span", { className: "signl-bp__product-variant" }, selectedVariant.title));
        }
      }

      var qtyRow = el("div", { className: "signl-bp__product-qty" });
      var minusBtn = el("button", { className: "signl-bp__qty-btn", type: "button" }, "\u2212");
      if (qty <= 1) minusBtn.disabled = true;
      minusBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        self._decrementProduct(cat, product);
      });
      var qtyVal = el("span", { className: "signl-bp__qty-value" }, String(qty || 1));
      var plusBtn = el("button", { className: "signl-bp__qty-btn", type: "button" }, "+");
      if (maxQty > 0 && slotTotal >= maxQty) plusBtn.disabled = true;
      plusBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        self._incrementProduct(cat, product);
      });
      qtyRow.appendChild(minusBtn);
      qtyRow.appendChild(qtyVal);
      qtyRow.appendChild(plusBtn);
      card.appendChild(qtyRow);

      card.addEventListener("click", function () {
        if (isSelected) {
          self._deselectProduct(cat, product);
        } else {
          self._selectProduct(cat, product);
        }
      });

      grid.appendChild(card);
    });

    body.appendChild(grid);
    slotEl.appendChild(body);
    return slotEl;
  };

  // ── Product selection ───────────────────────────────────────────────────────

  SignlBundleBuilder.prototype._selectProduct = function (cat, product) {
    var self = this;
    var slotSel = self.selections[cat.id];
    var slotTotal = Object.values(slotSel).reduce(function (s, x) { return s + x.qty; }, 0);
    if (cat.maxQty > 0 && slotTotal >= cat.maxQty) return;

    if (product.shopifyVariantId) {
      slotSel[product.id] = { product: product, resolvedVariantId: product.shopifyVariantId, qty: 1 };
      self._refresh();
    } else if (product.availableVariants && product.availableVariants.length) {
      self._showVariantPicker(product, function (variantId) {
        slotSel[product.id] = { product: product, resolvedVariantId: variantId, qty: 1 };
        self._refresh();
      });
    } else {
      self._showError("This product has no available variants. Please contact the store.");
    }
  };

  SignlBundleBuilder.prototype._deselectProduct = function (cat, product) {
    delete this.selections[cat.id][product.id];
    this._refresh();
  };

  SignlBundleBuilder.prototype._incrementProduct = function (cat, product) {
    var slotSel = this.selections[cat.id];
    var slotTotal = Object.values(slotSel).reduce(function (s, x) { return s + x.qty; }, 0);
    if (cat.maxQty > 0 && slotTotal >= cat.maxQty) return;
    if (slotSel[product.id]) { slotSel[product.id].qty++; this._refresh(); }
  };

  SignlBundleBuilder.prototype._decrementProduct = function (cat, product) {
    var slotSel = this.selections[cat.id];
    if (!slotSel[product.id]) return;
    slotSel[product.id].qty--;
    if (slotSel[product.id].qty <= 0) delete slotSel[product.id];
    this._refresh();
  };

  SignlBundleBuilder.prototype._showVariantPicker = function (product, callback) {
    var variants = product.availableVariants || [];
    var overlay = el("div", { className: "signl-bp__variant-overlay" });
    var modal = el("div", { className: "signl-bp__variant-modal" });

    var mHeader = el("div", { className: "signl-bp__variant-modal-header" });
    mHeader.appendChild(el("h4", {}, product.productTitle));
    var closeBtn = el("button", { className: "signl-bp__variant-modal-close", type: "button" }, "\u00d7");
    closeBtn.addEventListener("click", function () { overlay.remove(); });
    mHeader.appendChild(closeBtn);
    modal.appendChild(mHeader);

    var list = el("div", { className: "signl-bp__variant-list" });
    if (!variants.length) {
      list.appendChild(el("p", { style: "font-size:0.875rem;color:#6b7280;text-align:center" }, "No variants available."));
    } else {
      variants.forEach(function (v) {
        var opt = el("div", {
          className: "signl-bp__variant-option" + (!v.available ? " signl-bp__variant-option--unavailable" : "")
        });
        opt.appendChild(el("span", { className: "signl-bp__variant-name" }, v.title));
        if (v.price) {
          var cents = Math.round(parseFloat(v.price) * 100);
          opt.appendChild(el("span", { className: "signl-bp__variant-price" }, formatMoney(cents, null)));
        }
        opt.addEventListener("click", function () { overlay.remove(); callback(v.id); });
        list.appendChild(opt);
      });
    }
    modal.appendChild(list);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) overlay.remove(); });
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  };

  // ── Cart bar ────────────────────────────────────────────────────────────────

  SignlBundleBuilder.prototype._buildCartBar = function () {
    var self = this;
    var totals = self._getTotals();
    var valid = self._allCatsValid();
    var maxTier = self._getMaxTier();
    var discountType = self.discountConfig ? self.discountConfig.discountType : "percentage";

    var bar = el("div", { className: "signl-bp__cart-bar" });

    if (maxTier) {
      var progress = el("div", { className: "signl-bp__progress" });
      var msg = el("div", { className: "signl-bp__progress-msg" });
      msg.innerHTML = SVG.zap;
      var nextTier = self._getNextTier(totals.totalQty);
      if (totals.totalQty === 0) {
        msg.appendChild(document.createTextNode("Add items to start saving!"));
      } else if (nextTier) {
        var needed = nextTier.minQty - totals.totalQty;
        var tierLabel = discountType === "fixed"
          ? "$" + (nextTier.discountValue / 100).toFixed(2) + " off"
          : nextTier.discountValue + "% off";
        msg.appendChild(document.createTextNode("Add " + needed + " more item" + (needed !== 1 ? "s" : "") + " to unlock "));
        msg.appendChild(el("strong", {}, tierLabel));
      } else {
        var activeLabel = discountType === "fixed"
          ? "$" + (totals.discountValue / 100).toFixed(2) + " off"
          : totals.discountValue + "% off";
        msg.appendChild(el("strong", {}, "Max discount unlocked \u2014 " + activeLabel + "!"));
      }
      progress.appendChild(msg);

      var pct = Math.min((totals.totalQty / maxTier.minQty) * 100, 100);
      var track = el("div", { className: "signl-bp__progress-track" });
      track.appendChild(el("div", { className: "signl-bp__progress-fill", style: "width:" + pct + "%" }));
      progress.appendChild(track);

      if (self.discountConfig && self.discountConfig.tiers) {
        var tierLabels = el("div", { className: "signl-bp__progress-tiers" });
        self.discountConfig.tiers.forEach(function (tier) {
          var active = totals.currentTier && totals.currentTier.minQty >= tier.minQty;
          var lbl = discountType === "fixed"
            ? tier.minQty + "+ items \u2014 $" + (tier.discountValue / 100).toFixed(2) + " off"
            : tier.minQty + "+ items \u2014 " + tier.discountValue + "% off";
          tierLabels.appendChild(el("span", {
            className: "signl-bp__progress-tier" + (active ? " signl-bp__progress-tier--active" : "")
          }, lbl));
        });
        progress.appendChild(tierLabels);
      }
      bar.appendChild(progress);
    }

    var addRow = el("div", { className: "signl-bp__add-row" });
    var addBtn = el("button", { className: "signl-bp__add-btn", type: "button" }, [
      el("span", { innerHTML: SVG.cart, style: "display:flex" }),
      document.createTextNode(self.isSubmitting ? "Adding to cart\u2026" : self.ctaText),
    ]);
    if (!valid || self.isSubmitting) addBtn.disabled = true;
    addBtn.addEventListener("click", function () { self._addToCart(); });
    addRow.appendChild(addBtn);

    if (totals.currentTier && totals.discountValue > 0) {
      var savingsWrap = el("div", { style: "text-align:right" });
      savingsWrap.appendChild(el("span", { className: "signl-bp__add-savings" }, [
        el("span", { innerHTML: SVG.tag, style: "display:inline-flex;width:0.75rem;height:0.75rem;vertical-align:middle;margin-right:2px" }),
        document.createTextNode(
          discountType === "fixed"
            ? "Save $" + (totals.discountValue / 100).toFixed(2)
            : "Save " + totals.discountValue + "%"
        ),
      ]));
      addRow.appendChild(savingsWrap);
    }

    bar.appendChild(addRow);
    return bar;
  };

  // ── Add to cart ─────────────────────────────────────────────────────────────

  SignlBundleBuilder.prototype._addToCart = function () {
    if (this.isSubmitting) return;
    var self = this;
    var items = [];

    var discountTiers = (self.discountConfig && self.discountConfig.tiers) ? self.discountConfig.tiers : [];
    var discountType = (self.discountConfig && self.discountConfig.discountType) ? self.discountConfig.discountType : "percentage";
    var hasDiscount = discountTiers.length > 0;

    var bundleProps = {
      "_bundleId": self.bundleId,
      "_discountTiers": hasDiscount ? JSON.stringify(discountTiers) : "[]",
      "_discountType": discountType,
    };

    self.categories.forEach(function (cat) {
      var slotSel = self.selections[cat.id] || {};
      Object.values(slotSel).forEach(function (item) {
        if (item.resolvedVariantId && item.qty > 0) {
          items.push({
            id: item.resolvedVariantId,
            quantity: item.qty,
            properties: bundleProps,
          });
        }
      });
    });

    if (!items.length) {
      self._showError("Please complete your bundle selection before adding to cart.");
      return;
    }

    self.isSubmitting = true;
    self._refresh();
    self._trackEvent("add_to_cart");

    fetch("/cart/add.js", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ items: items }),
    })
      .then(function (res) {
        if (!res.ok) return res.json().then(function (body) { throw new Error(body.description || "Cart add failed"); });
        return res.json();
      })
      .then(function () {
        self.categories.forEach(function (cat) { self.selections[cat.id] = {}; });
        self.isSubmitting = false;
        self._refresh();
        self._showSuccess();

        document.dispatchEvent(new CustomEvent("signl:bundle-added", {
          detail: { bundleId: self.bundleId, items: items },
          bubbles: true,
        }));
        document.dispatchEvent(new CustomEvent("cart:refresh", { bubbles: true }));
        document.dispatchEvent(new CustomEvent("cart-drawer:open", { bubbles: true }));
      })
      .catch(function (err) {
        self.isSubmitting = false;
        self._refresh();
        self._showError(err.message || "Failed to add bundle to cart. Please try again.");
        console.error("SignlBundleBuilder: cart add error", err);
      });
  };

  // ── Notifications ───────────────────────────────────────────────────────────

  SignlBundleBuilder.prototype._showSuccess = function () {
    var bp = this.container.querySelector(".signl-bp");
    if (!bp) return;
    var existing = bp.querySelector(".signl-bp__success");
    if (existing) existing.remove();
    var banner = el("div", { className: "signl-bp__success", role: "status", "aria-live": "polite" }, [
      el("span", { innerHTML: SVG.check, style: "display:flex;width:1.125rem;height:1.125rem;flex-shrink:0" }),
      document.createTextNode("Bundle added to cart!"),
    ]);
    var slots = bp.querySelector(".signl-bp__slots");
    bp.insertBefore(banner, slots || bp.firstChild);
    setTimeout(function () { if (banner.parentNode) banner.remove(); }, 4000);
  };

  SignlBundleBuilder.prototype._showError = function (msg) {
    var existing = this.container.querySelector(".signl-bp__error-banner");
    if (existing) existing.remove();
    var banner = el("div", { className: "signl-bp__error-banner", role: "alert" }, msg);
    this.container.insertBefore(banner, this.container.firstChild);
    setTimeout(function () { if (banner.parentNode) banner.remove(); }, 5000);
  };

  // ── Boot ────────────────────────────────────────────────────────────────────

  function boot() {
    var containers = document.querySelectorAll(".signl-bundle-builder");
    containers.forEach(function (c) {
      if (!c.dataset.signlBuilderInit) {
        c.dataset.signlBuilderInit = "1";
        new SignlBundleBuilder(c);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.SignlBundleBuilder = SignlBundleBuilder;
})();

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

  function extractNumericId(gid) {
    if (!gid) return null;
    var m = gid.match(/\/(\d+)$/);
    return m ? parseInt(m[1], 10) : null;
  }

  function formatMoney(cents, currency) {
    if (currency) {
      try {
        return new Intl.NumberFormat(undefined, { style: "currency", currency: currency }).format(cents / 100);
      } catch (_) {}
    }
    return "$" + (cents / 100).toFixed(2);
  }

  function SignlBundlePicker(container) {
    this.container = container;
    this.shop = container.dataset.shop || "";
    this.productId = container.dataset.productId || "";
    this.appUrl = (container.dataset.appUrl || "").replace(/\/$/, "");
    this.currency = container.dataset.currency || "USD";
    this.selections = {};
    this.activeSlots = {};
    this.enteringBundle = null;
    this.bundles = [];
    this.isSubmitting = false;
    this.init();
  }

  SignlBundlePicker.prototype.init = function () {
    var self = this;
    if (!this.appUrl) {
      this.container.innerHTML = "";
      return;
    }
    var url = this.appUrl + "/api/storefront/bundles"
      + "?shop=" + encodeURIComponent(this.shop)
      + "&productId=" + encodeURIComponent(this.productId);
    fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        self.bundles = data || [];
        if (!self.bundles.length) {
          self.container.innerHTML = "";
          return;
        }
        self.bundles.forEach(function (b) {
          self.selections[b.id] = {};
          b.slots.forEach(function (s) { self.selections[b.id][s.id] = {}; });
          self.activeSlots[b.id] = b.slots.length ? b.slots[0].id : null;
        });
        self.render();
      })
      .catch(function (err) {
        console.error("SignlBundlePicker: fetch error", err);
        self.container.innerHTML = "";
      });
  };

  SignlBundlePicker.prototype.render = function () {
    this.container.innerHTML = "";
    var self = this;
    this.bundles.forEach(function (bundle) {
      self.container.appendChild(self.renderBundle(bundle));
    });
  };

  SignlBundlePicker.prototype.renderBundle = function (bundle) {
    var self = this;
    var root = el("div", { className: "signl-bp" });
    root.dataset.bundleId = bundle.id;

    var maxTier = bundle.discountEnabled !== false ? self.getMaxTier(bundle) : null;
    var header = el("div", { className: "signl-bp__header" });
    var headerContent = el("div", { className: "signl-bp__header-content" });
    headerContent.appendChild(el("h3", { className: "signl-bp__title" }, bundle.name));
    if (bundle.description) {
      headerContent.appendChild(el("p", { className: "signl-bp__subtitle" }, bundle.description));
    }
    header.appendChild(headerContent);
    if (maxTier) {
      var badgeLabel = bundle.discountType === "fixed"
        ? "Save $" + (maxTier.discountValue / 100).toFixed(2)
        : "Up to " + maxTier.discountValue + "% off";
      header.appendChild(el("span", { className: "signl-bp__discount-badge" }, [
        el("span", { innerHTML: SVG.tag, style: "display:flex;width:0.875rem;height:0.875rem" }),
        document.createTextNode(badgeLabel)
      ]));
    }
    root.appendChild(header);

    if (bundle.slots.length >= 1) {
      root.appendChild(self.renderTabBar(bundle));
    }

    var activeSlotId = self.activeSlots[bundle.id];
    var activeSlot = null;
    var activeSlotIdx = 0;
    bundle.slots.forEach(function (s, idx) {
      if (s.id === activeSlotId) { activeSlot = s; activeSlotIdx = idx; }
    });
    if (!activeSlot && bundle.slots.length) { activeSlot = bundle.slots[0]; activeSlotIdx = 0; }

    var slotsWrap = el("div", { className: "signl-bp__slots" });
    if (activeSlot) {
      var slotEl = self.renderSlot(bundle, activeSlot, activeSlotIdx + 1);
      slotsWrap.appendChild(slotEl);
    }
    root.appendChild(slotsWrap);

    root.appendChild(self.buildCartBar(bundle));
    return root;
  };

  SignlBundlePicker.prototype.renderTabBar = function (bundle) {
    var self = this;
    var activeSlotId = self.activeSlots[bundle.id];
    var bar = el("div", { className: "signl-bp__tab-bar" });

    bundle.slots.forEach(function (slot) {
      var isActive = slot.id === activeSlotId;
      var slotSel = self.selections[bundle.id][slot.id] || {};
      var slotTotal = Object.values(slotSel).reduce(function (s, x) { return s + x.qty; }, 0);
      var done = slotTotal >= slot.minQty;

      var tabClass = "signl-bp__tab";
      if (isActive) tabClass += " signl-bp__tab--active";
      if (done) tabClass += " signl-bp__tab--done";
      if (!slot.imageUrl) tabClass += " signl-bp__tab--text-only";

      var tab = el("button", { className: tabClass, type: "button" });

      if (slot.imageUrl) {
        var img = new Image();
        img.src = slot.imageUrl;
        img.alt = slot.name;
        tab.appendChild(img);
      }

      tab.appendChild(document.createTextNode(slot.name));

      var indicator = el("span", { className: done ? "signl-bp__tab-check" : "signl-bp__tab-progress" });
      if (done) {
        indicator.innerHTML = SVG.check;
      } else if (slotTotal > 0) {
        indicator.textContent = slotTotal + "/" + slot.minQty;
      }
      if (done || slotTotal > 0) tab.appendChild(indicator);

      tab.addEventListener("click", function () {
        if (self.activeSlots[bundle.id] === slot.id) return;
        self.activeSlots[bundle.id] = slot.id;

        var bundleEl = self.container.querySelector('[data-bundle-id="' + bundle.id + '"]');
        if (!bundleEl) { self.refresh(); return; }

        var oldSlotsWrap = bundleEl.querySelector(".signl-bp__slots");
        var oldBody = oldSlotsWrap && oldSlotsWrap.querySelector(".signl-bp__slot-body");

        function swapSlot() {
          var activeSlotId = self.activeSlots[bundle.id];
          var newActiveSlot = null;
          var newActiveSlotIdx = 0;
          bundle.slots.forEach(function (s, idx) {
            if (s.id === activeSlotId) { newActiveSlot = s; newActiveSlotIdx = idx; }
          });
          if (!newActiveSlot && bundle.slots.length) { newActiveSlot = bundle.slots[0]; newActiveSlotIdx = 0; }

          var newSlotsWrap = el("div", { className: "signl-bp__slots" });
          if (newActiveSlot) {
            var slotEl = self.renderSlot(bundle, newActiveSlot, newActiveSlotIdx + 1);
            var body = slotEl.querySelector(".signl-bp__slot-body");
            if (body) {
              body.classList.add("signl-bp__slot-body--entering");
              body.addEventListener("animationend", function () {
                body.classList.remove("signl-bp__slot-body--entering");
              }, { once: true });
            }
            newSlotsWrap.appendChild(slotEl);
          }
          if (oldSlotsWrap && oldSlotsWrap.parentNode) {
            oldSlotsWrap.parentNode.replaceChild(newSlotsWrap, oldSlotsWrap);
          }

          var newTabBar = self.renderTabBar(bundle);
          var oldTabBar = bundleEl.querySelector(".signl-bp__tab-bar");
          if (oldTabBar && oldTabBar.parentNode) {
            oldTabBar.parentNode.replaceChild(newTabBar, oldTabBar);
          }
        }

        if (oldBody) {
          oldBody.classList.add("signl-bp__slot-body--exiting");
          oldBody.addEventListener("animationend", function () { swapSlot(); }, { once: true });
        } else {
          swapSlot();
        }
      });

      bar.appendChild(tab);
    });

    return bar;
  };

  SignlBundlePicker.prototype.renderSlot = function (bundle, slot, num) {
    var self = this;
    var slotSel = this.selections[bundle.id][slot.id] || {};
    var slotTotal = Object.values(slotSel).reduce(function (s, x) { return s + x.qty; }, 0);
    var done = slotTotal >= slot.minQty;
    var maxQty = slot.maxQty;

    var slotEl = el("div", { className: "signl-bp__slot" });
    slotEl.dataset.slotId = slot.id;

    var hdr = el("div", { className: "signl-bp__slot-header" });
    var left = el("div", { className: "signl-bp__slot-header-left" });

    var numEl = el("div", { className: "signl-bp__slot-number" + (done ? " signl-bp__slot-number--done" : "") });
    if (done) {
      numEl.innerHTML = SVG.check;
      numEl.querySelector("svg").style.cssText = "width:0.875rem;height:0.875rem";
    } else {
      numEl.textContent = num;
    }
    left.appendChild(numEl);
    left.appendChild(el("span", { className: "signl-bp__slot-name" }, slot.name));
    hdr.appendChild(left);

    var reqText = maxQty
      ? "Choose " + slot.minQty + "\u2013" + maxQty
      : "Choose at least " + slot.minQty;
    hdr.appendChild(el("span", { className: "signl-bp__slot-req" }, reqText));
    hdr.appendChild(el("span", {
      className: "signl-bp__slot-progress" + (done ? " signl-bp__slot-progress--done" : "")
    }, slotTotal + "/" + slot.minQty + " selected"));

    slotEl.appendChild(hdr);

    var body = el("div", { className: "signl-bp__slot-body" });
    var grid = el("div", { className: "signl-bp__products" });

    slot.products.forEach(function (product) {
      var productSel = slotSel[product.id];
      var isSelected = !!productSel && productSel.qty > 0;
      var qty = productSel ? productSel.qty : 0;
      var maxReached = maxQty !== null && maxQty !== undefined && slotTotal >= maxQty && !isSelected;

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
      if (product.variantTitle && product.variantTitle !== "Default Title") {
        info.appendChild(el("span", { className: "signl-bp__product-variant" }, product.variantTitle));
      }
      card.appendChild(info);

      var qtyRow = el("div", { className: "signl-bp__product-qty" });
      var minusBtn = el("button", { className: "signl-bp__qty-btn", type: "button" }, "\u2212");
      if (qty <= 1) minusBtn.disabled = true;
      minusBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        self.decrementProduct(bundle, slot, product);
      });
      var qtyVal = el("span", { className: "signl-bp__qty-value" }, String(qty || 1));
      var plusBtn = el("button", { className: "signl-bp__qty-btn", type: "button" }, "+");
      if (maxQty !== null && maxQty !== undefined && slotTotal >= maxQty) plusBtn.disabled = true;
      plusBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        self.incrementProduct(bundle, slot, product);
      });
      qtyRow.appendChild(minusBtn);
      qtyRow.appendChild(qtyVal);
      qtyRow.appendChild(plusBtn);
      card.appendChild(qtyRow);

      card.addEventListener("click", function () {
        if (isSelected) {
          self.deselectProduct(bundle, slot, product);
        } else {
          self.selectProduct(bundle, slot, product);
        }
      });

      grid.appendChild(card);
    });

    body.appendChild(grid);
    slotEl.appendChild(body);
    return slotEl;
  };

  SignlBundlePicker.prototype.selectProduct = function (bundle, slot, product) {
    var self = this;
    var slotSel = this.selections[bundle.id][slot.id];
    var slotTotal = Object.values(slotSel).reduce(function (s, x) { return s + x.qty; }, 0);
    if (slot.maxQty !== null && slot.maxQty !== undefined && slotTotal >= slot.maxQty) return;

    if (product.shopifyVariantId) {
      var variantNumericId = extractNumericId(product.shopifyVariantId);
      if (!variantNumericId) {
        self.showError("This product variant is not configured. Please contact the store.");
        return;
      }
      slotSel[product.id] = { product: product, resolvedVariantId: variantNumericId, qty: 1 };
      self.refresh();
    } else if (product.availableVariants && product.availableVariants.length) {
      self.showVariantPicker(product, function (variantId) {
        slotSel[product.id] = { product: product, resolvedVariantId: variantId, qty: 1 };
        self.refresh();
      });
    } else {
      self.showError("This product has not been fully configured. Please contact the store.");
    }
  };

  SignlBundlePicker.prototype.deselectProduct = function (bundle, slot, product) {
    delete this.selections[bundle.id][slot.id][product.id];
    this.refresh();
  };

  SignlBundlePicker.prototype.incrementProduct = function (bundle, slot, product) {
    var slotSel = this.selections[bundle.id][slot.id];
    var slotTotal = Object.values(slotSel).reduce(function (s, x) { return s + x.qty; }, 0);
    if (slot.maxQty !== null && slot.maxQty !== undefined && slotTotal >= slot.maxQty) return;
    if (slotSel[product.id]) {
      slotSel[product.id].qty++;
      this.refresh();
    }
  };

  SignlBundlePicker.prototype.decrementProduct = function (bundle, slot, product) {
    var slotSel = this.selections[bundle.id][slot.id];
    if (!slotSel[product.id]) return;
    slotSel[product.id].qty--;
    if (slotSel[product.id].qty <= 0) delete slotSel[product.id];
    this.refresh();
  };

  SignlBundlePicker.prototype.showVariantPicker = function (product, callback) {
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
        var opt = el("div", { className: "signl-bp__variant-option" + (!v.available ? " signl-bp__variant-option--unavailable" : "") });
        opt.appendChild(el("span", { className: "signl-bp__variant-name" }, v.title));
        if (v.price) {
          var cents = Math.round(parseFloat(v.price) * 100);
          opt.appendChild(el("span", { className: "signl-bp__variant-price" }, formatMoney(cents, null)));
        }
        opt.addEventListener("click", function () {
          overlay.remove();
          callback(v.id);
        });
        list.appendChild(opt);
      });
    }
    modal.appendChild(list);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) overlay.remove(); });
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  };

  SignlBundlePicker.prototype.getMaxTier = function (bundle) {
    var tiers = bundle.discountTiers || [];
    if (!tiers.length) return null;
    return tiers.reduce(function (best, t) { return (!best || t.minQty > best.minQty) ? t : best; }, null);
  };

  SignlBundlePicker.prototype.getCurrentTier = function (bundle, total) {
    return (bundle.discountTiers || [])
      .slice().sort(function (a, b) { return b.minQty - a.minQty; })
      .find(function (t) { return total >= t.minQty; }) || null;
  };

  SignlBundlePicker.prototype.getNextTier = function (bundle, total) {
    return (bundle.discountTiers || [])
      .slice().sort(function (a, b) { return a.minQty - b.minQty; })
      .find(function (t) { return t.minQty > total; }) || null;
  };

  SignlBundlePicker.prototype.getTotals = function (bundle) {
    var totalQty = 0;
    var slotSels = this.selections[bundle.id] || {};
    Object.values(slotSels).forEach(function (slotSel) {
      Object.values(slotSel).forEach(function (item) { totalQty += item.qty; });
    });
    var currentTier = this.getCurrentTier(bundle, totalQty);
    return { totalQty: totalQty, currentTier: currentTier, discountValue: currentTier ? currentTier.discountValue : 0 };
  };

  SignlBundlePicker.prototype.allSlotsValid = function (bundle) {
    var slotSels = this.selections[bundle.id] || {};
    return bundle.slots.every(function (slot) {
      var total = Object.values(slotSels[slot.id] || {}).reduce(function (s, x) { return s + x.qty; }, 0);
      return total >= slot.minQty;
    });
  };

  SignlBundlePicker.prototype.buildCartBar = function (bundle) {
    var self = this;
    var totals = self.getTotals(bundle);
    var valid = self.allSlotsValid(bundle);
    var maxTier = bundle.discountEnabled !== false ? self.getMaxTier(bundle) : null;
    var nextTier = bundle.discountEnabled !== false ? self.getNextTier(bundle, totals.totalQty) : null;

    var bar = el("div", { className: "signl-bp__cart-bar" });

    if (maxTier) {
      var progress = el("div", { className: "signl-bp__progress" });
      var msg = el("div", { className: "signl-bp__progress-msg" });
      msg.innerHTML = SVG.zap;
      if (totals.totalQty === 0) {
        msg.appendChild(document.createTextNode("Add items to start saving!"));
      } else if (nextTier) {
        var needed = nextTier.minQty - totals.totalQty;
        var tierLabel = bundle.discountType === "fixed"
          ? "$" + (nextTier.discountValue / 100).toFixed(2) + " off"
          : nextTier.discountValue + "% off";
        msg.appendChild(document.createTextNode("Add " + needed + " more item" + (needed !== 1 ? "s" : "") + " to unlock "));
        msg.appendChild(el("strong", {}, tierLabel));
      } else {
        var activeLabel = bundle.discountType === "fixed"
          ? "$" + (totals.discountValue / 100).toFixed(2) + " off"
          : totals.discountValue + "% off";
        msg.appendChild(el("strong", {}, "Max discount unlocked \u2014 " + activeLabel + "!"));
      }
      progress.appendChild(msg);

      var pct = Math.min((totals.totalQty / maxTier.minQty) * 100, 100);
      var track = el("div", { className: "signl-bp__progress-track" });
      track.appendChild(el("div", { className: "signl-bp__progress-fill", style: "width:" + pct + "%" }));
      progress.appendChild(track);

      var tierLabels = el("div", { className: "signl-bp__progress-tiers" });
      (bundle.discountTiers || []).forEach(function (tier) {
        var active = totals.currentTier && totals.currentTier.minQty >= tier.minQty;
        var lbl = bundle.discountType === "fixed"
          ? tier.minQty + "+ items \u2014 $" + (tier.discountValue / 100).toFixed(2) + " off"
          : tier.minQty + "+ items \u2014 " + tier.discountValue + "% off";
        tierLabels.appendChild(el("span", {
          className: "signl-bp__progress-tier" + (active ? " signl-bp__progress-tier--active" : "")
        }, lbl));
      });
      progress.appendChild(tierLabels);
      bar.appendChild(progress);
    }

    var addRow = el("div", { className: "signl-bp__add-row" });
    var addBtn = el("button", {
      className: "signl-bp__add-btn",
      type: "button"
    }, [
      el("span", { innerHTML: SVG.cart, style: "display:flex" }),
      document.createTextNode(self.isSubmitting ? "Adding to cart\u2026" : "Add Bundle to Cart")
    ]);
    if (!valid || self.isSubmitting) addBtn.disabled = true;
    addBtn.addEventListener("click", function () { self.addToCart(bundle); });
    addRow.appendChild(addBtn);

    if (totals.currentTier && totals.discountValue > 0) {
      var savingsWrap = el("div", { style: "text-align:right" });
      savingsWrap.appendChild(el("span", { className: "signl-bp__add-savings" }, [
        el("span", { innerHTML: SVG.tag, style: "display:inline-flex;width:0.75rem;height:0.75rem;vertical-align:middle;margin-right:2px" }),
        document.createTextNode(
          bundle.discountType === "fixed"
            ? "Save $" + (totals.discountValue / 100).toFixed(2)
            : "Save " + totals.discountValue + "%"
        )
      ]));
      addRow.appendChild(savingsWrap);
    }

    bar.appendChild(addRow);
    return bar;
  };

  SignlBundlePicker.prototype.showSuccess = function (bundleId) {
    var bundleEl = this.container.querySelector('[data-bundle-id="' + bundleId + '"]');
    if (!bundleEl) return;

    var existing = bundleEl.querySelector(".signl-bp__success");
    if (existing) existing.remove();

    var banner = el("div", { className: "signl-bp__success", role: "status", "aria-live": "polite" }, [
      el("span", { innerHTML: SVG.check, style: "display:flex;width:1.125rem;height:1.125rem;flex-shrink:0" }),
      document.createTextNode("Bundle added to cart!")
    ]);
    bundleEl.insertBefore(banner, bundleEl.querySelector(".signl-bp__slots") || bundleEl.firstChild);

    setTimeout(function () { if (banner.parentNode) banner.remove(); }, 4000);
  };

  SignlBundlePicker.prototype.showError = function (msg) {
    var existing = this.container.querySelector(".signl-bp__error-banner");
    if (existing) existing.remove();

    var banner = el("div", { className: "signl-bp__error-banner", role: "alert" }, msg);
    this.container.insertBefore(banner, this.container.firstChild);

    setTimeout(function () { if (banner.parentNode) banner.remove(); }, 5000);
  };

  SignlBundlePicker.prototype.refresh = function () {
    var self = this;
    this.container.innerHTML = "";
    this.bundles.forEach(function (bundle) {
      self.container.appendChild(self.renderBundle(bundle));
    });
  };

  SignlBundlePicker.prototype.addToCart = function (bundle) {
    if (this.isSubmitting) return;
    var slotSels = this.selections[bundle.id] || {};
    var items = [];

    var discountActive = bundle.discountEnabled !== false;
    var bundleProps = {
      "_bundleId": String(bundle.id),
      "_discountTiers": discountActive ? JSON.stringify(bundle.discountTiers || []) : "[]",
      "_discountType": bundle.discountType || "percentage",
    };

    Object.values(slotSels).forEach(function (slotSel) {
      Object.values(slotSel).forEach(function (item) {
        if (item.resolvedVariantId && item.qty > 0) {
          items.push({ id: item.resolvedVariantId, quantity: item.qty, properties: bundleProps });
        }
      });
    });

    if (!items.length) {
      this.showError("Please complete your bundle selection before adding to cart.");
      return;
    }

    this.isSubmitting = true;
    this.refresh();

    var self = this;

    fetch("/cart/add.js", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ items: items })
    })
      .then(function (res) {
        if (!res.ok) return res.json().then(function (body) { throw new Error(body.description || "Cart add failed"); });
        return res.json();
      })
      .then(function () {
        self.selections[bundle.id] = {};
        bundle.slots.forEach(function (s) { self.selections[bundle.id][s.id] = {}; });
        self.isSubmitting = false;
        self.refresh();
        self.showSuccess(bundle.id);

        document.dispatchEvent(new CustomEvent("signl:bundle-added", {
          detail: { bundleId: bundle.id, items: items },
          bubbles: true
        }));
        document.dispatchEvent(new CustomEvent("cart:refresh", { bubbles: true }));
        document.dispatchEvent(new CustomEvent("cart-drawer:open", { bubbles: true }));
      })
      .catch(function (err) {
        self.isSubmitting = false;
        self.refresh();
        self.showError(err.message || "Failed to add bundle to cart. Please try again.");
        console.error("SignlBundlePicker: cart add error", err);
      });
  };

  function boot() {
    var containers = document.querySelectorAll(".signl-bundle-picker");
    containers.forEach(function (c) {
      if (!c.dataset.signlInit) {
        c.dataset.signlInit = "1";
        new SignlBundlePicker(c);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.SignlBundlePicker = SignlBundlePicker;
})();

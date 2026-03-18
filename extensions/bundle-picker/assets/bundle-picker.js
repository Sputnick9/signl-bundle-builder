(function () {
  "use strict";

  /* ── SVG icons ─────────────────────────────────────────────────────── */
  var SVG = {
    check: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 8 6.5 11.5 13 5"/></svg>',
    cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
    zap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
    img: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
  };

  /* ── Helpers ─────────────────────────────────────────────────────────── */
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
    var amt = (cents / 100).toFixed(2);
    if (currency) {
      try {
        return new Intl.NumberFormat(undefined, { style: "currency", currency: currency }).format(cents / 100);
      } catch (_) {}
    }
    return "$" + amt;
  }

  /* ── Main class ──────────────────────────────────────────────────────── */
  function SignlBundlePicker(container) {
    this.container = container;
    this.shop = container.dataset.shop || "";
    this.productId = container.dataset.productId || "";
    this.appUrl = (container.dataset.appUrl || "").replace(/\/$/, "");
    this.currency = container.dataset.currency || "USD";

    /* selections: { [bundleId]: { [slotId]: { [productDbId]: { product, resolvedVariantId, qty } } } } */
    this.selections = {};
    this.bundles = [];
    this.bundleEl = null;
    this.activeBundleIdx = 0;
    this.isSubmitting = false;
    this.variantCache = {};

    this._pendingVariantCb = null;

    this.init();
  }

  SignlBundlePicker.prototype.init = function () {
    var self = this;
    if (!this.appUrl) {
      this.container.innerHTML = "";
      return;
    }
    this.fetchBundles()
      .then(function (data) {
        self.bundles = data || [];
        if (!self.bundles.length) {
          self.container.innerHTML = "";
          return;
        }
        /* initialize empty selections */
        self.bundles.forEach(function (b) {
          self.selections[b.id] = {};
          b.slots.forEach(function (s) {
            self.selections[b.id][s.id] = {};
          });
        });
        self.render();
      })
      .catch(function (err) {
        console.error("SignlBundlePicker: fetch error", err);
        self.container.innerHTML = "";
      });
  };

  SignlBundlePicker.prototype.fetchBundles = function () {
    var url =
      this.appUrl +
      "/api/storefront/bundles" +
      "?shop=" + encodeURIComponent(this.shop) +
      "&productId=" + encodeURIComponent(this.productId);
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  };

  SignlBundlePicker.prototype.fetchVariants = function (productGid) {
    var self = this;
    if (this.variantCache[productGid]) {
      return Promise.resolve(this.variantCache[productGid]);
    }
    var url =
      this.appUrl +
      "/api/storefront/product-variants" +
      "?shop=" + encodeURIComponent(this.shop) +
      "&productId=" + encodeURIComponent(productGid);
    return fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        self.variantCache[productGid] = data.variants || [];
        return self.variantCache[productGid];
      });
  };

  /* ── Rendering ───────────────────────────────────────────────────────── */
  SignlBundlePicker.prototype.render = function () {
    this.container.innerHTML = "";
    var self = this;
    /* If multiple bundles, render each (for now render first active) */
    this.bundles.forEach(function (bundle, idx) {
      var wrap = self.renderBundle(bundle, idx);
      self.container.appendChild(wrap);
    });
  };

  SignlBundlePicker.prototype.renderBundle = function (bundle, idx) {
    var self = this;
    var root = el("div", { className: "signl-bp" });
    root.dataset.bundleId = bundle.id;

    /* Header */
    var maxTier = self.getMaxTier(bundle);
    var header = el("div", { className: "signl-bp__header" });
    var headerContent = el("div", { className: "signl-bp__header-content" });
    headerContent.appendChild(el("h3", { className: "signl-bp__title" }, bundle.name));
    if (bundle.description) {
      headerContent.appendChild(el("p", { className: "signl-bp__subtitle" }, bundle.description));
    }
    header.appendChild(headerContent);
    if (maxTier) {
      var label = bundle.discountType === "fixed"
        ? "Save $" + (maxTier.discountValue / 100).toFixed(2)
        : "Up to " + maxTier.discountValue + "% off";
      header.appendChild(
        el("span", { className: "signl-bp__discount-badge" }, [
          el("span", { innerHTML: SVG.tag, style: "display:flex;width:0.875rem;height:0.875rem" }),
          document.createTextNode(label)
        ])
      );
    }
    root.appendChild(header);

    /* Slots */
    var slotsWrap = el("div", { className: "signl-bp__slots" });
    bundle.slots.forEach(function (slot, slotIdx) {
      slotsWrap.appendChild(self.renderSlot(bundle, slot, slotIdx + 1));
    });
    root.appendChild(slotsWrap);

    /* Cart bar */
    root.appendChild(self.buildCartBar(bundle));

    return root;
  };

  SignlBundlePicker.prototype.renderSlot = function (bundle, slot, num) {
    var self = this;
    var slotSel = this.selections[bundle.id][slot.id] || {};
    var slotTotal = Object.values(slotSel).reduce(function (s, x) { return s + x.qty; }, 0);
    var done = slotTotal >= slot.minQty;
    var maxQty = slot.maxQty;

    var slotEl = el("div", { className: "signl-bp__slot" });
    slotEl.dataset.slotId = slot.id;

    /* Slot header */
    var hdr = el("div", { className: "signl-bp__slot-header" });
    var left = el("div", { className: "signl-bp__slot-header-left" });

    var numEl = el("div", {
      className: "signl-bp__slot-number" + (done ? " signl-bp__slot-number--done" : "")
    });
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
      ? "Choose " + slot.minQty + "–" + maxQty
      : "Choose at least " + slot.minQty;
    hdr.appendChild(el("span", { className: "signl-bp__slot-req" }, reqText));

    var progressEl = el("span", {
      className: "signl-bp__slot-progress" + (done ? " signl-bp__slot-progress--done" : "")
    }, slotTotal + "/" + slot.minQty + " selected");
    hdr.appendChild(progressEl);

    slotEl.appendChild(hdr);

    /* Products */
    var body = el("div", { className: "signl-bp__slot-body" });
    var grid = el("div", { className: "signl-bp__products" });

    slot.products.forEach(function (product) {
      var productSel = slotSel[product.id];
      var isSelected = !!productSel && productSel.qty > 0;
      var qty = productSel ? productSel.qty : 0;

      /* Only disable non-selected cards when max is reached */
      var maxReached = maxQty !== null && maxQty !== undefined && slotTotal >= maxQty && !isSelected;

      var card = el("div", {
        className: "signl-bp__product" +
          (isSelected ? " signl-bp__product--selected" : "") +
          (maxReached ? " signl-bp__product--max-reached" : "")
      });
      card.dataset.productId = product.id;

      /* Image */
      var imgWrap = el("div", { className: "signl-bp__product-img-wrap" });
      if (product.productImage) {
        var img = el("img", {});
        img.alt = product.productTitle;
        img.src = product.productImage;
        imgWrap.appendChild(img);
      } else {
        imgWrap.innerHTML = '<svg class="signl-bp__product-img-placeholder" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
      }

      /* Check overlay */
      var check = el("div", { className: "signl-bp__product-check" });
      check.innerHTML = '<div class="signl-bp__product-check-icon">' + SVG.check + "</div>";
      imgWrap.appendChild(check);
      card.appendChild(imgWrap);

      /* Info */
      var info = el("div", { className: "signl-bp__product-info" });
      info.appendChild(el("span", { className: "signl-bp__product-title" }, product.productTitle));
      if (product.variantTitle && product.variantTitle !== "Default Title") {
        info.appendChild(el("span", { className: "signl-bp__product-variant" }, product.variantTitle));
      }
      card.appendChild(info);

      /* Qty controls (visible when selected) */
      var qtyRow = el("div", { className: "signl-bp__product-qty" });
      var minusBtn = el("button", { className: "signl-bp__qty-btn", type: "button" }, "−");
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

      /* Click: toggle selection */
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

  /* ── Selection logic ─────────────────────────────────────────────────── */
  SignlBundlePicker.prototype.selectProduct = function (bundle, slot, product) {
    var self = this;
    var slotSel = this.selections[bundle.id][slot.id];
    var slotTotal = Object.values(slotSel).reduce(function (s, x) { return s + x.qty; }, 0);
    var maxQty = slot.maxQty;

    if (maxQty !== null && maxQty !== undefined && slotTotal >= maxQty) return;

    /* Determine variant */
    if (product.shopifyVariantId) {
      var variantNumericId = extractNumericId(product.shopifyVariantId);
      if (!variantNumericId) {
        alert("This product variant is not configured. Please contact the store.");
        return;
      }
      slotSel[product.id] = { product: product, resolvedVariantId: variantNumericId, qty: 1 };
      self.refresh();
    } else if (product.shopifyProductId) {
      /* Need to pick a variant */
      self.showVariantPicker(product, function (variantId) {
        slotSel[product.id] = { product: product, resolvedVariantId: variantId, qty: 1 };
        self.refresh();
      });
    } else {
      alert("This product is not properly configured.");
    }
  };

  SignlBundlePicker.prototype.deselectProduct = function (bundle, slot, product) {
    delete this.selections[bundle.id][slot.id][product.id];
    this.refresh();
  };

  SignlBundlePicker.prototype.incrementProduct = function (bundle, slot, product) {
    var slotSel = this.selections[bundle.id][slot.id];
    var slotTotal = Object.values(slotSel).reduce(function (s, x) { return s + x.qty; }, 0);
    var maxQty = slot.maxQty;
    if (maxQty !== null && maxQty !== undefined && slotTotal >= maxQty) return;
    if (slotSel[product.id]) {
      slotSel[product.id].qty++;
      this.refresh();
    }
  };

  SignlBundlePicker.prototype.decrementProduct = function (bundle, slot, product) {
    var slotSel = this.selections[bundle.id][slot.id];
    if (!slotSel[product.id]) return;
    slotSel[product.id].qty--;
    if (slotSel[product.id].qty <= 0) {
      delete slotSel[product.id];
    }
    this.refresh();
  };

  /* ── Variant picker ─────────────────────────────────────────────────── */
  SignlBundlePicker.prototype.showVariantPicker = function (product, callback) {
    var self = this;
    var overlay = el("div", { className: "signl-bp__variant-overlay" });
    var modal = el("div", { className: "signl-bp__variant-modal" });

    var mHeader = el("div", { className: "signl-bp__variant-modal-header" });
    mHeader.appendChild(el("h4", {}, product.productTitle));
    var closeBtn = el("button", { className: "signl-bp__variant-modal-close", type: "button" }, "×");
    closeBtn.addEventListener("click", function () { overlay.remove(); });
    mHeader.appendChild(closeBtn);
    modal.appendChild(mHeader);

    var list = el("div", { className: "signl-bp__variant-list" });
    list.innerHTML = "<p style='font-size:0.875rem;color:#6b7280;text-align:center'>Loading variants&hellip;</p>";
    modal.appendChild(list);

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) overlay.remove();
    });

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    self.fetchVariants(product.shopifyProductId)
      .then(function (variants) {
        list.innerHTML = "";
        if (!variants || !variants.length) {
          list.innerHTML = "<p style='font-size:0.875rem;color:#6b7280;text-align:center'>No variants available.</p>";
          return;
        }
        variants.forEach(function (v) {
          var opt = el("div", {
            className: "signl-bp__variant-option" + (!v.available ? " signl-bp__variant-option--unavailable" : "")
          });
          opt.appendChild(el("span", { className: "signl-bp__variant-name" }, v.title));
          if (v.price) {
            var price = parseFloat(v.price) * 100;
            opt.appendChild(el("span", { className: "signl-bp__variant-price" }, formatMoney(price, self.currency)));
          }
          opt.addEventListener("click", function () {
            overlay.remove();
            callback(v.id);
          });
          list.appendChild(opt);
        });
      })
      .catch(function () {
        list.innerHTML = "<p style='font-size:0.875rem;color:#6b7280;text-align:center'>Could not load variants.</p>";
      });
  };

  /* ── Tier / discount helpers ─────────────────────────────────────────── */
  SignlBundlePicker.prototype.getMaxTier = function (bundle) {
    var tiers = bundle.discountTiers || [];
    if (!tiers.length) return null;
    return tiers.reduce(function (best, t) {
      return (!best || t.minQty > best.minQty) ? t : best;
    }, null);
  };

  SignlBundlePicker.prototype.getCurrentTier = function (bundle, total) {
    var tiers = (bundle.discountTiers || []).slice().sort(function (a, b) { return b.minQty - a.minQty; });
    return tiers.find(function (t) { return total >= t.minQty; }) || null;
  };

  SignlBundlePicker.prototype.getNextTier = function (bundle, total) {
    var tiers = (bundle.discountTiers || []).slice().sort(function (a, b) { return a.minQty - b.minQty; });
    return tiers.find(function (t) { return t.minQty > total; }) || null;
  };

  SignlBundlePicker.prototype.getTotals = function (bundle) {
    var self = this;
    var slotSels = this.selections[bundle.id] || {};
    var totalQty = 0;
    Object.values(slotSels).forEach(function (slotSel) {
      Object.values(slotSel).forEach(function (item) { totalQty += item.qty; });
    });
    var currentTier = self.getCurrentTier(bundle, totalQty);
    var discountValue = currentTier ? currentTier.discountValue : 0;
    return { totalQty: totalQty, currentTier: currentTier, discountValue: discountValue };
  };

  SignlBundlePicker.prototype.allSlotsValid = function (bundle) {
    var slotSels = this.selections[bundle.id] || {};
    return bundle.slots.every(function (slot) {
      var slotSel = slotSels[slot.id] || {};
      var total = Object.values(slotSel).reduce(function (s, x) { return s + x.qty; }, 0);
      return total >= slot.minQty;
    });
  };

  /* ── Cart bar ────────────────────────────────────────────────────────── */
  SignlBundlePicker.prototype.buildCartBar = function (bundle) {
    var self = this;
    var totals = self.getTotals(bundle);
    var valid = self.allSlotsValid(bundle);
    var maxTier = self.getMaxTier(bundle);
    var nextTier = self.getNextTier(bundle, totals.totalQty);

    var bar = el("div", { className: "signl-bp__cart-bar" });

    /* Tier progress */
    if (maxTier) {
      var progress = el("div", { className: "signl-bp__progress" });

      /* Message */
      var msg = el("div", { className: "signl-bp__progress-msg" });
      msg.innerHTML = SVG.zap;
      if (totals.totalQty === 0) {
        msg.appendChild(document.createTextNode("Add items to start saving!"));
      } else if (nextTier) {
        var needed = nextTier.minQty - totals.totalQty;
        var label = bundle.discountType === "fixed"
          ? "$" + (nextTier.discountValue / 100).toFixed(2) + " off"
          : nextTier.discountValue + "% off";
        msg.appendChild(document.createTextNode("Add " + needed + " more item" + (needed !== 1 ? "s" : "") + " to unlock "));
        msg.appendChild(el("strong", {}, label));
      } else {
        var activeLabel = bundle.discountType === "fixed"
          ? "$" + (totals.discountValue / 100).toFixed(2) + " off"
          : totals.discountValue + "% off";
        msg.appendChild(el("strong", {}, "Max discount unlocked — " + activeLabel + "!"));
      }
      progress.appendChild(msg);

      /* Progress bar */
      var pct = maxTier ? Math.min((totals.totalQty / maxTier.minQty) * 100, 100) : 0;
      var track = el("div", { className: "signl-bp__progress-track" });
      track.appendChild(el("div", { className: "signl-bp__progress-fill", style: "width:" + pct + "%" }));
      progress.appendChild(track);

      /* Tier labels */
      var tierLabels = el("div", { className: "signl-bp__progress-tiers" });
      (bundle.discountTiers || []).forEach(function (tier) {
        var active = totals.currentTier && totals.currentTier.minQty >= tier.minQty;
        var lbl = bundle.discountType === "fixed"
          ? tier.minQty + "+ items — $" + (tier.discountValue / 100).toFixed(2) + " off"
          : tier.minQty + "+ items — " + tier.discountValue + "% off";
        tierLabels.appendChild(el("span", {
          className: "signl-bp__progress-tier" + (active ? " signl-bp__progress-tier--active" : "")
        }, lbl));
      });
      progress.appendChild(tierLabels);
      bar.appendChild(progress);
    }

    /* Add to cart row */
    var addRow = el("div", { className: "signl-bp__add-row" });
    var btnLabel = self.isSubmitting ? "Adding to cart…" : "Add Bundle to Cart";
    var addBtn = el("button", {
      className: "signl-bp__add-btn",
      type: "button"
    }, [
      el("span", { innerHTML: SVG.cart, style: "display:flex" }),
      document.createTextNode(btnLabel)
    ]);
    if (!valid || self.isSubmitting) addBtn.disabled = true;
    addBtn.addEventListener("click", function () {
      self.addToCart(bundle);
    });
    addRow.appendChild(addBtn);

    if (totals.currentTier && totals.discountValue > 0) {
      var savings = el("div", { style: "text-align:right" });
      savings.appendChild(el("span", { className: "signl-bp__add-savings" }, [
        el("span", { innerHTML: SVG.tag, style: "display:inline-flex;width:0.75rem;height:0.75rem;vertical-align:middle;margin-right:2px" }),
        document.createTextNode(
          bundle.discountType === "fixed"
            ? "Save $" + (totals.discountValue / 100).toFixed(2)
            : "Save " + totals.discountValue + "%"
        )
      ]));
      addRow.appendChild(savings);
    }

    bar.appendChild(addRow);
    return bar;
  };

  /* ── Refresh (re-render) ─────────────────────────────────────────────── */
  SignlBundlePicker.prototype.refresh = function () {
    var self = this;
    this.container.innerHTML = "";
    this.bundles.forEach(function (bundle) {
      self.container.appendChild(self.renderBundle(bundle));
    });
  };

  /* ── Add to cart ─────────────────────────────────────────────────────── */
  SignlBundlePicker.prototype.addToCart = function (bundle) {
    if (this.isSubmitting) return;
    var slotSels = this.selections[bundle.id] || {};
    var items = [];

    Object.values(slotSels).forEach(function (slotSel) {
      Object.values(slotSel).forEach(function (item) {
        if (item.resolvedVariantId && item.qty > 0) {
          /* Merge same variants */
          var existing = items.find(function (i) { return i.id === item.resolvedVariantId; });
          if (existing) {
            existing.quantity += item.qty;
          } else {
            items.push({ id: item.resolvedVariantId, quantity: item.qty });
          }
        }
      });
    });

    if (!items.length) {
      alert("Please complete your bundle selection before adding to cart.");
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
        /* Reset selections for this bundle */
        self.selections[bundle.id] = {};
        bundle.slots.forEach(function (s) { self.selections[bundle.id][s.id] = {}; });
        self.isSubmitting = false;
        self.refresh();

        /* Notify theme (cart drawer open, mini-cart update, etc.) */
        document.dispatchEvent(new CustomEvent("signl:bundle-added", { detail: { bundleId: bundle.id, items: items }, bubbles: true }));

        /* Try to trigger common theme cart updates */
        if (typeof window.Shopify === "object") {
          document.dispatchEvent(new CustomEvent("cart:refresh", { bubbles: true }));
          document.dispatchEvent(new CustomEvent("cart-drawer:open", { bubbles: true }));
        }
      })
      .catch(function (err) {
        self.isSubmitting = false;
        self.refresh();
        alert(err.message || "Failed to add bundle to cart. Please try again.");
        console.error("SignlBundlePicker: cart add error", err);
      });
  };

  /* ── Boot ────────────────────────────────────────────────────────────── */
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

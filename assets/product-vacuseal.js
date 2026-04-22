/* ── VacuSeal Pro product page interactions ── */
(function () {
  'use strict';

  /* ─── Money formatter ─── */
  function formatMoney(cents) {
    if (typeof Shopify !== 'undefined' && Shopify.formatMoney) {
      return Shopify.formatMoney(cents, window.vsMoneyFormat || '{{amount}}');
    }
    const fmt = window.vsMoneyFormat || '€{{amount}}';
    const amount = (cents / 100).toFixed(2);
    return fmt.replace('{{amount}}', amount)
              .replace('{{amount_with_comma_separator}}', amount.replace('.', ','))
              .replace('{{amount_no_decimals}}', Math.floor(cents / 100));
  }

  /* ─── Gallery ─── */
  class VsGallery {
    constructor(el) {
      this.mainImg = el.querySelector('#vs-main-img');
      this.thumbs  = el.querySelectorAll('.vs-thumb');
      if (!this.mainImg || !this.thumbs.length) return;
      this.thumbs.forEach((thumb, i) =>
        thumb.addEventListener('click', () => this.setActive(i))
      );
    }

    setActive(index) {
      const thumb = this.thumbs[index];
      if (!thumb) return;
      if (this.mainImg) {
        if (thumb.dataset.src)    this.mainImg.src    = thumb.dataset.src;
        if (thumb.dataset.srcset) this.mainImg.srcset = thumb.dataset.srcset;
      }
      this.thumbs.forEach((t, i) => t.classList.toggle('vs-active', i === index));
    }
  }

  /* ─── Variant picker ─── */
  class VsVariantPicker {
    constructor(el) {
      this.el       = el;
      this.variants = JSON.parse(el.dataset.variants || '[]');
      const cur     = JSON.parse(el.dataset.currentVariant || 'null');
      this.selectedOptions = cur ? [...cur.options] : [];

      this.form           = document.getElementById('vs-product-form');
      this.variantInput   = this.form && this.form.querySelector('[name="id"]');

      this.priceEl        = document.getElementById('vs-price');
      this.priceOrigEl    = document.getElementById('vs-price-orig');
      this.priceBadgeEl   = document.getElementById('vs-price-badge');
      this.stickyPriceEl  = document.getElementById('vs-sticky-price');
      this.stickyBtnEl    = document.getElementById('vs-sticky-add-btn');
      this.addToCartBtn   = document.getElementById('vs-add-to-cart-btn');

      el.querySelectorAll('.vs-option-group').forEach((group, optionIndex) => {
        group.querySelectorAll('.vs-variant-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            if (btn.disabled) return;
            this.selectedOptions[optionIndex] = btn.dataset.value;

            const label = group.querySelector('.vs-option-selected');
            if (label) label.textContent = btn.dataset.value;

            group.querySelectorAll('.vs-variant-btn').forEach(b => b.classList.remove('vs-selected'));
            btn.classList.add('vs-selected');
            this.updateVariant();
          });
        });
      });
    }

    findVariant(opts) {
      return this.variants.find(v => v.options.every((o, i) => o === opts[i])) || null;
    }

    updateVariant() {
      const variant = this.findVariant(this.selectedOptions);
      if (!variant) return;

      if (this.variantInput) this.variantInput.value = variant.id;

      /* Price */
      const priceStr = formatMoney(variant.price);
      if (this.priceEl)       this.priceEl.textContent = priceStr;
      if (this.stickyPriceEl) this.stickyPriceEl.textContent = priceStr;

      if (variant.compare_at_price && variant.compare_at_price > variant.price) {
        const discount = Math.round((1 - variant.price / variant.compare_at_price) * 100);
        if (this.priceOrigEl)  { this.priceOrigEl.textContent = formatMoney(variant.compare_at_price); this.priceOrigEl.style.display  = ''; }
        if (this.priceBadgeEl) { this.priceBadgeEl.textContent = discount + '% off';                  this.priceBadgeEl.style.display = ''; }
      } else {
        if (this.priceOrigEl)  this.priceOrigEl.style.display  = 'none';
        if (this.priceBadgeEl) this.priceBadgeEl.style.display = 'none';
      }

      /* Availability */
      const sold = !variant.available;
      if (this.addToCartBtn) {
        this.addToCartBtn.disabled    = sold;
        this.addToCartBtn.textContent = sold ? 'Sold Out' : 'Add to Cart';
      }
      if (this.stickyBtnEl) this.stickyBtnEl.disabled = sold;

      /* Update sibling option availability */
      this.refreshOptionStates();
    }

    refreshOptionStates() {
      this.el.querySelectorAll('.vs-option-group').forEach((group, optionIndex) => {
        group.querySelectorAll('.vs-variant-btn').forEach(btn => {
          if (btn.classList.contains('vs-selected')) return;
          const test = [...this.selectedOptions];
          test[optionIndex] = btn.dataset.value;
          const match = this.findVariant(test);
          btn.disabled = !match || !match.available;
        });
      });
    }
  }

  /* ─── Quantity control ─── */
  class VsQty {
    constructor(el) {
      this.valEl     = el.querySelector('.vs-qty-val');
      this.hiddenQty = document.querySelector('#vs-product-form [name="quantity"]');
      el.querySelector('.vs-qty-minus').addEventListener('click', () => this.change(-1));
      el.querySelector('.vs-qty-plus').addEventListener('click',  () => this.change(1));
    }

    get value() { return parseInt(this.valEl.textContent, 10) || 1; }

    change(delta) {
      const next = Math.max(1, this.value + delta);
      this.valEl.textContent  = next;
      if (this.hiddenQty) this.hiddenQty.value = next;
    }
  }

  /* ─── AJAX add to cart ─── */
  function vsAddToCart(variantId, qty) {
    const btn       = document.getElementById('vs-add-to-cart-btn');
    const stickyBtn = document.getElementById('vs-sticky-add-btn');

    const setState = (added) => {
      [btn, stickyBtn].forEach(b => {
        if (!b) return;
        b.disabled = added;
        b.classList.toggle('vs-added', added);
        if (added) {
          b.textContent = '✓ Added to Cart';
        } else {
          b.textContent = b === btn ? 'Add to Cart' : 'Add to Cart';
          b.disabled    = false;
        }
      });
    };

    setState(true);

    fetch('/cart/add.js', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body:    JSON.stringify({ id: variantId, quantity: qty || 1 }),
    })
    .then(r => { if (!r.ok) throw new Error('add failed'); return r.json(); })
    .then(() => {
      setTimeout(() => setState(false), 2200);

      /* Notify theme cart system */
      document.dispatchEvent(new CustomEvent('cart:refresh', { bubbles: true }));
      const drawer = document.querySelector('cart-drawer');
      if (drawer) document.dispatchEvent(new CustomEvent('cart:open', { bubbles: true }));
    })
    .catch(() => {
      setState(false);
      document.getElementById('vs-product-form')?.submit();
    });
  }

  /* ─── Sticky bar ─── */
  class VsStickyBar {
    constructor() {
      this.bar = document.getElementById('vs-sticky-bar');
      if (!this.bar) return;
      window.addEventListener('scroll', () => {
        this.bar.classList.toggle('vs-visible', window.scrollY > 500);
      }, { passive: true });
    }
  }

  /* ─── Scroll reveal ─── */
  class VsScrollReveal {
    constructor() {
      const obs = new IntersectionObserver(
        entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('vs-in'); }),
        { threshold: 0.12 }
      );
      document.querySelectorAll('.vs-reveal').forEach(el => obs.observe(el));
    }
  }

  /* ─── Init ─── */
  function init() {
    const gallery = document.querySelector('.vs-gallery');
    if (gallery) new VsGallery(gallery);

    const picker = document.getElementById('vs-variant-picker');
    if (picker && picker.dataset.variants) new VsVariantPicker(picker);

    const qtyWrap = document.querySelector('.vs-qty-control');
    if (qtyWrap) new VsQty(qtyWrap);

    new VsStickyBar();
    new VsScrollReveal();

    /* Form submit → AJAX */
    const form = document.getElementById('vs-product-form');
    if (form) {
      form.addEventListener('submit', e => {
        e.preventDefault();
        const variantId = form.querySelector('[name="id"]')?.value;
        const qty       = parseInt(form.querySelector('[name="quantity"]')?.value, 10) || 1;
        if (variantId) vsAddToCart(variantId, qty);
      });
    }

    /* Sticky bar button */
    document.getElementById('vs-sticky-add-btn')?.addEventListener('click', () => {
      const f         = document.getElementById('vs-product-form');
      const variantId = f?.querySelector('[name="id"]')?.value;
      const qty       = parseInt(f?.querySelector('[name="quantity"]')?.value, 10) || 1;
      if (variantId) vsAddToCart(variantId, qty);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

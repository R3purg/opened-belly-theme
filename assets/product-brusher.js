/* ── LintAway Pro product page interactions ── */
(function () {
  'use strict';

  /* ─── Money formatter ─── */
  function formatMoney(cents) {
    if (typeof Shopify !== 'undefined' && Shopify.formatMoney) {
      return Shopify.formatMoney(cents, window.pbMoneyFormat || '{{amount}}');
    }
    const fmt = window.pbMoneyFormat || '€{{amount}}';
    const amount = (cents / 100).toFixed(2);
    return fmt.replace('{{amount}}', amount)
              .replace('{{amount_with_comma_separator}}', amount.replace('.', ','))
              .replace('{{amount_no_decimals}}', Math.floor(cents / 100));
  }

  /* ─── Gallery strip ─── */
  class PbGallery {
    constructor() {
      this.cards = document.querySelectorAll('.pb-gallery-card');
      if (!this.cards.length) return;
      this.cards.forEach((card, i) =>
        card.addEventListener('click', () => this.setActive(i))
      );
    }

    setActive(index) {
      this.cards.forEach((c, i) => c.classList.toggle('pb-active', i === index));
    }
  }

  /* ─── Variant picker ─── */
  class PbVariantPicker {
    constructor(el) {
      this.el       = el;
      this.variants = JSON.parse(el.dataset.variants || '[]');
      const cur     = JSON.parse(el.dataset.currentVariant || 'null');
      this.selectedOptions = cur ? [...cur.options] : [];

      this.form         = document.getElementById('pb-product-form');
      this.variantInput = this.form && this.form.querySelector('[name="id"]');

      /* Price elements — purchase section */
      this.priceEl      = document.getElementById('pb-purchase-price');
      this.priceOrigEl  = document.getElementById('pb-purchase-orig');
      this.priceBadgeEl = document.getElementById('pb-purchase-badge');

      /* Price elements — hero */
      this.heroPriceEl      = document.getElementById('pb-hero-price');
      this.heroPriceOrigEl  = document.getElementById('pb-hero-price-orig');
      this.heroPriceBadgeEl = document.getElementById('pb-hero-price-badge');

      /* Sticky */
      this.stickyPriceEl = document.getElementById('pb-sticky-price');

      /* Buttons */
      this.addBtn       = document.getElementById('pb-add-to-cart-btn');
      this.stickyAddBtn = document.getElementById('pb-sticky-add-btn');

      el.querySelectorAll('.pb-option-group').forEach((group, optionIndex) => {
        group.querySelectorAll('.pb-variant-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            if (btn.disabled) return;
            this.selectedOptions[optionIndex] = btn.dataset.value;

            const label = group.querySelector('.pb-option-selected');
            if (label) label.textContent = btn.dataset.value;

            group.querySelectorAll('.pb-variant-btn').forEach(b => b.classList.remove('pb-selected'));
            btn.classList.add('pb-selected');
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

      const priceStr = formatMoney(variant.price);

      /* Purchase section */
      if (this.priceEl) this.priceEl.textContent = priceStr;

      /* Hero */
      if (this.heroPriceEl) this.heroPriceEl.textContent = priceStr;

      /* Sticky */
      if (this.stickyPriceEl) this.stickyPriceEl.textContent = priceStr;

      /* Sale badge */
      if (variant.compare_at_price && variant.compare_at_price > variant.price) {
        const discount = Math.round((1 - variant.price / variant.compare_at_price) * 100);
        const origStr  = formatMoney(variant.compare_at_price);
        const badgeStr = discount + '% off';

        if (this.priceOrigEl)      { this.priceOrigEl.textContent  = origStr;  this.priceOrigEl.style.display  = ''; }
        if (this.priceBadgeEl)     { this.priceBadgeEl.textContent = badgeStr; this.priceBadgeEl.style.display = ''; }
        if (this.heroPriceOrigEl)  { this.heroPriceOrigEl.textContent  = origStr;  this.heroPriceOrigEl.style.display  = ''; }
        if (this.heroPriceBadgeEl) { this.heroPriceBadgeEl.textContent = badgeStr; this.heroPriceBadgeEl.style.display = ''; }
      } else {
        [this.priceOrigEl, this.heroPriceOrigEl].forEach(el => { if (el) el.style.display = 'none'; });
        [this.priceBadgeEl, this.heroPriceBadgeEl].forEach(el => { if (el) el.style.display = 'none'; });
      }

      /* Availability */
      const sold = !variant.available;
      [this.addBtn, this.stickyAddBtn].forEach(btn => {
        if (!btn) return;
        btn.disabled    = sold;
        btn.textContent = sold ? 'Sold Out' : 'Add to Cart';
      });

      this.refreshOptionStates();
    }

    refreshOptionStates() {
      this.el.querySelectorAll('.pb-option-group').forEach((group, optionIndex) => {
        group.querySelectorAll('.pb-variant-btn').forEach(btn => {
          if (btn.classList.contains('pb-selected')) return;
          const test  = [...this.selectedOptions];
          test[optionIndex] = btn.dataset.value;
          const match = this.findVariant(test);
          btn.disabled = !match || !match.available;
        });
      });
    }
  }

  /* ─── Quantity ─── */
  class PbQty {
    constructor(el) {
      this.valEl     = el.querySelector('.pb-qty-val');
      this.hiddenQty = document.querySelector('#pb-product-form [name="quantity"]');
      el.querySelector('.pb-qty-minus').addEventListener('click', () => this.change(-1));
      el.querySelector('.pb-qty-plus').addEventListener('click',  () => this.change(1));
    }

    get value() { return parseInt(this.valEl.textContent, 10) || 1; }

    change(delta) {
      const next = Math.max(1, this.value + delta);
      this.valEl.textContent  = next;
      if (this.hiddenQty) this.hiddenQty.value = next;
    }
  }

  /* ─── AJAX add to cart ─── */
  function pbAddToCart(variantId, qty) {
    const btns = [
      document.getElementById('pb-add-to-cart-btn'),
      document.getElementById('pb-sticky-add-btn'),
      document.getElementById('pb-hero-add-btn'),
    ].filter(Boolean);

    const setState = (added) => {
      btns.forEach(b => {
        b.disabled = added;
        b.classList.toggle('pb-added', added);
        if (added)           b.textContent = '✓ Added to Cart';
        else if (b.id === 'pb-hero-add-btn') b.textContent = 'Add to Cart';
        else                 b.textContent = 'Add to Cart';
        b.disabled = added;
      });
    };

    setState(true);

    fetch('/cart/add.js', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body:    JSON.stringify({ id: variantId, quantity: qty || 1 }),
    })
    .then(r => { if (!r.ok) throw new Error(); return r.json(); })
    .then(() => {
      setTimeout(() => setState(false), 2200);
      document.dispatchEvent(new CustomEvent('cart:refresh', { bubbles: true }));
      const drawer = document.querySelector('cart-drawer');
      if (drawer) document.dispatchEvent(new CustomEvent('cart:open', { bubbles: true }));
    })
    .catch(() => {
      setState(false);
      document.getElementById('pb-product-form')?.submit();
    });
  }

  /* ─── Sticky bar ─── */
  class PbStickyBar {
    constructor() {
      this.bar = document.getElementById('pb-sticky-bar');
      if (!this.bar) return;
      window.addEventListener('scroll', () => {
        this.bar.classList.toggle('pb-visible', window.scrollY > 480);
      }, { passive: true });
    }
  }

  /* ─── Scroll reveal ─── */
  class PbScrollReveal {
    constructor() {
      const obs = new IntersectionObserver(
        entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('pb-in'); }),
        { threshold: 0.1 }
      );
      document.querySelectorAll('.pb-reveal').forEach(el => obs.observe(el));
    }
  }

  /* ─── Init ─── */
  function init() {
    new PbGallery();

    const picker = document.getElementById('pb-variant-picker');
    if (picker && picker.dataset.variants) new PbVariantPicker(picker);

    const qtyEl = document.querySelector('.pb-qty-control');
    if (qtyEl) new PbQty(qtyEl);

    new PbStickyBar();
    new PbScrollReveal();

    /* Form submit → AJAX */
    const form = document.getElementById('pb-product-form');
    if (form) {
      form.addEventListener('submit', e => {
        e.preventDefault();
        const variantId = form.querySelector('[name="id"]')?.value;
        const qty       = parseInt(form.querySelector('[name="quantity"]')?.value, 10) || 1;
        if (variantId) pbAddToCart(variantId, qty);
      });
    }

    /* Hero "Add to Cart" → scroll to purchase section */
    document.getElementById('pb-hero-add-btn')?.addEventListener('click', () => {
      document.getElementById('pb-purchase')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    /* Sticky add to cart */
    document.getElementById('pb-sticky-add-btn')?.addEventListener('click', () => {
      const f         = document.getElementById('pb-product-form');
      const variantId = f?.querySelector('[name="id"]')?.value;
      const qty       = parseInt(f?.querySelector('[name="quantity"]')?.value, 10) || 1;
      if (variantId) pbAddToCart(variantId, qty);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

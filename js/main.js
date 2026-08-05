/* Payband Advisory interactions. Vanilla JS, no dependencies.
   Everything respects prefers-reduced-motion. */

(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* 1. Scroll reveal: sections, cards and callouts fade up as they enter view. */
  function initReveal() {
    if (reduced || !('IntersectionObserver' in window)) return;

    var targets = document.querySelectorAll('main .section, main .card, main .callout');
    targets.forEach(function (el) { el.classList.add('reveal'); });

    document.querySelectorAll('.card-grid').forEach(function (grid) {
      Array.prototype.forEach.call(grid.children, function (card, i) {
        card.style.transitionDelay = (i * 0.12) + 's';
      });
    });

    var ioAlive = false;

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.target === document.body) {
          ioAlive = true;
          io.unobserve(document.body);
          return;
        }
        if (!entry.isIntersecting) return;
        var el = entry.target;
        el.classList.add('revealed');
        io.unobserve(el);
        /* After the entrance finishes, hand transform control to hover effects. */
        window.setTimeout(function () {
          el.classList.add('reveal-done');
          el.style.transitionDelay = '';
        }, 750 + (parseFloat(el.style.transitionDelay || 0) * 1000));
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

    /* Sentinel: body always intersects, so this fires immediately when the
       observer is being serviced. If it has not fired within 3 seconds
       (throttled webview, broken IO), reveal everything rather than leave
       the page blank. */
    io.observe(document.body);
    targets.forEach(function (el) { io.observe(el); });

    window.setTimeout(function () {
      if (ioAlive) return;
      io.disconnect();
      targets.forEach(function (el) {
        el.classList.add('revealed', 'reveal-done');
        el.style.transitionDelay = '';
      });
    }, 3000);
  }

  /* 2. Price count-up: "From £750" counts from 0 when the card appears. */
  function initCountUp() {
    if (reduced || !('IntersectionObserver' in window)) return;

    var prices = document.querySelectorAll('.price');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        animatePrice(entry.target);
      });
    }, { threshold: 0.6 });

    prices.forEach(function (el) {
      var node = el.firstChild;
      if (node && node.nodeType === 3 && /£[\d,]+/.test(node.textContent)) {
        io.observe(el);
      }
    });

    function animatePrice(el) {
      var node = el.firstChild;
      var original = node.textContent;
      var match = original.match(/£([\d,]+)/);
      if (!match) return;
      var target = parseInt(match[1].replace(/,/g, ''), 10);
      var start = null;
      var duration = 900;

      function step(ts) {
        if (!start) start = ts;
        var t = Math.min((ts - start) / duration, 1);
        var eased = 1 - Math.pow(1 - t, 3);
        var value = Math.round(target * eased);
        node.textContent = original.replace(/£[\d,]+/, '£' + value.toLocaleString('en-GB'));
        if (t < 1) window.requestAnimationFrame(step);
      }
      window.requestAnimationFrame(step);
    }
  }

  /* 3. Hero glow parallax: the ambient lights drift with the pointer. */
  function initParallax() {
    if (reduced || !canHover) return;
    var hero = document.querySelector('.hero-dark');
    if (!hero) return;
    var glows = hero.querySelectorAll('.hero-glow');
    if (!glows.length) return;

    var raf = null;
    hero.addEventListener('pointermove', function (e) {
      if (raf) return;
      raf = window.requestAnimationFrame(function () {
        var r = hero.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5;
        var y = (e.clientY - r.top) / r.height - 0.5;
        if (glows[0]) glows[0].style.transform = 'translate(' + (x * 50) + 'px,' + (y * 35) + 'px)';
        if (glows[1]) glows[1].style.transform = 'translate(' + (x * -40) + 'px,' + (y * -25) + 'px)';
        raf = null;
      });
    });
  }

  /* 4. Card tilt: tier cards tip gently towards the pointer. */
  function initTilt() {
    if (reduced || !canHover) return;
    document.querySelectorAll('.card-grid .card').forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        if (!card.classList.contains('reveal-done') && card.classList.contains('reveal')) return;
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5;
        var y = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = 'perspective(800px) rotateX(' + (y * -4) + 'deg) rotateY(' + (x * 5) + 'deg) translateY(-4px)';
      });
      card.addEventListener('pointerleave', function () {
        card.style.transform = '';
      });
    });
  }

  /* 5. Header: solid backdrop fades in once the dark hero is scrolled past. */
  function initHeaderScroll() {
    var header = document.querySelector('.header-overlay');
    if (!header) return;
    var onScroll = function () {
      header.classList.toggle('scrolled', window.scrollY > 40);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }


  /* 6. Form submissions: post to the Payband forms endpoint, then show thanks. */
  function initForms() {
    var endpoint = 'https://script.google.com/macros/s/AKfycbzZI3BI5aonZjQoKFpanAPdDTHlgm56sD4VvzsHXsakJB2xbV2dNgVmDmstumDgHG8/exec';
    var forms = document.querySelectorAll('form.gas-form');
    Array.prototype.forEach.call(forms, function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var data = new FormData(form);
        if (data.get('bot-field')) { window.location.href = 'thanks.html'; return; }
        var body = new URLSearchParams();
        data.forEach(function (v, k) { body.append(k, v); });
        var btn = form.querySelector('button[type="submit"]');
        var label = btn ? btn.textContent : '';
        if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }
        fetch(endpoint, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString()
        }).then(function () {
          window.location.href = 'thanks.html';
        }).catch(function () {
          if (btn) { btn.disabled = false; btn.textContent = label; }
          var err = form.querySelector('.form-error');
          if (!err) {
            err = document.createElement('p');
            err.className = 'form-error';
            err.style.color = '#b3261e';
            err.style.marginTop = '10px';
            form.appendChild(err);
          }
          err.textContent = 'That did not send. Please email us instead and we will reply within one working day.';
        });
      });
    });
  }


  /* 7. Tracker filters: show only the member states matching the chosen status. */
  function initTrackerFilters() {
    var btns = document.querySelectorAll('.tk-btn');
    if (!btns.length) return;
    var rows = document.querySelectorAll('#tk-body tr');
    Array.prototype.forEach.call(btns, function (btn) {
      btn.addEventListener('click', function () {
        var want = btn.getAttribute('data-filter');
        Array.prototype.forEach.call(btns, function (b) { b.classList.toggle('is-on', b === btn); });
        Array.prototype.forEach.call(rows, function (row) {
          var show = (want === 'all') || (row.getAttribute('data-status') === want);
          row.style.display = show ? '' : 'none';
        });
      });
    });
  }

  initReveal();
  initCountUp();
  initParallax();
  initTilt();
  initHeaderScroll();
  initForms();
  initTrackerFilters();
})();

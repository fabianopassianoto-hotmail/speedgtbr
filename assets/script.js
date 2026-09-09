// Keep previously shared homepage section links working.
(function () {
  if (location.pathname !== '/' && location.pathname !== '/index.html') return;
  var routes = {"por-que":"/por-que/","comece-aqui":"/comece-aqui/","regras":"/regras/","temporada-3":"/temporada-3/","hall-da-fama":"/hall-da-fama/","equipe":"/organizadores/","apoie":"/apoie/","depoimentos":"/depoimentos/","regulamento":"/regras/#regulamento","punicoes":"/regras/#punicoes","simgrid":"/comece-aqui/#simgrid","whatsapp":"/comece-aqui/#whatsapp","cadastro":"/comece-aqui/#cadastro","comece-apoie":"/comece-aqui/#comece-apoie","como-funciona":"/#como-funciona"};
  function redirect() {
    var target = routes[location.hash.slice(1)];
    if (target && target !== location.pathname + location.hash) location.replace(target);
  }
  redirect();
  window.addEventListener('hashchange', redirect);
})();

(function () {
    function ready(fn) {
      if (document.readyState !== 'loading') fn();
      else document.addEventListener('DOMContentLoaded', fn);
    }

    function renderIcons() { if (window.lucide) window.lucide.createIcons(); }

    function initHeader() {
      var header = document.getElementById('site-header');
      if (!header) return;
      var update = function () {
        if (window.scrollY > 40) header.classList.add('nav-scrolled');
        else header.classList.remove('nav-scrolled');
      };
      update();
      window.addEventListener('scroll', update, { passive: true });
    }

    function initRulesMenu() {
      var menu = document.querySelector('.rules-menu');
      var toggle = document.getElementById('rules-toggle');
      var mobile = document.querySelector('.rules-mobile');
      var mobileToggle = document.getElementById('rules-mobile-toggle');
      if (menu && toggle) {
        var close = function () {
          menu.classList.remove('is-open');
          toggle.setAttribute('aria-expanded', 'false');
        };
        toggle.addEventListener('click', function (e) {
          e.stopPropagation();
          var open = !menu.classList.contains('is-open');
          menu.classList.toggle('is-open', open);
          toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
        menu.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', close); });
        document.addEventListener('click', function (e) { if (!menu.contains(e.target)) close(); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
      }
      if (mobile && mobileToggle) {
        mobileToggle.addEventListener('click', function () {
          var open = !mobile.classList.contains('is-open');
          mobile.classList.toggle('is-open', open);
          mobileToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
      }
    }

    function initMobileMenu() {
      var btn = document.getElementById('nav-toggle');
      var drawer = document.getElementById('mobile-drawer');
      var iMenu = document.getElementById('nav-icon-menu');
      var iClose = document.getElementById('nav-icon-close');
      if (!btn || !drawer) return;
      var setOpen = function (open) {
        drawer.classList.toggle('is-open', open);
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (iMenu) iMenu.style.display = open ? 'none' : '';
        if (iClose) iClose.style.display = open ? '' : 'none';
      };
      btn.addEventListener('click', function () { setOpen(!drawer.classList.contains('is-open')); });
      drawer.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { setOpen(false); }); });
    }

    function initCountdown() {
      var hosts = document.querySelectorAll('[data-countdown]');
      hosts.forEach(function (host) {
        var target = new Date(host.getAttribute('data-countdown')).getTime();
        var dEl = host.querySelector('[data-cd="d"]');
        var hEl = host.querySelector('[data-cd="h"]');
        var mEl = host.querySelector('[data-cd="m"]');
        var sEl = host.querySelector('[data-cd="s"]');
        var pad = function (n) { return String(n).padStart(2, '0'); };
        var tick = function () {
          var diff = Math.max(0, target - Date.now());
          var days = Math.floor(diff / 86400000); diff -= days * 86400000;
          var hrs  = Math.floor(diff / 3600000);  diff -= hrs  * 3600000;
          var mins = Math.floor(diff / 60000);    diff -= mins * 60000;
          var secs = Math.floor(diff / 1000);
          if (dEl) dEl.textContent = pad(days);
          if (hEl) hEl.textContent = pad(hrs);
          if (mEl) mEl.textContent = pad(mins);
          if (sEl) sEl.textContent = pad(secs);
        };
        tick();
        setInterval(tick, 1000);
      });
    }

    function initScrollReveal() {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add('in-view'); io.unobserve(e.target); }
        });
      }, { threshold: 0.15 });
      document.querySelectorAll('.scroll-reveal').forEach(function (el) { io.observe(el); });
    }

    ready(function () {
      renderIcons();
      initHeader();
      initRulesMenu();
      initMobileMenu();
      initCountdown();
      initScrollReveal();

      try {
        console.log(
          '%c  SPEED GT BRASIL  %c\n\n  site criado por Max Lima  ðŸ\n',
          'background:#60A5FA;color:#0B0B0E;font-family:Saira,sans-serif;font-weight:900;font-size:16px;padding:6px 14px;letter-spacing:0.12em;',
          'color:#C4C4C4;font-family:monospace;font-size:12px;line-height:1.6;'
        );
      } catch (e) {}
    });
  })();


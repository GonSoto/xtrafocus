// Xtra Focus — content script.
// Two mechanisms:
//  1. Settings that map 1:1 to CSS: we mirror them as data-dx-* attributes on <html>
//     and src/hide.css does the rest. Cheap, instant, survives React re-renders.
//  2. Settings that need DOM inspection (ads, badges, "Discover more", tab switching,
//     feed placeholder): a debounced MutationObserver scan marks elements with
//     data-dx-hidden="<reason>", and hide.css hides anything marked.
(() => {
  'use strict';

  const html = document.documentElement;

  // Settings that are handled purely by CSS, keyed to their <html> attribute.
  const ATTRS = {
    hideFeed: 'data-dx-hide-feed',
    hideForYouTab: 'data-dx-hide-foryou',
    hideSidebar: 'data-dx-hide-sidebar',
    hideTrends: 'data-dx-hide-trends',
    hideWhoToFollow: 'data-dx-hide-wtf',
    hidePremium: 'data-dx-hide-premium',
    hideNavExplore: 'data-dx-hide-nav-explore',
    hideNavCommunities: 'data-dx-hide-nav-communities',
    hideNavGrok: 'data-dx-hide-grok',
    hideNavPremium: 'data-dx-hide-nav-premium',
    hideNavJobs: 'data-dx-hide-nav-jobs',
    hideMetrics: 'data-dx-hide-metrics',
    hideDMDrawer: 'data-dx-hide-dm',
    hideAds: 'data-dx-hide-ads'
  };

  // X localizes the ad label; exact-match against the common ones.
  const AD_LABELS = new Set([
    'Ad', 'Promoted',
    'Anuncio', 'Promocionado', 'Publicidad',
    'Anzeige', 'Gesponsert',
    'Sponsorisé', 'Promu',
    'Anúncio', 'Promovido'
  ]);

  const DISCOVER_LABELS = [
    'Discover more', 'More to explore',
    'Descubre más', 'Más para explorar',
    'Mehr entdecken', 'Découvrir plus', 'Descubra mais'
  ];

  let settings = { ...DX_DEFAULTS };
  let pauseUntil = 0;
  let page = '';
  let lastHref = '';
  let forcedFollowing = false;
  let scanTimer = null;

  function isPaused() {
    return pauseUntil > Date.now();
  }

  // Master on/off, factoring in a temporary pause. `settings.enabled` (the
  // user's actual saved preference) is never mutated by pausing.
  function isOn() {
    return settings.enabled && !isPaused();
  }

  function computePage() {
    const p = location.pathname;
    if (p === '/' || p === '/home') return 'home';
    if (p === '/explore' || p.startsWith('/explore/')) return 'explore';
    if (p.includes('/status/')) return 'status';
    return 'other';
  }

  function clearMarks(reason) {
    for (const el of document.querySelectorAll(`[data-dx-hidden="${reason}"]`)) {
      el.removeAttribute('data-dx-hidden');
    }
  }

  // --- JS-driven features -------------------------------------------------

  function isAdArticle(article) {
    // X always renders the "Ad"/"Promoted" disclosure inside the post's own
    // byline row (next to the name/handle/timestamp) — never elsewhere in the
    // body. Scoping to the first byline in the article (i.e. the outer post's
    // own, by document order) means a quote-tweet or reply that merely
    // embeds a promoted tweet further down can't trigger a false match,
    // regardless of whether that embed happens to use a nested <article> tag.
    const byline = article.querySelector('[data-testid="User-Name"]');
    if (!byline) return false;
    for (const span of byline.querySelectorAll('span')) {
      if (AD_LABELS.has(span.textContent.trim())) return true;
    }
    return false;
  }

  function handleAds() {
    if (!settings.hideAds) {
      clearMarks('ad');
      return;
    }
    for (const cell of document.querySelectorAll('[data-testid="cellInnerDiv"]')) {
      const article = cell.querySelector('article');
      const isAd = !!article && isAdArticle(article);
      if (isAd) {
        cell.setAttribute('data-dx-hidden', 'ad');
      } else if (cell.getAttribute('data-dx-hidden') === 'ad') {
        // React recycles timeline nodes; un-mark cells that no longer hold an ad.
        cell.removeAttribute('data-dx-hidden');
      }
    }
  }

  function handleDiscoverMore() {
    if (!settings.hideDiscoverMore || page !== 'status') {
      clearMarks('discover');
      return;
    }
    for (const h of document.querySelectorAll('[data-testid="cellInnerDiv"] h2')) {
      const text = h.textContent.trim();
      if (!DISCOVER_LABELS.some((label) => text.startsWith(label))) continue;
      // Hide the header cell and everything below it — X only appends
      // algorithmic suggestions after this marker on a post page.
      let cell = h.closest('[data-testid="cellInnerDiv"]');
      while (cell) {
        cell.setAttribute('data-dx-hidden', 'discover');
        cell = cell.nextElementSibling;
      }
    }
  }

  function handleBadges() {
    if (!settings.hideBadges) {
      clearMarks('badge');
      return;
    }
    // Unread pills in the left nav are small divs whose only content is a
    // number. Scan both the wide-desktop header nav and the bottom tab bar
    // X switches to at narrower widths, since either may hold it.
    for (const a of document.querySelectorAll(
      'header[role="banner"] a, [data-testid*="AppTabBar"] a'
    )) {
      for (const span of a.querySelectorAll('span')) {
        const text = span.textContent.trim();
        if (!/^\d+\+?$/.test(text)) continue;
        const parent = span.parentElement;
        const target =
          parent && parent.childElementCount === 1 && parent.textContent.trim() === text
            ? parent
            : span;
        target.setAttribute('data-dx-hidden', 'badge');
      }
    }
  }

  // Walk up from a sidebar card to the outermost wrapper that contains nothing
  // else, so hiding it doesn't leave an empty bordered box behind. `stopAt`,
  // if given, halts the climb before absorbing an ancestor that shouldn't be
  // hidden (e.g. one that also wraps the search box).
  function outermostLoneWrapper(el, boundary, stopAt) {
    let target = el;
    let parent = target.parentElement;
    while (
      parent &&
      parent !== boundary &&
      parent.childElementCount === 1 &&
      !(stopAt && stopAt(parent))
    ) {
      target = parent;
      parent = parent.parentElement;
    }
    return target;
  }

  function hasSearchBox(el) {
    return !!el.querySelector('form[role="search"], input[data-testid="SearchBox_Search_Input"]');
  }

  function handleTrends() {
    if (!settings.hideTrends) {
      clearMarks('trend');
      return;
    }
    const sidebar = document.querySelector('[data-testid="sidebarColumn"]');
    if (!sidebar) return;
    const trend = sidebar.querySelector('[data-testid="trend"]');
    if (!trend) return;
    // Find the trends widget's own landmark (a <section>, or a div carrying
    // its own aria-label) — never one that also wraps the search box, which
    // is the shared-wrapper bug this guards against. Mirrors the CSS rule in
    // hide.css as a dynamic fallback for whatever markup X actually serves.
    let node = trend;
    let widget = null;
    while (node && node !== sidebar) {
      if ((node.tagName === 'SECTION' || node.hasAttribute('aria-label')) && !hasSearchBox(node)) {
        widget = node;
        break;
      }
      node = node.parentElement;
    }
    if (widget) {
      outermostLoneWrapper(widget, sidebar, hasSearchBox).setAttribute('data-dx-hidden', 'trend');
    }
  }

  function handleSidebarCards() {
    if (!settings.hideWhoToFollow) clearMarks('card-wtf');
    if (!settings.hidePremium) clearMarks('card-premium');
    const sidebar = document.querySelector('[data-testid="sidebarColumn"]');
    if (!sidebar) return;
    for (const aside of sidebar.querySelectorAll('aside')) {
      if (settings.hideWhoToFollow && aside.querySelector('[data-testid="UserCell"]')) {
        outermostLoneWrapper(aside, sidebar).setAttribute('data-dx-hidden', 'card-wtf');
      } else if (settings.hidePremium && aside.querySelector('a[href^="/i/premium"]')) {
        outermostLoneWrapper(aside, sidebar).setAttribute('data-dx-hidden', 'card-premium');
      }
    }
  }

  function handleDMDrawer() {
    if (!settings.hideDMDrawer) {
      clearMarks('dm');
      return;
    }
    let found = false;
    for (const el of document.querySelectorAll('[data-testid*="Drawer"], [data-testid*="drawer"]')) {
      const id = el.getAttribute('data-testid') || '';
      if (!/dm|chat|message/i.test(id)) continue;
      el.setAttribute('data-dx-hidden', 'dm');
      found = true;
    }
    if (found) return;
    const drawer = findDockedDrawer();
    if (drawer) drawer.setAttribute('data-dx-hidden', 'dm');
  }

  // Fallback for when X renames the drawer's test id: probe the bottom-right
  // corner for a fixed-position panel docked there.
  function findDockedDrawer() {
    const probe = document.elementFromPoint(window.innerWidth - 30, window.innerHeight - 20);
    if (!probe) return null;
    let fixed = null;
    for (let node = probe; node && node !== document.body; node = node.parentElement) {
      if (getComputedStyle(node).position === 'fixed') fixed = node;
    }
    if (!fixed) return null;
    // Never grab the main layout columns, modals, or the video mini-player.
    if (fixed.closest('[data-testid="sidebarColumn"], [data-testid="primaryColumn"], #layers')) return null;
    if (fixed.querySelector('video')) return null;
    const r = fixed.getBoundingClientRect();
    if (window.innerWidth - r.right > 40 || window.innerHeight - r.bottom > 40) return null;
    if (r.width < 200 || r.width > 520) return null;
    if (r.height > window.innerHeight * 0.95) return null;
    return fixed;
  }

  function cleanTitle() {
    if (!settings.hideBadges) return;
    const m = document.title.match(/^\(\d+\+?\)\s*(.*)$/);
    if (m) document.title = m[1];
  }

  function forceFollowingTab() {
    if (!settings.followingOnly || page !== 'home' || forcedFollowing) return;
    const tablist = document.querySelector('main [role="tablist"]');
    if (!tablist) return;
    const tabs = tablist.querySelectorAll('a[role="tab"]');
    if (tabs.length < 2) return;
    forcedFollowing = true;
    // "For You" is always the first tab, "Following" the second.
    if (tabs[1].getAttribute('aria-selected') !== 'true') tabs[1].click();
  }

  function ensurePlaceholder() {
    const want = settings.hideFeed && page === 'home';
    const existing = document.getElementById('dx-zen');
    if (!want) {
      if (existing) existing.remove();
      return;
    }
    const column = document.querySelector('[data-testid="primaryColumn"]');
    if (!column) return;
    if (existing && column.contains(existing)) return;
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.id = 'dx-zen';
    div.innerHTML = `
      <div class="dx-zen-emoji">🌿</div>
      <h2>Timeline hidden</h2>
      <p>You're here on purpose. Search what you came for, check a profile, or close the tab.</p>
      <p class="dx-zen-hint">Toggle "Hide home timeline" in the Xtra Focus popup to bring it back.</p>`;
    column.appendChild(div);
  }

  // --- Orchestration ------------------------------------------------------

  function scan() {
    if (!isOn() || !document.body) return;
    handleAds();
    handleDiscoverMore();
    handleBadges();
    handleTrends();
    handleSidebarCards();
    handleDMDrawer();
    cleanTitle();
    forceFollowingTab();
    ensurePlaceholder();
  }

  function scheduleScan() {
    if (scanTimer) return;
    scanTimer = setTimeout(() => {
      scanTimer = null;
      scan();
    }, 250);
  }

  function checkRoute(force) {
    if (!force && location.href === lastHref) return;
    const navigated = location.href !== lastHref;
    lastHref = location.href;
    if (navigated) forcedFollowing = false;
    page = computePage();
    html.setAttribute('data-dx-page', page);
    if (isOn() && settings.blockExplore && page === 'explore') {
      location.replace(location.origin + '/home');
      return;
    }
    scheduleScan();
  }

  // Re-applies the current on/off + per-toggle state to the DOM. Called
  // whenever settings change, a pause starts/ends, or on init — never mutates
  // settings/pauseUntil itself, just reflects whatever they currently are.
  function refresh() {
    const on = isOn();
    if (on) {
      html.setAttribute('data-dx-on', '');
    } else {
      html.removeAttribute('data-dx-on');
    }
    for (const [key, attr] of Object.entries(ATTRS)) {
      if (on && settings[key]) {
        html.setAttribute(attr, '');
      } else {
        html.removeAttribute(attr);
      }
    }
    if (!on) {
      clearMarks('ad');
      clearMarks('discover');
      clearMarks('badge');
      clearMarks('trend');
      clearMarks('card-wtf');
      clearMarks('card-premium');
      clearMarks('dm');
      const zen = document.getElementById('dx-zen');
      if (zen) zen.remove();
    }
    checkRoute(true);
  }

  function applySettings(next) {
    settings = { ...DX_DEFAULTS, ...next };
    refresh();
  }

  function applyPause(next) {
    pauseUntil = next > Date.now() ? next : 0;
    refresh();
  }

  chrome.storage.sync.get(DX_DEFAULTS, (stored) => applySettings(stored));
  chrome.storage.local.get({ pauseUntil: 0 }, (stored) => applyPause(stored.pauseUntil));

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync') {
      const next = { ...settings };
      for (const [key, change] of Object.entries(changes)) next[key] = change.newValue;
      applySettings(next);
    } else if (area === 'local' && changes.pauseUntil) {
      applyPause(changes.pauseUntil.newValue || 0);
    }
  });

  new MutationObserver(scheduleScan).observe(html, {
    childList: true,
    subtree: true,
    characterData: true
  });

  // X is a SPA: watch soft navigations. The Navigation API catches pushState;
  // the interval is a cheap fallback. The same interval doubles as the pause
  // timer's expiry check, since a pause ending isn't a storage event.
  if (window.navigation) {
    window.navigation.addEventListener('navigate', () => setTimeout(() => checkRoute(false), 0));
  }
  setInterval(() => {
    if (pauseUntil && Date.now() >= pauseUntil) {
      pauseUntil = 0;
      chrome.storage.local.remove('pauseUntil');
      refresh();
    }
    checkRoute(false);
  }, 500);
  checkRoute(true);
})();

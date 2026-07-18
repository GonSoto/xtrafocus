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
  let page = '';
  let lastHref = '';
  let forcedFollowing = false;
  let scanTimer = null;

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
    for (const span of article.querySelectorAll('span')) {
      if (!AD_LABELS.has(span.textContent.trim())) continue;
      // Ignore matches inside the post's own text (someone tweeting the word "Ad").
      if (span.closest('[data-testid="tweetText"]')) continue;
      return true;
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
    // Unread pills in the left nav are small divs whose only content is a number.
    for (const a of document.querySelectorAll('header[role="banner"] a')) {
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
  // else, so hiding it doesn't leave an empty bordered box behind.
  function outermostLoneWrapper(el, boundary) {
    let target = el;
    let parent = target.parentElement;
    while (parent && parent !== boundary && parent.childElementCount === 1) {
      target = parent;
      parent = parent.parentElement;
    }
    return target;
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
    if (!settings.enabled || !document.body) return;
    handleAds();
    handleDiscoverMore();
    handleBadges();
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
    if (settings.enabled && settings.blockExplore && page === 'explore') {
      location.replace(location.origin + '/home');
      return;
    }
    scheduleScan();
  }

  function applySettings(next) {
    settings = { ...DX_DEFAULTS, ...next };
    if (settings.enabled) {
      html.setAttribute('data-dx-on', '');
    } else {
      html.removeAttribute('data-dx-on');
    }
    for (const [key, attr] of Object.entries(ATTRS)) {
      if (settings.enabled && settings[key]) {
        html.setAttribute(attr, '');
      } else {
        html.removeAttribute(attr);
      }
    }
    if (!settings.enabled) {
      clearMarks('ad');
      clearMarks('discover');
      clearMarks('badge');
      clearMarks('card-wtf');
      clearMarks('card-premium');
      clearMarks('dm');
      const zen = document.getElementById('dx-zen');
      if (zen) zen.remove();
    }
    checkRoute(true);
  }

  chrome.storage.sync.get(DX_DEFAULTS, (stored) => applySettings(stored));

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    const next = { ...settings };
    for (const [key, change] of Object.entries(changes)) next[key] = change.newValue;
    applySettings(next);
  });

  new MutationObserver(scheduleScan).observe(html, {
    childList: true,
    subtree: true,
    characterData: true
  });

  // X is a SPA: watch soft navigations. The Navigation API catches pushState;
  // the interval is a cheap fallback.
  if (window.navigation) {
    window.navigation.addEventListener('navigate', () => setTimeout(() => checkRoute(false), 0));
  }
  setInterval(() => checkRoute(false), 500);
  checkRoute(true);
})();

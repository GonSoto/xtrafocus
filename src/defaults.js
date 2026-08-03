// Single source of truth for every toggle and its default value.
// Loaded by both the content script and the popup.
const DX_DEFAULTS = {
  enabled: true,

  // Home
  hideFeed: false,
  followingOnly: true,
  hideForYouTab: false,

  // Right sidebar
  hideSidebar: false,
  hideTrends: true,
  hideWhoToFollow: true,
  hidePremium: true,
  hideSidebarSearch: false,

  // Left navigation
  hideNavExplore: false,
  hideNavCommunities: true,
  hideNavGrok: true,
  hideNavPremium: true,
  hideNavJobs: true,
  hideBadges: true,

  // Content
  hideAds: true,
  hideDiscoverMore: true,
  hideMetrics: false,
  hideDMDrawer: true,
  blockExplore: false
};

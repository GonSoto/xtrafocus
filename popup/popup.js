// Popup: renders the toggle list from a config array and syncs each switch
// with chrome.storage.sync. The content script listens for changes and applies
// them live.
const SECTIONS = [
  {
    title: 'Home',
    items: [
      ['hideFeed', 'Hide home timeline', 'Replaces the feed with a calm placeholder'],
      ['followingOnly', 'Default to "Following" tab', 'Auto-switches away from the algorithmic feed'],
      ['hideForYouTab', 'Hide "For You" tab', '']
    ]
  },
  {
    title: 'Right sidebar',
    items: [
      ['hideSidebar', 'Hide entire sidebar', 'Trends, suggestions, search — all of it'],
      ['hideTrends', 'Hide trends', '"What’s happening" card'],
      ['hideWhoToFollow', 'Hide "Who to follow"', 'Sidebar cards and inline feed suggestions'],
      ['hidePremium', 'Hide Premium upsells', '']
    ]
  },
  {
    title: 'Left navigation',
    items: [
      ['hideNavExplore', 'Hide Explore', ''],
      ['hideNavCommunities', 'Hide Communities', ''],
      ['hideNavGrok', 'Hide Grok', 'Everywhere: nav, buttons, drawer'],
      ['hideNavPremium', 'Hide Premium & Verified Orgs', ''],
      ['hideNavJobs', 'Hide Jobs', ''],
      ['hideBadges', 'Hide notification badges', 'Also strips the "(3)" count from the tab title']
    ]
  },
  {
    title: 'Content',
    items: [
      ['hideAds', 'Hide ads', 'Promoted & paid-partnership posts'],
      ['hideDiscoverMore', 'Hide "Discover more"', 'Algorithmic suggestions under posts'],
      ['hideMetrics', 'Hide engagement counts', 'Replies, reposts, likes, views'],
      ['hideDMDrawer', 'Hide message drawer', 'The floating DM bar, bottom-right'],
      ['blockExplore', 'Block Explore page', 'Redirects /explore back to home']
    ]
  }
];

const list = document.getElementById('list');
const master = document.getElementById('master');
const pauseBar = document.getElementById('pauseBar');
const pauseControls = document.getElementById('pauseControls');
const pauseCustomRow = document.getElementById('pauseCustomRow');
const pauseActiveRow = document.getElementById('pauseActiveRow');
const pauseCountdown = document.getElementById('pauseCountdown');
const pause5 = document.getElementById('pause5');
const pauseCustomBtn = document.getElementById('pauseCustomBtn');
const pauseMinutes = document.getElementById('pauseMinutes');
const pauseCustomStart = document.getElementById('pauseCustomStart');
const pauseCustomCancel = document.getElementById('pauseCustomCancel');
const pauseResumeBtn = document.getElementById('pauseResumeBtn');

function buildRow(key, label, hint) {
  const row = document.createElement('label');
  row.className = 'row';

  const labels = document.createElement('span');
  labels.className = 'labels';
  const labelEl = document.createElement('span');
  labelEl.className = 'label';
  labelEl.textContent = label;
  labels.appendChild(labelEl);
  if (hint) {
    const hintEl = document.createElement('span');
    hintEl.className = 'hint';
    hintEl.textContent = hint;
    labels.appendChild(hintEl);
  }

  const sw = document.createElement('span');
  sw.className = 'switch';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.dataset.key = key;
  const slider = document.createElement('span');
  slider.className = 'slider';
  sw.appendChild(input);
  sw.appendChild(slider);

  input.addEventListener('change', () => {
    chrome.storage.sync.set({ [key]: input.checked });
  });

  row.appendChild(labels);
  row.appendChild(sw);
  return row;
}

for (const section of SECTIONS) {
  const title = document.createElement('div');
  title.className = 'section-title';
  title.textContent = section.title;
  list.appendChild(title);
  for (const [key, label, hint] of section.items) {
    list.appendChild(buildRow(key, label, hint));
  }
}

master.addEventListener('change', () => {
  chrome.storage.sync.set({ enabled: master.checked });
  list.classList.toggle('off', !master.checked);
  pauseBar.classList.toggle('off', !master.checked);
});

chrome.storage.sync.get(DX_DEFAULTS, (settings) => {
  master.checked = settings.enabled;
  list.classList.toggle('off', !settings.enabled);
  pauseBar.classList.toggle('off', !settings.enabled);
  for (const input of list.querySelectorAll('input[data-key]')) {
    input.checked = !!settings[input.dataset.key];
  }
});

// --- Pause (temporary snooze, independent of the master enable/disable) ---

let countdownTimer = null;

function formatRemaining(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function showPauseControls() {
  clearInterval(countdownTimer);
  countdownTimer = null;
  pauseControls.hidden = false;
  pauseCustomRow.hidden = true;
  pauseActiveRow.hidden = true;
}

function showPauseActive(pauseUntil) {
  pauseControls.hidden = true;
  pauseCustomRow.hidden = true;
  pauseActiveRow.hidden = false;
  clearInterval(countdownTimer);
  const tick = () => {
    const remaining = pauseUntil - Date.now();
    if (remaining <= 0) {
      showPauseControls();
      return;
    }
    pauseCountdown.textContent = formatRemaining(remaining);
  };
  tick();
  countdownTimer = setInterval(tick, 1000);
}

function startPause(minutes) {
  const clamped = Math.min(480, Math.max(1, Math.round(minutes) || 5));
  const pauseUntil = Date.now() + clamped * 60000;
  chrome.storage.local.set({ pauseUntil });
  showPauseActive(pauseUntil);
}

pause5.addEventListener('click', () => startPause(5));

pauseCustomBtn.addEventListener('click', () => {
  pauseCustomRow.hidden = !pauseCustomRow.hidden;
  if (!pauseCustomRow.hidden) pauseMinutes.focus();
});

pauseCustomCancel.addEventListener('click', () => {
  pauseCustomRow.hidden = true;
});

pauseCustomStart.addEventListener('click', () => {
  startPause(Number(pauseMinutes.value));
});

pauseMinutes.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') startPause(Number(pauseMinutes.value));
});

pauseResumeBtn.addEventListener('click', () => {
  chrome.storage.local.remove('pauseUntil');
  showPauseControls();
});

chrome.storage.local.get({ pauseUntil: 0 }, ({ pauseUntil }) => {
  if (pauseUntil > Date.now()) showPauseActive(pauseUntil);
});

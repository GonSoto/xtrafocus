# Xtra Focus

An [Unhook](https://unhook.app/)-style distraction blocker for **X (Twitter)**, built as a
Chromium extension (Manifest V3). Hide everything you didn't come for — the algorithmic
feed, trends, follow suggestions, ads, Grok, Premium upsells, notification badges — and
keep only what you deem worth it. Every element is an individual toggle.

Xtra Focus is an independent, unofficial project. It is not affiliated with, endorsed
by, or sponsored by X Corp.

## Install (load unpacked)

1. Open `chrome://extensions` (or `edge://extensions`, `brave://extensions`, …).
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked** and select this folder.
4. Pin the icon and open the popup on any `x.com` tab to configure.

Toggles apply **instantly** to open tabs — no reload needed. Settings sync via your
browser profile (`chrome.storage.sync`).

## Toggles

| Section | Toggle | Default |
|---|---|---|
| Home | Hide home timeline (calm placeholder instead) | off |
| Home | Default to "Following" tab (skip the algorithm) | **on** |
| Home | Hide "For You" tab | off |
| Sidebar | Hide entire right sidebar | off |
| Sidebar | Hide trends ("What's happening") | **on** |
| Sidebar | Hide "Who to follow" (sidebar + inline in feed) | **on** |
| Sidebar | Hide Premium upsells | **on** |
| Nav | Hide Explore link | off |
| Nav | Hide Communities | **on** |
| Nav | Hide Grok (nav, drawer, buttons — everywhere) | **on** |
| Nav | Hide Premium & Verified Orgs | **on** |
| Nav | Hide Jobs | **on** |
| Nav | Hide notification badges (incl. tab-title count) | **on** |
| Content | Hide ads (promoted + paid-partnership posts) | **on** |
| Content | Hide "Discover more" suggestions under posts | **on** |
| Content | Hide engagement counts (replies, reposts, likes, views) | off |
| Content | Hide floating message drawer | **on** |
| Content | Block Explore page (redirect to home) | off |

Plus a master switch in the popup header to disable everything at once.

## Pause

Two buttons at the top of the popup let you see the full, unfiltered site temporarily
without touching your saved toggle preferences:

- **Pause 5 min** — one click, resumes automatically.
- **Pause…** — pick a custom number of minutes (up to 8 hours).

While paused, the popup shows a live countdown and a **Resume now** button. The pause
state lives in `chrome.storage.local` (device-local, not synced) and auto-expires on its
own — no need to remember to turn anything back on.

## How it works

- **CSS-driven hiding** ([src/hide.css](src/hide.css)): the content script mirrors your
  settings as `data-dx-*` attributes on `<html>`; every rule is gated on those
  attributes, so toggling is instant and survives X's React re-renders.
- **DOM-driven hiding** ([src/content.js](src/content.js)): things CSS can't detect —
  sponsored posts (a localized "Ad"/"Promoted" label in the byline, or a paid-partnership
  disclosure link — both scoped to skip a quoted/embedded post so quoting a sponsored
  tweet doesn't hide your own), numeric badge pills, "Discover more" sections,
  auto-switching to the Following tab — are handled by a debounced `MutationObserver`
  that marks elements with `data-dx-hidden`.
- **SPA awareness**: X never reloads the page, so a route watcher (Navigation API +
  fallback polling) keeps page-scoped rules (home vs. post vs. explore) accurate.
- **Responsive-layout coverage**: X restructures primary navigation by window width —
  labeled sidebar → icon-only rail → bottom tab bar, plus items can move into the "More"
  flyout menu. Nav-related toggles match on `href`/`data-testid` alone (guarded so they
  never reach into a post's own content), rather than depending on a specific container,
  so they hold up across all of those layouts.

## Caveats

- X ships UI changes frequently; selectors (mostly `data-testid` based) may need
  occasional touch-ups in [src/hide.css](src/hide.css).
- Promoted-post detection matches the localized "Ad/Promoted" byline label for
  EN/ES/DE/FR/PT — add your language to `AD_LABELS` in [src/content.js](src/content.js)
  if needed. Paid-partnership detection matches the disclosure link's URL instead of its
  label text, so it's already locale-independent.
- "Default to Following" assumes Following is the second tab on home (X's default
  layout, also with pinned lists).

## Contact

If you find any bugs, errors or missing features you would like to see in the extension, message me on [X](x.com/gsotooo_) or drop me an email at gonsotomayor@gmail.com

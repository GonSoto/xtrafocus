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
| Content | Hide ads / promoted posts | **on** |
| Content | Hide "Discover more" suggestions under posts | **on** |
| Content | Hide engagement counts (replies, reposts, likes, views) | off |
| Content | Hide floating message drawer | **on** |
| Content | Block Explore page (redirect to home) | off |

Plus a master switch in the popup header to disable everything at once.

## How it works

- **CSS-driven hiding** ([src/hide.css](src/hide.css)): the content script mirrors your
  settings as `data-dx-*` attributes on `<html>`; every rule is gated on those
  attributes, so toggling is instant and survives X's React re-renders.
- **DOM-driven hiding** ([src/content.js](src/content.js)): things CSS can't detect —
  promoted posts (localized "Ad" label), numeric badge pills, "Discover more" sections,
  auto-switching to the Following tab — are handled by a debounced `MutationObserver`
  that marks elements with `data-dx-hidden`.
- **SPA awareness**: X never reloads the page, so a route watcher (Navigation API +
  fallback polling) keeps page-scoped rules (home vs. post vs. explore) accurate.

## Caveats

- X ships UI changes frequently; selectors (mostly `data-testid` based) may need
  occasional touch-ups in [src/hide.css](src/hide.css).
- Ad detection matches the localized "Ad/Promoted" label for EN/ES/DE/FR/PT. Add your
  language to `AD_LABELS` in [src/content.js](src/content.js) if needed.
- "Default to Following" assumes Following is the second tab on home (X's default
  layout, also with pinned lists).

## Chrome Web Store submission notes

Checklist for the Developer Dashboard — none of this lives in the extension package itself:

- **Privacy policy URL** — required since the content script runs on x.com/twitter.com.
  Use [PRIVACY.md](PRIVACY.md) (host it via GitHub Pages, or paste it into any static page)
  — it states plainly that no data is collected or transmitted anywhere.
- **Permission justifications** (the Dashboard asks for these in plain English):
  - `storage`: saves the user's own toggle preferences locally / synced across their
    Chrome profile. Nothing else is stored.
  - Host access to `x.com` / `twitter.com`: required to apply CSS and DOM changes that
    hide selected UI elements. The extension never reads, stores, or transmits page
    content, tweets, or credentials.
- **Single purpose statement**: hides distraction-inducing UI elements on X (Twitter),
  configurable per-element by the user.
- **Store listing description**: include a line noting this is an independent project,
  not affiliated with, endorsed by, or sponsored by X Corp — nominative references to
  "X (Twitter)" and "Grok" in the description are descriptive/fair-use, not a claim of
  affiliation.
- **Screenshots / promo tile**: not yet produced — capture 1–2 screenshots of the popup
  and a before/after of a decluttered timeline (recommended: 1280×800), plus an optional
  440×280 small promo tile.

## Contact

If you find any bugs, errors or missing features you would like to see in the extension, message me on [X](x.com/gsotooo_) or drop me an email at gonsotomayor@gmail.com

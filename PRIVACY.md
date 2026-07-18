# Privacy Policy — Xtra Focus

_Last updated: 2026-07-18_

Xtra Focus is a browser extension that hides distracting UI elements on X (Twitter).
This policy covers the entire extension.

## Data collection

Xtra Focus does not collect, transmit, sell, or share any data, personal or otherwise.

Specifically, the extension:

- Makes **no network requests** of any kind. There is no server, no analytics, no
  telemetry, no crash reporting, and no third-party SDK anywhere in the code.
- Does **not** read, log, or transmit page content, posts, direct messages, account
  information, or browsing history.
- Does **not** use cookies, fingerprinting, or any tracking technology.

## What is stored, and where

The extension stores only your own toggle preferences (on/off switches such as "hide
trends" or "hide ads") using the browser's built-in `chrome.storage.sync` API. This
data:

- Never leaves your browser except via Chrome's own account-sync mechanism, which is
  controlled entirely by you through your Chrome/Google account settings — Xtra Focus
  has no access to it beyond reading and writing your own preference values.
- Contains nothing except boolean toggle states. No personal information is ever
  written to it.

## Permissions

- **storage** — used solely to save your toggle preferences as described above.
- **Host access to x.com / twitter.com** — used solely to run the content script that
  applies CSS/DOM changes hiding selected UI elements on those pages. The script does
  not read or transmit page content.

## Changes to this policy

If this policy changes, the update will be reflected here with a revised date above.

## Contact

Questions about this policy: gonsotomayor@gmail.com or [x.com/gsotooo_](https://x.com/gsotooo_).

## Affiliation

Xtra Focus is an independent, unofficial project. It is not affiliated with, endorsed
by, or sponsored by X Corp.

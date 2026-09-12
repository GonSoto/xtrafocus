# Publishing checklist — Xtra Focus

What's actually left before the Chrome Web Store listing can go live.

---

## Done

- [x] Extension code complete; no TODOs, debug logs, or dead code
- [x] Only `chrome.storage` is used — minimal permission surface (`storage` + host
      access to x.com/twitter.com)
- [x] Dropped the retired `mobile.twitter.com` match from [manifest.json](manifest.json)
- [x] Fixed a popup bug found while capturing screenshots: the pause bar's
      `display: flex` rules were overriding the `hidden` attribute, so all three pause
      rows (buttons, custom input, active countdown) rendered at once instead of one at
      a time. One rule in [popup.css](popup/popup.css) — **re-test the pause flow**
- [x] Developer account ready
- [x] Store assets rendered — five 1280×800 screenshots and two promo tiles, see
      [store-assets/](store-assets/)
- [x] [README.md](README.md) and [PRIVACY.md](PRIVACY.md) written

---

## 1. Privacy policy URL — costs nothing

The Dashboard needs a public URL, not a file. You do **not** need a domain or hosting.

- [ ] Make `github.com/GonSoto/xtrafocus` **public** if it isn't. A private repo means
      the URL 404s for the reviewer, which is an automatic rejection.
- [ ] Paste this as the privacy policy URL:
      `https://github.com/GonSoto/xtrafocus/blob/main/PRIVACY.md`

      GitHub renders it as a readable page, it's free, and it needs zero setup. Plenty of
      published extensions use exactly this. (GitHub Pages would give a prettier URL and
      is also free, but Jekyll won't convert a `.md` without front matter, so it's extra
      fiddling for no review benefit.)
- [ ] Update the `_Last updated:_` date at the top of [PRIVACY.md](PRIVACY.md).
- [ ] Open the URL in a private window to confirm a logged-out visitor sees it.

---

## 2. Screenshots — check the scrub before uploading

All five 1280×800 screenshots are in [store-assets/](store-assets/), including the
before/after pair built from your own captures.

- [ ] Look over `screenshot-4-before.png` once for anything the scrub missed. Replaced:
      every display name and @handle (→ `User-1`…`User-8`), every profile photo (→ the
      default X avatar), and the four trending topics, which were real political and
      sports terms.
- [ ] **Post body text was deliberately left as captured.** It's public, non-personal
      commentary, and keeping it is what makes the shot read as a real screenshot rather
      than a mockup — but the wording is still searchable back to its original authors,
      who now appear as `User-2`…`User-5`. Say the word and I'll swap the text too.
- [ ] Same call on the embedded video (a driving-sim clip watermarked
      `thedrivingfly.com`) — third-party media, incidental to the UI, left in place.
- [ ] The raw captures `home.png` / `home-after.png` still hold everything unscrubbed.
      They're now gitignored so they stay local — keep them, `render.js` needs them as
      input, but never upload or commit them.
- [ ] Both captures are of the **Spanish** UI, so the listing screenshots won't match an
      English store listing. Fine if that doesn't bother you; otherwise recapture in
      English and re-run `node store-assets/render.js` — the redaction coordinates are
      pinned to these exact captures, so new ones need re-measuring.

---

## 3. Listing copy

- [ ] **Category** — Productivity (Workflow & Planning).
- [ ] **Short description**, 132 char max.
- [ ] **Detailed description** — adapt the README. Must include: *"Xtra Focus is an
      independent, unofficial project. It is not affiliated with, endorsed by, or
      sponsored by X Corp."*
- [ ] **Single purpose** (paste): *"Hides distraction-inducing UI elements on X (Twitter),
      configurable per-element by the user."*
- [ ] **Permission justifications** (paste):
  - `storage` — *"Saves the user's own toggle preferences, synced across their own Chrome
    profile. Nothing else is stored and nothing is transmitted."*
  - Host access to `x.com` / `twitter.com` — *"Required to apply the CSS and DOM changes
    that hide selected UI elements on those pages. The extension never reads, stores, or
    transmits page content, posts, or credentials."*
- [ ] **Data usage** — tick that you collect none of the listed types, sign all three
      certification checkboxes. All three are truthful here.

---

## 4. Test before packaging

Fresh Chrome profile, no other extensions.

- [ ] Zero errors on the card at `chrome://extensions`.
- [ ] **Pause flow specifically** — 5 min, custom, Resume now, and that only one pause row
      shows at a time (this is the bug fixed above).
- [ ] Every toggle on and off once; changes apply with no reload.
- [ ] Parent/child locking: "Hide entire sidebar" and "Hide home timeline".
- [ ] Master switch off → site back to normal.
- [ ] Resize through all three nav layouts (sidebar → icon rail → bottom bar).
- [ ] Post permalink, profile, `/explore`, `/notifications`, `/messages`, search.
- [ ] No uncaught console errors on x.com.
- [ ] **Check the floating chat bubble.** In your own `home-after.png` capture — taken
      with the extension on — a round chat button is still sitting bottom-right, even
      though "Hide message drawer" is on by default. The Grok bubble next to it did get
      hidden. Either X renamed that element or it's a separate control the selector
      doesn't match; worth a look before the listing shows it.

---

## 5. Package

`manifest.json` must sit at the zip **root**, with no `.git/`, `.claude/`, or
`store-assets/` inside.

```powershell
$stage = "$env:TEMP\xtrafocus-1.0.0"
Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory $stage | Out-Null
Copy-Item manifest.json, icons, src, popup -Destination $stage -Recurse
Compress-Archive -Path "$stage\*" -DestinationPath "$env:USERPROFILE\Desktop\xtrafocus-1.0.0.zip" -Force
```

- [ ] **Unzip it somewhere fresh and load *that* unpacked** before uploading — catches a
      missing file far more cheaply than a rejection does.

---

## 6. Submit

- [ ] Upload, fill in §3, attach the assets from `store-assets/`.
- [ ] Submit for review. Anywhere from hours to several business days.
- [ ] If rejected: fix, **bump the version** (a resubmission at `1.0.0` is refused),
      resubmit.

---

## 7. After it's live

- [ ] Put the store link at the top of [README.md](README.md), keeping load-unpacked
      below it for developers.
- [ ] Point bug reports at GitHub Issues so they don't all land in your DMs.
- [ ] X ships UI changes often — [src/hide.css](src/hide.css) is the first thing that
      breaks. Plan to re-check selectors periodically.

---

## About `store-assets/`

| File | Use |
|---|---|
| `promo-tile-440x280.png` | Small promo tile (needed for any store featuring) |
| `promo-marquee-1400x560.png` | Marquee tile (optional) |
| `screenshot-1-toggles.png` | Screenshot — the toggle list |
| `screenshot-2-locking.png` | Screenshot — parent/child locking |
| `screenshot-3-pause.png` | Screenshot — pause countdown |
| `screenshot-4-before.png` | Screenshot — real home timeline, scrubbed |
| `screenshot-5-after.png` | Screenshot — same page with the extension on |
| `home.png`, `home-after.png` | Raw unscrubbed captures. Local input only — gitignored, never uploaded |

The popup in screenshots 1–3 is the **real** [popup/](popup/) rendered at its true
340×560, not a mockup — only `chrome.storage` is stubbed to supply the toggle states.
Screenshots 4–5 are your real captures with a redaction layer
(`src/redact-*.html`) positioned over them; every coordinate in those two files is
measured against these specific captures, so replacing the captures means re-measuring.
Edit the copy in `store-assets/src/*.html` and re-render with:

```powershell
node store-assets/render.js
```

Because it renders the live popup, re-running it after any UI change regenerates
accurate screenshots. Don't ship `store-assets/` inside the zip.

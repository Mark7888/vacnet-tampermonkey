# vacnet-tampermonkey

A Tampermonkey userscript that makes the **CS2 VACnet video labeling portal**
(`counter-strike.net/vacnet`) more usable, without changing how it looks or how
labels are submitted.

Written in TypeScript, bundled into a single `.user.js` file with esbuild.

## Features

| Feature | What it does |
| --- | --- |
| **View full context** | The portal pins the player inside a ~10 second window. Tick the checkbox and the whole recording plays and scrubs freely; untick it and the original window is back. |
| **Copy clip link** | Copies the portal link for the current task. Shift-click (or shift + <kbd>Y</kbd>) copies the direct `.webm` URL instead. |
| **Expert view** | Hides the page header, the footer, the "Please watch the clip with audio…" block and the portal logo, then gives the player 80% of the screen width with the verdicts in one clean row underneath. Nothing scrolls: the verdict row shrinks to the height it actually needs and the player takes everything else. Click again (or press <kbd>E</kbd>) to get the normal page back. |
| **Keyboard control** | Play/pause, frame stepping, seeking, speed and volume without touching the mouse — see below. |
| **Clip readout** | Shows your position inside the clip window, how long the window is, where the flagged event sits, and the current speed. |

Everything is remembered per browser, so the settings survive loading the next clip.

## Keyboard shortcuts

Press <kbd>?</kbd> on the page for the same list.

**Playback**

| Keys | Action |
| --- | --- |
| <kbd>Space</kbd> / <kbd>K</kbd> | Play / pause |
| <kbd>←</kbd> / <kbd>→</kbd> | Seek 1s — hold <kbd>Shift</kbd> for 5s, <kbd>Alt</kbd> for 0.1s |
| <kbd>J</kbd> / <kbd>L</kbd> | Seek 5 seconds |
| <kbd>,</kbd> / <kbd>.</kbd> | Step one frame back / forward (pauses) |
| <kbd>0</kbd> / <kbd>Home</kbd> | Jump to the start of the range |
| <kbd>End</kbd> | Jump to the end of the range |
| <kbd>1</kbd>–<kbd>9</kbd> | Jump to 10% – 90% of the range |

**Speed, audio, view**

| Keys | Action |
| --- | --- |
| <kbd>-</kbd> / <kbd>+</kbd> | Slower / faster (0.05x up to 3x) |
| <kbd>Backspace</kbd> | Reset speed to 1x |
| <kbd>↑</kbd> / <kbd>↓</kbd> | Volume up / down |
| <kbd>M</kbd> | Mute / unmute |
| <kbd>F</kbd> | Fullscreen |

**Portal**

| Keys | Action |
| --- | --- |
| <kbd>C</kbd> | Toggle "View full context" |
| <kbd>E</kbd> | Toggle expert view |
| <kbd>Y</kbd> | Copy clip link |
| <kbd>?</kbd> | Show / hide the shortcut list |
| <kbd>Esc</kbd> | Close the shortcut list |

"Range" means the labeled clip window, or the whole recording when **View full
context** is on. Shortcuts are ignored while you type in a text field, so the
portal's own controls keep working.

Shortcuts follow the key your layout actually prints, not its position on a US
keyboard: on a Hungarian layout <kbd>0</kbd> is the key left of <kbd>1</kbd> and
the <kbd>ö</kbd> next to <kbd>9</kbd> stays out of the way.

## Install

Install [Tampermonkey](https://www.tampermonkey.net/) first, then pick a channel
— opening either link shows Tampermonkey's install prompt, and it keeps that
copy up to date from the same URL afterwards.

| Channel | Install link | Updates to |
| --- | --- | --- |
| **Stable** | [`vacnet-enhancer.user.js`](https://github.com/Mark7888/vacnet-tampermonkey/releases/latest/download/vacnet-enhancer.user.js) | every tagged release |
| **Edge** | [`vacnet-enhancer.user.js`](https://raw.githubusercontent.com/Mark7888/vacnet-tampermonkey/dist/vacnet-enhancer.user.js) | every commit on `master` |

Stable comes from the [latest release](https://github.com/Mark7888/vacnet-tampermonkey/releases/latest),
which also carries a `SHA256SUMS` file and a build provenance attestation:

```bash
gh attestation verify vacnet-enhancer.user.js --repo Mark7888/vacnet-tampermonkey
```

Edge is the [`dist`](https://github.com/Mark7888/vacnet-tampermonkey/tree/dist)
branch, rebuilt from `master` on every push. Its version is stamped
`<version>-edge.<date>.<time>`, which sorts below the matching stable release,
so an edge install never gets quietly downgraded. raw.githubusercontent.com
caches for a few minutes, so a fresh build can take that long to show up.

The two channels share a name and namespace, so opening the other channel's link
switches an existing install over rather than adding a second copy.

You can also grab the userscript by hand from a **CI** run's artifacts, or build
it yourself with the steps below.

## Build

```bash
npm ci
npm run build        # -> dist/vacnet-enhancer.user.js (+ .meta.js)
```

Other scripts:

| Command | Purpose |
| --- | --- |
| `npm run watch` | Rebuild on change while developing |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run verify` | Check the built userscript's metadata block |
| `npm run check` | Type-check, build and verify |
| `npm test` | Chromium end-to-end tests (`npx playwright install chromium` first) |

`scripts/build.mjs` takes `--channel=release|edge` and `--version=<version>`;
the defaults are the release channel at the `package.json` version, which is
what a local build gets. The channel only decides which `@downloadURL` and
`@updateURL` land in the metadata block — the bundled code is identical.

## Continuous integration

| Workflow | Runs on | What it does |
| --- | --- | --- |
| [`ci.yml`](.github/workflows/ci.yml) | pushes to `master`, pull requests | Type-check, build, verify, `npm audit`, dependency review, browser tests |
| [`publish-edge.yml`](.github/workflows/publish-edge.yml) | pushes to `master` | Rebuilds the `dist` branch for the edge channel |
| [`release.yml`](.github/workflows/release.yml) | `v*` tags | Builds, attests and publishes the GitHub release |
| [`codeql.yml`](.github/workflows/codeql.yml) | pushes, pull requests, weekly | CodeQL `security-extended` analysis |

To cut a release, tag a commit and push the tag:

```bash
git tag v1.1.0 && git push origin v1.1.0
```

The tag name becomes the userscript's `@version`. A tag with a prerelease
suffix (`v1.1.0-rc.1`) is published as a GitHub prerelease, so it never becomes
the "latest release" that stable installs update to.

### How the pipeline is hardened

* **Fork pull requests can only reach `ci.yml`.** It is triggered by
  `pull_request`, never `pull_request_target`, so a contributor's code runs with
  a read-only token and no access to repository secrets. Nothing in that
  workflow needs write access.
* **Least privilege.** Every workflow starts from `permissions: {}` and each job
  opts into the single scope it needs.
* **Privileged jobs install nothing.** Publishing and releasing happen in
  separate jobs that download the already-built artifact and run only Node's
  standard library, `git` and `gh` — a compromised npm dependency never shares a
  job with a write-capable token.
* **`persist-credentials: false`** on every checkout that does not push, so no
  token is left sitting in `.git/config` while `npm ci` runs lifecycle scripts.
* **No third-party actions.** Only `actions/*` and `github/codeql-action/*`.
  Dependabot keeps both those and the npm dev-dependencies current.
* **Untrusted values never reach a shell.** Anything derived from an event is
  passed through `env:` and quoted; the release tag additionally has to match
  `v<number>.<number>...` before it is used.
* **The published file is verified twice.** `scripts/verify.mjs` re-checks the
  metadata block in the build job and again in the publishing job, against the
  exact bytes about to ship. A wrong `@updateURL` would hand every installed
  copy over to whatever lives at that address, so it is treated as a build
  failure rather than a typo.

Worth setting on the repository itself, since a workflow file cannot: require
approval before running workflows for first-time contributors (*Settings →
Actions → General → Fork pull request workflows*), and protect the `v*` tags and
the `dist` branch from direct pushes.

## How it works

* `src/clamp.ts` — the portal keeps the player inside the clip window with an
  inline `setInterval` that lives in a closure. The script runs at
  `document-start` and wraps `window.setInterval` so that exact callback (found
  by its source and period) can be switched off and on again. Nothing else about
  the portal's player code is touched.
* `src/player.ts` — reads the clip start/end/event timestamps back out of the
  portal's inline script, and talks to the underlying `<video>` element so it
  works with or without video.js.
* `src/ui/expert.ts` — expert view. The portal's stylesheet uses selectors more
  specific than any userscript selector can be (and a few `!important` rules), so
  the layout is applied as inline `!important` declarations on the dozen elements
  that matter, which win regardless of specificity. Every touched element's
  original `style` attribute is stored and put back on the way out, so the portal
  layout is bit-for-bit untouched while expert view is off. A `MutationObserver`
  re-applies it after the portal rewrites the verdict buttons (the Proceed /
  Back stages). The stacked layout only kicks in from 1100x620 upwards — below
  that expert view just clears the page furniture.
* `src/ui/` — toolbar, shortcut modal and toasts. Accent colours are sampled from
  the page at runtime, so the additions follow the site's own palette.
* `test/` — a fixture that reproduces the portal's markup (with a simulated media
  element) plus an end-to-end suite that drives the built userscript in Chromium.

The script never touches the verdict buttons or the submit form: labels are
submitted exactly as the portal intends.

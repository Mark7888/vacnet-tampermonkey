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
| **Hide info** | Collapses the "Please watch the clip with audio…" block and the portal logo row, which otherwise just eat vertical space. Click again (or press <kbd>H</kbd>) to bring them back. |
| **Resizable panels** | Drag the divider between the video column and the verdict column, and the handle under the player to change its height. Both sizes are remembered in `localStorage`. |
| **Reset layout** | Puts the panels back to the portal's own proportions and clears the saved sizes. Double-clicking either handle resets just that handle. |
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
| <kbd>Y</kbd> | Copy clip link |
| <kbd>H</kbd> | Hide / show the info row |
| <kbd>R</kbd> | Reset the panel layout |
| <kbd>?</kbd> | Show / hide the shortcut list |
| <kbd>Esc</kbd> | Close the shortcut list |

"Range" means the labeled clip window, or the whole recording when **View full
context** is on. Shortcuts are ignored while you type in a text field, so the
portal's own controls keep working.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/).
2. Grab `vacnet-enhancer.user.js` from the
   [latest release](https://github.com/Mark7888/vacnet-tampermonkey/releases/latest)
   (or from the **Build** workflow artifacts for an unreleased commit), or build
   it yourself with the steps below.
3. Open the file in Tampermonkey (drag it into the browser, or *Utilities →
   Import*) and confirm the installation.

Tampermonkey update checks use the release assets, so tagged releases are picked
up automatically.

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
| `npm run check` | Type-check and build |
| `npm test` | Chromium end-to-end tests (`npx playwright install chromium` first) |

CI (`.github/workflows/build.yml`) type-checks, builds and runs the browser tests
on every push and pull request, uploads the built userscript as an artifact, and
attaches it to the GitHub release when a `v*` tag is pushed (the tag name becomes
the `@version`).

## How it works

* `src/clamp.ts` — the portal keeps the player inside the clip window with an
  inline `setInterval` that lives in a closure. The script runs at
  `document-start` and wraps `window.setInterval` so that exact callback (found
  by its source and period) can be switched off and on again. Nothing else about
  the portal's player code is touched.
* `src/player.ts` — reads the clip start/end/event timestamps back out of the
  portal's inline script, and talks to the underlying `<video>` element so it
  works with or without video.js.
* `src/ui/` — toolbar, resizable columns, shortcut modal and toasts. Accent
  colours are sampled from the page at runtime, so the additions follow the
  site's own palette.
* `test/` — a fixture that reproduces the portal's markup (with a simulated media
  element) plus an end-to-end suite that drives the built userscript in Chromium.

The script never touches the verdict buttons or the submit form: labels are
submitted exactly as the portal intends.

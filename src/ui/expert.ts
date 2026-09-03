/**
 * Expert view: strips the page down to the player and the verdicts.
 *
 * The layout is applied as inline `!important` declarations on the handful of
 * elements that matter, because the portal's own stylesheet cannot be
 * out-specified from a userscript - see src/ui/patch.ts, which also keeps the
 * originals so leaving expert view puts the page back untouched. Everything
 * below `.verdict-column` is redesigned by src/ui/verdicts.ts.
 */

import { restoreAll, styleAll } from './patch';
import type { Declarations } from './patch';
import { decorateVerdicts, resetVerdicts } from './verdicts';

/** How much of the screen the player gets. */
const PLAYER_WIDTH = '80vw';

/** Below this the stacked layout would do more harm than good. */
const ROOMY = '(min-width: 1100px) and (min-height: 620px)';

/** Page furniture that expert view hides at any screen size. */
const CHROME: [selector: string, styles: Declarations][] = [
	['.PageHeader, .footer-container, .top-section, .top-section-logo', { display: 'none' }],
];

/** The stacked layout, applied only when there is room for it. */
const LAYOUT: [selector: string, styles: Declarations][] = [
	['.page-container', {
		'box-sizing': 'border-box',
		display: 'flex',
		width: '100%',
		'max-width': 'none',
		height: '100vh',
		margin: '0',
		padding: '10px 0 14px',
		overflow: 'hidden',
	}],
	['.flex-row-wrap', {
		display: 'flex',
		'flex-direction': 'column',
		'flex-wrap': 'nowrap',
		'align-items': 'center',
		gap: '10px',
		width: '100%',
		height: '100%',
		'min-height': '0',
		margin: '0',
		padding: '0',
	}],
	// The player takes every pixel the verdict row does not need.
	['.video-column', {
		flex: '1 1 auto',
		display: 'flex',
		'flex-direction': 'column',
		width: PLAYER_WIDTH,
		'max-width': PLAYER_WIDTH,
		'min-width': '0',
		height: 'auto',
		'min-height': '160px',
		margin: '0',
		padding: '0',
	}],
	['.videocontainer', {
		flex: '1 1 auto',
		display: 'flex',
		'flex-direction': 'column',
		width: '100%',
		'max-width': 'none',
		height: 'auto',
		'min-height': '0',
		margin: '0',
		padding: '0',
	}],
	['.videocontainer .video-js, .videocontainer > video', {
		flex: '1 1 auto',
		width: '100%',
		'max-width': 'none',
		height: '100%',
		'max-height': 'none',
		'min-height': '0',
	}],
	['.videocontainer .video-js video', {
		width: '100%',
		height: '100%',
		'max-height': 'none',
		'object-fit': 'contain',
	}],
	// The verdicts take the height they need, and no more.
	['.verdict-column', {
		flex: '0 0 auto',
		width: PLAYER_WIDTH,
		'max-width': PLAYER_WIDTH,
		'min-width': '0',
		height: 'auto',
		'min-height': '0',
		'max-height': '55vh',
		margin: '0',
		padding: '0',
		'overflow-x': 'hidden',
		'overflow-y': 'auto',
	}],
];

let enabled = false;
let roomy: MediaQueryList | null = null;
let observer: MutationObserver | null = null;
let listening = false;
let pending = false;

function apply(): void {
	for (const [selector, styles] of CHROME) styleAll(selector, styles);
	if (!roomy?.matches) return;

	// The document element is not reachable through querySelectorAll below.
	document.documentElement.style.setProperty('overflow', 'hidden', 'important');
	document.body.style.setProperty('overflow', 'hidden', 'important');
	for (const [selector, styles] of LAYOUT) styleAll(selector, styles);
	decorateVerdicts();
}

/** Re-applies the layout after the portal re-renders part of the verdict column. */
function scheduleRefresh(): void {
	if (!enabled || pending) return;
	pending = true;
	window.requestAnimationFrame(() => {
		pending = false;
		if (enabled) apply();
	});
}

function refresh(): void {
	restoreAll();
	resetVerdicts();
	document.documentElement.style.removeProperty('overflow');
	document.body.style.removeProperty('overflow');
	if (enabled) apply();
	// video.js lays its controls out on resize; style changes are invisible to it.
	window.requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
}

export function applyExpertView(value: boolean): void {
	enabled = value;
	document.documentElement.classList.toggle('vnh-expert', value);

	if (!roomy) {
		roomy = window.matchMedia(ROOMY);
		roomy.addEventListener('change', refresh);
	}
	const root = document.querySelector('.page-container');
	if (!observer && root) {
		// The portal rewrites the verdict buttons in place (Proceed / Back) and
		// writes its status line as text, so both kinds of change matter here.
		observer = new MutationObserver(scheduleRefresh);
		observer.observe(root, { childList: true, subtree: true, characterData: true });
	}
	if (!listening && root) {
		// Picking an answer changes no markup at all, only which radio is checked.
		root.addEventListener('change', scheduleRefresh);
		listening = true;
	}

	refresh();
}

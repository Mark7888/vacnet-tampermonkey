/**
 * Expert view: strips the page down to the player and the verdicts.
 *
 * The portal's own stylesheet is not something we can predict or out-specify
 * (several of its rules are more specific than anything a sane userscript
 * selector can be, and some are !important), so the layout is applied as inline
 * `!important` declarations on the handful of elements that matter. Inline
 * !important wins over every stylesheet rule, whatever its specificity. Each
 * element's original `style` attribute is kept so leaving expert view puts the
 * page back exactly as the portal had it.
 */

/** How much of the screen the player gets. */
const PLAYER_WIDTH = '80vw';

/** Below this the stacked layout would do more harm than good. */
const ROOMY = '(min-width: 1100px) and (min-height: 620px)';

type Declarations = Record<string, string>;

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
	['.verdicts-container', {
		'box-sizing': 'border-box',
		width: '100%',
		height: 'auto',
		'min-height': '0',
		'max-height': 'none',
		margin: '0',
		padding: '16px 22px',
	}],
	['.verdicts-container-inner', {
		display: 'grid',
		'grid-template-columns': 'repeat(auto-fit, minmax(200px, 1fr))',
		'align-items': 'start',
		gap: '10px 24px',
		width: '100%',
		height: 'auto',
		'min-height': '0',
		margin: '0',
		padding: '0',
	}],
	['.verdict-block', {
		display: 'flex',
		'flex-direction': 'column',
		gap: '8px',
		'min-width': '0',
		margin: '0',
		padding: '0',
	}],
	['.verdict-desc', {
		display: 'block',
		margin: '0',
		'font-size': 'clamp(12px, 0.68vw, 16px)',
		'line-height': '1.35',
	}],
	['.verdictbuttons', {
		display: 'flex',
		'flex-wrap': 'wrap',
		'justify-content': 'center',
		'align-items': 'center',
		gap: '6px',
		margin: '0',
		padding: '0',
	}],
	['.verdictbutton', { margin: '0' }],
	['.verdictbutton label', { padding: '6px 10px', 'font-size': '12px' }],
	// Second stage: the buttons are replaced by the chosen-label lines.
	['.verdictbuttonslabel, .verdictbuttonsverdictlabel', { margin: '0' }],
	['#submitbuttons', {
		display: 'flex',
		'justify-content': 'center',
		'align-items': 'center',
		gap: '10px',
		margin: '12px 0 0',
		padding: '0',
	}],
	['#statustext', { 'text-align': 'center', margin: '0' }],
];

/** Original `style` attributes of everything we have touched. */
const original = new Map<HTMLElement, string>();

let enabled = false;
let roomy: MediaQueryList | null = null;
let observer: MutationObserver | null = null;
let pending = false;

function patch(groups: [string, Declarations][][]): void {
	for (const group of groups) {
		for (const [selector, styles] of group) {
			for (const node of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
				if (!original.has(node)) original.set(node, node.getAttribute('style') ?? '');
				for (const [property, value] of Object.entries(styles)) {
					node.style.setProperty(property, value, 'important');
				}
			}
		}
	}
}

function restore(): void {
	for (const [node, style] of original) {
		if (style) node.setAttribute('style', style);
		else node.removeAttribute('style');
	}
	original.clear();
}

function apply(): void {
	const groups = [CHROME];
	// The document element is not reachable through querySelectorAll below.
	if (roomy?.matches) {
		document.documentElement.style.setProperty('overflow', 'hidden', 'important');
		document.body.style.setProperty('overflow', 'hidden', 'important');
		groups.push(LAYOUT);
	}
	patch(groups);
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
	restore();
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
	if (!observer) {
		observer = new MutationObserver(scheduleRefresh);
		const root = document.querySelector('.page-container');
		if (root) observer.observe(root, { childList: true, subtree: true });
	}

	refresh();
}

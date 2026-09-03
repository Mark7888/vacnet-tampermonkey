/**
 * All styling for the injected UI. Colours are derived from the portal itself at
 * runtime (see `applyAccentFromPage`) so the additions blend into the site.
 */

import { el } from './util';

const CSS = `
:root {
	--vnh-accent: #d5903a;
	--vnh-text: #c6d4df;
	--vnh-text-dim: #8fa0ad;
	--vnh-panel: rgba(16, 19, 23, 0.78);
	--vnh-panel-solid: #14181d;
	--vnh-border: rgba(198, 212, 223, 0.18);
	--vnh-border-strong: rgba(198, 212, 223, 0.34);
}

.vnh-toolbar {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 8px;
	box-sizing: border-box;
	width: 100%;
	margin: 0 0 8px 0;
	padding: 7px 10px;
	background: var(--vnh-panel);
	border: 1px solid var(--vnh-border);
	border-radius: 3px;
	color: var(--vnh-text);
	font-size: 12px;
	line-height: 1.4;
}

.vnh-toolbar .vnh-spacer { flex: 1 1 auto; }

.vnh-btn {
	appearance: none;
	display: inline-flex;
	align-items: center;
	gap: 6px;
	margin: 0;
	padding: 5px 10px;
	background: rgba(255, 255, 255, 0.05);
	border: 1px solid var(--vnh-border);
	border-radius: 2px;
	color: var(--vnh-text);
	font: inherit;
	font-size: 11px;
	letter-spacing: 0.06em;
	text-transform: uppercase;
	cursor: pointer;
	transition: background-color 0.12s ease, border-color 0.12s ease, color 0.12s ease;
}

.vnh-btn:hover {
	background: rgba(255, 255, 255, 0.11);
	border-color: var(--vnh-border-strong);
	color: #fff;
}

.vnh-btn:active { background: rgba(255, 255, 255, 0.04); }

.vnh-btn[aria-pressed="true"] {
	border-color: var(--vnh-accent);
	color: var(--vnh-accent);
}

.vnh-btn-icon {
	width: 26px;
	justify-content: center;
	padding: 5px 0;
	font-size: 12px;
}

.vnh-check {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 4px 8px 4px 6px;
	border: 1px solid transparent;
	border-radius: 2px;
	cursor: pointer;
	user-select: none;
	white-space: nowrap;
}

.vnh-check:hover { border-color: var(--vnh-border); }
.vnh-check input { accent-color: var(--vnh-accent); margin: 0; cursor: pointer; }
.vnh-check.vnh-on { color: var(--vnh-accent); }

.vnh-readout {
	font-variant-numeric: tabular-nums;
	font-size: 11px;
	color: var(--vnh-text-dim);
	white-space: nowrap;
}

.vnh-readout b { color: var(--vnh-text); font-weight: 600; }
.vnh-warn { color: #d47b6a; }

/*
 * Expert view is applied as inline !important styles (see src/ui/expert.ts),
 * because the portal's own selectors are more specific than anything we could
 * write here. Only our own toolbar needs styling from this side.
 */
html.vnh-expert .vnh-toolbar { margin-bottom: 6px; flex: 0 0 auto; }

/* --- toast ------------------------------------------------------------- */
.vnh-toast {
	position: fixed;
	left: 50%;
	bottom: 48px;
	z-index: 2147483000;
	transform: translate(-50%, 8px);
	padding: 8px 14px;
	background: var(--vnh-panel-solid);
	border: 1px solid var(--vnh-border-strong);
	border-left: 3px solid var(--vnh-accent);
	border-radius: 2px;
	color: var(--vnh-text);
	font-size: 13px;
	pointer-events: none;
	opacity: 0;
	transition: opacity 0.15s ease, transform 0.15s ease;
}

.vnh-toast.vnh-show { opacity: 1; transform: translate(-50%, 0); }

/* --- shortcut help ----------------------------------------------------- */
.vnh-modal {
	position: fixed;
	inset: 0;
	z-index: 2147483001;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(0, 0, 0, 0.62);
}

.vnh-modal[hidden] { display: none; }

.vnh-modal-card {
	width: min(620px, calc(100vw - 40px));
	max-height: calc(100vh - 80px);
	overflow: auto;
	background: var(--vnh-panel-solid);
	border: 1px solid var(--vnh-border-strong);
	border-radius: 3px;
	color: var(--vnh-text);
	box-shadow: 0 18px 48px rgba(0, 0, 0, 0.55);
}

.vnh-modal-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 10px 14px;
	border-bottom: 1px solid var(--vnh-border);
	font-size: 13px;
	letter-spacing: 0.08em;
	text-transform: uppercase;
	color: var(--vnh-accent);
}

.vnh-modal-close {
	cursor: pointer;
	padding: 0 4px;
	color: var(--vnh-text-dim);
	font-size: 15px;
	line-height: 1;
}

.vnh-modal-close:hover { color: #fff; }

.vnh-modal-body { padding: 12px 14px 16px; }

.vnh-keys {
	width: 100%;
	border-collapse: collapse;
	font-size: 12.5px;
}

.vnh-keys td { padding: 4px 6px; vertical-align: top; }
.vnh-keys tr + tr td { border-top: 1px solid rgba(198, 212, 223, 0.08); }
.vnh-keys td:first-child { width: 34%; white-space: nowrap; }
.vnh-keys .vnh-section td {
	padding-top: 12px;
	color: var(--vnh-accent);
	font-size: 11px;
	letter-spacing: 0.08em;
	text-transform: uppercase;
}

.vnh-modal-body kbd {
	display: inline-block;
	min-width: 10px;
	padding: 2px 6px;
	background: rgba(255, 255, 255, 0.07);
	border: 1px solid var(--vnh-border);
	border-bottom-width: 2px;
	border-radius: 3px;
	font-family: inherit;
	font-size: 11px;
	color: #fff;
}

.vnh-note { margin: 12px 0 0; color: var(--vnh-text-dim); font-size: 11.5px; line-height: 1.5; }
`;

export function injectStyles(): void {
	if (document.getElementById('vnh-styles')) return;
	const style = el('style', { text: CSS });
	style.id = 'vnh-styles';
	(document.head ?? document.documentElement).appendChild(style);
}

/**
 * Picks up the portal's own highlight colour so the accents match the page
 * instead of guessing at Valve's palette.
 */
export function applyAccentFromPage(): void {
	const sample = document.querySelector('.highlight-text')
		?? document.querySelector('.list-title')
		?? document.querySelector('.verdictbuttonslabel');
	if (!sample) return;
	const color = window.getComputedStyle(sample).color;
	if (color && !/rgba?\(\s*0\s*,\s*0\s*,\s*0\s*(,\s*0\s*)?\)/.test(color)) {
		document.documentElement.style.setProperty('--vnh-accent', color);
	}
}

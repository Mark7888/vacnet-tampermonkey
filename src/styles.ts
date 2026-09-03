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
	/* How much of the screen the player takes up in expert view. */
	--vnh-expert-width: 80vw;
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

/* --- expert view ------------------------------------------------------- */
html.vnh-expert .PageHeader,
html.vnh-expert .footer-container,
html.vnh-expert .top-section,
html.vnh-expert .top-section-logo { display: none !important; }

/*
 * The stacked layout only makes sense when there is room for it; on smaller
 * screens expert view just clears the page furniture and leaves the portal's
 * own responsive layout alone.
 */
@media (min-width: 1100px) and (min-height: 620px) {
	html.vnh-expert,
	html.vnh-expert body {
		height: 100%;
		overflow: hidden !important;
	}

	html.vnh-expert .page-container {
		box-sizing: border-box;
		display: flex;
		width: 100% !important;
		max-width: none !important;
		height: 100vh;
		margin: 0 !important;
		padding: 10px 0 14px !important;
		overflow: hidden;
	}

	html.vnh-expert .flex-row-wrap {
		flex-direction: column;
		flex-wrap: nowrap !important;
		align-items: center;
		gap: 10px;
		width: 100%;
		height: 100%;
		min-height: 0;
	}

	html.vnh-expert .video-column {
		flex: 1 1 auto !important;
		display: flex;
		flex-direction: column;
		width: var(--vnh-expert-width) !important;
		max-width: var(--vnh-expert-width) !important;
		min-width: 0;
		min-height: 200px;
		margin: 0 !important;
		padding: 0 !important;
	}

	html.vnh-expert .videocontainer {
		flex: 1 1 auto;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	html.vnh-expert .videocontainer > .vnh-toolbar { flex: 0 0 auto; }

	html.vnh-expert .videocontainer .video-js,
	html.vnh-expert .videocontainer > video {
		flex: 1 1 auto;
		width: 100% !important;
		height: 100% !important;
		max-height: none !important;
		min-height: 0;
	}

	html.vnh-expert .videocontainer .video-js video {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	/*
	 * Verdicts become one clean row underneath the player: the row takes the
	 * height it needs and the player absorbs whatever is left, so nothing gets
	 * clipped and the page never scrolls.
	 */
	html.vnh-expert .verdict-column {
		flex: 0 0 auto !important;
		max-height: 55vh;
		width: var(--vnh-expert-width) !important;
		max-width: var(--vnh-expert-width) !important;
		min-width: 0;
		min-height: 0;
		margin: 0 !important;
		overflow-x: hidden;
		overflow-y: auto;
	}

	html.vnh-expert .verdicts-container,
	html.vnh-expert .verdicts-container-inner { margin: 0 !important; }

	html.vnh-expert .verdicts-container { padding: 10px 14px !important; }

	html.vnh-expert .verdicts-container-inner {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		align-items: start;
		gap: 6px 18px;
	}

	html.vnh-expert .verdict-block {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin: 0 !important;
		padding: 0 !important;
	}

	html.vnh-expert .verdict-desc {
		margin: 0 !important;
		font-size: clamp(11px, 0.72vw, 15px);
		line-height: 1.35;
	}

	/* Keep the three verdict buttons on one line in a narrower column. */
	html.vnh-expert .verdictbutton label {
		padding: 6px 9px !important;
		font-size: 12px !important;
	}

	html.vnh-expert .verdictbuttons {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 6px;
		margin: 0 !important;
	}

	/* Second stage: the buttons are replaced by the chosen-label lines. */
	html.vnh-expert .verdictbuttonslabel,
	html.vnh-expert .verdictbuttonsverdictlabel { margin: 0 !important; }

	html.vnh-expert .submitbuttons {
		display: flex;
		justify-content: center;
		margin-top: 8px !important;
	}

	html.vnh-expert .status-text-container { text-align: center; }
}

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

/** The control strip that sits above the player. */

import { isClampHooked } from '../clamp';
import { getClipRange, getMedia } from '../player';
import { el, formatTime } from '../util';

export interface ToolbarCallbacks {
	onToggleFullContext(next: boolean): void;
	/** `rawVideo` is true when the user shift-clicked for the direct file URL. */
	onCopyLink(rawVideo: boolean): void;
	onToggleExpert(): void;
	onHelp(): void;
}

export interface Toolbar {
	syncFullContext(value: boolean): void;
	syncExpertView(value: boolean): void;
	refresh(): void;
}

export function installToolbar(callbacks: ToolbarCallbacks): Toolbar | null {
	const container = document.querySelector<HTMLElement>('.videocontainer');
	if (!container) return null;

	const checkbox = el('input', { attrs: { type: 'checkbox', id: 'vnh-fullcontext' } });
	const checkboxLabel = el('label', {
		class: 'vnh-check',
		attrs: {
			for: 'vnh-fullcontext',
			title: 'Play the whole recording instead of only the labeled clip window (C)',
		},
		children: [checkbox, el('span', { text: 'View full context' })],
	});

	const warning = el('span', {
		class: 'vnh-readout vnh-warn',
		text: '⚠ clip timer not found',
		attrs: { title: 'The portal’s clip-window timer was not detected on this page.' },
	});
	warning.style.display = 'none';

	const readout = el('span', { class: 'vnh-readout' });

	const copyButton = el('button', {
		class: 'vnh-btn',
		text: 'Copy clip link',
		attrs: {
			type: 'button',
			title: 'Copy the portal link for this clip (Y). Shift-click copies the direct video URL.',
		},
	});
	const expertButton = el('button', {
		class: 'vnh-btn',
		text: 'Expert view',
		attrs: {
			type: 'button',
			'aria-pressed': 'false',
			title: 'Hide the page header, footer and instructions and give the player the '
				+ 'full screen, with the verdicts in a row underneath. Click again to '
				+ 'restore the normal page (E).',
		},
	});
	const helpButton = el('button', {
		class: 'vnh-btn vnh-btn-icon',
		text: '?',
		attrs: { type: 'button', title: 'Keyboard shortcuts (?)' },
	});

	const toolbar = el('div', {
		class: 'vnh-toolbar',
		children: [
			checkboxLabel,
			warning,
			readout,
			el('span', { class: 'vnh-spacer' }),
			copyButton,
			expertButton,
			helpButton,
		],
	});
	container.insertBefore(toolbar, container.firstChild);

	checkbox.addEventListener('change', () => callbacks.onToggleFullContext(checkbox.checked));
	copyButton.addEventListener('click', (event) => callbacks.onCopyLink(event.shiftKey));
	expertButton.addEventListener('click', () => callbacks.onToggleExpert());
	helpButton.addEventListener('click', () => callbacks.onHelp());

	let fullContext = false;

	function updateReadout(): void {
		const media = getMedia();
		if (!media) {
			readout.textContent = '';
			return;
		}
		const range = getClipRange();
		const position = media.currentTime;
		const parts: string[] = [];
		if (range && !fullContext) {
			const length = Math.max(0, range.end - range.start);
			parts.push(`<b>+${(position - range.start).toFixed(1)}s</b> / ${length.toFixed(1)}s`);
		} else {
			const duration = Number.isFinite(media.duration) ? formatTime(media.duration) : '?';
			parts.push(`<b>${formatTime(position)}</b> / ${duration}`);
		}
		if (range && range.event !== null && !fullContext) {
			parts.push(`event +${(range.event - range.start).toFixed(1)}s`);
		}
		const rate = media.playbackRate;
		if (Math.abs(rate - 1) > 0.001) parts.push(`${rate}x`);
		readout.innerHTML = parts.join(' · ');
	}

	const media = getMedia();
	for (const event of ['timeupdate', 'seeked', 'ratechange', 'play', 'pause', 'loadedmetadata']) {
		media?.addEventListener(event, updateReadout);
	}
	updateReadout();

	// Only meaningful once the portal's inline script has run, i.e. at DOM ready.
	if (!isClampHooked()) warning.style.display = '';

	return {
		syncFullContext(value: boolean): void {
			fullContext = value;
			checkbox.checked = value;
			checkboxLabel.classList.toggle('vnh-on', value);
			updateReadout();
		},
		syncExpertView(value: boolean): void {
			expertButton.setAttribute('aria-pressed', value ? 'true' : 'false');
		},
		refresh: updateReadout,
	};
}

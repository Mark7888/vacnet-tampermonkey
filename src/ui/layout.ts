/**
 * Makes the video column and the verdict column resizable, plus a handle for the
 * player height. Both sizes live in localStorage and can be reset again.
 */

import { getSettings, updateSettings } from '../settings';
import { clamp, el } from '../util';

const MIN_RATIO = 0.25;
const MAX_RATIO = 0.85;
const MIN_HEIGHT = 180;
const DIVIDER_WIDTH = 12;
const WIDE_LAYOUT = '(min-width: 1000px)';

export interface LayoutController {
	/** Drops the stored sizes and returns to the portal's own proportions. */
	reset(): void;
	/** True when the columns are currently side by side and resizable. */
	isSplitActive(): boolean;
}

const NOOP_CONTROLLER: LayoutController = { reset: () => {}, isSplitActive: () => false };

export function installLayout(): LayoutController {
	const row = document.querySelector<HTMLElement>('.flex-row-wrap');
	const videoColumn = row?.querySelector<HTMLElement>(':scope > .video-column') ?? null;
	const verdictColumn = row?.querySelector<HTMLElement>(':scope > .verdict-column') ?? null;
	const container = document.querySelector<HTMLElement>('.videocontainer');
	if (!row || !videoColumn || !verdictColumn || !container) return NOOP_CONTROLLER;

	const naturalRatio = measureNaturalRatio(row, videoColumn, verdictColumn);
	const wide = window.matchMedia(WIDE_LAYOUT);

	const divider = el('div', {
		class: 'vnh-divider',
		attrs: {
			role: 'separator',
			'aria-orientation': 'vertical',
			title: 'Drag to resize the panels (double-click to reset)',
		},
	});
	row.insertBefore(divider, verdictColumn);

	const heightHandle = el('div', {
		class: 'vnh-height-handle',
		attrs: { role: 'separator', title: 'Drag to resize the player (double-click to reset)' },
	});
	container.appendChild(heightHandle);

	function currentRatio(): number {
		return getSettings().splitRatio ?? naturalRatio;
	}

	function applySplit(): void {
		if (!row) return;
		if (wide.matches) {
			row.classList.add('vnh-split');
			row.style.setProperty(
				'--vnh-video-width',
				`calc(${(currentRatio() * 100).toFixed(3)}% - ${DIVIDER_WIDTH / 2}px)`,
			);
		} else {
			row.classList.remove('vnh-split');
			row.style.removeProperty('--vnh-video-width');
		}
	}

	function applyHeight(): void {
		const height = getSettings().videoHeight;
		if (height && height >= MIN_HEIGHT) {
			document.documentElement.style.setProperty('--vnh-video-height', `${Math.round(height)}px`);
			document.documentElement.classList.add('vnh-video-height');
		} else {
			document.documentElement.classList.remove('vnh-video-height');
			document.documentElement.style.removeProperty('--vnh-video-height');
		}
	}

	divider.addEventListener('pointerdown', (event) => {
		if (event.button !== 0 || !wide.matches) return;
		event.preventDefault();
		divider.setPointerCapture(event.pointerId);
		divider.classList.add('vnh-dragging');
		document.documentElement.classList.add('vnh-resizing', 'vnh-col-resize');

		const onMove = (move: PointerEvent) => {
			const bounds = row.getBoundingClientRect();
			if (bounds.width <= 0) return;
			const ratio = clamp(
				(move.clientX - bounds.left - DIVIDER_WIDTH / 2) / bounds.width,
				MIN_RATIO,
				MAX_RATIO,
			);
			row.style.setProperty(
				'--vnh-video-width',
				`calc(${(ratio * 100).toFixed(3)}% - ${DIVIDER_WIDTH / 2}px)`,
			);
			updateSettings({ splitRatio: ratio });
		};
		const onUp = () => {
			divider.removeEventListener('pointermove', onMove);
			divider.classList.remove('vnh-dragging');
			document.documentElement.classList.remove('vnh-resizing', 'vnh-col-resize');
		};
		divider.addEventListener('pointermove', onMove);
		divider.addEventListener('pointerup', onUp, { once: true });
		divider.addEventListener('pointercancel', onUp, { once: true });
	});

	divider.addEventListener('dblclick', () => {
		updateSettings({ splitRatio: null });
		applySplit();
	});

	heightHandle.addEventListener('pointerdown', (event) => {
		if (event.button !== 0) return;
		event.preventDefault();
		heightHandle.setPointerCapture(event.pointerId);
		heightHandle.classList.add('vnh-dragging');
		document.documentElement.classList.add('vnh-resizing');

		const player = container.querySelector<HTMLElement>('.video-js, video');
		const startHeight = player?.getBoundingClientRect().height ?? 0;
		const startY = event.clientY;
		let height = startHeight;

		const onMove = (move: PointerEvent) => {
			height = clamp(startHeight + (move.clientY - startY), MIN_HEIGHT, window.innerHeight * 3);
			document.documentElement.style.setProperty('--vnh-video-height', `${Math.round(height)}px`);
			document.documentElement.classList.add('vnh-video-height');
		};
		const onUp = () => {
			heightHandle.removeEventListener('pointermove', onMove);
			heightHandle.classList.remove('vnh-dragging');
			document.documentElement.classList.remove('vnh-resizing');
			updateSettings({ videoHeight: Math.round(height) });
		};
		heightHandle.addEventListener('pointermove', onMove);
		heightHandle.addEventListener('pointerup', onUp, { once: true });
		heightHandle.addEventListener('pointercancel', onUp, { once: true });
	});

	heightHandle.addEventListener('dblclick', () => {
		updateSettings({ videoHeight: null });
		applyHeight();
	});

	if (typeof wide.addEventListener === 'function') {
		wide.addEventListener('change', applySplit);
	}

	applySplit();
	applyHeight();

	return {
		reset(): void {
			updateSettings({ splitRatio: null, videoHeight: null });
			applySplit();
			applyHeight();
		},
		isSplitActive(): boolean {
			return wide.matches;
		},
	};
}

/**
 * Reads the proportions the portal's own CSS produces, so "reset" and the initial
 * state keep the site's default look instead of a hard-coded guess.
 */
function measureNaturalRatio(row: HTMLElement, videoColumn: HTMLElement, verdictColumn: HTMLElement): number {
	const rowWidth = row.getBoundingClientRect().width;
	const videoWidth = videoColumn.getBoundingClientRect().width;
	const stacked = Math.abs(videoColumn.offsetTop - verdictColumn.offsetTop) > 8;
	if (!stacked && rowWidth > 0 && videoWidth > 0) {
		return clamp(videoWidth / rowWidth, MIN_RATIO, MAX_RATIO);
	}
	return 0.62;
}

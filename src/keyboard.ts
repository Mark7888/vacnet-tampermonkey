/** Global keyboard control for the player. */

import { isClampSuppressed } from './clamp';
import { getClipRange, getMedia, getPlayerRoot, getVideoJsPlayer } from './player';
import { toast } from './ui/toast';
import { clamp } from './util';

const RATES = [0.05, 0.1, 0.15, 0.25, 0.4, 0.5, 0.75, 1, 1.25, 1.5, 2, 3];
const FRAME = 1 / 60;

export interface KeyboardActions {
	toggleFullContext(): void;
	toggleInfo(): void;
	copyClipLink(): void;
	resetLayout(): void;
	toggleHelp(): void;
	/** Returns true when a help overlay was open and got closed. */
	closeHelp(): boolean;
}

/** The window the user is allowed to move around in right now. */
function activeRange(media: HTMLVideoElement): { start: number; end: number } {
	const range = getClipRange();
	if (range && !isClampSuppressed()) return { start: range.start, end: range.end };
	const duration = Number.isFinite(media.duration) ? media.duration : Number.MAX_SAFE_INTEGER;
	return { start: 0, end: duration };
}

function seekTo(media: HTMLVideoElement, time: number): void {
	const { start, end } = activeRange(media);
	media.currentTime = clamp(time, start, Math.max(start, end - 0.03));
}

function seekBy(media: HTMLVideoElement, delta: number): void {
	seekTo(media, media.currentTime + delta);
}

function stepFrame(media: HTMLVideoElement, direction: number): void {
	if (!media.paused) media.pause();
	seekBy(media, direction * FRAME);
}

function changeVolume(media: HTMLVideoElement, delta: number): void {
	const volume = clamp(media.volume + delta, 0, 1);
	media.volume = volume;
	if (volume > 0) media.muted = false;
	toast(`Volume ${Math.round(volume * 100)}%`);
}

function changeRate(media: HTMLVideoElement, direction: number): void {
	let index = 0;
	let best = Number.POSITIVE_INFINITY;
	RATES.forEach((rate, i) => {
		const distance = Math.abs(rate - media.playbackRate);
		if (distance < best) {
			best = distance;
			index = i;
		}
	});
	const next = RATES[clamp(index + direction, 0, RATES.length - 1)];
	media.playbackRate = next;
	toast(`Speed ${next}x`);
}

function toggleFullscreen(): void {
	const player = getVideoJsPlayer();
	if (player?.requestFullscreen && player.isFullscreen) {
		if (player.isFullscreen()) player.exitFullscreen?.();
		else player.requestFullscreen();
		return;
	}
	const root = getPlayerRoot();
	if (!root) return;
	if (document.fullscreenElement) void document.exitFullscreen();
	else void root.requestFullscreen();
}

/** Keeps the portal's own controls usable while typing or using the modal. */
function shouldIgnore(event: KeyboardEvent): boolean {
	if (event.ctrlKey || event.metaKey) return true;
	const target = event.target as HTMLElement | null;
	if (target) {
		if (target.isContentEditable) return true;
		const tag = target.tagName;
		if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
		if (tag === 'INPUT') {
			const type = (target as HTMLInputElement).type;
			if (!['radio', 'checkbox', 'button', 'submit', 'reset'].includes(type)) return true;
		}
	}
	const detailsModal = document.getElementById('detailsModalOverlay');
	if (detailsModal && detailsModal.style.display === 'block') return true;
	return false;
}

export function installKeyboard(actions: KeyboardActions): void {
	// Widen video.js' speed menu so the UI agrees with the keyboard shortcuts.
	try {
		getVideoJsPlayer()?.playbackRates?.(RATES);
	} catch {
		// the player may not be initialised yet - the shortcuts still work
	}

	window.addEventListener('keydown', (event) => {
		if (event.key === 'Escape' && actions.closeHelp()) {
			event.preventDefault();
			return;
		}
		if (event.repeat && (event.key === 'c' || event.key === 'h' || event.key === 'r')) return;
		if (shouldIgnore(event)) return;

		const media = getMedia();
		if (!media) return;
		const step = event.shiftKey ? 5 : event.altKey ? 0.1 : 1;
		let handled = true;

		switch (event.code) {
			case 'Space':
			case 'KeyK':
				if (media.paused) void media.play();
				else media.pause();
				break;
			case 'ArrowRight':
				seekBy(media, step);
				break;
			case 'ArrowLeft':
				seekBy(media, -step);
				break;
			case 'KeyL':
				seekBy(media, 5);
				break;
			case 'KeyJ':
				seekBy(media, -5);
				break;
			case 'Period':
				stepFrame(media, 1);
				break;
			case 'Comma':
				stepFrame(media, -1);
				break;
			case 'ArrowUp':
				changeVolume(media, 0.05);
				break;
			case 'ArrowDown':
				changeVolume(media, -0.05);
				break;
			case 'KeyM':
				media.muted = !media.muted;
				toast(media.muted ? 'Muted' : 'Unmuted');
				break;
			case 'KeyF':
				toggleFullscreen();
				break;
			case 'Minus':
			case 'NumpadSubtract':
				changeRate(media, -1);
				break;
			case 'Equal':
			case 'NumpadAdd':
				changeRate(media, 1);
				break;
			case 'Backspace':
				media.playbackRate = 1;
				toast('Speed 1x');
				break;
			case 'Home':
				seekTo(media, activeRange(media).start);
				break;
			case 'End':
				seekTo(media, activeRange(media).end);
				break;
			case 'KeyC':
				actions.toggleFullContext();
				break;
			case 'KeyH':
				actions.toggleInfo();
				break;
			case 'KeyY':
				actions.copyClipLink();
				break;
			case 'KeyR':
				actions.resetLayout();
				break;
			case 'Slash':
			case 'NumpadDivide':
				actions.toggleHelp();
				break;
			default:
				handled = false;
		}

		if (!handled && /^(Digit|Numpad)[0-9]$/.test(event.code)) {
			const digit = Number(event.code.slice(-1));
			const { start, end } = activeRange(media);
			seekTo(media, start + (end - start) * (digit / 10));
			handled = true;
		}

		if (handled) {
			event.preventDefault();
			event.stopPropagation();
		}
	}, true);
}

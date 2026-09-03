/**
 * The labeling portal keeps the player inside a ~10 second window with an inline
 * `setInterval` that rewinds/pauses the video whenever it leaves the clip range.
 * That timer lives in a closure we cannot reach, so we wrap `window.setInterval`
 * before the page's own script runs and neutralise just that one callback.
 */

import { log } from './util';

type Handler = TimerHandler;

let hookInstalled = false;
let suppressed = false;
let patchedTimers = 0;

/** Recognises the portal's clip-window timer by its source and period. */
function isClipWindowTimer(handler: Handler, timeout: number | undefined): boolean {
	if (typeof handler !== 'function') return false;
	if (timeout !== undefined && timeout > 1000) return false;
	let source = '';
	try {
		source = Function.prototype.toString.call(handler);
	} catch {
		return false;
	}
	return /currentTime\s*\(/.test(source) && /(startTime|endTime)/.test(source);
}

/**
 * Must run at document-start, before the portal's inline player script executes.
 */
export function installClampHook(): void {
	if (hookInstalled) return;
	const original = window.setInterval;
	const patched = function (this: unknown, handler: Handler, timeout?: number, ...args: unknown[]) {
		if (isClipWindowTimer(handler, timeout)) {
			patchedTimers += 1;
			const inner = handler as (...callbackArgs: unknown[]) => unknown;
			const wrapper = function (this: unknown, ...callbackArgs: unknown[]) {
				// While "View full context" is on we simply skip the portal's tick.
				if (suppressed) return undefined;
				return inner.apply(this, callbackArgs);
			};
			return original.call(window, wrapper as Handler, timeout, ...args);
		}
		return original.call(window, handler, timeout, ...args);
	};
	window.setInterval = patched as unknown as typeof window.setInterval;
	hookInstalled = true;
	log('clip-window hook installed');
}

/** True once the portal's timer has actually been wrapped. */
export function isClampHooked(): boolean {
	return patchedTimers > 0;
}

export function isClampSuppressed(): boolean {
	return suppressed;
}

export function setClampSuppressed(value: boolean): void {
	suppressed = value;
}

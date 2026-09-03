/** Small DOM/format helpers shared by the whole script. */

export function log(...args: unknown[]): void {
	console.log('[vacnet-enhancer]', ...args);
}

export function clamp(value: number, min: number, max: number): number {
	return value < min ? min : value > max ? max : value;
}

/** Creates an element with class names, attributes and children in one go. */
export function el<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	options: {
		class?: string;
		text?: string;
		html?: string;
		attrs?: Record<string, string>;
		children?: (Node | null)[];
	} = {},
): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	if (options.class) node.className = options.class;
	if (options.text !== undefined) node.textContent = options.text;
	if (options.html !== undefined) node.innerHTML = options.html;
	for (const [name, value] of Object.entries(options.attrs ?? {})) {
		node.setAttribute(name, value);
	}
	for (const child of options.children ?? []) {
		if (child) node.appendChild(child);
	}
	return node;
}

export function onReady(callback: () => void): void {
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', callback, { once: true });
	} else {
		callback();
	}
}

/** Seconds -> "m:ss.d", matching how the portal talks about clip offsets. */
export function formatTime(seconds: number): string {
	if (!Number.isFinite(seconds)) return '--:--';
	const sign = seconds < 0 ? '-' : '';
	const abs = Math.abs(seconds);
	const mins = Math.floor(abs / 60);
	const secs = abs - mins * 60;
	return `${sign}${mins}:${secs < 10 ? '0' : ''}${secs.toFixed(1)}`;
}

/** Clipboard write with a fallback for browsers/contexts without the async API. */
export async function copyText(text: string): Promise<boolean> {
	try {
		if (navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(text);
			return true;
		}
	} catch {
		// fall through to the legacy path
	}
	try {
		const area = el('textarea', { attrs: { readonly: 'readonly' } });
		area.value = text;
		area.style.cssText = 'position:fixed;top:-1000px;opacity:0;';
		document.body.appendChild(area);
		area.select();
		const ok = document.execCommand('copy');
		area.remove();
		return ok;
	} catch {
		return false;
	}
}

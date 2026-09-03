/** Small transient message used to confirm keyboard actions and copies. */

import { el } from '../util';

let node: HTMLDivElement | null = null;
let hideTimer: number | undefined;

export function toast(message: string): void {
	if (!node || !node.isConnected) {
		node = el('div', { class: 'vnh-toast' });
		document.body.appendChild(node);
	}
	node.textContent = message;
	// restart the transition even when a toast is already showing
	node.classList.remove('vnh-show');
	void node.offsetWidth;
	node.classList.add('vnh-show');
	window.clearTimeout(hideTimer);
	hideTimer = window.setTimeout(() => node?.classList.remove('vnh-show'), 1400);
}

/** Keyboard shortcut cheat sheet, styled after the portal's own modal. */

import { SHORTCUTS } from '../shortcuts';
import { el } from '../util';

let overlay: HTMLDivElement | null = null;

function buildRows(): string {
	const rows: string[] = [];
	for (const section of SHORTCUTS) {
		rows.push(`<tr class="vnh-section"><td colspan="2">${section.title}</td></tr>`);
		for (const [keys, description] of section.items) {
			const rendered = keys.split(' / ').map((key) => `<kbd>${key}</kbd>`).join(' / ');
			rows.push(`<tr><td>${rendered}</td><td>${description}</td></tr>`);
		}
	}
	return rows.join('');
}

function build(): HTMLDivElement {
	const card = el('div', {
		class: 'vnh-modal-card',
		html: `
			<div class="vnh-modal-header">
				<span>Keyboard shortcuts</span>
				<span class="vnh-modal-close" role="button" tabindex="0" aria-label="Close">X</span>
			</div>
			<div class="vnh-modal-body">
				<table class="vnh-keys">${buildRows()}</table>
				<p class="vnh-note">
					Shortcuts are ignored while you are typing in a text field.
					Seeking is limited to the labeled clip window unless
					<b>View full context</b> is enabled.
				</p>
			</div>`,
	});
	const node = el('div', { class: 'vnh-modal', children: [card] });
	node.hidden = true;
	node.addEventListener('click', (event) => {
		const target = event.target as HTMLElement;
		if (target === node || target.classList.contains('vnh-modal-close')) closeHelp();
	});
	document.body.appendChild(node);
	return node;
}

export function isHelpOpen(): boolean {
	return !!overlay && !overlay.hidden;
}

export function openHelp(): void {
	if (!overlay || !overlay.isConnected) overlay = build();
	overlay.hidden = false;
}

export function closeHelp(): boolean {
	if (!isHelpOpen()) return false;
	overlay!.hidden = true;
	return true;
}

export function toggleHelp(): void {
	if (isHelpOpen()) closeHelp();
	else openHelp();
}

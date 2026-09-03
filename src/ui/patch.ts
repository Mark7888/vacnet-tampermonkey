/**
 * Reversible patching of the portal's own markup.
 *
 * The portal's stylesheet is not something we can out-specify (several of its
 * rules are more specific than anything a sane userscript selector can be, and
 * some are !important), so expert view is applied as inline `!important`
 * declarations, which win over every stylesheet rule whatever its specificity.
 *
 * Text and attributes are patched the same way: the original is stored the
 * first time an element is touched, so leaving expert view puts the page back
 * exactly as the portal had it.
 */

export type Declarations = Record<string, string>;

const styles = new Map<HTMLElement, string>();
const markup = new Map<HTMLElement, string>();
const attributes = new Map<HTMLElement, Map<string, string | null>>();

/** Applies inline `!important` declarations, remembering the original `style`. */
export function style(node: HTMLElement, declarations: Declarations): void {
	if (!styles.has(node)) styles.set(node, node.getAttribute('style') ?? '');
	for (const [property, value] of Object.entries(declarations)) {
		node.style.setProperty(property, value, 'important');
	}
}

export function styleAll(selector: string, declarations: Declarations): void {
	for (const node of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
		style(node, declarations);
	}
}

/**
 * Replaces an element's content with plain text, keeping the portal's markup
 * for the way out. Writing is skipped when the text is already in place, so
 * re-applying the layout does not churn the DOM (and does not feed the
 * MutationObserver that calls us).
 */
export function text(node: HTMLElement, value: string): void {
	if (!markup.has(node)) markup.set(node, node.innerHTML);
	if (node.textContent !== value) node.textContent = value;
}

export function attr(node: HTMLElement, name: string, value: string): void {
	let saved = attributes.get(node);
	if (!saved) attributes.set(node, (saved = new Map()));
	if (!saved.has(name)) saved.set(name, node.getAttribute(name));
	if (node.getAttribute(name) !== value) node.setAttribute(name, value);
}

/** Puts every touched element back the way the portal had it. */
export function restoreAll(): void {
	for (const [node, html] of markup) node.innerHTML = html;
	markup.clear();

	for (const [node, saved] of attributes) {
		for (const [name, value] of saved) {
			if (value === null) node.removeAttribute(name);
			else node.setAttribute(name, value);
		}
	}
	attributes.clear();

	for (const [node, value] of styles) {
		if (value) node.setAttribute('style', value);
		else node.removeAttribute('style');
	}
	styles.clear();
}

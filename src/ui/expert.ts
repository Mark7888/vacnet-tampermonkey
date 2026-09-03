/**
 * Expert view: strips the page down to the player and the verdicts.
 *
 * The layout itself lives in the stylesheet (see the `html.vnh-expert` rules);
 * this module only flips the class and nudges video.js so its control bar
 * re-measures against the new player size.
 */

export function applyExpertView(enabled: boolean): void {
	document.documentElement.classList.toggle('vnh-expert', enabled);
	// video.js lays its controls out on resize; the class change is invisible to it.
	window.requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
}

/**
 * The portal's welcome page.
 *
 * `/vacnet` serves a static intro screen whose only control is a "Got It" link
 * to `/vacnet/clips`, and it comes back on every visit. In expert view - where
 * the point is to get to the clips with as little page furniture as possible -
 * the script follows that link itself.
 */

import { log } from './util';

/** The "Got It" link, which is the only thing on the intro page. */
const CONTINUE_LINK = '.intro-page-button a[href*="/vacnet/clips"]';

/** Where the intro page sends you when the markup changed under us. */
const CLIPS_PATH = '/vacnet/clips';

/**
 * Remembers the last automatic skip, so that a portal that bounces back to the
 * intro (logged out, no clips left) cannot turn into a redirect loop.
 */
const GUARD_KEY = 'vacnetEnhancer.introSkip';
const GUARD_MS = 10_000;

function guardTripped(): boolean {
	try {
		const last = Number(window.sessionStorage.getItem(GUARD_KEY));
		if (Number.isFinite(last) && last > 0 && Date.now() - last < GUARD_MS) return true;
		window.sessionStorage.setItem(GUARD_KEY, String(Date.now()));
	} catch {
		// storage disabled - one skip attempt is still better than none
	}
	return false;
}

/** True when the current document is the intro page and not a clip page. */
export function isIntroPage(): boolean {
	if (document.querySelector('.videocontainer')) return false;
	return !!document.querySelector(CONTINUE_LINK) || !!document.querySelector('.intro-text-container');
}

/**
 * Follows the intro page's own link to the clips.
 *
 * Returns true when a navigation was started, in which case the caller should
 * not bother building any UI on this document.
 */
export function skipIntroPage(): boolean {
	const link = document.querySelector<HTMLAnchorElement>(CONTINUE_LINK);
	const url = link?.href || new URL(CLIPS_PATH, location.href).href;

	if (guardTripped()) {
		log('intro page again right after skipping it - leaving it alone');
		return false;
	}

	log('expert view: skipping the intro page ->', url);
	// replace(), so going back does not land on the intro page again.
	location.replace(url);
	return true;
}

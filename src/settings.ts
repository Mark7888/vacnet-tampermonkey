/** Persisted user preferences (kept in localStorage, separate from Valve's keys). */

export interface Settings {
	/** Disables the portal's "snap back into the 10 second window" timer. */
	fullContext: boolean;
	/** Hides the instructions row and the portal logo block. */
	infoHidden: boolean;
	/** Width of the video column as a fraction of the row (null = site default). */
	splitRatio: number | null;
	/** Explicit player height in px (null = site default). */
	videoHeight: number | null;
}

const STORAGE_KEY = 'vacnetEnhancer.settings.v1';

const DEFAULTS: Settings = {
	fullContext: false,
	infoHidden: false,
	splitRatio: null,
	videoHeight: null,
};

let current: Settings = { ...DEFAULTS };

export function loadSettings(): Settings {
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (raw) {
			const parsed = JSON.parse(raw) as Partial<Settings>;
			current = { ...DEFAULTS, ...parsed };
		}
	} catch {
		current = { ...DEFAULTS };
	}
	return current;
}

export function getSettings(): Settings {
	return current;
}

export function updateSettings(patch: Partial<Settings>): Settings {
	current = { ...current, ...patch };
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
	} catch {
		// storage disabled - keep the in-memory value only
	}
	return current;
}

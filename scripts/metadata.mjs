// Single source of truth for the Tampermonkey metadata block.
// `version` is filled in from package.json by the build script.
export const metadata = {
	name: 'CS2 VACnet Labeling Portal Enhancer',
	namespace: 'https://github.com/Mark7888/vacnet-tampermonkey',
	description: 'Full clip playback, keyboard controls, resizable panels and other usability tweaks for the CS2 VACnet video labeling portal.',
	author: 'Mark7888',
	homepageURL: 'https://github.com/Mark7888/vacnet-tampermonkey',
	supportURL: 'https://github.com/Mark7888/vacnet-tampermonkey/issues',
	downloadURL: 'https://github.com/Mark7888/vacnet-tampermonkey/releases/latest/download/vacnet-enhancer.user.js',
	updateURL: 'https://github.com/Mark7888/vacnet-tampermonkey/releases/latest/download/vacnet-enhancer.meta.js',
	match: [
		'https://www.counter-strike.net/vacnet*',
		'https://counter-strike.net/vacnet*',
	],
	// Runs in the page context so it can hook the portal's own player code.
	grant: 'none',
	'run-at': 'document-start',
	noframes: '',
};

/** Renders the ==UserScript== block that gets prepended to the bundle. */
export function renderMetadataBlock(version) {
	const entries = [['name', metadata.name], ['namespace', metadata.namespace], ['version', version]];
	for (const [key, value] of Object.entries(metadata)) {
		if (key === 'name' || key === 'namespace') continue;
		if (Array.isArray(value)) {
			for (const item of value) entries.push([key, item]);
		} else {
			entries.push([key, value]);
		}
	}
	const width = Math.max(...entries.map(([key]) => key.length));
	const lines = entries.map(([key, value]) =>
		`// @${key.padEnd(width)} ${value}`.trimEnd());
	return ['// ==UserScript==', ...lines, '// ==/UserScript=='].join('\n');
}

// Single source of truth for the Tampermonkey metadata block.
// `version` and the update channel are supplied by the build script.

export const repo = 'Mark7888/vacnet-tampermonkey';

const releaseBase = `https://github.com/${repo}/releases/latest/download`;
// The `dist` branch is rebuilt from `master` by the publish-edge workflow, so
// its raw URLs are always the newest build and can be installed straight into
// Tampermonkey.
const edgeBase = `https://raw.githubusercontent.com/${repo}/dist`;

/**
 * Update channels. Each one only differs in where Tampermonkey is told to look
 * for updates, so an installed script keeps following the channel it came from.
 */
export const channels = {
	release: {
		downloadURL: `${releaseBase}/vacnet-enhancer.user.js`,
		updateURL: `${releaseBase}/vacnet-enhancer.meta.js`,
	},
	edge: {
		downloadURL: `${edgeBase}/vacnet-enhancer.user.js`,
		updateURL: `${edgeBase}/vacnet-enhancer.meta.js`,
	},
};

export const defaultChannel = 'release';

const metadata = {
	name: 'CS2 VACnet Labeling Portal Enhancer',
	namespace: `https://github.com/${repo}`,
	description: 'Full clip playback, keyboard controls, resizable panels and other usability tweaks for the CS2 VACnet video labeling portal.',
	author: 'Mark7888',
	homepageURL: `https://github.com/${repo}`,
	supportURL: `https://github.com/${repo}/issues`,
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
export function renderMetadataBlock(version, channel = defaultChannel) {
	const urls = channels[channel];
	if (!urls) throw new Error(`unknown channel "${channel}" (expected one of ${Object.keys(channels).join(', ')})`);

	const entries = [['name', metadata.name], ['namespace', metadata.namespace], ['version', version]];
	for (const [key, value] of Object.entries(metadata)) {
		if (key === 'name' || key === 'namespace') continue;
		if (key === 'match') {
			// Keep the update URLs next to the other repo links, above @match.
			entries.push(['downloadURL', urls.downloadURL], ['updateURL', urls.updateURL]);
		}
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

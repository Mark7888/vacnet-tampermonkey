// Shared CLI argument handling for the build and verify scripts.

/** Reads `--name=value` or `--name value` out of argv. */
export function flag(name) {
	const argv = process.argv.slice(2);
	const prefix = `--${name}=`;
	for (let i = 0; i < argv.length; i++) {
		if (argv[i].startsWith(prefix)) return argv[i].slice(prefix.length);
		if (argv[i] === `--${name}`) return argv[i + 1];
	}
	return undefined;
}

// Tampermonkey compares versions with the Firefox toolkit format, which needs
// dot-separated parts. Anything outside this shape risks updates silently
// never applying, so reject it at build time rather than after publishing.
const versionPattern = /^\d+(\.\d+)*(-[0-9A-Za-z.]+)?$/;

/** Accepts a bare or `v`-prefixed version and returns it normalised. */
export function resolveVersion(raw) {
	const version = String(raw ?? '').trim().replace(/^v/, '');
	if (!versionPattern.test(version)) {
		throw new Error(`invalid version "${raw}" (expected something like 1.2.3 or 1.2.3-edge.20260903.1512)`);
	}
	return version;
}

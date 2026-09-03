// Checks the built userscript before CI publishes it anywhere.
//
// The interesting failure this guards against is a bad @downloadURL/@updateURL:
// Tampermonkey re-fetches those on every update check, so shipping the wrong
// one hands the install over to whatever lives at that address. The rest is
// cheap insurance against publishing a truncated or malformed bundle.

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { channels, defaultChannel, renderMetadataBlock } from './metadata.mjs';
import { flag, resolveVersion } from './options.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'dist');

const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const channel = flag('channel') ?? process.env.USERSCRIPT_CHANNEL ?? defaultChannel;
const version = resolveVersion(flag('version') ?? process.env.USERSCRIPT_VERSION ?? pkg.version);

const problems = [];
const check = (ok, message) => { if (!ok) problems.push(message); };

if (!channels[channel]) {
	console.error(`verify: unknown channel "${channel}"`);
	process.exit(1);
}

const expectedBlock = renderMetadataBlock(version, channel);
const script = await readFile(join(outDir, 'vacnet-enhancer.user.js'), 'utf8');
const meta = await readFile(join(outDir, 'vacnet-enhancer.meta.js'), 'utf8');

// Tampermonkey only reads the metadata block when it is the very first thing in
// the file; anything before it makes the install silently do nothing.
check(script.startsWith('// ==UserScript==\n'), 'the userscript does not start with the metadata block');
check(script.startsWith(expectedBlock), `the userscript metadata block does not match the ${channel} channel at v${version}`);
check(meta.trimEnd() === expectedBlock, `the .meta.js does not match the ${channel} channel at v${version}`);

// A .meta.js that carries code would be served to every installed client on
// each update check.
check(meta.trimEnd().endsWith('// ==/UserScript=='), 'the .meta.js has content after the metadata block');

const { downloadURL, updateURL } = channels[channel];
for (const [key, expected] of [['downloadURL', downloadURL], ['updateURL', updateURL]]) {
	const found = script.match(new RegExp(`^// @${key}\\s+(\\S+)$`, 'm'))?.[1];
	check(found === expected, `@${key} is "${found}", expected "${expected}"`);
	check(found === undefined || found.startsWith('https://'), `@${key} is not served over https`);
}

const bodyStart = script.indexOf('// ==/UserScript==');
const body = script.slice(bodyStart);
check(body.length > 10_000, `the bundle looks truncated (${body.length} bytes after the metadata block)`);
check(script.includes("'use strict'"), 'the bundle is missing its strict-mode wrapper');
// esbuild resolves everything into the single file; a leftover import means a
// dependency would be fetched at runtime from the portal's origin.
check(!/^\s*(import|require)\s*\(/m.test(body), 'the bundle contains a runtime import');

if (problems.length > 0) {
	for (const problem of problems) console.error(`verify: ${problem}`);
	process.exit(1);
}

console.log(`verify: dist/vacnet-enhancer.user.js ok - v${version}, ${channel} channel, ${(script.length / 1024).toFixed(1)} kB`);

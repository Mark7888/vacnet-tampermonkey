import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { defaultChannel, renderMetadataBlock } from './metadata.mjs';
import { flag, resolveVersion } from './options.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'dist');
const outFile = join(outDir, 'vacnet-enhancer.user.js');
const metaFile = join(outDir, 'vacnet-enhancer.meta.js');
const watch = process.argv.includes('--watch');

const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const channel = flag('channel') ?? process.env.USERSCRIPT_CHANNEL ?? defaultChannel;
const version = resolveVersion(flag('version') ?? process.env.USERSCRIPT_VERSION ?? pkg.version);
const commit = flag('commit') ?? process.env.GITHUB_SHA ?? '';

const banner = renderMetadataBlock(version, channel);
// Provenance for anyone reading the shipped file. Tampermonkey needs the
// metadata block first, so this goes underneath it.
const stamp = commit ? `\n// build: ${channel} channel, commit ${commit}, ${new Date().toISOString()}` : '';

/** @type {import('esbuild').BuildOptions} */
const options = {
	entryPoints: [join(root, 'src', 'main.ts')],
	outfile: outFile,
	bundle: true,
	format: 'iife',
	target: ['chrome100', 'firefox100', 'safari15'],
	charset: 'utf8',
	legalComments: 'none',
	// Tampermonkey requires the metadata block to be the very first thing in the file.
	banner: { js: `${banner}${stamp}\n\n(function () {\n'use strict';\n` },
	footer: { js: '})();\n' },
	logLevel: 'info',
};

await mkdir(outDir, { recursive: true });

if (watch) {
	const ctx = await esbuild.context(options);
	await ctx.watch();
	console.log(`watching... -> ${outFile}`);
} else {
	await esbuild.build(options);
	const bytes = (await readFile(outFile)).byteLength;
	// Also emit a .meta.js so update checks stay cheap for Tampermonkey.
	await writeFile(metaFile, `${banner}\n`);
	console.log(`built ${outFile} (${(bytes / 1024).toFixed(1)} kB) - v${version}, ${channel} channel`);
}

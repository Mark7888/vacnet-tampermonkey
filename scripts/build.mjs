import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { renderMetadataBlock } from './metadata.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outFile = join(root, 'dist', 'vacnet-enhancer.user.js');
const watch = process.argv.includes('--watch');

const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const banner = renderMetadataBlock(pkg.version);

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
	banner: { js: `${banner}\n\n(function () {\n'use strict';\n` },
	footer: { js: '})();\n' },
	logLevel: 'info',
};

await mkdir(dirname(outFile), { recursive: true });

if (watch) {
	const ctx = await esbuild.context(options);
	await ctx.watch();
	console.log(`watching... -> ${outFile}`);
} else {
	await esbuild.build(options);
	const bytes = (await readFile(outFile)).byteLength;
	// Also emit a .meta.js so update checks stay cheap for Tampermonkey.
	await writeFile(join(root, 'dist', 'vacnet-enhancer.meta.js'), `${banner}\n`);
	console.log(`built ${outFile} (${(bytes / 1024).toFixed(1)} kB)`);
}

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

/**
 * End-to-end checks for the userscript: the fixture in ./fixture reproduces the
 * portal's markup (including its inline player script) with a simulated media
 * element, and the built userscript is injected exactly like Tampermonkey would
 * inject it at document-start.
 */
const DIR = new URL('./fixture/', import.meta.url).pathname;
const SCRIPT = await readFile(new URL('../dist/vacnet-enhancer.user.js', import.meta.url), 'utf8');

const server = createServer(async (req, res) => {
	const path = req.url.split('?')[0];
	const file = path === '/vacnet' || path === '/' ? 'page.html' : path.slice(1);
	try {
		const body = await readFile(DIR + file);
		res.writeHead(200, { 'Content-Type': file.endsWith('.js') ? 'text/javascript' : 'text/html' });
		res.end(body);
	} catch {
		res.writeHead(404).end('nope');
	}
});
await new Promise((r) => server.listen(8731, r));

const results = [];
function check(name, ok, extra = '') {
	results.push({ name, ok, extra });
	console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -- ' + extra : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch(
	process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://localhost:8731' });
const page = await context.newPage();
page.on('pageerror', (e) => check('no page errors', false, String(e)));
await page.addInitScript(SCRIPT);
await page.goto('http://localhost:8731/vacnet');
await page.waitForSelector('.vnh-toolbar');
await sleep(400);

// --- toolbar ---------------------------------------------------------------
check('toolbar is inside .videocontainer',
	await page.evaluate(() => !!document.querySelector('.videocontainer > .vnh-toolbar')));
check('clip timer was hooked (no warning shown)',
	await page.evaluate(() => document.querySelector('.vnh-warn').style.display === 'none'));
check('readout shows clip offset',
	/\+.*s \/ 10\.7s/.test(await page.evaluate(() => document.querySelector('.vnh-readout:not(.vnh-warn)').textContent)),
	await page.evaluate(() => document.querySelector('.vnh-readout:not(.vnh-warn)').textContent));

// --- clip window enforced by default --------------------------------------
await page.evaluate(() => { document.getElementById('video_html5_api').currentTime = 305; });
await sleep(300);
const snapped = await page.evaluate(() => document.getElementById('video_html5_api').currentTime);
check('clip window still enforced when unchecked', snapped < 300, `t=${snapped.toFixed(2)}`);

// --- full context ----------------------------------------------------------
await page.click('.vnh-check');
await sleep(50);
await page.evaluate(() => { document.getElementById('video_html5_api').currentTime = 305; });
await sleep(400);
const free = await page.evaluate(() => document.getElementById('video_html5_api').currentTime);
check('full context lets playback pass the clip end', free >= 305, `t=${free.toFixed(2)}`);
check('full context persisted',
	await page.evaluate(() => JSON.parse(localStorage.getItem('vacnetEnhancer.settings.v1')).fullContext === true));

// --- keyboard --------------------------------------------------------------
await page.evaluate(() => { document.getElementById('video_html5_api').pause(); document.getElementById('video_html5_api').currentTime = 300; });
await page.keyboard.press('ArrowRight');
check('ArrowRight seeks +1s',
	Math.abs(await page.evaluate(() => document.getElementById('video_html5_api').currentTime) - 301) < 0.01);
await page.keyboard.press('Shift+ArrowLeft');
check('Shift+ArrowLeft seeks -5s',
	Math.abs(await page.evaluate(() => document.getElementById('video_html5_api').currentTime) - 296) < 0.01);
await page.keyboard.press('Space');
check('Space plays', await page.evaluate(() => !document.getElementById('video_html5_api').paused));
await page.keyboard.press('Space');
check('Space pauses again', await page.evaluate(() => document.getElementById('video_html5_api').paused));
await page.keyboard.press('Equal');
check('"+" raises the playback rate',
	await page.evaluate(() => document.getElementById('video_html5_api').playbackRate) > 1);
await page.keyboard.press('Backspace');
check('Backspace resets the rate',
	await page.evaluate(() => document.getElementById('video_html5_api').playbackRate) === 1);
await page.keyboard.press('ArrowDown');
check('ArrowDown lowers the volume',
	await page.evaluate(() => document.getElementById('video_html5_api').volume) < 1);
await page.keyboard.press('KeyC');
check('C toggles full context off',
	await page.evaluate(() => !document.querySelector('#vnh-fullcontext').checked));
await page.keyboard.press('Digit0');
const atStart = await page.evaluate(() => document.getElementById('video_html5_api').currentTime);
check('0 jumps to the clip start', Math.abs(atStart - 288.58) < 0.1, `t=${atStart.toFixed(2)}`);
await page.keyboard.press('Slash');
check('? opens the shortcut list', await page.isVisible('.vnh-modal'));
await page.keyboard.press('Escape');
check('Esc closes the shortcut list', !(await page.isVisible('.vnh-modal')));

// keys must not fire while typing
await page.evaluate(() => {
	const input = document.createElement('input');
	input.id = 'typing';
	document.body.appendChild(input);
	input.focus();
});
const beforeTyping = await page.evaluate(() => document.getElementById('video_html5_api').currentTime);
await page.keyboard.press('ArrowRight');
check('shortcuts ignored while typing in a text field',
	(await page.evaluate(() => document.getElementById('video_html5_api').currentTime)) === beforeTyping);
await page.evaluate(() => { document.getElementById('typing').remove(); document.body.focus(); });

// --- hide info -------------------------------------------------------------
await page.click('.vnh-toolbar .vnh-btn:nth-of-type(2)');
check('info row hidden', !(await page.isVisible('.top-section')) && !(await page.isVisible('.top-section-logo')));
check('hide button offers to bring it back',
	(await page.textContent('.vnh-toolbar .vnh-btn:nth-of-type(2)')) === 'Show info');
await page.keyboard.press('KeyH');
check('H brings the info row back', await page.isVisible('.top-section'));
await page.click('.vnh-toolbar .vnh-btn:nth-of-type(2)');

// --- copy link -------------------------------------------------------------
await page.click('.vnh-toolbar .vnh-btn:nth-of-type(1)');
await sleep(100);
const copied = await page.evaluate(() => navigator.clipboard.readText());
check('copy clip link copies the portal link', copied.includes('/vacnet/view?s='), copied);
await page.click('.vnh-toolbar .vnh-btn:nth-of-type(1)', { modifiers: ['Shift'] });
await sleep(100);
const copiedRaw = await page.evaluate(() => navigator.clipboard.readText());
check('shift-click copies the video URL', copiedRaw.endsWith('clip.webm'), copiedRaw);

// --- resizing --------------------------------------------------------------
const before = await page.evaluate(() => document.querySelector('.video-column').getBoundingClientRect().width);
const divider = await page.locator('.vnh-divider').boundingBox();
await page.mouse.move(divider.x + 6, divider.y + 60);
await page.mouse.down();
await page.mouse.move(divider.x - 300, divider.y + 60, { steps: 8 });
await page.mouse.up();
const after = await page.evaluate(() => document.querySelector('.video-column').getBoundingClientRect().width);
check('dragging the divider resizes the columns', Math.abs(before - after) > 200, `${before} -> ${after}`);
const savedRatio = await page.evaluate(() => JSON.parse(localStorage.getItem('vacnetEnhancer.settings.v1')).splitRatio);
check('split ratio persisted', typeof savedRatio === 'number', String(savedRatio));

await page.locator('.vnh-height-handle').scrollIntoViewIfNeeded();
const handle = await page.locator('.vnh-height-handle').boundingBox();
await page.mouse.move(handle.x + 40, handle.y + 5);
await page.mouse.down();
await page.mouse.move(handle.x + 40, handle.y - 150, { steps: 6 });
await page.mouse.up();
const liveHeight = await page.evaluate(() => document.querySelector('.videocontainer .video-js').getBoundingClientRect().height);
const savedHeight = await page.evaluate(() => JSON.parse(localStorage.getItem('vacnetEnhancer.settings.v1')).videoHeight);
check('player height persisted', typeof savedHeight === 'number' && savedHeight > 0, String(savedHeight));
check('dragging the handle shrinks the player', Math.abs(liveHeight - savedHeight) < 2, `${liveHeight} vs ${savedHeight}`);

// --- persistence across reloads -------------------------------------------
await page.reload();
await page.waitForSelector('.vnh-toolbar');
await sleep(200);
const restored = await page.evaluate(() => ({
	width: document.querySelector('.video-column').getBoundingClientRect().width,
	hidden: getComputedStyle(document.querySelector('.top-section')).display === 'none',
	height: getComputedStyle(document.querySelector('.videocontainer .video-js')).height,
}));
check('column width restored after reload', Math.abs(restored.width - after) < 3, JSON.stringify(restored));
check('info row still hidden after reload', restored.hidden);
check('player height restored after reload', Math.abs(parseFloat(restored.height) - savedHeight) < 2, restored.height);

// --- reset -----------------------------------------------------------------
await page.click('.vnh-toolbar .vnh-btn:nth-of-type(3)');
await sleep(100);
const resetState = await page.evaluate(() => ({
	settings: JSON.parse(localStorage.getItem('vacnetEnhancer.settings.v1')),
	width: document.querySelector('.video-column').getBoundingClientRect().width,
	varSet: document.documentElement.classList.contains('vnh-video-height'),
}));
check('reset clears the stored sizes',
	resetState.settings.splitRatio === null && resetState.settings.videoHeight === null && !resetState.varSet,
	JSON.stringify(resetState));
check('reset restores the site proportions', Math.abs(resetState.width - before) < 12, `${resetState.width} vs ${before}`);

// --- narrow viewport -------------------------------------------------------
await page.setViewportSize({ width: 800, height: 900 });
await sleep(150);
check('split disabled on narrow layouts',
	!(await page.evaluate(() => document.querySelector('.flex-row-wrap').classList.contains('vnh-split'))));

await browser.close();
server.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);

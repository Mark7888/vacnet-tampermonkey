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

// --- expert view -----------------------------------------------------------
const expertButton = '.vnh-toolbar .vnh-btn:nth-of-type(2)';
await page.click(expertButton);
await sleep(150);

async function readExpertLayout() {
	return page.evaluate(() => {
		const box = (selector) => document.querySelector(selector).getBoundingClientRect();
		const column = document.querySelector('.verdict-column');
		const proceed = document.querySelector('.submitbuttons button');
		return {
			headerVisible: getComputedStyle(document.querySelector('.PageHeader')).display !== 'none',
			footerVisible: getComputedStyle(document.querySelector('.footer-container')).display !== 'none',
			infoVisible: getComputedStyle(document.querySelector('.top-section')).display !== 'none',
			logoVisible: getComputedStyle(document.querySelector('.top-section-logo')).display !== 'none',
			columnWidth: box('.video-column').width,
			videoTop: box('.videocontainer .video-js').top,
			videoBottom: box('.videocontainer .video-js').bottom,
			verdictTop: column.getBoundingClientRect().top,
			verdictBottom: column.getBoundingClientRect().bottom,
			hiddenInsideVerdicts: column.scrollHeight - column.clientHeight,
			proceedBottom: proceed.getBoundingClientRect().bottom,
			blocks: [...document.querySelectorAll('.verdict-block')].map((b) => {
				const r = b.getBoundingClientRect();
				return { left: Math.round(r.left), top: Math.round(r.top) };
			}),
			scrollHeight: document.documentElement.scrollHeight,
			innerHeight: window.innerHeight,
			innerWidth: window.innerWidth,
		};
	});
}

// The layout has to hold up on every screen the stacked mode applies to.
for (const size of [{ width: 1600, height: 900 }, { width: 1920, height: 1080 }, { width: 2560, height: 1440 }]) {
	await page.setViewportSize(size);
	await sleep(200);
	const view = await readExpertLayout();
	const at = `${size.width}x${size.height}`;
	check(`${at}: header, footer and info blocks hidden`,
		!view.headerVisible && !view.footerVisible && !view.infoVisible && !view.logoVisible);
	check(`${at}: player is 80% of the screen width`,
		Math.abs(view.columnWidth - view.innerWidth * 0.8) < 2,
		`${view.columnWidth} vs ${view.innerWidth * 0.8}`);
	check(`${at}: verdicts sit below the player`, view.verdictTop >= view.videoBottom - 1,
		`verdict ${view.verdictTop} vs video bottom ${view.videoBottom}`);
	check(`${at}: the four verdicts form a single row`,
		view.blocks.length === 4
			&& view.blocks.every((b) => Math.abs(b.top - view.blocks[0].top) < 2)
			&& new Set(view.blocks.map((b) => b.left)).size === 4,
		JSON.stringify(view.blocks));
	check(`${at}: nothing is clipped and the page does not scroll`,
		view.scrollHeight <= view.innerHeight + 1
			&& view.verdictBottom <= view.innerHeight + 1
			&& view.proceedBottom <= view.innerHeight + 1
			&& view.hiddenInsideVerdicts <= 1,
		`scrollHeight=${view.scrollHeight} proceed=${Math.round(view.proceedBottom)} `
			+ `hidden=${view.hiddenInsideVerdicts} viewport=${view.innerHeight}`);
	check(`${at}: the player takes most of the height`,
		view.videoBottom - view.videoTop > view.innerHeight * 0.5,
		`${Math.round(view.videoBottom - view.videoTop)}px of ${view.innerHeight}px`);
}

await page.setViewportSize({ width: 1600, height: 900 });
await sleep(150);
check('the page cannot be scrolled in expert view',
	await page.evaluate(() => {
		window.scrollTo(0, 500);
		return window.scrollY === 0;
	}));
check('expert view persisted',
	await page.evaluate(() => JSON.parse(localStorage.getItem('vacnetEnhancer.settings.v1')).expertView === true));

await page.keyboard.press('KeyE');
await sleep(150);
const restoredNormal = await page.evaluate(() => ({
	headerVisible: getComputedStyle(document.querySelector('.PageHeader')).display !== 'none',
	infoVisible: getComputedStyle(document.querySelector('.top-section')).display !== 'none',
	sideBySide: Math.abs(document.querySelector('.video-column').getBoundingClientRect().top
		- document.querySelector('.verdict-column').getBoundingClientRect().top) < 8,
	overflow: getComputedStyle(document.body).overflow,
}));
check('E leaves expert view and restores the page',
	restoredNormal.headerVisible && restoredNormal.infoVisible && restoredNormal.sideBySide
		&& restoredNormal.overflow !== 'hidden',
	JSON.stringify(restoredNormal));

// --- copy link -------------------------------------------------------------
await page.click('.vnh-toolbar .vnh-btn:nth-of-type(1)');
await sleep(100);
const copied = await page.evaluate(() => navigator.clipboard.readText());
check('copy clip link copies the portal link', copied.includes('/vacnet/view?s='), copied);
await page.click('.vnh-toolbar .vnh-btn:nth-of-type(1)', { modifiers: ['Shift'] });
await sleep(100);
const copiedRaw = await page.evaluate(() => navigator.clipboard.readText());
check('shift-click copies the video URL', copiedRaw.endsWith('clip.webm'), copiedRaw);

// --- persistence across reloads -------------------------------------------
await page.click(expertButton);
await page.reload();
await page.waitForSelector('.vnh-toolbar');
await sleep(250);
const afterReload = await page.evaluate(() => ({
	expert: document.documentElement.classList.contains('vnh-expert'),
	pressed: document.querySelector('.vnh-toolbar .vnh-btn:nth-of-type(2)').getAttribute('aria-pressed'),
	headerVisible: getComputedStyle(document.querySelector('.PageHeader')).display !== 'none',
	columnWidth: document.querySelector('.video-column').getBoundingClientRect().width,
	fits: document.documentElement.scrollHeight <= window.innerHeight + 1,
}));
check('expert view restored after reload',
	afterReload.expert && afterReload.pressed === 'true' && !afterReload.headerVisible && afterReload.fits,
	JSON.stringify(afterReload));

// --- untouched layout outside expert view ---------------------------------
await page.click(expertButton);
await sleep(100);
const normalLayout = await page.evaluate(() => {
	const video = document.querySelector('.video-column').getBoundingClientRect();
	const row = document.querySelector('.flex-row-wrap').getBoundingClientRect();
	return {
		ratio: video.width / row.width,
		inlineStyles: document.querySelector('.flex-row-wrap').getAttribute('style'),
		classes: document.querySelector('.flex-row-wrap').className,
	};
});
check('the portal layout is left untouched outside expert view',
	Math.abs(normalLayout.ratio - 0.66) < 0.01 && !normalLayout.inlineStyles
		&& normalLayout.classes === 'flex-row-wrap',
	JSON.stringify(normalLayout));

// --- small screens ---------------------------------------------------------
await page.setViewportSize({ width: 900, height: 700 });
await page.click(expertButton);
await sleep(150);
const small = await page.evaluate(() => ({
	headerVisible: getComputedStyle(document.querySelector('.PageHeader')).display !== 'none',
	overflow: getComputedStyle(document.body).overflow,
	stacked: getComputedStyle(document.querySelector('.flex-row-wrap')).flexDirection === 'column',
}));
check('small screens keep the portal layout but still lose the furniture',
	!small.headerVisible && small.overflow !== 'hidden' && !small.stacked,
	JSON.stringify(small));

await browser.close();
server.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);

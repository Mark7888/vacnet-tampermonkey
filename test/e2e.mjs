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
	const file = path === '/vacnet/intro' ? 'intro.html'
		: path === '/vacnet' || path === '/vacnet/clips' || path === '/' ? 'page.html'
		: path.slice(1);
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

// Non-US layouts: the shortcut has to follow the printed key, not its position.
// On a Hungarian keyboard "0" sits on the Backquote key and "ö" on Digit0.
async function pressLayoutKey(key, code) {
	await page.evaluate(([k, c]) => {
		window.dispatchEvent(new KeyboardEvent('keydown', {
			key: k, code: c, bubbles: true, cancelable: true,
		}));
	}, [key, code]);
}
await page.evaluate(() => { document.getElementById('video_html5_api').currentTime = 295; });
await pressLayoutKey('0', 'Backquote');
check('Hungarian layout: the key that types 0 jumps to the clip start',
	Math.abs(await page.evaluate(() => document.getElementById('video_html5_api').currentTime) - 288.58) < 0.1);
await page.evaluate(() => { document.getElementById('video_html5_api').currentTime = 295; });
await pressLayoutKey('ö', 'Digit0');
check('Hungarian layout: the ö key next to 9 is left alone',
	Math.abs(await page.evaluate(() => document.getElementById('video_html5_api').currentTime) - 295) < 0.01);
await pressLayoutKey('5', 'Digit5');
check('Hungarian layout: 5 still seeks to the middle of the range',
	Math.abs(await page.evaluate(() => document.getElementById('video_html5_api').currentTime) - 293.94) < 0.1,
	String(await page.evaluate(() => document.getElementById('video_html5_api').currentTime)));

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
			playerWidth: box('.videocontainer .video-js').width,
			containerWidth: box('.videocontainer').width,
			videoTop: box('.videocontainer .video-js').top,
			videoBottom: box('.videocontainer .video-js').bottom,
			verdictHeight: column.getBoundingClientRect().height,
			containerPadding: getComputedStyle(document.querySelector('.verdicts-container')).padding,
			firstBlockInset: document.querySelector('.verdict-block').getBoundingClientRect().left
				- document.querySelector('.verdicts-container').getBoundingClientRect().left,
			lastRowGap: column.getBoundingClientRect().bottom
				- document.querySelector('.submitbuttons').getBoundingClientRect().bottom,
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
		Math.abs(view.columnWidth - view.innerWidth * 0.8) < 2
			&& Math.abs(view.containerWidth - view.innerWidth * 0.8) < 2
			&& Math.abs(view.playerWidth - view.innerWidth * 0.8) < 2,
		`column=${view.columnWidth} container=${view.containerWidth} player=${view.playerWidth} `
			+ `want=${view.innerWidth * 0.8}`);
	check(`${at}: the verdict row is only as tall as it needs to be`,
		view.verdictHeight < view.innerHeight * 0.3,
		`${Math.round(view.verdictHeight)}px of ${view.innerHeight}px`);
	check(`${at}: the verdict row has breathing room`,
		parseFloat(view.containerPadding) >= 14 && view.firstBlockInset >= 16 && view.lastRowGap >= 12,
		`padding=${view.containerPadding} inset=${Math.round(view.firstBlockInset)} `
			+ `bottomGap=${Math.round(view.lastRowGap)}`);
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
		view.videoBottom - view.videoTop > view.innerHeight * 0.65,
		`${Math.round(view.videoBottom - view.videoTop)}px of ${view.innerHeight}px`);
}

await page.setViewportSize({ width: 1920, height: 1080 });
await sleep(200);

// --- the redesigned verdict column ----------------------------------------
const readVerdicts = () => page.evaluate(() => {
	const blocks = [...document.querySelectorAll('.verdict-block')];
	const box = (node) => node.getBoundingClientRect();
	const inner = document.querySelector('.verdicts-container-inner');
	const status = document.querySelector('#statustext');
	return {
		titles: blocks.map((b) => b.querySelector('.verdict-desc').textContent.trim()),
		tooltips: blocks.map((b) => b.querySelector('.verdict-desc').getAttribute('title') ?? ''),
		answers: blocks.map((b) => [...b.querySelectorAll('.verdictbutton label')].map((l) => l.textContent)),
		chips: blocks.map((b) => (b.querySelector('.verdictbuttonsverdictlabel')?.textContent ?? '').trim()),
		chipColors: blocks.map((b) => {
			const chip = b.querySelector('.verdictbuttonsverdictlabel');
			return chip ? getComputedStyle(chip).color : '';
		}),
		// Every answer of a block on one line, and every block the same height.
		rows: blocks.map((b) => new Set([...b.querySelectorAll('.verdictbutton label, .verdictbuttonsverdictlabel')]
			.map((l) => Math.round(box(l).top))).size),
		answerHeight: Math.max(0, ...blocks.flatMap((b) => [...b.querySelectorAll('.verdictbutton label')]
			.map((l) => Math.round(box(l).height)))),
		checkedLabel: (() => {
			const input = document.querySelector('input[name="aimassist"]:checked');
			const label = input && document.querySelector(`label[for="${input.id}"]`);
			return label ? { text: label.textContent, background: getComputedStyle(label).backgroundColor } : null;
		})(),
		// The portal paints the buttons; expert view has to take that paint off,
		// or it shows around the answer and stands taller than the row.
		paint: (() => {
			const button = document.querySelector('.verdictbutton');
			if (!button) return null;
			const style = getComputedStyle(button);
			return {
				background: style.backgroundColor,
				border: style.borderTopWidth,
				height: Math.round(box(button).height),
				labelHeight: Math.round(box(button.querySelector('label')).height),
			};
		})(),
		// Everything the panel shows has to fit inside the panel and its grid.
		answersBottom: Math.max(...[...document.querySelectorAll(
			'.verdictbutton label, .verdictbuttonsverdictlabel')].map((n) => box(n).bottom)),
		innerBottom: box(inner).bottom,
		submitBottom: (() => {
			const button = document.querySelector('#submitbuttons button');
			return button ? box(button).bottom : 0;
		})(),
		submitHeight: (() => {
			const button = document.querySelector('#submitbuttons button');
			return button ? Math.round(box(button).height) : 0;
		})(),
		statusTop: status ? box(status).top : 0,
		submitLeft: Math.round(box(document.querySelector('#submitbuttons')).left),
		submitTop: Math.round(box(document.querySelector('#submitbuttons')).top),
		blocksRight: Math.round(box(inner).right),
		blocksTop: Math.round(box(inner).top),
		panelHeight: box(document.querySelector('.verdict-column')).height,
		statusBottom: status ? Math.round(box(status).bottom) : 0,
		panelBottom: Math.round(box(document.querySelector('.verdicts-container')).bottom),
		statusText: status ? status.textContent.trim() : '',
		statusState: document.documentElement.className,
	};
});

const labeling = await readVerdicts();
check('the questions are shortened to a title',
	JSON.stringify(labeling.titles) === JSON.stringify(['Aim Hack', 'Wall Hack', 'BHop', 'Bot Behavior']),
	JSON.stringify(labeling.titles));
check('the portal\'s own question stays as a tooltip',
	labeling.tooltips.every((q) => q.length > 20), JSON.stringify(labeling.tooltips));
check('every block offers Yes / Uncertain / No',
	labeling.answers.every((row) => JSON.stringify(row) === '["Yes","Uncertain","No"]'),
	JSON.stringify(labeling.answers));
check('the three answers sit on one line and are small',
	labeling.rows.every((tops) => tops === 1) && labeling.answerHeight <= 30,
	`rows=${JSON.stringify(labeling.rows)} height=${labeling.answerHeight}`);
check('the portal\'s own paint on the buttons is taken off',
	labeling.paint.background === 'rgba(0, 0, 0, 0)' && labeling.paint.border === '0px'
		&& labeling.paint.height === 28 && labeling.paint.labelHeight === 28,
	JSON.stringify(labeling.paint));
check('the grid inside the panel is not boxed in with a second background',
	await page.evaluate(() => {
		const style = getComputedStyle(document.querySelector('.verdicts-container-inner'));
		return style.backgroundColor === 'rgba(0, 0, 0, 0)' && style.borderTopWidth === '0px';
	}),
	await page.evaluate(() => getComputedStyle(document.querySelector('.verdicts-container-inner')).backgroundColor));
check('nothing spills out of the verdict grid or the panel',
	labeling.answersBottom <= labeling.innerBottom + 1
		&& labeling.answersBottom <= labeling.panelBottom + 1,
	JSON.stringify({ answers: Math.round(labeling.answersBottom), inner: Math.round(labeling.innerBottom),
		panel: labeling.panelBottom }));
check('Proceed sits on the same line as the answers',
	Math.abs(labeling.submitBottom - labeling.answersBottom) < 2 && labeling.submitHeight === 28,
	JSON.stringify({ proceed: Math.round(labeling.submitBottom), answers: Math.round(labeling.answersBottom),
		height: labeling.submitHeight }));
check('the status line sits below the answers, not over them',
	labeling.statusTop >= labeling.answersBottom - 1,
	JSON.stringify({ status: Math.round(labeling.statusTop), answers: Math.round(labeling.answersBottom) }));
check('the submit button sits beside the verdicts, not under them',
	labeling.submitLeft >= labeling.blocksRight && Math.abs(labeling.submitTop - labeling.blocksTop) < 60,
	JSON.stringify({ submitLeft: labeling.submitLeft, blocksRight: labeling.blocksRight }));
check('the status line is a centred pill with room around its text',
	await page.evaluate(() => {
		const status = document.querySelector('#statustext');
		const panel = document.querySelector('.verdicts-container');
		const s = status.getBoundingClientRect();
		const p = panel.getBoundingClientRect();
		const style = getComputedStyle(status);
		return {
			centred: Math.abs((s.left + s.right) / 2 - (p.left + p.right) / 2) < 2,
			padded: parseFloat(style.paddingLeft) >= 8 && parseFloat(style.paddingRight) >= 8,
			hugsText: s.width < p.width / 2,
		};
	}).then((r) => r.centred && r.padded && r.hugsText),
	JSON.stringify(await page.evaluate(() => {
		const s = document.querySelector('#statustext').getBoundingClientRect();
		return { left: Math.round(s.left), width: Math.round(s.width) };
	})));
check('the status line has its own space at the bottom of the panel',
	labeling.statusBottom > 0 && labeling.statusBottom <= labeling.panelBottom,
	JSON.stringify({ status: labeling.statusBottom, panel: labeling.panelBottom }));

// Picking an answer still goes through the portal's own radio buttons.
await page.click('.verdict-block:first-child .verdictbutton.positive label');
await sleep(150);
const picked = await readVerdicts();
check('clicking an answer checks the portal\'s radio and highlights it',
	await page.evaluate(() => document.getElementById('aimassist_positive').checked)
		&& picked.checkedLabel.text === 'Yes'
		&& picked.checkedLabel.background === 'rgb(232, 177, 60)',
	JSON.stringify(picked.checkedLabel));

// --- Proceed: the portal replaces the buttons with the chosen answers -------
await page.click('#submitVerdictButton');
await sleep(200);
const confirming = await readVerdicts();
check('the layout survives the portal re-rendering the verdicts',
	confirming.rows.every((tops) => tops === 1)
		&& (await page.evaluate(() => document.querySelectorAll('#submitbuttons button').length)) === 2
		&& (await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1)),
	JSON.stringify(confirming.rows));
check('the confirm stage shows the same wording in the same colours',
	JSON.stringify(confirming.chips) === JSON.stringify(['Yes', 'Uncertain', 'Uncertain', 'Uncertain'])
		&& confirming.chipColors[0] === 'rgb(232, 177, 60)',
	JSON.stringify({ chips: confirming.chips, colors: confirming.chipColors }));
check('the panel does not resize when the portal swaps in the confirm stage',
	Math.abs(confirming.panelHeight - labeling.panelHeight) < 1,
	`${labeling.panelHeight} -> ${confirming.panelHeight}`);

// Back returns to the buttons with the answers the portal remembered.
await page.click('#backbutton');
await sleep(200);
const back = await readVerdicts();
check('Back returns to the redesigned buttons with the answer still picked',
	JSON.stringify(back.answers[0]) === '["Yes","Uncertain","No"]'
		&& back.checkedLabel.text === 'Yes'
		&& back.checkedLabel.background === 'rgb(232, 177, 60)'
		&& Math.abs(back.panelHeight - labeling.panelHeight) < 1,
	JSON.stringify({ answers: back.answers[0], checked: back.checkedLabel, height: back.panelHeight }));
await page.click('#submitVerdictButton');
await sleep(200);

// --- Confirm: the portal writes its status line and posts the form ---------
// The POST itself is stubbed out so the submitting state can be inspected; the
// page it would land on is visited by hand below.
await page.evaluate(() => { HTMLFormElement.prototype.submit = function () {}; });
await page.click('#submitVerdictButton');
await sleep(250);
const submitting = await readVerdicts();
check('the submitting status is styled and does not resize the panel',
	/Submitting/i.test(submitting.statusText)
		&& / vnh-status-busy|^vnh-status-busy/.test(' ' + submitting.statusState)
		&& Math.abs(submitting.panelHeight - labeling.panelHeight) < 1,
	JSON.stringify({ text: submitting.statusText, classes: submitting.statusState, height: submitting.panelHeight }));

await page.goto('http://localhost:8731/vacnet?submit_success=1');
await page.waitForSelector('.vnh-toolbar');
await sleep(300);
const submitted = await readVerdicts();
check('the submitted confirmation is styled and does not resize the panel',
	/Submitted/i.test(submitted.statusText)
		&& submitted.statusState.includes('vnh-status-done')
		&& submitted.statusTop >= submitted.answersBottom - 1
		&& Math.abs(submitted.panelHeight - labeling.panelHeight) < 1,
	JSON.stringify({ text: submitted.statusText, classes: submitted.statusState, height: submitted.panelHeight }));

await page.goto('http://localhost:8731/vacnet');
await page.waitForSelector('.vnh-toolbar');
await sleep(300);

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
check('leaving expert view puts the portal\'s own wording back',
	await page.evaluate(() => {
		const desc = document.querySelector('.verdict-desc');
		const labels = [...document.querySelectorAll('.verdict-block:first-child .verdictbutton label')]
			.map((l) => l.textContent.replace(/\s+/g, ' ').trim());
		return desc.textContent.length > 20 && !desc.getAttribute('title')
			&& labels.join('|') === 'Label Aim Assist|Uncertain|Label Not Aim Assist';
	}),
	await page.evaluate(() => [...document.querySelectorAll('.verdict-block:first-child .verdictbutton label')]
		.map((l) => l.textContent.replace(/\s+/g, ' ').trim()).join('|')));
check('leaving expert view removes every inline style it added',
	await page.evaluate(() => [
		'.page-container', '.flex-row-wrap', '.video-column', '.videocontainer',
		'.verdict-column', '.verdicts-container', '.verdicts-container-inner',
		'.verdict-block', '.verdict-desc', '.verdictbuttons', '.verdictbutton',
		'.verdictbutton label', '.verdictbutton input', '#submitbuttons', '#submitbuttons button',
		'#statustext', '.PageHeader', '.footer-container', '.top-section',
	].every((selector) => [...document.querySelectorAll(selector)]
		.every((node) => !node.getAttribute('style')))));

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
	!normalLayout.inlineStyles && normalLayout.classes === 'flex-row-wrap'
		&& normalLayout.ratio > 0.3 && normalLayout.ratio < 0.75,
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

// --- intro page ------------------------------------------------------------
// The portal shows its welcome screen on every visit; expert view follows the
// "Got It" link on its own instead of making you click it.
const intro = await context.newPage();
await intro.addInitScript(SCRIPT);
await intro.goto('http://localhost:8731/vacnet/clips');
await intro.evaluate(() => {
	localStorage.setItem('vacnetEnhancer.settings.v1', JSON.stringify({ fullContext: false, expertView: false }));
	sessionStorage.clear();
});

await intro.goto('http://localhost:8731/vacnet/intro');
await sleep(300);
check('the intro page is left alone outside expert view',
	new URL(intro.url()).pathname === '/vacnet/intro', intro.url());

await intro.evaluate(() => {
	localStorage.setItem('vacnetEnhancer.settings.v1', JSON.stringify({ fullContext: false, expertView: true }));
});
await intro.goto('http://localhost:8731/vacnet/intro');
await intro.waitForURL('**/vacnet/clips', { timeout: 5000 }).catch(() => {});
check('expert view skips straight to the clips',
	new URL(intro.url()).pathname === '/vacnet/clips', intro.url());
check('the clip page still gets the toolbar after the skip',
	await intro.locator('.vnh-toolbar').count() === 1);

// A portal that bounces back to the intro must not turn into a redirect loop.
await intro.goto('http://localhost:8731/vacnet/intro');
await sleep(400);
check('a second intro page right after a skip is left alone',
	new URL(intro.url()).pathname === '/vacnet/intro', intro.url());
await intro.close();

await browser.close();
server.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);

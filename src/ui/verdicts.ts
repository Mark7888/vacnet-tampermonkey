/**
 * Expert view's verdict column.
 *
 * The portal spends a lot of column height repeating itself: every question is
 * a full sentence, and each of its three buttons spells the answer out again
 * ("Label Aim Assist" / "Uncertain" / "Label Not Aim Assist"). Stacked under a
 * wide player that is height the video could be using, so expert view boils
 * each question down to a short title over a small Yes / Uncertain / No switch,
 * and moves the submit buttons beside the row instead of under it.
 *
 * Nothing is removed - the portal's own wording stays reachable as a tooltip,
 * and every rewrite is undone when expert view is switched off.
 *
 * The portal drives three states through the same markup (labeling, confirming
 * after Proceed, and submitting), so all three are given the same slots and the
 * same heights: the row never changes size as the portal swaps one for another,
 * and the status line the portal fills in ("Submitting...", "Labels Submitted")
 * sits in reserved space at the bottom of the panel rather than pushing the
 * player around when it appears.
 */

import { attr, style, text } from './patch';
import type { Declarations } from './patch';

type Choice = 'positive' | 'skip' | 'negative';

interface Look {
	/** What expert view calls this answer. */
	label: string;
	solid: string;
	soft: string;
	edge: string;
}

const CHOICES: Record<Choice, Look> = {
	positive: { label: 'Yes', solid: '#e8b13c', soft: 'rgba(232, 177, 60, 0.12)', edge: 'rgba(232, 177, 60, 0.45)' },
	skip: { label: 'Uncertain', solid: '#dfe7ee', soft: 'rgba(223, 231, 238, 0.09)', edge: 'rgba(223, 231, 238, 0.32)' },
	negative: { label: 'No', solid: '#4f9ada', soft: 'rgba(79, 154, 218, 0.14)', edge: 'rgba(79, 154, 218, 0.45)' },
};

const ORDER: Choice[] = ['positive', 'skip', 'negative'];

/** Short titles for the portal's questions, keyed by the radio group name. */
const TITLES: Record<string, string> = {
	aimassist: 'Aim Hack',
	wallhack: 'Wall Hack',
	autobhop: 'BHop',
	bot: 'Bot Behavior',
};

/** Height the answer row keeps in every stage, so nothing moves between them. */
const ROW_HEIGHT = '28px';
/** Space kept free at the bottom of the panel for the portal's status line. */
const STATUS_SPACE = '22px';

const PRIMARY_BUTTON: Declarations = {
	'box-sizing': 'border-box',
	margin: '0',
	padding: '7px 20px',
	background: 'var(--vnh-accent, #d5903a)',
	border: '1px solid transparent',
	'border-radius': '3px',
	color: '#10151b',
	font: 'inherit',
	'font-size': '12px',
	'font-weight': '700',
	'letter-spacing': '0.08em',
	'text-transform': 'uppercase',
	cursor: 'pointer',
	transition: 'filter 0.12s ease',
};

const GHOST_BUTTON: Declarations = {
	...PRIMARY_BUTTON,
	background: 'rgba(255, 255, 255, 0.06)',
	border: '1px solid rgba(198, 212, 223, 0.28)',
	color: 'var(--vnh-text, #c6d4df)',
	'font-weight': '600',
};

/** State of the portal's status line, mirrored onto <html> for the CSS icons. */
type Status = 'busy' | 'done' | 'plain' | null;

function squash(value: string | null | undefined): string {
	return (value ?? '').replace(/\s+/g, ' ').trim();
}

/** The radio group a verdict block belongs to, e.g. "aimassist". */
function groupKey(buttons: HTMLElement): string {
	const fromId = /^verdictbuttons_(.+)$/.exec(buttons.id ?? '');
	if (fromId) return fromId[1];
	return buttons.querySelector('input[type="radio"]')?.getAttribute('name') ?? '';
}

/**
 * A short name for the question. The portal's own short name for it shows up in
 * the positive button ("Aim Assist") and again in the confirm stage, so an
 * unknown question still gets something better than a paragraph.
 */
function shortTitle(key: string, buttons: HTMLElement): string {
	const known = TITLES[key];
	if (known) return known;
	const own = buttons.querySelector('.verdictbutton.positive .highlight-text')
		?? buttons.querySelector('.highlight-text')
		?? buttons.querySelector('.verdictbuttonslabel');
	return squash(own?.textContent).replace(/\s*:\s*$/, '');
}

function choiceOf(button: HTMLElement, input: HTMLInputElement | null): Choice | null {
	const value = input?.value ?? '';
	if (value === 'positive' || value === 'skip' || value === 'negative') return value;
	return ORDER.find((choice) => button.classList.contains(choice)) ?? null;
}

/** What the confirm stage said before we replaced its wording with ours. */
const confirmed = new WeakMap<HTMLElement, Choice>();

/**
 * Reads back what the portal wrote into the confirm stage. It builds that line
 * from the same branch that builds the hidden form input, so this is the answer
 * that is about to be submitted - more trustworthy than anything we remember.
 * The reading is kept per element, because shortening the line to "Yes" is what
 * removes the markup it was read from.
 */
function confirmedChoice(verdict: HTMLElement): Choice | null {
	const known = confirmed.get(verdict);
	if (known) return known;
	const choice = verdict.querySelector('.highlight-text-negative') ? 'negative'
		: verdict.querySelector('.highlight-text') ? 'positive'
		: verdict.querySelector('b') ? 'skip'
		: null;
	if (choice) confirmed.set(verdict, choice);
	return choice;
}

function answerStyle(look: Look, checked: boolean): Declarations {
	return {
		display: 'flex',
		'align-items': 'center',
		'justify-content': 'center',
		'box-sizing': 'border-box',
		width: '100%',
		height: '100%',
		'min-height': ROW_HEIGHT,
		margin: '0',
		padding: '0 10px',
		background: checked ? look.solid : look.soft,
		border: `1px solid ${checked ? look.solid : look.edge}`,
		'border-radius': '3px',
		color: checked ? '#10151b' : look.solid,
		'font-size': '12px',
		'font-weight': checked ? '700' : '500',
		'line-height': '1.2',
		'letter-spacing': '0.02em',
		'text-align': 'center',
		'white-space': 'nowrap',
		cursor: 'pointer',
		transition: 'background-color 0.12s ease, color 0.12s ease, border-color 0.12s ease',
	};
}

/** Stage one: the question and its three radio buttons. */
function decorateAnswers(buttons: HTMLElement): void {
	for (const button of Array.from(buttons.querySelectorAll<HTMLElement>('.verdictbutton'))) {
		const input = button.querySelector<HTMLInputElement>('input[type="radio"]');
		const choice = choiceOf(button, input);
		if (!choice) continue;
		const look = CHOICES[choice];

		style(button, {
			position: 'relative',
			// Sized by its own word, not an equal third: "Uncertain" needs more
			// room than "Yes", and squeezing it makes the row overlap when the
			// column gets narrow.
			flex: '1 1 auto',
			'min-width': '0',
			margin: '0',
			padding: '0',
		});
		// The radio itself is never the target - the label is - but it stays in
		// the DOM (and focusable) so the portal reads the same value as always.
		if (input) {
			style(input, {
				position: 'absolute',
				inset: '0',
				width: '100%',
				height: '100%',
				margin: '0',
				opacity: '0',
				'pointer-events': 'none',
			});
		}

		const label = button.querySelector<HTMLElement>('label');
		if (!label) continue;
		if (label.textContent !== look.label) attr(label, 'title', squash(label.textContent));
		text(label, look.label);
		style(label, answerStyle(look, input?.checked === true));
	}
}

/** Stage two: the portal has replaced the buttons with the chosen answers. */
function decorateConfirmed(buttons: HTMLElement): void {
	const verdict = buttons.querySelector<HTMLElement>('.verdictbuttonsverdictlabel');
	if (!verdict) return;

	// "Aim Assist :" - the short title above already says which question it is.
	const name = buttons.querySelector<HTMLElement>('.verdictbuttonslabel');
	if (name) style(name, { display: 'none', margin: '0' });

	const choice = confirmedChoice(verdict);
	const look = choice ? CHOICES[choice] : CHOICES.skip;
	if (choice && verdict.textContent !== look.label) attr(verdict, 'title', squash(verdict.textContent));
	if (choice) text(verdict, look.label);
	style(verdict, {
		...answerStyle(look, false),
		width: 'auto',
		padding: '0 16px',
		cursor: 'default',
		'font-weight': '700',
	});
}

function decorateBlock(block: HTMLElement): void {
	const buttons = block.querySelector<HTMLElement>('.verdictbuttons');
	if (!buttons) return;

	style(block, {
		display: 'flex',
		'flex-direction': 'column',
		gap: '6px',
		'min-width': '0',
		margin: '0',
		padding: '0',
	});

	const desc = block.querySelector<HTMLElement>('.verdict-desc');
	const title = shortTitle(groupKey(buttons), buttons);
	if (desc) {
		if (title && desc.textContent !== title) attr(desc, 'title', squash(desc.textContent));
		if (title) text(desc, title);
		style(desc, {
			display: 'block',
			overflow: 'hidden',
			margin: '0',
			color: 'var(--vnh-text, #c6d4df)',
			'font-size': '11px',
			'font-weight': '700',
			'letter-spacing': '0.09em',
			'line-height': '1.3',
			'text-align': 'center',
			'text-transform': 'uppercase',
			'text-overflow': 'ellipsis',
			'white-space': 'nowrap',
		});
	}

	// One line, whichever stage the portal is in, always the same height.
	style(buttons, {
		display: 'flex',
		'flex-wrap': 'nowrap',
		'justify-content': 'center',
		'align-items': 'stretch',
		gap: '4px',
		height: ROW_HEIGHT,
		'min-height': ROW_HEIGHT,
		margin: '0',
		padding: '0',
	});

	decorateAnswers(buttons);
	decorateConfirmed(buttons);
}

function statusState(status: HTMLElement): Status {
	const said = squash(status.textContent);
	if (!said) return null;
	// The portal's own wording: "Submitting...", "Please Wait...", "Labels Submitted".
	if (/\.\.\.|…|submitting|please wait/i.test(said)) return 'busy';
	if (/submitted|success|thank/i.test(said)) return 'done';
	return 'plain';
}

/** Places the Proceed / Back / Confirm buttons and the status line. */
function decorateSubmit(): void {
	const container = document.querySelector<HTMLElement>('.verdicts-container');
	const inner = document.querySelector<HTMLElement>('.verdicts-container-inner');
	const submit = document.querySelector<HTMLElement>('#submitbuttons, .submitbuttons');
	const status = document.querySelector<HTMLElement>('#statustext, .status-text-container');

	if (container) {
		style(container, {
			position: 'relative',
			'box-sizing': 'border-box',
			display: 'flex',
			'flex-wrap': 'wrap',
			'align-items': 'center',
			gap: '10px 22px',
			width: '100%',
			height: 'auto',
			'min-height': '0',
			'max-height': 'none',
			margin: '0',
			// Room at the bottom for the status line, which is taken out of the
			// flow below so the panel keeps its size when the portal fills it in.
			padding: `14px 22px calc(12px + ${STATUS_SPACE})`,
		});
	}

	if (inner) {
		style(inner, {
			display: 'grid',
			'grid-template-columns': 'repeat(auto-fit, minmax(150px, 1fr))',
			'align-items': 'start',
			flex: '1 1 380px',
			gap: '10px 20px',
			width: 'auto',
			height: 'auto',
			'min-width': '0',
			'min-height': '0',
			margin: '0',
			padding: '0',
		});
	}

	if (submit) {
		style(submit, {
			display: 'flex',
			'flex-wrap': 'nowrap',
			'justify-content': 'center',
			'align-items': 'center',
			flex: '0 0 auto',
			gap: '8px',
			// Wide enough for Back + Confirm, so Proceed alone sits in the same
			// place and the row does not reshuffle when the portal swaps them.
			'min-width': '196px',
			// Stays on the right even on a panel too narrow to keep it in the row.
			margin: '0 0 0 auto',
			padding: '0',
			'border-left': '1px solid rgba(198, 212, 223, 0.14)',
			'padding-left': '22px',
		});
		for (const button of Array.from(submit.querySelectorAll<HTMLElement>('button'))) {
			// `display` is left alone on purpose: the portal hides both buttons
			// while it submits, and an inline !important display would undo that.
			style(button, button.classList.contains('backbutton') ? GHOST_BUTTON : PRIMARY_BUTTON);
		}
	}

	if (status) {
		style(status, {
			position: 'absolute',
			left: '22px',
			right: '22px',
			bottom: '8px',
			height: STATUS_SPACE,
			margin: '0',
			padding: '0',
			color: 'var(--vnh-text-dim, #8fa0ad)',
			'font-size': '12px',
			'line-height': STATUS_SPACE,
			'letter-spacing': '0.04em',
			'text-align': 'center',
		});
		for (const line of Array.from(status.querySelectorAll<HTMLElement>('p'))) {
			style(line, { display: 'inline', margin: '0', padding: '0', font: 'inherit', color: 'inherit' });
		}
		setStatusState(statusState(status));
	} else {
		setStatusState(null);
	}
}

let shown: Status = null;

/**
 * The spinner and the tick are CSS (see src/styles.ts) keyed off <html>, so the
 * portal can keep rewriting the status line without us adding nodes to it.
 */
function setStatusState(state: Status): void {
	if (state === shown) return;
	shown = state;
	const classes = document.documentElement.classList;
	classes.toggle('vnh-status-busy', state === 'busy');
	classes.toggle('vnh-status-done', state === 'done');
}

export function decorateVerdicts(): void {
	for (const block of Array.from(document.querySelectorAll<HTMLElement>('.verdict-block'))) {
		decorateBlock(block);
	}
	decorateSubmit();
}

/** Drops the state classes; the markup itself is restored by ui/patch.ts. */
export function resetVerdicts(): void {
	setStatusState(null);
}

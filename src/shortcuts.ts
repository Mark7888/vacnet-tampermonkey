/** Shared description of the keyboard map, used by the handler and the help modal. */

export interface ShortcutSection {
	title: string;
	items: [keys: string, description: string][];
}

export const SHORTCUTS: ShortcutSection[] = [
	{
		title: 'Playback',
		items: [
			['Space / K', 'Play / pause'],
			['&larr; / &rarr;', 'Seek 1s &mdash; hold Shift for 5s, Alt for 0.1s'],
			['J / L', 'Seek 5 seconds'],
			[', / .', 'Step one frame back / forward'],
			['0 / Home', 'Jump to the start of the range'],
			['End', 'Jump to the end of the range'],
			['1 &ndash; 9', 'Jump to 10% &ndash; 90% of the range'],
		],
	},
	{
		title: 'Speed, audio, view',
		items: [
			['- / +', 'Slower / faster playback'],
			['Backspace', 'Reset speed to 1x'],
			['&uarr; / &darr;', 'Volume up / down'],
			['M', 'Mute / unmute'],
			['F', 'Fullscreen'],
		],
	},
	{
		title: 'Portal',
		items: [
			['C', 'Toggle "View full context"'],
			['Y', 'Copy clip link'],
			['H', 'Hide / show the info row'],
			['R', 'Reset the panel layout'],
			['?', 'Show / hide this list'],
			['Esc', 'Close this list'],
		],
	},
];

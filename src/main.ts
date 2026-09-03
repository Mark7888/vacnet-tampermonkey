/**
 * CS2 VACnet Labeling Portal Enhancer.
 *
 * Entry point: the clip-window hook has to be installed at document-start, the
 * rest of the UI is built once the portal's markup exists.
 */

import { installClampHook, isClampHooked, setClampSuppressed } from './clamp';
import { installKeyboard } from './keyboard';
import { getClipPageUrl, getClipVideoUrl } from './player';
import { getSettings, loadSettings, updateSettings } from './settings';
import { applyAccentFromPage, injectStyles } from './styles';
import { closeHelp, toggleHelp } from './ui/help';
import { installLayout } from './ui/layout';
import { installToolbar } from './ui/toolbar';
import { toast } from './ui/toast';
import { copyText, log, onReady } from './util';

installClampHook();
loadSettings();
setClampSuppressed(getSettings().fullContext);

onReady(() => {
	if (!document.querySelector('.videocontainer')) {
		log('no player on this page - nothing to do');
		return;
	}

	injectStyles();
	applyAccentFromPage();

	const layout = installLayout();

	const setInfoHidden = (value: boolean): void => {
		updateSettings({ infoHidden: value });
		document.documentElement.classList.toggle('vnh-hide-info', value);
		toolbar?.syncInfoHidden(value);
	};

	const setFullContext = (value: boolean, notify = true): void => {
		updateSettings({ fullContext: value });
		setClampSuppressed(value);
		toolbar?.syncFullContext(value);
		if (!notify) return;
		if (value && !isClampHooked()) {
			toast('Full context on (no clip timer was found on this page)');
		} else {
			toast(value ? 'Full context on' : 'Clip window restored');
		}
	};

	const copyClipLink = (rawVideo: boolean): void => {
		const pageUrl = getClipPageUrl();
		const videoUrl = getClipVideoUrl();
		const url = rawVideo ? videoUrl ?? pageUrl : pageUrl ?? videoUrl;
		if (!url) {
			toast('No clip link found on this page');
			return;
		}
		void copyText(url).then((ok) => {
			if (!ok) {
				toast('Could not copy the link');
				return;
			}
			toast(url === videoUrl ? 'Video URL copied' : 'Clip link copied');
		});
	};

	const resetLayout = (): void => {
		layout.reset();
		toast('Layout reset');
	};

	const toolbar = installToolbar({
		onToggleFullContext: (next) => setFullContext(next),
		onCopyLink: copyClipLink,
		onToggleInfo: () => setInfoHidden(!getSettings().infoHidden),
		onResetLayout: resetLayout,
		onHelp: toggleHelp,
	});

	// Push the stored preferences into the freshly built UI.
	setFullContext(getSettings().fullContext, false);
	setInfoHidden(getSettings().infoHidden);

	installKeyboard({
		toggleFullContext: () => setFullContext(!getSettings().fullContext),
		toggleInfo: () => setInfoHidden(!getSettings().infoHidden),
		copyClipLink: () => copyClipLink(false),
		resetLayout,
		toggleHelp,
		closeHelp,
	});

	log('ready');
});

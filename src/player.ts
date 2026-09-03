/** Access to the portal's video element and to the clip range baked into the page. */

export interface ClipRange {
	start: number;
	end: number;
	/** Timestamp of the flagged event, when the page exposes one. */
	event: number | null;
}

interface VideoJsPlayer {
	requestFullscreen?: () => void;
	isFullscreen?: () => boolean;
	exitFullscreen?: () => void;
	playbackRates?: (rates: number[]) => void;
}

let cachedMedia: HTMLVideoElement | null = null;
let cachedRange: ClipRange | null | undefined;

export function getMedia(): HTMLVideoElement | null {
	if (cachedMedia && cachedMedia.isConnected) return cachedMedia;
	cachedMedia = document.querySelector<HTMLVideoElement>('.videocontainer video, video#video, video');
	return cachedMedia;
}

export function getPlayerRoot(): HTMLElement | null {
	return document.querySelector<HTMLElement>('.videocontainer .video-js')
		?? document.querySelector<HTMLElement>('.videocontainer video');
}

/** The video.js player instance, when video.js has already initialised. */
export function getVideoJsPlayer(): VideoJsPlayer | null {
	const videojs = (window as unknown as { videojs?: { getPlayer?: (id: string) => VideoJsPlayer | null } }).videojs;
	try {
		return videojs?.getPlayer?.('video') ?? null;
	} catch {
		return null;
	}
}

/**
 * The clip window is only present as literals inside the portal's inline script,
 * so we read it back out of the script text.
 */
export function getClipRange(): ClipRange | null {
	if (cachedRange !== undefined) return cachedRange;
	cachedRange = parseClipRange();
	return cachedRange;
}

function parseClipRange(): ClipRange | null {
	const number = '(-?\\d+(?:\\.\\d+)?)';
	const startRe = new RegExp(`startTime\\s*=\\s*${number}`);
	const durationRe = new RegExp(`endTime\\s*=\\s*startTime\\s*\\+\\s*${number}`);
	const endRe = new RegExp(`endTime\\s*=\\s*${number}`);
	const eventRe = new RegExp(`eventTime\\s*=\\s*${number}`);

	for (const script of Array.from(document.querySelectorAll('script'))) {
		const text = script.textContent;
		if (!text || !text.includes('startTime')) continue;
		const start = startRe.exec(text);
		if (!start) continue;
		const startTime = Number(start[1]);
		const duration = durationRe.exec(text);
		const absoluteEnd = endRe.exec(text);
		const endTime = duration
			? startTime + Number(duration[1])
			: absoluteEnd
				? Number(absoluteEnd[1])
				: NaN;
		if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) continue;
		const event = eventRe.exec(text);
		return {
			start: startTime,
			end: endTime,
			event: event ? Number(event[1]) : null,
		};
	}
	return null;
}

/** The direct URL of the clip file the player is currently using. */
export function getClipVideoUrl(): string | null {
	const media = getMedia();
	if (media?.currentSrc) return media.currentSrc;
	const source = document.querySelector<HTMLSourceElement>('.videocontainer source[src]');
	return source?.src ?? null;
}

/** The shareable portal link for this task, when the page renders one. */
export function getClipPageUrl(): string | null {
	const link = document.querySelector<HTMLAnchorElement>('a[href*="/vacnet/view"]');
	return link?.href ?? null;
}

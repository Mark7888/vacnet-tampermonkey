// Simulated media element + minimal video.js stand-in, so the portal's own
// player script runs unmodified without needing a real 5 minute clip.
(function () {
	const media = document.getElementById('video');
	let position = 0, paused = true, rate = 1, vol = 1, muted = false;
	const fire = (name) => media.dispatchEvent(new Event(name));
	const define = (name, get, set) => Object.defineProperty(media, name, { get, set, configurable: true });
	define('currentTime', () => position, (v) => { position = Number(v); fire('seeked'); fire('timeupdate'); });
	define('duration', () => 310, () => {});
	define('paused', () => paused, () => {});
	define('playbackRate', () => rate, (v) => { rate = Number(v); fire('ratechange'); });
	define('volume', () => vol, (v) => { vol = Number(v); fire('volumechange'); });
	define('muted', () => muted, (v) => { muted = !!v; fire('volumechange'); });
	media.play = () => { paused = false; fire('play'); return Promise.resolve(); };
	media.pause = () => { paused = true; fire('pause'); };
	window.setInterval(function tick() {
		if (!paused) { position += 0.05 * rate; fire('timeupdate'); }
	}, 50);

	// video.js stand-in: wraps the element the same way and proxies the calls the
	// portal script makes.
	const wrapper = document.createElement('div');
	wrapper.className = 'video-js vjs-fake';
	media.parentNode.insertBefore(wrapper, media);
	wrapper.appendChild(media);
	wrapper.id = 'video';
	media.id = 'video_html5_api';
	media.classList.remove('video-js');
	const player = {
		volume: (v) => (v === undefined ? media.volume : (media.volume = v)),
		muted: (v) => (v === undefined ? media.muted : (media.muted = v)),
		currentTime: (v) => (v === undefined ? media.currentTime : (media.currentTime = v)),
		play: () => media.play(),
		pause: () => media.pause(),
		on: (name, fn) => media.addEventListener(name, fn),
		isFullscreen: () => false,
		requestFullscreen: () => {},
		playbackRates: () => {},
	};
	window.videojs = (id) => player;
	window.videojs.getPlayer = (id) => player;
	setTimeout(() => fire('loadeddata'), 30);
})();

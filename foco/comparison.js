const video = document.querySelector('#comparison-video');
const control = document.querySelector('.comparison-playback');

if (video && control) {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const errorMessage = document.querySelector('.comparison-error');
    let wantsPlayback = !reducedMotion.matches && navigator.connection?.saveData !== true;
    let visible = false;

    function updateControl() {
        const playing = !video.paused && !video.ended;
        control.dataset.playing = String(playing);
        control.setAttribute('aria-label', playing ? 'Pausar comparación' : 'Reproducir comparación');
    }

    async function playIfWanted() {
        if (!wantsPlayback || !visible || document.hidden) return;
        // The below-the-fold recording is downloaded only when it can be watched.
        // Choose once, when first watched. Resizing must not restart the recording
        // or download a second file. Both encodes retain the original 60 fps.
        if (!video.hasAttribute('src')) video.src = window.matchMedia('(max-width: 720px)').matches
            ? video.dataset.srcMobile : video.dataset.src;
        try { await video.play(); } catch { updateControl(); }
    }

    video.muted = true;
    video.controls = false;
    control.hidden = false;
    video.addEventListener('play', updateControl);
    video.addEventListener('pause', updateControl);
    video.addEventListener('error', () => {
        wantsPlayback = false;
        errorMessage.hidden = false;
        updateControl();
    });
    video.addEventListener('loadeddata', () => { errorMessage.hidden = true; });
    control.addEventListener('click', () => {
        wantsPlayback = video.paused;
        if (wantsPlayback) {
            if (video.error) video.load();
            playIfWanted();
        } else video.pause();
    });

    if ('IntersectionObserver' in window) {
        new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting && entry.intersectionRatio >= .25;
            if (visible) playIfWanted();
            else video.pause();
        }, { threshold: [0, .25] }).observe(video);
    } else {
        visible = true;
        playIfWanted();
    }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) video.pause();
        else playIfWanted();
    });
    reducedMotion.addEventListener('change', () => {
        if (reducedMotion.matches) {
            wantsPlayback = false;
            video.pause();
        }
    });
}

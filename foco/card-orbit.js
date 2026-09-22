const orbit = document.querySelector('#card-orbit-video');
const control = document.querySelector('.orbit-playback');
if (orbit && control) {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let wantsPlayback = !reducedMotion.matches && navigator.connection?.saveData !== true;
    let visible = false;

    function updateControl() {
        const playing = !orbit.paused && !orbit.ended;
        control.dataset.playing = String(playing);
        control.setAttribute('aria-label', playing ? 'Pausar animación' : 'Reproducir animación');
    }
    async function playIfWanted() {
        if (!wantsPlayback || !visible || document.hidden) return;
        if (!orbit.hasAttribute('src')) orbit.src = orbit.dataset.src;
        try { await orbit.play(); } catch { updateControl(); }
    }
    orbit.muted = true;
    orbit.controls = false;
    control.hidden = false;
    orbit.addEventListener('play', updateControl);
    orbit.addEventListener('pause', updateControl);
    orbit.addEventListener('error', () => { wantsPlayback = false; updateControl(); });
    control.addEventListener('click', () => {
        wantsPlayback = orbit.paused;
        if (wantsPlayback) {
            if (orbit.error) orbit.load();
            playIfWanted();
        } else orbit.pause();
    });
    if ('IntersectionObserver' in window) {
        new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting && entry.intersectionRatio >= .15;
            if (visible) playIfWanted();
            else orbit.pause();
        }, { threshold: [0, .15] }).observe(orbit);
    } else { visible = true; playIfWanted(); }
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) orbit.pause();
        else playIfWanted();
    });
    reducedMotion.addEventListener('change', () => {
        if (reducedMotion.matches) { wantsPlayback = false; orbit.pause(); }
    });
}

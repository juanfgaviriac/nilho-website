document.documentElement.classList.add("js");

const revealItems = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
        });
    }, { threshold: 0.14 });

    revealItems.forEach((item) => observer.observe(item));
} else {
    revealItems.forEach((item) => item.classList.add("is-visible"));
}

const film = document.querySelector("#foco-film");
const filmToolbar = document.querySelector(".film-toolbar");

if (film && filmToolbar) {
    const playback = filmToolbar.querySelector(".film-playback");
    const errorMessage = document.querySelector(".film-error");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const saveData = navigator.connection?.saveData === true;
    let wantsPlayback = !reducedMotion.matches && !saveData;
    let visible = false;

    function updatePlaybackControl() {
        const playing = !film.paused && !film.ended;
        playback.dataset.playing = String(playing);
        playback.setAttribute("aria-label", playing ? "Pausar demostración" : "Reproducir demostración");
    }

    async function playIfWanted() {
        if (!wantsPlayback || !visible || document.hidden) return;
        try {
            await film.play();
        } catch {
            // Autoplay can be blocked by the browser. The poster and play button remain usable.
            updatePlaybackControl();
        }
    }

    film.muted = true;
    film.controls = false;
    film.preload = wantsPlayback ? "metadata" : "none";
    filmToolbar.hidden = false;
    film.addEventListener("play", updatePlaybackControl);
    film.addEventListener("pause", updatePlaybackControl);
    film.addEventListener("error", () => {
        wantsPlayback = false;
        errorMessage.hidden = false;
        updatePlaybackControl();
    });

    playback.addEventListener("click", () => {
        wantsPlayback = film.paused;
        if (wantsPlayback) {
            if (film.error) {
                errorMessage.hidden = true;
                film.load();
            }
            playIfWanted();
        } else {
            film.pause();
        }
    });

    if ("IntersectionObserver" in window) {
        const visibilityObserver = new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting && entry.intersectionRatio >= 0.2;
            if (visible) playIfWanted();
            else film.pause();
        }, { threshold: [0, 0.2] });
        visibilityObserver.observe(film);
    } else {
        visible = true;
        playIfWanted();
    }

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) film.pause();
        else playIfWanted();
    });
    reducedMotion.addEventListener("change", () => {
        if (reducedMotion.matches) {
            wantsPlayback = false;
            film.pause();
        }
    });
}

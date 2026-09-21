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
    const choices = filmToolbar.querySelectorAll("[data-film]");
    const caption = document.querySelector("#film-caption");
    const errorMessage = document.querySelector(".film-error");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const saveData = navigator.connection?.saveData === true;
    const clips = {
        in: {
            source: "/foco/assets/film/foco-tap-in-v1.mp4",
            poster: "/foco/assets/film/foco-tap-in-v1.jpg",
            description: "Un iPhone se acerca a la tarjeta Foco y activa una sesión de concentración",
            caption: "Un toque para entrar en Foco."
        },
        out: {
            source: "/foco/assets/film/foco-tap-out-v1.mp4",
            poster: "/foco/assets/film/foco-tap-out-v1.jpg",
            description: "Un iPhone vuelve a la tarjeta Foco para cerrar la sesión y recuperar el acceso a las apps",
            caption: "Otro toque para volver a tus apps."
        }
    };
    let selected = "in";
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

    choices.forEach((choice) => {
        choice.addEventListener("click", () => {
            if (choice.dataset.film === selected) return;
            selected = choice.dataset.film;
            const clip = clips[selected];
            film.pause();
            film.poster = clip.poster;
            film.src = clip.source;
            film.setAttribute("aria-label", clip.description);
            caption.textContent = clip.caption;
            errorMessage.hidden = true;
            errorMessage.querySelector("a").href = clip.source;
            choices.forEach((button) => button.setAttribute("aria-pressed", String(button === choice)));
            film.load();
            wantsPlayback = true;
            playIfWanted();
        });
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

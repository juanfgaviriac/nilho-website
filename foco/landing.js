// Preserve previously shared cart anchors after moving checkout to its own page.
if (location.hash === '#comprar') location.replace('/comprar/' + location.search);

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

const featureCarousel = document.querySelector(".feature-carousel");
if (featureCarousel) {
    const track = featureCarousel.querySelector(".feature-track");
    const cards = [...track.querySelectorAll(".feature-card")];
    const toolbar = featureCarousel.querySelector(".feature-toolbar");
    const dots = [...toolbar.querySelectorAll("[data-feature]")];
    const previous = toolbar.querySelector('[data-direction="-1"]');
    const next = toolbar.querySelector('[data-direction="1"]');
    const announcement = featureCarousel.querySelector(".feature-announcement");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const labels = ["Modos", "Rutinas", "Mi tiempo"];
    let current = 0;
    let scheduled = false;

    function targets() {
        const max = track.scrollWidth - track.clientWidth;
        return cards.map((card) => Math.min(max, card.offsetLeft - cards[0].offsetLeft));
    }

    function update() {
        scheduled = false;
        const overflow = track.scrollWidth > track.clientWidth + 2;
        toolbar.hidden = !overflow;
        track.tabIndex = overflow ? 0 : -1;
        const positions = targets();
        current = positions.reduce((best, value, index) =>
            Math.abs(value - track.scrollLeft) < Math.abs(positions[best] - track.scrollLeft) ? index : best, 0);
        dots.forEach((dot, index) => {
            if (index === current) dot.setAttribute("aria-current", "true");
            else dot.removeAttribute("aria-current");
        });
        previous.disabled = track.scrollLeft <= 2;
        next.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 2;
    }

    function goTo(index, keyboard = false) {
        const destination = Math.max(0, Math.min(cards.length - 1, index));
        track.scrollTo({ left: targets()[destination], behavior: keyboard || reducedMotion.matches ? "instant" : "smooth" });
        if (keyboard || reducedMotion.matches) update();
        announcement.textContent = `${labels[destination]}, ${destination + 1} de ${cards.length}`;
    }

    dots.forEach((dot) => dot.addEventListener("click", (event) => goTo(Number(dot.dataset.feature), event.detail === 0)));
    [previous, next].forEach((button) => button.addEventListener("click", (event) => goTo(current + Number(button.dataset.direction), event.detail === 0)));
    track.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        goTo(event.key === "Home" ? 0 : event.key === "End" ? cards.length - 1 : current + (event.key === "ArrowRight" ? 1 : -1), true);
    });
    track.addEventListener("scroll", () => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(update);
    }, { passive: true });
    if ("ResizeObserver" in window) new ResizeObserver(update).observe(track);
    else window.addEventListener("resize", update);
    update();
}

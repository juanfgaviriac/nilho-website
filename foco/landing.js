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

const card = document.querySelector(".foco-card");
const cardStatus = document.querySelector(".card-status");

if (card && cardStatus) {
    card.addEventListener("click", () => {
        const isActive = card.getAttribute("aria-pressed") === "true";
        card.setAttribute("aria-pressed", String(!isActive));
        card.classList.remove("is-active");
        void card.offsetWidth;
        card.classList.add("is-active");
        cardStatus.textContent = isActive ? "Toca la tarjeta" : "Foco activo";
    });
}

(function () {
    'use strict';

    // Guiones generados por tools/fetch-content.mjs desde fenixbinario.com.
    const DECK_FILES = {
        cv: "data/cv.json",
        robot: "data/robot.json",
        reptile: "data/reptile.json"
    };

    const PRESENTATION_COMMANDS = ["#cv", "#robot", "#reptile", "#next", "#stop"];

    const cache = new Map();
    let presenter = null;

    function loadDeck(id) {
        if (!cache.has(id)) {
            const request = fetch(DECK_FILES[id], { cache: "no-cache" })
                .then((response) => {
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status} al cargar ${DECK_FILES[id]}`);
                    }
                    return response.json();
                })
                .catch((error) => {
                    cache.delete(id);
                    throw error;
                });

            cache.set(id, request);
        }

        return cache.get(id);
    }

    function notify(detail) {
        document.dispatchEvent(new CustomEvent("fnx:presentation", { bubbles: true, detail }));
    }

    function getPresenter() {
        if (presenter) return presenter;

        presenter = new window.FenixPresenter({
            onSlide(slide, index, deck) {
                notify({
                    state: "slide",
                    deck: deck.id,
                    index,
                    total: deck.slides.length,
                    title: slide.title || slide.text || deck.title
                });
            },
            onEnd(deck) {
                notify({ state: "end", deck: deck.id });
            }
        });

        return presenter;
    }

    function play(id) {
        loadDeck(id)
            .then((deck) => {
                notify({ state: "start", deck: deck.id, title: deck.title });
                getPresenter().play(deck);
            })
            .catch((error) => {
                console.error("No se pudo reproducir el guion:", error);
                notify({ state: "error", deck: id, message: error.message });
            });
    }

    function next() {
        if (presenter) presenter.next();
    }

    function stop() {
        if (presenter) presenter.stop();
    }

    // Cualquier comando ajeno a la presentación detiene la que esté en curso,
    // antes de que el nuevo comando repinte el lienzo.
    document.addEventListener("fnx:before-command", (event) => {
        const value = String(event.detail.value || "").toLowerCase();
        if (PRESENTATION_COMMANDS.indexOf(value) !== -1) return;
        if (presenter) presenter.stop();
    });

    /**
     * Estado del presentador: útil para depuración y para verificar que el
     * bucle de imagen viva está activo.
     */
    function status() {
        if (!presenter) return { active: false, live: false, index: -1, total: 0 };

        return {
            active: true,
            live: !!presenter.liveTimer,
            reveal: presenter.reveal,
            kind: presenter.currentSlide ? presenter.currentSlide.kind : null,
            index: presenter.index,
            total: presenter.deck ? presenter.deck.slides.length : 0,
            title: presenter.deck ? presenter.deck.title : null
        };
    }

    window.FenixContent = {
        play,
        next,
        stop,
        loadDeck,
        status
    };
})();

(function () {
    'use strict';

    // Ritmo de escritura humana: base corta + variación aleatoria + pausas
    // tras la puntuación. Nada de intervalos fijos.
    const BASE_DELAY = 35;
    const JITTER = 45;
    const PUNCTUATION = /[.,;:!?…]$/;
    const PUNCTUATION_PAUSE = 240;

    class Typewriter {
        constructor(options = {}) {
            this.target = options.target || null;
            this.base = options.base || BASE_DELAY;
            this.jitter = options.jitter || JITTER;
            this.onUpdate = options.onUpdate || null;

            this.token = 0;
            this.timer = null;
            this.pending = null;
        }

        get isTyping() {
            return !!this.pending;
        }

        /**
         * Escribe un texto carácter a carácter en el elemento indicado.
         * @returns {Promise<boolean>} true si se completó, false si se canceló.
         */
        type(text, { element, className, append = true } = {}) {
            const content = String(text === null || text === undefined ? "" : text);
            const node = element || document.createElement("p");

            if (className) node.className = className;
            if (append && this.target && node.parentNode !== this.target) {
                this.target.appendChild(node);
            }
            node.textContent = "";

            // Cancela cualquier escritura anterior.
            this.stop();

            this.token += 1;
            const myToken = this.token;

            return new Promise((resolve) => {
                let index = 0;

                const caret = document.createElement("span");
                caret.className = "fnx-log__caret";

                const complete = () => {
                    clearTimeout(this.timer);
                    this.timer = null;
                    node.textContent = content;
                    if (caret.parentNode) caret.parentNode.removeChild(caret);
                    this.pending = null;
                    resolve(true);
                };

                this.pending = { node, content, caret, complete, resolve };

                const step = () => {
                    if (myToken !== this.token) return;

                    index += 1;
                    node.textContent = content.slice(0, index);
                    node.appendChild(caret);
                    if (this.onUpdate) this.onUpdate();

                    if (index >= content.length) {
                        complete();
                        return;
                    }

                    const written = content.slice(0, index);
                    const delay = this.base
                        + Math.random() * this.jitter
                        + (PUNCTUATION.test(written) ? PUNCTUATION_PAUSE : 0);

                    this.timer = setTimeout(step, delay);
                };

                step();
            });
        }

        /** Completa al instante lo que se esté escribiendo. */
        finish() {
            if (this.pending) this.pending.complete();
        }

        /** Cancela la escritura en curso. */
        stop() {
            this.token += 1;

            if (this.timer) {
                clearTimeout(this.timer);
                this.timer = null;
            }

            if (this.pending) {
                const { caret, resolve } = this.pending;
                if (caret.parentNode) caret.parentNode.removeChild(caret);
                this.pending = null;
                resolve(false);
            }
        }
    }

    window.FenixTypewriter = Typewriter;
})();

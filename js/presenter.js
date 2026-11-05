(function () {
    'use strict';

    // ===== CONSTANTES ===== //
    const SLIDE_DURATION = 4600;
    const MEDIA_DURATION = 6600;
    const MEDIA_TIMEOUT_GRACE = 12000;
    const LIVE_INTERVAL = 100;
    const READING_PAUSE = 1400;

    // ===== DISEÑO DE LA DIAPOSITIVA ===== //
    // El lienzo visible ocupa la zona izquierda; el texto se escribe en la
    // columna derecha. La imagen se dibuja a color y su silueta alimenta la
    // matriz de celdas del motor.
    const MEDIA_IMAGE_TOP = 0.04;
    const MEDIA_IMAGE_MAX_HEIGHT = 0.72;
    const MEDIA_IMAGE_MAX_WIDTH = 0.94;

    const FONT_DISPLAY = "'Ethnocentric', 'Arial Narrow', Arial, sans-serif";
    const FONT_BODY = "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

    // ===== UTILIDADES DE TEXTO ===== //
    function ellipsize(ctx, text, maxWidth) {
        if (ctx.measureText(text).width <= maxWidth) return text;
        let cut = text;
        while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) {
            cut = cut.slice(0, -1);
        }
        return `${cut}…`;
    }

    // ===== PRESENTADOR ===== //
    class Presenter {
        constructor(options = {}) {
            this.stage = options.stage || (window.AICanvas && window.AICanvas.stage);
            this.onSlide = options.onSlide || function () {};
            this.onEnd = options.onEnd || function () {};

            this.deck = null;
            this.index = -1;
            this.timer = null;
            this.liveTimer = null;

            this.container = document.getElementById("ai-canvas-container");
            this.output = document.getElementById("fnx-console-output");

            // Lienzo visible: la imagen a color de la diapositiva.
            this.slideCanvas = document.createElement("canvas");
            this.slideCtx = this.slideCanvas.getContext("2d");

            // Lienzo de máscara: la silueta que el motor rasteriza como celdas.
            this.maskCanvas = document.createElement("canvas");
            this.maskCtx = this.maskCanvas.getContext("2d");

            this.image = null;
            this.silhouette = null;
            this.silhouetteIsLive = false;
            this.currentSlide = null;
            this.mounted = false;

            this.typewriter = new window.FenixTypewriter({
                onUpdate: () => this.scrollOutput()
            });

            this.handleResize = this.handleResize.bind(this);
            window.addEventListener("resize", this.handleResize);

            // Un clic sobre la salida completa la escritura al instante.
            if (this.output) {
                this.output.addEventListener("click", () => this.typewriter.finish());
            }
        }

        // ===== Ciclo de vida ===== //

        play(deck) {
            this.stopTimer();
            this.deck = deck;
            this.index = -1;
            this.mount();
            this.next();
            return this;
        }

        stop() {
            this.stopTimer();
            this.stopLive();
            this.typewriter.stop();
            this.unmount();
            this.deck = null;
            this.index = -1;
            if (this.stage) this.stage.clear();
        }

        next() {
            if (!this.deck) return;

            this.index += 1;

            if (this.index >= this.deck.slides.length) {
                const deck = this.deck;
                this.stop();
                this.onEnd(deck);
                return;
            }

            const slide = this.deck.slides[this.index];
            this.onSlide(slide, this.index, this.deck);
            this.render(slide);
        }

        prev() {
            if (!this.deck || this.index <= 0) return;
            this.index -= 2;
            this.next();
        }

        /**
         * Compone la diapositiva: la imagen a la izquierda y la narración
         * escrita a la derecha. La diapositiva avanza cuando la escritura
         * termina y el espectador ha tenido tiempo de leer.
         */
        render(slide) {
            this.stopTimer();
            this.typewriter.stop();

            // El medio y la narración van en paralelo: el texto se escribe
            // mientras la imagen carga y nunca se interrumpe.
            const media = slide.kind === "media"
                ? this.showMedia(slide)
                : Promise.resolve(this.showTextShape(slide));

            const narration = this.typeNarrative(slide);

            Promise.all([media, narration]).then(() => {
                this.scheduleNext(READING_PAUSE);
            });
        }

        // ===== Lado izquierdo: el render ===== //

        showTextShape(slide) {
            this.stopLive();
            this.image = null;
            this.silhouette = null;
            this.silhouetteIsLive = false;

            // El titular se rasteriza en el lienzo con el efecto de la casa.
            const title = slide.title || slide.text || "";
            if (this.stage && title) this.stage.text(title);
        }

        showMedia(slide) {
            // Si el medio tarda demasiado se sigue sin él: el texto es lo
            // importante y no puede quedarse esperando.
            return this.withTimeout(this.loadImage(slide.src), MEDIA_TIMEOUT_GRACE)
                .then((image) => {
                    if (!image) {
                        this.showTextShape(slide);
                        return;
                    }

                    this.image = image;
                    this.silhouette = this.toSilhouette(image);
                    this.paintCurrent(slide);

                    if (slide.live) {
                        this.startLive();
                    } else {
                        this.stopLive();
                    }
                })
                .catch(() => {
                    this.showTextShape(slide);
                });
        }

        withTimeout(promise, ms) {
            return Promise.race([
                promise,
                new Promise((resolve) => setTimeout(() => resolve(null), ms))
            ]);
        }

        paintCurrent(slide) {
            const current = slide || (this.deck && this.deck.slides[this.index]);
            if (!current) return;

            this.currentSlide = current;

            if (current.kind === "media" && this.image) {
                this.paintMediaSlide(current);
            } else {
                this.slideCtx.clearRect(0, 0, this.slideCanvas.width, this.slideCanvas.height);
                this.maskCtx.clearRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);
            }

            // La máscara es lo que el motor rasteriza como celdas.
            if (this.stage) {
                this.stage.display(this.maskCanvas, {
                    live: !!(current.live && this.image)
                });
            }
        }

        paintMediaSlide(slide) {
            const rect = this.imageRect();

            // Imagen a color, sobre fondo transparente.
            this.slideCtx.clearRect(0, 0, this.slideCanvas.width, this.slideCanvas.height);
            this.slideCtx.drawImage(this.image, rect.x, rect.y, rect.w, rect.h);

            // La máscara solo lleva la silueta: el texto vive en la columna
            // derecha y no debe rasterizarse aquí.
            this.maskCtx.clearRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);
            const source = slide.live && this.silhouetteIsLive ? this.image : this.silhouette;
            if (source) {
                this.maskCtx.drawImage(source, rect.x, rect.y, rect.w, rect.h);
            }
        }

        // ===== Lado derecho: la narración ===== //

        async typeNarrative(slide) {
            const out = this.output;
            if (!out) return;

            // Solo se conserva la narración de la diapositiva en curso: el
            // resultado siempre es legible de un vistazo.
            out.querySelectorAll(".fnx-log").forEach((node) => {
                node.parentNode.removeChild(node);
            });

            const log = document.createElement("div");
            log.className = "fnx-log";
            out.appendChild(log);

            const title = slide.title || slide.text || "";
            if (title) {
                const node = document.createElement("p");
                node.className = "fnx-log__title";
                log.appendChild(node);

                // Si la escritura se cancela (cambio de diapositiva o parada)
                // no se sigue con el resto del texto.
                const written = await this.typewriter.type(title, { element: node });
                if (!written) return;
            }

            if (slide.kind === "bullets" && slide.items) {
                const list = document.createElement("ul");
                list.className = "fnx-log__items";
                log.appendChild(list);

                for (const item of slide.items) {
                    const node = document.createElement("li");
                    node.className = "fnx-log__body";
                    list.appendChild(node);

                    const written = await this.typewriter.type(item, { element: node });
                    if (!written) return;
                }
            } else if (slide.kind === "links" && slide.items) {
                const list = document.createElement("div");
                list.className = "fnx-log__links";
                log.appendChild(list);

                for (const item of slide.items) {
                    const link = document.createElement("div");
                    link.className = "fnx-log__link";

                    const label = document.createElement("span");
                    label.className = "fnx-log__link-label";
                    const url = document.createElement("span");
                    url.className = "fnx-log__link-url";

                    link.appendChild(label);
                    link.appendChild(url);
                    list.appendChild(link);

                    const labelWritten = await this.typewriter.type(item.text, { element: label });
                    if (!labelWritten) return;

                    const urlWritten = await this.typewriter.type(item.url, { element: url });
                    if (!urlWritten) return;
                }
            } else if (slide.body) {
                const node = document.createElement("p");
                node.className = "fnx-log__body";
                log.appendChild(node);

                const written = await this.typewriter.type(slide.body, { element: node });
                if (!written) return;
            }

            this.scrollOutput();
        }

        scrollOutput() {
            if (!this.output) return;
            this.output.scrollTop = this.output.scrollHeight;
        }

        // ===== Montaje del lienzo visible ===== //

        mount() {
            if (this.mounted || !this.container) return;

            this.slideCanvas.className = "fnx-slide";
            this.container.appendChild(this.slideCanvas);
            this.mounted = true;
            this.handleResize();
        }

        unmount() {
            if (!this.mounted) return;
            if (this.slideCanvas.parentNode) {
                this.slideCanvas.parentNode.removeChild(this.slideCanvas);
            }
            this.mounted = false;
        }

        handleResize() {
            if (!this.container) return;

            const rect = this.container.getBoundingClientRect();
            // El motor escala la máscara al 80 % del lienzo: el lienzo visible
            // usa exactamente la misma proporción para quedar alineado.
            const width = Math.max(1, Math.round(rect.width * 0.8));
            const height = Math.max(1, Math.round(rect.height * 0.8));

            if (this.slideCanvas.width === width && this.slideCanvas.height === height) return;

            this.slideCanvas.width = width;
            this.slideCanvas.height = height;
            this.slideCanvas.style.width = `${rect.width * 0.8}px`;
            this.slideCanvas.style.height = `${rect.height * 0.8}px`;

            this.maskCanvas.width = width;
            this.maskCanvas.height = height;

            if (this.deck && this.index >= 0) {
                this.paintCurrent();
            }
        }

        // ===== Imagen ===== //

        imageRect() {
            const W = this.slideCanvas.width;
            const H = this.slideCanvas.height;

            const sourceWidth = this.image.naturalWidth || this.image.width;
            const sourceHeight = this.image.naturalHeight || this.image.height;

            const maxWidth = W * MEDIA_IMAGE_MAX_WIDTH;
            const maxHeight = H * MEDIA_IMAGE_MAX_HEIGHT;

            const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
            const width = sourceWidth * scale;
            const height = sourceHeight * scale;

            return {
                x: (W - width) / 2,
                y: (H - height) / 2,
                w: width,
                h: height,
                bottom: (H + height) / 2
            };
        }

        loadImage(src) {
            return new Promise((resolve, reject) => {
                const image = new Image();
                // CORS es obligatorio: sin él el lienzo queda contaminado y
                // getImageData() lanzaría SecurityError.
                image.crossOrigin = "anonymous";
                image.onload = () => {
                    // El navegador solo decodifica los fotogramas siguientes de
                    // un GIF si la imagen está en el árbol de render. Se ancla
                    // fuera de pantalla para que el GIF siga vivo.
                    image.setAttribute("aria-hidden", "true");
                    image.style.cssText = [
                        "position:absolute",
                        "left:-9999px",
                        "top:0",
                        "width:2px",
                        "height:2px",
                        "opacity:0.01",
                        "pointer-events:none"
                    ].join(";");
                    document.body.appendChild(image);
                    resolve(image);
                };
                image.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
                image.src = src;
            });
        }

        /**
         * Convierte una imagen opaca en silueta (alpha según luminancia) para
         * que la matriz de celdas siga la forma real del contenido.
         */
        toSilhouette(image) {
            const width = image.naturalWidth || image.width;
            const height = image.naturalHeight || image.height;

            const off = document.createElement("canvas");
            off.width = width;
            off.height = height;

            const ctx = off.getContext("2d");
            ctx.drawImage(image, 0, 0);

            const frame = ctx.getImageData(0, 0, width, height);
            const px = frame.data;

            let hasAlpha = false;
            for (let i = 3; i < px.length; i += 4) {
                if (px[i] < 250) {
                    hasAlpha = true;
                    break;
                }
            }

            if (hasAlpha) {
                // Con canal alfa la imagen ya ES la silueta: se puede redibujar
                // en vivo para que un GIF animado cambie de forma.
                this.silhouetteIsLive = true;
                return off;
            }

            for (let i = 0; i < px.length; i += 4) {
                const luma = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
                px[i + 3] = Math.min(255, Math.max(0, (255 - luma) * 1.25));
            }
            ctx.putImageData(frame, 0, 0);
            return off;
        }

        // ===== Animación en vivo ===== //

        startLive() {
            this.stopLive();
            this.liveTimer = setInterval(() => {
                if (!this.image || !this.currentSlide) return;

                const rect = this.imageRect();
                const source = this.silhouetteIsLive ? this.image : this.silhouette;

                this.slideCtx.clearRect(rect.x, rect.y, rect.w, rect.h);
                this.slideCtx.drawImage(this.image, rect.x, rect.y, rect.w, rect.h);

                this.maskCtx.clearRect(rect.x, rect.y, rect.w, rect.h);
                this.maskCtx.drawImage(source, rect.x, rect.y, rect.w, rect.h);

                // El motor ya tiene la forma viva registrada: solo refresca.
                if (this.stage) this.stage.refresh();
            }, LIVE_INTERVAL);
        }

        stopLive() {
            if (this.liveTimer) {
                clearInterval(this.liveTimer);
                this.liveTimer = null;
            }
        }

        scheduleNext(duration) {
            this.stopTimer();
            this.timer = setTimeout(() => this.next(), duration);
        }

        stopTimer() {
            if (this.timer) {
                clearTimeout(this.timer);
                this.timer = null;
            }
        }
    }

    window.FenixPresenter = Presenter;
})();

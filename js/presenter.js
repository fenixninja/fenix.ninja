(function () {
    'use strict';

    // ===== CONSTANTES ===== //
    const SLIDE_DURATION = 4600;
    const MEDIA_DURATION = 6600;
    const MEDIA_TIMEOUT_GRACE = 12000;
    const LIVE_INTERVAL = 100;
    const MAX_BODY_LINES = 4;

    // ===== DISEÑO DE LA DIAPOSITIVA =====
    // El lienzo ocupa el 80 % del viewport y se centra. La consola se ancla
    // abajo, así que el contenido se compone en la banda superior para que
    // siga legible aunque la paleta de comandos esté desplegada.
    const MEDIA_IMAGE_TOP = 0.03;
    const MEDIA_IMAGE_MAX_HEIGHT = 0.38;
    const MEDIA_TITLE_GAP = 0.04;
    const MEDIA_BODY_TOP = 0.50;
    const TEXT_TITLE_TOP = 0.16;
    const TEXT_BODY_TOP = 0.26;

    const FONT_DISPLAY = "'Ethnocentric', 'Arial Narrow', Arial, sans-serif";
    const FONT_BODY = "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

    // ===== UTILIDADES DE TEXTO ===== //
    function roundRect(ctx, x, y, w, h, r) {
        const radius = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.arcTo(x + w, y, x + w, y + h, radius);
        ctx.arcTo(x + w, y + h, x, y + h, radius);
        ctx.arcTo(x, y + h, x, y, radius);
        ctx.arcTo(x, y, x + w, y, radius);
        ctx.closePath();
    }

    function wrapLines(ctx, text, maxWidth) {
        const paragraphs = String(text || "").split(/\n+/);
        const lines = [];

        paragraphs.forEach((paragraph) => {
            const words = paragraph.split(/\s+/).filter(Boolean);
            let line = "";

            words.forEach((word) => {
                const probe = line ? `${line} ${word}` : word;
                if (ctx.measureText(probe).width > maxWidth && line) {
                    lines.push(line);
                    line = word;
                } else {
                    line = probe;
                }
            });

            if (line) lines.push(line);
        });

        return lines;
    }

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

            // Lienzo visible: la diapositiva en color (imagen + texto).
            this.slideCanvas = document.createElement("canvas");
            this.slideCtx = this.slideCanvas.getContext("2d");

            // Lienzo de máscara: alimenta la matriz de celdas del motor.
            this.maskCanvas = document.createElement("canvas");
            this.maskCtx = this.maskCanvas.getContext("2d");

            this.image = null;
            this.silhouette = null;
            this.silhouetteIsLive = false;
            this.mounted = false;

            this.handleResize = this.handleResize.bind(this);
            window.addEventListener("resize", this.handleResize);
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

            if (slide.kind === "media") {
                this.showMedia(slide);
            } else {
                this.showText(slide);
            }
        }

        prev() {
            if (!this.deck || this.index <= 0) return;
            this.index -= 2;
            this.next();
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

        // ===== Render ===== //

        showText(slide) {
            this.stopLive();
            this.image = null;
            this.silhouette = null;
            this.silhouetteIsLive = false;
            this.paintCurrent(slide);
            this.scheduleNext(SLIDE_DURATION);
        }

        showMedia(slide) {
            // Red de seguridad: si el medio nunca llega, la presentación
            // continúa igualmente.
            this.scheduleNext(MEDIA_DURATION + MEDIA_TIMEOUT_GRACE);

            this.loadImage(slide.src).then((image) => {
                this.image = image;
                this.silhouette = this.toSilhouette(image);
                this.paintCurrent(slide);

                if (slide.live) {
                    this.startLive();
                } else {
                    this.stopLive();
                }

                // El plazo de la diapositiva arranca cuando el medio está
                // listo: con red lenta el contenido no se pierde.
                this.scheduleNext(MEDIA_DURATION);
            }).catch(() => {
                this.paintTextSlide({
                    kind: "section",
                    title: slide.title || slide.caption || "",
                    body: slide.body || "Contenido no disponible"
                });
                this.scheduleNext(SLIDE_DURATION);
            });
        }

        paintCurrent(slide) {
            const current = slide || (this.deck && this.deck.slides[this.index]);
            if (!current) return;

            this.currentSlide = current;

            if (current.kind === "media" && this.image) {
                this.paintMediaSlide(current);
            } else {
                this.paintTextSlide(current);
            }

            // La máscara es lo que el motor rasteriza como celdas.
            if (this.stage) {
                this.stage.display(this.maskCanvas, {
                    live: !!(current.live && this.image)
                });
            }
        }

        paintMediaSlide(slide) {
            const ctx = this.slideCtx;
            const W = this.slideCanvas.width;
            const H = this.slideCanvas.height;

            ctx.clearRect(0, 0, W, H);

            const rect = this.imageRect();

            // Imagen a color, sobre fondo transparente.
            ctx.drawImage(this.image, rect.x, rect.y, rect.w, rect.h);

            this.paintHeadline(ctx, slide.title || slide.caption || "", rect.bottom);
            this.paintBody(ctx, slide.body || "");

            this.paintMask(slide, rect);
        }

        paintTextSlide(slide) {
            const W = this.slideCanvas.width;
            const H = this.slideCanvas.height;

            this.slideCtx.clearRect(0, 0, W, H);
            this.drawTextSlide(this.slideCtx, slide, {
                primary: this.token("--color-primary"),
                text: this.token("--color-text"),
                muted: this.token("--color-text-muted")
            });

            this.maskCtx.clearRect(0, 0, W, H);
            this.drawTextSlide(this.maskCtx, slide, {
                primary: "#ffffff",
                text: "#ffffff",
                muted: "#ffffff"
            });
        }

        /**
         * Layout único de las diapositivas de texto: se dibuja dos veces,
         * una en color sobre el lienzo visible y otra en blanco sobre la
         * máscara que consume el motor. Así la composición nunca diverge.
         */
        drawTextSlide(ctx, slide, palette) {
            const W = this.slideCanvas.width;
            const H = this.slideCanvas.height;

            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            if (slide.kind === "title") {
                ctx.fillStyle = palette.primary;
                ctx.font = `700 ${Math.round(H * 0.13)}px ${FONT_DISPLAY}`;
                ctx.fillText(ellipsize(ctx, slide.text || "", W * 0.86), W / 2, H * 0.26);

                ctx.fillStyle = palette.muted;
                ctx.font = `400 ${Math.round(H * 0.038)}px ${FONT_BODY}`;
                const lines = wrapLines(ctx, slide.subtitle || "", W * 0.74).slice(0, 3);
                lines.forEach((line, index) => {
                    ctx.fillText(line, W / 2, H * 0.40 + index * H * 0.05);
                });
                return;
            }

            let top = H * TEXT_TITLE_TOP;

            if (slide.title) {
                ctx.fillStyle = palette.primary;
                ctx.font = `700 ${Math.round(H * 0.075)}px ${FONT_DISPLAY}`;
                const titleLines = wrapLines(ctx, slide.title, W * 0.86).slice(0, 2);
                titleLines.forEach((line, index) => {
                    ctx.fillText(line, W / 2, top + index * H * 0.085);
                });
                top += titleLines.length * H * 0.085 + H * 0.02;
            }

            if (slide.kind === "bullets" && slide.items) {
                ctx.font = `400 ${Math.round(H * 0.032)}px ${FONT_BODY}`;
                ctx.textAlign = "left";
                slide.items.slice(0, MAX_BODY_LINES + 2).forEach((item, index) => {
                    const y = top + index * H * 0.048;
                    ctx.fillStyle = palette.primary;
                    ctx.fillText("—", W * 0.16, y);
                    ctx.fillStyle = palette.text;
                    ctx.fillText(ellipsize(ctx, item, W * 0.68), W * 0.20, y);
                });
                ctx.textAlign = "center";
                return;
            }

            if (slide.kind === "links" && slide.items) {
                ctx.font = `400 ${Math.round(H * 0.030)}px ${FONT_BODY}`;
                ctx.textAlign = "left";
                slide.items.slice(0, 8).forEach((item, index) => {
                    const y = top + index * H * 0.046;
                    ctx.fillStyle = palette.primary;
                    ctx.fillText(item.text, W * 0.18, y);
                    ctx.fillStyle = palette.muted;
                    ctx.fillText(ellipsize(ctx, item.url, W * 0.52), W * 0.40, y);
                });
                ctx.textAlign = "center";
                return;
            }

            if (slide.body) {
                ctx.fillStyle = palette.text;
                ctx.font = `400 ${Math.round(H * 0.034)}px ${FONT_BODY}`;
                const lines = wrapLines(ctx, slide.body, W * 0.80).slice(0, MAX_BODY_LINES + 2);
                lines.forEach((line, index) => {
                    ctx.fillText(line, W / 2, top + index * H * 0.048);
                });
            }
        }

        paintHeadline(ctx, title, bottom) {
            if (!title) return;

            const W = this.slideCanvas.width;
            const H = this.slideCanvas.height;

            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = this.token("--color-primary");
            ctx.font = `700 ${Math.round(H * 0.058)}px ${FONT_DISPLAY}`;

            const lines = wrapLines(ctx, title, W * 0.86).slice(0, 2);
            lines.forEach((line, index) => {
                ctx.fillText(line, W / 2, bottom + H * MEDIA_TITLE_GAP + index * H * 0.062);
            });
        }

        paintBody(ctx, body) {
            if (!body) return;

            const W = this.slideCanvas.width;
            const H = this.slideCanvas.height;

            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = this.token("--color-text");
            ctx.font = `400 ${Math.round(H * 0.028)}px ${FONT_BODY}`;

            const lines = wrapLines(ctx, body, W * 0.84).slice(0, MAX_BODY_LINES);
            const start = H * MEDIA_BODY_TOP + (lines.length - 1) * H * 0.038;

            lines.forEach((line, index) => {
                ctx.fillText(line, W / 2, start + index * H * 0.038);
            });
        }

        // ===== Máscara para la matriz de celdas ===== //

        paintMask(slide, rect) {
            const ctx = this.maskCtx;
            const W = this.maskCanvas.width;
            const H = this.maskCanvas.height;

            ctx.clearRect(0, 0, W, H);

            if (this.silhouette) {
                // Si la imagen ya traía canal alfa, la silueta es la propia
                // imagen: así el GIF animado sigue su forma fotograma a
                // fotograma. Las fotos (sin alfa) usan la silueta fija.
                const source = slide.live && this.silhouetteIsLive ? this.image : this.silhouette;
                ctx.drawImage(source, rect.x, rect.y, rect.w, rect.h);
            }
            // El texto se dibuja en blanco opaco: así la máscara lo incluye
            // con alpha pleno y el motor lo rasteriza como celdas.
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#ffffff";

            if (slide.title || slide.caption) {
                ctx.font = `700 ${Math.round(H * 0.058)}px ${FONT_DISPLAY}`;
                const lines = wrapLines(ctx, slide.title || slide.caption, W * 0.86).slice(0, 2);
                lines.forEach((line, index) => {
                    ctx.fillText(line, W / 2, rect.bottom + H * MEDIA_TITLE_GAP + index * H * 0.062);
                });
            }

            if (slide.body) {
                ctx.font = `400 ${Math.round(H * 0.028)}px ${FONT_BODY}`;
                const lines = wrapLines(ctx, slide.body, W * 0.84).slice(0, MAX_BODY_LINES);
                const start = H * 0.84 - (lines.length - 1) * H * 0.038;
                lines.forEach((line, index) => {
                    ctx.fillText(line, W / 2, start + index * H * 0.038);
                });
            }
        }

        /**
         * Repinta únicamente la región de la imagen. El texto de la
         * diapositiva vive por debajo y no se solapa, así que el bucle en
         * vivo no necesita recomponer la maqueta completa.
         */
        repaintImageRegion(rect, source) {
            this.slideCtx.clearRect(rect.x, rect.y, rect.w, rect.h);
            this.slideCtx.drawImage(source, rect.x, rect.y, rect.w, rect.h);

            this.maskCtx.clearRect(rect.x, rect.y, rect.w, rect.h);
            this.maskCtx.drawImage(source, rect.x, rect.y, rect.w, rect.h);
        }

        // ===== Imagen ===== //

        imageRect() {
            const W = this.slideCanvas.width;
            const H = this.slideCanvas.height;

            const sourceWidth = this.image.naturalWidth || this.image.width;
            const sourceHeight = this.image.naturalHeight || this.image.height;

            const maxWidth = W * 0.88;
            const maxHeight = H * MEDIA_IMAGE_MAX_HEIGHT;

            const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
            const width = sourceWidth * scale;
            const height = sourceHeight * scale;

            return {
                x: (W - width) / 2,
                y: H * MEDIA_IMAGE_TOP,
                w: width,
                h: height,
                bottom: H * MEDIA_IMAGE_TOP + height
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
                    // fuera de pantalla y casi transparente para que el GIF
                    // siga vivo sin verse en el lienzo.
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

                // Solo se repinta la imagen: el texto no se solapa con ella.
                this.repaintImageRegion(rect, this.image);
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

        // ===== Utilidades ===== //

        token(name) {
            const fallback = {
                "--color-primary": "#F25C1F",
                "--color-text": "#F2F2F0",
                "--color-text-muted": "rgba(242,242,240,0.62)"
            };
            if (typeof window === "undefined" || !window.getComputedStyle) {
                return fallback[name] || "#FFFFFF";
            }
            const value = getComputedStyle(document.documentElement).getPropertyValue(name);
            return (value && value.trim()) || fallback[name] || "#FFFFFF";
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

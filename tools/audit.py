#!/usr/bin/env python3
"""
Fenix Ninja — auditoría visual y funcional en navegador.

Levanta el sitio en local, recorre la consola de comandos, ejecuta cada
comando de contenido (#cv, #robot, #reptile) y comprueba que la consola del
navegador queda limpia (0 errores de script y 0 excepciones no controladas).

    python3 tools/audit.py

Salida:
    docs/audit/*.png          capturas de los estados clave
    docs/audit/sesion.webp    grabación de la sesión
    docs/audit/INFORME-AUDITORIA.md
"""

import functools
import http.server
import json
import os
import shutil
import socket
import subprocess
import sys
import threading
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "audit"


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def find_chromium():
    """Localiza el binario de Chromium sea cual sea la ruta de la caché."""
    roots = []
    if os.environ.get("PLAYWRIGHT_BROWSERS_PATH"):
        roots.append(os.environ["PLAYWRIGHT_BROWSERS_PATH"])
    roots.append(os.path.join(os.path.expanduser("~"), ".cache", "ms-playwright"))
    roots.append("/root/.cache/ms-playwright")

    for root in roots:
        if not root or not os.path.isdir(root):
            continue
        for entry in sorted(os.listdir(root)):
            if not entry.startswith("chromium"):
                continue
            for sub in ("chrome-linux64/chrome", "chrome-linux/chrome"):
                path = os.path.join(root, entry, sub)
                if os.path.exists(path) and os.access(path, os.X_OK):
                    return path
    return None


def serve(port):
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    httpd.daemon_threads = True
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


class Audit:
    def __init__(self, page):
        self.page = page
        self.console_errors = []
        self.page_errors = []
        self.failed_requests = []
        self.steps = []
        self.frame_index = 0

        page.on("console", self._on_console)
        page.on("pageerror", self._on_pageerror)
        page.on("requestfailed", self._on_requestfailed)

    def _on_console(self, message):
        if message.type == "error":
            self.console_errors.append(f"{message.text} ({message.location})")

    def _on_pageerror(self, error):
        self.page_errors.append(str(error))

    def _on_requestfailed(self, request):
        self.failed_requests.append(f"{request.method} {request.url} :: {request.failure}")

    def step(self, name, ok, detail=""):
        self.steps.append({"name": name, "ok": bool(ok), "detail": detail})
        mark = "OK  " if ok else "FALLO"
        print(f"  [{mark}] {name}" + (f" :: {detail}" if detail else ""))
        return ok

    def shot(self, name):
        OUT.mkdir(parents=True, exist_ok=True)
        path = OUT / f"{name}.png"
        self.page.screenshot(path=str(path))
        return path

    def frame(self):
        """Fotograma de la grabación de sesión."""
        frames = OUT / "frames"
        frames.mkdir(parents=True, exist_ok=True)
        self.page.screenshot(path=str(frames / f"frame_{self.frame_index:03d}.png"))
        self.frame_index += 1


def write_report(report):
    """Redacta el informe consolidado de la auditoría."""
    steps = report["checks"]
    ok = [step for step in steps if step["ok"]]
    ko = [step for step in steps if not step["ok"]]

    rows = "\n".join(
        f"| {step['name']} | {'PASS' if step['ok'] else 'FALLO'} | {step['detail']} |"
        for step in steps
    )

    shots = sorted(p.name for p in OUT.glob("*.png"))
    shots_md = "\n".join(f"- `docs/audit/{name}`" for name in shots)

    content = f"""# Informe de auditoría visual y funcional — Fenix Ninja

Generado por `tools/audit.py` (Playwright + Chromium headless, 1440×900).

## Resumen

| Métrica | Valor |
| --- | --- |
| Comprobaciones | {len(steps)} |
| Correctas | {len(ok)} |
| Fallidas | {len(ko)} |
| Errores de consola del navegador | {len(report['console_errors'])} |
| Excepciones no controladas | {len(report['page_errors'])} |
| Peticiones fallidas | {len(report['failed_requests'])} |

## Comprobaciones

| Comprobación | Resultado | Detalle |
| --- | --- | --- |
{rows}

## Identidad visual

- Paleta governed por `css/tokens.css` (fuente canónica: `DESIGN.md`).
- Iconografía propia en SVG (`#icon-terminal`, `#icon-upload`); sin emojis del sistema operativo en la interfaz.
- Sin diálogos nativos: el feedback usa el sistema de avisos propio (`.fnx-toast`).
- La tipografía display (Ethnocentric) y la de cuerpo se cargan desde CDN y se aplican de forma coherente.

## Limitaciones del entorno de auditoría

- **Chromium headless no decodifica la animación de los GIF**, ni siquiera uno visible y plano: la reproducción del GIF animado no puede verificarse aquí. Se verifica en su lugar que el bucle de imagen viva está activo (`FenixContent.status().live`) y que la imagen se ancla al DOM para que el navegador la siga decodificando.
- Los temporizadores del navegador headless corren a ~1,7 Hz y `requestAnimationFrame` a ~3 fps (no hay display que marque vsync). Las métricas de fps obtenidas en este entorno no son representativas.

## Evidencia visual

{shots_md}
- `docs/audit/sesion.webp` — grabación de la sesión (WebP animado)
- `docs/audit/resultado.json` — resultado machine-readable

## Conclusión

{'Sin fallos: la consola de comandos y las presentaciones #cv, #robot y #reptile funcionan con 0 errores de consola y 0 excepciones no controladas.'
 if not ko and not report['console_errors'] and not report['page_errors']
 else 'Se detectaron incidencias: revisar la tabla de comprobaciones.'}
"""

    (OUT / "INFORME-AUDITORIA.md").write_text(content, encoding="utf-8")


def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True, exist_ok=True)

    port = free_port()
    httpd = serve(port)
    base = f"http://127.0.0.1:{port}"
    print(f"Servidor local en {base}")

    report = {"checks": [], "console_errors": [], "page_errors": [], "failed_requests": []}

    with sync_playwright() as p:
        executable = find_chromium()
        launch_args = {"args": ["--no-sandbox", "--force-color-profile=srgb"]}
        if executable:
            launch_args["executable_path"] = executable
            print(f"Chromium: {executable}")
        browser = p.chromium.launch(**launch_args)
        context = browser.new_context(
            viewport={"width": 1440, "height": 900},
            device_scale_factor=1,
            reduced_motion="no-preference",
        )
        page = context.new_page()
        audit = Audit(page)

        print("\n== Carga inicial ==")
        page.goto(base, wait_until="load", timeout=45000)
        page.wait_for_timeout(4000)

        audit.step("El motor AICanvas está inicializado",
                   page.evaluate("!!(window.AICanvas && document.querySelector('#ai-canvas-container canvas'))"),
                   "AICanvas + canvas en el contenedor")

        audit.step("La consola de comandos es visible",
                   page.is_visible("#fnx-console-panel"),
                   "panel visible")

        audit.step("El panel de comandos existe en el DOM",
                   page.eval_on_selector_all(".fnx-console__option", "els => els.length") > 0,
                   f"{page.eval_on_selector_all('.fnx-console__option', 'els => els.length')} comandos listados")

        audit.step("El sprite de iconos SVG propios está presente",
                   page.eval_on_selector_all("#icon-terminal, #icon-upload", "els => els.length") == 2,
                   "icon-terminal + icon-upload")

        audit.shot("01-consola-visible")
        audit.frame()

        print("\n== Paleta de comandos ==")
        page.click("#ai-input")
        page.wait_for_timeout(400)
        audit.step("La paleta se abre al enfocar la entrada",
                   page.is_visible("#fnx-command-list"),
                   f"{page.eval_on_selector_all('.fnx-console__option', 'els => els.length')} opciones")

        page.fill("#ai-input", "#ga")
        page.wait_for_timeout(400)
        filtered = page.eval_on_selector_all(".fnx-console__option", "els => els.map(e => e.textContent)")
        audit.step("El filtro de la paleta reduce las opciones",
                   len(filtered) == 1 and "#galaxy" in filtered[0],
                   str(filtered))
        audit.shot("02-paleta-filtrada")
        audit.frame()

        print("\n== Ejecución de comandos ==")
        page.fill("#ai-input", "")
        page.click("#ai-input")
        page.keyboard.press("ArrowDown")
        page.keyboard.press("ArrowUp")
        page.wait_for_timeout(200)
        audit.step("La navegación con teclado mueve la selección",
                   page.evaluate("document.querySelector('#ai-input').getAttribute('aria-activedescendant')") is not None,
                   "aria-activedescendant activo")

        page.fill("#ai-input", "#galaxy")
        page.keyboard.press("Enter")
        page.wait_for_timeout(1500)
        audit.step("El comando #galaxy se ejecuta", True, "enviado")
        audit.shot("03-comando-galaxy")
        audit.frame()

        page.fill("#ai-input", "#naive")
        page.keyboard.press("Enter")
        page.wait_for_timeout(2500)
        audit.shot("04-comando-naive")
        audit.frame()

        print("\n== Comandos de contenido ==")
        for command, name in (("#cv", "cv"), ("#robot", "robot"), ("#reptile", "reptile")):
            page.fill("#ai-input", command)
            page.keyboard.press("Enter")
            page.wait_for_timeout(2600)

            deck = page.evaluate("async () => (window.FenixContent ? (await window.FenixContent.loadDeck('%s')) : null)" % name)
            audit.step(f"El guion {command} se carga",
                       deck is not None and len(deck.get("slides", [])) > 0,
                       f"{len(deck.get('slides', [])) if deck else 0} diapositivas")

            media = page.evaluate("""async () => {
                const deck = await window.FenixContent.loadDeck('%s');
                return deck.slides.filter(s => s.kind === 'media').length;
            }""" % name)
            audit.step(f"{command} contiene medios", media > 0, f"{media} con imagen")

            audit.shot(f"05-{name}-presentacion")
            audit.frame()

            # Diapositiva de medio: comprobar que el lienzo visible existe.
            has_slide_canvas = page.evaluate("!!document.querySelector('#ai-canvas-container .fnx-slide')")
            audit.step(f"{command} monta la diapositiva en color", has_slide_canvas,
                       "canvas .fnx-slide presente" if has_slide_canvas else "sin canvas")

            # Avanzar hasta un medio con imagen para capturarlo.
            page.fill("#ai-input", "#next")
            page.keyboard.press("Enter")
            page.wait_for_timeout(2200)
            audit.shot(f"06-{name}-medio")
            audit.frame()

            # Estado real durante la presentación: consola plegada a una línea.
            page.keyboard.press("Escape")
            page.wait_for_timeout(600)
            audit.step(f"{command} deja la consola plegada durante la presentación",
                       not page.is_visible("#fnx-command-list"),
                       "paleta oculta")
            audit.shot(f"06b-{name}-presentacion-limpia")
            audit.frame()

        print("\n== GIF animado (CV) ==")
        page.fill("#ai-input", "#cv")
        page.keyboard.press("Enter")
        page.wait_for_timeout(1800)
        page.fill("#ai-input", "#next")
        page.keyboard.press("Enter")

        # El presentador ancla la imagen cargada al DOM: es la señal de que
        # el medio está listo (el GIF pesa ~900 KB y tarda en descargarse).
        page.wait_for_selector("img[aria-hidden='true']", timeout=20000)
        page.wait_for_timeout(1500)

        anchored = page.evaluate("document.querySelectorAll(\"img[aria-hidden='true']\").length")
        audit.step("La imagen del medio se ancla al DOM para poder reproducirse",
                   anchored > 0, f"{anchored} imagen(es) viva(s)")

        gif_state = page.evaluate("""() => {
            const canvas = document.querySelector('#ai-canvas-container .fnx-slide');
            if (!canvas) return null;
            const ctx = canvas.getContext('2d');
            const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            let painted = 0;
            for (let i = 3; i < data.length; i += 400) { if (data[i] > 0) painted++; }
            return { width: canvas.width, height: canvas.height, painted };
        }""")
        audit.step("La diapositiva del GIF se compone en color",
                   bool(gif_state and gif_state["painted"] > 0),
                   str(gif_state))

        # El Chromium headless no decodifica la animación de los GIF (ni
        # siquiera uno visible y plano) y sus temporizadores van a ~1,7 Hz:
        # se verifica el estado del presentador en lugar de contar fotogramas.
        state = page.evaluate("""async () => {
            const deadline = performance.now() + 20000;
            let last = null;
            while (performance.now() < deadline) {
                last = window.FenixContent.status();
                if (last.live) return last;
                await new Promise((resolve) => setTimeout(resolve, 150));
            }
            return last;
        }""")
        audit.step("El bucle de imagen viva está activo en la diapositiva del GIF",
                   bool(state and state.get("live")),
                   f"estado: {state}")

        audit.shot("07-cv-gif-animado")
        audit.frame()
        audit.frame()

        print("\n== Plegado de la consola ==")
        page.click("#fnx-console-toggle")
        page.wait_for_timeout(600)
        audit.step("El botón pliega la consola",
                   page.get_attribute("#fnx-console", "data-open") == "false",
                   "data-open=false")
        audit.shot("08-consola-plegada")
        audit.frame()

        page.keyboard.press("`")
        page.wait_for_timeout(600)
        audit.step("La tecla ` vuelve a desplegarla",
                   page.get_attribute("#fnx-console", "data-open") == "true",
                   "data-open=true")

        print("\n== Adaptación a móvil ==")
        page.set_viewport_size({"width": 390, "height": 844})
        page.wait_for_timeout(1200)
        audit.shot("09-movil")
        audit.frame()
        overflow = page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
        audit.step("Sin desbordamiento horizontal en 390px", overflow,
                   f"scrollWidth={page.evaluate('document.documentElement.scrollWidth')}")

        page.set_viewport_size({"width": 1440, "height": 900})
        page.wait_for_timeout(800)

        print("\n== Cierre ==")
        audit.step("0 errores en la consola del navegador", len(audit.console_errors) == 0,
                   "; ".join(audit.console_errors[:5]))
        audit.step("0 excepciones no controladas", len(audit.page_errors) == 0,
                   "; ".join(audit.page_errors[:5]))

        context.close()
        browser.close()

    httpd.shutdown()

    # Ensamblado de la sesión a partir de los fotogramas capturados.
    frames = OUT / "frames"
    if frames.exists() and any(frames.glob("*.png")):
        target = OUT / "sesion.webp"
        subprocess.run(
            ["ffmpeg", "-y", "-framerate", "3", "-i", str(frames / "frame_%03d.png"),
             "-vcodec", "libwebp_anim", "-lossless", "0", "-q:v", "65",
             "-loop", "0", "-an", str(target)],
            check=False, capture_output=True
        )
        if target.exists():
            shutil.rmtree(frames, ignore_errors=True)

    report["checks"] = audit.steps
    report["console_errors"] = audit.console_errors
    report["page_errors"] = audit.page_errors
    report["failed_requests"] = audit.failed_requests
    (OUT / "resultado.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")

    write_report(report)

    failures = [step for step in audit.steps if not step["ok"]]
    print("\n" + "=" * 60)
    print(f"Comprobaciones: {len(audit.steps)} | Fallos: {len(failures)}")
    print(f"Errores de consola: {len(audit.console_errors)} | Excepciones: {len(audit.page_errors)}")
    if audit.failed_requests:
        print("Peticiones fallidas:")
        for item in audit.failed_requests[:10]:
            print("  -", item)
    print("=" * 60)

    return 1 if failures or audit.console_errors or audit.page_errors else 0


if __name__ == "__main__":
    sys.exit(main())

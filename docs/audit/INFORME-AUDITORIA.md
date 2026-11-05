# Informe de auditoría visual y funcional — Fenix Ninja

Generado por `tools/audit.py` (Playwright + Chromium headless, 1440×900).

## Resumen

| Métrica | Valor |
| --- | --- |
| Comprobaciones | 28 |
| Correctas | 28 |
| Fallidas | 0 |
| Errores de consola del navegador | 0 |
| Excepciones no controladas | 0 |
| Peticiones fallidas | 0 |

## Comprobaciones

| Comprobación | Resultado | Detalle |
| --- | --- | --- |
| El motor AICanvas está inicializado | PASS | AICanvas + canvas en el contenedor |
| La consola de comandos es visible | PASS | panel visible |
| El panel de comandos existe en el DOM | PASS | 15 comandos listados |
| El sprite de iconos SVG propios está presente | PASS | icon-terminal + icon-upload |
| La paleta se abre al enfocar la entrada | PASS | 15 opciones |
| El filtro de la paleta reduce las opciones | PASS | ['#galaxyEspiral de partículas en expansión continua'] |
| La navegación con teclado mueve la selección | PASS | aria-activedescendant activo |
| El comando #galaxy se ejecuta | PASS | enviado |
| El guion #cv se carga | PASS | 19 diapositivas |
| #cv contiene medios | PASS | 10 con imagen |
| #cv monta la diapositiva en color | PASS | canvas .fnx-slide presente |
| #cv deja la consola plegada durante la presentación | PASS | paleta oculta |
| El guion #robot se carga | PASS | 7 diapositivas |
| #robot contiene medios | PASS | 3 con imagen |
| #robot monta la diapositiva en color | PASS | canvas .fnx-slide presente |
| #robot deja la consola plegada durante la presentación | PASS | paleta oculta |
| El guion #reptile se carga | PASS | 8 diapositivas |
| #reptile contiene medios | PASS | 7 con imagen |
| #reptile monta la diapositiva en color | PASS | canvas .fnx-slide presente |
| #reptile deja la consola plegada durante la presentación | PASS | paleta oculta |
| La imagen del medio se ancla al DOM para poder reproducirse | PASS | 9 imagen(es) viva(s) |
| La diapositiva del GIF se compone en color | PASS | {'width': 1152, 'height': 720, 'painted': 1039} |
| El bucle de imagen viva está activo en la diapositiva del GIF | PASS | estado: {'active': True, 'live': True, 'index': 2, 'total': 19, 'title': 'CV'} |
| El botón pliega la consola | PASS | data-open=false |
| La tecla ` vuelve a desplegarla | PASS | data-open=true |
| Sin desbordamiento horizontal en 390px | PASS | scrollWidth=390 |
| 0 errores en la consola del navegador | PASS |  |
| 0 excepciones no controladas | PASS |  |

## Identidad visual

- Paleta governed por `css/tokens.css` (fuente canónica: `DESIGN.md`).
- Iconografía propia en SVG (`#icon-terminal`, `#icon-upload`); sin emojis del sistema operativo en la interfaz.
- Sin diálogos nativos: el feedback usa el sistema de avisos propio (`.fnx-toast`).
- La tipografía display (Ethnocentric) y la de cuerpo se cargan desde CDN y se aplican de forma coherente.

## Limitaciones del entorno de auditoría

- **Chromium headless no decodifica la animación de los GIF**, ni siquiera uno visible y plano: la reproducción del GIF animado no puede verificarse aquí. Se verifica en su lugar que el bucle de imagen viva está activo (`FenixContent.status().live`) y que la imagen se ancla al DOM para que el navegador la siga decodificando.
- Los temporizadores del navegador headless corren a ~1,7 Hz y `requestAnimationFrame` a ~3 fps (no hay display que marque vsync). Las métricas de fps obtenidas en este entorno no son representativas.

## Evidencia visual

- `docs/audit/01-consola-visible.png`
- `docs/audit/02-paleta-filtrada.png`
- `docs/audit/03-comando-galaxy.png`
- `docs/audit/04-comando-naive.png`
- `docs/audit/05-cv-presentacion.png`
- `docs/audit/05-reptile-presentacion.png`
- `docs/audit/05-robot-presentacion.png`
- `docs/audit/06-cv-medio.png`
- `docs/audit/06-reptile-medio.png`
- `docs/audit/06-robot-medio.png`
- `docs/audit/06b-cv-presentacion-limpia.png`
- `docs/audit/06b-reptile-presentacion-limpia.png`
- `docs/audit/06b-robot-presentacion-limpia.png`
- `docs/audit/07-cv-gif-animado.png`
- `docs/audit/08-consola-plegada.png`
- `docs/audit/09-movil.png`
- `docs/audit/sesion.webp` — grabación de la sesión (WebP animado)
- `docs/audit/resultado.json` — resultado machine-readable

## Conclusión

Sin fallos: la consola de comandos y las presentaciones #cv, #robot y #reptile funcionan con 0 errores de consola y 0 excepciones no controladas.

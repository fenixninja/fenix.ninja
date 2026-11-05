# DESIGN — Fenix Ninja

Fuente canónica del sistema visual. Ningún componente escribe valores de color,
radio o espaciado sueltos: todo pasa por las variables de `css/tokens.css`.

## Identidad

Proyecto de lienzo de partículas: cuadrícula oscura, átomos en movimiento y una
marca de un solo acento cálido. La consola es la única capa de interfaz y comparte
la misma paleta que el lienzo, de modo que el sistema se lee como una sola pieza.

| Rol | Token | Valor | Uso |
| --- | --- | --- | --- |
| Fondo | `--color-bg` | `#0F0F0F` | Lienzo y base de la página |
| Superficie | `--color-surface` | `rgba(15,15,15,.86)` | Panel de la consola |
| Superficie hundida | `--color-surface-sunken` | `rgba(0,0,0,.36)` | Campo de entrada |
| Borde | `--color-border-default` | `#262e37` | Bordes de panel y controles |
| Acento | `--color-primary` | `#F25C1F` | Marca, foco, commands, electrones |
| Texto | `--color-text` | `#F2F2F0` | Texto principal |
| Texto suave | `--color-text-muted` | `rgba(242,242,240,.62)` | Descripciones y pistas |
| Error | `--color-danger` | `#C0392B` | Comando desconocido, avisos de fallo |

## Tipografía

| Rol | Token | Pila |
| --- | --- | --- |
| Display | `--font-display` | `Ethnocentric, Arial Narrow, Arial, sans-serif` |
| Cuerpo | `--font-body` | `Inter, system-ui, Segoe UI, Roboto, sans-serif` |
| Monoespaciada | `--font-mono` | `ui-monospace, SF Mono, Menlo, Consolas, monospace` |

La tipografía display se reserva para titulares y para el texto rasterizado en el
lienzo. El texto de la consola es monoespaciado: alinea los identificadores de
comando (`#galaxy`) y facilita la lectura de la paleta.

## Espaciado y radios

Escala de espaciado en múltiplos de 4 px (`--space-1` … `--space-7`).
Radios: `--radius-sm` (6 px) en controles, `--radius-md` (10 px) en el campo de
entrada, `--radius-lg` (16 px) en el panel, `--radius-pill` (50 px) en el botón de
plegado.

## Movimiento

`--duration-fast` (120 ms) para estados de control, `--duration-base` (240 ms) para
transiciones de panel y `--duration-slow` (420 ms) para entradas de contenido. La curva es
`--ease-out` (`cubic-bezier(.22,.61,.36,1)`). Con `prefers-reduced-motion: reduce`
todas las transiciones se desactivan.

## Iconografía

Biblioteca propia de iconos vectoriales SVG definidos como `<symbol>` en
`index.html` y referenciados con `<use>`. **Prohibido el uso de emojis del sistema
operativo como iconografía funcional.**

- `#icon-terminal` — marca de la consola y botón de entrada.
- `#icon-upload` — subida de imagen.

## Columnas del lienzo y de la consola

La pantalla se divide en dos columnas. La consola es una columna fija a la
derecha y el lienzo ocupa el resto:

| Zona | Medida |
| --- | --- |
| Columna de la consola | `--panel-width`: `clamp(360px, 36vw, 560px)` |
| Lienzo | desde `0` hasta `var(--panel-width)` por la derecha |
| Móvil (`≤ 768px`) | la consola pasa a ser una hoja inferior de `54vh` |

El texto ya no se dibuja sobre el lienzo: la columna derecha es el lugar donde
aparece. El lienzo conserva la imagen a color y la silueta que alimenta la
matriz de celdas.

## Narración con efecto de máquina de escribir

La columna de resultado escribe el texto de cada diapositiva como una máquina de
escribir humana (`js/typewriter.js`):

| Parámetro | Valor | Motivo |
| --- | --- | --- |
| Retardo base | `35 ms` por carácter | ritmo legible |
| Variación | `0–45 ms` aleatorios | nunca es un intervalo fijo |
| Pausa de puntuación | `240 ms` tras `. , ; : ! ? …` | respira en las frases |

El cursor `.fnx-log__caret` parpadea mientras se escribe. Un clic sobre la
columna de resultado completa la escritura al instante; cambiar de diapositiva
la cancela. La diapositiva avanza cuando la escritura termina más una pausa de
lectura de `1400 ms`.

Las imágenes de la columna izquierda se revelan con el mismo ritmo: la foto
aparece de izquierda a derecha durante `1800 ms`, como si se escribiera. El
avance se mide por tiempo para que un navegador con temporizadores
estrangulados no alargue la diapositiva. El render final es idéntico al que
había: la imagen a color sobre la silueta que el motor rasteriza como celdas.

La columna de resultado es un `role="log"` con `aria-live="polite"` y tiene su
propia barra de desplazamiento, estilada con los tokens del sitio (pulgar
`--color-border-strong`, `--color-primary` al pasar el ratón).

## Diapositivas del presentador

El presentador compone cada diapositiva sobre un lienzo del 80 % del área
izquierda:

| Zona | Fracción del lienzo |
| --- | --- |
| Imagen | `0.04` → `0.76` de alto, `0.94` de ancho máximo |
| Titular y cuerpo | columna derecha (narración) |
| Diapositivas de texto | titular `0.16`, cuerpo `0.26` |

El motor rasteriza la **máscara** de cada diapositiva (silueta de la imagen)
como celdas; el color lo compone el lienzo visible. Ambos lienzos comparten
coordenadas, de modo que imagen y efecto nunca divergen. El texto se escribe en
la columna de la consola, nunca sobre el lienzo.

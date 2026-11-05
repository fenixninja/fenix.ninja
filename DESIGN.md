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
comando (`/galaxy`) y facilita la lectura de la paleta.

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

## Estado inicial de la consola

La consola **arranca plegada**: el lienzo ocupa todo el ancho y la animación
del unicornio se ve a pantalla completa. Si el usuario no la toca, se despliega
sola a los **10 segundos** (`AUTO_OPEN_DELAY`). Al pulsar el botón (o la tecla
`` ` ``) el despliegue automático se cancela: a partir de ahí manda el usuario.

En móvil el comportamiento es el mismo, y además el auto-despliegue no roba
el foco: no se abre el teclado del sistema sin que el usuario lo pida.

## Columnas del lienzo y de la consola

La pantalla se divide en dos columnas. La consola es una columna fija a la
derecha y el lienzo ocupa el resto:

| Zona | Medida |
| --- | --- |
| Columna de la consola | `--panel-width`: `clamp(360px, 36vw, 560px)` |
| Imagen en la consola | `--console-media-height`: `32vh` de alto máximo |
| Lienzo | desde `0` hasta `var(--panel-width)` por la derecha |
| Móvil (`≤ 768px`) | la consola pasa a ser una hoja inferior de `54vh` |

El texto ya no se dibuja sobre el lienzo: la columna derecha es el lugar donde
aparece. La consola muestra, de arriba abajo, la imagen de la diapositiva y el
resultado escrito; el lienzo conserva la silueta que alimenta la matriz de
celdas.

## Narración con efecto de máquina de escribir

La columna de resultado escribe el texto de cada diapositiva como una máquina de
escribir humana (`js/typewriter.js`):

| Parámetro | Valor | Motivo |
| --- | --- | --- |
| Retardo base | `17 ms` por carácter | ritmo legible y fluido |
| Variación | `0–22 ms` aleatorios | nunca es un intervalo fijo |
| Pausa de puntuación | `120 ms` tras `. , ; : ! ? …` | respira en las frases |
| Pausa de lectura | `700 ms` entre diapositivas | mantiene el ritmo |

El cursor `.fnx-log__caret` parpadea mientras se escribe. Un clic sobre la
columna de resultado completa la escritura al instante; cambiar de diapositiva
la cancela. La diapositiva avanza cuando la escritura termina más una pausa de
lectura de `1400 ms`.

Las imágenes **se cargan dentro de la consola** (columna derecha), en un
marco con un velo que las revela de izquierda a derecha durante `900 ms`, al
mismo ritmo que el texto. El avance del velo se mide por tiempo para que un
navegador con temporizadores estrangulados no alargue la diapositiva.

En el lienzo de la izquierda queda el **render de celdas** que el motor
construye con la silueta de la imagen: es el efecto propio del sitio.

Cuando la consola se retira, el lienzo recupera todo el ancho
(`body[data-console="closed"]`): no queda banda negra.

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

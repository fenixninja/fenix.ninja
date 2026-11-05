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

## Diapositivas del presentador

El presentador compone cada diapositiva sobre un lienzo del 80 % del viewport
centrado. La consola se ancla abajo, así que el contenido se compone en la banda
superior para que siga legible con la paleta desplegada:

| Zona | Fracción del lienzo |
| --- | --- |
| Imagen | `0.03` → `0.41` |
| Titular | bajo la imagen + `0.04` |
| Cuerpo | `0.50` |
| Diapositivas de texto | titular `0.16`, cuerpo `0.26` |

El motor rasteriza la **máscara** de cada diapositiva (silueta + texto en blanco)
como celdas; el color lo compone el lienzo visible. Ambos lienzos comparten
coordenadas, de modo que imagen y efecto nunca divergen.

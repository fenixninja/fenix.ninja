# Fenix Ninja

Lienzo de partículas con **consola de comandos** y presentaciones que reproducen el
CV, el robot Nibble y el dispositivo IoT Nosystat.

Sitio estático (GitHub Pages). Sin build, sin dependencias, sin frameworks.

## Consola de comandos

La consola es la única capa de interfaz y ocupa una **columna fija a la
derecha**; el lienzo con las imágenes se queda a la izquierda. En pantallas
pequeñas (≤ 768 px) la consola pasa a ser una hoja inferior.

La columna funciona como una shell: arriba la **imagen de la diapositiva** y
después el **resultado** (el eco de cada comando y la narración de la
presentación); abajo, el **campo de entrada**. Al retirar la consola el lienzo
recupera todo el ancho: no queda banda negra.

Al entrar, la consola está **plegada** para que se vea la animación completa
del unicornio. Si no la tocas, **se despliega sola a los 10 segundos**; en
cuanto pulsas el botón, el despliegue automático se cancela y manda el usuario.

| Tecla | Acción |
| --- | --- |
| `Enter` | Ejecuta el comando (o el texto libre, que se rasteriza en el lienzo) |
| `↑` `↓` | Navega por la paleta de comandos (o por el historial si la entrada está vacía) |
| `Tab` | Completa el comando resaltado |
| `Esc` | Cierra la paleta |
| `` ` `` | Plegar o desplegar la consola |
| Clic en el resultado | Termina la escritura al instante |

El botón circular de la esquina pliega la consola y devuelve el lienzo al
espectador.

### Máquina de escribir

El texto de cada diapositiva se escribe en la columna de resultado con efecto
de máquina de escribir: 17 ms por carácter con variación aleatoria y pausas de
120 ms tras la puntuación. Las imágenes **se cargan en la consola** y se
revelan con el mismo ritmo, de izquierda a derecha, durante 900 ms. En el
lienzo de la izquierda queda el render de celdas de la silueta.

La columna de resultado tiene su propio desplazamiento, con la barra de scroll
estilada con los tokens del sitio. Un clic sobre el resultado termina la
escritura al instante.

### Comandos

| Comando | Qué hace |
| --- | --- |
| `/naive` | Renderiza la silueta vectorial del unicornio |
| `/elder` | Renderiza el fénix poliédrico |
| `/galaxy` | Espiral de partículas en expansión continua |
| `/ring` | Anillo de electrones orbitando el centro |
| `/countdown` | Cuenta atrás 3-2-1 y lanza la galaxia |
| `/queue` | Escribe «naïve» letra a letra |
| `/explode` | Dispersa la forma actual en partículas |
| `/clear` | Limpia el lienzo |
| `/destroy` / `/init` | Destruye y reconstruye los lienzos |
| `/cv` | **Presentación del CV**: aptitudes, historial profesional y enlaces |
| `/robot` | **Presentación de Nibble**: robot fácil de montar y replicar |
| `/reptile` | **Presentación de Nosystat**: dispositivo IoT para microclimas |
| `/next` | Avanza a la siguiente diapositiva |
| `/stop` | Detiene la presentación en curso |

Los comandos empiezan por `/` (`/cv`, `/robot`, `/reptile`…). Cualquier otra
entrada se rasteriza sobre el lienzo; una entrada que empieza por `/` pero no
existe se informa como comando desconocido.

El registro de comandos vive en `js/ai-canvas.js` y es la **fuente única de verdad**:
el motor lo ejecuta y la consola solo lo describe. No hay lógica duplicada.

## Estructura

```
index.html              Markup, sprite de iconos SVG y carga de módulos
css/tokens.css          Tokens de diseño (fuente canónica de valores)
css/base.css            Reset, lienzo y utilidades globales
css/console.css         Estilos de la consola
js/ai-canvas.js         Motor de partículas: celdas, electrones, registro de comandos
js/presenter.js         Presentador de contenidos (composición de diapositivas)
js/content.js           Carga de guiones y ciclo de la presentación
js/console.js           Consola: paleta, historial, avisos, accesibilidad
js/typewriter.js        Máquina de escribir para la columna de resultado
data/cv.json            Guion del CV
data/robot.json         Guion de Nibble
data/reptile.json        Guion de Nosystat
tools/fetch-content.mjs Generador de los guiones desde fenixbinario.com
tools/audit.py          Auditoría visual y funcional en navegador
docs/audit/             Evidencia de la auditoría
DESIGN.md               Sistema de diseño
```

## Contenidos

Los guiones de `data/` se generan extrayendo las páginas reales de
`fenixbinario.com`. Para regenerarlos:

```bash
node tools/fetch-content.mjs
```

El generador es determinista y no tiene dependencias: parser HTML propio y
`fetch` nativo de Node 18+. Filtra los recursos decorativos del tema y el pie de
página, y resuelve las URL relativas a absolutas.

Las imágenes y los GIF se sirven con `Access-Control-Allow-Origin: *`, y el
presentador los carga con `crossOrigin="anonymous"`: sin eso el lienzo quedaría
contaminado y `getImageData()` lanzaría `SecurityError`.

## Auditoría

```bash
python3 tools/audit.py
```

Levanta el sitio en local, recorre la consola, ejecuta cada comando, captura
pantallas, graba la sesión y verifica que el navegador queda limpio. El informe
se genera en `docs/audit/INFORME-AUDITORIA.md`.

## Despliegue

GitHub Pages sirve la rama `main`. `CNAME` fija el dominio `fenix.ninja`. No hay
paso de build: los cambios se aplican al hacer push.

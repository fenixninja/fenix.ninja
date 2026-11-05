# PROJECT_PROFILE — Fenix Ninja

<!-- METADATA_START
DocumentID: FNX-PROJECT-PROFILE
Version: "1.0.0"
Classification: "Internal Engineering Profile"
TargetAudience: "Developers, AI Agents, Project Maintainers"
Updated: "2026-11-05"
METADATA_END -->

Este documento declara las banderas del proyecto: determinan qué fases del
proceso aplican y cuáles quedan fuera de alcance.

## Identidad

| Campo | Valor |
| --- | --- |
| Tipo | Sitio estático (GitHub Pages) |
| Dominio | `fenix.ninja` |
| Stack | HTML + CSS + JavaScript sin dependencias, sin build |
| Motor | Canvas 2D propio (`js/ai-canvas.js`) |
| Fuente de contenidos | `fenixbinario.com` (guiones en `data/`) |

## Banderas

| Bandera | Valor | Consecuencia |
| --- | --- | --- |
| `hasUi` | **sí** | Toda verificación exige levantar el sitio y recorrerlo en navegador, no solo tests de terminal |
| `hasApi` | no | No hay backend propio ni contratos de API que versionar |
| `hasRoles` | no | No hay matriz rol × acción que auditar |
| `hasPersistence` | no | No hay datos que proteger ni datos de prueba que limpiar |
| `hasI18n` | **no** | Interfaz en español, un único idioma; no se introduce un sistema i18n |
| `hasPayments` | no | — |
| `hasWebhooks` | no | — |
| `hasMcp` | **no** | El proyecto no expone servidor MCP; no aplica la matriz de decisión de MCP |
| `isLibrary` | no | Es una aplicación, no un paquete distribuible |

## Fases que aplican

- **Identidad visual** — sistema de tokens propio en `css/tokens.css`, fuente
  canónica en `DESIGN.md`, iconografía SVG propia, sin emojis del sistema
  operativo ni diálogos nativos.
- **Auditoría en navegador** — obligatoria: `tools/audit.py` recorre la consola,
  ejecuta todos los comandos y exige 0 errores de consola y 0 excepciones no
  controladas. Evidencia en `docs/audit/`.
- **Documentación** — `README.md` como mapa del proyecto y una fuente canónica
  por tema (`DESIGN.md`, `docs/audit/INFORME-AUDITORIA.md`).
- **Verificación de contenidos** — los guiones se regeneran con
  `tools/fetch-content.mjs` y se versionan en `data/`.

## Fases que no aplican

- i18n: el proyecto tiene un solo idioma (es). No se crean claves ni se
  sincronizan traducciones.
- Matriz rol × acción: no hay roles de usuario en el sitio.
- Pruebas de persistencia y limpieza de datos de prueba: no hay base de datos.
- Servidor MCP: no hay dominio consultable por agentes; el proyecto consume
  contenidos, no los expone.
- Cifrado de secretos y reveal-once: no se manejan credenciales de usuario.

## Notas de arquitectura

- El registro de comandos (`js/ai-canvas.js`) es la fuente única de verdad: el
  motor ejecuta y la consola describe. La consola no replica lógica de negocio.
- Las imágenes remotas se cargan con `crossOrigin="anonymous"`. Sin ello el
  lienzo quedaría contaminado y `getImageData()` lanzaría `SecurityError`.
- El presentador compone dos lienzos sincronizados: el visible (color) y la
  máscara (silueta) que el motor rasteriza como celdas.
- El texto ya no se dibuja sobre el lienzo: se escribe en la columna de
  resultado de la consola, a la derecha, con efecto de máquina de escribir.
- La narración y el medio van en paralelo: la escritura nunca se interrumpe por
  una imagen lenta y la diapositiva avanza al terminar de leerse.
- El plazo de una diapositiva con medio arranca cuando el medio está listo, no
  cuando se anuncia: con red lenta el contenido no se pierde.

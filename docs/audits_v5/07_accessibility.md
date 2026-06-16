# Auditoría de Accesibilidad (a11y) y Navegación por Teclado

## Resumen Ejecutivo
Se realizó una auditoría profunda sobre el estado de accesibilidad del proyecto Atelier. Se evaluaron las configuraciones del linter, el uso de semántica HTML, navegación por teclado, visibilidad de los estados de foco, y la correcta aplicación de atributos ARIA.

El estado actual del proyecto presenta **deficiencias significativas** en accesibilidad que afectan la experiencia de usuarios que dependen de teclados o lectores de pantalla (Screen Readers). Muchas de estas fallas provienen de prácticas comunes en el desarrollo moderno, como la construcción de componentes interactivos a partir de etiquetas estáticas (como `<div>` o `<span>`), además de un desactivado consciente o heredado de reglas críticas en el linter.

---

## Hallazgos Principales

### 1. Reglas de Accesibilidad Desactivadas en el Linter
Al inspeccionar el archivo `eslint.config.mjs`, se descubrió que varias reglas críticas del plugin `jsx-a11y` están apagadas explícitamente:
- `"jsx-a11y/alt-text": "off"`
- `"jsx-a11y/click-events-have-key-events": "off"`
- `"jsx-a11y/interactive-supports-focus": "off"`
- `"jsx-a11y/no-static-element-interactions": "off"`

Esto ha permitido que se introduzcan múltiples errores de accesibilidad sin que el equipo de desarrollo reciba advertencias durante la escritura del código. Al reactivarlas, se identificaron casi 90 infracciones inmediatas.

### 2. Navegación por Teclado y Elementos Interactivos
Al buscar usos de elementos interactivos personalizados, se encontraron **45 casos** de elementos con eventos de clic (`onClick`) que no tienen soporte para teclado (`onKeyDown`).
- Muchos menús, modales y botones personalizados son etiquetas `<div>` o `<span>`.
- Sólo se encontraron **3 usos** del atributo `tabIndex={0}` en todo el código fuente, lo que indica que la abrumadora mayoría de los componentes interactivos no nativos son completamente invisibles a la navegación por la tecla `Tab`.

### 3. Falta de Visibilidad del Estado de Foco (Focus Rings)
Se contabilizaron **283 usos** de la clase de Tailwind `outline-none`. Sin embargo, los reemplazos con bordes amigables de foco (por ejemplo, `focus:ring`) aparecen solamente en **85 ocasiones**.
- Esto significa que hay cientos de elementos donde el contorno de enfoque nativo del navegador fue eliminado pero no fue reemplazado por ningún indicador visual, haciendo casi imposible para el usuario saber dónde se encuentra dentro de la página al navegar con teclado.

### 4. Etiquetas de Formulario (Labels) Huérfanas
El código fuente contiene alrededor de **241 etiquetas `<label>`**, pero curiosamente sólo existen **12 usos** del atributo `htmlFor` (el equivalente en React del atributo HTML `for`).
- Esto demuestra que la inmensa mayoría de las etiquetas de formulario están siendo usadas únicamente con propósitos estéticos o visuales, y no están asociadas programáticamente a su respectivo `<input>`.
- **Consecuencia:** Los lectores de pantalla anunciarán un campo de texto vacío sin indicar qué información se solicita al usuario.

### 5. Atributos ARIA Deficientes
Para una aplicación compleja que posee modales dinámicos, paneles deslizables, notificaciones y múltiples menús, el uso de etiquetas ARIA es ínfimo.
- Se detectaron sólo unos **20 atributos ARIA** (`aria-expanded`, `aria-label`, `aria-modal`) en todo el proyecto.
- Hay cientos de botones (etiquetas `<button>`) y componentes con iconos (SVG) que carecen de texto interno y no poseen un `aria-label`, por lo que resultan en "Botones sin nombre" para las herramientas de asistencia.

### 6. Imágenes sin Texto Alternativo
Se encontraron algunas instancias de etiquetas `<img>` o componentes `<Image>` que no poseen el atributo `alt`. Aquellas que actúan de forma puramente decorativa no tienen `alt=""` explícito, un paso requerido para que los lectores de pantalla las ignoren adecuadamente.

---

## Plan de Acción Recomendado

1. **Rehabilitar ESLint A11y:** Cambiar las reglas `jsx-a11y` apagadas en `eslint.config.mjs` de `"off"` a `"warn"`. Esto forzará al equipo a notar los problemas de aquí en adelante.
2. **Revisión de Formularios:** Crear un script o iterar manualmente sobre todos los componentes de la carpeta `src/` que usan formularios, asociando las etiquetas `<label>` a sus correspondientes `<input id="...">` usando el atributo `htmlFor="..."`, o envolviendo el input dentro del label.
3. **Navegación por Teclado (tabIndex y keyEvents):** 
   - Reemplazar los `<div>` con `onClick` por etiquetas `<button>` nativas donde sea posible.
   - Donde no sea posible, agregar `role="button"`, `tabIndex={0}`, y un listener de `onKeyDown` que escuche las teclas `Enter` y `Espacio`.
4. **Visibilidad de Foco:** Reemplazar el uso desmedido de `outline-none` agregando clases alternativas que proporcionen retroalimentación visual al enfocar, como `focus:ring-2 focus:ring-amber-500 focus:outline-none`.
5. **Enriquecimiento ARIA:** 
   - Añadir `aria-label` a botones que solamente tienen un icono.
   - Añadir `aria-expanded` y `aria-controls` en menús desplegables (dropdowns).
   - Añadir `aria-live="polite"` en alertas de UI que aparecen de forma asíncrona.

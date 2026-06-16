# Auditoría de Estilos CSS y Tailwind

## Resumen Ejecutivo

El proyecto utiliza **Tailwind CSS v4** (según `package.json`). El archivo principal de estilos es `src/app/globals.css`, el cual define las variables CSS principales y temas con la directiva `@theme inline` (`--background`, `--foreground`, `--primary`, etc.). Sin embargo, la implementación en los componentes ignora casi por completo estas variables semánticas, favoreciendo el uso masivo explícito de clases condicionadas (como `dark:`) y valores arbitrarios estáticos (`[#hex]`).

---

## Hallazgos Principales

### 1. Inconsistencia en el Manejo de Temas (Dark/Light Mode)
El archivo `globals.css` define de manera correcta las variables CSS para los modos claro y oscuro en los bloques `:root` y `.dark`.
- **Problema:** En el código se está abusando del prefijo `dark:` explícito en lugar de usar variables semánticas. Existen **2490 ocurrencias** de clases como `dark:bg-stone-900` o `dark:text-white` distribuidas por todos los componentes.
- **Comparación:** Clases semánticas como `bg-background` y `text-foreground` (las cuales cambian automáticamente de color según el modo) se usan apenas ~7 y ~32 veces respectivamente.
- **Impacto:** Este enfoque hace extremadamente difícil mantener el código, imposibilita el fácil cambio a nuevos temas o ajustes globales de la paleta y engrosa innecesariamente el HTML en cada render.

### 2. Abuso de Valores Arbitrarios (Arbitrary Values)
En lugar de seguir un diseño cohesivo y una paleta de colores del tema, se han hardcodeado constantemente valores en línea, rompiendo el sistema de diseño.
- **`text-[...]`:** Encontrado **1894 veces** (por ej: `text-[#666]`, `text-[10px]`, `text-[11px]`).
- **`bg-[...]`:** Encontrado **236 veces** (por ej: `bg-[#fafafa]`, `bg-[#c8a55c]`).
- **Impacto:** Genera inconsistencias visuales, pérdida del "single source of truth" (única fuente de verdad) en el diseño y aumenta el tamaño final de la hoja de estilos generada, ignorando por completo el propósito de las clases utilitarias estándar de Tailwind.

### 3. Estilos en Línea y Fuentes Hardcodeadas
- Se hallaron cerca de **150** ocurrencias de la etiqueta `style={{...}}`. Muchas de ellas justificadas para cálculos dinámicos de UI (como anchos en porcentajes para barras de progreso), pero en repetidas ocasiones se utiliza para propiedades estáticas.
- **Problema notable:** Se fuerza la fuente localmente mediante `style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}` a nivel de componente en lugar de extender el bloque `@theme` (p. ej. usando la utilidad `font-sans`).

### 4. Código Muerto en Utilidades Personalizadas
- El archivo `globals.css` incluye utilidades como `.btn-premium` y `.glass-panel` creadas utilizando la directiva `@apply`. Sin embargo, ninguna de estas clases está siendo utilizada actualmente en ningún lugar de la base de código.

---

## Plan de Acción y Recomendaciones

1. **Refactorización de Temas (Semantic Theming):**
   - Reemplazar progresivamente pares como `bg-white dark:bg-stone-900` y `text-stone-900 dark:text-white` por variables semánticas (`bg-background`, `bg-sidebar`, `text-foreground`, etc.) debidamente registradas y mapeadas en `globals.css`.
   
2. **Consolidar Paleta de Colores y Tipografía:**
   - Identificar los colores hexadecimales más repetidos (`#c8a55c`, `#666`, etc.) y agregarlos al bloque `@theme inline` en `globals.css` como custom properties para habilitar su reutilización (ej: `text-brand-gold` en vez de `text-[#c8a55c]`).
   - Mapear las medidas repetitivas (`10px`, `11px`) a variables de escala (p. ej. utilidades custom o ajuste de `text-xs`).

3. **Limpieza CSS General:**
   - Eliminar utilidades "muertas" (`.btn-premium`, `.glass-panel`) de `globals.css` si no hay intención de utilizarlas.
   - Refactorizar los atributos `style={{ fontFamily: ... }}` para utilizar las clases tipográficas de Tailwind.

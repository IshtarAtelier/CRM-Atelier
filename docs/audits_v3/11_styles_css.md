# Auditoría de Estilos, Tailwind CSS y Temas (Dark/Light)

## 1. Uso de Tailwind CSS
- **Versión**: El proyecto utiliza **Tailwind CSS v4**. Esto se refleja en la presencia de los paquetes `@tailwindcss/postcss` y `tailwindcss` (versión ^4) en el `package.json`.
- **Configuración (CSS-first)**: Acorde a las convenciones de Tailwind v4, el proyecto no utiliza un archivo tradicional `tailwind.config.ts/js`. En su lugar, toda la configuración del diseño se centraliza directamente en el archivo principal de estilos globales (`src/app/globals.css`) mediante directivas nativas como `@import "tailwindcss";` y el uso del bloque `@theme`.
- **Organización de clases**: Se utilizan clases utilitarias de Tailwind extensamente en todo el proyecto. También hay uso correcto de directivas como `@apply` para crear clases de componentes semánticos complejos (por ejemplo, `.btn-premium`, `.glass-panel`) combinando la robustez de Tailwind con nombres de clases más limpios.

## 2. Consistencia de Temas (Dark / Light)
- **Implementación manual**: La activación del modo oscuro está configurada explícitamente de forma manual a través de la directiva `@custom-variant dark (&:where(.dark, .dark *));` en el `globals.css`. Esto obliga a que el modo oscuro se active solo mediante la inclusión de la clase `.dark` y deshabilita la reacción automática a las preferencias del sistema operativo.
- **Amplia aplicación en componentes**: El equipo de desarrollo ha incorporado extensamente selectores oscuros de manera explícita en los archivos TSX (por ejemplo, `dark:bg-stone-900`, `dark:border-stone-800`, `dark:text-white`). 
- **Ausencia de toggle de tema**: Al revisar el nivel de arquitectura (ej. `src/app/layout.tsx`), no se detectó un proveedor de temas (como `next-themes`) ni un script o lógica de React que alterne o maneje la clase `.dark` dinámicamente en el documento raíz (`<html>` o `<body>`). El modo oscuro está preparado visualmente, pero falta la interactividad/estado para accionarlo en el frontend, lo cual deja a los componentes en un modo oscuro latente pero inactivo globalmente.

## 3. Uso y Definición de Variables CSS
- **Definición de Variables Globales**: En el bloque `:root` de `globals.css` se definen variables base correctas (`--background`, `--foreground`, `--primary`, `--sidebar`, etc.).
- **Integración con Tailwind v4**: Estas variables están inyectadas a Tailwind mediante la configuración del bloque `@theme inline` (ej. `--color-background: var(--background);`), lo cual es una excelente práctica.
- **Inconsistencia Crítica de Variables Semánticas**: Las variables del root **no están versionadas para el modo oscuro**. Falta una definición correspondiente del modo oscuro para estas variables en el `globals.css` (es decir, una regla css como `.dark { --background: #...; --foreground: #...; }`).
- **Problema Derivado (Repetición Estilística)**: Debido a que las variables no cambian automáticamente su color, los desarrolladores se ven forzados a no aprovechar la variable `--background`. En vez de utilizar un estilo unificado como `className="bg-background text-foreground"`, el código se satura de sobreescrituras explícitas repetitivas en cada componente: `className="bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-white"`.

## Recomendaciones y Plan de Acción
1. **Implementar el cambio de Variables CSS por Tema**:
   Agregar las declaraciones de colores oscuros en el `globals.css` dentro de la clase `.dark`. Esto permitirá que las variables `--background`, `--foreground` y `--primary` cambien solas y simplificará la limpieza del código.
   ```css
   .dark {
     --background: #1c1917; /* stone-900 */
     --foreground: #fafaf9; /* stone-50 */
     /* ...otras variables */
   }
   ```
2. **Refactorizar el uso de los utilitarios de color**:
   Reducir el uso de colores codificados explícitamente (`bg-white dark:bg-stone-800`) y reemplazarlos progresivamente por `bg-background`, para depender completamente del sistema de variables.
3. **Instalar y configurar `next-themes`**:
   Dado que es una aplicación en Next.js, se recomienda envolver el árbol principal (o su contenido en el `RootLayout`) con un `ThemeProvider` para gestionar fácilmente el estado, persistencia en localStorage y un selector de tema (Light / Dark / System).

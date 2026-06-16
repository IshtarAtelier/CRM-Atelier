# Auditoría de Estilos: Tailwind CSS, Consistencia de Temas y Variables CSS

## 1. Uso de Tailwind CSS
- **Versión**: El proyecto se encuentra utilizando **Tailwind CSS v4** (`tailwindcss` y `@tailwindcss/postcss` en su versión 4), que trae mejoras importantes en rendimiento y una nueva forma de configurar temas y directivas.
- **Ecosistema**: También se hace uso de `tailwind-merge` para resolver de forma segura los conflictos de clases cuando se combinan estilos dinámicamente en componentes (como en React).
- **Implementación**: El estilo se basa completamente en las utilidades de Tailwind, las cuales están inyectadas a través de `src/app/globals.css`. Es el enfoque central para todo el diseño de interfaces en el frontend.

## 2. Variables CSS y Configuración del Tema
- **Definición Base**: En `src/app/globals.css`, se define un conjunto muy básico de variables CSS dentro de `:root`:
  ```css
  :root {
    --background: #faf8f5;
    --foreground: #433831;
    --primary: #9e7f65;
    --primary-foreground: #ffffff;
    --sidebar: #ffffff;
    --sidebar-border: #e8e2db;
  }
  ```
- **Integración con Tailwind v4**: Se utiliza correctamente la directiva `@theme inline` propia de la versión 4 para mapear estas variables CSS y ponerlas a disposición como utilidades (ej. `bg-background`).
- **Hallazgo Crítico**: **No existen definiciones de variables para el modo oscuro (`.dark`)**. Si bien el `:root` tiene definidos los tokens para el tema claro, en el archivo `globals.css` no hay un bloque que reemplace estos valores para la clase `.dark`.

## 3. Consistencia de Temas (Dark / Light Mode)
- **Estrategia Dark Mode**: Se utiliza una variante personalizada basada en clases:
  ```css
  @custom-variant dark (&:where(.dark, .dark *));
  ```
  Esto significa que el modo oscuro es manual y controlado activamente por un conmutador de estado (agregando la clase `.dark` a un nivel superior, como en `<html>` o `<body>`), y no hereda automáticamente las preferencias de esquema de color del sistema operativo en el CSS base.
  
- **Aplicación y Repetición**: Debido a la carencia de variables dinámicas, el modo oscuro se logra de forma "estática y repetitiva". Los desarrolladores tienen que indicar explícitamente el color claro y el color oscuro en casi todos los elementos.
  Se encontró el siguiente volumen de utilidades manuales en el proyecto:
  - **Fondos:** ~1,339 usos de variantes como `dark:bg-stone-900`, `dark:bg-stone-800`, etc.
  - **Texto:** ~951 usos de variantes como `dark:text-white`, `dark:text-stone-300`, etc.
  - **Bordes:** ~892 usos de variantes como `dark:border-stone-800`, etc.
- **Evaluación de Consistencia**: Aunque visualmente la aplicación puede verse coherente si los desarrolladores mantienen la disciplina manual, **a nivel arquitectónico la consistencia es frágil**. 
  Al depender de declarar a mano `bg-white dark:bg-stone-900` en cada componente, el código es propenso a inconsistencias menores si en algunos lugares se usa `stone-800` y en otros `stone-900` por error. Modificar la paleta oscura en el futuro obligará a un tedioso reemplazo global.

## 4. Conclusiones y Recomendaciones

1. **Completar las Variables CSS (Theming Semántico):**
   Añadir inmediatamente el soporte de modo oscuro en `globals.css` para el theaming base. Por ejemplo:
   ```css
   .dark {
     --background: #1c1917; /* stone-900 */
     --foreground: #fafaf9; /* stone-50 */
     --primary: #d6bfae;
     --sidebar: #292524; /* stone-800 */
     --sidebar-border: #44403c; /* stone-700 */
   }
   ```
2. **Refactorización Progresiva de Clases de Utilidad:**
   A medida que se desarrollen o modifiquen componentes, se debe empezar a reemplazar los patrones dobles como `bg-white dark:bg-stone-900` por `bg-background` o crear tokens extra como `--card`, `--card-foreground`, `--border`, etc.
3. **Escalar el Sistema de Diseño:**
   Definir un sistema de tokens en CSS más extenso si la aplicación lo requiere (ej. warning, error, info, success). Mantenerlo atado a las directivas de `@theme inline` de Tailwind v4 reducirá drásticamente el uso excesivo del prefijo `dark:` y centralizará el control del modo claro y oscuro, garantizando consistencia absoluta en el proyecto.

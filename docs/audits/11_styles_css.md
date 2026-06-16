# Auditoría de Estilos y Tailwind CSS

## 1. Uso de Tailwind CSS
El proyecto está utilizando **Tailwind CSS v4** (`@import "tailwindcss";`), lo cual es una excelente decisión para aprovechar el nuevo motor basado en Rust y la generación estática sin archivo de configuración externo (v4 approach).
- Se hace un uso extensivo de las utilidades de Tailwind (por ejemplo, `bg-white`, `text-stone-400`, etc.).
- Las utilidades se integran correctamente utilizando la librería `tailwind-merge` para combinar clases de forma condicional en componentes UI.
- **Falta de Linter de Tailwind**: No se detectó el uso de `eslint-plugin-tailwindcss` en el `package.json`. Esto es altamente recomendado para evitar clases mal escritas, detectar clases en conflicto (o redundantes) y ordenar automáticamente el código en los archivos TSX.

## 2. Consistencia de Temas (Dark / Light)
Se encontraron más de **2300** instancias de la directiva de utilidad `dark:` en los archivos del proyecto en la carpeta `src/`. 
El modo oscuro está configurado explícitamente en `globals.css` para activarse manualmente a través de la clase `.dark` (usando `@custom-variant dark (&:where(.dark, .dark *));`).

**Problema principal**: Alta carga de mantenimiento e inconsistencias. 
En lugar de utilizar variables CSS semánticas (Design Tokens) que se adapten al tema, el proyecto depende de hardcodear los colores mediante utilidades duales en los elementos (por ejemplo: `bg-stone-50 dark:bg-stone-900 text-stone-800 dark:text-stone-200`). Esto obliga a los desarrolladores a escribir ambas versiones (claro y oscuro) para cada componente, lo cual es propenso a errores (algunos componentes no se adaptarán al modo oscuro si el desarrollador olvida agregar el prefijo `dark:`).

## 3. Variables CSS (`globals.css`)
En el archivo base `src/app/globals.css` se definen las variables principales en el pseudo-elemento `:root`:
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
Sin embargo, esta implementación presenta inconvenientes estructurales:
- **No existe un selector `.dark`** que redefina estas variables para el modo oscuro.
- Existen clases en el código como `bg-background` y `text-foreground` que usan estos tokens. Al no estar redefinidas en `.dark`, **estas clases se mantendrán claras incluso cuando el modo oscuro esté activado**.
- Existe una baja adopción de los tokens definidos: `bg-background` se usa menos de 10 veces en contraste con utilidades como `bg-white` (casi 600 veces) y `bg-stone-50` (más de 300 veces).

### Recomendación Estratégica:
Implementar un bloque para el modo oscuro en `globals.css` para que las variables reaccionen automáticamente, lo que permitiría limpiar miles de clases `dark:` redundantes.
```css
:root {
  --background: #faf8f5;
  --foreground: #433831;
  /* ... */
}

.dark {
  --background: #1c1917; /* Equivale a stone-900, por ejemplo */
  --foreground: #fafaf9; /* Equivale a stone-50 */
  /* ... */
}
```

## 4. Posibles Clases No Utilizadas
Con Tailwind CSS v4, el compilador detecta de manera estática qué utilidades se emplean en el código (JIT incorporado) y **únicamente empaqueta el CSS final con las clases que realmente se utilizan**.
Por lo tanto:
- **En el Bundle Final (Producción)**: No existen clases CSS "muertas" o no utilizadas que ralenticen el sitio, ya que el motor de Tailwind desecha automáticamente cualquier clase que no sea referenciada explícitamente.
- **En el Código Fuente (TSX/JSX)**: Es muy probable que existan clases "redundantes" o "sobreescritas" en los componentes, en donde un componente recibe múltiples utilidades de una misma categoría (ej. `p-4 p-6`) pero solo se aplica la última. 
  - Para auditar, limpiar estas clases redundantes en los archivos y garantizar el orden, se aconseja instalar `eslint-plugin-tailwindcss` y configurar las reglas de corrección automática (`tailwindcss/no-contradicting-classname`).

## Conclusiones
El proyecto tiene una base de estilos robusta y aprovecha lo más moderno de Tailwind (v4), pero **necesita urgentemente una refactorización de su estrategia de theming (modo oscuro)**. Al adoptar un enfoque basado íntegramente en **Design Tokens (Variables CSS)** redefinidas por tema en lugar de la inyección manual repetitiva de modificadores `dark:`, se reducirá drásticamente el tamaño del código fuente HTML/JSX, facilitará su mantenimiento a futuro y se garantizará una experiencia visual consistente al alternar entre modos claro y oscuro.

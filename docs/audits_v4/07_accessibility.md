# Reporte de Accesibilidad (a11y) - Atelier Óptica

**Fecha:** 15 de Junio de 2026
**Objetivo:** Evaluar el estado de la accesibilidad (a11y), uso de atributos ARIA y navegación por teclado en la aplicación Next.js.

## 1. Introducción y Metodología
Se ha realizado un análisis estático del código fuente dentro del directorio `src/`, evaluando las configuraciones de linters, la estructura semántica de HTML y las interacciones de los componentes con el DOM. Se analizaron específicamente las reglas de accesibilidad de React (vía `jsx-a11y`) y el uso de atributos como `tabIndex`, `aria-*` y etiquetas `<label>`.

---

## 2. Hallazgos Principales

### ⚠️ Reglas de ESLint Desactivadas
Uno de los hallazgos más críticos es que las principales reglas de validación de accesibilidad están **explícitamente desactivadas** en el archivo `eslint.config.mjs`:
```js
"jsx-a11y/alt-text": "off",
"jsx-a11y/click-events-have-key-events": "off",
"jsx-a11y/interactive-supports-focus": "off",
"jsx-a11y/no-static-element-interactions": "off"
```
Al habilitar estas reglas temporalmente, el linter arroja **decenas de errores críticos** de accesibilidad (e.g., 46 errores de `click-events-have-key-events` y 43 de `no-static-element-interactions`).

---

## 3. Elementos Interactivos y Navegación por Teclado

### Problema: `onClick` en elementos estáticos
Existen más de 40 instancias donde se aplican eventos `onClick` directamente a elementos como `<div>` o `<span>` que actúan como botones interactivos (por ejemplo, en modales o listas), pero **carecen de roles semánticos** (`role="button"`) y de **gestión de foco** (`tabIndex={0}`).

**Ejemplo encontrado (`src/app/admin/whatsapp/page.tsx`):**
```tsx
<div className="flex items-center justify-between p-3 cursor-pointer" onClick={() => setEditingTag(t)}>
```
*Impacto:* Los usuarios que navegan con teclado no pueden hacer foco (Tab) en estos elementos ni interactuar con ellos presionando `Enter` o `Espacio`. 

### Foco y Modales (Focus Trapping)
El uso de `.focus()` en toda la aplicación es casi inexistente (sólo 6 llamadas, principalmente para inicializar campos de chat). Los múltiples modales de la aplicación no capturan el foco (focus trap) al abrirse ni lo devuelven al elemento disparador al cerrarse, lo cual desorienta completamente a usuarios de lectores de pantalla.

---

## 4. Formularios y Etiquetas (`<label>`)

### Problema: Desvinculación de Labels e Inputs
Existen alrededor de **246 etiquetas `<label>`** en el código, pero **solo 3 utilizan el atributo `htmlFor`**.
Además, en la mayoría de los formularios (ej. `src/app/contacto/page.tsx`), las etiquetas no envuelven a los `<input>` correspondientes, ni los vinculan mediante un ID.

**Ejemplo del problema:**
```tsx
<div>
  <label className="block text-[12px] font-medium text-stone-500 mb-1">Nombre completo</label>
  <input type="text" placeholder="Ej: María Pérez" required />
</div>
```
*Impacto:* Los lectores de pantalla no anuncian de qué trata el campo de texto cuando el usuario ingresa al `<input>`, dificultando gravemente el llenado de formularios para personas con discapacidad visual.

---

## 5. Uso de Atributos ARIA

El uso de atributos `aria-*` es **excesivamente bajo para el tamaño de la aplicación** (solo se detectaron 11 instancias en todo el directorio `src/`).
- Faltan `aria-expanded` en componentes desplegables (como dropdowns y menús móviles).
- Faltan `aria-hidden="true"` en iconos decorativos (e.g., `<ImageIcon />` de *lucide-react*).
- Faltan `aria-live="polite"` o `role="alert"` para notificaciones tipo Toast (como `LeadToastNotifications.tsx`).

---

## 6. Puntos Positivos

- **Imágenes (`alt` text):** El uso del componente `<Image>` de Next.js está muy extendido y en la enorme mayoría de los casos se provee un atributo `alt` descriptivo. No se detectaron imágenes críticas con atributos `alt` vacíos sin intención.
- **Semántica HTML:** La aplicación hace un uso respetable de etiquetas semánticas. Se encontraron más de 100 usos de etiquetas como `<main>`, `<header>`, `<footer>` y `<nav>`, lo que ayuda a definir las "landmarks" o regiones clave de las páginas para lectores de pantalla.

---

## 7. Plan de Acción y Recomendaciones

1. **Vincular Etiquetas y Formularios (Prioridad Alta):**
   - Modificar todos los `<label>` agregando `htmlFor="id-del-input"` o envolver el input directamente con el `<label>`.

2. **Corregir Elementos Interactivos Estáticos (Prioridad Alta):**
   - Reemplazar `<div onClick={...}>` por `<button type="button" onClick={...}>`. Si debe ser un `div` por motivos de diseño, agregar `role="button"`, `tabIndex={0}` y capturar los eventos `onKeyDown` para teclas Enter y Espacio.

3. **Rehabilitar reglas de ESLint (Prioridad Media):**
   - Remover las excepciones de accesibilidad en `eslint.config.mjs` y tratar los errores como "warnings" al principio, hasta ir resolviéndolos progresivamente.

4. **Gestión de Foco en Modales (Prioridad Media):**
   - Implementar librerías como `react-focus-lock` o usar componentes base accesibles (como Radix UI o Headless UI) que manejen el *Focus Trapping* nativamente.
   
5. **Incorporar ARIA (Prioridad Media):**
   - Añadir `aria-hidden="true"` a los iconos decorativos.
   - Usar `aria-expanded` en menús colapsables.

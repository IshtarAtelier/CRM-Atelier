# Reporte de Auditoría de Accesibilidad (a11y)

**Fecha:** 15 de Junio de 2026
**Proyecto:** CRM-Atelier

## Resumen Ejecutivo

Esta auditoría de accesibilidad fue realizada analizando el código base estático de la aplicación CRM-Atelier. Se revisaron patrones de marcado, estilos de clases (Tailwind), manejo de teclado y semántica de componentes de React/Next.js en el directorio `src/`.

El sitio presenta oportunidades críticas de mejora para cumplir con las Pautas de Accesibilidad para el Contenido Web (WCAG 2.1 AA). Los problemas principales recaen en el contraste de colores y legibilidad de textos, navegación por teclado limitante en algunos componentes y uso insuficiente de etiquetas alternativas en imágenes.

---

## 1. Uso de ARIA (Accessible Rich Internet Applications)

### Hallazgos
* **Positivo:** Se ha integrado el uso de atributos ARIA en componentes estructurales clave (por ejemplo, `aria-label` en barras de búsqueda, modales y botones de WhatsApp; `aria-expanded` para menús desplegables o FAQs; y `aria-modal="true"` en la creación de diálogos).
* **Áreas de mejora:** 
  * Los atributos ARIA no están presentes de manera estandarizada en todos los componentes personalizados que actúan como interactivos. 
  * Hay botones hechos a medida (tabs, configuradores) que carecen de los roles (`role="button"`) y estados (e.g., `aria-selected` o `aria-pressed`) correspondientes.

---

## 2. Navegación por Teclado

### Hallazgos Críticos
* **Elementos interactivos no semánticos:** Se detectaron más de 20 instancias donde se utilizan eventos `onClick` en elementos no semánticos como `<div>`, `<span>`, o `<p>`. Estos elementos no reciben el foco del teclado al presionar la tecla `Tab`.
  * *Ejemplo:* `<span className="cursor-pointer" onClick={...}>` en tablas de facturación o tarjetas de clientes (`admin/facturacion/page.tsx`, `admin/whatsapp/page.tsx`).
  * *Solución recomendada:* Reemplazar con botones semánticos `<button>` o añadir `role="button"`, `tabIndex={0}` y un manejador `onKeyDown` o `onKeyUp` (para activar la acción con Enter/Espacio).
* **Indicadores de Foco ocultos:** Existen 22 instancias donde se ha utilizado la clase `focus:outline-none` de Tailwind CSS sin un equivalente visual alternativo de foco activo (como `focus:ring`, `focus:border`, o un cambio notorio de fondo). Esto hace que sea casi imposible para un usuario que navega por teclado saber dónde se encuentra en la pantalla.
* **Skip Links:** No se detectaron enlaces de "Salto al contenido principal" (Skip to main content) para ayudar a los usuarios de lectores de pantalla o de teclado a saltar la navegación repetitiva de la cabecera.

---

## 3. Contraste de Colores y Legibilidad

### Hallazgos Críticos
* **Bajo contraste de texto:** Hay un uso extendido de textos de colores claros sobre fondos claros, como `text-stone-300`, `text-stone-400` o `text-gray-400` en etiquetas, notas, subtítulos y comprobantes. Estos colores frente al blanco o fondos muy claros resultan en un **ratio de contraste inferior al 4.5:1** requerido por WCAG AA.
* **Tamaños de fuente minúsculos:** Se ha detectado un patrón generalizado del uso de clases de texto extremadamente pequeñas como `text-[9px]` y `text-[10px]` (presentes en componentes como `QuickQuote.tsx`, `DoctorCommissions.tsx` e `InvoiceModal.tsx`).
  * *Impacto:* Estos tamaños son inaccesibles y muy difíciles de leer para una gran porción de usuarios, especialmente aquellos con visibilidad reducida o en dispositivos móviles. El tamaño mínimo recomendado por estándares de web es típicamente de `12px` (y `16px` para cuerpos de texto).

---

## 4. Imágenes y Multimedia

### Hallazgos
* **Atributo `alt` ausente:** Se han encontrado múltiples etiquetas `<img>` en la aplicación y paneles de administración (`admin/web/page.tsx`, `admin/inventario/page.tsx`, detalles de recetas o pedidos) que **no poseen el atributo `alt`**.
  * *Solución recomendada:* Todas las imágenes deben tener un atributo `alt`. Si la imagen es puramente decorativa, debe incluirse un `alt=""` vacío para que los lectores de pantalla la ignoren correctamente; de lo contrario, debe proveer una descripción significativa.

---

## 5. Estructura y Formularios

### Hallazgos
* **Asociación de Etiquetas de Formulario:** En varios componentes, existen elementos `<label>` visuales para `input`s que carecen del atributo `htmlFor` apuntando al `id` del input. Esto evita que los lectores de pantalla asocien correctamente la descripción al campo de formulario, y también impide que hacer clic en la etiqueta enfoque el input.

---

## Recomendaciones a Corto Plazo
1. **Reemplazar `focus:outline-none`** con clases que provean foco visual (e.g., `focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none`).
2. **Aumentar el tamaño de fuente** a por lo menos `text-xs` (12px) y reemplazar colores `stone-300`/`stone-400` por tonos que pasen el chequeo de contraste, como `stone-500` o `stone-600` en fondos claros.
3. **Auditar e inyectar atributos `alt`** en todas las imágenes renderizadas, o `alt=""` en su defecto.
4. **Convertir elementos `<div onClick>` y `<span onClick>` en botones `<button type="button">`** para heredar soporte nativo de teclado y lectores de pantalla.

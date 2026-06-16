# Auditoría de Componentes UI: Duplicación y Arquitectura

## 1. Resumen Ejecutivo
Se realizó una auditoría profunda sobre el directorio `src/components`, identificando problemas severos de **falta de abstracción**, **duplicación de código** y **mala separación de responsabilidades**. La arquitectura actual promueve la creación de componentes monolíticos y la repetición constante de estilos a través de Tailwind, lo cual penaliza la mantenibilidad y escalabilidad del proyecto.

---

## 2. Hallazgos Principales

### A. Falta de Componentes Base (UI Primitives)
El proyecto no cuenta con una librería sólida de componentes base (botones, inputs, selects, tarjetas).
- **El Problema:** En lugar de utilizar componentes reutilizables (ej: `<Button>`, `<Input>`), el equipo utiliza etiquetas HTML nativas repetidas a lo largo de docenas de archivos, junto con las mismas clases de Tailwind. Se detectaron más de 120 botones e infinidad de inputs repitiendo bloques masivos de estilo (ej. `className="w-full px-4 py-4 bg-white dark:bg-stone-800 border-2 rounded-2xl..."`).
- **Impacto:** Si en el futuro se desea cambiar el radio de los bordes o el color de foco de los inputs en toda la app, el cambio deberá realizarse de forma manual en decenas de archivos.

### B. Duplicación de Esfuerzos y Lógica Paralela
Se descubrieron abstracciones parciales o paralelas que realizan la misma función visual y de negocio:
- **Modales Reinventados:** Existen componentes como `CheckoutModal.tsx` y `AddPaymentModal.tsx` que reimplementan todo el contenedor visual del modal (fondos translúcidos, `z-index`, animaciones y estructura `fixed`) en lugar de reutilizar o extender el componente `src/components/ui/Modal.tsx` ya existente.
- **Formularios de Checkout Divididos vs. Monolíticos:** El proyecto cuenta con una abstracción modular en `src/components/checkout/` (`CheckoutContactForm.tsx`, `CheckoutPaymentOptions.tsx`, `CheckoutShippingForm.tsx`) empleada en el **Storefront**. Sin embargo, la sección del CRM / Cotizador utiliza `src/components/quotes/CheckoutModal.tsx` (un monolito de más de 400 líneas) que reimplementa estas pantallas sin compartir piezas con el Storefront.
- **Items de Lista (Line Items):** `CartLineItems.tsx` y `QuoteLineItems.tsx` hacen tareas de renderizado extremadamente similares, pero no consumen un componente genérico tipo `LineItemRow`.

### C. Mala Separación de Responsabilidades (Archivos Monolíticos)
Muchos componentes han evolucionado hasta convertirse en "God Objects" (Archivos Monolíticos Gigantes), superando las 600 - 1000 líneas de código. Esto ocurre porque mezclan UI compleja, llamadas a la API y gestión masiva de estado interno.
- **`ProductForm.tsx` (1004 líneas, ~75KB):** Maneja dentro de un solo archivo la lógica de carga individual de productos, la carga masiva (bulk upload via CSV), el parseo de datos, múltiples pasos del wizard y validación.
- **`QuoteSummary.tsx` (787 líneas, ~52KB):** Combina el motor de cálculo de precios, evaluación de reglas promocionales complejas (ej. 2x1) y el maquetado visual de todo el resumen.
- **`LensConfigurator.tsx` (652 líneas) y `PrescriptionManager.tsx` (645 líneas):** Son componentes masivos que necesitan extracción urgente a custom hooks o separación en subcomponentes por dominio funcional.

---

## 3. Plan de Acción Recomendado

1. **Creación de un Sistema de Diseño Interno:** Crear la carpeta `src/components/ui` con `Button.tsx`, `Input.tsx`, `Card.tsx`, `Badge.tsx`, etc. Luego, hacer refactor progresivo a lo largo de la app para implementarlos.
2. **Desacoplar Lógica de Presentación (Custom Hooks):** Abstraer lógica de estado y cálculo de `ProductForm.tsx` y `QuoteSummary.tsx` en hooks dedicados, como `useProductFormManager()` o `useQuoteCalculator()`.
3. **Consolidar Modulares:** Unificar las pantallas de checkout del CRM y el Storefront bajo un único sistema de pasos compartiendo formularios base. Eliminar la reinvención manual de los modales en favor de `src/components/ui/Modal.tsx`.

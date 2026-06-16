# Auditoría de Flujo E-commerce: Carrito y Checkout

**Fecha:** 15 de Junio de 2026
**Componentes Analizados:** `useCart.ts`, `CartSidebar.tsx`, `LensConfigurator.tsx`, `checkout/page.tsx` y subcomponentes de checkout.

## 1. Estado Global del Carrito (`useCart.ts`)
- **Tecnología:** Utiliza Zustand junto con el middleware `persist` para mantener el estado del carrito en el `localStorage` (`atelier-cart-storage`).
- **Estructura de Datos:** Cada ítem en el carrito almacena el producto base y opciones de personalización (configuración de lentes: `lensConfig`, color, precio base y precio con adicionales).
- **Tracking:** Se integra correctamente el evento `trackAddToCart` para fines analíticos en el momento en que se añade un ítem.

## 2. Configuración de Lentes (`LensConfigurator.tsx`)
- **Lógica de Flujo:** Presenta una interfaz de paso a paso, dividiendo dinámicamente la experiencia en dos vertientes:
  - **CLEAR (Anteojos Recetados):** Elección de Visión (Monofocal, Bifocal, Multifocal, Solo armazón) y Calidad de Cristal (Orgánico Blanco, AR, Blue, Policarbonato, Fotocromático, Smart Free, Varilux, etc).
  - **SUN (Anteojos de Sol):** Elección de Color del Tinte, Estilo (Compacto, Degradé, Muestra), y la opción de añadir aumento sobre lentes blancos que luego serán teñidos.
- **Precios Dinámicos:** Obtiene los valores de los cristales desde el endpoint `/api/web/pricing`, utilizando valores por defecto como fallback en caso de error.
- **Receta:** Permite la carga de un archivo (imagen o PDF) o postergar la entrega mediante un checkbox ("Enviar por WhatsApp luego").

## 3. Sidebar del Carrito (`CartSidebar.tsx`)
- **Interfaz:** Panel lateral animado con `framer-motion` que muestra todos los artículos del carrito.
- **Funcionalidad:** Permite modificar cantidades, eliminar ítems, ver las configuraciones de los lentes seleccionados y proporciona un acceso rápido al `LensConfigurator` para aquellos armazones que aún no tienen cristales configurados.

## 4. Página de Checkout (`checkout/page.tsx`)
- **Gestión de Sesiones:** Sincroniza datos temporalmente mediante llamadas a `/api/checkout/session` (con *debounce* de 2 segundos) y guarda el avance localmente (`atelier-checkout-form`) para recuperar el formulario si el usuario refresca.
- **Formulario de Contacto (`CheckoutContactForm`):** Captura información personal estándar e implementa validaciones básicas en los inputs (ej. DNI/CUIL, WhatsApp).
- **Formulario de Envío (`CheckoutShippingForm`):** 
  - Ajusta inteligentemente las opciones según la ciudad. Si detecta "Córdoba" o "Carlos Paz", añade la opción de envío gratuito local ("Cadetería Local Express").
  - Integrado con las opciones de envío nacional por Correo Argentino (Sucursal y Domicilio).
- **Opciones de Pago (`CheckoutPaymentOptions`):**
  - **Tarjetas:** Carga de manera asíncrona la librería `Decidir.js`. Permite ingresar los datos de tarjeta, realiza la validación y crea un token (`createToken`) para no enviar datos de tarjetas crudos al backend, siguiendo las buenas prácticas de seguridad y cifrado.
  - **Transferencia:** Gestiona el descuento dinámicamente según la configuración de la tienda (promociones obtenidas de `/api/settings`, típicamente 15% OFF).
- **Resumen Lateral (`CheckoutSummarySidebar`):** Calcula subtotales, totales y descuentos aplicados en tiempo real.

## 5. Conclusiones y Observaciones
- El ecosistema del e-commerce está excepcionalmente bien estructurado, separando claramente las responsabilidades en componentes independientes.
- La experiencia de configuración de cristales es robusta y muy completa.
- La integración de la pasarela de pagos cumple con las normas de seguridad al utilizar tokenización.
- **Punto de Mejora Menor:** El guardado del formulario en el `localStorage` en `checkout/page.tsx` utiliza JSON.parse sin una validación estricta del esquema, lo cual no es crítico, pero podría ser propenso a errores si el formato en cache cambia en versiones futuras.

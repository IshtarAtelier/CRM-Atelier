# Auditoría del Flujo de E-commerce y Checkout

**Fecha:** 15 de Junio de 2026
**Objetivo:** Revisión del flujo completo de E-commerce, desde la selección de productos (Armá tus Lentes), el carrito de compras, el proceso de checkout y la integración con la pasarela de pagos.

---

## 1. Experiencia de Compra y "Armá tus lentes"
**URL Principal:** `/arma-tus-lentes`
**Componentes Clave:** `CustomGlassesBuilder.tsx`, `LensConfigurator.tsx`

- **Visualización de Productos:** La página carga los productos web activos (`WebProduct`) con categoría "Receta" y stock disponible. Utiliza un componente de 3D (`Interactive3DImage`) para previsualizar los armazones de forma dinámica y atractiva.
- **Configurador a Medida (3 Pasos):**
  1. **Armazón:** Selección inicial con filtrado por marcas y búsqueda por modelo.
  2. **Cristales y Tratamientos:** Interfaz guiada en `LensConfigurator` donde el cliente elige si necesita cristales, el tipo de aumento (Monofocal, Multifocal, etc.), tratamientos adicionales (Antirreflex, Filtro Azul) y color de lente.
  3. **Receta:** Permite la carga del archivo de receta médica.
- Al finalizar, el costo del armazón base se suma al de los cristales seleccionados y el producto se añade al carrito.

## 2. Carrito de Compras
**Store Global:** `src/store/useCart.ts` (Zustand)
**Componente:** `CartSidebar.tsx`

- **Persistencia:** El carrito se guarda en `localStorage` (bajo la clave `atelier-cart-storage`) para que el usuario no pierda su progreso al recargar.
- **Visualización (Sidebar):** Se despliega un panel lateral derecho donde se muestran los productos añadidos.
- **Funciones Soportadas:** 
  - Ajuste de cantidades (+/-).
  - Eliminación de productos.
  - Edición / Agregado posterior de cristales si el usuario agregó primero un armazón simple.
- **Seguimiento (Tracking):** Se ejecutan eventos analíticos (`trackAddToCart`) cuando se suma un ítem.
- **Promesas de Valor:** El carrito incluye distintivos de "Pago Seguro", "Envío Gratis" y "6 Cuotas" para incentivar el checkout.

## 3. Proceso de Checkout
**URL:** `/checkout`
**Componentes Clave:** `CheckoutContactForm`, `CheckoutShippingForm`, `CheckoutPaymentOptions`, `CheckoutSummarySidebar`

El proceso está condensado en una sola página fluida (One-Page Checkout) que mejora la conversión:

1. **Datos de Contacto:** Solicita Email, Nombre, Apellido, DNI y Teléfono.
2. **Método de Envío:**
   - Detecta automáticamente si la ciudad ingresada es local (Córdoba Capital, Carlos Paz) y preselecciona/habilita "Cadetería Local".
   - Si no es local, ofrece envío a domicilio o a sucursal vía Correo Argentino.
3. **Métodos de Pago:**
   - **Transferencia Bancaria:** Aplica un descuento automático (por ej. 15%) configurable desde los ajustes del sistema.
   - **Tarjeta de Crédito / Débito (Payway):** Utiliza el SDK de **Decidir v2** de Payway para tokenizar la tarjeta de manera segura en el lado del cliente (Frontend). Solicita Número, Vencimiento, CVC y Nombre en la tarjeta.
4. **Carritos Abandonados:**
   - Mientras el usuario rellena el formulario, el sistema realiza *debouncing* (cada 2 segundos) y guarda silenciosamente el progreso en la base de datos (`/api/checkout/session`). 
   - Esto permite recuperar la sesión más tarde o activar campañas de email para carritos abandonados.

## 4. Pasarela de Pagos (Backend)
**Endpoint:** `/api/checkout/payway/route.ts`

El backend unifica el procesamiento de la venta independientemente de si es transferencia o tarjeta:

1. **Gestión de Contacto:** Identifica si el cliente ya existe en el CRM (buscando por DNI, teléfono o email). Si no existe, crea una nueva ficha en `ContactService`.
2. **Creación de la Orden (CRM):** 
   - Crea un registro de tipo `Order` asignado a un administrador del sistema.
   - La información de los cristales seleccionados a medida se guarda estructurada en el campo JSON `prismVal`.
   - Genera notas internas sobre la logística y la dirección.
3. **Notificaciones Automáticas:**
   - **Al Cliente:** Se envía un email con el resumen de la compra, detalle del método de envío elegido y tiempos estimados (5 días hábiles si tiene cristales a medida, 2 días si es solo armazón).
   - **A los Administradores:** Se dispara un email de alerta de nueva venta web, con los datos de contacto, facturación, productos y un recordatorio para revisar el CRM.
4. **Lógica de Pagos:**
   - **Transferencia:** El flujo se corta aquí devolviendo éxito, la orden queda en estado `WEB_PENDING` esperando validación manual del comprobante.
   - **Payway (Tarjetas):** 
     - Recibe el `paymentToken` y el `BIN` generados en el Frontend por Decidir.
     - Determina la franquicia (Visa, Mastercard, Amex) basado en el BIN.
     - Llama a la API server-to-server de Decidir (`/api/v2/payments`) con las llaves privadas (`PAYWAY_PRIVATE_KEY`).
     - Si es aprobado, la orden pasa a estado `PAID`.
     - Si es rechazado, la orden pasa a estado `CANCELED` y se registra el motivo del rechazo en `labNotes` del CRM.
5. **Control de Stock:** El sistema realiza un decremento atómico del stock directamente en la tabla `Product` para los ítems comprados (ignorando el pseudo-producto "Cristal").

## Conclusión y Recomendaciones
El flujo está bien estructurado, es persistente y profesional. La integración nativa de un configurador de lentes recetados dentro del flujo del carrito marca una ventaja competitiva grande.

**Puntos fuertes detectados:**
- Guardado asincrónico para recuperar "Carritos abandonados".
- Descuento automático por transferencia en el Total.
- Unificación de clientes y ventas web directamente dentro del sistema CRM principal.
- Tokenización segura en el Frontend (no se almacenan datos sensibles de tarjeta en los servidores).

**Sugerencias Menores:**
- Verificar que el descuento por transferencia aplicado en el Frontend (checkout summary) sea exactamente el mismo validado en el Backend (actualmente en el Backend es un *hardcode* del 15%: `total * 0.85`), idealmente debería consumir el valor de `web_promo_cash_discount` global para evitar discordancias.
- Considerar agregar logs adicionales cuando la API de Decidir devuelve errores por si necesitan ayudar a clientes con tarjetas declinadas repetidamente.

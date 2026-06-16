# Auditoría de Flujo E-commerce, Carrito y Checkout

## 1. Introducción
Este reporte analiza el flujo completo de E-commerce de la aplicación Atelier Óptica. Se revisaron los procesos desde la navegación en la tienda, el agregado al carrito, hasta la concreción de la venta en el proceso de checkout y el impacto en la base de datos y pasarelas de pago.

---

## 2. Flujo de Navegación y Tienda (`/tienda` y `/producto/[slug]`)
### Catálogo y Filtros (`TiendaClient`)
- **Estructura y UI:** La tienda presenta un catálogo de armazones y otros productos categorizados (Receta, Sol, XL, Clip-On, Contacto). Utiliza transiciones fluidas con `framer-motion`.
- **Precios dinámicos:** Muestra en tiempo real tanto el precio normal (con opción de cuotas) como el precio con descuento aplicable para pago en efectivo o transferencia (configurado vía `web_promo_cash_discount`).
- **Escasez y Urgencia:** Incluye validación de inventario (`stock <= 3`) que muestra dinámicamente un *badge* de urgencia ("Últimas X unidades").
- **Product Client:** La vista de producto detallada permite ver galerías de fotos y agregar un ítem al carrito. En este paso inicial, el producto se agrega por defecto "sin cristales configurados" (estado inicial del `lensConfig` como "NONE").

---

## 3. Carrito de Compras (`CartSidebar` y `useCart`)
### Estado y Persistencia
- **Gestión de Estado:** Todo el manejo del carrito se realiza mediante **Zustand** (`store/useCart.ts`).
- **Persistencia:** Está envuelto en un *middleware* de `persist`, que guarda de forma transparente el estado del carrito en `localStorage` (`atelier-cart-storage`), permitiendo que el usuario retome su carrito entre sesiones.
- **Eventos:** Incluye de forma nativa tracking behavior (`trackAddToCart`) que conecta con los píxeles/analytics definidos en el sistema.

### Interfaz del Carrito (`CartSidebar`)
- **Funcionalidades Core:** Muestra un resumen de los ítems con sus configuraciones de cristales, permitiendo alterar cantidades o eliminar artículos.
- **Configurador de Cristales (`LensConfigurator`):**
  - Esta es una de las piezas más complejas del carrito. Permite a un usuario abrir un modal para añadir cristales (monofocales, bifocales, multifocales) y tratamientos (antirreflex, filtro azul, fotocromáticos, tintes de sol) a su armazón o lente base.
  - Guarda dicha configuración dentro de cada `CartItem` (en el atributo `lensConfig`), modificando su `price` total según corresponda.

---

## 4. Flujo de Checkout (`/checkout`)
El proceso de Checkout es un formulario en una sola vista, optimizado para conversión, separado en 3 pilares lógicos: **Contacto, Envío y Pago**.

### 4.1 UI y Frontend
- **Autoguardado y Sesión:**
  - Persiste cada entrada del usuario en `localStorage` (`atelier-checkout-form`) a medida que escribe, y envía *ping* debounced a `/api/checkout/session` (que maneja métricas de abandono de carrito).
- **Lógica Condicional por Región:**
  - Identifica si el cliente reside en Córdoba/Carlos Paz para ofrecer automáticamente "Cadetería Local". De lo contrario, prioriza el envío por "Correo Argentino".
- **Tracking:** Ejecuta los eventos `trackInitiateCheckout` al montar la vista con ítems, y `trackPurchase` si se finaliza la orden correctamente.

### 4.2 Métodos de Pago Integrados
- **Transferencia Bancaria (`TRANSFER`):**
  - Aplica un descuento configurado en la plataforma (`cashDiscountRate`).
  - Termina la operación asincrónicamente y le brinda un mensaje de "Pendiente" al usuario en la vista de éxito.
- **Tarjeta (Payway / Decidir):**
  - Carga el SDK de **Decidir** dependiendo del entorno (producción vs developer).
  - Captura datos de tarjeta, emite el `createToken` desde el navegador (para seguridad PCI DSS) y envía sólo el Token y BIN al backend (`/api/checkout/payway`).

---

## 5. API y Lógica de Backend (`/api/checkout/payway/route.ts`)
La ruta del backend es extremadamente robusta y cuenta con sólidas validaciones antes de impactar en el CRM.

1. **Recálculo de Precios por Seguridad:**
   - La API no confía ciegamente en el total enviado por el frontend. Recolecta de la DB cada armazón y utiliza el mapping interno de cristales (`CrystalMapping`) para calcular el precio exacto final en base a la configuración que el usuario solicitó.
   - Si la discrepancia entre el frontend y el backend es mayor a $5 ARS, rechaza la transacción inmediatamente.
2. **Creación/Actualización del Cliente (`ContactService`):**
   - Normaliza el número de teléfono con formato argentino.
   - Crea un contacto en el CRM o, si hay duplicados, intenta actualizar su dirección y setear `contactSource = "WEB_STOREFRONT"`.
3. **Manejo Estricto de Stock (Race Conditions):**
   - Antes de procesar el cobro, la API decremente el stock temporalmente.
   - Si el cobro falla (tarjeta rechazada) o hay otro error posterior, se dispara la función `restoreStock()` que restaura las cantidades reservadas.
4. **Separación de Items (Desglose OD/OI):**
   - Al crear la ficha (Order) en el CRM, el backend desglosa el cristal personalizado de manera que los ópticos vean: el armazón por un lado, y el cristal del Ojo Derecho (OD) y Ojo Izquierdo (OI) de forma independiente, separando el costo equitativamente.
5. **Transacción con Prisma (Seguridad):**
   - Si se cobra la tarjeta, se utiliza `prisma.$transaction` para asegurar que el registro de Pago, la actualización de estado a `PAID` y la solicitud de facturación (`INVOICE_REQUEST`) se creen como una unidad atómica.
6. **Notificaciones y Alertas:**
   - Envía un email al cliente con el resumen de su compra (`sendEmail`).
   - Envía un email de "Alerta de Venta" a los administradores para que revisen el CRM de forma inmediata.

---

## 6. Conclusión y Hallazgos
El flujo de e-commerce implementado posee un estándar de alta calidad, robustez de cálculos en el lado del servidor para prevenir ataques o inyecciones de precios falsos, persistencia local para optimización de UX, y un manejo transaccional seguro con la base de datos y la pasarela de pago (Payway).

**Aspectos Positivos Destacados:**
- Manejo impecable de inventario (reservas y devoluciones automáticas ante fallos).
- Seguridad PCI delegada mediante tokens desde el frontend con Decidir.
- Desglose inteligente de cristales a nivel backend para su correcta visualización en el CRM.

**Puntos a tener en cuenta para el futuro:**
- Podría evaluarse el manejo de fallos por red durante el `restoreStock`, asegurándose que, si el propio restore falla (ej: la DB se cae en ese instante), quede algún log de stock inconsistente para intervención manual. 
- La pasarela Payway está hardcodeada a usar el método de Decidir, lo que requeriría refactorizar ligeramente la interfaz si se desea implementar un patrón *Strategy* para admitir MercadoPago o MODO en el futuro.

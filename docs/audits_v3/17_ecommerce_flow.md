# Auditoría del Flujo E-commerce (Carrito y Checkout)

Fecha: 15 de Junio, 2026

## 1. Carrito de Compras (`useCart.ts`)
El carrito de compras está implementado utilizando `zustand` con el middleware de `persist` para mantener los datos en el `localStorage` bajo la clave `atelier-cart-storage`.

**Puntos Fuertes:**
- **Estado Global Persistente:** Los usuarios no pierden su carrito al recargar la página o volver días después.
- **Manejo de Variantes y Cristales:** Soporta configuraciones de lentes complejas (`lensConfig`), lo cual es crucial para el modelo de negocio de una óptica (tipo de cristal, tratamiento, tinte).
- **Control Inteligente de Cantidades:** Si se agrega el mismo producto exacto (misma configuración de lentes y tratamientos), el sistema incrementa la cantidad en lugar de duplicar la línea en el carrito.
- **Tracking Automático:** Integra llamadas directas a `trackAddToCart` (Facebook Pixel y Google Analytics) al momento de agregar ítems, facilitando campañas de retargeting.

## 2. Flujo del Checkout (`src/app/checkout/page.tsx`)
La página principal de checkout presenta un diseño claro dividido en un formulario de 3 pasos (Contacto, Envío, Pago) y una barra lateral estática con el resumen.

**Puntos Fuertes:**
- **Prevención de Errores de Hidratación:** Utiliza el patrón `mounted` de React para evitar desajustes de hidratación entre SSR y el estado persistido del carrito en cliente.
- **Seguimiento de Sesiones (Abandoned Carts):** Sincroniza datos incompletos del formulario con el backend de manera silente (debounced a 2 segundos hacia `/api/checkout/session`). Esto permite crear potentes flujos de recuperación de carritos abandonados.
- **Logística Dinámica:** Detecta automáticamente si la ciudad ingresada corresponde a "Córdoba" o "Carlos Paz" (`isLocalCity`) para ofrecer instantáneamente Envío Local (Cadetería) o por Correo Argentino.
- **Persistencia de Formulario Local:** Guarda los datos de contacto y envío en `localStorage` (`atelier-checkout-form`) para prevenir pérdida de datos ante una recarga accidental. Excluye cuidadosamente los datos sensibles de la tarjeta de crédito.

## 3. Seguridad y Procesamiento en Backend (`/api/checkout/payway/route.ts`)
El endpoint principal es responsable de procesar la compra final, manejar la pasarela Payway y registrar ventas por Transferencia.

**Puntos Fuertes:**
- **Revalidación Estricta de Precios (Seguridad Crítica):** Aunque el frontend envía un `total`, el backend desconfía y recalcula todo. Busca el precio actual del armazón en la base de datos y utiliza `CrystalMapping` para reconstruir el precio exacto de los cristales solicitados (Monofocales, Bifocales, Multifocales y Extras/Tintes). Si detecta una discrepancia mayor a $5 ARS, rechaza la transacción de inmediato para evitar manipulaciones (tampering) desde el navegador.
- **Manejo de Stock Seguro con Rollback:** Verifica el stock disponible de cada armazón antes de proceder. Realiza el descuento (`decrement`) y mantiene un array temporal. Si el pago con tarjeta en Payway declina por falta de fondos, o si ocurre un error inesperado, el backend ejecuta una función `restoreStock()` revirtiendo las unidades al inventario para no inmovilizar productos.
- **Desglose Estructural de Órdenes:** Al guardar los ítems en `prisma.order`, desglosa un pedido customizado en 3 líneas separadas de base de datos: Armazón, Cristal Ojo Derecho (OD), y Cristal Ojo Izquierdo (OI) dividiendo el precio a la mitad. Esto garantiza integración perfecta con el flujo de Laboratorio y Taller del CRM.
- **Deduplicación de Clientes:** Utiliza `ContactService.create` normalizando el teléfono argentino. Si el cliente ya existe, se atrapa la excepción de duplicado, se actualiza la dirección de envío del perfil existente y se anexa la orden sin ensuciar la base de datos con perfiles redundantes.

## 4. Oportunidades de Mejora / Observaciones

1. **Lógica Promocional (Ej: 2x1):** 
   El sistema actual de cotización del CRM (usado por vendedores) posee lógica avanzada de promociones 2x1 (`promo-utils.ts`). Sin embargo, el frontend Web y la ruta del checkout no parecen estar validando ni aplicando descuentos 2x1 de armazones automáticamente. De querer homologar las ofertas físicas con la web, se debería integrar esa misma lógica en el backend del Checkout Web.
2. **Condición de Carrera en Stock:**
   El decremento de inventario se realiza en el código como un simple `decrement: item.quantity`. En eventos de alto tráfico, si dos personas confirman el pago exactamente en el mismo milisegundo por la última unidad, podrían dejar el stock en número negativo (`-1`). Se recomienda migrar a un query transaccional más robusto: `update { data: decrement, where: { id, stock: { gte: quantity } } }`.
3. **Limpieza de Local Storage post-compra:**
   Actualmente tras una transacción exitosa se limpia el carrito y el ID de sesión, pero el almacenamiento temporal del formulario (`atelier-checkout-form`) permanece en el navegador. Idealmente debería ser purgado en el bloque de éxito.

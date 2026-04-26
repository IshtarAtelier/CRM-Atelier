# Evaluación y Reestructuración del Módulo de Reportes

Al analizar a fondo cómo está construido el módulo de reportes actualmente (`/api/reports/route.ts` y `/admin/reportes/page.tsx`), entiendo perfectamente por qué sientes que se está perdiendo el rumbo profesional y por qué el sistema falla silenciosamente en producción.

A continuación presento el diagnóstico real del problema y una propuesta de arquitectura digna de un CRM de alto nivel.

---

## 1. Diagnóstico: ¿Por qué falla y se siente "improvisado"?

### A. Cuello de Botella en el Servidor (El motivo de las fallas)
Actualmente, la API de reportes intenta descargar **todo el historial de ventas, clientes, items, productos y pagos** a la memoria del servidor (Node.js) para luego sumar todo con bucles `for`. 
* **Consecuencia:** A medida que el Atelier factura más, el servidor colapsa por falta de memoria o por superar el tiempo límite de respuesta (Timeout). Esto hace que el frontend reciba un error, oculte los datos y se quede "cargando" o en blanco.

### B. Confusión Financiera (Devengado vs Percibido)
El sistema actual mezcla conceptos financieros:
* Filtra las fechas usando el día en que se **creó el pedido** (`order.createdAt`), pero resta gastos fijos de meses enteros, y toma en cuenta comisiones de plataformas que quizás se pagaron en otro mes.
* Esto genera que los números de "Ganancia Neta" no reflejen la realidad de tu caja diaria ni de tu rentabilidad real.

### C. Interfaz Monolítica ("Todo en uno")
El reporte intenta mostrar en una sola pantalla: Estado de resultados, Rendimiento de Laboratorios, Top Clientes, Top Productos, Facturación AFIP, y Comisiones Médicas.
* **Consecuencia:** Es abrumador para el usuario, difícil de mantener en el código, y hace que cualquier mínimo error en (por ejemplo) un producto sin categoría, rompa toda la página de reportes.

---

## 2. Propuesta Arquitectónica (Hacia un CRM Profesional)

Para que el CRM sea una herramienta gerencial real, debemos dividir el módulo "Reportes" en **4 tableros independientes y especializados**, utilizando consultas SQL directas y sumatorias nativas de base de datos para garantizar velocidad instantánea.

### Tablero 1: 💰 Finanzas y Flujo de Caja (Cashflow)
*Único objetivo: Saber cuánta plata entró, cuánta salió y la rentabilidad.*
* **Ingresos Reales:** Basado estrictamente en la fecha en que el cliente realizó el **Pago** (Percibido), no en cuándo encargó el anteojo.
* **Estado de Resultados (P&L):**
  * Ingresos Netos.
  * *Menos* CMV (Costo de Mercadería Vendida: Cristales y Armazones).
  * *Menos* Gastos Operativos (Alquileres, sueldos extraídos de tu módulo de Gastos).
  * *Menos* Comisiones de Pasarelas (PayWay, Naranja, etc).
  * **EBITDA / Ganancia Neta.**
* **Métrica clave:** Ticket promedio de pagos y balance de caja.

### Tablero 2: 📈 Rendimiento Comercial y Laboratorios
*Único objetivo: Auditar la eficiencia de ventas y proveedores.*
* **Rendimiento de Cristales:** Rentabilidad por cada laboratorio (Katz, Novar, etc.).
* **Top Productos y Categorías:** Lo que más rota en el inventario.
* **Top Clientes:** Para fidelización corporativa o VIP.
* **Métrica clave:** Margen promedio por lente vendido.

### Tablero 3: 👨‍⚕️ Liquidaciones y Comisiones
*Único objetivo: Cuentas claras con terceros.*
* **Doctores:** Ventas derivadas, cálculo automático del 15% (o el valor estipulado) sobre el neto, y registro de pagos ya transferidos al doctor.
* **Vendedores / Asesores:** Rendimiento por cada integrante del equipo de Ishtar/Yani.

### Tablero 4: 🧾 Auditoría AFIP
*Único objetivo: Control fiscal.*
* Resumen de comprobantes emitidos, divisiones por cuentas de facturación, y alertas de facturas pendientes o montos en negro vs blanco.

---

## 3. Plan de Acción Técnico

Si estás de acuerdo con esta dirección profesional, los pasos exactos a programar son:

1. **Eliminar el monolito:** Deprecar la ruta pesada `/api/reports/route.ts` actual.
2. **Crear rutas de API separadas y optimizadas** (Ej: `/api/analytics/financial`, `/api/analytics/sales`) utilizando `prisma.payment.aggregate` para sumar directamente en la base de datos, garantizando tiempos de respuesta de milisegundos.
3. **Reconstruir la Interfaz (UI):** Crear un layout en `/admin/analytics` con pestañas laterales (Finanzas, Ventas, Comisiones) para no sobrecargar visualmente la pantalla.
4. **Desacoplar las constantes:** Mover todos los mapeos (nombres de métodos de pago, laboratorios, tipos de gasto) a la base de datos o a un archivo de configuración estricto para evitar errores de tipeo o nulos (`NaN`).

Esta reestructuración sentará bases sólidas. En lugar de emparchar un reporte que se cae, construiremos un módulo analítico corporativo. ¿Avanzamos con la creación de la estructura para los nuevos tableros (Finanzas y Comercial)?

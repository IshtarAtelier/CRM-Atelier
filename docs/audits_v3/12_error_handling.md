# Reporte de Manejo de Errores (Error Handling)

## 1. Frontend (Next.js & React)

### 1.1. Ausencia de Error Boundaries Globales
Durante la revisión del directorio `src/app`, se detectó la ausencia total de archivos `error.tsx` o `global-error.tsx`. Esto significa que Next.js no tiene un mecanismo para capturar y manejar errores de enrutamiento o renderizado a nivel de servidor/cliente de forma elegante. Cualquier error no manejado en un componente de servidor o cliente provocará que la aplicación muestre la pantalla de error por defecto (deseable en desarrollo, pero mala experiencia de usuario en producción).

### 1.2. Ausencia de React Error Boundaries
No se encontraron implementaciones del ciclo de vida `componentDidCatch` o `getDerivedStateFromError` en el directorio `src/components`. Si un componente falla silenciosamente o lanza una excepción durante el renderizado, puede "romper" (crash) toda la jerarquía de componentes y dejar una pantalla en blanco.

### 1.3. Manejo de Errores en Peticiones HTTP
Las peticiones al backend (ej. `fetch` en las páginas) se envuelven en bloques `try/catch`. 
* **Práctica actual**: El error suele enviarse a la consola del navegador (`console.error('Error fetching orders:', error);`).
* **Problema**: Frecuentemente, el estado de carga (`loading`) se resetea pero no se notifica al usuario final mediante alertas visuales (toasts o banners), provocando que el usuario desconozca que la acción falló.

---

## 2. Backend (Next.js API Routes & WA-Service)

### 2.1. API Routes de Next.js (`src/app/api`)
Existe un amplio uso de bloques `try/catch` (aproximadamente 173 instancias de `console.error` identificadas).
* **Práctica actual**: Las rutas capturan excepciones y devuelven respuestas HTTP 500:
  ```typescript
  return NextResponse.json({ error: 'Error al crear producto', details: error.message }, { status: 500 });
  ```
* **Riesgo**: Exponer `error.message` directamente hacia el cliente puede revelar detalles de la base de datos (Prisma), variables de entorno o estructura de los servidores. 

### 2.2. Microservicio de WhatsApp (`wa-service`)
Este microservicio en Node.js maneja errores de forma rudimentaria mediante múltiples bloques `try/catch`.
* **Uso de la Consola**: Toda la trazabilidad se realiza con `console.log` o `console.error`. No hay una librería de registro estructurado (como Winston o Pino) que permita niveles de log (INFO, WARN, ERROR) o que almacene los logs eficientemente.
* **Bloques "Mudos"**: Existen múltiples instancias de bloques `catch` vacíos donde el error simplemente es ignorado sin dejar rastro: `catch (e) { /* ignore */ }`. Esto dificulta enormemente la depuración y auditoría cuando ocurren problemas críticos.

---

## 3. Recomendaciones

1. **Implementar `error.tsx`**: Crear un archivo `error.tsx` en la raíz de `src/app` (y en subrutas críticas) para capturar fallos de renderizado y mostrar una interfaz de error amigable.
2. **Alertas Centralizadas HTTP**: Configurar un manejador global para las solicitudes (por ejemplo, creando un interceptor en `axios` o un custom hook de `fetch`) que se encargue de lanzar notificaciones Toast automáticamente al detectar respuestas `4xx` o `5xx`.
3. **Librería de Logging Backend**: Migrar el backend (tanto Next API como `wa-service`) hacia un logger estandarizado (ej. Pino). Esto permitirá tener logs en formato JSON, más fáciles de procesar y monitorear.
4. **Sanitización de Respuestas de Error**: En la API, asegurar que los mensajes de error técnicos internos no lleguen al frontend en producción. En su lugar, enviar un `errorId` y registrar los detalles internamente con ese ID.
5. **Eliminar Capturas Silenciosas (Swallowed Errors)**: Revisar `wa-service/index.js` y asegurarse de que todos los errores ignorados deliberadamente tengan, al menos, un log de advertencia en modo debug.

# Reporte de Auditoría: Arquitectura del Backend

**Fecha:** Junio 2026
**Proyecto:** CRM-Atelier

---

## 1. Resumen Ejecutivo
Se realizó una auditoría de la arquitectura del backend en el proyecto, que está construido sobre Next.js (App Router). El backend funciona mediante **Next.js API Routes (Route Handlers)** que actúan como controladores HTTP. La estructura general tiende hacia un patrón **Service-based** pero de forma inconsistente, con una marcada ausencia de Inyección de Dependencias (DI) formal. Se hace uso intensivo del ORM **Prisma** mediante acceso directo (Active Record / Data Mapper simplificado) en lugar del patrón Repository.

## 2. Arquitectura General (Next.js API Routes)
El proyecto utiliza las características server-side del App Router de Next.js. Las rutas API se ubican dentro de `src/app/api/.../route.ts`.
- **Estructura de Directorios:** Altamente segmentada por dominio (ej. `orders`, `products`, `auth`, `billing`, etc.).
- **Controladores HTTP:** Los archivos `route.ts` exponen métodos exportados (como `GET`, `POST`, `PATCH`, `DELETE`) que actúan como los controladores. Se encargan de validar la Request, verificar los headers, extraer parámetros y enviar respuestas mediante `NextResponse`.

## 3. Estructura de Controladores y Lógica de Negocio
Existen dos enfoques coexistentes en el código, revelando una arquitectura en transición o híbrida:

1. **Fat Controllers (Lógica en las Rutas):** 
   - Muchas de las operaciones, especialmente consultas complejas (GET con filtros) o creaciones iniciales (POST), manejan la lógica de negocio y las consultas de base de datos directamente dentro del archivo `route.ts`. 
   - *Ejemplo:* `src/app/api/orders/route.ts` posee toda la lógica de filtrado de Prisma, validación de variables, y cálculos de balance en el método GET, haciendo el controlador sumamente extenso ("Fat Controller").

2. **Capa de Servicios (Service Layer Pattern):**
   - Para ciertas entidades y operaciones CRUD, se ha delegado la lógica a la carpeta `src/services/` (ej. `OrderService`, `ProductService`, `PricingService`).
   - Los controladores entonces quedan limpios, actuando únicamente como un proxy. 
   - *Ejemplo:* `src/app/api/orders/[id]/route.ts` delega sus llamadas a `OrderService.getOrder`, `OrderService.updateOrder`, etc.

## 4. Inyección de Dependencias (DI) y Patrones Usados
**Ausencia de Inyección de Dependencias Formal.**
- No se utilizan contenedores de IoC (Inversion of Control) como TSyringe o NestJS-style DI.
- **Implementación de Servicios:** Los servicios están construidos como objetos literales con funciones o clases con métodos **estáticos** (`static async...`). 
- Las dependencias (como la conexión a la base de datos `prisma`, funciones de utilería, u otros servicios) son importadas globalmente mediante `import`.
- Esto genera un alto acoplamiento (High Coupling) ya que los servicios no pueden ser instanciados con dependencias simuladas (mocks) fácilmente durante el testing, dependendiendo del entorno global.

## 5. Capa de Acceso a Datos y Repositorios
- **ORM:** Se utiliza **Prisma ORM**.
- **Instancia Global:** Instanciado en `src/lib/db.ts` utilizando el patrón Singleton.
- **Patrón Repository:** No se utiliza. Las queries de la base de datos se hacen llamando directamente a `prisma.modelo` ya sea desde los servicios o desde los controladores. 

## 6. Autenticación y Middleware
- Se utiliza un esquema de autenticación propio y basado en JWT (JSON Web Tokens) gestionados en cookies (no se emplea NextAuth.js).
- Se utiliza un `middleware.ts` en la raíz de `src/` que intercepta las peticiones para validar roles (`x-user-role`, `x-user-id`) que luego son consumidos por los controladores para aplicar restricciones lógicas (ej. solo `ADMIN` puede modificar un producto o borrar órdenes).

## 7. Hallazgos y Oportunidades de Mejora

1. **Consolidar el Patrón Service Layer:** 
   Se recomienda migrar toda la lógica de negocio remanente en los archivos `route.ts` hacia la capa de servicios. Esto evitará la duplicación de lógica y facilitará el mantenimiento. Un archivo de ruta debe limitarse a: 
   - Recibir la Request.
   - Parsear parámetros/body.
   - Llamar al Servicio adecuado.
   - Retornar la respuesta (NextResponse) o manejar errores.

2. **Transición a Clases Instanciables vs Estáticas:**
   Si se planea escalar los tests unitarios en el futuro, es recomendable abandonar los métodos estáticos en los servicios en favor de instanciar clases (ej. `new OrderService(prisma)`). Esto permitiría inyectar dependencias y mejorar la mantenibilidad, aunque en aplicaciones Next.js más funcionales, la inyección suele emularse pasando dependencias como argumentos de funciones si se prefiere evitar POO pura.

3. **Extraer Reglas de Negocio a Utilidades Puras:**
   Cálculos financieros (presentes en `PricingService` o `promo-utils`) están acoplados al DOM o la BD en ciertas partes. Mantenerlos como funciones puras es una excelente práctica.

**Conclusión:**
La arquitectura actual es pragmática y adecuada para el ciclo de vida de un monolito en Next.js. El uso directo de Prisma acelera el desarrollo y la división en la carpeta `services/` muestra una buena intención de separación de responsabilidades, aunque su ejecución requiere unificar criterios (migrar los controladores "gordos" a delegar responsabilidades 100% en los servicios).

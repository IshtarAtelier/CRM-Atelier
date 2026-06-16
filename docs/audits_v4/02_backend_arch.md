# Auditoría de la Arquitectura del Backend (Next.js)

## 1. Estructura de Controladores (API Routes)

El proyecto utiliza el **App Router de Next.js** (`src/app/api/...`), por lo tanto los controladores están representados por los archivos `route.ts`.

* **Patrón de enrutamiento:** Cada endpoint está definido por funciones asíncronas exportadas que corresponden al método HTTP (`GET`, `POST`, `PUT`, `DELETE`).
* **Responsabilidades mixtas ("Fat Controllers"):** En varios endpoints, los archivos `route.ts` asumen más responsabilidades de las que debería tener un controlador estándar. Extraen la información de la request, la validan, ejecutan la lógica de negocio y realizan llamadas directas a la base de datos (vía Prisma ORM).
* **Middlewares:** Existe un middleware global (`src/middleware.ts`) que intercepta las rutas `/api/*` para resolver autenticación y autorizaciones (mediante tokens JWT / cookies), inyectando en la cabecera identificadores como `x-user-id` que los controladores leen para identificar al usuario, lo que es una muy buena práctica.

## 2. Capa de Servicios (`src/services/`)

Existe una capa de servicios donde se encapsula la lógica más compleja, pero su adopción en la base de código es inconsistente (algunas rutas delegan el 100% al servicio, mientras otras operan de forma independiente).

* **Patrón de Implementación:** No se instancian los servicios mediante clases. En su lugar, se utilizan dos patrones funcionales/estáticos:
  1. **Clases con métodos estáticos:** Ej. `export class OrderService { static async getOrder(...) { ... } }`.
  2. **Objetos literales exportados:** Ej. `export const ContactService = { ... }`.
* **Utilidad:** Los servicios como `PricingService`, `BotService`, o `OrderService` actúan como módulos de agrupación o *namespaces* de lógica de negocio o utilidades compartidas.

## 3. Inyección de Dependencias (DI) y Acoplamiento

* **Inyección de Dependencias Ausente:** El proyecto **no utiliza Inyección de Dependencias (DI)** ni contenedores de IoC (como InversifyJS, NestJS, o TSyringe).
* **Resolución Estática Directa:** Todas las dependencias (el ORM `prisma`, servicios de utilidades, o librerías de terceros) se importan directamente de forma estática en la parte superior de cada archivo (`import { prisma } from '@/lib/db';`).
* **Ventajas en este contexto:** Dada la naturaleza Serverless del framework Next.js, prescindir de un framework de DI reduce el "cold start", el *boilerplate* de configuración, y mantiene la estructura más funcional y sencilla.
* **Desventajas:** Genera un alto acoplamiento estático que hace más difíciles las pruebas unitarias puras en aislamiento. Para testear de forma aislada se tiene que depender de utilidades de mock de módulos (como `jest.mock`).

## 4. Patrones Adicionales Observados

* **Direct Data Access (Sin Capa Repository):** No se utiliza el Patrón Repository. En su lugar, `prisma` se importa e invoca de manera directa en todas las capas (tanto en `route.ts` como en la carpeta `services/`). En entornos Next.js modernos, Prisma suele cumplir directamente el rol de Repository, por lo que esto es un estándar aceptado.
* **Validación de DTOs:** El proyecto se apoya en **Zod** (`src/lib/validations/` y schemas *inline* en rutas/servicios) para analizar (parse) y validar las entradas HTTP, lo que emula un sistema de DTOs fuertemente tipados en TypeScript.
* **Separación de Lógica Pura:** Utilidades aisladas que no dependen del modelo de base de datos se manejan eficazmente en la carpeta `src/lib/` (ej. `promo-utils.ts`, `order-utils.ts`).

## 5. Conclusiones y Recomendaciones

1. **Estandarizar el Uso de Servicios ("Thin Controllers"):** Es altamente recomendable refactorizar gradualmente los `route.ts` ("Fat Controllers") para que deleguen toda la lógica de negocio a la carpeta `services/`. Los controladores solo deberían manejar: recibir la request, validar con Zod, invocar al servicio estático, y devolver la respuesta (NextResponse).
2. **Homogeneizar el Patrón de Servicio:** Es preferible adoptar un único estilo en `src/services/`. Se recomienda utilizar **Clases con métodos estáticos**, ya que agrupan lógicamente las responsabilidades de forma clara y estricta en TypeScript.
3. **No forzar Inyección de Dependencias:** A menos que el proyecto requiera un Testing Unitario muy extensivo y sofisticado, no se recomienda incorporar librerías de Inyección de Dependencias clásicas en Next.js App Router; el patrón de módulos estáticos ya implementado suele ser la forma idiomática y de mejor rendimiento para aplicaciones web modernas con React Server Components/Serverless APIs.

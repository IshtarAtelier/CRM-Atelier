# Reporte de Auditoría de Dependencias

Este reporte detalla el estado actual de las dependencias del proyecto, incluyendo aquellas que se encuentran obsoletas y las que presentan vulnerabilidades de seguridad detectadas mediante `npm audit`.

## 1. Dependencias Obsoletas

Al ejecutar `npm outdated`, se identificaron las siguientes dependencias desactualizadas en el proyecto:

| Paquete | Versión Actual | Versión Deseada | Última Versión | Observaciones |
|---------|----------------|-----------------|----------------|---------------|
| `@aws-sdk/client-s3` | 3.1048.0 | 3.1069.0 | 3.1069.0 | |
| `@aws-sdk/s3-request-presigner` | 3.1048.0 | 3.1069.0 | 3.1069.0 | |
| `@google/genai` | 2.4.0 | 2.8.0 | 2.8.0 | |
| `@langchain/core` | 1.1.48 | 1.1.49 | 1.1.49 | |
| `@langchain/langgraph` | 1.3.4 | 1.4.2 | 1.4.2 | |
| `@prisma/client` | 5.22.0 | 5.22.0 | 7.8.0 | Mayor version release (Prisma 7) |
| `@tailwindcss/postcss` | 4.3.0 | 4.3.1 | 4.3.1 | |
| `@types/node` | 20.19.41 | 20.19.43 | 25.9.3 | Mayor version release |
| `@types/nodemailer` | 8.0.0 | 8.0.1 | 8.0.1 | |
| `@types/react` | 19.2.14 | 19.2.17 | 19.2.17 | |
| `axios` | 1.16.1 | 1.18.0 | 1.18.0 | |
| `better-sqlite3` | 12.10.0 | 12.11.1 | 12.11.1 | |
| `date-fns` | 4.2.1 | 4.4.0 | 4.4.0 | |
| `eslint` | 9.39.4 | 9.39.4 | 10.5.0 | Mayor version release |
| `eslint-config-next` | 15.1.11 | 15.1.11 | 16.2.9 | |
| `firebase-admin` | 13.10.0 | 13.10.0 | 14.0.0 | Mayor version release |
| `framer-motion` | 12.38.0 | 12.40.0 | 12.40.0 | |
| `googleapis` | 172.0.0 | 172.0.0 | 173.0.0 | Mayor version release |
| `lucide-react` | 0.575.0 | 0.575.0 | 1.18.0 | |
| `next` | 15.1.11 | 15.1.11 | 16.2.9 | Mayor version release |
| `nodemailer` | 8.0.7 | 8.0.11 | 9.0.0 | Mayor version release |
| `openai` | 6.38.0 | 6.42.0 | 6.42.0 | |
| `playwright` | 1.60.0 | 1.61.0 | 1.61.0 | |
| `prisma` | 5.22.0 | 5.22.0 | 7.8.0 | Mayor version release |
| `react` | 19.0.0 | 19.0.0 | 19.2.7 | |
| `react-dom` | 19.0.0 | 19.0.0 | 19.2.7 | |
| `tailwindcss` | 4.3.0 | 4.3.1 | 4.3.1 | |
| `typescript` | 5.9.3 | 5.9.3 | 6.0.3 | Mayor version release |
| `zustand` | 5.0.13 | 5.0.14 | 5.0.14 | |

*Se detectan varias actualizaciones mayores que requerirán pruebas exhaustivas (breaking changes) antes de actualizar en producción, notablemente: Prisma, Firebase Admin, ESLint, Next.js, Nodemailer y TypeScript.*

## 2. Vulnerabilidades Encontradas

La ejecución de `npm audit` detectó un total de **20 vulnerabilidades**: **12 moderadas**, **7 altas** y **1 crítica**.

### Críticas
- **next** (`9.3.4-canary.0` - `16.3.0-canary.5`)
  - **Problemas:** Múltiples vulnerabilidades de exposición de información, Server-Side Request Forgery (SSRF), denegaciones de servicio (DoS) por enrutamiento/imágenes, y Cross-Site Scripting (XSS).
  - **Solución Propuesta:** Instalar versión superior a `16.3.0-canary.5` (o el fix reportado en Next.js `15.5.19`), lo cual podría requerir `npm audit fix --force`.

### Altas
- **form-data** (`>=4.0.0 <4.0.6` || `<2.5.6`)
  - **Problemas:** Inyección CRLF mediante nombres de archivo y campos multi-part no escapados.
- **protobufjs** (`<=7.6.2`)
  - **Problemas:** Denegación de servicio a través de la expansión "Any" de forma ilimitada durante la conversión a JSON. También existe la posibilidad de sobrescribir propiedades (shadowing) debido a nombres derivados de esquemas.
- **ws** (`8.0.0` - `8.20.1`)
  - **Problemas:** Agotamiento de memoria derivando en DoS proveniente de fragmentos muy pequeños de datos.
- **xlsx** (`*`)
  - **Problemas:** Polución de Prototipos y DoS por expresiones regulares (ReDoS).
  - **Nota:** Actualmente *no existe fix* mediante `npm audit`.

### Moderadas
- **DOMPurify** (`<=3.2.3`)
  - **Problemas:** Bypasses de sanitización que podrían derivar en inyecciones XSS.
- **js-yaml** (`<=4.1.1`)
  - **Problemas:** Complejidad cuadrática en el manejo de "merge keys" derivando en DoS.
- **nodemailer** (`<=8.0.8`)
  - **Problemas:** Inyección CRLF, validación incorrecta de certificados TLS en token fetch OAuth2, y bypass de validaciones de acceso al normalizar mensajes.
- **postcss** (`<8.5.10`)
  - **Problemas:** Vulnerabilidad XSS relacionada a tags de cierre `</style>` no escapados en su salida de stringify.
- **uuid** (`<11.1.1`)
  - **Problemas:** Ausencia de validación en los límites del buffer en ciertas variantes de UUID.

## 3. Recomendaciones

1. **Aplicar Parches Seguros:** Se recomienda correr `npm audit fix` para intentar resolver las vulnerabilidades altas y moderadas de aquellas dependencias que soporten actualización sin romper compatibilidad.
2. **Revisión y Actualizaciones Mayores (Breaking Changes):** Las vulnerabilidades críticas en Next.js y otros paquetes requerirán probablemente de `npm audit fix --force`. Dado que esto instalará versiones con cambios estructurales (por ejemplo, actualizando `firebase-admin` a v14 o `next` a v15.x/16.x), esto debe llevarse a cabo en un branch de pruebas dedicado.
3. **Reemplazo o Manejo de xlsx:** Debido a que el paquete `xlsx` se encuentra marcado con vulnerabilidades y sin parche disponible, si la aplicación expone la validación y carga de hojas de cálculo a usuarios externos, debe considerarse utilizar un parser alternativo para evitar el riesgo de DoS.

# Auditoría de Dependencias

## 1. Vulnerabilidades de Seguridad (`npm audit`)

Se encontraron un total de **20 vulnerabilidades**:
- **1 Crítica**
- **7 Altas**
- **12 Moderadas**

### Detalles de Vulnerabilidades
- **`next` (Crítica)**: Múltiples vulnerabilidades relacionadas con la seguridad del servidor, inyección de contenido, denegación de servicio (DoS) y envenenamiento de caché. *Acción recomendada*: Requiere actualización forzada (`npm audit fix --force`), lo que instalaría una versión con posibles cambios que rompan la compatibilidad (breaking changes).
- **`DOMPurify` (Alta)**: Problemas relacionados con la sanitización y evasión en la evaluación de expresiones de plantillas.
- **`form-data` (Alta)**: Inyección CRLF mediante nombres y nombres de archivo no escapados.
- **`protobufjs` (Alta)**: Problemas de evasión y denegación de servicio a través de expansiones sin límites.
- **`ws` (Alta)**: DoS por agotamiento de memoria desde fragmentos diminutos. *Acción recomendada*: Actualización forzada, ya que afecta a dependencias como `socket.io-client`.
- **`xlsx` (Alta)**: Vulnerabilidades de contaminación de prototipos (Prototype Pollution) y denegación de servicio por expresiones regulares (ReDoS). *Sin parche disponible actualmente*.
- **Vulnerabilidades Moderadas**: Afectan a paquetes como `js-yaml`, `nodemailer`, `postcss`, y `uuid` (el cual impacta las dependencias de Google Cloud como `firebase-admin`). 

> **Recomendación**: Correr `npm audit fix` para solucionar las vulnerabilidades moderadas y revisar manualmente la actualización de `next`, `ws`, y `firebase-admin` mediante `--force` asegurando que no rompan la aplicación. Para `xlsx`, se sugiere evaluar migrar a una alternativa más segura si es posible.

## 2. Dependencias Obsoletas (`npm outdated`)

Existen múltiples dependencias que tienen actualizaciones disponibles en el registro. A continuación, se agrupan en función del riesgo de impacto de sus actualizaciones:

### Actualizaciones Menores / Parches (Seguras)
Pueden actualizarse de manera general, ya que en principio no deberían romper funcionalidades existentes.
- `@aws-sdk/client-s3`: 3.1048.0 -> 3.1069.0
- `@aws-sdk/s3-request-presigner`: 3.1048.0 -> 3.1069.0
- `@google/genai`: 2.4.0 -> 2.8.0
- `@langchain/core`: 1.1.48 -> 1.1.49
- `@langchain/langgraph`: 1.3.4 -> 1.4.2
- `@tailwindcss/postcss`: 4.3.0 -> 4.3.1
- `axios`: 1.16.1 -> 1.18.0
- `better-sqlite3`: 12.10.0 -> 12.11.1
- `date-fns`: 4.2.1 -> 4.4.0
- `framer-motion`: 12.38.0 -> 12.40.0
- `openai`: 6.38.0 -> 6.42.0
- `playwright`: 1.60.0 -> 1.61.0
- `tailwindcss`: 4.3.0 -> 4.3.1
- `zustand`: 5.0.13 -> 5.0.14

### Actualizaciones Mayores (Breaking Changes Posibles)
Requieren revisar el *changelog* (registro de cambios), probar minuciosamente y planificar migraciones.
- `@prisma/client` & `prisma`: 5.22.0 -> 7.8.0
- `@types/node`: 20.19.41 -> 25.9.3
- `eslint`: 9.39.4 -> 10.5.0
- `eslint-config-next`: 15.1.11 -> 16.2.9
- `firebase-admin`: 13.10.0 -> 14.0.0
- `googleapis`: 172.0.0 -> 173.0.0
- `lucide-react`: 0.575.0 -> 1.18.0
- `next`: 15.1.11 -> 16.2.9
- `nodemailer`: 8.0.7 -> 9.0.0
- `react` & `react-dom`: 19.0.0 -> 19.2.7
- `typescript`: 5.9.3 -> 6.0.3

> **Recomendación**: Para las actualizaciones menores, ejecutar `npm update` para subir sus versiones respetando el ^ o ~. Para las actualizaciones mayores (`next`, `react`, `prisma`, `firebase-admin`, etc.), evaluar el impacto del cambio, realizar actualización paquete a paquete individualmente (ej: `npm install next@latest`) y correr una suite completa de pruebas para asegurarse que la app siga funcionando de forma correcta.

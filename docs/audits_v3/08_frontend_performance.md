# Auditoría de Rendimiento Frontend (Frontend Performance)

## 1. Resumen Ejecutivo
Un análisis del rendimiento del frontend revela una arquitectura moderna basada en **Next.js 15 y React 19**. La aplicación cuenta con aciertos notables (como la carga diferida de librerías pesadas en utilidades, optimización en la carga de fuentes web y uso diferido de scripts de terceros). Sin embargo, existen **oportunidades críticas de mejora**, particularmente en el ámbito de la **optimización de imágenes** y en la **gestión del tamaño del bundle de JavaScript** inicial en el lado del cliente (Client Components).

## 2. Tiempos de Carga y Core Web Vitals
### Aciertos (Buenas Prácticas Implementadas):
*   **Gestión de Fuentes (`next/font`)**: Se utiliza `next/font/google` (fuente **Geist**) en `layout.tsx`. Esto mitiga de forma excelente el *Cumulative Layout Shift (CLS)* al auto-alojar la fuente y eliminar los retrasos en las peticiones de red externas, lo cual optimiza la métrica del LCP.
*   **Scripts de Terceros Diferidos**: En el componente `<TrackingScripts />` (para Google Analytics y Meta Pixel), se utiliza el componente `<Script>` de Next.js con la estrategia `strategy="lazyOnload"`. Esto es fundamental porque evita el bloqueo del hilo principal de JavaScript (*Main Thread*) y acelera el renderizado de la página principal.
*   **Arquitectura de Servidor (Server Components)**: Al estar migrados al App Router de Next.js 15, muchos componentes por defecto no envían código JS al cliente, disminuyendo la latencia y tiempos de carga globales.

### Puntos a Mejorar:
*   Falta de gestión de precarga para imágenes principales (*Hero Images* o LCP elements).

## 3. Optimización de Imágenes
### Diagnóstico:
A pesar de que el archivo `next.config.ts` está perfectamente configurado para formatos optimizados (`image/avif`, `image/webp`) y define de manera segura los orígenes de almacenamiento (Firebase, Google Storage), existe una subutilización de estas herramientas.

*   **Problema Principal**: Existe un **uso extensivo y muy frecuente de etiquetas HTML `<img>` estándar** en gran parte de la plataforma (por ejemplo, en las secciones de `/admin`, `/blog` y varios componentes de tienda en `/components`).
*   **Impacto Negativo**:
    1.  Se pierde la conversión automática de Next.js a formatos súper livianos (AVIF/WebP) y el escalado de resoluciones dinámicas por dispositivo.
    2.  Las etiquetas `<img>` no cuentan, por lo general, con atributos de `width` o `height` o no aplican "lazy loading" nativo por defecto, lo que genera problemas de saltos de pantalla (CLS) y descarga de recursos no visibles.

### Recomendaciones:
*   **Refactorización Masiva:** Sustituir todas las instancias de la etiqueta genérica `<img>` por el componente `<Image>` (`next/image`).
*   **Carga Crítica de Imágenes LCP:** En las landings principales, la primera imagen visual del bloque superior (*Hero*) debe contener obligatoriamente la propiedad `priority={true}` para acelerar el *Largest Contentful Paint*.

## 4. Tamaño del Bundle (Bundle Size) y Code Splitting
### Diagnóstico:
*   **Acierto Importante (Lazy Loading de Librerías):** Las librerías que generan los PDFs (como `jspdf` y `jspdf-autotable`) se están importando de forma dinámica `await import('jspdf')` en las utilidades de generación correspondientes. Es un patrón brillante de optimización que previene inyectar cientos de kilobytes innecesarios en la carga inicial de los usuarios.

*   **Áreas de Alerta:**
    1.  **Componentes React Pesados**: A diferencia de las utilidades de utilería (PDFs), para los componentes de React que son pesados e interactivos, no se hace uso del API de carga dinámica de Next.js (`next/dynamic`). Componentes orientados al usuario (como `Interactive3DImage` que incluye todo el engine de `framer-motion`) incrementan los tiempos de Parseo de JS (TBT o *Total Blocking Time*) del paquete inicial sin necesidad inmediata.
    2.  **Monitoreo del Bundle**: No existe registro en el `package.json` o en `next.config.ts` de la herramienta `@next/bundle-analyzer`, lo que significa que el equipo de desarrollo opera "a ciegas" respecto al crecimiento del bundle en producción al momento de la compilación.

### Recomendaciones:
*   **Uso de `next/dynamic`:** Importar bajo demanda todos los modales grandes, componentes 3D, mapas, gráficos complejos o partes de UI "Below the Fold" (abajo en el scroll inicial). Por ejemplo: `const Interactive3DImage = dynamic(() => import('./Interactive3DImage'))`.
*   **Instalación del Analizador de Bundles:** Integrar `@next/bundle-analyzer` y configurar un script `"analyze": "ANALYZE=true next build"` en el `package.json` para habilitar una auditoría de peso recurrente y mantener controlada la deuda técnica en rendimiento.

## 5. Resumen del Plan de Acción
1.  Aplicar reglas de linters (`@next/eslint-plugin-next`) que restrinjan el uso de `<img />` a favor de `<Image />`.
2.  Implementar `next/dynamic` en componentes visuales voluminosos que se rendericen en el cliente (`"use client"`).
3.  Añadir métricas medibles instalando el analizador visual de Next.js.
4.  Asignar tags `priority={true}` a imágenes visuales críticas en el primer pantallazo de carga de la web.

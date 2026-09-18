// ────────────────────────────────────────────────────────────────────────────
// La URL de una imagen local cambia cuando cambia su contenido.
//
// POR QUÉ (17/9/2026): las fotos "look" de la tienda se regeneraron el 15/9 —
// mismo nombre de archivo, otra foto adentro (de la edición marfil con la
// persona recortada, al original bien encuadrado). El servidor sirvió la nueva
// enseguida, pero `/images/` va con `max-age` de un día y las rendiciones del
// optimizador con 31 (`minimumCacheTTL`), así que todo navegador que la había
// visto siguió mostrando la vieja: la dueña la vio dos días después y pensó
// que no se había subido. Un archivo que cambia de contenido sin cambiar de
// nombre es invisible para quien ya lo tiene.
//
// La solución es la de siempre: un `?v=<hash del contenido>` en la URL. El
// hash es del CONTENIDO y no del mtime a propósito: en Railway cada deploy
// hace checkout y le pone la hora del build a todos los archivos; con mtime
// cada deploy invalidaría las 900 imágenes y todos los visitantes las
// volverían a bajar. Con el hash, la URL solo cambia cuando la foto cambia.
//
// Solo para rutas locales de `public/` (`/images/...`). Lo que vive en el
// storage externo ya tiene su propia clave. SOLO SERVIDOR: lee el disco.
// ────────────────────────────────────────────────────────────────────────────

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const cache = new Map<string, string | null>();

function hashDe(rutaPublica: string): string | null {
    if (cache.has(rutaPublica)) return cache.get(rutaPublica)!;
    let h: string | null = null;
    try {
        const abs = path.join(process.cwd(), 'public', rutaPublica);
        h = createHash('md5').update(readFileSync(abs)).digest('hex').slice(0, 8);
    } catch {
        h = null; // no está en public/ (o no se puede leer): la URL queda como está
    }
    cache.set(rutaPublica, h);
    return h;
}

/** `/images/products/vega-c2-look-1.webp` → `/images/products/vega-c2-look-1.webp?v=1628338a`. */
export function versionarImagenLocal(url: string | null | undefined): string {
    if (!url || !url.startsWith('/images/') || url.includes('?')) return url || '';
    const h = hashDe(url);
    return h ? `${url}?v=${h}` : url;
}

export function versionarImagenesLocales(urls: readonly string[] | null | undefined): string[] {
    return (urls || []).map(versionarImagenLocal);
}

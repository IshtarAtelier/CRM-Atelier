// Resuelve el alias `@/` de tsconfig para que un check pueda importar un
// service REAL (no una copia de su lógica). Node no lee tsconfig; sin esto,
// `import '@/lib/audit'` desde adentro de un service explota.
//
// Uso:  node --experimental-strip-types --import ./scripts/checks/_alias-loader.mjs <check>
//
// Agrega las extensiones que TypeScript da por implícitas (.ts/.tsx/index.ts).

import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CANDIDATOS = ['', '.ts', '.tsx', '.js', '/index.ts', '/index.tsx', '/index.js'];

export function resolve(especificador, contexto, siguiente) {
    if (especificador.startsWith('@/')) {
        const base = path.join(RAIZ, 'src', especificador.slice(2));
        for (const ext of CANDIDATOS) {
            const intento = base + ext;
            if (ext !== '' && existsSync(intento)) return { url: pathToFileURL(intento).href, shortCircuit: true };
        }
        return { url: pathToFileURL(base).href, shortCircuit: true };
    }
    // Import relativo sin extensión (estilo TS) desde un archivo .ts.
    // Ojo: `path.extname('./cash.service')` devuelve '.service' — hay que mirar
    // la lista real de extensiones, no si "tiene punto".
    const yaTieneExtension = /\.(ts|tsx|js|jsx|mjs|cjs|json)$/.test(especificador);
    if (especificador.startsWith('.') && !yaTieneExtension && contexto.parentURL?.endsWith('.ts')) {
        const base = path.resolve(path.dirname(fileURLToPath(contexto.parentURL)), especificador);
        for (const ext of CANDIDATOS.slice(1)) {
            if (existsSync(base + ext)) return { url: pathToFileURL(base + ext).href, shortCircuit: true };
        }
    }
    return siguiente(especificador, contexto);
}

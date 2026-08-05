/**
 * Registro de lo que se publicó y cuándo.
 *
 * Vive en la BASE (tabla SystemSetting, que ya existe) y no en un archivo:
 * el servicio corre en Railway, donde el disco es efímero y un archivo se
 * pierde en cada deploy. Sin esto, el aviso de inactividad de la Etapa 6 no
 * tendría contra qué comparar.
 *
 * Es a propósito una sola clave con las últimas publicaciones, y no una tabla
 * nueva: agregar una tabla obliga a una migración y a mantenerla, y acá con
 * saber "qué se publicó, cuándo y dónde" alcanza. Si algún día hace falta más
 * (métricas por pieza, por ejemplo), se migra con los datos ya guardados.
 */
const CLAVE = 'social_publicaciones';
const CUANTAS_GUARDA = 60;

async function conPrisma(fn) {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({
        datasources: { db: { url: process.env.PROD_DATABASE_URL || process.env.DATABASE_URL } },
    });
    try {
        return await fn(prisma);
    } finally {
        await prisma.$disconnect();
    }
}

/** Todas las publicaciones registradas, de la más nueva a la más vieja. */
export async function leerBitacora() {
    return conPrisma(async (prisma) => {
        const fila = await prisma.systemSetting.findUnique({ where: { key: CLAVE } });
        if (!fila?.value) return [];
        try {
            const datos = JSON.parse(fila.value);
            return Array.isArray(datos) ? datos : [];
        } catch {
            // Un valor corrupto no puede romper el aviso: se trata como vacío.
            console.error('[social] La bitácora tiene un valor ilegible; se ignora.');
            return [];
        }
    });
}

/**
 * Deja registrada una publicación.
 * @param {{pieza:string, plataformas:string[], slides:number, urls?:object}} entrada
 */
export async function registrarPublicacion(entrada) {
    return conPrisma(async (prisma) => {
        const fila = await prisma.systemSetting.findUnique({ where: { key: CLAVE } });
        let previas = [];
        try { previas = fila?.value ? JSON.parse(fila.value) : []; } catch { previas = []; }
        if (!Array.isArray(previas)) previas = [];

        const nueva = { ...entrada, fecha: new Date().toISOString() };
        const todas = [nueva, ...previas].slice(0, CUANTAS_GUARDA);
        const value = JSON.stringify(todas);

        await prisma.systemSetting.upsert({
            where: { key: CLAVE },
            update: { value },
            create: { key: CLAVE, value },
        });
        return nueva;
    });
}

/** Días completos desde la última publicación. `null` si nunca se publicó. */
export function diasSinPublicar(bitacora) {
    if (!bitacora.length) return null;
    const ultima = new Date(bitacora[0].fecha).getTime();
    return Math.floor((Date.now() - ultima) / 86400000);
}

/** Cuántas se publicaron en los últimos N días (para medir la cadencia). */
export function publicadasEnLosUltimos(bitacora, dias) {
    const desde = Date.now() - dias * 86400000;
    return bitacora.filter(p => new Date(p.fecha).getTime() >= desde).length;
}

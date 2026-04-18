/**
 * Resuelve una URL de almacenamiento (local o nube) para su visualización en el frontend.
 * @param urlOrKey La URL o Key guardada en la base de datos.
 * @returns Una URL válida para asignar al src de un <img> o abrir en una pestaña.
 */
export function resolveStorageUrl(urlOrKey: string | null | undefined): string {
    if (!urlOrKey) return '';

    // Si es base64, lo retornamos directo
    if (urlOrKey.startsWith('data:image')) {
        return urlOrKey;
    }

    // Si ya es una URL completa (http/https) o una ruta relativa de public (/uploads/...)
    if (urlOrKey.startsWith('http') || urlOrKey.startsWith('/') || urlOrKey.startsWith('data:')) {
        return urlOrKey;
    }

    // Si es una ruta local simulada
    if (urlOrKey.startsWith('local://')) {
        const key = urlOrKey.replace('local://', '');
        return `/api/storage/view?key=${encodeURIComponent(key)}`;
    }

    // Si es un KEY de Cloud (sin prefijo y no empieza con /), 
    // en un futuro aquí podríamos llamar a una API para obtener el signed URL o 
    // simplemente asumir que el backend nos dio el key y necesitamos resolverlo.
    // Por ahora, para simplificar compatibilidad local:
    return `/api/storage/view?key=${encodeURIComponent(urlOrKey)}`;
}

/**
 * Convierte un File a un string Base64 (Data URI) nativo.
 * Se usa para inyectar imágenes en la DB y protegerse contra el reinicio efimero de contenedores en Railway.
 */
export async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
}

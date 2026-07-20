// Tipos de caso de post-venta (para clasificar y hacer reportes).
// Editar esta lista para agregar / sacar / renombrar tipos.
export const POST_SALE_CASE_TYPES = [
    'Cambio de receta',
    'Error de medición y centrado',
    'Garantía',
    'Falla de laboratorio',
    'Error de armado / montaje',
    'Rayado / tratamiento',
    'Error administrativo / carga',
    'Reclamo / insatisfacción',
    'Otro',
] as const;

export type PostSaleCaseType = typeof POST_SALE_CASE_TYPES[number];

// Responsable del error de un caso de post-venta (opciones fijas, para reportes).
export const POST_SALE_RESPONSIBLES = ['Cliente', 'Matías', 'Milena', 'Ishtar', 'Médico', 'Grupo Óptico', 'Optovisión', 'Proveedor (armazón)', 'Transporte / Correo'] as const;

// Cobertura del caso: ¿lo cubre la óptica o va con cargo al cliente?
export const POST_SALE_COVERAGE = ['Sin cargo', 'Con cargo'] as const;

// Color de badge por tipo (clases Tailwind). Fallback para tipos no listados.
export const POST_SALE_CASE_TYPE_STYLES: Record<string, string> = {
    'Cambio de receta': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/40',
    'Error de medición y centrado': 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/40',
    'Garantía': 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/40',
    'Falla de laboratorio': 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-900/40',
    'Error de armado / montaje': 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-950/30 dark:text-fuchsia-400 dark:border-fuchsia-900/40',
    'Rayado / tratamiento': 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-900/40',
    'Error administrativo / carga': 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700',
    'Reclamo / insatisfacción': 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/30 dark:text-pink-400 dark:border-pink-900/40',
    'Otro': 'bg-stone-100 text-stone-600 border-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700',
};

export function caseTypeStyle(type?: string | null): string {
    if (!type) return POST_SALE_CASE_TYPE_STYLES['Otro'];
    return POST_SALE_CASE_TYPE_STYLES[type] || POST_SALE_CASE_TYPE_STYLES['Otro'];
}

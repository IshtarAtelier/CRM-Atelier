/**
 * Condición frente al IVA del receptor (RG 5616, campo `CondicionIVAReceptorId`
 * de FECAESolicitar). Desde el 1/12/2026 ARCA rechaza todo comprobante que no
 * la informe. Códigos según FEParamGetCondicionIvaReceptor; las que admite la
 * Factura C (somos monotributo: solo emitimos C).
 */
export const CONDICIONES_IVA_RECEPTOR = [
    { id: 6, label: 'Monotributista', comun: true },
    { id: 1, label: 'Responsable Inscripto', comun: true },
    { id: 4, label: 'Exento', comun: true },
    { id: 5, label: 'Consumidor Final', comun: true },
    { id: 13, label: 'Monotributista Social', comun: false },
    { id: 16, label: 'Monotributo Trabajador Independiente Promovido', comun: false },
    { id: 7, label: 'Sujeto No Categorizado', comun: false },
    { id: 15, label: 'IVA No Alcanzado', comun: false },
    { id: 10, label: 'IVA Liberado – Ley N° 19.640', comun: false },
    { id: 9, label: 'Cliente del Exterior', comun: false },
    { id: 8, label: 'Proveedor del Exterior', comun: false },
] as const;

export const CONDICION_IVA_CONSUMIDOR_FINAL = 5;

const IDS_VALIDOS = new Set<number>(CONDICIONES_IVA_RECEPTOR.map(c => c.id));

/** Sin CUIT el receptor es siempre Consumidor Final; con CUIT vale lo elegido. */
export function resolverCondicionIvaReceptor(docTipo: number, elegida?: number | null): number {
    if (docTipo !== 80) return CONDICION_IVA_CONSUMIDOR_FINAL;
    if (elegida != null && IDS_VALIDOS.has(Number(elegida))) return Number(elegida);
    throw new Error('Con CUIT hay que indicar la condición frente al IVA del receptor (RG 5616).');
}

// Rango de fabricación de un cristal, para mostrar SOLO en pantallas internas
// (cotizador / carrito del vendedor). Nunca incluir en presupuestos, PDFs ni
// emails al cliente.

const formatDiopter = (v: number) => `${v > 0 ? '+' : ''}${Number.isInteger(v) ? v : v.toFixed(2)}`;

export function formatLensRange(p: {
    sphereMin?: number | null; sphereMax?: number | null;
    cylinderMin?: number | null; cylinderMax?: number | null;
    additionMin?: number | null; additionMax?: number | null;
}): string | null {
    if (p.sphereMin == null || p.sphereMax == null) return null;
    let range = `Esf ${formatDiopter(p.sphereMax)} a ${formatDiopter(p.sphereMin)}`;
    if (p.cylinderMin != null && p.cylinderMax != null) {
        range += Math.abs(p.cylinderMin) === Math.abs(p.cylinderMax)
            ? ` · Cil ±${Math.abs(p.cylinderMax)}`
            : ` · Cil ${formatDiopter(p.cylinderMin)} a ${formatDiopter(p.cylinderMax)}`;
    }
    if (p.additionMin != null && p.additionMax != null) {
        range += ` · Ad ${formatDiopter(p.additionMin)}–${formatDiopter(p.additionMax)}`;
    }
    return range;
}

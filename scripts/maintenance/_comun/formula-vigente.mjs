/**
 * CANDADO para los scripts que ESCRIBEN costos desde una lista de laboratorio.
 *
 * Los scripts de sincronización traen la fórmula del laboratorio escrita
 * (Grupo Óptico: lista + $7.272; Optovisión: (lista + $23.000) × 1,21), pero la
 * fuente de verdad es la tabla LaboratoryConfig, que se edita desde
 * Configuración → Laboratorios y que la app usa para recalcular (lab-recalc).
 * Si alguien cambia el calibrado desde la pantalla y después corre un script
 * viejo, el script pisaría en silencio todos los costos con el número anterior.
 *
 * Esto lo impide: antes de escribir, el script compara su fórmula con la de la
 * base contra la que corre y SE NIEGA a seguir si no coinciden. La salida es
 * actualizar el script, no forzarlo.
 */
export async function exigirFormulaVigente(prisma, laboratorio, { calibrado, iva }) {
    const filas = await prisma.$queryRaw`
        select name, calibrado, iva from "LaboratoryConfig" where upper(name) = upper(${laboratorio})`;
    if (!filas.length) {
        throw new Error(`No hay configuración para "${laboratorio}" en LaboratoryConfig: no se puede verificar la fórmula.`);
    }
    const cfg = filas[0];
    const cal = Number(cfg.calibrado), ivaBase = Number(cfg.iva);
    if (Math.round(cal) !== Math.round(calibrado) || Math.round(ivaBase) !== Math.round(iva)) {
        throw new Error(
            `La fórmula de "${laboratorio}" cambió en Configuración → Laboratorios: la base dice calibrado ` +
            `$${cal.toLocaleString('es-AR')} e IVA ${ivaBase}%, este script usa $${calibrado.toLocaleString('es-AR')} ` +
            `e IVA ${iva}%. No se escribe nada: actualizá el script a los valores de la base.`);
    }
    console.log(`Fórmula verificada contra LaboratoryConfig: calibrado $${cal.toLocaleString('es-AR')} · IVA ${ivaBase}%\n`);
}

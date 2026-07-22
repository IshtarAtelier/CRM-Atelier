import * as backfill from './lab-recon/backfill';
import * as matching from './lab-recon/cost-matching';
import * as imap from './lab-recon/imap';
import * as orderStatus from './lab-recon/order-status';
import * as alerts from './lab-recon/alerts';
import * as reports from './lab-recon/reports';

export type { LabName, LabCostInput } from './lab-recon/types';

/**
 * CONCILIACIÓN DE COSTOS DE LABORATORIO — punto de entrada.
 *
 * Cruza lo que factura cada laboratorio contra el costo cargado en el CRM, avisa
 * de toda diferencia y de todo pedido que no tenga una venta que lo respalde.
 * Documentación funcional en `docs/conciliacion-costos-laboratorio.md`.
 *
 * Esta clase es una FACHADA delgada: la lógica vive en `lab-recon/`, un módulo
 * por responsabilidad. Se mantiene como fachada para que los crons y las rutas
 * de la API sigan llamando a un solo lugar conocido.
 *
 *   lab-recon/types.ts         tipos, umbrales y helpers compartidos
 *   lab-recon/backfill.ts      estreno silencioso por laboratorio
 *   lab-recon/cost-matching.ts el cruce en sí (costo por par, 2x1, huérfanos)
 *   lab-recon/imap.ts          facturas de Optovision y resumen de Essilor
 *   lab-recon/order-status.ts  estado del pedido y costo del caso de postventa
 *   lab-recon/alerts.ts        avisos inmediatos y resumen diario
 *   lab-recon/reports.ts       reportes y libro de auditoría (solo lectura)
 *
 * PARA SUMAR UN LABORATORIO NUEVO:
 *   1. Un proveedor en `lab-providers/` con su `collect()` (de dónde salen sus
 *      costos: portal, email, planilla) y sumarlo a `LAB_PROVIDERS`.
 *   2. Su patrón de ítems en `LAB_ITEM_PATTERNS` y su nombre en `LAB_LABELS`
 *      (lab-recon/types.ts), y el lab en `BACKFILL_LABS` (lab-recon/backfill.ts)
 *      para que su histórico entre en silencio la primera vez.
 *   Nada más cambia: el cruce, los avisos, los reportes y la pantalla ya lo toman.
 */
export class LabCostReconciliationService {
    // ── Estreno silencioso por laboratorio ──────────────────────────────────
    static readonly BACKFILL_LABS = backfill.BACKFILL_LABS;
    static backfillKey = backfill.backfillKey;
    static isQuietLab = backfill.isQuietLab;
    static invalidateBackfillCache = backfill.invalidateBackfillCache;

    // ── El cruce ────────────────────────────────────────────────────────────
    static systemCostForLab = matching.systemCostForLab;
    static upsertEntry = matching.upsertEntry;
    static recheckUnmatched = matching.recheckUnmatched;
    static registerPortalOrphans = matching.registerPortalOrphans;

    // ── Ingesta por email ───────────────────────────────────────────────────
    static scanOptovisionInbox = imap.scanOptovisionInbox;
    static scanEssilorStatement = imap.scanEssilorStatement;
    static crossStatementRows = imap.crossStatementRows;

    // ── Estado del pedido / postventa ───────────────────────────────────────
    static promoteFinishedOptovision = orderStatus.promoteFinishedOptovision;

    // ── Avisos ──────────────────────────────────────────────────────────────
    static alertNewFindings = alerts.alertNewFindings;
    static markAlerted = alerts.markAlerted;

    // ── Reportes y auditoría ────────────────────────────────────────────────
    static reconciliationSnapshot = reports.reconciliationSnapshot;
    static recordAuditRun = reports.recordAuditRun;
    static weeklyReport = reports.weeklyReport;
    static monthlyReport = reports.monthlyReport;
    static searchReport = reports.searchReport;
}

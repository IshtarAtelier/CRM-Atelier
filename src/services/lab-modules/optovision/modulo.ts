import { LAB_ITEM_PATTERNS } from '../../lab-recon/types';
import type { LabModule } from '../contrato';
import { CARGA_OPTOVISION } from './carga-asistida';
import { LAB_OPTOVISION, NOMBRE_OPTOVISION } from './portal';

/**
 * EL MÓDULO DE OPTOVISIÓN: hoy solo carga asistida (Ishtar, 16/10/2026: "lo
 * único que falta de este laboratorio es la carga asistida").
 *
 * El seguimiento sigue como siempre: la factura por mail (lab-recon/imap.ts)
 * y el aviso de "corroborar con el laboratorio" a los 5 días hábiles
 * (lab-recon/order-status.ts). Los costos también vienen por mail. Por eso
 * `capacidades.seguimiento` y `costos` van en false y el tick de
 * /api/cron/lab-modulos lo saltea (corrida.ts); cuando convenga leer el
 * listado de OVES (docs/oves-portal.md ya dice cómo), es prender esas dos
 * capacidades acá.
 */
export const MODULO_OPTOVISION: LabModule = {
    clave: LAB_OPTOVISION,
    nombre: NOMBRE_OPTOVISION,
    patronProducto: LAB_ITEM_PATTERNS.OPTOVISION,
    capacidades: { seguimiento: false, costos: false, carga: true },
    carga: CARGA_OPTOVISION,
    // Sin seguimiento por portal, el aviso de retiro lo da el circuito de siempre (factura + corroboración humana).
    avisoDeRetiroAutomatico: false,
    async seguirPedidos() {
        return { vistos: 0, nuevos: 0, cambiados: 0, vinculados: 0, avanzados: 0, terminados: 0, sinPedidoEnPortal: [], atrasados: [], skipped: true, reason: 'Optovisión no hace seguimiento por portal (va por la factura, lab-recon)' };
    },
    async recolectarCostos() {
        return { skipped: true, reason: 'los costos de Optovisión llegan por mail (lab-recon/imap.ts)' };
    },
};

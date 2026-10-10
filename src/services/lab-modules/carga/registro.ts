import type { Actor } from '../../../lib/actor';
import type { CargaAsistida } from './contrato';
import { REGISTRO_MODULOS } from '../registro';

/**
 * Los laboratorios con carga asistida: los módulos del registro que la
 * declaran (`LabModule.carga`). Sumar uno = implementar CargaAsistida
 * (carga/contrato.ts) y ponerlo en su módulo; las rutas y la ficha lo toman solos.
 */
export const CARGAS: CargaAsistida[] = REGISTRO_MODULOS.flatMap(m => (m.carga ? [m.carga] : []));

export function cargaDe(lab: string | null | undefined): CargaAsistida | null {
    const k = String(lab || '').trim().toUpperCase();
    return CARGAS.find(c => c.lab === k) ?? null;
}

/** Quien firma el barrido de borradores colgados (cualquier laboratorio). */
export const ROBOT_DE_LABORATORIO: Actor = { id: null, name: 'Robot de laboratorio', role: null };

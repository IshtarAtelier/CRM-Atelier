import type { Actor } from '../../../lib/actor';
import type { CargaAsistida } from './contrato';
import { CARGA_VITOLEN } from '../vitolen/carga-asistida';
import { CARGA_GRUPO_OPTICO } from '../grupo-optico/carga-asistida';

/**
 * Los laboratorios con carga asistida. Sumar uno = implementar CargaAsistida
 * (carga/contrato.ts) y agregarlo acá; las rutas y la ficha lo toman solos.
 */
export const CARGAS: CargaAsistida[] = [CARGA_VITOLEN, CARGA_GRUPO_OPTICO];

export function cargaDe(lab: string | null | undefined): CargaAsistida | null {
    const k = String(lab || '').trim().toUpperCase();
    return CARGAS.find(c => c.lab === k) ?? null;
}

/** Quien firma el barrido de borradores colgados (cualquier laboratorio). */
export const ROBOT_DE_LABORATORIO: Actor = { id: null, name: 'Robot de laboratorio', role: null };

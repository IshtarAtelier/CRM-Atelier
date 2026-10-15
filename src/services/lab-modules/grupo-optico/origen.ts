import { numeroDelParConCargo as origenDe } from '../carga/origen';
import { LAB_GRUPO_OPTICO } from './portal';
import { esNumeroSmartLab } from './existentes';

/** El nº del par con cargo de un 2x1 de Grupo Óptico (la regla común vive en carga/origen.ts). */
export { elegirNumeroDelParConCargo } from '../carga/origen';
export const numeroDelParConCargo = (orderId: string, pair: number) => origenDe(LAB_GRUPO_OPTICO, orderId, pair, { esNumeroDelLab: esNumeroSmartLab });

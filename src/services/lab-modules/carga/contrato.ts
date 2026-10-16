import type { Actor } from '../../../lib/actor';

/**
 * LA CARGA ASISTIDA DE UN LABORATORIO, con la misma forma para todos.
 *
 * Las rutas (/api/lab-modulos/borradores) y la ficha no saben de Vitolen ni de
 * Grupo Óptico: le piden al registro la carga del laboratorio y llaman acá.
 * Sumar un laboratorio = implementar esto y registrarlo (carga/registro.ts).
 *
 * La regla de Ishtar vale para todos (30/9/2026): el robot prepara, una
 * persona revisa y aprueba, recién ahí el robot carga.
 */
export interface ResultadoPreparar {
    ok: boolean;
    /** El borrador (PREPARADO/EN_REVISION/ERROR) cuando se llegó a crear. */
    borrador?: unknown;
    borradorId?: string;
    error?: string;
    faltantes?: string[];
    avisos?: string[];
    /** HTTP sugerido para la ruta. */
    status: number;
}

/**
 * Un dato que pone quien prepara (lo que la venta no sabe). La ficha lo dibuja sola.
 * `extra`: algo que se agrega al pedido y NO está cobrado en la venta (p. ej.
 * Essential). La ficha avisa con `advertencia`, exige un motivo, y el valor
 * que viaja en `body.extras[clave]` es ese motivo (carga/extras-no-cobrados.ts).
 */
export interface CampoDePreparacion {
    /** La clave con la que viaja en el body de preparar. */
    clave: string;
    etiqueta: string;
    tipo: 'select' | 'numero' | 'extra';
    /** Solo `extra`: lo que lee quien lo agrega antes de confirmar. */
    advertencia?: string;
    /** `imagen`: la ficha muestra la opción con su dibujo (las formas de armazón del portal de Vitolen) en vez de un desplegable. */
    opciones?: { value: string; label: string; imagen?: string }[];
    obligatorio: boolean;
    porDefecto?: string;
    ayuda?: string;
    min?: number;
    max?: number;
}

/** Un par de la venta que se carga en este laboratorio, como lo ve la ficha. */
export interface ParParaCargar {
    pair: number;
    /** El producto / diseño, para el título del par. */
    titulo: string | null;
    faltantes: string[];
    avisos: string[];
    campos: CampoDePreparacion[];
    /** Si viene, todavía no se puede preparar (p. ej. el 2º par espera al 1º). */
    espera?: string | null;
    /** Si viene, el par ya tiene pedido en el laboratorio: no se carga otro. */
    yaCargado?: string | null;
    /**
     * Si viene, el robot NO puede cargar este par (el portal no tiene cómo elegir
     * el cristal) y se carga a mano: la ficha lo anuncia y no ofrece Preparar
     * (Ishtar, 15/10/2026: "que el bot anuncie que no se puede cargar con bot,
     * que se revise a mano y listo").
     */
    aMano?: string | null;
    /** Rol en una promo de dos pares: el tipo decide el color; la etiqueta, el texto ("SIN CARGO · 2x1", "2º par · promo"). */
    rol?: { tipo: 'CON_CARGO' | 'SIN_CARGO'; etiqueta: string } | null;
}

/** Cómo se muestra un borrador, igual para todos los laboratorios. */
export interface VistaDeBorrador {
    /** El texto que acompaña a la captura del portal en la revisión. */
    textoRevision: string;
    /** Lo que se carga, renglón por renglón (apoyo de la captura, nunca su reemplazo). */
    filas: { titulo: string; valor: string; fuerte?: boolean }[];
    avisos: string[];
    /** Cómo se titulan los avisos (Vitolen: son cosas para hacer a mano antes de aprobar). */
    tituloAvisos?: string;
    /** Link al pedido en el portal, si el portal lo tiene (para corregirlo ahí). */
    enlacePortal?: string | null;
    /** Documento del laboratorio una vez cargado (PDF del pedido). */
    documento?: { url: string; etiqueta: string } | null;
    /** Quedó un pedido sin confirmar en el portal que hay que cancelar. */
    pendienteEnPortal?: { id: string; url: string | null } | null;
    /** Lo que alguien cambió a mano en el portal después de preparar (Vitolen, "Modificar" + releer): se aprueba igual, con motivo, y la dueña recibe el aviso con el impacto de costo. */
    cambiosAMano?: { lineas: string[]; costoExtra: number; aConfirmar: boolean; motivo: string | null } | null;
    /**
     * Si viene, "Aprobar y cargar" abre primero un aviso con este texto y pide
     * confirmar (regla de Ishtar, 8/10/2026: en los 2x1 que nadie olvide el nº
     * de operación del otro par, que es lo que hace el descuento).
     */
    confirmarAntesDeAprobar?: { titulo: string; texto: string } | null;
}

export interface BorradorParaVista {
    status: string; pair: number; payload: unknown; resumenPortal: unknown;
    screenshotUrl: string | null; screenshotFinalUrl: string | null; portalNumber: string | null; error: string | null;
}

export interface CargaAsistida {
    lab: string;
    nombre: string;
    robot: Actor;
    /** Qué pares de la venta se cargan en este lab, qué le falta a cada uno y qué hay que elegir al preparar. */
    analizar(orderId: string): Promise<{ pares: ParParaCargar[] } | null>;
    /** Cómo se muestra un borrador de este lab en la ficha. Puro. */
    vistaDeBorrador(b: BorradorParaVista): VistaDeBorrador;
    /** Arma el pedido desde la venta, crea el borrador y hace que el robot lo deje para revisar. */
    preparar(orderId: string, pair: number, body: Record<string, unknown>, actor: Actor): Promise<ResultadoPreparar>;
    /** Después del OK humano: el robot carga en el portal. Reintentable. */
    /** `robot`: la identidad que `Borradores.reintentar` ya tomó para este robot (la hereda en vez de pedir el candado de nuevo). */
    confirmar(borradorId: string, opts?: { robot?: string | null }): Promise<unknown>;
    /** Después de un rechazo: lo que haya que deshacer en el portal (Vitolen cancela su borrador; Grupo Óptico, nada). */
    despuesDeRechazar(borradorId: string, actor?: Actor): Promise<unknown>;
    /** Cancelar en el portal un borrador que quedó colgado (solo los portales que tienen borrador). */
    cancelarEnPortal?(borradorId: string, actor?: Actor): Promise<{ cancelado: boolean; motivo?: string }>;
    /** Volver a mirar el portal sin cambiar de estado (Vitolen: después de "Modificar" a mano). */
    releerPortal?(borradorId: string, actor: Actor): Promise<unknown>;
    /** Antes de aprobar: lo que el lab exige del cuerpo (Vitolen: el motivo de los cambios a mano). Lanza ErrorDeCarga si falta. */
    antesDeAprobar?(borradorId: string, body: Record<string, unknown>, actor: Actor): Promise<void>;
}

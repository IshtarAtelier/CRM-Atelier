/**
 * Los errores de la carga asistida que las rutas traducen a HTTP y la ficha a
 * texto, SIN mirar la prosa del mensaje (hasta el 10/10/2026 la ruta decidía el
 * status con un regex de siete alternativas sobre `message`).
 */
export type CodigoDeErrorDeCarga = 'NO_EXISTE' | 'PERMISO' | 'ESTADO' | 'DATOS' | 'PORTAL' | 'VENTA';

export class ErrorDeCarga extends Error {
    readonly codigo: CodigoDeErrorDeCarga;
    readonly http: number;
    constructor(mensaje: string, codigo: CodigoDeErrorDeCarga = 'ESTADO', http?: number) {
        super(mensaje);
        this.name = 'ErrorDeCarga';
        this.codigo = codigo;
        this.http = http ?? ({ NO_EXISTE: 404, PERMISO: 403, ESTADO: 409, DATOS: 400, PORTAL: 502, VENTA: 409 } as const)[codigo];
    }
}

/** El HTTP que le corresponde a un error cualquiera: el suyo si es de carga, 500 si no. */
export const httpDeError = (err: unknown): number => (err instanceof ErrorDeCarga ? err.http : 500);

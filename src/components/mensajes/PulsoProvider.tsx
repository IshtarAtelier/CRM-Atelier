"use client";

/**
 * EL PULSO: un solo intervalo para todo el panel.
 *
 * Tres cosas necesitan el mismo dato cada pocos segundos — la campanita de
 * mensajes, el pop-up de urgentes y los puntitos verdes de quién está en línea.
 * Con un `setInterval` cada uno serían tres viajes de red y tres consultas a la
 * base cada 20 s POR PESTAÑA ABIERTA, para pintar una sola barra lateral. Acá
 * hay un solo latido y los demás leen de este contexto.
 *
 * Además es el latido que marca a esta persona como "en línea": no hace falta
 * una llamada aparte para eso, la misma que trae los datos avisa que sigue acá.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { UrgentePopup } from './UrgentePopup';
import { avisar, estaMirando, marcarTitulo } from './avisos-escritorio';

interface Urgente {
    id: string; threadId: string; body: string;
    createdAt: string; senderName: string; subject: string | null;
}

interface Pulso {
    noLeidos: number;
    urgentes: Urgente[];
    enLinea: string[];
    yoId: string | null;
    /** Fuerza un latido ya (después de leer algo, para que el badge baje al toque). */
    refrescar: () => void;
}

const PulsoContext = createContext<Pulso>({
    noLeidos: 0, urgentes: [], enLinea: [], yoId: null, refrescar: () => {},
});

export const usePulso = () => useContext(PulsoContext);

const LATIDO_MS = 20000;

/** ¿Las dos listas de urgentes son la misma? Compara por id y en orden. */
function mismosIds(a: Urgente[], b: Urgente[]): boolean {
    return a.length === b.length && a.every((x, i) => x.id === b[i].id);
}

export function PulsoProvider({ children }: { children: ReactNode }) {
    const [noLeidos, setNoLeidos] = useState(0);
    const [urgentes, setUrgentes] = useState<Urgente[]>([]);
    const [enLinea, setEnLinea] = useState<string[]>([]);
    const [yoId, setYoId] = useState<string | null>(null);

    // Cuántos había en el latido anterior. `null` = todavía no sabemos: la
    // primera respuesta solo fija la referencia, así un refresco de página no
    // hace sonar de nuevo mensajes que ya se habían escuchado.
    const previo = useRef<number | null>(null);
    const disparar = useRef<() => void>(() => {});
    // Urgentes por los que YA salió un cartel de escritorio. Sin esto, cada
    // latido de 20 s volvería a avisar del mismo mensaje mientras siga sin leer:
    // un aviso cada 20 segundos, para siempre.
    const urgentesAvisados = useRef<Set<string>>(new Set());

    useEffect(() => {
        let cancelado = false;

        const sonar = () => {
            try {
                const audio = new Audio('/sounds/notification.ogg');
                audio.play().catch(() => {});
            } catch {
                // El navegador bloquea el audio hasta que hubo alguna
                // interacción con la página. No es un error que valga reportar.
            }
        };

        const latir = async () => {
            try {
                const res = await fetch('/api/mensajes/pulso');
                if (!res.ok || cancelado) return;
                const d = await res.json();
                if (cancelado) return;

                const urgentesNuevos: any[] = Array.isArray(d.urgentes) ? d.urgentes : [];
                const hayMas = previo.current !== null && d.noLeidos > previo.current;

                if (hayMas) sonar();

                // ── Carteles del sistema operativo (como los del correo) ──
                // Solo si NO está mirando el CRM: si lo tiene delante ya ve el
                // número en rojo y el globo, y un cartel encima sería ruido.
                if (!estaMirando()) {
                    // Los urgentes van de a uno y con su texto: son los que
                    // justifican interrumpir a alguien que está en otra cosa.
                    for (const u of urgentesNuevos) {
                        if (urgentesAvisados.current.has(u.id)) continue;
                        urgentesAvisados.current.add(u.id);
                        avisar({
                            titulo: `🚨 Urgente de ${u.senderName}`,
                            cuerpo: u.body,
                            ir: `/admin/mensajes?abrir=${u.threadId}`,
                            insistente: true,
                            etiqueta: `urgente-${u.id}`,
                        });
                    }
                    // Los normales, uno solo con el total: cinco carteles
                    // apilados por cinco mensajes no los hace más legibles.
                    const soloNormales = d.noLeidos - urgentesNuevos.length;
                    if (hayMas && soloNormales > 0) {
                        avisar({
                            titulo: '💬 Mensajes del equipo',
                            cuerpo: soloNormales === 1
                                ? 'Tenés un mensaje nuevo sin leer'
                                : `Tenés ${soloNormales} mensajes sin leer`,
                            ir: '/admin/mensajes',
                            etiqueta: 'mensajes-equipo',
                        });
                    }
                }

                // Los ya leídos se olvidan, así un urgente futuro del mismo
                // hilo vuelve a avisar (y el Set no crece sin fin).
                const vivos = new Set(urgentesNuevos.map((u: any) => u.id));
                for (const id of urgentesAvisados.current) {
                    if (!vivos.has(id)) urgentesAvisados.current.delete(id);
                }

                // El contador en el título de la pestaña, que no necesita permiso.
                marcarTitulo(d.noLeidos ?? 0);

                previo.current = d.noLeidos;
                setNoLeidos(d.noLeidos ?? 0);
                // Reemplazar el array SOLO si cambió su contenido. Un array
                // nuevo con los mismos ids re-renderiza todo el panel (el
                // provider envuelve /admin entero) veinte veces por minuto sin
                // que haya pasado nada.
                setUrgentes(prev => mismosIds(prev, urgentesNuevos) ? prev : urgentesNuevos);
                const enLineaNueva: string[] = Array.isArray(d.enLinea) ? d.enLinea : [];
                setEnLinea(prev =>
                    prev.length === enLineaNueva.length && prev.every((x, i) => x === enLineaNueva[i])
                        ? prev : enLineaNueva);
                setYoId(d.yoId ?? null);
            } catch {
                // Un latido perdido no cambia nada en pantalla: se reintenta en
                // el siguiente ciclo y el puntito verde tolera dos fallas.
            }
        };

        disparar.current = latir;
        latir();
        const t = setInterval(latir, LATIDO_MS);
        return () => { cancelado = true; clearInterval(t); };
    }, []);

    // Identidad ESTABLE. Antes se creaba una función nueva en cada render del
    // provider — y el provider re-renderiza en cada latido, porque setUrgentes
    // y setEnLinea reciben arrays nuevos aunque el contenido sea igual.
    // Consecuencia: `abrir()` (que la tiene como dependencia) cambiaba de
    // identidad, el efecto de `?abrir=` volvía a correr, llamaba a refrescar(),
    // eso disparaba otro latido... y así sin fin, pidiendo la conversación en
    // bucle y pisando `lastReadAt` todo el tiempo.
    const refrescar = useCallback(() => disparar.current(), []);
    const valor = useMemo(
        () => ({ noLeidos, urgentes, enLinea, yoId, refrescar }),
        [noLeidos, urgentes, enLinea, yoId, refrescar],
    );

    return (
        <PulsoContext.Provider value={valor}>
            {children}
            {/* Vive acá, fuera de cualquier pantalla: un urgente tiene que
                aparecer estés donde estés dentro del panel, no solo en Mensajes. */}
            <UrgentePopup urgentes={urgentes} />
        </PulsoContext.Provider>
    );
}

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

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { UrgentePopup } from './UrgentePopup';

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

                if (previo.current !== null && d.noLeidos > previo.current) sonar();
                previo.current = d.noLeidos;

                setNoLeidos(d.noLeidos ?? 0);
                setUrgentes(Array.isArray(d.urgentes) ? d.urgentes : []);
                setEnLinea(Array.isArray(d.enLinea) ? d.enLinea : []);
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

    return (
        <PulsoContext.Provider
            value={{ noLeidos, urgentes, enLinea, yoId, refrescar: () => disparar.current() }}
        >
            {children}
            {/* Vive acá, fuera de cualquier pantalla: un urgente tiene que
                aparecer estés donde estés dentro del panel, no solo en Mensajes. */}
            <UrgentePopup urgentes={urgentes} />
        </PulsoContext.Provider>
    );
}

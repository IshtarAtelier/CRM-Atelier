'use client';

import { useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { precioConSigno } from '@/lib/format-precio';

/** Medio peso: lo que puede diferir un importe redondeado al peso de lo cobrado con centavos. */
const TOLERANCIA_REDONDEO = 0.5;

/**
 * El vendedor pide la factura: confirma los datos (el monto ya viene puesto,
 * no se tipea), dice si hace falta una observación y la escribe. La administración recibe un WhatsApp con el link
 * que abre la factura ya armada (ver invoice-request.service.ts).
 */
interface SolicitarFacturaModalProps {
    orderId: string;
    clienteNombre: string;
    clienteDni?: string | null;
    /** Lo cobrado hasta hoy: tope de lo que se puede facturar. */
    cobrado: number;
    /** Monto propuesto (lo cobrado y todavía sin facturar). */
    montoSugerido: number;
    onClose: () => void;
}

export default function SolicitarFacturaModal({ orderId, clienteNombre, clienteDni, cobrado, montoSugerido, onClose }: SolicitarFacturaModalProps) {
    const [nombre, setNombre] = useState(clienteNombre);
    const [dni, setDni] = useState(clienteDni || '');
    const [confirmado, setConfirmado] = useState(false);
    const [necesitaObs, setNecesitaObs] = useState<boolean | null>(null);
    const [observaciones, setObservaciones] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState('');

    // El monto no se pide: es lo cobrado y sin facturar, redondeado al peso.
    // Si hace falta otro importe, va en la observación (Ishtar, 16/10/2026).
    const montoNum = Math.round(montoSugerido || cobrado);
    // Misma tolerancia que el servidor (invoice-request.service.ts): lo cobrado
    // puede traer centavos ($964.409,60) y el sugerido va redondeado al peso
    // ($964.410). Sin tolerancia, el monto propuesto por el propio modal se
    // rechazaba por 40 centavos (Milena, 16/10/2026).
    const montoValido = Number.isFinite(montoNum) && montoNum > 0 && montoNum <= cobrado + TOLERANCIA_REDONDEO;
    const obsValida = necesitaObs === false || (necesitaObs === true && observaciones.trim().length > 0);
    const nombreValido = nombre.trim().length > 1;
    const puedeEnviar = montoValido && nombreValido && confirmado && obsValida && !enviando;

    const enviar = async () => {
        if (!puedeEnviar) return;
        setEnviando(true);
        setError('');
        try {
            const res = await fetch('/api/billing/invoice-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId,
                    monto: montoNum,
                    // Si corrigió nombre o DNI, se guardan en la ficha: la factura sale de ahí.
                    cliente: { nombre: nombre.trim(), dni: dni.trim() || null },
                    datosConfirmados: confirmado,
                    observaciones: necesitaObs ? observaciones.trim() : null,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data.error || 'No se pudo enviar la solicitud.');
                return;
            }
            alert('✅ Factura solicitada. A la administración le llega por WhatsApp.');
            onClose();
        } catch {
            setError('Error de conexión al solicitar la factura.');
        } finally {
            setEnviando(false);
        }
    };

    const opcion = (activa: boolean) =>
        `flex-1 py-3 rounded-xl text-xs font-black transition-all ${activa ? 'bg-indigo-600 text-white shadow-lg' : 'bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400'}`;

    return (
        <Modal isOpen onClose={onClose} maxWidth="md">
            <div className="space-y-5 p-6">
                <h2 className="text-lg font-black">Solicitar factura</h2>
                <div className="rounded-2xl border-2 border-stone-100 dark:border-stone-800 p-4 space-y-2 text-sm">
                    <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Datos a facturar</p>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400">Nombre, apellido y DNI salen así en la factura. Si están mal, corregilos acá: se actualiza la ficha.</p>
                    <label className="block">
                        <span className="text-stone-500 dark:text-stone-400">Nombre y apellido:</span>
                        <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} className="mt-1 w-full px-4 py-2 bg-stone-50 dark:bg-stone-800 rounded-xl font-black focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </label>
                    <label className="block">
                        <span className="text-stone-500 dark:text-stone-400">DNI:</span>
                        <input type="text" inputMode="numeric" value={dni} onChange={e => setDni(e.target.value)} placeholder="Vacío = consumidor final" className="mt-1 w-full px-4 py-2 bg-stone-50 dark:bg-stone-800 rounded-xl font-black focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </label>
                    <p><span className="text-stone-500 dark:text-stone-400">Monto:</span> <strong>{precioConSigno(montoNum)}</strong> <span className="text-[11px] text-stone-500 dark:text-stone-400">(lo cobrado hasta hoy y sin facturar)</span></p>
                    {!montoValido && (
                        <p className="text-xs text-red-600">No hay un monto cobrado para facturar.</p>
                    )}
                </div>

                <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={confirmado} onChange={e => setConfirmado(e.target.checked)} className="mt-1 w-4 h-4" />
                    <span className="text-sm font-bold">Confirmo que nombre, apellido y DNI son los de la factura.</span>
                </label>

                <div className="space-y-2">
                    <p className="text-sm font-bold">¿Necesita alguna observación?</p>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400">Es lo que lee quien factura. Ej.: factura a CUIT (con la condición frente al IVA), otro monto, obra social o plan, o qué cristales/armazón detallar.</p>
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setNecesitaObs(false)} className={opcion(necesitaObs === false)}>No</button>
                        <button type="button" onClick={() => setNecesitaObs(true)} className={opcion(necesitaObs === true)}>Sí</button>
                    </div>
                    {necesitaObs && (
                        <textarea
                            value={observaciones}
                            onChange={e => setObservaciones(e.target.value)}
                            rows={3}
                            autoFocus
                            placeholder="Escribí la observación…"
                            className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    )}
                </div>

                {error && <p className="text-sm text-red-600 font-bold">{error}</p>}

                <button
                    type="button"
                    onClick={enviar}
                    disabled={!puedeEnviar}
                    className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black flex items-center justify-center gap-2 disabled:opacity-40"
                >
                    {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                    Solicitar factura
                </button>
            </div>
        </Modal>
    );
}

'use client';

import { useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { precioConSigno } from '@/lib/format-precio';

/**
 * El vendedor pide la factura: confirma los datos, dice si hace falta una
 * observación y la escribe. La administración recibe un WhatsApp con el link
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
    const [monto, setMonto] = useState(String(Math.round(montoSugerido || cobrado)));
    const [confirmado, setConfirmado] = useState(false);
    const [necesitaObs, setNecesitaObs] = useState<boolean | null>(null);
    const [observaciones, setObservaciones] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState('');

    const montoNum = parseFloat(monto.replace(/\./g, '').replace(',', '.'));
    const montoValido = Number.isFinite(montoNum) && montoNum > 0 && montoNum <= cobrado;
    const obsValida = necesitaObs === false || (necesitaObs === true && observaciones.trim().length > 0);
    const puedeEnviar = montoValido && confirmado && obsValida && !enviando;

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
                    <p><span className="text-stone-500 dark:text-stone-400">Cliente:</span> <strong>{clienteNombre}</strong></p>
                    <p><span className="text-stone-500 dark:text-stone-400">Documento:</span> <strong>{clienteDni ? `DNI ${clienteDni}` : 'Sin documento (consumidor final)'}</strong></p>
                    <label className="block">
                        <span className="text-stone-500 dark:text-stone-400">Monto:</span>
                        <input
                            type="text"
                            inputMode="numeric"
                            value={monto}
                            onChange={e => setMonto(e.target.value)}
                            className="mt-1 w-full px-4 py-2 bg-stone-50 dark:bg-stone-800 rounded-xl font-black focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <span className="text-[11px] text-stone-500 dark:text-stone-400">Cobrado hasta hoy: {precioConSigno(cobrado)}</span>
                    </label>
                    {!montoValido && monto !== '' && (
                        <p className="text-xs text-red-600">El monto tiene que ser mayor a 0 y no superar lo cobrado.</p>
                    )}
                </div>

                <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={confirmado} onChange={e => setConfirmado(e.target.checked)} className="mt-1 w-4 h-4" />
                    <span className="text-sm font-bold">Confirmo que los datos a facturar están correctos.</span>
                </label>

                <div className="space-y-2">
                    <p className="text-sm font-bold">¿Necesita alguna observación?</p>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400">Ej.: factura a CUIT (con la condición frente al IVA), a nombre de otra persona, otro monto o algún dato a corregir.</p>
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

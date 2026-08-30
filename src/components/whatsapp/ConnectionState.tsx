'use client';

/**
 * Qué se ve cuando no hay conexión con WhatsApp.
 *
 * Son dos casos distintos y se explican distinto: con la API oficial no hay QR
 * ni teléfono que vincular (si falla, es credenciales o Meta), mientras que con
 * wa-service hay un código para escanear.
 */

import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { QrCode, RefreshCw, WifiOff } from 'lucide-react';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';

function QRRenderer({ qr }: { qr: string }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        if (!qr || !canvasRef.current) return;
        QRCode.toCanvas(canvasRef.current, qr, {
            width: 280,
            margin: 2,
            color: { dark: '#1c1917', light: '#ffffff' },
        });
    }, [qr]);
    return <canvas ref={canvasRef} className="mx-auto rounded-[2rem] shadow-sm" />;
}

const botonReintentar =
    'px-6 min-h-11 bg-stone-900 dark:bg-white text-white dark:text-stone-900 rounded-2xl font-bold text-sm transition-all inline-flex items-center gap-2 mx-auto shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-600';

export interface ConnectionStateProps {
    esApiOficial: boolean;
    qr: string | null;
    error?: string | null;
    onReintentar: () => void;
}

export function ConnectionState({ esApiOficial, qr, error, onReintentar }: ConnectionStateProps) {
    return (
        <div className="flex-1 overflow-y-auto p-4 lg:p-12 flex items-center justify-center">
            <div className="bg-white/80 dark:bg-stone-900/80 backdrop-blur-2xl rounded-[2.5rem] border border-stone-200 dark:border-white/10 p-12 text-center max-w-lg shadow-2xl">
                {esApiOficial ? (
                    <>
                        <div className="w-20 h-20 bg-amber-100 dark:bg-amber-950/60 rounded-3xl flex items-center justify-center mx-auto mb-6">
                            <WhatsAppIcon className="w-10 h-10 text-amber-700 dark:text-amber-300" />
                        </div>
                        <h2 className="text-2xl font-black text-stone-900 dark:text-white tracking-tight mb-2">La API de WhatsApp no responde</h2>
                        <p className="text-sm text-stone-700 dark:text-stone-300 mb-4 font-medium">{error || 'Faltan credenciales o Meta no contesta.'}</p>
                        <p className="text-xs text-stone-600 dark:text-stone-400 mb-8">
                            Con la API oficial no hay QR ni teléfono que vincular: si esto persiste, revisar en Railway las
                            variables WA_CLOUD_TOKEN, WA_CLOUD_PHONE_NUMBER_ID y el estado del número en el WhatsApp Manager.
                        </p>
                        <button type="button" onClick={onReintentar} className={botonReintentar}>
                            <RefreshCw className="w-4 h-4" aria-hidden /> Reintentar
                        </button>
                    </>
                ) : qr ? (
                    <>
                        <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-950/60 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
                            <QrCode className="w-10 h-10 text-emerald-700 dark:text-emerald-300" aria-hidden />
                        </div>
                        <h2 className="text-2xl font-black text-stone-900 dark:text-white tracking-tight mb-2">Vincular dispositivo</h2>
                        <p className="text-sm text-stone-700 dark:text-stone-300 mb-8 font-medium">Escaneá este código usando WhatsApp Web en tu celular.</p>
                        <div className="inline-block bg-white p-5 rounded-3xl shadow-xl border border-stone-200">
                            <QRRenderer qr={qr} />
                        </div>
                        <button type="button" onClick={onReintentar} className={`mt-8 ${botonReintentar}`}>
                            <RefreshCw className="w-4 h-4" aria-hidden /> Recargar QR
                        </button>
                    </>
                ) : (
                    <>
                        <div className="w-20 h-20 bg-red-100 dark:bg-red-950/60 rounded-3xl flex items-center justify-center mx-auto mb-6">
                            <WifiOff className="w-10 h-10 text-red-700 dark:text-red-300" aria-hidden />
                        </div>
                        <h2 className="text-2xl font-black text-stone-900 dark:text-white tracking-tight mb-2">Señal perdida</h2>
                        <p className="text-sm text-stone-700 dark:text-stone-300 mb-8 font-medium">El servicio wa-service no se está comunicando.</p>
                        <button type="button" onClick={onReintentar} className={botonReintentar}>
                            <RefreshCw className="w-4 h-4" aria-hidden /> Reintentar conexión
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

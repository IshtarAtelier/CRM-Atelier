'use client';

// ────────────────────────────────────────────────────────────────────────────
// El guiado de novedades que aparece al abrir el admin, OBLIGATORIO para su
// audiencia (pedido de Ishtar, 24/8/26): sin X, sin cerrar clickeando afuera,
// sin Escape. La única salida es recorrer los pasos y confirmar al final —
// "no les permitas decir que no quieren ver".
//
// Quién lo tiene pendiente lo decide /api/novedades (server); acá vive el
// CONTENIDO de cada guiado, indexado por el mismo id. El visto se marca en el
// server: cambiar de máquina o de navegador no lo hace reaparecer.
// ────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { Palette, Sun, Ruler, Lock, Gift, Check, X as XIcon, ArrowRight, Loader2, AlertTriangle } from 'lucide-react';
import { AVISO_TENIDO_2X1 } from '@/lib/promo-utils';

interface Paso {
    titulo: string;
    cuerpo: React.ReactNode;
}

const GUIADOS: Record<string, Paso[]> = {
    'tenido-una-linea-2026-08': [
        {
            titulo: 'Hay cambios en teñidos y recetas',
            cuerpo: (
                <>
                    <p>Antes de empezar el día, mirá estos 4 pasos. Es 1 minuto y evita errores en ventas.</p>
                    <p className="flex items-center gap-2 mt-3 p-3 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400">
                        <Lock className="w-4 h-4 shrink-0" />
                        Este aviso no se puede saltear: el botón para cerrarlo aparece en el último paso.
                    </p>
                </>
            ),
        },
        {
            titulo: 'Armazón que trae el cliente: siempre por el botón',
            cuerpo: (
                <>
                    <p>Cuando el cliente trae SU PROPIO armazón, <strong>siempre</strong> hay que cargarlo con el botón <strong>“Agregar armazón del usuario”</strong> (abajo del carrito, en el presupuesto) — nunca dejarlo afuera ni contarlo solo de palabra.</p>
                    <p className="flex items-center gap-2 mt-3 text-amber-600 dark:text-amber-500 font-bold">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        Sin ese botón, el sistema no sabe que hay un armazón ahí: no pide la foto ni las medidas al confirmar la venta, y ese anteojo queda sin rastro en la ficha del cliente.
                    </p>
                    <p className="mt-3 p-3 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400">
                        Queda marcado “Sin cargo” solo — no hay que tocar el precio a mano.
                    </p>
                </>
            ),
        },
        {
            titulo: 'El teñido ahora es UNA sola línea',
            cuerpo: (
                <>
                    <p>Ya no se carga un teñido por ojo: los dos cristales van siempre del mismo color. Es una sola línea con un solo selector de <strong>color + grado + armazón</strong>.</p>
                    <p className="flex items-center gap-2 mt-3 text-amber-600 dark:text-amber-500 font-bold">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        Sin esas 3 cosas elegidas, el sistema no deja enviar la venta a fábrica.
                    </p>
                </>
            ),
        },
        {
            titulo: 'Promo 2x1: un solo teñido sin cargo',
            cuerpo: (
                <>
                    <p>Con el 2x1 de multifocales se bonifica <strong>UN teñido</strong> (el del 1º anteojo). El del segundo anteojo <strong>se cobra</strong>.</p>
                    <p className="mt-2"><strong>El teñido según muestra NO entra</strong> en esta bonificación bajo ningún caso: se cobra siempre, tenga o no tenga la promo activa.</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold"><Check className="w-3.5 h-3.5" /> Compacto — entra</span>
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold"><Check className="w-3.5 h-3.5" /> Degradé — entra</span>
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 text-xs font-bold"><XIcon className="w-3.5 h-3.5" /> Según muestra — se cobra SIEMPRE</span>
                    </div>
                    <p className="flex items-center gap-2 mt-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                        <Gift className="w-4 h-4 shrink-0" /> El cartel de la promo lo recuerda en cada presupuesto: “{AVISO_TENIDO_2X1}”.
                    </p>
                </>
            ),
        },
        {
            titulo: 'Armazones: cuándo se bonifica un par',
            cuerpo: (
                <>
                    <p>Hacen falta <strong>2 pares completos</strong> de cristales 2x1 para que un armazón entre en la promo. Con un solo par, el armazón se cobra entero.</p>
                    <p className="mt-2">Solo entran los armazones <strong>tildados a mano en Stock</strong> (“Elegible 2x1”). Sin ese tilde, el armazón se cobra completo aunque el pedido tenga los 2 pares.</p>
                    <div className="mt-3 space-y-2">
                        <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20">
                            <Gift className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                            <span className="text-emerald-700 dark:text-emerald-400"><strong>2 o más armazones tildados:</strong> se cobra el más caro de la venta; el <strong>siguiente</strong> tildado más caro va <strong>GRATIS entero</strong>. Sin topes ni promedios.</span>
                        </div>
                        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20">
                            <Gift className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                            <span className="text-amber-700 dark:text-amber-400"><strong>1 solo armazón tildado:</strong> va al <strong>50%</strong> — sea el único armazón de la venta (el otro lo trae el cliente) o venga acompañado de otro sin promo.</span>
                        </div>
                    </div>
                </>
            ),
        },
        {
            titulo: 'Clip-on: el caso especial',
            cuerpo: (
                <>
                    <p>Un <strong>clip-on</strong> se engancha sobre otro armazón: no es un anteojo completo por sí solo, y eso cambia cómo se bonifica.</p>
                    <p className="flex items-start gap-2 mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400">
                        <XIcon className="w-4 h-4 shrink-0 mt-0.5" />
                        <span><strong>Si es el ÚNICO armazón de la venta</strong>, se cobra ENTERO: el otro anteojo lo arma el cliente con el suyo, y el clip-on se engancha sobre ese mismo — no cuenta como segundo anteojo.</span>
                    </p>
                    <p className="flex items-start gap-2 mt-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400">
                        <Check className="w-4 h-4 shrink-0 mt-0.5" />
                        <span><strong>Con otro armazón de la óptica en la misma venta</strong> (entre o no en la promo), el clip-on SÍ se bonifica como cualquier armazón tildado.</span>
                    </p>
                </>
            ),
        },
        {
            titulo: 'Dos detalles más',
            cuerpo: (
                <>
                    <p className="flex items-start gap-2">
                        <Sun className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                        <span>Un cristal con teñido ya no figura como “Blanco”: dice <strong>“De sol — teñido Sepia”</strong>, también en el PDF y en la confirmación que recibe el cliente.</span>
                    </p>
                    <p className="flex items-start gap-2 mt-3">
                        <Ruler className="w-4 h-4 shrink-0 mt-0.5 text-indigo-500" />
                        <span>La <strong>altura</strong> ahora se carga solo en el armazón (cuadros OD/OI). En la receta queda la DNP.</span>
                    </p>
                    <p className="mt-3 p-3 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400">
                        ¿Dudas? Escribile a Ishtar por la mensajería interna.
                    </p>
                </>
            ),
        },
    ],
};

export default function NovedadesGuiadas() {
    const [guiadoId, setGuiadoId] = useState<string | null>(null);
    const [paso, setPaso] = useState(0);
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        let vivo = true;
        fetch('/api/novedades')
            .then(r => (r.ok ? r.json() : { pendiente: null }))
            .then(d => { if (vivo && d.pendiente && GUIADOS[d.pendiente]) setGuiadoId(d.pendiente); })
            .catch(() => { /* sin red no se traba el admin */ });
        return () => { vivo = false; };
    }, []);

    if (!guiadoId) return null;
    const pasos = GUIADOS[guiadoId];
    const esUltimo = paso === pasos.length - 1;

    const confirmar = async () => {
        setGuardando(true);
        try {
            const res = await fetch('/api/novedades', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: guiadoId }),
            });
            // Solo se cierra si el server lo registró: si falló, mañana no
            // tiene que "haberse visto solo".
            if (res.ok) setGuiadoId(null);
        } catch { /* se queda abierto */ }
        setGuardando(false);
    };

    return (
        // Sin onClick en el fondo y sin listener de Escape: no hay forma de
        // cerrarlo que no sea el botón del último paso. Es a propósito.
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Novedades del sistema">
            <div className="bg-white dark:bg-stone-900 rounded-[2rem] border border-stone-200 dark:border-stone-700 shadow-2xl max-w-lg w-full p-8 animate-in zoom-in-95 duration-300">
                <p className="text-[10px] font-black text-violet-600 dark:text-violet-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Palette className="w-4 h-4" /> Novedades del sistema · paso {paso + 1} de {pasos.length}
                </p>
                <h3 className="text-xl font-bold text-stone-900 dark:text-white mt-3 mb-4 tracking-tight">{pasos[paso].titulo}</h3>
                <div className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed space-y-1">
                    {pasos[paso].cuerpo}
                </div>

                <div className="flex items-center justify-between mt-8">
                    <div className="flex gap-1.5">
                        {pasos.map((_, i) => (
                            <span key={i} className={`w-2 h-2 rounded-full ${i <= paso ? 'bg-violet-600' : 'bg-stone-200 dark:bg-stone-700'}`} />
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        {paso > 0 && (
                            <button
                                type="button"
                                onClick={() => setPaso(p => p - 1)}
                                className="px-4 py-2.5 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 font-bold text-[11px] uppercase tracking-widest transition-colors"
                            >
                                Atrás
                            </button>
                        )}
                        {esUltimo ? (
                            <button
                                type="button"
                                onClick={confirmar}
                                disabled={guardando}
                                className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-[11px] uppercase tracking-widest transition-all disabled:opacity-60"
                            >
                                {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                Entendido, lo vi
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setPaso(p => p + 1)}
                                className="inline-flex items-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-black text-[11px] uppercase tracking-widest transition-all"
                            >
                                Siguiente <ArrowRight className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

'use client';

/**
 * Personalidad del asistente: las reglas base y el contexto del día.
 *
 * Es el panel que más consecuencias tiene de todo el buzón — lo que se escriba
 * acá es lo que el bot le contesta a clientes reales. Por eso el guardado es
 * explícito y avisa cuando terminó.
 */

import { Bot, Calendar, X } from 'lucide-react';
import { BotPricingSection } from '@/components/config/BotPricingSection';

export interface AgentConfigPanelProps {
    prompt: string;
    onPrompt: (v: string) => void;
    contextoDelDia: string;
    onContextoDelDia: (v: string) => void;
    estadoGuardado: 'idle' | 'saving' | 'success';
    onGuardar: () => void;
    onCerrar: () => void;
}

const areaBase =
    'w-full px-5 py-4 bg-white dark:bg-black/40 border rounded-2xl text-[13px] outline-none resize-none font-medium text-stone-900 dark:text-stone-100 transition-all shadow-inner leading-relaxed';

export function AgentConfigPanel({
    prompt,
    onPrompt,
    contextoDelDia,
    onContextoDelDia,
    estadoGuardado,
    onGuardar,
    onCerrar,
}: AgentConfigPanelProps) {
    return (
        <section
            aria-label="Personalidad del asistente"
            className="border-b border-violet-300 dark:border-violet-900/50 bg-white/80 dark:bg-stone-900/80 backdrop-blur-3xl px-8 py-6 flex-shrink-0 z-10 shadow-lg max-h-[85vh] overflow-y-auto"
        >
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-violet-100 dark:bg-violet-950/60 rounded-xl">
                        <Bot className="w-5 h-5 text-violet-700 dark:text-violet-300" aria-hidden />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-stone-900 dark:text-white uppercase tracking-widest">Personalidad del agente</h3>
                        <p className="text-xs text-stone-700 dark:text-stone-300">Define las reglas globales de Ishtar, la IA.</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onCerrar}
                    aria-label="Cerrar la configuración del agente"
                    className="min-w-10 min-h-10 inline-flex items-center justify-center text-stone-700 dark:text-stone-300 hover:text-stone-900 bg-black/5 dark:bg-white/10 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label htmlFor="agente-reglas" className="text-[11px] font-black text-stone-700 dark:text-stone-300 uppercase tracking-widest flex items-center gap-2">
                            <Bot className="w-4 h-4 text-violet-700 dark:text-violet-400" aria-hidden /> Reglas base (motor IA)
                        </label>
                        <textarea
                            id="agente-reglas"
                            value={prompt}
                            onChange={e => onPrompt(e.target.value)}
                            rows={10}
                            placeholder="Acá van las reglas fijas de ventas y soporte..."
                            className={`${areaBase} border-violet-300 dark:border-violet-800 focus:ring-4 focus:ring-violet-700/20 focus:border-violet-700`}
                        />
                        <p className="text-[11px] font-bold text-stone-600 dark:text-stone-400">
                            Es el corazón de la IA. Si lo borrás, se usa el texto predeterminado del código.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="agente-contexto" className="text-[11px] font-black text-stone-700 dark:text-stone-300 uppercase tracking-widest flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-emerald-700 dark:text-emerald-400" aria-hidden /> Contexto del día (novedades)
                        </label>
                        <textarea
                            id="agente-contexto"
                            value={contextoDelDia}
                            onChange={e => onContextoDelDia(e.target.value)}
                            rows={10}
                            placeholder="Ej: Hoy lunes 25 estamos cerrados por feriado. / Hoy tenemos 20% OFF en cristales..."
                            className={`${areaBase} border-emerald-300 dark:border-emerald-800 focus:ring-4 focus:ring-emerald-700/20 focus:border-emerald-700`}
                        />
                        <p className="text-[11px] font-bold text-stone-600 dark:text-stone-400">
                            Para avisos temporales urgentes, feriados o promociones de hoy.
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={onGuardar}
                    disabled={estadoGuardado !== 'idle'}
                    className={`self-end px-6 min-h-10 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg transition-all active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-violet-700 ${
                        estadoGuardado === 'success' ? 'bg-emerald-700' : 'bg-violet-700 hover:bg-violet-800'
                    } ${estadoGuardado === 'saving' ? 'opacity-70 cursor-wait' : ''}`}
                >
                    {estadoGuardado === 'saving' ? 'Guardando...' : estadoGuardado === 'success' ? '✓ ¡Guardado!' : 'Guardar personalidad'}
                </button>

                <div className="border-t border-stone-200 dark:border-stone-800 pt-2">
                    <BotPricingSection />
                </div>
            </div>
        </section>
    );
}

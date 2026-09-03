'use client';

/**
 * WhatsApp como ventanita, sin salir de lo que estabas haciendo.
 *
 * El pedido fue textual: "que abra ventanita ahí, que ocupe menos espacio, que
 * tenga más de una vista". Es el mismo chasis que el Copilot (botón redondo
 * abajo a la derecha + panel de 420 px que aparece encima), corrido hacia arriba
 * para no taparlo.
 *
 * TRES ESTADOS: cerrado · mini (la lista, empezando por lo que no leíste) ·
 * chat (la conversación con su redactor). "Expandir" lleva al buzón completo
 * con esa conversación ya abierta.
 *
 * No dibuja nada propio: reusa los mismos componentes que la pantalla completa
 * y lee del `WhatsAppProvider`, así que lo que se ve acá y allá nunca diverge.
 * En `/admin/whatsapp` no aparece: ahí ya estás en el buzón.
 */

import { useCallback, useEffect, useState } from 'react';
import { avisarPanelAbierto, usePanelExclusivo, useAbrirPanelRemoto } from '@/lib/paneles-flotantes';
import { usePathname, useRouter } from 'next/navigation';
import { Minimize2 } from 'lucide-react';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';
import { ChatList } from './ChatList/ChatList';
import { ChatHeader } from './Header/ChatHeader';
import { ConversationView } from './Conversation/ConversationView';
import { Composer } from './Composer/Composer';
import { TemplatePromptModal } from './TemplatePromptModal';
import { EnviarPresupuestoModal } from './EnviarPresupuestoModal';
import { inicialDe, telefonoParaLink } from './format';
import { useWhatsAppAcciones, useWhatsAppDatos } from './WhatsAppProvider';
import type { AdjuntoMedia, QuickReply } from './types';

const CLAVE_ABIERTO = 'wa-flotante-abierto-v1';
/** Cuántas conversaciones entran en la ventanita antes de mandarte al buzón. */
const MAX_EN_MINI = 25;

export function FloatingWhatsApp() {
    const pathname = usePathname();
    const router = useRouter();
    const { chats, unreadTotal, chatSeleccionado, selectedChatId, messagesByChat, tags, agentEnabled, esApiOficial, enviando } = useWhatsAppDatos();
    const acciones = useWhatsAppAcciones();

    const [abierto, setAbierto] = useState(false);
    // El Copilot y esta ventanita se dibujan en el MISMO rectángulo: solo uno
    // puede estar abierto a la vez, si no se tapan entre ellos.
    usePanelExclusivo('whatsapp', abierto, useCallback(() => setAbierto(false), []));
    // El disparador vive en la barra de Accesos, no acá: este componente ya no
    // dibuja un botón redondo propio.
    useAbrirPanelRemoto('whatsapp', useCallback(() => setAbierto(true), []));
    const [soloNoLeidos, setSoloNoLeidos] = useState(true);
    const [texto, setTexto] = useState('');
    const [adjunto, setAdjunto] = useState<AdjuntoMedia | null>(null);
    const [templatePrompt, setTemplatePrompt] = useState<{ chatId: string; texto: string; nombre: string } | null>(null);
    const [presupuestoPdf, setPresupuestoPdf] = useState(false);

    const enElBuzon = pathname === '/admin/whatsapp';

    // Abierto o cerrado sobrevive a la navegación entre pantallas del panel.
    useEffect(() => {
        try { setAbierto(localStorage.getItem(CLAVE_ABIERTO) === '1'); } catch { /* sin storage */ }
    }, []);
    useEffect(() => {
        try { localStorage.setItem(CLAVE_ABIERTO, abierto ? '1' : '0'); } catch { /* storage lleno */ }
    }, [abierto]);

    // Mientras la ventanita está abierta, el buzón late rápido y trae la lista.
    useEffect(() => {
        if (!abierto || enElBuzon) return;
        return acciones.activarBuzon();
    }, [abierto, enElBuzon, acciones]);

    // ⌘⇧W / Ctrl+Shift+W. ⌘J ya es del Copilot.
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'w') {
                e.preventDefault();
                setAbierto(prev => {
                    if (!prev) avisarPanelAbierto('whatsapp');
                    return !prev;
                });
            }
            if (e.key === 'Escape' && abierto) setAbierto(false);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [abierto]);

    if (enElBuzon) return null;

    const enChat = !!chatSeleccionado;
    const mensajes = selectedChatId ? messagesByChat[selectedChatId] || [] : [];

    const listaMini = chats
        .filter(c => !c.archived)
        .filter(c => (soloNoLeidos ? c.unreadCount > 0 : true))
        .slice(0, MAX_EN_MINI);

    const expandir = () => {
        if (!chatSeleccionado) { router.push('/admin/whatsapp'); return; }
        router.push(`/admin/whatsapp?phone=${telefonoParaLink(chatSeleccionado)}`);
    };

    const enviarMensaje = async () => {
        if ((!texto.trim() && !adjunto) || !chatSeleccionado || enviando) return;
        const t = texto;
        const media = adjunto;
        setTexto('');
        setAdjunto(null);
        const r = await acciones.enviar(chatSeleccionado.id, t, media ?? undefined);
        if (r.estado === 'necesita-plantilla') {
            setTemplatePrompt({ chatId: r.chatId, texto: r.texto, nombre: r.nombre });
        } else if (r.estado === 'error') {
            alert(`❌ No se pudo enviar: ${r.mensaje}`);
        }
    };

    const enviarAudio = async (base64: string, mimetype: string) => {
        if (!chatSeleccionado || enviando) return;
        const r = await acciones.enviar(chatSeleccionado.id, '', { base64, mimetype, filename: `audio_${Date.now()}.webm` });
        if (r.estado === 'error') alert(`❌ No se pudo enviar el audio: ${r.mensaje}`);
    };

    const enviarPlantilla = async (qr: QuickReply) => {
        if (!qr.templateName || !chatSeleccionado) return;
        const r = await acciones.enviarPlantilla(chatSeleccionado.id, qr.templateName);
        if (r.estado === 'error' && r.mensaje !== 'cancelado') {
            alert(`❌ No se pudo enviar la plantilla: ${r.mensaje}`);
        }
    };

    const chipFiltro = (activo: boolean) =>
        `px-3 min-h-10 rounded-full text-xs font-bold border transition-all inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
            activo
                ? 'bg-emerald-700 text-white border-emerald-700'
                : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 border-stone-300 dark:border-stone-700'
        }`;

    return (
        <>
            {/* El botón vive en la barra de Accesos (FloatingDock), junto al
                Copilot y a los accesos rápidos: todo en una sola píldora en vez
                de botones sueltos apilados en la esquina. */}

            {/* El panel */}
            <div
                className={`fixed bottom-6 right-6 z-[95] w-[420px] max-w-[calc(100vw-2rem)] transition-all duration-300 ease-out ${
                    abierto ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-8 opacity-0 scale-95 pointer-events-none'
                }`}
                aria-hidden={!abierto}
            >
                <div className="h-[560px] max-h-[80vh] bg-white dark:bg-stone-900 rounded-3xl shadow-2xl border border-stone-300 dark:border-stone-700 flex flex-col overflow-hidden">
                    {enChat && chatSeleccionado ? (
                        <>
                            <ChatHeader
                                chat={chatSeleccionado}
                                tags={tags}
                                esApiOficial={esApiOficial}
                                compacto
                                onVolver={acciones.cerrarChat}
                                onExpandir={expandir}
                                onAbrirResumen={expandir}
                                onCrearTarea={expandir}
                                extrayendoFicha={false}
                                onCrearFicha={expandir}
                                buscadorAbierto={false}
                                onAlternarBuscador={expandir}
                                selectorEtiquetasAbierto={false}
                                onSelectorEtiquetas={() => {}}
                                onAlternarEtiqueta={async () => {}}
                                onArchivar={() => {}}
                                onCambiarEtiquetas={() => {}}
                                onToggleBot={activo => acciones.toggleBot(chatSeleccionado.id, activo)}
                            />
                            <ConversationView
                                mensajes={mensajes}
                                chatId={chatSeleccionado.id}
                                inicialContacto={inicialDe(chatSeleccionado)}
                                compacto
                            />
                            <Composer
                                texto={texto}
                                onTexto={setTexto}
                                adjunto={adjunto}
                                onAdjunto={setAdjunto}
                                enviando={enviando}
                                onEnviar={enviarMensaje}
                                onEnviarAudio={enviarAudio}
                                onPlantillaRapida={enviarPlantilla}
                                onPresupuestoPdf={chatSeleccionado.client ? () => setPresupuestoPdf(true) : undefined}
                                compacto
                            />
                        </>
                    ) : (
                        <>
                            <div className="bg-emerald-700 px-4 py-3 flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-3">
                                    <span aria-hidden className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                                        <WhatsAppIcon className="w-5 h-5 text-white" />
                                    </span>
                                    <div>
                                        <h2 className="text-sm font-bold text-white">WhatsApp</h2>
                                        <p className="text-[11px] text-white/90 font-medium">
                                            {unreadTotal > 0 ? `${unreadTotal} sin leer` : 'Todo leído'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <kbd className="hidden md:inline px-1.5 py-0.5 bg-white/20 rounded text-[10px] font-bold text-white border border-white/30">⌘⇧W</kbd>
                                    <button
                                        type="button"
                                        onClick={() => setAbierto(false)}
                                        aria-label="Minimizar WhatsApp"
                                        className="min-w-10 min-h-10 inline-flex items-center justify-center hover:bg-white/20 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                                    >
                                        <Minimize2 className="w-4 h-4 text-white" />
                                    </button>
                                </div>
                            </div>

                            <div className="px-4 py-3 flex items-center gap-2 border-b border-stone-200 dark:border-stone-800 shrink-0">
                                <button type="button" aria-pressed={soloNoLeidos} onClick={() => setSoloNoLeidos(true)} className={chipFiltro(soloNoLeidos)}>
                                    {soloNoLeidos && <span aria-hidden>✓</span>} Sin leer
                                </button>
                                <button type="button" aria-pressed={!soloNoLeidos} onClick={() => setSoloNoLeidos(false)} className={chipFiltro(!soloNoLeidos)}>
                                    {!soloNoLeidos && <span aria-hidden>✓</span>} Recientes
                                </button>
                                <button
                                    type="button"
                                    onClick={expandir}
                                    className="ml-auto px-3 min-h-10 rounded-full text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                                >
                                    Ver buzón
                                </button>
                            </div>

                            <ChatList
                                chats={listaMini}
                                chatSeleccionadoId={null}
                                asistenteGlobalActivo={agentEnabled}
                                compacto
                                vacioTexto={soloNoLeidos ? 'No hay mensajes sin leer.' : 'Todavía no hay conversaciones.'}
                                onSeleccionar={chat => acciones.abrirChat(chat.id)}
                            />
                        </>
                    )}
                </div>
            </div>

            {templatePrompt && (
                <TemplatePromptModal
                    open
                    chatId={templatePrompt.chatId}
                    nombre={templatePrompt.nombre}
                    textoOriginal={templatePrompt.texto}
                    onClose={() => setTemplatePrompt(null)}
                    onSent={() => {
                        acciones.refrescarMensajes(templatePrompt.chatId);
                        acciones.refrescarChats();
                    }}
                />
            )}

            {presupuestoPdf && chatSeleccionado && (
                <EnviarPresupuestoModal
                    open
                    chat={chatSeleccionado}
                    onClose={() => setPresupuestoPdf(false)}
                    onSent={() => {
                        acciones.refrescarMensajes(chatSeleccionado.id);
                        acciones.refrescarChats();
                    }}
                />
            )}
        </>
    );
}

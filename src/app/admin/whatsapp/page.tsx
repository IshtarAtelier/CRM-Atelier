'use client';

/**
 * El buzón de WhatsApp.
 *
 * Esta pantalla era un monolito de ~2.780 líneas con TODO adentro. Hoy es
 * composición pura: los datos y el socket viven en el `WhatsAppProvider` (uno
 * para todo el panel) y cada pedazo de interfaz es un componente de
 * `src/components/whatsapp/`, compartido con la ventana flotante.
 *
 * Lo que queda acá es lo que ES de esta pantalla y de ninguna otra: los filtros
 * del listado, el buscador dentro de la conversación, los modales de gestión y
 * la configuración del agente.
 */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';
import { TestChatModal } from '@/components/ui/TestChatModal';
import InboxHeader from '@/components/whatsapp/InboxHeader';
import { TemplatePromptModal } from '@/components/whatsapp/TemplatePromptModal';
import { ConnectionState } from '@/components/whatsapp/ConnectionState';
import { ChatFilters } from '@/components/whatsapp/ChatList/ChatFilters';
import { ChatList } from '@/components/whatsapp/ChatList/ChatList';
import { ChatHeader } from '@/components/whatsapp/Header/ChatHeader';
import { ChatSearchBar } from '@/components/whatsapp/Conversation/ChatSearchBar';
import { ConversationView, type ConversationHandle } from '@/components/whatsapp/Conversation/ConversationView';
import { Composer } from '@/components/whatsapp/Composer/Composer';
import { AgentConfigPanel } from '@/components/whatsapp/modals/AgentConfigPanel';
import { PROMPT_BASE_POR_DEFECTO } from '@/components/whatsapp/modals/default-agent-prompt';
import { CreateClientModal } from '@/components/whatsapp/modals/CreateClientModal';
import { SummaryModal } from '@/components/whatsapp/modals/SummaryModal';
import { TagManagerModal } from '@/components/whatsapp/modals/TagManagerModal';
import { TaskModal, type TaskDraft } from '@/components/whatsapp/modals/TaskModal';
import { useWhatsAppAcciones, useWhatsAppDatos } from '@/components/whatsapp/WhatsAppProvider';
import { getDisplayName, inicialDe, normalizarBusqueda } from '@/components/whatsapp/format';
import type { AdjuntoMedia, Chat, ClienteExtraido, QuickReply, ReadFilter } from '@/components/whatsapp/types';

function WhatsAppPageContent() {
    const {
        status, cargandoStatus, esApiOficial, chats, chatsCargados, selectedChatId, chatSeleccionado,
        messagesByChat, tags, agentEnabled, followupsEnabled, promptDelServicio, enviando,
    } = useWhatsAppDatos();
    const acciones = useWhatsAppAcciones();

    // ── Configuración del agente (solo de esta pantalla) ──
    const [agentPrompt, setAgentPrompt] = useState('');
    const [dailyContext, setDailyContext] = useState('');
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success'>('idle');
    const [showConfig, setShowConfig] = useState(false);

    // ── Redactor ──────────────────────────────────
    const [newMessage, setNewMessage] = useState('');
    const [selectedImage, setSelectedImage] = useState<AdjuntoMedia | null>(null);
    // Pedido de plantilla pendiente: el envío chocó con la ventana cerrada.
    // `nombre` se congela al momento del 409: el modal envía al chat de ese
    // momento, no al que esté seleccionado cuando por fin se aprieta enviar.
    const [templatePrompt, setTemplatePrompt] = useState<{ chatId: string; texto: string; nombre: string } | null>(null);

    // ── Filtros y paneles ─────────────────────────
    const [filterLabel, setFilterLabel] = useState<string | null>(null);
    const [readFilter, setReadFilter] = useState<ReadFilter>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [showArchived, setShowArchived] = useState(false);
    const [showTagManager, setShowTagManager] = useState(false);
    const [showTestChat, setShowTestChat] = useState(false);
    const [showLabelPicker, setShowLabelPicker] = useState(false);
    const [syncing, setSyncing] = useState(false);

    // ── Modales de la conversación ────────────────
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [taskDraft, setTaskDraft] = useState<TaskDraft>({ description: '', dueDate: new Date().toISOString().split('T')[0] });
    const [creatingTask, setCreatingTask] = useState(false);
    const [summaryChat, setSummaryChat] = useState<Chat | null>(null);
    const [editingSummary, setEditingSummary] = useState('');
    const [extracting, setExtracting] = useState(false);
    const [extractedClient, setExtractedClient] = useState<ClienteExtraido | null>(null);
    const [creatingClient, setCreatingClient] = useState(false);

    // ── Buscador dentro de la conversación ────────
    const [showChatSearch, setShowChatSearch] = useState(false);
    const [chatSearch, setChatSearch] = useState('');
    const [chatSearchIdx, setChatSearchIdx] = useState(0);
    const chatSearchInputRef = useRef<HTMLInputElement>(null);
    const conversacionRef = useRef<ConversationHandle>(null);

    const searchParams = useSearchParams();
    const urlPhone = searchParams.get('phone');
    const handledUrlPhoneRef = useRef(false);

    const messages = useMemo(
        () => (selectedChatId ? messagesByChat[selectedChatId] || [] : []),
        [messagesByChat, selectedChatId],
    );

    // Mirar el buzón sube el latido a 15 s y trae la lista completa; al salir de
    // la pantalla vuelve al ritmo de fondo, que solo alimenta la badge.
    useEffect(() => acciones.activarBuzon(), [acciones]);

    // El servicio empuja el prompt vigente por socket; el editor arranca con él.
    useEffect(() => {
        if (promptDelServicio !== null) setAgentPrompt(promptDelServicio);
    }, [promptDelServicio]);

    const fetchAgent = useCallback(async () => {
        try {
            const res = await fetch('/api/whatsapp/agent');
            const data = await res.json();
            setAgentPrompt(data.prompt || PROMPT_BASE_POR_DEFECTO);
            setDailyContext(data.dailyContext || '');
        } catch { /* el panel queda con lo último que sepa */ }
    }, []);

    useEffect(() => { fetchAgent(); }, [fetchAgent]);

    // ── Abrir el chat que pide la URL (?phone=) ───
    useEffect(() => {
        if (!urlPhone || handledUrlPhoneRef.current || !chatsCargados) return;
        handledUrlPhoneRef.current = true;

        const urlText = searchParams.get('text');
        const normalizado = urlPhone.replace(/\D/g, '');
        const objetivo = chats.find(c =>
            c.waId.includes(normalizado)
            || (c.client?.phone && c.client.phone.replace(/\D/g, '').includes(normalizado)));

        if (objetivo) {
            acciones.abrirChat(objetivo.id);
            if (urlText) setNewMessage(urlText);
            return;
        }

        (async () => {
            try {
                const res = await fetch('/api/whatsapp/chats', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: urlPhone }),
                });
                if (!res.ok) throw new Error('sin chat');
                const nuevo: Chat = await res.json();
                await acciones.refrescarChats();
                await acciones.abrirChat(nuevo.id);
                if (urlText) setNewMessage(urlText);
            } catch {
                alert(`No hay conversación de WhatsApp iniciada con el número ${urlPhone}. Podés mandarle el primer mensaje desde tu celular para abrir el chat.`);
            }
        })();
    }, [urlPhone, chatsCargados, chats, searchParams, acciones]);

    // ── Buscador dentro de la conversación ────────
    // Los mensajes se traen todos (el endpoint no pagina), así que la búsqueda es
    // sobre lo que ya está en memoria: encuentra en toda la charla.
    const chatSearchHits = useMemo(() => {
        const q = normalizarBusqueda(chatSearch.trim());
        if (!q) return [] as string[];
        return messages.filter(m => normalizarBusqueda(m.content || '').includes(q)).map(m => m.id).filter(Boolean);
    }, [chatSearch, messages]);

    useEffect(() => { setChatSearchIdx(0); }, [chatSearch]);

    // Cerrar el buscador al cambiar de conversación: los resultados eran de la otra.
    useEffect(() => { setShowChatSearch(false); setChatSearch(''); }, [selectedChatId]);

    const chatSearchActiveId = chatSearchHits[chatSearchIdx] || null;

    useEffect(() => {
        if (!chatSearchActiveId) return;
        document.getElementById(`msg-${chatSearchActiveId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [chatSearchActiveId]);

    const irAlResultado = (delta: number) => {
        if (chatSearchHits.length === 0) return;
        setChatSearchIdx(prev => (prev + delta + chatSearchHits.length) % chatSearchHits.length);
    };
    const cerrarBuscadorChat = () => { setShowChatSearch(false); setChatSearch(''); };

    // ── Envíos ────────────────────────────────────
    const enviarMensaje = async () => {
        if ((!newMessage.trim() && !selectedImage) || !chatSeleccionado || enviando) return;
        const texto = newMessage;
        const media = selectedImage;
        setNewMessage('');
        setSelectedImage(null);
        conversacionRef.current?.irAlFinal();

        const r = await acciones.enviar(chatSeleccionado.id, texto, media ?? undefined);
        if (r.estado === 'necesita-plantilla') {
            setTemplatePrompt({ chatId: r.chatId, texto: r.texto, nombre: r.nombre });
        } else if (r.estado === 'error') {
            alert(`❌ No se pudo enviar: ${r.mensaje}`);
        }
    };

    const enviarAudio = async (base64: string, mimetype: string) => {
        if (!chatSeleccionado || enviando) return;
        conversacionRef.current?.irAlFinal();
        const r = await acciones.enviar(chatSeleccionado.id, '', { base64, mimetype, filename: `audio_${Date.now()}.webm` });
        if (r.estado === 'error') alert(`❌ No se pudo enviar el audio: ${r.mensaje}`);
    };

    const enviarPlantillaRapida = async (qr: QuickReply) => {
        if (!qr.templateName || !chatSeleccionado) return;
        const r = await acciones.enviarPlantilla(chatSeleccionado.id, qr.templateName);
        if (r.estado === 'error' && r.mensaje !== 'cancelado') {
            alert(`❌ No se pudo enviar la plantilla: ${r.mensaje}`);
        }
    };

    // ── Etiquetas y favoritos ─────────────────────
    const toggleLabel = async (label: string) => {
        if (!chatSeleccionado) return;
        const current = chatSeleccionado.chatLabels || [];
        const next = current.includes(label) ? current.filter(l => l !== label) : [...current, label];
        await acciones.actualizarChat(chatSeleccionado.id, { chatLabels: next });
        if (label === 'Cancelar Bot' && next.includes(label)) {
            await acciones.actualizarChat(chatSeleccionado.id, { botEnabled: false });
        }
        if (label === 'Fijado' && chatSeleccionado.client?.id) {
            marcarFavorito(chatSeleccionado.client.id, next.includes('Fijado'));
        }
    };

    const marcarFavorito = (clientId: string, favorito: boolean) => {
        fetch(`/api/contacts/${clientId}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isFavorite: favorito }),
        }).catch(e => console.error('Error actualizando favorito:', e));
    };

    const fijarChat = async (chat: Chat) => {
        const current = chat.chatLabels || [];
        const eraFav = current.includes('Fijado');
        const next = eraFav ? current.filter(l => l !== 'Fijado') : [...current, 'Fijado'];
        await acciones.actualizarChat(chat.id, { chatLabels: next });
        if (chat.client) {
            acciones.aplicarChatLocal(chat.id, { client: { ...chat.client, isFavorite: !eraFav } });
            marcarFavorito(chat.client.id, !eraFav);
        }
    };

    // ── Ficha desde el chat ───────────────────────
    const extraerFicha = async () => {
        if (!chatSeleccionado) return;
        setExtracting(true);
        setExtractedClient(null);
        try {
            const res = await fetch(`/api/whatsapp/chats/${chatSeleccionado.id}/extract-client`, { method: 'POST' });
            const data = await res.json();
            if (res.ok && data.extracted) setExtractedClient(data.extracted);
            else alert(data.error || 'No se pudieron extraer datos');
        } catch (e) {
            console.error('Error extrayendo datos:', e);
            alert('Error al analizar la conversación');
        }
        setExtracting(false);
    };

    const confirmarFicha = async () => {
        if (!extractedClient || !chatSeleccionado) return;
        if (!extractedClient.name?.trim() || !extractedClient.contactSource?.trim()) {
            alert('El nombre y el origen de contacto son obligatorios.');
            return;
        }
        const chatId = chatSeleccionado.id;
        setCreatingClient(true);
        try {
            const res = await fetch('/api/contacts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: extractedClient.name,
                    phone: extractedClient.phone || null,
                    interest: extractedClient.interest || null,
                    insurance: extractedClient.insurance || null,
                    contactSource: extractedClient.contactSource || null,
                    status: 'CONTACT',
                    // Quién la crea es la persona logueada (lo resuelve el servidor
                    // con la sesión). Esto solo declara CÓMO: apretó el botón del
                    // buzón con los datos que prellenó el asistente.
                    creationMethod: 'ASISTENTE_WHATSAPP',
                }),
            });
            const nuevo = await res.json();

            if (!res.ok) {
                if (nuevo.isDuplicate && nuevo.existingClient) {
                    if (window.confirm(`${nuevo.details}\n\n¿Querés vincular este chat a la ficha existente de ${nuevo.existingClient.name}?`)) {
                        await vincularFicha(chatId, {
                            id: nuevo.existingClient.id,
                            name: nuevo.existingClient.name,
                            phone: nuevo.existingClient.phone,
                            status: nuevo.existingClient.status || 'CONTACT',
                        });
                        setExtractedClient(null);
                    }
                } else {
                    alert(nuevo.error || nuevo.details || 'Error al crear contacto');
                }
                setCreatingClient(false);
                return;
            }

            await vincularFicha(chatId, { id: nuevo.id, name: nuevo.name, phone: nuevo.phone, status: nuevo.status });
            if (extractedClient.notes) {
                await fetch(`/api/contacts/${nuevo.id}/interactions`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'NOTE', content: `[HITO] ${extractedClient.notes}` }),
                });
            }
            setExtractedClient(null);
        } catch (e) {
            console.error('Error creando cliente:', e);
            alert('Error al crear la ficha');
        }
        setCreatingClient(false);
    };

    const vincularFicha = async (chatId: string, client: { id: string; name: string; phone: string; status: string }) => {
        await fetch(`/api/whatsapp/chats/${chatId}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: client.id }),
        });
        acciones.aplicarChatLocal(chatId, { client });
    };

    // ── Tareas, sincronización y personalidad ─────
    const crearTarea = async () => {
        if (!chatSeleccionado?.client?.id || !taskDraft.description.trim()) return;
        setCreatingTask(true);
        try {
            const res = await fetch(`/api/contacts/${chatSeleccionado.client.id}/tasks`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(taskDraft),
            });
            if (res.ok) {
                setShowTaskModal(false);
                setTaskDraft({ description: '', dueDate: new Date().toISOString().split('T')[0] });
            } else {
                alert('No se pudo crear la tarea');
            }
        } catch (error) {
            console.error('Error creating task', error);
        }
        setCreatingTask(false);
    };

    const sincronizar = async () => {
        if (syncing) return;
        setSyncing(true);
        try {
            const res = await fetch('/api/whatsapp/sync', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                alert('Sincronización iniciada. Los chats y mensajes se actualizarán en segundo plano en unos segundos.');
                setTimeout(() => {
                    acciones.refrescarChats();
                    if (selectedChatId) acciones.refrescarMensajes(selectedChatId);
                }, 3000);
            } else {
                alert('Error al sincronizar: ' + (data.error || 'Desconocido'));
            }
        } catch (e) {
            console.error('Error al sincronizar:', e);
            alert('Error al iniciar la sincronización.');
        }
        setSyncing(false);
    };

    const guardarAgente = async () => {
        setSaveStatus('saving');
        try {
            await fetch('/api/whatsapp/agent', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: agentPrompt, enabled: agentEnabled, dailyContext }),
            });
            setSaveStatus('success');
            setTimeout(() => { setSaveStatus('idle'); setShowConfig(false); }, 1000);
        } catch {
            alert('Error al intentar guardar la configuración.');
            setSaveStatus('idle');
        }
    };

    // ── Vista filtrada ────────────────────────────
    const filteredChats = chats.filter(c => {
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().replace(/[\s-]/g, '');
            const queryDigits = query.replace(/\D/g, '');
            const name = getDisplayName(c).toLowerCase().replace(/[\s-]/g, '');
            const matchReal = !!queryDigits && (c.realPhone || '').includes(queryDigits);
            const matchClient = !!queryDigits && (c.client?.phone || '').includes(queryDigits);
            return name.includes(query) || c.waId.toLowerCase().includes(query) || matchReal || matchClient;
        }
        if (c.archived !== showArchived) return false;
        if (filterLabel && !(c.chatLabels || []).includes(filterLabel)) return false;
        if (readFilter === 'UNREAD' && c.unreadCount === 0) return false;
        if (readFilter === 'READ' && c.unreadCount > 0) return false;
        // Buzón limpio: sin filtros, lo leído de más de 2 días se esconde.
        if (!showArchived && !filterLabel && readFilter === 'ALL' && c.unreadCount === 0) {
            const dias = c.lastMessageAt ? (Date.now() - new Date(c.lastMessageAt).getTime()) / (1000 * 3600 * 24) : 0;
            if (dias > 2) return false;
        }
        return true;
    });

    const usedLabels = Array.from(new Set(chats.flatMap(c => c.chatLabels || []))).filter(l => l && l !== 'Fijado');

    return (
        <main className="absolute inset-0 flex flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50/50 via-stone-100 to-stone-200 dark:from-stone-900 dark:via-stone-950 dark:to-black">
            {/* La jerarquía de esta barra (estado · interruptores · acción ·
                el resto en un menú) vive documentada en el componente. */}
            <InboxHeader
                conectado={status.connected}
                telefono={status.phone}
                esApiOficial={esApiOficial}
                calidad={status.qualityRating}
                error={status.error}
                asistenteActivo={agentEnabled}
                onToggleAsistente={acciones.setAgentEnabled}
                seguimientosActivos={followupsEnabled}
                onToggleSeguimientos={next => {
                    // Apagar es el botón de pánico: no pedimos confirmación.
                    // Encender sí la pide, porque reanuda mensajes salientes
                    // automáticos a clientes reales.
                    if (next && !confirm('Vas a reactivar los seguimientos automáticos por WhatsApp.\n\nEl bot va a volver a escribirle solo a los clientes con presupuestos pendientes y charlas sin respuesta. ¿Confirmás?')) return;
                    acciones.setFollowupsEnabled(next);
                }}
                sincronizando={syncing}
                onSincronizar={sincronizar}
                onProbarChat={() => setShowTestChat(true)}
                onAbrirEtiquetas={() => setShowTagManager(true)}
                onAbrirPersonalidad={() => { setShowConfig(v => !v); if (!showConfig) fetchAgent(); }}
                personalidadAbierta={showConfig}
            />

            {showConfig && (
                <AgentConfigPanel
                    prompt={agentPrompt}
                    onPrompt={setAgentPrompt}
                    contextoDelDia={dailyContext}
                    onContextoDelDia={setDailyContext}
                    estadoGuardado={saveStatus}
                    onGuardar={guardarAgente}
                    onCerrar={() => setShowConfig(false)}
                />
            )}

            {/* El buzón se muestra de una: mientras el status está en vuelo
                asumimos conectado y pintamos la lista — los chats vienen de la DB,
                no dependen de la sesión. La pantalla de desconectado aparece solo
                cuando el status YA respondió que no hay sesión; antes tapaba todo
                hasta 100 s si wa-service estaba ocupado. */}
            {!status.connected && !cargandoStatus ? (
                <ConnectionState esApiOficial={esApiOficial} qr={status.qr} error={status.error} onReintentar={acciones.refrescarStatus} />
            ) : (
                <div className="flex flex-1 min-h-0 overflow-hidden m-4 lg:m-6 gap-6">
                    <div className={`w-[360px] bg-white/70 dark:bg-stone-900/70 backdrop-blur-2xl rounded-[2rem] border border-stone-200 dark:border-white/10 flex flex-col shadow-xl ${chatSeleccionado ? 'hidden lg:flex' : 'flex'}`}>
                        <ChatFilters
                            cantidad={filteredChats.length}
                            verArchivados={showArchived}
                            onVerArchivados={setShowArchived}
                            busqueda={searchQuery}
                            onBusqueda={setSearchQuery}
                            filtroEtiqueta={filterLabel}
                            onFiltroEtiqueta={setFilterLabel}
                            filtroLectura={readFilter}
                            onFiltroLectura={setReadFilter}
                            etiquetasUsadas={usedLabels}
                        />
                        <ChatList
                            chats={filteredChats}
                            chatSeleccionadoId={selectedChatId}
                            asistenteGlobalActivo={agentEnabled}
                            onSeleccionar={chat => { setShowLabelPicker(false); acciones.abrirChat(chat.id); }}
                            onFijar={fijarChat}
                            onArchivar={chat => {
                                acciones.actualizarChat(chat.id, { archived: !chat.archived });
                                if (selectedChatId === chat.id) acciones.cerrarChat();
                            }}
                        />
                    </div>

                    <div className="flex-1 bg-white/70 dark:bg-stone-900/70 backdrop-blur-2xl rounded-[2rem] border border-stone-200 dark:border-white/10 shadow-xl overflow-hidden flex flex-col">
                        {chatSeleccionado ? (
                            <>
                                <ChatHeader
                                    chat={chatSeleccionado}
                                    tags={tags}
                                    esApiOficial={esApiOficial}
                                    onVolver={acciones.cerrarChat}
                                    onAbrirResumen={() => {
                                        setSummaryChat(chatSeleccionado);
                                        setEditingSummary(chatSeleccionado.chatSummary || '');
                                    }}
                                    onCrearTarea={() => setShowTaskModal(true)}
                                    extrayendoFicha={extracting}
                                    onCrearFicha={extraerFicha}
                                    buscadorAbierto={showChatSearch}
                                    onAlternarBuscador={() => {
                                        if (showChatSearch) { cerrarBuscadorChat(); return; }
                                        setShowChatSearch(true);
                                        setTimeout(() => chatSearchInputRef.current?.focus(), 50);
                                    }}
                                    selectorEtiquetasAbierto={showLabelPicker}
                                    onSelectorEtiquetas={setShowLabelPicker}
                                    onAlternarEtiqueta={toggleLabel}
                                    onArchivar={() => {
                                        acciones.actualizarChat(chatSeleccionado.id, { archived: !chatSeleccionado.archived });
                                        acciones.cerrarChat();
                                    }}
                                    onCambiarEtiquetas={etiquetas => acciones.actualizarChat(chatSeleccionado.id, { chatLabels: etiquetas })}
                                    onToggleBot={activo => acciones.toggleBot(chatSeleccionado.id, activo)}
                                />

                                {showChatSearch && (
                                    <ChatSearchBar
                                        ref={chatSearchInputRef}
                                        valor={chatSearch}
                                        onValor={setChatSearch}
                                        indice={chatSearchIdx}
                                        total={chatSearchHits.length}
                                        onMover={irAlResultado}
                                        onCerrar={cerrarBuscadorChat}
                                    />
                                )}

                                <ConversationView
                                    ref={conversacionRef}
                                    mensajes={messages}
                                    chatId={chatSeleccionado.id}
                                    inicialContacto={inicialDe(chatSeleccionado)}
                                    busqueda={chatSearch}
                                    idResultadoActivo={chatSearchActiveId}
                                />

                                <Composer
                                    texto={newMessage}
                                    onTexto={setNewMessage}
                                    adjunto={selectedImage}
                                    onAdjunto={setSelectedImage}
                                    enviando={enviando}
                                    onEnviar={enviarMensaje}
                                    onEnviarAudio={enviarAudio}
                                    onPlantillaRapida={enviarPlantillaRapida}
                                />
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center">
                                <div className="w-32 h-32 bg-white dark:bg-stone-800 rounded-full flex items-center justify-center mb-6 shadow-2xl">
                                    <WhatsAppIcon className="w-12 h-12 text-stone-400 dark:text-stone-500" />
                                </div>
                                <h2 className="text-2xl font-black text-stone-600 dark:text-stone-400">Buzón Atelier</h2>
                                <p className="text-sm text-stone-600 dark:text-stone-400 mt-2">Elegí una conversación de la lista.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <TestChatModal isOpen={showTestChat} onClose={() => setShowTestChat(false)} />

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

            {showTagManager && (
                <TagManagerModal tags={tags} onRecargar={acciones.refrescarTags} onCerrar={() => setShowTagManager(false)} />
            )}

            {showTaskModal && chatSeleccionado?.client && (
                <TaskModal
                    borrador={taskDraft}
                    onBorrador={setTaskDraft}
                    guardando={creatingTask}
                    onGuardar={crearTarea}
                    onCerrar={() => setShowTaskModal(false)}
                />
            )}

            {extractedClient && (
                <CreateClientModal
                    datos={extractedClient}
                    onDatos={setExtractedClient}
                    creando={creatingClient}
                    onConfirmar={confirmarFicha}
                    onCerrar={() => setExtractedClient(null)}
                />
            )}

            {summaryChat && (
                <SummaryModal
                    texto={editingSummary}
                    onTexto={setEditingSummary}
                    onGuardar={async () => {
                        await acciones.actualizarChat(summaryChat.id, { chatSummary: editingSummary });
                        setSummaryChat(null);
                    }}
                    onCerrar={() => setSummaryChat(null)}
                />
            )}
        </main>
    );
}

export default function WhatsAppPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                <span className="sr-only">Cargando el buzón...</span>
            </div>
        }>
            <WhatsAppPageContent />
        </Suspense>
    );
}

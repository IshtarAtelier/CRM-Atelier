'use client';

/**
 * El buzón de WhatsApp.
 *
 * Esta pantalla era un monolito de ~2.780 líneas con TODO adentro: tipos,
 * helpers de formato, la lista, las burbujas, el redactor, cinco modales y el
 * prompt del bot. Nada se podía reusar en otra vista y cualquier arreglo obligaba
 * a leer el archivo entero.
 *
 * Ahora es composición: el estado y las llamadas a la API viven acá, y cada
 * pedazo de interfaz es un componente de `src/components/whatsapp/`, pensado
 * para servir también a la ventana flotante del panel.
 */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';
import { TestChatModal } from '@/components/ui/TestChatModal';
import InboxHeader from '@/components/whatsapp/InboxHeader';
import { TemplatePromptModal } from '@/components/whatsapp/TemplatePromptModal';
import { ConnectionState } from '@/components/whatsapp/ConnectionState';
import { InAppToasts, type AvisoEnApp } from '@/components/whatsapp/InAppToasts';
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
import { getDisplayName, inicialDe, normalizarBusqueda, saludoSegunHora } from '@/components/whatsapp/format';
import type {
    AdjuntoMedia, Chat, ClienteExtraido, Message, QuickReply, ReadFilter, Tag, WhatsAppStatus,
} from '@/components/whatsapp/types';
import { WHATSAPP_TEMPLATES, renderTemplate, type TemplateName } from '@/lib/whatsapp/templates';

/** Pinta la última lista conocida al instante mientras llega la fresca. */
const INBOX_CACHE_KEY = 'wa-inbox-cache-v1';

function WhatsAppPageContent() {
    // ── Conexión y agente ─────────────────────────
    const [status, setStatus] = useState<WhatsAppStatus>({ connected: false, phone: null, qr: null, agentEnabled: false });
    const [loadingStatus, setLoadingStatus] = useState(true);
    const esApiOficial = status.transport === 'cloud';
    const [agentPrompt, setAgentPrompt] = useState('');
    const [dailyContext, setDailyContext] = useState('');
    const [agentEnabled, setAgentEnabled] = useState(false);
    // Seguimientos salientes: interruptor aparte del asistente. Ése decide si el
    // bot contesta; éste, si nosotros escribimos primero.
    const [followupsEnabled, setFollowupsEnabled] = useState(true);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success'>('idle');

    // ── Datos del buzón ───────────────────────────
    const [chats, setChats] = useState<Chat[]>([]);
    const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [dbTags, setDbTags] = useState<Tag[]>([]);

    // ── Redactor ──────────────────────────────────
    const [newMessage, setNewMessage] = useState('');
    const [selectedImage, setSelectedImage] = useState<AdjuntoMedia | null>(null);
    const [sending, setSending] = useState(false);
    // Pedido de plantilla pendiente: el envío chocó con la ventana cerrada.
    // `nombre` se congela al momento del 409: el modal envía al chat de ese
    // momento, no al que esté seleccionado cuando por fin se aprieta enviar.
    const [templatePrompt, setTemplatePrompt] = useState<{ chatId: string; texto: string; nombre: string } | null>(null);

    // ── Filtros y paneles ─────────────────────────
    const [filterLabel, setFilterLabel] = useState<string | null>(null);
    const [readFilter, setReadFilter] = useState<ReadFilter>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [showArchived, setShowArchived] = useState(false);
    const [showConfig, setShowConfig] = useState(false);
    const [showTagManager, setShowTagManager] = useState(false);
    const [showTestChat, setShowTestChat] = useState(false);
    const [showLabelPicker, setShowLabelPicker] = useState(false);
    const [syncing, setSyncing] = useState(false);

    // ── Modales de la conversación ────────────────
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [taskDraft, setTaskDraft] = useState<TaskDraft>({ description: '', dueDate: new Date().toISOString().split('T')[0] });
    const [creatingTask, setCreatingTask] = useState(false);
    const [summaryModalChat, setSummaryModalChat] = useState<Chat | null>(null);
    const [editingSummary, setEditingSummary] = useState('');
    const [extracting, setExtracting] = useState(false);
    const [extractedClient, setExtractedClient] = useState<ClienteExtraido | null>(null);
    const [creatingClient, setCreatingClient] = useState(false);

    // ── Buscador dentro de la conversación ────────
    const [showChatSearch, setShowChatSearch] = useState(false);
    const [chatSearch, setChatSearch] = useState('');
    const [chatSearchIdx, setChatSearchIdx] = useState(0);
    const chatSearchInputRef = useRef<HTMLInputElement>(null);

    const [avisos, setAvisos] = useState<AvisoEnApp[]>([]);
    const conversacionRef = useRef<ConversationHandle>(null);
    const pollRef = useRef<NodeJS.Timeout | null>(null);
    const selectedChatRef = useRef(selectedChat);
    const knownClientIds = useRef<Set<string>>(new Set());
    const initialLoadRef = useRef(true);
    const handledUrlPhoneRef = useRef(false);

    const searchParams = useSearchParams();
    const urlPhone = searchParams.get('phone');

    const avisar = useCallback((title: string, body: string, icon?: string, onClick?: () => void) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        setAvisos(prev => [...prev, { id, title, body, icon, onClick }]);
        setTimeout(() => setAvisos(prev => prev.filter(n => n.id !== id)), 6000);
    }, []);

    useEffect(() => { selectedChatRef.current = selectedChat; }, [selectedChat]);

    useEffect(() => {
        if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            Notification.requestPermission();
        }
    }, []);

    // ── Cache local del buzón ─────────────────────
    // Solo alimenta el render inicial: las notificaciones de leads nuevos siguen
    // ancladas al primer fetch real (initialLoadRef), así la cache no dispara
    // avisos falsos.
    useEffect(() => {
        try {
            const raw = localStorage.getItem(INBOX_CACHE_KEY);
            if (raw) {
                const cached = JSON.parse(raw);
                if (Array.isArray(cached) && cached.length > 0) {
                    setChats(prev => (prev.length === 0 ? cached : prev));
                }
            }
        } catch { /* cache corrupta o storage lleno: ignorar */ }
    }, []);

    // ── Fetchers ──────────────────────────────────
    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch('/api/whatsapp/status');
            setStatus(await res.json());
        } catch {
            setStatus({ connected: false, phone: null, qr: null, agentEnabled: false });
        }
        setLoadingStatus(false);
    }, []);

    const fetchMessages = useCallback(async (chatId: string) => {
        try {
            const res = await fetch(`/api/whatsapp/chats/${chatId}/messages`);
            const data = await res.json();
            setMessages(Array.isArray(data) ? data : []);
        } catch { setMessages([]); }
    }, []);

    const fetchTags = useCallback(async () => {
        try {
            const res = await fetch('/api/tags');
            const data = await res.json();
            if (Array.isArray(data)) setDbTags(data);
        } catch { setDbTags([]); }
    }, []);

    const fetchChats = useCallback(async () => {
        try {
            const res = await fetch('/api/whatsapp/chats');
            const data = await res.json();
            if (!Array.isArray(data)) { setChats([]); return; }

            // Leads nuevos: el primer fetch solo fija la referencia, así un
            // refresco de página no vuelve a avisar de fichas ya conocidas.
            if (initialLoadRef.current) {
                data.forEach((c: Chat) => { if (c.client?.id) knownClientIds.current.add(c.client.id); });
                initialLoadRef.current = false;
            } else {
                data.forEach((c: Chat) => {
                    if (c.client?.id && !knownClientIds.current.has(c.client.id)) {
                        knownClientIds.current.add(c.client.id);
                        const title = '🌟 Nuevo lead calificado';
                        const body = `La IA acaba de ingresar la receta y clasificar a ${c.client.name}.`;
                        const icon = 'https://cdn-icons-png.flaticon.com/512/4712/4712139.png';
                        avisar(title, body, icon, () => setSelectedChat(c));
                        if ('Notification' in window && Notification.permission === 'granted') {
                            new Notification(title, { body, icon });
                        }
                    }
                });
            }

            const sorted = [...data].sort((a: Chat, b: Chat) => {
                const aPin = (a.chatLabels || []).includes('Fijado') ? 1 : 0;
                const bPin = (b.chatLabels || []).includes('Fijado') ? 1 : 0;
                if (aPin !== bPin) return bPin - aPin;
                const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
                const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
                return tb - ta;
            });
            setChats(sorted);
            try { localStorage.setItem(INBOX_CACHE_KEY, JSON.stringify(sorted)); } catch { /* storage lleno */ }

            // Abrir el chat que pide la URL (?phone=), creándolo si hace falta.
            if (urlPhone && !handledUrlPhoneRef.current) {
                handledUrlPhoneRef.current = true;
                const urlText = searchParams.get('text');
                const normalizado = urlPhone.replace(/\D/g, '');
                const objetivo = sorted.find((c: Chat) =>
                    c.waId.includes(normalizado)
                    || (c.client?.phone && c.client.phone.replace(/\D/g, '').includes(normalizado)));
                if (objetivo) {
                    setSelectedChat(objetivo);
                    if (urlText) setNewMessage(urlText);
                } else {
                    try {
                        const response = await fetch('/api/whatsapp/chats', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ phone: urlPhone }),
                        });
                        if (response.ok) {
                            const nuevo: Chat = await response.json();
                            setChats(prev => (prev.some(c => c.id === nuevo.id) ? prev : [nuevo, ...prev]));
                            setSelectedChat(nuevo);
                            if (urlText) setNewMessage(urlText);
                        } else {
                            alert(`No hay conversación de WhatsApp iniciada con el número ${urlPhone}. Podés mandarle el primer mensaje desde tu celular para abrir el chat.`);
                        }
                    } catch (err) {
                        console.error('Error al iniciar chat automático:', err);
                        alert(`No hay conversación de WhatsApp iniciada con el número ${urlPhone}. Podés mandarle el primer mensaje desde tu celular para abrir el chat.`);
                    }
                }
            }

            // Refrescar el chat abierto con botEnabled/etiquetas frescas.
            setSelectedChat(prev => (prev ? sorted.find((c: Chat) => c.id === prev.id) || prev : null));
        } catch { setChats([]); }
        // `urlPhone`/`searchParams` se leen una sola vez (handledUrlPhoneRef), por
        // eso no van en las dependencias: recrear este fetcher relanzaría el
        // socket y el polling del efecto de abajo en cada cambio de la URL.
    }, [avisar]);

    const fetchAgent = useCallback(async () => {
        try {
            const res = await fetch('/api/whatsapp/agent');
            const data = await res.json();
            setAgentPrompt(data.prompt || PROMPT_BASE_POR_DEFECTO);
            setDailyContext(data.dailyContext || '');
            setAgentEnabled(data.enabled || false);
            // Si el servicio no informa el campo (versión vieja), asumimos
            // encendido para no mostrar "Pausados" cuando en realidad están activos.
            setFollowupsEnabled(data.followupsEnabled !== false);
        } catch { /* el panel queda con lo último que sepa */ }
    }, []);

    useEffect(() => { fetchTags(); }, [fetchTags]);
    useEffect(() => { fetchAgent(); }, [fetchAgent]);

    // ── Socket + polling de respaldo ──────────────
    useEffect(() => {
        let socket: { disconnect: () => void } | null = null;

        const initSocket = async () => {
            try {
                const res = await fetch('/api/whatsapp/status');
                const data = await res.json();
                setStatus(data);
                setLoadingStatus(false);

                // El socketUrl que reporta el status va antes que el origin — sin
                // ese fallback el buzón se conectaba a un socket muerto.
                const socketUrl = process.env.NEXT_PUBLIC_WA_URL || data.socketUrl
                    || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3100');
                const { io } = await import('socket.io-client');
                const s = io(socketUrl, {
                    // Token fresco por intento de conexión: el socketToken expira
                    // (24h) y el bot se reinicia con cada deploy; con un token
                    // estático la reconexión quedaba rechazada hasta recargar la
                    // página, y el buzón moría en silencio.
                    auth: (cb: (data: object) => void) => {
                        fetch('/api/whatsapp/status')
                            .then(r => r.json())
                            .then(d => cb({ token: d.socketToken }))
                            .catch(() => cb({ token: data.socketToken }));
                    },
                });
                socket = s;

                s.on('bot_status', (d: WhatsAppStatus) => {
                    setStatus(d);
                    if (d.agentEnabled !== undefined) setAgentEnabled(d.agentEnabled);
                    if (d.followupsEnabled !== undefined) setFollowupsEnabled(d.followupsEnabled);
                    if (d.prompt !== undefined) setAgentPrompt(d.prompt);
                    setLoadingStatus(false);
                });

                s.on('chat_updated', ({ chatId }: { chatId: string }) => {
                    fetchChats();
                    if (selectedChatRef.current?.id === chatId) fetchMessages(chatId);
                });

                s.on('new_message_received', ({ chatId, name, content }: { chatId: string; name: string; content: string }) => {
                    if (selectedChatRef.current?.id === chatId) return;
                    // Sin sonido (pedido de Ishtar 27/8): el aviso visual alcanza.
                    const title = `📩 Mensaje de ${name}`;
                    const icon = 'https://cdn-icons-png.flaticon.com/512/124/124034.png';
                    avisar(title, content, icon, () => {
                        setChats(prev => {
                            const c = prev.find(ch => ch.id === chatId);
                            if (c) setSelectedChat(c);
                            return prev;
                        });
                    });
                    if ('Notification' in window && Notification.permission === 'granted') {
                        new Notification(title, { body: content, icon });
                    }
                });

                s.on('chat_summary_updated', ({ chatId, summary }: { chatId: string; summary: string }) => {
                    fetchChats();
                    if (selectedChatRef.current?.id === chatId) {
                        setSelectedChat(prev => (prev ? { ...prev, chatSummary: summary } : null));
                    }
                });

                s.on('task_created', ({ description }: { description: string }) => {
                    avisar('📅 Tarea programada', `La ficha inteligente agendó: ${description}`);
                });
            } catch (err) {
                console.error('Failed to initialize socket connection:', err);
            }
        };

        initSocket();
        fetchChats();

        pollRef.current = setInterval(() => {
            fetchStatus();
            fetchChats();
            if (selectedChatRef.current) fetchMessages(selectedChatRef.current.id);
        }, 15000);

        return () => {
            socket?.disconnect();
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [fetchStatus, fetchChats, fetchMessages, avisar]);

    // ── Buscador dentro de la conversación ────────
    // Los mensajes se traen todos (el endpoint no pagina), así que la búsqueda
    // es sobre lo que ya está en memoria: encuentra en toda la charla.
    const chatSearchHits = useMemo(() => {
        const q = normalizarBusqueda(chatSearch.trim());
        if (!q) return [] as string[];
        return messages.filter(m => normalizarBusqueda(m.content || '').includes(q)).map(m => m.id).filter(Boolean);
    }, [chatSearch, messages]);

    useEffect(() => { setChatSearchIdx(0); }, [chatSearch]);

    // Cerrar el buscador al cambiar de conversación: los resultados eran de la otra.
    useEffect(() => {
        setShowChatSearch(false);
        setChatSearch('');
    }, [selectedChat?.id]);

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

    // ── Acciones ──────────────────────────────────
    const nombreDeUsuario = () => {
        try {
            const stored = localStorage.getItem('user');
            if (stored) return JSON.parse(stored).name || 'CRM';
        } catch { /* sin sesión guardada */ }
        return 'CRM';
    };

    const selectChat = async (chat: Chat) => {
        setSelectedChat(chat);
        setShowLabelPicker(false);
        await fetchMessages(chat.id);
        if (chat.unreadCount > 0) {
            setChats(prev => prev.map(c => (c.id === chat.id ? { ...c, unreadCount: 0 } : c)));
            setSelectedChat(prev => (prev ? { ...prev, unreadCount: 0 } : prev));
            fetch(`/api/whatsapp/chats/${chat.id}/mark-read`, { method: 'POST' }).catch(() => {});
        }
    };

    const sendMessage = async () => {
        if ((!newMessage.trim() && !selectedImage) || !selectedChat || sending) return;

        const messageText = newMessage;
        const messageImage = selectedImage;
        const currentChatId = selectedChat.id;
        const currentNombre = (selectedChat.client?.name || selectedChat.profileName || '').split(' ')[0];
        const userName = nombreDeUsuario();

        setNewMessage('');
        setSelectedImage(null);

        const optimista: Message = {
            id: 'temp_' + Date.now(),
            chatId: currentChatId,
            direction: 'OUTBOUND',
            type: messageImage ? 'image' : 'text',
            content: messageText || (messageImage ? '📷 Imagen' : ''),
            mediaUrl: messageImage ? messageImage.base64 : undefined,
            status: 'PENDING',
            senderName: userName,
            createdAt: new Date().toISOString(),
        };
        setMessages(prev => [...prev, optimista]);
        conversacionRef.current?.irAlFinal();

        setSending(true);
        try {
            const body: Record<string, unknown> = { chatId: currentChatId, message: messageText, senderName: userName };
            if (messageImage) body.media = messageImage;
            const res = await fetch('/api/whatsapp/send', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                // El optimista se retira: nada salió.
                setMessages(prev => prev.filter(m => m.id !== optimista.id));
                if (res.status === 409 && err?.needsTemplate) {
                    // API oficial: el cliente no escribió en 24 h. Se ofrece la
                    // plantilla "retomar conversación" con el texto como tema.
                    setTemplatePrompt({ chatId: currentChatId, texto: messageText, nombre: currentNombre });
                } else {
                    alert(`❌ No se pudo enviar: ${err?.error || `HTTP ${res.status}`}`);
                }
                setSending(false);
                return;
            }
            // Si el humano escribe desde la interfaz, el bot se apaga en el acto.
            setSelectedChat(prev => (prev && prev.id === currentChatId ? { ...prev, botEnabled: false } : prev));
            setChats(prev => prev.map(c => (c.id === currentChatId ? { ...c, botEnabled: false } : c)));
            await fetchMessages(currentChatId);
        } catch (e) {
            // El fetch lanzó (red caída): nada salió, se retira el optimista.
            console.error('Error enviando:', e);
            setMessages(prev => prev.filter(m => m.id !== optimista.id));
            alert('❌ No se pudo enviar: sin conexión con el servidor. Probá de nuevo.');
        }
        setSending(false);
    };

    const sendAudio = async (base64: string, mimetype: string) => {
        if (!selectedChat || sending) return;
        const currentChatId = selectedChat.id;
        const userName = nombreDeUsuario();

        const optimista: Message = {
            id: 'temp_' + Date.now(),
            chatId: currentChatId,
            direction: 'OUTBOUND',
            type: 'audio',
            content: '🎵 Audio',
            mediaUrl: base64,
            status: 'PENDING',
            senderName: userName,
            createdAt: new Date().toISOString(),
        };
        setMessages(prev => [...prev, optimista]);
        conversacionRef.current?.irAlFinal();

        setSending(true);
        try {
            const res = await fetch('/api/whatsapp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chatId: currentChatId,
                    message: '',
                    media: { base64, mimetype, filename: `audio_${Date.now()}.webm` },
                    senderName: userName,
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                setMessages(prev => prev.filter(m => m.id !== optimista.id));
                alert(res.status === 409
                    ? 'El cliente no escribió en las últimas 24 h: los audios solo se pueden mandar con la conversación abierta. Mandale primero la plantilla "retomar conversación".'
                    : `❌ No se pudo enviar el audio: ${err?.error || `HTTP ${res.status}`}`);
                setSending(false);
                return;
            }
            setSelectedChat(prev => (prev && prev.id === currentChatId ? { ...prev, botEnabled: false } : prev));
            setChats(prev => prev.map(c => (c.id === currentChatId ? { ...c, botEnabled: false } : c)));
            await fetchMessages(currentChatId);
        } catch (e) {
            console.error('Error enviando audio:', e);
            setMessages(prev => prev.filter(m => m.id !== optimista.id));
            alert('❌ No se pudo enviar el audio: sin conexión con el servidor. Probá de nuevo.');
        }
        setSending(false);
    };

    /**
     * Respuesta rápida que es plantilla oficial: va directo como plantilla
     * (forceTemplate). Funciona con la ventana de 24 h abierta o cerrada, y el
     * texto es EXACTAMENTE el aprobado en Meta.
     */
    const sendQuickTemplate = async (templateName: TemplateName) => {
        if (!selectedChat || sending) return;
        const chat = selectedChat;
        const def = WHATSAPP_TEMPLATES[templateName];
        const nombre = (chat.client?.name || chat.profileName || '').split(' ')[0] || 'cliente';

        const bodyParams: string[] = [];
        for (const p of def.params as readonly { label: string }[]) {
            if (p.label.includes('saludo')) {
                bodyParams.push(saludoSegunHora());
            } else if (p.label.includes('producto')) {
                // pedido_resena: los productos de la última venta, como en el panel de reseñas.
                let productos = 'anteojos nuevos';
                if (chat.client?.id) {
                    try {
                        const res = await fetch(`/api/contacts/${chat.client.id}`);
                        if (res.ok) {
                            const clientData = await res.json();
                            const lastSale = clientData.orders?.find((o: { orderType: string; isDeleted: boolean }) => o.orderType === 'SALE' && !o.isDeleted);
                            const names = lastSale?.items
                                ?.map((it: { product?: { name?: string }; productNameSnapshot?: string }) => it.product?.name || it.productNameSnapshot)
                                .filter(Boolean).join(', ');
                            if (names) productos = names;
                        }
                    } catch (e) {
                        console.error('Error buscando la última venta para la reseña', e);
                    }
                }
                bodyParams.push(productos);
            } else {
                bodyParams.push(nombre);
            }
        }

        const preview = renderTemplate(templateName, bodyParams);
        if (!window.confirm(`Se envía a ${chat.client?.name || chat.profileName} como plantilla aprobada de WhatsApp:\n\n${preview}\n\n¿Enviar?`)) return;

        setSending(true);
        try {
            const res = await fetch('/api/whatsapp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chatId: chat.id, message: '', forceTemplate: true, template: { name: def.name, bodyParams } }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                alert(`❌ No se pudo enviar la plantilla: ${err?.error || `HTTP ${res.status}`}`);
            } else {
                setSelectedChat(prev => (prev ? { ...prev, botEnabled: false } : prev));
                setChats(prev => prev.map(c => (c.id === chat.id ? { ...c, botEnabled: false } : c)));
                await fetchMessages(chat.id);
            }
        } catch (e) {
            console.error('Error enviando plantilla:', e);
            alert('❌ No se pudo enviar la plantilla: sin conexión con el servidor. Probá de nuevo.');
        }
        setSending(false);
    };

    const toggleBot = async (chatId: string, enabled: boolean) => {
        try {
            await fetch(`/api/whatsapp/chats/${chatId}/bot`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ botEnabled: enabled }),
            });
            setSelectedChat(prev => (prev && prev.id === chatId ? { ...prev, botEnabled: enabled } : prev));
            setChats(prev => prev.map(c => (c.id === chatId ? { ...c, botEnabled: enabled } : c)));
        } catch (e) {
            console.error('Error al togglear bot:', e);
        }
    };

    const updateChat = async (chatId: string, patch: Partial<Pick<Chat, 'chatLabels' | 'archived' | 'botEnabled' | 'chatSummary'>>) => {
        try {
            await fetch(`/api/whatsapp/chats/${chatId}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
            });
            setChats(prev => prev.map(c => (c.id === chatId ? { ...c, ...patch } : c)));
            setSelectedChat(prev => (prev && prev.id === chatId ? { ...prev, ...patch } : prev));
        } catch (e) {
            console.error('Error actualizando chat:', e);
        }
    };

    const toggleLabel = async (label: string) => {
        if (!selectedChat) return;
        const current = selectedChat.chatLabels || [];
        const next = current.includes(label) ? current.filter(l => l !== label) : [...current, label];
        await updateChat(selectedChat.id, { chatLabels: next });
        if (label === 'Cancelar Bot' && next.includes(label)) {
            await updateChat(selectedChat.id, { botEnabled: false });
        }
        if (label === 'Fijado' && selectedChat.client?.id) {
            try {
                await fetch(`/api/contacts/${selectedChat.client.id}`, {
                    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ isFavorite: next.includes('Fijado') }),
                });
            } catch (e) { console.error('Error actualizando favorito:', e); }
        }
    };

    const togglePinChat = async (chat: Chat) => {
        const current = chat.chatLabels || [];
        const eraFav = current.includes('Fijado');
        const next = eraFav ? current.filter(l => l !== 'Fijado') : [...current, 'Fijado'];
        await updateChat(chat.id, { chatLabels: next });

        setChats(prev => prev.map(c => (c.id === chat.id && c.client ? { ...c, client: { ...c.client, isFavorite: !eraFav } } : c)));
        setSelectedChat(prev => (prev && prev.id === chat.id && prev.client ? { ...prev, client: { ...prev.client, isFavorite: !eraFav } } : prev));

        if (chat.client?.id) {
            try {
                await fetch(`/api/contacts/${chat.client.id}`, {
                    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isFavorite: !eraFav }),
                });
            } catch (e) { console.error('Error actualizando favorito:', e); }
        }
    };

    const extractClientFromChat = async () => {
        if (!selectedChat) return;
        setExtracting(true);
        setExtractedClient(null);
        try {
            const res = await fetch(`/api/whatsapp/chats/${selectedChat.id}/extract-client`, { method: 'POST' });
            const data = await res.json();
            if (res.ok && data.extracted) {
                setExtractedClient(data.extracted);
            } else {
                alert(data.error || 'No se pudieron extraer datos');
            }
        } catch (e) {
            console.error('Error extrayendo datos:', e);
            alert('Error al analizar la conversación');
        }
        setExtracting(false);
    };

    const confirmCreateClient = async () => {
        if (!extractedClient || !selectedChat) return;
        if (!extractedClient.name?.trim() || !extractedClient.contactSource?.trim()) {
            alert('El nombre y el origen de contacto son obligatorios.');
            return;
        }
        const chatId = selectedChat.id;
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
                    creationMethod: 'ASISTENTE_WHATSAPP',
                }),
            });
            const nuevo = await res.json();

            if (!res.ok) {
                if (nuevo.isDuplicate && nuevo.existingClient) {
                    if (window.confirm(`${nuevo.details}\n\n¿Querés vincular este chat a la ficha existente de ${nuevo.existingClient.name}?`)) {
                        await fetch(`/api/whatsapp/chats/${chatId}`, {
                            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ clientId: nuevo.existingClient.id }),
                        });
                        const vinculado = {
                            id: nuevo.existingClient.id,
                            name: nuevo.existingClient.name,
                            phone: nuevo.existingClient.phone,
                            status: nuevo.existingClient.status || 'CONTACT',
                        };
                        setSelectedChat(prev => (prev ? { ...prev, client: vinculado } : prev));
                        setChats(prev => prev.map(c => (c.id === chatId ? { ...c, client: vinculado } : c)));
                        setExtractedClient(null);
                    }
                } else {
                    alert(nuevo.error || nuevo.details || 'Error al crear contacto');
                }
                setCreatingClient(false);
                return;
            }

            await fetch(`/api/whatsapp/chats/${chatId}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: nuevo.id }),
            });
            if (extractedClient.notes) {
                await fetch(`/api/contacts/${nuevo.id}/interactions`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'NOTE', content: `[HITO] ${extractedClient.notes}` }),
                });
            }
            const creado = { id: nuevo.id, name: nuevo.name, phone: nuevo.phone, status: nuevo.status };
            setSelectedChat(prev => (prev ? { ...prev, client: creado } : prev));
            setChats(prev => prev.map(c => (c.id === chatId ? { ...c, client: creado } : c)));
            setExtractedClient(null);
        } catch (e) {
            console.error('Error creando cliente:', e);
            alert('Error al crear la ficha');
        }
        setCreatingClient(false);
    };

    const handleCreateTask = async () => {
        if (!selectedChat?.client?.id || !taskDraft.description.trim()) return;
        setCreatingTask(true);
        try {
            const res = await fetch(`/api/contacts/${selectedChat.client.id}/tasks`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(taskDraft),
            });
            if (res.ok) {
                setShowTaskModal(false);
                setTaskDraft({ description: '', dueDate: new Date().toISOString().split('T')[0] });
                avisar('Tarea creada', 'Tarea guardada exitosamente.');
            } else {
                avisar('Error', 'No se pudo crear la tarea');
            }
        } catch (error) {
            console.error('Error creating task', error);
        }
        setCreatingTask(false);
    };

    const handleSync = async () => {
        if (syncing) return;
        setSyncing(true);
        try {
            const res = await fetch('/api/whatsapp/sync', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                alert('Sincronización iniciada. Los chats y mensajes se actualizarán en segundo plano en unos segundos.');
                setTimeout(async () => {
                    await fetchChats();
                    if (selectedChatRef.current) await fetchMessages(selectedChatRef.current.id);
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

    const saveAgent = async () => {
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
            <InAppToasts avisos={avisos} onCerrar={id => setAvisos(prev => prev.filter(n => n.id !== id))} />

            {/* La jerarquía de esta barra (estado · interruptores · acción ·
                el resto en un menú) vive documentada en el componente. */}
            <InboxHeader
                conectado={status.connected}
                telefono={status.phone}
                esApiOficial={esApiOficial}
                calidad={status.qualityRating}
                error={status.error}
                asistenteActivo={agentEnabled}
                onToggleAsistente={next => {
                    setAgentEnabled(next);
                    fetch('/api/whatsapp/agent', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: next }),
                    });
                }}
                seguimientosActivos={followupsEnabled}
                onToggleSeguimientos={next => {
                    // Apagar es el botón de pánico: no pedimos confirmación.
                    // Encender sí la pide, porque reanuda mensajes salientes
                    // automáticos a clientes reales.
                    if (next && !confirm('Vas a reactivar los seguimientos automáticos por WhatsApp.\n\nEl bot va a volver a escribirle solo a los clientes con presupuestos pendientes y charlas sin respuesta. ¿Confirmás?')) return;
                    setFollowupsEnabled(next);
                    fetch('/api/whatsapp/agent', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ followupsEnabled: next }),
                    }).then(res => { if (!res.ok) throw new Error(); }).catch(() => {
                        // Si el servicio no confirmó, la UI no puede quedarse
                        // mostrando un estado que no rige.
                        setFollowupsEnabled(!next);
                        alert('No se pudo cambiar el estado de los seguimientos: el servidor de WhatsApp no respondió. El estado real no cambió.');
                    });
                }}
                sincronizando={syncing}
                onSincronizar={handleSync}
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
                    onGuardar={saveAgent}
                    onCerrar={() => setShowConfig(false)}
                />
            )}

            {/* El buzón se muestra de una: mientras el status está en vuelo
                (loadingStatus) asumimos conectado y pintamos la lista — los chats
                vienen de la DB, no dependen de la sesión. La pantalla de
                desconectado aparece solo cuando el status YA respondió que no hay
                sesión; antes tapaba todo hasta 100 s si wa-service estaba ocupado. */}
            {!status.connected && !loadingStatus ? (
                <ConnectionState esApiOficial={esApiOficial} qr={status.qr} error={status.error} onReintentar={fetchStatus} />
            ) : (
                <div className="flex flex-1 min-h-0 overflow-hidden m-4 lg:m-6 gap-6">
                    <div className={`w-[360px] bg-white/70 dark:bg-stone-900/70 backdrop-blur-2xl rounded-[2rem] border border-stone-200 dark:border-white/10 flex flex-col shadow-xl ${selectedChat ? 'hidden lg:flex' : 'flex'}`}>
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
                            chatSeleccionadoId={selectedChat?.id ?? null}
                            asistenteGlobalActivo={agentEnabled}
                            onSeleccionar={selectChat}
                            onFijar={togglePinChat}
                            onArchivar={chat => {
                                updateChat(chat.id, { archived: !chat.archived });
                                if (selectedChat?.id === chat.id) setSelectedChat(null);
                            }}
                        />
                    </div>

                    <div className="flex-1 bg-white/70 dark:bg-stone-900/70 backdrop-blur-2xl rounded-[2rem] border border-stone-200 dark:border-white/10 shadow-xl overflow-hidden flex flex-col">
                        {selectedChat ? (
                            <>
                                <ChatHeader
                                    chat={selectedChat}
                                    tags={dbTags}
                                    esApiOficial={esApiOficial}
                                    onVolver={() => setSelectedChat(null)}
                                    onAbrirResumen={() => {
                                        setSummaryModalChat(selectedChat);
                                        setEditingSummary(selectedChat.chatSummary || '');
                                    }}
                                    onCrearTarea={() => setShowTaskModal(true)}
                                    extrayendoFicha={extracting}
                                    onCrearFicha={extractClientFromChat}
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
                                        updateChat(selectedChat.id, { archived: !selectedChat.archived });
                                        setSelectedChat(null);
                                    }}
                                    onCambiarEtiquetas={etiquetas => updateChat(selectedChat.id, { chatLabels: etiquetas })}
                                    onToggleBot={activo => toggleBot(selectedChat.id, activo)}
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
                                    chatId={selectedChat.id}
                                    inicialContacto={inicialDe(selectedChat)}
                                    busqueda={chatSearch}
                                    idResultadoActivo={chatSearchActiveId}
                                />

                                <Composer
                                    texto={newMessage}
                                    onTexto={setNewMessage}
                                    adjunto={selectedImage}
                                    onAdjunto={setSelectedImage}
                                    enviando={sending}
                                    onEnviar={sendMessage}
                                    onEnviarAudio={sendAudio}
                                    onPlantillaRapida={(qr: QuickReply) => { if (qr.templateName) sendQuickTemplate(qr.templateName); }}
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
                    onSent={() => { if (selectedChat) fetchMessages(selectedChat.id); fetchChats(); }}
                />
            )}

            {showTagManager && (
                <TagManagerModal tags={dbTags} onRecargar={fetchTags} onCerrar={() => setShowTagManager(false)} />
            )}

            {showTaskModal && selectedChat?.client && (
                <TaskModal
                    borrador={taskDraft}
                    onBorrador={setTaskDraft}
                    guardando={creatingTask}
                    onGuardar={handleCreateTask}
                    onCerrar={() => setShowTaskModal(false)}
                />
            )}

            {extractedClient && (
                <CreateClientModal
                    datos={extractedClient}
                    onDatos={setExtractedClient}
                    creando={creatingClient}
                    onConfirmar={confirmCreateClient}
                    onCerrar={() => setExtractedClient(null)}
                />
            )}

            {summaryModalChat && (
                <SummaryModal
                    texto={editingSummary}
                    onTexto={setEditingSummary}
                    onGuardar={async () => {
                        await updateChat(summaryModalChat.id, { chatSummary: editingSummary });
                        setSummaryModalChat(null);
                    }}
                    onCerrar={() => setSummaryModalChat(null)}
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

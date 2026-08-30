'use client';

/**
 * UN SOLO WhatsApp para todo el panel.
 *
 * Hasta acá cada pestaña abría TRES sockets al bot en paralelo — el buzón
 * (`admin/whatsapp/page.tsx`), la badge de la barra lateral y el toaster de
 * leads — y cada uno pedía su propio token firmado, escuchaba los mismos
 * eventos y emitía sus propios carteles del sistema. De ahí venían los avisos
 * repetidos y tres conexiones por persona conectada.
 *
 * Acá hay un socket, un contador y un único emisor de notificaciones.
 *
 * DOS CONTEXTOS a propósito (mismo patrón que PulsoProvider): los datos cambian
 * con cada mensaje y las acciones nunca. Si fueran uno solo, el panel entero
 * —que este provider envuelve— se re-renderizaría con cada latido solo porque
 * el objeto de acciones sería nuevo.
 *
 * CARGA PEREZOSA de la lista: en una pantalla cualquiera del CRM solo hace falta
 * el número de la badge, así que se pide `unread-count` cada 2 minutos. La lista
 * completa (y el polling de 15 s) arranca recién cuando alguien mira el buzón:
 * la pantalla completa o la ventana flotante llaman a `activarBuzon()`.
 */

import {
    createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import type { Chat, Message, Tag, VistaWhatsApp, WhatsAppStatus } from './types';
import { WHATSAPP_TEMPLATES, renderTemplate, type TemplateName } from '@/lib/whatsapp/templates';
import { saludoSegunHora } from './format';

const INBOX_CACHE_KEY = 'wa-inbox-cache-v1';
const LATIDO_BUZON_MS = 15000;
const LATIDO_FONDO_MS = 120000;

/** Un aviso para el toaster global. */
export interface EventoWhatsApp {
    id: string;
    tipo: 'LEAD' | 'BOT_ERROR' | 'MESSAGE' | 'TAREA';
    data: Record<string, unknown>;
}

/** Qué devolvió un envío: bien, la ventana de 24 h cerrada, o un error. */
export type ResultadoEnvio =
    | { estado: 'ok' }
    | { estado: 'necesita-plantilla'; chatId: string; texto: string; nombre: string }
    | { estado: 'error'; mensaje: string };

interface DatosWhatsApp {
    status: WhatsAppStatus;
    cargandoStatus: boolean;
    esApiOficial: boolean;
    chats: Chat[];
    chatsCargados: boolean;
    unreadTotal: number;
    selectedChatId: string | null;
    chatSeleccionado: Chat | null;
    messagesByChat: Record<string, Message[]>;
    tags: Tag[];
    agentEnabled: boolean;
    followupsEnabled: boolean;
    /** Prompt que empujó el servicio por `bot_status` (no el editado en pantalla). */
    promptDelServicio: string | null;
    vista: VistaWhatsApp;
    eventos: EventoWhatsApp[];
    enviando: boolean;
}

interface AccionesWhatsApp {
    /** Empieza a traer la lista completa y a latir cada 15 s. Devuelve la baja. */
    activarBuzon: () => () => void;
    abrirChat: (chatId: string) => Promise<void>;
    cerrarChat: () => void;
    setVista: (v: VistaWhatsApp) => void;
    marcarLeido: (chatId: string) => void;
    enviar: (chatId: string, texto: string, media?: { base64: string; mimetype: string; filename: string }) => Promise<ResultadoEnvio>;
    enviarPlantilla: (chatId: string, templateName: TemplateName, confirmar?: boolean) => Promise<ResultadoEnvio>;
    actualizarChat: (chatId: string, patch: Partial<Pick<Chat, 'chatLabels' | 'archived' | 'botEnabled' | 'chatSummary'>>) => Promise<void>;
    aplicarChatLocal: (chatId: string, patch: Partial<Chat>) => void;
    toggleBot: (chatId: string, activo: boolean) => Promise<void>;
    refrescarChats: () => Promise<void>;
    refrescarMensajes: (chatId: string) => Promise<void>;
    refrescarStatus: () => Promise<void>;
    refrescarTags: () => Promise<void>;
    setAgentEnabled: (v: boolean) => void;
    setFollowupsEnabled: (v: boolean) => void;
    descartarEvento: (id: string) => void;
    /** El ÚNICO emisor de carteles del sistema operativo del CRM para WhatsApp. */
    notificar: (aviso: { titulo: string; cuerpo: string; icono?: string; chatId?: string; ir?: string }) => void;
}

const DATOS_VACIOS: DatosWhatsApp = {
    status: { connected: false, phone: null, qr: null, agentEnabled: false },
    cargandoStatus: true,
    esApiOficial: false,
    chats: [],
    chatsCargados: false,
    unreadTotal: 0,
    selectedChatId: null,
    chatSeleccionado: null,
    messagesByChat: {},
    tags: [],
    agentEnabled: false,
    followupsEnabled: true,
    promptDelServicio: null,
    vista: 'lista',
    eventos: [],
    enviando: false,
};

const DatosContext = createContext<DatosWhatsApp>(DATOS_VACIOS);
const AccionesContext = createContext<AccionesWhatsApp | null>(null);

export const useWhatsAppDatos = () => useContext(DatosContext);

export function useWhatsAppAcciones(): AccionesWhatsApp {
    const ctx = useContext(AccionesContext);
    if (!ctx) throw new Error('useWhatsAppAcciones necesita <WhatsAppProvider> arriba en el árbol.');
    return ctx;
}

/** Fijados arriba, después por último mensaje. */
function ordenar(lista: Chat[]): Chat[] {
    return [...lista].sort((a, b) => {
        const aPin = (a.chatLabels || []).includes('Fijado') ? 1 : 0;
        const bPin = (b.chatLabels || []).includes('Fijado') ? 1 : 0;
        if (aPin !== bPin) return bPin - aPin;
        const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return tb - ta;
    });
}

function nombreDeUsuario(): string {
    try {
        const stored = localStorage.getItem('user');
        if (stored) return JSON.parse(stored).name || 'CRM';
    } catch { /* sin sesión guardada */ }
    return 'CRM';
}

export function WhatsAppProvider({ children }: { children: ReactNode }) {
    const pathname = usePathname();

    const [status, setStatus] = useState<WhatsAppStatus>(DATOS_VACIOS.status);
    const [cargandoStatus, setCargandoStatus] = useState(true);
    const [chats, setChats] = useState<Chat[]>([]);
    const [chatsCargados, setChatsCargados] = useState(false);
    const [contadorRemoto, setContadorRemoto] = useState(0);
    const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
    const [messagesByChat, setMessagesByChat] = useState<Record<string, Message[]>>({});
    const [tags, setTags] = useState<Tag[]>([]);
    const [agentEnabled, setAgentEnabledState] = useState(false);
    const [followupsEnabled, setFollowupsEnabledState] = useState(true);
    const [promptDelServicio, setPromptDelServicio] = useState<string | null>(null);
    const [vista, setVista] = useState<VistaWhatsApp>('lista');
    const [eventos, setEventos] = useState<EventoWhatsApp[]>([]);
    const [enviando, setEnviando] = useState(false);

    // Refs para que las acciones sean estables y aun así vean el estado fresco.
    const selectedChatIdRef = useRef<string | null>(null);
    const buzonActivoRef = useRef(0);
    const chatsCargadosRef = useRef(false);
    const clientesConocidos = useRef<Set<string>>(new Set());
    const primeraCarga = useRef(true);
    /** `chats` fresco dentro de acciones que no deben depender de él. */
    const chatsRef = useRef<Chat[]>([]);

    useEffect(() => { chatsRef.current = chats; }, [chats]);
    useEffect(() => { selectedChatIdRef.current = selectedChatId; }, [selectedChatId]);
    useEffect(() => { chatsCargadosRef.current = chatsCargados; }, [chatsCargados]);

    // ── Avisos ────────────────────────────────────
    const descartarEvento = useCallback((id: string) => {
        setEventos(prev => prev.filter(e => e.id !== id));
    }, []);

    const agregarEvento = useCallback((tipo: EventoWhatsApp['tipo'], data: Record<string, unknown>, vidaMs = 8000) => {
        const id = `${tipo}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        setEventos(prev => [...prev, { id, tipo, data }]);
        setTimeout(() => descartarEvento(id), vidaMs);
    }, [descartarEvento]);

    /**
     * El único cartel del sistema operativo.
     *
     * No molesta si la persona ya está mirando ESE chat: ahí el mensaje aparece
     * solo en pantalla. `tag` deduplica por conversación (cinco mensajes del
     * mismo cliente no apilan cinco carteles) y `silent` porque la dueña pidió
     * sin sonido (27/8).
     */
    const notificar = useCallback((aviso: { titulo: string; cuerpo: string; icono?: string; chatId?: string; ir?: string }) => {
        if (typeof window === 'undefined' || !('Notification' in window)) return;
        if (Notification.permission !== 'granted') return;
        if (aviso.chatId && document.hasFocus() && selectedChatIdRef.current === aviso.chatId) return;

        try {
            const n = new Notification(aviso.titulo, {
                body: aviso.cuerpo,
                icon: aviso.icono,
                tag: aviso.chatId ? `wa-${aviso.chatId}` : undefined,
                silent: true,
            });
            if (aviso.ir) {
                n.onclick = () => { window.focus(); window.location.href = aviso.ir as string; };
            }
        } catch { /* el navegador puede rechazar la notificación: no es un error que valga reportar */ }
    }, []);

    useEffect(() => {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

    // ── Fetchers ──────────────────────────────────
    const refrescarStatus = useCallback(async () => {
        try {
            const res = await fetch('/api/whatsapp/status');
            setStatus(await res.json());
        } catch {
            setStatus({ connected: false, phone: null, qr: null, agentEnabled: false });
        }
        setCargandoStatus(false);
    }, []);

    const refrescarContador = useCallback(async () => {
        try {
            const res = await fetch('/api/whatsapp/chats/unread-count');
            const data = await res.json();
            if (typeof data.count === 'number') setContadorRemoto(data.count);
        } catch { /* un latido perdido no cambia nada: se reintenta */ }
    }, []);

    const refrescarMensajes = useCallback(async (chatId: string) => {
        try {
            const res = await fetch(`/api/whatsapp/chats/${chatId}/messages`);
            const data = await res.json();
            setMessagesByChat(prev => ({ ...prev, [chatId]: Array.isArray(data) ? data : [] }));
        } catch {
            setMessagesByChat(prev => ({ ...prev, [chatId]: prev[chatId] || [] }));
        }
    }, []);

    const refrescarTags = useCallback(async () => {
        try {
            const res = await fetch('/api/tags');
            const data = await res.json();
            if (Array.isArray(data)) setTags(data);
        } catch { /* las etiquetas quedan como estaban */ }
    }, []);

    const refrescarChats = useCallback(async () => {
        try {
            const res = await fetch('/api/whatsapp/chats');
            const data = await res.json();
            if (!Array.isArray(data)) return;

            // Leads nuevos: el primer fetch solo fija la referencia, así un
            // refresco de página no vuelve a avisar de fichas ya conocidas.
            if (primeraCarga.current) {
                data.forEach((c: Chat) => { if (c.client?.id) clientesConocidos.current.add(c.client.id); });
                primeraCarga.current = false;
            } else {
                data.forEach((c: Chat) => {
                    if (c.client?.id && !clientesConocidos.current.has(c.client.id)) {
                        clientesConocidos.current.add(c.client.id);
                        agregarEvento('LEAD', {
                            id: c.client.id, name: c.client.name, interest: '', source: 'WhatsApp',
                            hasPrescription: false, isLinked: false,
                        });
                    }
                });
            }

            const ordenados = ordenar(data);
            setChats(ordenados);
            setChatsCargados(true);
            try { localStorage.setItem(INBOX_CACHE_KEY, JSON.stringify(ordenados)); } catch { /* storage lleno */ }
        } catch { /* la lista queda con lo último bueno que se vio */ }
    }, [agregarEvento]);

    // Cache local: pinta la última lista conocida al instante. Solo alimenta el
    // primer render — las notificaciones de leads siguen ancladas al fetch real.
    useEffect(() => {
        try {
            const raw = localStorage.getItem(INBOX_CACHE_KEY);
            if (raw) {
                const cached = JSON.parse(raw);
                if (Array.isArray(cached) && cached.length > 0) {
                    setChats(prev => (prev.length === 0 ? cached : prev));
                }
            }
        } catch { /* cache corrupta */ }
    }, []);

    useEffect(() => { refrescarTags(); }, [refrescarTags]);

    // ── El socket ÚNICO ───────────────────────────
    useEffect(() => {
        let socket: { disconnect: () => void } | null = null;
        let cancelado = false;

        const init = async () => {
            try {
                const res = await fetch('/api/whatsapp/status');
                const data = await res.json();
                if (cancelado) return;
                setStatus(data);
                setCargandoStatus(false);
                setAgentEnabledState(!!data.agentEnabled);

                // El socketUrl que reporta el status va antes que el origin: sin
                // ese fallback el panel se conectaba a un socket muerto.
                const socketUrl = process.env.NEXT_PUBLIC_WA_URL || data.socketUrl
                    || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3100');
                const { io } = await import('socket.io-client');
                const s = io(socketUrl, {
                    // Token fresco por intento de conexión: expira a las 24 h y el
                    // bot se reinicia con cada deploy; con un token estático la
                    // reconexión quedaba rechazada hasta recargar la página.
                    auth: (cb: (d: object) => void) => {
                        fetch('/api/whatsapp/status')
                            .then(r => r.json())
                            .then(d => cb({ token: d.socketToken }))
                            .catch(() => cb({ token: data.socketToken }));
                    },
                });

                s.on('bot_status', (d: WhatsAppStatus) => {
                    setStatus(d);
                    if (d.agentEnabled !== undefined) setAgentEnabledState(d.agentEnabled);
                    if (d.followupsEnabled !== undefined) setFollowupsEnabledState(d.followupsEnabled);
                    if (d.prompt !== undefined) setPromptDelServicio(d.prompt);
                    setCargandoStatus(false);
                });

                s.on('chat_updated', ({ chatId }: { chatId: string }) => {
                    refrescarContador();
                    if (chatsCargadosRef.current) refrescarChats();
                    if (selectedChatIdRef.current === chatId) refrescarMensajes(chatId);
                });

                s.on('chat_read_status', () => {
                    refrescarContador();
                    if (chatsCargadosRef.current) refrescarChats();
                });

                s.on('new_message_received', (d: { chatId: string; name: string; phone: string; content: string }) => {
                    refrescarContador();
                    if (chatsCargadosRef.current) refrescarChats();
                    if (selectedChatIdRef.current === d.chatId) {
                        refrescarMensajes(d.chatId);
                        return; // ya lo está mirando: ni toast ni cartel
                    }
                    agregarEvento('MESSAGE', { ...d });
                    notificar({
                        titulo: `Mensaje de ${d.name}`,
                        cuerpo: d.content,
                        icono: 'https://cdn-icons-png.flaticon.com/512/124/124034.png',
                        chatId: d.chatId,
                        // El buzón abre el chat por ?phone=; ?id= no lo maneja.
                        ir: `/admin/whatsapp?phone=${d.phone}`,
                    });
                });

                s.on('chat_summary_updated', ({ chatId, summary }: { chatId: string; summary: string }) => {
                    setChats(prev => prev.map(c => (c.id === chatId ? { ...c, chatSummary: summary } : c)));
                });

                s.on('lead_created', (d: Record<string, unknown>) => {
                    agregarEvento('LEAD', d);
                    const esVinculado = !!d.isLinked;
                    notificar({
                        titulo: esVinculado ? `🔗 Ficha vinculada: ${d.name}` : `🌟 Nuevo lead: ${d.name}`,
                        cuerpo: esVinculado
                            ? 'Se vinculó la conversación a la ficha existente.'
                            : `Interés: ${d.interest}${d.hasPrescription ? ' · Envió receta ✅' : ''}`,
                        icono: esVinculado
                            ? 'https://cdn-icons-png.flaticon.com/512/3256/3256114.png'
                            : 'https://cdn-icons-png.flaticon.com/512/4712/4712139.png',
                        ir: `/admin/contactos?id=${d.id}`,
                    });
                });

                s.on('bot_error', (d: Record<string, unknown>) => {
                    // Quién puede verlo lo decide el toaster (solo ADMIN).
                    agregarEvento('BOT_ERROR', d, 15000);
                    notificar({
                        titulo: `⚠️ Bot desactivado: ${d.name}`,
                        cuerpo: 'Límite de cuota / crédito agotado en Gemini.',
                        icono: 'https://cdn-icons-png.flaticon.com/512/564/564619.png',
                        ir: `/admin/whatsapp?phone=${d.phone}`,
                    });
                });

                s.on('task_created', ({ description }: { description: string }) => {
                    agregarEvento('TAREA', { description });
                });

                if (cancelado) { s.disconnect(); return; }
                socket = s;
            } catch (err) {
                console.error('No se pudo abrir el socket de WhatsApp:', err);
            }
        };

        init();
        refrescarContador();

        return () => { cancelado = true; socket?.disconnect(); };
    }, [refrescarChats, refrescarContador, refrescarMensajes, agregarEvento, notificar]);

    // ── El latido ─────────────────────────────────
    // 15 s mirando el buzón; 2 minutos de fondo, donde solo importa la badge.
    const [buzonActivo, setBuzonActivo] = useState(0);
    const enPaginaBuzon = pathname === '/admin/whatsapp';
    const mirandoBuzon = enPaginaBuzon || buzonActivo > 0;

    useEffect(() => {
        const latir = () => {
            refrescarStatus();
            refrescarContador();
            if (mirandoBuzon) {
                refrescarChats();
                if (selectedChatIdRef.current) refrescarMensajes(selectedChatIdRef.current);
            }
        };
        if (mirandoBuzon && !chatsCargadosRef.current) refrescarChats();
        const t = setInterval(latir, mirandoBuzon ? LATIDO_BUZON_MS : LATIDO_FONDO_MS);
        return () => clearInterval(t);
    }, [mirandoBuzon, refrescarStatus, refrescarContador, refrescarChats, refrescarMensajes]);

    // ── Acciones ──────────────────────────────────
    const activarBuzon = useCallback(() => {
        buzonActivoRef.current += 1;
        setBuzonActivo(buzonActivoRef.current);
        return () => {
            buzonActivoRef.current = Math.max(0, buzonActivoRef.current - 1);
            setBuzonActivo(buzonActivoRef.current);
        };
    }, []);

    const aplicarChatLocal = useCallback((chatId: string, patch: Partial<Chat>) => {
        setChats(prev => prev.map(c => (c.id === chatId ? { ...c, ...patch } : c)));
    }, []);

    const marcarLeido = useCallback((chatId: string) => {
        setChats(prev => prev.map(c => (c.id === chatId ? { ...c, unreadCount: 0 } : c)));
        setContadorRemoto(prev => Math.max(0, prev - 1));
        fetch(`/api/whatsapp/chats/${chatId}/mark-read`, { method: 'POST' })
            .then(() => refrescarContador())
            .catch(() => {});
    }, [refrescarContador]);

    const abrirChat = useCallback(async (chatId: string) => {
        setSelectedChatId(chatId);
        selectedChatIdRef.current = chatId;
        setVista('chat');
        await refrescarMensajes(chatId);
        setChats(prev => {
            const chat = prev.find(c => c.id === chatId);
            if (chat && chat.unreadCount > 0) marcarLeido(chatId);
            return prev;
        });
    }, [refrescarMensajes, marcarLeido]);

    const cerrarChat = useCallback(() => {
        setSelectedChatId(null);
        selectedChatIdRef.current = null;
        setVista('lista');
    }, []);

    /**
     * La ÚNICA implementación del envío: optimismo, retiro del optimista cuando
     * no salió, y el 409 de la ventana de 24 h devuelto como resultado para que
     * cada pantalla ofrezca la plantilla a su manera.
     */
    const enviar = useCallback(async (
        chatId: string,
        texto: string,
        media?: { base64: string; mimetype: string; filename: string },
    ): Promise<ResultadoEnvio> => {
        const userName = nombreDeUsuario();
        const esAudio = !!media && media.mimetype.startsWith('audio');
        const optimista: Message = {
            id: 'temp_' + Date.now(),
            chatId,
            direction: 'OUTBOUND',
            type: esAudio ? 'audio' : media ? 'image' : 'text',
            content: texto || (esAudio ? '🎵 Audio' : media ? '📷 Imagen' : ''),
            mediaUrl: media?.base64,
            status: 'PENDING',
            senderName: userName,
            createdAt: new Date().toISOString(),
        };
        setMessagesByChat(prev => ({ ...prev, [chatId]: [...(prev[chatId] || []), optimista] }));
        setEnviando(true);

        const quitarOptimista = () =>
            setMessagesByChat(prev => ({ ...prev, [chatId]: (prev[chatId] || []).filter(m => m.id !== optimista.id) }));

        try {
            const body: Record<string, unknown> = { chatId, message: texto, senderName: userName };
            if (media) body.media = media;
            const res = await fetch('/api/whatsapp/send', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                quitarOptimista();
                setEnviando(false);
                if (res.status === 409 && (err?.needsTemplate || esAudio || media)) {
                    if (esAudio || media) {
                        return {
                            estado: 'error',
                            mensaje: 'El cliente no escribió en las últimas 24 h: los adjuntos solo se pueden mandar con la conversación abierta. Mandale primero la plantilla "retomar conversación".',
                        };
                    }
                    const chat = chatsRef.current.find(c => c.id === chatId);
                    const nombre = (chat?.client?.name || chat?.profileName || '').split(' ')[0];
                    return { estado: 'necesita-plantilla', chatId, texto, nombre };
                }
                return { estado: 'error', mensaje: err?.error || `HTTP ${res.status}` };
            }

            // Si el humano escribe desde la interfaz, el bot se apaga en el acto.
            aplicarChatLocal(chatId, { botEnabled: false });
            await refrescarMensajes(chatId);
            setEnviando(false);
            return { estado: 'ok' };
        } catch (e) {
            // El fetch lanzó (red caída): nada salió, se retira el optimista.
            console.error('Error enviando:', e);
            quitarOptimista();
            setEnviando(false);
            return { estado: 'error', mensaje: 'sin conexión con el servidor. Probá de nuevo.' };
        }
    }, [aplicarChatLocal, refrescarMensajes]);

    /**
     * Plantilla oficial: va con `forceTemplate`, así sale con la ventana de 24 h
     * abierta o cerrada, y el texto es EXACTAMENTE el aprobado en Meta.
     */
    const enviarPlantilla = useCallback(async (
        chatId: string,
        templateName: TemplateName,
        confirmar = true,
    ): Promise<ResultadoEnvio> => {
        const chat = chatsRef.current.find(c => c.id === chatId);
        const def = WHATSAPP_TEMPLATES[templateName];
        const nombre = (chat?.client?.name || chat?.profileName || '').split(' ')[0] || 'cliente';

        const bodyParams: string[] = [];
        for (const p of def.params as readonly { label: string }[]) {
            if (p.label.includes('saludo')) {
                bodyParams.push(saludoSegunHora());
            } else if (p.label.includes('producto')) {
                // pedido_resena: los productos de la última venta, como en el panel de reseñas.
                let productos = 'anteojos nuevos';
                if (chat?.client?.id) {
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

        if (confirmar) {
            const preview = renderTemplate(templateName, bodyParams);
            const destinatario = chat?.client?.name || chat?.profileName || 'este contacto';
            if (!window.confirm(`Se envía a ${destinatario} como plantilla aprobada de WhatsApp:\n\n${preview}\n\n¿Enviar?`)) {
                return { estado: 'error', mensaje: 'cancelado' };
            }
        }

        setEnviando(true);
        try {
            const res = await fetch('/api/whatsapp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chatId, message: '', forceTemplate: true, template: { name: def.name, bodyParams } }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                setEnviando(false);
                return { estado: 'error', mensaje: err?.error || `HTTP ${res.status}` };
            }
            aplicarChatLocal(chatId, { botEnabled: false });
            await refrescarMensajes(chatId);
            setEnviando(false);
            return { estado: 'ok' };
        } catch (e) {
            console.error('Error enviando plantilla:', e);
            setEnviando(false);
            return { estado: 'error', mensaje: 'sin conexión con el servidor. Probá de nuevo.' };
        }
    }, [aplicarChatLocal, refrescarMensajes]);

    const actualizarChat = useCallback(async (
        chatId: string,
        patch: Partial<Pick<Chat, 'chatLabels' | 'archived' | 'botEnabled' | 'chatSummary'>>,
    ) => {
        try {
            await fetch(`/api/whatsapp/chats/${chatId}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
            });
            aplicarChatLocal(chatId, patch);
        } catch (e) {
            console.error('Error actualizando chat:', e);
        }
    }, [aplicarChatLocal]);

    const toggleBot = useCallback(async (chatId: string, activo: boolean) => {
        try {
            await fetch(`/api/whatsapp/chats/${chatId}/bot`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ botEnabled: activo }),
            });
            aplicarChatLocal(chatId, { botEnabled: activo });
        } catch (e) {
            console.error('Error al togglear bot:', e);
        }
    }, [aplicarChatLocal]);

    const setAgentEnabled = useCallback((v: boolean) => {
        setAgentEnabledState(v);
        fetch('/api/whatsapp/agent', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: v }),
        }).catch(() => {});
    }, []);

    const setFollowupsEnabled = useCallback((v: boolean) => {
        setFollowupsEnabledState(v);
        fetch('/api/whatsapp/agent', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ followupsEnabled: v }),
        }).then(res => { if (!res.ok) throw new Error(); }).catch(() => {
            // Si el servicio no confirmó, la UI no puede quedarse mostrando un
            // estado que no rige.
            setFollowupsEnabledState(!v);
            alert('No se pudo cambiar el estado de los seguimientos: el servidor de WhatsApp no respondió. El estado real no cambió.');
        });
    }, []);

    // ── Los dos valores del contexto ──────────────
    const unreadTotal = chatsCargados
        ? chats.reduce((acc, c) => acc + (c.unreadCount || 0), 0)
        : contadorRemoto;

    const chatSeleccionado = useMemo(
        () => chats.find(c => c.id === selectedChatId) || null,
        [chats, selectedChatId],
    );

    const datos = useMemo<DatosWhatsApp>(() => ({
        status,
        cargandoStatus,
        esApiOficial: status.transport === 'cloud',
        chats,
        chatsCargados,
        unreadTotal,
        selectedChatId,
        chatSeleccionado,
        messagesByChat,
        tags,
        agentEnabled,
        followupsEnabled,
        promptDelServicio,
        vista,
        eventos,
        enviando,
    }), [status, cargandoStatus, chats, chatsCargados, unreadTotal, selectedChatId, chatSeleccionado,
        messagesByChat, tags, agentEnabled, followupsEnabled, promptDelServicio, vista, eventos, enviando]);

    // Identidad ESTABLE: si este objeto cambiara, todo el panel se re-renderizaría
    // con cada mensaje que entra, que es justo lo que separar los contextos evita.
    const acciones = useMemo<AccionesWhatsApp>(() => ({
        activarBuzon, abrirChat, cerrarChat, setVista, marcarLeido, enviar, enviarPlantilla,
        actualizarChat, aplicarChatLocal, toggleBot, refrescarChats, refrescarMensajes,
        refrescarStatus, refrescarTags, setAgentEnabled, setFollowupsEnabled, descartarEvento, notificar,
    }), [activarBuzon, abrirChat, cerrarChat, marcarLeido, enviar, enviarPlantilla, actualizarChat,
        aplicarChatLocal, toggleBot, refrescarChats, refrescarMensajes, refrescarStatus, refrescarTags,
        setAgentEnabled, setFollowupsEnabled, descartarEvento, notificar]);

    return (
        <AccionesContext.Provider value={acciones}>
            <DatosContext.Provider value={datos}>{children}</DatosContext.Provider>
        </AccionesContext.Provider>
    );
}

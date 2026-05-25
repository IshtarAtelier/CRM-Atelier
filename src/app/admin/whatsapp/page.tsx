'use client';

import QRCode from 'qrcode';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
    MessageCircle, Send, Wifi, WifiOff, QrCode, RefreshCw, User,
    Clock, CheckCircle2, Bot, Settings, X, ChevronLeft, Phone,
    Tag, Archive, ArchiveRestore, Filter, Plus, Mic, PlaySquare, Image as ImageIcon, Calendar, Search, Play, Paperclip, Smile, Square, Trash2,
    UserPlus, Loader2, Sparkles, Pin
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { io as SocketIOClient } from 'socket.io-client';
import { TestChatModal } from '@/components/TestChatModal';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false });

// Etiquetas predefinidas para chats
const CHAT_LABEL_OPTIONS = [
    { label: 'Fijado', color: 'bg-yellow-100/80 text-yellow-700 border-yellow-200' },
    { label: 'Cancelar Bot', color: 'bg-red-100/80 text-red-700 border-red-200' },
    { label: 'VIP', color: 'bg-amber-100/80 text-amber-700 border-amber-200' },
    { label: 'Proveedor', color: 'bg-slate-100/80 text-slate-700 border-slate-200' },
    { label: 'Interesado', color: 'bg-emerald-100/80 text-emerald-700 border-emerald-200' },
    { label: 'No interesado', color: 'bg-stone-100/80 text-stone-600 border-stone-200' },
    { label: 'Seguimiento', color: 'bg-blue-100/80 text-blue-700 border-blue-200' },
    { label: 'Pendiente', color: 'bg-orange-100/80 text-orange-700 border-orange-200' },
];

const getLabelStyle = (label: string) =>
    CHAT_LABEL_OPTIONS.find(o => o.label === label)?.color
    ?? 'bg-violet-100/80 text-violet-700 border-violet-200';

const resolveMediaUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('local://')) {
        return `/api/storage/view?key=${encodeURIComponent(url.replace('local://', ''))}`;
    }
    if (url.startsWith('/') || url.startsWith('http')) {
        return url;
    }
    return `/api/storage/view?key=${encodeURIComponent(url)}`;
};

// Respuestas rápidas predefinidas
const QUICK_REPLIES = [
    { label: 'Saludo', text: '¡Hola! 👋 Bienvenido a Atelier Óptica. ¿En qué te puedo ayudar?' },
    { label: 'Receta', text: '¿Me podés compartir tu receta óptica para ayudarte mejor?' },
    { label: 'Turno', text: '¿Querés coordinar un turno para una consulta en el local? 📍' },
    { label: 'Dirección', text: '📍 Nos encontrás en Tejeda 4380, Córdoba.' },
    { label: 'Horario', text: 'Atendemos de lunes a viernes de 9 a 18hs.' },
    { label: 'Listo para retirar', text: '🎉 ¡Tu pedido está listo para retirar!' },
    { label: 'Pago pendiente', text: 'Te recuerdo que quedó pendiente el saldo restante. ¿Cuándo te viene bien coordinar el pago?' },
];

// ── Types ─────────────────────────────────────────
interface Chat {
    id: string;
    waId: string;
    realPhone?: string | null;
    profileName: string;
    status: string;
    unreadCount: number;
    lastMessageAt: string;
    botEnabled: boolean;
    archived: boolean;
    chatLabels: string[];
    client?: { id: string; name: string; phone: string; status: string } | null;
    messages?: Message[];
}

interface Message {
    id: string;
    chatId: string;
    direction: string; // INBOUND | OUTBOUND
    type: string;
    content: string;
    mediaUrl?: string;
    status: string;
    senderName?: string | null;
    createdAt: string;
}

// ── Main Component ────────────────────────────────
export default function WhatsAppPage() {
    const [status, setStatus] = useState<{ connected: boolean; phone: string | null; qr: string | null; agentEnabled: boolean }>({
        connected: false, phone: null, qr: null, agentEnabled: false
    });
    const [chats, setChats] = useState<Chat[]>([]);
    const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [showConfig, setShowConfig] = useState(false);
    const [agentPrompt, setAgentPrompt] = useState('');
    const [dailyContext, setDailyContext] = useState('');
    const [agentEnabled, setAgentEnabled] = useState(false);
    const [showTestChat, setShowTestChat] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success'>('idle');
    const [loadingStatus, setLoadingStatus] = useState(true);
    const [filterLabel, setFilterLabel] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showArchived, setShowArchived] = useState(false);
    const [showLabelPicker, setShowLabelPicker] = useState(false);
    const [showQuickReplies, setShowQuickReplies] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [selectedImage, setSelectedImage] = useState<{ base64: string; mimetype: string; filename: string } | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [showCreateClientModal, setShowCreateClientModal] = useState(false);
    const [extracting, setExtracting] = useState(false);
    const [extractedClient, setExtractedClient] = useState<{ name: string; phone: string | null; interest: string | null; insurance: string | null; contactSource: string; notes: string | null } | null>(null);
    const [creatingClient, setCreatingClient] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const pollRef = useRef<NodeJS.Timeout | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // ── Audio Recording ───────────────────────────
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];
            
            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                stream.getTracks().forEach(track => track.stop());
                
                // Convert to Base64
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = () => {
                    const base64data = (reader.result as string).split(',')[1];
                    sendAudio(base64data, 'audio/webm');
                };
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);
            timerIntervalRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error('Error al acceder al micrófono:', err);
            alert('No se pudo acceder al micrófono. Por favor, revisa los permisos del navegador.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.onstop = null; // Evitar que se envíe
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        }
    };

    const sendAudio = async (base64: string, mimetype: string) => {
        if (!selectedChat || sending) return;
        setSending(true);
        try {
            let userName = 'CRM';
            try {
                const stored = localStorage.getItem('user');
                if (stored) userName = JSON.parse(stored).name || 'CRM';
            } catch { }

            const body = { 
                chatId: selectedChat.id, 
                message: '', 
                media: { base64, mimetype, filename: `audio_${Date.now()}.webm` },
                senderName: userName
            };
            await fetch('/api/whatsapp/send', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
            });
            setSelectedChat(prev => prev ? { ...prev, botEnabled: false } : prev);
            setChats(prev => prev.map(c => c.id === selectedChat.id ? { ...c, botEnabled: false } : c));
            await fetchMessages(selectedChat.id);
        } catch (e) {
            console.error('Error enviando audio:', e);
        }
        setSending(false);
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
                    if (selectedChatRef.current) {
                        await fetchMessages(selectedChatRef.current.id);
                    }
                }, 3000);
            } else {
                alert('Error al sincronizar: ' + (data.error || 'Desconocido'));
            }
        } catch (e) {
            console.error('Error al sincronizar:', e);
            alert('Error al iniciar la sincronización.');
        } finally {
            setSyncing(false);
        }
    };

    // ── Fetch status ──────────────────────────────
    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch('/api/whatsapp/status');
            const data = await res.json();
            setStatus(data);
            setLoadingStatus(false);
        } catch {
            setStatus({ connected: false, phone: null, qr: null, agentEnabled: false });
            setLoadingStatus(false);
        }
    }, []);

    useEffect(() => {
        if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
            Notification.requestPermission();
        }
    }, []);

    const knownClientIds = useRef<Set<string>>(new Set());
    const initialLoadRef = useRef(true);

    const searchParams = useSearchParams();
    const urlPhone = searchParams.get('phone');
    const handledUrlPhoneRef = useRef(false);

    // ── Fetch chats ───────────────────────────────
    const fetchChats = useCallback(async () => {
        try {
            const res = await fetch('/api/whatsapp/chats');
            const data = await res.json();
            if (Array.isArray(data)) {
                
                // --- Notification Logic ---
                if (initialLoadRef.current) {
                    data.forEach(c => { if (c.client?.id) knownClientIds.current.add(c.client.id); });
                    initialLoadRef.current = false;
                } else {
                    data.forEach(c => {
                        if (c.client?.id && !knownClientIds.current.has(c.client.id)) {
                            knownClientIds.current.add(c.client.id);
                            if ("Notification" in window && Notification.permission === "granted") {
                                new Notification("🌟 Nuevo Lead Calificado", {
                                    body: `La IA acaba de ingresar la receta y clasificar a ${c.client.name}.`,
                                    icon: "https://cdn-icons-png.flaticon.com/512/4712/4712139.png"
                                });
                            }
                        }
                    });
                }
                // --------------------------

                const sorted = [...data].sort((a, b) => {
                    const aPinned = (a.chatLabels || []).includes('Fijado') ? 1 : 0;
                    const bPinned = (b.chatLabels || []).includes('Fijado') ? 1 : 0;
                    if (aPinned !== bPinned) return bPinned - aPinned;

                    const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
                    const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
                    return tb - ta;
                });
                setChats(sorted);

                // Auto-select chat from URL parameter if present
                if (urlPhone && !handledUrlPhoneRef.current) {
                    const normalizedPhone = urlPhone.replace(/\D/g, '');
                    const targetChat = sorted.find(c => 
                        c.waId.includes(normalizedPhone) || 
                        (c.client?.phone && c.client.phone.replace(/\D/g, '').includes(normalizedPhone))
                    );
                    if (targetChat) {
                        setSelectedChat(targetChat);
                    } else {
                        // Si no existe el chat todavía, mostramos un aviso
                        alert(`No hay conversación de WhatsApp iniciada con el número ${urlPhone}. Podés mandarle el primer mensaje desde tu celular para abrir el chat.`);
                    }
                    handledUrlPhoneRef.current = true;
                }

                // Update selectedChat to reflect fresh botEnabled/labels
                setSelectedChat(prev => {
                    if (!prev) return null;
                    const updatedChat = sorted.find(c => c.id === prev.id);
                    return updatedChat || prev;
                });
            } else {
                setChats([]);
            }
        } catch { setChats([]); }
    }, []);

    // ── Fetch messages ────────────────────────────
    const fetchMessages = useCallback(async (chatId: string) => {
        try {
            const res = await fetch(`/api/whatsapp/chats/${chatId}/messages`);
            const data = await res.json();
            setMessages(Array.isArray(data) ? data : []);
        } catch { setMessages([]); }
    }, []);

    // ── Agent config ──────────────────────────────
    const fetchAgent = async () => {
        try {
            const res = await fetch('/api/whatsapp/agent');
            const data = await res.json();
            
            // Si no hay prompt guardado, proveemos el template base por defecto
            const defaultBasePrompt = `Eres "Ishtar", la experta asistente virtual de Atelier Óptica. \n\nTU OBJETIVO CORE: Actuar como un portero inteligente y asesor experto. \n\nDIFERENCIACIÓN DE ROLES:\n1. SI EL CLIENTE ES 'CONTACT' (PROSPECTO/LEAD): Eres un AGENTE DE VENTAS. Tu meta es calificarlo, entender su necesidad (multifocales, monofocales), darle precios del catálogo.\n2. SI EL CLIENTE ES 'CLIENT' (YA ES CLIENTE): Eres un AGENTE DE POSVENTA. Tu meta es dar soporte sobre sus pedidos. Usa 'get_order_status' para informar estados y saldos (balances) pendientes. Recordale los horarios si es necesario.\n\nREGLAS DE ORO:\n- SALDOS: Si el cliente tiene un saldo pendiente al preguntar por su pedido, infórmalo amablemente: "Tu pedido está [estado] y el saldo pendiente es $[monto]".\n- PRESUPUESTOS: Si te piden precios orientativos y no tienen receta, DALES EL PRECIO COMO TEXTO en el chat. Usa 'create_quote' ÚNICA Y EXCLUSIVAMENTE si el cliente ya está registrado en el CRM (es decir, ya usaste convert_into_lead tras pedirle la receta).\n- OCR: Extrae datos de recetas enviadas y guárdalos con 'save_prescription'.`;
            
            const systemPrompt = `${data.prompt || defaultBasePrompt}
  
  =========================
  REGLAS DE SEGURIDAD ESTRICTAS (INQUEBRANTABLES):
  1. KILL-SWITCH PARA CHATS PERSONALES O DE PROVEEDORES: Si detectas que el cliente te habla de temas personales, familiares, informales que no tienen que ver con anteojos, o si es un proveedor/laboratorio B2B vendiendo insumos, DEBES ejecutar INMEDIATAMENTE la herramienta 'disable_bot_for_personal_chat' pasando el chatId, y luego finalizar tu turno sin dar otra respuesta.
  2. REGLA DE CALIFICACIÓN: SOLO PUEDES CREAR UN LEAD (usar 'convert_into_lead') SI Y SOLO SI el cliente ya proporcionó una receta médica (foto, texto o datos clínicos). Si NO TIENE RECETA aún, trátalo amablemente, resuélvele dudas, pero PÍDELE LA RECETA y NO LO CONVIERTAS EN LEAD HASTA TENERLA.
  =========================

  =========================
  CONTEXTO DIARIO Y NOVEDADES:`;
            
            setAgentPrompt(systemPrompt);
            setDailyContext(data.dailyContext || '');
            setAgentEnabled(data.enabled || false);
        } catch { }
    };

    const saveAgent = async () => {
        setSaveStatus('saving');
        try {
            await fetch('/api/whatsapp/agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: agentPrompt, enabled: agentEnabled, dailyContext }),
            });
            setSaveStatus('success');
            setTimeout(() => {
                setSaveStatus('idle');
                setShowConfig(false);
            }, 1000);
        } catch { 
            alert('Error al intentar guardar la configuración.');
            setSaveStatus('idle');
        }
    };

    // ── Agent config: cargar solo una vez al montar ─
    useEffect(() => {
        fetchAgent();
    }, []);

    const selectedChatRef = useRef(selectedChat);
    useEffect(() => {
        selectedChatRef.current = selectedChat;
    }, [selectedChat]);

    // ── WebSockets & Polling (Fallback) ───────────
    useEffect(() => {
        fetchStatus();
        fetchChats();

        const socket = SocketIOClient(process.env.NEXT_PUBLIC_WA_URL || 'http://localhost:3100');

        socket.on('bot_status', (data) => {
            setStatus({ connected: data.connected, phone: data.phone, qr: data.qr, agentEnabled: data.agentEnabled });
            if (data.agentEnabled !== undefined) setAgentEnabled(data.agentEnabled);
            if (data.prompt !== undefined) setAgentPrompt(data.prompt);
            setLoadingStatus(false);
        });

        socket.on('chat_updated', ({ chatId }) => {
            fetchChats();
            if (selectedChatRef.current?.id === chatId) {
                fetchMessages(chatId);
            }
        });

        pollRef.current = setInterval(() => {
            fetchStatus();
            fetchChats();
            if (selectedChatRef.current) fetchMessages(selectedChatRef.current.id);
        }, 15000);

        return () => {
            socket.disconnect();
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [fetchStatus, fetchChats, fetchMessages]);

    // ── Auto-scroll ───────────────────────────────
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ── Select chat ───────────────────────────────
    const selectChat = async (chat: Chat) => {
        setSelectedChat(chat);
        setShowLabelPicker(false);
        await fetchMessages(chat.id);
    };

    // ── Send text ─────────────────────────────────
    const sendMessage = async () => {
        if ((!newMessage.trim() && !selectedImage) || !selectedChat || sending) return;
        setSending(true);
        try {
            let userName = 'CRM';
            try {
                const stored = localStorage.getItem('user');
                if (stored) userName = JSON.parse(stored).name || 'CRM';
            } catch { }
            
            const body: Record<string, unknown> = { chatId: selectedChat.id, message: newMessage, senderName: userName };
            if (selectedImage) body.media = selectedImage;
            await fetch('/api/whatsapp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            setNewMessage('');
            setSelectedImage(null);
            // Si el humano envía un mensaje desde la interfaz, apagamos el bot instantáneamente
            setSelectedChat(prev => prev ? { ...prev, botEnabled: false } : prev);
            setChats(prev => prev.map(c => c.id === selectedChat.id ? { ...c, botEnabled: false } : c));
            await fetchMessages(selectedChat.id);
        } catch (e) {
            console.error('Error enviando:', e);
        }
        setSending(false);
    };

    // ── Pick image from file input ────────────────
    const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            setSelectedImage({ base64, mimetype: file.type, filename: file.name });
        };
        reader.readAsDataURL(file);
        e.target.value = ''; 
    };

    // ── Toggle Bot per Chat ──────────────────────
    const toggleBot = async (chatId: string, enabled: boolean) => {
        try {
            await fetch(`/api/whatsapp/chats/${chatId}/bot`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ botEnabled: enabled }),
            });
            if (selectedChat?.id === chatId) {
                setSelectedChat({ ...selectedChat, botEnabled: enabled });
            }
            setChats(chats.map(c => c.id === chatId ? { ...c, botEnabled: enabled } : c));
        } catch (e) {
            console.error('Error al togglear bot:', e);
        }
    };

    // ── Actualizar etiquetas / archivar ───────────
    const updateChat = async (chatId: string, patch: Partial<Pick<Chat, 'chatLabels' | 'archived' | 'botEnabled'>>) => {
        try {
            await fetch(`/api/whatsapp/chats/${chatId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(patch),
            });
            const updated = (c: Chat) => c.id === chatId ? { ...c, ...patch } : c;
            setChats(prev => prev.map(updated));
            if (selectedChat?.id === chatId) {
                setSelectedChat(prev => prev ? { ...prev, ...patch } : prev);
            }
        } catch (e) {
            console.error('Error actualizando chat:', e);
        }
    };

    // ── Etiqueta: toggle en el chat seleccionado ──
    const toggleLabel = async (label: string) => {
        if (!selectedChat) return;
        const current = selectedChat.chatLabels || [];
        const next = current.includes(label)
            ? current.filter(l => l !== label)
            : [...current, label];
        await updateChat(selectedChat.id, { chatLabels: next });
        if (label === 'Cancelar Bot' && next.includes(label)) {
            await updateChat(selectedChat.id, { botEnabled: false });
        }
        if (label === 'Fijado' && selectedChat.client?.id) {
            try {
                await fetch(`/api/contacts/${selectedChat.client.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ isFavorite: next.includes('Fijado') })
                });
            } catch (e) {
                console.error('Error actualizando favorito:', e);
            }
        }
    };

    // ── Crear Ficha desde Chat (IA) ───────────────
    const extractClientFromChat = async () => {
        if (!selectedChat) return;
        setExtracting(true);
        setExtractedClient(null);
        try {
            const res = await fetch(`/api/whatsapp/chats/${selectedChat.id}/extract-client`, { method: 'POST' });
            const data = await res.json();
            if (res.ok && data.extracted) {
                setExtractedClient(data.extracted);
                setShowCreateClientModal(true);
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
        setCreatingClient(true);
        try {
            // 1. Crear cliente en el CRM
            const res = await fetch('/api/contacts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: extractedClient.name,
                    phone: extractedClient.phone || null,
                    interest: extractedClient.interest || null,
                    insurance: extractedClient.insurance || null,
                    contactSource: extractedClient.contactSource || 'WhatsApp',
                    status: 'CONTACT',
                }),
            });
            const newClient = await res.json();
            if (!res.ok) {
                if (newClient.isDuplicate && newClient.existingClient) {
                    if (window.confirm(`${newClient.details}\n\n¿Querés vincular este chat a la ficha existente de ${newClient.existingClient.name}?`)) {
                        // Vincular al cliente existente
                        await fetch(`/api/whatsapp/chats/${selectedChat.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ clientId: newClient.existingClient.id }),
                        });
                        
                        // Actualizar UI
                        const updatedClient = { 
                            id: newClient.existingClient.id, 
                            name: newClient.existingClient.name, 
                            phone: newClient.existingClient.phone, 
                            status: newClient.existingClient.status || 'CONTACT' 
                        };
                        setSelectedChat(prev => prev ? { ...prev, client: updatedClient } : prev);
                        setChats(prev => prev.map(c => c.id === selectedChat.id ? { ...c, client: updatedClient } : c));
                        setShowCreateClientModal(false);
                        setExtractedClient(null);
                    }
                } else {
                    alert(newClient.error || newClient.details || 'Error al crear contacto');
                }
                setCreatingClient(false);
                return;
            }

            // 2. Vincular chat al nuevo cliente
            await fetch(`/api/whatsapp/chats/${selectedChat.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId: newClient.id }),
            });

            // 3. Guardar nota si hay
            if (extractedClient.notes) {
                await fetch(`/api/contacts/${newClient.id}/interactions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'NOTE', content: `[HITO] ${extractedClient.notes}` }),
                });
            }

            // 4. Actualizar UI
            const updatedClient = { id: newClient.id, name: newClient.name, phone: newClient.phone, status: newClient.status };
            setSelectedChat(prev => prev ? { ...prev, client: updatedClient } : prev);
            setChats(prev => prev.map(c => c.id === selectedChat.id ? { ...c, client: updatedClient } : c));
            setShowCreateClientModal(false);
            setExtractedClient(null);
        } catch (e) {
            console.error('Error creando cliente:', e);
            alert('Error al crear la ficha');
        }
        setCreatingClient(false);
    };

    const getDisplayName = useCallback((chat: Chat) => {
        if (chat.client?.name) return chat.client.name;
        if (chat.profileName && chat.profileName.trim() !== '') return chat.profileName;
        // If we have a resolved real phone, use it
        if (chat.realPhone && chat.realPhone.length >= 8) return `+${chat.realPhone}`;
        const id = chat.waId || '';
        if (id.includes('@c.us') || id.includes('@s.whatsapp.net')) {
            const num = id.split('@')[0];
            return `+${num}`;
        }
        // @lid without resolved phone — just show "Contacto" 
        if (id.includes('@lid')) return 'Contacto WhatsApp';
        return id.split('@')[0] || 'Desconocido';
    }, []);

    // ── Vista filtrada de chats ───────────────────
    const filteredChats = chats.filter(c => {
        if (c.archived !== showArchived) return false;
        if (filterLabel && !(c.chatLabels || []).includes(filterLabel)) return false;
        
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            const name = getDisplayName(c).toLowerCase();
            const num = c.waId.toLowerCase();
            if (!name.includes(query) && !num.includes(query)) return false;
        } else {
            if (!showArchived && !filterLabel && c.unreadCount === 0) {
                const daysOld = c.lastMessageAt ? (new Date().getTime() - new Date(c.lastMessageAt).getTime()) / (1000 * 3600 * 24) : 0;
                if (daysOld > 2) return false;
            }
        }

        return true;
    });

    const usedLabels = Array.from(new Set(chats.flatMap(c => c.chatLabels || []))).filter(Boolean);

    // ═══════════════════════════════════════════════
    // RENDER: PREMIUM GLASSMORPHIC UI
    // ═══════════════════════════════════════════════

    return (
        <main className="absolute inset-0 flex flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50/50 via-stone-100 to-stone-200 dark:from-stone-900 dark:via-stone-950 dark:to-black">
            {/* Header Flotante / Premium */}
            <div className="flex items-center justify-between px-8 py-5 border-b border-white/40 dark:border-white/5 bg-white/40 dark:bg-black/30 backdrop-blur-2xl flex-shrink-0 z-20 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                        <MessageCircle className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-stone-800 dark:text-white tracking-tight">Comunicaciones</h1>
                        <p className="text-[11px] font-bold text-stone-500 flex items-center gap-1.5 uppercase tracking-widest mt-0.5">
                            {status.connected ? <><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Activo ({status.phone})</> : <><span className="w-2 h-2 rounded-full bg-red-500" /> Desconectado</>}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3 bg-white/60 dark:bg-stone-900/60 backdrop-blur-md px-4 py-2 rounded-full border border-stone-200/50 dark:border-stone-800 shadow-sm transition-all">
                        <div className="flex flex-col items-end">
                            <span className="text-[9px] font-black uppercase tracking-widest text-stone-400 dark:text-stone-500 leading-none mb-0.5">Asistente IA</span>
                            <span className={`text-[11px] font-bold leading-none transition-colors ${agentEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-500 dark:text-stone-400'}`}>
                                {agentEnabled ? 'Activa' : 'Inactiva'}
                            </span>
                        </div>
                        <button
                            onClick={() => {
                                const next = !agentEnabled;
                                setAgentEnabled(next);
                                fetch('/api/whatsapp/agent', {
                                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: next }),
                                });
                            }}
                            className={`w-11 h-6 rounded-full transition-colors relative shadow-inner focus:outline-none ${agentEnabled ? 'bg-emerald-500' : 'bg-stone-300 dark:bg-stone-700'}`}
                        >
                            <div className={`w-5 h-5 rounded-full bg-white shadow-sm absolute top-0.5 transition-transform ${agentEnabled ? 'translate-x-[22px]' : 'translate-x-[2px]'}`} />
                        </button>
                    </div>

                    {status.connected && (
                        <button
                            onClick={handleSync}
                            disabled={syncing}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-sm transition-all shadow-sm border ${
                                syncing
                                    ? 'bg-stone-300 dark:bg-stone-700 text-stone-500 cursor-not-allowed'
                                    : 'bg-indigo-500 text-white border-indigo-400 hover:bg-indigo-600 hover:scale-105'
                            }`}
                        >
                            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                            {syncing ? 'Sincronizar' : 'Sincronizar'}
                        </button>
                    )}

                    <button
                        onClick={() => setShowTestChat(true)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-sm transition-all shadow-sm border bg-emerald-500 text-white border-emerald-400 hover:bg-emerald-600 hover:scale-105"
                    >
                        <Play className="w-4 h-4" /> Probar Chat
                    </button>

                    <button
                        onClick={() => { setShowConfig(!showConfig); if (!showConfig) fetchAgent(); }}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-sm transition-all shadow-sm border ${showConfig
                            ? 'bg-violet-600 text-white border-violet-500 shadow-violet-500/20'
                            : 'bg-white/80 dark:bg-stone-800/80 text-stone-700 dark:text-stone-300 border-white/50 dark:border-white/10 hover:bg-white hover:scale-105'
                            }`}
                    >
                        <Settings className="w-4 h-4" /> Personalidad
                    </button>
                </div>
            </div>

            {/* Panel de Configuración Agente Animado */}
            {showConfig && (
                <div className="border-b border-violet-200/50 dark:border-violet-900/30 bg-white/60 dark:bg-stone-900/60 backdrop-blur-3xl px-8 py-6 flex-shrink-0 animate-in slide-in-from-top-4 fade-in duration-300 z-10 shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-violet-100 dark:bg-violet-900/50 rounded-xl">
                                <Bot className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-stone-800 dark:text-white uppercase tracking-widest">Personalidad del Agente</h3>
                                <p className="text-xs text-stone-500">Define las reglas globales de Ishtar, la IA.</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-6">
                            <button onClick={() => setShowConfig(false)} className="p-2 text-stone-400 hover:text-stone-800 bg-black/5 rounded-full transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                    <div className="flex flex-col gap-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-stone-500 uppercase tracking-widest flex items-center gap-2">
                                    <Bot className="w-4 h-4 text-violet-500" /> Reglas Base (Motor IA)
                                </label>
                                <textarea
                                    value={agentPrompt}
                                    onChange={(e) => setAgentPrompt(e.target.value)}
                                    rows={10}
                                    placeholder="Aquí van las reglas fijas de ventas y soporte..."
                                    className="w-full px-5 py-4 bg-white/80 dark:bg-black/40 backdrop-blur-md border border-violet-200 dark:border-violet-800/50 rounded-2xl text-[13px] focus:ring-4 focus:ring-violet-500/20 focus:border-violet-500 outline-none resize-none font-medium text-stone-800 dark:text-stone-200 transition-all shadow-inner leading-relaxed"
                                />
                                <p className="text-[10px] font-bold text-stone-400">Este es el corazón de la IA. Si borras esto, se usará el código predeterminado.</p>
                            </div>
                            
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-stone-500 uppercase tracking-widest flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-emerald-500" /> Contexto del Día (Novedades)
                                </label>
                                <textarea
                                    value={dailyContext}
                                    onChange={(e) => setDailyContext(e.target.value)}
                                    rows={10}
                                    placeholder="Ej: Hoy lunes 25 estamos cerrados por feriado. / Hoy tenemos 20% OFF en cristales..."
                                    className="w-full px-5 py-4 bg-white/80 dark:bg-black/40 backdrop-blur-md border border-emerald-200 dark:border-emerald-800/50 rounded-2xl text-[13px] focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none resize-none font-medium text-stone-800 dark:text-stone-200 transition-all shadow-inner leading-relaxed"
                                />
                                <p className="text-[10px] font-bold text-stone-400">Usa esto para avisos temporales urgentes, feriados o promociones de hoy.</p>
                            </div>
                        </div>
                        <button
                            onClick={saveAgent}
                            disabled={saveStatus !== 'idle'}
                            className={`self-end px-6 py-2.5 bg-gradient-to-r ${saveStatus === 'success' ? 'from-emerald-500 to-emerald-600 shadow-emerald-500/30' : 'from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-violet-500/30'} text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg transition-all active:scale-95 ${saveStatus === 'saving' ? 'opacity-70 cursor-wait' : ''}`}
                        >
                            {saveStatus === 'saving' ? 'Guardando...' : saveStatus === 'success' ? '✓ ¡Guardado!' : 'Guardar Personalidad'}
                        </button>
                    </div>
                </div>
            )}

            {!status.connected ? (
                /* ── PANTALLA DE DESCONECTADO PREMIUM ── */
                <div className="flex-1 overflow-y-auto p-4 lg:p-12 flex items-center justify-center">
                    <div className="bg-white/70 dark:bg-stone-900/70 backdrop-blur-2xl rounded-[2.5rem] border border-white/50 dark:border-white/10 p-12 text-center max-w-lg shadow-2xl">
                        {loadingStatus ? (
                            <div>
                                <div className="w-16 h-16 border-4 border-emerald-100 border-t-emerald-500 rounded-full animate-spin mx-auto mb-6 shadow-lg shadow-emerald-500/20" />
                                <p className="text-base font-black tracking-tight text-stone-800 dark:text-white">Estableciendo enlace neural...</p>
                            </div>
                        ) : status.qr ? (
                            <div className="animate-in zoom-in-95 duration-500">
                                <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/50 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-500/20">
                                    <QrCode className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <h2 className="text-2xl font-black text-stone-800 dark:text-white tracking-tight mb-2">Vincular Dispositivo</h2>
                                <p className="text-sm text-stone-500 mb-8 font-medium">Escaneá este código usando WhatsApp Web en tu celular.</p>

                                <div className="inline-block bg-white p-5 rounded-3xl shadow-xl border border-stone-100 relative group overflow-hidden">
                                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <QRRenderer qr={status.qr} />
                                </div>

                                <button
                                    onClick={fetchStatus}
                                    className="mt-8 px-6 py-3 bg-stone-900 dark:bg-white text-white dark:text-stone-900 rounded-2xl font-bold text-sm hover:scale-105 active:scale-95 transition-all flex items-center gap-2 mx-auto shadow-xl"
                                >
                                    <RefreshCw className="w-4 h-4" /> Recargar QR
                                </button>
                            </div>
                        ) : (
                            <div>
                                <div className="w-20 h-20 bg-red-100 dark:bg-red-900/50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                                    <WifiOff className="w-10 h-10 text-red-500" />
                                </div>
                                <h2 className="text-2xl font-black text-stone-800 dark:text-white tracking-tight mb-2">Señal Perdida</h2>
                                <p className="text-sm text-stone-500 mb-8 font-medium">El servicio WA-Service no se está comunicando.</p>
                                <button
                                    onClick={fetchStatus}
                                    className="px-8 py-3.5 bg-stone-900 dark:bg-white text-white dark:text-stone-900 rounded-2xl font-black transition-all hover:scale-105 shadow-xl flex items-center gap-2 mx-auto"
                                >
                                    <RefreshCw className="w-4 h-4" /> Reintentar Conexión
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* ── DASHBOARD PREMIUM DE CHATS ── */
                <div className="flex flex-1 min-h-0 overflow-hidden m-4 lg:m-6 gap-6">
                    {/* Lista de Chats (Glassmorphism Sidebar) */}
                    <div className={`w-[360px] bg-white/60 dark:bg-stone-900/60 backdrop-blur-2xl rounded-[2rem] border border-white/50 dark:border-white/10 flex flex-col shadow-xl ${selectedChat ? 'hidden lg:flex' : 'flex'}`}>
                        {/* Header de Sidebar */}
                        <div className="p-5 border-b border-stone-200/50 dark:border-white/5">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-sm font-black text-stone-800 dark:text-white tracking-tight">
                                    {showArchived ? 'Buzón Archivado' : 'Buzón Activo'}
                                    <span className="ml-2 text-stone-400 font-medium">({filteredChats.length})</span>
                                </h2>
                                <button
                                    onClick={() => { setShowArchived(v => !v); setFilterLabel(null); }}
                                    className={`p-2 rounded-xl transition-all ${showArchived ? 'bg-stone-800 text-white shadow-md' : 'bg-white text-stone-600 shadow-sm hover:shadow-md border border-stone-100'}`}
                                >
                                    {showArchived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                                </button>
                            </div>

                            <div className="mb-4 relative">
                                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Buscar cliente o número..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl py-2 pl-9 pr-3 text-xs outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 transition-all text-stone-800 dark:text-white placeholder:text-stone-400"
                                />
                            </div>

                            {usedLabels.length > 0 && (
                                <div className="flex gap-2 overflow-x-auto pb-1 pb-hide-scroll">
                                    <button
                                        onClick={() => setFilterLabel(null)}
                                        className={`px-3 py-1.5 rounded-full text-[11px] font-black whitespace-nowrap transition-all flex-shrink-0 shadow-sm ${!filterLabel ? 'bg-stone-900 text-white' : 'bg-white text-stone-600 hover:bg-stone-50'}`}
                                    >
                                        Todos
                                    </button>
                                    {usedLabels.map(lbl => (
                                        <button
                                            key={lbl}
                                            onClick={() => setFilterLabel(filterLabel === lbl ? null : lbl)}
                                            className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all shadow-sm border ${filterLabel === lbl ? getLabelStyle(lbl) + ' ring-2 ring-violet-500/50 scale-105' : 'bg-white text-stone-600 border-white/50 hover:bg-stone-50'}`}
                                        >
                                            {lbl}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Listado */}
                        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1 custom-scrollbar">
                            {filteredChats.length === 0 ? (
                                <div className="text-center py-20 px-6">
                                    <div className="w-16 h-16 bg-white dark:bg-stone-800 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                                        <MessageCircle className="w-6 h-6 text-stone-300" />
                                    </div>
                                    <p className="text-sm font-bold text-stone-400">Todo limpio.</p>
                                </div>
                            ) : (
                                filteredChats.map(chat => {
                                    const isSelected = selectedChat?.id === chat.id;
                                    const lastMsg = chat.messages?.[0];
                                    return (
                                        <button
                                            key={chat.id}
                                            onClick={() => selectChat(chat)}
                                            className={`w-full text-left p-3 rounded-2xl transition-all relative border ${isSelected
                                                ? 'bg-white dark:bg-stone-800 border-transparent shadow-lg shadow-black/5 ring-1 ring-stone-900/5 dark:ring-white/10 z-10'
                                                : 'hover:bg-white/50 dark:hover:bg-stone-800/50 border-transparent text-stone-700 dark:text-stone-300'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black shrink-0 transition-transform ${isSelected ? 'scale-105' : ''} ${chat.botEnabled && isSelected ? 'bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-md shadow-violet-500/30' : (isSelected ? 'bg-emerald-500 text-white' : 'bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300')}`}>
                                                        {getDisplayName(chat)[0].toUpperCase()}
                                                    </div>
                                                    {chat.botEnabled && agentEnabled && !isSelected && (
                                                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-violet-500 rounded-full border-2 border-white flex items-center justify-center">
                                                            <Bot className="w-3 h-3 text-white" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0 pr-1">
                                                    <div className="flex items-center justify-between">
                                                        <span className={`text-[13px] font-black truncate flex items-center gap-1 ${isSelected ? 'text-stone-900 dark:text-white' : ''}`}>
                                                            {getDisplayName(chat)}
                                                            {(chat.chatLabels || []).includes('Fijado') && (
                                                                <Pin className="w-3 h-3 text-stone-400 rotate-45 shrink-0" />
                                                            )}
                                                        </span>
                                                        {chat.lastMessageAt && (
                                                            <span className="text-[10px] text-stone-400 font-bold shrink-0">
                                                                {format(new Date(chat.lastMessageAt), "HH:mm")}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center justify-between mt-1">
                                                        <p className={`text-[12px] truncate max-w-[80%] ${chat.unreadCount > 0 ? 'font-black text-stone-800 dark:text-white' : 'text-stone-500 dark:text-stone-400 font-medium'}`}>
                                                            {lastMsg ? (
                                                                <>
                                                                    {lastMsg.direction === 'OUTBOUND' && <span className="opacity-50 mr-1">Tú:</span>}
                                                                    {lastMsg.type === 'AUDIO' ? '🎧 Audio' : (lastMsg.type === 'IMAGE' ? '📷 Imagen' : lastMsg.content)}
                                                                </>
                                                            ) : '...'}
                                                        </p>
                                                        {chat.unreadCount > 0 && (
                                                            <span className="w-5 h-5 bg-emerald-500 text-white rounded-full text-[10px] font-black flex items-center justify-center animate-pulse shadow-sm shadow-emerald-500/40">
                                                                {chat.unreadCount}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Chat Abierto */}
                    <div className="flex-1 bg-white/60 dark:bg-stone-900/60 backdrop-blur-2xl rounded-[2rem] border border-white/50 dark:border-white/10 shadow-xl overflow-hidden flex flex-col">
                        {selectedChat ? (
                            <>
                                {/* Cabecera del Chat */}
                                <div className="px-5 py-3 bg-white/80 dark:bg-black/20 backdrop-blur-md border-b border-stone-200/50 dark:border-white/5 flex items-center justify-between shrink-0 z-10 shadow-sm">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <button onClick={() => setSelectedChat(null)} className="lg:hidden p-1.5 rounded-xl bg-white shadow-sm border border-stone-100">
                                            <ChevronLeft className="w-4 h-4 text-stone-600" />
                                        </button>
                                        <div className="w-10 h-10 rounded-xl bg-stone-900 dark:bg-white text-white dark:text-stone-900 flex items-center justify-center text-sm font-black shrink-0 shadow-md relative">
                                            {getDisplayName(selectedChat)[0].toUpperCase()}
                                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow-sm" />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="text-sm font-black text-stone-900 dark:text-white truncate flex items-center gap-1.5">
                                                {getDisplayName(selectedChat)}
                                                {selectedChat.client && (
                                                    <span className="px-1.5 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-[8px] font-black tracking-widest uppercase text-stone-400 shrink-0">CRM</span>
                                                )}
                                            </h3>
                                            <p className="text-[10px] font-bold text-stone-400 flex items-center gap-1 mt-0.5">
                                                <Phone className="w-2.5 h-2.5" /> {(() => { const ph = selectedChat.realPhone || selectedChat.client?.phone || ''; const waClean = selectedChat.waId.replace('@c.us', '').replace('@s.whatsapp.net', ''); return (ph && ph.length >= 8) ? ph : (selectedChat.waId.includes('@lid') ? 'Número pendiente' : waClean || 'Sin número'); })()}
                                                {selectedChat.client ? (
                                                    <a 
                                                        href={`/admin/contactos?id=${selectedChat.client.id}`}
                                                        className="ml-1.5 px-2 py-0.5 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-500 dark:text-stone-400 rounded-md text-[9px] uppercase tracking-wider font-black transition-colors"
                                                    >
                                                        Ver ficha
                                                    </a>
                                                ) : (
                                                    <button
                                                        onClick={extractClientFromChat}
                                                        disabled={extracting}
                                                        className="ml-1.5 px-2.5 py-1 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white rounded-lg text-[9px] uppercase tracking-wider font-black transition-all shadow-md hover:shadow-lg hover:scale-105 disabled:opacity-60 disabled:hover:scale-100 flex items-center gap-1"
                                                    >
                                                        {extracting ? (
                                                            <><Loader2 className="w-2.5 h-2.5 animate-spin" /> Analizando...</>
                                                        ) : (
                                                            <><Sparkles className="w-2.5 h-2.5" /> Crear Ficha</>
                                                        )}
                                                    </button>
                                                )}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {(selectedChat.chatLabels || []).length > 0 && (
                                            <div className="hidden lg:flex flex-wrap gap-1 mr-2 border-r border-stone-200/50 dark:border-stone-700 pr-2">
                                                {selectedChat.chatLabels.map(lbl => (
                                                    <span key={lbl} className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${getLabelStyle(lbl)}`}>{lbl}</span>
                                                ))}
                                            </div>
                                        )}
                                        
                                        <div className="relative">
                                            <button onClick={() => setShowLabelPicker(v => !v)} className="p-2 bg-white dark:bg-stone-800 border border-stone-200/50 dark:border-stone-700 hover:bg-stone-50 rounded-xl transition-all shadow-sm">
                                                <Tag className="w-3.5 h-3.5 text-stone-500" />
                                            </button>
                                            {showLabelPicker && (
                                                <div className="absolute right-0 top-11 bg-white/90 dark:bg-stone-900/90 backdrop-blur-xl border border-stone-200/50 dark:border-white/10 rounded-2xl shadow-2xl z-50 w-44 p-2">
                                                    {CHAT_LABEL_OPTIONS.map(opt => {
                                                        const active = (selectedChat.chatLabels || []).includes(opt.label);
                                                        return (
                                                            <button key={opt.label} onClick={() => toggleLabel(opt.label)} className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all mb-1 last:mb-0 ${active ? opt.color : 'text-stone-600 hover:bg-stone-100'}`}>
                                                                {opt.label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                        <button onClick={() => { updateChat(selectedChat.id, { archived: !selectedChat.archived }); setSelectedChat(null); }} className="p-2 bg-white dark:bg-stone-800 border border-stone-200/50 dark:border-stone-700 hover:bg-stone-50 rounded-xl transition-all shadow-sm">
                                            {selectedChat.archived ? <ArchiveRestore className="w-3.5 h-3.5 text-stone-500" /> : <Archive className="w-3.5 h-3.5 text-stone-500" />}
                                        </button>

                                        <div className="w-px h-6 bg-stone-200/50 dark:bg-stone-700 mx-0.5" />

                                        {/* Botón IA estilo pill (igual que el header) */}
                                        <div className="flex items-center gap-2 bg-white/60 dark:bg-stone-800/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-stone-200/50 dark:border-stone-700 shadow-sm">
                                            <div className="flex flex-col items-end">
                                                <span className="text-[8px] font-black uppercase tracking-widest text-stone-400 leading-none mb-0.5">Asistente</span>
                                                <span className={`text-[10px] font-bold leading-none transition-colors ${selectedChat.botEnabled ? 'text-violet-600 dark:text-violet-400' : 'text-stone-400'}`}>
                                                    {selectedChat.botEnabled ? 'Activa' : 'Inactiva'}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => toggleBot(selectedChat.id, !selectedChat.botEnabled)}
                                                className={`w-9 h-5 rounded-full transition-colors relative shadow-inner focus:outline-none ${selectedChat.botEnabled ? 'bg-violet-500' : 'bg-stone-300 dark:bg-stone-600'}`}
                                            >
                                                <div className={`w-4 h-4 rounded-full bg-white shadow-sm absolute top-0.5 transition-transform ${selectedChat.botEnabled ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Conversación (Burbujas Premium) */}
                                <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6 bg-gradient-to-b from-transparent to-stone-50/50 dark:from-transparent dark:to-stone-950/20 custom-scrollbar-smooth">
                                    {messages.map((msg, idx) => {
                                        const isOut = msg.direction === 'OUTBOUND';
                                        return (
                                            <div key={msg.id || `msg-${idx}`} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
                                                <div className="flex gap-2 max-w-[80%] items-end">
                                                    {!isOut && (
                                                        <div className="w-6 h-6 rounded-full bg-stone-200 flex-shrink-0 flex items-center justify-center text-[9px] font-black text-stone-500 self-end mb-1">
                                                            {getDisplayName(selectedChat)[0].toUpperCase()}
                                                        </div>
                                                    )}
                                                    
                                                    <div className={`px-5 py-3.5 shadow-sm relative group overflow-hidden ${isOut ? 'bg-emerald-500 text-white rounded-[24px] rounded-br-sm shadow-emerald-500/10' : 'bg-white/90 dark:bg-stone-800/90 backdrop-blur-xl text-stone-800 dark:text-stone-100 rounded-[24px] rounded-bl-sm border border-stone-200/50 dark:border-white/5'}`}>
                                                        
                                                        {/* RENDERIZADO DE MEDIOS */}
                                                        {msg.mediaUrl && msg.type === 'AUDIO' && (
                                                            <div className="mb-2 bg-black/5 dark:bg-white/5 p-2 rounded-2xl flex items-center border border-black/5">
                                                                <Mic className="w-5 h-5 opacity-50 mr-2 shrink-0" />
                                                                <audio controls src={resolveMediaUrl(msg.mediaUrl)} className="h-10 w-48 ouline-none filter drop-shadow-sm" preload="metadata" />
                                                            </div>
                                                        )}
                                                        {msg.mediaUrl && msg.type === 'IMAGE' && (
                                                            <div className="mb-2 overflow-hidden rounded-xl border border-black/5">
                                                                <img src={resolveMediaUrl(msg.mediaUrl)} alt="📸" className="max-w-full max-h-64 object-contain" />
                                                            </div>
                                                        )}
                                                        {msg.mediaUrl && msg.type === 'VIDEO' && (
                                                            <div className="mb-2 overflow-hidden rounded-xl border border-black/5">
                                                                <video controls src={resolveMediaUrl(msg.mediaUrl)} className="max-w-full max-h-64 object-contain rounded-xl" />
                                                            </div>
                                                        )}

                                                        {/* FALLBACKS PARA MEDIOS SIN URL */}
                                                        {!msg.mediaUrl && msg.type === 'AUDIO' && (
                                                            <div className="mb-1 flex items-center gap-2 opacity-70 italic text-sm"><Mic className="w-4 h-4"/> Audio de WhatsApp</div>
                                                        )}
                                                        {!msg.mediaUrl && msg.type === 'IMAGE' && (
                                                            <div className="mb-1 flex items-center gap-2 opacity-70 italic text-sm"><ImageIcon className="w-4 h-4"/> Imagen de WhatsApp</div>
                                                        )}
                                                        {!msg.mediaUrl && msg.type === 'VIDEO' && (
                                                            <div className="mb-1 flex items-center gap-2 opacity-70 italic text-sm"><PlaySquare className="w-4 h-4"/> Video de WhatsApp</div>
                                                        )}
                                                        {!msg.mediaUrl && msg.type === 'DOCUMENT' && (
                                                            <div className="mb-1 flex items-center gap-2 opacity-70 italic text-sm"><Archive className="w-4 h-4"/> Documento de WhatsApp</div>
                                                        )}

                                                        {msg.content ? (
                                                            <p className="text-[15px] font-medium leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                                                        ) : null}
                                                        
                                                        <div className={`mt-2 flex items-center gap-1.5 text-[10px] font-bold ${isOut ? 'text-emerald-100 justify-end' : 'text-stone-400'}`}>
                                                            {isOut && (
                                                                <span className="mr-1 opacity-80 uppercase tracking-widest">{msg.senderName ? msg.senderName : 'Teléfono'}</span>
                                                            )}
                                                            <span>{format(new Date(msg.createdAt), "HH:mm")}</span>
                                                            {isOut && <CheckCircle2 className="w-3 h-3" />}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div ref={messagesEndRef} className="h-4" />
                                </div>

                                {/* Zona de Escritura Premium */}
                                <div className="p-4 bg-white/80 dark:bg-stone-900/80 backdrop-blur-2xl border-t border-stone-200/50 dark:border-white/10 shrink-0">
                                    
                                    {showQuickReplies && (
                                        <div className="mb-4 bg-stone-50 dark:bg-stone-800 rounded-3xl p-4 border border-stone-200/50 shadow-inner max-h-48 overflow-y-auto animate-in slide-in-from-bottom-2">
                                            <p className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-3">Escudos de Respuesta</p>
                                            <div className="flex flex-wrap gap-2">
                                                {QUICK_REPLIES.map(qr => (
                                                    <button key={qr.label} onClick={() => { setNewMessage(qr.text); setShowQuickReplies(false); }} className="px-4 py-2 bg-white dark:bg-stone-700 rounded-xl shadow-sm hover:shadow-md border border-stone-200 dark:border-stone-600 transition-all text-left group">
                                                        <span className="block text-[11px] font-black text-stone-800 dark:text-white uppercase tracking-wider">{qr.label}</span>
                                                        <span className="block text-xs text-stone-500 truncate max-w-[200px] mt-0.5 group-hover:text-stone-700">{qr.text}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {selectedImage && (
                                        <div className="mb-4 inline-flex items-center gap-3 p-2 pr-4 bg-stone-100 rounded-2xl border border-stone-200 animate-in slide-in-from-bottom-2">
                                            <div className="relative">
                                                <img src={`data:${selectedImage.mimetype};base64,${selectedImage.base64}`} alt="preview" className="h-14 w-14 object-cover rounded-xl" />
                                                <button onClick={() => setSelectedImage(null)} className="absolute -top-2 -right-2 w-6 h-6 bg-stone-800 text-white rounded-full flex items-center justify-center shadow-lg"><X className="w-3 h-3" /></button>
                                            </div>
                                            <span className="text-xs font-bold text-stone-600">Adjunto listo</span>
                                        </div>
                                    )}

                                    <div className="flex items-end gap-3 max-w-[1200px] mx-auto relative">
                                        {showEmojiPicker && (
                                            <div className="absolute bottom-[80px] left-0 z-50 animate-in slide-in-from-bottom-2 drop-shadow-2xl">
                                                <EmojiPicker 
                                                    onEmojiClick={(emojiData) => setNewMessage(prev => prev + emojiData.emoji)} 
                                                    autoFocusSearch={false}
                                                />
                                            </div>
                                        )}

                                        <div className="flex bg-stone-100 dark:bg-stone-800 rounded-3xl p-1.5 shadow-inner">
                                            <input ref={fileInputRef} type="file" accept="image/*,video/*,application/pdf" className="hidden" onChange={handleImagePick} />
                                            <button onClick={() => setShowEmojiPicker(v => !v)} className={`p-3 rounded-2xl transition-all shadow-sm ${showEmojiPicker ? 'bg-white text-emerald-500' : 'text-stone-500 hover:bg-white hover:text-stone-900'}`}>
                                                <Smile className="w-5 h-5" />
                                            </button>
                                            <button onClick={() => fileInputRef.current?.click()} className="p-3 text-stone-500 hover:bg-white hover:text-stone-900 rounded-2xl transition-all shadow-sm transform -rotate-45">
                                                <Paperclip className="w-5 h-5" />
                                            </button>
                                            <button onClick={() => setShowQuickReplies(v => !v)} className={`p-3 rounded-2xl transition-all shadow-sm ${showQuickReplies ? 'bg-indigo-100 text-indigo-600' : 'text-stone-500 hover:bg-white hover:text-indigo-600'}`}>
                                                <Bot className="w-5 h-5" />
                                            </button>
                                        </div>

                                        {isRecording ? (
                                            <div className="flex-1 flex items-center gap-4 bg-red-50 dark:bg-red-900/20 px-6 py-[14px] rounded-[2rem] border-[3px] border-red-100 dark:border-red-900/30 animate-pulse shadow-sm">
                                                <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm" />
                                                <span className="text-red-500 font-black tracking-widest tabular-nums">{formatTime(recordingTime)}</span>
                                                <span className="text-red-400 text-[13px] font-bold flex-1">Grabando audio...</span>
                                                <button onClick={cancelRecording} className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full transition-all">
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex-1 bg-white dark:bg-stone-800 border-[3px] border-stone-100 dark:border-stone-700 rounded-[2rem] flex items-center px-6 shadow-sm focus-within:border-emerald-200 dark:focus-within:border-emerald-900/50 transition-colors">
                                                <input
                                                    type="text"
                                                    value={newMessage}
                                                    onChange={e => setNewMessage(e.target.value)}
                                                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                                                    onFocus={() => setShowEmojiPicker(false)}
                                                    placeholder="Escribe un mensaje..."
                                                    className="w-full py-4 bg-transparent outline-none text-[15px] font-medium text-stone-800 dark:text-white placeholder:text-stone-400"
                                                />
                                            </div>
                                        )}

                                        {(!newMessage.trim() && !selectedImage && !isRecording) ? (
                                            <button
                                                onClick={startRecording}
                                                className="h-14 w-14 bg-emerald-500 hover:bg-emerald-600 text-white rounded-[2rem] flex items-center justify-center shadow-xl shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95 shrink-0"
                                            >
                                                <Mic className="w-6 h-6" />
                                            </button>
                                        ) : isRecording ? (
                                            <button
                                                onClick={stopRecording}
                                                className="h-14 w-14 bg-emerald-500 hover:bg-emerald-600 text-white rounded-[2rem] flex items-center justify-center shadow-xl shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95 shrink-0 animate-in zoom-in"
                                            >
                                                <Send className="w-6 h-6 ml-1" />
                                            </button>
                                        ) : (
                                            <button
                                                onClick={sendMessage}
                                                disabled={sending}
                                                className="h-14 w-14 bg-emerald-500 hover:bg-emerald-600 text-white rounded-[2rem] flex items-center justify-center shadow-xl shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95 shrink-0 animate-in zoom-in"
                                            >
                                                <Send className="w-6 h-6 ml-1" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center opacity-70">
                                <div className="w-32 h-32 bg-gradient-to-br from-stone-100 to-white dark:from-stone-800 dark:to-stone-900 rounded-full flex items-center justify-center mb-6 shadow-2xl shadow-black/5 hover:scale-105 transition-transform duration-500">
                                    <MessageCircle className="w-12 h-12 text-stone-300 dark:text-stone-600" />
                                </div>
                                <h2 className="text-2xl font-black text-stone-400 dark:text-stone-500">Buzón Atelier</h2>
                            </div>
                        )}
                    </div>
                </div>
            )}
            <TestChatModal isOpen={showTestChat} onClose={() => setShowTestChat(false)} />

            {/* Modal: Crear Ficha desde Chat */}
            {showCreateClientModal && extractedClient && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-center justify-center p-4" onClick={() => setShowCreateClientModal(false)}>
                    <div className="bg-white dark:bg-stone-900 rounded-3xl shadow-2xl w-full max-w-md border border-stone-200/50 dark:border-white/10 overflow-hidden" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="px-6 py-4 bg-gradient-to-r from-violet-500 to-indigo-500 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-white" />
                                <h3 className="text-base font-black text-white">Crear Ficha</h3>
                            </div>
                            <button onClick={() => setShowCreateClientModal(false)} className="p-1 rounded-lg hover:bg-white/20 transition-colors">
                                <X className="w-4 h-4 text-white" />
                            </button>
                        </div>
                        <p className="px-6 pt-3 text-[11px] text-stone-400 font-medium">Datos extraídos automáticamente de la conversación. Editá lo que necesites antes de confirmar.</p>

                        {/* Form */}
                        <div className="p-6 space-y-3">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1 block">Nombre *</label>
                                <input
                                    value={extractedClient.name}
                                    onChange={e => setExtractedClient({ ...extractedClient, name: e.target.value })}
                                    className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-sm font-semibold text-stone-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1 block">Teléfono</label>
                                <input
                                    value={extractedClient.phone || ''}
                                    onChange={e => setExtractedClient({ ...extractedClient, phone: e.target.value || null })}
                                    placeholder="Ej: 3515551234"
                                    className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-sm font-semibold text-stone-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1 block">Interés</label>
                                    <input
                                        value={extractedClient.interest || ''}
                                        onChange={e => setExtractedClient({ ...extractedClient, interest: e.target.value || null })}
                                        placeholder="Ej: Multifocal"
                                        className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-sm font-semibold text-stone-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1 block">Obra Social</label>
                                    <input
                                        value={extractedClient.insurance || ''}
                                        onChange={e => setExtractedClient({ ...extractedClient, insurance: e.target.value || null })}
                                        placeholder="Ej: OSDE"
                                        className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-sm font-semibold text-stone-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1 block">Origen</label>
                                <input
                                    value={extractedClient.contactSource || ''}
                                    onChange={e => setExtractedClient({ ...extractedClient, contactSource: e.target.value })}
                                    className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-sm font-semibold text-stone-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1 block">Notas</label>
                                <textarea
                                    value={extractedClient.notes || ''}
                                    onChange={e => setExtractedClient({ ...extractedClient, notes: e.target.value || null })}
                                    rows={2}
                                    placeholder="Detalles importantes de la conversación..."
                                    className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-sm font-semibold text-stone-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all resize-none"
                                />
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="px-6 pb-5 flex gap-2">
                            <button
                                onClick={() => setShowCreateClientModal(false)}
                                className="flex-1 px-4 py-2.5 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-stone-200 dark:hover:bg-stone-700 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmCreateClient}
                                disabled={creatingClient || !extractedClient.name.trim()}
                                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg hover:shadow-xl disabled:opacity-50 flex items-center justify-center gap-1.5"
                            >
                                {creatingClient ? (
                                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Creando...</>
                                ) : (
                                    <><UserPlus className="w-3.5 h-3.5" /> Crear Ficha</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}

// ── QR Renderer ───────────────────────────────────
function QRRenderer({ qr }: { qr: string }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        if (!qr || !canvasRef.current) return;
        QRCode.toCanvas(canvasRef.current, qr, {
            width: 280, margin: 2,
            color: { dark: '#1c1917', light: '#ffffff' }
        });
    }, [qr]);
    return <canvas ref={canvasRef} className="mx-auto rounded-[2rem] shadow-sm" />;
}

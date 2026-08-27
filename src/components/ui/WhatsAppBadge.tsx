"use client";

import { useState, useEffect } from 'react';

export function WhatsAppBadge() {
    const [count, setCount] = useState(0);

    useEffect(() => {
        // Desmontado antes de que termine la cadena de promesas de abajo, y el
        // socket que haya llegado a crearse. Los dos hacen falta para cortar de
        // verdad: el `return () => socket.disconnect()` que había estaba DENTRO
        // del `.then()`, así que era el valor de retorno de la promesa y no el
        // cleanup del efecto — el socket no se cerraba nunca.
        //
        // Este componente vive en la barra lateral y se monta/desmonta cada vez
        // que se colapsa y se vuelve a abrir (`!isCollapsed && <WhatsAppBadge/>`),
        // así que cada apertura dejaba OTRA conexión viva escuchando
        // `new_message_received`. De ahí el sonido repetido: con tres sockets
        // colgados, un mensaje entrante sonaba tres veces. Y de paso eran tres
        // conexiones al bot por pestaña.
        let cancelado = false;
        let socketVivo: { disconnect: () => void } | null = null;

        const fetchCount = async () => {
            try {
                const res = await fetch('/api/whatsapp/chats/unread-count');
                const data = await res.json();
                if (typeof data.count === 'number') {
                    setCount(data.count);
                }
            } catch (e) {
                // Ignore
            }
        };

        fetchCount();
        // Respaldo lento: el socket.io de abajo ya refresca el contador al instante
        // ante mensajes nuevos y cambios de lectura. Este intervalo solo cubre el caso
        // de socket caído; a 15s era polling redundante que golpeaba la DB por pestaña.
        const interval = setInterval(fetchCount, 120000);

        import('socket.io-client').then(({ io }) => {
            if (cancelado) return;
            fetch('/api/whatsapp/status').then(r => r.json()).then(statusData => {
                if (cancelado) return;
                const socketUrl = process.env.NEXT_PUBLIC_WA_URL || statusData.socketUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3100');
                const socket = io(socketUrl, {
                transports: ['websocket'],
                path: '/socket.io',
                reconnection: true,
                // El socket del bot exige token firmado; fresco por intento de
                // conexión para sobrevivir expiración (24h) y reinicios del bot.
                auth: (cb: (data: object) => void) => {
                    fetch('/api/whatsapp/status')
                        .then(r => r.json())
                        .then(d => cb({ token: d.socketToken }))
                        .catch(() => cb({ token: statusData.socketToken }));
                }
            });

            socket.on('new_message_received', ({ name, content }: any) => {
                fetchCount(); // Update badge instantly

                // Sin sonido (pedido de Ishtar 27/8): queda el badge y la
                // notificación del navegador, que no suenan.
                if (!window.location.pathname.includes('/admin/whatsapp')) {
                    if ("Notification" in window && Notification.permission === "granted") {
                        new Notification(`📩 Mensaje de ${name}`, { 
                            body: content, 
                            icon: "https://cdn-icons-png.flaticon.com/512/124/124034.png" 
                        });
                    }
                }
            });

            socket.on('chat_read_status', fetchCount);

                socketVivo = socket;
                // El desmontaje pudo ocurrir mientras se resolvían las promesas:
                // si ya pasó, este socket nace huérfano y hay que cerrarlo acá.
                if (cancelado) socket.disconnect();
            }).catch(console.error);
        });

        return () => {
            cancelado = true;
            clearInterval(interval);
            socketVivo?.disconnect();
        };
    }, []);

    if (count === 0) return null;

    return (
        <span className="ml-auto inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-[10px] font-black text-white bg-green-500 rounded-full shadow-sm">
            {count}
        </span>
    );
}

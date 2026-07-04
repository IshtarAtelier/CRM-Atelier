"use client";

import { useState, useEffect } from 'react';

export function WhatsAppBadge() {
    const [count, setCount] = useState(0);

    useEffect(() => {
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
            fetch('/api/whatsapp/status').then(r => r.json()).then(statusData => {
                const token = statusData.socketToken;
                const socketUrl = process.env.NEXT_PUBLIC_WA_URL || statusData.socketUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3100');
                const socket = io(socketUrl, {
                transports: ['websocket'],
                path: '/socket.io',
                reconnection: true
            });

            socket.on('new_message_received', ({ name, content }: any) => {
                fetchCount(); // Update badge instantly

                // Play sound if not on whatsapp page (since page.tsx already plays it if on page)
                if (!window.location.pathname.includes('/admin/whatsapp')) {
                    try {
                        const audio = new Audio('/sounds/notification.ogg');
                        audio.play().catch(() => {});
                    } catch (e) {}
                    
                    if ("Notification" in window && Notification.permission === "granted") {
                        new Notification(`📩 Mensaje de ${name}`, { 
                            body: content, 
                            icon: "https://cdn-icons-png.flaticon.com/512/124/124034.png" 
                        });
                    }
                }
            });

            socket.on('chat_read_status', fetchCount);

                return () => { socket.disconnect(); };
            }).catch(console.error);
        });

        return () => clearInterval(interval);
    }, []);

    if (count === 0) return null;

    return (
        <span className="ml-auto inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-[10px] font-black text-white bg-green-500 rounded-full shadow-sm">
            {count}
        </span>
    );
}

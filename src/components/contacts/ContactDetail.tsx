'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Contact } from '@/types/contacts';

// Modular Components
import ContactHeader from './ContactHeader';
import HistoryManager from './HistoryManager';
import TaskManager from './TaskManager';
import PrescriptionManager from './PrescriptionManager';
import OrderManager from './OrderManager';

interface ContactDetailProps {
    contactId: string;
    onClose: () => void;
    onEdit: (initialData: any) => void;
    onToggleFavorite: (id: string) => Promise<boolean>;
    onUpdatePriority: (id: string, stars: number) => Promise<boolean>;
    onAddInteraction: (id: string, type: string, content: string) => Promise<boolean>;
    onAddTask: (id: string, description: string, dueDate?: string) => Promise<boolean>;
    onUpdateTaskStatus: (id: string, taskId: string, status: string) => Promise<boolean>;
    onStatusChange: (id: string, status: string, userRole?: string) => Promise<boolean>;
    onDeleteOrder: (orderId: string, reason?: string, role?: string) => Promise<any> | void;
    autoStartQuote?: boolean;
}

export default function ContactDetail({
    contactId,
    onClose,
    onEdit,
    onToggleFavorite,
    onUpdatePriority,
    onAddInteraction,
    onAddTask,
    onUpdateTaskStatus,
    onStatusChange,
    onDeleteOrder,
    autoStartQuote
}: ContactDetailProps) {
    const [contact, setContact] = useState<Contact | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState<'history' | 'tasks' | 'prescription' | 'budget' | 'sales'>('history');
    const [currentUserRole, setCurrentUserRole] = useState('STAFF');
    const [pendingConvertOrderId, setPendingConvertOrderId] = useState<string | null>(null);
    const [convertSuccess, setConvertSuccess] = useState(false);
    const [convertError, setConvertError] = useState<string | null>(null);

    const router = useRouter();

    useEffect(() => {
        const loadUser = async () => {
            const res = await fetch('/api/auth/me');
            if (res.ok) {
                const data = await res.json();
                setCurrentUserRole(data.role || 'STAFF');
            }
        };
        loadUser();
        fetchContact();
    }, [contactId]);

    useEffect(() => {
        if (autoStartQuote && contact) {
            setActiveSection('budget');
        }
    }, [autoStartQuote, contact]);

    const fetchContact = async () => {
        try {
            const res = await fetch(`/api/contacts/${contactId}`);
            if (res.ok) {
                const data = await res.json();
                setContact(data);
            }
        } catch (error) {
            console.error('Error fetching contact:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRevertStatus = async () => {
        if (!contact) return;
        const newStatus = contact.status === 'CONFIRMED' ? 'CONTACT' : contact.status;
        const success = await onStatusChange(contactId, newStatus, currentUserRole);
        if (success) fetchContact();
    };

    const handleConvertOrder = async (orderId: string, conversionData?: any) => {
        // Direct conversion - the CheckoutModal in QuoteSummary already handled validation & payment
        try {
            const res = await fetch(`/api/orders/${orderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    orderType: 'SALE',
                    prescriptionId: conversionData?.prescriptionId 
                }),
            });
            if (!res.ok) {
                const errData = await res.json();
                setConvertError(errData.error || 'Error al convertir pedido');
                return;
            }
            setConvertSuccess(true);
            setActiveSection('sales');
            fetchContact();
            setTimeout(() => setConvertSuccess(false), 5000);
        } catch (e) {
            setConvertError('Error de red al convertir');
        }
    };

    const handleAddPayment = (orderId: string) => {
        // Open the budget/sales view if not already there, and we could auto-expand the order
        // For now, the button in QuoteSummary already handles opening its internal state if needed
        // but if we want a global payment modal, we'd add it here.
        // Since QuoteSummary now should handle its own "Abonar" trigger if we want to reuse CheckoutModal,
        // or just a simple payment modal. 
        // Let's implement a simple payment trigger here if needed, or just let QuoteSummary handle it.
        setActiveSection(activeSection === 'sales' ? 'sales' : 'budget');
    };

    const handleDeleteOrder = async (orderId: string) => {
        try {
            await onDeleteOrder(orderId);
            fetchContact();
        } catch (e) {
            console.error('Error deleting order:', e);
        }
    };

    if (loading) return (
        <div className="flex-1 flex items-center justify-center bg-stone-50 dark:bg-stone-950">
            <div className="text-center font-black text-stone-400 text-sm animate-pulse tracking-widest uppercase">Cargando ficha...</div>
        </div>
    );

    if (!contact) return (
        <div className="flex-1 flex items-center justify-center bg-stone-50 dark:bg-stone-950">
            <div className="text-center p-12 bg-white dark:bg-stone-900 rounded-[3rem] shadow-xl border border-stone-100 dark:border-stone-800">
                <p className="text-stone-400 font-bold mb-4 italic">No se pudo cargar la información.</p>
                <button onClick={fetchContact} className="px-6 py-3 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest">Reintentar</button>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-md z-[60] flex justify-end animate-in fade-in duration-300">
            <div className="bg-white dark:bg-stone-900 w-full max-w-5xl h-full shadow-2xl flex flex-col border-l border-stone-200 dark:border-stone-800 animate-in slide-in-from-right duration-500">
                
                <ContactHeader 
                    contact={contact}
                    currentUserRole={currentUserRole}
                    setCurrentUserRole={setCurrentUserRole as any}
                    activeSection={activeSection}
                    setActiveSection={setActiveSection}
                    onClose={onClose}
                    onEdit={onEdit}
                    onToggleFavorite={onToggleFavorite}
                    onUpdatePriority={onUpdatePriority}
                    onRevertStatus={handleRevertStatus}
                />

                <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {convertSuccess && (
                        <div className="mb-6 p-4 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100 flex items-center gap-3 animate-bounce">
                            <span className="font-black text-xs uppercase tracking-widest italic">✨ ¡Venta generada con éxito!</span>
                        </div>
                    )}

                    {convertError && (
                        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-2xl border border-red-100 flex items-center gap-3">
                            <span className="font-black text-xs uppercase tracking-widest italic">⚠️ {convertError}</span>
                            <button onClick={() => setConvertError(null)} className="ml-auto text-red-400">×</button>
                        </div>
                    )}

                    {activeSection === 'history' && (
                        <HistoryManager 
                            contactId={contactId}
                            interactions={contact.interactions || []}
                            onAddInteraction={(content) => onAddInteraction(contactId, 'NOTE', content).then(() => fetchContact())}
                        />
                    )}

                    {activeSection === 'tasks' && (
                        <TaskManager 
                            tasks={contact.tasks || []}
                            onAddTask={(desc, date) => onAddTask(contactId, desc, date).then(() => fetchContact())}
                            onToggleTask={(tid, status) => onUpdateTaskStatus(contactId, tid, status).then(() => fetchContact())}
                        />
                    )}

                    {activeSection === 'prescription' && (
                        <PrescriptionManager 
                            contact={contact}
                            onRefresh={fetchContact}
                            conversionOrderId={pendingConvertOrderId}
                            onConversionComplete={() => {
                                setPendingConvertOrderId(null);
                                setConvertSuccess(true);
                                setActiveSection('sales');
                                setTimeout(() => setConvertSuccess(false), 5000);
                            }}
                            onCloseConversion={() => setPendingConvertOrderId(null)}
                        />
                    )}

                    {(activeSection === 'budget' || activeSection === 'sales') && (
                        <OrderManager 
                            contactId={contactId}
                            contact={contact}
                            prescriptions={contact.prescriptions || []}
                            activeSection={activeSection as 'budget' | 'sales'}
                            currentUserRole={currentUserRole}
                            onRefresh={fetchContact}
                            onConvertOrder={handleConvertOrder}
                            onAddPayment={handleAddPayment}
                            onDeleteOrder={handleDeleteOrder}
                        />
                    )}
                </main>
            </div>
        </div>
    );
}

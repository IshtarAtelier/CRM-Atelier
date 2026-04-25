'use client';

import React from 'react';
import { Loader2, AlertCircle, Users } from 'lucide-react';
import { ContactCard } from '@/components/contacts/ContactCard';
import { Contact } from '@/types/contacts';

interface ContactsListProps {
    contacts: Contact[];
    loading: boolean;
    error: string | null;
    activeTab: string;
    onStatusChange: (id: string, status: string) => Promise<boolean>;
    onPriorityChange: (id: string, priority: number) => Promise<boolean>;
    onToggleFavorite: (id: string) => Promise<boolean>;
    onSelect: (id: string) => void;
    onQuote: (id: string) => void;
    currentUserRole?: string;
    onDeleteContact?: (id: string) => Promise<boolean>;
}

export default function ContactsList({
    contacts,
    loading,
    error,
    activeTab,
    onStatusChange,
    onPriorityChange,
    onToggleFavorite,
    onSelect,
    onQuote,
    currentUserRole,
    onDeleteContact
}: ContactsListProps) {
    if (loading && contacts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-stone-400 gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="font-black uppercase tracking-widest text-xs">Sincronizando...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-red-500 gap-4 border-2 border-dashed border-red-100 rounded-[3rem] bg-red-50/50 p-8">
                <AlertCircle className="w-12 h-12" />
                <div className="text-center">
                    <p className="font-black uppercase tracking-widest text-sm mb-2">Ocurrió un error inesperado</p>
                    <p className="text-xs font-bold text-red-400">{error}</p>
                </div>
            </div>
        );
    }

    if (contacts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-stone-200 dark:border-stone-700 rounded-[3rem]">
                <Users className="w-16 h-16 text-stone-200 mb-4" />
                <p className="text-stone-400 font-black uppercase tracking-widest text-sm text-center px-6">
                    No hay {activeTab === 'ALL' ? 'registros' : activeTab === 'CONTACT' ? 'contactos' : activeTab === 'CONFIRMED' ? 'pedidos confirmados' : 'ventas'} para mostrar
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {contacts.map((contact) => (
                <ContactCard
                    key={contact.id}
                    contact={contact}
                    onStatusChange={onStatusChange}
                    onPriorityChange={onPriorityChange}
                    onToggleFavorite={onToggleFavorite}
                    onClick={onSelect}
                    onQuote={onQuote}
                    currentUserRole={currentUserRole}
                    onDeleteContact={onDeleteContact}
                />
            ))}
        </div>
    );
}

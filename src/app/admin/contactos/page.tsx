'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Users, UserPlus, CheckCircle2, UserCheck, Loader2 } from "lucide-react";
import { useContacts } from '@/hooks/useContacts';
import { ContactStatus } from '@/types/contacts';

// Modular Components
import ContactForm from '@/components/ContactForm';
import ContactDetail from '@/components/contacts/ContactDetail';
import FavoritesPanel from '@/components/contacts/FavoritesPanel';

// New Page-specific Modular Components
import ContactsHeader from '@/components/contacts/page/ContactsHeader';
import ContactsFilters from '@/components/contacts/page/ContactsFilters';
import ContactsList from '@/components/contacts/page/ContactsList';

function ContactosPageContent() {
    const searchParams = useSearchParams();
    const [activeTab, setActiveTab] = useState<ContactStatus>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedInterest, setSelectedInterest] = useState('ALL');
    const [currentUserRole, setCurrentUserRole] = useState('STAFF');
    
    const [showForm, setShowForm] = useState(false);
    const [editingContactData, setEditingContactData] = useState<any | null>(null);
    const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
    const [autoStartQuote, setAutoStartQuote] = useState(false);
    const [showFavorites, setShowFavorites] = useState(false);
    const [showRxAlert, setShowRxAlert] = useState(true);

    const {
        contacts,
        expiredRx,
        loading,
        error,
        createContact,
        updateContact,
        updateStatus,
        updatePriority,
        toggleFavorite,
        addInteraction,
        addTask,
        updateTaskStatus,
        addPrescription,
        updatePrescription,
        deletePrescription,
        addPayment,
        checkCanClose,
        deleteOrder,
        deleteContact
    } = useContacts(activeTab, searchQuery, showFavorites, selectedInterest);

    useEffect(() => {
        const clientId = searchParams.get('clientId');
        const idParam = searchParams.get('id');
        if (clientId) {
            setSelectedContactId(clientId);
        } else if (idParam) {
            setSelectedContactId(idParam);
        }

        try {
            const stored = localStorage.getItem('user');
            if (stored) {
                const u = JSON.parse(stored);
                setCurrentUserRole(u.role || 'STAFF');
            }
        } catch { }
    }, [searchParams]);

    const favoriteContacts = contacts.filter(c => c.isFavorite);

    const tabs = [
        { id: 'ALL', label: 'Todos', icon: Users },
        { id: 'CONTACT', label: 'Contactos', icon: UserPlus },
        { id: 'CONFIRMED', label: 'Confirmados', icon: CheckCircle2 },
        { id: 'CLIENT', label: 'Ventas', icon: UserCheck }
    ];

    return (
        <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20 relative">
            
            <ContactsHeader 
                activeTab={activeTab}
                showFavorites={showFavorites}
                setShowFavorites={setShowFavorites}
                favoriteCount={favoriteContacts.length}
                onNewContact={() => { setEditingContactData(null); setShowForm(true); }}
                expiredRx={expiredRx}
                showRxAlert={showRxAlert}
                setShowRxAlert={setShowRxAlert}
                onSelectContact={setSelectedContactId}
            />

            {/* Tabs / Solapas */}
            <div className="flex flex-wrap gap-2 p-1.5 bg-stone-100/50 dark:bg-stone-800/50 rounded-2xl border border-stone-200/50 dark:border-stone-700/50 backdrop-blur-sm shadow-inner">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as ContactStatus)}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${isActive
                                ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-md border border-stone-200/20'
                                : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-300'
                                }`}
                        >
                            <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : ''}`} strokeWidth={2.5} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            <ContactsFilters 
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                selectedInterest={selectedInterest}
                setSelectedInterest={setSelectedInterest}
            />

            <ContactsList 
                contacts={contacts}
                loading={loading}
                error={error}
                activeTab={activeTab}
                onStatusChange={updateStatus}
                onPriorityChange={updatePriority}
                onToggleFavorite={toggleFavorite}
                onSelect={setSelectedContactId}
                onQuote={(id) => { setSelectedContactId(id); setAutoStartQuote(true); }}
                currentUserRole={currentUserRole}
                onDeleteContact={deleteContact}
            />

            {/* Support Components */}
            {showForm && (
                <ContactForm
                    onClose={() => { setShowForm(false); setEditingContactData(null); }}
                    initialData={editingContactData}
                    onSubmit={async (data) => {
                        if (editingContactData) {
                            const updated = await updateContact(editingContactData.id, data);
                            if (updated) {
                                setShowForm(false);
                                if (data.startQuote) {
                                    setSelectedContactId(updated.id);
                                    setAutoStartQuote(true);
                                }
                            }
                        } else {
                            const newContact = await createContact(data);
                            if (newContact) {
                                if (data.followUpTask) {
                                    const dueDate48h = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().split('T')[0];
                                    await addTask(newContact.id, data.followUpTask, dueDate48h);
                                }
                                setShowForm(false);
                                if (data.startQuote) {
                                    setSelectedContactId(newContact.id);
                                    setAutoStartQuote(true);
                                }
                            }
                        }
                    }}
                />
            )}

            {selectedContactId && (
                <ContactDetail
                    contactId={selectedContactId}
                    onClose={() => { setSelectedContactId(null); setAutoStartQuote(false); }}
                    onEdit={(data) => { setEditingContactData(data); setShowForm(true); }}
                    onToggleFavorite={toggleFavorite}
                    onUpdatePriority={updatePriority}
                    onAddInteraction={addInteraction}
                    onAddTask={addTask}
                    onUpdateTaskStatus={updateTaskStatus}
                    onStatusChange={updateStatus}
                    onDeleteOrder={(id) => deleteOrder(id)}
                    onDeleteContact={async (id) => {
                        const success = await deleteContact(id);
                        if (success) setSelectedContactId(null);
                        return success;
                    }}
                    autoStartQuote={autoStartQuote}
                />
            )}

            {showFavorites && (
                <FavoritesPanel
                    favorites={favoriteContacts}
                    onClose={() => setShowFavorites(false)}
                    onSelect={(id) => { setSelectedContactId(id); setShowFavorites(false); }}
                />
            )}

        </div>
    );
}

export default function ContactosPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </div>
        }>
            <ContactosPageContent />
        </Suspense>
    );
}

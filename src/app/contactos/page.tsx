'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, UserPlus, CheckCircle2, UserCheck, Users, Search, Loader2, AlertCircle, Heart, Clock } from "lucide-react";
import ContactForm from '@/components/ContactForm';
import { ContactCard } from '@/components/contacts/ContactCard';
import ContactDetail from '@/components/contacts/ContactDetail';
import FavoritesPanel from '@/components/contacts/FavoritesPanel';
import { useContacts } from '@/hooks/useContacts';
import { ContactStatus } from '@/types/contacts';

export default function ContactosPage() {
    const searchParams = useSearchParams();
    const [activeTab, setActiveTab] = useState<ContactStatus>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingContactData, setEditingContactData] = useState<any | null>(null);
    const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
    const [autoStartQuote, setAutoStartQuote] = useState(false);
    const [showFavorites, setShowFavorites] = useState(false);
    const [selectedInterest, setSelectedInterest] = useState('ALL');
    const [expiredRx, setExpiredRx] = useState<{ id: string; name: string; months: number }[]>([]);
    const [showRxAlert, setShowRxAlert] = useState(true);

    const productTypes: any[] = [];


    useEffect(() => {
        const clientId = searchParams.get('clientId');
        if (clientId) {
            setSelectedContactId(clientId);
        }
    }, [searchParams]);

    // Fetch expired prescriptions (>12 months)
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('/api/contacts?status=ALL');
                const allContacts = await res.json();
                // For each contact with prescriptions, check if latest is > 12 months
                const expired: { id: string; name: string; months: number }[] = [];
                const now = new Date();
                for (const c of allContacts) {
                    if (c.prescriptions && c.prescriptions.length > 0) {
                        const latest = c.prescriptions.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                        const monthsAgo = Math.floor((now.getTime() - new Date(latest.date).getTime()) / (30 * 24 * 60 * 60 * 1000));
                        if (monthsAgo >= 12) {
                            expired.push({ id: c.id, name: c.name, months: monthsAgo });
                        }
                    }
                }
                setExpiredRx(expired);
            } catch { }
        })();
    }, []);

    const {
        contacts,
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
        deleteOrder
    } = useContacts(activeTab, searchQuery, showFavorites, selectedInterest);

    const favoriteContacts = contacts.filter(c => c.isFavorite);

    const tabs = [
        { id: 'ALL', label: 'Todos', icon: Users },
        { id: 'CONTACT', label: 'Contactos', icon: UserPlus },
        { id: 'CONFIRMED', label: 'Confirmados', icon: CheckCircle2 },
        { id: 'CLIENT', label: 'Ventas', icon: UserCheck }
    ];

    return (
        <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20 relative">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-black text-stone-800 dark:text-stone-100 tracking-tight italic">
                        Gestión de <span className="text-primary not-italic text-stone-900 border-b-4 border-primary/30">Contactos</span>
                    </h1>
                    <p className="text-stone-500 mt-2 font-medium uppercase text-[10px] tracking-[0.2em]">
                        {activeTab === 'ALL' ? 'Todos los registros' : activeTab === 'CONTACT' ? 'Prospectos' : activeTab === 'CONFIRMED' ? 'Pedidos Confirmados' : 'Ventas Cerradas'}
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setShowFavorites(!showFavorites)}
                        className={`p-5 rounded-2xl border transition-all relative ${showFavorites
                            ? 'bg-red-50 text-red-500 border-red-200'
                            : 'bg-white dark:bg-stone-800 text-stone-400 border-stone-200 dark:border-stone-700'
                            }`}
                    >
                        <Heart className={`w-6 h-6 ${showFavorites ? 'fill-current' : ''}`} />
                        {favoriteContacts.length > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-stone-900 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                                {favoriteContacts.length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => {
                            setEditingContactData(null);
                            setShowForm(true);
                        }}
                        className="flex items-center gap-3 px-8 py-5 bg-stone-900 text-white dark:bg-primary dark:text-primary-foreground rounded-2xl text-sm font-black shadow-2xl shadow-stone-400/20 hover:scale-105 active:scale-95 transition-all group"
                    >
                        <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform" strokeWidth={3} />
                        NUEVO CONTACTO
                    </button>
                </div>
            </header>

            {/* Prescription Renewal Alert */}
            {showRxAlert && expiredRx.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex items-center gap-4">
                    <Clock className="w-6 h-6 text-amber-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-amber-700 dark:text-amber-400">
                            🔔 {expiredRx.length} receta{expiredRx.length > 1 ? 's' : ''} vencida{expiredRx.length > 1 ? 's' : ''} (+12 meses)
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {expiredRx.slice(0, 5).map(rx => (
                                <button
                                    key={rx.id}
                                    onClick={() => setSelectedContactId(rx.id)}
                                    className="px-3 py-1 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded-lg text-xs font-bold hover:bg-amber-200 dark:hover:bg-amber-800 transition-all"
                                >
                                    {rx.name} ({rx.months}m)
                                </button>
                            ))}
                            {expiredRx.length > 5 && (
                                <span className="px-3 py-1 text-amber-500 text-xs font-bold">+{expiredRx.length - 5} más</span>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={() => setShowRxAlert(false)}
                        className="text-amber-400 hover:text-amber-600 transition-colors flex-shrink-0"
                    >
                        ✕
                    </button>
                </div>
            )}

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

            {/* Barra de Búsqueda */}
            <div className="space-y-4">
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-300 group-focus-within:text-primary transition-colors" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, teléfono, interés u obra social..."
                        className="w-full pl-12 pr-6 py-4 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl shadow-sm focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all font-bold text-sm"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* Filtros de Tipo de Producto */}
                <div className="flex flex-wrap gap-2 pt-2">
                    {productTypes.map((type) => (
                        <button
                            key={type.id}
                            onClick={() => setSelectedInterest(type.id)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border-2 ${selectedInterest === type.id
                                ? 'bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105'
                                : 'bg-white dark:bg-stone-800 border-stone-100 dark:border-stone-700 text-stone-400 hover:border-stone-200 dark:hover:border-stone-600'
                                }`}
                        >
                            {type.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Lista de Contactos */}
            <div className="space-y-4">
                {loading && contacts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-stone-400 gap-4">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <span className="font-black uppercase tracking-widest text-xs">Sincronizando...</span>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center py-20 text-red-500 gap-4 border-2 border-dashed border-red-100 rounded-[3rem] bg-red-50/50 p-8">
                        <AlertCircle className="w-12 h-12" />
                        <div className="text-center">
                            <p className="font-black uppercase tracking-widest text-sm mb-2">Ocurrió un error inesperado</p>
                            <p className="text-xs font-bold text-red-400">{error}</p>
                        </div>
                    </div>
                ) : contacts.length > 0 ? (
                    contacts.map((contact) => (
                        <ContactCard
                            key={contact.id}
                            contact={contact}
                            onStatusChange={updateStatus}
                            onPriorityChange={updatePriority}
                            onToggleFavorite={toggleFavorite}
                            onClick={(id) => setSelectedContactId(id)}
                            onQuote={(id) => {
                                setSelectedContactId(id);
                                setAutoStartQuote(true);
                            }}
                        />
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-stone-200 dark:border-stone-700 rounded-[3rem]">
                        <Users className="w-16 h-16 text-stone-200 mb-4" />
                        <p className="text-stone-400 font-black uppercase tracking-widest text-sm text-center px-6">
                            No hay {activeTab === 'ALL' ? 'registros' : activeTab === 'CONTACT' ? 'contactos' : activeTab === 'CONFIRMED' ? 'pedidos confirmados' : 'ventas'} para mostrar
                        </p>
                    </div>
                )}
            </div>

            {/* Componentes Modulares de Soporte */}
            {showForm && (
                <ContactForm
                    onClose={() => {
                        setShowForm(false);
                        setEditingContactData(null);
                    }}
                    initialData={editingContactData}
                    onSubmit={async (data) => {
                        if (editingContactData) {
                            const success = await updateContact(editingContactData.id, data);
                            if (success) setShowForm(false);
                        } else {
                            const newContact = await createContact(data);
                            if (newContact) {
                                // Si es Multifocal, crear tarea de seguimiento automática a 48hs
                                if (data.followUpTask) {
                                    const dueDate48h = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().split('T')[0];
                                    await addTask(newContact.id, data.followUpTask, dueDate48h);
                                }
                                setShowForm(false);
                                setSelectedContactId(newContact.id);
                                setAutoStartQuote(true);
                            }
                        }
                    }}
                />
            )}

            {selectedContactId && (
                <ContactDetail
                    contactId={selectedContactId}
                    onClose={() => {
                        setSelectedContactId(null);
                        setAutoStartQuote(false);
                    }}
                    onEdit={(data) => {
                        setEditingContactData(data);
                        setShowForm(true);
                    }}
                    onToggleFavorite={toggleFavorite}
                    onUpdatePriority={updatePriority}
                    onAddInteraction={addInteraction}
                    onAddTask={addTask}
                    onUpdateTaskStatus={updateTaskStatus}
                    onAddPrescription={addPrescription}
                    onUpdatePrescription={updatePrescription}
                    onDeletePrescription={deletePrescription}
                    onAddPayment={addPayment}
                    onCheckCanClose={checkCanClose}
                    onStatusChange={updateStatus}
                    onDeleteOrder={deleteOrder}
                    autoStartQuote={autoStartQuote}
                />
            )}

            {showFavorites && (
                <FavoritesPanel
                    favorites={favoriteContacts}
                    onClose={() => setShowFavorites(false)}
                    onSelect={(id) => {
                        setSelectedContactId(id);
                        setShowFavorites(false);
                    }}
                />
            )}

        </div>
    );
}

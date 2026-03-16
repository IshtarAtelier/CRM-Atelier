import { useState, useEffect } from 'react';
import { Contact, ContactStatus, ContactFormData } from '@/types/contacts';

export function useContacts(activeTab: ContactStatus, searchQuery: string, favoritesOnly: boolean = false, interest: string = 'ALL') {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchContacts = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/contacts?status=${activeTab}&search=${searchQuery}&favorites=${favoritesOnly}&interest=${interest}`);
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Error al cargar contactos');
            }
            const data = await res.json();
            setContacts(Array.isArray(data) ? data : []);
            setError(null);
        } catch (err: any) {
            console.error('Fetch error:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const createContact = async (formData: ContactFormData): Promise<Contact | null> => {
        try {
            const res = await fetch('/api/contacts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await res.json().catch(() => ({}));

            if (res.ok) {
                await fetchContacts();
                return data;
            }

            // Error handling improvements
            let errorMsg = 'Error al crear contacto';
            if (data.details?.includes('Unique constraint failed on the fields: (`email`)')) {
                errorMsg = 'Ya existe un contacto con este Email.';
            } else if (data.details?.includes('Unique constraint failed')) {
                errorMsg = 'Error: Estás intentando duplicar un dato que debe ser único (Email o DNI).';
            } else {
                errorMsg = data.details || data.error || errorMsg;
            }

            alert(errorMsg);
            return null;
        } catch (err: any) {
            console.error('Error creating contact:', err);
            alert(`Error de conexión: ${err.message}`);
            return null;
        }
    };

    const updateStatus = async (id: string, newStatus: string, userRole: string = 'STAFF') => {
        try {
            const res = await fetch(`/api/contacts/${id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus, userRole })
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Error al actualizar estado');
            }
            await fetchContacts();
            return true;
        } catch (err) {
            console.error('Error updating status:', err);
            alert(err instanceof Error ? err.message : 'Error al actualizar estado');
            return false;
        }
    };

    const updatePriority = async (id: string, priority: number) => {
        try {
            setContacts(prev => prev.map(c => c.id === id ? { ...c, priority } : c));
            const res = await fetch(`/api/contacts/${id}/priority`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ priority })
            });
            if (!res.ok) await fetchContacts();
            return res.ok;
        } catch (err) {
            await fetchContacts();
            return false;
        }
    };

    const toggleFavorite = async (id: string) => {
        try {
            setContacts(prev => prev.map(c => c.id === id ? { ...c, isFavorite: !c.isFavorite } : c));
            const res = await fetch(`/api/contacts/${id}/favorite`, { method: 'PATCH' });
            if (!res.ok) await fetchContacts();
            return res.ok;
        } catch (err) {
            await fetchContacts();
            return false;
        }
    };

    const getContactDetail = async (id: string): Promise<Contact | null> => {
        try {
            const res = await fetch(`/api/contacts/${id}`);
            if (!res.ok) return null;
            return await res.json();
        } catch (err) {
            return null;
        }
    };

    const addInteraction = async (id: string, type: string, content: string) => {
        try {
            const res = await fetch(`/api/contacts/${id}/interactions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, content })
            });
            return res.ok;
        } catch (err) {
            return false;
        }
    };

    const addTask = async (id: string, description: string, dueDate?: string) => {
        try {
            const res = await fetch(`/api/contacts/${id}/tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description, dueDate })
            });
            return res.ok;
        } catch (err) {
            return false;
        }
    };

    const updateTaskStatus = async (id: string, taskId: string, status: string) => {
        try {
            const res = await fetch(`/api/contacts/${id}/tasks`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ taskId, status })
            });
            return res.ok;
        } catch (err) {
            return false;
        }
    };

    useEffect(() => {
        fetchContacts();
    }, [activeTab, searchQuery, favoritesOnly, interest]);

    const addPrescription = async (clientId: string, data: any) => {
        try {
            const res = await fetch(`/api/contacts/${clientId}/prescriptions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (res.ok) {
                // Refresh contacts to update UI
                fetchContacts();
                return true;
            }
            const errData = await res.json().catch(() => ({}));
            alert(`Error al guardar receta: ${errData.error || 'Error desconocido'}`);
            return false;
        } catch (error: any) {
            console.error('Error adding prescription:', error);
            alert(`Error de red al guardar receta: ${error.message}`);
            return false;
        }
    };

    const addPayment = async (clientId: string, data: any) => {
        try {
            const res = await fetch(`/api/contacts/${clientId}/payments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (res.ok) {
                fetchContacts();
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error adding payment:', error);
            return false;
        }
    };

    const checkCanClose = async (clientId: string) => {
        try {
            const res = await fetch(`/api/contacts/${clientId}/can-close`);
            if (res.ok) return await res.json();
            return { canClose: false, reason: 'Error de servidor' };
        } catch (error) {
            return { canClose: false, reason: 'Error de conexión' };
        }
    };

    const deleteOrder = async (orderId: string, reason: string, role: string = 'STAFF') => {
        try {
            const res = await fetch(`/api/orders/${orderId}?reason=${encodeURIComponent(reason)}&role=${role}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                fetchContacts();
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error deleting order:', error);
            return false;
        }
    };

    const deletePrescription = async (clientId: string, presId: string) => {
        try {
            const res = await fetch(`/api/contacts/${clientId}/prescriptions/${presId}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                fetchContacts();
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error deleting prescription:', error);
            return false;
        }
    };

    const updatePrescription = async (clientId: string, presId: string, data: any) => {
        try {
            const res = await fetch(`/api/contacts/${clientId}/prescriptions/${presId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (res.ok) {
                fetchContacts();
                return true;
            }
            const errData = await res.json().catch(() => ({}));
            alert(`Error al actualizar receta: ${errData.error || 'Error desconocido'}`);
            return false;
        } catch (error: any) {
            console.error('Error updating prescription:', error);
            alert(`Error de red al actualizar receta: ${error.message}`);
            return false;
        }
    };

    const updateContact = async (id: string, formData: Partial<ContactFormData>): Promise<Contact | null> => {
        try {
            const res = await fetch(`/api/contacts/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                await fetchContacts();
                return data;
            }
            alert(`Error al actualizar contacto: ${data.details || data.error || 'Error desconocido'}`);
            return null;
        } catch (err: any) {
            console.error('Error updating contact:', err);
            alert(`Error de conexión: ${err.message}`);
            return null;
        }
    };

    return {
        contacts,
        loading,
        error,
        refresh: fetchContacts,
        createContact,
        updateContact,
        updateStatus,
        updatePriority,
        toggleFavorite,
        getContactDetail,
        addInteraction,
        addTask,
        updateTaskStatus,
        addPrescription,
        addPayment,
        checkCanClose,
        deleteOrder,
        deletePrescription,
        updatePrescription
    };
}

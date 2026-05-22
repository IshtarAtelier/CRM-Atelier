'use client';

import { useState, useEffect } from 'react';
import { 
    ChevronLeft, ChevronRight, TrendingDown, Plus, 
    AlertCircle, CheckCircle2, Building2, Megaphone, 
    Truck, Receipt, Loader2, Copy, Trash2
} from 'lucide-react';

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const EXPENSE_TYPES = [
    { id: 'FIJO', label: 'Gastos Operativos Fijos', icon: Building2, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-950/30' },
    { id: 'MARKETING', label: 'Marketing y Ventas', icon: Megaphone, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/30' },
    { id: 'PROVEEDOR', label: 'Proveedores y Laboratorios', icon: Truck, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-950/30' },
    { id: 'OTRO', label: 'Otros Gastos', icon: Receipt, color: 'text-stone-500', bg: 'bg-stone-50 dark:bg-stone-900' }
];

const DEFAULT_TEMPLATES = [
    { type: 'FIJO', name: 'Alquiler', category: 'ALQUILER' },
    { type: 'FIJO', name: 'Sueldos', category: 'SUELDOS' },
    { type: 'FIJO', name: 'Cargas sociales (vep)', category: 'IMPUESTOS' },
    { type: 'FIJO', name: 'Monotributo Ishtar', category: 'IMPUESTOS' },
    { type: 'FIJO', name: 'Monotributo Yani', category: 'IMPUESTOS' },
    { type: 'FIJO', name: 'Contadora', category: 'CONTADORA' },
    { type: 'FIJO', name: 'Internet / Telefonía', category: 'SERVICIOS' },
    { type: 'FIJO', name: 'Sistema de gestión', category: 'SERVICIOS' },
    { type: 'FIJO', name: 'Alarmas', category: 'SERVICIOS' },
    { type: 'FIJO', name: 'Limpieza', category: 'LIMPIEZA' },
    { type: 'FIJO', name: 'Matrícula / Colegio', category: 'OTRO' },
    { type: 'FIJO', name: 'Servicios (luz, agua, etc.)', category: 'SERVICIOS' },
    { type: 'MARKETING', name: 'Meta Ads', category: 'MARKETING' },
    { type: 'MARKETING', name: 'Google Ads', category: 'MARKETING' },
    { type: 'MARKETING', name: 'Gestión de campañas', category: 'MARKETING' },
    { type: 'PROVEEDOR', name: 'Payway Costos de servicios', category: 'PROVEEDOR' },
    { type: 'PROVEEDOR', name: 'Payway Impuestos', category: 'PROVEEDOR' },
    { type: 'PROVEEDOR', name: 'Laboratorio Optovision', category: 'PROVEEDOR' },
    { type: 'PROVEEDOR', name: 'Laboratorio Grupo Óptico', category: 'PROVEEDOR' },
    { type: 'PROVEEDOR', name: 'Cristaldo', category: 'PROVEEDOR' },
    { type: 'PROVEEDOR', name: 'Comisiones', category: 'PROVEEDOR' },
];

function ExpenseRow({ expense, onSave, onDelete }: { expense: any, onSave: (e: any) => void, onDelete: (e: any) => void }) {
    const [amount, setAmount] = useState(expense.amount > 0 ? expense.amount.toString() : '');
    const [isFocused, setIsFocused] = useState(false);
    const isPending = expense.amount === 0;

    useEffect(() => {
        if (!isFocused) {
            setAmount(expense.amount > 0 ? expense.amount.toString() : '');
        }
    }, [expense.amount, isFocused]);

    const handleBlur = () => {
        setIsFocused(false);
        const numAmount = parseFloat(amount) || 0;
        if (numAmount !== expense.amount) {
            onSave({ ...expense, amount: numAmount });
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            (e.currentTarget as HTMLInputElement).blur();
        }
    };

    return (
        <div className={`group flex items-center justify-between p-3 sm:p-4 transition-colors border-b border-stone-100 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-700/50 ${isFocused ? 'bg-stone-50 dark:bg-stone-700/30' : ''}`}>
            <div className="flex items-center gap-3 flex-1 min-w-0 pr-4">
                <div className={`flex-shrink-0 w-2 h-2 rounded-full ${isPending ? 'bg-red-400 animate-pulse' : 'bg-emerald-400'}`} />
                <span className={`text-sm font-bold truncate ${isPending ? 'text-stone-500' : 'text-stone-800 dark:text-white'}`}>
                    {expense.name}
                </span>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                <div className="relative">
                    <span className={`absolute left-3 top-1/2 -translate-y-1/2 font-black text-sm ${isPending && !amount ? 'text-red-400' : 'text-stone-400'}`}>$</span>
                    <input 
                        type="number" 
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        onFocus={() => setIsFocused(true)}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        placeholder="0"
                        className={`w-28 sm:w-36 pl-7 pr-3 py-2 rounded-lg text-right font-black outline-none transition-all text-sm
                            ${isPending 
                                ? 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 placeholder:text-red-300 dark:placeholder:text-red-800 focus:ring-2 focus:ring-red-500/20' 
                                : 'bg-stone-100 dark:bg-stone-900 text-stone-800 dark:text-white border border-stone-200 dark:border-stone-700 focus:border-primary focus:ring-2 focus:ring-primary/20'
                            }`}
                    />
                </div>
                <button 
                    onClick={() => onDelete(expense)}
                    className="p-2 text-stone-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg sm:opacity-0 group-hover:opacity-100 transition-all focus:opacity-100"
                    title="Eliminar gasto"
                >
                    <Trash2 size={18} />
                </button>
            </div>
        </div>
    );
}

function AddExpenseRow({ type, month, year, onAdd }: { type: string, month: number, year: number, onAdd: (e: any) => Promise<void> }) {
    const [name, setName] = useState('');
    const [amount, setAmount] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        if (!name.trim()) return;
        setIsSaving(true);
        const numAmount = parseFloat(amount) || 0;
        await onAdd({
            name: name.trim(),
            amount: numAmount,
            type,
            category: 'OTRO',
            month,
            year,
            notes: ''
        });
        setName('');
        setAmount('');
        setIsSaving(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSave();
    };

    return (
        <div className="flex items-center gap-2 p-3 sm:p-4 bg-stone-50/50 dark:bg-stone-800/50 rounded-b-2xl">
            <input 
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Añadir nuevo gasto..."
                className="flex-1 bg-transparent text-sm font-bold text-stone-800 dark:text-white outline-none placeholder:text-stone-400 min-w-0"
                disabled={isSaving}
            />
            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-sm text-stone-400">$</span>
                    <input 
                        type="number"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="0"
                        className="w-24 sm:w-28 pl-7 pr-3 py-1.5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg text-right font-black text-sm outline-none focus:border-primary disabled:opacity-50"
                        disabled={isSaving}
                    />
                </div>
                <button 
                    onClick={handleSave}
                    disabled={!name.trim() || isSaving}
                    className="p-2 text-primary hover:bg-primary/10 rounded-lg disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
                >
                    {isSaving ? <Loader2 className="animate-spin w-5 h-5" /> : <Plus size={20} />}
                </button>
            </div>
        </div>
    );
}

export default function GastosPage() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [expenses, setExpenses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    const selectedMonth = currentDate.getMonth() + 1;
    const selectedYear = currentDate.getFullYear();

    useEffect(() => {
        fetchExpenses(selectedMonth, selectedYear);
    }, [selectedMonth, selectedYear]);

    const fetchExpenses = async (m: number, y: number, autoGenerate = true) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/expenses?month=${m}&year=${y}`);
            const data = await res.json();
            if (!data.error) {
                if (Array.isArray(data) && data.length === 0 && autoGenerate) {
                    await autoGenerateTemplate(m, y);
                    return;
                }
                setExpenses(data);
            }
        } catch (error) {
            console.error("Error fetching expenses", error);
        }
        setLoading(false);
    };

    const autoGenerateTemplate = async (m: number, y: number) => {
        try {
            const creates = DEFAULT_TEMPLATES.map(t => fetch('/api/expenses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: t.name,
                    amount: 0,
                    category: t.category,
                    type: t.type,
                    month: m,
                    year: y,
                    notes: ''
                })
            }));
            await Promise.all(creates);
            await fetchExpenses(m, y, false);
        } catch (error) {
            console.error("Error auto-generating template:", error);
            setLoading(false);
        }
    };

    const handlePrevMonth = () => {
        setCurrentDate(new Date(selectedYear, selectedMonth - 2, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(new Date(selectedYear, selectedMonth, 1));
    };

    const handleSaveExpense = async (payload: any) => {
        try {
            const res = await fetch('/api/expenses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                const updated = await res.json();
                setExpenses(prev => {
                    const exists = prev.find(x => x.id === updated.id);
                    if (exists) return prev.map(x => x.id === updated.id ? updated : x);
                    return [...prev, updated];
                });
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleDeleteExpense = async (expense: any) => {
        if (!expense.id) return;
        if (!confirm(`¿Eliminar definitivamente "${expense.name}"?`)) return;
        
        try {
            const res = await fetch(`/api/expenses?id=${expense.id}`, { method: 'DELETE' });
            if (res.ok) {
                setExpenses(prev => prev.filter(x => x.id !== expense.id));
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleGenerateTemplate = async () => {
        setLoading(true);
        try {
            const creates = DEFAULT_TEMPLATES.map(t => fetch('/api/expenses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: t.name,
                    amount: 0,
                    category: t.category,
                    type: t.type,
                    month: selectedMonth,
                    year: selectedYear,
                    notes: ''
                })
            }));
            await Promise.all(creates);
            await fetchExpenses(selectedMonth, selectedYear);
        } catch (error) {
            console.error(error);
            setLoading(false);
        }
    };

    const handleDuplicateLastMonth = async () => {
        setLoading(true);
        try {
            let prevM = selectedMonth - 1;
            let prevY = selectedYear;
            if (prevM === 0) {
                prevM = 12;
                prevY -= 1;
            }
            
            const res = await fetch(`/api/expenses?month=${prevM}&year=${prevY}`);
            const lastMonthExpenses = await res.json();
            
            if (lastMonthExpenses && lastMonthExpenses.length > 0) {
                const creates = lastMonthExpenses.map((t: any) => fetch('/api/expenses', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: t.name,
                        amount: 0,
                        category: t.category,
                        type: t.type,
                        month: selectedMonth,
                        year: selectedYear,
                        notes: ''
                    })
                }));
                await Promise.all(creates);
            } else {
                alert("No hay gastos en el mes anterior para copiar.");
            }
            await fetchExpenses(selectedMonth, selectedYear);
        } catch (error) {
            console.error(error);
            setLoading(false);
        }
    };

    const totalMes = expenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const pendientesCount = expenses.filter(e => e.amount === 0).length;
    const completadosCount = expenses.length - pendientesCount;
    const progress = expenses.length > 0 ? (completadosCount / expenses.length) * 100 : 0;
    
    const now = new Date();
    const isCurrentMonth = now.getMonth() + 1 === selectedMonth && now.getFullYear() === selectedYear;
    const showAntiOlvidoAlert = isCurrentMonth && now.getDate() > 10 && pendientesCount > 0;

    return (
        <main className="min-h-screen bg-stone-50 dark:bg-stone-900 pb-32">
            <div className="bg-white dark:bg-stone-800 border-b border-stone-200 dark:border-stone-700 sticky top-0 z-30 shadow-sm">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                                <TrendingDown size={18} />
                            </div>
                            <h1 className="text-xl font-black text-stone-800 dark:text-white">Gastos</h1>
                        </div>
                        <span className="text-xl font-black text-stone-800 dark:text-white">
                            ${totalMes.toLocaleString()}
                        </span>
                    </div>

                    <div className="flex items-center justify-between bg-stone-100 dark:bg-stone-900 rounded-xl p-1 max-w-sm">
                        <button onClick={handlePrevMonth} className="p-2 sm:p-3 rounded-lg hover:bg-white dark:hover:bg-stone-800 transition-colors text-stone-500">
                            <ChevronLeft size={20} />
                        </button>
                        <div className="font-black text-stone-800 dark:text-white text-sm sm:text-base text-center flex-1 uppercase tracking-widest">
                            {MONTHS[selectedMonth - 1]} {selectedYear}
                        </div>
                        <button onClick={handleNextMonth} className="p-2 sm:p-3 rounded-lg hover:bg-white dark:hover:bg-stone-800 transition-colors text-stone-500">
                            <ChevronRight size={20} />
                        </button>
                    </div>

                    {expenses.length > 0 && (
                        <div className="mt-4">
                            <div className="flex justify-between items-center mb-1.5">
                                <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Progreso de Carga</span>
                                <span className="text-[10px] font-black text-primary">{completadosCount}/{expenses.length} Cargados</span>
                            </div>
                            <div className="h-1.5 w-full bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-primary transition-all duration-500" 
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {showAntiOlvidoAlert && (
                <div className="max-w-4xl mx-auto px-4 mt-4">
                    <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl p-3 flex items-start gap-3">
                        <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={18} />
                        <div>
                            <p className="text-sm font-black text-red-600 dark:text-red-400">Alerta de Carga</p>
                            <p className="text-xs font-medium text-red-500 dark:text-red-300">
                                Ya pasamos el día 10 y tienes {pendientesCount} gasto{pendientesCount > 1 ? 's' : ''} en $0. ¡No te olvides de completarlos!
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-4xl mx-auto px-4 mt-6">
                {loading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="animate-spin text-stone-300 w-8 h-8" />
                    </div>
                ) : expenses.length === 0 ? (
                    <div className="text-center py-16 bg-white dark:bg-stone-800 rounded-2xl border-2 border-dashed border-stone-200 dark:border-stone-700">
                        <Receipt className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                        <h3 className="text-lg font-black text-stone-800 dark:text-white mb-1">Mes en blanco</h3>
                        <p className="text-xs text-stone-400 mb-6 max-w-[250px] mx-auto">
                            No tienes gastos registrados para este mes. ¿Quieres generar la lista base para completarla más rápido?
                        </p>
                        <div className="flex flex-col gap-3 max-w-[250px] mx-auto">
                            <button 
                                onClick={handleDuplicateLastMonth}
                                className="w-full py-3 bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest rounded-xl hover:scale-105 transition-transform flex items-center justify-center gap-2"
                            >
                                <Copy size={16} /> Copiar Mes Anterior
                            </button>
                            <button 
                                onClick={handleGenerateTemplate}
                                className="w-full py-3 bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 text-xs font-black uppercase tracking-widest rounded-xl hover:scale-105 transition-transform flex items-center justify-center gap-2"
                            >
                                <Plus size={16} /> Usar Plantilla Base
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {EXPENSE_TYPES.map(type => {
                            const typeExpenses = expenses.filter(e => e.type === type.id);
                            
                            const TypeIcon = type.icon;
                            const typeTotal = typeExpenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);

                            return (
                                <div key={type.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="flex items-center justify-between mb-3 px-1">
                                        <div className="flex items-center gap-2">
                                            <div className={`p-1.5 rounded-lg ${type.bg}`}>
                                                <TypeIcon className={`w-4 h-4 ${type.color}`} />
                                            </div>
                                            <h2 className="text-xs font-black uppercase tracking-widest text-stone-500">{type.label}</h2>
                                        </div>
                                        <span className="text-xs font-black text-stone-800 dark:text-white">${typeTotal.toLocaleString()}</span>
                                    </div>
                                    
                                    <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-100 dark:border-stone-700 shadow-sm flex flex-col">
                                        {typeExpenses.map((expense, idx) => (
                                            <ExpenseRow 
                                                key={expense.id || `exp-${idx}`} 
                                                expense={expense} 
                                                onSave={handleSaveExpense}
                                                onDelete={handleDeleteExpense}
                                            />
                                        ))}
                                        <AddExpenseRow 
                                            type={type.id} 
                                            month={selectedMonth} 
                                            year={selectedYear} 
                                            onAdd={handleSaveExpense} 
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </main>
    );
}

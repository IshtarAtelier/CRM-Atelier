'use client';

import { useState, useEffect, useRef } from 'react';
import { 
    ChevronLeft, ChevronRight, TrendingDown, Plus, 
    AlertCircle, CheckCircle2, Building2, Megaphone, 
    Truck, Receipt, Loader2, ArrowRight, X, Copy, Trash2
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

export default function GastosPage() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [expenses, setExpenses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingExpense, setEditingExpense] = useState<any>(null);
    const [editAmount, setEditAmount] = useState('');
    const [showNewModal, setShowNewModal] = useState(false);
    
    // Selectors
    const selectedMonth = currentDate.getMonth() + 1; // 1-12
    const selectedYear = currentDate.getFullYear();

    useEffect(() => {
        fetchExpenses(selectedMonth, selectedYear);
    }, [selectedMonth, selectedYear]);

    const fetchExpenses = async (m: number, y: number) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/expenses?month=${m}&year=${y}`);
            const data = await res.json();
            if (!data.error) {
                setExpenses(data);
            }
        } catch (error) {
            console.error("Error fetching expenses", error);
        }
        setLoading(false);
    };

    const handlePrevMonth = () => {
        setCurrentDate(new Date(selectedYear, selectedMonth - 2, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(new Date(selectedYear, selectedMonth, 1));
    };

    const handleSaveAmount = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingExpense) return;
        
        try {
            const numAmount = parseFloat(editAmount) || 0;
            const payload = { ...editingExpense, amount: numAmount };
            
            const res = await fetch('/api/expenses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (res.ok) {
                const updated = await res.json();
                setExpenses(prev => {
                    const exists = prev.find(x => x.id === updated.id);
                    if (exists) {
                        return prev.map(x => x.id === updated.id ? updated : x);
                    }
                    return [...prev, updated];
                });
                setEditingExpense(null);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleDeleteExpense = async () => {
        if (!editingExpense || !editingExpense.id) {
            setEditingExpense(null);
            return;
        }
        
        if (!confirm('¿Estás seguro de que deseas eliminar este gasto?')) return;
        
        try {
            const res = await fetch(`/api/expenses?id=${editingExpense.id}`, {
                method: 'DELETE'
            });
            
            if (res.ok) {
                setExpenses(prev => prev.filter(x => x.id !== editingExpense.id));
                setEditingExpense(null);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleGenerateTemplate = async () => {
        setLoading(true);
        try {
            // Generar a partir de defaults si está vacío
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
        }
    };

    const handleDuplicateLastMonth = async () => {
        setLoading(true);
        try {
            // Buscar gastos del mes anterior
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
                        amount: 0, // Inicia en 0 para que sea "pendiente"
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
        }
    };

    // Cálculos y Métricas
    const totalMes = expenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const pendientesCount = expenses.filter(e => e.amount === 0).length;
    const completadosCount = expenses.length - pendientesCount;
    const progress = expenses.length > 0 ? (completadosCount / expenses.length) * 100 : 0;
    
    // Alerta Anti-Olvido: Si pasamos el día 10 del mes actual y hay pendientes
    const now = new Date();
    const isCurrentMonth = now.getMonth() + 1 === selectedMonth && now.getFullYear() === selectedYear;
    const showAntiOlvidoAlert = isCurrentMonth && now.getDate() > 10 && pendientesCount > 0;

    return (
        <main className="min-h-screen bg-stone-50 dark:bg-stone-900 pb-32">
            {/* Header Mobile-First */}
            <div className="bg-white dark:bg-stone-800 border-b border-stone-200 dark:border-stone-700 sticky top-0 z-30 shadow-sm">
                <div className="max-w-3xl mx-auto px-4 py-4">
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

                    {/* Month Selector */}
                    <div className="flex items-center justify-between bg-stone-100 dark:bg-stone-900 rounded-xl p-1">
                        <button onClick={handlePrevMonth} className="p-3 rounded-lg hover:bg-white dark:hover:bg-stone-800 transition-colors text-stone-500">
                            <ChevronLeft size={20} />
                        </button>
                        <div className="font-black text-stone-800 dark:text-white text-base text-center flex-1 uppercase tracking-widest">
                            {MONTHS[selectedMonth - 1]} {selectedYear}
                        </div>
                        <button onClick={handleNextMonth} className="p-3 rounded-lg hover:bg-white dark:hover:bg-stone-800 transition-colors text-stone-500">
                            <ChevronRight size={20} />
                        </button>
                    </div>

                    {/* Progress Bar */}
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
                <div className="max-w-3xl mx-auto px-4 mt-4">
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

            <div className="max-w-3xl mx-auto px-4 mt-6">
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
                        <div className="flex flex-col gap-3 max-w-[200px] mx-auto">
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
                            if (typeExpenses.length === 0) return null;
                            
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
                                    
                                    <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-100 dark:border-stone-700 shadow-sm overflow-hidden">
                                        {typeExpenses.map((expense, idx) => {
                                            const isPending = expense.amount === 0;
                                            return (
                                                <div 
                                                    key={expense.id} 
                                                    onClick={() => {
                                                        setEditingExpense(expense);
                                                        setEditAmount(expense.amount > 0 ? expense.amount.toString() : '');
                                                    }}
                                                    className={`flex items-center justify-between p-4 cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-700/50 transition-colors ${idx !== typeExpenses.length - 1 ? 'border-b border-stone-100 dark:border-stone-700' : ''}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-2 h-2 rounded-full ${isPending ? 'bg-red-400 animate-pulse' : 'bg-emerald-400'}`} />
                                                        <span className={`text-sm font-bold ${isPending ? 'text-stone-500' : 'text-stone-800 dark:text-white'}`}>
                                                            {expense.name}
                                                        </span>
                                                    </div>
                                                    
                                                    {isPending ? (
                                                        <div className="px-3 py-1 bg-red-50 dark:bg-red-950/30 text-red-500 text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center gap-1">
                                                            Cargar
                                                        </div>
                                                    ) : (
                                                        <span className="text-base font-black text-stone-800 dark:text-white">
                                                            ${expense.amount.toLocaleString()}
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Quick Add Button Mobile */}
            <button 
                onClick={() => {
                    setEditingExpense({ name: '', amount: 0, category: 'OTRO', type: 'OTRO', month: selectedMonth, year: selectedYear });
                    setEditAmount('');
                    setShowNewModal(true);
                }}
                className="fixed bottom-6 right-4 w-14 h-14 bg-primary text-white rounded-full shadow-xl shadow-primary/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-20 lg:hidden"
            >
                <Plus size={24} />
            </button>

            {/* Edit / Quick Input Modal */}
            {editingExpense && !showNewModal && (
                <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-stone-800 w-full max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-4 duration-300">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="text-xs font-black uppercase tracking-widest text-stone-400">Ingresar Monto</h3>
                                    <p className="text-xl font-black text-stone-800 dark:text-white">{editingExpense.name}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {editingExpense.id && (
                                        <button 
                                            onClick={handleDeleteExpense}
                                            className="w-8 h-8 bg-red-50 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-500 hover:bg-red-100"
                                            title="Eliminar gasto"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                    <button 
                                        onClick={() => setEditingExpense(null)}
                                        className="w-8 h-8 bg-stone-100 dark:bg-stone-700 rounded-full flex items-center justify-center text-stone-500 hover:bg-stone-200"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>
                            
                            <form onSubmit={handleSaveAmount}>
                                <div className="relative mb-6">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-stone-400">$</span>
                                    <input 
                                        type="number" 
                                        autoFocus
                                        value={editAmount}
                                        onChange={e => setEditAmount(e.target.value)}
                                        className="w-full text-4xl font-black text-stone-800 dark:text-white bg-transparent outline-none pl-12 pb-2 border-b-2 border-stone-200 dark:border-stone-700 focus:border-primary transition-colors"
                                        placeholder="0"
                                    />
                                </div>
                                <button 
                                    type="submit"
                                    className="w-full py-4 bg-primary text-primary-foreground text-sm font-black uppercase tracking-widest rounded-xl hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/25"
                                >
                                    Guardar Gasto <ArrowRight size={18} />
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* New Custom Expense Modal */}
            {showNewModal && editingExpense && (
                <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-stone-800 w-full max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-black text-stone-800 dark:text-white">Nuevo Gasto Especial</h3>
                            <button 
                                onClick={() => setShowNewModal(false)}
                                className="w-8 h-8 bg-stone-100 dark:bg-stone-700 rounded-full flex items-center justify-center text-stone-500"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={(e) => {
                            setShowNewModal(false);
                            handleSaveAmount(e);
                        }} className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-1">Concepto</label>
                                <input 
                                    type="text" 
                                    required
                                    value={editingExpense.name}
                                    onChange={e => setEditingExpense({...editingExpense, name: e.target.value})}
                                    className="w-full px-4 py-3 bg-stone-100 dark:bg-stone-900 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20"
                                    placeholder="Ej: Arreglo persiana"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-1">Tipo</label>
                                <select 
                                    value={editingExpense.type}
                                    onChange={e => setEditingExpense({...editingExpense, type: e.target.value})}
                                    className="w-full px-4 py-3 bg-stone-100 dark:bg-stone-900 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20"
                                >
                                    <option value="FIJO">Gasto Fijo / Operativo</option>
                                    <option value="MARKETING">Marketing / Ventas</option>
                                    <option value="PROVEEDOR">Laboratorios / Proveedores</option>
                                    <option value="OTRO">Otro Extraordinario</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-1">Monto</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-stone-400">$</span>
                                    <input 
                                        type="number" 
                                        required
                                        value={editAmount}
                                        onChange={e => setEditAmount(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 bg-stone-100 dark:bg-stone-900 rounded-xl text-lg font-black outline-none focus:ring-2 focus:ring-primary/20"
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                            <button 
                                type="submit"
                                className="w-full py-4 mt-2 bg-primary text-primary-foreground text-sm font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/25"
                            >
                                Agregar
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </main>
    );
}

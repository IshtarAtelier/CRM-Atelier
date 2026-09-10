'use client';

import { useState, useEffect } from 'react';
import { 
    ChevronLeft, ChevronRight, TrendingDown, Plus, 
    AlertCircle, Building2, Megaphone, 
    Truck, Receipt, Loader2, Trash2, Lock, CloudOff
} from 'lucide-react';

interface EstadoDeCarga {
    total: number;
    cargados: number;
    enCero: string[];
    ilegibles: string[];
    desactualizados: string[];
    listoParaCerrar: boolean;
}

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const EXPENSE_TYPES = [
    { id: 'FIJO', label: 'Gastos Operativos Fijos', icon: Building2, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-950/30' },
    { id: 'MARKETING', label: 'Marketing y Ventas', icon: Megaphone, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/30' },
    { id: 'PROVEEDOR', label: 'Proveedores y Laboratorios', icon: Truck, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-950/30' },
    { id: 'OTRO', label: 'Otros Gastos', icon: Receipt, color: 'text-stone-500', bg: 'bg-stone-50 dark:bg-stone-900' }
];


const FUENTE_LABELS: Record<string, string> = {
    'meta-ads': 'Traído de Meta Ads',
    'google-ads': 'Traído de Google Ads',
    'usd-fijo': 'Abono en USD convertido',
    laboratorio: 'Calculado de las ventas',
};

function etiquetaFuente(fuente?: string): string {
    return FUENTE_LABELS[fuente || ''] || 'Calculado automáticamente';
}

function ExpenseRow({ expense, onSave, onDelete }: { expense: any, onSave: (e: any) => void, onDelete: (e: any) => void }) {
    const [amount, setAmount] = useState(expense.amount > 0 ? expense.amount.toString() : '');
    const [isFocused, setIsFocused] = useState(false);
    const isPending = expense.amount === 0;
    // Un gasto suelto agregado a mano se borra; los de la lista fija y los que
    // calcula el sistema, no.
    const puedeBorrar = !expense.isCalculated && !expense.obligatorio;

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
                <div className={`flex-shrink-0 w-2 h-2 rounded-full ${(isPending && !expense.isCalculated) ? 'bg-red-400 animate-pulse' : 'bg-emerald-400'}`} />
                <span className={`text-sm font-bold truncate ${(isPending && !expense.isCalculated) ? 'text-stone-500' : 'text-stone-800 dark:text-white'}`}>
                    {expense.name} 
                    {expense.isCalculated && !expense.aviso && <span className="ml-2 text-[10px] bg-stone-200 dark:bg-stone-700 px-2 py-0.5 rounded-full text-stone-500 dark:text-stone-300 uppercase tracking-wider border border-stone-300 dark:border-stone-600">{etiquetaFuente(expense.fuente)}</span>}
                    {expense.aviso && (
                        <span className="ml-2 inline-flex items-center gap-1 text-[10px] bg-red-100 dark:bg-red-950/50 px-2 py-0.5 rounded-full text-red-600 dark:text-red-400 uppercase tracking-wider border border-red-200 dark:border-red-900">
                            <CloudOff size={10} /> Sin datos
                        </span>
                    )}
                </span>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                <div className="relative">
                    <span className={`absolute left-3 top-1/2 -translate-y-1/2 font-black text-sm ${((isPending && !expense.isCalculated) && !amount) ? 'text-red-400' : 'text-stone-400'}`}>$</span>
                    <input 
                        type="number" 
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        onFocus={() => setIsFocused(true)}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        placeholder="0"
                        disabled={expense.isCalculated}
                        title={expense.isCalculated ? `${etiquetaFuente(expense.fuente)}. No se edita a mano.` : ""}
                        className={`w-28 sm:w-36 pl-7 pr-3 py-2 rounded-lg text-right font-black outline-none transition-all text-sm
                            ${expense.isCalculated 
                                ? 'bg-stone-200/50 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border border-transparent cursor-not-allowed opacity-90' 
                                : isPending 
                                    ? 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 placeholder:text-red-300 dark:placeholder:text-red-800 focus:ring-2 focus:ring-red-500/20' 
                                    : 'bg-stone-100 dark:bg-stone-900 text-stone-800 dark:text-white border border-stone-200 dark:border-stone-700 focus:border-primary focus:ring-2 focus:ring-primary/20'
                            }`}
                    />
                </div>
                {puedeBorrar ? (
                    <button 
                        onClick={() => onDelete(expense)}
                        className="p-2 text-stone-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg sm:opacity-0 group-hover:opacity-100 transition-all focus:opacity-100"
                        title="Eliminar gasto"
                    >
                        <Trash2 size={18} />
                    </button>
                ) : (
                    // Los obligatorios y los automáticos ocupan el lugar del
                    // botón con un candado: se ve que no falta nada, que no se
                    // pueden borrar.
                    <div className="w-[34px] flex items-center justify-center text-stone-300 dark:text-stone-600" title={expense.isCalculated ? 'Lo calcula el sistema.' : 'Gasto fijo: está todos los meses y no se puede borrar.'}>
                        <Lock size={14} />
                    </div>
                )}
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
    const [estado, setEstado] = useState<EstadoDeCarga | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    
    const selectedMonth = currentDate.getMonth() + 1;
    const selectedYear = currentDate.getFullYear();

    useEffect(() => {
        fetchExpenses(selectedMonth, selectedYear);
    }, [selectedMonth, selectedYear]);

    // El mes ya no se "genera": la API lo reconcilia contra la lista de
    // conceptos fijos en cada lectura, así que nunca viene vacío ni le falta
    // un concepto nuevo. Por eso se fueron los botones de plantilla y de
    // copiar el mes anterior — copiar arrastraba importes viejos sin revisar.
    const fetchExpenses = async (m: number, y: number) => {
        setLoading(true);
        setError(null);
        try {
            // POST y no GET: abrir un mes lo sincroniza (completa la lista fija
            // y trae Meta/Google), y eso es una escritura. Mirar no debería mutar.
            const res = await fetch(`/api/expenses/sincronizar?month=${m}&year=${y}`, { method: 'POST' });
            const data = await res.json().catch(() => ({ error: 'El servidor respondió algo que no se pudo leer.' }));
            // Si falla, hay que DECIRLO. Tragarse el error dejaba la pantalla
            // con el mes vacío y las cuatro secciones en blanco: se ve igual
            // que un mes sin gastos, y quien lo mire puede ponerse a recargar
            // a mano encima de datos que sí están.
            if (!res.ok || data.error) {
                setError(data.error || `No se pudieron cargar los gastos (HTTP ${res.status}).`);
                setExpenses([]);
                setEstado(null);
            } else {
                setExpenses(data.gastos || []);
                setEstado(data.estado || null);
            }
        } catch (e: any) {
            setError(e?.message || 'No se pudo conectar con el servidor.');
            setExpenses([]);
            setEstado(null);
        }
        setLoading(false);
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
            const body = await res.json();
            if (!res.ok) {
                alert(body.error || 'No se pudo guardar el gasto.');
                await fetchExpenses(selectedMonth, selectedYear);
                return;
            }
            setExpenses(prev => {
                const exists = prev.find(x => x.id === body.id);
                if (exists) return prev.map(x => x.id === body.id ? { ...x, ...body } : x);
                return [...prev, body];
            });
        } catch (error) {
            console.error(error);
        }
    };

    const handleDeleteExpense = async (expense: any) => {
        if (!expense.id) return;
        if (!confirm(`¿Eliminar definitivamente "${expense.name}"?`)) return;
        
        try {
            const res = await fetch(`/api/expenses?id=${expense.id}`, { method: 'DELETE' });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                alert(body.error || 'No se pudo eliminar el gasto.');
                return;
            }
            setExpenses(prev => prev.filter(x => x.id !== expense.id));
        } catch (error) {
            console.error(error);
        }
    };

    const totalMes = expenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    // El progreso se mide sobre la lista fija: los gastos sueltos que alguien
    // agrega a mano ya vienen con importe, y los laboratorios los calcula el
    // sistema. Mezclarlos hacía que el contador nunca llegara a completo.
    const obligatorios = expenses.filter(e => e.obligatorio);
    const pendientes = obligatorios.filter(e => (e.amount || 0) === 0);
    const pendientesCount = pendientes.length;
    const completadosCount = obligatorios.length - pendientesCount;
    const progress = obligatorios.length > 0 ? (completadosCount / obligatorios.length) * 100 : 0;
    const ilegibles = estado?.ilegibles || [];
    const desactualizados = estado?.desactualizados || [];
    
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

                    {obligatorios.length > 0 && (
                        <div className="mt-4">
                            <div className="flex justify-between items-center mb-1.5">
                                <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Gastos fijos cargados</span>
                                <span className="text-[10px] font-black text-primary">{completadosCount}/{obligatorios.length} Cargados</span>
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

            {error && (
                <div className="max-w-4xl mx-auto px-4 mt-4">
                    <div className="bg-red-50 dark:bg-red-950/30 border-2 border-red-300 dark:border-red-900 rounded-xl p-4 flex items-start gap-3">
                        <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={18} />
                        <div className="flex-1">
                            <p className="text-sm font-black text-red-600 dark:text-red-400">No se pudieron cargar los gastos</p>
                            <p className="text-xs font-medium text-red-500 dark:text-red-300 mt-0.5">{error}</p>
                            <p className="text-xs font-medium text-red-500 dark:text-red-300 mt-1">
                                El mes NO está vacío: no se pudo leer. No cargues nada encima hasta que esto se resuelva.
                            </p>
                            <button
                                onClick={() => fetchExpenses(selectedMonth, selectedYear)}
                                className="mt-2 px-3 py-1.5 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors"
                            >
                                Reintentar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {ilegibles.length > 0 && (
                <div className="max-w-4xl mx-auto px-4 mt-4">
                    <div className="bg-red-50 dark:bg-red-950/30 border-2 border-red-300 dark:border-red-900 rounded-xl p-4 flex items-start gap-3">
                        <CloudOff className="text-red-500 flex-shrink-0 mt-0.5" size={18} />
                        <div>
                            <p className="text-sm font-black text-red-600 dark:text-red-400">El cierre de este mes está frenado</p>
                            <p className="text-xs font-medium text-red-500 dark:text-red-300 mt-1">
                                Hay gastos que trae el sistema y no se pudieron leer. El importe existe en la plataforma, así que cerrar el mes sin ellos informaría una ganancia más alta que la real.
                            </p>
                            <ul className="mt-2 space-y-1">
                                {ilegibles.map(m => (
                                    <li key={m} className="text-xs font-bold text-red-600 dark:text-red-400">· {m}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {desactualizados.length > 0 && (
                <div className="max-w-4xl mx-auto px-4 mt-4">
                    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl p-3 flex items-start gap-3">
                        <CloudOff className="text-amber-500 flex-shrink-0 mt-0.5" size={18} />
                        <div>
                            <p className="text-sm font-black text-amber-700 dark:text-amber-400">Importes sin actualizar</p>
                            <p className="text-xs font-medium text-amber-600 dark:text-amber-300 mt-0.5">
                                No frenan el cierre —el importe está—, pero es el de la lectura anterior.
                            </p>
                            <ul className="mt-1.5 space-y-0.5">
                                {desactualizados.map(m => (
                                    <li key={m} className="text-xs font-bold text-amber-700 dark:text-amber-400">· {m}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {showAntiOlvidoAlert && (
                <div className="max-w-4xl mx-auto px-4 mt-4">
                    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl p-3 flex items-start gap-3">
                        <AlertCircle className="text-amber-500 flex-shrink-0 mt-0.5" size={18} />
                        <div>
                            <p className="text-sm font-black text-amber-700 dark:text-amber-400">Alerta de carga</p>
                            <p className="text-xs font-medium text-amber-600 dark:text-amber-300">
                                Ya pasamos el día 10 y {pendientesCount === 1 ? 'queda 1 gasto fijo' : `quedan ${pendientesCount} gastos fijos`} en $0: {pendientes.slice(0, 4).map(e => e.name).join(', ')}{pendientes.length > 4 ? ` y ${pendientes.length - 4} más` : ''}.
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
                ) : error ? null : (
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

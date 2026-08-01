'use client';

import { useState, useRef, useEffect } from 'react';
import { Check, Search, X } from 'lucide-react';

interface Tag {
    id: string;
    name: string;
    color: string | null;
}

interface ChatLabelPickerProps {
    labels: string[];
    availableTags: Tag[];
    onToggle: (labelName: string) => Promise<void>;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    buttonClassName?: string;
    triggerIcon?: React.ReactNode;
}

const getLabelStyleInline = (hexColor: string | null | undefined) => {
    let r = 128, g = 128, b = 128;
    const h = hexColor || '#9e7f65';
    if (h.startsWith('#') && h.length === 7) {
        r = parseInt(h.slice(1, 3), 16);
        g = parseInt(h.slice(3, 5), 16);
        b = parseInt(h.slice(5, 7), 16);
    }
    return {
        backgroundColor: `rgb(${r}, ${g}, ${b})`,
        color: '#ffffff',
        borderColor: `rgb(${r}, ${g}, ${b})`
    };
};

export function ChatLabelPicker({
    labels,
    availableTags,
    onToggle,
    isOpen,
    onOpenChange,
    buttonClassName,
    triggerIcon
}: ChatLabelPickerProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [toggling, setToggling] = useState<string | null>(null);
    const [popoverPosition, setPopoverPosition] = useState<'bottom' | 'top'>('bottom');
    const containerRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    // Detectar si el popover sale de pantalla
    useEffect(() => {
        if (!isOpen || !buttonRef.current) return;

        const timer = setTimeout(() => {
            const buttonRect = buttonRef.current?.getBoundingClientRect();
            if (buttonRect) {
                const spaceBelow = window.innerHeight - buttonRect.bottom;
                const spaceAbove = buttonRect.top;
                setPopoverPosition(spaceBelow < 300 && spaceAbove > 300 ? 'top' : 'bottom');
            }
        }, 0);

        return () => clearTimeout(timer);
    }, [isOpen]);

    const filteredTags = availableTags.filter(tag =>
        tag.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleToggle = async (tagName: string) => {
        setToggling(tagName);
        try {
            await onToggle(tagName);
        } finally {
            setToggling(null);
        }
    };

    const isActive = (tagName: string) => labels.includes(tagName);

    return (
        <div className="relative" ref={containerRef}>
            {/* Trigger Button */}
            <button
                ref={buttonRef}
                onClick={() => onOpenChange(!isOpen)}
                className={buttonClassName || "p-2 bg-white dark:bg-stone-800 border border-stone-200/50 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-700 rounded-xl transition-all shadow-sm"}
                title="Filtrar por etiqueta"
            >
                {triggerIcon}
            </button>

            {/* Popover */}
            {isOpen && (
                <>
                    {/* Backdrop para cerrar al clickear afuera */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => onOpenChange(false)}
                    />

                    {/* Contenido */}
                    <div
                        className={`absolute right-0 z-50 w-72 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-2xl shadow-lg ${
                            popoverPosition === 'bottom' ? 'top-11' : 'bottom-11'
                        }`}
                    >
                        {/* Header */}
                        <div className="px-4 py-3 border-b border-stone-200 dark:border-stone-700">
                            <div className="flex items-center gap-2 bg-stone-50 dark:bg-stone-800/50 px-3 py-2 rounded-lg">
                                <Search className="w-4 h-4 text-stone-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar etiqueta..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="flex-1 bg-transparent text-sm font-medium outline-none text-stone-700 dark:text-stone-200 placeholder-stone-400 dark:placeholder-stone-500"
                                    autoFocus
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="hover:text-stone-600 dark:hover:text-stone-300"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Lista de etiquetas */}
                        <div className="max-h-80 overflow-y-auto custom-scrollbar-smooth">
                            {filteredTags.length > 0 ? (
                                <div className="py-2 px-2">
                                    {filteredTags.map(tag => {
                                        const active = isActive(tag.name);
                                        const isCurrentlyToggling = toggling === tag.name;

                                        return (
                                            <button
                                                key={tag.id}
                                                onClick={() => handleToggle(tag.name)}
                                                disabled={isCurrentlyToggling}
                                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left mb-1 last:mb-0 ${
                                                    active
                                                        ? 'bg-stone-100 dark:bg-stone-800'
                                                        : 'hover:bg-stone-50 dark:hover:bg-stone-800/50'
                                                } ${isCurrentlyToggling ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                {/* Checkbox visual */}
                                                <div
                                                    className="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all"
                                                    style={
                                                        active
                                                            ? getLabelStyleInline(tag.color)
                                                            : {
                                                                  backgroundColor: 'transparent',
                                                                  borderColor: 'var(--border, #ddd)'
                                                              }
                                                    }
                                                >
                                                    {active && <Check className="w-3 h-3" />}
                                                </div>

                                                {/* Nombre de etiqueta */}
                                                <span className="flex-1 text-sm font-medium text-stone-700 dark:text-stone-200">
                                                    {tag.name}
                                                </span>

                                                {/* Color preview */}
                                                {tag.color && (
                                                    <div
                                                        className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm"
                                                        style={{ backgroundColor: tag.color }}
                                                        title={tag.color}
                                                    />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="py-8 text-center text-sm text-stone-400 dark:text-stone-500">
                                    {searchQuery
                                        ? 'No hay etiquetas que coincidan'
                                        : 'Sin etiquetas disponibles'}
                                </div>
                            )}
                        </div>

                        {/* Footer (contador) */}
                        {filteredTags.length > 0 && (
                            <div className="px-4 py-2 border-t border-stone-200 dark:border-stone-700 text-[11px] text-stone-500 dark:text-stone-400">
                                {labels.length > 0
                                    ? `${labels.length} etiqueta${labels.length !== 1 ? 's' : ''} activa${labels.length !== 1 ? 's' : ''}`
                                    : 'Sin etiquetas'}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

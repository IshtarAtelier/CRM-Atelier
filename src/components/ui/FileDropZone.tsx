'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, X, FileImage, File as FileIcon, AlertCircle, Clipboard } from 'lucide-react';

interface FileDropZoneProps {
    /** Accepted file types, e.g. "image/*" or "image/*,.pdf" */
    accept?: string;
    /** Max file size in MB */
    maxSizeMB?: number;
    /** Callback when a valid file is selected/dropped */
    onFile: (file: File) => void;
    /** Label text shown in the drop zone */
    label?: string;
    /** Optional preview URL (e.g. already uploaded image) */
    preview?: string | null;
    /** Callback to clear the preview */
    onClearPreview?: () => void;
    /** Extra CSS classes for the container */
    className?: string;
    /** Whether the component is in a loading/processing state */
    loading?: boolean;
    /** Loading label text */
    loadingLabel?: string;
    /** Whether to disable the component */
    disabled?: boolean;
    /** Compact mode (smaller height) */
    compact?: boolean;
}

export default function FileDropZone({
    accept = 'image/*',
    maxSizeMB = 10,
    onFile,
    label = 'Arrastrá un archivo aquí o hacé click para seleccionar',
    preview = null,
    onClearPreview,
    className = '',
    loading = false,
    loadingLabel = 'Procesando...',
    disabled = false,
    compact = false,
}: FileDropZoneProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pasteFlash, setPasteFlash] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const dragCountRef = useRef(0);

    const validateFile = useCallback((file: File): boolean => {
        setError(null);

        // Size check
        if (file.size > maxSizeMB * 1024 * 1024) {
            setError(`El archivo excede ${maxSizeMB}MB`);
            return false;
        }

        // Type check
        if (accept && accept !== '*') {
            const acceptedTypes = accept.split(',').map(t => t.trim());
            const fileType = file.type;
            const fileExt = '.' + (file.name.split('.').pop() || '').toLowerCase();

            const isValid = acceptedTypes.some(type => {
                if (type.endsWith('/*')) {
                    return fileType.startsWith(type.replace('/*', '/'));
                }
                if (type.startsWith('.')) {
                    return fileExt === type.toLowerCase();
                }
                return fileType === type;
            });

            if (!isValid) {
                setError('Tipo de archivo no permitido');
                return false;
            }
        }

        return true;
    }, [accept, maxSizeMB]);

    const handleFile = useCallback((file: File) => {
        if (validateFile(file)) {
            setError(null);
            onFile(file);
        }
    }, [validateFile, onFile]);

    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCountRef.current++;
        if (dragCountRef.current === 1) {
            setIsDragging(true);
        }
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCountRef.current--;
        if (dragCountRef.current === 0) {
            setIsDragging(false);
        }
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCountRef.current = 0;
        setIsDragging(false);

        if (disabled || loading) return;

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    }, [disabled, loading, handleFile]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFile(file);
        }
        // Reset input so same file can be selected again
        e.target.value = '';
    }, [handleFile]);

    const handleClick = useCallback(() => {
        if (!disabled && !loading) {
            inputRef.current?.click();
        }
    }, [disabled, loading]);

    // Clipboard paste support (Ctrl+V / Cmd+V)
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            if (disabled || loading || preview) return;

            const items = e.clipboardData?.items;
            if (!items) return;

            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    const file = item.getAsFile();
                    if (file) {
                        // Show paste flash animation
                        setPasteFlash(true);
                        setTimeout(() => setPasteFlash(false), 600);
                        handleFile(file);
                    }
                    return;
                }
            }
        };

        document.addEventListener('paste', handlePaste);
        return () => document.removeEventListener('paste', handlePaste);
    }, [disabled, loading, preview, handleFile]);

    // If there's a preview, show it
    if (preview) {
        return (
            <div className={`relative group overflow-hidden rounded-2xl ${className}`}>
                <img
                    src={preview}
                    alt="Preview"
                    className={`w-full ${compact ? 'h-32' : 'h-40'} object-cover border-2 ${loading ? 'border-primary opacity-80' : 'border-emerald-200 dark:border-emerald-800'} transition-all`}
                />
                
                {loading && (
                    <>
                        {/* Dark Overlay */}
                        <div className="absolute inset-0 bg-primary/10 backdrop-blur-[2px]" />
                        
                        {/* Laser Scanner Line */}
                        <div 
                            className="absolute left-0 right-0 h-0.5 bg-primary shadow-[0_0_20px_3px_rgba(52,211,153,1)] z-10"
                            style={{
                                animation: 'scan-laser 1.5s ease-in-out infinite alternate'
                            }}
                        />
                        <style>{`
                            @keyframes scan-laser {
                                0% { top: 0%; opacity: 0; }
                                10% { opacity: 1; }
                                90% { opacity: 1; }
                                100% { top: 100%; opacity: 0; }
                            }
                        `}</style>
                        
                        {/* Centered Loading Badge */}
                        <div className="absolute inset-0 flex items-center justify-center z-20">
                            <span className="bg-stone-900/80 text-primary px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-md border border-primary/50 shadow-[0_0_30px_rgba(52,211,153,0.3)] animate-pulse">
                                {loadingLabel || 'Escaneando...'}
                            </span>
                        </div>
                    </>
                )}

                {onClearPreview && !loading && (
                    <button
                        onClick={onClearPreview}
                        className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:scale-110 transition-all shadow-lg opacity-0 group-hover:opacity-100 z-30"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className={className}>
            <div
                onClick={handleClick}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={`
                    relative flex flex-col items-center justify-center w-full
                    ${compact ? 'h-28' : 'min-h-[140px] py-6'}
                    rounded-2xl cursor-pointer
                    transition-all duration-300 ease-out overflow-hidden
                    ${disabled || loading
                        ? 'opacity-50 cursor-not-allowed bg-stone-100 dark:bg-stone-900 border-2 border-stone-200 dark:border-stone-700'
                        : isDragging || pasteFlash
                            ? 'bg-primary/5 dark:bg-primary/10 border-2 border-primary border-dashed scale-[1.02] shadow-lg shadow-primary/10'
                            : 'bg-stone-50 dark:bg-stone-900 border-2 border-dashed border-stone-200 dark:border-stone-700 hover:border-primary/50 hover:bg-primary/[0.02] group'
                    }
                `}
            >
                {/* Paste Flash Overlay */}
                <div className={`absolute inset-0 bg-primary/20 transition-opacity duration-300 pointer-events-none ${pasteFlash ? 'opacity-100' : 'opacity-0'}`} />

                <input
                    ref={inputRef}
                    type="file"
                    accept={accept}
                    onChange={handleInputChange}
                    className="hidden"
                    disabled={disabled || loading}
                />

                {loading ? (
                    <>
                        <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin mb-3 relative z-10" />
                        <span className="text-[10px] font-black text-primary uppercase tracking-widest animate-pulse relative z-10">
                            {loadingLabel}
                        </span>
                    </>
                ) : isDragging ? (
                    <>
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-3 animate-bounce relative z-10">
                            <Upload className="w-6 h-6 text-primary" />
                        </div>
                        <span className="text-xs font-black text-primary uppercase tracking-widest relative z-10">
                            Soltá el archivo aquí
                        </span>
                    </>
                ) : pasteFlash ? (
                    <>
                        <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mb-3 scale-110 transition-transform relative z-10">
                            <Clipboard className="w-6 h-6 text-primary" />
                        </div>
                        <span className="text-xs font-black text-primary uppercase tracking-widest relative z-10">
                            ¡Imagen Pegada!
                        </span>
                    </>
                ) : (
                    <>
                        <div className="w-10 h-10 bg-stone-100 dark:bg-stone-800 rounded-full flex items-center justify-center mb-2 group-hover:bg-primary/10 group-hover:scale-110 transition-all duration-300 relative z-10">
                            {accept?.includes('image') ? (
                                <FileImage className="w-5 h-5 text-stone-300 group-hover:text-primary transition-colors duration-300" />
                            ) : (
                                <FileIcon className="w-5 h-5 text-stone-300 group-hover:text-primary transition-colors duration-300" />
                            )}
                        </div>
                        <span className="text-[10px] font-black text-stone-400 group-hover:text-primary/70 uppercase tracking-widest transition-colors duration-300 text-center px-4 relative z-10">
                            {label}
                        </span>
                        
                        <div className="flex items-center gap-2 mt-2 relative z-10">
                            <span className="flex items-center gap-1 text-[9px] font-bold text-stone-400 bg-stone-200/50 dark:bg-stone-800/50 px-2 py-0.5 rounded-md">
                                <Clipboard className="w-3 h-3" /> Ctrl+V para pegar
                            </span>
                            <span className="text-[9px] font-bold text-stone-300">
                                Máx. {maxSizeMB}MB
                            </span>
                        </div>
                    </>
                )}
            </div>

            {error && (
                <div className="flex items-center gap-1.5 mt-2 text-red-500 animate-in slide-in-from-top duration-200">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-[10px] font-bold">{error}</span>
                </div>
            )}
        </div>
    );
}

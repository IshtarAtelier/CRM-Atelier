'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, X, FileImage, File as FileIcon, AlertCircle } from 'lucide-react';

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

    // If there's a preview, show it
    if (preview) {
        return (
            <div className={`relative group ${className}`}>
                <img
                    src={preview}
                    alt="Preview"
                    className={`w-full ${compact ? 'h-32' : 'h-40'} object-cover rounded-2xl border-2 border-emerald-200 dark:border-emerald-800 transition-all`}
                />
                {onClearPreview && (
                    <button
                        onClick={onClearPreview}
                        className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:scale-110 transition-all shadow-lg opacity-0 group-hover:opacity-100"
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
                    transition-all duration-300 ease-out
                    ${disabled || loading
                        ? 'opacity-50 cursor-not-allowed bg-stone-100 dark:bg-stone-900 border-2 border-stone-200 dark:border-stone-700'
                        : isDragging
                            ? 'bg-primary/5 dark:bg-primary/10 border-2 border-primary border-dashed scale-[1.02] shadow-lg shadow-primary/10'
                            : 'bg-stone-50 dark:bg-stone-900 border-2 border-dashed border-stone-200 dark:border-stone-700 hover:border-primary/50 hover:bg-primary/[0.02] group'
                    }
                `}
            >
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
                        <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin mb-3" />
                        <span className="text-[10px] font-black text-primary uppercase tracking-widest animate-pulse">
                            {loadingLabel}
                        </span>
                    </>
                ) : isDragging ? (
                    <>
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-3 animate-bounce">
                            <Upload className="w-6 h-6 text-primary" />
                        </div>
                        <span className="text-xs font-black text-primary uppercase tracking-widest">
                            Soltá el archivo aquí
                        </span>
                    </>
                ) : (
                    <>
                        <div className="w-10 h-10 bg-stone-100 dark:bg-stone-800 rounded-full flex items-center justify-center mb-2 group-hover:bg-primary/10 group-hover:scale-110 transition-all duration-300">
                            {accept?.includes('image') ? (
                                <FileImage className="w-5 h-5 text-stone-300 group-hover:text-primary transition-colors duration-300" />
                            ) : (
                                <FileIcon className="w-5 h-5 text-stone-300 group-hover:text-primary transition-colors duration-300" />
                            )}
                        </div>
                        <span className="text-[10px] font-black text-stone-400 group-hover:text-primary/70 uppercase tracking-widest transition-colors duration-300 text-center px-4">
                            {label}
                        </span>
                        <span className="text-[9px] font-bold text-stone-300 mt-1">
                            Máx. {maxSizeMB}MB
                        </span>
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

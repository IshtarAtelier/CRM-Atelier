'use client';

import { useState, useEffect } from 'react';
import { UploadCloud, Loader2, Sparkles } from 'lucide-react';
import Image from "next/image";

interface AIImageUploaderProps {
  productId: string;
  initialStatus?: string;
  initialImages?: string[];
  onSuccess?: () => void;
}

/**
 * Componente reutilizable para mostrar el estado de las imágenes de catálogo
 * y permitir subir nuevas fotos directamente desde el modal de edición.
 * Soporta múltiples imágenes (galería multi-ángulo).
 */
export default function AIImageUploader({ productId, initialStatus = 'IDLE', initialImages = [], onSuccess }: AIImageUploaderProps) {
  const [status, setStatus] = useState(initialStatus);
  const [images, setImages] = useState<string[]>(initialImages);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');

  // Polling: check if background processing has finished
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (status === 'PROCESSING') {
      intervalId = setInterval(async () => {
        try {
          const res = await fetch(`/api/products?_cb=${Date.now()}`);
          const products = await res.json();
          const product = products.find((p: any) => p.id === productId);

          if (product) {
            if (product.imageProcessingStatus === 'READY') {
              setStatus('READY');
              setImages(product.imagenesCatalogo || []);
              clearInterval(intervalId);
              if (onSuccess) onSuccess();
            } else if (product.imageProcessingStatus === 'ERROR') {
              setStatus('ERROR');
              setError('Error en el procesamiento de IA');
              clearInterval(intervalId);
            }
          }
        } catch (e) {
          console.error('Polling error', e);
        }
      }, 3000);
    }

    return () => { if (intervalId) clearInterval(intervalId); };
  }, [status, productId, onSuccess]);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setError('');

    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')).slice(0, 3);
    if (files.length === 0) { setError('Por favor sube imágenes válidas'); return; }

    await uploadAndProcess(files);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const files = Array.from(e.target.files || []).slice(0, 3);
    if (files.length === 0) return;
    await uploadAndProcess(files);
  };

  const uploadAndProcess = async (files: File[]) => {
    setStatus('PROCESSING');

    try {
      const imageKeys: string[] = [];

      for (const file of files) {
        const urlRes = await fetch('/api/storage/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, contentType: file.type, productId }),
        });
        const { uploadUrl, key } = await urlRes.json();

        if (uploadUrl.startsWith('/api/storage/local-upload')) {
          await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': file.type }, body: file });
        } else {
          await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
        }
        imageKeys.push(key);
      }

      const trigRes = await fetch('/api/ai/process-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, imageKeys }),
      });

      if (!trigRes.ok) throw new Error('Error al iniciar procesamiento');
      // Polling will handle the rest
    } catch (err: any) {
      setStatus('ERROR');
      setError(err.message);
    }
  };

  const resolveImageUrl = (url: string) => {
    if (url.startsWith('http')) return url;
    return `/api/storage/view?key=${encodeURIComponent(url)}`;
  };

  return (
    <div className="space-y-3 pt-4 border-t border-stone-100 dark:border-stone-800">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="text-[10px] font-black text-stone-800 dark:text-stone-200 uppercase tracking-widest">
          Catálogo Web IA
        </h3>
        {images.length > 0 && (
          <span className="text-[8px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full ml-auto">
            {images.length} vista{images.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Gallery of existing images */}
      {images.length > 0 && status === 'READY' && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {images.map((img, i) => (
            <div key={i} className="w-20 h-20 rounded-xl overflow-hidden border-2 border-emerald-400 shrink-0 bg-white">
              <Image unoptimized src={resolveImageUrl(img)} alt={`Vista ${i + 1}`} className="w-full h-full object-contain p-1" />
            </div>
          ))}
        </div>
      )}

      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
        onDrop={handleDrop}
        className={`relative w-full h-28 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center overflow-hidden transition-all duration-300 ${
          isDragging
            ? 'border-primary bg-primary/5'
            : status === 'PROCESSING'
              ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/10'
              : 'border-stone-300 dark:border-stone-700 hover:border-stone-400 bg-stone-50 dark:bg-stone-800/50'
        }`}
      >
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          disabled={status === 'PROCESSING'}
        />

        {status === 'PROCESSING' ? (
          <div className="flex flex-col items-center text-amber-600 dark:text-amber-500 animate-pulse">
            <Loader2 className="w-6 h-6 animate-spin mb-1" />
            <span className="text-[9px] font-black uppercase tracking-widest">IA Procesando...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center text-stone-400 pointer-events-none">
            <UploadCloud className={`w-6 h-6 mb-1 transition-transform ${isDragging ? 'scale-110 text-primary' : ''}`} />
            <span className="text-[9px] font-black uppercase tracking-widest">
              {images.length > 0 ? 'Reemplazar fotos' : 'Arrastrar fotos'}
            </span>
            <span className="text-[7px] font-bold text-stone-400 mt-0.5">Hasta 3 imágenes · IA genera catálogo</span>
          </div>
        )}
      </div>

      {error && <p className="text-[9px] font-bold text-red-500 bg-red-50 dark:bg-red-950 p-2 rounded-lg">{error}</p>}
    </div>
  );
}

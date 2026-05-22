'use client';

import { useState, useRef } from 'react';
import { X, Camera, ImagePlus, ArrowRight, Search, Plus, Loader2, CheckCircle2, Package, Sparkles } from 'lucide-react';
import { Product } from '@/hooks/useProducts';

interface PhotoStudioProps {
  onClose: () => void;
  onSuccess: () => void;
  products: Product[];
  isAdmin: boolean;
  uniqueBrands: string[];
}

type Step = 'capture' | 'assign' | 'processing';
type AssignMode = 'existing' | 'new';

const ANGLE_LABELS = [
  { key: 'front', label: 'Frente', emoji: '📷', required: true },
  { key: 'angle', label: '45°', emoji: '📐', required: false },
  { key: 'side', label: 'Perfil', emoji: '👤', required: false },
];

const CATEGORIES = [
  { id: 'Lentes de Sol', label: '🕶️ Sol' },
  { id: 'Armazón de Receta', label: '👓 Receta' },
  { id: 'Lentes Especiales', label: '✨ Especiales' },
];

export default function PhotoStudio({ onClose, products, onSuccess, isAdmin, uniqueBrands }: PhotoStudioProps) {
  const [step, setStep] = useState<Step>('capture');
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [assignMode, setAssignMode] = useState<AssignMode>('existing');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [processingMessage, setProcessingMessage] = useState('');

  // New product form
  const [newProduct, setNewProduct] = useState({
    name: '', brand: '', model: '', category: 'Lentes de Sol', price: 0, cost: 0, stock: 1, publishToWeb: true
  });

  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Non-crystal products only
  const frameProducts = products.filter(p =>
    p.category !== 'Cristal' &&
    !['MONOFOCAL', 'MULTIFOCAL', 'BIFOCAL'].includes(p.type?.toUpperCase() || '')
  );

  const filteredProducts = searchQuery
    ? frameProducts.filter(p => {
      const q = searchQuery.toLowerCase();
      return (
        p.name?.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q) ||
        p.model?.toLowerCase().includes(q)
      );
    })
    : frameProducts.slice(0, 20);

  const handleCapture = (index: number, file: File) => {
    const preview = URL.createObjectURL(file);
    setPhotos(prev => {
      const next = [...prev];
      // Fill gaps if needed
      while (next.length <= index) next.push(null as any);
      next[index] = { file, preview };
      return next.filter(Boolean);
    });
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => {
      const next = [...prev];
      if (next[index]?.preview) URL.revokeObjectURL(next[index].preview);
      next.splice(index, 1);
      return next;
    });
  };

  const canProceedToAssign = photos.length >= 1;

  const handleSubmit = async () => {
    setStep('processing');
    setProcessingMessage('Subiendo imágenes...');

    try {
      let targetProductId = selectedProductId;

      // If creating new product, create it first
      if (assignMode === 'new') {
        setProcessingMessage('Creando producto...');
        const payload = {
          name: newProduct.name || `${newProduct.brand} ${newProduct.model}`.trim(),
          brand: newProduct.brand,
          model: newProduct.model,
          category: newProduct.category,
          type: newProduct.category,
          price: newProduct.price,
          cost: newProduct.cost,
          stock: newProduct.stock,
          unitType: 'UNIDAD',
          publishToWeb: newProduct.publishToWeb,
        };
        const createRes = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-role': 'ADMIN' },
          body: JSON.stringify(payload),
        });
        if (!createRes.ok) {
          const err = await createRes.json();
          throw new Error(err.error || 'Error al crear producto');
        }
        const created = await createRes.json();
        targetProductId = created.id;
      }

      if (!targetProductId) throw new Error('No se seleccionó ningún producto');

      // Upload each photo directly to storage
      setProcessingMessage(`Subiendo ${photos.length} foto(s) a la nube...`);
      const imageKeys: string[] = [];

      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];

        // 1. Get presigned URL
        const urlRes = await fetch('/api/storage/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: `view_${i}_${photo.file.name}`,
            contentType: photo.file.type,
            productId: targetProductId,
          }),
        });
        const { uploadUrl, key } = await urlRes.json();

        // 2. Direct upload
        if (uploadUrl.startsWith('/api/storage/local-upload')) {
          await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': photo.file.type }, body: photo.file });
        } else {
          await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': photo.file.type }, body: photo.file });
        }

        imageKeys.push(key);
      }

      // 3. Trigger background AI processing
      setProcessingMessage('Enviando a IA para procesamiento...');
      const trigRes = await fetch('/api/ai/process-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: targetProductId, imageKeys }),
      });

      if (!trigRes.ok) throw new Error('Error al iniciar procesamiento');

      setProcessingMessage('✅ ¡Listo! Las imágenes se están procesando en segundo plano.');

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);

    } catch (err: any) {
      setProcessingMessage(`❌ Error: ${err.message}`);
      setTimeout(() => setStep('assign'), 3000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-stone-900 w-full max-w-2xl rounded-[3rem] shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">

        {/* Header */}
        <header className="p-6 lg:p-8 border-b border-stone-100 dark:border-stone-800 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg lg:text-xl font-black text-stone-800 dark:text-white tracking-tighter">
                Photo <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-500 to-indigo-500">Studio</span>
              </h2>
              <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest">
                {step === 'capture' ? 'Capturá las fotos del producto' : step === 'assign' ? 'Asigná a un producto' : 'Procesando...'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-2xl transition-colors">
            <X className="w-5 h-5 text-stone-400" />
          </button>
        </header>

        {/* Body */}
        <div className="p-6 lg:p-8 overflow-y-auto flex-1 space-y-6">

          {/* ═══ STEP: CAPTURE ═══ */}
          {step === 'capture' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-3 gap-3">
                {ANGLE_LABELS.map((angle, index) => {
                  const photo = photos[index];
                  return (
                    <div key={angle.key} className="relative group">
                      <input
                        ref={el => { fileInputRefs.current[index] = el; }}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleCapture(index, f);
                          e.target.value = '';
                        }}
                      />

                      {photo ? (
                        <div className="relative aspect-square rounded-2xl overflow-hidden border-2 border-emerald-400 shadow-lg">
                          <img src={photo.preview} alt={angle.label} className="w-full h-full object-cover" />
                          <div className="absolute top-1.5 right-1.5 bg-emerald-500 text-white p-1 rounded-full shadow">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </div>
                          <button
                            onClick={() => removePhoto(index)}
                            className="absolute top-1.5 left-1.5 bg-red-500 text-white p-1 rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                          {/* Tap to retake */}
                          <button
                            onClick={() => fileInputRefs.current[index]?.click()}
                            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          >
                            <Camera className="w-6 h-6 text-white" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => fileInputRefs.current[index]?.click()}
                          className={`w-full aspect-square rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 ${
                            angle.required
                              ? 'border-violet-300 dark:border-violet-700 bg-violet-50/50 dark:bg-violet-900/10 hover:border-violet-400'
                              : 'border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800/30 hover:border-stone-300'
                          }`}
                        >
                          <span className="text-2xl">{angle.emoji}</span>
                          <span className="text-[9px] font-black uppercase tracking-widest text-stone-500">{angle.label}</span>
                          {angle.required && <span className="text-[7px] font-bold text-violet-500 uppercase">Requerida</span>}
                          {!angle.required && <span className="text-[7px] font-bold text-stone-400 uppercase">Opcional</span>}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Alternative: Pick from gallery */}
              <div className="text-center">
                <button
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.multiple = true;
                    input.onchange = (e) => {
                      const files = (e.target as HTMLInputElement).files;
                      if (files) {
                        Array.from(files).slice(0, 3).forEach((f, i) => {
                          handleCapture(photos.length + i, f);
                        });
                      }
                    };
                    input.click();
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-[10px] font-black text-stone-500 uppercase tracking-widest hover:text-primary hover:bg-primary/5 rounded-full transition-all"
                >
                  <ImagePlus className="w-4 h-4" />
                  Elegir de fototeca
                </button>
              </div>

              {/* Continue Button */}
              <button
                disabled={!canProceedToAssign}
                onClick={() => setStep('assign')}
                className="w-full py-5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Continuar con {photos.length} foto{photos.length !== 1 ? 's' : ''} <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* ═══ STEP: ASSIGN ═══ */}
          {step === 'assign' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              
              {/* Photos preview strip */}
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {photos.map((p, i) => (
                  <div key={i} className="w-16 h-16 rounded-xl overflow-hidden border-2 border-emerald-400 shrink-0">
                    <img src={p.preview} alt={`Vista ${i + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>

              {/* Mode toggle */}
              <div className="flex p-1 bg-stone-100 dark:bg-stone-800/50 rounded-2xl gap-1 border border-stone-200/50 dark:border-stone-700/50">
                <button
                  onClick={() => setAssignMode('existing')}
                  className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                    assignMode === 'existing' ? 'bg-white dark:bg-stone-700 text-primary shadow-md' : 'text-stone-400'
                  }`}
                >
                  <Package className="w-4 h-4" /> Producto Existente
                </button>
                <button
                  onClick={() => setAssignMode('new')}
                  className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                    assignMode === 'new' ? 'bg-white dark:bg-stone-700 text-primary shadow-md' : 'text-stone-400'
                  }`}
                >
                  <Plus className="w-4 h-4" /> Producto Nuevo
                </button>
              </div>

              {/* ── Existing Product Search ── */}
              {assignMode === 'existing' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="relative">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <input
                      type="text"
                      placeholder="Buscar por marca, modelo..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-5 py-4 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl text-sm font-bold outline-none focus:border-primary transition-all"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-2xl">
                    {filteredProducts.map(p => {
                      const isSelected = selectedProductId === p.id;
                      const displayName = [p.brand, p.name || p.model].filter(Boolean).join(' · ');
                      return (
                        <button
                          key={p.id}
                          onClick={() => setSelectedProductId(p.id)}
                          className={`w-full text-left px-5 py-3.5 rounded-xl flex items-center justify-between gap-3 transition-all ${
                            isSelected
                              ? 'bg-violet-100 dark:bg-violet-900/30 border-2 border-violet-400 shadow-md'
                              : 'bg-stone-50 dark:bg-stone-800/50 border border-stone-100 dark:border-stone-700 hover:border-stone-300'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-black text-stone-800 dark:text-stone-100 truncate">{displayName || 'Sin nombre'}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[8px] font-black uppercase tracking-widest bg-stone-100 dark:bg-stone-700 text-stone-500 px-1.5 py-0.5 rounded">{p.category}</span>
                              <span className="text-[9px] font-bold text-stone-400">Stock: {p.stock}</span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-black text-stone-900 dark:text-white">${p.price?.toLocaleString()}</p>
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-violet-500 mt-1 ml-auto" />}
                          </div>
                        </button>
                      );
                    })}
                    {filteredProducts.length === 0 && (
                      <p className="text-center py-8 text-stone-400 text-[10px] font-black uppercase tracking-widest">Sin resultados</p>
                    )}
                  </div>
                </div>
              )}

              {/* ── New Product Form ── */}
              {assignMode === 'new' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  {/* Category */}
                  <div className="flex gap-2">
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => setNewProduct({ ...newProduct, category: cat.id })}
                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${
                          newProduct.category === cat.id
                            ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-400 text-violet-700 dark:text-violet-400'
                            : 'bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-500'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest ml-3">Marca</label>
                      <input
                        type="text"
                        placeholder="Ej: Ray-Ban"
                        value={newProduct.brand}
                        onChange={e => setNewProduct({ ...newProduct, brand: e.target.value })}
                        className="w-full px-4 py-3.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl font-bold text-sm outline-none focus:border-primary"
                        list="studio-brands-list"
                      />
                      <datalist id="studio-brands-list">
                        {uniqueBrands.map(b => <option key={b} value={b} />)}
                      </datalist>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest ml-3">Modelo / Color</label>
                      <input
                        type="text"
                        placeholder="Ej: Wayfarer Negro"
                        value={newProduct.model}
                        onChange={e => setNewProduct({ ...newProduct, model: e.target.value })}
                        className="w-full px-4 py-3.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl font-bold text-sm outline-none focus:border-primary"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest ml-3">Stock</label>
                      <input
                        type="number"
                        min={0}
                        value={newProduct.stock}
                        onChange={e => setNewProduct({ ...newProduct, stock: parseInt(e.target.value) || 0 })}
                        className="w-full px-4 py-3.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl font-bold text-sm outline-none focus:border-primary"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-primary uppercase tracking-widest ml-3">Precio $</label>
                      <input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={newProduct.price || ''}
                        onChange={e => setNewProduct({ ...newProduct, price: parseFloat(e.target.value) || 0 })}
                        className="w-full px-4 py-3.5 bg-primary/5 border-2 border-primary/20 rounded-xl font-black text-sm text-primary outline-none focus:border-primary"
                      />
                    </div>
                    {isAdmin && (
                      <div className="space-y-1 col-span-2">
                        <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest ml-3">Costo $</label>
                        <input
                          type="number"
                          min={0}
                          placeholder="0"
                          value={newProduct.cost || ''}
                          onChange={e => setNewProduct({ ...newProduct, cost: parseFloat(e.target.value) || 0 })}
                          className="w-full px-4 py-3.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl font-bold text-sm outline-none focus:border-primary"
                        />
                      </div>
                    )}
                    
                    {/* Publish to Web Toggle */}
                    <div className="col-span-2 pt-2">
                      <label className="flex items-center gap-3 cursor-pointer group w-max">
                        <div className={`relative w-10 h-6 rounded-full transition-colors ${newProduct.publishToWeb ? 'bg-primary' : 'bg-stone-300 dark:bg-stone-700'}`}>
                          <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${newProduct.publishToWeb ? 'translate-x-4' : 'translate-x-0'}`} />
                        </div>
                        <input 
                          type="checkbox" 
                          className="hidden" 
                          checked={newProduct.publishToWeb} 
                          onChange={e => setNewProduct({ ...newProduct, publishToWeb: e.target.checked })} 
                        />
                        <div>
                          <p className={`text-xs font-black uppercase tracking-widest ${newProduct.publishToWeb ? 'text-primary' : 'text-stone-500'}`}>
                            🌐 Publicar en Tienda Online
                          </p>
                          <p className="text-[9px] font-bold text-stone-400">El producto aparecerá visible en la web pública.</p>
                        </div>
                      </label>
                    </div>

                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setStep('capture')}
                  className="flex-1 py-4 bg-stone-100 dark:bg-stone-800 text-stone-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-stone-200 transition-colors"
                >
                  ← Volver
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={(assignMode === 'existing' ? !selectedProductId : !newProduct.brand && !newProduct.model)}
                  className="flex-[2] py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-30"
                >
                  <Sparkles className="w-4 h-4" /> Procesar con IA
                </button>
              </div>
            </div>
          )}

          {/* ═══ STEP: PROCESSING ═══ */}
          {step === 'processing' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-6 animate-in fade-in duration-500">
              {processingMessage.startsWith('✅') ? (
                <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center animate-in zoom-in duration-500">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                </div>
              ) : processingMessage.startsWith('❌') ? (
                <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                  <X className="w-10 h-10 text-red-500" />
                </div>
              ) : (
                <div className="w-20 h-20 bg-violet-100 dark:bg-violet-900/30 rounded-full flex items-center justify-center">
                  <Loader2 className="w-10 h-10 text-violet-500 animate-spin" />
                </div>
              )}
              <p className="text-sm font-black text-stone-700 dark:text-stone-200 text-center max-w-xs">
                {processingMessage}
              </p>
              {!processingMessage.startsWith('✅') && !processingMessage.startsWith('❌') && (
                <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">
                  Las imágenes se procesan en segundo plano
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

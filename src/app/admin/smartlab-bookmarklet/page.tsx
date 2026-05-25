'use client';

export default function SmartLabBookmarkletPage() {
    const bookmarkletCode = `javascript:void((function(){try{var h=window.location.hash;var idx=h.indexOf('ATELIER_DATA=');if(idx<0){alert('❌ No hay datos de Atelier en esta página.\\n\\nPrimero andá a Atelier → Ventas y tocá 🧪 SmartLab en una venta.');return;}var raw=decodeURIComponent(h.substring(idx+13));var d=JSON.parse(raw);var ns=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;var ts=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;var filled=[];var queue=[];function add(id,val,label){if(val&&val!=='')queue.push({id:id,val:String(val),label:label});}add('optical-code-text',d.codigoInterno,'Código interno');add('right-eye-far-spherical-autocomplete',d.od_esfera,'Esf OD');add('left-eye-far-spherical-autocomplete',d.oi_esfera,'Esf OI');add('right-eye-far-cylindrical-autocomplete',d.od_cilindro,'Cil OD');add('left-eye-far-cylindrical-autocomplete',d.oi_cilindro,'Cil OI');add('right-eye-far-axis-autocomplete',d.od_eje,'Eje OD');add('left-eye-far-axis-autocomplete',d.oi_eje,'Eje OI');add('right-eye-interpupillary-distance-autocomplete',d.od_dp,'DP OD');add('left-eye-interpupillary-distance-autocomplete',d.oi_dp,'DP OI');add('right-eye-pupillary-height-autocomplete',d.od_altura,'Altura OD');add('left-eye-pupillary-height-autocomplete',d.oi_altura,'Altura OI');var i=0;function next(){if(i>=queue.length){if(d.observaciones){var el=document.getElementById('comment-textarea');if(el){ts.call(el,d.observaciones);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));filled.push('Observación');}}if(d.armazon){var el2=document.getElementById('frame-and-model-textarea');if(el2){ts.call(el2,d.armazon);el2.dispatchEvent(new Event('input',{bubbles:true}));el2.dispatchEvent(new Event('change',{bubbles:true}));filled.push('Armazón');}}alert('✅ Campos completados ('+filled.length+'): '+filled.join(', ')+'\\n\\n⚠️ REVISÁ todo antes de Guardar.\\n❌ No toques Guardar si algo está mal.');return;}var f=queue[i];var el=document.getElementById(f.id);if(!el){i++;next();return;}el.focus();el.click();ns.call(el,f.val);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));setTimeout(function(){var listbox=document.querySelector('[role="listbox"]');if(listbox){var opts=listbox.querySelectorAll('[role="option"]');if(opts.length>0){opts[0].click();filled.push(f.label);}else{el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',keyCode:13,bubbles:true}));filled.push(f.label+'?');}}else{filled.push(f.label);}el.blur();i++;setTimeout(next,400);},600);}next();}catch(e){alert('❌ Error: '+e.message);}})())`;

    return (
        <main className="p-4 lg:p-8 max-w-3xl mx-auto">
            <div className="bg-white dark:bg-stone-800 rounded-3xl p-8 border-2 border-stone-200 dark:border-stone-700 shadow-xl">
                <h1 className="text-3xl font-black text-stone-800 dark:text-white mb-2">
                    🤖 Instalar Bookmarklet SmartLab
                </h1>
                <p className="text-sm text-stone-500 mb-8">
                    Este botón mágico autocompleta el formulario de SmartLab con los datos de Atelier.
                </p>

                {/* Step 1 */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-4">
                        <span className="w-8 h-8 bg-amber-400 text-amber-950 rounded-full flex items-center justify-center text-sm font-black">1</span>
                        <h2 className="text-lg font-black text-stone-800 dark:text-white">Mostrá la barra de favoritos</h2>
                    </div>
                    <p className="text-sm text-stone-600 dark:text-stone-400 ml-11">
                        Si no la ves, apretá <kbd className="px-2 py-1 bg-stone-100 dark:bg-stone-700 rounded text-xs font-bold">Cmd + Shift + B</kbd> en Chrome.
                    </p>
                </div>

                {/* Step 2 */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-4">
                        <span className="w-8 h-8 bg-amber-400 text-amber-950 rounded-full flex items-center justify-center text-sm font-black">2</span>
                        <h2 className="text-lg font-black text-stone-800 dark:text-white">Arrastrá este botón a tu barra de favoritos</h2>
                    </div>
                    <div className="ml-11 p-6 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-2xl border-2 border-dashed border-amber-300 dark:border-amber-700 text-center">
                        <a
                            href={bookmarkletCode}
                            onClick={(e) => {
                                e.preventDefault();
                                alert('¡No hagas clic acá! Tenés que ARRASTRAR este botón hacia tu barra de favoritos (la barra de arriba del navegador).');
                            }}
                            className="inline-block px-8 py-4 bg-gradient-to-r from-amber-400 to-orange-400 text-amber-950 rounded-2xl text-base font-black shadow-xl shadow-amber-400/30 hover:scale-105 transition-all cursor-grab active:cursor-grabbing select-none"
                        >
                            🤖 Atelier → SmartLab
                        </a>
                        <p className="text-xs text-amber-700 dark:text-amber-400 mt-4 font-bold">
                            ⬆️ Arrastrá este botón naranja hacia arriba, a tu barra de favoritos
                        </p>
                        <p className="text-[10px] text-stone-400 mt-2">
                            ⚠️ Si ya tenés uno viejo, borralo primero (click derecho → Eliminar) y arrastrá este nuevo.
                        </p>
                    </div>
                </div>

                {/* Step 3 */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-4">
                        <span className="w-8 h-8 bg-amber-400 text-amber-950 rounded-full flex items-center justify-center text-sm font-black">3</span>
                        <h2 className="text-lg font-black text-stone-800 dark:text-white">¡Listo! Así se usa:</h2>
                    </div>
                    <div className="ml-11 space-y-3">
                        {[
                            'En Atelier → Ventas, hacé clic en el botón 🧪 SmartLab de la venta.',
                            'Se abre SmartLab con los datos incluidos en la URL.',
                            'En SmartLab, seleccioná el tipo de lente (ej: Multifocal).',
                            'Hacé clic en "🤖 Atelier → SmartLab" en tu barra de favoritos.',
                            '¡Los campos se llenan solos! Revisá y dale a Guardar pedido.',
                        ].map((step, i) => (
                            <div key={i} className="flex items-start gap-3">
                                <span className="text-emerald-500 font-black text-sm mt-0.5">→</span>
                                <p className="text-sm text-stone-700 dark:text-stone-300">{step}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Safety notice */}
                <div className="bg-red-50 dark:bg-red-950/20 border-2 border-red-200 dark:border-red-800 rounded-2xl p-4 mt-6">
                    <p className="text-xs font-black text-red-600 dark:text-red-400 uppercase tracking-widest mb-1">⚠️ Importante</p>
                    <p className="text-sm text-red-700 dark:text-red-300">
                        El bookmarklet <strong>NUNCA</strong> hace clic en &quot;Guardar pedido&quot;. Solo llena los campos.
                        Vos revisás y decidís si guardás o no.
                    </p>
                </div>
            </div>
        </main>
    );
}

'use client';

export default function SmartLabBookmarkletPage() {
    const bookmarkletCode = `javascript:void((()=>{try{var e=window.location.hash,t=e.indexOf("ATELIER_DATA=");if(t<0)alert("❌ No hay datos de Atelier en esta página.\\n\\nPrimero andá a Atelier → Ventas y tocá 🧪 SmartLab en una venta.");else{var o=decodeURIComponent(e.substring(t+13)),n=JSON.parse(o),l=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set,c=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value").set,p=[],d=[],s=(u("client-autocomplete",n.paciente_nombre+" "+n.paciente_apellido,"Paciente"),u("optical-code-text",n.codigoInterno,"Código interno"),u("material-autocomplete",n.material,"Material"),u("color-autocomplete",n.color,"Color"),u("diameter-autocomplete",n.diametro,"Diámetro"),u("refractive-index-autocomplete",n.indice,"Índice"),u("right-eye-far-spherical-autocomplete",n.od_esfera,"Esf OD"),u("left-eye-far-spherical-autocomplete",n.oi_esfera,"Esf OI"),u("right-eye-far-cylindrical-autocomplete",n.od_cilindro,"Cil OD"),u("left-eye-far-cylindrical-autocomplete",n.oi_cilindro,"Cil OI"),u("right-eye-far-axis-autocomplete",n.od_eje,"Eje OD"),u("left-eye-far-axis-autocomplete",n.oi_eje,"Eje OI"),u("right-eye-addition-autocomplete",n.od_adicion,"Adición OD"),u("left-eye-addition-autocomplete",n.oi_adicion,"Adición OI"),u("right-eye-near-spherical-autocomplete",n.od_esfera_cerca,"Cerca Esf OD"),u("left-eye-near-spherical-autocomplete",n.oi_esfera_cerca,"Cerca Esf OI"),u("right-eye-near-cylindrical-autocomplete",n.od_cilindro_cerca,"Cerca Cil OD"),u("left-eye-near-cylindrical-autocomplete",n.oi_cilindro_cerca,"Cerca Cil OI"),u("right-eye-near-axis-autocomplete",n.od_eje_cerca,"Cerca Eje OD"),u("left-eye-near-axis-autocomplete",n.oi_eje_cerca,"Cerca Eje OI"),u("right-eye-interpupillary-distance-autocomplete",n.od_dp,"DP Lejos OD"),u("left-eye-interpupillary-distance-autocomplete",n.oi_dp,"DP Lejos OI"),u("right-eye-near-interpupillary-distance-autocomplete",n.od_dp_cerca,"DP Cerca OD"),u("left-eye-near-interpupillary-distance-autocomplete",n.oi_dp_cerca,"DP Cerca OI"),u("right-eye-pupillary-height-autocomplete",n.od_altura,"Altura OD"),u("left-eye-pupillary-height-autocomplete",n.oi_altura,"Altura OI"),0),a=!1;if(n.tipo_lente)for(var i=document.querySelectorAll('label, div[role="button"], button, span'),r=0;r<i.length;r++)if(i[r].innerText&&i[r].innerText.trim()===n.tipo_lente){i[r].click(),a=!0,p.push("Tipo: "+n.tipo_lente);break}a?setTimeout(function(){if("Monofocal"===n.tipo_lente&&n.labType)for(var e="STOCK"===n.labType?"Lentes Stock":"Lentes Laboratorio",t=document.querySelectorAll("span, label, p, div"),o=0;o<t.length;o++)if(t[o].innerText&&t[o].innerText.includes(e)){t[o].click(),p.push("Origen: "+n.labType);break}y()},800):y()}function u(e,t,o){t&&""!==t&&d.push({id:e,val:String(t),label:o})}function m(e,t){if(e){for(var o=document.querySelectorAll("label, span, p"),a=0;a<o.length;a++)if(o[a].innerText&&o[a].innerText.toLowerCase()===e.toLowerCase())return o[a].click(),void p.push(t);for(a=0;a<o.length;a++)if(o[a].innerText&&o[a].innerText.toLowerCase().includes(e.toLowerCase()))return o[a].click(),void p.push(t)}}function y(){if(d.length<=s){n.observaciones&&(e=document.getElementById("comment-textarea"))&&(c.call(e,n.observaciones),e.dispatchEvent(new Event("input",{bubbles:!0})),e.dispatchEvent(new Event("change",{bubbles:!0})),p.push("Observación")),n.armazon&&(e=document.getElementById("frame-and-model-textarea"))&&(c.call(e,n.armazon),e.dispatchEvent(new Event("input",{bubbles:!0})),e.dispatchEvent(new Event("change",{bubbles:!0})),p.push("Armazón")),n.tratamiento&&m(n.tratamiento,"Tratamiento: "+n.tratamiento),n.tipo_tenido&&m(n.tipo_tenido,"Tipo teñido: "+n.tipo_tenido),n.color_tenido&&m(n.color_tenido,"Color teñido: "+n.color_tenido),n.intensidad_tenido&&m(n.intensidad_tenido,"Intensidad: "+n.intensidad_tenido);for(var e,t=document.querySelectorAll("label, span, p"),o=0;o<t.length;o++)if(t[o].innerText&&t[o].innerText.toLowerCase().includes("calibra en óptica")){var a=t[o].closest("label")?.querySelector('input[type="checkbox"]');(a=a||t[o].parentElement?.querySelector('input[type="checkbox"]'))&&a.checked&&(a.click(),p.push("Calibrar: Laboratorio"));break}alert("✅ Campos completados ("+p.length+"): "+p.join(", ")+"\\n\\n⚠️ REVISÁ todo antes de Guardar.\\n❌ No toques Guardar si algo está mal.")}else{var i=d[s],r=document.getElementById(i.id);r?(r.focus(),r.click(),l.call(r,i.val),r.dispatchEvent(new Event("input",{bubbles:!0})),r.dispatchEvent(new Event("change",{bubbles:!0})),setTimeout(function(){var e=document.querySelector('[role="listbox"]');if(e){var t=e.querySelectorAll('[role="option"]');if(0<t.length){for(var o=!1,a=0;a<t.length;a++)if(t[a].innerText&&t[a].innerText.toLowerCase().includes(i.val.toLowerCase())){t[a].click(),o=!0;break}o||t[0].click(),p.push(i.label)}else r.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",keyCode:13,bubbles:!0})),p.push(i.label+"?")}else p.push(i.label);r.blur(),s++,setTimeout(y,300)},500)):(s++,y())}}}catch(e){alert("❌ Error: "+e.message)}})())`;

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

'use client';

export default function SmartLabBookmarkletPage() {
    // Bookmarklet code - minified version of bookmarklet-source.js
    const bookmarkletCode = `javascript:void(function(){try{var h=window.location.hash,idx=h.indexOf("ATELIER_DATA=");if(idx<0){alert("\\u274c No hay datos de Atelier en esta p\\u00e1gina.\\n\\nPrimero and\\u00e1 a Atelier \\u2192 Ventas y toc\\u00e1 \\ud83e\\uddea SmartLab en una venta.");return}var j=decodeURIComponent(h.substring(idx+13)),D=JSON.parse(j),IS=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,"value").set,TS=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,"value").set;function SV(el,v){if(!el)return;var s=el.tagName==="TEXTAREA"?TS:IS;if(s)s.call(el,v);el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}))}var done=[];var LC=false;if(D.tipo_lente){var btns=document.querySelectorAll("button");for(var b=0;b<btns.length;b++){if(btns[b].innerText&&btns[b].innerText.trim()===D.tipo_lente){btns[b].click();LC=true;done.push("Tipo: "+D.tipo_lente);break}}}function FA(){var ce=document.getElementById("optical-code-text");if(ce&&D.codigoInterno){SV(ce,D.codigoInterno);done.push("C\\u00f3digo")}var lt=D.labType||"STOCK";if(lt==="STOCK"){var ss=document.getElementById("switch-is-stock");if(ss&&!ss.checked){ss.click();done.push("Stock")}}else{var sl=document.getElementById("switch-is-laboratory");if(sl&&!sl.checked){sl.click();done.push("Laboratorio")}}var Q=[];function AQ(id,v,lb,fz){if(v&&v!=="")Q.push({id:id,val:String(v),label:lb,fuzzy:fz||null})}AQ("right-eye-far-spherical-autocomplete",D.od_esfera,"Esf OD");AQ("left-eye-far-spherical-autocomplete",D.oi_esfera,"Esf OI");AQ("right-eye-far-cylindrical-autocomplete",D.od_cilindro,"Cil OD");AQ("left-eye-far-cylindrical-autocomplete",D.oi_cilindro,"Cil OI");AQ("right-eye-far-axis-autocomplete",D.od_eje,"Eje OD");AQ("left-eye-far-axis-autocomplete",D.oi_eje,"Eje OI");AQ("right-eye-addition-autocomplete",D.od_adicion,"Add OD");AQ("left-eye-addition-autocomplete",D.oi_adicion,"Add OI");AQ("right-eye-near-spherical-autocomplete",D.od_esfera_cerca,"CeEsOD");AQ("left-eye-near-spherical-autocomplete",D.oi_esfera_cerca,"CeEsOI");AQ("right-eye-near-cylindrical-autocomplete",D.od_cilindro_cerca,"CeCiOD");AQ("left-eye-near-cylindrical-autocomplete",D.oi_cilindro_cerca,"CeCiOI");AQ("right-eye-near-axis-autocomplete",D.od_eje_cerca,"CeEjOD");AQ("left-eye-near-axis-autocomplete",D.oi_eje_cerca,"CeEjOI");AQ("right-eye-interpupillary-distance-autocomplete",D.od_dp,"DP OD");AQ("left-eye-interpupillary-distance-autocomplete",D.oi_dp,"DP OI");AQ("right-eye-near-interpupillary-distance-autocomplete",D.od_dp_cerca,"DPcOD");AQ("left-eye-near-interpupillary-distance-autocomplete",D.oi_dp_cerca,"DPcOI");AQ("right-eye-pupillary-height-autocomplete",D.od_altura,"Alt OD");AQ("left-eye-pupillary-height-autocomplete",D.oi_altura,"Alt OI");AQ("diameter-autocomplete",D.diametro,"Di\\u00e1metro");var ml=(D.material||"").toLowerCase(),tl=(D.tratamiento||"").toLowerCase(),fz=[];if(ml.indexOf("org")>-1)fz.push("org");if(ml.indexOf("poli")>-1)fz.push("poli");if(ml.indexOf("alto")>-1||ml.indexOf("1.6")>-1||ml.indexOf("1.7")>-1)fz.push("1.6");if(tl.indexOf("blue")>-1)fz.push("blue");else if(tl.indexOf("foto")>-1||tl.indexOf("transition")>-1)fz.push("foto");else if(tl.indexOf("antirreflejo")>-1||tl.indexOf("ar")>-1)fz.push("c/ar");else if(fz.length>0)fz.push("blanco");if(fz.length>0||D.material)AQ("material-autocomplete",D.material||" ","Material",fz.length>0?fz:null);var qi=0;function PN(){if(qi>=Q.length){FU();return}var it=Q[qi],el=document.getElementById(it.id);if(!el){qi++;PN();return}el.focus();el.click();SV(el,it.id==="material-autocomplete"?" ":it.val);setTimeout(function(){var lb=document.querySelector('[role="listbox"]'),pk=false;if(lb){var opts=lb.querySelectorAll('[role="option"]');if(opts.length>0){if(it.fuzzy&&it.fuzzy.length>0){for(var o=0;o<opts.length;o++){var ot=(opts[o].innerText||"").toLowerCase(),mc=0;for(var f=0;f<it.fuzzy.length;f++)if(ot.indexOf(it.fuzzy[f])>-1)mc++;if(mc===it.fuzzy.length){opts[o].click();pk=true;break}}if(!pk&&opts[0]){opts[0].click();pk=true}}else{for(var o2=0;o2<opts.length;o2++){if((opts[o2].innerText||"").toLowerCase().indexOf(it.val.toLowerCase())>-1){opts[o2].click();pk=true;break}}if(!pk&&opts[0]){opts[0].click();pk=true}}}}if(!pk)el.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",keyCode:13,bubbles:true}));el.blur();done.push(it.label);qi++;setTimeout(PN,350)},500)}function CL(tx,nm){var ls=document.querySelectorAll("label,span,p");for(var i=0;i<ls.length;i++){var lt=(ls[i].innerText||"").trim().toLowerCase();if(lt===tx.toLowerCase()){ls[i].click();done.push(nm);return}}for(var j=0;j<ls.length;j++){var lt2=(ls[j].innerText||"").trim().toLowerCase();if(lt2.indexOf(tx.toLowerCase())>-1){ls[j].click();done.push(nm);return}}}function FU(){if(D.observaciones){var oe=document.getElementById("comment-textarea");if(oe){SV(oe,D.observaciones);done.push("Obs")}}if(D.armazon){var fe=document.getElementById("frame-and-model-textarea");if(fe){SV(fe,D.armazon);done.push("Armaz\\u00f3n")}}if(D.tratamiento)CL(D.tratamiento,"Tratamiento");if(D.tipo_tenido)CL(D.tipo_tenido,"Tipo te\\u00f1ido");if(D.color_tenido)CL(D.color_tenido,"Color te\\u00f1ido");if(D.intensidad_tenido)CL(D.intensidad_tenido,"Intensidad");alert("\\u2705 Campos completados ("+done.length+"):\\n"+done.join(", ")+"\\n\\n\\u26a0\\ufe0f REVIS\\u00c1 todo antes de Guardar.")}PN()}if(LC){setTimeout(FA,1200)}else{FA()}}catch(e){alert("\\u274c Error: "+e.message)}}())`;

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

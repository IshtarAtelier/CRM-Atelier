'use client';

import { useEffect, useRef } from 'react';

export default function SmartLabBookmarkletPage() {
    const linkRef = useRef<HTMLAnchorElement>(null);

    const bookmarkletCode = `javascript:void(function(){try{var h=window.location.hash,idx=h.indexOf("ATELIER_DATA=");if(idx<0){alert("No hay datos de Atelier");return}var j=decodeURIComponent(h.substring(idx+13)),D=JSON.parse(j),IS=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,"value").set,TS=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,"value").set;function SV(el,v){if(!el)return;var s=el.tagName==="TEXTAREA"?TS:IS;if(s)s.call(el,v);el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}))}var done=[];var LC=false;if(D.tipo_lente){var btns=document.querySelectorAll("button");for(var b=0;b<btns.length;b++){if(btns[b].innerText&&btns[b].innerText.trim()===D.tipo_lente){btns[b].click();LC=true;done.push("Tipo: "+D.tipo_lente);break}}}function FA(){var ce=document.getElementById("optical-code-text");if(ce&&D.codigoInterno){SV(ce,D.codigoInterno);done.push("Codigo")}var lt=D.labType||"STOCK";if(lt==="STOCK"){var ss=document.getElementById("switch-is-stock");if(ss&&!ss.checked){ss.click();done.push("Stock")}}else{var sl=document.getElementById("switch-is-laboratory");if(sl&&!sl.checked){sl.click();done.push("Lab")}}doQ()}function doQ(){var Q=[];function AQ(id,v,lb,fz){if(v&&v!=="")Q.push({id:id,val:String(v),label:lb,fuzzy:fz||null})}AQ("right-eye-far-spherical-autocomplete",D.od_esfera,"Esf OD");AQ("left-eye-far-spherical-autocomplete",D.oi_esfera,"Esf OI");AQ("right-eye-far-cylindrical-autocomplete",D.od_cilindro,"Cil OD");AQ("left-eye-far-cylindrical-autocomplete",D.oi_cilindro,"Cil OI");AQ("right-eye-far-axis-autocomplete",D.od_eje,"Eje OD");AQ("left-eye-far-axis-autocomplete",D.oi_eje,"Eje OI");AQ("right-eye-addition-autocomplete",D.od_adicion,"Add OD");AQ("left-eye-addition-autocomplete",D.oi_adicion,"Add OI");AQ("right-eye-interpupillary-distance-autocomplete",D.od_dp,"DP OD");AQ("left-eye-interpupillary-distance-autocomplete",D.oi_dp,"DP OI");AQ("right-eye-pupillary-height-autocomplete",D.od_altura,"Alt OD");AQ("left-eye-pupillary-height-autocomplete",D.oi_altura,"Alt OI");AQ("diameter-autocomplete",D.diametro,"Diam");var ml=(D.material||"").toLowerCase(),tl=(D.tratamiento||"").toLowerCase(),fz=[];if(ml.indexOf("org")>-1)fz.push("org");if(ml.indexOf("poli")>-1)fz.push("poli");if(tl.indexOf("blue")>-1||tl.indexOf("azul")>-1)fz.push("blue");else if(tl.indexOf("foto")>-1||tl.indexOf("transition")>-1)fz.push("foto");else if(tl.indexOf("antirreflejo")>-1||tl.indexOf("ar")>-1)fz.push("c/ar");else if(fz.length>0)fz.push("blanco");if(fz.length>0||D.material)AQ("material-autocomplete",D.material||" ","Material",fz.length>0?fz:null);var qi=0;function PN(){if(qi>=Q.length){FU();return}var it=Q[qi],el=document.getElementById(it.id);if(!el){qi++;PN();return}el.focus();el.click();SV(el,it.id==="material-autocomplete"?" ":it.val);setTimeout(function(){var lb=document.querySelector('[role="listbox"]'),pk=false;if(lb){var opts=lb.querySelectorAll('[role="option"]');if(opts.length>0){if(it.fuzzy&&it.fuzzy.length>0){for(var o=0;o<opts.length;o++){var ot=(opts[o].innerText||"").toLowerCase(),mc=0;for(var f=0;f<it.fuzzy.length;f++)if(ot.indexOf(it.fuzzy[f])>-1)mc++;if(mc===it.fuzzy.length){opts[o].click();pk=true;break}}if(!pk&&opts[0]){opts[0].click();pk=true}}else{for(var o2=0;o2<opts.length;o2++){if((opts[o2].innerText||"").toLowerCase().indexOf(it.val.toLowerCase())>-1){opts[o2].click();pk=true;break}}if(!pk&&opts[0]){opts[0].click();pk=true}}}}if(!pk)el.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",keyCode:13,bubbles:true}));el.blur();done.push(it.label);qi++;setTimeout(PN,350)},500)}PN()}function CL(tx,nm){var ls=document.querySelectorAll("label,span,p,div");for(var i=0;i<ls.length;i++){if((ls[i].innerText||"").trim()===tx){ls[i].click();done.push(nm);return}}for(var j=0;j<ls.length;j++){if((ls[j].innerText||"").trim().toLowerCase().indexOf(tx.toLowerCase())>-1){ls[j].click();done.push(nm);return}}}function FU(){if(D.observaciones){var oe=document.getElementById("comment-textarea");if(oe){SV(oe,D.observaciones);done.push("Obs")}}if(D.armazon){var fe=document.getElementById("frame-and-model-textarea");if(fe){SV(fe,D.armazon);done.push("Armazon")}}if(D.tipo_armazon)CL(D.tipo_armazon,"TipoArm");if(D.tipo_tenido)CL(D.tipo_tenido,"TipoTen");if(D.color_tenido)CL(D.color_tenido,"ColorTen");if(D.intensidad_tenido)CL(D.intensidad_tenido,"Intensidad");alert("Campos completados ("+done.length+"): "+done.join(", ")+"\\n\\nRevisa todo antes de Guardar.")}if(LC){setTimeout(FA,1200)}else{FA()}}catch(e){alert("Error: "+e.message)}}())`;

    useEffect(() => {
        if (linkRef.current) {
            linkRef.current.setAttribute('href', bookmarkletCode);
        }
    }, [bookmarkletCode]);

    return (
        <main className="p-4 lg:p-8 max-w-3xl mx-auto">
            <div className="bg-white dark:bg-stone-800 rounded-3xl p-8 border-2 border-stone-200 dark:border-stone-700 shadow-xl">
                <h1 className="text-3xl font-black text-stone-800 dark:text-white mb-4">
                    🤖 Robot SmartLab v4
                </h1>
                <p className="text-stone-600 dark:text-stone-400 mb-8">
                    Arrastrá el botón naranja hacia tu barra de favoritos de Chrome.<br/>
                    Si ya tenés uno viejo, borralo primero (click derecho → Eliminar).
                </p>
                <div className="p-8 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-2xl border-2 border-dashed border-amber-300 dark:border-amber-700 text-center">
                    <a
                        ref={linkRef}
                        href="#"
                        onClick={(e) => e.preventDefault()}
                        className="inline-block px-10 py-5 bg-gradient-to-r from-amber-400 to-orange-400 text-amber-950 rounded-2xl text-lg font-black shadow-xl shadow-amber-400/30 hover:scale-105 transition-all cursor-grab active:cursor-grabbing select-none"
                    >
                        🤖 Atelier → SmartLab v4
                    </a>
                    <p className="text-sm text-amber-700 dark:text-amber-400 mt-4 font-bold">
                        ⬆️ Arrastrá este botón naranja a tu barra de favoritos
                    </p>
                </div>
            </div>
        </main>
    );
}

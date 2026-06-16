javascript:void((function(){
    try {
        var h = window.location.hash;
        var idx = h.indexOf('ATELIER_DATA=');
        if(idx < 0) {
            alert('❌ No hay datos de Atelier en esta página.\n\nPrimero andá a Atelier → Ventas y tocá 🧪 SmartLab en una venta.');
            return;
        }
        var raw = decodeURIComponent(h.substring(idx+13));
        var d = JSON.parse(raw);
        var ns = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
        var ts = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;
        var filled = [];
        var queue = [];
        
        function add(id, val, label) {
            if(val && val !== '') queue.push({id: id, val: String(val), label: label});
        }
        
        add('client-autocomplete', d.paciente_nombre + ' ' + d.paciente_apellido, 'Paciente');
        add('optical-code-text', d.codigoInterno, 'Código interno');
        add('material-autocomplete', d.material, 'Material');
        add('color-autocomplete', d.color, 'Color');
        add('diameter-autocomplete', d.diametro, 'Diámetro');
        add('refractive-index-autocomplete', d.indice, 'Índice');
        add('right-eye-far-spherical-autocomplete', d.od_esfera, 'Esf OD');
        add('left-eye-far-spherical-autocomplete', d.oi_esfera, 'Esf OI');
        add('right-eye-far-cylindrical-autocomplete', d.od_cilindro, 'Cil OD');
        add('left-eye-far-cylindrical-autocomplete', d.oi_cilindro, 'Cil OI');
        add('right-eye-far-axis-autocomplete', d.od_eje, 'Eje OD');
        add('left-eye-far-axis-autocomplete', d.oi_eje, 'Eje OI');
        add('right-eye-addition-autocomplete', d.od_adicion, 'Adición OD');
        add('left-eye-addition-autocomplete', d.oi_adicion, 'Adición OI');
        add('right-eye-near-spherical-autocomplete', d.od_esfera_cerca, 'Cerca Esf OD');
        add('left-eye-near-spherical-autocomplete', d.oi_esfera_cerca, 'Cerca Esf OI');
        add('right-eye-near-cylindrical-autocomplete', d.od_cilindro_cerca, 'Cerca Cil OD');
        add('left-eye-near-cylindrical-autocomplete', d.oi_cilindro_cerca, 'Cerca Cil OI');
        add('right-eye-near-axis-autocomplete', d.od_eje_cerca, 'Cerca Eje OD');
        add('left-eye-near-axis-autocomplete', d.oi_eje_cerca, 'Cerca Eje OI');
        add('right-eye-interpupillary-distance-autocomplete', d.od_dp, 'DP Lejos OD');
        add('left-eye-interpupillary-distance-autocomplete', d.oi_dp, 'DP Lejos OI');
        add('right-eye-near-interpupillary-distance-autocomplete', d.od_dp_cerca, 'DP Cerca OD');
        add('left-eye-near-interpupillary-distance-autocomplete', d.oi_dp_cerca, 'DP Cerca OI');
        add('right-eye-pupillary-height-autocomplete', d.od_altura, 'Altura OD');
        add('left-eye-pupillary-height-autocomplete', d.oi_altura, 'Altura OI');
        
        var i = 0;
        
        function clickLabel(textToFind, successMsg) {
            if(!textToFind) return;
            var lbls = document.querySelectorAll('label, span, p');
            for(var k=0; k<lbls.length; k++){
                if(lbls[k].innerText && lbls[k].innerText.toLowerCase() === textToFind.toLowerCase()){
                    lbls[k].click();
                    filled.push(successMsg);
                    return;
                }
            }
            // fallback to includes
            for(var k=0; k<lbls.length; k++){
                if(lbls[k].innerText && lbls[k].innerText.toLowerCase().includes(textToFind.toLowerCase())){
                    lbls[k].click();
                    filled.push(successMsg);
                    return;
                }
            }
        }

        function finish() {
            if(d.observaciones){
                var el = document.getElementById('comment-textarea');
                if(el){
                    ts.call(el, d.observaciones);
                    el.dispatchEvent(new Event('input', {bubbles: true}));
                    el.dispatchEvent(new Event('change', {bubbles: true}));
                    filled.push('Observación');
                }
            }
            if(d.armazon){
                var el2 = document.getElementById('frame-and-model-textarea');
                if(el2){
                    ts.call(el2, d.armazon);
                    el2.dispatchEvent(new Event('input', {bubbles: true}));
                    el2.dispatchEvent(new Event('change', {bubbles: true}));
                    filled.push('Armazón');
                }
            }
            
            if(d.tratamiento) {
                clickLabel(d.tratamiento, 'Tratamiento: ' + d.tratamiento);
            }
            if(d.tipo_tenido) {
                clickLabel(d.tipo_tenido, 'Tipo teñido: ' + d.tipo_tenido);
            }
            if(d.color_tenido) {
                clickLabel(d.color_tenido, 'Color teñido: ' + d.color_tenido);
            }
            if(d.intensidad_tenido) {
                clickLabel(d.intensidad_tenido, 'Intensidad: ' + d.intensidad_tenido);
            }

            // Uncheck calibra en óptica
            var chkLbls = document.querySelectorAll('label, span, p');
            for(var k=0; k<chkLbls.length; k++){
                if(chkLbls[k].innerText && chkLbls[k].innerText.toLowerCase().includes('calibra en óptica')){
                    var chk = chkLbls[k].closest('label')?.querySelector('input[type="checkbox"]');
                    if(!chk) chk = chkLbls[k].parentElement?.querySelector('input[type="checkbox"]');
                    if(chk && chk.checked) {
                        chk.click();
                        filled.push('Calibrar: Laboratorio');
                    }
                    break;
                }
            }
            
            alert('✅ Campos completados ('+filled.length+'): '+filled.join(', ')+'\n\n⚠️ REVISÁ todo antes de Guardar.\n❌ No toques Guardar si algo está mal.');
        }

        function next() {
            if(i >= queue.length){
                finish();
                return;
            }
            var f = queue[i];
            var el = document.getElementById(f.id);
            if(!el){
                i++;
                next();
                return;
            }
            el.focus();
            el.click();
            ns.call(el, f.val);
            el.dispatchEvent(new Event('input', {bubbles: true}));
            el.dispatchEvent(new Event('change', {bubbles: true}));
            setTimeout(function(){
                var listbox = document.querySelector('[role="listbox"]');
                if(listbox){
                    var opts = listbox.querySelectorAll('[role="option"]');
                    if(opts.length > 0){
                        // Try to find exact match
                        var found = false;
                        for(var o=0; o<opts.length; o++){
                            if(opts[o].innerText && opts[o].innerText.toLowerCase().includes(f.val.toLowerCase())){
                                opts[o].click();
                                found = true;
                                break;
                            }
                        }
                        if(!found) opts[0].click();
                        filled.push(f.label);
                    } else {
                        el.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', keyCode: 13, bubbles: true}));
                        filled.push(f.label+'?');
                    }
                } else {
                    filled.push(f.label);
                }
                el.blur();
                i++;
                setTimeout(next, 300);
            }, 500);
        }
        
        var clickedType = false;
        if(d.tipo_lente){
            var btns = document.querySelectorAll('label, div[role="button"], button, span');
            for(var j=0; j<btns.length; j++){
                if(btns[j].innerText && btns[j].innerText.trim() === d.tipo_lente){
                    btns[j].click();
                    clickedType = true;
                    filled.push('Tipo: '+d.tipo_lente);
                    break;
                }
            }
        }
        
        if(clickedType){
            setTimeout(function(){
                if(d.tipo_lente === 'Monofocal' && d.labType){
                    var targetText = d.labType === 'STOCK' ? 'Lentes Stock' : 'Lentes Laboratorio';
                    var lbls = document.querySelectorAll('span, label, p, div');
                    for(var k=0; k<lbls.length; k++){
                        if(lbls[k].innerText && lbls[k].innerText.includes(targetText)){
                            lbls[k].click();
                            filled.push('Origen: '+d.labType);
                            break;
                        }
                    }
                }
                next();
            }, 800);
        } else {
            next();
        }
    } catch(e) {
        alert('❌ Error: '+e.message);
    }
})());

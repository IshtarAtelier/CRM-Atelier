// Bookmarklet source code - readable version
// This will be minified and injected into the bookmarklet page
(function() {
  try {
    // Step 1: Read data from URL hash
    var hash = window.location.hash;
    var idx = hash.indexOf('ATELIER_DATA=');
    if (idx < 0) {
      alert('❌ No hay datos de Atelier en esta página.\n\nPrimero andá a Atelier → Ventas y tocá 🧪 SmartLab en una venta.');
      return;
    }

    var jsonStr = decodeURIComponent(hash.substring(idx + 13));
    var data = JSON.parse(jsonStr);

    // Utility: set value on a React-controlled input
    var inputSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    var textareaSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;

    function setValue(el, val) {
      if (!el) return false;
      var setter = el.tagName === 'TEXTAREA' ? textareaSetter : inputSetter;
      if (setter) setter.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    var completed = [];

    // Step 2: Click the lens type button (Monofocal, Multifocal, etc.)
    var lensTypeClicked = false;
    if (data.tipo_lente) {
      var allButtons = document.querySelectorAll('button');
      for (var b = 0; b < allButtons.length; b++) {
        var btnText = allButtons[b].innerText ? allButtons[b].innerText.trim() : '';
        if (btnText === data.tipo_lente) {
          allButtons[b].click();
          lensTypeClicked = true;
          completed.push('Tipo lente: ' + data.tipo_lente);
          break;
        }
      }
    }

    // Step 3: Fill fields after a delay (to let SmartLab render after lens type click)
    function fillAllFields() {
      // 3a: Código interno (plain text input)
      var codigoEl = document.getElementById('optical-code-text');
      if (codigoEl && data.codigoInterno) {
        setValue(codigoEl, data.codigoInterno);
        completed.push('Código interno');
      }

      // 3b: Stock vs Laboratorio toggle
      var labType = data.labType || 'STOCK';
      if (labType === 'STOCK') {
        var stockSwitch = document.getElementById('switch-is-stock');
        if (stockSwitch && !stockSwitch.checked) {
          stockSwitch.click();
          completed.push('Lentes Stock');
        }
      } else {
        var labSwitch = document.getElementById('switch-is-laboratory');
        if (labSwitch && !labSwitch.checked) {
          labSwitch.click();
          completed.push('Lentes Laboratorio');
        }
      }

      // 3c: Build the queue of autocomplete fields to fill one by one
      var queue = [];

      function addToQueue(elementId, value, label, fuzzyTerms) {
        if (value && value !== '') {
          queue.push({ id: elementId, val: String(value), label: label, fuzzy: fuzzyTerms || null });
        }
      }

      // Prescription fields
      addToQueue('right-eye-far-spherical-autocomplete', data.od_esfera, 'Esf OD');
      addToQueue('left-eye-far-spherical-autocomplete', data.oi_esfera, 'Esf OI');
      addToQueue('right-eye-far-cylindrical-autocomplete', data.od_cilindro, 'Cil OD');
      addToQueue('left-eye-far-cylindrical-autocomplete', data.oi_cilindro, 'Cil OI');
      addToQueue('right-eye-far-axis-autocomplete', data.od_eje, 'Eje OD');
      addToQueue('left-eye-far-axis-autocomplete', data.oi_eje, 'Eje OI');
      addToQueue('right-eye-addition-autocomplete', data.od_adicion, 'Add OD');
      addToQueue('left-eye-addition-autocomplete', data.oi_adicion, 'Add OI');

      // Near vision (if present)
      addToQueue('right-eye-near-spherical-autocomplete', data.od_esfera_cerca, 'Cerca Esf OD');
      addToQueue('left-eye-near-spherical-autocomplete', data.oi_esfera_cerca, 'Cerca Esf OI');
      addToQueue('right-eye-near-cylindrical-autocomplete', data.od_cilindro_cerca, 'Cerca Cil OD');
      addToQueue('left-eye-near-cylindrical-autocomplete', data.oi_cilindro_cerca, 'Cerca Cil OI');
      addToQueue('right-eye-near-axis-autocomplete', data.od_eje_cerca, 'Cerca Eje OD');
      addToQueue('left-eye-near-axis-autocomplete', data.oi_eje_cerca, 'Cerca Eje OI');

      // Interpupillary distances
      addToQueue('right-eye-interpupillary-distance-autocomplete', data.od_dp, 'DP OD');
      addToQueue('left-eye-interpupillary-distance-autocomplete', data.oi_dp, 'DP OI');
      addToQueue('right-eye-near-interpupillary-distance-autocomplete', data.od_dp_cerca, 'DP Cerca OD');
      addToQueue('left-eye-near-interpupillary-distance-autocomplete', data.oi_dp_cerca, 'DP Cerca OI');

      // Heights
      addToQueue('right-eye-pupillary-height-autocomplete', data.od_altura, 'Altura OD');
      addToQueue('left-eye-pupillary-height-autocomplete', data.oi_altura, 'Altura OI');

      // Diameter
      addToQueue('diameter-autocomplete', data.diametro, 'Diámetro');

      // Material - with fuzzy matching
      var matLower = (data.material || '').toLowerCase();
      var treatLower = (data.tratamiento || '').toLowerCase();
      var fuzzyTerms = [];
      if (matLower.indexOf('org') > -1) fuzzyTerms.push('org');
      if (matLower.indexOf('poli') > -1) fuzzyTerms.push('poli');
      if (matLower.indexOf('alto') > -1 || matLower.indexOf('1.6') > -1 || matLower.indexOf('1.7') > -1) fuzzyTerms.push('1.6');
      // Add treatment info to material fuzzy search
      if (treatLower.indexOf('blue') > -1) fuzzyTerms.push('blue');
      else if (treatLower.indexOf('foto') > -1 || treatLower.indexOf('transition') > -1) fuzzyTerms.push('foto');
      else if (treatLower.indexOf('antirreflejo') > -1 || treatLower.indexOf('ar') > -1) fuzzyTerms.push('c/ar');
      else if (fuzzyTerms.length > 0) fuzzyTerms.push('blanco');

      if (fuzzyTerms.length > 0 || data.material) {
        addToQueue('material-autocomplete', data.material || ' ', 'Material', fuzzyTerms.length > 0 ? fuzzyTerms : null);
      }

      // Process queue one item at a time
      var queueIdx = 0;

      function processNext() {
        if (queueIdx >= queue.length) {
          finishUp();
          return;
        }

        var item = queue[queueIdx];
        var el = document.getElementById(item.id);

        if (!el) {
          // Skip this field
          queueIdx++;
          processNext();
          return;
        }

        el.focus();
        el.click();

        // For material, type a space to open the dropdown; for others, type the value
        var typeVal = (item.id === 'material-autocomplete') ? ' ' : item.val;
        setValue(el, typeVal);

        setTimeout(function() {
          var listbox = document.querySelector('[role="listbox"]');
          var picked = false;

          if (listbox) {
            var options = listbox.querySelectorAll('[role="option"]');
            if (options.length > 0) {
              if (item.fuzzy && item.fuzzy.length > 0) {
                // Fuzzy matching for material
                for (var o = 0; o < options.length; o++) {
                  var optText = (options[o].innerText || '').toLowerCase();
                  var matchCount = 0;
                  for (var f = 0; f < item.fuzzy.length; f++) {
                    if (optText.indexOf(item.fuzzy[f]) > -1) matchCount++;
                  }
                  if (matchCount === item.fuzzy.length) {
                    options[o].click();
                    picked = true;
                    break;
                  }
                }
                // Fallback: pick first option
                if (!picked && options[0]) {
                  options[0].click();
                  picked = true;
                }
              } else {
                // Exact value matching
                for (var o2 = 0; o2 < options.length; o2++) {
                  var optText2 = (options[o2].innerText || '').toLowerCase();
                  if (optText2.indexOf(item.val.toLowerCase()) > -1) {
                    options[o2].click();
                    picked = true;
                    break;
                  }
                }
                // Fallback: pick first option
                if (!picked && options[0]) {
                  options[0].click();
                  picked = true;
                }
              }
            }
          }

          if (!picked) {
            el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
          }

          el.blur();
          completed.push(item.label);
          queueIdx++;
          setTimeout(processNext, 350);
        }, 500);
      }

      function finishUp() {
        // Observaciones
        if (data.observaciones) {
          var obsEl = document.getElementById('comment-textarea');
          if (obsEl) {
            setValue(obsEl, data.observaciones);
            completed.push('Observación');
          }
        }

        // Armazón
        if (data.armazon) {
          var frameEl = document.getElementById('frame-and-model-textarea');
          if (frameEl) {
            setValue(frameEl, data.armazon);
            completed.push('Armazón');
          }
        }

        // Tratamiento (click on radio/label)
        if (data.tratamiento) {
          var labels = document.querySelectorAll('label, span');
          for (var lbl = 0; lbl < labels.length; lbl++) {
            var lt = (labels[lbl].innerText || '').toLowerCase();
            if (lt === data.tratamiento.toLowerCase() || lt.indexOf(data.tratamiento.toLowerCase()) > -1) {
              labels[lbl].click();
              completed.push('Tratamiento');
              break;
            }
          }
        }

        // Teñido
        if (data.tipo_tenido) {
          clickLabel(data.tipo_tenido, 'Tipo teñido');
        }
        if (data.color_tenido) {
          clickLabel(data.color_tenido, 'Color teñido');
        }
        if (data.intensidad_tenido) {
          clickLabel(data.intensidad_tenido, 'Intensidad teñido');
        }

        // Desactivar "Calibra en óptica" si está marcado
        var allLabels = document.querySelectorAll('label, span, p');
        for (var cl = 0; cl < allLabels.length; cl++) {
          if (allLabels[cl].innerText && allLabels[cl].innerText.toLowerCase().indexOf('calibra en óptica') > -1) {
            var checkbox = allLabels[cl].closest('label');
            if (checkbox) {
              var cb = checkbox.querySelector('input[type="checkbox"]');
              if (cb && cb.checked) {
                cb.click();
                completed.push('Calibrar: Lab');
              }
            }
            break;
          }
        }

        alert('✅ Campos completados (' + completed.length + '):\n' + completed.join(', ') + '\n\n⚠️ REVISÁ todo antes de Guardar.\n❌ No toques Guardar si algo está mal.');
      }

      function clickLabel(text, logName) {
        var labels = document.querySelectorAll('label, span, p');
        for (var i = 0; i < labels.length; i++) {
          var lt = (labels[i].innerText || '').trim().toLowerCase();
          if (lt === text.toLowerCase()) {
            labels[i].click();
            completed.push(logName);
            return;
          }
        }
        // Partial match
        for (var j = 0; j < labels.length; j++) {
          var lt2 = (labels[j].innerText || '').trim().toLowerCase();
          if (lt2.indexOf(text.toLowerCase()) > -1) {
            labels[j].click();
            completed.push(logName);
            return;
          }
        }
      }

      // Start processing the queue
      processNext();
    }

    // Wait for lens type click to render new fields, then fill
    if (lensTypeClicked) {
      setTimeout(fillAllFields, 1200);
    } else {
      fillAllFields();
    }

  } catch (err) {
    alert('❌ Error del robot: ' + err.message);
  }
})();

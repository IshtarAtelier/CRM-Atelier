/**
 * Los modelos fotografiados por Agostina (sesión Gutiérrez, sep 2026) con las
 * fotos de cada uno. ÚNICA lista: la leen generar-stories-agostina.mjs (stories
 * 9:16) y generar-feed-modelos.mjs (carruseles 4:5 del feed). Dar de alta o
 * baja un modelo es tocar esta lista y volver a correr los dos generadores.
 *
 * Catálogo: [id, nombre, color, familia, fotos, ajustes?]. El id es el slug de
 * la pieza (`story-agos-<id>`) y de la ficha de la tienda; nombre y color son lo
 * que se escribe en la placa; familia decide la leyenda y la secuencia. Las
 * fotos van por el NÚMERO con que empiezan en la carpeta de la sesión, en el
 * orden de la secuencia (receta/sol: frente, perfil, anteojo en manos; clip-on:
 * sin clip, frente con clip, perfil, anteojo en manos).
 *
 * `foco` (0-1) corre el recorte horizontal de la foto en manos; `aire` abre el
 * perfil hacia arriba; `brillo` levanta una foto oscura.
 */
export const RECETA = 'receta', SOL = 'sol', CLIP = 'clip';
export const MODELOS = [
    // ── Receta: frente, perfil, anteojo en manos ──────────────────────────
    // Solo el frente: la 005 es un perfil puro, a 90°, y Ishtar lo sacó
    // ("el Atenea que está muy de lateral, sacalo", 16/10/2026).
    ['atenea-c3', 'Atenea', 'C3', RECETA, ['003']],
    ['victoria-c5', 'Victoria', 'C5', RECETA, ['017', '018', '530']],
    ['dionisio-c2', 'Dionisio', 'C2', RECETA, ['020', '021', '522']],
    ['frida-c5', 'Frida', 'C5', RECETA, ['024', '025', '524']],
    ['polaris-c7', 'Polaris', 'C7', RECETA, ['027', '028', '532']],
    ['gala-c7', 'Gala', 'C7', RECETA, ['036', '037']],
    ['gala-c1', 'Gala', 'C1', RECETA, ['45', '46']],
    ['pegaso-c2', 'Pegaso', 'C2', RECETA, ['049', '050']],
    ['polaris-c2', 'Polaris', 'C2', RECETA, ['053', '054']],
    ['helena-c4', 'Helena', 'C4', RECETA, ['057', '058']],
    ['frida-c1', 'Frida', 'C1', RECETA, ['061', '062']],
    ['frida-c3', 'Frida', 'C3', RECETA, ['073', '074', '075']],
    ['victoria-c1', 'Victoria', 'C1', RECETA, ['079', '080', '081']],
    ['polaris-c6', 'Polaris', 'C6', RECETA, ['084', '085', '086']],
    ['victoria-c6', 'Victoria', 'C6', RECETA, ['094', '095', '096']],
    ['roma', 'Roma', '', RECETA, ['100', '101', '102']],
    ['hera', 'Hera', '', RECETA, ['110', '111', '112']],
    ['onix-negro', 'Onix', 'Negro', RECETA, ['115', '116', '117']],
    ['frida-c2', 'Frida', 'C2', RECETA, ['120', '121', '122']],
    ['andromeda-c6', 'Andrómeda', 'C6', RECETA, ['125', '126', '127']],
    ['olimpia', 'Olimpia', '', RECETA, ['130', '131', '132']],
    ['andromeda-c3', 'Andrómeda', 'C3', RECETA, ['135', '136', '137']],
    ['gala-c8', 'Gala', 'C8', RECETA, ['140', '141', '142']],
    ['helena-c3', 'Helena', 'C3', RECETA, ['145', '146', '147']],
    ['victoria-c7', 'Victoria', 'C7', RECETA, ['150', '151', '152']],
    ['helena-c5', 'Helena', 'C5', RECETA, ['155', '156', '157']],
    // Solo el frente: en la 161 (perfil) tiene los ojos cerrados y esa foto
    // "no puede seguir circulando" (Ishtar, 16/10/2026). Un modelo con UNA
    // foto sale en stories y en los carruseles de selección, no en el feed diario.
    ['andromeda-c7', 'Andrómeda', 'C7', RECETA, ['160']],
    ['gala-c2', 'Gala', 'C2', RECETA, ['165', '166', '167']],
    ['gala-c3', 'Gala', 'C3', RECETA, ['170', '171', '172']],
    ['helena-c2', 'Helena', 'C2', RECETA, ['175', '176', '177']],
    ['andromeda-c4', 'Andrómeda', 'C4', RECETA, ['180', '181', '182']],
    ['altair-c1', 'Altair', 'C1', RECETA, ['185', '186', '187']],
    ['minerva-c2', 'Minerva', 'C2', RECETA, ['195', '196', '197']],
    ['aquiles-c4', 'Aquiles', 'C4', RECETA, ['200', '201', '202']],
    ['pandora-c5', 'Pandora', 'C5', RECETA, ['205', '206', '207']],
    ['ariadne-c2', 'Ariadne', 'C2', RECETA, ['210', '211', '212']],
    ['hermes-c4', 'Hermes', 'C4', RECETA, ['215', '216', '217']],
    ['ariadne-c1', 'Ariadne', 'C1', RECETA, ['220', '221', '222']],
    ['teseo-c1', 'Teseo', 'C1', RECETA, ['225', '226', '227']],
    ['diana-c2', 'Diana', 'C2', RECETA, ['230', '231', '232']],
    ['aquiles-c1', 'Aquiles', 'C1', RECETA, ['235', '236', '237']],
    ['venus-c1', 'Venus', 'C1', RECETA, ['240', '241', '242']],
    ['hermes-c3', 'Hermes', 'C3', RECETA, ['245', '246', '247']],
    ['poseidon-c3', 'Poseidon', 'C3', RECETA, ['250', '251', '252']],
    ['teseo-c4', 'Teseo', 'C4', RECETA, ['255', '256', '257']],
    ['orfeo-c4', 'Orfeo', 'C4', RECETA, ['260', '261', '262']],
    ['cronos-c1', 'Cronos', 'C1', RECETA, ['271', '272', '273']],
    ['cronos-c3', 'Cronos', 'C3', RECETA, ['276', '277', '278']],
    ['orfeo-c1', 'Orfeo', 'C1', RECETA, ['281', '282', '283']],
    ['orfeo-c3', 'Orfeo', 'C3', RECETA, ['286', '287', '288']],
    // ['hermes-c1', 'Hermes', 'C1', RECETA, ['291', '292', '293']],  // FUERA (Ishtar, 20/10/2026): en la 291 tiene los ojos cerrados y el video no da calidad. Volver cuando haya foto nueva.
    ['poseidon-c2', 'Poseidon', 'C2', RECETA, ['296', '297', '298']],
    ['pandora-c3', 'Pandora', 'C3', RECETA, ['306', '307', '308']],
    ['hermes-c2', 'Hermes', 'C2', RECETA, ['311', '312', '313']],
    ['orfeo-c2', 'Orfeo', 'C2', RECETA, ['316', '317', '318']],
    ['diana-c4', 'Diana', 'C4', RECETA, ['321', '322', '323']],
    ['diana-c3', 'Diana', 'C3', RECETA, ['331', '332', '333']],
    ['venus-c2', 'Venus', 'C2', RECETA, ['336', '337', '338']],
    ['hestia-c1', 'Hestia', 'C1', RECETA, ['341', '342', '343']],
    ['hestia-c2', 'Hestia', 'C2', RECETA, ['346', '347', '348']],
    ['selene-c4', 'Selene', 'C4', RECETA, ['366', '367', '368']],
    ['selene-c5', 'Selene', 'C5', RECETA, ['371', '372', '373']],
    ['rigel-c3', 'Rigel', 'C3', RECETA, ['381', '382', '383']],
    ['rigel-c1', 'Rigel', 'C1', RECETA, ['386', '387', '388']],
    ['orion-c1', 'Orión', 'C1', RECETA, ['396', '397', '398']],
    ['electra-c5', 'Electra', 'C5', RECETA, ['410', '411', '412']],
    ['electra-c4', 'Electra', 'C4', RECETA, ['415', '416', '417']],
    ['minerva-c3', 'Minerva', 'C3', RECETA, ['420', '421', '422']],
    // ── Clip-on: sin clip, frente con clip, perfil, anteojo en manos ──────
    ['venice', 'Venice', '', CLIP, ['425', '428', '429', '430'], { foco: 0.60, ratio: 4 / 5 }],
    ['torino-c4', 'Torino', 'C4', CLIP, ['433', '438', '439', '441'], { foco: 0.45, ratio: 3 / 4 }],
    ['torino-c3', 'Torino', 'C3', CLIP, ['444', '448', '449', '450']],
    ['palermo-c3', 'Palermo', 'C3', CLIP, ['453', '457', '458', '459']],
    ['verona-c1', 'Verona', 'C1', CLIP, ['462', '464', '465', '468']],
    ['capri-c5', 'Capri', 'C5', CLIP, ['471', '475', '476', '477'], { foco: 0.45 }],
    ['monaco-c2', 'Monaco', 'C2', CLIP, ['480', '484', '485', '486'], { ratio: 0.9 }],
    ['riviera-c1', 'Riviera', 'C1', CLIP, ['489', '493', '494', '495'], { foco: 0.56, ratio: 0.9 }],
    ['milano-c1', 'Milano', 'C1', CLIP, ['498', '499'], { brillo: 0.86 }],   // no tiene foto con clip ni en manos
    ['florence-c2', 'Florence', 'C2', CLIP, ['502', '512', '513', '515'], { ratio: 0.9 }],
    // ── Sol: frente, perfil, anteojo en manos ─────────────────────────────
    ['antares-c1', 'Antares', 'C1', SOL, ['535', '536', '537']],
    ['sirio-c1', 'Sirio', 'C1', SOL, ['540', '541', '542']],
    ['sirio-c2', 'Sirio', 'C2', SOL, ['545', '546', '547']],
    ['deneb-c2', 'Deneb', 'C2', SOL, ['550', '551', '552']],
    ['vega-c2', 'Vega', 'C2', SOL, ['555', '556', '557']],
    ['adhara-c4', 'Adhara', 'C4', SOL, ['560', '561', '562'], { foco: 0.49, aire: 0.11 }],
    ['deneb-c1', 'Deneb', 'C1', SOL, ['565', '566', '567']],
    ['vega-c1', 'Vega', 'C1', SOL, ['570', '571', '572']],
    ['mizar-c2', 'Mizar', 'C2', SOL, ['575', '576', '577']],
    ['fenix-c1', 'Fénix', 'C1', SOL, ['580', '581', '582']],
    ['canopo-c2', 'Cánopo', 'C2', SOL, ['585', '586', '587'], { aire: 0.11 }],
    ['nashira-c3', 'Nashira', 'C3', SOL, ['590', '591', '592'], { foco: 0.49, aire: 0.11 }],
];

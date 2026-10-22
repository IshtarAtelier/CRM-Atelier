/**
 * Los modelos fotografiados por Massaru (sesión del 6/10/2026) con las fotos de
 * cada uno. ÚNICA lista: la leen generar-stories-massaru.mjs (stories 9:16) y
 * generar-feed-modelos.mjs (carruseles 4:5 del feed).
 *
 * [id, nombre, color, familia, fotos]: el id es el slug de la pieza
 * (`story-massaru-<id>`) y de la ficha de la tienda; las fotos son el número de
 * la foto original (frente, perfil), el mismo que usa
 * scripts/maintenance/fotos-sesion/massaru/usables.json.
 */
export const RECETA = 'receta', SOL = 'sol';
export const MODELOS = [
    // ── Sol: frente, perfil ─────────────────────────────────────────────
    ['zeus-c33-p01', 'Zeus', 'C33-P01', SOL, [6, 10]],
    ['zeus-c33-p86', 'Zeus', 'C33-P86', SOL, [12, 13]],
    ['zeus-c33-p18-2', 'Zeus', 'C33-P18-2', SOL, [15, 16]],
    ['zeus-c33-p18-1', 'Zeus', 'C33-P18-1', SOL, [18, 19]],
    ['kalishta', 'Kalishta', '', SOL, [21, 23]],
    ['odiseo', 'Odiseo', '', SOL, [25, 26]],
    ['eva-c3', 'Eva', 'C3', SOL, [31, 32]],
    ['pluton-c7', 'Plutón', 'C7', SOL, [34, 35]],
    ['vega-c2', 'Vega', 'C2', SOL, [37, 38]],
    ['eva-c2', 'Eva', 'C2', SOL, [40, 41]],
    ['fenix-c2', 'Fénix', 'C2', SOL, [43, 44]],
    ['vega-c1', 'Vega', 'C1', SOL, [46, 47]],
    ['olimpo-sepia', 'Olimpo', 'Sepia', SOL, [49, 50]],
    ['olimpo-pink', 'Olimpo', 'Pink', SOL, [52, 53]],
    ['olimpo-blue', 'Olimpo', 'Blue', SOL, [55]],
    ['olimpo-grey', 'Olimpo', 'Grey', SOL, [57, 58]],
    ['edipo', 'Edipo', '', SOL, [60, 61]],
    ['persefone', 'Perséfone', '', SOL, [66, 67]],
    ['olimpo-black', 'Olimpo', 'Black', SOL, [69, 71]],
    ['demeter', 'Deméter', '', SOL, [72, 73]],
    ['pluton-c4', 'Plutón', 'C4', SOL, [78, 79]],
    ['triton-c3', 'Tritón', 'C3', SOL, [83, 84]],
    ['triton-c5', 'Tritón', 'C5', SOL, [86, 87]],
    ['sol', 'Sol', '', SOL, [89, 90]],
    ['calisto-c5', 'Calisto', 'C5', SOL, [92, 93]],
    ['perseo-c4', 'Perseo', 'C4', SOL, [96, 97]],
    ['perseo-c5', 'Perseo', 'C5', SOL, [99, 100]],
    ['calisto-c4', 'Calisto', 'C4', SOL, [102, 103]],
    ['urano', 'Urano', '', SOL, [108, 109]],
    ['meteoro-c4', 'Meteoro', 'C4', SOL, [111, 121]],
    ['meteoro-c275', 'Meteoro', 'C275', SOL, [114, 115]],
    ['meteoro-c26', 'Meteoro', 'C26', SOL, [117, 118]],
    // ── Receta: frente, perfil ──────────────────────────────────────────
    ['orfeo-c1', 'Orfeo', 'C1', RECETA, [123, 124]],
    ['poseidon-c6', 'Poseidon', 'C6', RECETA, [126, 127]],
    ['poseidon-c2', 'Poseidon', 'C2', RECETA, [129, 130]],
    ['poseidon-c3', 'Poseidon', 'C3', RECETA, [132, 133]],
    ['pegaso-c2', 'Pegaso', 'C2', RECETA, [135, 136]],
    ['cronos-c1', 'Cronos', 'C1', RECETA, [138, 139]],
    ['ulises-c4', 'Ulises', 'C4', RECETA, [141, 142]],
    ['orfeo-c3', 'Orfeo', 'C3', RECETA, [144, 145]],
    ['hermes-c1', 'Hermes', 'C1', RECETA, [147, 148]],
    ['osiris-c4', 'Osiris', 'C4', RECETA, [150, 151]],
    ['teseo-c1', 'Teseo', 'C1', RECETA, [153, 154]],
    ['aquiles-c1', 'Aquiles', 'C1', RECETA, [156, 157]],
    ['hermes-c3', 'Hermes', 'C3', RECETA, [160, 161]],
    ['helios-c1', 'Helios', 'C1', RECETA, [163, 164]],
    ['hestia-c1', 'Hestia', 'C1', RECETA, [166, 167]],
    ['hestia-c2', 'Hestia', 'C2', RECETA, [169, 170]],
    ['aquiles-c4', 'Aquiles', 'C4', RECETA, [172, 173]],
    ['andromeda-c6', 'Andrómeda', 'C6', RECETA, [175, 176]],
    ['polaris-c7', 'Polaris', 'C7', RECETA, [178, 179]],
    ['cronos-c3', 'Cronos', 'C3', RECETA, [181, 182]],
    ['olimpia-c1', 'Olimpia', 'C1', RECETA, [184, 185]],
    ['lumen-c1', 'Lumen', 'C1', RECETA, [187, 188]],
    ['cratos', 'Cratos', '', RECETA, [193, 194]],
];

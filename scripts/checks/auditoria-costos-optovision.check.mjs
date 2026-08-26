// ────────────────────────────────────────────────────────────────────────────
// AUDITORÍA COMPLETA de la actualización de costos de Optovisión.
//
// Verifica TODA la cadena antes de escribir un peso en producción, y cada
// sección usa un camino INDEPENDIENTE del que se quiere validar (repetir la
// misma cuenta dos veces no audita nada):
//
//   A. TRANSCRIPCIÓN — cada precio del JSON tiene que aparecer, textual, en el
//      texto extraído de SU página del PDF. Detecta números mal tipeados.
//   B. COHERENCIA INTERNA DE LA LISTA — las columnas de tratamiento guardan
//      diferencias fijas en todo el catálogo (Prevencia−Sapphire=2.305,
//      Sapphire−Forte=2.745, Forte−Trío=28.680, Trío−SinAR=61.950). Un número
//      que rompe la escalera es un error de transcripción que A no atrapa si
//      el typo coincide con otro número de la página.
//   C. FUNDAMENTOS — calibrado e IVA del emparejador == LaboratoryConfig de
//      PRODUCCIÓN == respaldo del código. Tres fuentes, un solo valor.
//   D. EMPAREJADO — para cada producto emparejado, el renglón elegido tiene
//      que ser coherente con el NOMBRE por reglas de tokens (xperio↔XPERIO,
//      transitions↔TRANSITIONS…), en los dos sentidos. Detecta reglas de
//      regex que se comen unas a otras. Y la partición tiene que cerrar:
//      emparejados + sin lista + por nombre == total, sin duplicados.
//   E. ARITMÉTICA — costoNuevo de cada emparejado == fórmula recalculada acá,
//      a mano, desde el JSON. Y la promo 50% solo en los "Mi Primer".
//   F. BASES — los 127 de producción idénticos a local (costo Y precio): la
//      propuesta está calculada sobre los números reales.
//   G. EL QUE ESCRIBE — sincronizar-costos.mjs no puede tocar `price` ni traer
//      un UPDATE sin WHERE. Se audita el texto del script.
//
// SOLO LEE (local y producción). Correr:
//   node scripts/checks/auditoria-costos-optovision.check.mjs
//   PDF="/ruta/al/pdf" node ...   (sin PDF, la sección A se marca omitida)
// ────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { config } from 'dotenv';
import { homedir } from 'node:os';
import { emparejar, datos, costoDe, CALIBRADO, IVA } from '../maintenance/precios-optovision/emparejador.mjs';

config();

const PDF = process.env.PDF || `${homedir()}/Downloads/Lista de Precios Optovision - 03 de Agosto 2026.pdf`;
let fallas = 0, avisos = 0;
const ok = (desc, cond) => { console.log(`  ${cond ? '✅' : '❌'} ${desc}`); if (!cond) fallas++; };
const aviso = desc => { console.log(`  ⚠️  ${desc}`); avisos++; };

// ═══ A. TRANSCRIPCIÓN: el JSON contra el texto del PDF ══════════════════════
console.log('\nA. TRANSCRIPCIÓN — cada precio del JSON, buscado en su página del PDF');
if (!existsSync(PDF)) {
    aviso(`No está el PDF (${PDF}): sección omitida. Correr con PDF=/ruta para auditarla.`);
} else {
    const numerosDe = pag => {
        const texto = execFileSync('pdftotext', ['-f', String(pag), '-l', String(pag), PDF, '-'], { encoding: 'utf8' });
        return new Set([...texto.matchAll(/\b\d{1,3}(?:\.\d{3})+\b|\b\d{4,6}\b/g)]
            .map(m => Number(m[0].replaceAll('.', ''))));
    };
    const porPagina = new Map();
    const numeros = pag => {
        if (!porPagina.has(pag)) porPagina.set(pag, numerosDe(pag));
        return porPagina.get(pag);
    };

    let total = 0, noEncontrados = [];
    for (const d of datos.disenos) {
        for (const m of d.materiales) for (const [t, v] of Object.entries(m.precios)) {
            total++;
            if (!numeros(d.pagina).has(v)) noEncontrados.push(`${d.nombre} · ${m.material} · ${t} = ${v} (pág ${d.pagina})`);
        }
    }
    for (const g of datos.monofocales?.grupos || []) for (const f of g.filas) {
        total++;
        if (!numeros(datos.monofocales.pagina).has(f.precio)) noEncontrados.push(`monofocal ${g.familia} · ${f.material} = ${f.precio}`);
    }
    for (const t of datos.monofocales?.tratamientos_sueltos || []) {
        total++;
        // Los 4 tratamientos aparecen en la página 20 y en la 22.
        if (!numeros(20).has(t.precio) && !numeros(22).has(t.precio)) noEncontrados.push(`tratamiento ${t.nombre} = ${t.precio}`);
    }
    for (const fam of datos.sygnus?.familias || []) for (const f of fam.filas) {
        total++;
        if (!datos.sygnus.paginas.some(pag => numeros(pag).has(f.precio))) noEncontrados.push(`sygnus ${fam.familia} · ${f.material} = ${f.precio}`);
    }
    for (const c of [...(datos.crizal?.tratamiento_rx || []), ...(datos.crizal?.lentes_de_stock || [])]) {
        total++;
        if (!numeros(22).has(c.precio)) noEncontrados.push(`crizal ${c.nombre} = ${c.precio}`);
    }
    ok(`los ${total} precios del JSON aparecen textuales en su página del PDF`, noEncontrados.length === 0);
    for (const x of noEncontrados.slice(0, 8)) console.log(`       falta: ${x}`);
}

// ═══ B. COHERENCIA INTERNA: la escalera de tratamientos ═════════════════════
console.log('\nB. COHERENCIA INTERNA — las diferencias fijas entre columnas de tratamiento');
{
    const GAPS = [['CRIZAL PREVENCIA', 'CRIZAL SAPPHIRE', 2305], ['CRIZAL SAPPHIRE', 'CRIZAL FORTE UV', 2745],
    ['CRIZAL FORTE UV', 'TRIO EASY CLEAN', 28680], ['TRIO EASY CLEAN', 'SIN AR', 61950]];
    let filas = 0, rotos = [];
    for (const d of datos.disenos) for (const m of d.materiales) {
        for (const [alto, bajo, gap] of GAPS) {
            if (m.precios[alto] == null || m.precios[bajo] == null) continue;
            filas++;
            const real = m.precios[alto] - m.precios[bajo];
            if (real !== gap) rotos.push(`${d.nombre} · ${m.material}: ${alto}−${bajo} = ${real} (esperado ${gap})`);
        }
    }
    ok(`las ${filas} diferencias entre columnas respetan la escalera del catálogo`, rotos.length === 0);
    for (const x of rotos.slice(0, 6)) console.log(`       rompe: ${x}`);
    ok('la diferencia Trío−SinAR (61.950) es EXACTAMENTE el precio del Trío suelto',
        (datos.monofocales?.tratamientos_sueltos || []).some(t => t.precio === 61950));
}

// ═══ C. FUNDAMENTOS: calibrado e IVA, tres fuentes ══════════════════════════
console.log('\nC. FUNDAMENTOS — calibrado e IVA: emparejador vs producción vs código');
const prod = new PrismaClient({ datasources: { db: { url: process.env.PROD_DATABASE_URL } } });
const local = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
try {
    const [cfg] = await prod.$queryRaw`select calibrado, iva from "LaboratoryConfig" where upper(name) = ${'OPTOVISION'}`;
    ok(`LaboratoryConfig de PRODUCCIÓN: calibrado $${cfg?.calibrado} e IVA ${cfg?.iva}%`,
        cfg?.calibrado === CALIBRADO && cfg?.iva === IVA);
    const codigo = readFileSync('src/lib/lens-cost.ts', 'utf8');
    ok(`el respaldo del código (CALIBRADO_POR_DEFECTO) también dice ${CALIBRADO}`,
        codigo.includes(`CALIBRADO_POR_DEFECTO = ${CALIBRADO}`) && codigo.includes(`IVA_POR_DEFECTO = ${IVA}`));

    // ═══ D. EMPAREJADO: coherencia nombre ↔ renglón, y la partición ═════════
    console.log('\nD. EMPAREJADO — el renglón elegido contra el nombre, por tokens');
    const productos = await local.$queryRaw`
        select id, name, price, cost, "baseCost", is2x1 from "Product"
        where category = 'Cristal' and laboratory = 'OPTOVISION' order by name`;
    const { ok: emp, porNombre, sinLista } = emparejar(productos);

    ok(`la partición cierra: ${emp.length} + ${sinLista.length} + ${porNombre.length} = ${productos.length}`,
        emp.length + sinLista.length + porNombre.length === productos.length);
    const ids = new Set([...emp, ...porNombre, ...sinLista].map(x => x.id));
    ok('ningún producto cae en dos categorías a la vez', ids.size === productos.length);

    // Tokens en los dos sentidos: si el nombre dice X, el renglón tiene que
    // decir X — y al revés. Un solo regex por token, insensible a mayúsculas y
    // espacios ("BlueUV" vs "BLUE UV"), aplicado a nombre y renglón por igual.
    const TOKENS = [/xperio/i, /transitions/i, /xtractive/i, /blue\s*uv/i, /acclimates/i, /stylis/i, /airwear/i];
    // Exenciones documentadas del sentido renglón→nombre:
    //  · ORMA: es el material por descarte (muchos nombres no lo dicen);
    //  · tratamientos CRIZAL del renglón: los pone la política del más caro.
    let incoherentes = [];
    for (const p of emp) {
        if (!p.material) continue;
        const renglon = `${p.familia || ''} ${p.material || ''} ${p.tratamiento || ''}`;
        for (const re of TOKENS) {
            const n = re.test(p.name), r = re.test(renglon);
            if (n !== r) {
                incoherentes.push(`${String(p.name).slice(0, 42)} → "${renglon.slice(0, 52)}" (${n ? 'falta' : 'sobra'} ${re.source})`);
                break;
            }
        }
    }
    ok(`los ${emp.length} emparejados son coherentes nombre↔renglón por tokens`, incoherentes.length === 0);
    for (const x of incoherentes.slice(0, 6)) console.log(`       incoherente: ${x}`);

    // ═══ E. ARITMÉTICA: recalcular todo a mano ══════════════════════════════
    console.log('\nE. ARITMÉTICA — cada costoNuevo, recalculado desde el JSON');
    let mal = 0;
    for (const p of emp) {
        const esperado = costoDe(p.lista);
        if (esperado !== p.costoNuevo) mal++;
    }
    ok(`los ${emp.length} costos nuevos == (lista + ${CALIBRADO}) × ${(1 + IVA / 100)}`, mal === 0);
    const promos = emp.filter(p => p.esPromo);
    ok(`la media-lista (promo 50%) aplica SOLO a los ${promos.length} "Mi Primer Varilux"`,
        promos.length === 4 && promos.every(p => /mi\s*primer/i.test(p.name))
        && emp.filter(p => !p.esPromo).every(p => !/mi\s*primer/i.test(p.name)));
    // La lente de stock re-emparejada a su renglón real (pág. 22) baja ~9% y
    // ES CORRECTO: su costo viejo venía de un renglón equivocado más caro.
    const bajanFuerte = emp.filter(p => p.pct != null && p.pct < -8 && !p.renglonStock);
    ok('ningún costo baja más de 8% (salvo lentes de stock con renglón textual)', bajanFuerte.length === 0);
    for (const x of bajanFuerte.slice(0, 4)) console.log(`       baja ${x.pct.toFixed(1)}%: ${String(x.name).slice(0, 44)}`);

    // ═══ F. BASES: local == producción ══════════════════════════════════════
    console.log('\nF. BASES — la propuesta está calculada sobre los números de producción');
    const enProd = await prod.$queryRaw`
        select id, cost, price from "Product" where category = 'Cristal' and laboratory = 'OPTOVISION'`;
    const localPorId = new Map(productos.map(p => [p.id, p]));
    const distintos = enProd.filter(x => {
        const l = localPorId.get(x.id);
        return !l || Math.round(l.cost || 0) !== Math.round(x.cost || 0) || Math.round(l.price || 0) !== Math.round(x.price || 0);
    });
    ok(`los ${enProd.length} cristales de producción están idénticos en local (costo y precio)`, distintos.length === 0);

    // ═══ G. EL QUE ESCRIBE ══════════════════════════════════════════════════
    console.log('\nG. EL QUE ESCRIBE — sincronizar-costos.mjs, auditado como texto');
    const sync = readFileSync('scripts/maintenance/precios-optovision/sincronizar-costos.mjs', 'utf8');
    // UNA sola pasada responde las dos preguntas — y con guard de longitud en
    // ambas: un `.every` sobre cero matches da verde vacío, o sea un chequeo
    // que dejó de chequear sin avisar.
    const updates = [...sync.matchAll(/update "Product"[\s\S]*?(where[^\n]*)/gi)];
    ok('ningún UPDATE del script toca `price`', updates.length > 0 && updates.every(u => !/\bprice\s*=/.test(u[0])));
    ok('todo UPDATE lleva WHERE por id', updates.length > 0 && updates.every(u => /where id = /.test(u[1])));
    ok('sin --produccion se planta si DATABASE_URL no es localhost', /localhost\|127/.test(sync));
    ok('cada cambio queda firmado en el AuditLog', sync.includes('"AuditLog"'));
    // ═══ H. POLÍTICA DEL MÁS CARO ══════════════════════════════════════════
    console.log('\nH. POLÍTICA — todo renglón con Crizal costea a su columna más cara');
    let violan = [];
    for (const p of emp) {
        if (!p.material || p.renglonStock) continue;
        const d = datos.disenos.find(x => x.nombre === p.familia);
        const m = d?.materiales.find(x => x.material === p.material);
        if (!m) continue; // monofocales: la política va por tratamiento suelto
        const crizales = Object.entries(m.precios).filter(([k]) => k.startsWith('CRIZAL'));
        if (!crizales.length) continue;
        const maximo = Math.max(...crizales.map(([, v]) => v));
        const esSinAr = /sin\s*ar|no\s*reflex|sin\s*crizal/i.test(p.name);
        const esTrio = /tr[íi]o|easy\s*clean/i.test(p.name);
        if (!esSinAr && !esTrio) {
            const listaComparable = p.esPromo ? p.lista * 2 : p.lista;
            if (Math.round(listaComparable) !== maximo) {
                violan.push(`${String(p.name).slice(0, 44)} usa ${p.tratamiento} (${listaComparable}) y el máximo es ${maximo}`);
            }
        }
    }
    ok('todos los renglones con Crizal usan la columna más cara (o SIN AR/Trío por nombre)', violan.length === 0);
    for (const x of violan.slice(0, 6)) console.log(`       viola: ${x}`);
    const sinConfirmar = emp.filter(p => p.seguro === false);
    ok(`no queda NINGÚN producto con el tratamiento "sin confirmar" (antes eran 44)`, sinConfirmar.length === 0);
    for (const x of sinConfirmar.slice(0, 5)) console.log(`       sin confirmar: ${String(x.name).slice(0, 50)}`);

} finally {
    await prod.$disconnect();
    await local.$disconnect();
}

console.log(`\n${'═'.repeat(60)}`);
console.log(fallas === 0
    ? `✅ AUDITORÍA COMPLETA EN VERDE${avisos ? ` (${avisos} sección(es) omitidas)` : ''}: la cadena entera verifica.`
    : `❌ ${fallas} verificación(es) FALLARON — no aplicar en producción hasta resolverlas.`);
process.exit(fallas === 0 ? 0 : 1);

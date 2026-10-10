/**
 * Arma y renderiza la story de cada feriado con apertura cargada, de hoy en
 * adelante:
 *   social/contenido/feriado-<fecha>.json  +  public/social/feriado-<fecha>/01.jpg
 *
 *   npx tsx scripts/social/generar-stories-feriados.ts
 *
 * No publica nada ni toca la base. Las placas se commitean y se deployan;
 * después el cron social-story-diaria las saca solo, desde
 * DIAS_DE_ANTICIPACION días antes hasta el feriado (src/lib/social/stories-feriados.ts).
 *
 * Correrlo cada vez que se carga o cambia la `apertura` de un feriado en
 * src/lib/constants/feriados-argentina.ts. `npm run check:social` avisa si
 * a un feriado con apertura le falta la placa.
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { FERIADOS_ARGENTINA } from '../../src/lib/constants/feriados-argentina';
import { piezaDeFeriado } from '../../src/lib/social/stories-feriados';

const RAIZ = path.resolve(__dirname, '..', '..');
const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Cordoba' }).format(new Date());

let hechas = 0, iguales = 0;
for (const f of FERIADOS_ARGENTINA) {
    if (f.fecha < hoy) continue;
    const pieza = piezaDeFeriado(f);
    if (!pieza) continue;
    const json = path.join(RAIZ, 'social', 'contenido', `${pieza.id}.json`);
    const texto = JSON.stringify(pieza, null, 2) + '\n';
    const jpg = path.join(RAIZ, 'public', 'social', pieza.id, '01.jpg');
    // Si el texto no cambió y la placa existe, no se re-renderiza: un JPEG
    // nuevo con los mismos píxeles igual ensucia el git.
    if (existsSync(json) && existsSync(jpg) && readFileSync(json, 'utf-8') === texto) { iguales++; continue; }
    writeFileSync(json, texto);
    execFileSync('node', [path.join(RAIZ, 'scripts', 'social', 'render.mjs'), json], { stdio: 'inherit' });
    hechas++;
}
console.log(`Stories de feriados: ${hechas} renderizadas, ${iguales} sin cambios.`);

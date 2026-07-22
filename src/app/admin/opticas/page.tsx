"use client";

// Panel de captación de ópticas (B2B mayorista) — solo Ishtar y Milena.
// Tabla de leads scrapeados/importados con rating, datos, link a Maps y botón
// de WhatsApp con mensaje precargado (el envío lo dispara siempre un humano).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Star, MapPin, MessageCircle, Check, Ban, RotateCcw, Search,
  Upload, Copy, ShieldAlert, Store, Phone, X, Eye,
} from "lucide-react";
import { formatDateTime } from "@/lib/format-date";

// {link} se resuelve en waLink() al link tracker /mayorista/catalogo?lead=<id>
// (mismo origin donde corre el panel). Ojo: NO decir "sin mínimos" — el
// checkout mayorista exige WHOLESALE_MIN_PIECES=10 (payway/route.ts), una
// plantilla que prometa "sin mínimos" manda al lead a un error en el carrito.
const DEFAULT_TPL =
  "Hola {nombre}! Te escribo de *Cápsula Escarlata* — una colección boutique y curada: diseño de autor y modelos en tendencia, a precio mayorista para ópticas 👓\n\n" +
  "Trabajamos *acetato italiano* (denso, no se decolora y ajusta perfecto en caliente) y *titanio* (ultraliviano, hipoalergénico, no se oxida). Es calidad que el cliente nota apenas se lo prueba, y eso te lo hace fácil de vender.\n\n" +
  "Comprás desde *$32.000* y se venden al público entre $80.000 y $160.000: *2,5x o más de margen*, y el precio lo ponés vos.\n\n" +
  "Oficina en Córdoba (retirás sin cargo), envíos a todo el país y cambio inmediato ante fallas.\n\n" +
  "Mirá el catálogo completo con precios acá 👇\n{link}";

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  NUEVO: { label: "Nuevo", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  CONTACTADO: { label: "Contactado", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  RESPONDIO: { label: "Respondió", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  CLIENTE: { label: "Cliente 🎉", cls: "bg-emerald-600 text-white border-emerald-600" },
  BLOCKLIST: { label: "Blocklist", cls: "bg-red-50 text-red-600 border-red-200" },
};

export default function OpticasLeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  // Filtros (q/city se debouncean para no disparar un fetch por tecla)
  const [status, setStatus] = useState("");
  const [qInput, setQInput] = useState("");
  const [cityInput, setCityInput] = useState("");
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [minRating, setMinRating] = useState(0);
  const [onlyWa, setOnlyWa] = useState(true);
  // Descarta respuestas viejas que lleguen después de una más nueva
  const fetchSeq = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => { setQ(qInput); setCity(cityInput); setPage(1); }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qInput, cityInput]);

  // Plantilla del mensaje (se guarda en el navegador)
  const [tpl, setTpl] = useState(DEFAULT_TPL);
  const [showTpl, setShowTpl] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importMsg, setImportMsg] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("opticas-leads-tpl");
    if (saved) setTpl(saved);
  }, []);

  const fetchLeads = useCallback(async () => {
    const seq = ++fetchSeq.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        ...(status ? { status } : {}),
        ...(q ? { q } : {}),
        ...(city ? { city } : {}),
        ...(minRating ? { minRating: String(minRating) } : {}),
        ...(onlyWa ? { onlyWa: "1" } : {}),
      });
      const res = await fetch(`/api/admin/opticas-leads?${params}`);
      if (seq !== fetchSeq.current) return; // llegó tarde: hay una búsqueda más nueva
      if (res.status === 403) { setForbidden(true); return; }
      const data = await res.json();
      if (seq !== fetchSeq.current) return;
      setLeads(data.leads || []);
      setStats(data.stats || null);
      setTotalPages(data.totalPages || 1);
    } catch (e) {
      console.error(e);
    } finally {
      if (seq === fetchSeq.current) setLoading(false);
    }
  }, [page, status, q, city, minRating, onlyWa]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const patchLead = async (id: string, body: any) => {
    const res = await fetch(`/api/admin/opticas-leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    // Un solo camino de actualización: refetch (lista + stats coherentes).
    if (res.ok) fetchLeads();
  };

  const catalogLink = (lead: any) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://atelieroptica.com.ar";
    return `${origin}/mayorista/catalogo?lead=${lead.id}`;
  };

  const waLink = (lead: any) => {
    const msg = tpl.replaceAll("{nombre}", lead.name).replaceAll("{link}", catalogLink(lead));
    return `https://wa.me/${lead.phoneWa}?text=${encodeURIComponent(msg)}`;
  };

  const mapsLink = (lead: any) =>
    lead.mapsUrl ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lead.name} ${lead.address || ""} ${lead.city || ""}`)}`;

  const doImport = async () => {
    setImportMsg("Importando…");
    try {
      let rows: any[] = [];
      const text = importText.trim();
      if (text.startsWith("[") || text.startsWith("{")) {
        const parsed = JSON.parse(text);
        rows = Array.isArray(parsed) ? parsed : parsed.leads || [];
      } else {
        // CSV con soporte de comillas (las direcciones de Maps traen comas:
        // "Av. Colón 123, Local 2"). Split naive corrompería las columnas.
        const parseCsvLine = (line: string): string[] => {
          const cells: string[] = [];
          let cur = "", inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (inQuotes) {
              if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
              else if (ch === '"') inQuotes = false;
              else cur += ch;
            } else if (ch === '"') inQuotes = true;
            else if (ch === ",") { cells.push(cur); cur = ""; }
            else cur += ch;
          }
          cells.push(cur);
          return cells.map(c => c.trim());
        };
        const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
        const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase());
        rows = lines.slice(1).map(line => {
          const cells = parseCsvLine(line);
          const row: any = {};
          headers.forEach((h, i) => { row[h] = cells[i]; });
          return row;
        });
      }
      const res = await fetch("/api/admin/opticas-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads: rows, source: "csv" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setImportMsg(`✓ ${data.created} nuevos, ${data.updated} actualizados, ${data.skipped} salteados${data.failed ? `, ${data.failed} con error` : ""}`);
      setImportText("");
      fetchLeads();
    } catch (e: any) {
      setImportMsg(`Error: ${e.message}`);
    }
  };

  const statCards = useMemo(() => {
    if (!stats) return [];
    const by = stats.byStatus || {};
    return [
      { label: "Total", value: stats.total ?? 0, cls: "text-stone-900" },
      { label: "Nuevos", value: by.NUEVO ?? 0, cls: "text-blue-600" },
      { label: "Con WhatsApp", value: stats.conWa ?? 0, cls: "text-emerald-600" },
      { label: "Contactados", value: by.CONTACTADO ?? 0, cls: "text-amber-600" },
      { label: "Respondieron", value: by.RESPONDIO ?? 0, cls: "text-emerald-700" },
      { label: "Clientes", value: by.CLIENTE ?? 0, cls: "text-emerald-800" },
      { label: "Blocklist", value: by.BLOCKLIST ?? 0, cls: "text-red-500" },
      { label: "Vieron el catálogo", value: stats.catalogViews?.uniqueSessions ?? 0, cls: "text-violet-600" },
    ];
  }, [stats]);

  if (forbidden) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center gap-3 p-8">
        <ShieldAlert className="w-10 h-10 text-red-400" />
        <h1 className="text-lg font-black uppercase tracking-widest">Acceso restringido</h1>
        <p className="text-sm text-stone-500 max-w-sm">
          Esta sección es solo para Ishtar y Milena. Si tenés que entrar, pedile a un admin
          que agregue tu email a <code className="bg-stone-100 px-1 rounded">OPTICAS_LEADS_EMAILS</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <Store className="w-6 h-6 text-stone-700" />
          <div>
            <h1 className="text-xl font-black tracking-tight">Captación de Ópticas</h1>
            <p className="text-xs text-stone-500">Canal mayorista B2B · el envío de WhatsApp siempre lo disparás vos</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowTpl(v => !v)}
            className="px-3 py-2 text-xs font-bold uppercase tracking-wider border border-stone-300 rounded-lg hover:bg-stone-50">
            Plantilla WA
          </button>
          <button onClick={() => setShowImport(v => !v)}
            className="px-3 py-2 text-xs font-bold uppercase tracking-wider bg-stone-900 text-white rounded-lg hover:bg-stone-700 flex items-center gap-2">
            <Upload className="w-3.5 h-3.5" /> Importar
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-5">
        {statCards.map(c => (
          <div key={c.label} className="bg-white border border-stone-200 rounded-xl px-3 py-3 text-center">
            <p className={`text-2xl font-black ${c.cls}`}>{c.value}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Plantilla */}
      {showTpl && (
        <div className="bg-white border border-stone-200 rounded-xl p-4 mb-5">
          <div className="flex justify-between items-center mb-2">
            <p className="text-xs font-black uppercase tracking-widest text-stone-500">
              Mensaje de invitación — usá {"{nombre}"} para el nombre de la óptica y {"{link}"} para el catálogo (se arma solo, distinto por óptica)
            </p>
            <button onClick={() => setShowTpl(false)}><X className="w-4 h-4 text-stone-400" /></button>
          </div>
          <textarea value={tpl}
            onChange={e => { setTpl(e.target.value); localStorage.setItem("opticas-leads-tpl", e.target.value); }}
            rows={4}
            className="w-full border border-stone-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300" />
        </div>
      )}

      {/* Importar */}
      {showImport && (
        <div className="bg-white border border-stone-200 rounded-xl p-4 mb-5">
          <div className="flex justify-between items-center mb-2">
            <p className="text-xs font-black uppercase tracking-widest text-stone-500">
              Pegá JSON ([{"{"}name, phone, rating, address, city…{"}"}]) o CSV con encabezado name,phone,rating,address,city
            </p>
            <button onClick={() => setShowImport(false)}><X className="w-4 h-4 text-stone-400" /></button>
          </div>
          <textarea value={importText} onChange={e => setImportText(e.target.value)} rows={5}
            placeholder={'name,phone,rating,address,city\nÓptica Ejemplo,351 555-1234,4.5,Av. Colón 123,Córdoba'}
            className="w-full border border-stone-200 rounded-lg p-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-stone-300" />
          <div className="flex items-center gap-3 mt-2">
            <button onClick={doImport}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
              Importar
            </button>
            <span className="text-xs text-stone-500">{importMsg}</span>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
          className="border border-stone-200 rounded-lg px-2 py-2 text-xs font-semibold bg-white">
          <option value="">Todos los estados</option>
          <option value="NUEVO">Nuevos</option>
          <option value="CONTACTADO">Contactados</option>
          <option value="RESPONDIO">Respondieron</option>
          <option value="CLIENTE">Clientes</option>
          <option value="BLOCKLIST">Blocklist</option>
        </select>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input value={qInput} onChange={e => setQInput(e.target.value)}
            placeholder="nombre, dirección o teléfono"
            className="border border-stone-200 rounded-lg pl-8 pr-3 py-2 text-xs w-56 bg-white" />
        </div>
        <input value={cityInput} onChange={e => setCityInput(e.target.value)}
          placeholder="ciudad"
          className="border border-stone-200 rounded-lg px-3 py-2 text-xs w-32 bg-white" />
        <select value={minRating} onChange={e => { setMinRating(Number(e.target.value)); setPage(1); }}
          className="border border-stone-200 rounded-lg px-2 py-2 text-xs font-semibold bg-white">
          <option value={0}>Rating: todos</option>
          <option value={3.5}>3.5+</option>
          <option value={4}>4.0+</option>
          <option value={4.5}>4.5+</option>
        </select>
        <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 bg-white border border-stone-200 rounded-lg px-3 py-2 cursor-pointer">
          <input type="checkbox" checked={onlyWa} onChange={e => { setOnlyWa(e.target.checked); setPage(1); }} />
          Solo con teléfono
        </label>
      </div>

      {/* Tabla */}
      <div className="bg-white border border-stone-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-stone-100 text-[10px] font-black uppercase tracking-widest text-stone-400 text-left">
              <th className="px-4 py-3">Óptica</th>
              <th className="px-4 py-3">Teléfono</th>
              <th className="px-4 py-3">Rating</th>
              <th className="px-4 py-3">Dirección</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-stone-400 text-xs">Cargando…</td></tr>
            ) : leads.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-stone-400 text-xs">
                Sin leads todavía — importá con el botón de arriba.
              </td></tr>
            ) : leads.map(lead => {
              const st = STATUS_LABELS[lead.status] || STATUS_LABELS.NUEVO;
              return (
                <tr key={lead.id} className="border-b border-stone-50 hover:bg-stone-50/60">
                  <td className="px-4 py-3">
                    <p className="font-bold text-stone-900 leading-tight">{lead.name}</p>
                    <a href={mapsLink(lead)} target="_blank" rel="noopener noreferrer"
                      className="text-[11px] text-blue-600 hover:underline inline-flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> ver en Maps ↗
                    </a>
                    {lead.catalogViews > 0 && (
                      <p title={`Última vez: ${formatDateTime(lead.catalogViewedAt)}`}
                        className="text-[11px] text-violet-600 font-semibold inline-flex items-center gap-1 mt-0.5">
                        <Eye className="w-3 h-3" /> Vio el catálogo{lead.catalogViews > 1 ? ` (${lead.catalogViews}x)` : ""}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {lead.phone ? (
                      <span className="inline-flex items-center gap-1.5 font-mono text-xs">
                        <Phone className="w-3 h-3 text-stone-400" /> {lead.phone}
                        <button title="copiar" onClick={() => navigator.clipboard.writeText(lead.phone)}
                          className="text-stone-300 hover:text-stone-600"><Copy className="w-3 h-3" /></button>
                      </span>
                    ) : <span className="text-stone-300 text-xs">—</span>}
                    {lead.phoneWa == null && lead.phone && (
                      <p className="text-[10px] text-amber-600 font-bold">no normalizable</p>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {lead.rating != null ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold">
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        {Number(lead.rating).toFixed(1)}
                        {lead.reviewsCount != null && <span className="text-stone-400 font-normal">({lead.reviewsCount})</span>}
                      </span>
                    ) : <span className="text-stone-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-stone-500 max-w-[260px]">
                    {lead.address}{lead.city ? `, ${lead.city}` : ""}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block border px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${st.cls}`}>
                      {st.label}
                    </span>
                    {lead.contactedBy && lead.status !== "NUEVO" && (
                      <p className="text-[10px] text-stone-400 mt-0.5">por {lead.contactedBy}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {lead.phoneWa && lead.status !== "BLOCKLIST" && (
                        <a href={waLink(lead)} target="_blank" rel="noopener noreferrer"
                          title="Abrir WhatsApp con el mensaje precargado"
                          className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg">
                          <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                        </a>
                      )}
                      {lead.status === "NUEVO" && (
                        <button title="Marcar contactada" onClick={() => patchLead(lead.id, { status: "CONTACTADO" })}
                          className="p-1.5 rounded-lg border border-stone-200 text-stone-500 hover:bg-emerald-50 hover:text-emerald-700">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {lead.status === "CONTACTADO" && (
                        <button title="Marcar que respondió" onClick={() => patchLead(lead.id, { status: "RESPONDIO" })}
                          className="p-1.5 rounded-lg border border-stone-200 text-stone-500 hover:bg-emerald-50 hover:text-emerald-700">
                          <MessageCircle className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {lead.status !== "BLOCKLIST" ? (
                        <button title="Blocklist (no contactar)" onClick={() => patchLead(lead.id, { status: "BLOCKLIST" })}
                          className="p-1.5 rounded-lg border border-stone-200 text-stone-400 hover:bg-red-50 hover:text-red-600">
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button title="Sacar de blocklist" onClick={() => patchLead(lead.id, { status: "NUEVO" })}
                          className="p-1.5 rounded-lg border border-stone-200 text-stone-400 hover:bg-blue-50 hover:text-blue-600">
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4 text-xs font-bold">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            className="px-3 py-1.5 border border-stone-200 rounded-lg disabled:opacity-30">←</button>
          <span className="text-stone-500">página {page} de {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 border border-stone-200 rounded-lg disabled:opacity-30">→</button>
        </div>
      )}
    </div>
  );
}

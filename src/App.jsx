import { useState, useEffect, useRef, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

// ── Supabase ─────────────────────────────────────────────────────────────────
const SUPA_URL = "https://mbkwpaxissvvjhewkggl.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ia3dwYXhpc3N2dmpoZXdrZ2dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MjQzOTMsImV4cCI6MjA4NzAwMDM5M30.Zo9aJVDByO8aVSADfSCc2m4jCI1qeXuWYQgVRT-a3LA";
const HDR = { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: "Bearer " + SUPA_KEY };
const REST = SUPA_URL + "/rest/v1";

function q(table) {
  var _t = table, _f = [], _o = null, _s = "*", _lim = null;
  var api = {
    select: function(s) { _s = s; return api; },
    order: function(c, o) { _o = "order=" + c + (o && o.ascending === false ? ".desc" : ".asc"); return api; },
    limit: function(n) { _lim = n; return api; },
    eq: function(c, v) { _f.push(c + "=eq." + encodeURIComponent(v)); return api; },
    get: function() {
      var u = REST + "/" + _t + "?select=" + _s;
      if (_f.length) u += "&" + _f.join("&");
      if (_o) u += "&" + _o;
      if (_lim) u += "&limit=" + _lim;
      return fetch(u, { headers: HDR }).then(function(r) { return r.json().then(function(d) { return r.ok ? { data: d, error: null } : { data: null, error: d }; }); });
    },
    insert: function(p) {
      return fetch(REST + "/" + _t, { method: "POST", headers: Object.assign({}, HDR, { Prefer: "return=representation" }), body: JSON.stringify(p) })
        .then(function(r) { return r.json().then(function(d) { return r.ok ? { data: Array.isArray(d) ? d[0] : d, error: null } : { data: null, error: d }; }); });
    },
    update: function(p) {
      var u = REST + "/" + _t + (_f.length ? "?" + _f.join("&") : "");
      return fetch(u, { method: "PATCH", headers: Object.assign({}, HDR, { Prefer: "return=representation" }), body: JSON.stringify(p) })
        .then(function(r) { return r.json().then(function(d) { return r.ok ? { data: d, error: null } : { data: null, error: d }; }); });
    },
    del: function() {
      var u = REST + "/" + _t + (_f.length ? "?" + _f.join("&") : "");
      return fetch(u, { method: "DELETE", headers: HDR }).then(function(r) { return r.ok ? { error: null } : r.json().then(function(d) { return { error: d }; }); });
    }
  };
  return api;
}

// ── Theme ────────────────────────────────────────────────────────────────────
const DT = {
  primary: "#F97316", secondary: "#3B82F6", success: "#22C55E", danger: "#EF4444", warning: "#EAB308",
  bg: "#1C1917", card: "#292524", mid: "#44403C", border: "#57534E", white: "#FAFAF9", muted: "#A8A29E",
  sidebarWidth: 220, borderRadius: 12, fontFamily: "'Segoe UI',system-ui,sans-serif",
  companyName: "JEAN BTP SARL", companyAddress: "Zone Industrielle, Abidjan",
  companyTel: "+225 27 00 00 00", companyEmail: "devis@jeanbtp.ci", companySiret: "CI-ABJ-2024-B-12345",
  devisBg: "#ffffff", devisAccent: "#F97316", devisText: "#222222",
  devisTableHead: "#F97316", devisTableHeadText: "#ffffff", devisTotalBg: "#F97316",
  devisFont: "sans-serif", devisBorderRadius: 8, devisTitre: "DEVIS", devisMention: "",
  showColRef: true, showColUnite: true, showColPU: true, showColTotal: true,
  logoEntreprise: "", logoClient: "",
};
function useTheme() {
  const [T, setT] = useState(function() { try { var s = localStorage.getItem("jm_t"); return s ? Object.assign({}, DT, JSON.parse(s)) : DT; } catch(e) { return DT; } });
  function upT(k, v) { setT(function(p) { var n = Object.assign({}, p, { [k]: v }); try { localStorage.setItem("jm_t", JSON.stringify(n)); } catch(e) {} return n; }); }
  function resetT() { setT(DT); try { localStorage.removeItem("jm_t"); } catch(e) {} }
  return { T, upT, resetT };
}
function useBP() {
  const [bp, setBp] = useState(function() { var w = window.innerWidth; return w < 480 ? "xs" : w < 768 ? "sm" : w < 1024 ? "md" : "lg"; });
  useEffect(function() {
    function fn() { var w = window.innerWidth; setBp(w < 480 ? "xs" : w < 768 ? "sm" : w < 1024 ? "md" : "lg"); }
    window.addEventListener("resize", fn); return function() { window.removeEventListener("resize", fn); };
  }, []);
  return { bp, isMobile: bp === "xs" || bp === "sm" };
}

// ── Constantes ───────────────────────────────────────────────────────────────
const CATS = ["Main d'oeuvre", "Materiaux", "Equipement", "Transport", "Sous-traitance", "Divers"];
const UNITES = ["U", "m2", "ml", "m3", "kg", "t", "forfait", "h", "j", "ens."];
const STATUTS_CH = ["Brouillon", "Planifie", "En cours", "En derive", "En reception", "Cloture"];
const STATUTS_DEV = ["brouillon", "envoye", "accepte", "refuse"];
const TYPES_INT = ["Urgence", "Preventive", "Corrective", "Inspection"];

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n) { return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n || 0) + " XOF"; }
function fmtS(n) { var a = Math.abs(n || 0); if (a >= 1e6) return ((n||0)/1e6).toFixed(1) + "M"; if (a >= 1e3) return Math.round((n||0)/1e3) + "k"; return String(Math.round(n || 0)); }
function pct(v, t) { return t > 0 ? Math.round(v / t * 100) : 0; }
function today() { return new Date().toISOString().slice(0, 10); }
function addDays(d, n) { var dt = new Date(d); dt.setDate(dt.getDate() + n); return dt.toISOString().slice(0, 10); }
function uid() { return Date.now() + "-" + Math.random().toString(36).slice(2); }
function stC(s, T) { return ({ "En cours": T.secondary, "En derive": T.danger, "Cloture": T.success, "Planifie": T.warning, "En reception": T.primary, "Brouillon": T.muted }[s] || T.muted); }
function catC(c, T) { return ({ "Main d'oeuvre": T.secondary, "Materiaux": T.primary, "Equipement": T.warning, "Transport": T.success, "Sous-traitance": "#A855F7", "Divers": T.muted }[c] || T.muted); }
function totalDep(c) { return (c.depenses || []).reduce(function(a, d) { return a + Number(d.montant || 0); }, 0); }
function genNum() { return "DEV-" + new Date().getFullYear() + "-" + String(Date.now()).slice(-5); }

function calcDevis(lots, tva, remise) {
  var lc = (lots || []).map(function(l) {
    if (l.type === "article") return Object.assign({}, l, { total_ligne: Math.round((l.quantite || 0) * (l.prix_unitaire || 0)) });
    var arts = (l.articles || []).map(function(a) { return Object.assign({}, a, { total_ligne: Math.round((a.quantite || 0) * (a.prix_unitaire || 0)) }); });
    var sls = (l.sousLots || []).map(function(sl) {
      var sa = (sl.articles || []).map(function(a) { return Object.assign({}, a, { total_ligne: Math.round((a.quantite || 0) * (a.prix_unitaire || 0)) }); });
      return Object.assign({}, sl, { articles: sa, total: sa.reduce(function(s, a) { return s + a.total_ligne; }, 0) });
    });
    return Object.assign({}, l, { articles: arts, sousLots: sls, total: arts.reduce(function(s, a) { return s + a.total_ligne; }, 0) + sls.reduce(function(s, sl) { return s + sl.total; }, 0) });
  });
  var st = lc.reduce(function(s, l) { return s + (l.total || l.total_ligne || 0); }, 0);
  var mr = Math.round(st * (remise / 100));
  var bi = st - mr;
  var mt = Math.round(bi * (tva / 100));
  return { lots: lc, sousTotal: st, montantRemise: mr, baseImp: bi, montantTVA: mt, totalTTC: bi + mt };
}

function calcTache(t, tc, cfg) {
  var q = parseFloat(t.quantite) || 0;
  var mo = ((parseFloat(t.salaire) || 0) / (parseFloat(t.rendement) || 1)) * (1 + tc / 100);
  var ds = mo + (parseFloat(t.materiau) || 0) + (parseFloat(t.materiel) || 0) + (parseFloat(t.sous_traitance) || 0);
  var fg = ds * (cfg.fg / 100);
  var pr = ds + fg;
  var bn = pr * (cfg.benef / 100);
  var pv = pr + bn;
  return { mo: mo, ds: ds, fg: fg, pr: pr, bn: bn, pv: pv, pvt: pv * q };
}

// ── PDF ───────────────────────────────────────────────────────────────────────
function exportPDF(dv, calc, chNom, T) {
  var acc = T.devisAccent || T.primary, bg = T.devisBg || "#fff", txt = T.devisText || "#222";
  var thBg = T.devisTableHead || T.primary, thTxt = T.devisTableHeadText || "#fff";
  var totBg = T.devisTotalBg || T.primary, fnt = T.devisFont || "sans-serif", br = T.devisBorderRadius || 8;
  var sr = T.showColRef !== false, su = T.showColUnite !== false, sp = T.showColPU !== false, st2 = T.showColTotal !== false;
  var rows = "";
  (calc.lots || []).forEach(function(l, li) {
    if (l.type === "lot") {
      rows += '<tr style="background:' + acc + '22"><td colspan="6" style="padding:8px;font-weight:800;color:' + acc + '">LOT ' + (li + 1) + ' — ' + l.nom + '<span style="float:right">' + fmt(l.total) + '</span></td></tr>';
      (l.articles || []).forEach(function(a, ai) {
        rows += '<tr>' + (sr ? '<td>' + (li+1) + '.' + (ai+1) + '</td>' : '') + '<td>' + a.designation + '</td><td>' + a.quantite + '</td>' + (su ? '<td>' + a.unite + '</td>' : '') + (sp ? '<td style="text-align:right">' + fmt(a.prix_unitaire) + '</td>' : '') + (st2 ? '<td style="text-align:right;font-weight:700;color:' + acc + '">' + fmt(a.total_ligne) + '</td>' : '') + '</tr>';
      });
    } else if (l.type === "article") {
      rows += '<tr>' + (sr ? '<td>' + (li+1) + '</td>' : '') + '<td>' + l.designation + '</td><td>' + l.quantite + '</td>' + (su ? '<td>' + l.unite + '</td>' : '') + (sp ? '<td style="text-align:right">' + fmt(l.prix_unitaire) + '</td>' : '') + (st2 ? '<td style="text-align:right;font-weight:700;color:' + acc + '">' + fmt(l.total_ligne) + '</td>' : '') + '</tr>';
    }
  });
  var le = T.logoEntreprise ? '<img src="' + T.logoEntreprise + '" style="height:52px;max-width:120px;object-fit:contain"/>' : '<div style="width:52px;height:52px;background:' + acc + ';border-radius:' + br + 'px;display:inline-flex;align-items:center;justify-content:center;font-size:22px;color:#fff">🏗</div>';
  var lc2 = T.logoClient ? '<img src="' + T.logoClient + '" style="height:40px;max-width:80px;object-fit:contain"/>' : "";
  var remRow = dv.taux_remise > 0 ? '<tr><td>Remise (' + dv.taux_remise + '%)</td><td style="text-align:right;color:#ef4444">- ' + fmt(calc.montantRemise) + '</td></tr>' : "";
  var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + dv.numero + '</title><style>body{font-family:' + fnt + ';margin:2cm;font-size:10pt;color:' + txt + ';background:' + bg + '}table{width:100%;border-collapse:collapse}th{background:' + thBg + ';color:' + thTxt + ';padding:8px}td{padding:7px 10px;border-bottom:1px solid #eee}.ttc{background:' + totBg + ';color:#fff;font-weight:800}</style></head><body><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' + le + '<div style="text-align:right"><div style="background:' + acc + ';color:#fff;padding:6px 18px;border-radius:' + br + 'px;font-weight:800;font-size:14pt">' + (T.devisTitre || "DEVIS") + '</div><div style="font-size:9pt;color:#777;margin-top:6px">N° ' + dv.numero + '<br/>' + dv.date_creation + '</div></div></div><div style="background:' + acc + '15;border-left:4px solid ' + acc + ';padding:10px 14px;margin-bottom:14px;display:flex;justify-content:space-between"><div><b>' + dv.client_nom + '</b>' + (chNom ? '<br/>🏗 ' + chNom : '') + '</div>' + lc2 + '</div><table><thead><tr>' + (sr ? '<th>#</th>' : '') + '<th>Désignation</th><th>Qté</th>' + (su ? '<th>Unité</th>' : '') + (sp ? '<th>P.U. HT</th>' : '') + (st2 ? '<th>Total HT</th>' : '') + '</tr></thead><tbody>' + rows + '</tbody></table><br><table style="width:300px;margin-left:auto"><tbody><tr><td>Sous-total HT</td><td style="text-align:right">' + fmt(calc.sousTotal) + '</td></tr>' + remRow + '<tr><td>TVA (' + dv.taux_tva + '%)</td><td style="text-align:right">' + fmt(calc.montantTVA) + '</td></tr><tr class="ttc"><td>TOTAL TTC</td><td style="text-align:right">' + fmt(calc.totalTTC) + '</td></tr></tbody></table>' + (T.devisMention ? '<div style="margin-top:16px;padding:8px 12px;background:#f5f5f5;border-radius:' + br + 'px;font-size:9pt;color:#777">' + T.devisMention + '</div>' : '') + '</body></html>';
  var w = window.open("", "_blank"); w.document.write(html); w.document.close(); setTimeout(function() { w.focus(); w.print(); }, 500);
}

// ── Atoms UI ──────────────────────────────────────────────────────────────────
function Badge({ label, color, small }) {
  return <span style={{ background: color + "22", color, border: "1px solid " + color + "55", borderRadius: 6, padding: small ? "2px 7px" : "3px 10px", fontSize: small ? 10 : 11, fontWeight: 600, whiteSpace: "nowrap" }}>{label}</span>;
}
function PBar({ p, color, h }) {
  return <div style={{ background: "#57534E", borderRadius: 99, height: h || 8, overflow: "hidden" }}><div style={{ width: Math.min(p, 100) + "%", background: color, height: "100%", borderRadius: 99, transition: "width .4s" }} /></div>;
}
function Empty({ msg, icon }) {
  return <div style={{ textAlign: "center", padding: "40px 20px", color: "#A8A29E" }}><div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div><div style={{ fontSize: 14 }}>{msg}</div></div>;
}
function Spin() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 180, flexDirection: "column", gap: 12 }}>
      <div style={{ width: 36, height: 36, border: "4px solid #57534E", borderTopColor: "#F97316", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
function Kpi({ icon, label, value, color, compact, T }) {
  return (
    <div style={{ background: T.card, border: "1px solid " + T.border, borderRadius: compact ? 10 : T.borderRadius, padding: compact ? "12px 14px" : "16px 20px", flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: compact ? 18 : 22, marginBottom: 3 }}>{icon}</div>
      <div style={{ fontSize: compact ? 15 : 20, fontWeight: 700, color: color || T.white, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
      <div style={{ fontSize: compact ? 10 : 12, color: T.muted, marginTop: 2 }}>{label}</div>
    </div>
  );
}
function Card({ title, action, children, T }) {
  return (
    <div style={{ background: T.card, border: "1px solid " + T.border, borderRadius: T.borderRadius, padding: "18px 20px" }}>
      {title && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}><div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>{action}</div>}
      {children}
    </div>
  );
}
function Modal({ title, onClose, onSave, saveLabel, wide, children, T }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000099", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: T.card, border: "1px solid " + T.border, borderRadius: "20px 20px 0 0", padding: "24px 20px", width: "100%", maxWidth: wide ? 1000 : 860, maxHeight: "96vh", overflow: "auto" }}>
        <div style={{ width: 40, height: 4, background: T.border, borderRadius: 99, margin: "0 auto 20px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 22, lineHeight: 1 }}>×</button>
        </div>
        {children}
        {onSave && (
          <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ padding: "10px 20px", background: T.mid, color: T.white, border: "none", borderRadius: 10, cursor: "pointer" }}>Annuler</button>
            <button onClick={onSave} style={{ padding: "10px 20px", background: T.primary, color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer" }}>{saveLabel || "Enregistrer"}</button>
          </div>
        )}
      </div>
    </div>
  );
}
function FF({ label, value, onChange, type, full, placeholder, rows, T }) {
  var s = { width: "100%", background: T.mid, border: "1px solid " + T.border, borderRadius: 8, padding: "10px 12px", color: T.white, fontSize: 14, boxSizing: "border-box", outline: "none" };
  return (
    <div style={full ? { gridColumn: "1/-1" } : {}}>
      <label style={{ fontSize: 11, color: T.muted, display: "block", marginBottom: 4 }}>{label}</label>
      {rows ? <textarea value={value || ""} onChange={function(e) { onChange(e.target.value); }} rows={rows} placeholder={placeholder} style={s} />
        : <input type={type || "text"} value={value || ""} onChange={function(e) { onChange(e.target.value); }} placeholder={placeholder} style={s} />}
    </div>
  );
}
function FS({ label, value, onChange, options, full, T }) {
  return (
    <div style={full ? { gridColumn: "1/-1" } : {}}>
      <label style={{ fontSize: 11, color: T.muted, display: "block", marginBottom: 4 }}>{label}</label>
      <select value={value || ""} onChange={function(e) { onChange(e.target.value); }} style={{ width: "100%", background: T.mid, border: "1px solid " + T.border, borderRadius: 8, padding: "10px 12px", color: T.white, fontSize: 14, boxSizing: "border-box", outline: "none" }}>
        {options.map(function(o) { return Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o} value={o}>{o}</option>; })}
      </select>
    </div>
  );
}
function FG({ children, cols }) { return <div style={{ display: "grid", gridTemplateColumns: "repeat(" + (cols || 2) + ",1fr)", gap: 12 }}>{children}</div>; }
function ColorRow({ label, k, T, upT }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid " + T.border }}>
      <div><div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>{T[k] && <div style={{ fontSize: 11, color: T.muted }}>{T[k]}</div>}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: T[k] || "#000", border: "2px solid " + T.border }} />
        <input type="color" value={T[k] || "#000000"} onChange={function(e) { upT(k, e.target.value); }} style={{ width: 40, height: 32, border: "none", borderRadius: 6, cursor: "pointer", padding: 2, background: "none" }} />
      </div>
    </div>
  );
}
function Toggle({ label, k, T, upT }) {
  var on = T[k] !== false;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
      <div onClick={function() { upT(k, !on); }} style={{ width: 36, height: 20, borderRadius: 10, background: on ? T.primary : T.mid, cursor: "pointer", position: "relative", transition: "background .2s", flexShrink: 0 }}>
        <div style={{ position: "absolute", top: 2, left: on ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
      </div>
      <span style={{ fontSize: 13 }}>{label}</span>
    </div>
  );
}

// ── Aperçu Devis ──────────────────────────────────────────────────────────────
function DevisApercu({ T, devis, calc }) {
  var acc = T.devisAccent || T.primary, bg = T.devisBg || "#fff", txt = T.devisText || "#222";
  var thBg = T.devisTableHead || T.primary, thTxt = T.devisTableHeadText || "#fff";
  var totBg = T.devisTotalBg || T.primary, fnt = T.devisFont || "sans-serif", br = T.devisBorderRadius || 8;
  var sr = T.showColRef !== false, su = T.showColUnite !== false, sp = T.showColPU !== false, stot = T.showColTotal !== false;
  var sample = [
    { designation: "Fondations béton", quantite: 2, unite: "m3", prix_unitaire: 85000, total_ligne: 170000 },
    { designation: "Maçonnerie parpaing", quantite: 50, unite: "m2", prix_unitaire: 12000, total_ligne: 600000 },
    { designation: "Couverture tôle", quantite: 1, unite: "forfait", prix_unitaire: 450000, total_ligne: 450000 },
  ];
  var lotsR = calc && calc.lots && calc.lots.length > 0 ? calc.lots : null;
  var st = devis ? ((calc || {}).sousTotal || 0) : 1220000;
  var tva = devis ? ((calc || {}).montantTVA || 0) : 219600;
  var ttc = devis ? ((calc || {}).totalTTC || 0) : 1439600;

  function ALine({ a, idx }) {
    return (
      <tr style={{ background: idx % 2 === 0 ? "#fff" : "#f8f8f8", borderBottom: "1px solid #eee" }}>
        {sr && <td style={{ padding: "5px 8px", color: "#999", fontSize: 10 }}>{idx + 1}</td>}
        <td style={{ padding: "5px 8px", fontSize: 10 }}>{a.designation}</td>
        <td style={{ padding: "5px 8px", textAlign: "center", fontSize: 10 }}>{a.quantite}</td>
        {su && <td style={{ padding: "5px 8px", textAlign: "center", color: "#888", fontSize: 10 }}>{a.unite}</td>}
        {sp && <td style={{ padding: "5px 8px", textAlign: "right", fontSize: 10 }}>{fmt(a.prix_unitaire)}</td>}
        {stot && <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 700, color: acc, fontSize: 10 }}>{fmt(a.total_ligne)}</td>}
      </tr>
    );
  }
  function renderRows() {
    if (!lotsR) return sample.map(function(r, i) { return <ALine key={i} a={r} idx={i} />; });
    var rows = [];
    lotsR.forEach(function(l, li) {
      if (l.type === "article") { rows.push(<ALine key={l.id} a={l} idx={li} />); return; }
      rows.push(<tr key={l.id + "h"} style={{ background: acc + "22" }}><td colSpan={6} style={{ padding: "7px 10px", fontWeight: 800, color: acc, fontSize: 10 }}>LOT {li + 1} — {l.nom} <span style={{ float: "right" }}>{fmt(l.total)}</span></td></tr>);
      (l.articles || []).forEach(function(a, ai) { rows.push(<ALine key={a.id} a={a} idx={ai} />); });
    });
    return rows;
  }
  return (
    <div style={{ background: bg, borderRadius: br, padding: 16, fontFamily: fnt, color: txt, border: "1px solid #ddd", fontSize: 11 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {T.logoEntreprise ? <img src={T.logoEntreprise} alt="" style={{ height: 48, maxWidth: 110, objectFit: "contain" }} />
            : <div style={{ width: 48, height: 48, background: acc, borderRadius: br, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#fff" }}>🏗</div>}
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: acc }}>{T.companyName}</div>
            <div style={{ fontSize: 10, color: "#777", lineHeight: 1.6 }}>{T.companyAddress}<br />{T.companyTel}</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ background: acc, color: "#fff", borderRadius: br, padding: "5px 16px", fontWeight: 800, fontSize: 13, display: "inline-block" }}>{T.devisTitre || "DEVIS"}</div>
          <div style={{ fontSize: 10, color: "#777", marginTop: 6, lineHeight: 1.7 }}>N° {devis ? devis.numero : "DEV-2025-0001"}<br />Date : {devis ? devis.date_creation : today()}</div>
        </div>
      </div>
      <div style={{ background: acc + "15", borderLeft: "4px solid " + acc, borderRadius: br, padding: "10px 14px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 9, color: "#999", fontWeight: 700, letterSpacing: 1 }}>CLIENT</div>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{devis ? devis.client_nom : "CLIENT EXEMPLE"}</div>
        </div>
        {T.logoClient && <img src={T.logoClient} alt="" style={{ height: 36, maxWidth: 80, objectFit: "contain" }} />}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, marginBottom: 10 }}>
        <thead>
          <tr style={{ background: thBg, color: thTxt }}>
            {sr && <th style={{ padding: "6px 8px", textAlign: "left" }}>#</th>}
            <th style={{ padding: "6px 8px", textAlign: "left" }}>Désignation</th>
            <th style={{ padding: "6px 8px", textAlign: "center" }}>Qté</th>
            {su && <th style={{ padding: "6px 8px", textAlign: "center" }}>Unité</th>}
            {sp && <th style={{ padding: "6px 8px", textAlign: "right" }}>P.U. HT</th>}
            {stot && <th style={{ padding: "6px 8px", textAlign: "right" }}>Total HT</th>}
          </tr>
        </thead>
        <tbody>{renderRows()}</tbody>
      </table>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <table style={{ width: 220, borderCollapse: "collapse", fontSize: 11 }}>
          <tbody>
            <tr><td style={{ padding: "5px 10px", color: "#666" }}>Sous-total HT</td><td style={{ padding: "5px 10px", textAlign: "right", fontWeight: 600 }}>{fmt(st)}</td></tr>
            {devis && devis.taux_remise > 0 && <tr><td style={{ padding: "5px 10px", color: "#ef4444" }}>Remise ({devis.taux_remise}%)</td><td style={{ padding: "5px 10px", textAlign: "right", color: "#ef4444", fontWeight: 600 }}>- {fmt((calc || {}).montantRemise || 0)}</td></tr>}
            <tr><td style={{ padding: "5px 10px", color: "#666" }}>TVA ({devis ? devis.taux_tva : 18}%)</td><td style={{ padding: "5px 10px", textAlign: "right", fontWeight: 600 }}>{fmt(tva)}</td></tr>
            <tr style={{ background: totBg, color: "#fff" }}><td style={{ padding: "8px 10px", fontWeight: 800 }}>TOTAL TTC</td><td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 800 }}>{fmt(ttc)}</td></tr>
          </tbody>
        </table>
      </div>
      {T.devisMention && <div style={{ marginTop: 10, padding: "8px 12px", background: "#f5f5f5", borderRadius: br, fontSize: 10, color: "#777" }}>{T.devisMention}</div>}
    </div>
  );
}

// ── Data hooks ────────────────────────────────────────────────────────────────
function useChantiers() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const load = useCallback(function() {
    setLoading(true); setError(null);
    Promise.all([
      q("chantiers").order("created_at", { ascending: false }).get(),
      q("depenses").order("date", { ascending: false }).get(),
    ]).then(function(res) {
      if (res[0].error) throw res[0].error;
      var ch = res[0].data || [], dep = res[1].data || [];
      setData(ch.map(function(c) {
        return Object.assign({}, c, {
          budgetInitial: Number(c.budget_initial || 0),
          depenses: dep.filter(function(d) { return d.chantier_id === c.id; }).map(function(d) { return Object.assign({}, d, { montant: Number(d.montant || 0) }); })
        });
      }));
      setLoading(false);
    }).catch(function(e) { setError(e.message || JSON.stringify(e)); setLoading(false); });
  }, []);
  useEffect(function() { load(); }, []);
  return { data, loading, error, reload: load };
}

function useInterventions() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(function() {
    setLoading(true);
    Promise.all([
      q("interventions").order("created_at", { ascending: false }).get(),
      q("intervention_depenses").get(),
    ]).then(function(res) {
      var intv = res[0].data || [], idep = res[1].data || [];
      setData(intv.map(function(i) {
        return Object.assign({}, i, {
          depenses: idep.filter(function(d) { return d.intervention_id === i.id; }).map(function(d) { return Object.assign({}, d, { montant: Number(d.montant || 0) }); })
        });
      }));
      setLoading(false);
    }).catch(function() { setLoading(false); });
  }, []);
  useEffect(function() { load(); }, []);
  return { data, loading, reload: load };
}

function useDevis() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(function() {
    setLoading(true);
    Promise.all([
      q("devis").order("created_at", { ascending: false }).get(),
      q("devis_lots").order("ordre").get(),
      q("devis_articles").order("ordre").get(),
    ]).then(function(res) {
      var dvs = res[0].data || [], lots = res[1].data || [], arts = res[2].data || [];
      setData(dvs.map(function(dv) {
        var rootLots = lots.filter(function(l) { return l.devis_id === dv.id && !l.parent_lot_id; }).map(function(l) {
          var sls = lots.filter(function(sl) { return sl.parent_lot_id === l.id; }).map(function(sl) {
            return Object.assign({}, sl, { type: "lot", articles: arts.filter(function(a) { return a.lot_id === sl.id; }) });
          });
          return Object.assign({}, l, { type: "lot", articles: arts.filter(function(a) { return a.lot_id === l.id; }), sousLots: sls });
        });
        var freeArts = arts.filter(function(a) { return a.devis_id === dv.id && !a.lot_id; }).map(function(a) { return Object.assign({}, a, { type: "article" }); });
        var allLots = rootLots.concat(freeArts).sort(function(a, b) { return (a.ordre || 0) - (b.ordre || 0); });
        return Object.assign({}, dv, { lots: allLots });
      }));
      setLoading(false);
    }).catch(function() { setLoading(false); });
  }, []);
  useEffect(function() { load(); }, []);
  return { data, loading, reload: load };
}

function useDebourse() {
  const [sessions, setSessions] = useState([]);
  const [taches, setTaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(function() {
    setLoading(true);
    Promise.all([
      q("debourse_sessions").order("created_at", { ascending: false }).get(),
      q("debourse_taches").order("ordre").get(),
    ]).then(function(res) {
      setSessions(res[0].data || []);
      setTaches(res[1].data || []);
      setLoading(false);
    }).catch(function() { setLoading(false); });
  }, []);
  useEffect(function() { load(); }, []);
  return { sessions, taches, loading, reload: load };
}

// ════════════════════════════════════════════════════════════════════════════
// APP ROOT
// ════════════════════════════════════════════════════════════════════════════
export default function App() {
  const { T, upT, resetT } = useTheme();
  const ch = useChantiers();
  const intv = useInterventions();
  const dv = useDevis();
  const db = useDebourse();
  const { isMobile, bp } = useBP();
  const [page, setPage] = useState("dashboard");
  const [selId, setSelId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  function navTo(p) { setPage(p); setDrawerOpen(false); }
  function openCh(id) { setSelId(id); setPage("fiche"); setDrawerOpen(false); }
  function reloadAll() { ch.reload(); intv.reload(); dv.reload(); db.reload(); }

  var nbAl = ch.data.filter(function(c) { var p = pct(totalDep(c), c.budgetInitial); return p > 100 || c.statut === "En derive"; }).length;
  var nbInt = intv.data.filter(function(i) { return i.statut === "En cours"; }).length;

  var nav = [
    { key: "dashboard", icon: "📊", label: "Dashboard" },
    { key: "chantiers", icon: "🏗️", label: "Chantiers" },
    { key: "devis", icon: "📄", label: "Devis" },
    { key: "debourse", icon: "🔢", label: "Débours Sec" },
    { key: "interventions", icon: "🔧", label: "Interventions", badge: nbInt },
    { key: "alertes", icon: "🔔", label: "Alertes", badge: nbAl },
    { key: "kpi", icon: "📈", label: "KPIs" },
    { key: "ia", icon: "🤖", label: "IA" },
    { key: "gestion", icon: "⚙️", label: "Gestion" },
    { key: "parametres", icon: "🎨", label: "Apparence" },
  ];

  function NavBtn({ n }) {
    var active = page === n.key || (page === "fiche" && n.key === "chantiers");
    return (
      <button onClick={function() { navTo(n.key); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: bp === "md" ? 0 : 10, padding: "10px", borderRadius: 8, border: "none", background: active ? T.primary + "22" : "transparent", color: active ? T.primary : T.muted, cursor: "pointer", marginBottom: 2, justifyContent: bp === "md" ? "center" : "flex-start", position: "relative", fontFamily: T.fontFamily }}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>{n.icon}</span>
        {bp !== "md" && <span style={{ fontSize: 13, fontWeight: active ? 700 : 400, flex: 1 }}>{n.label}</span>}
        {n.badge > 0 && <span style={{ position: "absolute", top: 4, right: 4, background: T.danger, color: "#fff", borderRadius: 99, fontSize: 9, padding: "1px 5px", fontWeight: 700 }}>{n.badge}</span>}
      </button>
    );
  }

  var selected = ch.data.find(function(c) { return c.id === selId; });
  var isLoading = ch.loading || dv.loading;

  return (
    <div style={{ display: "flex", height: "100vh", background: T.bg, color: T.white, fontFamily: T.fontFamily, overflow: "hidden" }}>
      <style>{`*{box-sizing:border-box;}input,select,textarea{font-size:16px!important;}`}</style>

      {/* Sidebar desktop */}
      {!isMobile && (
        <div style={{ width: bp === "md" ? 60 : T.sidebarWidth, background: T.card, borderRight: "1px solid " + T.border, display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ padding: "18px 12px 16px", borderBottom: "1px solid " + T.border, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ background: T.primary, borderRadius: 10, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🏗</div>
            {bp !== "md" && <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.3 }}>{T.companyName}</div>}
          </div>
          <nav style={{ flex: 1, padding: "10px 8px", overflowY: "auto" }}>
            {nav.map(function(n) { return <NavBtn key={n.key} n={n} />; })}
          </nav>
          {bp !== "md" && (
            <div style={{ padding: 8, borderTop: "1px solid " + T.border }}>
              <button onClick={reloadAll} style={{ width: "100%", background: T.secondary + "22", border: "1px solid " + T.secondary + "44", color: T.secondary, borderRadius: 8, padding: 8, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>↺ Sync</button>
            </div>
          )}
        </div>
      )}

      {/* Main */}
      <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", paddingBottom: isMobile ? 68 : 0 }}>
        {/* Topbar */}
        <div style={{ background: T.card, borderBottom: "1px solid " + T.border, padding: isMobile ? "12px 16px" : "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, position: "sticky", top: 0, zIndex: 50 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {isMobile && <button onClick={function() { setDrawerOpen(true); }} style={{ background: "none", border: "none", color: T.muted, fontSize: 22, cursor: "pointer" }}>☰</button>}
            <div style={{ fontSize: isMobile ? 14 : 16, fontWeight: 700 }}>
              {page === "fiche" && selected ? "🏗️ " + selected.nom : (nav.find(function(n) { return n.key === page; }) || { icon: "", label: "" }).icon + " " + (nav.find(function(n) { return n.key === page; }) || { label: "" }).label}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {isLoading && <div style={{ width: 18, height: 18, border: "3px solid " + T.border, borderTopColor: T.primary, borderRadius: "50%", animation: "spin 1s linear infinite" }} />}
            <button onClick={reloadAll} style={{ background: T.secondary + "22", border: "1px solid " + T.secondary + "44", color: T.secondary, borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>↺</button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: isMobile ? "12px" : "24px" }}>
          {ch.error ? (
            <div style={{ background: T.danger + "11", border: "1px solid " + T.danger + "44", borderRadius: 12, padding: 24, textAlign: "center" }}>
              <div style={{ color: T.danger, fontWeight: 700, marginBottom: 8 }}>Erreur Supabase</div>
              <div style={{ color: T.muted, fontSize: 13, marginBottom: 16 }}>{ch.error}</div>
              <button onClick={reloadAll} style={{ background: T.primary, color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontWeight: 700, cursor: "pointer" }}>Réessayer</button>
            </div>
          ) : (
            <>
              {page === "dashboard"     && <Dashboard ch={ch.data} intv={intv.data} dv={dv.data} openCh={openCh} T={T} />}
              {page === "chantiers"     && <Chantiers ch={ch.data} openCh={openCh} reload={ch.reload} T={T} />}
              {page === "fiche" && selected && <Fiche chantier={selected} setPage={setPage} reload={ch.reload} T={T} />}
              {page === "devis"         && <Devis dv={dv.data} ch={ch.data} reload={dv.reload} T={T} upT={upT} />}
              {page === "debourse"      && <Debourse sessions={db.sessions} taches={db.taches} ch={ch.data} reload={db.reload} T={T} />}
              {page === "interventions" && <Interventions intv={intv.data} ch={ch.data} reload={intv.reload} T={T} />}
              {page === "alertes"       && <Alertes ch={ch.data} openCh={openCh} T={T} />}
              {page === "kpi"           && <KpiPage ch={ch.data} dv={dv.data} intv={intv.data} T={T} />}
              {page === "ia"            && <IA ch={ch.data} intv={intv.data} dv={dv.data} T={T} />}
              {page === "gestion"       && <Gestion ch={ch.data} openCh={openCh} reload={ch.reload} T={T} />}
              {page === "parametres"    && <Parametres T={T} upT={upT} resetT={resetT} />}
            </>
          )}
        </div>
      </div>

      {/* Mobile bottom bar */}
      {isMobile && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: T.card, borderTop: "1px solid " + T.border, display: "flex", justifyContent: "space-around", padding: "6px 0", zIndex: 100 }}>
          {nav.slice(0, 5).map(function(n) {
            var active = page === n.key;
            return (
              <button key={n.key} onClick={function() { navTo(n.key); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "none", border: "none", color: active ? T.primary : T.muted, cursor: "pointer", padding: "4px 6px", position: "relative", minWidth: 44 }}>
                <span style={{ fontSize: 20 }}>{n.icon}</span>
                <span style={{ fontSize: 9, fontWeight: active ? 700 : 400 }}>{n.label}</span>
                {n.badge > 0 && <span style={{ position: "absolute", top: 0, right: 2, background: T.danger, color: "#fff", borderRadius: 99, fontSize: 9, padding: "1px 5px", fontWeight: 700 }}>{n.badge}</span>}
              </button>
            );
          })}
          <button onClick={function() { setDrawerOpen(true); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "none", border: "none", color: T.muted, cursor: "pointer", padding: "4px 6px", minWidth: 44 }}>
            <span style={{ fontSize: 20 }}>☰</span><span style={{ fontSize: 9 }}>Plus</span>
          </button>
        </div>
      )}

      {/* Mobile drawer */}
      {isMobile && drawerOpen && (
        <>
          <div onClick={function() { setDrawerOpen(false); }} style={{ position: "fixed", inset: 0, background: "#0007", zIndex: 150 }} />
          <div style={{ position: "fixed", left: 0, top: 0, bottom: 0, width: 280, background: T.card, borderRight: "1px solid " + T.border, zIndex: 151, padding: "50px 12px 12px", overflowY: "auto" }}>
            <button onClick={function() { setDrawerOpen(false); }} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", color: T.muted, fontSize: 22, cursor: "pointer" }}>×</button>
            <div style={{ padding: "0 8px 16px", marginBottom: 8, borderBottom: "1px solid " + T.border }}><div style={{ fontWeight: 700, fontSize: 16 }}>{T.companyName}</div></div>
            {nav.map(function(n) { return <NavBtn key={n.key} n={n} />; })}
          </div>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════════════════════════
function Dashboard({ ch, intv, dv, openCh, T }) {
  const { isMobile } = useBP();
  var totalB = ch.reduce(function(a, c) { return a + c.budgetInitial; }, 0);
  var totalD = ch.reduce(function(a, c) { return a + totalDep(c); }, 0);
  var totalCA = dv.filter(function(d) { return d.statut === "accepte"; }).reduce(function(a, d) { return a + (d.total_ttc || 0); }, 0);
  var pc = pct(totalD, totalB);
  var pieData = [
    { name: "En cours", value: ch.filter(function(c) { return c.statut === "En cours"; }).length, color: T.secondary },
    { name: "En dérive", value: ch.filter(function(c) { return c.statut === "En derive"; }).length, color: T.danger },
    { name: "Planifié", value: ch.filter(function(c) { return c.statut === "Planifie"; }).length, color: T.warning },
    { name: "Clôturé", value: ch.filter(function(c) { return c.statut === "Cloture"; }).length, color: T.success },
  ].filter(function(d) { return d.value > 0; });
  var actifs = ch.filter(function(c) { return c.statut !== "Cloture" && c.statut !== "Brouillon"; });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5,1fr)", gap: 10 }}>
        <Kpi icon="🏗️" label="Chantiers" value={ch.length} color={T.primary} compact={isMobile} T={T} />
        <Kpi icon="💰" label="Budget total" value={fmtS(totalB)} compact={isMobile} T={T} />
        <Kpi icon="📊" label="Consommé" value={pc + "%"} color={pc > 80 ? T.danger : T.success} compact={isMobile} T={T} />
        <Kpi icon="📄" label="CA devis" value={fmtS(totalCA)} color={T.success} compact={isMobile} T={T} />
        <Kpi icon="🔧" label="Interventions" value={intv.filter(function(i) { return i.statut === "En cours"; }).length} color={T.secondary} compact={isMobile} T={T} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
        <Card title="Statuts chantiers" T={T}>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={65} label={function(e) { return e.name + " (" + e.value + ")"; }}>
                  {pieData.map(function(d, i) { return <Cell key={i} fill={d.color} />; })}
                </Pie>
                <Tooltip contentStyle={{ background: T.card, border: "1px solid " + T.border, color: T.white }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <Empty msg="Aucun chantier" icon="🏗️" />}
        </Card>
        <Card title="Chantiers actifs" T={T}>
          {actifs.slice(0, 6).map(function(c) {
            var d = totalDep(c), p = pct(d, c.budgetInitial);
            return (
              <div key={c.id} onClick={function() { openCh(c.id); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid " + T.border, cursor: "pointer" }}>
                <div style={{ flex: 2 }}><div style={{ fontWeight: 600, fontSize: 13 }}>{c.nom}</div><div style={{ fontSize: 11, color: T.muted }}>{c.client}</div></div>
                <div style={{ flex: 1 }}><PBar p={p} color={p > 100 ? T.danger : p > 80 ? T.warning : T.success} h={6} /><div style={{ fontSize: 10, color: T.muted, textAlign: "right", marginTop: 2 }}>{p}%</div></div>
              </div>
            );
          })}
          {actifs.length === 0 && <Empty msg="Aucun chantier actif" icon="🏗️" />}
        </Card>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// CHANTIERS
// ════════════════════════════════════════════════════════════════════════════
function Chantiers({ ch, openCh, reload, T }) {
  const { isMobile } = useBP();
  const [filter, setFilter] = useState("Tous");
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nom: "", client: "", localisation: "", type: "Construction", budget_initial: "", date_debut: "", date_fin: "" });
  function up(k, v) { setForm(function(p) { return Object.assign({}, p, { [k]: v }); }); }

  function save() {
    if (!form.nom || !form.budget_initial) return;
    setSaving(true);
    q("chantiers").insert({ nom: form.nom, client: form.client, localisation: form.localisation, type: form.type, budget_initial: parseFloat(form.budget_initial), date_debut: form.date_debut || null, date_fin: form.date_fin || null, statut: "Brouillon", alertes: [], score: 100, lat: 5.35, lng: -4.0 }).then(function() {
      setSaving(false); setShowNew(false); setForm({ nom: "", client: "", localisation: "", type: "Construction", budget_initial: "", date_debut: "", date_fin: "" }); reload();
    });
  }
  function del(id) { if (!window.confirm("Supprimer ?")) return; q("chantiers").eq("id", id).del().then(function() { reload(); }); }

  var filtered = filter === "Tous" ? ch : ch.filter(function(c) { return c.statut === filter; });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 6, justifyContent: "space-between", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 4, overflowX: "auto", flexWrap: "nowrap" }}>
          {["Tous"].concat(STATUTS_CH).map(function(s) {
            return <button key={s} onClick={function() { setFilter(s); }} style={{ padding: "6px 12px", borderRadius: 20, border: "1px solid " + (filter === s ? T.primary : T.border), background: filter === s ? T.primary : "transparent", color: filter === s ? "#fff" : T.muted, cursor: "pointer", fontSize: 12, fontWeight: filter === s ? 700 : 400, whiteSpace: "nowrap", flexShrink: 0 }}>{s}</button>;
          })}
        </div>
        <button onClick={function() { setShowNew(true); }} style={{ background: T.primary, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 700, cursor: "pointer", fontSize: 13, flexShrink: 0 }}>+ Nouveau</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill,minmax(320px,1fr))", gap: 14 }}>
        {filtered.map(function(c) {
          var d = totalDep(c), p = pct(d, c.budgetInitial);
          return (
            <div key={c.id} onClick={function() { openCh(c.id); }} style={{ background: T.card, border: "1px solid " + (p > 100 ? T.danger + "66" : T.border), borderRadius: T.borderRadius, padding: 16, cursor: "pointer", position: "relative" }}>
              <button onClick={function(e) { e.stopPropagation(); del(c.id); }} style={{ position: "absolute", top: 12, right: 12, background: T.danger + "22", border: "1px solid " + T.danger + "44", color: T.danger, borderRadius: 6, padding: "3px 10px", fontSize: 11, cursor: "pointer" }}>✕</button>
              <div style={{ marginBottom: 10, paddingRight: 60 }}><div style={{ fontWeight: 700, fontSize: 15 }}>{c.nom}</div><div style={{ fontSize: 12, color: T.muted }}>{c.client} — {c.localisation}</div></div>
              <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}><Badge label={c.statut} color={stC(c.statut, T)} /><Badge label={c.type} color={T.primary} small /></div>
              <div style={{ marginBottom: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}><span style={{ color: T.muted }}>Budget consommé</span><span style={{ fontWeight: 700, color: p > 100 ? T.danger : p > 80 ? T.warning : T.success }}>{p}%</span></div>
                <PBar p={p} color={p > 100 ? T.danger : p > 80 ? T.warning : T.success} />
              </div>
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid " + T.border, fontSize: 12, color: T.muted }}>{fmtS(d)} / {fmtS(c.budgetInitial)} XOF</div>
            </div>
          );
        })}
      </div>
      {filtered.length === 0 && <Empty msg="Aucun chantier" icon="🏗️" />}
      {showNew && (
        <Modal title="Nouveau chantier" onClose={function() { setShowNew(false); }} onSave={save} T={T}>
          {saving ? <Spin /> : (
            <FG cols={2}>
              <FF label="Nom *" value={form.nom} onChange={function(v) { up("nom", v); }} full T={T} />
              <FF label="Client" value={form.client} onChange={function(v) { up("client", v); }} T={T} />
              <FS label="Type" value={form.type} onChange={function(v) { up("type", v); }} options={["Construction", "Rehabilitation", "Maintenance", "VRD", "Génie Civil"]} T={T} />
              <FF label="Localisation" value={form.localisation} onChange={function(v) { up("localisation", v); }} T={T} />
              <FF label="Budget (XOF) *" type="number" value={form.budget_initial} onChange={function(v) { up("budget_initial", v); }} full T={T} />
              <FF label="Date début" type="date" value={form.date_debut} onChange={function(v) { up("date_debut", v); }} T={T} />
              <FF label="Date fin prévue" type="date" value={form.date_fin} onChange={function(v) { up("date_fin", v); }} T={T} />
            </FG>
          )}
        </Modal>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// FICHE CHANTIER
// ════════════════════════════════════════════════════════════════════════════
function Fiche({ chantier: c, setPage, reload, T }) {
  const { isMobile } = useBP();
  const [tab, setTab] = useState("infos");
  const [showDep, setShowDep] = useState(false);
  const [fDep, setFDep] = useState({ libelle: "", categorie: "Main d'oeuvre", montant: "", date: today(), note: "" });
  const [fCat, setFCat] = useState("Toutes");
  const [saving, setSaving] = useState(false);

  var dep = totalDep(c), dp = pct(dep, c.budgetInitial);
  var filtered = fCat === "Toutes" ? c.depenses : c.depenses.filter(function(d) { return d.categorie === fCat; });

  function changeSt(st) { q("chantiers").eq("id", c.id).update({ statut: st }).then(function() { reload(); }); }
  function addDep() {
    if (!fDep.libelle || !fDep.montant) return;
    setSaving(true);
    q("depenses").insert({ chantier_id: c.id, libelle: fDep.libelle, categorie: fDep.categorie, montant: parseFloat(fDep.montant), date: fDep.date, note: fDep.note }).then(function() {
      setSaving(false); setShowDep(false); setFDep({ libelle: "", categorie: "Main d'oeuvre", montant: "", date: today(), note: "" }); reload();
    });
  }
  function delDep(id) { q("depenses").eq("id", id).del().then(function() { reload(); }); }

  // Graphique dépenses par catégorie
  var depCatData = CATS.map(function(cat) {
    return { cat: cat.split(" ")[0], total: c.depenses.filter(function(d) { return d.categorie === cat; }).reduce(function(a, d) { return a + d.montant; }, 0) };
  }).filter(function(x) { return x.total > 0; });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <button onClick={function() { setPage("chantiers"); }} style={{ background: "none", border: "none", color: T.primary, cursor: "pointer", fontSize: 13, marginBottom: 12, textAlign: "left", padding: 0 }}>← Retour aux chantiers</button>
      <div style={{ background: T.card, border: "1px solid " + T.border, borderRadius: T.borderRadius, padding: isMobile ? 16 : 20, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1 }}><div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800 }}>{c.nom}</div><div style={{ color: T.muted, fontSize: 12, marginTop: 4 }}>{c.client} — {c.localisation}</div></div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {STATUTS_CH.map(function(st) {
              return <button key={st} onClick={function() { changeSt(st); }} style={{ padding: "5px 10px", borderRadius: 20, border: "1px solid " + (c.statut === st ? stC(st, T) : T.border), background: c.statut === st ? stC(st, T) + "22" : "transparent", color: c.statut === st ? stC(st, T) : T.muted, cursor: "pointer", fontSize: 10, fontWeight: c.statut === st ? 700 : 400 }}>{st}</button>;
            })}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}><Badge label={c.statut} color={stC(c.statut, T)} /><Badge label={c.type} color={T.primary} small /></div>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 16, overflowX: "auto" }}>
        {[["infos", "Infos"], ["budget", "Budget"], ["depenses", "Dépenses (" + c.depenses.length + ")"], ["graphiques", "Graphiques"]].map(function(o) {
          return <button key={o[0]} onClick={function() { setTab(o[0]); }} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid " + (tab === o[0] ? T.primary : T.border), background: tab === o[0] ? T.primary : T.card, color: tab === o[0] ? "#fff" : T.muted, cursor: "pointer", fontSize: 12, fontWeight: tab === o[0] ? 700 : 400, whiteSpace: "nowrap", flexShrink: 0 }}>{o[1]}</button>;
        })}
      </div>

      {tab === "infos" && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
          <Card title="Informations" T={T}>
            {[["Nom", c.nom], ["Client", c.client], ["Localisation", c.localisation], ["Type", c.type], ["Statut", c.statut], ["Début", c.date_debut || "—"], ["Fin prévue", c.date_fin || "—"]].map(function(row) {
              return <div key={row[0]} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid " + T.border, fontSize: 13, gap: 8 }}><span style={{ color: T.muted }}>{row[0]}</span><span style={{ fontWeight: 600 }}>{row[1]}</span></div>;
            })}
          </Card>
          <Card title="Synthèse budgétaire" T={T}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}><span style={{ color: T.muted }}>Avancement budget</span><strong style={{ color: dp > 100 ? T.danger : dp > 80 ? T.warning : T.success }}>{dp}%</strong></div>
              <PBar p={dp} color={dp > 100 ? T.danger : dp > 80 ? T.warning : T.success} h={14} />
            </div>
            {[["Budget initial", fmt(c.budgetInitial), T.white], ["Dépenses", fmt(dep), T.warning], ["Marge restante", fmt(c.budgetInitial - dep), c.budgetInitial - dep >= 0 ? T.success : T.danger]].map(function(row) {
              return <div key={row[0]} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid " + T.border, fontSize: 13 }}><span style={{ color: T.muted }}>{row[0]}</span><span style={{ fontWeight: 700, color: row[2] }}>{row[1]}</span></div>;
            })}
          </Card>
        </div>
      )}

      {tab === "budget" && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 10 }}>
          <Kpi icon="💰" label="Budget" value={fmtS(c.budgetInitial)} compact T={T} />
          <Kpi icon="🧾" label="Dépenses" value={fmtS(dep)} color={T.warning} compact T={T} />
          <Kpi icon="💵" label="Marge" value={fmtS(c.budgetInitial - dep)} color={c.budgetInitial - dep >= 0 ? T.success : T.danger} compact T={T} />
          <Kpi icon="📊" label="Consommé" value={dp + "%"} color={dp > 100 ? T.danger : dp > 80 ? T.warning : T.success} compact T={T} />
        </div>
      )}

      {tab === "depenses" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 6, justifyContent: "space-between", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 4, overflowX: "auto" }}>
              {["Toutes"].concat(CATS).map(function(cat) {
                return <button key={cat} onClick={function() { setFCat(cat); }} style={{ padding: "5px 10px", borderRadius: 20, border: "1px solid " + (fCat === cat ? T.primary : T.border), background: fCat === cat ? T.primary : "transparent", color: fCat === cat ? "#fff" : T.muted, cursor: "pointer", fontSize: 10, whiteSpace: "nowrap", flexShrink: 0 }}>{cat}</button>;
              })}
            </div>
            <button onClick={function() { setShowDep(true); }} style={{ background: T.primary, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>+ Dépense</button>
          </div>
          {filtered.length === 0 && <Empty msg="Aucune dépense" icon="🧾" />}
          {filtered.map(function(d) {
            return (
              <div key={d.id} style={{ background: T.card, border: "1px solid " + T.border, borderRadius: 10, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 13 }}>{d.libelle}</div><div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}><Badge label={d.categorie} color={catC(d.categorie, T)} small /><span style={{ fontSize: 10, color: T.muted }}>{d.date}</span>{d.note && <span style={{ fontSize: 10, color: T.muted }}>— {d.note}</span>}</div></div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}><span style={{ fontWeight: 800, color: T.primary, fontSize: 14 }}>{fmt(d.montant)}</span><button onClick={function() { delDep(d.id); }} style={{ background: T.danger + "22", border: "1px solid " + T.danger + "44", color: T.danger, borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>✕</button></div>
              </div>
            );
          })}
          {showDep && (
            <Modal title="Nouvelle dépense" onClose={function() { setShowDep(false); }} onSave={addDep} T={T}>
              {saving ? <Spin /> : (
                <FG cols={2}>
                  <FF label="Libellé *" value={fDep.libelle} onChange={function(v) { setFDep(function(p) { return Object.assign({}, p, { libelle: v }); }); }} full T={T} />
                  <FS label="Catégorie" value={fDep.categorie} onChange={function(v) { setFDep(function(p) { return Object.assign({}, p, { categorie: v }); }); }} options={CATS} T={T} />
                  <FF label="Montant (XOF)" type="number" value={fDep.montant} onChange={function(v) { setFDep(function(p) { return Object.assign({}, p, { montant: v }); }); }} T={T} />
                  <FF label="Date" type="date" value={fDep.date} onChange={function(v) { setFDep(function(p) { return Object.assign({}, p, { date: v }); }); }} T={T} />
                  <FF label="Note" value={fDep.note} onChange={function(v) { setFDep(function(p) { return Object.assign({}, p, { note: v }); }); }} full T={T} />
                </FG>
              )}
            </Modal>
          )}
        </div>
      )}

      {tab === "graphiques" && depCatData.length > 0 && (
        <Card title="Répartition des dépenses" T={T}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={depCatData} layout="vertical" margin={{ left: 0, right: 10 }}>
              <XAxis type="number" tick={{ fill: T.muted, fontSize: 9 }} tickFormatter={function(v) { return fmtS(v); }} />
              <YAxis type="category" dataKey="cat" tick={{ fill: T.muted, fontSize: 10 }} width={70} />
              <Tooltip contentStyle={{ background: T.card, border: "1px solid " + T.border, color: T.white }} formatter={function(v) { return fmt(v); }} />
              <Bar dataKey="total" radius={[0, 4, 4, 0]}>{depCatData.map(function(d, i) { return <Cell key={i} fill={catC(d.cat, T)} />; })}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// DEVIS
// ════════════════════════════════════════════════════════════════════════════
function Devis({ dv, ch, reload, T, upT }) {
  const { isMobile } = useBP();
  const [tab, setTab] = useState("liste");
  const [editDv, setEditDv] = useState(null);
  const [filterSt, setFilterSt] = useState("Tous");
  const [saving, setSaving] = useState(false);

  var SDC = { brouillon: T.muted, envoye: T.secondary, accepte: T.success, refuse: T.danger };
  var filtered = filterSt === "Tous" ? dv : dv.filter(function(d) { return d.statut === filterSt; });
  var totalCA = dv.filter(function(d) { return d.statut === "accepte"; }).reduce(function(a, d) { return a + (d.total_ttc || 0); }, 0);
  var txConv = dv.length > 0 ? Math.round(dv.filter(function(d) { return d.statut === "accepte"; }).length / dv.length * 100) : 0;

  function tabS(k) { return { padding: "8px 16px", borderRadius: 8, border: "1px solid " + (tab === k ? T.primary : T.border), background: tab === k ? T.primary : T.card, color: tab === k ? "#fff" : T.muted, cursor: "pointer", fontSize: 13, fontWeight: tab === k ? 700 : 400 }; }

  async function saveDv(form, calc) {
    setSaving(true);
    try {
      var dvData = { numero: form.numero, statut: form.statut, chantier_id: form.chantier_id || null, client_nom: form.client_nom, client_adresse: form.client_adresse, client_telephone: form.client_telephone, client_email: form.client_email, date_creation: form.date_creation, date_validite: form.date_validite, taux_tva: form.taux_tva, taux_remise: form.taux_remise, sous_total: calc.sousTotal, montant_remise: calc.montantRemise, montant_tva: calc.montantTVA, total_ttc: calc.totalTTC, conditions_paiement: form.conditions_paiement, notes: form.notes };
      var dvId;
      if (editDv) {
        await q("devis").eq("id", editDv.id).update(dvData);
        dvId = editDv.id;
        await q("devis_lots").eq("devis_id", dvId).del();
        await q("devis_articles").eq("devis_id", dvId).del();
      } else {
        var r = await q("devis").insert(dvData);
        dvId = r.data.id;
      }
      // Insérer lots et articles
      for (var i = 0; i < (form.lots || []).length; i++) {
        var l = form.lots[i];
        if (l.type === "article") {
          await q("devis_articles").insert({ devis_id: dvId, lot_id: null, ordre: i, designation: l.designation, quantite: l.quantite, unite: l.unite, prix_unitaire: l.prix_unitaire, total_ligne: Math.round((l.quantite || 0) * (l.prix_unitaire || 0)) });
        } else {
          var lr = await q("devis_lots").insert({ devis_id: dvId, parent_lot_id: null, ordre: i, nom: l.nom, total: l.total || 0 });
          var lotId = lr.data.id;
          for (var j = 0; j < (l.articles || []).length; j++) {
            var a = l.articles[j];
            await q("devis_articles").insert({ devis_id: dvId, lot_id: lotId, ordre: j, designation: a.designation, quantite: a.quantite, unite: a.unite, prix_unitaire: a.prix_unitaire, total_ligne: Math.round((a.quantite || 0) * (a.prix_unitaire || 0)) });
          }
        }
      }
      setSaving(false); setTab("liste"); setEditDv(null); reload();
    } catch(e) { console.error(e); setSaving(false); }
  }

  function delDv(id) { if (!window.confirm("Supprimer ?")) return; q("devis_articles").eq("devis_id", id).del().then(function() { q("devis_lots").eq("devis_id", id).del().then(function() { q("devis").eq("id", id).del().then(function() { reload(); }); }); }); }
  function changeSt(id, s) { q("devis").eq("id", id).update({ statut: s }).then(function() { reload(); }); }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={function() { setTab("liste"); }} style={tabS("liste")}>📋 Liste</button>
          <button onClick={function() { setEditDv(null); setTab("form"); }} style={tabS("form")}>+ Nouveau</button>
          <button onClick={function() { setTab("style"); }} style={tabS("style")}>🖋 Style</button>
        </div>
        {tab === "liste" && (
          <div style={{ display: "flex", gap: 4, overflowX: "auto" }}>
            {["Tous"].concat(STATUTS_DEV).map(function(s) {
              return <button key={s} onClick={function() { setFilterSt(s); }} style={{ padding: "5px 12px", borderRadius: 20, border: "1px solid " + (filterSt === s ? T.primary : T.border), background: filterSt === s ? T.primary : "transparent", color: filterSt === s ? "#fff" : T.muted, cursor: "pointer", fontSize: 11, whiteSpace: "nowrap", flexShrink: 0 }}>{s}</button>;
            })}
          </div>
        )}
      </div>

      {tab === "liste" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 10 }}>
            <Kpi icon="📄" label="Total" value={dv.length} color={T.primary} compact={isMobile} T={T} />
            <Kpi icon="✅" label="Acceptés" value={dv.filter(function(d) { return d.statut === "accepte"; }).length} color={T.success} compact={isMobile} T={T} />
            <Kpi icon="💰" label="CA accepté" value={fmtS(totalCA)} color={T.success} compact={isMobile} T={T} />
            <Kpi icon="📊" label="Taux conv." value={txConv + "%"} color={txConv > 50 ? T.success : txConv > 25 ? T.warning : T.danger} compact={isMobile} T={T} />
          </div>
          {filtered.length === 0 && <Empty msg="Aucun devis — cliquez + Nouveau" icon="📄" />}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill,minmax(360px,1fr))", gap: 14 }}>
            {filtered.map(function(d) {
              var chNom = (ch.find(function(c) { return c.id === d.chantier_id; }) || {}).nom;
              var c2 = calcDevis(d.lots || [], d.taux_tva || 18, d.taux_remise || 0);
              return (
                <div key={d.id} style={{ background: T.card, border: "1px solid " + T.border, borderRadius: T.borderRadius, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div><div style={{ fontWeight: 800, fontSize: 15, color: T.primary }}>{d.numero}</div><div style={{ fontWeight: 600, fontSize: 14, marginTop: 2 }}>{d.client_nom}</div><div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{d.date_creation} → {d.date_validite}{chNom ? " · 🏗 " + chNom : ""}</div></div>
                    <Badge label={d.statut} color={SDC[d.statut] || T.muted} />
                  </div>
                  <div style={{ background: T.mid, borderRadius: 8, padding: "10px 14px" }}>
                    <div style={{ fontSize: 10, color: T.muted }}>TOTAL TTC</div>
                    <div style={{ fontWeight: 800, fontSize: 20, color: T.primary }}>{fmt(d.total_ttc)}</div>
                    <div style={{ fontSize: 10, color: T.muted }}>HT : {fmt(d.sous_total)} — TVA {d.taux_tva}%{d.taux_remise > 0 ? " — Remise " + d.taux_remise + "%" : ""}</div>
                  </div>
                  <details>
                    <summary style={{ fontSize: 11, fontWeight: 600, color: T.primary, cursor: "pointer", marginBottom: 6 }}>👁 Aperçu visuel</summary>
                    <DevisApercu T={T} devis={d} calc={c2} />
                  </details>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {STATUTS_DEV.map(function(s) {
                      return <button key={s} onClick={function() { changeSt(d.id, s); }} style={{ padding: "4px 10px", borderRadius: 20, border: "1px solid " + (d.statut === s ? (SDC[s] || T.primary) : T.border), background: d.statut === s ? (SDC[s] || T.primary) + "22" : "transparent", color: d.statut === s ? (SDC[s] || T.primary) : T.muted, cursor: "pointer", fontSize: 10 }}>{s}</button>;
                    })}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={function() { exportPDF(d, c2, chNom, T); }} style={{ flex: 1, background: T.secondary + "22", color: T.secondary, border: "1px solid " + T.secondary + "44", borderRadius: 8, padding: "7px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>📥 PDF</button>
                    <button onClick={function() { setEditDv(d); setTab("form"); }} style={{ background: T.warning + "22", color: T.warning, border: "1px solid " + T.warning + "44", borderRadius: 8, padding: "7px 10px", fontSize: 12, cursor: "pointer" }}>✏️</button>
                    <button onClick={function() { delDv(d.id); }} style={{ background: T.danger + "22", color: T.danger, border: "1px solid " + T.danger + "44", borderRadius: 8, padding: "7px 10px", fontSize: 12, cursor: "pointer" }}>✕</button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      {tab === "form" && <DevisForm ch={ch} editDv={editDv} onSave={saveDv} onClose={function() { setTab("liste"); setEditDv(null); }} saving={saving} T={T} />}
      {tab === "style" && <StylePanel T={T} upT={upT} />}
    </div>
  );
}

// ── Devis Form ────────────────────────────────────────────────────────────────
function DevisForm({ ch, editDv, onSave, onClose, saving, T }) {
  const { isMobile } = useBP();
  function nA() { return { id: uid(), designation: "", quantite: 1, unite: "U", prix_unitaire: 0 }; }
  function nL() { return { id: uid(), type: "lot", nom: "", articles: [nA()], sousLots: [] }; }
  var initLots = editDv && editDv.lots ? editDv.lots : [Object.assign(nL(), { nom: "Lot 1 — Gros oeuvre" })];
  var init = editDv ? editDv : { id: uid(), numero: genNum(), statut: "brouillon", client_nom: "", client_adresse: "", client_telephone: "", client_email: "", chantier_id: "", date_creation: today(), date_validite: addDays(today(), 30), taux_tva: 18, taux_remise: 0, conditions_paiement: "30% à la commande, 40% à mi-chantier, 30% à réception.", notes: "", lots: initLots };
  const [form, setForm] = useState(init);
  function up(k, v) { setForm(function(p) { return Object.assign({}, p, { [k]: v }); }); }
  function upLots(fn) { setForm(function(p) { return Object.assign({}, p, { lots: fn(p.lots) }); }); }
  function addLot() { upLots(function(ls) { return ls.concat([Object.assign(nL(), { nom: "Lot " + (ls.filter(function(l) { return l.type === "lot"; }).length + 1) })]); }); }
  function addFreeArt() { upLots(function(ls) { return ls.concat([Object.assign({ type: "article" }, nA())]); }); }
  function delLot(id) { upLots(function(ls) { return ls.filter(function(l) { return l.id !== id; }); }); }
  function upLot(id, k, v) { upLots(function(ls) { return ls.map(function(l) { return l.id === id ? Object.assign({}, l, { [k]: v }) : l; }); }); }
  function addArt(lid) { upLots(function(ls) { return ls.map(function(l) { return l.id === lid ? Object.assign({}, l, { articles: (l.articles || []).concat([nA()]) }) : l; }); }); }
  function delArt(lid, aid) { upLots(function(ls) { return ls.map(function(l) { return l.id === lid ? Object.assign({}, l, { articles: (l.articles || []).filter(function(a) { return a.id !== aid; }) }) : l; }); }); }
  function upArt(lid, aid, k, v) { upLots(function(ls) { return ls.map(function(l) { return l.id === lid ? Object.assign({}, l, { articles: (l.articles || []).map(function(a) { return a.id === aid ? Object.assign({}, a, { [k]: v }) : a; }) }) : l; }); }); }
  function upFree(id, k, v) { upLots(function(ls) { return ls.map(function(l) { return l.id === id && l.type === "article" ? Object.assign({}, l, { [k]: v }) : l; }); }); }

  var calc = calcDevis(form.lots, form.taux_tva, form.taux_remise);
  var iS = { background: T.bg, border: "1px solid " + T.border, borderRadius: 7, padding: "7px 10px", color: T.white, fontSize: 13, outline: "none" };

  function ArtRow({ a, onUp, onDel }) {
    return (
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6, flexWrap: isMobile ? "wrap" : "nowrap" }}>
        <input value={a.designation} onChange={function(e) { onUp("designation", e.target.value); }} placeholder="Désignation..." style={Object.assign({}, iS, { flex: 2, minWidth: isMobile ? "100%" : 0 })} />
        <input type="number" value={a.quantite} onChange={function(e) { onUp("quantite", parseFloat(e.target.value) || 0); }} style={Object.assign({}, iS, { width: 70, textAlign: "center" })} />
        <select value={a.unite} onChange={function(e) { onUp("unite", e.target.value); }} style={Object.assign({}, iS, { width: 75 })}>
          {UNITES.map(function(u) { return <option key={u} value={u}>{u}</option>; })}
        </select>
        <input type="number" value={a.prix_unitaire} onChange={function(e) { onUp("prix_unitaire", parseFloat(e.target.value) || 0); }} style={Object.assign({}, iS, { width: 110, textAlign: "right" })} />
        <div style={{ width: 110, textAlign: "right", fontWeight: 700, color: T.primary, fontSize: 12, flexShrink: 0 }}>{fmt(Math.round((a.quantite || 0) * (a.prix_unitaire || 0)))}</div>
        <button onClick={onDel} style={{ background: T.danger + "22", border: "none", color: T.danger, borderRadius: 6, padding: "6px 8px", cursor: "pointer" }}>✕</button>
      </div>
    );
  }

  return (
    <div style={{ background: T.card, border: "1px solid " + T.border, borderRadius: T.borderRadius, padding: isMobile ? 16 : 24 }}>
      {saving && <div style={{ position: "fixed", inset: 0, background: "#0009", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}><Spin /></div>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div><div style={{ fontWeight: 800, fontSize: 18 }}>{editDv ? "Modifier" : "Nouveau"} devis</div><div style={{ fontSize: 12, color: T.primary, fontWeight: 700, marginTop: 2 }}>{form.numero}</div></div>
        <button onClick={onClose} style={{ background: T.mid, border: "none", color: T.muted, borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13 }}>Annuler</button>
      </div>

      <div style={{ fontWeight: 700, fontSize: 13, color: T.primary, margin: "0 0 10px", borderBottom: "1px solid " + T.border, paddingBottom: 6 }}>📋 Client</div>
      <FG cols={isMobile ? 1 : 2}>
        <FF label="Nom client *" value={form.client_nom} onChange={function(v) { up("client_nom", v); }} full={isMobile} T={T} />
        <FS label="Chantier associé" value={form.chantier_id} onChange={function(v) { up("chantier_id", v); }} options={[["", "— Aucun —"]].concat(ch.map(function(c) { return [c.id, c.nom]; }))} T={T} />
        <FF label="Adresse" value={form.client_adresse} onChange={function(v) { up("client_adresse", v); }} T={T} />
        <FF label="Téléphone" value={form.client_telephone} onChange={function(v) { up("client_telephone", v); }} T={T} />
        <FF label="Email" value={form.client_email} onChange={function(v) { up("client_email", v); }} type="email" T={T} />
        <FF label="Validité" value={form.date_validite} onChange={function(v) { up("date_validite", v); }} type="date" T={T} />
      </FG>

      <div style={{ fontWeight: 700, fontSize: 13, color: T.primary, margin: "16px 0 10px", borderBottom: "1px solid " + T.border, paddingBottom: 6 }}>🏗️ Lots & Articles</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {form.lots.map(function(l, li) {
          if (l.type === "article") {
            return (
              <div key={l.id} style={{ background: T.mid, borderRadius: 8, padding: "10px 12px" }}>
                <ArtRow a={l} onUp={function(k, v) { upFree(l.id, k, v); }} onDel={function() { delLot(l.id); }} />
              </div>
            );
          }
          var lc = calc.lots.find(function(x) { return x.id === l.id; });
          return (
            <div key={l.id} style={{ background: T.mid, border: "2px solid " + T.primary + "44", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ background: T.primary + "22", padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ background: T.primary, color: "#fff", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 800 }}>LOT {li + 1}</span>
                <input value={l.nom} onChange={function(e) { upLot(l.id, "nom", e.target.value); }} placeholder="Nom du lot..." style={{ flex: 1, background: "transparent", border: "none", borderBottom: "1px dashed " + T.primary + "66", color: T.white, fontSize: 14, fontWeight: 700, outline: "none", padding: "2px 0", minWidth: 120 }} />
                <div style={{ fontWeight: 800, color: T.primary, fontSize: 14 }}>{fmt(lc ? lc.total : 0)}</div>
                <button onClick={function() { delLot(l.id); }} style={{ background: T.danger + "22", border: "1px solid " + T.danger + "44", color: T.danger, borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>✕ Lot</button>
              </div>
              <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                {(l.articles || []).map(function(a) {
                  return <ArtRow key={a.id} a={a} onUp={function(k, v) { upArt(l.id, a.id, k, v); }} onDel={function() { delArt(l.id, a.id); }} />;
                })}
                <button onClick={function() { addArt(l.id); }} style={{ background: T.primary + "11", border: "1px dashed " + T.primary + "55", color: T.primary, borderRadius: 7, padding: "6px 12px", fontSize: 11, cursor: "pointer", textAlign: "left", fontWeight: 600 }}>+ Article</button>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button onClick={addLot} style={{ flex: 1, background: T.primary + "22", border: "2px dashed " + T.primary + "66", color: T.primary, borderRadius: 10, padding: "10px", fontWeight: 700, cursor: "pointer" }}>+ Lot</button>
        <button onClick={addFreeArt} style={{ flex: 1, background: T.mid, border: "2px dashed " + T.border, color: T.muted, borderRadius: 10, padding: "10px", fontWeight: 700, cursor: "pointer" }}>+ Article libre</button>
      </div>

      <div style={{ fontWeight: 700, fontSize: 13, color: T.primary, margin: "16px 0 10px", borderBottom: "1px solid " + T.border, paddingBottom: 6 }}>💰 Financier</div>
      <FG cols={isMobile ? 1 : 3}>
        <FF label="TVA (%)" type="number" value={form.taux_tva} onChange={function(v) { up("taux_tva", parseFloat(v) || 0); }} T={T} />
        <FF label="Remise (%)" type="number" value={form.taux_remise} onChange={function(v) { up("taux_remise", parseFloat(v) || 0); }} T={T} />
        <div style={{ background: T.primary + "11", border: "1px solid " + T.primary + "44", borderRadius: 8, padding: "10px 14px" }}>
          <div style={{ fontSize: 10, color: T.muted }}>TOTAL TTC</div>
          <div style={{ fontWeight: 800, fontSize: 20, color: T.primary }}>{fmt(calc.totalTTC)}</div>
        </div>
      </FG>
      <div style={{ background: T.mid, borderRadius: 10, padding: "12px 16px", marginTop: 10 }}>
        {[["Sous-total HT", fmt(calc.sousTotal)], calc.montantRemise > 0 ? ["Remise (" + form.taux_remise + "%)", "- " + fmt(calc.montantRemise)] : null, ["Base imposable", fmt(calc.baseImp)], ["TVA (" + form.taux_tva + "%)", fmt(calc.montantTVA)]].filter(Boolean).map(function(row) {
          return <div key={row[0]} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13, borderBottom: "1px solid " + T.border }}><span style={{ color: T.muted }}>{row[0]}</span><span style={{ fontWeight: 600 }}>{row[1]}</span></div>;
        })}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", marginTop: 4 }}><span style={{ fontWeight: 700 }}>TOTAL TTC</span><span style={{ fontWeight: 800, fontSize: 16, color: T.primary }}>{fmt(calc.totalTTC)}</span></div>
      </div>

      <div style={{ fontWeight: 700, fontSize: 13, color: T.primary, margin: "16px 0 10px", borderBottom: "1px solid " + T.border, paddingBottom: 6 }}>👁 Aperçu en direct</div>
      <DevisApercu T={T} devis={form} calc={calc} />

      <div style={{ fontWeight: 700, fontSize: 13, color: T.primary, margin: "16px 0 10px", borderBottom: "1px solid " + T.border, paddingBottom: 6 }}>📝 Conditions</div>
      <FG cols={1}>
        <FF label="Conditions de paiement" value={form.conditions_paiement} onChange={function(v) { up("conditions_paiement", v); }} rows={2} full T={T} />
        <FF label="Notes internes" value={form.notes} onChange={function(v) { up("notes", v); }} rows={2} full T={T} />
      </FG>
      <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
        <button onClick={onClose} style={{ padding: "10px 20px", background: T.mid, color: T.white, border: "none", borderRadius: 10, cursor: "pointer" }}>Annuler</button>
        <button onClick={function() { onSave(form, calc); }} style={{ padding: "10px 24px", background: T.primary, color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>💾 Enregistrer</button>
      </div>
    </div>
  );
}

// ── Style Panel ───────────────────────────────────────────────────────────────
function StylePanel({ T, upT }) {
  const { isMobile } = useBP();
  const eRef = useRef(), cRef = useRef();
  function loadLogo(ref, key) {
    ref.current.click();
    ref.current.onchange = function(e) { var f = e.target.files[0]; if (!f) return; var r = new FileReader(); r.onload = function(ev) { upT(key, ev.target.result); }; r.readAsDataURL(f); };
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Card title="🖼 Logos" T={T}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
          {[["logoEntreprise", "LOGO ENTREPRISE", T.primary, eRef], ["logoClient", "LOGO CLIENT", T.secondary, cRef]].map(function(row) {
            var k = row[0], lbl = row[1], col = row[2], ref = row[3];
            return (
              <div key={k} style={{ background: T.mid, borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
                <div style={{ fontSize: 12, color: T.muted, fontWeight: 700 }}>{lbl}</div>
                {T[k] ? <img src={T[k]} alt="" style={{ maxWidth: 140, maxHeight: 80, objectFit: "contain", borderRadius: 6, background: "#fff", padding: 4 }} />
                  : <div style={{ width: 140, height: 80, border: "2px dashed " + T.border, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: T.muted, fontSize: 12 }}>Aucun logo</div>}
                <div style={{ display: "flex", gap: 8 }}>
                  <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} />
                  <button onClick={function() { loadLogo(ref, k); }} style={{ background: col, color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Choisir</button>
                  {T[k] && <button onClick={function() { upT(k, ""); }} style={{ background: T.danger + "22", color: T.danger, border: "1px solid " + T.danger + "44", borderRadius: 8, padding: "7px 12px", fontSize: 12, cursor: "pointer" }}>✕</button>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20 }}>
        <Card title="🎨 Couleurs" T={T}>
          {[["Fond", "devisBg"], ["Accent", "devisAccent"], ["Texte", "devisText"], ["En-tête tableau", "devisTableHead"], ["Texte en-tête", "devisTableHeadText"], ["Total TTC", "devisTotalBg"]].map(function(row) {
            return <ColorRow key={row[1]} label={row[0]} k={row[1]} T={T} upT={upT} />;
          })}
        </Card>
        <Card title="🔤 Typographie & Options" T={T}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: T.muted, display: "block", marginBottom: 4 }}>Police</label>
            <select value={T.devisFont || "sans-serif"} onChange={function(e) { upT("devisFont", e.target.value); }} style={{ width: "100%", background: T.mid, border: "1px solid " + T.border, borderRadius: 8, padding: "9px 12px", color: T.white, fontSize: 14, outline: "none" }}>
              {["sans-serif", "serif", "monospace", "Arial, sans-serif", "Georgia, serif", "Trebuchet MS, sans-serif"].map(function(f) { return <option key={f} value={f}>{f.split(",")[0]}</option>; })}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: T.muted, display: "block", marginBottom: 4 }}>Rayon coins : {T.devisBorderRadius || 8}px</label>
            <input type="range" min={0} max={20} value={T.devisBorderRadius || 8} onChange={function(e) { upT("devisBorderRadius", parseInt(e.target.value)); }} style={{ width: "100%", accentColor: T.primary }} />
          </div>
          <FF label="Titre du devis" value={T.devisTitre || "DEVIS"} onChange={function(v) { upT("devisTitre", v); }} T={T} />
          <div style={{ marginBottom: 12, marginTop: 12 }}>
            <label style={{ fontSize: 11, color: T.muted, display: "block", marginBottom: 4 }}>Mention pied de page</label>
            <textarea value={T.devisMention || ""} onChange={function(e) { upT("devisMention", e.target.value); }} rows={2} style={{ width: "100%", background: T.mid, border: "1px solid " + T.border, borderRadius: 8, padding: "9px 12px", color: T.white, fontSize: 13, outline: "none", boxSizing: "border-box", resize: "vertical" }} />
          </div>
          <label style={{ fontSize: 11, color: T.muted, display: "block", marginBottom: 6 }}>Colonnes</label>
          {[["showColRef", "N° référence"], ["showColUnite", "Unité"], ["showColPU", "P.U. HT"], ["showColTotal", "Total HT"]].map(function(row) {
            return <Toggle key={row[0]} label={row[1]} k={row[0]} T={T} upT={upT} />;
          })}
        </Card>
      </div>
      <Card title="👁 Aperçu en direct" T={T}>
        <DevisApercu T={T} />
      </Card>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={function() { ["devisBg", "devisAccent", "devisText", "devisTableHead", "devisTableHeadText", "devisTotalBg", "devisFont", "devisBorderRadius", "devisTitre", "devisMention", "showColRef", "showColUnite", "showColPU", "showColTotal", "logoEntreprise", "logoClient"].forEach(function(k) { upT(k, DT[k] !== undefined ? DT[k] : undefined); }); }} style={{ background: T.danger + "22", color: T.danger, border: "1px solid " + T.danger + "44", borderRadius: 8, padding: "10px 20px", fontWeight: 700, cursor: "pointer" }}>Réinitialiser style devis</button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// DÉBOURS SEC — avec persistance Supabase
// ════════════════════════════════════════════════════════════════════════════
function Debourse({ sessions, taches, ch, reload, T }) {
  const { isMobile } = useBP();
  const [selSid, setSelSid] = useState(null);
  const [showNewS, setShowNewS] = useState(false);
  const [sForm, setSForm] = useState({ nom: "", chantier_id: "", taux_charges: 40, coeff_fg: 15, coeff_benef: 10 });
  const [saving, setSaving] = useState(false);

  var selSess = sessions.find(function(s) { return s.id === selSid; });
  var selTaches = selSid ? taches.filter(function(t) { return t.session_id === selSid; }) : [];

  function saveSession() {
    if (!sForm.nom) return;
    setSaving(true);
    q("debourse_sessions").insert({ nom: sForm.nom, chantier_id: sForm.chantier_id || null, taux_charges: parseFloat(sForm.taux_charges), coeff_fg: parseFloat(sForm.coeff_fg), coeff_benef: parseFloat(sForm.coeff_benef) }).then(function(r) {
      setSaving(false); setShowNewS(false); reload();
      if (r.data) setSelSid(r.data.id);
    });
  }
  function delSession(id) {
    if (!window.confirm("Supprimer cette session ?")) return;
    q("debourse_taches").eq("session_id", id).del().then(function() { q("debourse_sessions").eq("id", id).del().then(function() { setSelSid(null); reload(); }); });
  }
  function updateCfg(k, v) {
    if (!selSid) return;
    q("debourse_sessions").eq("id", selSid).update({ [k]: parseFloat(v) || 0 }).then(function() { reload(); });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Sessions */}
      <Card title="📁 Sessions de débours" action={<button onClick={function() { setShowNewS(true); }} style={{ background: T.primary, color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>+ Nouvelle</button>} T={T}>
        {sessions.length === 0 ? <Empty msg="Aucune session — créez-en une" icon="🔢" /> : (
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
            {sessions.map(function(s) {
              var sts = taches.filter(function(t) { return t.session_id === s.id; });
              var tot = sts.reduce(function(a, t) { return a + (t.prix_vente_total || 0); }, 0);
              var active = selSid === s.id;
              return (
                <div key={s.id} onClick={function() { setSelSid(s.id); }} style={{ background: active ? T.primary + "22" : T.mid, border: "2px solid " + (active ? T.primary : T.border), borderRadius: 10, padding: "12px 16px", cursor: "pointer", minWidth: 180, flexShrink: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: active ? T.primary : T.white }}>{s.nom}</div>
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>{sts.length} tâche{sts.length !== 1 ? "s" : ""}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.success, marginTop: 4 }}>{fmtS(tot)} XOF</div>
                  <button onClick={function(e) { e.stopPropagation(); delSession(s.id); }} style={{ marginTop: 8, background: T.danger + "22", border: "none", color: T.danger, borderRadius: 6, padding: "3px 8px", fontSize: 10, cursor: "pointer" }}>Supprimer</button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Session sélectionnée */}
      {selSess && <SessionDetail sess={selSess} taches={selTaches} reload={reload} T={T} isMobile={isMobile} updateCfg={updateCfg} />}

      {showNewS && (
        <Modal title="Nouvelle session de débours" onClose={function() { setShowNewS(false); }} onSave={saveSession} T={T}>
          {saving ? <Spin /> : (
            <FG cols={2}>
              <FF label="Nom *" value={sForm.nom} onChange={function(v) { setSForm(function(p) { return Object.assign({}, p, { nom: v }); }); }} full T={T} />
              <FS label="Chantier associé" value={sForm.chantier_id} onChange={function(v) { setSForm(function(p) { return Object.assign({}, p, { chantier_id: v }); }); }} options={[["", "— Aucun —"]].concat(ch.map(function(c) { return [c.id, c.nom]; }))} full T={T} />
              <FF label="Taux charges sociales (%)" type="number" value={sForm.taux_charges} onChange={function(v) { setSForm(function(p) { return Object.assign({}, p, { taux_charges: v }); }); }} T={T} />
              <FF label="Frais généraux (%)" type="number" value={sForm.coeff_fg} onChange={function(v) { setSForm(function(p) { return Object.assign({}, p, { coeff_fg: v }); }); }} T={T} />
              <FF label="Bénéfice / Marge (%)" type="number" value={sForm.coeff_benef} onChange={function(v) { setSForm(function(p) { return Object.assign({}, p, { coeff_benef: v }); }); }} T={T} />
            </FG>
          )}
        </Modal>
      )}
    </div>
  );
}

function SessionDetail({ sess, taches, reload, T, isMobile, updateCfg }) {
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tForm, setTForm] = useState({ libelle: "", unite: "U", quantite: 0, salaire: 0, rendement: 1, materiau: 0, materiel: 0, sous_traitance: 0 });
  const [editId, setEditId] = useState(null);

  var cfg = { tc: sess.taux_charges || 40, fg: sess.coeff_fg || 15, benef: sess.coeff_benef || 10 };
  var totaux = taches.reduce(function(acc, t) { var c = calcTache(t, cfg.tc, cfg); return { ds: acc.ds + c.ds * (t.quantite || 0), pr: acc.pr + c.pr * (t.quantite || 0), pvt: acc.pvt + c.pvt }; }, { ds: 0, pr: 0, pvt: 0 });

  function openEdit(t) { setTForm({ libelle: t.libelle, unite: t.unite, quantite: t.quantite, salaire: t.salaire, rendement: t.rendement, materiau: t.materiau, materiel: t.materiel, sous_traitance: t.sous_traitance }); setEditId(t.id); setShowNew(true); }
  function saveTache() {
    if (!tForm.libelle) return;
    setSaving(true);
    var c = calcTache(tForm, cfg.tc, cfg);
    var data = { session_id: sess.id, libelle: tForm.libelle, unite: tForm.unite, quantite: parseFloat(tForm.quantite) || 0, salaire: parseFloat(tForm.salaire) || 0, rendement: parseFloat(tForm.rendement) || 1, materiau: parseFloat(tForm.materiau) || 0, materiel: parseFloat(tForm.materiel) || 0, sous_traitance: parseFloat(tForm.sous_traitance) || 0, main_oeuvre_u: Math.round(c.mo), debourse_sec_u: Math.round(c.ds), prix_revient_u: Math.round(c.pr), prix_vente_u: Math.round(c.pv), prix_vente_total: Math.round(c.pvt) };
    var op = editId ? q("debourse_taches").eq("id", editId).update(data) : q("debourse_taches").insert(data);
    op.then(function() { setSaving(false); setShowNew(false); setEditId(null); setTForm({ libelle: "", unite: "U", quantite: 0, salaire: 0, rendement: 1, materiau: 0, materiel: 0, sous_traitance: 0 }); reload(); });
  }
  function delTache(id) { q("debourse_taches").eq("id", id).del().then(function() { reload(); }); }

  var iS = { background: T.mid, border: "1px solid " + T.border, borderRadius: 7, padding: "6px 8px", color: T.white, fontSize: 12, outline: "none" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3,1fr)", gap: 10 }}>
        <Kpi icon="🔨" label="Débours sec total" value={fmtS(Math.round(totaux.ds))} color={T.warning} compact={isMobile} T={T} />
        <Kpi icon="🏷️" label="Prix de revient" value={fmtS(Math.round(totaux.pr))} color={T.secondary} compact={isMobile} T={T} />
        <Kpi icon="💰" label="Prix de vente HT" value={fmtS(Math.round(totaux.pvt))} color={T.success} compact={isMobile} T={T} />
      </div>

      {/* Coefficients modifiables */}
      <Card title={"⚙️ Coefficients — " + sess.nom} T={T}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: 12 }}>
          {[["Charges sociales (%)", "taux_charges", cfg.tc], ["Frais généraux (%)", "coeff_fg", cfg.fg], ["Bénéfice (%)", "coeff_benef", cfg.benef]].map(function(row) {
            return (
              <div key={row[1]}>
                <label style={{ fontSize: 11, color: T.muted, display: "block", marginBottom: 4 }}>{row[0]}</label>
                <input type="number" defaultValue={row[2]} onBlur={function(e) { updateCfg(row[1], e.target.value); }} style={Object.assign({}, iS, { width: "100%" })} />
              </div>
            );
          })}
        </div>
      </Card>

      {/* Tâches */}
      <Card title="📋 Tâches / Ouvrages" action={<button onClick={function() { setEditId(null); setTForm({ libelle: "", unite: "U", quantite: 0, salaire: 0, rendement: 1, materiau: 0, materiel: 0, sous_traitance: 0 }); setShowNew(true); }} style={{ background: T.primary, color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>+ Tâche</button>} T={T}>
        {taches.length === 0 && <Empty msg="Aucune tâche — ajoutez-en une" icon="📋" />}
        {taches.map(function(t) {
          var c = calcTache(t, cfg.tc, cfg);
          return (
            <div key={t.id} style={{ background: T.mid, border: "1px solid " + T.border, borderRadius: 10, padding: "12px 14px", marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
                <div><div style={{ fontWeight: 700, fontSize: 14 }}>{t.libelle}</div><div style={{ fontSize: 11, color: T.muted }}>{t.quantite} {t.unite}</div></div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={function() { openEdit(t); }} style={{ background: T.warning + "22", color: T.warning, border: "1px solid " + T.warning + "44", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>✏️</button>
                  <button onClick={function() { delTache(t.id); }} style={{ background: T.danger + "22", color: T.danger, border: "1px solid " + T.danger + "44", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>✕</button>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 8, background: T.bg, borderRadius: 8, padding: "10px 12px" }}>
                {[["Main d'œuvre/u", c.mo, T.secondary], ["Débours sec/u", c.ds, T.warning], ["Prix revient/u", c.pr, T.muted], ["Prix vente total", c.pvt, T.success]].map(function(row) {
                  return (
                    <div key={row[0]}>
                      <div style={{ fontSize: 9, color: T.muted, marginBottom: 2 }}>{row[0]}</div>
                      <div style={{ fontWeight: 700, color: row[2], fontSize: 13 }}>{fmtS(Math.round(row[1]))} XOF</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.muted, marginBottom: 3 }}>
                  <span>Part du total</span>
                  <span>{totaux.pvt > 0 ? Math.round(c.pvt / totaux.pvt * 100) : 0}%</span>
                </div>
                <PBar p={totaux.pvt > 0 ? c.pvt / totaux.pvt * 100 : 0} color={T.success} h={5} />
              </div>
            </div>
          );
        })}
      </Card>

      {/* Récap */}
      {taches.length > 1 && (
        <Card title="📊 Récapitulatif" T={T}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 10, marginBottom: 14 }}>
            <Kpi icon="📋" label="Tâches" value={taches.length} compact T={T} />
            <Kpi icon="🔨" label="Débours sec" value={fmtS(Math.round(totaux.ds))} color={T.warning} compact T={T} />
            <Kpi icon="💰" label="Prix vente HT" value={fmtS(Math.round(totaux.pvt))} color={T.success} compact T={T} />
            <Kpi icon="📈" label="Marge brute" value={totaux.pvt > 0 ? Math.round((totaux.pvt - totaux.pr) / totaux.pvt * 100) + "%" : "—"} color={T.primary} compact T={T} />
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={taches.map(function(t) { var c = calcTache(t, cfg.tc, cfg); return { nom: t.libelle.slice(0, 12), pvt: Math.round(c.pvt) }; })}>
              <XAxis dataKey="nom" tick={{ fill: T.muted, fontSize: 9 }} />
              <YAxis tick={{ fill: T.muted, fontSize: 9 }} tickFormatter={function(v) { return fmtS(v); }} />
              <Tooltip contentStyle={{ background: T.card, border: "1px solid " + T.border, color: T.white }} formatter={function(v) { return fmt(v); }} />
              <Bar dataKey="pvt" fill={T.success} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {showNew && (
        <Modal title={editId ? "Modifier la tâche" : "Nouvelle tâche"} onClose={function() { setShowNew(false); setEditId(null); }} onSave={saveTache} T={T}>
          {saving ? <Spin /> : (
            <FG cols={2}>
              <FF label="Désignation *" value={tForm.libelle} onChange={function(v) { setTForm(function(p) { return Object.assign({}, p, { libelle: v }); }); }} full T={T} />
              <FS label="Unité" value={tForm.unite} onChange={function(v) { setTForm(function(p) { return Object.assign({}, p, { unite: v }); }); }} options={UNITES} T={T} />
              <FF label="Quantité" type="number" value={tForm.quantite} onChange={function(v) { setTForm(function(p) { return Object.assign({}, p, { quantite: v }); }); }} T={T} />
              <FF label="Salaire ouvrier (XOF/j)" type="number" value={tForm.salaire} onChange={function(v) { setTForm(function(p) { return Object.assign({}, p, { salaire: v }); }); }} T={T} />
              <FF label="Rendement (unités/j)" type="number" value={tForm.rendement} onChange={function(v) { setTForm(function(p) { return Object.assign({}, p, { rendement: v }); }); }} T={T} />
              <FF label="Matériaux (XOF/u)" type="number" value={tForm.materiau} onChange={function(v) { setTForm(function(p) { return Object.assign({}, p, { materiau: v }); }); }} T={T} />
              <FF label="Matériel (XOF/u)" type="number" value={tForm.materiel} onChange={function(v) { setTForm(function(p) { return Object.assign({}, p, { materiel: v }); }); }} T={T} />
              <FF label="Sous-traitance (XOF/u)" type="number" value={tForm.sous_traitance} onChange={function(v) { setTForm(function(p) { return Object.assign({}, p, { sous_traitance: v }); }); }} T={T} />
            </FG>
          )}
        </Modal>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// INTERVENTIONS
// ════════════════════════════════════════════════════════════════════════════
function Interventions({ intv, ch, reload, T }) {
  const { isMobile } = useBP();
  const [fT, setFT] = useState("Tous");
  const [fS, setFS] = useState("Tous");
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ titre: "", description: "", type: "Corrective", intervenant: "", chantier: "", date_creation: today(), statut: "En attente" });
  var STIC = { "En attente": T.warning, "En cours": T.secondary, "Terminee": T.success };
  var TC = { Urgence: T.danger, Preventive: T.secondary, Corrective: T.primary, Inspection: "#A855F7" };
  var filtered = intv.filter(function(i) { return (fT === "Tous" || i.type === fT) && (fS === "Tous" || i.statut === fS); });
  function totalD(i) { return (i.depenses || []).reduce(function(a, d) { return a + d.montant; }, 0); }
  function updSt(id, s) { q("interventions").eq("id", id).update({ statut: s }).then(function() { reload(); }); }
  function del(id) { q("interventions").eq("id", id).del().then(function() { reload(); }); }
  function save() {
    if (!form.titre) return;
    setSaving(true);
    q("interventions").insert({ titre: form.titre, description: form.description, type: form.type, intervenant: form.intervenant, chantier: form.chantier, date_creation: form.date_creation, duree: 1, statut: form.statut, facturee: false }).then(function() { setSaving(false); setShowNew(false); reload(); });
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 10 }}>
        <Kpi icon="🔧" label="Total" value={intv.length} color={T.primary} compact={isMobile} T={T} />
        <Kpi icon="🚨" label="Urgences" value={intv.filter(function(i) { return i.type === "Urgence"; }).length} color={T.danger} compact={isMobile} T={T} />
        <Kpi icon="⚙️" label="En cours" value={intv.filter(function(i) { return i.statut === "En cours"; }).length} color={T.secondary} compact={isMobile} T={T} />
        <Kpi icon="💰" label="Coût total" value={fmtS(intv.reduce(function(a, i) { return a + totalD(i); }, 0))} color={T.warning} compact={isMobile} T={T} />
      </div>
      <Card T={T}>
        <div style={{ display: "flex", gap: 4, overflowX: "auto", marginBottom: 8 }}>
          {["Tous"].concat(TYPES_INT).map(function(t) { return <button key={t} onClick={function() { setFT(t); }} style={{ padding: "5px 10px", borderRadius: 20, border: "1px solid " + (fT === t ? T.primary : T.border), background: fT === t ? T.primary : "transparent", color: fT === t ? "#fff" : T.muted, cursor: "pointer", fontSize: 11, whiteSpace: "nowrap", flexShrink: 0 }}>{t}</button>; })}
        </div>
        <div style={{ display: "flex", gap: 4, justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 4, overflowX: "auto" }}>
            {["Tous", "En attente", "En cours", "Terminee"].map(function(s) { return <button key={s} onClick={function() { setFS(s); }} style={{ padding: "5px 10px", borderRadius: 20, border: "1px solid " + (fS === s ? T.primary : T.border), background: fS === s ? T.primary : "transparent", color: fS === s ? "#fff" : T.muted, cursor: "pointer", fontSize: 11, whiteSpace: "nowrap", flexShrink: 0 }}>{s}</button>; })}
          </div>
          <button onClick={function() { setShowNew(true); }} style={{ background: T.primary, color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontWeight: 700, cursor: "pointer", fontSize: 12, flexShrink: 0 }}>+ Nouvelle</button>
        </div>
      </Card>
      {filtered.length === 0 && <Empty msg="Aucune intervention" icon="🔧" />}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill,minmax(340px,1fr))", gap: 12 }}>
        {filtered.map(function(i) {
          return (
            <div key={i.id} style={{ background: T.card, border: "1px solid " + (i.type === "Urgence" ? T.danger + "66" : T.border), borderRadius: T.borderRadius, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 14 }}>{i.titre}</div><div style={{ fontSize: 11, color: T.muted }}>{i.chantier || "—"} · {i.date_creation}</div></div>
                <Badge label={i.type} color={TC[i.type] || T.primary} small />
              </div>
              {i.description && <div style={{ fontSize: 12, color: T.muted, background: T.mid, borderRadius: 6, padding: "7px 10px" }}>{i.description}</div>}
              <div style={{ background: T.mid, borderRadius: 8, padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div><div style={{ fontSize: 10, color: T.muted }}>Coût</div><div style={{ fontWeight: 800, color: T.primary, fontSize: 15 }}>{fmt(totalD(i))}</div></div>
                <Badge label={i.facturee ? "Facturée" : "Non facturée"} color={i.facturee ? T.success : T.danger} small />
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <select value={i.statut} onChange={function(e) { updSt(i.id, e.target.value); }} style={{ flex: 1, background: (STIC[i.statut] || T.muted) + "22", border: "1px solid " + (STIC[i.statut] || T.muted) + "55", borderRadius: 6, padding: "5px 10px", color: STIC[i.statut] || T.muted, fontSize: 12, cursor: "pointer", outline: "none", fontWeight: 700 }}>
                  {["En attente", "En cours", "Terminee"].map(function(s) { return <option key={s} value={s}>{s}</option>; })}
                </select>
                <button onClick={function() { del(i.id); }} style={{ background: T.danger + "22", border: "1px solid " + T.danger + "44", color: T.danger, borderRadius: 6, padding: "6px 10px", fontSize: 12, cursor: "pointer" }}>✕</button>
              </div>
            </div>
          );
        })}
      </div>
      {showNew && (
        <Modal title="Nouvelle intervention" onClose={function() { setShowNew(false); }} onSave={save} T={T}>
          {saving ? <Spin /> : (
            <FG cols={2}>
              <FF label="Titre *" value={form.titre} onChange={function(v) { setForm(function(p) { return Object.assign({}, p, { titre: v }); }); }} full T={T} />
              <FS label="Type" value={form.type} onChange={function(v) { setForm(function(p) { return Object.assign({}, p, { type: v }); }); }} options={TYPES_INT} T={T} />
              <FS label="Statut" value={form.statut} onChange={function(v) { setForm(function(p) { return Object.assign({}, p, { statut: v }); }); }} options={["En attente", "En cours", "Terminee"]} T={T} />
              <FF label="Intervenant" value={form.intervenant} onChange={function(v) { setForm(function(p) { return Object.assign({}, p, { intervenant: v }); }); }} T={T} />
              <FS label="Chantier" value={form.chantier} onChange={function(v) { setForm(function(p) { return Object.assign({}, p, { chantier: v }); }); }} options={[""].concat(ch.map(function(c) { return c.nom; }))} T={T} />
              <FF label="Date" type="date" value={form.date_creation} onChange={function(v) { setForm(function(p) { return Object.assign({}, p, { date_creation: v }); }); }} T={T} />
              <FF label="Description" value={form.description} onChange={function(v) { setForm(function(p) { return Object.assign({}, p, { description: v }); }); }} rows={3} full T={T} />
            </FG>
          )}
        </Modal>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ALERTES
// ════════════════════════════════════════════════════════════════════════════
function Alertes({ ch, openCh, T }) {
  var alertes = [];
  ch.forEach(function(c) {
    var d = totalDep(c), p = pct(d, c.budgetInitial);
    if (p > 100) alertes.push({ niveau: "critique", msg: "Dépassement budget : " + p + "%", chantier: c });
    else if (p >= 80) alertes.push({ niveau: "warning", msg: "Budget à " + p + "% consommé", chantier: c });
    if (c.statut === "En derive") alertes.push({ niveau: "critique", msg: "Chantier en dérive", chantier: c });
  });
  var col = { critique: T.danger, warning: T.warning, info: T.secondary };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {alertes.length === 0 && <Empty msg="Aucune alerte — tout va bien ! ✅" icon="🎉" />}
      {alertes.map(function(al, i) {
        return (
          <div key={i} onClick={function() { openCh(al.chantier.id); }} style={{ background: T.card, border: "1px solid " + (col[al.niveau] || T.border) + "55", borderLeft: "4px solid " + (col[al.niveau] || T.border), borderRadius: T.borderRadius, padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div><div style={{ fontWeight: 600, fontSize: 13, color: col[al.niveau] }}>⚠ {al.msg}</div><div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>{al.chantier.nom} — {al.chantier.client}</div></div>
            <Badge label={al.chantier.statut} color={stC(al.chantier.statut, T)} />
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// KPI PAGE
// ════════════════════════════════════════════════════════════════════════════
function KpiPage({ ch, dv, intv, T }) {
  const { isMobile } = useBP();
  var totalB = ch.reduce(function(a, c) { return a + c.budgetInitial; }, 0);
  var totalD = ch.reduce(function(a, c) { return a + totalDep(c); }, 0);
  var marge = totalB - totalD, pc = pct(totalD, totalB);
  var allDep = ch.reduce(function(a, c) { return a.concat(c.depenses); }, []);
  var depCat = CATS.map(function(cat) { return { cat: cat, total: allDep.filter(function(d) { return d.categorie === cat; }).reduce(function(a, d) { return a + d.montant; }, 0) }; }).filter(function(x) { return x.total > 0; });
  var txConv = dv.length > 0 ? Math.round(dv.filter(function(d) { return d.statut === "accepte"; }).length / dv.length * 100) : 0;
  var caTotal = dv.filter(function(d) { return d.statut === "accepte"; }).reduce(function(a, d) { return a + (d.total_ttc || 0); }, 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 10 }}>
        <Kpi icon="💰" label="Budget total" value={fmtS(totalB)} compact={isMobile} T={T} />
        <Kpi icon="🧾" label="Dépenses" value={fmtS(totalD)} color={T.warning} compact={isMobile} T={T} />
        <Kpi icon="💵" label="Marge" value={fmtS(marge)} color={marge >= 0 ? T.success : T.danger} compact={isMobile} T={T} />
        <Kpi icon="📉" label="Consommé" value={pc + "%"} color={pc > 100 ? T.danger : pc > 80 ? T.warning : T.success} compact={isMobile} T={T} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 10 }}>
        <Kpi icon="📄" label="Devis total" value={dv.length} compact={isMobile} T={T} />
        <Kpi icon="✅" label="Taux conv." value={txConv + "%"} color={txConv > 50 ? T.success : txConv > 25 ? T.warning : T.danger} compact={isMobile} T={T} />
        <Kpi icon="💰" label="CA accepté" value={fmtS(caTotal)} color={T.success} compact={isMobile} T={T} />
        <Kpi icon="🔧" label="Interventions" value={intv.length} color={T.secondary} compact={isMobile} T={T} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
        <Card title="Dépenses par catégorie" T={T}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={depCat} layout="vertical" margin={{ left: 0, right: 10 }}>
              <XAxis type="number" tick={{ fill: T.muted, fontSize: 9 }} tickFormatter={function(v) { return fmtS(v); }} />
              <YAxis type="category" dataKey="cat" tick={{ fill: T.muted, fontSize: 10 }} width={80} />
              <Tooltip contentStyle={{ background: T.card, border: "1px solid " + T.border, color: T.white }} formatter={function(v) { return fmt(v); }} />
              <Bar dataKey="total" radius={[0, 4, 4, 0]}>{depCat.map(function(d, i) { return <Cell key={i} fill={catC(d.cat, T)} />; })}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Budget par chantier" T={T}>
          {ch.map(function(c) {
            var d = totalDep(c), p = pct(d, c.budgetInitial);
            return (
              <div key={c.id} style={{ padding: "8px 0", borderBottom: "1px solid " + T.border }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}><span style={{ fontWeight: 600 }}>{c.nom}</span><span style={{ fontWeight: 700, color: p > 100 ? T.danger : p > 80 ? T.warning : T.success }}>{p}%</span></div>
                <PBar p={p} color={p > 100 ? T.danger : p > 80 ? T.warning : T.success} h={6} />
              </div>
            );
          })}
          {ch.length === 0 && <Empty msg="Aucun chantier" icon="📊" />}
        </Card>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// IA
// ════════════════════════════════════════════════════════════════════════════
function IA({ ch, intv, dv, T }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  function run() {
    setLoading(true); setError(null); setResult(null);
    var ctx = {
      chantiers: ch.map(function(c) { return { nom: c.nom, statut: c.statut, budget: c.budgetInitial, depenses: totalDep(c), pct: pct(totalDep(c), c.budgetInitial) }; }),
      interventions: intv.slice(0, 20).map(function(i) { return { titre: i.titre, type: i.type, statut: i.statut }; }),
      devis: { total: dv.length, acceptes: dv.filter(function(d) { return d.statut === "accepte"; }).length, ca: dv.filter(function(d) { return d.statut === "accepte"; }).reduce(function(a, d) { return a + (d.total_ttc || 0); }, 0) }
    };
    fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1200, messages: [{ role: "user", content: "Tu es expert BTP Côte d'Ivoire. Analyse ce portefeuille (XOF). Réponds UNIQUEMENT en JSON valide:\n" + JSON.stringify(ctx) + "\n\nFormat strict: {\"recommandations\":[{\"titre\":string,\"detail\":string,\"priorite\":\"haute\"|\"moyenne\"|\"basse\"}],\"scoreGlobal\":number,\"synthese\":string,\"pointsForts\":[string],\"risques\":[string]}" }] }) })
      .then(function(r) { return r.json(); })
      .then(function(data) { var txt = (data.content || []).map(function(i) { return i.text || ""; }).join(""); setResult(JSON.parse(txt.replace(/```json|```/g, "").trim())); setLoading(false); })
      .catch(function(e) { setError("Erreur IA : " + e.message); setLoading(false); });
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ background: T.primary + "11", border: "1px solid " + T.primary + "44", borderRadius: T.borderRadius, padding: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>🤖 Analyse IA du portefeuille</div>
        <div style={{ color: T.muted, fontSize: 13, marginBottom: 14 }}>{ch.length} chantier{ch.length !== 1 ? "s" : ""} · {dv.length} devis · {intv.length} interventions</div>
        <button onClick={run} disabled={loading} style={{ background: T.primary, color: "#fff", border: "none", borderRadius: 10, padding: "10px 24px", fontWeight: 700, cursor: loading ? "wait" : "pointer", fontSize: 14 }}>{loading ? "⏳ Analyse en cours..." : "🚀 Lancer l'analyse"}</button>
        {error && <div style={{ color: T.danger, fontSize: 12, marginTop: 10 }}>{error}</div>}
      </div>
      {!result && !loading && <Empty msg="Lancez l'analyse pour obtenir des recommandations IA" icon="🤖" />}
      {loading && <Spin />}
      {result && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: T.primary + "11", border: "1px solid " + T.primary + "44", borderRadius: T.borderRadius, padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Synthèse</div>
              <div style={{ background: (result.scoreGlobal > 70 ? T.success : result.scoreGlobal > 40 ? T.warning : T.danger) + "22", borderRadius: 8, padding: "6px 16px", fontWeight: 800, fontSize: 18, color: result.scoreGlobal > 70 ? T.success : result.scoreGlobal > 40 ? T.warning : T.danger }}>Score {result.scoreGlobal}/100</div>
            </div>
            <div style={{ fontSize: 13, color: T.muted, marginBottom: 12 }}>{result.synthese}</div>
            {result.pointsForts && result.pointsForts.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontWeight: 700, color: T.success, fontSize: 12, marginBottom: 6 }}>✅ Points forts</div>
                {result.pointsForts.map(function(p, i) { return <div key={i} style={{ fontSize: 12, color: T.muted, marginBottom: 3 }}>• {p}</div>; })}
              </div>
            )}
            {result.risques && result.risques.length > 0 && (
              <div>
                <div style={{ fontWeight: 700, color: T.danger, fontSize: 12, marginBottom: 6 }}>⚠ Risques identifiés</div>
                {result.risques.map(function(r, i) { return <div key={i} style={{ fontSize: 12, color: T.muted, marginBottom: 3 }}>• {r}</div>; })}
              </div>
            )}
          </div>
          <Card title="📋 Recommandations" T={T}>
            {(result.recommandations || []).map(function(r, i) {
              var col = r.priorite === "haute" ? T.danger : r.priorite === "moyenne" ? T.warning : T.success;
              return (
                <div key={i} style={{ background: col + "11", border: "1px solid " + col + "33", borderRadius: 8, padding: 14, marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 6 }}><div style={{ fontWeight: 700, color: col, fontSize: 13 }}>{r.titre}</div><Badge label={"Priorité " + r.priorite} color={col} small /></div>
                  <div style={{ fontSize: 12, color: T.muted }}>{r.detail}</div>
                </div>
              );
            })}
          </Card>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// GESTION
// ════════════════════════════════════════════════════════════════════════════
function Gestion({ ch, openCh, reload, T }) {
  const { isMobile } = useBP();
  const [confirm, setConfirm] = useState(null);
  const [search, setSearch] = useState("");
  var filtered = ch.filter(function(c) { return (c.nom + c.client).toLowerCase().includes(search.toLowerCase()); });
  function del(id) { q("chantiers").eq("id", id).del().then(function() { setConfirm(null); reload(); }); }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 10 }}>
        <Kpi icon="🏗️" label="Total" value={ch.length} color={T.primary} compact={isMobile} T={T} />
        <Kpi icon="✅" label="Clôturés" value={ch.filter(function(c) { return c.statut === "Cloture"; }).length} color={T.success} compact={isMobile} T={T} />
        <Kpi icon="⚙️" label="En cours" value={ch.filter(function(c) { return c.statut === "En cours"; }).length} color={T.secondary} compact={isMobile} T={T} />
        <Kpi icon="🚨" label="En dérive" value={ch.filter(function(c) { return c.statut === "En derive"; }).length} color={T.danger} compact={isMobile} T={T} />
      </div>
      <Card title="Tous les projets" T={T}>
        <input value={search} onChange={function(e) { setSearch(e.target.value); }} placeholder="Rechercher..." style={{ width: "100%", background: T.mid, border: "1px solid " + T.border, borderRadius: 8, padding: "10px 14px", color: T.white, fontSize: 14, boxSizing: "border-box", outline: "none", marginBottom: 14 }} />
        {filtered.map(function(c) {
          var dep = totalDep(c), p = pct(dep, c.budgetInitial);
          return (
            <div key={c.id} style={{ background: T.mid, border: "1px solid " + (confirm === c.id ? T.danger + "88" : T.border), borderRadius: T.borderRadius, padding: "12px 14px", marginBottom: 8 }}>
              {confirm === c.id ? (
                <div>
                  <div style={{ fontWeight: 700, color: T.danger, marginBottom: 8 }}>Supprimer "{c.nom}" et toutes ses dépenses ?</div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={function() { setConfirm(null); }} style={{ flex: 1, padding: "9px", background: T.card, color: T.white, border: "1px solid " + T.border, borderRadius: 8, cursor: "pointer" }}>Annuler</button>
                    <button onClick={function() { del(c.id); }} style={{ flex: 1, padding: "9px", background: T.danger, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>Confirmer</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                    <div><div style={{ fontWeight: 700, fontSize: 14 }}>{c.nom}</div><div style={{ fontSize: 11, color: T.muted }}>{c.client} · {c.type}</div></div>
                    <Badge label={c.statut} color={stC(c.statut, T)} small />
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.muted, marginBottom: 3 }}><span>{fmt(dep)}</span><span style={{ fontWeight: 700, color: p > 100 ? T.danger : p > 80 ? T.warning : T.success }}>{p}%</span></div>
                    <PBar p={p} color={p > 100 ? T.danger : p > 80 ? T.warning : T.success} h={6} />
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button onClick={function() { openCh(c.id); }} style={{ background: T.secondary + "22", border: "1px solid " + T.secondary + "44", color: T.secondary, borderRadius: 7, padding: "7px 14px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Ouvrir</button>
                    <button onClick={function() { setConfirm(c.id); }} style={{ background: T.danger + "22", border: "1px solid " + T.danger + "44", color: T.danger, borderRadius: 7, padding: "7px 12px", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>✕</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <Empty msg="Aucun résultat" icon="🔍" />}
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PARAMÈTRES
// ════════════════════════════════════════════════════════════════════════════
function Parametres({ T, upT, resetT }) {
  const { isMobile } = useBP();
  var presets = [
    { label: "BTP Orange", colors: { primary: "#F97316", secondary: "#3B82F6", bg: "#1C1917", card: "#292524" } },
    { label: "Bleu Pro", colors: { primary: "#2563EB", secondary: "#7C3AED", bg: "#0F172A", card: "#1E293B" } },
    { label: "Vert Nature", colors: { primary: "#16A34A", secondary: "#0891B2", bg: "#14532D", card: "#166534" } },
    { label: "Rouge BTP", colors: { primary: "#DC2626", secondary: "#D97706", bg: "#1C0A0A", card: "#2C1010" } },
    { label: "Dark Pro", colors: { primary: "#6366F1", secondary: "#EC4899", bg: "#000000", card: "#111111" } },
  ];
  var uiColors = [["Couleur principale", "primary"], ["Secondaire", "secondary"], ["Succès", "success"], ["Danger", "danger"], ["Avertissement", "warning"], ["Fond", "bg"], ["Carte", "card"]];
  var companyFields = [["Nom", "companyName"], ["Adresse", "companyAddress"], ["Téléphone", "companyTel"], ["Email", "companyEmail"], ["SIRET / RC", "companySiret"]];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Card title="🎨 Thèmes prédéfinis" T={T}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5,1fr)", gap: 10 }}>
          {presets.map(function(p) {
            return (
              <button key={p.label} onClick={function() { Object.entries(p.colors).forEach(function(e) { upT(e[0], e[1]); }); }} style={{ background: p.colors.card, border: "2px solid " + p.colors.primary, borderRadius: 10, padding: "12px 10px", cursor: "pointer", textAlign: "left" }}>
                <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>{Object.values(p.colors).map(function(c, i) { return <div key={i} style={{ width: 14, height: 14, borderRadius: "50%", background: c }} />; })}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: p.colors.primary }}>{p.label}</div>
              </button>
            );
          })}
        </div>
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20 }}>
        <Card title="🎨 Couleurs interface" T={T}>
          {uiColors.map(function(row) { return <ColorRow key={row[1]} label={row[0]} k={row[1]} T={T} upT={upT} />; })}
        </Card>
        <Card title="🏢 Informations entreprise" T={T}>
          {companyFields.map(function(row) {
            return (
              <div key={row[1]} style={{ padding: "10px 0", borderBottom: "1px solid " + T.border }}>
                <label style={{ fontSize: 11, color: T.muted, display: "block", marginBottom: 4 }}>{row[0]}</label>
                <input value={T[row[1]] || ""} onChange={function(e) { upT(row[1], e.target.value); }} style={{ width: "100%", background: T.mid, border: "1px solid " + T.border, borderRadius: 8, padding: "8px 12px", color: T.white, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
              </div>
            );
          })}
        </Card>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={resetT} style={{ background: T.danger + "22", color: T.danger, border: "1px solid " + T.danger + "44", borderRadius: 8, padding: "10px 20px", fontWeight: 700, cursor: "pointer" }}>Réinitialiser tout</button>
      </div>
    </div>
  );
}
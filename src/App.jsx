import React, { useState, useEffect, useRef, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

const SUPA_URL = "https://mbkwpaxissvvjhewkggl.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ia3dwYXhpc3N2dmpoZXdrZ2dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MjQzOTMsImV4cCI6MjA4NzAwMDM5M30.Zo9aJVDByO8aVSADfSCc2m4jCI1qeXuWYQgVRT-a3LA";
const HDR = { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: "Bearer " + SUPA_KEY };
const REST = SUPA_URL + "/rest/v1";
const AI_URL = "/api/claude";
const AI_MODEL = "claude-sonnet-4-20250514";

// ── SUPABASE ──────────────────────────────────────────────────────────────────
function q(table) {
  var _f = [], _s = "*", _o = null;
  return {
    select: function(s) { _s = s; return this; },
    order: function(c, o) { _o = "order=" + c + (o && o.ascending === false ? ".desc" : ".asc"); return this; },
    eq: function(c, v) { _f.push(c + "=eq." + encodeURIComponent(v)); return this; },
    get: function() {
      var u = REST + "/" + table + "?select=" + _s;
      if (_f.length) u += "&" + _f.join("&");
      if (_o) u += "&" + _o;
      return fetch(u, { headers: HDR }).then(function(r) { return r.json().then(function(d) { return r.ok ? { data: d, error: null } : { data: null, error: d }; }); });
    },
    insert: function(p) {
      return fetch(REST + "/" + table, { method: "POST", headers: Object.assign({}, HDR, { Prefer: "return=representation" }), body: JSON.stringify(p) })
        .then(function(r) { return r.json().then(function(d) { return r.ok ? { data: Array.isArray(d) ? d[0] : d, error: null } : { data: null, error: d }; }); });
    },
    update: function(p) {
      var u = REST + "/" + table + (_f.length ? "?" + _f.join("&") : "");
      return fetch(u, { method: "PATCH", headers: Object.assign({}, HDR, { Prefer: "return=representation" }), body: JSON.stringify(p) })
        .then(function(r) { return r.json().then(function(d) { return r.ok ? { data: d, error: null } : { data: null, error: d }; }); });
    },
    del: function() {
      var u = REST + "/" + table + (_f.length ? "?" + _f.join("&") : "");
      return fetch(u, { method: "DELETE", headers: HDR }).then(function(r) { return r.ok ? { error: null } : r.json().then(function(d) { return { error: d }; }); });
    }
  };
}

// ── AI ────────────────────────────────────────────────────────────────────────
async function aiCall(body, maxRetries) {
  maxRetries = maxRetries || 4;
  for (var attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      var r = await fetch(AI_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (r.ok) return r.json();
      var et = await r.text();
      if ((r.status === 529 || r.status === 503 || r.status === 500) && attempt < maxRetries) {
        await new Promise(function(res) { setTimeout(res, attempt * 4000); });
      } else throw new Error("API " + r.status + ": " + et.slice(0, 150));
    } catch (e) {
      if (attempt < maxRetries && (e.message.indexOf("fetch") >= 0 || e.message.indexOf("network") >= 0)) {
        await new Promise(function(res) { setTimeout(res, attempt * 3000); });
      } else throw e;
    }
  }
  throw new Error("Echec apres " + maxRetries + " tentatives");
}
async function aiText(messages, maxTok) {
  var d = await aiCall({ model: AI_MODEL, max_tokens: maxTok || 1000, messages: messages });
  return (d.content || []).map(function(i) { return i.text || ""; }).join("");
}
function safeParseJSON(txt) {
  var patterns = [/```json\s*([\s\S]*?)```/, /```\s*([\s\S]*?)```/, /(\{[\s\S]*\})/];
  for (var pi = 0; pi < patterns.length; pi++) {
    var m = txt.match(patterns[pi]);
    if (m) {
      try { return JSON.parse(m[1] || m[0]); } catch (e) {}
    }
  }
  try { return JSON.parse(txt.trim()); } catch (e) { return null; }
}

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
var DT = { primary: "#F97316", secondary: "#3B82F6", success: "#22C55E", danger: "#EF4444", warning: "#EAB308", bg: "#1C1917", card: "#292524", mid: "#44403C", border: "#57534E", white: "#FAFAF9", muted: "#A8A29E", sidebarWidth: 220, borderRadius: 12, fontFamily: "'Segoe UI',system-ui,sans-serif", companyName: "JEAN BTP SARL", companyAddress: "Zone Industrielle, Abidjan", companyTel: "+225 27 00 00 00", companyEmail: "devis@jeanbtp.ci", companySiret: "CI-ABJ-2024-B-12345" };
var CATS = ["Main d'oeuvre", "Materiaux", "Equipement", "Transport", "Sous-traitance", "Divers"];
var UNITES = ["U", "m2", "ml", "m3", "kg", "t", "forfait", "h", "j", "ens."];
var STATUTS_CH = ["Brouillon", "Planifie", "En cours", "En derive", "En reception", "Cloture"];
var TYPES_INT = ["Urgence", "Preventive", "Corrective", "Inspection"];
var VOIES = ["Appel téléphonique", "SMS", "Email", "WhatsApp", "Visite directe", "Courrier", "Radio", "Application", "Autre"];
var MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
var VOIE_ICO = { "Appel téléphonique": "📞", "SMS": "💬", "Email": "📧", "WhatsApp": "📱", "Visite directe": "🚶", "Courrier": "✉️", "Radio": "📻", "Application": "📲", "Autre": "🔔" };
var VOIE_COL = { "Appel téléphonique": "#22C55E", "SMS": "#3B82F6", "Email": "#F97316", "WhatsApp": "#22C55E", "Visite directe": "#A855F7", "Courrier": "#EAB308", "Radio": "#EF4444", "Application": "#0891B2", "Autre": "#A8A29E" };

// ── HELPERS ───────────────────────────────────────────────────────────────────
function fmt(n) { return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n || 0) + " XOF"; }
function fmtS(n) { var a = Math.abs(n || 0); if (a >= 1e6) return ((n || 0) / 1e6).toFixed(1) + "M"; if (a >= 1e3) return Math.round((n || 0) / 1e3) + "k"; return String(Math.round(n || 0)); }
function pct(v, t) { return t > 0 ? Math.round(v / t * 100) : 0; }
function today() { return new Date().toISOString().slice(0, 10); }
function stC(s, T) { var m = { "En cours": T.secondary, "En derive": T.danger, "Cloture": T.success, "Planifie": T.warning, "En reception": T.primary, "Brouillon": T.muted }; return m[s] || T.muted; }
function catC(c, T) { var m = { "Main d'oeuvre": T.secondary, "Materiaux": T.primary, "Equipement": T.warning, "Transport": T.success, "Sous-traitance": "#A855F7", "Divers": T.muted }; return m[c] || T.muted; }
function totalDep(c) { return (c.depenses || []).reduce(function(a, d) { return a + Number(d.montant || 0); }, 0); }
function totalDepIntv(i) { return (i.depenses || []).reduce(function(a, d) { return a + Number(d.montant || 0); }, 0); }
function parseNum(v) { return parseFloat(String(v || "0").replace(/\s/g, "").replace(",", ".").replace(/[^\d.-]/g, "")) || 0; }

// ── DATA HOOKS ────────────────────────────────────────────────────────────────
function useTheme() {
  var ref = useState(DT), T = ref[0], setT = ref[1];
  return { T: T, upT: function(k, v) { setT(function(p) { var n = Object.assign({}, p); n[k] = v; return n; }); }, resetT: function() { setT(DT); } };
}
function useBP() {
  var ref = useState(function() { var w = window.innerWidth; return w < 480 ? "xs" : w < 768 ? "sm" : w < 1024 ? "md" : "lg"; }), bp = ref[0], setBp = ref[1];
  useEffect(function() { function fn() { var w = window.innerWidth; setBp(w < 480 ? "xs" : w < 768 ? "sm" : w < 1024 ? "md" : "lg"); } window.addEventListener("resize", fn); return function() { window.removeEventListener("resize", fn); }; }, []);
  return { bp: bp, isMobile: bp === "xs" || bp === "sm" };
}
function useChantiers() {
  var r = useState([]), data = r[0], setData = r[1];
  var l = useState(true), loading = l[0], setLoading = l[1];
  var e = useState(null), error = e[0], setError = e[1];
  var load = useCallback(function() {
    setLoading(true); setError(null);
    Promise.all([q("chantiers").order("created_at", { ascending: false }).get(), q("depenses").order("date", { ascending: false }).get()])
      .then(function(res) {
        if (res[0].error) throw new Error(JSON.stringify(res[0].error));
        var ch = res[0].data || [], dep = res[1].data || [];
        setData(ch.map(function(c) { return Object.assign({}, c, { budgetInitial: Number(c.budget_initial || 0), depenses: dep.filter(function(d) { return d.chantier_id === c.id; }).map(function(d) { return Object.assign({}, d, { montant: Number(d.montant || 0) }); }) }); }));
        setLoading(false);
      }).catch(function(e) { setError(e.message); setLoading(false); });
  }, []);
  useEffect(function() { load(); }, []);
  return { data: data, loading: loading, error: error, reload: load };
}
function useInterventions() {
  var r = useState([]), data = r[0], setData = r[1];
  var l = useState(false), loading = l[0], setLoading = l[1];
  var load = useCallback(function() {
    setLoading(true);
    Promise.all([q("interventions").order("created_at", { ascending: false }).get(), q("intervention_depenses").order("date", { ascending: false }).get()])
      .then(function(res) {
        var intv = res[0].data || [], idep = res[1].data || [];
        setData(intv.map(function(i) { return Object.assign({}, i, { depenses: idep.filter(function(d) { return String(d.intervention_id) === String(i.id); }).map(function(d) { return Object.assign({}, d, { montant: Number(d.montant || 0) }); }) }); }));
        setLoading(false);
      }).catch(function(e) { console.error(e); setLoading(false); });
  }, []);
  useEffect(function() { load(); }, []);
  return { data: data, loading: loading, reload: load };
}
function useDebourse() {
  var s = useState([]), sessions = s[0], setSessions = s[1];
  var t = useState([]), taches = t[0], setTaches = t[1];
  var l = useState(true), loading = l[0], setLoading = l[1];
  var load = useCallback(function() {
    setLoading(true);
    Promise.all([q("debourse_sessions").order("created_at", { ascending: false }).get(), q("debourse_taches").order("ordre").get()])
      .then(function(res) { setSessions(res[0].data || []); setTaches(res[1].data || []); setLoading(false); })
      .catch(function() { setLoading(false); });
  }, []);
  useEffect(function() { load(); }, []);
  return { sessions: sessions, taches: taches, loading: loading, reload: load };
}

// ── UI ATOMS ──────────────────────────────────────────────────────────────────
function Badge(p) { return React.createElement("span", { style: { background: p.color + "22", color: p.color, border: "1px solid " + p.color + "55", borderRadius: 6, padding: p.small ? "2px 7px" : "3px 10px", fontSize: p.small ? 10 : 11, fontWeight: 600, whiteSpace: "nowrap" } }, p.label); }
function PBar(p) { return React.createElement("div", { style: { background: "#57534E", borderRadius: 99, height: p.h || 8, overflow: "hidden" } }, React.createElement("div", { style: { width: Math.min(p.p, 100) + "%", background: p.color, height: "100%", borderRadius: 99, transition: "width .4s" } })); }
function Empty(p) { return React.createElement("div", { style: { textAlign: "center", padding: "40px 20px", color: "#A8A29E" } }, React.createElement("div", { style: { fontSize: 40, marginBottom: 12 } }, p.icon), React.createElement("div", { style: { fontSize: 14 } }, p.msg)); }
function Spin() { return React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", height: 80, flexDirection: "column", gap: 8 } }, React.createElement("div", { style: { width: 28, height: 28, border: "3px solid #57534E", borderTopColor: "#F97316", borderRadius: "50%", animation: "spin 1s linear infinite" } }), React.createElement("style", null, "@keyframes spin{to{transform:rotate(360deg)}}")); }
function Kpi(p) {
  return React.createElement("div", { style: { background: p.T.card, border: "1px solid " + p.T.border, borderRadius: p.compact ? 10 : p.T.borderRadius, padding: p.compact ? "10px 12px" : "16px 20px", flex: 1, minWidth: 0 } },
    React.createElement("div", { style: { fontSize: p.compact ? 14 : 20, marginBottom: 2 } }, p.icon),
    React.createElement("div", { style: { fontSize: p.compact ? 13 : 20, fontWeight: 700, color: p.color || p.T.white, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, p.value),
    React.createElement("div", { style: { fontSize: p.compact ? 9 : 11, color: p.T.muted, marginTop: 2 } }, p.label));
}

// Use JSX-free helpers for complex components
function Card(p) {
  var style = { background: p.T.card, border: "1px solid " + p.T.border, borderRadius: p.T.borderRadius, padding: "14px 16px" };
  return (
    <div style={style}>
      {p.title && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 6 }}><div style={{ fontWeight: 700, fontSize: 13 }}>{p.title}</div>{p.action}</div>}
      {p.children}
    </div>
  );
}
function Modal(p) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000099", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: p.T.card, border: "1px solid " + p.T.border, borderRadius: "20px 20px 0 0", padding: "20px 16px", width: "100%", maxWidth: 900, maxHeight: "94vh", overflow: "auto" }}>
        <div style={{ width: 40, height: 4, background: p.T.border, borderRadius: 99, margin: "0 auto 16px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>{p.title}</div>
          <button onClick={p.onClose} style={{ background: "none", border: "none", color: p.T.muted, cursor: "pointer", fontSize: 20 }}>✕</button>
        </div>
        {p.children}
        {p.onSave && <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
          <button onClick={p.onClose} style={{ padding: "9px 18px", background: p.T.mid, color: p.T.white, border: "none", borderRadius: 8, cursor: "pointer" }}>Annuler</button>
          <button onClick={p.onSave} style={{ padding: "9px 18px", background: p.T.primary, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>{p.saveLabel || "Enregistrer"}</button>
        </div>}
      </div>
    </div>
  );
}
function FF(p) {
  var s = { width: "100%", background: p.T.mid, border: "1px solid " + p.T.border, borderRadius: 7, padding: "8px 10px", color: p.T.white, fontSize: 13, boxSizing: "border-box", outline: "none" };
  return (
    <div style={p.full ? { gridColumn: "1/-1" } : {}}>
      <label style={{ fontSize: 10, color: p.T.muted, display: "block", marginBottom: 3 }}>{p.label}</label>
      {p.rows ? <textarea value={p.value || ""} onChange={function(e) { p.onChange(e.target.value); }} rows={p.rows} style={s} placeholder={p.placeholder} /> : <input type={p.type || "text"} value={p.value || ""} onChange={function(e) { p.onChange(e.target.value); }} placeholder={p.placeholder} style={s} />}
    </div>
  );
}
function FS(p) {
  return (
    <div style={p.full ? { gridColumn: "1/-1" } : {}}>
      <label style={{ fontSize: 10, color: p.T.muted, display: "block", marginBottom: 3 }}>{p.label}</label>
      <select value={p.value || ""} onChange={function(e) { p.onChange(e.target.value); }} style={{ width: "100%", background: p.T.mid, border: "1px solid " + p.T.border, borderRadius: 7, padding: "8px 10px", color: p.T.white, fontSize: 13, boxSizing: "border-box", outline: "none" }}>
        {p.options.map(function(o) { return Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o} value={o}>{o}</option>; })}
      </select>
    </div>
  );
}
function FG(p) { return <div style={{ display: "grid", gridTemplateColumns: "repeat(" + (p.cols || 2) + ",1fr)", gap: 10 }}>{p.children}</div>; }

// ── EXPORTS ───────────────────────────────────────────────────────────────────
function exportCSV(rows, filename) {
  var header = Object.keys(rows[0]).join(";");
  var body = rows.map(function(r) { return Object.values(r).map(function(v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(";"); }).join("\n");
  var blob = new Blob(["\uFEFF" + header + "\n" + body], { type: "text/csv;charset=utf-8;" });
  var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
}
function exportIntvCSV(data, label) {
  if (!data.length) { alert("Aucune intervention."); return; }
  exportCSV(data.map(function(i) { var cout = totalDepIntv(i); var facture = parseFloat(i.montant_facture || 0); return { Titre: i.titre, Type: i.type, Client: i.client || "", VoieReception: i.voie_reception || "", Intervenant: i.intervenant || "", Chantier: i.chantier || "", Date: i.date_creation || "", CoutTotal: cout, MontantFacture: facture || "", Benefice: facture > 0 ? facture - cout : "" }; }), "interventions_" + label + ".csv");
}
function exportDebourseHTML(sess, taches, chNom, T) {
  var rows = taches.map(function(t, i) {
    var bg = i % 2 === 0 ? "#fff" : "#f9f9f9";
    var indent = t.niveau === 2 ? "&nbsp;&nbsp;&nbsp;&nbsp;" : t.niveau === 3 ? "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;" : "";
    return "<tr style='background:" + bg + "'><td>" + (t.num || "") + "</td><td>" + indent + t.libelle + "</td><td style='text-align:center'>" + (t.quantite || "") + "</td><td style='text-align:center'>" + (t.unite || "") + "</td><td style='text-align:right'>" + fmt(t.mo_u || 0) + "</td><td style='text-align:right'>" + fmt(t.mat_u || 0) + "</td><td style='text-align:right'>" + fmt(t.debourse_sec_u || 0) + "</td><td style='text-align:right;font-weight:700;color:" + T.primary + "'>" + fmt(t.prix_vente_total || 0) + "</td></tr>";
  }).join("");
  var tot = taches.filter(function(t) { return t.niveau === 1; }).reduce(function(a, t) { return a + (t.prix_vente_total || 0); }, 0);
  var style = "body{font-family:sans-serif;margin:2cm;font-size:10pt}h1{color:" + T.primary + "}table{width:100%;border-collapse:collapse}th{background:" + T.primary + ";color:#fff;padding:8px;text-align:left}td{padding:6px 8px;border-bottom:1px solid #eee}.tot{background:" + T.primary + ";color:#fff;font-weight:800}";
  var html = "<!DOCTYPE html><html><head><meta charset='utf-8'><title>" + sess.nom + "</title><style>" + style + "</style></head><body><h1>" + sess.nom + "</h1><p>Chantier: <b>" + (chNom || "--") + "</b></p><table><thead><tr><th>N°</th><th>Désignation</th><th>Qté</th><th>Unité</th><th>MO/u</th><th>Mat/u</th><th>DS/u</th><th>PV total</th></tr></thead><tbody>" + rows + "<tr class='tot'><td colspan='7'>TOTAL</td><td>" + fmt(tot) + "</td></tr></tbody></table></body></html>";
  var w = window.open("", "_blank"); w.document.write(html); w.document.close(); setTimeout(function() { w.focus(); w.print(); }, 500);
}

// ── APP ROOT ──────────────────────────────────────────────────────────────────
export default function App() {
  var th = useTheme(), T = th.T, upT = th.upT, resetT = th.resetT;
  var ch = useChantiers(), intv = useInterventions(), db = useDebourse();
  var bp = useBP(), isMobile = bp.isMobile;
  var ps = useState("dashboard"), page = ps[0], setPage = ps[1];
  var ss = useState(null), selId = ss[0], setSelId = ss[1];
  var ds = useState(false), drawerOpen = ds[0], setDrawerOpen = ds[1];
  function navTo(p) { setPage(p); setDrawerOpen(false); }
  function openCh(id) { setSelId(id); setPage("fiche"); setDrawerOpen(false); }
  function reloadAll() { ch.reload(); intv.reload(); db.reload(); }
  var nbInt = intv.data.filter(function(i) { return i.statut === "En cours"; }).length;
  var nav = [{ key: "dashboard", icon: "📊", label: "Dashboard" }, { key: "chantiers", icon: "🏗️", label: "Chantiers" }, { key: "debourse", icon: "🔢", label: "Debours Sec" }, { key: "interventions", icon: "🔧", label: "Interventions", badge: nbInt }, { key: "kpi", icon: "📈", label: "KPIs" }, { key: "ia", icon: "🤖", label: "IA" }, { key: "parametres", icon: "🎨", label: "Apparence" }];
  var selected = ch.data.find(function(c) { return c.id === selId; });
  function NavBtn(np) {
    var n = np.n, active = page === n.key || (page === "fiche" && n.key === "chantiers");
    return <button onClick={function() { navTo(n.key); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: bp.bp === "md" ? 0 : 10, padding: "10px", borderRadius: 8, border: "none", background: active ? T.primary + "22" : "transparent", color: active ? T.primary : T.muted, cursor: "pointer", marginBottom: 2, justifyContent: bp.bp === "md" ? "center" : "flex-start", position: "relative", fontFamily: T.fontFamily }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>{n.icon}</span>
      {bp.bp !== "md" && <span style={{ fontSize: 13, fontWeight: active ? 700 : 400, flex: 1 }}>{n.label}</span>}
      {n.badge > 0 && <span style={{ position: "absolute", top: 4, right: 4, background: T.danger, color: "#fff", borderRadius: 99, fontSize: 9, padding: "1px 5px", fontWeight: 700 }}>{n.badge}</span>}
    </button>;
  }
  return (
    <div style={{ display: "flex", height: "100vh", background: T.bg, color: T.white, fontFamily: T.fontFamily, overflow: "hidden" }}>
      <style>{"*{box-sizing:border-box;}input,select,textarea{font-size:16px!important;font-family:inherit;}"}</style>
      {!isMobile && <div style={{ width: bp.bp === "md" ? 60 : T.sidebarWidth, background: T.card, borderRight: "1px solid " + T.border, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "16px 12px 14px", borderBottom: "1px solid " + T.border, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ background: T.primary, borderRadius: 10, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>🏗</div>
          {bp.bp !== "md" && <div style={{ fontWeight: 700, fontSize: 12, lineHeight: 1.3 }}>{T.companyName}</div>}
        </div>
        <nav style={{ flex: 1, padding: "10px 8px", overflowY: "auto" }}>{nav.map(function(n) { return <NavBtn key={n.key} n={n} />; })}</nav>
        {bp.bp !== "md" && <div style={{ padding: 8, borderTop: "1px solid " + T.border }}><button onClick={reloadAll} style={{ width: "100%", background: T.secondary + "22", border: "1px solid " + T.secondary + "44", color: T.secondary, borderRadius: 8, padding: 8, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>↺ Sync</button></div>}
      </div>}
      <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", paddingBottom: isMobile ? 64 : 0 }}>
        <div style={{ background: T.card, borderBottom: "1px solid " + T.border, padding: isMobile ? "10px 14px" : "10px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, position: "sticky", top: 0, zIndex: 50 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {isMobile && <button onClick={function() { setDrawerOpen(true); }} style={{ background: "none", border: "none", color: T.muted, fontSize: 22, cursor: "pointer" }}>☰</button>}
            <div style={{ fontSize: isMobile ? 14 : 15, fontWeight: 700 }}>{page === "fiche" && selected ? "🏗️ " + selected.nom : (nav.find(function(n) { return n.key === page; }) || { icon: "", label: "" }).label}</div>
          </div>
          <button onClick={reloadAll} style={{ background: T.secondary + "22", border: "1px solid " + T.secondary + "44", color: T.secondary, borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>↺</button>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: isMobile ? "10px" : "20px" }}>
          {ch.error ? <div style={{ background: T.danger + "11", border: "1px solid " + T.danger + "44", borderRadius: 12, padding: 24, textAlign: "center" }}><div style={{ color: T.danger, fontWeight: 700, marginBottom: 8 }}>Erreur Supabase</div><div style={{ color: T.muted, fontSize: 12, marginBottom: 14 }}>{ch.error}</div><button onClick={reloadAll} style={{ background: T.primary, color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontWeight: 700, cursor: "pointer" }}>Reessayer</button></div> : <>
            {page === "dashboard" && <Dashboard ch={ch.data} intv={intv.data} openCh={openCh} T={T} />}
            {page === "chantiers" && <Chantiers ch={ch.data} openCh={openCh} reload={ch.reload} T={T} />}
            {page === "fiche" && selected && <Fiche chantier={selected} setPage={setPage} reload={ch.reload} T={T} />}
            {page === "debourse" && <Debourse sessions={db.sessions} taches={db.taches} ch={ch.data} reload={db.reload} T={T} />}
            {page === "interventions" && <Interventions intv={intv.data} ch={ch.data} reload={intv.reload} T={T} />}
            {page === "kpi" && <KpiPage ch={ch.data} intv={intv.data} T={T} />}
            {page === "ia" && <IA ch={ch.data} intv={intv.data} T={T} />}
            {page === "parametres" && <Parametres T={T} upT={upT} resetT={resetT} />}
          </>}
        </div>
      </div>
      {isMobile && <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: T.card, borderTop: "1px solid " + T.border, display: "flex", justifyContent: "space-around", padding: "5px 0", zIndex: 100 }}>
        {nav.slice(0, 5).map(function(n) { var active = page === n.key; return <button key={n.key} onClick={function() { navTo(n.key); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, background: "none", border: "none", color: active ? T.primary : T.muted, cursor: "pointer", padding: "3px 4px", position: "relative", minWidth: 44 }}><span style={{ fontSize: 19 }}>{n.icon}</span><span style={{ fontSize: 8, fontWeight: active ? 700 : 400 }}>{n.label}</span>{n.badge > 0 && <span style={{ position: "absolute", top: 0, right: 0, background: T.danger, color: "#fff", borderRadius: 99, fontSize: 8, padding: "1px 4px", fontWeight: 700 }}>{n.badge}</span>}</button>; })}
        <button onClick={function() { setDrawerOpen(true); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, background: "none", border: "none", color: T.muted, cursor: "pointer", padding: "3px 4px", minWidth: 44 }}><span style={{ fontSize: 19 }}>☰</span><span style={{ fontSize: 8 }}>Plus</span></button>
      </div>}
      {isMobile && drawerOpen && <>
        <div onClick={function() { setDrawerOpen(false); }} style={{ position: "fixed", inset: 0, background: "#0007", zIndex: 150 }} />
        <div style={{ position: "fixed", left: 0, top: 0, bottom: 0, width: 270, background: T.card, borderRight: "1px solid " + T.border, zIndex: 151, padding: "48px 12px 12px", overflowY: "auto" }}>
          <button onClick={function() { setDrawerOpen(false); }} style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", color: T.muted, fontSize: 22, cursor: "pointer" }}>✕</button>
          <div style={{ padding: "0 8px 14px", marginBottom: 8, borderBottom: "1px solid " + T.border }}><div style={{ fontWeight: 700, fontSize: 15 }}>{T.companyName}</div></div>
          {nav.map(function(n) { return <NavBtn key={n.key} n={n} />; })}
        </div>
      </>}
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function Dashboard(p) {
  var ch = p.ch, intv = p.intv, openCh = p.openCh, T = p.T, isMobile = useBP().isMobile;
  var totalB = ch.reduce(function(a, c) { return a + c.budgetInitial; }, 0);
  var totalD = ch.reduce(function(a, c) { return a + totalDep(c); }, 0);
  var pc = pct(totalD, totalB);
  var pieData = [{ name: "En cours", value: ch.filter(function(c) { return c.statut === "En cours"; }).length, color: T.secondary }, { name: "En derive", value: ch.filter(function(c) { return c.statut === "En derive"; }).length, color: T.danger }, { name: "Planifie", value: ch.filter(function(c) { return c.statut === "Planifie"; }).length, color: T.warning }, { name: "Cloture", value: ch.filter(function(c) { return c.statut === "Cloture"; }).length, color: T.success }].filter(function(d) { return d.value > 0; });
  var actifs = ch.filter(function(c) { return c.statut !== "Cloture" && c.statut !== "Brouillon"; });
  return <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 8 }}>
      <Kpi icon="🏗️" label="Chantiers" value={ch.length} color={T.primary} compact={isMobile} T={T} />
      <Kpi icon="💰" label="Budget total" value={fmtS(totalB)} compact={isMobile} T={T} />
      <Kpi icon="📊" label="Consomme" value={pc + "%"} color={pc > 80 ? T.danger : T.success} compact={isMobile} T={T} />
      <Kpi icon="🔧" label="Interv. actives" value={intv.filter(function(i) { return i.statut === "En cours"; }).length} color={T.secondary} compact={isMobile} T={T} />
    </div>
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
      <Card title="Statuts chantiers" T={T}>{pieData.length > 0 ? <ResponsiveContainer width="100%" height={160}><PieChart><Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={60} label={function(e) { return e.name + " (" + e.value + ")"; }}>{pieData.map(function(d, i) { return <Cell key={i} fill={d.color} />; })}</Pie><Tooltip contentStyle={{ background: T.card, border: "1px solid " + T.border, color: T.white }} /></PieChart></ResponsiveContainer> : <Empty msg="Aucun chantier" icon="🏗️" />}</Card>
      <Card title="Chantiers actifs" T={T}>{actifs.slice(0, 5).map(function(c) { var d = totalDep(c), p2 = pct(d, c.budgetInitial); return <div key={c.id} onClick={function() { openCh(c.id); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid " + T.border, cursor: "pointer" }}><div style={{ flex: 2 }}><div style={{ fontWeight: 600, fontSize: 13 }}>{c.nom}</div><div style={{ fontSize: 11, color: T.muted }}>{c.client}</div></div><div style={{ flex: 1 }}><PBar p={p2} color={p2 > 100 ? T.danger : p2 > 80 ? T.warning : T.success} h={6} /><div style={{ fontSize: 10, color: T.muted, textAlign: "right", marginTop: 2 }}>{p2}%</div></div></div>; })} {actifs.length === 0 && <Empty msg="Aucun chantier actif" icon="🏗️" />}</Card>
    </div>
  </div>;
}

// ── CHANTIERS ─────────────────────────────────────────────────────────────────
function Chantiers(p) {
  var ch = p.ch, openCh = p.openCh, reload = p.reload, T = p.T, isMobile = useBP().isMobile;
  var fs = useState("Tous"), filter = fs[0], setFilter = fs[1];
  var ns = useState(false), showNew = ns[0], setShowNew = ns[1];
  var sv = useState(false), saving = sv[0], setSaving = sv[1];
  var fm = useState({ nom: "", client: "", localisation: "", type: "Construction", budget_initial: "", date_debut: "", date_fin: "" }), form = fm[0], setForm = fm[1];
  function up(k, v) { setForm(function(p2) { var n = Object.assign({}, p2); n[k] = v; return n; }); }
  function save() { if (!form.nom || !form.budget_initial) return; setSaving(true); q("chantiers").insert({ nom: form.nom, client: form.client, localisation: form.localisation, type: form.type, budget_initial: parseFloat(form.budget_initial), date_debut: form.date_debut || null, date_fin: form.date_fin || null, statut: "Brouillon" }).then(function() { setSaving(false); setShowNew(false); reload(); }); }
  function del(id) { if (!window.confirm("Supprimer ?")) return; q("chantiers").eq("id", id).del().then(function() { reload(); }); }
  var filtered = filter === "Tous" ? ch : ch.filter(function(c) { return c.statut === filter; });
  return <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    <div style={{ display: "flex", gap: 6, justifyContent: "space-between", flexWrap: "wrap", alignItems: "center" }}>
      <div style={{ display: "flex", gap: 4, overflowX: "auto" }}>{["Tous"].concat(STATUTS_CH).map(function(s) { return <button key={s} onClick={function() { setFilter(s); }} style={{ padding: "5px 10px", borderRadius: 20, border: "1px solid " + (filter === s ? T.primary : T.border), background: filter === s ? T.primary : "transparent", color: filter === s ? "#fff" : T.muted, cursor: "pointer", fontSize: 11, whiteSpace: "nowrap", flexShrink: 0 }}>{s}</button>; })}</div>
      <button onClick={function() { setShowNew(true); }} style={{ background: T.primary, color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>+ Nouveau</button>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill,minmax(280px,1fr))", gap: 12 }}>
      {filtered.map(function(c) { var d = totalDep(c), pp = pct(d, c.budgetInitial); return <div key={c.id} onClick={function() { openCh(c.id); }} style={{ background: T.card, border: "1px solid " + (pp > 100 ? T.danger + "66" : T.border), borderRadius: T.borderRadius, padding: 14, cursor: "pointer", position: "relative" }}><button onClick={function(e) { e.stopPropagation(); del(c.id); }} style={{ position: "absolute", top: 10, right: 10, background: T.danger + "22", border: "1px solid " + T.danger + "44", color: T.danger, borderRadius: 6, padding: "2px 8px", fontSize: 10, cursor: "pointer" }}>✕</button><div style={{ marginBottom: 8, paddingRight: 50 }}><div style={{ fontWeight: 700, fontSize: 14 }}>{c.nom}</div><div style={{ fontSize: 11, color: T.muted }}>{c.client} - {c.localisation}</div></div><div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}><Badge label={c.statut} color={stC(c.statut, T)} /><Badge label={c.type} color={T.primary} small /></div><div style={{ marginBottom: 4 }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}><span style={{ color: T.muted }}>Budget</span><span style={{ fontWeight: 700, color: pp > 100 ? T.danger : pp > 80 ? T.warning : T.success }}>{pp}%</span></div><PBar p={pp} color={pp > 100 ? T.danger : pp > 80 ? T.warning : T.success} /></div><div style={{ marginTop: 6, fontSize: 11, color: T.muted }}>{fmtS(d)} / {fmtS(c.budgetInitial)} XOF</div></div>; })}
    </div>
    {filtered.length === 0 && <Empty msg="Aucun chantier" icon="🏗️" />}
    {showNew && <Modal title="Nouveau chantier" onClose={function() { setShowNew(false); }} onSave={save} T={T}>{saving ? <Spin /> : <FG cols={2}><FF label="Nom *" value={form.nom} onChange={function(v) { up("nom", v); }} full T={T} /><FF label="Client" value={form.client} onChange={function(v) { up("client", v); }} T={T} /><FS label="Type" value={form.type} onChange={function(v) { up("type", v); }} options={["Construction", "Rehabilitation", "Maintenance", "VRD", "Genie Civil"]} T={T} /><FF label="Localisation" value={form.localisation} onChange={function(v) { up("localisation", v); }} T={T} /><FF label="Budget (XOF) *" type="number" value={form.budget_initial} onChange={function(v) { up("budget_initial", v); }} full T={T} /><FF label="Date debut" type="date" value={form.date_debut} onChange={function(v) { up("date_debut", v); }} T={T} /><FF label="Date fin prevue" type="date" value={form.date_fin} onChange={function(v) { up("date_fin", v); }} T={T} /></FG>}</Modal>}
  </div>;
}

// ── FICHE CHANTIER ────────────────────────────────────────────────────────────
function Fiche(p) {
  var c = p.chantier, setPage = p.setPage, reload = p.reload, T = p.T, isMobile = useBP().isMobile;
  var ts = useState("infos"), tab = ts[0], setTab = ts[1];
  var sd = useState(false), showDep = sd[0], setShowDep = sd[1];
  var fd = useState({ libelle: "", categorie: "Main d'oeuvre", montant: "", date: today(), note: "" }), fDep = fd[0], setFDep = fd[1];
  var sv = useState(false), saving = sv[0], setSaving = sv[1];
  var dep = totalDep(c), dp = pct(dep, c.budgetInitial);
  function changeSt(st) { q("chantiers").eq("id", c.id).update({ statut: st }).then(function() { reload(); }); }
  function addDep() { if (!fDep.libelle || !fDep.montant) return; setSaving(true); q("depenses").insert({ chantier_id: c.id, libelle: fDep.libelle, categorie: fDep.categorie, montant: parseFloat(fDep.montant), date: fDep.date, note: fDep.note }).then(function() { setSaving(false); setShowDep(false); reload(); }); }
  function delDep(id) { q("depenses").eq("id", id).del().then(function() { reload(); }); }
  return <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
    <button onClick={function() { setPage("chantiers"); }} style={{ background: "none", border: "none", color: T.primary, cursor: "pointer", fontSize: 13, marginBottom: 10, textAlign: "left", padding: 0 }}>← Retour</button>
    <div style={{ background: T.card, border: "1px solid " + T.border, borderRadius: T.borderRadius, padding: isMobile ? 14 : 18, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 10, flexWrap: "wrap" }}><div style={{ flex: 1 }}><div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 800 }}>{c.nom}</div><div style={{ color: T.muted, fontSize: 11, marginTop: 3 }}>{c.client} - {c.localisation}</div></div><div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{STATUTS_CH.map(function(st) { return <button key={st} onClick={function() { changeSt(st); }} style={{ padding: "4px 8px", borderRadius: 20, border: "1px solid " + (c.statut === st ? stC(st, T) : T.border), background: c.statut === st ? stC(st, T) + "22" : "transparent", color: c.statut === st ? stC(st, T) : T.muted, cursor: "pointer", fontSize: 10 }}>{st}</button>; })}</div></div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}><Badge label={c.statut} color={stC(c.statut, T)} /><Badge label={c.type} color={T.primary} small /></div>
    </div>
    <div style={{ display: "flex", gap: 4, marginBottom: 14, overflowX: "auto" }}>{[["infos", "Infos"], ["depenses", "Dépenses (" + c.depenses.length + ")"]].map(function(o) { return <button key={o[0]} onClick={function() { setTab(o[0]); }} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid " + (tab === o[0] ? T.primary : T.border), background: tab === o[0] ? T.primary : T.card, color: tab === o[0] ? "#fff" : T.muted, cursor: "pointer", fontSize: 12, fontWeight: tab === o[0] ? 700 : 400 }}>{o[1]}</button>; })}</div>
    {tab === "infos" && <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
      <Card title="Informations" T={T}>{[["Nom", c.nom], ["Client", c.client], ["Localisation", c.localisation], ["Type", c.type], ["Debut", c.date_debut || "-"], ["Fin prevue", c.date_fin || "-"]].map(function(row) { return <div key={row[0]} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid " + T.border, fontSize: 12 }}><span style={{ color: T.muted }}>{row[0]}</span><span style={{ fontWeight: 600 }}>{row[1]}</span></div>; })}</Card>
      <Card title="Budget" T={T}><div style={{ marginBottom: 12 }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}><span style={{ color: T.muted }}>Avancement</span><strong style={{ color: dp > 100 ? T.danger : dp > 80 ? T.warning : T.success }}>{dp}%</strong></div><PBar p={dp} color={dp > 100 ? T.danger : dp > 80 ? T.warning : T.success} h={12} /></div>{[["Budget initial", fmt(c.budgetInitial), T.white], ["Depenses", fmt(dep), T.warning], ["Marge", fmt(c.budgetInitial - dep), c.budgetInitial - dep >= 0 ? T.success : T.danger]].map(function(row) { return <div key={row[0]} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid " + T.border, fontSize: 12 }}><span style={{ color: T.muted }}>{row[0]}</span><span style={{ fontWeight: 700, color: row[2] }}>{row[1]}</span></div>; })}</Card>
    </div>}
    {tab === "depenses" && <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}><button onClick={function() { setShowDep(true); }} style={{ background: T.primary, color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>+ Dépense</button></div>
      {c.depenses.length === 0 && <Empty msg="Aucune depense" icon="🧾" />}
      {c.depenses.map(function(d) { return <div key={d.id} style={{ background: T.card, border: "1px solid " + T.border, borderRadius: 9, padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}><div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 13 }}>{d.libelle}</div><div style={{ display: "flex", gap: 6, marginTop: 4 }}><Badge label={d.categorie} color={catC(d.categorie, T)} small /><span style={{ fontSize: 10, color: T.muted }}>{d.date}</span></div></div><div style={{ display: "flex", gap: 6, alignItems: "center" }}><span style={{ fontWeight: 800, color: T.primary, fontSize: 13 }}>{fmt(d.montant)}</span><button onClick={function() { delDep(d.id); }} style={{ background: T.danger + "22", border: "1px solid " + T.danger + "44", color: T.danger, borderRadius: 5, padding: "3px 7px", fontSize: 10, cursor: "pointer" }}>✕</button></div></div>; })}
      {showDep && <Modal title="Nouvelle depense" onClose={function() { setShowDep(false); }} onSave={addDep} T={T}>{saving ? <Spin /> : <FG cols={2}><FF label="Libelle *" value={fDep.libelle} onChange={function(v) { setFDep(function(pp) { var n = Object.assign({}, pp); n.libelle = v; return n; }); }} full T={T} /><FS label="Categorie" value={fDep.categorie} onChange={function(v) { setFDep(function(pp) { var n = Object.assign({}, pp); n.categorie = v; return n; }); }} options={CATS} T={T} /><FF label="Montant (XOF)" type="number" value={fDep.montant} onChange={function(v) { setFDep(function(pp) { var n = Object.assign({}, pp); n.montant = v; return n; }); }} T={T} /><FF label="Date" type="date" value={fDep.date} onChange={function(v) { setFDep(function(pp) { var n = Object.assign({}, pp); n.date = v; return n; }); }} T={T} /><FF label="Note" value={fDep.note} onChange={function(v) { setFDep(function(pp) { var n = Object.assign({}, pp); n.note = v; return n; }); }} full T={T} /></FG>}</Modal>}
    </div>}
  </div>;
}

// ══════════════════════════════════════════════════════════════════════════════
// ── DEBOURS SEC — REFONTE COMPLÈTE ───────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

// Calcul prix vente à partir du debours sec + coefficients
function calcPV(ds, cfg) {
  var fg = ds * (cfg.fg / 100);
  var pr = ds + fg;
  var pv = pr * (1 + cfg.benef / 100);
  return { fg: fg, pr: pr, pv: pv };
}

// Recalcule les numéros en fonction de la hiérarchie
function renum(taches) {
  var catIdx = 0, ssIdx = 0, lineIdx = 0;
  return taches.map(function(t) {
    var n = Object.assign({}, t);
    if (t.niveau === 1) { catIdx++; ssIdx = 0; lineIdx = 0; n.num = String(catIdx); }
    else if (t.niveau === 2) { ssIdx++; lineIdx = 0; n.num = catIdx + "." + ssIdx; }
    else { lineIdx++; n.num = catIdx + "." + ssIdx + "." + lineIdx; }
    return n;
  });
}

function Debourse(p) {
  var sessions = p.sessions, taches = p.taches, ch = p.ch, reload = p.reload, T = p.T, isMobile = useBP().isMobile;
  var ss = useState(null), selSid = ss[0], setSelSid = ss[1];
  var ns = useState(false), showNew = ns[0], setShowNew = ns[1];
  var sf = useState({ nom: "", chantier_id: "", taux_charges: 40, coeff_fg: 15, coeff_benef: 10 }), sForm = sf[0], setSForm = sf[1];
  var sv = useState(false), saving = sv[0], setSaving = sv[1];
  var en = useState(null), editNom = en[0], setEditNom = en[1]; // id of session being renamed
  var nv = useState(""), newNom = nv[0], setNewNom = nv[1];
  var selSess = sessions.find(function(s) { return s.id === selSid; });
  var selTaches = selSid ? taches.filter(function(t) { return t.session_id === selSid; }) : [];

  function saveSession() {
    if (!sForm.nom) return; setSaving(true);
    q("debourse_sessions").insert({ nom: sForm.nom, chantier_id: sForm.chantier_id || null, taux_charges: parseFloat(sForm.taux_charges), coeff_fg: parseFloat(sForm.coeff_fg), coeff_benef: parseFloat(sForm.coeff_benef) })
      .then(function(r) { setSaving(false); setShowNew(false); reload(); if (r.data) setSelSid(r.data.id); });
  }
  function delSession(id) {
    if (!window.confirm("Supprimer ce projet de débours ?")) return;
    q("debourse_taches").eq("session_id", id).del().then(function() { q("debourse_sessions").eq("id", id).del().then(function() { setSelSid(null); reload(); }); });
  }
  function renameSession(id) {
    if (!newNom.trim()) return;
    q("debourse_sessions").eq("id", id).update({ nom: newNom.trim() }).then(function() { setEditNom(null); reload(); });
  }
  function updateCfg(id, k, v) { var u = {}; u[k] = parseFloat(v) || 0; q("debourse_sessions").eq("id", id).update(u).then(function() { reload(); }); }

  return <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    {/* Session list */}
    <Card title="Projets de Débours Sec" action={<button onClick={function() { setShowNew(true); }} style={{ background: T.primary, color: "#fff", border: "none", borderRadius: 7, padding: "6px 12px", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>+ Nouveau</button>} T={T}>
      {sessions.length === 0 ? <Empty msg="Aucun projet" icon="🔢" /> :
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
          {sessions.map(function(s) {
            var sts = taches.filter(function(t) { return t.session_id === s.id; });
            var tot = sts.filter(function(t) { return t.niveau === 1; }).reduce(function(a, t) { return a + (t.prix_vente_total || 0); }, 0);
            var active = selSid === s.id;
            return <div key={s.id} style={{ background: active ? T.primary + "22" : T.mid, border: "2px solid " + (active ? T.primary : T.border), borderRadius: 10, padding: "10px 14px", cursor: "pointer", minWidth: 170, flexShrink: 0 }}>
              {editNom === s.id ? <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <input value={newNom} onChange={function(e) { setNewNom(e.target.value); }} autoFocus style={{ background: T.mid, border: "1px solid " + T.primary, borderRadius: 5, padding: "4px 7px", color: T.white, fontSize: 12, outline: "none" }} />
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={function() { renameSession(s.id); }} style={{ flex: 1, background: T.success, color: "#fff", border: "none", borderRadius: 5, padding: "3px", fontSize: 10, cursor: "pointer" }}>✔</button>
                  <button onClick={function() { setEditNom(null); }} style={{ background: T.mid, color: T.muted, border: "none", borderRadius: 5, padding: "3px 6px", fontSize: 10, cursor: "pointer" }}>✕</button>
                </div>
              </div> : <>
                <div onClick={function() { setSelSid(s.id); }} style={{ fontWeight: 700, fontSize: 12, color: active ? T.primary : T.white, marginBottom: 4 }}>{s.nom}</div>
                <div style={{ fontSize: 10, color: T.muted }}>{sts.length} ligne(s)</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.success, marginTop: 3 }}>{fmtS(tot)} XOF</div>
                <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                  <button onClick={function() { setEditNom(s.id); setNewNom(s.nom); }} style={{ flex: 1, background: T.warning + "22", color: T.warning, border: "1px solid " + T.warning + "44", borderRadius: 5, padding: "3px", fontSize: 9, cursor: "pointer" }}>✏️</button>
                  <button onClick={function() { setSelSid(s.id); }} style={{ flex: 1, background: T.secondary + "22", color: T.secondary, border: "none", borderRadius: 5, padding: "3px", fontSize: 9, cursor: "pointer" }}>Ouvrir</button>
                  <button onClick={function() { delSession(s.id); }} style={{ background: T.danger + "22", color: T.danger, border: "1px solid " + T.danger + "44", borderRadius: 5, padding: "3px 6px", fontSize: 9, cursor: "pointer" }}>🗑</button>
                </div>
              </>}
            </div>;
          })}
        </div>}
    </Card>

    {selSess && <DebourseEditor sess={selSess} taches={selTaches} ch={ch} reload={reload} T={T} isMobile={isMobile} updateCfg={updateCfg} />}

    {showNew && <Modal title="Nouveau projet Débours" onClose={function() { setShowNew(false); }} onSave={saveSession} T={T}>
      {saving ? <Spin /> : <FG cols={2}>
        <FF label="Nom du projet *" value={sForm.nom} onChange={function(v) { setSForm(function(pp) { var n = Object.assign({}, pp); n.nom = v; return n; }); }} full T={T} />
        <FS label="Chantier lié" value={sForm.chantier_id} onChange={function(v) { setSForm(function(pp) { var n = Object.assign({}, pp); n.chantier_id = v; return n; }); }} options={[["", "- Aucun -"]].concat(ch.map(function(c) { return [c.id, c.nom]; }))} full T={T} />
        <FF label="Charges sociales (%)" type="number" value={sForm.taux_charges} onChange={function(v) { setSForm(function(pp) { var n = Object.assign({}, pp); n.taux_charges = v; return n; }); }} T={T} />
        <FF label="Frais généraux (%)" type="number" value={sForm.coeff_fg} onChange={function(v) { setSForm(function(pp) { var n = Object.assign({}, pp); n.coeff_fg = v; return n; }); }} T={T} />
        <FF label="Bénéfice (%)" type="number" value={sForm.coeff_benef} onChange={function(v) { setSForm(function(pp) { var n = Object.assign({}, pp); n.coeff_benef = v; return n; }); }} T={T} />
      </FG>}
    </Modal>}
  </div>;
}

// ── DEBOURS EDITOR ────────────────────────────────────────────────────────────
function DebourseEditor(p) {
  var sess = p.sess, rawTaches = p.taches, ch = p.ch, reload = p.reload, T = p.T, isMobile = p.isMobile, updateCfg = p.updateCfg;
  var cfg = { tc: sess.taux_charges || 40, fg: sess.coeff_fg || 15, benef: sess.coeff_benef || 10 };
  var taches = renum(rawTaches.slice().sort(function(a, b) { return (a.ordre || 0) - (b.ordre || 0); }));
  var chNom = (ch.find(function(c) { return c.id === sess.chantier_id; }) || {}).nom || "";

  // State
  var sa = useState(false), showAdd = sa[0], setShowAdd = sa[1];
  var si = useState(false), showImport = si[0], setShowImport = si[1];
  var sia = useState(false), showIA = sia[0], setShowIA = sia[1];
  var eid = useState(null), editId = eid[0], setEditId = eid[1];
  var er = useState({}), editRow = er[0], setEditRow = er[1];
  var af = useState({ libelle: "", unite: "U", quantite: "", mo_u: "", mat_u: "", autres_u: "", niveau: 3, cat_parent: "", ss_parent: "" }), addForm = af[0], setAddForm = af[1];
  var sv = useState(false), saving = sv[0], setSaving = sv[1];

  // Totaux par catégorie (niveau 1)
  var cats = taches.filter(function(t) { return t.niveau === 1; });
  var grandTotal = cats.reduce(function(a, t) { return a + (t.prix_vente_total || 0); }, 0);
  var grandDS = taches.filter(function(t) { return t.niveau === 3; }).reduce(function(a, t) { return a + (t.debourse_sec_u || 0) * (t.quantite || 0); }, 0);

  function startEdit(t) { setEditId(t.id); setEditRow({ libelle: t.libelle, unite: t.unite || "U", quantite: t.quantite || 0, mo_u: t.mo_u || 0, mat_u: t.mat_u || 0, autres_u: t.autres_u || 0, niveau: t.niveau }); }
  function cancelEdit() { setEditId(null); setEditRow({}); }

  function computeLine(mo, mat, autres, qte, cfg2) {
    var ds = (parseFloat(mo) || 0) * (1 + cfg2.tc / 100) + (parseFloat(mat) || 0) + (parseFloat(autres) || 0);
    var pv = calcPV(ds, cfg2);
    return { ds: ds, pv_u: pv.pv, pvt: pv.pv * (parseFloat(qte) || 0) };
  }

  async function saveEdit(id, row) {
    var c = computeLine(row.mo_u, row.mat_u, row.autres_u, row.quantite, cfg);
    await q("debourse_taches").eq("id", id).update({
      libelle: row.libelle, unite: row.unite, quantite: parseFloat(row.quantite) || 0,
      mo_u: parseFloat(row.mo_u) || 0, mat_u: parseFloat(row.mat_u) || 0, autres_u: parseFloat(row.autres_u) || 0,
      debourse_sec_u: Math.round(c.ds), prix_vente_u: Math.round(c.pv_u), prix_vente_total: Math.round(c.pvt)
    });
    // update parent totals
    await recalcParents(id);
    setEditId(null); setEditRow({}); reload();
  }

  async function recalcParents(changedId) {
    // find the ligne
    var t = rawTaches.find(function(x) { return x.id === changedId; });
    if (!t) return;
    // recalc sous-cat
    if (t.parent_id) {
      var siblings = rawTaches.filter(function(x) { return x.parent_id === t.parent_id; });
      var ssPVT = siblings.reduce(function(a, x) { return a + (x.id === changedId ? computeLine(x.mo_u, x.mat_u, x.autres_u, x.quantite, cfg).pvt : (x.prix_vente_total || 0)); }, 0);
      await q("debourse_taches").eq("id", t.parent_id).update({ prix_vente_total: Math.round(ssPVT) });
      // recalc cat
      var ss = rawTaches.find(function(x) { return x.id === t.parent_id; });
      if (ss && ss.parent_id) {
        var siblings2 = rawTaches.filter(function(x) { return x.parent_id === ss.parent_id; });
        var catPVT = siblings2.reduce(function(a, x) { return a + (x.id === t.parent_id ? ssPVT : (x.prix_vente_total || 0)); }, 0);
        await q("debourse_taches").eq("id", ss.parent_id).update({ prix_vente_total: Math.round(catPVT) });
      }
    }
  }

  async function addLigne() {
    if (!addForm.libelle) return; setSaving(true);
    var niveau = parseInt(addForm.niveau);
    var ordre = rawTaches.length + 1;
    var parent_id = null;
    if (niveau === 2) {
      // find parent cat by num prefix
      var cat = taches.find(function(t) { return t.niveau === 1 && t.libelle === addForm.cat_parent; });
      parent_id = cat ? cat.id : null;
    } else if (niveau === 3) {
      var ss = taches.find(function(t) { return t.niveau === 2 && t.libelle === addForm.ss_parent; });
      parent_id = ss ? ss.id : null;
    }
    var c = niveau === 3 ? computeLine(addForm.mo_u, addForm.mat_u, addForm.autres_u, addForm.quantite, cfg) : { ds: 0, pv_u: 0, pvt: 0 };
    await q("debourse_taches").insert({
      session_id: sess.id, libelle: addForm.libelle, unite: addForm.unite || "U",
      quantite: parseFloat(addForm.quantite) || 0, niveau: niveau, parent_id: parent_id, ordre: ordre,
      mo_u: parseFloat(addForm.mo_u) || 0, mat_u: parseFloat(addForm.mat_u) || 0, autres_u: parseFloat(addForm.autres_u) || 0,
      debourse_sec_u: Math.round(c.ds), prix_vente_u: Math.round(c.pv_u), prix_vente_total: Math.round(c.pvt)
    });
    setSaving(false); setShowAdd(false); reload();
  }

  function delLigne(id) {
    if (!window.confirm("Supprimer ?")) return;
    q("debourse_taches").eq("id", id).del().then(function() { reload(); });
  }

  function upE(k, v) { setEditRow(function(pp) { var n = Object.assign({}, pp); n[k] = v; return n; }); }
  function upA(k, v) { setAddForm(function(pp) { var n = Object.assign({}, pp); n[k] = v; return n; }); }

  var cats1 = taches.filter(function(t) { return t.niveau === 1; });
  var cats2 = taches.filter(function(t) { return t.niveau === 2; });
  var iS = { background: T.bg, border: "1px solid " + T.border, borderRadius: 4, padding: "3px 6px", color: T.white, fontSize: 11, outline: "none", width: "100%" };

  return <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    {/* Coefficients */}
    <Card title={"⚙️ " + sess.nom + (chNom ? " — " + chNom : "")} T={T}>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: 10, marginBottom: 10 }}>
        {[["Charges sociales (%)", "taux_charges", cfg.tc], ["Frais généraux (%)", "coeff_fg", cfg.fg], ["Bénéfice (%)", "coeff_benef", cfg.benef]].map(function(row) {
          return <div key={row[1]}><label style={{ fontSize: 10, color: T.muted, display: "block", marginBottom: 3 }}>{row[0]}</label><input type="number" defaultValue={row[2]} onBlur={function(e) { updateCfg(sess.id, row[1], e.target.value); }} style={{ background: T.mid, border: "1px solid " + T.border, borderRadius: 6, padding: "6px 8px", color: T.white, fontSize: 12, outline: "none", width: "100%" }} /></div>;
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <div style={{ background: T.warning + "11", border: "1px solid " + T.warning + "33", borderRadius: 7, padding: "8px 10px", textAlign: "center" }}><div style={{ fontSize: 9, color: T.muted }}>Débours sec total</div><div style={{ fontWeight: 800, fontSize: 14, color: T.warning }}>{fmtS(grandDS)}</div></div>
        <div style={{ background: T.primary + "11", border: "1px solid " + T.primary + "33", borderRadius: 7, padding: "8px 10px", textAlign: "center" }}><div style={{ fontSize: 9, color: T.muted }}>Prix vente HT</div><div style={{ fontWeight: 800, fontSize: 14, color: T.primary }}>{fmtS(grandTotal)}</div></div>
        <div style={{ background: T.success + "11", border: "1px solid " + T.success + "33", borderRadius: 7, padding: "8px 10px", textAlign: "center" }}><div style={{ fontSize: 9, color: T.muted }}>Marges FG+Bén.</div><div style={{ fontWeight: 800, fontSize: 14, color: T.success }}>{fmtS(grandTotal - grandDS)}</div></div>
      </div>
    </Card>

    {/* Actions */}
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      <button onClick={function() { setShowAdd(true); }} style={{ background: T.primary, color: "#fff", border: "none", borderRadius: 7, padding: "7px 13px", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>+ Ajouter une ligne</button>
      <button onClick={function() { setShowImport(true); }} style={{ background: T.secondary + "22", color: T.secondary, border: "1px solid " + T.secondary + "44", borderRadius: 7, padding: "7px 13px", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>📂 Importer doc</button>
      <button onClick={function() { setShowIA(true); }} style={{ background: "#A855F722", color: "#A855F7", border: "1px solid #A855F744", borderRadius: 7, padding: "7px 13px", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>🤖 IA Ouvrage</button>
      <button onClick={function() { exportDebourseHTML(sess, taches, chNom, T); }} style={{ background: T.success + "22", color: T.success, border: "1px solid " + T.success + "44", borderRadius: 7, padding: "7px 13px", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>📄 PDF</button>
    </div>

    {/* Tableau hiérarchique */}
    {taches.length === 0 ? <Empty msg="Aucune ligne — ajoutez des catégories, sous-catégories et postes" icon="📋" /> :
      <div style={{ background: T.card, border: "1px solid " + T.border, borderRadius: T.borderRadius, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, minWidth: 700 }}>
            <thead>
              <tr style={{ background: T.primary }}>
                {["N°", "Désignation", "Qté", "Un.", "MO/u (DS)", "Mat/u", "Autres/u", "DS/u", "PV total", ""].map(function(h, i) {
                  return <th key={i} style={{ padding: "8px", textAlign: i > 3 ? "right" : "left", color: "#fff", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>;
                })}
              </tr>
            </thead>
            <tbody>
              {taches.map(function(t) {
                var isCat = t.niveau === 1, isSS = t.niveau === 2, isLine = t.niveau === 3;
                var bgRow = isCat ? T.primary + "22" : isSS ? T.mid + "aa" : "transparent";
                var c = isLine ? computeLine(t.mo_u || 0, t.mat_u || 0, t.autres_u || 0, t.quantite || 0, cfg) : null;
                var isEdit = editId === t.id;
                return <tr key={t.id} style={{ background: isEdit ? T.warning + "11" : bgRow, borderBottom: "1px solid " + T.border + "55" }}>
                  <td style={{ padding: "5px 8px", fontSize: 10, color: T.muted, fontWeight: 700, whiteSpace: "nowrap" }}>{t.num}</td>
                  {isEdit ? <>
                    <td style={{ padding: "3px 5px" }}><input value={editRow.libelle || ""} onChange={function(e) { upE("libelle", e.target.value); }} style={Object.assign({}, iS, { minWidth: 120 })} /></td>
                    <td style={{ padding: "3px 5px" }}>{isLine && <input type="number" value={editRow.quantite || ""} onChange={function(e) { upE("quantite", e.target.value); }} style={Object.assign({}, iS, { width: 55, textAlign: "right" })} />}</td>
                    <td style={{ padding: "3px 5px" }}>{isLine && <select value={editRow.unite || "U"} onChange={function(e) { upE("unite", e.target.value); }} style={Object.assign({}, iS, { width: 60 })}>{UNITES.map(function(u) { return <option key={u} value={u}>{u}</option>; })}</select>}</td>
                    <td style={{ padding: "3px 5px" }}>{isLine && <input type="number" value={editRow.mo_u || ""} onChange={function(e) { upE("mo_u", e.target.value); }} style={Object.assign({}, iS, { width: 75, textAlign: "right" })} />}</td>
                    <td style={{ padding: "3px 5px" }}>{isLine && <input type="number" value={editRow.mat_u || ""} onChange={function(e) { upE("mat_u", e.target.value); }} style={Object.assign({}, iS, { width: 75, textAlign: "right" })} />}</td>
                    <td style={{ padding: "3px 5px" }}>{isLine && <input type="number" value={editRow.autres_u || ""} onChange={function(e) { upE("autres_u", e.target.value); }} style={Object.assign({}, iS, { width: 75, textAlign: "right" })} />}</td>
                    <td colSpan={2} style={{ padding: "3px 5px", textAlign: "right", color: T.muted, fontSize: 10 }}>{isLine && ("DS: " + fmtS(computeLine(editRow.mo_u || 0, editRow.mat_u || 0, editRow.autres_u || 0, editRow.quantite || 0, cfg).ds))}</td>
                    <td style={{ padding: "3px 5px", whiteSpace: "nowrap" }}>
                      <button onClick={function() { saveEdit(t.id, editRow); }} style={{ background: T.success, color: "#fff", border: "none", borderRadius: 4, padding: "3px 7px", fontSize: 10, cursor: "pointer", marginRight: 3 }}>✔</button>
                      <button onClick={cancelEdit} style={{ background: T.danger + "22", color: T.danger, border: "none", borderRadius: 4, padding: "3px 6px", fontSize: 10, cursor: "pointer" }}>✕</button>
                    </td>
                  </> : <>
                    <td style={{ padding: "5px 8px", fontWeight: isCat ? 800 : isSS ? 700 : 400, fontSize: isCat ? 12 : 11, paddingLeft: isCat ? 8 : isSS ? 20 : 32, color: isCat ? T.primary : isSS ? T.secondary : T.white }}>{t.libelle}</td>
                    <td style={{ padding: "5px 8px", textAlign: "right", color: T.muted }}>{isLine ? t.quantite : ""}</td>
                    <td style={{ padding: "5px 8px", color: T.muted }}>{isLine ? t.unite : ""}</td>
                    <td style={{ padding: "5px 8px", textAlign: "right", color: T.muted }}>{isLine ? fmtS(t.mo_u || 0) : ""}</td>
                    <td style={{ padding: "5px 8px", textAlign: "right", color: T.muted }}>{isLine ? fmtS(t.mat_u || 0) : ""}</td>
                    <td style={{ padding: "5px 8px", textAlign: "right", color: T.muted }}>{isLine ? fmtS(t.autres_u || 0) : ""}</td>
                    <td style={{ padding: "5px 8px", textAlign: "right", color: T.warning, fontWeight: isLine ? 600 : 400 }}>{isLine ? fmtS(t.debourse_sec_u || 0) : ""}</td>
                    <td style={{ padding: "5px 8px", textAlign: "right", color: T.success, fontWeight: isCat ? 800 : isSS ? 700 : 600 }}>{fmtS(t.prix_vente_total || 0)}</td>
                    <td style={{ padding: "3px 5px", whiteSpace: "nowrap" }}>
                      <button onClick={function() { startEdit(t); }} style={{ background: T.warning + "22", color: T.warning, border: "none", borderRadius: 4, padding: "3px 6px", fontSize: 10, cursor: "pointer", marginRight: 2 }}>✏️</button>
                      <button onClick={function() { delLigne(t.id); }} style={{ background: T.danger + "22", color: T.danger, border: "none", borderRadius: 4, padding: "3px 6px", fontSize: 10, cursor: "pointer" }}>🗑</button>
                    </td>
                  </>}
                </tr>;
              })}
              <tr style={{ background: T.primary + "33", borderTop: "2px solid " + T.primary }}>
                <td colSpan={7} style={{ padding: "8px", fontWeight: 800, color: T.primary, fontSize: 12 }}>TOTAL GÉNÉRAL</td>
                <td style={{ padding: "8px", textAlign: "right", color: T.warning, fontWeight: 800 }}>{fmtS(grandDS)}</td>
                <td style={{ padding: "8px", textAlign: "right", color: T.success, fontWeight: 800, fontSize: 13 }}>{fmtS(grandTotal)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </div>}

    {/* Modal Ajouter */}
    {showAdd && <Modal title="Ajouter une ligne" onClose={function() { setShowAdd(false); }} onSave={addLigne} T={T}>
      {saving ? <Spin /> : <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <FS label="Niveau" value={String(addForm.niveau)} onChange={function(v) { upA("niveau", parseInt(v)); }} options={[["1", "1 — Catégorie principale"], ["2", "2 — Sous-catégorie"], ["3", "3 — Poste / Ligne de détail"]]} full T={T} />
        {addForm.niveau >= 2 && <FS label="Catégorie parente" value={addForm.cat_parent} onChange={function(v) { upA("cat_parent", v); }} options={[""].concat(cats1.map(function(t) { return t.libelle; }))} full T={T} />}
        {addForm.niveau === 3 && <FS label="Sous-catégorie parente" value={addForm.ss_parent} onChange={function(v) { upA("ss_parent", v); }} options={[""].concat(cats2.filter(function(t) { var c2 = taches.find(function(x) { return x.id === t.parent_id; }); return !addForm.cat_parent || (c2 && c2.libelle === addForm.cat_parent); }).map(function(t) { return t.libelle; }))} full T={T} />}
        <FG cols={2}>
          <FF label="Libellé *" value={addForm.libelle} onChange={function(v) { upA("libelle", v); }} full T={T} />
          {addForm.niveau === 3 && <>
            <FF label="Quantité" type="number" value={addForm.quantite} onChange={function(v) { upA("quantite", v); }} T={T} />
            <FS label="Unité" value={addForm.unite} onChange={function(v) { upA("unite", v); }} options={UNITES} T={T} />
            <FF label="Main d'œuvre / unité (XOF)" type="number" value={addForm.mo_u} onChange={function(v) { upA("mo_u", v); }} T={T} />
            <FF label="Matériaux / unité (XOF)" type="number" value={addForm.mat_u} onChange={function(v) { upA("mat_u", v); }} T={T} />
            <FF label="Autres (mat., transp…) / u (XOF)" type="number" value={addForm.autres_u} onChange={function(v) { upA("autres_u", v); }} T={T} />
          </>}
        </FG>
        {addForm.niveau === 3 && addForm.quantite && <div style={{ background: T.warning + "11", border: "1px solid " + T.warning + "33", borderRadius: 7, padding: "8px 12px", fontSize: 11 }}>
          <span style={{ color: T.muted }}>Aperçu DS/u: </span><strong style={{ color: T.warning }}>{fmtS(computeLine(addForm.mo_u, addForm.mat_u, addForm.autres_u, 1, cfg).ds)}</strong>
          <span style={{ color: T.muted, marginLeft: 12 }}>PV total: </span><strong style={{ color: T.success }}>{fmtS(computeLine(addForm.mo_u, addForm.mat_u, addForm.autres_u, addForm.quantite, cfg).pvt)}</strong>
        </div>}
      </div>}
    </Modal>}

    {showImport && <ImportSmartModal sess={sess} ch={ch} reload={reload} onClose={function() { setShowImport(false); }} cfg={cfg} T={T} />}
    {showIA && <IAOuvrageModal sess={sess} reload={reload} onClose={function() { setShowIA(false); }} cfg={cfg} T={T} cats1={cats1} cats2={cats2} />}
  </div>;
}

// ── IMPORT INTELLIGENT ────────────────────────────────────────────────────────
function ImportSmartModal(p) {
  var sess = p.sess, reload = p.reload, onClose = p.onClose, cfg = p.cfg, T = p.T;
  var fr = useRef();
  var ls = useState("idle"), loadState = ls[0], setLoadState = ls[1]; // idle | reading | analyzing | importing | done
  var ms = useState(""), msg = ms[0], setMsg = ms[1];
  var pg = useState(0), prog = pg[0], setProg = pg[1];
  var er = useState(null), err = er[0], setErr = er[1];
  var ps = useState([]), postes = ps[0], setPostes = ps[1]; // postes extraits par l'IA
  var ss = useState(""), sessNom = ss[0], setSessNom = ss[1];

  async function handleFile(file) {
    setErr(null); setPostes([]); setProg(0);
    setLoadState("reading"); setMsg("📄 Lecture du fichier...");
    try {
      var texte = "";
      var ext = file.name.split(".").pop().toLowerCase();
      if (file.type === "application/pdf" || file.type.indexOf("image/") === 0) {
        var b64 = await new Promise(function(res, rej) { var r = new FileReader(); r.onload = function(e) { res(e.target.result.split(",")[1]); }; r.onerror = rej; r.readAsDataURL(file); });
        var cb = file.type === "application/pdf" ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } } : { type: "image", source: { type: "base64", media_type: file.type, data: b64 } };
        setMsg("🔍 Extraction du contenu...");
        var d0 = await aiCall({ model: AI_MODEL, max_tokens: 6000, messages: [{ role: "user", content: [cb, { type: "text", text: "Extrais TOUT le texte de ce document BTP: désignations, quantités, unités, prix unitaires, totaux. Retourne le texte brut complet." }] }] });
        texte = (d0.content || []).map(function(i) { return i.text || ""; }).join("");
      } else if (ext === "xlsx" || ext === "xls") {
        var SheetJS = await import("https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs");
        var buf = await file.arrayBuffer(); var wb = SheetJS.read(buf, { type: "array" }); var ws = wb.Sheets[wb.SheetNames[0]];
        texte = SheetJS.utils.sheet_to_csv(ws);
      } else { texte = await file.text(); }

      setSessNom(file.name.replace(/\.[^.]+$/, "").slice(0, 50));
      setLoadState("analyzing"); setMsg("🤖 Analyse IA intelligente du document...");

      // Prompt IA ultra-détaillé pour respecter les prix du fichier
      var prompt = `Tu es un expert BTP en Côte d'Ivoire. Analyse ce document de bordereau de prix / DPGF / devis.

RÈGLES ABSOLUES:
1. Le prix unitaire (PU) de chaque poste doit être EXACTEMENT celui du document — ne l'invente pas, ne l'augmente pas
2. "Fourniture et pose" = fournir le matériau ET la main d'œuvre de pose → mat_u = coût fourniture, mo_u = coût pose (estime la part MO ~20-35% du PU si non précisée)
3. "Fourniture seule" = mat_u = PU, mo_u = 0
4. "Pose seule" / "Main d'œuvre" = mo_u = PU, mat_u = 0
5. Le débours sec (DS) = mo_u * (1 + charges/100) + mat_u + autres_u doit être INFÉRIEUR ou ÉGAL au PU du document
6. Si le document a des catégories/sections, respecte-les exactement
7. Inclus TOUS les postes, même les petits

Réponds UNIQUEMENT en JSON valide:
{
  "categories": [
    {
      "libelle": "NOM CATEGORIE (ex: GROS OEUVRE)",
      "sous_categories": [
        {
          "libelle": "Nom sous-catégorie (ex: Terrassements)",
          "lignes": [
            {
              "libelle": "Désignation exacte du poste",
              "unite": "m3",
              "quantite": 25.5,
              "pu_doc": 85000,
              "mo_u": 20000,
              "mat_u": 55000,
              "autres_u": 0,
              "type": "fourniture_et_pose"
            }
          ]
        }
      ]
    }
  ]
}

type peut être: "fourniture_et_pose", "fourniture_seule", "pose_seule", "main_oeuvre", "mixte"

DOCUMENT:
` + texte.slice(0, 7000);

      var r = await aiCall({ model: AI_MODEL, max_tokens: 6000, messages: [{ role: "user", content: prompt }] });
      var txt = (r.content || []).map(function(i) { return i.text || ""; }).join("");
      var parsed = safeParseJSON(txt);
      if (!parsed || !parsed.categories) throw new Error("Impossible d'analyser le document. Vérifiez qu'il contient bien des postes BTP.");

      setPostes(parsed.categories);
      setLoadState("preview");
      setMsg("");
    } catch (e) { setErr(e.message); setLoadState("idle"); }
  }

  async function importerProjet() {
    setLoadState("importing"); setMsg("💾 Import en cours...");
    try {
      var ordre = 0;
      for (var ci = 0; ci < postes.length; ci++) {
        var cat = postes[ci];
        var catRes = await q("debourse_taches").insert({ session_id: sess.id, libelle: cat.libelle, niveau: 1, ordre: ordre++, quantite: 0, mo_u: 0, mat_u: 0, autres_u: 0, debourse_sec_u: 0, prix_vente_u: 0, prix_vente_total: 0, unite: "" });
        var catId = catRes.data ? catRes.data.id : null;
        var catPVT = 0;
        for (var si = 0; si < (cat.sous_categories || []).length; si++) {
          var sc = cat.sous_categories[si];
          var scRes = await q("debourse_taches").insert({ session_id: sess.id, libelle: sc.libelle, niveau: 2, parent_id: catId, ordre: ordre++, quantite: 0, mo_u: 0, mat_u: 0, autres_u: 0, debourse_sec_u: 0, prix_vente_u: 0, prix_vente_total: 0, unite: "" });
          var scId = scRes.data ? scRes.data.id : null;
          var scPVT = 0;
          for (var li = 0; li < (sc.lignes || []).length; li++) {
            var l = sc.lignes[li];
            var mo = parseFloat(l.mo_u) || 0, mat = parseFloat(l.mat_u) || 0, autres = parseFloat(l.autres_u) || 0;
            var ds = mo * (1 + cfg.tc / 100) + mat + autres;
            var puDoc = parseFloat(l.pu_doc) || 0;
            // Cap: DS ne doit pas dépasser le PU du document
            if (puDoc > 0 && ds > puDoc) { var ratio = puDoc / ds; mo = mo * ratio; mat = mat * ratio; autres = autres * ratio; ds = puDoc; }
            var pv = calcPV(ds, cfg);
            var pvt = pv.pv * (parseFloat(l.quantite) || 0);
            scPVT += pvt;
            await q("debourse_taches").insert({ session_id: sess.id, libelle: l.libelle, niveau: 3, parent_id: scId, ordre: ordre++, unite: l.unite || "U", quantite: parseFloat(l.quantite) || 0, mo_u: Math.round(mo), mat_u: Math.round(mat), autres_u: Math.round(autres), debourse_sec_u: Math.round(ds), prix_vente_u: Math.round(pv.pv), prix_vente_total: Math.round(pvt) });
            setProg(Math.round(((ci * 100 + si * 10 + li) / (postes.length * 100)) * 100));
          }
          catPVT += scPVT;
          if (scId) await q("debourse_taches").eq("id", scId).update({ prix_vente_total: Math.round(scPVT) });
        }
        if (catId) await q("debourse_taches").eq("id", catId).update({ prix_vente_total: Math.round(catPVT) });
      }
      setLoadState("done"); setMsg(""); reload();
    } catch (e) { setErr("Erreur import: " + e.message); setLoadState("idle"); }
  }

  // Calcul totaux pour preview
  function previewTotal() {
    return (postes || []).reduce(function(a, cat) { return a + (cat.sous_categories || []).reduce(function(b, sc) { return b + (sc.lignes || []).reduce(function(c2, l) { var ds = (parseFloat(l.mo_u) || 0) * (1 + cfg.tc / 100) + (parseFloat(l.mat_u) || 0) + (parseFloat(l.autres_u) || 0); var puDoc = parseFloat(l.pu_doc) || 0; if (puDoc > 0 && ds > puDoc) ds = puDoc; return c2 + calcPV(ds, cfg).pv * (parseFloat(l.quantite) || 0); }, 0); }, 0); }, 0);
  }

  return <Modal title="📂 Import intelligent — Document BTP" onClose={onClose} T={T}>
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {(loadState === "idle" || loadState === "reading" || loadState === "analyzing") && <>
        <div style={{ background: T.mid, borderRadius: 12, padding: 20, textAlign: "center", border: "2px dashed " + T.border }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Importer un document BTP</div>
          <div style={{ fontSize: 11, color: T.muted, marginBottom: 14 }}>Bordereau de prix · DPGF · Devis · Excel · PDF · Image<br />L'IA lit les prix du document et les respecte exactement</div>
          <input ref={fr} type="file" accept=".xlsx,.xls,.pdf,.csv,.txt,image/*" style={{ display: "none" }} onChange={function(e) { var f = e.target.files[0]; if (f) { e.target.value = ""; handleFile(f); } }} />
          <button onClick={function() { fr.current.click(); }} disabled={loadState !== "idle"} style={{ background: T.secondary, color: "#fff", border: "none", borderRadius: 8, padding: "10px 22px", fontWeight: 700, cursor: loadState !== "idle" ? "wait" : "pointer", fontSize: 14 }}>{loadState === "idle" ? "Choisir un fichier" : "Analyse en cours..."}</button>
        </div>
        {(loadState === "reading" || loadState === "analyzing") && <>
          <div style={{ background: T.secondary + "11", border: "1px solid " + T.secondary + "33", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: T.secondary, fontWeight: 600 }}>{msg}</div>
          <Spin />
        </>}
        {err && <div style={{ background: T.danger + "11", border: "1px solid " + T.danger + "44", borderRadius: 8, padding: "10px", color: T.danger, fontSize: 12 }}>⚠️ {err}<br /><button onClick={function() { setErr(null); setLoadState("idle"); }} style={{ marginTop: 6, background: T.mid, color: T.white, border: "none", borderRadius: 5, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>Réessayer</button></div>}
      </>}

      {loadState === "preview" && <>
        <div style={{ background: T.success + "11", border: "1px solid " + T.success + "33", borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div><div style={{ fontWeight: 700, color: T.success, fontSize: 13 }}>✅ {postes.length} catégorie(s) analysée(s)</div><div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>PV total estimé: <strong>{fmtS(previewTotal())} XOF</strong></div></div>
          <button onClick={function() { setLoadState("idle"); setPostes([]); }} style={{ background: T.secondary + "22", color: T.secondary, border: "1px solid " + T.secondary + "44", borderRadius: 7, padding: "5px 12px", fontSize: 11, cursor: "pointer" }}>Changer de fichier</button>
        </div>
        <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
          {postes.map(function(cat, ci) {
            var nbLignes = (cat.sous_categories || []).reduce(function(a, sc) { return a + (sc.lignes || []).length; }, 0);
            return <div key={ci} style={{ background: T.mid, borderRadius: 9, overflow: "hidden" }}>
              <div style={{ background: T.primary + "22", padding: "8px 12px", fontWeight: 800, fontSize: 12, color: T.primary }}>{cat.libelle} <span style={{ color: T.muted, fontWeight: 400 }}>({nbLignes} poste(s))</span></div>
              {(cat.sous_categories || []).map(function(sc, si) { return <div key={si} style={{ padding: "6px 16px", borderBottom: "1px solid " + T.border + "44" }}>
                <div style={{ fontWeight: 700, fontSize: 11, color: T.secondary, marginBottom: 4 }}>{sc.libelle}</div>
                {(sc.lignes || []).slice(0, 3).map(function(l, li) { return <div key={li} style={{ fontSize: 10, color: T.muted, display: "flex", justifyContent: "space-between", padding: "2px 0" }}><span>{l.libelle.slice(0, 50)}</span><span style={{ color: T.warning }}>{l.quantite} {l.unite} × {fmtS(l.pu_doc)} XOF</span></div>; })}
                {(sc.lignes || []).length > 3 && <div style={{ fontSize: 10, color: T.muted }}>+ {(sc.lignes || []).length - 3} autre(s)...</div>}
              </div>; })}
            </div>;
          })}
        </div>
        <button onClick={importerProjet} style={{ background: T.success, color: "#fff", border: "none", borderRadius: 9, padding: "12px", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>🚀 Importer dans ce projet</button>
      </>}

      {loadState === "importing" && <>
        <div style={{ background: T.primary + "11", border: "1px solid " + T.primary + "33", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: T.primary, fontWeight: 600 }}>💾 Import en cours...</div>
        <div style={{ background: T.mid, borderRadius: 99, height: 8, overflow: "hidden" }}><div style={{ width: prog + "%", background: T.primary, height: "100%", borderRadius: 99, transition: "width .3s" }} /></div>
        <Spin />
      </>}

      {loadState === "done" && <div style={{ background: T.success + "11", border: "1px solid " + T.success + "44", borderRadius: 12, padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>🎉</div>
        <div style={{ fontWeight: 800, fontSize: 16, color: T.success, marginBottom: 8 }}>Import réussi !</div>
        <button onClick={onClose} style={{ background: T.success, color: "#fff", border: "none", borderRadius: 8, padding: "10px 22px", fontWeight: 700, cursor: "pointer" }}>Voir le projet</button>
      </div>}
    </div>
  </Modal>;
}

// ── IA OUVRAGE MODAL ──────────────────────────────────────────────────────────
function IAOuvrageModal(p) {
  var sess = p.sess, reload = p.reload, onClose = p.onClose, cfg = p.cfg, T = p.T, cats1 = p.cats1, cats2 = p.cats2;
  var qs = useState(""), query = qs[0], setQuery = qs[1];
  var rs = useState(null), result = rs[0], setResult = rs[1];
  var ls = useState(false), loading = ls[0], setLoading = ls[1];
  var es = useState(null), err = es[0], setErr = es[1];
  var is = useState(false), importing = is[0], setImporting = is[1];
  var ds = useState(false), done = ds[0], setDone = ds[1];
  var cp = useState(""), catParent = cp[0], setCatParent = cp[1];
  var sp = useState(""), ssParent = sp[0], setSsParent = sp[1];

  async function analyze() {
    if (!query.trim()) return; setLoading(true); setErr(null); setResult(null); setDone(false);
    try {
      var prompt = `Expert BTP Côte d'Ivoire. Décompose cet ouvrage BTP en détail avec les vraies valeurs XOF CI.

OUVRAGE: "${query}"

RÈGLES IMPORTANTES:
- "Fourniture et pose" = fournir le matériau + main d'œuvre de pose (sépare les deux)
- MO inclut les ouvriers qualifiés (maçon 7000-9000 XOF/j, manœuvre 4500 XOF/j, coffreur 8000 XOF/j...)
- Matériaux aux prix marché CI: ciment CPA 7500/sac, sable 15000/m3, gravier 18000/m3, acier HA 850-1200 XOF/kg
- Détaille chaque composant séparément
- Sois précis sur les dosages (ex béton C25: 350kg/7 sacs ciment, 0.8m3 sable, 0.9m3 gravier par m3)

Réponds UNIQUEMENT en JSON:
{
  "libelle": "Nom complet de l'ouvrage",
  "unite": "m3",
  "elements": [
    {
      "libelle": "Béton C25/30 dosé 350kg/m3",
      "type": "fourniture_et_pose",
      "mo_u": 25000,
      "mat_u": 87000,
      "autres_u": 5000,
      "description": "7 sacs ciment + 0.8m3 sable + 0.9m3 gravier + eau + vibration"
    }
  ],
  "quantite_suggeree": 1
}`;
      var d = await aiCall({ model: AI_MODEL, max_tokens: 3000, messages: [{ role: "user", content: prompt }] });
      var txt = (d.content || []).map(function(i) { return i.text || ""; }).join("");
      var parsed = safeParseJSON(txt);
      if (!parsed || !parsed.elements) throw new Error("Réponse invalide");
      setResult(parsed);
    } catch (e) { setErr(e.message); }
    setLoading(false);
  }

  async function importOuvrage() {
    if (!result) return; setImporting(true);
    var ordre = 1000 + Math.floor(Math.random() * 9000);
    var catId = null, ssId = null;
    // find or create parent
    var selCat = cats1.find(function(t) { return t.libelle === catParent; });
    catId = selCat ? selCat.id : null;
    if (catParent && !catId) { var cr = await q("debourse_taches").insert({ session_id: sess.id, libelle: catParent, niveau: 1, ordre: ordre++, quantite: 0, mo_u: 0, mat_u: 0, autres_u: 0, debourse_sec_u: 0, prix_vente_u: 0, prix_vente_total: 0, unite: "" }); catId = cr.data ? cr.data.id : null; }
    var selSS = cats2.find(function(t) { return t.libelle === ssParent; });
    ssId = selSS ? selSS.id : null;
    if (ssParent && !ssId) { var sr = await q("debourse_taches").insert({ session_id: sess.id, libelle: ssParent, niveau: 2, parent_id: catId, ordre: ordre++, quantite: 0, mo_u: 0, mat_u: 0, autres_u: 0, debourse_sec_u: 0, prix_vente_u: 0, prix_vente_total: 0, unite: "" }); ssId = sr.data ? sr.data.id : null; }
    // insert ouvrage as cat-level ligne with sub-elements
    var totalMO = result.elements.reduce(function(a, e) { return a + (e.mo_u || 0); }, 0);
    var totalMat = result.elements.reduce(function(a, e) { return a + (e.mat_u || 0); }, 0);
    var totalAutres = result.elements.reduce(function(a, e) { return a + (e.autres_u || 0); }, 0);
    var ds = totalMO * (1 + cfg.tc / 100) + totalMat + totalAutres;
    var pv = calcPV(ds, cfg);
    var qte = parseFloat(result.quantite_suggeree) || 1;
    var pvt = pv.pv * qte;
    var lr = await q("debourse_taches").insert({ session_id: sess.id, libelle: result.libelle, niveau: ssId ? 3 : catId ? 2 : 1, parent_id: ssId || catId, ordre: ordre++, unite: result.unite || "U", quantite: qte, mo_u: Math.round(totalMO), mat_u: Math.round(totalMat), autres_u: Math.round(totalAutres), debourse_sec_u: Math.round(ds), prix_vente_u: Math.round(pv.pv), prix_vente_total: Math.round(pvt) });
    setImporting(false); setDone(true); reload();
  }

  var totalDS = result ? result.elements.reduce(function(a, e) { return a + (e.mo_u || 0) * (1 + cfg.tc / 100) + (e.mat_u || 0) + (e.autres_u || 0); }, 0) : 0;
  var TYPE_ICO = { "fourniture_et_pose": "🔨+📦", "fourniture_seule": "📦", "pose_seule": "🔨", "main_oeuvre": "👷", "mixte": "⚙️" };

  return <Modal title="🤖 IA — Décomposition d'ouvrage BTP" onClose={onClose} T={T}>
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <FF label="Décrivez l'ouvrage à décomposer" value={query} onChange={setQuery} placeholder="Ex: Semelle filante 40×60cm béton armé C25, fourniture et pose…" rows={3} full T={T} />
      <button onClick={analyze} disabled={loading || !query.trim()} style={{ background: loading ? T.mid : T.secondary, color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontWeight: 700, cursor: loading ? "wait" : "pointer", fontSize: 13 }}>{loading ? "🤖 Analyse détaillée..." : "🤖 Décomposer"}</button>
      {err && <div style={{ background: T.danger + "11", border: "1px solid " + T.danger + "44", borderRadius: 8, padding: "10px", color: T.danger, fontSize: 12 }}>⚠️ {err}</div>}
      {result && !done && <>
        <div style={{ background: T.warning + "11", border: "1px solid " + T.warning + "33", borderRadius: 9, padding: "10px 14px", fontSize: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8, color: T.warning }}>{result.libelle}</div>
          {result.elements.map(function(e, i) {
            var ds_e = (e.mo_u || 0) * (1 + cfg.tc / 100) + (e.mat_u || 0) + (e.autres_u || 0);
            return <div key={i} style={{ background: T.mid, borderRadius: 7, padding: "8px 10px", marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div style={{ flex: 1 }}><span style={{ fontSize: 10, color: T.primary }}>{TYPE_ICO[e.type] || "⚙️"} </span><strong style={{ fontSize: 12 }}>{e.libelle}</strong>{e.description && <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>{e.description}</div>}</div>
                <div style={{ textAlign: "right", fontSize: 11 }}>
                  {e.mo_u > 0 && <div>👷 MO: <strong style={{ color: T.secondary }}>{fmtS(e.mo_u)}</strong></div>}
                  {e.mat_u > 0 && <div>📦 Mat: <strong style={{ color: T.primary }}>{fmtS(e.mat_u)}</strong></div>}
                  {e.autres_u > 0 && <div>➕ Autres: <strong style={{ color: T.muted }}>{fmtS(e.autres_u)}</strong></div>}
                  <div style={{ color: T.warning, fontWeight: 700 }}>DS: {fmtS(Math.round(ds_e))}</div>
                </div>
              </div>
            </div>;
          })}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
            <div style={{ background: T.warning + "22", borderRadius: 6, padding: "6px 10px", textAlign: "center" }}><div style={{ fontSize: 9, color: T.muted }}>Débours sec/u</div><div style={{ fontWeight: 800, color: T.warning }}>{fmtS(Math.round(totalDS))}</div></div>
            <div style={{ background: T.success + "22", borderRadius: 6, padding: "6px 10px", textAlign: "center" }}><div style={{ fontSize: 9, color: T.muted }}>Prix vente/u</div><div style={{ fontWeight: 800, color: T.success }}>{fmtS(Math.round(calcPV(totalDS, cfg).pv))}</div></div>
          </div>
        </div>
        <div style={{ background: T.mid, borderRadius: 9, padding: "12px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8, color: T.muted }}>Insérer dans :</div>
          <FG cols={2}>
            <FS label="Catégorie (optionnel)" value={catParent} onChange={setCatParent} options={[""].concat(cats1.map(function(t) { return t.libelle; }))} T={T} />
            <FS label="Sous-catégorie (optionnel)" value={ssParent} onChange={setSsParent} options={[""].concat(cats2.map(function(t) { return t.libelle; }))} T={T} />
          </FG>
          <button onClick={importOuvrage} disabled={importing} style={{ marginTop: 10, width: "100%", background: T.success, color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontWeight: 700, fontSize: 13, cursor: importing ? "wait" : "pointer" }}>{importing ? "..." : "✅ Insérer dans le projet"}</button>
        </div>
      </>}
      {done && <div style={{ background: T.success + "11", border: "1px solid " + T.success + "44", borderRadius: 10, padding: 20, textAlign: "center" }}><div style={{ fontSize: 32, marginBottom: 6 }}>✅</div><div style={{ fontWeight: 700, color: T.success }}>Inséré avec succès !</div><button onClick={function() { setResult(null); setDone(false); setQuery(""); }} style={{ marginTop: 10, background: T.secondary, color: "#fff", border: "none", borderRadius: 7, padding: "7px 16px", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>Décomposer un autre</button></div>}
    </div>
  </Modal>;
}

// ── INTERVENTIONS ─────────────────────────────────────────────────────────────
function DepensesIntv(p) {
  var intv = p.intv, reload = p.reload, T = p.T;
  var os = useState(false), open = os[0], setOpen = os[1];
  var es = useState(null), editDep = es[0], setEditDep = es[1];
  var fs = useState({ libelle: "", montant: "", date: today(), categorie: "Divers" }), form = fs[0], setForm = fs[1];
  var sv = useState(false), saving = sv[0], setSaving = sv[1];
  var deps = intv.depenses || [];
  var total = deps.reduce(function(a, d) { return a + d.montant; }, 0);
  function resetForm() { setEditDep(null); setForm({ libelle: "", montant: "", date: today(), categorie: "Divers" }); }
  function startEdit(d) { setEditDep(d); setForm({ libelle: d.libelle || "", montant: String(d.montant || ""), date: d.date || today(), categorie: d.categorie || "Divers" }); setOpen(true); }
  function upF(k, v) { setForm(function(pp) { var n = Object.assign({}, pp); n[k] = v; return n; }); }
  function save() {
    if (!form.libelle || !form.montant) return; setSaving(true);
    var payload = { libelle: form.libelle, montant: parseFloat(form.montant) || 0, date: form.date, categorie: form.categorie || "Divers" };
    var op = editDep ? q("intervention_depenses").eq("id", editDep.id).update(payload) : q("intervention_depenses").insert(Object.assign({}, payload, { intervention_id: intv.id }));
    op.then(function() { setSaving(false); setOpen(false); resetForm(); reload(); }).catch(function() { setSaving(false); });
  }
  function del(id) { if (!window.confirm("Supprimer ?")) return; q("intervention_depenses").eq("id", id).del().then(function() { reload(); }); }
  return <div style={{ background: T.mid, borderRadius: 8, padding: "9px 11px" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div><div style={{ fontSize: 9, color: T.muted }}>Coût engagé</div><div style={{ fontWeight: 800, color: T.warning, fontSize: 13 }}>{fmt(total)}</div></div>
      <button onClick={function() { resetForm(); setOpen(function(v) { return !v; }); }} style={{ background: T.warning + "22", border: "1px solid " + T.warning + "44", color: T.warning, borderRadius: 6, padding: "4px 9px", fontSize: 10, cursor: "pointer", fontWeight: 700 }}>{open ? "Fermer" : "+ Dépense"}</button>
    </div>
    {open && <div style={{ marginTop: 9, borderTop: "1px solid " + T.border + "66", paddingTop: 9, display: "flex", flexDirection: "column", gap: 7 }}>
      {deps.map(function(d) { return <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11 }}><div style={{ flex: 1 }}><span style={{ fontWeight: 600 }}>{d.libelle}</span><span style={{ color: T.muted, marginLeft: 5, fontSize: 10 }}>{d.date}</span></div><span style={{ fontWeight: 700, color: T.warning }}>{fmt(d.montant)}</span><button onClick={function() { startEdit(d); }} style={{ background: T.warning + "22", border: "none", color: T.warning, borderRadius: 4, padding: "2px 6px", fontSize: 9, cursor: "pointer" }}>✏️</button><button onClick={function() { del(d.id); }} style={{ background: T.danger + "22", border: "none", color: T.danger, borderRadius: 4, padding: "2px 6px", fontSize: 9, cursor: "pointer" }}>🗑</button></div>; })}
      <FG cols={2}>
        <FF label="Libellé *" value={form.libelle} onChange={function(v) { upF("libelle", v); }} full T={T} />
        <FS label="Catégorie" value={form.categorie} onChange={function(v) { upF("categorie", v); }} options={CATS} T={T} />
        <FF label="Montant (XOF) *" type="number" value={form.montant} onChange={function(v) { upF("montant", v); }} T={T} />
        <FF label="Date" type="date" value={form.date} onChange={function(v) { upF("date", v); }} T={T} />
      </FG>
      <div style={{ display: "flex", gap: 7, justifyContent: "flex-end" }}>
        {editDep && <button onClick={resetForm} style={{ background: T.mid, color: T.muted, border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 11, cursor: "pointer" }}>Annuler</button>}
        <button onClick={save} disabled={saving} style={{ background: saving ? T.mid : T.success, color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", fontWeight: 700, fontSize: 11, cursor: saving ? "wait" : "pointer" }}>{saving ? "..." : (editDep ? "Enregistrer" : "Ajouter")}</button>
      </div>
    </div>}
  </div>;
}

function FacturationPanel(p) {
  var intv = p.intv, reload = p.reload, T = p.T;
  var cout = totalDepIntv(intv), facture = parseFloat(intv.montant_facture || 0), benef = facture > 0 ? facture - cout : null, margeP = facture > 0 && cout > 0 ? Math.round((facture - cout) / cout * 100) : null;
  var es = useState(false), editing = es[0], setEditing = es[1];
  var vs = useState(String(facture || "")), val = vs[0], setVal = vs[1];
  var sv = useState(false), sv2 = sv[0], setSv = sv[1];
  function save() { setSv(true); q("interventions").eq("id", intv.id).update({ montant_facture: parseFloat(val) || null, facturee: parseFloat(val) > 0 }).then(function() { setSv(false); setEditing(false); reload(); }); }
  return <div style={{ background: benef === null ? T.mid : benef >= 0 ? T.success + "11" : T.danger + "11", border: "1px solid " + (benef === null ? T.border : benef >= 0 ? T.success + "55" : T.danger + "55"), borderRadius: 8, padding: "9px 11px" }}>
    <div style={{ fontSize: 9, color: T.muted, marginBottom: 5, fontWeight: 600 }}>💰 FACTURATION</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 7 }}>
      <div style={{ textAlign: "center" }}><div style={{ fontSize: 8, color: T.muted }}>Coût</div><div style={{ fontWeight: 800, fontSize: 12, color: cout > 0 ? T.warning : T.muted }}>{cout > 0 ? fmtS(cout) : "—"}</div></div>
      <div style={{ textAlign: "center" }}><div style={{ fontSize: 8, color: T.muted }}>Facturé</div><div style={{ fontWeight: 800, fontSize: 12, color: facture > 0 ? T.primary : T.muted }}>{facture > 0 ? fmtS(facture) : "—"}</div></div>
      <div style={{ textAlign: "center" }}><div style={{ fontSize: 8, color: T.muted }}>Bénéfice</div><div style={{ fontWeight: 800, fontSize: 12, color: benef === null ? T.muted : benef >= 0 ? T.success : T.danger }}>{benef === null ? "—" : (benef >= 0 ? "+" : "") + fmtS(benef)}</div></div>
    </div>
    {margeP !== null && <div style={{ background: margeP >= 0 ? T.success + "22" : T.danger + "22", borderRadius: 4, padding: "2px 7px", fontSize: 9, fontWeight: 700, color: margeP >= 0 ? T.success : T.danger, textAlign: "center", marginBottom: 7 }}>Marge: {margeP >= 0 ? "+" : ""}{margeP}%</div>}
    {editing ? <div style={{ display: "flex", gap: 5 }}><input type="number" value={val} onChange={function(e) { setVal(e.target.value); }} placeholder="Montant facturé XOF" style={{ flex: 1, background: T.mid, border: "1px solid " + T.primary, borderRadius: 5, padding: "6px 8px", color: T.white, fontSize: 12, outline: "none" }} /><button onClick={save} disabled={sv2} style={{ background: T.success, color: "#fff", border: "none", borderRadius: 5, padding: "6px 10px", fontWeight: 700, fontSize: 11, cursor: "pointer" }}>✔</button><button onClick={function() { setEditing(false); }} style={{ background: T.mid, color: T.muted, border: "none", borderRadius: 5, padding: "6px 8px", fontSize: 11, cursor: "pointer" }}>✕</button></div>
      : <button onClick={function() { setVal(String(facture || "")); setEditing(true); }} style={{ width: "100%", background: T.primary + "22", border: "1px solid " + T.primary + "44", color: T.primary, borderRadius: 5, padding: "5px", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>{facture > 0 ? "✏️ Modifier le facturé" : "+ Saisir le montant facturé"}</button>}
  </div>;
}

function Interventions(p) {
  var intv = p.intv, ch = p.ch, reload = p.reload, T = p.T, isMobile = useBP().isMobile;
  var ft = useState("Tous"), fT = ft[0], setFT = ft[1];
  var fm = useState(""), fMois = fm[0], setFMois = fm[1];
  var ns = useState(false), showNew = ns[0], setShowNew = ns[1];
  var ei = useState(null), editIntv = ei[0], setEditIntv = ei[1];
  var sv = useState(false), saving = sv[0], setSaving = sv[1];
  var er = useState(null), saveErr = er[0], setSaveErr = er[1];
  var BLANK = { titre: "", description: "", type: "Corrective", intervenant: "", client: "", voie_reception: "Appel téléphonique", chantier: "", date_creation: today(), statut: "En attente", facturee: false, montant_facture: "" };
  var fm2 = useState(BLANK), form = fm2[0], setForm = fm2[1];
  var TC = { Urgence: T.danger, Preventive: T.secondary, Corrective: T.primary, Inspection: "#A855F7" };
  var STIC = { "En attente": T.warning, "En cours": T.secondary, "Terminee": T.success };
  var filtered = intv.filter(function(i) { var okT = fT === "Tous" || i.type === fT; var okM = !fMois || (i.date_creation && i.date_creation.slice(0, 7) === fMois); return okT && okM; });
  var moisDispo = []; intv.forEach(function(i) { if (i.date_creation && i.date_creation.length >= 7) { var m = i.date_creation.slice(0, 7); if (!moisDispo.includes(m)) moisDispo.push(m); } }); moisDispo.sort().reverse();
  var totalCout = intv.reduce(function(a, i) { return a + totalDepIntv(i); }, 0);
  var totalFact = intv.reduce(function(a, i) { return a + parseFloat(i.montant_facture || 0); }, 0);
  function del(id) { if (!window.confirm("Supprimer ?")) return; q("interventions").eq("id", id).del().then(function() { reload(); }); }
  function updSt(id, s) { q("interventions").eq("id", id).update({ statut: s }).then(function() { reload(); }); }
  function openNew() { setForm(BLANK); setEditIntv(null); setSaveErr(null); setShowNew(true); }
  function openEdit(i) {
    setForm({ titre: i.titre || "", description: i.description || "", type: i.type || "Corrective", intervenant: i.intervenant || "", client: i.client || "", voie_reception: i.voie_reception || "Appel téléphonique", chantier: i.chantier || "", date_creation: i.date_creation || today(), statut: i.statut || "En attente", facturee: !!i.facturee, montant_facture: String(i.montant_facture || "") });
    setEditIntv(i); setSaveErr(null); setShowNew(true);
  }
  function upF(k, v) { setForm(function(pp) { var n = Object.assign({}, pp); n[k] = v; return n; }); }
  function save() {
    if (!form.titre) { setSaveErr("Le titre est obligatoire"); return; }
    setSaving(true); setSaveErr(null);
    var payload = { titre: form.titre, description: form.description || "", type: form.type, intervenant: form.intervenant || "", client: form.client || "", voie_reception: form.voie_reception, chantier: form.chantier || "", date_creation: form.date_creation, statut: form.statut, facturee: !!form.facturee, montant_facture: form.montant_facture ? parseFloat(form.montant_facture) : null };
    var op = editIntv ? q("interventions").eq("id", editIntv.id).update(payload) : q("interventions").insert(payload);
    op.then(function(r) {
      setSaving(false);
      if (r && r.error) { setSaveErr("Erreur: " + JSON.stringify(r.error)); return; }
      setShowNew(false); setEditIntv(null); reload();
    }).catch(function(e) { setSaving(false); setSaveErr("Erreur réseau: " + e.message); });
  }
  return <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 8 }}>
      <Kpi icon="🔧" label="Total" value={intv.length} color={T.primary} compact T={T} />
      <Kpi icon="🧾" label="Coût total" value={fmtS(totalCout)} color={T.warning} compact T={T} />
      <Kpi icon="💵" label="Facturé" value={fmtS(totalFact)} color={T.primary} compact T={T} />
      <Kpi icon="📈" label="Bénéfice" value={fmtS(totalFact - totalCout)} color={totalFact - totalCout >= 0 ? T.success : T.danger} compact T={T} />
    </div>
    <Card T={T}>
      <div style={{ display: "flex", gap: 4, overflowX: "auto", marginBottom: 9 }}>{["Tous"].concat(TYPES_INT).map(function(t) { return <button key={t} onClick={function() { setFT(t); }} style={{ padding: "5px 10px", borderRadius: 20, border: "1px solid " + (fT === t ? T.primary : T.border), background: fT === t ? T.primary : "transparent", color: fT === t ? "#fff" : T.muted, cursor: "pointer", fontSize: 11, whiteSpace: "nowrap", flexShrink: 0 }}>{t}</button>; })}</div>
      <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap", marginBottom: 9 }}>
        <span style={{ fontSize: 11, color: T.muted }}>📅</span>
        <select value={fMois} onChange={function(e) { setFMois(e.target.value); }} style={{ background: T.mid, border: "1px solid " + T.border, borderRadius: 7, padding: "5px 9px", color: T.white, fontSize: 11, outline: "none" }}>
          <option value="">Toute la période</option>
          {moisDispo.map(function(m) { var parts = m.split("-"); return <option key={m} value={m}>{MOIS[parseInt(parts[1]) - 1] + " " + parts[0]}</option>; })}
        </select>
        {fMois && <button onClick={function() { setFMois(""); }} style={{ background: T.danger + "22", color: T.danger, border: "none", borderRadius: 5, padding: "3px 8px", fontSize: 10, cursor: "pointer" }}>✕</button>}
        <span style={{ fontSize: 10, color: T.muted, marginLeft: "auto" }}>{filtered.length} résultat(s)</span>
        <button onClick={function() { exportIntvCSV(filtered, "interventions"); }} style={{ background: T.success + "22", color: T.success, border: "1px solid " + T.success + "44", borderRadius: 7, padding: "5px 10px", fontWeight: 700, cursor: "pointer", fontSize: 11 }}>CSV</button>
        <button onClick={openNew} style={{ background: T.primary, color: "#fff", border: "none", borderRadius: 7, padding: "5px 13px", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>+ Nouvelle</button>
      </div>
    </Card>
    {filtered.length === 0 && <Empty msg="Aucune intervention" icon="🔧" />}
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill,minmax(340px,1fr))", gap: 12 }}>
      {filtered.map(function(i) { return <div key={i.id} style={{ background: T.card, border: "1px solid " + (i.type === "Urgence" ? T.danger + "66" : T.border), borderRadius: T.borderRadius, padding: 14, display: "flex", flexDirection: "column", gap: 9 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 7 }}>
          <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 13 }}>{i.titre}</div><div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>{i.date_creation}</div></div>
          <Badge label={i.type} color={TC[i.type] || T.primary} small />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
          {i.client && <div style={{ background: T.mid, borderRadius: 6, padding: "5px 8px" }}><div style={{ fontSize: 8, color: T.muted }}>👤 CLIENT</div><div style={{ fontWeight: 700, fontSize: 11 }}>{i.client}</div></div>}
          {i.voie_reception && <div style={{ background: (VOIE_COL[i.voie_reception] || T.muted) + "11", border: "1px solid " + (VOIE_COL[i.voie_reception] || T.muted) + "33", borderRadius: 6, padding: "5px 8px" }}><div style={{ fontSize: 8, color: T.muted }}>📡 RÉCEPTION</div><div style={{ fontWeight: 700, fontSize: 10, color: VOIE_COL[i.voie_reception] || T.muted }}>{VOIE_ICO[i.voie_reception] || ""} {i.voie_reception}</div></div>}
        </div>
        {(i.chantier || i.intervenant) && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", fontSize: 10, color: T.muted }}>{i.chantier && <span>🏗️ {i.chantier}</span>}{i.intervenant && <span>👷 {i.intervenant}</span>}</div>}
        {i.description && <div style={{ fontSize: 11, color: T.muted, background: T.mid, borderRadius: 5, padding: "6px 9px", fontStyle: "italic" }}>{i.description}</div>}
        <DepensesIntv intv={i} reload={reload} T={T} />
        <FacturationPanel intv={i} reload={reload} T={T} />
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <select value={i.statut} onChange={function(e) { updSt(i.id, e.target.value); }} style={{ flex: 1, background: (STIC[i.statut] || T.muted) + "22", border: "1px solid " + (STIC[i.statut] || T.muted) + "55", borderRadius: 6, padding: "5px 8px", color: STIC[i.statut] || T.muted, fontSize: 11, cursor: "pointer", outline: "none", fontWeight: 700 }}>{["En attente", "En cours", "Terminee"].map(function(s) { return <option key={s} value={s}>{s}</option>; })}</select>
          <button onClick={function() { openEdit(i); }} style={{ background: T.warning + "22", border: "1px solid " + T.warning + "44", color: T.warning, borderRadius: 5, padding: "5px 9px", fontSize: 11, cursor: "pointer" }}>✏️</button>
          <button onClick={function() { del(i.id); }} style={{ background: T.danger + "22", border: "1px solid " + T.danger + "44", color: T.danger, borderRadius: 5, padding: "5px 9px", fontSize: 11, cursor: "pointer" }}>🗑</button>
        </div>
      </div>; })}
    </div>
    {showNew && <Modal title={editIntv ? "Modifier l'intervention" : "Nouvelle intervention"} onClose={function() { setShowNew(false); setEditIntv(null); setSaveErr(null); }} onSave={save} saveLabel={editIntv ? "Enregistrer" : "Créer"} T={T}>
      {saving ? <Spin /> : <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {saveErr && <div style={{ background: T.danger + "11", border: "1px solid " + T.danger + "44", borderRadius: 8, padding: "9px 12px", color: T.danger, fontSize: 12, fontWeight: 600 }}>⚠️ {saveErr}</div>}
        <div style={{ background: T.mid, borderRadius: 9, padding: "12px 14px" }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: T.primary, marginBottom: 10 }}>📋 Identification</div>
          <FG cols={2}>
            <FF label="Titre *" value={form.titre} onChange={function(v) { upF("titre", v); }} full T={T} />
            <FS label="Type" value={form.type} onChange={function(v) { upF("type", v); }} options={TYPES_INT} T={T} />
            <FF label="Date" type="date" value={form.date_creation} onChange={function(v) { upF("date_creation", v); }} T={T} />
            <FS label="Statut" value={form.statut} onChange={function(v) { upF("statut", v); }} options={["En attente", "En cours", "Terminee"]} T={T} />
          </FG>
        </div>
        <div style={{ background: T.mid, borderRadius: 9, padding: "12px 14px" }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: T.secondary, marginBottom: 10 }}>👤 Client & Réception</div>
          <FG cols={2}>
            <FF label="Nom du client" value={form.client} onChange={function(v) { upF("client", v); }} placeholder="M. Kouassi, Société ABC..." T={T} />
            <FS label="Voie de réception" value={form.voie_reception} onChange={function(v) { upF("voie_reception", v); }} options={VOIES} T={T} />
            <FS label="Chantier concerné" value={form.chantier} onChange={function(v) { upF("chantier", v); }} options={[""].concat(ch.map(function(c) { return c.nom; }))} T={T} />
            <FF label="Intervenant assigné" value={form.intervenant} onChange={function(v) { upF("intervenant", v); }} placeholder="Nom du technicien..." T={T} />
          </FG>
        </div>
        <div style={{ background: T.mid, borderRadius: 9, padding: "12px 14px" }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: T.warning, marginBottom: 8 }}>📝 Description</div>
          <FF label="" value={form.description} onChange={function(v) { upF("description", v); }} rows={2} full T={T} placeholder="Décrivez le problème signalé..." />
        </div>
        <div style={{ background: T.mid, borderRadius: 9, padding: "12px 14px" }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: T.success, marginBottom: 10 }}>💰 Facturation</div>
          <FG cols={2}>
            <FF label="Montant facturé (XOF)" type="number" value={form.montant_facture} onChange={function(v) { upF("montant_facture", v); }} placeholder="Laisser vide si non chiffré" T={T} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 18 }}>
              <input type="checkbox" id="fact_cb" checked={!!form.facturee} onChange={function(e) { upF("facturee", e.target.checked); }} style={{ width: 16, height: 16, cursor: "pointer" }} />
              <label htmlFor="fact_cb" style={{ fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Marquée comme facturée</label>
            </div>
          </FG>
        </div>
      </div>}
    </Modal>}
  </div>;
}

// ── KPI ───────────────────────────────────────────────────────────────────────
function KpiPage(p) {
  var ch = p.ch, intv = p.intv, T = p.T, isMobile = useBP().isMobile;
  var totalB = ch.reduce(function(a, c) { return a + c.budgetInitial; }, 0);
  var totalD = ch.reduce(function(a, c) { return a + totalDep(c); }, 0);
  var tCout = intv.reduce(function(a, i) { return a + totalDepIntv(i); }, 0);
  var tFact = intv.reduce(function(a, i) { return a + parseFloat(i.montant_facture || 0); }, 0);
  var voieMap = {}; intv.forEach(function(i) { var v = i.voie_reception || "Autre"; if (!voieMap[v]) voieMap[v] = 0; voieMap[v]++; });
  var voieData = Object.entries(voieMap).map(function(e) { return { voie: (VOIE_ICO[e[0]] || "") + " " + e[0].slice(0, 10), nb: e[1] }; });
  var intvParType = TYPES_INT.map(function(t) { return { type: t, nb: intv.filter(function(i) { return i.type === t; }).length }; });
  return <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    <div style={{ fontWeight: 700, fontSize: 13, color: T.primary, borderBottom: "1px solid " + T.border, paddingBottom: 7 }}>🏗️ Chantiers</div>
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 8 }}>
      <Kpi icon="💰" label="Budget" value={fmtS(totalB)} compact T={T} />
      <Kpi icon="🧾" label="Dépenses" value={fmtS(totalD)} color={T.warning} compact T={T} />
      <Kpi icon="💵" label="Marge chantiers" value={fmtS(totalB - totalD)} color={totalB - totalD >= 0 ? T.success : T.danger} compact T={T} />
      <Kpi icon="📊" label="Consommé" value={pct(totalD, totalB) + "%"} color={pct(totalD, totalB) > 100 ? T.danger : T.success} compact T={T} />
    </div>
    <div style={{ fontWeight: 700, fontSize: 13, color: T.secondary, borderBottom: "1px solid " + T.border, paddingBottom: 7, marginTop: 6 }}>🔧 Interventions</div>
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 8 }}>
      <Kpi icon="🔧" label="Total" value={intv.length} color={T.primary} compact T={T} />
      <Kpi icon="🧾" label="Coût engagé" value={fmtS(tCout)} color={T.warning} compact T={T} />
      <Kpi icon="💵" label="Facturé" value={fmtS(tFact)} color={T.primary} compact T={T} />
      <Kpi icon="📈" label="Bénéfice net" value={fmtS(tFact - tCout)} color={tFact - tCout >= 0 ? T.success : T.danger} compact T={T} />
    </div>
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
      <Card title="Voies de réception" T={T}><ResponsiveContainer width="100%" height={160}><BarChart data={voieData}><XAxis dataKey="voie" tick={{ fill: T.muted, fontSize: 9 }} /><YAxis tick={{ fill: T.muted, fontSize: 9 }} /><Tooltip contentStyle={{ background: T.card, border: "1px solid " + T.border, color: T.white }} /><Bar dataKey="nb" fill={T.secondary} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></Card>
      <Card title="Interventions par type" T={T}><ResponsiveContainer width="100%" height={160}><BarChart data={intvParType}><XAxis dataKey="type" tick={{ fill: T.muted, fontSize: 9 }} /><YAxis tick={{ fill: T.muted, fontSize: 9 }} /><Tooltip contentStyle={{ background: T.card, border: "1px solid " + T.border, color: T.white }} /><Bar dataKey="nb" radius={[4, 4, 0, 0]}>{intvParType.map(function(d, i) { var cols = [T.danger, T.secondary, T.primary, "#A855F7"]; return <Cell key={i} fill={cols[i % 4]} />; })}</Bar></BarChart></ResponsiveContainer></Card>
      <Card title="Budget par chantier" T={T}>{ch.map(function(c) { var d = totalDep(c), pp = pct(d, c.budgetInitial); return <div key={c.id} style={{ padding: "6px 0", borderBottom: "1px solid " + T.border }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}><span style={{ fontWeight: 600 }}>{c.nom}</span><span style={{ fontWeight: 700, color: pp > 100 ? T.danger : pp > 80 ? T.warning : T.success }}>{pp}%</span></div><PBar p={pp} color={pp > 100 ? T.danger : pp > 80 ? T.warning : T.success} h={5} /></div>; })} {ch.length === 0 && <Empty msg="Aucun chantier" icon="📊" />}</Card>
    </div>
  </div>;
}

// ── IA ────────────────────────────────────────────────────────────────────────
function IA(p) {
  var ch = p.ch, intv = p.intv, T = p.T;
  var ls = useState(false), loading = ls[0], setLoading = ls[1];
  var rs = useState(null), result = rs[0], setResult = rs[1];
  var es = useState(null), error = es[0], setError = es[1];
  function run() {
    setLoading(true); setError(null); setResult(null);
    var tCout = intv.reduce(function(a, i) { return a + totalDepIntv(i); }, 0);
    var tFact = intv.reduce(function(a, i) { return a + parseFloat(i.montant_facture || 0); }, 0);
    var ctx = { chantiers: ch.map(function(c) { return { nom: c.nom, statut: c.statut, budget: c.budgetInitial, depenses: totalDep(c), pct: pct(totalDep(c), c.budgetInitial) }; }), interventions: { total: intv.length, cout: tCout, facture: tFact, benef: tFact - tCout, urgences: intv.filter(function(i) { return i.type === "Urgence"; }).length, liste: intv.slice(0, 8).map(function(i) { return { titre: i.titre, type: i.type, statut: i.statut, client: i.client, voie: i.voie_reception }; }) } };
    aiCall({ model: AI_MODEL, max_tokens: 1500, messages: [{ role: "user", content: "Expert BTP CI. Analyse ce portefeuille. JSON uniquement:\n" + JSON.stringify(ctx) + "\nFormat: {\"recommandations\":[{\"titre\":\"str\",\"detail\":\"str\",\"priorite\":\"haute\"}],\"scoreGlobal\":75,\"synthese\":\"str\",\"pointsForts\":[\"str\"],\"risques\":[\"str\"]}" }] })
      .then(function(data) { var txt = (data.content || []).map(function(i) { return i.text || ""; }).join(""); var parsed = safeParseJSON(txt); if (!parsed) throw new Error("JSON invalide"); setResult(parsed); setLoading(false); })
      .catch(function(e) { setError("Erreur: " + e.message); setLoading(false); });
  }
  return <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    <div style={{ background: T.primary + "11", border: "1px solid " + T.primary + "44", borderRadius: T.borderRadius, padding: 18 }}>
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 3 }}>Analyse IA du portefeuille</div>
      <div style={{ color: T.muted, fontSize: 12, marginBottom: 12 }}>{ch.length} chantier(s) — {intv.length} interventions</div>
      <button onClick={run} disabled={loading} style={{ background: T.primary, color: "#fff", border: "none", borderRadius: 9, padding: "9px 22px", fontWeight: 700, cursor: loading ? "wait" : "pointer", fontSize: 13 }}>{loading ? "Analyse..." : "Lancer l'analyse"}</button>
      {error && <div style={{ color: T.danger, fontSize: 12, marginTop: 8 }}>{error}</div>}
    </div>
    {!result && !loading && <Empty msg="Lancez l'analyse pour obtenir des recommandations" icon="🤖" />}
    {loading && <Spin />}
    {result && <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Card T={T}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}><div style={{ fontWeight: 800, fontSize: 15 }}>Synthèse</div><div style={{ background: (result.scoreGlobal > 70 ? T.success : result.scoreGlobal > 40 ? T.warning : T.danger) + "22", borderRadius: 7, padding: "5px 14px", fontWeight: 800, fontSize: 17, color: result.scoreGlobal > 70 ? T.success : result.scoreGlobal > 40 ? T.warning : T.danger }}>Score {result.scoreGlobal}/100</div></div>
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 10 }}>{result.synthese}</div>
        {result.pointsForts && result.pointsForts.map(function(pp, i) { return <div key={i} style={{ fontSize: 11, color: T.muted, marginBottom: 2 }}>✅ {pp}</div>; })}
        {result.risques && result.risques.map(function(r, i) { return <div key={i} style={{ fontSize: 11, color: T.muted, marginBottom: 2 }}>⚠️ {r}</div>; })}
      </Card>
      <Card title="Recommandations" T={T}>{(result.recommandations || []).map(function(r, i) { var col = r.priorite === "haute" ? T.danger : r.priorite === "moyenne" ? T.warning : T.success; return <div key={i} style={{ background: col + "11", border: "1px solid " + col + "33", borderRadius: 7, padding: 12, marginBottom: 9 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 7, flexWrap: "wrap", marginBottom: 5 }}><div style={{ fontWeight: 700, color: col, fontSize: 12 }}>{r.titre}</div><Badge label={"Priorité " + r.priorite} color={col} small /></div><div style={{ fontSize: 11, color: T.muted }}>{r.detail}</div></div>; })}</Card>
    </div>}
  </div>;
}

// ── PARAMETRES ────────────────────────────────────────────────────────────────
function Parametres(p) {
  var T = p.T, upT = p.upT, resetT = p.resetT, isMobile = useBP().isMobile;
  var presets = [{ label: "BTP Orange", colors: { primary: "#F97316", secondary: "#3B82F6", bg: "#1C1917", card: "#292524" } }, { label: "Bleu Pro", colors: { primary: "#2563EB", secondary: "#7C3AED", bg: "#0F172A", card: "#1E293B" } }, { label: "Vert Nature", colors: { primary: "#16A34A", secondary: "#0891B2", bg: "#14532D", card: "#166534" } }, { label: "Rouge BTP", colors: { primary: "#DC2626", secondary: "#D97706", bg: "#1C0A0A", card: "#2C1010" } }, { label: "Dark Pro", colors: { primary: "#6366F1", secondary: "#EC4899", bg: "#000000", card: "#111111" } }];
  return <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
    <Card title="Thèmes" T={T}><div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5,1fr)", gap: 9 }}>{presets.map(function(pp) { return <button key={pp.label} onClick={function() { Object.keys(pp.colors).forEach(function(k) { upT(k, pp.colors[k]); }); }} style={{ background: pp.colors.card, border: "2px solid " + pp.colors.primary, borderRadius: 9, padding: "10px 8px", cursor: "pointer", textAlign: "left" }}><div style={{ display: "flex", gap: 3, marginBottom: 5 }}>{Object.values(pp.colors).map(function(c, i) { return <div key={i} style={{ width: 12, height: 12, borderRadius: "50%", background: c }} />; })}</div><div style={{ fontSize: 10, fontWeight: 700, color: pp.colors.primary }}>{pp.label}</div></button>; })}</div></Card>
    <Card title="Entreprise" T={T}>{[["Nom", "companyName"], ["Adresse", "companyAddress"], ["Téléphone", "companyTel"], ["Email", "companyEmail"], ["SIRET / RC", "companySiret"]].map(function(row) { return <div key={row[1]} style={{ padding: "9px 0", borderBottom: "1px solid " + T.border }}><label style={{ fontSize: 10, color: T.muted, display: "block", marginBottom: 3 }}>{row[0]}</label><input value={T[row[1]] || ""} onChange={function(e) { upT(row[1], e.target.value); }} style={{ width: "100%", background: T.mid, border: "1px solid " + T.border, borderRadius: 7, padding: "7px 10px", color: T.white, fontSize: 13, outline: "none", boxSizing: "border-box" }} /></div>; })}</Card>
    <div style={{ display: "flex", justifyContent: "flex-end" }}><button onClick={resetT} style={{ background: T.danger + "22", color: T.danger, border: "1px solid " + T.danger + "44", borderRadius: 8, padding: "9px 18px", fontWeight: 700, cursor: "pointer" }}>Réinitialiser</button></div>
  </div>;
}
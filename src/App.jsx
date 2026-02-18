import { useState, useEffect, useMemo } from "react";

// ── Supabase client léger (fetch direct REST + Realtime désactivé) ────────────
function createClient(url, key) {
  const headers = { "Content-Type": "application/json", "apikey": key, "Authorization": "Bearer " + key };
  const rest = url + "/rest/v1";

  const from = (table) => ({
    _table: table, _filters: [], _order: null, _sel: "*",
    select(s) { this._sel = s; return this; },
    order(col, opts) { this._order = col + (opts?.ascending===false?"?order="+col+".desc":"?order="+col+".asc"); return this; },
    eq(col, val) { this._filters.push(col + "=eq." + val); return this; },
    async _url(extra) {
      let u = rest + "/" + this._table + "?select=" + this._sel;
      this._filters.forEach(f => u += "&" + f);
      if (this._order) u = rest + "/" + this._table + "?" + this._order + "&select=" + this._sel + (this._filters.length?"&"+this._filters.join("&"):"");
      return u;
    },
    async select_run() {
      const u = await this._url();
      const r = await fetch(u, { headers });
      const data = await r.json();
      return r.ok ? { data, error: null } : { data: null, error: data };
    },
    async insert(obj) {
      const r = await fetch(rest + "/" + this._table, { method:"POST", headers: { ...headers, "Prefer":"return=representation" }, body: JSON.stringify(obj) });
      const data = await r.json();
      return r.ok ? { data, error: null } : { data: null, error: data };
    },
    async update(obj) {
      let u = rest + "/" + this._table + "?" + this._filters.join("&");
      const r = await fetch(u, { method:"PATCH", headers: { ...headers, "Prefer":"return=representation" }, body: JSON.stringify(obj) });
      const data = await r.json();
      return r.ok ? { data, error: null } : { data: null, error: data };
    },
    async delete() {
      let u = rest + "/" + this._table + "?" + this._filters.join("&");
      const r = await fetch(u, { method:"DELETE", headers });
      return r.ok ? { error: null } : { error: await r.json() };
    },
  });

  return { from };
}

// ── Supabase ──────────────────────────────────────────────────────────────────
const SUPA_URL = "https://mbkwpaxissvvjhewkggl.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ia3dwYXhpc3N2dmpoZXdrZ2dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MjQzOTMsImV4cCI6MjA4NzAwMDM5M30.Zo9aJVDByO8aVSADfSCc2m4jCI1qeXuWYQgVRT-a3LA";
const sb = createClient(SUPA_URL, SUPA_KEY);

const C = {
  orange:"#F97316",orangeD:"#EA580C",orangeL:"#FED7AA",
  dark:"#292524",mid:"#44403C",border:"#57534E",card:"#292524",
  bg:"#1C1917",white:"#FAFAF9",muted:"#A8A29E",light:"#78716C",
  green:"#22C55E",red:"#EF4444",yellow:"#EAB308",blue:"#3B82F6",purple:"#A855F7"
};
const CATEGORIES = ["Main d'œuvre","Matériaux","Équipement","Transport","Sous-traitance","Divers"];

const fmt = n => new Intl.NumberFormat("fr-FR",{style:"currency",currency:"XOF",maximumFractionDigits:0}).format(n);
const pct = (v,t) => t>0?Math.round(v/t*100):0;
const statutColor = s => ({"En cours":C.blue,"En dérive":C.red,"Clôturé":C.green,"Planifié":C.yellow,"En pause":C.light,"Brouillon":C.muted,"En réception":C.orange}[s]||C.muted);
const catColor = c => ({"Main d'œuvre":C.blue,"Matériaux":C.orange,"Équipement":C.yellow,"Transport":C.green,"Sous-traitance":C.purple,"Divers":C.muted}[c]||C.muted);
const budgetColor = s => ({Conforme:C.green,"80% consommé":C.yellow,Dépassement:C.red}[s]||C.muted);
const getSousStatut = (dep,bud) => { const p=pct(dep,bud); return p>100?"Dépassement":p>=80?"80% consommé":"Conforme"; };
const totalDep = c => (c.depenses||[]).reduce((a,d)=>a+Number(d.montant),0);
const totalIntDep = i => (i.depenses||[]).reduce((a,d)=>a+Number(d.montant),0);

// ── UI Atoms ──────────────────────────────────────────────────────────────────
const Badge=({label,color,small})=><span style={{background:color+"22",color,border:"1px solid "+color+"55",borderRadius:6,padding:small?"2px 7px":"3px 10px",fontSize:small?11:12,fontWeight:600,whiteSpace:"nowrap"}}>{label}</span>;
const KpiCard=({icon,label,value,sub,color})=>(
  <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,padding:"16px 20px",flex:1,minWidth:140}}>
    <div style={{fontSize:22,marginBottom:4}}>{icon}</div>
    <div style={{fontSize:22,fontWeight:700,color:color||C.white}}>{value}</div>
    <div style={{fontSize:12,color:C.muted,marginTop:2}}>{label}</div>
    {sub&&<div style={{fontSize:11,color:C.light,marginTop:4}}>{sub}</div>}
  </div>
);
const PBar=({p,color,h})=><div style={{background:C.mid,borderRadius:99,height:h||8,overflow:"hidden"}}><div style={{width:Math.min(p,100)+"%",background:color||C.orange,height:"100%",borderRadius:99}}/></div>;
const Card=({title,children})=><div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,padding:"18px 20px"}}>{title&&<div style={{fontWeight:700,fontSize:14,marginBottom:14}}>{title}</div>}{children}</div>;
const EmptyState=({msg,icon})=><div style={{textAlign:"center",padding:"40px 20px",color:C.muted}}><div style={{fontSize:40,marginBottom:12}}>{icon}</div><div style={{fontSize:14}}>{msg}</div></div>;
const Spinner=()=><div style={{display:"flex",alignItems:"center",justifyContent:"center",height:200,flexDirection:"column",gap:12}}><div style={{width:40,height:40,border:"4px solid "+C.border,borderTop:"4px solid "+C.orange,borderRadius:"50%",animation:"spin 1s linear infinite"}}/><div style={{color:C.muted,fontSize:13}}>Chargement depuis Supabase...</div><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>;
const Modal=({title,onClose,onSave,children})=>(
  <div style={{position:"fixed",inset:0,background:"#00000099",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
    <div style={{background:C.dark,border:"1px solid "+C.border,borderRadius:16,padding:28,width:"100%",maxWidth:560,maxHeight:"90vh",overflow:"auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
        <div style={{fontWeight:800,fontSize:16}}>{title}</div>
        <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:18}}>✕</button>
      </div>
      {children}
      <div style={{display:"flex",gap:10,marginTop:20,justifyContent:"flex-end"}}>
        <button onClick={onClose} style={{padding:"8px 20px",background:C.mid,color:C.white,border:"none",borderRadius:8,cursor:"pointer"}}>Annuler</button>
        <button onClick={onSave} style={{padding:"8px 20px",background:C.orange,color:"#fff",border:"none",borderRadius:8,fontWeight:700,cursor:"pointer"}}>Enregistrer</button>
      </div>
    </div>
  </div>
);
const FGrid=({children})=><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>{children}</div>;
const FField=({label,value,onChange,type})=>(
  <div><label style={{fontSize:12,color:C.muted,display:"block",marginBottom:4}}>{label}</label>
  <input type={type||"text"} value={value} onChange={e=>onChange(e.target.value)} style={{width:"100%",background:C.mid,border:"1px solid "+C.border,borderRadius:8,padding:"9px 12px",color:C.white,fontSize:13,boxSizing:"border-box",outline:"none"}}/></div>
);
const FSelect=({label,value,onChange,options})=>(
  <div><label style={{fontSize:12,color:C.muted,display:"block",marginBottom:4}}>{label}</label>
  <select value={value} onChange={e=>onChange(e.target.value)} style={{width:"100%",background:C.mid,border:"1px solid "+C.border,borderRadius:8,padding:"9px 12px",color:C.white,fontSize:13,boxSizing:"border-box",outline:"none"}}>
    {options.map(o=><option key={o} value={o}>{o}</option>)}
  </select></div>
);

// ═════════════════════════════════════════════════════════════════════════════
// HOOK — chargement données Supabase
// ═════════════════════════════════════════════════════════════════════════════
function useSupabaseData() {
  const [chantiers, setChantiers] = useState([]);
  const [interventions, setInterventions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = (table, order) => {
        let t = sb.from(table);
        if (order) t = t.order(order, { ascending: false });
        return t.select_run();
      };
      const [r1,r2,r3,r4,r5] = await Promise.all([q("chantiers","created_at"),q("depenses","date"),q("interventions","created_at"),q("intervention_depenses"),q("intervention_todos")]);
      const [{ data: ch, error: e1 },{ data: dep, error: e2 },{ data: intv, error: e3 },{ data: idep, error: e4 },{ data: todos, error: e5 }] = [r1,r2,r3,r4,r5];
      if (e1) throw e1;
      if (e2) throw e2;
      if (e3) throw e3;
      if (e4) throw e4;
      if (e5) throw e5;

      // Assembler
      const chantiersAssembled = (ch || []).map(c => ({
        ...c,
        budgetInitial: Number(c.budget_initial),
        dateDebut: c.date_debut,
        dateFin: c.date_fin,
        alertes: c.alertes || [],
        depenses: (dep || []).filter(d => d.chantier_id === c.id).map(d => ({ ...d, montant: Number(d.montant) }))
      }));

      const intAssembled = (intv || []).map(i => ({
        ...i,
        dateCreation: i.date_creation,
        depenses: (idep || []).filter(d => d.intervention_id === i.id).map(d => ({ ...d, montant: Number(d.montant) })),
        todos: (todos || []).filter(t => t.intervention_id === i.id)
      }));

      setChantiers(chantiersAssembled);
      setInterventions(intAssembled);
    } catch (err) {
      setError("Erreur connexion Supabase : " + (err.message || JSON.stringify(err)));
    }
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);
  return { chantiers, setChantiers, interventions, setInterventions, loading, error, reload: loadAll };
}

// ═════════════════════════════════════════════════════════════════════════════
// APP
// ═════════════════════════════════════════════════════════════════════════════
export default function App() {
  const { chantiers, setChantiers, interventions, setInterventions, loading, error, reload } = useSupabaseData();
  const [page, setPage] = useState("dashboard");
  const [selectedId, setSelectedId] = useState(null);
  const [onglet, setOnglet] = useState("infos");
  const [sideOpen, setSideOpen] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newForm, setNewForm] = useState({ nom:"", client:"", localisation:"", type:"Construction", budgetInitial:"", dateDebut:"", dateFin:"" });

  const selected = chantiers.find(c => c.id === selectedId);
  const openChantier = id => { setSelectedId(id); setPage("fiche"); setOnglet("infos"); };

  const saveChantier = async () => {
    if (!newForm.nom || !newForm.client || !newForm.budgetInitial) return;
    setSaving(true);
    const { error } = await sb.from("chantiers").insert({
      nom: newForm.nom, client: newForm.client, localisation: newForm.localisation,
      type: newForm.type, budget_initial: parseFloat(newForm.budgetInitial),
      date_debut: newForm.dateDebut || null, date_fin: newForm.dateFin || null,
      statut: "Brouillon", alertes: [], score: 100, lat: 5.35, lng: -4.0
    });
    setSaving(false);
    if (!error) { setShowNew(false); setNewForm({ nom:"", client:"", localisation:"", type:"Construction", budgetInitial:"", dateDebut:"", dateFin:"" }); reload(); }
    else alert("Erreur : " + error.message);
  };

  const deleteChantier = async id => {
    await sb.from("chantiers").delete().eq("id", id);
    setPage("chantiers"); reload();
  };

  const nbAlertes = chantiers.filter(c => pct(totalDep(c), c.budgetInitial) >= 90 || c.statut === "En dérive").length;
  const nbIntEnCours = interventions.filter(i => i.statut === "En cours").length;

  const navItems = [
    { key:"dashboard", icon:"📊", label:"Dashboard Global" },
    { key:"chantiers", icon:"🏗️", label:"Mes Chantiers" },
    { key:"interventions", icon:"🔧", label:"Interventions", badge: nbIntEnCours },
    { key:"alertes", icon:"🔔", label:"Alertes", badge: nbAlertes },
    { key:"kpi", icon:"📈", label:"KPIs & Analyses" },
    { key:"ia", icon:"🤖", label:"Intelligence IA" },
  ];

  const titles = { dashboard:"📊 Dashboard", chantiers:"🏗️ Mes Chantiers", interventions:"🔧 Interventions", alertes:"🔔 Alertes", kpi:"📈 KPIs", ia:"🤖 IA", fiche: selected ? "🏗️ " + selected.nom : "" };

  return (
    <div style={{ display:"flex", height:"100vh", background:C.bg, color:C.white, fontFamily:"'Segoe UI',system-ui,sans-serif", overflow:"hidden" }}>
      {/* Sidebar */}
      <div style={{ width:sideOpen?220:60, background:C.dark, borderRight:"1px solid "+C.border, display:"flex", flexDirection:"column", transition:"width .25s", overflow:"hidden", flexShrink:0 }}>
        <div style={{ padding:"20px 14px 16px", borderBottom:"1px solid "+C.border, display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ background:C.orange, borderRadius:10, width:36, height:36, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>🏗</div>
          {sideOpen && <div><div style={{ fontWeight:700, fontSize:14 }}>JEAN MANAGER</div><div style={{ fontSize:10, color:C.orange }}>☁️ Supabase</div></div>}
        </div>
        <nav style={{ flex:1, padding:"10px 8px" }}>
          {navItems.map(n => (
            <button key={n.key} onClick={() => setPage(n.key)} style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"10px 8px", borderRadius:8, border:"none", background:page===n.key?C.orange+"22":"transparent", color:page===n.key?C.orange:C.muted, cursor:"pointer", marginBottom:2, textAlign:"left" }}>
              <span style={{ fontSize:18, flexShrink:0 }}>{n.icon}</span>
              {sideOpen && <span style={{ fontSize:13, fontWeight:page===n.key?700:400, flex:1 }}>{n.label}</span>}
              {sideOpen && n.badge > 0 && <span style={{ background:C.red, color:"#fff", borderRadius:99, fontSize:10, padding:"1px 6px", fontWeight:700 }}>{n.badge}</span>}
            </button>
          ))}
        </nav>
        {sideOpen && (
          <div style={{ padding:8, borderTop:"1px solid "+C.border }}>
            <button onClick={reload} style={{ width:"100%", background:C.blue+"22", border:"1px solid "+C.blue+"44", color:C.blue, borderRadius:8, padding:8, fontSize:11, fontWeight:700, cursor:"pointer" }}>
              🔄 Synchroniser
            </button>
          </div>
        )}
        <button onClick={() => setSideOpen(p => !p)} style={{ margin:8, padding:8, border:"none", background:C.mid, color:C.muted, borderRadius:8, cursor:"pointer" }}>{sideOpen ? "◀" : "▶"}</button>
      </div>

      {/* Main */}
      <div style={{ flex:1, overflow:"auto", display:"flex", flexDirection:"column" }}>
        <div style={{ background:C.dark, borderBottom:"1px solid "+C.border, padding:"12px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ fontSize:16, fontWeight:700 }}>{titles[page]}</div>
            <div style={{ background:C.green+"22", border:"1px solid "+C.green+"44", borderRadius:6, padding:"2px 10px", fontSize:11, color:C.green }}>☁️ Supabase connecté</div>
          </div>
          <div style={{ display:"flex", gap:10, alignItems:"center" }}>
            {(page === "chantiers" || page === "dashboard") && (
              <button onClick={() => setShowNew(true)} style={{ background:C.orange, color:"#fff", border:"none", borderRadius:8, padding:"8px 16px", fontWeight:700, cursor:"pointer", fontSize:13 }}>+ Nouveau chantier</button>
            )}
            {page === "fiche" && selected && (
              <button onClick={() => { if (window.confirm("Supprimer ?")) deleteChantier(selected.id); }} style={{ background:C.red+"22", color:C.red, border:"1px solid "+C.red+"44", borderRadius:8, padding:"8px 14px", fontWeight:700, cursor:"pointer", fontSize:13 }}>🗑️ Supprimer</button>
            )}
            <div style={{ background:C.mid, borderRadius:8, padding:"6px 12px", fontSize:12, color:C.muted }}>👤 Admin</div>
          </div>
        </div>

        <div style={{ flex:1, overflow:"auto", padding:24 }}>
          {loading ? <Spinner /> : error ? (
            <div style={{ background:C.red+"11", border:"1px solid "+C.red+"44", borderRadius:12, padding:24, textAlign:"center" }}>
              <div style={{ fontSize:32, marginBottom:12 }}>⚠️</div>
              <div style={{ color:C.red, fontWeight:700, marginBottom:8 }}>Erreur de connexion Supabase</div>
              <div style={{ color:C.muted, fontSize:13, marginBottom:16 }}>{error}</div>
              <div style={{ color:C.muted, fontSize:12, marginBottom:16 }}>Vérifiez que vous avez bien exécuté le script SQL dans Supabase.</div>
              <button onClick={reload} style={{ background:C.orange, color:"#fff", border:"none", borderRadius:8, padding:"10px 24px", fontWeight:700, cursor:"pointer" }}>🔄 Réessayer</button>
            </div>
          ) : (
            <>
              {page === "dashboard" && <DashboardPage chantiers={chantiers} openChantier={openChantier} interventions={interventions} />}
              {page === "chantiers" && <ChantiersPage chantiers={chantiers} openChantier={openChantier} deleteChantier={deleteChantier} />}
              {page === "fiche" && selected && <FichePage chantier={selected} onglet={onglet} setOnglet={setOnglet} setPage={setPage} reload={reload} />}
              {page === "interventions" && <InterventionsPage interventions={interventions} setInterventions={setInterventions} chantiers={chantiers} reload={reload} />}
              {page === "alertes" && <AlertesPage chantiers={chantiers} openChantier={openChantier} />}
              {page === "kpi" && <KpiPage chantiers={chantiers} />}
              {page === "ia" && <IAPage chantiers={chantiers} openChantier={openChantier} interventions={interventions} />}
            </>
          )}
        </div>
      </div>

      {showNew && (
        <Modal title="+ Nouveau Chantier" onClose={() => setShowNew(false)} onSave={saveChantier}>
          {saving ? <Spinner /> : (
            <FGrid>
              <FField label="Nom *" value={newForm.nom} onChange={v => setNewForm(p => ({ ...p, nom:v }))} />
              <FField label="Client *" value={newForm.client} onChange={v => setNewForm(p => ({ ...p, client:v }))} />
              <FField label="Localisation" value={newForm.localisation} onChange={v => setNewForm(p => ({ ...p, localisation:v }))} />
              <FSelect label="Type" value={newForm.type} onChange={v => setNewForm(p => ({ ...p, type:v }))} options={["Construction","Réhabilitation","Maintenance"]} />
              <FField label="Budget initial (XOF) *" type="number" value={newForm.budgetInitial} onChange={v => setNewForm(p => ({ ...p, budgetInitial:v }))} />
              <FField label="Date début" type="date" value={newForm.dateDebut} onChange={v => setNewForm(p => ({ ...p, dateDebut:v }))} />
              <FField label="Date fin" type="date" value={newForm.dateFin} onChange={v => setNewForm(p => ({ ...p, dateFin:v }))} />
            </FGrid>
          )}
        </Modal>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═════════════════════════════════════════════════════════════════════════════
function DashboardPage({ chantiers, openChantier, interventions }) {
  const totalB = chantiers.reduce((a,c) => a + c.budgetInitial, 0);
  const totalD = chantiers.reduce((a,c) => a + totalDep(c), 0);
  const nbUrgences = interventions.filter(i => i.type === "Urgence" && i.statut !== "Terminée").length;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
      <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
        <KpiCard icon="🏗️" label="Chantiers" value={chantiers.length} color={C.orange} />
        <KpiCard icon="💰" label="Budget total" value={fmt(totalB)} />
        <KpiCard icon="🧾" label="Dépenses réelles" value={fmt(totalD)} sub={pct(totalD,totalB)+"%"} color={C.yellow} />
        <KpiCard icon="💵" label="Marge globale" value={fmt(totalB-totalD)} color={totalB-totalD>=0?C.green:C.red} />
        <KpiCard icon="🚨" label="Urgences" value={nbUrgences} color={nbUrgences>0?C.red:C.green} />
      </div>
      <Card title="Chantiers actifs">
        {chantiers.filter(c => c.statut !== "Clôturé").map(c => {
          const d = totalDep(c); const p = pct(d, c.budgetInitial);
          return (
            <div key={c.id} onClick={() => openChantier(c.id)} style={{ display:"flex", alignItems:"center", gap:14, padding:"12px 0", borderBottom:"1px solid "+C.border, cursor:"pointer" }}>
              <div style={{ flex:2 }}><div style={{ fontWeight:600 }}>{c.nom}</div><div style={{ fontSize:12, color:C.muted }}>{c.client}</div></div>
              <Badge label={c.statut} color={statutColor(c.statut)} />
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:C.muted, marginBottom:4 }}><span>Budget</span><span style={{ color:p>100?C.red:p>80?C.yellow:C.green, fontWeight:700 }}>{p}%</span></div>
                <PBar p={p} color={p>100?C.red:p>80?C.yellow:C.green} />
              </div>
              <div style={{ textAlign:"right", minWidth:120 }}><div style={{ fontSize:12, fontWeight:600 }}>{fmt(d)}</div><div style={{ fontSize:11, color:C.muted }}>/ {fmt(c.budgetInitial)}</div></div>
            </div>
          );
        })}
        {chantiers.filter(c => c.statut !== "Clôturé").length === 0 && <EmptyState msg="Aucun chantier actif" icon="🏗️" />}
      </Card>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// CHANTIERS
// ═════════════════════════════════════════════════════════════════════════════
function ChantiersPage({ chantiers, openChantier, deleteChantier }) {
  const [filter, setFilter] = useState("Tous");
  const statuts = ["Tous","Brouillon","Planifié","En cours","En dérive","Clôturé"];
  const filtered = filter === "Tous" ? chantiers : chantiers.filter(c => c.statut === filter);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        {statuts.map(s => <button key={s} onClick={() => setFilter(s)} style={{ padding:"6px 14px", borderRadius:20, border:"1px solid "+(filter===s?C.orange:C.border), background:filter===s?C.orange:"transparent", color:filter===s?"#fff":C.muted, cursor:"pointer", fontSize:12, fontWeight:filter===s?700:400 }}>{s}</button>)}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))", gap:16 }}>
        {filtered.map(c => <ChantierCard key={c.id} c={c} onClick={() => openChantier(c.id)} onDelete={e => { e.stopPropagation(); if (window.confirm("Supprimer " + c.nom + " ?")) deleteChantier(c.id); }} />)}
      </div>
      {filtered.length === 0 && <EmptyState msg="Aucun chantier" icon="🏗️" />}
    </div>
  );
}

function ChantierCard({ c, onClick, onDelete }) {
  const d = totalDep(c); const p = pct(d, c.budgetInitial); const ssb = getSousStatut(d, c.budgetInitial);
  return (
    <div onClick={onClick} style={{ background:C.card, border:"1px solid "+(ssb==="Dépassement"?C.red+"66":C.border), borderRadius:14, padding:20, cursor:"pointer", position:"relative" }}
      onMouseEnter={e => e.currentTarget.style.borderColor=C.orange}
      onMouseLeave={e => e.currentTarget.style.borderColor=ssb==="Dépassement"?C.red+"66":C.border}>
      <button onClick={onDelete} style={{ position:"absolute", top:12, right:12, background:C.red+"22", border:"1px solid "+C.red+"44", color:C.red, borderRadius:6, padding:"3px 8px", fontSize:11, cursor:"pointer" }}>🗑️</button>
      <div style={{ marginBottom:12, paddingRight:40 }}>
        <div style={{ fontWeight:700, fontSize:15 }}>{c.nom}</div>
        <div style={{ fontSize:12, color:C.muted }}>{c.client} · 📍 {c.localisation}</div>
      </div>
      <div style={{ display:"flex", gap:6, marginBottom:12, flexWrap:"wrap" }}>
        <Badge label={c.statut} color={statutColor(c.statut)} />
        <Badge label={c.type} color={C.orange} small />
        <Badge label={ssb} color={budgetColor(ssb)} small />
      </div>
      <div style={{ marginBottom:6 }}>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4 }}><span style={{ color:C.muted }}>Budget consommé</span><span style={{ fontWeight:700, color:p>100?C.red:p>80?C.yellow:C.green }}>{p}%</span></div>
        <PBar p={p} color={p>100?C.red:p>80?C.yellow:C.green} />
      </div>
      <div style={{ marginTop:10, paddingTop:10, borderTop:"1px solid "+C.border, fontSize:12, color:C.muted }}>
        🧾 {fmt(d)} / {fmt(c.budgetInitial)}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// FICHE CHANTIER
// ═════════════════════════════════════════════════════════════════════════════
function FichePage({ chantier: c, onglet, setOnglet, setPage, reload }) {
  const [saving, setSaving] = useState(false);
  const [showNewDep, setShowNewDep] = useState(false);
  const [depForm, setDepForm] = useState({ libelle:"", categorie:"Main d'œuvre", montant:"", date:new Date().toISOString().slice(0,10), note:"" });
  const [filterCat, setFilterCat] = useState("Toutes");
  const [showStatutMenu, setShowStatutMenu] = useState(false);

  const dep = totalDep(c); const depPct = pct(dep, c.budgetInitial); const ssb = getSousStatut(dep, c.budgetInitial);
  const cycleVie = ["Brouillon","Planifié","En cours","En pause","En dérive","En réception","Clôturé"];
  const cycleIdx = cycleVie.indexOf(c.statut);

  const changeStatut = async s => {
    await sb.from("chantiers").update({ statut: s }).eq("id", c.id);
    setShowStatutMenu(false); reload();
  };

  const addDep = async () => {
    if (!depForm.libelle || !depForm.montant) return;
    setSaving(true);
    await sb.from("depenses").insert({ chantier_id: c.id, libelle: depForm.libelle, categorie: depForm.categorie, montant: parseFloat(depForm.montant), date: depForm.date, note: depForm.note });
    setSaving(false); setShowNewDep(false);
    setDepForm({ libelle:"", categorie:"Main d'œuvre", montant:"", date:new Date().toISOString().slice(0,10), note:"" });
    reload();
  };

  const delDep = async id => {
    await sb.from("depenses").delete().eq("id", id);
    reload();
  };

  const filteredDep = filterCat === "Toutes" ? c.depenses : c.depenses.filter(d => d.categorie === filterCat);
  const depParCat = CATEGORIES.map(cat => ({ cat, total: c.depenses.filter(d => d.categorie === cat).reduce((a,d) => a+Number(d.montant),0) })).filter(x => x.total > 0);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
      <button onClick={() => setPage("chantiers")} style={{ background:"none", border:"none", color:C.orange, cursor:"pointer", fontSize:13, marginBottom:16, textAlign:"left" }}>← Retour</button>

      {/* Header */}
      <div style={{ background:C.card, border:"1px solid "+C.border, borderRadius:14, padding:"20px 24px", marginBottom:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12 }}>
          <div>
            <div style={{ fontSize:22, fontWeight:800 }}>{c.nom}</div>
            <div style={{ color:C.muted, fontSize:13, marginTop:4 }}>👤 {c.client} · 📍 {c.localisation} · 🏷️ {c.type}</div>
            <div style={{ color:C.muted, fontSize:12, marginTop:2 }}>📅 {c.dateDebut} → {c.dateFin}</div>
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
            <Badge label={ssb} color={budgetColor(ssb)} />
            <div style={{ position:"relative" }}>
              <button onClick={() => setShowStatutMenu(p => !p)} style={{ display:"flex", alignItems:"center", gap:6, background:statutColor(c.statut)+"22", border:"2px solid "+statutColor(c.statut), borderRadius:8, padding:"6px 14px", color:statutColor(c.statut), cursor:"pointer", fontWeight:700, fontSize:13 }}>
                {c.statut} <span style={{ fontSize:10 }}>▼</span>
              </button>
              {showStatutMenu && (
                <div style={{ position:"absolute", right:0, top:"calc(100% + 6px)", background:C.dark, border:"1px solid "+C.border, borderRadius:10, zIndex:50, minWidth:170, overflow:"hidden", boxShadow:"0 8px 24px #0008" }}>
                  {cycleVie.map(s => <button key={s} onClick={() => changeStatut(s)} style={{ width:"100%", display:"flex", alignItems:"center", gap:8, padding:"10px 14px", border:"none", background:c.statut===s?statutColor(s)+"22":"transparent", color:c.statut===s?statutColor(s):C.white, cursor:"pointer", fontSize:13, fontWeight:c.statut===s?700:400, textAlign:"left" }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:statutColor(s) }} />{s}{c.statut===s&&<span style={{ marginLeft:"auto" }}>✓</span>}
                  </button>)}
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Cycle de vie */}
        <div style={{ marginTop:18 }}>
          <div style={{ fontSize:11, color:C.muted, marginBottom:8 }}>Cycle de vie</div>
          <div style={{ display:"flex", alignItems:"center", overflowX:"auto" }}>
            {cycleVie.map((s, i) => (
              <div key={s} style={{ display:"flex", alignItems:"center" }}>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                  <button onClick={() => changeStatut(s)} style={{ width:30, height:30, borderRadius:"50%", background:i===cycleIdx?C.orange:i<cycleIdx?C.green:C.mid, border:i===cycleIdx?"3px solid "+C.orangeL:"3px solid transparent", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:"#fff", cursor:"pointer", flexShrink:0 }}>
                    {i < cycleIdx ? "✓" : i+1}
                  </button>
                  <div style={{ fontSize:9, color:i===cycleIdx?C.orange:i<cycleIdx?C.green:C.muted, whiteSpace:"nowrap", fontWeight:i===cycleIdx?700:400 }}>{s}</div>
                </div>
                {i < cycleVie.length-1 && <div style={{ width:22, height:2, background:i<cycleIdx?C.green:C.mid, marginBottom:14, flexShrink:0 }} />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Onglets */}
      <div style={{ display:"flex", gap:4, marginBottom:20 }}>
        {["infos","dépenses","analyse"].map(o => (
          <button key={o} onClick={() => setOnglet(o)} style={{ padding:"8px 16px", borderRadius:8, border:"1px solid "+(onglet===o?C.orange:C.border), background:onglet===o?C.orange:C.card, color:onglet===o?"#fff":C.muted, cursor:"pointer", fontSize:13, fontWeight:onglet===o?700:400, textTransform:"capitalize" }}>
            {o}{o==="dépenses"&&c.depenses.length>0&&<span style={{ background:C.yellow, color:C.dark, borderRadius:99, fontSize:9, padding:"1px 5px", fontWeight:800, marginLeft:5 }}>{c.depenses.length}</span>}
          </button>
        ))}
      </div>

      {onglet === "infos" && (
        <Card title="Informations générales">
          {[["Nom",c.nom],["Client",c.client],["Localisation",c.localisation],["Type",c.type],["Budget initial",fmt(c.budgetInitial)],["Dépenses actuelles",fmt(dep)],["Marge",fmt(c.budgetInitial-dep)],["Date début",c.dateDebut],["Date fin",c.dateFin]].map(([k,v]) => (
            <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid "+C.border, fontSize:13 }}>
              <span style={{ color:C.muted }}>{k}</span><span style={{ fontWeight:600 }}>{v}</span>
            </div>
          ))}
        </Card>
      )}

      {onglet === "dépenses" && (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
            <KpiCard icon="🧾" label="Total dépenses" value={fmt(dep)} color={C.yellow} />
            <KpiCard icon="📋" label="Nb lignes" value={c.depenses.length} color={C.orange} />
            <KpiCard icon="💰" label="Reste budget" value={fmt(c.budgetInitial-dep)} color={c.budgetInitial-dep>=0?C.green:C.red} />
            <KpiCard icon="📊" label="Consommé" value={depPct+"%"} color={depPct>100?C.red:depPct>80?C.yellow:C.green} />
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {["Toutes",...CATEGORIES].map(cat => <button key={cat} onClick={() => setFilterCat(cat)} style={{ padding:"5px 12px", borderRadius:20, border:"1px solid "+(filterCat===cat?C.orange:C.border), background:filterCat===cat?C.orange:"transparent", color:filterCat===cat?"#fff":C.muted, cursor:"pointer", fontSize:11, fontWeight:filterCat===cat?700:400 }}>{cat}</button>)}
            </div>
            <button onClick={() => setShowNewDep(true)} style={{ background:C.orange, color:"#fff", border:"none", borderRadius:8, padding:"8px 18px", fontWeight:700, cursor:"pointer", fontSize:13 }}>+ Ajouter</button>
          </div>
          {filteredDep.length === 0 && <EmptyState msg="Aucune dépense" icon="🧾" />}
          {filteredDep.map(d => (
            <div key={d.id} style={{ background:C.card, border:"1px solid "+C.border, borderRadius:12, padding:"14px 18px", display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                  <div style={{ width:8, height:8, borderRadius:"50%", background:catColor(d.categorie) }} />
                  <span style={{ fontWeight:700, fontSize:14 }}>{d.libelle}</span>
                </div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <Badge label={d.categorie} color={catColor(d.categorie)} small />
                  <span style={{ fontSize:11, color:C.muted }}>📅 {d.date}</span>
                  {d.note && <span style={{ fontSize:11, color:C.muted, fontStyle:"italic" }}>💬 {d.note}</span>}
                </div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontWeight:800, fontSize:16, color:C.orange }}>{fmt(d.montant)}</span>
                <button onClick={() => delDep(d.id)} style={{ background:C.red+"22", border:"1px solid "+C.red+"44", color:C.red, borderRadius:6, padding:"4px 10px", fontSize:11, cursor:"pointer" }}>🗑️</button>
              </div>
            </div>
          ))}
          {filteredDep.length > 0 && (
            <div style={{ background:C.card, border:"1px solid "+C.orange+"44", borderRadius:10, padding:"12px 18px", display:"flex", justifyContent:"space-between" }}>
              <span style={{ color:C.muted, fontWeight:600 }}>Total</span>
              <span style={{ fontWeight:800, color:C.orange, fontSize:16 }}>{fmt(filteredDep.reduce((a,d) => a+Number(d.montant),0))}</span>
            </div>
          )}
          {showNewDep && (
            <Modal title="🧾 Nouvelle Dépense" onClose={() => setShowNewDep(false)} onSave={addDep}>
              {saving ? <Spinner /> : (
                <FGrid>
                  <div style={{ gridColumn:"1/-1" }}><FField label="Libellé *" value={depForm.libelle} onChange={v => setDepForm(p => ({ ...p, libelle:v }))} /></div>
                  <FSelect label="Catégorie" value={depForm.categorie} onChange={v => setDepForm(p => ({ ...p, categorie:v }))} options={CATEGORIES} />
                  <FField label="Montant (XOF) *" type="number" value={depForm.montant} onChange={v => setDepForm(p => ({ ...p, montant:v }))} />
                  <FField label="Date" type="date" value={depForm.date} onChange={v => setDepForm(p => ({ ...p, date:v }))} />
                  <div style={{ gridColumn:"1/-1" }}><FField label="Note" value={depForm.note} onChange={v => setDepForm(p => ({ ...p, note:v }))} /></div>
                </FGrid>
              )}
            </Modal>
          )}
        </div>
      )}

      {onglet === "analyse" && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
          <Card title="Analyse budgétaire">
            {[["Budget initial",fmt(c.budgetInitial),C.white],["Dépenses cumulées",fmt(dep),C.yellow],["Marge",fmt(c.budgetInitial-dep),c.budgetInitial-dep>=0?C.green:C.red],["% consommé",depPct+"%",depPct>100?C.red:depPct>80?C.yellow:C.green],["Statut",ssb,budgetColor(ssb)]].map(([k,v,col]) => (
              <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"10px 0", borderBottom:"1px solid "+C.border, fontSize:13 }}>
                <span style={{ color:C.muted }}>{k}</span><span style={{ fontWeight:700, color:col }}>{v}</span>
              </div>
            ))}
          </Card>
          <Card title="Par catégorie">
            {depParCat.length === 0 ? <EmptyState msg="Aucune dépense" icon="📊" /> : depParCat.map(({ cat, total:t }) => (
              <div key={cat} style={{ padding:"8px 0", borderBottom:"1px solid "+C.border }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:4 }}>
                  <span style={{ color:catColor(cat), fontWeight:600 }}>{cat}</span><span style={{ fontWeight:700 }}>{fmt(t)}</span>
                </div>
                <PBar p={pct(t,dep)} color={catColor(cat)} h={5} />
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// INTERVENTIONS
// ═════════════════════════════════════════════════════════════════════════════
function InterventionsPage({ interventions, chantiers, reload }) {
  const [showNew, setShowNew] = useState(false);
  const [viewId, setViewId] = useState(null);
  const [filterType, setFilterType] = useState("Tous");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ titre:"", description:"", type:"Corrective", intervenant:"", chantier:"", client:"", dateCreation:new Date().toISOString().slice(0,10), duree:"1", statut:"En attente" });

  const filtered = interventions.filter(i => filterType === "Tous" || i.type === filterType);
  const totalCout = interventions.reduce((a,i) => a+totalIntDep(i), 0);

  const saveNew = async () => {
    if (!form.titre) return;
    setSaving(true);
    await sb.from("interventions").insert({ titre:form.titre, description:form.description, type:form.type, intervenant:form.intervenant, chantier:form.chantier, client:form.client, date_creation:form.dateCreation, duree:parseInt(form.duree)||1, statut:form.statut, facturee:false });
    setSaving(false); setShowNew(false);
    setForm({ titre:"", description:"", type:"Corrective", intervenant:"", chantier:"", client:"", dateCreation:new Date().toISOString().slice(0,10), duree:"1", statut:"En attente" });
    reload();
  };

  const updateStatut = async (id, s) => { await sb.from("interventions").update({ statut:s }).eq("id", id); reload(); };
  const toggleFacturee = async (id, val) => { await sb.from("interventions").update({ facturee:!val }).eq("id", id); reload(); };
  const deleteInt = async id => { await sb.from("interventions").delete().eq("id", id); reload(); };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
        <KpiCard icon="🔧" label="Total" value={interventions.length} color={C.orange} />
        <KpiCard icon="🚨" label="Urgences" value={interventions.filter(i => i.type==="Urgence").length} color={C.red} />
        <KpiCard icon="⚙️" label="En cours" value={interventions.filter(i => i.statut==="En cours").length} color={C.blue} />
        <KpiCard icon="💰" label="Coût total" value={fmt(totalCout)} color={C.yellow} />
        <KpiCard icon="✅" label="Facturé" value={fmt(interventions.filter(i=>i.facturee).reduce((a,i)=>a+totalIntDep(i),0))} color={C.green} />
      </div>

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {["Tous","Urgence","Préventive","Corrective","Inspection"].map(t => <button key={t} onClick={() => setFilterType(t)} style={{ padding:"6px 14px", borderRadius:20, border:"1px solid "+(filterType===t?C.orange:C.border), background:filterType===t?C.orange:"transparent", color:filterType===t?"#fff":C.muted, cursor:"pointer", fontSize:12, fontWeight:filterType===t?700:400 }}>{t}</button>)}
        </div>
        <button onClick={() => setShowNew(true)} style={{ background:C.orange, color:"#fff", border:"none", borderRadius:8, padding:"8px 18px", fontWeight:700, cursor:"pointer", fontSize:13 }}>+ Nouvelle</button>
      </div>

      {filtered.length === 0 && <EmptyState msg="Aucune intervention" icon="🔧" />}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(360px,1fr))", gap:14 }}>
        {filtered.map(i => (
          <div key={i.id} style={{ background:C.card, border:"1px solid "+(i.type==="Urgence"?C.red+"66":C.border), borderRadius:14, padding:18, display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:15 }}>{i.titre}</div>
                <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>🏗️ {i.chantier||"—"} · 👤 {i.client||"—"}</div>
                <div style={{ fontSize:11, color:C.muted, marginTop:1 }}>📅 {i.dateCreation} · {i.intervenant}</div>
              </div>
              <Badge label={i.type} color={{ Urgence:C.red, Préventive:C.blue, Corrective:C.orange, Inspection:C.purple }[i.type]||C.orange} small />
            </div>
            {i.description && <div style={{ fontSize:12, color:C.muted, background:C.mid, borderRadius:6, padding:"8px 12px" }}>{i.description}</div>}
            <div style={{ display:"flex", gap:10, alignItems:"center", background:C.mid, borderRadius:8, padding:"10px 14px" }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:10, color:C.muted }}>Coût dépenses</div>
                <div style={{ fontWeight:800, color:C.orange, fontSize:16 }}>{fmt(totalIntDep(i))}</div>
              </div>
              <button onClick={() => toggleFacturee(i.id, i.facturee)} style={{ background:i.facturee?C.green+"22":C.red+"22", border:"1px solid "+(i.facturee?C.green:C.red)+"55", borderRadius:8, padding:"6px 14px", color:i.facturee?C.green:C.red, fontWeight:700, fontSize:12, cursor:"pointer" }}>
                {i.facturee ? "✅ Facturée" : "❌ Non facturée"}
              </button>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
              <select value={i.statut} onChange={e => updateStatut(i.id, e.target.value)} style={{ background:C.mid, border:"1px solid "+C.border, borderRadius:6, padding:"5px 10px", color:C.white, fontSize:12, cursor:"pointer", outline:"none" }}>
                {["En attente","En cours","Terminée"].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <div style={{ display:"flex", gap:6 }}>
                <button onClick={() => setViewId(i.id)} style={{ background:C.blue+"22", border:"1px solid "+C.blue+"44", color:C.blue, borderRadius:6, padding:"5px 12px", fontSize:11, cursor:"pointer", fontWeight:600 }}>📋 Détail</button>
                <button onClick={() => deleteInt(i.id)} style={{ background:C.red+"22", border:"1px solid "+C.red+"44", color:C.red, borderRadius:6, padding:"5px 10px", fontSize:11, cursor:"pointer" }}>🗑️</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showNew && (
        <Modal title="🔧 Nouvelle Intervention" onClose={() => setShowNew(false)} onSave={saveNew}>
          {saving ? <Spinner /> : (
            <FGrid>
              <div style={{ gridColumn:"1/-1" }}><FField label="Titre *" value={form.titre} onChange={v => setForm(p => ({ ...p, titre:v }))} /></div>
              <FSelect label="Type" value={form.type} onChange={v => setForm(p => ({ ...p, type:v }))} options={["Urgence","Préventive","Corrective","Inspection"]} />
              <FSelect label="Statut" value={form.statut} onChange={v => setForm(p => ({ ...p, statut:v }))} options={["En attente","En cours","Terminée"]} />
              <FField label="Intervenant" value={form.intervenant} onChange={v => setForm(p => ({ ...p, intervenant:v }))} />
              <FSelect label="Chantier" value={form.chantier} onChange={v => setForm(p => ({ ...p, chantier:v }))} options={["",...chantiers.map(c => c.nom)]} />
              <FField label="Client" value={form.client} onChange={v => setForm(p => ({ ...p, client:v }))} />
              <FField label="Date" type="date" value={form.dateCreation} onChange={v => setForm(p => ({ ...p, dateCreation:v }))} />
              <FField label="Durée (jours)" type="number" value={form.duree} onChange={v => setForm(p => ({ ...p, duree:v }))} />
              <div style={{ gridColumn:"1/-1" }}>
                <label style={{ fontSize:12, color:C.muted, display:"block", marginBottom:4 }}>Description</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description:e.target.value }))} rows={3} style={{ width:"100%", background:C.mid, border:"1px solid "+C.border, borderRadius:8, padding:"9px 12px", color:C.white, fontSize:13, boxSizing:"border-box", outline:"none", resize:"vertical" }} />
              </div>
            </FGrid>
          )}
        </Modal>
      )}
      {viewId && <IntervDetail intervention={interventions.find(i => i.id === viewId)} onClose={() => setViewId(null)} reload={reload} />}
    </div>
  );
}

function IntervDetail({ intervention: i, onClose, reload }) {
  const [tab, setTab] = useState("depenses");
  const [depForm, setDepForm] = useState({ libelle:"", categorie:"Main d'œuvre", montant:"", date:new Date().toISOString().slice(0,10), note:"" });
  const [todoText, setTodoText] = useState("");

  const addDep = async () => {
    if (!depForm.libelle || !depForm.montant) return;
    await sb.from("intervention_depenses").insert({ intervention_id:i.id, libelle:depForm.libelle, categorie:depForm.categorie, montant:parseFloat(depForm.montant), date:depForm.date, note:depForm.note });
    setDepForm({ libelle:"", categorie:"Main d'œuvre", montant:"", date:new Date().toISOString().slice(0,10), note:"" });
    reload();
  };
  const delDep = async id => { await sb.from("intervention_depenses").delete().eq("id", id); reload(); };
  const addTodo = async () => {
    if (!todoText.trim()) return;
    await sb.from("intervention_todos").insert({ intervention_id:i.id, texte:todoText, fait:false });
    setTodoText(""); reload();
  };
  const toggleTodo = async (id, val) => { await sb.from("intervention_todos").update({ fait:!val }).eq("id", id); reload(); };
  const delTodo = async id => { await sb.from("intervention_todos").delete().eq("id", id); reload(); };

  const todosDone = (i.todos||[]).filter(t => t.fait).length;

  return (
    <div style={{ position:"fixed", inset:0, background:"#00000099", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:C.dark, border:"1px solid "+C.border, borderRadius:16, padding:28, width:"100%", maxWidth:640, maxHeight:"90vh", overflow:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
          <div>
            <div style={{ fontWeight:800, fontSize:18 }}>{i.titre}</div>
            <div style={{ fontSize:13, color:C.muted, marginTop:4 }}>🏗️ {i.chantier} · 👤 {i.client}</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:20 }}>✕</button>
        </div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:20 }}>
          <KpiCard icon="💰" label="Coût total" value={fmt(totalIntDep(i))} color={C.orange} />
          <KpiCard icon="✅" label="Todos" value={todosDone+"/"+(i.todos||[]).length} color={todosDone===(i.todos||[]).length&&(i.todos||[]).length>0?C.green:C.blue} />
        </div>
        <div style={{ display:"flex", gap:6, marginBottom:16 }}>
          {["depenses","todos"].map(t => <button key={t} onClick={() => setTab(t)} style={{ padding:"8px 18px", borderRadius:8, border:"1px solid "+(tab===t?C.orange:C.border), background:tab===t?C.orange:C.card, color:tab===t?"#fff":C.muted, cursor:"pointer", fontWeight:tab===t?700:400, fontSize:13 }}>{t==="depenses"?"🧾 Dépenses":"✅ Todos"}</button>)}
        </div>
        {tab === "depenses" && (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <div style={{ display:"flex", gap:8, marginBottom:4 }}>
              <FField label="" value={depForm.libelle} onChange={v => setDepForm(p => ({ ...p, libelle:v }))} />
              <div style={{ display:"flex", gap:6, alignItems:"flex-end" }}>
                <button onClick={addDep} style={{ background:C.orange, color:"#fff", border:"none", borderRadius:8, padding:"9px 16px", fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>+ Ajouter</button>
              </div>
            </div>
            <FGrid>
              <FSelect label="Catégorie" value={depForm.categorie} onChange={v => setDepForm(p => ({ ...p, categorie:v }))} options={CATEGORIES} />
              <FField label="Montant" type="number" value={depForm.montant} onChange={v => setDepForm(p => ({ ...p, montant:v }))} />
              <FField label="Date" type="date" value={depForm.date} onChange={v => setDepForm(p => ({ ...p, date:v }))} />
              <FField label="Note" value={depForm.note} onChange={v => setDepForm(p => ({ ...p, note:v }))} />
            </FGrid>
            {(i.depenses||[]).map(d => (
              <div key={d.id} style={{ background:C.mid, borderRadius:8, padding:"10px 14px", display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                <div><div style={{ fontWeight:600, fontSize:13 }}>{d.libelle}</div><div style={{ fontSize:11, color:C.muted }}><Badge label={d.categorie} color={catColor(d.categorie)} small /> · {d.date}</div></div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontWeight:800, color:C.orange }}>{fmt(d.montant)}</span>
                  <button onClick={() => delDep(d.id)} style={{ background:C.red+"22", border:"1px solid "+C.red+"44", color:C.red, borderRadius:6, padding:"4px 8px", fontSize:11, cursor:"pointer" }}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === "todos" && (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <div style={{ display:"flex", gap:8 }}>
              <input value={todoText} onChange={e => setTodoText(e.target.value)} onKeyDown={e => e.key==="Enter"&&addTodo()} placeholder="Nouvelle tâche..." style={{ flex:1, background:C.mid, border:"1px solid "+C.border, borderRadius:8, padding:"9px 12px", color:C.white, fontSize:13, outline:"none" }} />
              <button onClick={addTodo} style={{ background:C.orange, color:"#fff", border:"none", borderRadius:8, padding:"9px 16px", fontWeight:700, cursor:"pointer" }}>+ Ajouter</button>
            </div>
            {(i.todos||[]).map(t => (
              <div key={t.id} style={{ display:"flex", alignItems:"center", gap:10, background:C.mid, borderRadius:8, padding:"10px 14px" }}>
                <button onClick={() => toggleTodo(t.id, t.fait)} style={{ width:22, height:22, borderRadius:"50%", background:t.fait?C.green:C.border, border:"2px solid "+(t.fait?C.green:C.muted), display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0, color:"#fff", fontSize:12 }}>{t.fait?"✓":""}</button>
                <span style={{ flex:1, fontSize:13, textDecoration:t.fait?"line-through":"none", color:t.fait?C.muted:C.white }}>{t.texte}</span>
                <button onClick={() => delTodo(t.id)} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:14 }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ALERTES
// ═════════════════════════════════════════════════════════════════════════════
function AlertesPage({ chantiers, openChantier }) {
  const alertes = chantiers.flatMap(c => {
    const d = totalDep(c); const p = pct(d, c.budgetInitial); const list = [];
    if (p > 100) list.push({ niveau:"critique", msg:`Dépassement budget : ${p}% consommé (${fmt(d)} / ${fmt(c.budgetInitial)})`, chantier:c });
    else if (p >= 90) list.push({ niveau:"danger", msg:`Budget à ${p}% consommé — risque imminent`, chantier:c });
    else if (p >= 80) list.push({ niveau:"warning", msg:`Budget à ${p}% consommé — surveillance requise`, chantier:c });
    if (c.statut === "En dérive") list.push({ niveau:"critique", msg:"Chantier en dérive — intervention requise", chantier:c });
    return list;
  });
  const col = { critique:C.red, danger:C.orange, warning:C.yellow, info:C.blue };
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {alertes.length === 0 && <EmptyState msg="Aucune alerte 🎉" icon="✅" />}
      {alertes.map(({ alerte, niveau, msg, chantier }, i) => (
        <div key={i} onClick={() => openChantier(chantier.id)} style={{ background:C.card, border:"1px solid "+(col[niveau]||C.border)+"44", borderRadius:10, padding:"14px 18px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div><div style={{ fontWeight:600, fontSize:14, color:col[niveau] }}>⚠️ {msg}</div><div style={{ fontSize:12, color:C.muted, marginTop:4 }}>{chantier.nom} · {chantier.client}</div></div>
          <Badge label={chantier.statut} color={statutColor(chantier.statut)} />
        </div>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// KPI
// ═════════════════════════════════════════════════════════════════════════════
function KpiPage({ chantiers }) {
  const totalBudget = chantiers.reduce((a,c) => a+c.budgetInitial, 0);
  const totalDeps = chantiers.reduce((a,c) => a+totalDep(c), 0);
  const pctGlobal = pct(totalDeps, totalBudget);
  const allDep = chantiers.flatMap(c => c.depenses);
  const depCat = CATEGORIES.map(cat => ({ cat, total: allDep.filter(d => d.categorie===cat).reduce((a,d) => a+Number(d.montant),0) })).filter(x => x.total > 0);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
      <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
        <KpiCard icon="💰" label="Budget total" value={fmt(totalBudget)} />
        <KpiCard icon="🧾" label="Dépenses réelles" value={fmt(totalDeps)} color={C.yellow} sub={pctGlobal+"% consommé"} />
        <KpiCard icon="💵" label="Marge globale" value={fmt(totalBudget-totalDeps)} color={totalBudget-totalDeps>=0?C.green:C.red} />
        <KpiCard icon="🚨" label="En dérive" value={chantiers.filter(c=>c.statut==="En dérive").length} color={C.red} />
        <KpiCard icon="✅" label="Clôturés" value={chantiers.filter(c=>c.statut==="Clôturé").length} color={C.green} />
      </div>
      <Card title="Consommation globale">
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:6 }}>
          <span style={{ color:C.muted }}>Dépenses / Budget total</span>
          <strong style={{ color:pctGlobal>100?C.red:pctGlobal>80?C.yellow:C.green }}>{pctGlobal}%</strong>
        </div>
        <PBar p={pctGlobal} color={pctGlobal>100?C.red:pctGlobal>80?C.yellow:C.green} h={18} />
      </Card>
      <Card title="Par catégorie (global)">
        {depCat.length === 0 ? <EmptyState msg="Aucune dépense" icon="📊" /> : depCat.map(({ cat, total:t }) => (
          <div key={cat} style={{ padding:"8px 0", borderBottom:"1px solid "+C.border }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:4 }}>
              <span style={{ color:catColor(cat), fontWeight:600 }}>{cat}</span><span style={{ fontWeight:700 }}>{fmt(t)}</span>
            </div>
            <PBar p={pct(t,totalDeps)} color={catColor(cat)} h={6} />
          </div>
        ))}
      </Card>
      <Card title="Détail par chantier">
        {chantiers.map(c => {
          const d = totalDep(c); const p = pct(d, c.budgetInitial);
          return (
            <div key={c.id} style={{ padding:"12px 0", borderBottom:"1px solid "+C.border }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, marginBottom:4, flexWrap:"wrap" }}>
                <div style={{ minWidth:160, fontWeight:600 }}>{c.nom.split(" ").slice(0,3).join(" ")}</div>
                <div style={{ flex:1, minWidth:100 }}><PBar p={p} color={p>100?C.red:p>80?C.yellow:C.green} h={10} /></div>
                <div style={{ fontWeight:700, color:p>100?C.red:p>80?C.yellow:C.green, minWidth:45 }}>{p}%</div>
                <Badge label={c.statut} color={statutColor(c.statut)} small />
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:C.muted, flexWrap:"wrap", gap:6 }}>
                <span>🧾 {fmt(d)}</span><span>💰 {fmt(c.budgetInitial)}</span><span style={{ color:c.budgetInitial-d>=0?C.green:C.red }}>💵 {fmt(c.budgetInitial-d)}</span>
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// IA
// ═════════════════════════════════════════════════════════════════════════════
function IAPage({ chantiers, interventions }) {
  const [analysing, setAnalysing] = useState(false);
  const [iaResult, setIaResult] = useState(null);
  const [iaError, setIaError] = useState(null);

  const runIA = async () => {
    setAnalysing(true); setIaError(null); setIaResult(null);
    try {
      const ctx = {
        chantiers: chantiers.map(c => ({ nom:c.nom, statut:c.statut, budgetInitial:c.budgetInitial, depensesTotal:totalDep(c) })),
        interventions: interventions.map(i => ({ titre:i.titre, type:i.type, statut:i.statut, cout:totalIntDep(i), facturee:i.facturee }))
      };
      const res = await fetch("https://api.anthropic.com/v1/messages", { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000, messages:[{ role:"user", content:"Expert BTP. Analyse ce portefeuille (XOF). Réponds UNIQUEMENT en JSON:\n"+JSON.stringify(ctx)+"\n\nFormat: {\"recommandations\":[{\"titre\":string,\"detail\":string,\"priorite\":\"haute\"|\"moyenne\"|\"basse\"}],\"scoreGlobal\":number,\"synthese\":string}" }] }) });
      const data = await res.json();
      const text = (data.content||[]).map(i => i.text||"").join("");
      setIaResult(JSON.parse(text.replace(/```json|```/g,"").trim()));
    } catch (e) { setIaError("Erreur IA : " + e.message); }
    setAnalysing(false);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ background:C.orange+"11", border:"1px solid "+C.orange+"44", borderRadius:14, padding:24 }}>
        <div style={{ fontSize:20, fontWeight:800, marginBottom:6 }}>🤖 Analyse IA — Portefeuille BTP</div>
        <div style={{ color:C.muted, fontSize:13, marginBottom:16 }}>Analyse de vos {chantiers.length} chantiers et {interventions.length} interventions</div>
        <button onClick={runIA} disabled={analysing} style={{ background:C.orange, color:"#fff", border:"none", borderRadius:10, padding:"10px 24px", fontWeight:700, cursor:analysing?"wait":"pointer", fontSize:14 }}>
          {analysing ? "⏳ Analyse..." : iaResult ? "🔄 Relancer" : "▶ Lancer l'analyse"}
        </button>
        {iaError && <div style={{ color:C.red, fontSize:12, marginTop:10 }}>⚠️ {iaError}</div>}
      </div>
      {analysing && <Spinner />}
      {iaResult && (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div style={{ background:C.orange+"11", border:"1px solid "+C.orange+"44", borderRadius:12, padding:18 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <div style={{ fontWeight:800, fontSize:16 }}>📋 Synthèse</div>
              <div style={{ background:(iaResult.scoreGlobal>70?C.green:iaResult.scoreGlobal>40?C.yellow:C.red)+"22", borderRadius:8, padding:"4px 14px", fontWeight:800, color:iaResult.scoreGlobal>70?C.green:iaResult.scoreGlobal>40?C.yellow:C.red }}>Score : {iaResult.scoreGlobal}/100</div>
            </div>
            <div style={{ fontSize:13, color:C.muted, lineHeight:1.7 }}>{iaResult.synthese}</div>
          </div>
          {iaResult.recommandations?.map((r,i) => {
            const col = r.priorite==="haute"?C.red:r.priorite==="moyenne"?C.yellow:C.green;
            return (
              <div key={i} style={{ background:col+"11", border:"1px solid "+col+"33", borderRadius:8, padding:"12px 16px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", gap:8 }}>
                  <div style={{ fontWeight:700, color:col }}>{r.titre}</div>
                  <Badge label={"Priorité "+r.priorite} color={col} small />
                </div>
                <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>{r.detail}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
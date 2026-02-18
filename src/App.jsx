import { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis } from "recharts";

// ── Supabase client léger ─────────────────────────────────────────────────────
const SUPA_URL = "https://mbkwpaxissvvjhewkggl.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ia3dwYXhpc3N2dmpoZXdrZ2dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MjQzOTMsImV4cCI6MjA4NzAwMDM5M30.Zo9aJVDByO8aVSADfSCc2m4jCI1qeXuWYQgVRT-a3LA";
const headers = { "Content-Type":"application/json", "apikey":SUPA_KEY, "Authorization":"Bearer "+SUPA_KEY };
const rest = SUPA_URL + "/rest/v1";

function sbFrom(table) {
  return {
    _table:table, _filters:[], _order:null, _sel:"*",
    select(s){ this._sel=s; return this; },
    order(col, opts){ this._order="order="+col+(opts?.ascending===false?".desc":".asc"); return this; },
    eq(col,val){ this._filters.push(col+"=eq."+val); return this; },
    _url(){
      let u=rest+"/"+this._table+"?select="+this._sel;
      if(this._filters.length) u+="&"+this._filters.join("&");
      if(this._order) u+="&"+this._order;
      return u;
    },
    async select_run(){
      const r=await fetch(this._url(),{headers});
      const data=await r.json();
      return r.ok?{data,error:null}:{data:null,error:data};
    },
    async insert(obj){
      const r=await fetch(rest+"/"+this._table,{method:"POST",headers:{...headers,"Prefer":"return=representation"},body:JSON.stringify(obj)});
      const data=await r.json();
      return r.ok?{data,error:null}:{data:null,error:data};
    },
    async update(obj){
      const u=rest+"/"+this._table+(this._filters.length?"?"+this._filters.join("&"):"");
      const r=await fetch(u,{method:"PATCH",headers:{...headers,"Prefer":"return=representation"},body:JSON.stringify(obj)});
      const data=await r.json();
      return r.ok?{data,error:null}:{data:null,error:data};
    },
    async delete(){
      const u=rest+"/"+this._table+(this._filters.length?"?"+this._filters.join("&"):"");
      const r=await fetch(u,{method:"DELETE",headers});
      return r.ok?{error:null}:{error:await r.json()};
    }
  };
}
const sb={from:sbFrom};

// ── Constantes ────────────────────────────────────────────────────────────────
const C = {
  orange:"#F97316",orangeD:"#EA580C",orangeL:"#FED7AA",
  dark:"#292524",mid:"#44403C",border:"#57534E",card:"#292524",
  bg:"#1C1917",white:"#FAFAF9",muted:"#A8A29E",light:"#78716C",
  green:"#22C55E",red:"#EF4444",yellow:"#EAB308",blue:"#3B82F6",purple:"#A855F7"
};
const CATEGORIES = ["Main d'œuvre","Matériaux","Équipement","Transport","Sous-traitance","Divers"];
const TYPE_INT = {Urgence:"#EF4444",Préventive:"#3B82F6",Corrective:"#F97316",Inspection:"#A855F7"};
const STATUT_INT = {"En attente":"#EAB308","En cours":"#3B82F6","Terminée":"#22C55E"};

// ── 1. Fonctions utilitaires ──────────────────────────────────────────────────
const fmt = n => new Intl.NumberFormat("fr-FR",{style:"currency",currency:"XOF",maximumFractionDigits:0}).format(n);
const pct = (v,t) => t>0?Math.round(v/t*100):0;
const statutColor = s => ({"En cours":C.blue,"En dérive":C.red,"Clôturé":C.green,"Planifié":C.yellow,"En pause":C.light,"Brouillon":C.muted,"En réception":C.orange}[s]||C.muted);
const catColor = c => ({"Main d'œuvre":C.blue,"Matériaux":C.orange,"Équipement":C.yellow,"Transport":C.green,"Sous-traitance":C.purple,"Divers":C.muted}[c]||C.muted);

// ── 2. getSousStatutBudget ────────────────────────────────────────────────────
const getSousStatutBudget = (dep,budget) => {
  const p=pct(dep,budget);
  if(p>100) return "Dépassement";
  if(p>=80) return "80% consommé";
  return "Conforme";
};
const budgetColor = s => ({Conforme:C.green,"80% consommé":C.yellow,Dépassement:C.red}[s]||C.muted);

// ── 3. totalDep & getBudgetConsomme ──────────────────────────────────────────
const totalDep = c => (c.depenses||[]).reduce((a,d)=>a+Number(d.montant),0);
const getBudgetConsomme = c => totalDep(c);
const totalIntDep = i => (i.depenses||[]).reduce((a,d)=>a+Number(d.montant),0);

// ── 4. exportDepenses ────────────────────────────────────────────────────────
function exportDepenses(chantiers,scope,chantierId){
  const target=scope==="one"?chantiers.filter(c=>c.id===chantierId):chantiers;
  const total=target.flatMap(c=>c.depenses).reduce((a,d)=>a+Number(d.montant),0);
  const wb=XLSX.utils.book_new();
  const d1=[["Chantier","Client","Libellé","Catégorie","Montant (XOF)","Date","Note"],
    ...target.flatMap(c=>c.depenses.map(d=>[c.nom,c.client,d.libelle,d.categorie,d.montant,d.date,d.note||""])),
    ["","","","TOTAL",total,"",""]];
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(d1),"Détail Dépenses");
  const d2=[["Catégorie","Montant (XOF)","Nb","% Total"]];
  CATEGORIES.forEach(cat=>{
    const l=target.flatMap(c=>c.depenses.filter(d=>d.categorie===cat));
    const t=l.reduce((a,d)=>a+Number(d.montant),0);
    if(t>0) d2.push([cat,t,l.length,parseFloat((t/total*100).toFixed(1))]);
  });
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(d2),"Par Catégorie");
  const nom=scope==="one"?target[0].nom.replace(/\s+/g,"_"):"Tous";
  XLSX.writeFile(wb,"Depenses_"+nom+"_"+new Date().toISOString().slice(0,10)+".xlsx");
}

// ── 5. genAlertes ────────────────────────────────────────────────────────────
const genAlertes = (chantiers) => {
  const alertes=[];
  chantiers.forEach(c=>{
    const dep=getBudgetConsomme(c); const p=pct(dep,c.budgetInitial);
    if(p>100) alertes.push({niveau:"critique",msg:"Dépassement budget : "+p+"% consommé ("+fmt(dep)+" / "+fmt(c.budgetInitial)+")",chantier:c});
    else if(p>=90) alertes.push({niveau:"danger",msg:"Budget à "+p+"% consommé — risque imminent",chantier:c});
    else if(p>=80) alertes.push({niveau:"warning",msg:"Budget à "+p+"% consommé — surveillance requise",chantier:c});
    if(c.statut==="En dérive") alertes.push({niveau:"critique",msg:"Chantier en dérive — intervention requise",chantier:c});
    if(c.dateFin){
      const today=new Date(); const fin=new Date(c.dateFin);
      const diffDays=Math.round((fin-today)/(1000*60*60*24));
      if(diffDays<0&&c.statut!=="Clôturé") alertes.push({niveau:"danger",msg:"Date de fin dépassée depuis "+Math.abs(diffDays)+" jour(s)",chantier:c});
      else if(diffDays>=0&&diffDays<=7&&c.statut!=="Clôturé") alertes.push({niveau:"warning",msg:"Échéance dans "+diffDays+" jour(s)",chantier:c});
    }
    if((c.depenses||[]).length===0&&c.statut==="En cours") alertes.push({niveau:"info",msg:"Aucune dépense enregistrée alors que le chantier est en cours",chantier:c});
  });
  return alertes;
};

// ── 6-14. Composants UI ──────────────────────────────────────────────────────
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
const Spinner=()=><div style={{display:"flex",alignItems:"center",justifyContent:"center",height:200,flexDirection:"column",gap:12}}><div style={{width:40,height:40,border:"4px solid "+C.border,borderTop:"4px solid "+C.orange,borderRadius:"50%",animation:"spin 1s linear infinite"}}/><div style={{color:C.muted,fontSize:13}}>Chargement...</div><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>;
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

// ── Hook Supabase ─────────────────────────────────────────────────────────────
function useSupabaseData(){
  const [chantiers,setChantiers]=useState([]);
  const [interventions,setInterventions]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null);

  const loadAll=async()=>{
    setLoading(true); setError(null);
    try{
      const [r1,r2,r3,r4,r5]=await Promise.all([
        sb.from("chantiers").order("created_at",{ascending:false}).select_run(),
        sb.from("depenses").order("date",{ascending:false}).select_run(),
        sb.from("interventions").order("created_at",{ascending:false}).select_run(),
        sb.from("intervention_depenses").select_run(),
        sb.from("intervention_todos").select_run()
      ]);
      if(r1.error) throw r1.error;
      if(r2.error) throw r2.error;
      if(r3.error) throw r3.error;
      if(r4.error) throw r4.error;
      if(r5.error) throw r5.error;
      const ch=r1.data||[], dep=r2.data||[], intv=r3.data||[], idep=r4.data||[], todos=r5.data||[];
      setChantiers(ch.map(c=>({...c,budgetInitial:Number(c.budget_initial),dateDebut:c.date_debut,dateFin:c.date_fin,alertes:c.alertes||[],depenses:dep.filter(d=>d.chantier_id===c.id).map(d=>({...d,montant:Number(d.montant)}))})));
      setInterventions(intv.map(i=>({...i,dateCreation:i.date_creation,depenses:idep.filter(d=>d.intervention_id===i.id).map(d=>({...d,montant:Number(d.montant)})),todos:todos.filter(t=>t.intervention_id===i.id)})));
    }catch(err){setError("Erreur Supabase : "+(err.message||JSON.stringify(err)));}
    setLoading(false);
  };
  useEffect(()=>{loadAll();},[]);
  return {chantiers,setChantiers,interventions,setInterventions,loading,error,reload:loadAll};
}

// ═════════════════════════════════════════════════════════════════════════════
// 7. APP principale
// ═════════════════════════════════════════════════════════════════════════════
export default function App(){
  const {chantiers,setChantiers,interventions,setInterventions,loading,error,reload}=useSupabaseData();
  const [page,setPage]=useState("dashboard");
  const [selectedId,setSelectedId]=useState(null);
  const [onglet,setOnglet]=useState("infos");
  const [sideOpen,setSideOpen]=useState(true);
  const [showNew,setShowNew]=useState(false);
  const [filterStatut,setFilterStatut]=useState("Tous");
  const [saving,setSaving]=useState(false);
  const [newForm,setNewForm]=useState({nom:"",client:"",localisation:"",type:"Construction",budgetInitial:"",dateDebut:"",dateFin:""});

  const selected=chantiers.find(c=>c.id===selectedId);
  const openChantier=id=>{setSelectedId(id);setPage("fiche");setOnglet("infos");};

  const saveChantier=async()=>{
    if(!newForm.nom||!newForm.client||!newForm.budgetInitial)return;
    setSaving(true);
    const {error}=await sb.from("chantiers").insert({nom:newForm.nom,client:newForm.client,localisation:newForm.localisation,type:newForm.type,budget_initial:parseFloat(newForm.budgetInitial),date_debut:newForm.dateDebut||null,date_fin:newForm.dateFin||null,statut:"Brouillon",alertes:[],score:100,lat:5.35,lng:-4.0});
    setSaving(false);
    if(!error){setShowNew(false);setNewForm({nom:"",client:"",localisation:"",type:"Construction",budgetInitial:"",dateDebut:"",dateFin:""});reload();}
    else alert("Erreur : "+error.message);
  };

  const deleteChantier=async id=>{
    await sb.from("chantiers").eq("id",id).delete();
    setPage("chantiers"); reload();
  };

  const nbAlertes=genAlertes(chantiers).filter(a=>a.niveau==="critique"||a.niveau==="danger").length;
  const nbIntEnCours=interventions.filter(i=>i.statut==="En cours").length;

  const navItems=[
    {key:"dashboard",icon:"📊",label:"Dashboard Global"},
    {key:"chantiers",icon:"🏗️",label:"Mes Chantiers"},
    {key:"interventions",icon:"🔧",label:"Interventions",badge:nbIntEnCours},
    {key:"alertes",icon:"🔔",label:"Alertes",badge:nbAlertes},
    {key:"kpi",icon:"📈",label:"KPIs & Analyses"},
    {key:"ia",icon:"🤖",label:"Intelligence IA"},
    {key:"gestion",icon:"⚙️",label:"Gestion projets"},
  ];
  const titles={dashboard:"📊 Dashboard",chantiers:"🏗️ Mes Chantiers",interventions:"🔧 Interventions",alertes:"🔔 Alertes",kpi:"📈 KPIs",ia:"🤖 IA",gestion:"⚙️ Gestion",fiche:selected?"🏗️ "+selected.nom:""};

  return(
    <div style={{display:"flex",height:"100vh",background:C.bg,color:C.white,fontFamily:"'Segoe UI',system-ui,sans-serif",overflow:"hidden"}}>
      {/* Sidebar */}
      <div style={{width:sideOpen?220:60,background:C.dark,borderRight:"1px solid "+C.border,display:"flex",flexDirection:"column",transition:"width .25s",overflow:"hidden",flexShrink:0}}>
        <div style={{padding:"20px 14px 16px",borderBottom:"1px solid "+C.border,display:"flex",alignItems:"center",gap:10}}>
          <div style={{background:C.orange,borderRadius:10,width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>🏗</div>
          {sideOpen&&<div><div style={{fontWeight:700,fontSize:14}}>JEAN MANAGER</div><div style={{fontSize:10,color:C.orange}}>☁️ Supabase</div></div>}
        </div>
        <nav style={{flex:1,padding:"10px 8px"}}>
          {navItems.map(n=>(
            <button key={n.key} onClick={()=>setPage(n.key)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 8px",borderRadius:8,border:"none",background:page===n.key?C.orange+"22":"transparent",color:page===n.key?C.orange:C.muted,cursor:"pointer",marginBottom:2,textAlign:"left"}}>
              <span style={{fontSize:18,flexShrink:0}}>{n.icon}</span>
              {sideOpen&&<span style={{fontSize:13,fontWeight:page===n.key?700:400,flex:1}}>{n.label}</span>}
              {sideOpen&&n.badge>0&&<span style={{background:C.red,color:"#fff",borderRadius:99,fontSize:10,padding:"1px 6px",fontWeight:700}}>{n.badge}</span>}
            </button>
          ))}
        </nav>
        {sideOpen&&<div style={{padding:8,borderTop:"1px solid "+C.border}}>
          <button onClick={reload} style={{width:"100%",background:C.blue+"22",border:"1px solid "+C.blue+"44",color:C.blue,borderRadius:8,padding:8,fontSize:11,fontWeight:700,cursor:"pointer"}}>🔄 Synchroniser</button>
        </div>}
        <button onClick={()=>setSideOpen(p=>!p)} style={{margin:8,padding:8,border:"none",background:C.mid,color:C.muted,borderRadius:8,cursor:"pointer"}}>{sideOpen?"◀":"▶"}</button>
      </div>

      {/* Main */}
      <div style={{flex:1,overflow:"auto",display:"flex",flexDirection:"column"}}>
        <div style={{background:C.dark,borderBottom:"1px solid "+C.border,padding:"12px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{fontSize:16,fontWeight:700}}>{titles[page]}</div>
            <div style={{background:C.green+"22",border:"1px solid "+C.green+"44",borderRadius:6,padding:"2px 10px",fontSize:11,color:C.green}}>☁️ Supabase</div>
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            {(page==="chantiers"||page==="dashboard")&&<>
              <button onClick={()=>exportDepenses(chantiers,"all")} style={{background:C.green+"22",color:C.green,border:"1px solid "+C.green+"55",borderRadius:8,padding:"8px 14px",fontWeight:700,cursor:"pointer",fontSize:13}}>📥 Export Excel</button>
              <button onClick={()=>setShowNew(true)} style={{background:C.orange,color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontWeight:700,cursor:"pointer",fontSize:13}}>+ Nouveau chantier</button>
            </>}
            {page==="fiche"&&selected&&<>
              <button onClick={()=>exportDepenses(chantiers,"one",selected.id)} style={{background:C.green+"22",color:C.green,border:"1px solid "+C.green+"55",borderRadius:8,padding:"8px 14px",fontWeight:700,cursor:"pointer",fontSize:13}}>📥 Exporter</button>
              <button onClick={()=>{if(window.confirm("Supprimer ?"))deleteChantier(selected.id);}} style={{background:C.red+"22",color:C.red,border:"1px solid "+C.red+"44",borderRadius:8,padding:"8px 14px",fontWeight:700,cursor:"pointer",fontSize:13}}>🗑️ Supprimer</button>
            </>}
            <div style={{background:C.mid,borderRadius:8,padding:"6px 12px",fontSize:12,color:C.muted}}>👤 Admin</div>
          </div>
        </div>

        <div style={{flex:1,overflow:"auto",padding:24}}>
          {loading?<Spinner/>:error?(
            <div style={{background:C.red+"11",border:"1px solid "+C.red+"44",borderRadius:12,padding:24,textAlign:"center"}}>
              <div style={{fontSize:32,marginBottom:12}}>⚠️</div>
              <div style={{color:C.red,fontWeight:700,marginBottom:8}}>Erreur de connexion Supabase</div>
              <div style={{color:C.muted,fontSize:13,marginBottom:16}}>{error}</div>
              <button onClick={reload} style={{background:C.orange,color:"#fff",border:"none",borderRadius:8,padding:"10px 24px",fontWeight:700,cursor:"pointer"}}>🔄 Réessayer</button>
            </div>
          ):<>
            {page==="dashboard"&&<DashboardPage chantiers={chantiers} openChantier={openChantier} interventions={interventions}/>}
            {page==="chantiers"&&<ChantiersPage chantiers={chantiers} openChantier={openChantier} filter={filterStatut} setFilter={setFilterStatut} deleteChantier={deleteChantier}/>}
            {page==="fiche"&&selected&&<FichePage chantier={selected} onglet={onglet} setOnglet={setOnglet} setPage={setPage} chantiers={chantiers} reload={reload}/>}
            {page==="interventions"&&<InterventionsPage interventions={interventions} setInterventions={setInterventions} chantiers={chantiers} reload={reload}/>}
            {page==="alertes"&&<AlertesPage chantiers={chantiers} openChantier={openChantier}/>}
            {page==="kpi"&&<KpiPage chantiers={chantiers}/>}
            {page==="ia"&&<IAPage chantiers={chantiers} openChantier={openChantier} interventions={interventions}/>}
            {page==="gestion"&&<GestionPage chantiers={chantiers} setChantiers={setChantiers} openChantier={openChantier} reload={reload}/>}
          </>}
        </div>
      </div>

      {showNew&&(
        <Modal title="+ Nouveau Chantier" onClose={()=>setShowNew(false)} onSave={saveChantier}>
          {saving?<Spinner/>:<FGrid>
            <FField label="Nom *" value={newForm.nom} onChange={v=>setNewForm(p=>({...p,nom:v}))}/>
            <FField label="Client *" value={newForm.client} onChange={v=>setNewForm(p=>({...p,client:v}))}/>
            <FField label="Localisation" value={newForm.localisation} onChange={v=>setNewForm(p=>({...p,localisation:v}))}/>
            <FSelect label="Type" value={newForm.type} onChange={v=>setNewForm(p=>({...p,type:v}))} options={["Construction","Réhabilitation","Maintenance"]}/>
            <FField label="Budget initial (XOF) *" type="number" value={newForm.budgetInitial} onChange={v=>setNewForm(p=>({...p,budgetInitial:v}))}/>
            <FField label="Date début" type="date" value={newForm.dateDebut} onChange={v=>setNewForm(p=>({...p,dateDebut:v}))}/>
            <FField label="Date fin" type="date" value={newForm.dateFin} onChange={v=>setNewForm(p=>({...p,dateFin:v}))}/>
          </FGrid>}
        </Modal>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 8. DashboardPage
// ═════════════════════════════════════════════════════════════════════════════
function DashboardPage({chantiers,openChantier,interventions}){
  const totalB=chantiers.reduce((a,c)=>a+c.budgetInitial,0);
  const totalD=chantiers.reduce((a,c)=>a+totalDep(c),0);
  const nbUrgences=interventions.filter(i=>i.type==="Urgence"&&i.statut!=="Terminée").length;
  const pieData=[
    {name:"En cours",value:chantiers.filter(c=>c.statut==="En cours").length,color:C.blue},
    {name:"En dérive",value:chantiers.filter(c=>c.statut==="En dérive").length,color:C.red},
    {name:"Planifié",value:chantiers.filter(c=>c.statut==="Planifié").length,color:C.yellow},
    {name:"Clôturé",value:chantiers.filter(c=>c.statut==="Clôturé").length,color:C.green},
  ].filter(d=>d.value>0);
  const bdData=chantiers.map(c=>({name:c.nom.split(" ").slice(0,2).join(" "),budget:Math.round(c.budgetInitial/1000),dep:Math.round(totalDep(c)/1000)}));
  return(
    <div style={{display:"flex",flexDirection:"column",gap:24}}>
      <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
        <KpiCard icon="🏗️" label="Chantiers" value={chantiers.length} color={C.orange}/>
        <KpiCard icon="💰" label="Budget total" value={fmt(totalB)} sub={fmt(totalD)+" dépensé"}/>
        <KpiCard icon="📊" label="Consommation" value={pct(totalD,totalB)+"%"} color={pct(totalD,totalB)>100?C.red:pct(totalD,totalB)>80?C.yellow:C.green}/>
        <KpiCard icon="🚨" label="Urgences" value={nbUrgences} color={nbUrgences>0?C.red:C.green}/>
        <KpiCard icon="💵" label="Marge globale" value={fmt(totalB-totalD)} color={totalB-totalD>=0?C.green:C.red}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
        <Card title="Répartition par statut">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart><Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={75} label={({name,value})=>name+" ("+value+")"}>
              {pieData.map((d,i)=><Cell key={i} fill={d.color}/>)}
            </Pie><Tooltip contentStyle={{background:C.dark,border:"1px solid "+C.border,color:C.white}}/></PieChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Budget vs Dépenses (k XOF)">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={bdData} margin={{top:5,right:10,left:-10,bottom:40}}>
              <XAxis dataKey="name" tick={{fill:C.muted,fontSize:10}} angle={-30} textAnchor="end"/>
              <YAxis tick={{fill:C.muted,fontSize:10}}/>
              <Tooltip contentStyle={{background:C.dark,border:"1px solid "+C.border,color:C.white}} formatter={v=>v+"k XOF"}/>
              <Bar dataKey="budget" fill={C.orange+"88"} name="Budget" radius={[4,4,0,0]}/>
              <Bar dataKey="dep" fill={C.orange} name="Dépenses" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
      <Card title="Chantiers — Vue rapide">
        {chantiers.filter(c=>c.statut!=="Clôturé"&&c.statut!=="Brouillon").map(c=>{
          const d=totalDep(c);const p2=pct(d,c.budgetInitial);
          return(
            <div key={c.id} onClick={()=>openChantier(c.id)} style={{display:"flex",alignItems:"center",gap:14,padding:"12px 0",borderBottom:"1px solid "+C.border,cursor:"pointer"}}>
              <div style={{flex:2}}><div style={{fontWeight:600,fontSize:14}}>{c.nom}</div><div style={{fontSize:12,color:C.muted}}>{c.client}</div></div>
              <Badge label={c.statut} color={statutColor(c.statut)}/>
              <div style={{flex:1}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.muted,marginBottom:4}}><span>Budget consommé</span><span style={{color:p2>100?C.red:p2>80?C.yellow:C.green,fontWeight:700}}>{p2}%</span></div>
                <PBar p={p2} color={p2>100?C.red:p2>80?C.yellow:C.green}/>
              </div>
              <div style={{textAlign:"right",minWidth:120}}><div style={{fontSize:12,fontWeight:600}}>{fmt(d)}</div><div style={{fontSize:11,color:C.muted}}>/ {fmt(c.budgetInitial)}</div></div>
            </div>
          );
        })}
        {chantiers.filter(c=>c.statut!=="Clôturé"&&c.statut!=="Brouillon").length===0&&<EmptyState msg="Aucun chantier actif" icon="🏗️"/>}
      </Card>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 9. ChantiersPage
// ═════════════════════════════════════════════════════════════════════════════
function ChantiersPage({chantiers,openChantier,filter,setFilter,deleteChantier}){
  const statuts=["Tous","Brouillon","Planifié","En cours","En dérive","En pause","En réception","Clôturé"];
  const filtered=filter==="Tous"?chantiers:chantiers.filter(c=>c.statut===filter);
  return(
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {statuts.map(s=><button key={s} onClick={()=>setFilter(s)} style={{padding:"6px 14px",borderRadius:20,border:"1px solid "+(filter===s?C.orange:C.border),background:filter===s?C.orange:"transparent",color:filter===s?"#fff":C.muted,cursor:"pointer",fontSize:12,fontWeight:filter===s?700:400}}>{s}</button>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:16}}>
        {filtered.map(c=><ChantierCard key={c.id} c={c} onClick={()=>openChantier(c.id)} onDelete={e=>{e.stopPropagation();if(window.confirm("Supprimer "+c.nom+" ?"))deleteChantier(c.id);}}/>)}
      </div>
      {filtered.length===0&&<EmptyState msg="Aucun chantier" icon="🏗️"/>}
    </div>
  );
}

// ── 10. ChantierCard ─────────────────────────────────────────────────────────
function ChantierCard({c,onClick,onDelete}){
  const d=totalDep(c);const p=pct(d,c.budgetInitial);const ssb=getSousStatutBudget(d,c.budgetInitial);
  return(
    <div onClick={onClick} style={{background:C.card,border:"1px solid "+(ssb==="Dépassement"?C.red+"66":C.border),borderRadius:14,padding:20,cursor:"pointer",position:"relative"}}
      onMouseEnter={e=>e.currentTarget.style.borderColor=C.orange}
      onMouseLeave={e=>e.currentTarget.style.borderColor=ssb==="Dépassement"?C.red+"66":C.border}>
      <button onClick={onDelete} style={{position:"absolute",top:12,right:12,background:C.red+"22",border:"1px solid "+C.red+"44",color:C.red,borderRadius:6,padding:"3px 8px",fontSize:11,cursor:"pointer",zIndex:2}}>🗑️</button>
      <div style={{marginBottom:12,paddingRight:40}}>
        <div style={{fontWeight:700,fontSize:15}}>{c.nom}</div>
        <div style={{fontSize:12,color:C.muted}}>{c.client}</div>
        <div style={{fontSize:11,color:C.light,marginTop:2}}>📍 {c.localisation}</div>
      </div>
      <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
        <Badge label={c.statut} color={statutColor(c.statut)}/>
        <Badge label={c.type} color={C.orange} small/>
        <Badge label={ssb} color={budgetColor(ssb)} small/>
      </div>
      <div style={{marginBottom:6}}>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}><span style={{color:C.muted}}>Budget consommé</span><span style={{fontWeight:700,color:p>100?C.red:p>80?C.yellow:C.green}}>{p}%</span></div>
        <PBar p={p} color={p>100?C.red:p>80?C.yellow:C.green}/>
      </div>
      <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid "+C.border,display:"flex",justifyContent:"space-between",fontSize:12}}>
        <span style={{color:C.muted}}>🧾 {fmt(d)} / {fmt(c.budgetInitial)}</span>
        {(c.alertes||[]).length>0&&<span style={{color:C.red,fontWeight:700}}>⚠️ {c.alertes.length}</span>}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 11. FichePage
// ═════════════════════════════════════════════════════════════════════════════
function FichePage({chantier:c,onglet,setOnglet,setPage,chantiers,reload}){
  const onglets=["infos","dashboard","dépenses","analyse"];
  const dep=totalDep(c);const depPct=pct(dep,c.budgetInitial);const ssb=getSousStatutBudget(dep,c.budgetInitial);
  const [showNewDep,setShowNewDep]=useState(false);
  const [depForm,setDepForm]=useState({libelle:"",categorie:"Main d'œuvre",montant:"",date:new Date().toISOString().slice(0,10),note:""});
  const [editDepId,setEditDepId]=useState(null);
  const [editDepData,setEditDepData]=useState({});
  const [filterCat,setFilterCat]=useState("Toutes");
  const [showStatutMenu,setShowStatutMenu]=useState(false);
  const [saving,setSaving]=useState(false);
  const cycleVie=["Brouillon","Planifié","En cours","En pause","En dérive","En réception","Clôturé"];
  const cycleIdx=cycleVie.indexOf(c.statut);

  const changeStatut=async s=>{await sb.from("chantiers").eq("id",c.id).update({statut:s});setShowStatutMenu(false);reload();};
  const addDep=async()=>{
    if(!depForm.libelle||!depForm.montant)return;
    setSaving(true);
    await sb.from("depenses").insert({chantier_id:c.id,libelle:depForm.libelle,categorie:depForm.categorie,montant:parseFloat(depForm.montant),date:depForm.date,note:depForm.note});
    setSaving(false);setShowNewDep(false);
    setDepForm({libelle:"",categorie:"Main d'œuvre",montant:"",date:new Date().toISOString().slice(0,10),note:""});
    reload();
  };
  const delDep=async id=>{await sb.from("depenses").eq("id",id).delete();reload();};
  const saveEditDep=async()=>{
    await sb.from("depenses").eq("id",editDepId).update({libelle:editDepData.libelle,categorie:editDepData.categorie,montant:parseFloat(editDepData.montant),date:editDepData.date,note:editDepData.note});
    setEditDepId(null);reload();
  };

  const filteredDep=filterCat==="Toutes"?c.depenses:c.depenses.filter(d=>d.categorie===filterCat);
  const depParCat=CATEGORIES.map(cat=>({cat,total:c.depenses.filter(d=>d.categorie===cat).reduce((a,d)=>a+Number(d.montant),0)})).filter(x=>x.total>0);

  return(
    <div style={{display:"flex",flexDirection:"column",gap:0}}>
      <button onClick={()=>setPage("chantiers")} style={{background:"none",border:"none",color:C.orange,cursor:"pointer",fontSize:13,marginBottom:16,textAlign:"left"}}>← Retour</button>
      <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:14,padding:"20px 24px",marginBottom:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
          <div>
            <div style={{fontSize:22,fontWeight:800}}>{c.nom}</div>
            <div style={{color:C.muted,fontSize:13,marginTop:4}}>👤 {c.client} · 📍 {c.localisation} · 🏷️ {c.type}</div>
            <div style={{color:C.muted,fontSize:12,marginTop:2}}>📅 {c.dateDebut} → {c.dateFin}</div>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
            <Badge label={ssb} color={budgetColor(ssb)}/>
            <div style={{position:"relative"}}>
              <button onClick={()=>setShowStatutMenu(p=>!p)} style={{display:"flex",alignItems:"center",gap:6,background:statutColor(c.statut)+"22",border:"2px solid "+statutColor(c.statut),borderRadius:8,padding:"6px 14px",color:statutColor(c.statut),cursor:"pointer",fontWeight:700,fontSize:13}}>
                {c.statut} <span style={{fontSize:10}}>▼</span>
              </button>
              {showStatutMenu&&(
                <div style={{position:"absolute",right:0,top:"calc(100% + 6px)",background:C.dark,border:"1px solid "+C.border,borderRadius:10,zIndex:50,minWidth:170,overflow:"hidden",boxShadow:"0 8px 24px #0008"}}>
                  {cycleVie.map(s=><button key={s} onClick={()=>changeStatut(s)} style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"10px 14px",border:"none",background:c.statut===s?statutColor(s)+"22":"transparent",color:c.statut===s?statutColor(s):C.white,cursor:"pointer",fontSize:13,fontWeight:c.statut===s?700:400,textAlign:"left"}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:statutColor(s)}}/>{s}{c.statut===s&&<span style={{marginLeft:"auto"}}>✓</span>}
                  </button>)}
                </div>
              )}
            </div>
          </div>
        </div>
        <div style={{marginTop:18}}>
          <div style={{fontSize:11,color:C.muted,marginBottom:8}}>Cycle de vie</div>
          <div style={{display:"flex",alignItems:"center",overflowX:"auto",paddingBottom:4}}>
            {cycleVie.map((s,i)=>(
              <div key={s} style={{display:"flex",alignItems:"center"}}>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                  <button onClick={()=>changeStatut(s)} style={{width:30,height:30,borderRadius:"50%",background:i===cycleIdx?C.orange:i<cycleIdx?C.green:C.mid,border:i===cycleIdx?"3px solid "+C.orangeL:"3px solid transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer",flexShrink:0}}>
                    {i<cycleIdx?"✓":i+1}
                  </button>
                  <div style={{fontSize:9,color:i===cycleIdx?C.orange:i<cycleIdx?C.green:C.muted,whiteSpace:"nowrap",fontWeight:i===cycleIdx?700:400}}>{s}</div>
                </div>
                {i<cycleVie.length-1&&<div style={{width:22,height:2,background:i<cycleIdx?C.green:C.mid,marginBottom:14,flexShrink:0}}/>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{display:"flex",gap:4,marginBottom:20,flexWrap:"wrap"}}>
        {onglets.map(o=>(
          <button key={o} onClick={()=>setOnglet(o)} style={{padding:"8px 16px",borderRadius:8,border:"1px solid "+(onglet===o?C.orange:C.border),background:onglet===o?C.orange:C.card,color:onglet===o?"#fff":C.muted,cursor:"pointer",fontSize:13,fontWeight:onglet===o?700:400,textTransform:"capitalize"}}>
            {o}{o==="dépenses"&&c.depenses.length>0&&<span style={{background:C.yellow,color:C.dark,borderRadius:99,fontSize:9,padding:"1px 5px",fontWeight:800,marginLeft:5}}>{c.depenses.length}</span>}
          </button>
        ))}
      </div>

      {onglet==="infos"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <Card title="Informations générales">
            {[["Nom",c.nom],["Client",c.client],["Localisation",c.localisation],["Type",c.type],["Budget initial",fmt(c.budgetInitial)],["Dépenses actuelles",fmt(dep)],["Marge",fmt(c.budgetInitial-dep)],["Date début",c.dateDebut],["Date fin",c.dateFin]].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid "+C.border,fontSize:13}}>
                <span style={{color:C.muted}}>{k}</span><span style={{fontWeight:600}}>{v}</span>
              </div>
            ))}
          </Card>
          <Card title="📍 Localisation">
            <div style={{background:C.mid,borderRadius:10,height:220,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8}}>
              <div style={{fontSize:48}}>🗺️</div>
              <div style={{color:C.muted,fontSize:13,textAlign:"center"}}>{c.localisation}<br/><span style={{fontSize:11}}>Lat: {c.lat} · Lng: {c.lng}</span></div>
            </div>
          </Card>
        </div>
      )}

      {onglet==="dashboard"&&(
        <div style={{display:"flex",flexDirection:"column",gap:20}}>
          <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
            <KpiCard icon="💰" label="Budget initial" value={fmt(c.budgetInitial)} color={C.white}/>
            <KpiCard icon="🧾" label="Dépenses cumulées" value={fmt(dep)} color={C.yellow} sub={depPct+"% du budget"}/>
            <KpiCard icon="💵" label="Marge restante" value={fmt(c.budgetInitial-dep)} color={c.budgetInitial-dep>=0?C.green:C.red}/>
            <KpiCard icon="📊" label="Statut budgétaire" value={ssb} color={budgetColor(ssb)}/>
          </div>
          <Card title="Consommation budgétaire">
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,fontSize:13}}><span style={{color:C.muted}}>Dépenses / Budget</span><strong style={{color:depPct>100?C.red:depPct>80?C.yellow:C.green}}>{depPct}%</strong></div>
            <PBar p={depPct} color={depPct>100?C.red:depPct>80?C.yellow:C.green} h={16}/>
            {depPct>100&&<div style={{marginTop:10,color:C.red,fontSize:12,fontWeight:700}}>🚨 Dépassement de {fmt(dep-c.budgetInitial)}</div>}
          </Card>
        </div>
      )}

      {onglet==="dépenses"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
            <KpiCard icon="🧾" label="Total dépenses" value={fmt(dep)} color={C.yellow}/>
            <KpiCard icon="📋" label="Nb lignes" value={c.depenses.length} color={C.orange}/>
            <KpiCard icon="💰" label="Reste budget" value={fmt(c.budgetInitial-dep)} color={c.budgetInitial-dep>=0?C.green:C.red}/>
            <KpiCard icon="📊" label="Consommé" value={depPct+"%"} color={depPct>100?C.red:depPct>80?C.yellow:C.green}/>
          </div>
          {depParCat.length>0&&(
            <Card title="Répartition par catégorie">
              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                {depParCat.map(({cat,total:t})=>(
                  <div key={cat} style={{background:catColor(cat)+"22",border:"1px solid "+catColor(cat)+"44",borderRadius:8,padding:"8px 14px",fontSize:12}}>
                    <div style={{color:catColor(cat),fontWeight:700}}>{cat}</div>
                    <div style={{fontWeight:800,marginTop:2}}>{fmt(t)}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {["Toutes",...CATEGORIES].map(cat=><button key={cat} onClick={()=>setFilterCat(cat)} style={{padding:"5px 12px",borderRadius:20,border:"1px solid "+(filterCat===cat?C.orange:C.border),background:filterCat===cat?C.orange:"transparent",color:filterCat===cat?"#fff":C.muted,cursor:"pointer",fontSize:11,fontWeight:filterCat===cat?700:400}}>{cat}</button>)}
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>exportDepenses(chantiers,"one",c.id)} style={{background:C.green+"22",color:C.green,border:"1px solid "+C.green+"55",borderRadius:8,padding:"8px 14px",fontWeight:700,cursor:"pointer",fontSize:13}}>📥 Excel</button>
              <button onClick={()=>setShowNewDep(true)} style={{background:C.orange,color:"#fff",border:"none",borderRadius:8,padding:"8px 18px",fontWeight:700,cursor:"pointer",fontSize:13}}>+ Ajouter</button>
            </div>
          </div>
          {filteredDep.length===0&&<EmptyState msg="Aucune dépense" icon="🧾"/>}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {filteredDep.map(d=>(
              <div key={d.id}>
                {editDepId===d.id?(
                  <div style={{background:C.card,border:"2px solid "+C.orange,borderRadius:12,padding:16}}>
                    <FGrid>
                      <div style={{gridColumn:"1/-1"}}><FField label="Libellé" value={editDepData.libelle} onChange={v=>setEditDepData(p=>({...p,libelle:v}))}/></div>
                      <FSelect label="Catégorie" value={editDepData.categorie} onChange={v=>setEditDepData(p=>({...p,categorie:v}))} options={CATEGORIES}/>
                      <FField label="Montant (XOF)" type="number" value={editDepData.montant} onChange={v=>setEditDepData(p=>({...p,montant:v}))}/>
                      <FField label="Date" type="date" value={editDepData.date} onChange={v=>setEditDepData(p=>({...p,date:v}))}/>
                      <FField label="Note" value={editDepData.note} onChange={v=>setEditDepData(p=>({...p,note:v}))}/>
                    </FGrid>
                    <div style={{display:"flex",gap:8,marginTop:12,justifyContent:"flex-end"}}>
                      <button onClick={()=>setEditDepId(null)} style={{padding:"7px 16px",background:C.mid,color:C.white,border:"none",borderRadius:8,cursor:"pointer"}}>Annuler</button>
                      <button onClick={saveEditDep} style={{padding:"7px 16px",background:C.orange,color:"#fff",border:"none",borderRadius:8,fontWeight:700,cursor:"pointer"}}>💾 Enregistrer</button>
                    </div>
                  </div>
                ):(
                  <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,padding:"14px 18px",display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                        <div style={{width:8,height:8,borderRadius:"50%",background:catColor(d.categorie)}}/>
                        <span style={{fontWeight:700,fontSize:14}}>{d.libelle}</span>
                      </div>
                      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                        <Badge label={d.categorie} color={catColor(d.categorie)} small/>
                        <span style={{fontSize:11,color:C.muted}}>📅 {d.date}</span>
                        {d.note&&<span style={{fontSize:11,color:C.muted,fontStyle:"italic"}}>💬 {d.note}</span>}
                      </div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontWeight:800,fontSize:16,color:C.orange}}>{fmt(d.montant)}</span>
                      <button onClick={()=>{setEditDepId(d.id);setEditDepData({libelle:d.libelle,categorie:d.categorie,montant:d.montant,date:d.date,note:d.note||""});}} style={{background:C.blue+"22",border:"1px solid "+C.blue+"44",color:C.blue,borderRadius:6,padding:"4px 10px",fontSize:11,cursor:"pointer"}}>✏️</button>
                      <button onClick={()=>delDep(d.id)} style={{background:C.red+"22",border:"1px solid "+C.red+"44",color:C.red,borderRadius:6,padding:"4px 10px",fontSize:11,cursor:"pointer"}}>🗑️</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          {filteredDep.length>0&&<div style={{background:C.card,border:"1px solid "+C.orange+"44",borderRadius:10,padding:"12px 18px",display:"flex",justifyContent:"space-between"}}>
            <span style={{color:C.muted,fontWeight:600}}>Total {filterCat!=="Toutes"?filterCat:"toutes catégories"}</span>
            <span style={{fontWeight:800,color:C.orange,fontSize:16}}>{fmt(filteredDep.reduce((a,d)=>a+Number(d.montant),0))}</span>
          </div>}
          {showNewDep&&(
            <Modal title="🧾 Nouvelle Dépense" onClose={()=>setShowNewDep(false)} onSave={addDep}>
              {saving?<Spinner/>:<FGrid>
                <div style={{gridColumn:"1/-1"}}><FField label="Libellé *" value={depForm.libelle} onChange={v=>setDepForm(p=>({...p,libelle:v}))}/></div>
                <FSelect label="Catégorie" value={depForm.categorie} onChange={v=>setDepForm(p=>({...p,categorie:v}))} options={CATEGORIES}/>
                <FField label="Montant (XOF) *" type="number" value={depForm.montant} onChange={v=>setDepForm(p=>({...p,montant:v}))}/>
                <FField label="Date" type="date" value={depForm.date} onChange={v=>setDepForm(p=>({...p,date:v}))}/>
                <div style={{gridColumn:"1/-1"}}><FField label="Note" value={depForm.note} onChange={v=>setDepForm(p=>({...p,note:v}))}/></div>
              </FGrid>}
            </Modal>
          )}
        </div>
      )}

      {onglet==="analyse"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <Card title="Analyse budgétaire">
            {[["Budget initial",fmt(c.budgetInitial),C.white],["Dépenses cumulées",fmt(dep),C.yellow],["Marge",fmt(c.budgetInitial-dep),c.budgetInitial-dep>=0?C.green:C.red],["% consommé",depPct+"%",depPct>100?C.red:depPct>80?C.yellow:C.green],["Statut",ssb,budgetColor(ssb)]].map(([k,v,col])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid "+C.border,fontSize:13}}>
                <span style={{color:C.muted}}>{k}</span><span style={{fontWeight:700,color:col}}>{v}</span>
              </div>
            ))}
          </Card>
          <Card title="Dépenses par catégorie">
            {depParCat.length===0?<EmptyState msg="Aucune dépense" icon="📊"/>:depParCat.map(({cat,total:t})=>(
              <div key={cat} style={{padding:"8px 0",borderBottom:"1px solid "+C.border}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4}}>
                  <span style={{color:catColor(cat),fontWeight:600}}>{cat}</span><span style={{fontWeight:700}}>{fmt(t)}</span>
                </div>
                <PBar p={pct(t,dep)} color={catColor(cat)} h={5}/>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 12. InterventionsPage
// ═════════════════════════════════════════════════════════════════════════════
function InterventionsPage({interventions,setInterventions,chantiers,reload}){
  const [showNew,setShowNew]=useState(false);
  const [viewId,setViewId]=useState(null);
  const [filterType,setFilterType]=useState("Tous");
  const [filterStatut,setFilterStatut]=useState("Tous");
  const [filterClient,setFilterClient]=useState("Tous");
  const [sortBy,setSortBy]=useState("date_desc");
  const [saving,setSaving]=useState(false);
  const [form,setForm]=useState({titre:"",description:"",type:"Corrective",intervenant:"",chantier:"",client:"",dateCreation:new Date().toISOString().slice(0,10),duree:"",statut:"En attente"});

  const types=["Tous","Urgence","Préventive","Corrective","Inspection"];
  const statuts=["Tous","En attente","En cours","Terminée"];
  const clients=["Tous",...new Set(interventions.map(i=>i.client).filter(Boolean))];

  const filtered=useMemo(()=>{
    let r=interventions.filter(i=>(filterType==="Tous"||i.type===filterType)&&(filterStatut==="Tous"||i.statut===filterStatut)&&(filterClient==="Tous"||i.client===filterClient));
    if(sortBy==="date_desc") r=[...r].sort((a,b)=>new Date(b.dateCreation)-new Date(a.dateCreation));
    if(sortBy==="date_asc") r=[...r].sort((a,b)=>new Date(a.dateCreation)-new Date(b.dateCreation));
    if(sortBy==="client") r=[...r].sort((a,b)=>(a.client||"").localeCompare(b.client||""));
    if(sortBy==="cout_desc") r=[...r].sort((a,b)=>totalIntDep(b)-totalIntDep(a));
    return r;
  },[interventions,filterType,filterStatut,filterClient,sortBy]);

  const totalCout=interventions.reduce((a,i)=>a+totalIntDep(i),0);
  const totalFacture=interventions.filter(i=>i.facturee).reduce((a,i)=>a+totalIntDep(i),0);

  const saveNew=async()=>{
    if(!form.titre)return;
    setSaving(true);
    await sb.from("interventions").insert({titre:form.titre,description:form.description,type:form.type,intervenant:form.intervenant,chantier:form.chantier,client:form.client,date_creation:form.dateCreation,duree:parseInt(form.duree)||1,statut:form.statut,facturee:false});
    setSaving(false);setShowNew(false);
    setForm({titre:"",description:"",type:"Corrective",intervenant:"",chantier:"",client:"",dateCreation:new Date().toISOString().slice(0,10),duree:"",statut:"En attente"});
    reload();
  };
  const updateStatut=async(id,s)=>{await sb.from("interventions").eq("id",id).update({statut:s});reload();};
  const toggleFacturee=async(id,val)=>{await sb.from("interventions").eq("id",id).update({facturee:!val});reload();};
  const deleteInt=async id=>{await sb.from("interventions").eq("id",id).delete();reload();};

  return(
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
        <KpiCard icon="🔧" label="Total" value={interventions.length} color={C.orange}/>
        <KpiCard icon="🚨" label="Urgences" value={interventions.filter(i=>i.type==="Urgence").length} color={C.red}/>
        <KpiCard icon="⚙️" label="En cours" value={interventions.filter(i=>i.statut==="En cours").length} color={C.blue}/>
        <KpiCard icon="💰" label="Coût total" value={fmt(totalCout)} color={C.yellow}/>
        <KpiCard icon="✅" label="Facturé" value={fmt(totalFacture)} color={C.green}/>
        <KpiCard icon="❌" label="Non facturé" value={fmt(totalCout-totalFacture)} color={C.red}/>
      </div>
      <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,padding:"14px 18px",display:"flex",flexDirection:"column",gap:12}}>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          <span style={{fontSize:12,color:C.muted,minWidth:50}}>Type :</span>
          {types.map(t=><button key={t} onClick={()=>setFilterType(t)} style={{padding:"5px 12px",borderRadius:20,border:"1px solid "+(filterType===t?C.orange:C.border),background:filterType===t?C.orange:"transparent",color:filterType===t?"#fff":C.muted,cursor:"pointer",fontSize:11,fontWeight:filterType===t?700:400}}>{t}</button>)}
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          <span style={{fontSize:12,color:C.muted,minWidth:50}}>Statut :</span>
          {statuts.map(s=><button key={s} onClick={()=>setFilterStatut(s)} style={{padding:"5px 12px",borderRadius:20,border:"1px solid "+(filterStatut===s?(STATUT_INT[s]||C.orange):C.border),background:filterStatut===s?(STATUT_INT[s]||C.orange)+"33":"transparent",color:filterStatut===s?(STATUT_INT[s]||C.orange):C.muted,cursor:"pointer",fontSize:11,fontWeight:filterStatut===s?700:400}}>{s}</button>)}
        </div>
        <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <span style={{fontSize:12,color:C.muted}}>Client :</span>
            <select value={filterClient} onChange={e=>setFilterClient(e.target.value)} style={{background:C.mid,border:"1px solid "+C.border,borderRadius:6,padding:"4px 10px",color:C.white,fontSize:12,outline:"none"}}>
              {clients.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <span style={{fontSize:12,color:C.muted}}>Trier :</span>
            <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{background:C.mid,border:"1px solid "+C.border,borderRadius:6,padding:"4px 10px",color:C.white,fontSize:12,outline:"none"}}>
              <option value="date_desc">Date ↓</option>
              <option value="date_asc">Date ↑</option>
              <option value="client">Client A→Z</option>
              <option value="cout_desc">Coût ↓</option>
            </select>
          </div>
          <button onClick={()=>setShowNew(true)} style={{marginLeft:"auto",background:C.orange,color:"#fff",border:"none",borderRadius:8,padding:"8px 18px",fontWeight:700,cursor:"pointer",fontSize:13}}>+ Nouvelle</button>
        </div>
      </div>
      {filtered.length===0&&<EmptyState msg="Aucune intervention" icon="🔧"/>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(380px,1fr))",gap:14}}>
        {filtered.map(i=>(
          <div key={i.id} style={{background:C.card,border:"1px solid "+(i.type==="Urgence"?C.red+"66":C.border),borderRadius:14,padding:18,display:"flex",flexDirection:"column",gap:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:15}}>{i.titre}</div>
                <div style={{fontSize:12,color:C.muted,marginTop:2}}>🏗️ {i.chantier||"—"} · 👤 {i.client||"—"}</div>
                <div style={{fontSize:11,color:C.muted,marginTop:1}}>📅 {i.dateCreation} · {i.intervenant}</div>
              </div>
              <Badge label={i.type} color={TYPE_INT[i.type]||C.orange} small/>
            </div>
            {i.description&&<div style={{fontSize:12,color:C.muted,background:C.mid,borderRadius:6,padding:"8px 12px"}}>{i.description}</div>}
            <div style={{display:"flex",gap:10,alignItems:"center",background:C.mid,borderRadius:8,padding:"10px 14px"}}>
              <div style={{flex:1}}>
                <div style={{fontSize:10,color:C.muted}}>Coût total</div>
                <div style={{fontWeight:800,color:C.orange,fontSize:16}}>{fmt(totalIntDep(i))}</div>
                <div style={{fontSize:11,color:C.muted}}>{(i.depenses||[]).length} ligne(s)</div>
              </div>
              <button onClick={()=>toggleFacturee(i.id,i.facturee)} style={{background:i.facturee?C.green+"22":C.red+"22",border:"1px solid "+(i.facturee?C.green:C.red)+"55",borderRadius:8,padding:"6px 14px",color:i.facturee?C.green:C.red,fontWeight:700,fontSize:12,cursor:"pointer"}}>
                {i.facturee?"✅ Facturée":"❌ Non facturée"}
              </button>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
              <select value={i.statut} onChange={e=>updateStatut(i.id,e.target.value)} style={{background:STATUT_INT[i.statut]+"22",border:"1px solid "+STATUT_INT[i.statut]+"55",borderRadius:6,padding:"4px 10px",color:STATUT_INT[i.statut],fontSize:12,cursor:"pointer",outline:"none",fontWeight:700}}>
                {["En attente","En cours","Terminée"].map(s=><option key={s} value={s}>{s}</option>)}
              </select>
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>setViewId(i.id)} style={{background:C.blue+"22",border:"1px solid "+C.blue+"44",color:C.blue,borderRadius:6,padding:"5px 12px",fontSize:11,cursor:"pointer",fontWeight:600}}>📋 Détail</button>
                <button onClick={()=>deleteInt(i.id)} style={{background:C.red+"22",border:"1px solid "+C.red+"44",color:C.red,borderRadius:6,padding:"5px 10px",fontSize:11,cursor:"pointer"}}>🗑️</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {showNew&&(
        <Modal title="🔧 Nouvelle Intervention" onClose={()=>setShowNew(false)} onSave={saveNew}>
          {saving?<Spinner/>:<FGrid>
            <div style={{gridColumn:"1/-1"}}><FField label="Titre *" value={form.titre} onChange={v=>setForm(p=>({...p,titre:v}))}/></div>
            <FSelect label="Type" value={form.type} onChange={v=>setForm(p=>({...p,type:v}))} options={["Urgence","Préventive","Corrective","Inspection"]}/>
            <FSelect label="Statut" value={form.statut} onChange={v=>setForm(p=>({...p,statut:v}))} options={["En attente","En cours","Terminée"]}/>
            <FField label="Intervenant" value={form.intervenant} onChange={v=>setForm(p=>({...p,intervenant:v}))}/>
            <FSelect label="Chantier" value={form.chantier} onChange={v=>setForm(p=>({...p,chantier:v}))} options={["",...chantiers.map(c=>c.nom)]}/>
            <FField label="Client" value={form.client} onChange={v=>setForm(p=>({...p,client:v}))}/>
            <FField label="Date" type="date" value={form.dateCreation} onChange={v=>setForm(p=>({...p,dateCreation:v}))}/>
            <FField label="Durée (jours)" type="number" value={form.duree} onChange={v=>setForm(p=>({...p,duree:v}))}/>
            <div style={{gridColumn:"1/-1"}}>
              <label style={{fontSize:12,color:C.muted,display:"block",marginBottom:4}}>Description</label>
              <textarea value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} rows={3} style={{width:"100%",background:C.mid,border:"1px solid "+C.border,borderRadius:8,padding:"9px 12px",color:C.white,fontSize:13,boxSizing:"border-box",outline:"none",resize:"vertical"}}/>
            </div>
          </FGrid>}
        </Modal>
      )}
      {viewId&&<IntervDetail intervention={interventions.find(i=>i.id===viewId)} onClose={()=>setViewId(null)} reload={reload}/>}
    </div>
  );
}

// ── 14. IntervDetail ──────────────────────────────────────────────────────────
function IntervDetail({intervention:i,onClose,reload}){
  const [tab,setTab]=useState("depenses");
  const [depForm,setDepForm]=useState({libelle:"",categorie:"Main d'œuvre",montant:"",date:new Date().toISOString().slice(0,10),note:""});
  const [showDep,setShowDep]=useState(false);
  const [todoText,setTodoText]=useState("");

  const addDep=async()=>{
    if(!depForm.libelle||!depForm.montant)return;
    await sb.from("intervention_depenses").insert({intervention_id:i.id,libelle:depForm.libelle,categorie:depForm.categorie,montant:parseFloat(depForm.montant),date:depForm.date,note:depForm.note});
    setShowDep(false);setDepForm({libelle:"",categorie:"Main d'œuvre",montant:"",date:new Date().toISOString().slice(0,10),note:""});reload();
  };
  const delDep=async id=>{await sb.from("intervention_depenses").eq("id",id).delete();reload();};
  const addTodo=async()=>{
    if(!todoText.trim())return;
    await sb.from("intervention_todos").insert({intervention_id:i.id,texte:todoText,fait:false});
    setTodoText("");reload();
  };
  const toggleTodo=async(id,val)=>{await sb.from("intervention_todos").eq("id",id).update({fait:!val});reload();};
  const delTodo=async id=>{await sb.from("intervention_todos").eq("id",id).delete();reload();};

  const totalD=totalIntDep(i);
  const todosDone=(i.todos||[]).filter(t=>t.fait).length;

  return(
    <div style={{position:"fixed",inset:0,background:"#00000099",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:C.dark,border:"1px solid "+C.border,borderRadius:16,padding:28,width:"100%",maxWidth:700,maxHeight:"90vh",overflow:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
          <div>
            <div style={{fontWeight:800,fontSize:18}}>{i.titre}</div>
            <div style={{fontSize:13,color:C.muted,marginTop:4}}>🏗️ {i.chantier} · 👤 {i.client} · 📅 {i.dateCreation}</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:20}}>✕</button>
        </div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:20}}>
          <KpiCard icon="💰" label="Coût total" value={fmt(totalD)} color={C.orange}/>
          <KpiCard icon="📋" label="Dépenses" value={(i.depenses||[]).length} color={C.yellow}/>
          <KpiCard icon="✅" label="Todos" value={todosDone+"/"+(i.todos||[]).length} color={todosDone===(i.todos||[]).length&&(i.todos||[]).length>0?C.green:C.blue}/>
          <KpiCard icon={i.facturee?"✅":"❌"} label="Facturation" value={i.facturee?"Facturée":"Non facturée"} color={i.facturee?C.green:C.red}/>
        </div>
        <div style={{display:"flex",gap:6,marginBottom:16}}>
          {["depenses","todos"].map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{padding:"8px 18px",borderRadius:8,border:"1px solid "+(tab===t?C.orange:C.border),background:tab===t?C.orange:C.card,color:tab===t?"#fff":C.muted,cursor:"pointer",fontWeight:tab===t?700:400,fontSize:13}}>
              {t==="depenses"?"🧾 Dépenses":"✅ To-do list"}
            </button>
          ))}
        </div>
        {tab==="depenses"&&(
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div style={{display:"flex",justifyContent:"flex-end"}}>
              <button onClick={()=>setShowDep(true)} style={{background:C.orange,color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontWeight:700,cursor:"pointer",fontSize:13}}>+ Ajouter</button>
            </div>
            {(i.depenses||[]).length===0&&<EmptyState msg="Aucune dépense" icon="🧾"/>}
            {(i.depenses||[]).map(d=>(
              <div key={d.id} style={{background:C.mid,borderRadius:10,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:7,height:7,borderRadius:"50%",background:catColor(d.categorie)}}/><span style={{fontWeight:600,fontSize:13}}>{d.libelle}</span></div>
                  <div style={{fontSize:11,color:C.muted,marginTop:3}}><Badge label={d.categorie} color={catColor(d.categorie)} small/> · {d.date}{d.note&&" · "+d.note}</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontWeight:800,color:C.orange}}>{fmt(d.montant)}</span>
                  <button onClick={()=>delDep(d.id)} style={{background:C.red+"22",border:"1px solid "+C.red+"44",color:C.red,borderRadius:6,padding:"4px 8px",fontSize:11,cursor:"pointer"}}>🗑️</button>
                </div>
              </div>
            ))}
            {(i.depenses||[]).length>0&&<div style={{background:C.card,border:"1px solid "+C.orange+"44",borderRadius:10,padding:"12px 16px",display:"flex",justifyContent:"space-between"}}><span style={{fontWeight:700,color:C.muted}}>Total</span><span style={{fontWeight:800,color:C.orange,fontSize:16}}>{fmt(totalD)}</span></div>}
            {showDep&&(
              <div style={{background:C.card,border:"2px solid "+C.orange,borderRadius:12,padding:16}}>
                <div style={{fontWeight:700,color:C.orange,marginBottom:12}}>+ Nouvelle dépense</div>
                <FGrid>
                  <div style={{gridColumn:"1/-1"}}><FField label="Libellé *" value={depForm.libelle} onChange={v=>setDepForm(p=>({...p,libelle:v}))}/></div>
                  <FSelect label="Catégorie" value={depForm.categorie} onChange={v=>setDepForm(p=>({...p,categorie:v}))} options={CATEGORIES}/>
                  <FField label="Montant (XOF) *" type="number" value={depForm.montant} onChange={v=>setDepForm(p=>({...p,montant:v}))}/>
                  <FField label="Date" type="date" value={depForm.date} onChange={v=>setDepForm(p=>({...p,date:v}))}/>
                  <FField label="Note" value={depForm.note} onChange={v=>setDepForm(p=>({...p,note:v}))}/>
                </FGrid>
                <div style={{display:"flex",gap:8,marginTop:12,justifyContent:"flex-end"}}>
                  <button onClick={()=>setShowDep(false)} style={{padding:"7px 16px",background:C.mid,color:C.white,border:"none",borderRadius:8,cursor:"pointer"}}>Annuler</button>
                  <button onClick={addDep} style={{padding:"7px 16px",background:C.orange,color:"#fff",border:"none",borderRadius:8,fontWeight:700,cursor:"pointer"}}>💾 Enregistrer</button>
                </div>
              </div>
            )}
          </div>
        )}
        {tab==="todos"&&(
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div style={{display:"flex",gap:8}}>
              <input value={todoText} onChange={e=>setTodoText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTodo()} placeholder="Nouvelle tâche..." style={{flex:1,background:C.mid,border:"1px solid "+C.border,borderRadius:8,padding:"9px 12px",color:C.white,fontSize:13,outline:"none"}}/>
              <button onClick={addTodo} style={{background:C.orange,color:"#fff",border:"none",borderRadius:8,padding:"9px 16px",fontWeight:700,cursor:"pointer"}}>+ Ajouter</button>
            </div>
            {(i.todos||[]).length===0&&<EmptyState msg="Aucune tâche" icon="✅"/>}
            {(i.todos||[]).map(t=>(
              <div key={t.id} style={{display:"flex",alignItems:"center",gap:10,background:C.mid,borderRadius:8,padding:"10px 14px"}}>
                <button onClick={()=>toggleTodo(t.id,t.fait)} style={{width:22,height:22,borderRadius:"50%",background:t.fait?C.green:C.border,border:"2px solid "+(t.fait?C.green:C.muted),display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,color:"#fff",fontSize:12}}>{t.fait?"✓":""}</button>
                <span style={{flex:1,fontSize:13,textDecoration:t.fait?"line-through":"none",color:t.fait?C.muted:C.white}}>{t.texte}</span>
                <button onClick={()=>delTodo(t.id)} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:14}}>✕</button>
              </div>
            ))}
            {(i.todos||[]).length>0&&<div style={{textAlign:"right",fontSize:12,color:C.muted}}>{todosDone}/{(i.todos||[]).length} tâche(s)<PBar p={pct(todosDone,(i.todos||[]).length)} color={C.green} h={4}/></div>}
          </div>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 15. GestionPage
// ═════════════════════════════════════════════════════════════════════════════
function GestionPage({chantiers,setChantiers,openChantier,reload}){
  const [confirmId,setConfirmId]=useState(null);
  const [search,setSearch]=useState("");
  const filtered=chantiers.filter(c=>c.nom.toLowerCase().includes(search.toLowerCase())||c.client.toLowerCase().includes(search.toLowerCase()));
  const handleDelete=async id=>{await sb.from("chantiers").eq("id",id).delete();setConfirmId(null);reload();};

  return(
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
        <KpiCard icon="🏗️" label="Total projets" value={chantiers.length} color={C.orange}/>
        <KpiCard icon="✅" label="Clôturés" value={chantiers.filter(c=>c.statut==="Clôturé").length} color={C.green}/>
        <KpiCard icon="⚙️" label="En cours" value={chantiers.filter(c=>c.statut==="En cours").length} color={C.blue}/>
        <KpiCard icon="🚨" label="En dérive" value={chantiers.filter(c=>c.statut==="En dérive").length} color={C.red}/>
      </div>
      <Card title="⚙️ Gestion & Suppression">
        <div style={{marginBottom:16}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher..." style={{width:"100%",background:C.mid,border:"1px solid "+C.border,borderRadius:8,padding:"9px 14px",color:C.white,fontSize:13,boxSizing:"border-box",outline:"none"}}/>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {filtered.map(c=>{
            const dep=getBudgetConsomme(c);const p=pct(dep,c.budgetInitial);const ssb=getSousStatutBudget(dep,c.budgetInitial);
            return(
              <div key={c.id} style={{background:C.mid,border:"1px solid "+(confirmId===c.id?C.red+"88":C.border),borderRadius:12,padding:"14px 18px"}}>
                {confirmId===c.id?(
                  <div>
                    <div style={{fontWeight:700,color:C.red,marginBottom:8}}>🗑️ Confirmer la suppression de "{c.nom}" ?</div>
                    <div style={{fontSize:12,color:C.muted,marginBottom:14}}>Cette action est irréversible.</div>
                    <div style={{display:"flex",gap:10}}>
                      <button onClick={()=>setConfirmId(null)} style={{flex:1,padding:"8px",background:C.card,color:C.white,border:"1px solid "+C.border,borderRadius:8,cursor:"pointer"}}>Annuler</button>
                      <button onClick={()=>handleDelete(c.id)} style={{flex:1,padding:"8px",background:C.red,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700}}>✔ Supprimer</button>
                    </div>
                  </div>
                ):(
                  <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
                    <div style={{flex:2,minWidth:160}}><div style={{fontWeight:700,fontSize:14}}>{c.nom}</div><div style={{fontSize:12,color:C.muted,marginTop:2}}>👤 {c.client} · 📍 {c.localisation}</div></div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}><Badge label={c.statut} color={statutColor(c.statut)} small/><Badge label={ssb} color={budgetColor(ssb)} small/></div>
                    <div style={{minWidth:200,flex:1}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.muted,marginBottom:3}}><span>{fmt(dep)}</span><span style={{color:p>100?C.red:p>80?C.yellow:C.green,fontWeight:700}}>{p}%</span></div>
                      <PBar p={p} color={p>100?C.red:p>80?C.yellow:C.green} h={6}/>
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>openChantier(c.id)} style={{background:C.blue+"22",border:"1px solid "+C.blue+"44",color:C.blue,borderRadius:7,padding:"6px 14px",fontSize:12,cursor:"pointer",fontWeight:600}}>📋 Ouvrir</button>
                      <button onClick={()=>setConfirmId(c.id)} style={{background:C.red+"22",border:"1px solid "+C.red+"44",color:C.red,borderRadius:7,padding:"6px 12px",fontSize:12,cursor:"pointer",fontWeight:700}}>🗑️</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {filtered.length===0&&<EmptyState msg="Aucun projet trouvé" icon="🔍"/>}
      </Card>
      <Card title="📊 Récapitulatif financier global">
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:12,marginBottom:16}}>
          {[
            ["Budget total",fmt(chantiers.reduce((a,c)=>a+c.budgetInitial,0)),C.white],
            ["Dépenses cumulées",fmt(chantiers.reduce((a,c)=>a+getBudgetConsomme(c),0)),C.yellow],
            ["Marge globale",fmt(chantiers.reduce((a,c)=>a+(c.budgetInitial-getBudgetConsomme(c)),0)),chantiers.reduce((a,c)=>a+(c.budgetInitial-getBudgetConsomme(c)),0)>=0?C.green:C.red],
          ].map(([k,v,col])=>(
            <div key={k} style={{background:C.mid,borderRadius:10,padding:"12px 16px"}}>
              <div style={{fontSize:11,color:C.muted,marginBottom:4}}>{k}</div>
              <div style={{fontWeight:800,fontSize:16,color:col}}>{v}</div>
            </div>
          ))}
        </div>
        {chantiers.map(c=>{const dep=getBudgetConsomme(c);const p=pct(dep,c.budgetInitial);return(
          <div key={c.id} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 0",borderBottom:"1px solid "+C.border,fontSize:12}}>
            <div style={{minWidth:170,fontWeight:600}}>{c.nom.split(" ").slice(0,3).join(" ")}</div>
            <div style={{flex:1}}><PBar p={p} color={p>100?C.red:p>80?C.yellow:C.green} h={8}/></div>
            <div style={{minWidth:45,textAlign:"right",fontWeight:700,color:p>100?C.red:p>80?C.yellow:C.green}}>{p}%</div>
            <div style={{minWidth:110,textAlign:"right",color:C.muted}}>{fmt(dep)}</div>
            <div style={{minWidth:110,textAlign:"right",color:C.muted}}>/ {fmt(c.budgetInitial)}</div>
          </div>
        );})}
      </Card>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 16. AlertesPage
// ═════════════════════════════════════════════════════════════════════════════
function AlertesPage({chantiers,openChantier}){
  const alertes=genAlertes(chantiers);
  const col={critique:C.red,danger:C.orange,warning:C.yellow,info:C.blue};
  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {alertes.length===0&&<EmptyState msg="Aucune alerte 🎉" icon="✅"/>}
      {alertes.map(({niveau,msg,chantier},i)=>(
        <div key={i} onClick={()=>openChantier(chantier.id)} style={{background:C.card,border:"1px solid "+(col[niveau]||C.border)+"44",borderRadius:10,padding:"14px 18px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div><div style={{fontWeight:600,fontSize:14,color:col[niveau]}}>⚠️ {msg}</div><div style={{fontSize:12,color:C.muted,marginTop:4}}>{chantier.nom} · {chantier.client}</div></div>
          <Badge label={chantier.statut} color={statutColor(chantier.statut)}/>
        </div>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 17. KpiPage
// ═════════════════════════════════════════════════════════════════════════════
function KpiPage({chantiers}){
  const total=chantiers.length||1;
  const totalBudget=chantiers.reduce((a,c)=>a+c.budgetInitial,0);
  const totalDeps=chantiers.reduce((a,c)=>a+getBudgetConsomme(c),0);
  const margeGlobale=totalBudget-totalDeps;
  const pctGlobal=pct(totalDeps,totalBudget);
  const derives=chantiers.filter(c=>getBudgetConsomme(c)>c.budgetInitial||c.statut==="En dérive");
  const enBonne=chantiers.filter(c=>pct(getBudgetConsomme(c),c.budgetInitial)<80);
  const clos=chantiers.filter(c=>c.statut==="Clôturé");
  const tauxDerive=Math.round(derives.length/total*100);
  const allDep=chantiers.flatMap(c=>c.depenses);
  const depCat=CATEGORIES.map(cat=>({cat,total:allDep.filter(d=>d.categorie===cat).reduce((a,d)=>a+Number(d.montant),0)})).filter(x=>x.total>0);
  const radarData=[
    {kpi:"Budget OK",val:Math.round(enBonne.length/total*100)},
    {kpi:"Sans dérive",val:100-tauxDerive},
    {kpi:"Taux clôture",val:Math.round(clos.length/total*100)},
    {kpi:"Marge positive",val:Math.round(chantiers.filter(c=>getBudgetConsomme(c)<c.budgetInitial).length/total*100)},
    {kpi:"Actifs suivis",val:Math.round(chantiers.filter(c=>c.depenses.length>0).length/total*100)},
  ];
  const bdData=chantiers.map(c=>({name:c.nom.split(" ").slice(0,2).join(" "),budget:Math.round(c.budgetInitial/1000),dep:Math.round(getBudgetConsomme(c)/1000),marge:Math.round((c.budgetInitial-getBudgetConsomme(c))/1000)}));

  return(
    <div style={{display:"flex",flexDirection:"column",gap:24}}>
      <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
        <KpiCard icon="💰" label="Budget total" value={fmt(totalBudget)} color={C.white}/>
        <KpiCard icon="🧾" label="Dépenses réelles" value={fmt(totalDeps)} color={C.yellow} sub={pctGlobal+"% du budget"}/>
        <KpiCard icon="💵" label="Marge globale" value={fmt(margeGlobale)} color={margeGlobale>=0?C.green:C.red}/>
        <KpiCard icon="📉" label="Taux dérive" value={tauxDerive+"%"} color={tauxDerive>20?C.red:tauxDerive>10?C.yellow:C.green}/>
        <KpiCard icon="✅" label="Projets sains" value={enBonne.length+"/"+total} color={C.green}/>
        <KpiCard icon="🏁" label="Clôturés" value={clos.length} color={C.green}/>
      </div>
      <Card title="Consommation budgétaire globale">
        <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:6}}><span style={{color:C.muted}}>Dépenses / Budget total</span><strong style={{color:pctGlobal>100?C.red:pctGlobal>80?C.yellow:C.green}}>{pctGlobal}%</strong></div>
        <PBar p={pctGlobal} color={pctGlobal>100?C.red:pctGlobal>80?C.yellow:C.green} h={18}/>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.muted,marginTop:6}}><span>Dépensé : {fmt(totalDeps)}</span><span>Restant : {fmt(margeGlobale)}</span><span>Budget : {fmt(totalBudget)}</span></div>
      </Card>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
        <Card title="Radar Performance">
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid stroke={C.border}/>
              <PolarAngleAxis dataKey="kpi" tick={{fill:C.muted,fontSize:11}}/>
              <Radar dataKey="val" stroke={C.orange} fill={C.orange} fillOpacity={0.3}/>
              <Tooltip contentStyle={{background:C.dark,border:"1px solid "+C.border,color:C.white}} formatter={v=>v+"%"}/>
            </RadarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Dépenses par catégorie">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={depCat} layout="vertical" margin={{left:10,right:10}}>
              <XAxis type="number" tick={{fill:C.muted,fontSize:10}} tickFormatter={v=>Math.round(v/1000)+"k"}/>
              <YAxis type="category" dataKey="cat" tick={{fill:C.muted,fontSize:11}} width={95}/>
              <Tooltip contentStyle={{background:C.dark,border:"1px solid "+C.border,color:C.white}} formatter={v=>fmt(v)}/>
              <Bar dataKey="total" radius={[0,4,4,0]}>{depCat.map(({cat},i)=><Cell key={i} fill={catColor(cat)}/>)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
      <Card title="Budget vs Dépenses vs Marge (k XOF)">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={bdData} margin={{top:5,right:10,left:-10,bottom:50}}>
            <XAxis dataKey="name" tick={{fill:C.muted,fontSize:10}} angle={-30} textAnchor="end"/>
            <YAxis tick={{fill:C.muted,fontSize:10}}/>
            <Tooltip contentStyle={{background:C.dark,border:"1px solid "+C.border,color:C.white}} formatter={v=>v+"k XOF"}/>
            <Bar dataKey="budget" fill={C.orange+"66"} name="Budget" radius={[4,4,0,0]}/>
            <Bar dataKey="dep" fill={C.orange} name="Dépenses" radius={[4,4,0,0]}/>
            <Bar dataKey="marge" fill={C.green+"99"} name="Marge" radius={[4,4,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Détail consommation par chantier">
        {chantiers.map(c=>{const dep=getBudgetConsomme(c);const p=pct(dep,c.budgetInitial);const ssb=getSousStatutBudget(dep,c.budgetInitial);return(
          <div key={c.id} style={{padding:"12px 0",borderBottom:"1px solid "+C.border}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginBottom:4,flexWrap:"wrap"}}>
              <div style={{minWidth:170,fontWeight:600,fontSize:13}}>{c.nom.split(" ").slice(0,3).join(" ")}</div>
              <div style={{flex:1,minWidth:120}}><PBar p={p} color={p>100?C.red:p>80?C.yellow:C.green} h={10}/></div>
              <div style={{fontWeight:700,color:p>100?C.red:p>80?C.yellow:C.green,minWidth:45,textAlign:"right"}}>{p}%</div>
              <Badge label={ssb} color={budgetColor(ssb)} small/>
              <Badge label={c.statut} color={statutColor(c.statut)} small/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.muted,flexWrap:"wrap",gap:6}}>
              <span>🧾 Dépenses : <strong style={{color:C.yellow}}>{fmt(dep)}</strong></span>
              <span>💰 Budget : {fmt(c.budgetInitial)}</span>
              <span style={{color:c.budgetInitial-dep>=0?C.green:C.red}}>💵 Marge : {fmt(c.budgetInitial-dep)}</span>
              <span>📋 {c.depenses.length} ligne(s)</span>
            </div>
          </div>
        );})}
      </Card>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 18. IAPage
// ═════════════════════════════════════════════════════════════════════════════
function IAPage({chantiers,openChantier,interventions}){
  const [analysing,setAnalysing]=useState(false);
  const [iaResult,setIaResult]=useState(null);
  const [iaError,setIaError]=useState(null);
  const [activeTab,setActiveTab]=useState("derives");

  const derives=chantiers.filter(c=>c.statut==="En dérive");
  const risques=chantiers.filter(c=>{const p=pct(totalDep(c),c.budgetInitial);return p>=80&&p<=100&&c.statut!=="En dérive";});
  const projections=chantiers.map(c=>{const d=totalDep(c);return{...c,depenses_total:d,ecart:d-c.budgetInitial};});
  const allDep=chantiers.flatMap(c=>c.depenses.map(d=>({...d,chantier:c.nom})));
  const grouped={};
  allDep.forEach(d=>{const k=d.libelle.trim().toLowerCase();if(!grouped[k])grouped[k]=[];grouped[k].push(d);});
  const doublons=Object.entries(grouped).filter(([,items])=>items.length>1);
  const prest={};
  allDep.filter(d=>d.categorie==="Sous-traitance").forEach(d=>{const k=d.libelle.trim();if(!prest[k])prest[k]={libelle:k,total:0,chantiers:new Set()};prest[k].total+=Number(d.montant);prest[k].chantiers.add(d.chantier);});
  const prestList=Object.values(prest).sort((a,b)=>b.total-a.total);
  const totalST=allDep.filter(d=>d.categorie==="Sous-traitance").reduce((a,d)=>a+Number(d.montant),0);

  const runIA=async()=>{
    setAnalysing(true);setIaError(null);setIaResult(null);
    try{
      const ctx={
        chantiers:chantiers.map(c=>({nom:c.nom,client:c.client,statut:c.statut,budgetInitial:c.budgetInitial,depensesTotal:totalDep(c),depenses:c.depenses})),
        interventions:interventions.map(i=>({titre:i.titre,type:i.type,statut:i.statut,cout:totalIntDep(i),chantier:i.chantier,facturee:i.facturee})),
        doublons:doublons.map(([lib,items])=>({libelle:lib,occurrences:items.length,total:items.reduce((a,i)=>a+Number(i.montant),0),chantiers:items.map(i=>i.chantier)})),
        prestataires:prestList.map(p=>({libelle:p.libelle,total:p.total,chantiers:[...p.chantiers]}))
      };
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:"Expert BTP. Analyse ce portefeuille (XOF). Réponds UNIQUEMENT en JSON:\n"+JSON.stringify(ctx)+"\n\nFormat: {\"recapPrestataires\":[{\"nom\":string,\"totalXOF\":number,\"risque\":\"faible\"|\"moyen\"|\"élevé\",\"commentaire\":string}],\"alertesDoublons\":[{\"libelle\":string,\"occurrences\":number,\"totalXOF\":number,\"action\":string}],\"recommandations\":[{\"titre\":string,\"detail\":string,\"priorite\":\"haute\"|\"moyenne\"|\"basse\"}],\"scoreGlobal\":number,\"synthese\":string}"}]})});
      const data=await res.json();
      const text=(data.content||[]).map(i=>i.text||"").join("");
      setIaResult(JSON.parse(text.replace(/```json|```/g,"").trim()));
    }catch(e){setIaError("Erreur IA : "+e.message);}
    setAnalysing(false);
  };

  const tabs=[{key:"derives",label:"🚨 Dérives"},{key:"doublons",label:"🔍 Doublons"+(doublons.length>0?" ("+doublons.length+")":"")},{key:"prestataires",label:"👷 Prestataires"},{key:"ia",label:"🤖 Analyse IA"}];

  return(
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <div style={{background:C.orange+"11",border:"1px solid "+C.orange+"44",borderRadius:14,padding:24}}>
        <div style={{fontSize:20,fontWeight:800,marginBottom:6}}>🤖 Intelligence Artificielle</div>
        <div style={{color:C.muted,fontSize:13,marginBottom:16}}>Dérives · Doublons · Prestataires · Recommandations</div>
        <button onClick={runIA} disabled={analysing} style={{background:C.orange,color:"#fff",border:"none",borderRadius:10,padding:"10px 24px",fontWeight:700,cursor:analysing?"wait":"pointer",fontSize:14}}>
          {analysing?"⏳ Analyse...":iaResult?"🔄 Relancer":"▶ Lancer l'analyse IA"}
        </button>
        {iaError&&<div style={{color:C.red,fontSize:12,marginTop:10}}>⚠️ {iaError}</div>}
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {tabs.map(t=><button key={t.key} onClick={()=>setActiveTab(t.key)} style={{padding:"8px 16px",borderRadius:8,border:"1px solid "+(activeTab===t.key?C.orange:C.border),background:activeTab===t.key?C.orange:C.card,color:activeTab===t.key?"#fff":C.muted,cursor:"pointer",fontSize:13,fontWeight:activeTab===t.key?700:400}}>{t.label}</button>)}
      </div>

      {activeTab==="derives"&&(
        <>
          <Card title="🚨 Dérives budgétaires">
            {derives.length===0&&risques.length===0?<div style={{color:C.green,padding:16,textAlign:"center"}}>✅ Aucune dérive</div>:<>
              {derives.map(c=>{const d=totalDep(c);return<div key={c.id} onClick={()=>openChantier(c.id)} style={{background:C.red+"11",border:"1px solid "+C.red+"33",borderRadius:8,padding:"12px 16px",marginBottom:8,cursor:"pointer"}}><div style={{fontWeight:700,color:C.red}}>🔴 {c.nom}</div><div style={{fontSize:12,color:C.muted}}>Dépenses à {pct(d,c.budgetInitial)}% — {fmt(d)} / {fmt(c.budgetInitial)}</div></div>;})}
              {risques.map(c=>{const d=totalDep(c);return<div key={c.id} onClick={()=>openChantier(c.id)} style={{background:C.yellow+"11",border:"1px solid "+C.yellow+"33",borderRadius:8,padding:"12px 16px",marginBottom:8,cursor:"pointer"}}><div style={{fontWeight:700,color:C.yellow}}>🟡 {c.nom}</div><div style={{fontSize:12,color:C.muted}}>Dépenses à {pct(d,c.budgetInitial)}% — surveillance requise</div></div>;})}
            </>}
          </Card>
          <Card title="💡 Écart budget vs dépenses">
            {projections.map(c=>(
              <div key={c.id} style={{padding:"12px 0",borderBottom:"1px solid "+C.border,display:"flex",alignItems:"center",gap:14}}>
                <div style={{flex:2}}><div style={{fontWeight:600,fontSize:13}}>{c.nom}</div><div style={{fontSize:11,color:C.muted}}>{pct(c.depenses_total,c.budgetInitial)}% consommé</div></div>
                <div style={{flex:1,textAlign:"center"}}><div style={{fontSize:11,color:C.muted}}>Dépenses</div><div style={{fontWeight:700}}>{fmt(c.depenses_total)}</div></div>
                <div style={{flex:1,textAlign:"right"}}><div style={{fontSize:11,color:C.muted}}>Écart</div><div style={{fontWeight:700,color:c.ecart>0?C.red:C.green}}>{c.ecart>0?"+":""}{fmt(c.ecart)}</div></div>
                <Badge label={c.ecart>0?"⚠️ Dépassé":"✅ OK"} color={c.ecart>0?C.red:C.green} small/>
              </div>
            ))}
          </Card>
        </>
      )}

      {activeTab==="doublons"&&(
        <Card title="🔍 Dépenses libellés identiques">
          {doublons.length===0?<div style={{color:C.green,padding:16,textAlign:"center"}}>✅ Aucun doublon</div>:<>
            <div style={{background:C.yellow+"11",border:"1px solid "+C.yellow+"33",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:13,color:C.yellow}}>⚠️ {doublons.length} libellé(s) en doublon</div>
            {doublons.map(([lib,items])=>(
              <div key={lib} style={{border:"1px solid "+C.yellow+"44",borderRadius:10,padding:"14px 16px",marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><div style={{fontWeight:700,color:C.yellow}}>🔁 "{items[0].libelle}"</div><span style={{fontSize:12,color:C.muted}}>{items.length}x · {fmt(items.reduce((a,i)=>a+Number(i.montant),0))}</span></div>
                {items.map((item,idx)=>(
                  <div key={idx} style={{display:"flex",justifyContent:"space-between",background:C.mid,borderRadius:6,padding:"7px 12px",fontSize:12,marginBottom:4}}>
                    <span>🏗️ {item.chantier}</span><span style={{color:C.muted}}>{item.date}</span><span style={{fontWeight:700,color:C.orange}}>{fmt(item.montant)}</span><Badge label={item.categorie} color={catColor(item.categorie)} small/>
                  </div>
                ))}
                {items.every(i=>i.montant===items[0].montant)&&<div style={{marginTop:8,fontSize:12,color:C.red,fontWeight:600}}>🚨 Montants identiques — risque double saisie !</div>}
              </div>
            ))}
          </>}
        </Card>
      )}

      {activeTab==="prestataires"&&(
        <Card title="👷 Prestataires (Sous-traitance)">
          {prestList.length===0?<EmptyState msg="Aucun prestataire" icon="👷"/>:<>
            {prestList.map((p,i)=>{const pp=pct(p.total,totalST);return(
              <div key={i} style={{background:C.mid,borderRadius:10,padding:"12px 16px",marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                  <div><div style={{fontWeight:700,fontSize:14}}>👷 {p.libelle}</div><div style={{fontSize:11,marginTop:3}}>{[...p.chantiers].map(ch=><span key={ch} style={{marginRight:6,background:C.orange+"22",color:C.orange,borderRadius:4,padding:"1px 6px",fontSize:10}}>🏗️ {ch}</span>)}</div></div>
                  <div style={{textAlign:"right"}}><div style={{fontWeight:800,color:C.orange,fontSize:15}}>{fmt(p.total)}</div><div style={{fontSize:11,color:C.muted}}>{pp}%</div></div>
                </div>
                <div style={{marginTop:8}}><PBar p={pp} color={C.orange} h={5}/></div>
              </div>
            );})}
            <div style={{padding:"12px 16px",background:C.card,borderRadius:8,display:"flex",justifyContent:"space-between",marginTop:4}}><span style={{color:C.muted,fontWeight:600}}>Total sous-traitance</span><span style={{fontWeight:800,color:C.orange}}>{fmt(totalST)}</span></div>
          </>}
        </Card>
      )}

      {activeTab==="ia"&&(
        <>
          {!iaResult&&!analysing&&<EmptyState msg="Cliquez sur 'Lancer l'analyse IA'" icon="🤖"/>}
          {analysing&&<Spinner/>}
          {iaResult&&(
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <div style={{background:C.orange+"11",border:"1px solid "+C.orange+"44",borderRadius:12,padding:18}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div style={{fontWeight:800,fontSize:16}}>📋 Synthèse</div>
                  <div style={{background:(iaResult.scoreGlobal>70?C.green:iaResult.scoreGlobal>40?C.yellow:C.red)+"22",borderRadius:8,padding:"4px 14px",fontWeight:800,color:iaResult.scoreGlobal>70?C.green:iaResult.scoreGlobal>40?C.yellow:C.red}}>Score : {iaResult.scoreGlobal}/100</div>
                </div>
                <div style={{fontSize:13,color:C.muted,lineHeight:1.7}}>{iaResult.synthese}</div>
              </div>
              {iaResult.recapPrestataires?.length>0&&(
                <Card title="👷 Prestataires">
                  {iaResult.recapPrestataires.map((p,i)=>(
                    <div key={i} style={{padding:"12px 0",borderBottom:"1px solid "+C.border,display:"flex",justifyContent:"space-between",gap:10}}>
                      <div style={{flex:1}}><div style={{fontWeight:700}}>👷 {p.nom}</div><div style={{fontSize:12,color:C.muted}}>{p.commentaire}</div></div>
                      <div style={{display:"flex",gap:8,alignItems:"center"}}><span style={{fontWeight:700,color:C.orange}}>{fmt(p.totalXOF)}</span><Badge label={"Risque "+p.risque} color={p.risque==="élevé"?C.red:p.risque==="moyen"?C.yellow:C.green} small/></div>
                    </div>
                  ))}
                </Card>
              )}
              {iaResult.recommandations?.length>0&&(
                <Card title="🎯 Recommandations">
                  {iaResult.recommandations.map((r,i)=>{
                    const col=r.priorite==="haute"?C.red:r.priorite==="moyenne"?C.yellow:C.green;
                    return(
                      <div key={i} style={{background:col+"11",border:"1px solid "+col+"33",borderRadius:8,padding:"12px 16px",marginBottom:10}}>
                        <div style={{display:"flex",justifyContent:"space-between",gap:8}}><div style={{fontWeight:700,color:col}}>{r.titre}</div><Badge label={"Priorité "+r.priorite} color={col} small/></div>
                        <div style={{fontSize:12,color:C.muted,marginTop:4}}>{r.detail}</div>
                      </div>
                    );
                  })}
                </Card>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
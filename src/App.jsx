import { useState, useEffect, useCallback } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from "recharts";

const DT = {
  primary:"#F97316", secondary:"#3B82F6", success:"#22C55E",
  danger:"#EF4444", warning:"#EAB308", bg:"#1C1917", card:"#292524",
  mid:"#44403C", border:"#57534E", white:"#FAFAF9", muted:"#A8A29E",
  borderRadius:12, fontFamily:"'Segoe UI',system-ui,sans-serif",
  companyName:"JEAN BTP SARL"
};
const STATUTS   = ["Brouillon","Planifie","En cours","En derive","En reception","Cloture"];
const CATS      = ["Main d'oeuvre","Materiaux","Equipement","Transport","Sous-traitance","Divers"];
const UNITES    = ["U","m2","ml","m3","kg","t","forfait","h","j","ens."];
const TYPES_INT = ["Urgence","Preventive","Corrective","Inspection"];
const STATUTS_INT = ["En cours","Termine","Annule","En attente"];

const fmt   = n => new Intl.NumberFormat("fr-FR",{maximumFractionDigits:0}).format(n||0)+" XOF";
const fmtS  = n => { const a=Math.abs(n||0); if(a>=1e6)return((n||0)/1e6).toFixed(1)+"M"; if(a>=1e3)return Math.round((n||0)/1e3)+"k"; return String(Math.round(n||0)); };
const pct   = (v,t) => t>0?Math.round(v/t*100):0;
const today = () => new Date().toISOString().slice(0,10);
const stC   = (s,T) => ({"En cours":T.secondary,"En derive":T.danger,"Cloture":T.success,"Planifie":T.warning,"En reception":T.primary,"Brouillon":T.muted})[s]||T.muted;
const catC  = (c,T) => ({"Main d'oeuvre":T.secondary,"Materiaux":T.primary,"Equipement":T.warning,"Transport":T.success,"Sous-traitance":"#A855F7","Divers":T.muted})[c]||T.muted;
const intStC= (s,T) => ({"En cours":T.secondary,"Termine":T.success,"Annule":T.danger,"En attente":T.warning})[s]||T.muted;
const totalDep  = c => (c.depenses||[]).reduce((a,d)=>a+Number(d.montant||0),0);
const totalDepI = i => (i.depenses||[]).reduce((a,d)=>a+Number(d.montant||0),0);

// ── SUPABASE ──────────────────────────────────────────────────────────────────
const SB_URL = "https://mbkwpaxissvvjhewkggl.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ia3dwYXhpc3N2dmpoZXdrZ2dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MjQzOTMsImV4cCI6MjA4NzAwMDM5M30.Zo9aJVDByO8aVSADfSCc2m4jCI1qeXuWYQgVRT-a3LA";
const HDR = {"Content-Type":"application/json",apikey:SB_KEY,Authorization:"Bearer "+SB_KEY};
function sb(table){
  let _f=[],_s="*",_o=null;
  const self={
    select(s){_s=s;return self},
    order(c,o){_o="order="+c+(o&&o.ascending===false?".desc":".asc");return self},
    eq(c,v){_f.push(c+"=eq."+encodeURIComponent(v));return self},
    get(){let u=SB_URL+"/rest/v1/"+table+"?select="+_s;if(_f.length)u+="&"+_f.join("&");if(_o)u+="&"+_o;return fetch(u,{headers:HDR}).then(r=>r.json().then(d=>r.ok?{data:d,error:null}:{data:null,error:d}));},
    insert(p){return fetch(SB_URL+"/rest/v1/"+table,{method:"POST",headers:{...HDR,Prefer:"return=representation"},body:JSON.stringify(p)}).then(r=>r.json().then(d=>r.ok?{data:Array.isArray(d)?d[0]:d,error:null}:{data:null,error:d}));},
    update(p){let u=SB_URL+"/rest/v1/"+table+(_f.length?"?"+_f.join("&"):"");return fetch(u,{method:"PATCH",headers:{...HDR,Prefer:"return=representation"},body:JSON.stringify(p)}).then(r=>r.json().then(d=>r.ok?{data:d,error:null}:{data:null,error:d}));},
    del(){let u=SB_URL+"/rest/v1/"+table+(_f.length?"?"+_f.join("&"):"");return fetch(u,{method:"DELETE",headers:HDR}).then(r=>r.ok?{error:null}:r.json().then(d=>({error:d})));}
  };
  return self;
}

// ── AI CALL ───────────────────────────────────────────────────────────────────
async function aiCall(body){
  for(let i=1;i<=4;i++){
    try{
      const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      if(r.ok)return r.json();
      if((r.status===529||r.status===503)&&i<4){await new Promise(res=>setTimeout(res,i*3000));continue;}
      throw new Error("AI "+r.status);
    }catch(e){if(i<4)await new Promise(res=>setTimeout(res,i*3000));else throw e;}
  }
}

// ── SYSTÈME PROMPT INGÉNIEUR ÉTUDES DE PRIX ───────────────────────────────────
const SYSTEM_DEBOURSE = `Tu es un Ingénieur Études de Prix Senior spécialisé en bâtiment et génie civil en Afrique de l'Ouest (Côte d'Ivoire, contexte FCFA).
Tu maîtrises parfaitement le déboursé sec, les ratios de chantier et les coûts locaux.

MISSION : Analyser les ouvrages fournis et produire un déboursé sec complet, réaliste et exploitable.

BASE DE RATIOS INTERNES (à adapter selon contexte) :
- Béton armé dosé à 350 kg/m³ : ciment 0,35 t/m³, gravier 0,8 m³/m³, sable 0,45 m³/m³, eau 175 L/m³, acier 80-120 kg/m³
- Maçonnerie parpaing 15cm : 12,5 blocs/m², ciment 3 kg/m², sable 5 kg/m², MO 0,3 j/m²
- Enduit ciment : ciment 8 kg/m², sable 20 kg/m², MO 0,15 j/m²
- Carrelage 60x60 : 2,78 carreaux/m², colle 4 kg/m², joint 0,5 kg/m², MO 0,2 j/m²
- Fouille en rigole : MO 0,08 j/m³, engin 0,01 h/m³
- Ferraillage : 15 kg acier HA/m², fil recuit 0,15 kg/m², MO 0,08 j/kg
- Coffrages bois : bois 4 m²/m² coffré, clous 0,5 kg/m², MO 0,25 j/m²
- Peinture intérieure : peinture 0,3 L/m²/couche, MO 0,05 j/m²
- Plomberie sanitaire WC : appareils + robinetterie + tuyauterie PVC, MO 1,5 j/poste
- Electricité prise : câble 5ml, goulotte 5ml, prise 1U, MO 0,3 j/poste

TARIFS MOYENS CÔTE D'IVOIRE (FCFA) :
- Maçon qualifié : 8 000–12 000 FCFA/jour
- Manœuvre : 4 000–6 000 FCFA/jour
- Électricien : 10 000–15 000 FCFA/jour
- Plombier : 10 000–15 000 FCFA/jour
- Ciment CPJ 45 (sac 50 kg) : 6 000–7 000 FCFA
- Parpaing 15cm : 400–500 FCFA/u
- Acier HA 10mm (kg) : 600–700 FCFA/kg
- Carrelage standard 60x60 : 8 000–12 000 FCFA/m²
- Gravier (m³) : 20 000–30 000 FCFA
- Sable (m³) : 10 000–15 000 FCFA

RÈGLES SYSTÉMATIQUES :
- Pertes chantier : +5% sur matériaux
- MO/u = (Salaire journalier moyen équipe) × (rendement en jours/unité)
- DS/u = Mat/u + MO/u + Matériel/u
- Total = Quantité × DS/u
- Toujours préciser l'unité
- Cohérence économique Afrique subsaharienne obligatoire

FORMAT DE RÉPONSE OBLIGATOIRE (JSON strict, aucun texte avant ou après) :
{
  "analyse": "Analyse rapide des ouvrages identifiés",
  "lignes": [
    {
      "designation": "Nom de l'ouvrage",
      "unite": "m²",
      "quantite": 50,
      "mat_u": 12500,
      "mo_u": 3200,
      "materiel_u": 500,
      "ds_u": 16200,
      "total": 810000,
      "detail": "Détail de la décomposition : béton 0.15m³=X, acier=Y..."
    }
  ],
  "notes": "Hypothèses et remarques importantes",
  "total_global": 1250000
}

Si des informations manquent (quantités, type de béton, finitions...), pose les questions AVANT de calculer. Dans ce cas réponds :
{ "questions": ["Question 1 ?", "Question 2 ?"] }`;

// ── HOOKS ─────────────────────────────────────────────────────────────────────
function useChantiers(){
  const [data,setData]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null);
  const load=useCallback(()=>{
    setLoading(true);setError(null);
    Promise.all([sb("chantiers").order("created_at",{ascending:false}).get(),sb("depenses").order("date",{ascending:false}).get()])
      .then(([rc,rd])=>{
        if(rc.error)throw new Error(JSON.stringify(rc.error));
        const ch=rc.data||[],dep=rd.data||[];
        setData(ch.map(c=>({...c,budgetInitial:Number(c.budget_initial||0),depenses:dep.filter(d=>d.chantier_id===c.id).map(d=>({...d,montant:Number(d.montant||0)}))})));
        setLoading(false);
      }).catch(e=>{setError(e.message);setLoading(false);});
  },[]);
  useEffect(()=>{load();},[]);
  return {data,loading,error,reload:load};
}
function useInterventions(){
  const [data,setData]=useState([]);
  const load=useCallback(()=>{
    Promise.all([sb("interventions").order("created_at",{ascending:false}).get(),sb("intervention_depenses").order("date",{ascending:false}).get()])
      .then(([ri,rd])=>{
        const intv=ri.data||[],idep=rd.data||[];
        setData(intv.map(i=>({...i,depenses:idep.filter(d=>String(d.intervention_id)===String(i.id)).map(d=>({...d,montant:Number(d.montant||0)}))})));
      }).catch(()=>{});
  },[]);
  useEffect(()=>{load();},[]);
  return {data,reload:load};
}
function useDebourse(){
  const [sessions,setSessions]=useState([]);
  const [taches,setTaches]=useState([]);
  const load=useCallback(()=>{
    Promise.all([sb("debourse_sessions").order("created_at",{ascending:false}).get(),sb("debourse_taches").order("ordre").get()])
      .then(([rs,rt])=>{setSessions(rs.data||[]);setTaches(rt.data||[]);})
      .catch(()=>{});
  },[]);
  useEffect(()=>{load();},[]);
  return {sessions,taches,reload:load};
}

// ── UI ATOMS ──────────────────────────────────────────────────────────────────
function Badge({label,color,small}){return <span style={{background:color+"22",color,border:"1px solid "+color+"55",borderRadius:6,padding:small?"2px 7px":"3px 10px",fontSize:small?10:11,fontWeight:600,whiteSpace:"nowrap"}}>{label}</span>;}
function PBar({p,color,h=8}){return <div style={{background:"#57534E",borderRadius:99,height:h,overflow:"hidden"}}><div style={{width:Math.min(p,100)+"%",background:color,height:"100%",borderRadius:99,transition:"width .4s"}}/></div>;}
function Empty({icon,msg}){return <div style={{textAlign:"center",padding:"40px 20px",color:"#A8A29E"}}><div style={{fontSize:36,marginBottom:10}}>{icon}</div><div style={{fontSize:13}}>{msg}</div></div>;}
function Spin({label}){return <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10,padding:"30px 20px"}}><div style={{width:30,height:30,border:"3px solid #57534E",borderTopColor:"#F97316",borderRadius:"50%",animation:"spin 1s linear infinite"}}/>{label&&<div style={{fontSize:12,color:"#A8A29E"}}>{label}</div>}<style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style></div>;}
function Kpi({icon,label,value,color,T,compact}){return <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:10,padding:compact?"10px 12px":"16px 20px",flex:1,minWidth:0}}><div style={{fontSize:compact?14:20,marginBottom:2}}>{icon}</div><div style={{fontSize:compact?13:20,fontWeight:700,color:color||T.white,lineHeight:1.2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{value}</div><div style={{fontSize:compact?9:11,color:T.muted,marginTop:2}}>{label}</div></div>;}
function Card({T,title,action,children}){return <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:T.borderRadius,padding:"14px 16px"}}>{title&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:6}}><div style={{fontWeight:700,fontSize:13}}>{title}</div>{action}</div>}{children}</div>;}
function Modal({T,title,onClose,onSave,saveLabel,children,wide}){
  return <div style={{position:"fixed",inset:0,background:"#00000099",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
    <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:"20px 20px 0 0",padding:"20px 16px",width:"100%",maxWidth:wide?1100:900,maxHeight:"94vh",overflow:"auto"}}>
      <div style={{width:40,height:4,background:T.border,borderRadius:99,margin:"0 auto 16px"}}/>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}>
        <div style={{fontWeight:800,fontSize:15}}>{title}</div>
        <button onClick={onClose} style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:20}}>✕</button>
      </div>
      {children}
      {onSave&&<div style={{display:"flex",gap:10,marginTop:16,justifyContent:"flex-end"}}>
        <button onClick={onClose} style={{padding:"9px 18px",background:T.mid,color:T.white,border:"none",borderRadius:8,cursor:"pointer"}}>Annuler</button>
        <button onClick={onSave} style={{padding:"9px 18px",background:T.primary,color:"#fff",border:"none",borderRadius:8,fontWeight:700,cursor:"pointer"}}>{saveLabel||"Enregistrer"}</button>
      </div>}
    </div>
  </div>;
}
function FF({T,label,value,onChange,type,placeholder,rows,full}){
  const s={width:"100%",background:T.mid,border:"1px solid "+T.border,borderRadius:7,padding:"8px 10px",color:T.white,fontSize:13,boxSizing:"border-box",outline:"none"};
  return <div style={full?{gridColumn:"1/-1"}:{}}>
    {label&&<label style={{fontSize:10,color:T.muted,display:"block",marginBottom:3}}>{label}</label>}
    {rows?<textarea value={value||""} onChange={e=>onChange(e.target.value)} rows={rows} style={s} placeholder={placeholder}/>:<input type={type||"text"} value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={s}/>}
  </div>;
}
function FS({T,label,value,onChange,options,full}){
  return <div style={full?{gridColumn:"1/-1"}:{}}>
    {label&&<label style={{fontSize:10,color:T.muted,display:"block",marginBottom:3}}>{label}</label>}
    <select value={value||""} onChange={e=>onChange(e.target.value)} style={{width:"100%",background:T.mid,border:"1px solid "+T.border,borderRadius:7,padding:"8px 10px",color:T.white,fontSize:13,boxSizing:"border-box",outline:"none"}}>
      {options.map(o=>Array.isArray(o)?<option key={o[0]} value={o[0]}>{o[1]}</option>:<option key={o} value={o}>{o}</option>)}
    </select>
  </div>;
}
function FG({cols=2,children}){return <div style={{display:"grid",gridTemplateColumns:`repeat(${cols},1fr)`,gap:10}}>{children}</div>;}
function newDepLine(){return {id:Date.now()+Math.random(),libelle:"",categorie:"Main d'oeuvre",montant:"",date:today(),note:""};}

// ══════════════════════════════════════════════════════════════════════════════
// APP ROOT
// ══════════════════════════════════════════════════════════════════════════════
export default function App(){
  const [T]=useState(DT);
  const {data:ch,loading,error,reload:reloadCh}=useChantiers();
  const {data:intv,reload:reloadIntv}=useInterventions();
  const {sessions,taches,reload:reloadDb}=useDebourse();
  const [page,setPage]=useState("dashboard");
  const [selId,setSelId]=useState(null);
  const [drawerOpen,setDrawerOpen]=useState(false);
  const [isMobile,setIsMobile]=useState(window.innerWidth<768);
  useEffect(()=>{const fn=()=>setIsMobile(window.innerWidth<768);window.addEventListener("resize",fn);return()=>window.removeEventListener("resize",fn);},[]);
  function navTo(p){setPage(p);setDrawerOpen(false);}
  function openCh(id){setSelId(id);setPage("fiche");setDrawerOpen(false);}
  function reloadAll(){reloadCh();reloadIntv();reloadDb();}
  const nbInt=intv.filter(i=>i.statut==="En cours").length;
  const nav=[
    {key:"dashboard",icon:"📊",label:"Dashboard"},
    {key:"chantiers",icon:"🏗️",label:"Chantiers"},
    {key:"debourse",icon:"🔢",label:"Débours Sec"},
    {key:"ia_debourse",icon:"🤖",label:"IA Débours",highlight:true},
    {key:"interventions",icon:"🔧",label:"Interventions",badge:nbInt},
    {key:"kpi",icon:"📈",label:"KPIs"},
  ];
  const selected=ch.find(c=>c.id===selId);
  function NavBtn({n}){
    const active=page===n.key||(page==="fiche"&&n.key==="chantiers");
    return <button onClick={()=>navTo(n.key)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px",borderRadius:8,border:"none",background:active?T.primary+"22":n.highlight&&!active?"#A855F711":"transparent",color:active?T.primary:n.highlight?"#A855F7":T.muted,cursor:"pointer",marginBottom:2,position:"relative",fontFamily:T.fontFamily}}>
      <span style={{fontSize:18}}>{n.icon}</span>
      <span style={{fontSize:13,fontWeight:active?700:400,flex:1}}>{n.label}</span>
      {n.highlight&&!active&&<span style={{background:"#A855F7",color:"#fff",borderRadius:4,fontSize:8,padding:"1px 5px",fontWeight:700}}>IA</span>}
      {n.badge>0&&<span style={{background:T.danger,color:"#fff",borderRadius:99,fontSize:9,padding:"1px 5px",fontWeight:700}}>{n.badge}</span>}
    </button>;
  }
  return (
    <div style={{display:"flex",height:"100vh",background:T.bg,color:T.white,fontFamily:T.fontFamily,overflow:"hidden"}}>
      <style>{"*{box-sizing:border-box;}input,select,textarea{font-family:inherit;}"}</style>
      {!isMobile&&<div style={{width:220,background:T.card,borderRight:"1px solid "+T.border,display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{padding:"16px 12px 14px",borderBottom:"1px solid "+T.border,display:"flex",alignItems:"center",gap:10}}>
          <div style={{background:T.primary,borderRadius:10,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🏗</div>
          <div style={{fontWeight:700,fontSize:12}}>{T.companyName}</div>
        </div>
        <nav style={{flex:1,padding:"10px 8px",overflowY:"auto"}}>{nav.map(n=><NavBtn key={n.key} n={n}/>)}</nav>
        <div style={{padding:8,borderTop:"1px solid "+T.border}}><button onClick={reloadAll} style={{width:"100%",background:T.secondary+"22",border:"1px solid "+T.secondary+"44",color:T.secondary,borderRadius:8,padding:8,fontSize:11,fontWeight:700,cursor:"pointer"}}>↺ Sync</button></div>
      </div>}
      <div style={{flex:1,overflow:"auto",display:"flex",flexDirection:"column",paddingBottom:isMobile?64:0}}>
        <div style={{background:T.card,borderBottom:"1px solid "+T.border,padding:isMobile?"10px 14px":"10px 22px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,position:"sticky",top:0,zIndex:50}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {isMobile&&<button onClick={()=>setDrawerOpen(true)} style={{background:"none",border:"none",color:T.muted,fontSize:22,cursor:"pointer"}}>☰</button>}
            <div style={{fontSize:isMobile?14:15,fontWeight:700}}>{page==="fiche"&&selected?"🏗️ "+selected.nom:(nav.find(n=>n.key===page)||{label:""}).label}</div>
          </div>
          <button onClick={reloadAll} style={{background:T.secondary+"22",border:"1px solid "+T.secondary+"44",color:T.secondary,borderRadius:8,padding:"5px 10px",fontSize:12,cursor:"pointer",fontWeight:600}}>↺</button>
        </div>
        <div style={{flex:1,overflow:"auto",padding:isMobile?"10px":"20px"}}>
          {error?<div style={{background:T.danger+"11",border:"1px solid "+T.danger+"44",borderRadius:12,padding:20,textAlign:"center"}}><div style={{color:T.danger,fontWeight:700,marginBottom:8}}>Erreur connexion</div><div style={{color:T.muted,fontSize:12,marginBottom:12}}>{error}</div><button onClick={reloadAll} style={{background:T.primary,color:"#fff",border:"none",borderRadius:8,padding:"9px 20px",fontWeight:700,cursor:"pointer"}}>Réessayer</button></div>:<>
            {page==="dashboard"&&<Dashboard ch={ch} intv={intv} openCh={openCh} T={T} isMobile={isMobile} navTo={navTo}/>}
            {page==="chantiers"&&<Chantiers ch={ch} openCh={openCh} reload={reloadCh} T={T} isMobile={isMobile}/>}
            {page==="fiche"&&selected&&<Fiche chantier={selected} setPage={setPage} reload={reloadCh} T={T} isMobile={isMobile}/>}
            {page==="debourse"&&<Debourse sessions={sessions} taches={taches} ch={ch} reload={reloadDb} T={T} isMobile={isMobile}/>}
            {page==="ia_debourse"&&<IADebourse ch={ch} sessions={sessions} reload={reloadDb} T={T} isMobile={isMobile}/>}
            {page==="interventions"&&<Interventions intv={intv} ch={ch} reload={reloadIntv} T={T} isMobile={isMobile}/>}
            {page==="kpi"&&<KpiPage ch={ch} intv={intv} T={T} isMobile={isMobile}/>}
          </>}
        </div>
      </div>
      {isMobile&&<div style={{position:"fixed",bottom:0,left:0,right:0,background:T.card,borderTop:"1px solid "+T.border,display:"flex",justifyContent:"space-around",padding:"5px 0",zIndex:100}}>
        {nav.slice(0,5).map(n=>{const active=page===n.key;return <button key={n.key} onClick={()=>navTo(n.key)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1,background:"none",border:"none",color:active?T.primary:n.highlight?"#A855F7":T.muted,cursor:"pointer",padding:"3px 4px",position:"relative",minWidth:44}}><span style={{fontSize:19}}>{n.icon}</span><span style={{fontSize:8,fontWeight:active?700:400}}>{n.label}</span>{n.badge>0&&<span style={{position:"absolute",top:0,right:0,background:T.danger,color:"#fff",borderRadius:99,fontSize:8,padding:"1px 4px"}}>{n.badge}</span>}</button>;})}
        <button onClick={()=>setDrawerOpen(true)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1,background:"none",border:"none",color:T.muted,cursor:"pointer",padding:"3px 4px",minWidth:44}}><span style={{fontSize:19}}>☰</span><span style={{fontSize:8}}>Plus</span></button>
      </div>}
      {isMobile&&drawerOpen&&<>
        <div onClick={()=>setDrawerOpen(false)} style={{position:"fixed",inset:0,background:"#0007",zIndex:150}}/>
        <div style={{position:"fixed",left:0,top:0,bottom:0,width:270,background:T.card,borderRight:"1px solid "+T.border,zIndex:151,padding:"48px 12px 12px",overflowY:"auto"}}>
          <button onClick={()=>setDrawerOpen(false)} style={{position:"absolute",top:14,right:14,background:"none",border:"none",color:T.muted,fontSize:22,cursor:"pointer"}}>✕</button>
          <div style={{padding:"0 8px 14px",marginBottom:8,borderBottom:"1px solid "+T.border}}><div style={{fontWeight:700,fontSize:15}}>{T.companyName}</div></div>
          {nav.map(n=><NavBtn key={n.key} n={n}/>)}
        </div>
      </>}
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function Dashboard({ch,intv,openCh,T,isMobile,navTo}){
  const totalB=ch.reduce((a,c)=>a+c.budgetInitial,0);
  const totalD=ch.reduce((a,c)=>a+totalDep(c),0);
  const pc=pct(totalD,totalB);
  const pieData=[{name:"En cours",value:ch.filter(c=>c.statut==="En cours").length,color:T.secondary},{name:"En dérive",value:ch.filter(c=>c.statut==="En derive").length,color:T.danger},{name:"Planifié",value:ch.filter(c=>c.statut==="Planifie").length,color:T.warning},{name:"Clôturé",value:ch.filter(c=>c.statut==="Cloture").length,color:T.success}].filter(d=>d.value>0);
  const actifs=ch.filter(c=>c.statut!=="Cloture"&&c.statut!=="Brouillon");
  return <div style={{display:"flex",flexDirection:"column",gap:14}}>
    <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:8}}>
      <Kpi icon="🏗️" label="Chantiers" value={ch.length} color={T.primary} compact T={T}/>
      <Kpi icon="💰" label="Budget total" value={fmtS(totalB)} compact T={T}/>
      <Kpi icon="📊" label="Consommé" value={pc+"%"} color={pc>80?T.danger:T.success} compact T={T}/>
      <Kpi icon="🔧" label="Interv. actives" value={intv.filter(i=>i.statut==="En cours").length} color={T.secondary} compact T={T}/>
    </div>
    {/* Bandeau IA */}
    <div onClick={()=>navTo("ia_debourse")} style={{background:"linear-gradient(135deg,#A855F722,#7C3AED22)",border:"1px solid #A855F755",borderRadius:T.borderRadius,padding:"14px 18px",cursor:"pointer",display:"flex",alignItems:"center",gap:14}}>
      <div style={{fontSize:32}}>🤖</div>
      <div style={{flex:1}}>
        <div style={{fontWeight:800,fontSize:14,color:"#C084FC"}}>IA Débours Sec — Ingénieur Études de Prix</div>
        <div style={{fontSize:11,color:T.muted,marginTop:2}}>Décrivez vos ouvrages → l'IA décompose matériaux, MO, matériel et calcule le déboursé sec en contexte Côte d'Ivoire</div>
      </div>
      <div style={{color:"#A855F7",fontSize:20}}>→</div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14}}>
      <Card title="Statuts chantiers" T={T}>{pieData.length>0?<ResponsiveContainer width="100%" height={160}><PieChart><Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={60} label={e=>e.name+" ("+e.value+")"}>{pieData.map((d,i)=><Cell key={i} fill={d.color}/>)}</Pie><Tooltip contentStyle={{background:T.card,border:"1px solid "+T.border,color:T.white}}/></PieChart></ResponsiveContainer>:<Empty msg="Aucun chantier" icon="🏗️"/>}</Card>
      <Card title="Chantiers actifs" T={T}>{actifs.slice(0,5).map(c=>{const d=totalDep(c),pp=pct(d,c.budgetInitial);return <div key={c.id} onClick={()=>openCh(c.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid "+T.border,cursor:"pointer"}}><div style={{flex:2}}><div style={{fontWeight:600,fontSize:13}}>{c.nom}</div><div style={{fontSize:11,color:T.muted}}>{c.client}</div></div><div style={{flex:1}}><PBar p={pp} color={pp>100?T.danger:pp>80?T.warning:T.success} h={6}/><div style={{fontSize:10,color:T.muted,textAlign:"right",marginTop:2}}>{pp}%</div></div></div>;})} {actifs.length===0&&<Empty msg="Aucun chantier actif" icon="🏗️"/>}</Card>
    </div>
  </div>;
}

// ══════════════════════════════════════════════════════════════════════════════
// 🤖 IA DÉBOURS SEC — MODULE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
function IADebourse({ch,sessions,reload,T,isMobile}){
  const [step,setStep]=useState("input"); // input | questions | result | saving
  const [input,setInput]=useState("");
  const [chantierLie,setChantierLie]=useState("");
  const [sessionNom,setSessionNom]=useState("");
  const [cfg,setCfg]=useState({tc:40,fg:15,benef:10});
  const [loading,setLoading]=useState(false);
  const [questions,setQuestions]=useState([]);
  const [answers,setAnswers]=useState({});
  const [result,setResult]=useState(null);
  const [history,setHistory]=useState([]);// conversation
  const [saving,setSaving]=useState(false);
  const [savedId,setSavedId]=useState(null);

  const exemples=[
    "Mur en parpaing 15cm, 120 m², enduit 2 faces",
    "Dalle pleine BA 0.15m épaisseur, 80 m²",
    "Fouille en rigole pour fondations filantes 60x80cm, 45 ml",
    "Carrelage grès cérame 60x60 en pose collée, 200 m²",
    "Installation électrique : 15 prises, 8 interrupteurs, tableau 12 disjoncteurs",
    "Enduit ciment intérieur et extérieur sur 300 m²",
  ];

  async function analyser(userMsg,hist){
    setLoading(true);
    const msgs=[...hist,{role:"user",content:userMsg}];
    try{
      const r=await aiCall({model:"claude-sonnet-4-20250514",max_tokens:3000,system:SYSTEM_DEBOURSE,messages:msgs});
      const txt=(r.content||[]).map(b=>b.text||"").join("");
      // Nettoyage JSON
      const clean=txt.replace(/```json|```/g,"").trim();
      let parsed=null;
      try{parsed=JSON.parse(clean);}catch(e){
        const m=clean.match(/\{[\s\S]*\}/);
        if(m){try{parsed=JSON.parse(m[0]);}catch(e2){}}
      }
      const newHist=[...msgs,{role:"assistant",content:txt}];
      setHistory(newHist);
      if(parsed?.questions){
        setQuestions(parsed.questions);
        setAnswers({});
        setStep("questions");
      } else if(parsed?.lignes){
        setResult(parsed);
        setStep("result");
      } else {
        // Réponse texte libre
        setResult({analyse:txt,lignes:[],notes:"",total_global:0,_freeText:true});
        setStep("result");
      }
    }catch(e){alert("Erreur IA: "+e.message);}
    setLoading(false);
  }

  function lancerAnalyse(){
    if(!input.trim())return;
    setHistory([]);setResult(null);setQuestions([]);
    const prompt=`Voici les ouvrages à analyser :\n\n${input}\n\nProduis le déboursé sec complet.`;
    analyser(prompt,[]);
  }

  function envoyerReponses(){
    const txt=questions.map((q,i)=>`${q} → ${answers[i]||"Non précisé"}`).join("\n");
    analyser("Voici mes réponses :\n"+txt,history);
  }

  async function sauvegarderEnDebourse(){
    if(!result?.lignes?.length)return;
    setSaving(true);
    const nom=sessionNom||("IA — "+new Date().toLocaleDateString("fr-FR"));
    const {data:sess}=await sb("debourse_sessions").insert({nom,chantier_id:chantierLie||null,taux_charges:cfg.tc,coeff_fg:cfg.fg,coeff_benef:cfg.benef});
    if(!sess){setSaving(false);return;}
    // Créer catégorie "Ouvrages" niveau 1
    const {data:cat}=await sb("debourse_taches").insert({session_id:sess.id,libelle:"Ouvrages IA",niveau:1,ordre:0,prix_vente_total:Math.round(result.total_global||0)});
    for(let i=0;i<result.lignes.length;i++){
      const l=result.lignes[i];
      const tc=cfg.tc/100,fg=cfg.fg/100,b=cfg.benef/100;
      const ds=l.ds_u||0;
      const pv=ds*(1+fg)*(1+b);
      const pvt=pv*(l.quantite||0);
      await sb("debourse_taches").insert({session_id:sess.id,parent_id:cat?.id||null,libelle:l.designation,niveau:3,ordre:i+1,unite:l.unite||"U",quantite:l.quantite||0,mo_u:Math.round(l.mo_u||0),mat_u:Math.round(l.mat_u||0),autres_u:Math.round(l.materiel_u||0),debourse_sec_u:Math.round(ds),prix_vente_u:Math.round(pv),prix_vente_total:Math.round(pvt)});
    }
    setSaving(false);setSavedId(sess.id);reload();
  }

  const upCfg=(k,v)=>setCfg(p=>({...p,[k]:v}));

  return <div style={{display:"flex",flexDirection:"column",gap:16}}>
    {/* En-tête */}
    <div style={{background:"linear-gradient(135deg,#1e1b4b,#312e81,#1e1b4b)",border:"1px solid #4f46e5",borderRadius:T.borderRadius,padding:"18px 20px"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
        <div style={{fontSize:28}}>🤖</div>
        <div><div style={{fontWeight:800,fontSize:16,color:"#a5b4fc"}}>Ingénieur IA — Études de Prix BTP</div><div style={{fontSize:11,color:"#6366f1"}}>Spécialisé Afrique de l'Ouest · Contexte FCFA Côte d'Ivoire</div></div>
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {["🏗 Analyse ouvrages","📐 Ratios techniques","💰 Prix FCFA locaux","📊 Tableau déboursé"].map(t=><span key={t} style={{background:"#4f46e522",color:"#a5b4fc",border:"1px solid #4f46e544",borderRadius:20,padding:"3px 10px",fontSize:10,fontWeight:600}}>{t}</span>)}
      </div>
    </div>

    {step==="input"&&<>
      {/* Config coefficients */}
      <Card title="⚙️ Coefficients de calcul" T={T}>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)",gap:10}}>
          {[["Charges sociales (%)","tc",cfg.tc],["Frais généraux (%)","fg",cfg.fg],["Bénéfice (%)","benef",cfg.benef]].map(([lbl,k,v])=><div key={k}><label style={{fontSize:10,color:T.muted,display:"block",marginBottom:3}}>{lbl}</label><input type="number" value={v} onChange={e=>upCfg(k,parseFloat(e.target.value)||0)} style={{width:"100%",background:T.mid,border:"1px solid "+T.border,borderRadius:6,padding:"7px 8px",color:T.white,fontSize:13,outline:"none"}}/></div>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:10,marginTop:10}}>
          <div>
            <label style={{fontSize:10,color:T.muted,display:"block",marginBottom:3}}>Chantier lié (optionnel)</label>
            <select value={chantierLie} onChange={e=>setChantierLie(e.target.value)} style={{width:"100%",background:T.mid,border:"1px solid "+T.border,borderRadius:6,padding:"7px 8px",color:T.white,fontSize:13,outline:"none"}}>
              <option value="">— Aucun —</option>
              {ch.map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>
          <FF T={T} label="Nom du projet débours (optionnel)" value={sessionNom} onChange={setSessionNom} placeholder="ex: Villa 2 pièces — Fondations"/>
        </div>
      </Card>
      {/* Zone de saisie */}
      <Card title="📋 Décrivez vos ouvrages" T={T}>
        <div style={{fontSize:11,color:T.muted,marginBottom:8}}>Listez vos postes avec quantités et unités. Plus vous êtes précis, meilleur sera le calcul.</div>
        <textarea value={input} onChange={e=>setInput(e.target.value)} rows={8} placeholder={"Exemple :\n- Mur parpaing 15cm : 120 m²\n- Dalle BA 0.15m : 80 m²\n- Fouille rigole 60x80 : 45 ml\n- Enduit ciment 2 faces : 200 m²"} style={{width:"100%",background:T.mid,border:"1px solid "+T.border,borderRadius:8,padding:"12px",color:T.white,fontSize:13,outline:"none",resize:"vertical",lineHeight:1.6}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:12,flexWrap:"wrap",gap:8}}>
          <div style={{fontSize:10,color:T.muted}}>{input.length} caractères</div>
          <button onClick={lancerAnalyse} disabled={!input.trim()||loading} style={{background:"linear-gradient(135deg,#7C3AED,#A855F7)",color:"#fff",border:"none",borderRadius:9,padding:"11px 24px",fontWeight:800,cursor:input.trim()?"pointer":"not-allowed",fontSize:14,opacity:input.trim()?1:0.5,letterSpacing:"0.3px"}}>
            🤖 Calculer le déboursé sec
          </button>
        </div>
      </Card>
      {/* Exemples */}
      <Card title="💡 Exemples rapides" T={T}>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {exemples.map(e=><button key={e} onClick={()=>setInput(prev=>prev+(prev?"\n":"")+e)} style={{background:T.mid,color:T.muted,border:"1px solid "+T.border,borderRadius:20,padding:"5px 12px",fontSize:11,cursor:"pointer",textAlign:"left"}}>{e}</button>)}
        </div>
      </Card>
    </>}

    {loading&&<div style={{background:T.card,border:"1px solid #4f46e5",borderRadius:T.borderRadius,padding:30}}><Spin label="L'ingénieur IA analyse vos ouvrages et calcule les ratios..."/></div>}

    {step==="questions"&&!loading&&<Card title="❓ L'IA a besoin de précisions" T={T}>
      <div style={{fontSize:12,color:T.muted,marginBottom:14}}>Pour un calcul précis, répondez à ces questions :</div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {questions.map((q,i)=><div key={i}>
          <div style={{fontSize:13,fontWeight:600,marginBottom:5,color:T.white}}>• {q}</div>
          <textarea value={answers[i]||""} onChange={e=>setAnswers(p=>({...p,[i]:e.target.value}))} rows={2} placeholder="Votre réponse..." style={{width:"100%",background:T.mid,border:"1px solid "+T.border,borderRadius:6,padding:"8px",color:T.white,fontSize:12,outline:"none",resize:"none"}}/>
        </div>)}
      </div>
      <div style={{display:"flex",gap:10,marginTop:14,justifyContent:"flex-end"}}>
        <button onClick={()=>{setStep("input");setHistory([]);}} style={{padding:"9px 18px",background:T.mid,color:T.white,border:"none",borderRadius:8,cursor:"pointer"}}>← Recommencer</button>
        <button onClick={envoyerReponses} style={{padding:"9px 20px",background:"linear-gradient(135deg,#7C3AED,#A855F7)",color:"#fff",border:"none",borderRadius:8,fontWeight:700,cursor:"pointer"}}>Calculer maintenant →</button>
      </div>
    </Card>}

    {step==="result"&&result&&!loading&&<>
      {result._freeText?<Card title="📄 Réponse de l'IA" T={T}><div style={{fontSize:13,lineHeight:1.8,whiteSpace:"pre-wrap",color:T.white}}>{result.analyse}</div><button onClick={()=>{setStep("input");}} style={{marginTop:12,background:T.mid,color:T.white,border:"none",borderRadius:8,padding:"8px 16px",cursor:"pointer"}}>← Nouveau calcul</button></Card>:
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        {/* Résumé */}
        <div style={{background:"linear-gradient(135deg,#14532d22,#15803d22)",border:"1px solid #16a34a55",borderRadius:T.borderRadius,padding:"14px 16px"}}>
          <div style={{fontWeight:700,color:"#4ade80",marginBottom:6,fontSize:13}}>✅ Analyse terminée</div>
          <div style={{fontSize:12,color:T.white,lineHeight:1.6}}>{result.analyse}</div>
        </div>
        {/* KPIs */}
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:8}}>
          <Kpi icon="📦" label="Postes calculés" value={result.lignes.length} color="#C084FC" T={T} compact/>
          <Kpi icon="💰" label="Total DS" value={fmtS(result.total_global)} color={T.warning} T={T} compact/>
          <Kpi icon="📈" label="PV estimé" value={fmtS(result.total_global*(1+cfg.fg/100)*(1+cfg.benef/100))} color={T.success} T={T} compact/>
          <Kpi icon="💹" label="Marge brute" value={Math.round(cfg.benef)+"%"} color={T.primary} T={T} compact/>
        </div>
        {/* Tableau résultat */}
        <Card title="📊 Tableau déboursé sec" T={T}>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:700}}>
              <thead><tr style={{background:"linear-gradient(135deg,#7C3AED,#A855F7)"}}>
                {["Désignation","Qté","U","Mat/u","MO/u","Matériel/u","DS/u","Total DS"].map((h,i)=><th key={i} style={{padding:"9px 8px",textAlign:i>2?"right":"left",color:"#fff",fontSize:10,fontWeight:700,whiteSpace:"nowrap"}}>{h}</th>)}
              </tr></thead>
              <tbody>{result.lignes.map((l,i)=><tr key={i} style={{background:i%2===0?"transparent":T.mid+"55",borderBottom:"1px solid "+T.border+"33"}}>
                <td style={{padding:"8px 8px"}}>
                  <div style={{fontWeight:600}}>{l.designation}</div>
                  {l.detail&&<div style={{fontSize:9,color:T.muted,marginTop:2}}>{l.detail}</div>}
                </td>
                <td style={{padding:"8px 8px",textAlign:"right"}}>{l.quantite}</td>
                <td style={{padding:"8px 8px",color:T.muted}}>{l.unite}</td>
                <td style={{padding:"8px 8px",textAlign:"right",color:T.primary}}>{fmtS(l.mat_u)}</td>
                <td style={{padding:"8px 8px",textAlign:"right",color:T.secondary}}>{fmtS(l.mo_u)}</td>
                <td style={{padding:"8px 8px",textAlign:"right",color:T.warning}}>{fmtS(l.materiel_u)}</td>
                <td style={{padding:"8px 8px",textAlign:"right",fontWeight:700,color:T.white}}>{fmtS(l.ds_u)}</td>
                <td style={{padding:"8px 8px",textAlign:"right",fontWeight:800,color:T.success}}>{fmtS(l.total)}</td>
              </tr>)}
              <tr style={{background:"#A855F722",borderTop:"2px solid #A855F7"}}>
                <td colSpan={6} style={{padding:"10px 8px",fontWeight:800,color:"#C084FC",fontSize:12}}>TOTAL DÉBOURSÉ SEC</td>
                <td colSpan={2} style={{padding:"10px 8px",textAlign:"right",fontWeight:900,color:T.success,fontSize:14}}>{fmt(result.total_global)}</td>
              </tr>
              </tbody>
            </table>
          </div>
          {result.notes&&<div style={{marginTop:10,padding:"10px 12px",background:T.warning+"11",border:"1px solid "+T.warning+"33",borderRadius:7,fontSize:11,color:T.muted}}><span style={{fontWeight:700,color:T.warning}}>⚠️ Notes : </span>{result.notes}</div>}
        </Card>
        {/* Récap MO / Mat / Matériel */}
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)",gap:10}}>
          {[["🧱 Matériaux",result.lignes.reduce((a,l)=>a+(l.mat_u||0)*(l.quantite||0),0),T.primary],["👷 Main d'oeuvre",result.lignes.reduce((a,l)=>a+(l.mo_u||0)*(l.quantite||0),0),T.secondary],["⚙️ Matériel",result.lignes.reduce((a,l)=>a+(l.materiel_u||0)*(l.quantite||0),0),T.warning]].map(([lbl,val,col])=>{
            const pct2=result.total_global>0?Math.round(val/result.total_global*100):0;
            return <div key={lbl} style={{background:col+"11",border:"1px solid "+col+"33",borderRadius:9,padding:"12px 14px"}}>
              <div style={{fontSize:11,color:T.muted}}>{lbl}</div>
              <div style={{fontWeight:800,color:col,fontSize:16,margin:"4px 0"}}>{fmtS(val)}</div>
              <PBar p={pct2} color={col} h={5}/>
              <div style={{fontSize:10,color:T.muted,marginTop:3}}>{pct2}% du déboursé</div>
            </div>;
          })}
        </div>
        {/* Actions */}
        <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"space-between",alignItems:"center"}}>
          <button onClick={()=>{setStep("input");setResult(null);setHistory([]);}} style={{background:T.mid,color:T.white,border:"none",borderRadius:8,padding:"9px 16px",cursor:"pointer",fontSize:12}}>← Nouveau calcul</button>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {savedId?<div style={{background:T.success+"22",color:T.success,border:"1px solid "+T.success+"44",borderRadius:8,padding:"9px 16px",fontSize:12,fontWeight:700}}>✅ Sauvegardé dans Débours Sec</div>:
            <button onClick={sauvegarderEnDebourse} disabled={saving} style={{background:"linear-gradient(135deg,#7C3AED,#A855F7)",color:"#fff",border:"none",borderRadius:8,padding:"9px 18px",fontWeight:700,cursor:"pointer",fontSize:12,opacity:saving?0.7:1}}>
              {saving?"⏳ Sauvegarde...":"💾 Importer dans Débours Sec"}
            </button>}
            <button onClick={()=>{
              const rows=result.lignes.map(l=>({Désignation:l.designation,Quantité:l.quantite,Unité:l.unite,"Mat/u":l.mat_u,"MO/u":l.mo_u,"Matériel/u":l.materiel_u,"DS/u":l.ds_u,"Total DS":l.total}));
              const h=Object.keys(rows[0]).join(";");const b=rows.map(r=>Object.values(r).join(";")).join("\n");
              const bl=new Blob(["\uFEFF"+h+"\n"+b],{type:"text/csv;charset=utf-8;"});const a=document.createElement("a");a.href=URL.createObjectURL(bl);a.download="debourse_sec_ia.csv";a.click();
            }} style={{background:T.success+"22",color:T.success,border:"1px solid "+T.success+"44",borderRadius:8,padding:"9px 16px",fontWeight:700,cursor:"pointer",fontSize:12}}>
              📥 Export CSV
            </button>
          </div>
        </div>
      </div>}
    </>}
  </div>;
}

// ── CHANTIERS ─────────────────────────────────────────────────────────────────
function Chantiers({ch,openCh,reload,T,isMobile}){
  const [filter,setFilter]=useState("Tous");
  const [showNew,setShowNew]=useState(false);
  const [saving,setSaving]=useState(false);
  const [form,setForm]=useState({nom:"",client:"",localisation:"",type:"Construction",budget_initial:"",date_debut:"",date_fin:""});
  const up=(k,v)=>setForm(p=>({...p,[k]:v}));
  function save(){if(!form.nom||!form.budget_initial)return;setSaving(true);sb("chantiers").insert({...form,budget_initial:parseFloat(form.budget_initial),date_debut:form.date_debut||null,date_fin:form.date_fin||null,statut:"Brouillon"}).then(()=>{setSaving(false);setShowNew(false);reload();});}
  function del(id){if(!window.confirm("Supprimer ?"))return;sb("chantiers").eq("id",id).del().then(()=>reload());}
  const filtered=filter==="Tous"?ch:ch.filter(c=>c.statut===filter);
  return <div style={{display:"flex",flexDirection:"column",gap:14}}>
    <div style={{display:"flex",gap:6,justifyContent:"space-between",flexWrap:"wrap",alignItems:"center"}}>
      <div style={{display:"flex",gap:4,overflowX:"auto"}}>{["Tous",...STATUTS].map(s=><button key={s} onClick={()=>setFilter(s)} style={{padding:"5px 10px",borderRadius:20,border:"1px solid "+(filter===s?T.primary:T.border),background:filter===s?T.primary:"transparent",color:filter===s?"#fff":T.muted,cursor:"pointer",fontSize:11,whiteSpace:"nowrap",flexShrink:0}}>{s}</button>)}</div>
      <button onClick={()=>setShowNew(true)} style={{background:T.primary,color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",fontWeight:700,cursor:"pointer",fontSize:12}}>+ Nouveau</button>
    </div>
    <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
      {filtered.map(c=>{const d=totalDep(c),pp=pct(d,c.budgetInitial);return <div key={c.id} onClick={()=>openCh(c.id)} style={{background:T.card,border:"1px solid "+(pp>100?T.danger+"66":T.border),borderRadius:T.borderRadius,padding:14,cursor:"pointer",position:"relative"}}><button onClick={e=>{e.stopPropagation();del(c.id);}} style={{position:"absolute",top:10,right:10,background:T.danger+"22",border:"1px solid "+T.danger+"44",color:T.danger,borderRadius:5,padding:"2px 8px",fontSize:10,cursor:"pointer"}}>✕</button><div style={{marginBottom:8,paddingRight:44}}><div style={{fontWeight:700,fontSize:14}}>{c.nom}</div><div style={{fontSize:11,color:T.muted}}>{c.client} — {c.localisation}</div></div><div style={{display:"flex",gap:5,marginBottom:8,flexWrap:"wrap"}}><Badge label={c.statut} color={stC(c.statut,T)}/><Badge label={c.type} color={T.primary} small/></div><div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3}}><span style={{color:T.muted}}>Budget</span><span style={{fontWeight:700,color:pp>100?T.danger:pp>80?T.warning:T.success}}>{pp}%</span></div><PBar p={pp} color={pp>100?T.danger:pp>80?T.warning:T.success}/><div style={{marginTop:6,fontSize:11,color:T.muted}}>{fmtS(d)} / {fmtS(c.budgetInitial)} XOF</div></div>;})}
    </div>
    {filtered.length===0&&<Empty msg="Aucun chantier" icon="🏗️"/>}
    {showNew&&<Modal title="Nouveau chantier" onClose={()=>setShowNew(false)} onSave={save} T={T}>{saving?<Spin/>:<FG cols={2}><FF label="Nom *" value={form.nom} onChange={v=>up("nom",v)} full T={T}/><FF label="Client" value={form.client} onChange={v=>up("client",v)} T={T}/><FS label="Type" value={form.type} onChange={v=>up("type",v)} options={["Construction","Rehabilitation","Maintenance","VRD","Genie Civil"]} T={T}/><FF label="Localisation" value={form.localisation} onChange={v=>up("localisation",v)} T={T}/><FF label="Budget (XOF) *" type="number" value={form.budget_initial} onChange={v=>up("budget_initial",v)} full T={T}/><FF label="Date début" type="date" value={form.date_debut} onChange={v=>up("date_debut",v)} T={T}/><FF label="Date fin prévue" type="date" value={form.date_fin} onChange={v=>up("date_fin",v)} T={T}/></FG>}</Modal>}
  </div>;
}

// ── FICHE CHANTIER ────────────────────────────────────────────────────────────
function Fiche({chantier:c,setPage,reload,T,isMobile}){
  const [tab,setTab]=useState("infos");
  const [showDep,setShowDep]=useState(false);
  const [lines,setLines]=useState([newDepLine()]);
  const [saving,setSaving]=useState(false);
  const dep=totalDep(c),dp=pct(dep,c.budgetInitial);
  function changeSt(st){sb("chantiers").eq("id",c.id).update({statut:st}).then(()=>reload());}
  function upLine(id,k,v){setLines(prev=>prev.map(l=>l.id===id?{...l,[k]:v}:l));}
  function addLine(){setLines(prev=>[...prev,newDepLine()]);}
  function removeLine(id){setLines(prev=>prev.length>1?prev.filter(l=>l.id!==id):prev);}
  async function saveDeps(){
    const valid=lines.filter(l=>l.libelle&&l.montant);if(!valid.length)return;
    setSaving(true);for(const l of valid)await sb("depenses").insert({chantier_id:c.id,libelle:l.libelle,categorie:l.categorie,montant:parseFloat(l.montant),date:l.date,note:l.note});
    setSaving(false);setShowDep(false);setLines([newDepLine()]);reload();
  }
  function delDep(id){sb("depenses").eq("id",id).del().then(()=>reload());}
  const totalSaisie=lines.reduce((a,l)=>a+(parseFloat(l.montant)||0),0);
  return <div style={{display:"flex",flexDirection:"column",gap:0}}>
    <button onClick={()=>setPage("chantiers")} style={{background:"none",border:"none",color:T.primary,cursor:"pointer",fontSize:13,marginBottom:10,textAlign:"left",padding:0}}>← Retour</button>
    <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:T.borderRadius,padding:isMobile?14:18,marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap",marginBottom:10}}><div style={{flex:1}}><div style={{fontSize:isMobile?16:20,fontWeight:800}}>{c.nom}</div><div style={{color:T.muted,fontSize:11,marginTop:3}}>{c.client} — {c.localisation}</div></div><div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{STATUTS.map(st=><button key={st} onClick={()=>changeSt(st)} style={{padding:"4px 8px",borderRadius:20,border:"1px solid "+(c.statut===st?stC(st,T):T.border),background:c.statut===st?stC(st,T)+"22":"transparent",color:c.statut===st?stC(st,T):T.muted,cursor:"pointer",fontSize:10}}>{st}</button>)}</div></div>
      <Badge label={c.statut} color={stC(c.statut,T)}/>
    </div>
    <div style={{display:"flex",gap:4,marginBottom:12,overflowX:"auto"}}>{[["infos","Infos"],["depenses","Dépenses ("+c.depenses.length+")"]].map(o=><button key={o[0]} onClick={()=>setTab(o[0])} style={{padding:"7px 12px",borderRadius:8,border:"1px solid "+(tab===o[0]?T.primary:T.border),background:tab===o[0]?T.primary:T.card,color:tab===o[0]?"#fff":T.muted,cursor:"pointer",fontSize:12,fontWeight:tab===o[0]?700:400}}>{o[1]}</button>)}</div>
    {tab==="infos"&&<div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12}}>
      <Card title="Informations" T={T}>{[["Nom",c.nom],["Client",c.client],["Localisation",c.localisation],["Type",c.type],["Début",c.date_debut||"-"],["Fin prévue",c.date_fin||"-"]].map(row=><div key={row[0]} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid "+T.border,fontSize:12}}><span style={{color:T.muted}}>{row[0]}</span><span style={{fontWeight:600}}>{row[1]}</span></div>)}</Card>
      <Card title="Budget" T={T}><div style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}><span style={{color:T.muted}}>Avancement</span><strong style={{color:dp>100?T.danger:dp>80?T.warning:T.success}}>{dp}%</strong></div><PBar p={dp} color={dp>100?T.danger:dp>80?T.warning:T.success} h={12}/></div>{[["Budget initial",fmt(c.budgetInitial),T.white],["Dépenses",fmt(dep),T.warning],["Marge",fmt(c.budgetInitial-dep),c.budgetInitial-dep>=0?T.success:T.danger]].map(row=><div key={row[0]} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid "+T.border,fontSize:12}}><span style={{color:T.muted}}>{row[0]}</span><span style={{fontWeight:700,color:row[2]}}>{row[1]}</span></div>)}</Card>
    </div>}
    {tab==="depenses"&&<div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div style={{display:"flex",justifyContent:"flex-end"}}><button onClick={()=>{setLines([newDepLine()]);setShowDep(true);}} style={{background:T.primary,color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",fontWeight:700,cursor:"pointer",fontSize:12}}>+ Saisie multi-lignes</button></div>
      {c.depenses.length===0&&<Empty msg="Aucune dépense" icon="🧾"/>}
      {c.depenses.map(d=><div key={d.id} style={{background:T.card,border:"1px solid "+T.border,borderRadius:9,padding:"10px 12px",display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}><div style={{flex:1}}><div style={{fontWeight:700,fontSize:13}}>{d.libelle}</div><div style={{display:"flex",gap:6,marginTop:4}}><Badge label={d.categorie} color={catC(d.categorie,T)} small/><span style={{fontSize:10,color:T.muted}}>{d.date}</span></div></div><div style={{display:"flex",gap:5,alignItems:"center"}}><span style={{fontWeight:800,color:T.primary,fontSize:13}}>{fmt(d.montant)}</span><button onClick={()=>delDep(d.id)} style={{background:T.danger+"22",border:"none",color:T.danger,borderRadius:5,padding:"3px 7px",fontSize:10,cursor:"pointer"}}>✕</button></div></div>)}
      {showDep&&<Modal title={"Saisie dépenses — "+c.nom} onClose={()=>setShowDep(false)} onSave={saveDeps} saveLabel={"Enregistrer "+lines.filter(l=>l.libelle&&l.montant).length+" ligne(s)"} T={T} wide>
        {saving?<Spin/>:<>
          <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:600}}><thead><tr style={{background:T.mid}}>{["Libellé *","Catégorie","Montant *","Date","Note",""].map((h,i)=><th key={i} style={{padding:"7px 8px",textAlign:"left",fontSize:10,color:T.muted,fontWeight:600}}>{h}</th>)}</tr></thead><tbody>{lines.map(l=>{const iS={background:T.bg,border:"1px solid "+T.border,borderRadius:5,padding:"6px 8px",color:T.white,fontSize:12,outline:"none",width:"100%"};return <tr key={l.id} style={{borderBottom:"1px solid "+T.border+"44"}}><td style={{padding:"4px"}}><input value={l.libelle} onChange={e=>upLine(l.id,"libelle",e.target.value)} placeholder="ex: Béton B25" style={iS}/></td><td style={{padding:"4px"}}><select value={l.categorie} onChange={e=>upLine(l.id,"categorie",e.target.value)} style={iS}>{CATS.map(c=><option key={c} value={c}>{c}</option>)}</select></td><td style={{padding:"4px"}}><input type="number" value={l.montant} onChange={e=>upLine(l.id,"montant",e.target.value)} placeholder="0" style={{...iS,width:110}}/></td><td style={{padding:"4px"}}><input type="date" value={l.date} onChange={e=>upLine(l.id,"date",e.target.value)} style={{...iS,width:130}}/></td><td style={{padding:"4px"}}><input value={l.note} onChange={e=>upLine(l.id,"note",e.target.value)} placeholder="Optionnel" style={iS}/></td><td style={{padding:"4px"}}><button onClick={()=>removeLine(l.id)} style={{background:T.danger+"22",color:T.danger,border:"none",borderRadius:5,padding:"5px 8px",cursor:"pointer"}}>✕</button></td></tr>;})}</tbody></table></div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10}}><button onClick={addLine} style={{background:T.success+"22",color:T.success,border:"1px solid "+T.success+"44",borderRadius:7,padding:"7px 14px",fontWeight:700,cursor:"pointer",fontSize:12}}>+ Ajouter une ligne</button>{totalSaisie>0&&<div style={{fontWeight:700,color:T.primary,fontSize:13}}>Total : {fmt(totalSaisie)}</div>}</div>
        </>}
      </Modal>}
    </div>}
  </div>;
}

// ── DÉBOURS SEC ───────────────────────────────────────────────────────────────
function Debourse({sessions,taches,ch,reload,T,isMobile}){
  const [selSid,setSelSid]=useState(null);
  const [showNew,setShowNew]=useState(false);
  const [sForm,setSForm]=useState({nom:"",chantier_id:"",taux_charges:40,coeff_fg:15,coeff_benef:10});
  const [saving,setSaving]=useState(false);
  const [editNom,setEditNom]=useState(null);
  const [newNom,setNewNom]=useState("");
  const selSess=sessions.find(s=>s.id===selSid);
  const selTaches=selSid?taches.filter(t=>t.session_id===selSid):[];
  function saveSession(){if(!sForm.nom)return;setSaving(true);sb("debourse_sessions").insert({nom:sForm.nom,chantier_id:sForm.chantier_id||null,taux_charges:parseFloat(sForm.taux_charges),coeff_fg:parseFloat(sForm.coeff_fg),coeff_benef:parseFloat(sForm.coeff_benef)}).then(r=>{setSaving(false);setShowNew(false);reload();if(r.data)setSelSid(r.data.id);});}
  function delSession(id){if(!window.confirm("Supprimer ?"))return;sb("debourse_taches").eq("session_id",id).del().then(()=>sb("debourse_sessions").eq("id",id).del().then(()=>{setSelSid(null);reload();}));}
  function renameSession(id){if(!newNom.trim())return;sb("debourse_sessions").eq("id",id).update({nom:newNom.trim()}).then(()=>{setEditNom(null);reload();});}
  function updateCfg(id,k,v){const u={};u[k]=parseFloat(v)||0;sb("debourse_sessions").eq("id",id).update(u).then(()=>reload());}
  return <div style={{display:"flex",flexDirection:"column",gap:14}}>
    <Card title="Projets de Débours Sec" action={<button onClick={()=>setShowNew(true)} style={{background:T.primary,color:"#fff",border:"none",borderRadius:7,padding:"6px 12px",fontWeight:700,cursor:"pointer",fontSize:12}}>+ Nouveau</button>} T={T}>
      {sessions.length===0?<Empty msg="Aucun projet. Créez-en un ou utilisez l'IA Débours." icon="🔢"/>:<div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:4}}>
        {sessions.map(s=>{const sts=taches.filter(t=>t.session_id===s.id);const tot=sts.filter(t=>t.niveau===1).reduce((a,t)=>a+(t.prix_vente_total||0),0);const active=selSid===s.id;
          return <div key={s.id} style={{background:active?T.primary+"22":T.mid,border:"2px solid "+(active?T.primary:T.border),borderRadius:10,padding:"10px 14px",minWidth:170,flexShrink:0}}>
            {editNom===s.id?<div style={{display:"flex",flexDirection:"column",gap:5}}><input value={newNom} onChange={e=>setNewNom(e.target.value)} autoFocus style={{background:T.mid,border:"1px solid "+T.primary,borderRadius:5,padding:"4px 7px",color:T.white,fontSize:12,outline:"none"}} onKeyDown={e=>{if(e.key==="Enter")renameSession(s.id);if(e.key==="Escape")setEditNom(null);}}/><div style={{display:"flex",gap:4}}><button onClick={()=>renameSession(s.id)} style={{flex:1,background:T.success,color:"#fff",border:"none",borderRadius:5,padding:"3px",fontSize:10,cursor:"pointer"}}>✔</button><button onClick={()=>setEditNom(null)} style={{background:T.mid,color:T.muted,border:"none",borderRadius:5,padding:"3px 6px",fontSize:10,cursor:"pointer"}}>✕</button></div></div>
            :<><div onClick={()=>setSelSid(s.id)} style={{fontWeight:700,fontSize:12,color:active?T.primary:T.white,marginBottom:3,cursor:"pointer"}}>{s.nom}</div><div style={{fontSize:10,color:T.muted}}>{sts.length} ligne(s)</div><div style={{fontSize:12,fontWeight:700,color:T.success,marginTop:3}}>{fmtS(tot)} XOF</div><div style={{display:"flex",gap:3,marginTop:7}}><button onClick={()=>setSelSid(s.id)} style={{flex:1,background:T.secondary+"22",color:T.secondary,border:"none",borderRadius:5,padding:"3px",fontSize:9,cursor:"pointer"}}>Ouvrir</button><button onClick={()=>{setEditNom(s.id);setNewNom(s.nom);}} style={{background:T.warning+"22",color:T.warning,border:"none",borderRadius:5,padding:"3px 7px",fontSize:11,cursor:"pointer"}}>✏️</button><button onClick={()=>delSession(s.id)} style={{background:T.danger+"22",color:T.danger,border:"none",borderRadius:5,padding:"3px 6px",fontSize:9,cursor:"pointer"}}>🗑</button></div></>}
          </div>;
        })}
      </div>}
    </Card>
    {selSess&&<DebourseEditor sess={selSess} taches={selTaches} ch={ch} reload={reload} T={T} isMobile={isMobile} updateCfg={updateCfg}/>}
    {showNew&&<Modal title="Nouveau projet Débours" onClose={()=>setShowNew(false)} onSave={saveSession} T={T}>{saving?<Spin/>:<FG cols={2}><FF label="Nom *" value={sForm.nom} onChange={v=>setSForm(p=>({...p,nom:v}))} full T={T}/><FS label="Chantier lié" value={sForm.chantier_id} onChange={v=>setSForm(p=>({...p,chantier_id:v}))} options={[["","— Aucun —"],...ch.map(c=>[c.id,c.nom])]} full T={T}/><FF label="Charges sociales (%)" type="number" value={sForm.taux_charges} onChange={v=>setSForm(p=>({...p,taux_charges:v}))} T={T}/><FF label="Frais généraux (%)" type="number" value={sForm.coeff_fg} onChange={v=>setSForm(p=>({...p,coeff_fg:v}))} T={T}/><FF label="Bénéfice (%)" type="number" value={sForm.coeff_benef} onChange={v=>setSForm(p=>({...p,coeff_benef:v}))} T={T}/></FG>}</Modal>}
  </div>;
}

function computeLine(mo,mat,autres,qte,cfg){const tc=cfg.tc/100,fg=cfg.fg/100,b=cfg.benef/100;const ds=(parseFloat(mo)||0)*(1+tc)+(parseFloat(mat)||0)+(parseFloat(autres)||0);const pv=ds*(1+fg)*(1+b);return {ds,pv_u:pv,pvt:pv*(parseFloat(qte)||0)};}
function renum(taches){let ci=0,si=0,li=0;return taches.map(t=>{const n={...t};if(t.niveau===1){ci++;si=0;li=0;n.num=String(ci);}else if(t.niveau===2){si++;li=0;n.num=ci+"."+si;}else{li++;n.num=ci+"."+si+"."+li;}return n;});}

function DebourseEditor({sess,taches:rawTaches,ch,reload,T,isMobile,updateCfg}){
  const cfg={tc:sess.taux_charges||40,fg:sess.coeff_fg||15,benef:sess.coeff_benef||10};
  const taches=renum([...rawTaches].sort((a,b)=>(a.ordre||0)-(b.ordre||0)));
  const cats1=taches.filter(t=>t.niveau===1),cats2=taches.filter(t=>t.niveau===2);
  const [showAdd,setShowAdd]=useState(false);
  const [editId,setEditId]=useState(null);
  const [editRow,setEditRow]=useState({});
  const [editLbl,setEditLbl]=useState(null);
  const [newLbl,setNewLbl]=useState("");
  const [addForm,setAddForm]=useState({libelle:"",unite:"U",quantite:"",pu:"",mo_u:"",mat_u:"",autres_u:"",niveau:3,cat_parent:"",ss_parent:""});
  const [saving,setSaving]=useState(false);
  const grandTotal=cats1.reduce((a,t)=>a+(t.prix_vente_total||0),0);
  const grandDS=taches.filter(t=>t.niveau===3).reduce((a,t)=>a+(t.debourse_sec_u||0)*(t.quantite||0),0);
  function startEdit(t){setEditId(t.id);setEditRow({libelle:t.libelle,unite:t.unite||"U",quantite:t.quantite||0,pu:t.pu||0,mo_u:t.mo_u||0,mat_u:t.mat_u||0,autres_u:t.autres_u||0,niveau:t.niveau});}
  function cancelEdit(){setEditId(null);setEditRow({});}
  async function saveEdit(id,row){const c=computeLine(row.mo_u,row.mat_u,row.autres_u,row.quantite,cfg);await sb("debourse_taches").eq("id",id).update({libelle:row.libelle,unite:row.unite,quantite:parseFloat(row.quantite)||0,pu:parseFloat(row.pu)||0,mo_u:parseFloat(row.mo_u)||0,mat_u:parseFloat(row.mat_u)||0,autres_u:parseFloat(row.autres_u)||0,debourse_sec_u:Math.round(c.ds),prix_vente_u:Math.round(c.pv_u),prix_vente_total:Math.round(c.pvt)});setEditId(null);setEditRow({});reload();}
  function saveLabel(id){if(!newLbl.trim())return;sb("debourse_taches").eq("id",id).update({libelle:newLbl.trim()}).then(()=>{setEditLbl(null);reload();});}
  async function addLigne(){if(!addForm.libelle)return;setSaving(true);const niv=parseInt(addForm.niveau);let parent_id=null;if(niv>=2){const cat=taches.find(t=>t.niveau===1&&t.libelle===addForm.cat_parent);parent_id=cat?cat.id:null;}if(niv===3&&addForm.ss_parent){const ss=taches.find(t=>t.niveau===2&&t.libelle===addForm.ss_parent);if(ss)parent_id=ss.id;}const c=niv===3?computeLine(addForm.mo_u,addForm.mat_u,addForm.autres_u,addForm.quantite,cfg):{ds:0,pv_u:0,pvt:0};await sb("debourse_taches").insert({session_id:sess.id,libelle:addForm.libelle,unite:addForm.unite||"U",quantite:parseFloat(addForm.quantite)||0,pu:parseFloat(addForm.pu)||0,niveau:niv,parent_id,ordre:rawTaches.length+1,mo_u:parseFloat(addForm.mo_u)||0,mat_u:parseFloat(addForm.mat_u)||0,autres_u:parseFloat(addForm.autres_u)||0,debourse_sec_u:Math.round(c.ds),prix_vente_u:Math.round(c.pv_u),prix_vente_total:Math.round(c.pvt)});setSaving(false);setShowAdd(false);reload();}
  function delLigne(id){if(!window.confirm("Supprimer ?"))return;sb("debourse_taches").eq("id",id).del().then(()=>reload());}
  const iS={background:DT.bg,border:"1px solid "+DT.primary+"66",borderRadius:4,padding:"3px 5px",color:DT.white,fontSize:11,outline:"none",width:"100%"};
  const prevDS=addForm.niveau===3?computeLine(addForm.mo_u,addForm.mat_u,addForm.autres_u,addForm.quantite||1,cfg):null;
  return <div style={{display:"flex",flexDirection:"column",gap:12}}>
    <Card title={"⚙️ "+sess.nom} T={T}>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)",gap:10,marginBottom:12}}>{[["Charges sociales (%)","taux_charges",cfg.tc],["Frais généraux (%)","coeff_fg",cfg.fg],["Bénéfice (%)","coeff_benef",cfg.benef]].map(row=><div key={row[1]}><label style={{fontSize:10,color:T.muted,display:"block",marginBottom:3}}>{row[0]}</label><input type="number" defaultValue={row[2]} onBlur={e=>updateCfg(sess.id,row[1],e.target.value)} style={{background:T.mid,border:"1px solid "+T.border,borderRadius:6,padding:"6px 8px",color:T.white,fontSize:12,outline:"none",width:"100%"}}/></div>)}</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>{[["Débours sec",fmtS(grandDS),T.warning],["Prix vente HT",fmtS(grandTotal),T.success],["Marge brute",fmtS(grandTotal-grandDS),T.primary]].map(r=><div key={r[0]} style={{background:r[2]+"11",border:"1px solid "+r[2]+"33",borderRadius:7,padding:"7px 10px",textAlign:"center"}}><div style={{fontSize:9,color:T.muted}}>{r[0]}</div><div style={{fontWeight:800,fontSize:14,color:r[2]}}>{r[1]}</div></div>)}</div>
    </Card>
    <div style={{display:"flex",gap:6}}><button onClick={()=>setShowAdd(true)} style={{background:T.primary,color:"#fff",border:"none",borderRadius:7,padding:"7px 13px",fontWeight:700,cursor:"pointer",fontSize:12}}>+ Ligne</button></div>
    {taches.length===0?<Empty msg="Ajoutez des catégories et postes" icon="📋"/>:
    <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:T.borderRadius,overflow:"hidden"}}><div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:700}}>
        <thead><tr style={{background:T.primary}}>{["N°","Désignation","Qté","U","MO/u","Mat/u","Autres/u","DS/u","PV total",""].map((h,i)=><th key={i} style={{padding:"8px 7px",textAlign:i>3?"right":"left",color:"#fff",fontSize:10,fontWeight:700,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
        <tbody>{taches.map(t=>{const isCat=t.niveau===1,isSS=t.niveau===2,isLine=t.niveau===3;const bgRow=isCat?T.primary+"18":isSS?T.mid+"cc":"transparent";const isEdit=editId===t.id;const isLblEdit=editLbl===t.id;const editC=isEdit?computeLine(editRow.mo_u,editRow.mat_u,editRow.autres_u,editRow.quantite,cfg):null;
          return <tr key={t.id} style={{background:isEdit?T.warning+"11":bgRow,borderBottom:"1px solid "+T.border+"44"}}>
            <td style={{padding:"5px 7px",fontSize:10,color:T.muted,fontWeight:700,whiteSpace:"nowrap"}}>{t.num}</td>
            <td style={{padding:"5px 7px",paddingLeft:isCat?7:isSS?18:32}}>
              {!isLine&&isLblEdit?<div style={{display:"flex",gap:4,alignItems:"center"}}><input value={newLbl} onChange={e=>setNewLbl(e.target.value)} autoFocus style={{...iS,minWidth:120}} onKeyDown={e=>{if(e.key==="Enter")saveLabel(t.id);if(e.key==="Escape")setEditLbl(null);}}/><button onClick={()=>saveLabel(t.id)} style={{background:T.success,color:"#fff",border:"none",borderRadius:4,padding:"3px 7px",fontSize:10,cursor:"pointer"}}>✔</button><button onClick={()=>setEditLbl(null)} style={{background:T.danger+"22",color:T.danger,border:"none",borderRadius:4,padding:"3px 6px",fontSize:10,cursor:"pointer"}}>✕</button></div>
              :isEdit&&isLine?<input value={editRow.libelle||""} onChange={e=>setEditRow(p=>({...p,libelle:e.target.value}))} style={{...iS,minWidth:130}}/>
              :<span style={{fontWeight:isCat?800:isSS?700:400,color:isCat?T.primary:isSS?T.secondary:T.white}}>{t.libelle}</span>}
            </td>
            {isEdit?<>
              <td style={{padding:"3px 4px"}}>{isLine&&<input type="number" value={editRow.quantite} onChange={e=>setEditRow(p=>({...p,quantite:e.target.value}))} style={{...iS,width:55,textAlign:"right"}}/>}</td>
              <td style={{padding:"3px 4px"}}>{isLine&&<select value={editRow.unite} onChange={e=>setEditRow(p=>({...p,unite:e.target.value}))} style={{...iS,width:55}}>{UNITES.map(u=><option key={u} value={u}>{u}</option>)}</select>}</td>
              <td style={{padding:"3px 4px"}}>{isLine&&<input type="number" value={editRow.mo_u} onChange={e=>setEditRow(p=>({...p,mo_u:e.target.value}))} style={{...iS,width:70,textAlign:"right"}}/>}</td>
              <td style={{padding:"3px 4px"}}>{isLine&&<input type="number" value={editRow.mat_u} onChange={e=>setEditRow(p=>({...p,mat_u:e.target.value}))} style={{...iS,width:70,textAlign:"right"}}/>}</td>
              <td style={{padding:"3px 4px"}}>{isLine&&<input type="number" value={editRow.autres_u} onChange={e=>setEditRow(p=>({...p,autres_u:e.target.value}))} style={{...iS,width:70,textAlign:"right"}}/>}</td>
              <td style={{padding:"5px 7px",textAlign:"right",color:T.warning,fontWeight:700}}>{isLine?fmtS(Math.round(editC.ds)):""}</td>
              <td style={{padding:"5px 7px",textAlign:"right",color:T.success,fontWeight:800}}>{isLine?fmtS(Math.round(editC.pvt)):""}</td>
              <td style={{padding:"3px 4px",whiteSpace:"nowrap"}}><button onClick={()=>saveEdit(t.id,editRow)} style={{background:T.success,color:"#fff",border:"none",borderRadius:4,padding:"4px 8px",fontSize:10,cursor:"pointer",marginRight:3,fontWeight:700}}>✔</button><button onClick={cancelEdit} style={{background:T.danger+"22",color:T.danger,border:"1px solid "+T.danger+"44",borderRadius:4,padding:"4px 7px",fontSize:10,cursor:"pointer"}}>✕</button></td>
            </>:<>
              <td style={{padding:"6px 7px",textAlign:"right",color:T.muted}}>{isLine?(t.quantite||""):""}</td>
              <td style={{padding:"6px 7px",color:T.muted}}>{isLine?(t.unite||""):""}</td>
              <td style={{padding:"6px 7px",textAlign:"right",color:T.muted}}>{isLine?fmtS(t.mo_u||0):""}</td>
              <td style={{padding:"6px 7px",textAlign:"right",color:T.muted}}>{isLine?fmtS(t.mat_u||0):""}</td>
              <td style={{padding:"6px 7px",textAlign:"right",color:T.muted}}>{isLine?fmtS(t.autres_u||0):""}</td>
              <td style={{padding:"6px 7px",textAlign:"right",color:T.warning,fontWeight:600}}>{isLine?fmtS(t.debourse_sec_u||0):""}</td>
              <td style={{padding:"6px 7px",textAlign:"right",color:T.success,fontWeight:isCat?800:isSS?700:600}}>{fmtS(t.prix_vente_total||0)}</td>
              <td style={{padding:"3px 4px",whiteSpace:"nowrap"}}>
                {!isLine&&<button onClick={()=>{setEditLbl(t.id);setNewLbl(t.libelle);}} style={{background:T.warning+"22",color:T.warning,border:"none",borderRadius:4,padding:"3px 6px",fontSize:10,cursor:"pointer",marginRight:2}}>✏️</button>}
                {isLine&&<button onClick={()=>startEdit(t)} style={{background:T.warning+"22",color:T.warning,border:"none",borderRadius:4,padding:"3px 6px",fontSize:10,cursor:"pointer",marginRight:2}}>✏️</button>}
                <button onClick={()=>delLigne(t.id)} style={{background:T.danger+"22",color:T.danger,border:"none",borderRadius:4,padding:"3px 6px",fontSize:10,cursor:"pointer"}}>🗑</button>
              </td>
            </>}
          </tr>;
        })}
        <tr style={{background:T.primary+"33",borderTop:"2px solid "+T.primary}}><td colSpan={7} style={{padding:"8px 7px",fontWeight:800,color:T.primary,fontSize:12}}>TOTAL GÉNÉRAL</td><td style={{padding:"8px 7px",textAlign:"right",color:T.warning,fontWeight:800}}>{fmtS(grandDS)}</td><td style={{padding:"8px 7px",textAlign:"right",color:T.success,fontWeight:800,fontSize:13}}>{fmtS(grandTotal)}</td><td/></tr>
        </tbody>
      </table>
    </div></div>}
    {showAdd&&<Modal title="Ajouter une ligne" onClose={()=>setShowAdd(false)} onSave={addLigne} T={T}>{saving?<Spin/>:<div style={{display:"flex",flexDirection:"column",gap:12}}>
      <FS label="Niveau" value={String(addForm.niveau)} onChange={v=>setAddForm(p=>({...p,niveau:parseInt(v)}))} options={[["1","1 — Catégorie principale"],["2","2 — Sous-catégorie"],["3","3 — Poste détaillé"]]} full T={T}/>
      {addForm.niveau>=2&&<FS label="Catégorie parente" value={addForm.cat_parent} onChange={v=>setAddForm(p=>({...p,cat_parent:v}))} options={["— Sélectionner —",...cats1.map(t=>t.libelle)]} full T={T}/>}
      {addForm.niveau===3&&<FS label="Sous-catégorie parente" value={addForm.ss_parent} onChange={v=>setAddForm(p=>({...p,ss_parent:v}))} options={["— Sélectionner —",...cats2.map(t=>t.libelle)]} full T={T}/>}
      <FG cols={2}>
        <FF label="Libellé *" value={addForm.libelle} onChange={v=>setAddForm(p=>({...p,libelle:v}))} full T={T}/>
        {addForm.niveau===3&&<><FF label="Quantité" type="number" value={addForm.quantite} onChange={v=>setAddForm(p=>({...p,quantite:v}))} T={T}/><FS label="Unité" value={addForm.unite} onChange={v=>setAddForm(p=>({...p,unite:v}))} options={UNITES} T={T}/><FF label="MO / u (XOF)" type="number" value={addForm.mo_u} onChange={v=>setAddForm(p=>({...p,mo_u:v}))} T={T}/><FF label="Matériaux / u (XOF)" type="number" value={addForm.mat_u} onChange={v=>setAddForm(p=>({...p,mat_u:v}))} T={T}/><FF label="Autres / u (XOF)" type="number" value={addForm.autres_u} onChange={v=>setAddForm(p=>({...p,autres_u:v}))} T={T}/></>}
      </FG>
      {prevDS&&addForm.quantite&&<div style={{background:T.warning+"11",border:"1px solid "+T.warning+"33",borderRadius:7,padding:"8px 12px",display:"flex",gap:16,flexWrap:"wrap"}}><span style={{fontSize:11}}><span style={{color:T.muted}}>DS/u: </span><strong style={{color:T.warning}}>{fmtS(Math.round(prevDS.ds))}</strong></span><span style={{fontSize:11}}><span style={{color:T.muted}}>PV total: </span><strong style={{color:T.success}}>{fmtS(Math.round(prevDS.pvt))}</strong></span></div>}
    </div>}</Modal>}
  </div>;
}

// ── INTERVENTIONS ─────────────────────────────────────────────────────────────
function Interventions({intv,ch,reload,T,isMobile}){
  const [showNew,setShowNew]=useState(false);
  const [editIntv,setEditIntv]=useState(null);
  const [saving,setSaving]=useState(false);
  const [showDep,setShowDep]=useState(null);
  const [depLines,setDepLines]=useState([newDepLine()]);
  const [savingDep,setSavingDep]=useState(false);
  const emptyForm={chantier_id:"",titre:"",type:"Corrective",description:"",date_debut:today(),date_fin:"",statut:"En cours",responsable:""};
  const [form,setForm]=useState(emptyForm);
  const up=(k,v)=>setForm(p=>({...p,[k]:v}));
  function openNew(){setForm(emptyForm);setEditIntv(null);setShowNew(true);}
  function openEdit(i){setForm({chantier_id:i.chantier_id||"",titre:i.titre||"",type:i.type||"Corrective",description:i.description||"",date_debut:i.date_debut||today(),date_fin:i.date_fin||"",statut:i.statut||"En cours",responsable:i.responsable||""});setEditIntv(i.id);setShowNew(true);}
  function save(){if(!form.titre)return;setSaving(true);const payload={titre:form.titre,type:form.type,description:form.description,date_debut:form.date_debut,date_fin:form.date_fin||null,statut:form.statut,responsable:form.responsable,chantier_id:form.chantier_id||null};const op=editIntv?sb("interventions").eq("id",editIntv).update(payload):sb("interventions").insert(payload);op.then(()=>{setSaving(false);setShowNew(false);setEditIntv(null);reload();});}
  function del(id){if(!window.confirm("Supprimer ?"))return;sb("interventions").eq("id",id).del().then(()=>reload());}
  function changeSt(id,st){sb("interventions").eq("id",id).update({statut:st}).then(()=>reload());}
  function upDepLine(lid,k,v){setDepLines(prev=>prev.map(l=>l.id===lid?{...l,[k]:v}:l));}
  async function saveDeps(intvId){const valid=depLines.filter(l=>l.libelle&&l.montant);if(!valid.length)return;setSavingDep(true);for(const l of valid)await sb("intervention_depenses").insert({intervention_id:intvId,libelle:l.libelle,categorie:l.categorie,montant:parseFloat(l.montant),date:l.date,note:l.note});setSavingDep(false);setShowDep(null);setDepLines([newDepLine()]);reload();}
  function delDep(id){sb("intervention_depenses").eq("id",id).del().then(()=>reload());}
  const enCours=intv.filter(i=>i.statut==="En cours"),autres=intv.filter(i=>i.statut!=="En cours");
  return <div style={{display:"flex",flexDirection:"column",gap:14}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{fontWeight:700,fontSize:14}}>Interventions ({intv.length})</div><button onClick={openNew} style={{background:T.primary,color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",fontWeight:700,cursor:"pointer",fontSize:12}}>+ Nouvelle</button></div>
    {enCours.length>0&&<div><div style={{fontSize:11,color:T.muted,marginBottom:8,fontWeight:600}}>EN COURS</div><div style={{display:"flex",flexDirection:"column",gap:8}}>{enCours.map(i=><IntvCard key={i.id} i={i} ch={ch} T={T} del={del} changeSt={changeSt} openEdit={openEdit} openDep={()=>{setShowDep(i.id);setDepLines([newDepLine()]);}} delDep={delDep}/>)}</div></div>}
    {autres.length>0&&<div><div style={{fontSize:11,color:T.muted,marginBottom:8,fontWeight:600}}>HISTORIQUE</div><div style={{display:"flex",flexDirection:"column",gap:8}}>{autres.map(i=><IntvCard key={i.id} i={i} ch={ch} T={T} del={del} changeSt={changeSt} openEdit={openEdit} openDep={()=>{setShowDep(i.id);setDepLines([newDepLine()]);}} delDep={delDep}/>)}</div></div>}
    {intv.length===0&&<Empty msg="Aucune intervention" icon="🔧"/>}
    {showNew&&<Modal title={editIntv?"Modifier l'intervention":"Nouvelle intervention"} onClose={()=>{setShowNew(false);setEditIntv(null);}} onSave={save} saveLabel={editIntv?"Mettre à jour":"Créer"} T={T}>{saving?<Spin/>:<FG cols={2}><FF label="Titre *" value={form.titre} onChange={v=>up("titre",v)} full T={T}/><FS label="Type" value={form.type} onChange={v=>up("type",v)} options={TYPES_INT} T={T}/><FS label="Statut" value={form.statut} onChange={v=>up("statut",v)} options={STATUTS_INT} T={T}/><FS label="Chantier" value={form.chantier_id} onChange={v=>up("chantier_id",v)} options={[["","— Aucun —"],...ch.map(c=>[c.id,c.nom])]} T={T}/><FF label="Responsable" value={form.responsable} onChange={v=>up("responsable",v)} T={T}/><FF label="Date début" type="date" value={form.date_debut} onChange={v=>up("date_debut",v)} T={T}/><FF label="Date fin" type="date" value={form.date_fin} onChange={v=>up("date_fin",v)} T={T}/><FF label="Description" value={form.description} onChange={v=>up("description",v)} rows={3} full T={T}/></FG>}</Modal>}
    {showDep&&(()=>{const io=intv.find(i=>i.id===showDep);if(!io)return null;const tot=depLines.reduce((a,l)=>a+(parseFloat(l.montant)||0),0);
      return <Modal title={"Dépenses — "+io.titre} onClose={()=>setShowDep(null)} onSave={()=>saveDeps(showDep)} saveLabel={"Enregistrer "+depLines.filter(l=>l.libelle&&l.montant).length+" ligne(s)"} T={T} wide>
        {savingDep?<Spin/>:<>
          {io.depenses.length>0&&<div style={{marginBottom:14}}><div style={{fontSize:11,color:T.muted,marginBottom:6,fontWeight:600}}>Dépenses existantes</div>{io.depenses.map(d=><div key={d.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid "+T.border+"44",fontSize:12}}><div><span style={{fontWeight:600}}>{d.libelle}</span><span style={{color:T.muted,marginLeft:8}}>{d.date}</span></div><div style={{display:"flex",gap:6,alignItems:"center"}}><Badge label={d.categorie} color={catC(d.categorie,T)} small/><span style={{color:T.primary,fontWeight:700}}>{fmt(d.montant)}</span><button onClick={()=>delDep(d.id)} style={{background:T.danger+"22",color:T.danger,border:"none",borderRadius:4,padding:"2px 6px",fontSize:10,cursor:"pointer"}}>✕</button></div></div>)}</div>}
          <div style={{fontSize:11,color:T.muted,marginBottom:6,fontWeight:600}}>Nouvelles lignes</div>
          <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:600}}><thead><tr style={{background:T.mid}}>{["Libellé *","Catégorie","Montant *","Date","Note",""].map((h,i)=><th key={i} style={{padding:"7px 8px",textAlign:"left",fontSize:10,color:T.muted,fontWeight:600}}>{h}</th>)}</tr></thead><tbody>{depLines.map(l=>{const iS={background:T.bg,border:"1px solid "+T.border,borderRadius:5,padding:"6px 8px",color:T.white,fontSize:12,outline:"none",width:"100%"};return <tr key={l.id} style={{borderBottom:"1px solid "+T.border+"44"}}><td style={{padding:"4px"}}><input value={l.libelle} onChange={e=>upDepLine(l.id,"libelle",e.target.value)} placeholder="ex: Pièce de rechange" style={iS}/></td><td style={{padding:"4px"}}><select value={l.categorie} onChange={e=>upDepLine(l.id,"categorie",e.target.value)} style={iS}>{CATS.map(c=><option key={c} value={c}>{c}</option>)}</select></td><td style={{padding:"4px"}}><input type="number" value={l.montant} onChange={e=>upDepLine(l.id,"montant",e.target.value)} placeholder="0" style={{...iS,width:110}}/></td><td style={{padding:"4px"}}><input type="date" value={l.date} onChange={e=>upDepLine(l.id,"date",e.target.value)} style={{...iS,width:130}}/></td><td style={{padding:"4px"}}><input value={l.note} onChange={e=>upDepLine(l.id,"note",e.target.value)} placeholder="Optionnel" style={iS}/></td><td style={{padding:"4px"}}><button onClick={()=>setDepLines(p=>p.length>1?p.filter(x=>x.id!==l.id):p)} style={{background:T.danger+"22",color:T.danger,border:"none",borderRadius:5,padding:"5px 8px",cursor:"pointer"}}>✕</button></td></tr>;})}</tbody></table></div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10}}><button onClick={()=>setDepLines(p=>[...p,newDepLine()])} style={{background:T.success+"22",color:T.success,border:"1px solid "+T.success+"44",borderRadius:7,padding:"7px 14px",fontWeight:700,cursor:"pointer",fontSize:12}}>+ Ajouter une ligne</button>{tot>0&&<div style={{fontWeight:700,color:T.primary,fontSize:13}}>Total : {fmt(tot)}</div>}</div>
        </>}
      </Modal>;
    })()}
  </div>;
}
function IntvCard({i,ch,T,del,changeSt,openEdit,openDep,delDep}){
  const [exp,setExp]=useState(false);
  const chNom=(ch.find(c=>c.id===i.chantier_id)||{}).nom||"";
  const cost=totalDepI(i);
  return <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:T.borderRadius,padding:12}}>
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,flexWrap:"wrap",gap:6}}>
      <div style={{flex:1,cursor:"pointer"}} onClick={()=>setExp(e=>!e)}><div style={{fontWeight:700,fontSize:13}}>{i.titre} <span style={{color:T.muted,fontSize:11}}>{exp?"▲":"▼"}</span></div>{chNom&&<div style={{fontSize:11,color:T.muted}}>{chNom}</div>}</div>
      <div style={{display:"flex",gap:4,alignItems:"center",flexWrap:"wrap"}}>
        <Badge label={i.statut||"En cours"} color={intStC(i.statut,T)}/>
        <button onClick={()=>openEdit(i)} style={{background:T.warning+"22",color:T.warning,border:"none",borderRadius:5,padding:"3px 7px",fontSize:11,cursor:"pointer"}}>✏️</button>
        <button onClick={()=>openDep()} style={{background:T.primary+"22",color:T.primary,border:"none",borderRadius:5,padding:"3px 7px",fontSize:11,cursor:"pointer"}}>💸</button>
        <button onClick={()=>changeSt(i.id,i.statut==="En cours"?"Termine":"En cours")} style={{background:T.success+"22",color:T.success,border:"none",borderRadius:5,padding:"3px 7px",fontSize:10,cursor:"pointer"}}>✔</button>
        <button onClick={()=>del(i.id)} style={{background:T.danger+"22",color:T.danger,border:"none",borderRadius:5,padding:"3px 7px",fontSize:10,cursor:"pointer"}}>✕</button>
      </div>
    </div>
    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><Badge label={i.type} color={T.warning} small/>{i.date_debut&&<span style={{fontSize:10,color:T.muted}}>Début: {i.date_debut}</span>}{i.responsable&&<span style={{fontSize:10,color:T.secondary}}>👤 {i.responsable}</span>}{cost>0&&<span style={{fontSize:10,fontWeight:700,color:T.primary}}>{fmt(cost)}</span>}</div>
    {exp&&i.description&&<div style={{marginTop:8,fontSize:12,color:T.muted,borderTop:"1px solid "+T.border,paddingTop:8}}>{i.description}</div>}
    {exp&&i.depenses.length>0&&<div style={{marginTop:8,borderTop:"1px solid "+T.border,paddingTop:8}}><div style={{fontSize:10,color:T.muted,fontWeight:600,marginBottom:4}}>DÉPENSES</div>{i.depenses.map(d=><div key={d.id} style={{display:"flex",justifyContent:"space-between",fontSize:11,padding:"4px 0",borderBottom:"1px solid "+T.border+"33"}}><span>{d.libelle} <span style={{color:T.muted}}>— {d.date}</span></span><span style={{color:T.primary,fontWeight:700}}>{fmt(d.montant)}</span></div>)}</div>}
  </div>;
}

// ── KPI ───────────────────────────────────────────────────────────────────────
function KpiPage({ch,intv,T,isMobile}){
  const totalB=ch.reduce((a,c)=>a+c.budgetInitial,0),totalD=ch.reduce((a,c)=>a+totalDep(c),0);
  const enDerive=ch.filter(c=>c.statut==="En derive").length,taux=pct(totalD,totalB);
  const barData=ch.slice(0,8).map(c=>({name:c.nom.slice(0,12),budget:c.budgetInitial,dep:totalDep(c)}));
  const catData=CATS.map(cat=>{const total=ch.reduce((a,c)=>a+(c.depenses||[]).filter(d=>d.categorie===cat).reduce((b,d)=>b+d.montant,0),0);return {name:cat,value:total};}).filter(d=>d.value>0);
  const COLORS=[T.secondary,T.primary,T.warning,T.success,"#A855F7",T.muted];
  return <div style={{display:"flex",flexDirection:"column",gap:14}}>
    <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:8}}>
      <Kpi icon="💼" label="Total budget" value={fmtS(totalB)} T={T} compact/>
      <Kpi icon="💸" label="Total dépenses" value={fmtS(totalD)} color={T.warning} T={T} compact/>
      <Kpi icon="📊" label="Taux conso." value={taux+"%"} color={taux>80?T.danger:T.success} T={T} compact/>
      <Kpi icon="⚠️" label="En dérive" value={enDerive} color={enDerive>0?T.danger:T.success} T={T} compact/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14}}>
      <Card title="Budget vs Dépenses" T={T}><ResponsiveContainer width="100%" height={180}><BarChart data={barData}><XAxis dataKey="name" tick={{fill:T.muted,fontSize:9}}/><YAxis tickFormatter={fmtS} tick={{fill:T.muted,fontSize:9}}/><Tooltip formatter={v=>fmt(v)} contentStyle={{background:T.card,border:"1px solid "+T.border,color:T.white}}/><Bar dataKey="budget" fill={T.secondary} name="Budget" radius={[3,3,0,0]}/><Bar dataKey="dep" fill={T.primary} name="Dépenses" radius={[3,3,0,0]}/></BarChart></ResponsiveContainer></Card>
      <Card title="Répartition dépenses" T={T}>{catData.length>0?<ResponsiveContainer width="100%" height={180}><PieChart><Pie data={catData} dataKey="value" cx="50%" cy="50%" outerRadius={70} label={e=>e.name.slice(0,8)}>{catData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip formatter={v=>fmt(v)} contentStyle={{background:T.card,border:"1px solid "+T.border,color:T.white}}/></PieChart></ResponsiveContainer>:<Empty msg="Aucune dépense" icon="📊"/>}</Card>
    </div>
  </div>;
}
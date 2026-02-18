import { useState, useEffect, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis } from "recharts";

const SUPA_URL = "https://mbkwpaxissvvjhewkggl.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ia3dwYXhpc3N2dmpoZXdrZ2dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MjQzOTMsImV4cCI6MjA4NzAwMDM5M30.Zo9aJVDByO8aVSADfSCc2m4jCI1qeXuWYQgVRT-a3LA";
const headers = { "Content-Type":"application/json", "apikey":SUPA_KEY, "Authorization":"Bearer "+SUPA_KEY };
const rest = SUPA_URL + "/rest/v1";

// ── Hook responsive ───────────────────────────────────────────────────────────
function useBreakpoint() {
  const [bp, setBp] = useState(() => {
    const w = window.innerWidth;
    return w < 480 ? "xs" : w < 768 ? "sm" : w < 1024 ? "md" : "lg";
  });
  useEffect(() => {
    const fn = () => {
      const w = window.innerWidth;
      setBp(w < 480 ? "xs" : w < 768 ? "sm" : w < 1024 ? "md" : "lg");
    };
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return { bp, isMobile: bp === "xs" || bp === "sm", isTablet: bp === "md", isDesktop: bp === "lg" };
}

function sbFrom(table) {
  return {
    _table:table,_filters:[],_order:null,_sel:"*",
    select(s){this._sel=s;return this;},
    order(col,opts){this._order="order="+col+(opts?.ascending===false?".desc":".asc");return this;},
    eq(col,val){this._filters.push(col+"=eq."+val);return this;},
    _url(){let u=rest+"/"+this._table+"?select="+this._sel;if(this._filters.length)u+="&"+this._filters.join("&");if(this._order)u+="&"+this._order;return u;},
    async select_run(){const r=await fetch(this._url(),{headers});const data=await r.json();return r.ok?{data,error:null}:{data:null,error:data};},
    async insert(obj){const r=await fetch(rest+"/"+this._table,{method:"POST",headers:{...headers,"Prefer":"return=representation"},body:JSON.stringify(obj)});const data=await r.json();return r.ok?{data,error:null}:{data:null,error:data};},
    async update(obj){const u=rest+"/"+this._table+(this._filters.length?"?"+this._filters.join("&"):"");const r=await fetch(u,{method:"PATCH",headers:{...headers,"Prefer":"return=representation"},body:JSON.stringify(obj)});const data=await r.json();return r.ok?{data,error:null}:{data:null,error:data};},
    async delete(){const u=rest+"/"+this._table+(this._filters.length?"?"+this._filters.join("&"):"");const r=await fetch(u,{method:"DELETE",headers});return r.ok?{error:null}:{error:await r.json()};}
  };
}
const sb={from:sbFrom};

const C = {
  orange:"#F97316",orangeD:"#EA580C",orangeL:"#FED7AA",
  dark:"#292524",mid:"#44403C",border:"#57534E",card:"#292524",
  bg:"#1C1917",white:"#FAFAF9",muted:"#A8A29E",light:"#78716C",
  green:"#22C55E",red:"#EF4444",yellow:"#EAB308",blue:"#3B82F6",purple:"#A855F7"
};
const CATEGORIES = ["Main d'œuvre","Matériaux","Équipement","Transport","Sous-traitance","Divers"];
const TYPE_INT = {Urgence:"#EF4444",Préventive:"#3B82F6",Corrective:"#F97316",Inspection:"#A855F7"};
const STATUT_INT = {"En attente":"#EAB308","En cours":"#3B82F6","Terminée":"#22C55E"};

const fmt = n => new Intl.NumberFormat("fr-FR",{style:"currency",currency:"XOF",maximumFractionDigits:0}).format(n);
const fmtShort = n => { if(Math.abs(n)>=1000000) return (n/1000000).toFixed(1)+"M XOF"; if(Math.abs(n)>=1000) return Math.round(n/1000)+"k XOF"; return n+" XOF"; };
const pct = (v,t) => t>0?Math.round(v/t*100):0;
const statutColor = s => ({"En cours":C.blue,"En dérive":C.red,"Clôturé":C.green,"Planifié":C.yellow,"En pause":C.light,"Brouillon":C.muted,"En réception":C.orange}[s]||C.muted);
const catColor = c => ({"Main d'œuvre":C.blue,"Matériaux":C.orange,"Équipement":C.yellow,"Transport":C.green,"Sous-traitance":C.purple,"Divers":C.muted}[c]||C.muted);
const getSousStatutBudget = (dep,budget) => { const p=pct(dep,budget); if(p>100)return"Dépassement"; if(p>=80)return"80% consommé"; return"Conforme"; };
const budgetColor = s => ({Conforme:C.green,"80% consommé":C.yellow,Dépassement:C.red}[s]||C.muted);
const totalDep = c => (c.depenses||[]).reduce((a,d)=>a+Number(d.montant),0);
const getBudgetConsomme = c => totalDep(c);
const totalIntDep = i => (i.depenses||[]).reduce((a,d)=>a+Number(d.montant),0);
const genAlertes = (chantiers) => {
  const alertes=[];
  chantiers.forEach(c=>{
    const dep=getBudgetConsomme(c);const p2=pct(dep,c.budgetInitial);
    if(p2>100)alertes.push({niveau:"critique",msg:"Dépassement budget : "+p2+"% consommé",chantier:c});
    else if(p2>=90)alertes.push({niveau:"danger",msg:"Budget à "+p2+"% — risque imminent",chantier:c});
    else if(p2>=80)alertes.push({niveau:"warning",msg:"Budget à "+p2+"% — surveillance",chantier:c});
    if(c.statut==="En dérive")alertes.push({niveau:"critique",msg:"Chantier en dérive",chantier:c});
    if(c.dateFin){const today=new Date();const fin=new Date(c.dateFin);const diff=Math.round((fin-today)/(864e5));if(diff<0&&c.statut!=="Clôturé")alertes.push({niveau:"danger",msg:"Échéance dépassée de "+Math.abs(diff)+"j",chantier:c});else if(diff>=0&&diff<=7&&c.statut!=="Clôturé")alertes.push({niveau:"warning",msg:"Échéance dans "+diff+"j",chantier:c});}
    if((c.depenses||[]).length===0&&c.statut==="En cours")alertes.push({niveau:"info",msg:"Aucune dépense enregistrée",chantier:c});
  });
  return alertes;
};

function exportDepenses(chantiers,scope,chantierId){
  const target=scope==="one"?chantiers.filter(c=>c.id===chantierId):chantiers;
  const total=target.flatMap(c=>c.depenses).reduce((a,d)=>a+Number(d.montant),0);
  const wb=XLSX.utils.book_new();
  const d1=[["Chantier","Client","Libellé","Catégorie","Montant (XOF)","Date","Note"],...target.flatMap(c=>c.depenses.map(d=>[c.nom,c.client,d.libelle,d.categorie,d.montant,d.date,d.note||""]))];
  d1.push(["","","","TOTAL",total,"",""]);
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(d1),"Détail Dépenses");
  XLSX.writeFile(wb,"Depenses_"+new Date().toISOString().slice(0,10)+".xlsx");
}

// ── UI Components ─────────────────────────────────────────────────────────────
const Badge=({label,color,small})=><span style={{background:color+"22",color,border:"1px solid "+color+"55",borderRadius:6,padding:small?"2px 7px":"3px 10px",fontSize:small?10:11,fontWeight:600,whiteSpace:"nowrap"}}>{label}</span>;

const KpiCard=({icon,label,value,sub,color,compact})=>(
  <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:compact?10:12,padding:compact?"12px 14px":"16px 20px",flex:1,minWidth:compact?100:130}}>
    <div style={{fontSize:compact?18:22,marginBottom:3}}>{icon}</div>
    <div style={{fontSize:compact?16:20,fontWeight:700,color:color||C.white,lineHeight:1.2}}>{value}</div>
    <div style={{fontSize:compact?10:12,color:C.muted,marginTop:2}}>{label}</div>
    {sub&&<div style={{fontSize:10,color:C.light,marginTop:3}}>{sub}</div>}
  </div>
);

const PBar=({p,color,h})=><div style={{background:C.mid,borderRadius:99,height:h||8,overflow:"hidden"}}><div style={{width:Math.min(p,100)+"%",background:color||C.orange,height:"100%",borderRadius:99}}/></div>;

const Card=({title,children,pad})=><div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,padding:pad||"18px 20px"}}>{title&&<div style={{fontWeight:700,fontSize:14,marginBottom:14}}>{title}</div>}{children}</div>;

const EmptyState=({msg,icon})=><div style={{textAlign:"center",padding:"40px 20px",color:C.muted}}><div style={{fontSize:40,marginBottom:12}}>{icon}</div><div style={{fontSize:14}}>{msg}</div></div>;

const Spinner=()=><div style={{display:"flex",alignItems:"center",justifyContent:"center",height:200,flexDirection:"column",gap:12}}><div style={{width:36,height:36,border:"4px solid "+C.border,borderTop:"4px solid "+C.orange,borderRadius:"50%",animation:"spin 1s linear infinite"}}/><div style={{color:C.muted,fontSize:13}}>Chargement...</div><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>;

const Modal=({title,onClose,onSave,children})=>(
  <div style={{position:"fixed",inset:0,background:"#00000099",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center",padding:0}}>
    <div style={{background:C.dark,border:"1px solid "+C.border,borderRadius:"20px 20px 0 0",padding:"24px 20px",width:"100%",maxWidth:600,maxHeight:"92vh",overflow:"auto",WebkitOverflowScrolling:"touch"}}>
      <div style={{width:40,height:4,background:C.border,borderRadius:99,margin:"0 auto 20px"}}/>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
        <div style={{fontWeight:800,fontSize:16}}>{title}</div>
        <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:20,padding:"0 4px"}}>✕</button>
      </div>
      {children}
      <div style={{display:"flex",gap:10,marginTop:20,justifyContent:"flex-end"}}>
        <button onClick={onClose} style={{padding:"10px 20px",background:C.mid,color:C.white,border:"none",borderRadius:10,cursor:"pointer",fontSize:14}}>Annuler</button>
        <button onClick={onSave} style={{padding:"10px 20px",background:C.orange,color:"#fff",border:"none",borderRadius:10,fontWeight:700,cursor:"pointer",fontSize:14}}>Enregistrer</button>
      </div>
    </div>
  </div>
);

const FGrid=({children,cols})=><div style={{display:"grid",gridTemplateColumns:`repeat(${cols||2},1fr)`,gap:12}}>{children}</div>;
const FField=({label,value,onChange,type,full})=>(
  <div style={full?{gridColumn:"1/-1"}:{}}><label style={{fontSize:11,color:C.muted,display:"block",marginBottom:4}}>{label}</label>
  <input type={type||"text"} value={value} onChange={e=>onChange(e.target.value)} style={{width:"100%",background:C.mid,border:"1px solid "+C.border,borderRadius:8,padding:"10px 12px",color:C.white,fontSize:14,boxSizing:"border-box",outline:"none",WebkitAppearance:"none"}}/></div>
);
const FSelect=({label,value,onChange,options,full})=>(
  <div style={full?{gridColumn:"1/-1"}:{}}><label style={{fontSize:11,color:C.muted,display:"block",marginBottom:4}}>{label}</label>
  <select value={value} onChange={e=>onChange(e.target.value)} style={{width:"100%",background:C.mid,border:"1px solid "+C.border,borderRadius:8,padding:"10px 12px",color:C.white,fontSize:14,boxSizing:"border-box",outline:"none",WebkitAppearance:"none"}}>
    {options.map(o=><option key={o} value={o}>{o}</option>)}
  </select></div>
);

// ── Hook Supabase ──────────────────────────────────────────────────────────────
function useSupabaseData(){
  const [chantiers,setChantiers]=useState([]);
  const [interventions,setInterventions]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null);
  const loadAll=async()=>{
    setLoading(true);setError(null);
    try{
      const [r1,r2,r3,r4,r5]=await Promise.all([
        sb.from("chantiers").order("created_at",{ascending:false}).select_run(),
        sb.from("depenses").order("date",{ascending:false}).select_run(),
        sb.from("interventions").order("created_at",{ascending:false}).select_run(),
        sb.from("intervention_depenses").select_run(),
        sb.from("intervention_todos").select_run()
      ]);
      if(r1.error)throw r1.error;
      const ch=r1.data||[],dep=r2.data||[],intv=r3.data||[],idep=r4.data||[],todos=r5.data||[];
      setChantiers(ch.map(c=>({...c,budgetInitial:Number(c.budget_initial),dateDebut:c.date_debut,dateFin:c.date_fin,alertes:c.alertes||[],depenses:dep.filter(d=>d.chantier_id===c.id).map(d=>({...d,montant:Number(d.montant)}))})));
      setInterventions(intv.map(i=>({...i,dateCreation:i.date_creation,depenses:idep.filter(d=>d.intervention_id===i.id).map(d=>({...d,montant:Number(d.montant)})),todos:todos.filter(t=>t.intervention_id===i.id)})));
    }catch(err){setError("Erreur : "+(err.message||JSON.stringify(err)));}
    setLoading(false);
  };
  useEffect(()=>{loadAll();},[]);
  return{chantiers,setChantiers,interventions,setInterventions,loading,error,reload:loadAll};
}

// ═════════════════════════════════════════════════════════════════════════════
// APP
// ═════════════════════════════════════════════════════════════════════════════
export default function App(){
  const {chantiers,setChantiers,interventions,setInterventions,loading,error,reload}=useSupabaseData();
  const {isMobile,bp}=useBreakpoint();
  const [page,setPage]=useState("dashboard");
  const [selectedId,setSelectedId]=useState(null);
  const [onglet,setOnglet]=useState("infos");
  const [drawerOpen,setDrawerOpen]=useState(false);
  const [showNew,setShowNew]=useState(false);
  const [filterStatut,setFilterStatut]=useState("Tous");
  const [saving,setSaving]=useState(false);
  const [newForm,setNewForm]=useState({nom:"",client:"",localisation:"",type:"Construction",budgetInitial:"",dateDebut:"",dateFin:""});

  const selected=chantiers.find(c=>c.id===selectedId);
  const openChantier=id=>{setSelectedId(id);setPage("fiche");setOnglet("infos");if(isMobile)setDrawerOpen(false);};
  const navTo=p=>{setPage(p);setDrawerOpen(false);};

  const saveChantier=async()=>{
    if(!newForm.nom||!newForm.client||!newForm.budgetInitial)return;
    setSaving(true);
    await sb.from("chantiers").insert({nom:newForm.nom,client:newForm.client,localisation:newForm.localisation,type:newForm.type,budget_initial:parseFloat(newForm.budgetInitial),date_debut:newForm.dateDebut||null,date_fin:newForm.dateFin||null,statut:"Brouillon",alertes:[],score:100,lat:5.35,lng:-4.0});
    setSaving(false);setShowNew(false);setNewForm({nom:"",client:"",localisation:"",type:"Construction",budgetInitial:"",dateDebut:"",dateFin:""});reload();
  };
  const deleteChantier=async id=>{await sb.from("chantiers").eq("id",id).delete();setPage("chantiers");reload();};

  const nbAlertes=genAlertes(chantiers).filter(a=>a.niveau==="critique"||a.niveau==="danger").length;
  const nbIntEnCours=interventions.filter(i=>i.statut==="En cours").length;

  const navItems=[
    {key:"dashboard",icon:"📊",label:"Dashboard"},
    {key:"chantiers",icon:"🏗️",label:"Chantiers"},
    {key:"interventions",icon:"🔧",label:"Interventions",badge:nbIntEnCours},
    {key:"alertes",icon:"🔔",label:"Alertes",badge:nbAlertes},
    {key:"kpi",icon:"📈",label:"KPIs"},
    {key:"ia",icon:"🤖",label:"IA"},
    {key:"gestion",icon:"⚙️",label:"Gestion"},
  ];

  const NavItem=({n})=>(
    <button onClick={()=>navTo(n.key)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:isMobile?"14px 16px":"10px 10px",borderRadius:8,border:"none",background:page===n.key?C.orange+"22":"transparent",color:page===n.key?C.orange:C.muted,cursor:"pointer",marginBottom:2,textAlign:"left",position:"relative"}}>
      <span style={{fontSize:20,flexShrink:0}}>{n.icon}</span>
      <span style={{fontSize:14,fontWeight:page===n.key?700:400,flex:1}}>{n.label}</span>
      {n.badge>0&&<span style={{background:C.red,color:"#fff",borderRadius:99,fontSize:10,padding:"1px 7px",fontWeight:700}}>{n.badge}</span>}
    </button>
  );

  // Mobile bottom bar icons
  const BottomBar=()=>(
    <div style={{position:"fixed",bottom:0,left:0,right:0,background:C.dark,borderTop:"1px solid "+C.border,display:"flex",justifyContent:"space-around",padding:"8px 0 max(8px, env(safe-area-inset-bottom))",zIndex:100}}>
      {navItems.slice(0,5).map(n=>(
        <button key={n.key} onClick={()=>navTo(n.key)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,background:"none",border:"none",color:page===n.key?C.orange:C.muted,cursor:"pointer",padding:"4px 8px",position:"relative",minWidth:48}}>
          <span style={{fontSize:22}}>{n.icon}</span>
          <span style={{fontSize:9,fontWeight:page===n.key?700:400}}>{n.label}</span>
          {n.badge>0&&<span style={{position:"absolute",top:0,right:4,background:C.red,color:"#fff",borderRadius:99,fontSize:9,padding:"1px 5px",fontWeight:700}}>{n.badge}</span>}
        </button>
      ))}
      <button onClick={()=>setDrawerOpen(true)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,background:"none",border:"none",color:C.muted,cursor:"pointer",padding:"4px 8px",minWidth:48}}>
        <span style={{fontSize:22}}>☰</span>
        <span style={{fontSize:9}}>Plus</span>
      </button>
    </div>
  );

  // Mobile slide-in drawer
  const Drawer=()=>(
    <>
      <div onClick={()=>setDrawerOpen(false)} style={{position:"fixed",inset:0,background:"#0007",zIndex:150}}/>
      <div style={{position:"fixed",left:0,top:0,bottom:0,width:280,background:C.dark,borderRight:"1px solid "+C.border,zIndex:151,padding:"50px 12px 12px",overflowY:"auto"}}>
        <button onClick={()=>setDrawerOpen(false)} style={{position:"absolute",top:16,right:16,background:"none",border:"none",color:C.muted,fontSize:22,cursor:"pointer"}}>✕</button>
        <div style={{padding:"0 8px 16px",marginBottom:8,borderBottom:"1px solid "+C.border}}>
          <div style={{fontWeight:700,fontSize:16}}>JEAN MANAGER</div>
          <div style={{fontSize:11,color:C.orange}}>☁️ Supabase</div>
        </div>
        {navItems.map(n=><NavItem key={n.key} n={n}/>)}
        <div style={{marginTop:16,paddingTop:16,borderTop:"1px solid "+C.border}}>
          <button onClick={()=>{reload();setDrawerOpen(false);}} style={{width:"100%",background:C.blue+"22",border:"1px solid "+C.blue+"44",color:C.blue,borderRadius:8,padding:10,fontSize:12,fontWeight:700,cursor:"pointer"}}>🔄 Synchroniser</button>
        </div>
      </div>
    </>
  );

  return(
    <div style={{display:"flex",height:"100vh",background:C.bg,color:C.white,fontFamily:"'Segoe UI',system-ui,sans-serif",overflow:"hidden"}}>
      <style>{`
        *{-webkit-tap-highlight-color:transparent;box-sizing:border-box;}
        input,select,textarea{font-size:16px!important;}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>

      {/* Desktop sidebar */}
      {!isMobile&&(
        <div style={{width:bp==="md"?60:200,background:C.dark,borderRight:"1px solid "+C.border,display:"flex",flexDirection:"column",flexShrink:0}}>
          <div style={{padding:"18px 12px 16px",borderBottom:"1px solid "+C.border,display:"flex",alignItems:"center",gap:10}}>
            <div style={{background:C.orange,borderRadius:10,width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>🏗</div>
            {bp!=="md"&&<div><div style={{fontWeight:700,fontSize:13}}>JEAN MANAGER</div><div style={{fontSize:10,color:C.orange}}>☁️ Supabase</div></div>}
          </div>
          <nav style={{flex:1,padding:"10px 8px",overflowY:"auto"}}>
            {navItems.map(n=>(
              <button key={n.key} onClick={()=>setPage(n.key)} style={{width:"100%",display:"flex",alignItems:"center",gap:bp==="md"?0:10,padding:"10px",borderRadius:8,border:"none",background:page===n.key?C.orange+"22":"transparent",color:page===n.key?C.orange:C.muted,cursor:"pointer",marginBottom:2,justifyContent:bp==="md"?"center":"flex-start",position:"relative"}}>
                <span style={{fontSize:20,flexShrink:0}}>{n.icon}</span>
                {bp!=="md"&&<span style={{fontSize:13,fontWeight:page===n.key?700:400,flex:1}}>{n.label}</span>}
                {n.badge>0&&(bp==="md"?<span style={{position:"absolute",top:4,right:4,background:C.red,color:"#fff",borderRadius:99,fontSize:9,padding:"1px 4px",fontWeight:700}}>{n.badge}</span>:<span style={{background:C.red,color:"#fff",borderRadius:99,fontSize:10,padding:"1px 6px",fontWeight:700}}>{n.badge}</span>)}
              </button>
            ))}
          </nav>
          {bp!=="md"&&<div style={{padding:8,borderTop:"1px solid "+C.border}}>
            <button onClick={reload} style={{width:"100%",background:C.blue+"22",border:"1px solid "+C.blue+"44",color:C.blue,borderRadius:8,padding:8,fontSize:11,fontWeight:700,cursor:"pointer"}}>🔄 Sync</button>
          </div>}
        </div>
      )}

      {/* Main */}
      <div style={{flex:1,overflow:"auto",display:"flex",flexDirection:"column",paddingBottom:isMobile?72:0}}>
        {/* Header */}
        <div style={{background:C.dark,borderBottom:"1px solid "+C.border,padding:isMobile?"12px 16px":"12px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,position:"sticky",top:0,zIndex:50}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {isMobile&&<button onClick={()=>setDrawerOpen(true)} style={{background:"none",border:"none",color:C.muted,fontSize:22,cursor:"pointer",padding:"0 4px"}}>☰</button>}
            <div style={{fontSize:isMobile?14:16,fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:isMobile?160:300}}>
              {navItems.find(n=>n.key===page)?.icon} {page==="fiche"&&selected?selected.nom:navItems.find(n=>n.key===page)?.label}
            </div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {!isMobile&&(page==="chantiers"||page==="dashboard")&&<button onClick={()=>exportDepenses(chantiers,"all")} style={{background:C.green+"22",color:C.green,border:"1px solid "+C.green+"55",borderRadius:8,padding:"7px 12px",fontWeight:700,cursor:"pointer",fontSize:12}}>📥 Excel</button>}
            {(page==="chantiers"||page==="dashboard")&&<button onClick={()=>setShowNew(true)} style={{background:C.orange,color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",fontWeight:700,cursor:"pointer",fontSize:isMobile?12:13}}>+ {isMobile?"":"Nouveau"}</button>}
            {page==="fiche"&&selected&&<>
              {!isMobile&&<button onClick={()=>exportDepenses(chantiers,"one",selected.id)} style={{background:C.green+"22",color:C.green,border:"1px solid "+C.green+"55",borderRadius:8,padding:"7px 12px",fontWeight:700,cursor:"pointer",fontSize:12}}>📥</button>}
              <button onClick={()=>{if(window.confirm("Supprimer ?"))deleteChantier(selected.id);}} style={{background:C.red+"22",color:C.red,border:"1px solid "+C.red+"44",borderRadius:8,padding:"7px 12px",fontWeight:700,cursor:"pointer",fontSize:12}}>🗑️</button>
            </>}
          </div>
        </div>

        <div style={{flex:1,overflow:"auto",padding:isMobile?"12px 12px":"24px",WebkitOverflowScrolling:"touch"}}>
          {loading?<Spinner/>:error?(
            <div style={{background:C.red+"11",border:"1px solid "+C.red+"44",borderRadius:12,padding:24,textAlign:"center"}}>
              <div style={{fontSize:32,marginBottom:12}}>⚠️</div>
              <div style={{color:C.red,fontWeight:700,marginBottom:8}}>Erreur de connexion</div>
              <div style={{color:C.muted,fontSize:13,marginBottom:16}}>{error}</div>
              <button onClick={reload} style={{background:C.orange,color:"#fff",border:"none",borderRadius:8,padding:"10px 24px",fontWeight:700,cursor:"pointer"}}>🔄 Réessayer</button>
            </div>
          ):<>
            {page==="dashboard"&&<DashboardPage chantiers={chantiers} openChantier={openChantier} interventions={interventions}/>}
            {page==="chantiers"&&<ChantiersPage chantiers={chantiers} openChantier={openChantier} filter={filterStatut} setFilter={setFilterStatut} deleteChantier={deleteChantier}/>}
            {page==="fiche"&&selected&&<FichePage chantier={selected} onglet={onglet} setOnglet={setOnglet} setPage={setPage} chantiers={chantiers} reload={reload}/>}
            {page==="interventions"&&<InterventionsPage interventions={interventions} chantiers={chantiers} reload={reload}/>}
            {page==="alertes"&&<AlertesPage chantiers={chantiers} openChantier={openChantier}/>}
            {page==="kpi"&&<KpiPage chantiers={chantiers}/>}
            {page==="ia"&&<IAPage chantiers={chantiers} openChantier={openChantier} interventions={interventions}/>}
            {page==="gestion"&&<GestionPage chantiers={chantiers} openChantier={openChantier} reload={reload}/>}
          </>}
        </div>
      </div>

      {isMobile&&<BottomBar/>}
      {isMobile&&drawerOpen&&<Drawer/>}

      {showNew&&(
        <Modal title="+ Nouveau Chantier" onClose={()=>setShowNew(false)} onSave={saveChantier}>
          {saving?<Spinner/>:<FGrid cols={2}>
            <FField label="Nom *" value={newForm.nom} onChange={v=>setNewForm(p=>({...p,nom:v}))} full/>
            <FField label="Client *" value={newForm.client} onChange={v=>setNewForm(p=>({...p,client:v}))}/>
            <FSelect label="Type" value={newForm.type} onChange={v=>setNewForm(p=>({...p,type:v}))} options={["Construction","Réhabilitation","Maintenance"]}/>
            <FField label="Localisation" value={newForm.localisation} onChange={v=>setNewForm(p=>({...p,localisation:v}))} full/>
            <FField label="Budget (XOF) *" type="number" value={newForm.budgetInitial} onChange={v=>setNewForm(p=>({...p,budgetInitial:v}))} full/>
            <FField label="Date début" type="date" value={newForm.dateDebut} onChange={v=>setNewForm(p=>({...p,dateDebut:v}))}/>
            <FField label="Date fin" type="date" value={newForm.dateFin} onChange={v=>setNewForm(p=>({...p,dateFin:v}))}/>
          </FGrid>}
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// DashboardPage
// ═══════════════════════════════════════════════════════
function DashboardPage({chantiers,openChantier,interventions}){
  const {isMobile}=useBreakpoint();
  const totalB=chantiers.reduce((a,c)=>a+c.budgetInitial,0);
  const totalD=chantiers.reduce((a,c)=>a+totalDep(c),0);
  const nbUrgences=interventions.filter(i=>i.type==="Urgence"&&i.statut!=="Terminée").length;
  const pieData=[
    {name:"En cours",value:chantiers.filter(c=>c.statut==="En cours").length,color:C.blue},
    {name:"En dérive",value:chantiers.filter(c=>c.statut==="En dérive").length,color:C.red},
    {name:"Planifié",value:chantiers.filter(c=>c.statut==="Planifié").length,color:C.yellow},
    {name:"Clôturé",value:chantiers.filter(c=>c.statut==="Clôturé").length,color:C.green},
  ].filter(d=>d.value>0);
  const bdData=chantiers.slice(0,6).map(c=>({name:c.nom.split(" ")[0],budget:Math.round(c.budgetInitial/1000),dep:Math.round(totalDep(c)/1000)}));
  const f=isMobile?fmtShort:fmt;
  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(5,1fr)",gap:10}}>
        <KpiCard icon="🏗️" label="Chantiers" value={chantiers.length} color={C.orange} compact={isMobile}/>
        <KpiCard icon="💰" label="Budget total" value={f(totalB)} compact={isMobile}/>
        <KpiCard icon="📊" label="Consommé" value={pct(totalD,totalB)+"%"} color={pct(totalD,totalB)>100?C.red:pct(totalD,totalB)>80?C.yellow:C.green} compact={isMobile}/>
        <KpiCard icon="🚨" label="Urgences" value={nbUrgences} color={nbUrgences>0?C.red:C.green} compact={isMobile}/>
        <KpiCard icon="💵" label="Marge" value={f(totalB-totalD)} color={totalB-totalD>=0?C.green:C.red} compact={isMobile}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:16}}>
        <Card title="Statuts">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart><Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={65} label={({name,value})=>name+"("+value+")"} labelLine={false}>
              {pieData.map((d,i)=><Cell key={i} fill={d.color}/>)}
            </Pie><Tooltip contentStyle={{background:C.dark,border:"1px solid "+C.border,color:C.white}}/></PieChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Budget vs Dépenses (k XOF)">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={bdData} margin={{top:4,right:4,left:-20,bottom:20}}>
              <XAxis dataKey="name" tick={{fill:C.muted,fontSize:10}} angle={-20} textAnchor="end"/>
              <YAxis tick={{fill:C.muted,fontSize:9}}/>
              <Tooltip contentStyle={{background:C.dark,border:"1px solid "+C.border,color:C.white}} formatter={v=>v+"k XOF"}/>
              <Bar dataKey="budget" fill={C.orange+"88"} name="Budget" radius={[4,4,0,0]}/>
              <Bar dataKey="dep" fill={C.orange} name="Dépenses" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
      <Card title="Chantiers actifs">
        {chantiers.filter(c=>c.statut!=="Clôturé"&&c.statut!=="Brouillon").map(c=>{
          const d=totalDep(c);const p2=pct(d,c.budgetInitial);
          return(
            <div key={c.id} onClick={()=>openChantier(c.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 0",borderBottom:"1px solid "+C.border,cursor:"pointer",flexWrap:isMobile?"wrap":"nowrap"}}>
              <div style={{flex:2,minWidth:120}}><div style={{fontWeight:600,fontSize:13}}>{c.nom}</div><div style={{fontSize:11,color:C.muted}}>{c.client}</div></div>
              <Badge label={c.statut} color={statutColor(c.statut)}/>
              <div style={{flex:1,minWidth:100}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:C.muted,marginBottom:3}}><span>Consommé</span><span style={{color:p2>100?C.red:p2>80?C.yellow:C.green,fontWeight:700}}>{p2}%</span></div>
                <PBar p={p2} color={p2>100?C.red:p2>80?C.yellow:C.green}/>
              </div>
              {!isMobile&&<div style={{textAlign:"right",minWidth:110,fontSize:12}}><div style={{fontWeight:600}}>{fmt(d)}</div><div style={{color:C.muted}}>/ {fmt(c.budgetInitial)}</div></div>}
            </div>
          );
        })}
        {chantiers.filter(c=>c.statut!=="Clôturé"&&c.statut!=="Brouillon").length===0&&<EmptyState msg="Aucun chantier actif" icon="🏗️"/>}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ChantiersPage
// ═══════════════════════════════════════════════════════
function ChantiersPage({chantiers,openChantier,filter,setFilter,deleteChantier}){
  const {isMobile}=useBreakpoint();
  const statuts=["Tous","Planifié","En cours","En dérive","Clôturé","Brouillon"];
  const filtered=filter==="Tous"?chantiers:chantiers.filter(c=>c.statut===filter);
  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"flex",gap:6,flexWrap:"nowrap",overflowX:"auto",paddingBottom:4,WebkitOverflowScrolling:"touch"}}>
        {statuts.map(s=><button key={s} onClick={()=>setFilter(s)} style={{padding:"6px 12px",borderRadius:20,border:"1px solid "+(filter===s?C.orange:C.border),background:filter===s?C.orange:"transparent",color:filter===s?"#fff":C.muted,cursor:"pointer",fontSize:12,fontWeight:filter===s?700:400,whiteSpace:"nowrap",flexShrink:0}}>{s}</button>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(320px,1fr))",gap:14}}>
        {filtered.map(c=><ChantierCard key={c.id} c={c} onClick={()=>openChantier(c.id)} onDelete={e=>{e.stopPropagation();if(window.confirm("Supprimer ?"))deleteChantier(c.id);}}/>)}
      </div>
      {filtered.length===0&&<EmptyState msg="Aucun chantier" icon="🏗️"/>}
    </div>
  );
}

function ChantierCard({c,onClick,onDelete}){
  const d=totalDep(c);const p=pct(d,c.budgetInitial);const ssb=getSousStatutBudget(d,c.budgetInitial);
  return(
    <div onClick={onClick} style={{background:C.card,border:"1px solid "+(ssb==="Dépassement"?C.red+"66":C.border),borderRadius:14,padding:16,cursor:"pointer",position:"relative",touchAction:"manipulation"}}
      onMouseEnter={e=>e.currentTarget.style.borderColor=C.orange}
      onMouseLeave={e=>e.currentTarget.style.borderColor=ssb==="Dépassement"?C.red+"66":C.border}>
      <button onClick={onDelete} style={{position:"absolute",top:12,right:12,background:C.red+"22",border:"1px solid "+C.red+"44",color:C.red,borderRadius:6,padding:"3px 10px",fontSize:12,cursor:"pointer",zIndex:2}}>🗑️</button>
      <div style={{marginBottom:10,paddingRight:44}}>
        <div style={{fontWeight:700,fontSize:15}}>{c.nom}</div>
        <div style={{fontSize:12,color:C.muted}}>{c.client}</div>
        {c.localisation&&<div style={{fontSize:11,color:C.light,marginTop:2}}>📍 {c.localisation}</div>}
      </div>
      <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
        <Badge label={c.statut} color={statutColor(c.statut)}/>
        <Badge label={c.type} color={C.orange} small/>
        <Badge label={ssb} color={budgetColor(ssb)} small/>
      </div>
      <div style={{marginBottom:4}}>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}><span style={{color:C.muted}}>Budget</span><span style={{fontWeight:700,color:p>100?C.red:p>80?C.yellow:C.green}}>{p}%</span></div>
        <PBar p={p} color={p>100?C.red:p>80?C.yellow:C.green}/>
      </div>
      <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid "+C.border,display:"flex",justifyContent:"space-between",fontSize:12}}>
        <span style={{color:C.muted}}>{fmtShort(d)} / {fmtShort(c.budgetInitial)}</span>
        {(c.alertes||[]).length>0&&<span style={{color:C.red,fontWeight:700}}>⚠️ {c.alertes.length}</span>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// FichePage
// ═══════════════════════════════════════════════════════
function FichePage({chantier:c,onglet,setOnglet,setPage,chantiers,reload}){
  const {isMobile}=useBreakpoint();
  const onglets=["infos","budget","dépenses","analyse"];
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
    setDepForm({libelle:"",categorie:"Main d'œuvre",montant:"",date:new Date().toISOString().slice(0,10),note:""});reload();
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
      <button onClick={()=>setPage("chantiers")} style={{background:"none",border:"none",color:C.orange,cursor:"pointer",fontSize:13,marginBottom:12,textAlign:"left",padding:0}}>← Retour</button>

      {/* Header card */}
      <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:14,padding:isMobile?16:20,marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:12}}>
          <div style={{flex:1}}>
            <div style={{fontSize:isMobile?18:22,fontWeight:800}}>{c.nom}</div>
            <div style={{color:C.muted,fontSize:12,marginTop:4}}>👤 {c.client} · 📍 {c.localisation}</div>
            <div style={{color:C.muted,fontSize:11,marginTop:2}}>📅 {c.dateDebut} → {c.dateFin}</div>
          </div>
          <div style={{position:"relative",flexShrink:0}}>
            <button onClick={()=>setShowStatutMenu(p=>!p)} style={{display:"flex",alignItems:"center",gap:6,background:statutColor(c.statut)+"22",border:"2px solid "+statutColor(c.statut),borderRadius:8,padding:"6px 12px",color:statutColor(c.statut),cursor:"pointer",fontWeight:700,fontSize:12}}>
              {c.statut} <span>▼</span>
            </button>
            {showStatutMenu&&(
              <div style={{position:"absolute",right:0,top:"calc(100% + 6px)",background:C.dark,border:"1px solid "+C.border,borderRadius:10,zIndex:50,minWidth:170,overflow:"hidden",boxShadow:"0 8px 24px #0008"}}>
                {cycleVie.map(s=><button key={s} onClick={()=>changeStatut(s)} style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"10px 14px",border:"none",background:c.statut===s?statutColor(s)+"22":"transparent",color:c.statut===s?statutColor(s):C.white,cursor:"pointer",fontSize:13,textAlign:"left"}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:statutColor(s)}}/>{s}{c.statut===s&&<span style={{marginLeft:"auto"}}>✓</span>}
                </button>)}
              </div>
            )}
          </div>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          <Badge label={c.type} color={C.orange} small/>
          <Badge label={ssb} color={budgetColor(ssb)} small/>
        </div>
        {/* Cycle mini */}
        <div style={{marginTop:14,overflowX:"auto",paddingBottom:4}}>
          <div style={{display:"flex",alignItems:"center",minWidth:"max-content"}}>
            {cycleVie.map((s,i)=>(
              <div key={s} style={{display:"flex",alignItems:"center"}}>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                  <button onClick={()=>changeStatut(s)} style={{width:26,height:26,borderRadius:"50%",background:i===cycleIdx?C.orange:i<cycleIdx?C.green:C.mid,border:i===cycleIdx?"3px solid "+C.orangeL:"3px solid transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"#fff",cursor:"pointer",flexShrink:0}}>
                    {i<cycleIdx?"✓":i+1}
                  </button>
                  <div style={{fontSize:8,color:i===cycleIdx?C.orange:i<cycleIdx?C.green:C.muted,whiteSpace:"nowrap",fontWeight:i===cycleIdx?700:400}}>{s}</div>
                </div>
                {i<cycleVie.length-1&&<div style={{width:16,height:2,background:i<cycleIdx?C.green:C.mid,marginBottom:12,flexShrink:0}}/>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Onglets */}
      <div style={{display:"flex",gap:4,marginBottom:16,overflowX:"auto",paddingBottom:2,WebkitOverflowScrolling:"touch"}}>
        {onglets.map(o=>(
          <button key={o} onClick={()=>setOnglet(o)} style={{padding:"8px 14px",borderRadius:8,border:"1px solid "+(onglet===o?C.orange:C.border),background:onglet===o?C.orange:C.card,color:onglet===o?"#fff":C.muted,cursor:"pointer",fontSize:12,fontWeight:onglet===o?700:400,textTransform:"capitalize",whiteSpace:"nowrap",flexShrink:0}}>
            {o}{o==="dépenses"&&c.depenses.length>0&&<span style={{background:C.yellow,color:C.dark,borderRadius:99,fontSize:9,padding:"1px 5px",fontWeight:800,marginLeft:4}}>{c.depenses.length}</span>}
          </button>
        ))}
      </div>

      {onglet==="infos"&&(
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14}}>
          <Card title="Informations">
            {[["Nom",c.nom],["Client",c.client],["Localisation",c.localisation],["Type",c.type],["Budget",fmt(c.budgetInitial)],["Dépenses",fmt(dep)],["Marge",fmt(c.budgetInitial-dep)],["Début",c.dateDebut],["Fin",c.dateFin]].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid "+C.border,fontSize:13,gap:8}}>
                <span style={{color:C.muted,flexShrink:0}}>{k}</span><span style={{fontWeight:600,textAlign:"right",wordBreak:"break-word"}}>{v}</span>
              </div>
            ))}
          </Card>
          <Card title="Budget global">
            <div style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:6}}><span style={{color:C.muted}}>Consommé</span><strong style={{color:depPct>100?C.red:depPct>80?C.yellow:C.green}}>{depPct}%</strong></div>
              <PBar p={depPct} color={depPct>100?C.red:depPct>80?C.yellow:C.green} h={14}/>
            </div>
            {[["Budget",fmt(c.budgetInitial),C.white],["Dépenses",fmt(dep),C.yellow],["Marge",fmt(c.budgetInitial-dep),c.budgetInitial-dep>=0?C.green:C.red],["Statut",ssb,budgetColor(ssb)]].map(([k,v,col])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid "+C.border,fontSize:13}}>
                <span style={{color:C.muted}}>{k}</span><span style={{fontWeight:700,color:col}}>{v}</span>
              </div>
            ))}
          </Card>
        </div>
      )}

      {onglet==="budget"&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:10}}>
            <KpiCard icon="💰" label="Budget" value={fmtShort(c.budgetInitial)} compact={isMobile}/>
            <KpiCard icon="🧾" label="Dépenses" value={fmtShort(dep)} color={C.yellow} compact={isMobile}/>
            <KpiCard icon="💵" label="Marge" value={fmtShort(c.budgetInitial-dep)} color={c.budgetInitial-dep>=0?C.green:C.red} compact={isMobile}/>
            <KpiCard icon="📊" label="Consommé" value={depPct+"%"} color={depPct>100?C.red:depPct>80?C.yellow:C.green} compact={isMobile}/>
          </div>
          <Card title="Consommation">
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,fontSize:13}}><span style={{color:C.muted}}>Dépenses / Budget</span><strong style={{color:depPct>100?C.red:depPct>80?C.yellow:C.green}}>{depPct}%</strong></div>
            <PBar p={depPct} color={depPct>100?C.red:depPct>80?C.yellow:C.green} h={20}/>
            {depPct>100&&<div style={{marginTop:10,color:C.red,fontSize:12,fontWeight:700}}>🚨 Dépassement de {fmt(dep-c.budgetInitial)}</div>}
          </Card>
        </div>
      )}

      {onglet==="dépenses"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:10}}>
            <KpiCard icon="🧾" label="Total" value={fmtShort(dep)} color={C.yellow} compact={isMobile}/>
            <KpiCard icon="📋" label="Lignes" value={c.depenses.length} color={C.orange} compact={isMobile}/>
            <KpiCard icon="💰" label="Reste" value={fmtShort(c.budgetInitial-dep)} color={c.budgetInitial-dep>=0?C.green:C.red} compact={isMobile}/>
            <KpiCard icon="📊" label="%" value={depPct+"%"} color={depPct>100?C.red:depPct>80?C.yellow:C.green} compact={isMobile}/>
          </div>
          <div style={{display:"flex",gap:6,justifyContent:"space-between",flexWrap:"wrap"}}>
            <div style={{display:"flex",gap:4,flexWrap:"nowrap",overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
              {["Toutes",...CATEGORIES].map(cat=><button key={cat} onClick={()=>setFilterCat(cat)} style={{padding:"5px 10px",borderRadius:20,border:"1px solid "+(filterCat===cat?C.orange:C.border),background:filterCat===cat?C.orange:"transparent",color:filterCat===cat?"#fff":C.muted,cursor:"pointer",fontSize:10,fontWeight:filterCat===cat?700:400,whiteSpace:"nowrap",flexShrink:0}}>{cat}</button>)}
            </div>
            <button onClick={()=>setShowNewDep(true)} style={{background:C.orange,color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontWeight:700,cursor:"pointer",fontSize:13,flexShrink:0}}>+ Ajouter</button>
          </div>
          {filteredDep.length===0&&<EmptyState msg="Aucune dépense" icon="🧾"/>}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {filteredDep.map(d=>(
              <div key={d.id}>
                {editDepId===d.id?(
                  <div style={{background:C.card,border:"2px solid "+C.orange,borderRadius:12,padding:14}}>
                    <FGrid cols={2}>
                      <FField label="Libellé" value={editDepData.libelle} onChange={v=>setEditDepData(p=>({...p,libelle:v}))} full/>
                      <FSelect label="Catégorie" value={editDepData.categorie} onChange={v=>setEditDepData(p=>({...p,categorie:v}))} options={CATEGORIES}/>
                      <FField label="Montant" type="number" value={editDepData.montant} onChange={v=>setEditDepData(p=>({...p,montant:v}))}/>
                      <FField label="Date" type="date" value={editDepData.date} onChange={v=>setEditDepData(p=>({...p,date:v}))}/>
                      <FField label="Note" value={editDepData.note} onChange={v=>setEditDepData(p=>({...p,note:v}))} full/>
                    </FGrid>
                    <div style={{display:"flex",gap:8,marginTop:10,justifyContent:"flex-end"}}>
                      <button onClick={()=>setEditDepId(null)} style={{padding:"8px 16px",background:C.mid,color:C.white,border:"none",borderRadius:8,cursor:"pointer"}}>Annuler</button>
                      <button onClick={saveEditDep} style={{padding:"8px 16px",background:C.orange,color:"#fff",border:"none",borderRadius:8,fontWeight:700,cursor:"pointer"}}>💾</button>
                    </div>
                  </div>
                ):(
                  <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,padding:"12px 14px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                          <div style={{width:7,height:7,borderRadius:"50%",background:catColor(d.categorie),flexShrink:0}}/>
                          <span style={{fontWeight:700,fontSize:13}}>{d.libelle}</span>
                        </div>
                        <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                          <Badge label={d.categorie} color={catColor(d.categorie)} small/>
                          <span style={{fontSize:10,color:C.muted}}>📅 {d.date}</span>
                          {d.note&&<span style={{fontSize:10,color:C.muted,fontStyle:"italic"}}>💬 {d.note}</span>}
                        </div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                        <span style={{fontWeight:800,fontSize:14,color:C.orange}}>{fmtShort(d.montant)}</span>
                        <button onClick={()=>{setEditDepId(d.id);setEditDepData({libelle:d.libelle,categorie:d.categorie,montant:d.montant,date:d.date,note:d.note||""});}} style={{background:C.blue+"22",border:"1px solid "+C.blue+"44",color:C.blue,borderRadius:6,padding:"4px 8px",fontSize:11,cursor:"pointer"}}>✏️</button>
                        <button onClick={()=>delDep(d.id)} style={{background:C.red+"22",border:"1px solid "+C.red+"44",color:C.red,borderRadius:6,padding:"4px 8px",fontSize:11,cursor:"pointer"}}>🗑️</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          {filteredDep.length>0&&<div style={{background:C.card,border:"1px solid "+C.orange+"44",borderRadius:10,padding:"12px 14px",display:"flex",justifyContent:"space-between"}}>
            <span style={{color:C.muted,fontWeight:600,fontSize:13}}>Total</span>
            <span style={{fontWeight:800,color:C.orange}}>{fmt(filteredDep.reduce((a,d)=>a+Number(d.montant),0))}</span>
          </div>}
          {showNewDep&&(
            <Modal title="🧾 Nouvelle Dépense" onClose={()=>setShowNewDep(false)} onSave={addDep}>
              {saving?<Spinner/>:<FGrid cols={2}>
                <FField label="Libellé *" value={depForm.libelle} onChange={v=>setDepForm(p=>({...p,libelle:v}))} full/>
                <FSelect label="Catégorie" value={depForm.categorie} onChange={v=>setDepForm(p=>({...p,categorie:v}))} options={CATEGORIES}/>
                <FField label="Montant (XOF) *" type="number" value={depForm.montant} onChange={v=>setDepForm(p=>({...p,montant:v}))}/>
                <FField label="Date" type="date" value={depForm.date} onChange={v=>setDepForm(p=>({...p,date:v}))} full/>
                <FField label="Note" value={depForm.note} onChange={v=>setDepForm(p=>({...p,note:v}))} full/>
              </FGrid>}
            </Modal>
          )}
        </div>
      )}

      {onglet==="analyse"&&(
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14}}>
          <Card title="Analyse budgétaire">
            {[["Budget",fmt(c.budgetInitial),C.white],["Dépenses",fmt(dep),C.yellow],["Marge",fmt(c.budgetInitial-dep),c.budgetInitial-dep>=0?C.green:C.red],["Consommé",depPct+"%",depPct>100?C.red:depPct>80?C.yellow:C.green],["Statut",ssb,budgetColor(ssb)]].map(([k,v,col])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:"1px solid "+C.border,fontSize:13}}>
                <span style={{color:C.muted}}>{k}</span><span style={{fontWeight:700,color:col}}>{v}</span>
              </div>
            ))}
          </Card>
          <Card title="Par catégorie">
            {depParCat.length===0?<EmptyState msg="Aucune dépense" icon="📊"/>:depParCat.map(({cat,total:t})=>(
              <div key={cat} style={{padding:"8px 0",borderBottom:"1px solid "+C.border}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4}}>
                  <span style={{color:catColor(cat),fontWeight:600}}>{cat}</span><span style={{fontWeight:700}}>{fmtShort(t)}</span>
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

// ═══════════════════════════════════════════════════════
// InterventionsPage
// ═══════════════════════════════════════════════════════
function InterventionsPage({interventions,chantiers,reload}){
  const {isMobile}=useBreakpoint();
  const [showNew,setShowNew]=useState(false);
  const [viewId,setViewId]=useState(null);
  const [filterType,setFilterType]=useState("Tous");
  const [filterStatut,setFilterStatut]=useState("Tous");
  const [saving,setSaving]=useState(false);
  const [form,setForm]=useState({titre:"",description:"",type:"Corrective",intervenant:"",chantier:"",client:"",dateCreation:new Date().toISOString().slice(0,10),duree:"",statut:"En attente"});
  const types=["Tous","Urgence","Préventive","Corrective","Inspection"];
  const statuts=["Tous","En attente","En cours","Terminée"];
  const filtered=interventions.filter(i=>(filterType==="Tous"||i.type===filterType)&&(filterStatut==="Tous"||i.statut===filterStatut));
  const totalCout=interventions.reduce((a,i)=>a+totalIntDep(i),0);
  const totalFacture=interventions.filter(i=>i.facturee).reduce((a,i)=>a+totalIntDep(i),0);
  const saveNew=async()=>{
    if(!form.titre)return;setSaving(true);
    await sb.from("interventions").insert({titre:form.titre,description:form.description,type:form.type,intervenant:form.intervenant,chantier:form.chantier,client:form.client,date_creation:form.dateCreation,duree:parseInt(form.duree)||1,statut:form.statut,facturee:false});
    setSaving(false);setShowNew(false);reload();
  };
  const updateStatut=async(id,s)=>{await sb.from("interventions").eq("id",id).update({statut:s});reload();};
  const toggleFacturee=async(id,val)=>{await sb.from("interventions").eq("id",id).update({facturee:!val});reload();};
  const deleteInt=async id=>{await sb.from("interventions").eq("id",id).delete();reload();};

  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(5,1fr)",gap:10}}>
        <KpiCard icon="🔧" label="Total" value={interventions.length} color={C.orange} compact={isMobile}/>
        <KpiCard icon="🚨" label="Urgences" value={interventions.filter(i=>i.type==="Urgence").length} color={C.red} compact={isMobile}/>
        <KpiCard icon="⚙️" label="En cours" value={interventions.filter(i=>i.statut==="En cours").length} color={C.blue} compact={isMobile}/>
        <KpiCard icon="💰" label="Coût" value={fmtShort(totalCout)} color={C.yellow} compact={isMobile}/>
        <KpiCard icon="✅" label="Facturé" value={fmtShort(totalFacture)} color={C.green} compact={isMobile}/>
      </div>
      <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>
        <div style={{display:"flex",gap:6,overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
          <span style={{fontSize:11,color:C.muted,flexShrink:0,alignSelf:"center"}}>Type:</span>
          {types.map(t=><button key={t} onClick={()=>setFilterType(t)} style={{padding:"5px 10px",borderRadius:20,border:"1px solid "+(filterType===t?C.orange:C.border),background:filterType===t?C.orange:"transparent",color:filterType===t?"#fff":C.muted,cursor:"pointer",fontSize:11,fontWeight:filterType===t?700:400,whiteSpace:"nowrap",flexShrink:0}}>{t}</button>)}
        </div>
        <div style={{display:"flex",gap:6,overflowX:"auto",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",gap:6,overflowX:"auto"}}>
            <span style={{fontSize:11,color:C.muted,flexShrink:0,alignSelf:"center"}}>Statut:</span>
            {statuts.map(s=><button key={s} onClick={()=>setFilterStatut(s)} style={{padding:"5px 10px",borderRadius:20,border:"1px solid "+(filterStatut===s?C.orange:C.border),background:filterStatut===s?C.orange:"transparent",color:filterStatut===s?"#fff":C.muted,cursor:"pointer",fontSize:11,fontWeight:filterStatut===s?700:400,whiteSpace:"nowrap",flexShrink:0}}>{s}</button>)}
          </div>
          <button onClick={()=>setShowNew(true)} style={{background:C.orange,color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",fontWeight:700,cursor:"pointer",fontSize:12,flexShrink:0}}>+ Nouvelle</button>
        </div>
      </div>
      {filtered.length===0&&<EmptyState msg="Aucune intervention" icon="🔧"/>}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(340px,1fr))",gap:12}}>
        {filtered.map(i=>(
          <div key={i.id} style={{background:C.card,border:"1px solid "+(i.type==="Urgence"?C.red+"66":C.border),borderRadius:14,padding:16,display:"flex",flexDirection:"column",gap:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:14}}>{i.titre}</div>
                <div style={{fontSize:11,color:C.muted,marginTop:2}}>🏗️ {i.chantier||"—"} · 👤 {i.client||"—"}</div>
                <div style={{fontSize:10,color:C.muted}}>📅 {i.dateCreation} · {i.intervenant}</div>
              </div>
              <Badge label={i.type} color={TYPE_INT[i.type]||C.orange} small/>
            </div>
            {i.description&&<div style={{fontSize:12,color:C.muted,background:C.mid,borderRadius:6,padding:"7px 10px"}}>{i.description}</div>}
            <div style={{display:"flex",gap:10,alignItems:"center",background:C.mid,borderRadius:8,padding:"10px 12px"}}>
              <div style={{flex:1}}>
                <div style={{fontSize:10,color:C.muted}}>Coût</div>
                <div style={{fontWeight:800,color:C.orange,fontSize:15}}>{fmtShort(totalIntDep(i))}</div>
              </div>
              <button onClick={()=>toggleFacturee(i.id,i.facturee)} style={{background:i.facturee?C.green+"22":C.red+"22",border:"1px solid "+(i.facturee?C.green:C.red)+"55",borderRadius:8,padding:"6px 12px",color:i.facturee?C.green:C.red,fontWeight:700,fontSize:11,cursor:"pointer"}}>
                {i.facturee?"✅ Facturée":"❌ Non facturée"}
              </button>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
              <select value={i.statut} onChange={e=>updateStatut(i.id,e.target.value)} style={{background:STATUT_INT[i.statut]+"22",border:"1px solid "+STATUT_INT[i.statut]+"55",borderRadius:6,padding:"5px 10px",color:STATUT_INT[i.statut],fontSize:12,cursor:"pointer",outline:"none",fontWeight:700,WebkitAppearance:"none",flex:1}}>
                {["En attente","En cours","Terminée"].map(s=><option key={s} value={s}>{s}</option>)}
              </select>
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>setViewId(i.id)} style={{background:C.blue+"22",border:"1px solid "+C.blue+"44",color:C.blue,borderRadius:6,padding:"6px 12px",fontSize:12,cursor:"pointer",fontWeight:600}}>📋</button>
                <button onClick={()=>deleteInt(i.id)} style={{background:C.red+"22",border:"1px solid "+C.red+"44",color:C.red,borderRadius:6,padding:"6px 10px",fontSize:12,cursor:"pointer"}}>🗑️</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {showNew&&(
        <Modal title="🔧 Nouvelle Intervention" onClose={()=>setShowNew(false)} onSave={saveNew}>
          {saving?<Spinner/>:<FGrid cols={2}>
            <FField label="Titre *" value={form.titre} onChange={v=>setForm(p=>({...p,titre:v}))} full/>
            <FSelect label="Type" value={form.type} onChange={v=>setForm(p=>({...p,type:v}))} options={["Urgence","Préventive","Corrective","Inspection"]}/>
            <FSelect label="Statut" value={form.statut} onChange={v=>setForm(p=>({...p,statut:v}))} options={["En attente","En cours","Terminée"]}/>
            <FField label="Intervenant" value={form.intervenant} onChange={v=>setForm(p=>({...p,intervenant:v}))}/>
            <FSelect label="Chantier" value={form.chantier} onChange={v=>setForm(p=>({...p,chantier:v}))} options={["",...chantiers.map(c=>c.nom)]}/>
            <FField label="Client" value={form.client} onChange={v=>setForm(p=>({...p,client:v}))}/>
            <FField label="Date" type="date" value={form.dateCreation} onChange={v=>setForm(p=>({...p,dateCreation:v}))}/>
            <FField label="Durée (j)" type="number" value={form.duree} onChange={v=>setForm(p=>({...p,duree:v}))}/>
            <div style={{gridColumn:"1/-1"}}>
              <label style={{fontSize:11,color:C.muted,display:"block",marginBottom:4}}>Description</label>
              <textarea value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} rows={3} style={{width:"100%",background:C.mid,border:"1px solid "+C.border,borderRadius:8,padding:"10px 12px",color:C.white,fontSize:14,boxSizing:"border-box",outline:"none",resize:"vertical"}}/>
            </div>
          </FGrid>}
        </Modal>
      )}
      {viewId&&<IntervDetail intervention={interventions.find(i=>i.id===viewId)} onClose={()=>setViewId(null)} reload={reload}/>}
    </div>
  );
}

function IntervDetail({intervention:i,onClose,reload}){
  const {isMobile}=useBreakpoint();
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
  const addTodo=async()=>{if(!todoText.trim())return;await sb.from("intervention_todos").insert({intervention_id:i.id,texte:todoText,fait:false});setTodoText("");reload();};
  const toggleTodo=async(id,val)=>{await sb.from("intervention_todos").eq("id",id).update({fait:!val});reload();};
  const delTodo=async id=>{await sb.from("intervention_todos").eq("id",id).delete();reload();};
  const totalD=totalIntDep(i);
  const todosDone=(i.todos||[]).filter(t=>t.fait).length;
  return(
    <div style={{position:"fixed",inset:0,background:"#00000099",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div style={{background:C.dark,border:"1px solid "+C.border,borderRadius:"20px 20px 0 0",padding:"20px 18px",width:"100%",maxWidth:700,maxHeight:"92vh",overflow:"auto",WebkitOverflowScrolling:"touch"}}>
        <div style={{width:40,height:4,background:C.border,borderRadius:99,margin:"0 auto 16px"}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
          <div><div style={{fontWeight:800,fontSize:16}}>{i.titre}</div><div style={{fontSize:12,color:C.muted}}>🏗️ {i.chantier} · 📅 {i.dateCreation}</div></div>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:22,padding:"0 4px"}}>✕</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
          <KpiCard icon="💰" label="Coût" value={fmtShort(totalD)} color={C.orange} compact/>
          <KpiCard icon="✅" label="Todos" value={todosDone+"/"+(i.todos||[]).length} color={todosDone===(i.todos||[]).length&&(i.todos||[]).length>0?C.green:C.blue} compact/>
        </div>
        <div style={{display:"flex",gap:6,marginBottom:14}}>
          {["depenses","todos"].map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:"9px",borderRadius:8,border:"1px solid "+(tab===t?C.orange:C.border),background:tab===t?C.orange:C.card,color:tab===t?"#fff":C.muted,cursor:"pointer",fontWeight:tab===t?700:400,fontSize:13}}>
              {t==="depenses"?"🧾 Dépenses":"✅ Tâches"}
            </button>
          ))}
        </div>
        {tab==="depenses"&&(
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div style={{display:"flex",justifyContent:"flex-end"}}><button onClick={()=>setShowDep(true)} style={{background:C.orange,color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontWeight:700,cursor:"pointer",fontSize:13}}>+ Ajouter</button></div>
            {(i.depenses||[]).length===0&&<EmptyState msg="Aucune dépense" icon="🧾"/>}
            {(i.depenses||[]).map(d=>(
              <div key={d.id} style={{background:C.mid,borderRadius:10,padding:"10px 12px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,fontSize:13}}>{d.libelle}</div>
                  <div style={{fontSize:10,color:C.muted}}><Badge label={d.categorie} color={catColor(d.categorie)} small/> · {d.date}</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontWeight:800,color:C.orange}}>{fmtShort(d.montant)}</span>
                  <button onClick={()=>delDep(d.id)} style={{background:C.red+"22",border:"1px solid "+C.red+"44",color:C.red,borderRadius:6,padding:"5px 8px",fontSize:11,cursor:"pointer"}}>🗑️</button>
                </div>
              </div>
            ))}
            {showDep&&(
              <div style={{background:C.card,border:"2px solid "+C.orange,borderRadius:12,padding:14}}>
                <FGrid cols={2}>
                  <FField label="Libellé *" value={depForm.libelle} onChange={v=>setDepForm(p=>({...p,libelle:v}))} full/>
                  <FSelect label="Catégorie" value={depForm.categorie} onChange={v=>setDepForm(p=>({...p,categorie:v}))} options={CATEGORIES}/>
                  <FField label="Montant *" type="number" value={depForm.montant} onChange={v=>setDepForm(p=>({...p,montant:v}))}/>
                  <FField label="Date" type="date" value={depForm.date} onChange={v=>setDepForm(p=>({...p,date:v}))} full/>
                </FGrid>
                <div style={{display:"flex",gap:8,marginTop:10,justifyContent:"flex-end"}}>
                  <button onClick={()=>setShowDep(false)} style={{padding:"8px 14px",background:C.mid,color:C.white,border:"none",borderRadius:8,cursor:"pointer"}}>Annuler</button>
                  <button onClick={addDep} style={{padding:"8px 14px",background:C.orange,color:"#fff",border:"none",borderRadius:8,fontWeight:700,cursor:"pointer"}}>💾</button>
                </div>
              </div>
            )}
          </div>
        )}
        {tab==="todos"&&(
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div style={{display:"flex",gap:8}}>
              <input value={todoText} onChange={e=>setTodoText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTodo()} placeholder="Nouvelle tâche..." style={{flex:1,background:C.mid,border:"1px solid "+C.border,borderRadius:8,padding:"10px 12px",color:C.white,fontSize:14,outline:"none"}}/>
              <button onClick={addTodo} style={{background:C.orange,color:"#fff",border:"none",borderRadius:8,padding:"10px 14px",fontWeight:700,cursor:"pointer",flexShrink:0}}>+</button>
            </div>
            {(i.todos||[]).length===0&&<EmptyState msg="Aucune tâche" icon="✅"/>}
            {(i.todos||[]).map(t=>(
              <div key={t.id} style={{display:"flex",alignItems:"center",gap:10,background:C.mid,borderRadius:8,padding:"10px 12px"}}>
                <button onClick={()=>toggleTodo(t.id,t.fait)} style={{width:24,height:24,borderRadius:"50%",background:t.fait?C.green:C.border,border:"2px solid "+(t.fait?C.green:C.muted),display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,color:"#fff",fontSize:13}}>{t.fait?"✓":""}</button>
                <span style={{flex:1,fontSize:13,textDecoration:t.fait?"line-through":"none",color:t.fait?C.muted:C.white}}>{t.texte}</span>
                <button onClick={()=>delTodo(t.id)} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:16}}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// AlertesPage
// ═══════════════════════════════════════════════════════
function AlertesPage({chantiers,openChantier}){
  const alertes=genAlertes(chantiers);
  const col={critique:C.red,danger:C.orange,warning:C.yellow,info:C.blue};
  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {alertes.length===0&&<EmptyState msg="Aucune alerte 🎉" icon="✅"/>}
      {alertes.map(({niveau,msg,chantier},i)=>(
        <div key={i} onClick={()=>openChantier(chantier.id)} style={{background:C.card,border:"1px solid "+(col[niveau]||C.border)+"55",borderRadius:10,padding:"14px 16px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
          <div style={{flex:1}}>
            <div style={{fontWeight:600,fontSize:13,color:col[niveau]}}>⚠️ {msg}</div>
            <div style={{fontSize:11,color:C.muted,marginTop:3}}>{chantier.nom} · {chantier.client}</div>
          </div>
          <Badge label={chantier.statut} color={statutColor(chantier.statut)}/>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// KpiPage
// ═══════════════════════════════════════════════════════
function KpiPage({chantiers}){
  const {isMobile}=useBreakpoint();
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
    {kpi:"Clôture",val:Math.round(clos.length/total*100)},
    {kpi:"Marge+",val:Math.round(chantiers.filter(c=>getBudgetConsomme(c)<c.budgetInitial).length/total*100)},
    {kpi:"Suivis",val:Math.round(chantiers.filter(c=>c.depenses.length>0).length/total*100)},
  ];
  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(6,1fr)",gap:10}}>
        <KpiCard icon="💰" label="Budget" value={fmtShort(totalBudget)} compact={isMobile}/>
        <KpiCard icon="🧾" label="Dépenses" value={fmtShort(totalDeps)} color={C.yellow} compact={isMobile}/>
        <KpiCard icon="💵" label="Marge" value={fmtShort(margeGlobale)} color={margeGlobale>=0?C.green:C.red} compact={isMobile}/>
        <KpiCard icon="📉" label="Dérive" value={tauxDerive+"%"} color={tauxDerive>20?C.red:tauxDerive>10?C.yellow:C.green} compact={isMobile}/>
        <KpiCard icon="✅" label="Sains" value={enBonne.length+"/"+total} color={C.green} compact={isMobile}/>
        <KpiCard icon="🏁" label="Clôturés" value={clos.length} color={C.green} compact={isMobile}/>
      </div>
      <Card title="Consommation globale">
        <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:6}}><span style={{color:C.muted}}>Dépenses / Budget</span><strong style={{color:pctGlobal>100?C.red:pctGlobal>80?C.yellow:C.green}}>{pctGlobal}%</strong></div>
        <PBar p={pctGlobal} color={pctGlobal>100?C.red:pctGlobal>80?C.yellow:C.green} h={18}/>
      </Card>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:16}}>
        <Card title="Radar Performance">
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={radarData}>
              <PolarGrid stroke={C.border}/><PolarAngleAxis dataKey="kpi" tick={{fill:C.muted,fontSize:10}}/>
              <Radar dataKey="val" stroke={C.orange} fill={C.orange} fillOpacity={0.3}/>
              <Tooltip contentStyle={{background:C.dark,border:"1px solid "+C.border,color:C.white}} formatter={v=>v+"%"}/>
            </RadarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Dépenses par catégorie">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={depCat} layout="vertical" margin={{left:5,right:5}}>
              <XAxis type="number" tick={{fill:C.muted,fontSize:9}} tickFormatter={v=>Math.round(v/1000)+"k"}/>
              <YAxis type="category" dataKey="cat" tick={{fill:C.muted,fontSize:10}} width={80}/>
              <Tooltip contentStyle={{background:C.dark,border:"1px solid "+C.border,color:C.white}} formatter={v=>fmtShort(v)}/>
              <Bar dataKey="total" radius={[0,4,4,0]}>{depCat.map(({cat},i)=><Cell key={i} fill={catColor(cat)}/>)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
      <Card title="Détail par chantier">
        {chantiers.map(c=>{const dep=getBudgetConsomme(c);const p=pct(dep,c.budgetInitial);const ssb=getSousStatutBudget(dep,c.budgetInitial);return(
          <div key={c.id} style={{padding:"10px 0",borderBottom:"1px solid "+C.border}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
              <div style={{fontWeight:600,fontSize:13,minWidth:120,flex:1}}>{c.nom.split(" ").slice(0,3).join(" ")}</div>
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <span style={{fontWeight:700,color:p>100?C.red:p>80?C.yellow:C.green,fontSize:12}}>{p}%</span>
                <Badge label={ssb} color={budgetColor(ssb)} small/>
              </div>
            </div>
            <PBar p={p} color={p>100?C.red:p>80?C.yellow:C.green} h={7}/>
            {!isMobile&&<div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.muted,marginTop:4}}>
              <span>🧾 {fmtShort(dep)}</span><span>💰 {fmtShort(c.budgetInitial)}</span><span style={{color:c.budgetInitial-dep>=0?C.green:C.red}}>💵 {fmtShort(c.budgetInitial-dep)}</span>
            </div>}
          </div>
        );})}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// IAPage
// ═══════════════════════════════════════════════════════
function IAPage({chantiers,openChantier,interventions}){
  const {isMobile}=useBreakpoint();
  const [analysing,setAnalysing]=useState(false);
  const [iaResult,setIaResult]=useState(null);
  const [iaError,setIaError]=useState(null);
  const [activeTab,setActiveTab]=useState("derives");
  const derives=chantiers.filter(c=>c.statut==="En dérive");
  const risques=chantiers.filter(c=>{const p=pct(totalDep(c),c.budgetInitial);return p>=80&&p<=100&&c.statut!=="En dérive";});
  const allDep=chantiers.flatMap(c=>c.depenses.map(d=>({...d,chantier:c.nom})));
  const grouped={};allDep.forEach(d=>{const k=d.libelle.trim().toLowerCase();if(!grouped[k])grouped[k]=[];grouped[k].push(d);});
  const doublons=Object.entries(grouped).filter(([,items])=>items.length>1);
  const prest={};allDep.filter(d=>d.categorie==="Sous-traitance").forEach(d=>{const k=d.libelle.trim();if(!prest[k])prest[k]={libelle:k,total:0,chantiers:new Set()};prest[k].total+=Number(d.montant);prest[k].chantiers.add(d.chantier);});
  const prestList=Object.values(prest).sort((a,b)=>b.total-a.total);
  const totalST=allDep.filter(d=>d.categorie==="Sous-traitance").reduce((a,d)=>a+Number(d.montant),0);

  const runIA=async()=>{
    setAnalysing(true);setIaError(null);setIaResult(null);
    try{
      const ctx={chantiers:chantiers.map(c=>({nom:c.nom,client:c.client,statut:c.statut,budgetInitial:c.budgetInitial,depensesTotal:totalDep(c),depenses:c.depenses})),doublons:doublons.map(([lib,items])=>({libelle:lib,occurrences:items.length,total:items.reduce((a,i)=>a+Number(i.montant),0)})),prestataires:prestList.map(p=>({libelle:p.libelle,total:p.total}))};
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:"Expert BTP. Analyse ce portefeuille (XOF). Réponds UNIQUEMENT en JSON:\n"+JSON.stringify(ctx)+"\n\nFormat: {\"recapPrestataires\":[{\"nom\":string,\"totalXOF\":number,\"risque\":\"faible\"|\"moyen\"|\"élevé\",\"commentaire\":string}],\"alertesDoublons\":[{\"libelle\":string,\"occurrences\":number,\"totalXOF\":number,\"action\":string}],\"recommandations\":[{\"titre\":string,\"detail\":string,\"priorite\":\"haute\"|\"moyenne\"|\"basse\"}],\"scoreGlobal\":number,\"synthese\":string}"}]})});
      const data=await res.json();const text=(data.content||[]).map(i=>i.text||"").join("");
      setIaResult(JSON.parse(text.replace(/```json|```/g,"").trim()));
    }catch(e){setIaError("Erreur IA : "+e.message);}
    setAnalysing(false);
  };

  const tabs=[{key:"derives",label:"🚨 Dérives"},{key:"doublons",label:"🔍 Doublons"},{key:"prestataires",label:"👷 Prest."},{key:"ia",label:"🤖 IA"}];

  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{background:C.orange+"11",border:"1px solid "+C.orange+"44",borderRadius:14,padding:18}}>
        <div style={{fontSize:18,fontWeight:800,marginBottom:4}}>🤖 Intelligence Artificielle</div>
        <div style={{color:C.muted,fontSize:12,marginBottom:12}}>Dérives · Doublons · Prestataires · Recommandations</div>
        <button onClick={runIA} disabled={analysing} style={{background:C.orange,color:"#fff",border:"none",borderRadius:10,padding:"10px 20px",fontWeight:700,cursor:analysing?"wait":"pointer",fontSize:14}}>
          {analysing?"⏳ Analyse...":iaResult?"🔄 Relancer":"▶ Lancer l'analyse"}
        </button>
        {iaError&&<div style={{color:C.red,fontSize:12,marginTop:10}}>⚠️ {iaError}</div>}
      </div>
      <div style={{display:"flex",gap:6,overflowX:"auto",WebkitOverflowScrolling:"touch",paddingBottom:2}}>
        {tabs.map(t=><button key={t.key} onClick={()=>setActiveTab(t.key)} style={{padding:"8px 14px",borderRadius:8,border:"1px solid "+(activeTab===t.key?C.orange:C.border),background:activeTab===t.key?C.orange:C.card,color:activeTab===t.key?"#fff":C.muted,cursor:"pointer",fontSize:12,fontWeight:activeTab===t.key?700:400,whiteSpace:"nowrap",flexShrink:0}}>{t.label}</button>)}
      </div>

      {activeTab==="derives"&&(
        <>
          <Card title="🚨 Dérives budgétaires">
            {derives.length===0&&risques.length===0?<div style={{color:C.green,padding:16,textAlign:"center"}}>✅ Aucune dérive</div>:<>
              {derives.map(c=>{const d=totalDep(c);return<div key={c.id} onClick={()=>openChantier(c.id)} style={{background:C.red+"11",border:"1px solid "+C.red+"33",borderRadius:8,padding:"12px",marginBottom:8,cursor:"pointer"}}><div style={{fontWeight:700,color:C.red}}>🔴 {c.nom}</div><div style={{fontSize:12,color:C.muted}}>{pct(d,c.budgetInitial)}% consommé</div></div>;})}
              {risques.map(c=>{const d=totalDep(c);return<div key={c.id} onClick={()=>openChantier(c.id)} style={{background:C.yellow+"11",border:"1px solid "+C.yellow+"33",borderRadius:8,padding:"12px",marginBottom:8,cursor:"pointer"}}><div style={{fontWeight:700,color:C.yellow}}>🟡 {c.nom}</div><div style={{fontSize:12,color:C.muted}}>{pct(d,c.budgetInitial)}% — surveillance</div></div>;})}
            </>}
          </Card>
          <Card title="Écart budget vs dépenses">
            {chantiers.map(c=>{const dep=getBudgetConsomme(c);const ecart=dep-c.budgetInitial;return(
              <div key={c.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:"1px solid "+C.border,flexWrap:isMobile?"wrap":"nowrap"}}>
                <div style={{flex:1,minWidth:120,fontWeight:600,fontSize:13}}>{c.nom.split(" ").slice(0,2).join(" ")}</div>
                <Badge label={ecart>0?"⚠️ Dépassé":"✅ OK"} color={ecart>0?C.red:C.green} small/>
                <span style={{fontWeight:700,color:ecart>0?C.red:C.green,fontSize:12}}>{ecart>0?"+":""}{fmtShort(ecart)}</span>
              </div>
            );})}
          </Card>
        </>
      )}

      {activeTab==="doublons"&&(
        <Card title="🔍 Doublons potentiels">
          {doublons.length===0?<div style={{color:C.green,padding:16,textAlign:"center"}}>✅ Aucun doublon</div>:<>
            <div style={{background:C.yellow+"11",border:"1px solid "+C.yellow+"33",borderRadius:8,padding:"10px",marginBottom:12,fontSize:13,color:C.yellow}}>⚠️ {doublons.length} libellé(s) identiques</div>
            {doublons.map(([lib,items])=>(
              <div key={lib} style={{border:"1px solid "+C.yellow+"44",borderRadius:10,padding:"12px",marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                  <div style={{fontWeight:700,color:C.yellow,fontSize:13}}>🔁 "{items[0].libelle}"</div>
                  <span style={{fontSize:11,color:C.muted}}>{items.length}x · {fmtShort(items.reduce((a,i)=>a+Number(i.montant),0))}</span>
                </div>
                {items.map((item,idx)=>(
                  <div key={idx} style={{background:C.mid,borderRadius:6,padding:"7px 10px",fontSize:11,marginBottom:4,display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:4}}>
                    <span>🏗️ {item.chantier}</span><span style={{color:C.muted}}>{item.date}</span><span style={{fontWeight:700,color:C.orange}}>{fmtShort(item.montant)}</span>
                  </div>
                ))}
                {items.every(i=>i.montant===items[0].montant)&&<div style={{fontSize:11,color:C.red,fontWeight:600,marginTop:4}}>🚨 Montants identiques — risque double saisie</div>}
              </div>
            ))}
          </>}
        </Card>
      )}

      {activeTab==="prestataires"&&(
        <Card title="👷 Sous-traitants">
          {prestList.length===0?<EmptyState msg="Aucun prestataire" icon="👷"/>:<>
            {prestList.map((p,i)=>{const pp=pct(p.total,totalST);return(
              <div key={i} style={{background:C.mid,borderRadius:10,padding:"12px",marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",gap:8}}>
                  <div style={{fontWeight:700}}>{p.libelle}</div>
                  <div><span style={{fontWeight:800,color:C.orange}}>{fmtShort(p.total)}</span><span style={{fontSize:11,color:C.muted,marginLeft:6}}>{pp}%</span></div>
                </div>
                <PBar p={pp} color={C.orange} h={4}/>
              </div>
            );})}
            <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0",fontWeight:700}}><span style={{color:C.muted}}>Total ST</span><span style={{color:C.orange}}>{fmtShort(totalST)}</span></div>
          </>}
        </Card>
      )}

      {activeTab==="ia"&&(
        <>
          {!iaResult&&!analysing&&<EmptyState msg="Cliquez sur 'Lancer l'analyse'" icon="🤖"/>}
          {analysing&&<Spinner/>}
          {iaResult&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{background:C.orange+"11",border:"1px solid "+C.orange+"44",borderRadius:12,padding:16}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div style={{fontWeight:800,fontSize:15}}>📋 Synthèse</div>
                  <div style={{background:(iaResult.scoreGlobal>70?C.green:iaResult.scoreGlobal>40?C.yellow:C.red)+"22",borderRadius:8,padding:"4px 12px",fontWeight:800,color:iaResult.scoreGlobal>70?C.green:iaResult.scoreGlobal>40?C.yellow:C.red}}>Score : {iaResult.scoreGlobal}/100</div>
                </div>
                <div style={{fontSize:13,color:C.muted,lineHeight:1.6}}>{iaResult.synthese}</div>
              </div>
              {iaResult.recommandations?.length>0&&(
                <Card title="🎯 Recommandations">
                  {iaResult.recommandations.map((r,i)=>{const col=r.priorite==="haute"?C.red:r.priorite==="moyenne"?C.yellow:C.green;return(
                    <div key={i} style={{background:col+"11",border:"1px solid "+col+"33",borderRadius:8,padding:"12px",marginBottom:10}}>
                      <div style={{display:"flex",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}>
                        <div style={{fontWeight:700,color:col,fontSize:13}}>{r.titre}</div>
                        <Badge label={"Priorité "+r.priorite} color={col} small/>
                      </div>
                      <div style={{fontSize:12,color:C.muted,marginTop:4}}>{r.detail}</div>
                    </div>
                  );})}
                </Card>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// GestionPage
// ═══════════════════════════════════════════════════════
function GestionPage({chantiers,openChantier,reload}){
  const {isMobile}=useBreakpoint();
  const [confirmId,setConfirmId]=useState(null);
  const [search,setSearch]=useState("");
  const filtered=chantiers.filter(c=>c.nom.toLowerCase().includes(search.toLowerCase())||c.client.toLowerCase().includes(search.toLowerCase()));
  const handleDelete=async id=>{await sb.from("chantiers").eq("id",id).delete();setConfirmId(null);reload();};
  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:10}}>
        <KpiCard icon="🏗️" label="Total" value={chantiers.length} color={C.orange} compact={isMobile}/>
        <KpiCard icon="✅" label="Clôturés" value={chantiers.filter(c=>c.statut==="Clôturé").length} color={C.green} compact={isMobile}/>
        <KpiCard icon="⚙️" label="En cours" value={chantiers.filter(c=>c.statut==="En cours").length} color={C.blue} compact={isMobile}/>
        <KpiCard icon="🚨" label="Dérives" value={chantiers.filter(c=>c.statut==="En dérive").length} color={C.red} compact={isMobile}/>
      </div>
      <Card title="⚙️ Gestion des projets">
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Rechercher..." style={{width:"100%",background:C.mid,border:"1px solid "+C.border,borderRadius:8,padding:"10px 14px",color:C.white,fontSize:14,boxSizing:"border-box",outline:"none",marginBottom:14}}/>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {filtered.map(c=>{
            const dep=getBudgetConsomme(c);const p=pct(dep,c.budgetInitial);const ssb=getSousStatutBudget(dep,c.budgetInitial);
            return(
              <div key={c.id} style={{background:C.mid,border:"1px solid "+(confirmId===c.id?C.red+"88":C.border),borderRadius:12,padding:"12px 14px"}}>
                {confirmId===c.id?(
                  <div>
                    <div style={{fontWeight:700,color:C.red,marginBottom:8}}>🗑️ Supprimer "{c.nom}" ?</div>
                    <div style={{display:"flex",gap:10}}>
                      <button onClick={()=>setConfirmId(null)} style={{flex:1,padding:"9px",background:C.card,color:C.white,border:"1px solid "+C.border,borderRadius:8,cursor:"pointer"}}>Annuler</button>
                      <button onClick={()=>handleDelete(c.id)} style={{flex:1,padding:"9px",background:C.red,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700}}>Supprimer</button>
                    </div>
                  </div>
                ):(
                  <div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:8}}>
                      <div style={{flex:1}}><div style={{fontWeight:700,fontSize:14}}>{c.nom}</div><div style={{fontSize:11,color:C.muted}}>👤 {c.client} · 📍 {c.localisation}</div></div>
                      <div style={{display:"flex",gap:6}}><Badge label={c.statut} color={statutColor(c.statut)} small/><Badge label={ssb} color={budgetColor(ssb)} small/></div>
                    </div>
                    <div style={{marginBottom:8}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.muted,marginBottom:3}}><span>{fmtShort(dep)} / {fmtShort(c.budgetInitial)}</span><span style={{color:p>100?C.red:p>80?C.yellow:C.green,fontWeight:700}}>{p}%</span></div>
                      <PBar p={p} color={p>100?C.red:p>80?C.yellow:C.green} h={6}/>
                    </div>
                    <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                      <button onClick={()=>openChantier(c.id)} style={{background:C.blue+"22",border:"1px solid "+C.blue+"44",color:C.blue,borderRadius:7,padding:"7px 14px",fontSize:12,cursor:"pointer",fontWeight:600}}>📋 Ouvrir</button>
                      <button onClick={()=>setConfirmId(c.id)} style={{background:C.red+"22",border:"1px solid "+C.red+"44",color:C.red,borderRadius:7,padding:"7px 12px",fontSize:12,cursor:"pointer",fontWeight:700}}>🗑️</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length===0&&<EmptyState msg="Aucun projet" icon="🔍"/>}
        </div>
      </Card>
    </div>
  );
}
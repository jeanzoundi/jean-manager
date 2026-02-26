import { useState, useEffect, useCallback, useMemo } from "react";
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
const TYPES_CH  = ["Construction","Rehabilitation","Maintenance","VRD","Genie Civil"];
const MOIS_NOM  = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

const fmt   = n => new Intl.NumberFormat("fr-FR",{maximumFractionDigits:0}).format(n||0)+" XOF";
const fmtN  = n => new Intl.NumberFormat("fr-FR",{maximumFractionDigits:0}).format(n||0);
const fmtS  = n => { const a=Math.abs(n||0); if(a>=1e6)return((n||0)/1e6).toFixed(1)+"M"; if(a>=1e3)return Math.round((n||0)/1e3)+"k"; return String(Math.round(n||0)); };
const pct   = (v,t) => t>0?Math.round(v/t*100):0;
const tod   = () => new Date().toISOString().slice(0,10);
const getMois= d => d?d.slice(0,7):"";
const getMoisNom=d=>{if(!d)return"-";const p=d.split("-");return MOIS_NOM[parseInt(p[1])-1]+" "+p[0];};
const stC   = (s,T) => ({"En cours":T.secondary,"En derive":T.danger,"Cloture":T.success,"Planifie":T.warning,"En reception":T.primary,"Brouillon":T.muted})[s]||T.muted;
const catC  = (c,T) => ({"Main d'oeuvre":T.secondary,"Materiaux":T.primary,"Equipement":T.warning,"Transport":T.success,"Sous-traitance":"#A855F7","Divers":T.muted})[c]||T.muted;
const intStC= (s,T) => ({"En cours":T.secondary,"Termine":T.success,"Annule":T.danger,"En attente":T.warning})[s]||T.muted;
const totalDep  = c => (c.depenses||[]).reduce((a,d)=>a+Number(d.montant||0),0);
const totalDepI = i => (i.depenses||[]).reduce((a,d)=>a+Number(d.montant||0),0);
const uid = () => Math.random().toString(36).slice(2,10);

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
  };return self;
}

// ── CALCULS ───────────────────────────────────────────────────────────────────
function calcDS(mo,mat,autres,cfg){const tc=cfg.tc/100;return (parseFloat(mo)||0)*(1+tc)+(parseFloat(mat)||0)+(parseFloat(autres)||0);}
function calcPV(ds,cfg){return ds*(1+cfg.fg/100)*(1+cfg.benef/100);}
function renum(taches){let ci=0,si=0,li=0;return taches.map(t=>{const n={...t};if(t.niveau===1){ci++;si=0;li=0;n.num=String(ci);}else if(t.niveau===2){si++;li=0;n.num=ci+"."+si;}else{li++;n.num=ci+"."+si+"."+li;}return n;});}

// ── EXPORT UTILITIES ──────────────────────────────────────────────────────────
function exportCSV(rows, filename) {
  if(!rows.length)return;
  const h=Object.keys(rows[0]).join(";");
  const b=rows.map(r=>Object.values(r).map(v=>`"${String(v||"").replace(/"/g,'""')}"`).join(";")).join("\n");
  const bl=new Blob(["\uFEFF"+h+"\n"+b],{type:"text/csv;charset=utf-8;"});
  const a=document.createElement("a");a.href=URL.createObjectURL(bl);a.download=filename+".csv";a.click();
}
function printHTML(html, title){
  const w=window.open("","_blank");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>
    body{font-family:sans-serif;margin:1.5cm;font-size:9pt;color:#111}
    h1{color:#F97316;margin-bottom:4px}h2{color:#3B82F6;margin:16px 0 4px}
    table{width:100%;border-collapse:collapse;margin-bottom:16px}
    th{background:#F97316;color:#fff;padding:6px 8px;text-align:left;font-size:9pt}
    td{padding:5px 8px;border-bottom:1px solid #eee;font-size:9pt}
    tr:nth-child(even){background:#f9f9f9}
    .total{background:#F97316;color:#fff;font-weight:800}
    .badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:8pt;font-weight:700}
    .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
    .kpi{background:#f5f5f5;border-radius:8px;padding:10px;text-align:center}
    .kpi-val{font-size:16pt;font-weight:800;color:#F97316}
    .kpi-lbl{font-size:8pt;color:#666}
    @media print{button{display:none}}
  </style></head><body>${html}<br><button onclick="window.print()">Imprimer</button></body></html>`);
  w.document.close();
}

// ── UI ATOMS ──────────────────────────────────────────────────────────────────
function Badge({label,color,small}){return <span style={{background:color+"22",color,border:"1px solid "+color+"55",borderRadius:6,padding:small?"2px 7px":"3px 10px",fontSize:small?10:11,fontWeight:600,whiteSpace:"nowrap"}}>{label}</span>;}
function PBar({p,color,h=8}){return <div style={{background:"#57534E",borderRadius:99,height:h,overflow:"hidden"}}><div style={{width:Math.min(p,100)+"%",background:color,height:"100%",borderRadius:99,transition:"width .4s"}}/></div>;}
function Empty({icon,msg}){return <div style={{textAlign:"center",padding:"40px 20px",color:"#A8A29E"}}><div style={{fontSize:36,marginBottom:10}}>{icon}</div><div style={{fontSize:13}}>{msg}</div></div>;}
function Spin(){return <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10,padding:"24px"}}><div style={{width:26,height:26,border:"3px solid #57534E",borderTopColor:"#F97316",borderRadius:"50%",animation:"spin 1s linear infinite"}}/><style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style></div>;}
function Kpi({icon,label,value,color,T,compact}){return <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:10,padding:compact?"10px 12px":"16px 20px",flex:1,minWidth:0}}><div style={{fontSize:compact?14:20,marginBottom:2}}>{icon}</div><div style={{fontSize:compact?13:20,fontWeight:700,color:color||T.white,lineHeight:1.2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{value}</div><div style={{fontSize:compact?9:11,color:T.muted,marginTop:2}}>{label}</div></div>;}
function Card({T,title,action,children}){return <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:T.borderRadius,padding:"14px 16px"}}>{title&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:6}}><div style={{fontWeight:700,fontSize:13}}>{title}</div>{action}</div>}{children}</div>;}
function Modal({T,title,onClose,onSave,saveLabel,children,wide}){return <div style={{position:"fixed",inset:0,background:"#00000099",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}}><div style={{background:T.card,border:"1px solid "+T.border,borderRadius:"20px 20px 0 0",padding:"20px 16px",width:"100%",maxWidth:wide?1100:700,maxHeight:"94vh",overflow:"auto"}}><div style={{width:40,height:4,background:T.border,borderRadius:99,margin:"0 auto 16px"}}/><div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}><div style={{fontWeight:800,fontSize:15}}>{title}</div><button onClick={onClose} style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:20}}>✕</button></div>{children}{onSave&&<div style={{display:"flex",gap:10,marginTop:16,justifyContent:"flex-end"}}><button onClick={onClose} style={{padding:"9px 18px",background:T.mid,color:T.white,border:"none",borderRadius:8,cursor:"pointer"}}>Annuler</button><button onClick={onSave} style={{padding:"9px 18px",background:T.primary,color:"#fff",border:"none",borderRadius:8,fontWeight:700,cursor:"pointer"}}>{saveLabel||"Enregistrer"}</button></div>}</div></div>;}
function FF({T,label,value,onChange,type,placeholder,rows,full}){const s={width:"100%",background:T.mid,border:"1px solid "+T.border,borderRadius:7,padding:"8px 10px",color:T.white,fontSize:13,boxSizing:"border-box",outline:"none"};return <div style={full?{gridColumn:"1/-1"}:{}}>{label&&<label style={{fontSize:10,color:T.muted,display:"block",marginBottom:3}}>{label}</label>}{rows?<textarea value={value||""} onChange={e=>onChange(e.target.value)} rows={rows} style={s} placeholder={placeholder}/>:<input type={type||"text"} value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={s}/>}</div>;}
function FS({T,label,value,onChange,options,full}){return <div style={full?{gridColumn:"1/-1"}:{}}>{label&&<label style={{fontSize:10,color:T.muted,display:"block",marginBottom:3}}>{label}</label>}<select value={value||""} onChange={e=>onChange(e.target.value)} style={{width:"100%",background:T.mid,border:"1px solid "+T.border,borderRadius:7,padding:"8px 10px",color:T.white,fontSize:13,boxSizing:"border-box",outline:"none"}}>{options.map(o=>Array.isArray(o)?<option key={o[0]} value={o[0]}>{o[1]}</option>:<option key={o} value={o}>{o}</option>)}</select></div>;}
function FG({cols=2,children}){return <div style={{display:"grid",gridTemplateColumns:`repeat(${cols},1fr)`,gap:10}}>{children}</div>;}
function newDepLine(){return {id:uid(),libelle:"",categorie:"Main d'oeuvre",montant:"",date:tod(),note:""};}
function ISel({T,label,value,onChange,style={}}){return <div style={style}>{label&&<label style={{fontSize:10,color:T.muted,display:"block",marginBottom:3}}>{label}</label>}<input value={value||""} onChange={e=>onChange(e.target.value)} style={{width:"100%",background:T.mid,border:"1px solid "+T.border,borderRadius:7,padding:"7px 10px",color:T.white,fontSize:12,outline:"none"}}/></div>;}
function expBtn(color){return {background:color+"22",color:color,border:"1px solid "+color+"44",borderRadius:8,padding:"8px 14px",fontWeight:700,cursor:"pointer",fontSize:12};}

// ── HOOKS ─────────────────────────────────────────────────────────────────────
function useChantiers(){
  const [data,setData]=useState([]);const [loading,setLoading]=useState(true);const [error,setError]=useState(null);
  const load=useCallback(()=>{setLoading(true);setError(null);Promise.all([sb("chantiers").order("created_at",{ascending:false}).get(),sb("depenses").order("date",{ascending:false}).get()]).then(([rc,rd])=>{if(rc.error)throw new Error(JSON.stringify(rc.error));const ch=rc.data||[],dep=rd.data||[];setData(ch.map(c=>({...c,budgetInitial:Number(c.budget_initial||0),depenses:dep.filter(d=>d.chantier_id===c.id).map(d=>({...d,montant:Number(d.montant||0)}))})));setLoading(false);}).catch(e=>{setError(e.message);setLoading(false);});},[]);
  useEffect(()=>{load();},[]);return {data,loading,error,reload:load};
}
function useInterventions(){
  const [data,setData]=useState([]);
  const load=useCallback(()=>{Promise.all([sb("interventions").order("created_at",{ascending:false}).get(),sb("intervention_depenses").order("date",{ascending:false}).get()]).then(([ri,rd])=>{const intv=ri.data||[],idep=rd.data||[];setData(intv.map(i=>({...i,depenses:idep.filter(d=>String(d.intervention_id)===String(i.id)).map(d=>({...d,montant:Number(d.montant||0)}))})));}).catch(()=>{});},[]);
  useEffect(()=>{load();},[]);return {data,reload:load};
}
function useDebourse(){
  const [sessions,setSessions]=useState([]);const [taches,setTaches]=useState([]);
  const load=useCallback(()=>{Promise.all([sb("debourse_sessions").order("created_at",{ascending:false}).get(),sb("debourse_taches").order("ordre").get()]).then(([rs,rt])=>{setSessions(rs.data||[]);setTaches(rt.data||[]);}).catch(()=>{});},[]);
  useEffect(()=>{load();},[]);return {sessions,taches,reload:load};
}

// ══════════════════════════════════════════════════════════════════════════════
// APP ROOT
// ══════════════════════════════════════════════════════════════════════════════
export default function App(){
  const T=DT;
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
    {key:"interventions",icon:"🔧",label:"Interventions",badge:nbInt},
    {key:"rapports",icon:"📤",label:"Rapports & Export"},
    {key:"kpi",icon:"📈",label:"KPIs"},
  ];
  const selected=ch.find(c=>c.id===selId);

  function NavBtn({n}){
    const active=page===n.key||(page==="fiche"&&n.key==="chantiers");
    return <button onClick={()=>navTo(n.key)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px",borderRadius:8,border:"none",background:active?T.primary+"22":"transparent",color:active?T.primary:T.muted,cursor:"pointer",marginBottom:2,position:"relative",fontFamily:T.fontFamily}}>
      <span style={{fontSize:18}}>{n.icon}</span>
      <span style={{fontSize:13,fontWeight:active?700:400,flex:1}}>{n.label}</span>
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
        <div style={{padding:8,borderTop:"1px solid "+T.border}}><button onClick={reloadAll} style={{width:"100%",background:T.secondary+"22",border:"1px solid "+T.secondary+"44",color:T.secondary,borderRadius:8,padding:8,fontSize:11,fontWeight:700,cursor:"pointer"}}>↺ Synchroniser</button></div>
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
            {page==="interventions"&&<Interventions intv={intv} ch={ch} reload={reloadIntv} T={T} isMobile={isMobile}/>}
            {page==="rapports"&&<Rapports ch={ch} intv={intv} T={T} isMobile={isMobile}/>}
            {page==="kpi"&&<KpiPage ch={ch} intv={intv} T={T} isMobile={isMobile}/>}
          </>}
        </div>
      </div>
      {isMobile&&<div style={{position:"fixed",bottom:0,left:0,right:0,background:T.card,borderTop:"1px solid "+T.border,display:"flex",justifyContent:"space-around",padding:"5px 0",zIndex:100}}>
        {nav.slice(0,5).map(n=>{const active=page===n.key;return <button key={n.key} onClick={()=>navTo(n.key)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1,background:"none",border:"none",color:active?T.primary:T.muted,cursor:"pointer",padding:"3px 4px",position:"relative",minWidth:44}}><span style={{fontSize:19}}>{n.icon}</span><span style={{fontSize:8,fontWeight:active?700:400}}>{n.label.slice(0,6)}</span>{n.badge>0&&<span style={{position:"absolute",top:0,right:0,background:T.danger,color:"#fff",borderRadius:99,fontSize:8,padding:"1px 4px"}}>{n.badge}</span>}</button>;})}
        <button onClick={()=>setDrawerOpen(true)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1,background:"none",border:"none",color:T.muted,cursor:"pointer",padding:"3px 4px",minWidth:44}}><span style={{fontSize:19}}>☰</span><span style={{fontSize:8}}>Plus</span></button>
      </div>}
      {isMobile&&drawerOpen&&<><div onClick={()=>setDrawerOpen(false)} style={{position:"fixed",inset:0,background:"#0007",zIndex:150}}/><div style={{position:"fixed",left:0,top:0,bottom:0,width:270,background:T.card,borderRight:"1px solid "+T.border,zIndex:151,padding:"48px 12px 12px",overflowY:"auto"}}><button onClick={()=>setDrawerOpen(false)} style={{position:"absolute",top:14,right:14,background:"none",border:"none",color:T.muted,fontSize:22,cursor:"pointer"}}>✕</button><div style={{padding:"0 8px 14px",marginBottom:8,borderBottom:"1px solid "+T.border}}><div style={{fontWeight:700,fontSize:15}}>{T.companyName}</div></div>{nav.map(n=><NavBtn key={n.key} n={n}/>)}</div></>}
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
    <div onClick={()=>navTo("rapports")} style={{background:"linear-gradient(135deg,#1e3a5f,#1e40af)",border:"1px solid #3b82f655",borderRadius:T.borderRadius,padding:"14px 18px",cursor:"pointer",display:"flex",alignItems:"center",gap:14}}>
      <div style={{fontSize:28}}>📤</div>
      <div style={{flex:1}}><div style={{fontWeight:800,fontSize:14,color:"#93c5fd"}}>Rapports & Exports</div><div style={{fontSize:11,color:T.muted,marginTop:2}}>Filtrer par mois, client, statut · Export CSV & PDF</div></div>
      <div style={{color:T.secondary,fontSize:20}}>→</div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14}}>
      <Card title="Statuts chantiers" T={T}>{pieData.length>0?<ResponsiveContainer width="100%" height={150}><PieChart><Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={55} label={e=>e.name+" ("+e.value+")"}>{pieData.map((d,i)=><Cell key={i} fill={d.color}/>)}</Pie><Tooltip contentStyle={{background:T.card,border:"1px solid "+T.border,color:T.white}}/></PieChart></ResponsiveContainer>:<Empty msg="Aucun chantier" icon="🏗️"/>}</Card>
      <Card title="Chantiers actifs" T={T}>{actifs.slice(0,5).map(c=>{const d=totalDep(c),pp=pct(d,c.budgetInitial);return <div key={c.id} onClick={()=>openCh(c.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:"1px solid "+T.border,cursor:"pointer"}}><div style={{flex:2}}><div style={{fontWeight:600,fontSize:12}}>{c.nom}</div><div style={{fontSize:10,color:T.muted}}>{c.client}</div></div><div style={{flex:1}}><PBar p={pp} color={pp>100?T.danger:pp>80?T.warning:T.success} h={5}/><div style={{fontSize:9,color:T.muted,textAlign:"right",marginTop:1}}>{pp}%</div></div></div>;})} {actifs.length===0&&<Empty msg="Aucun actif" icon="🏗️"/>}</Card>
    </div>
  </div>;
}

// ── CHANTIERS ─────────────────────────────────────────────────────────────────
function Chantiers({ch,openCh,reload,T,isMobile}){
  const [filter,setFilter]=useState("Tous");const [showNew,setShowNew]=useState(false);const [saving,setSaving]=useState(false);
  const [form,setForm]=useState({nom:"",client:"",localisation:"",type:"Construction",budget_initial:"",date_debut:"",date_fin:"",description:""});
  const up=(k,v)=>setForm(p=>({...p,[k]:v}));
  function save(){
    if(!form.nom){alert("Le nom est obligatoire");return;}
    if(!form.budget_initial){alert("Le budget est obligatoire");return;}
    setSaving(true);
    sb("chantiers").insert({
      nom:form.nom,
      client:form.client||null,
      localisation:form.localisation||null,
      type:form.type||null,
      budget_initial:parseFloat(form.budget_initial),
      date_debut:form.date_debut||null,
      date_fin:form.date_fin||null,
      description:form.description||null,
      statut:"Brouillon"
    }).then(r=>{
      setSaving(false);
      if(r.error){alert("Erreur: "+JSON.stringify(r.error));return;}
      setShowNew(false);
      setForm({nom:"",client:"",localisation:"",type:"Construction",budget_initial:"",date_debut:"",date_fin:"",description:""});
      reload();
    });
  }
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
    {showNew&&<Modal title="Nouveau chantier" onClose={()=>setShowNew(false)} onSave={save} T={T}>{saving?<Spin/>:<FG cols={2}><FF label="Nom *" value={form.nom} onChange={v=>up("nom",v)} full T={T}/><FF label="Client" value={form.client} onChange={v=>up("client",v)} T={T}/><FS label="Type" value={form.type} onChange={v=>up("type",v)} options={TYPES_CH} T={T}/><FF label="Localisation" value={form.localisation} onChange={v=>up("localisation",v)} T={T}/><FF label="Budget (XOF) *" type="number" value={form.budget_initial} onChange={v=>up("budget_initial",v)} full T={T}/><FF label="Date début" type="date" value={form.date_debut} onChange={v=>up("date_debut",v)} T={T}/><FF label="Date fin prévue" type="date" value={form.date_fin} onChange={v=>up("date_fin",v)} T={T}/><FF label="Description" value={form.description} onChange={v=>up("description",v)} rows={2} full T={T}/></FG>}</Modal>}
  </div>;
}

// ── FICHE ─────────────────────────────────────────────────────────────────────
function Fiche({chantier:c,setPage,reload,T,isMobile}){
  const [tab,setTab]=useState("infos");const [showDep,setShowDep]=useState(false);const [lines,setLines]=useState([newDepLine()]);const [saving,setSaving]=useState(false);
  const dep=totalDep(c),dp=pct(dep,c.budgetInitial);
  function changeSt(st){sb("chantiers").eq("id",c.id).update({statut:st}).then(()=>reload());}
  function upLine(id,k,v){setLines(prev=>prev.map(l=>l.id===id?{...l,[k]:v}:l));}
  async function saveDeps(){const valid=lines.filter(l=>l.libelle&&l.montant);if(!valid.length)return;setSaving(true);for(const l of valid)await sb("depenses").insert({chantier_id:c.id,libelle:l.libelle,categorie:l.categorie,montant:parseFloat(l.montant),date:l.date,note:l.note});setSaving(false);setShowDep(false);setLines([newDepLine()]);reload();}
  function delDep(id){sb("depenses").eq("id",id).del().then(()=>reload());}
  const totalS=lines.reduce((a,l)=>a+(parseFloat(l.montant)||0),0);
  function exportFiche(){const rows=(c.depenses||[]).map(d=>({Libellé:d.libelle,Catégorie:d.categorie,"Montant (XOF)":d.montant,Date:d.date,Note:d.note||""}));if(rows.length)exportCSV(rows,"depenses_"+c.nom+"_"+tod());}
  function printFiche(){
    const dep2=totalDep(c),pp=pct(dep2,c.budgetInitial);
    const rows=(c.depenses||[]).map(d=>`<tr><td>${d.libelle}</td><td>${d.categorie}</td><td style="text-align:right">${fmtN(d.montant)} XOF</td><td>${d.date}</td><td>${d.note||""}</td></tr>`).join("");
    const html=`<h1>Fiche Chantier — ${c.nom}</h1><p>Client : <strong>${c.client||"-"}</strong> | Statut : <strong>${c.statut}</strong></p><div class="kpi-grid"><div class="kpi"><div class="kpi-val">${fmtS(c.budgetInitial)}</div><div class="kpi-lbl">Budget</div></div><div class="kpi"><div class="kpi-val">${fmtS(dep2)}</div><div class="kpi-lbl">Dépenses</div></div><div class="kpi"><div class="kpi-val">${pp}%</div><div class="kpi-lbl">Consommé</div></div><div class="kpi"><div class="kpi-val">${fmtS(c.budgetInitial-dep2)}</div><div class="kpi-lbl">Marge</div></div></div>${rows.length?`<table><thead><tr><th>Libellé</th><th>Catégorie</th><th>Montant</th><th>Date</th><th>Note</th></tr></thead><tbody>${rows}</tbody></table>`:""}`;
    printHTML(html,"Fiche "+c.nom);
  }
  return <div style={{display:"flex",flexDirection:"column",gap:0}}>
    <button onClick={()=>setPage("chantiers")} style={{background:"none",border:"none",color:T.primary,cursor:"pointer",fontSize:13,marginBottom:10,textAlign:"left",padding:0}}>← Retour</button>
    <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:T.borderRadius,padding:isMobile?14:18,marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap",marginBottom:10}}><div style={{flex:1}}><div style={{fontSize:isMobile?16:20,fontWeight:800}}>{c.nom}</div><div style={{color:T.muted,fontSize:11}}>{c.client} — {c.localisation}</div></div><div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{STATUTS.map(st=><button key={st} onClick={()=>changeSt(st)} style={{padding:"4px 8px",borderRadius:20,border:"1px solid "+(c.statut===st?stC(st,T):T.border),background:c.statut===st?stC(st,T)+"22":"transparent",color:c.statut===st?stC(st,T):T.muted,cursor:"pointer",fontSize:10}}>{st}</button>)}</div></div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}><Badge label={c.statut} color={stC(c.statut,T)}/><button onClick={exportFiche} style={expBtn(T.success)}>📥 CSV</button><button onClick={printFiche} style={expBtn(T.primary)}>🖨️ PDF</button></div>
    </div>
    <div style={{display:"flex",gap:4,marginBottom:12}}>{[["infos","Infos"],["depenses","Dépenses ("+c.depenses.length+")"]].map(o=><button key={o[0]} onClick={()=>setTab(o[0])} style={{padding:"7px 12px",borderRadius:8,border:"1px solid "+(tab===o[0]?T.primary:T.border),background:tab===o[0]?T.primary:T.card,color:tab===o[0]?"#fff":T.muted,cursor:"pointer",fontSize:12,fontWeight:tab===o[0]?700:400}}>{o[1]}</button>)}</div>
    {tab==="infos"&&<div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12}}>
      <Card title="Informations" T={T}>{[["Nom",c.nom],["Client",c.client||"-"],["Localisation",c.localisation||"-"],["Type",c.type||"-"],["Début",c.date_debut||"-"],["Fin prévue",c.date_fin||"-"],["Description",c.description||"-"]].map(row=><div key={row[0]} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid "+T.border,fontSize:12}}><span style={{color:T.muted}}>{row[0]}</span><span style={{fontWeight:600}}>{row[1]}</span></div>)}</Card>
      <Card title="Budget" T={T}><div style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}><span style={{color:T.muted}}>Avancement</span><strong style={{color:dp>100?T.danger:dp>80?T.warning:T.success}}>{dp}%</strong></div><PBar p={dp} color={dp>100?T.danger:dp>80?T.warning:T.success} h={12}/></div>{[["Budget initial",fmt(c.budgetInitial),T.white],["Dépenses",fmt(dep),T.warning],["Marge",fmt(c.budgetInitial-dep),c.budgetInitial-dep>=0?T.success:T.danger]].map(row=><div key={row[0]} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid "+T.border,fontSize:12}}><span style={{color:T.muted}}>{row[0]}</span><span style={{fontWeight:700,color:row[2]}}>{row[1]}</span></div>)}</Card>
    </div>}
    {tab==="depenses"&&<div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div style={{display:"flex",justifyContent:"flex-end",gap:6}}><button onClick={exportFiche} style={expBtn(T.success)}>📥 CSV dépenses</button><button onClick={()=>{setLines([newDepLine()]);setShowDep(true);}} style={{background:T.primary,color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",fontWeight:700,cursor:"pointer",fontSize:12}}>+ Saisie multi-lignes</button></div>
      {c.depenses.length===0&&<Empty msg="Aucune dépense" icon="🧾"/>}
      {c.depenses.map(d=><div key={d.id} style={{background:T.card,border:"1px solid "+T.border,borderRadius:9,padding:"10px 12px",display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}><div style={{flex:1}}><div style={{fontWeight:700,fontSize:13}}>{d.libelle}</div><div style={{display:"flex",gap:6,marginTop:4}}><Badge label={d.categorie} color={catC(d.categorie,T)} small/><span style={{fontSize:10,color:T.muted}}>{d.date}</span>{d.note&&<span style={{fontSize:10,color:T.muted}}>{d.note}</span>}</div></div><div style={{display:"flex",gap:5,alignItems:"center"}}><span style={{fontWeight:800,color:T.primary,fontSize:13}}>{fmt(d.montant)}</span><button onClick={()=>delDep(d.id)} style={{background:T.danger+"22",border:"none",color:T.danger,borderRadius:5,padding:"3px 7px",fontSize:10,cursor:"pointer"}}>✕</button></div></div>)}
      {showDep&&<Modal title="Saisie dépenses multi-lignes" onClose={()=>setShowDep(false)} onSave={saveDeps} saveLabel={"Enregistrer "+lines.filter(l=>l.libelle&&l.montant).length+" ligne(s)"} T={T} wide>
        {saving?<Spin/>:<>
          <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:600}}><thead><tr style={{background:T.mid}}>{["Libellé *","Catégorie","Montant *","Date","Note",""].map((h,i)=><th key={i} style={{padding:"7px 8px",textAlign:"left",fontSize:10,color:T.muted,fontWeight:600}}>{h}</th>)}</tr></thead><tbody>{lines.map(l=>{const iS={background:T.bg,border:"1px solid "+T.border,borderRadius:5,padding:"6px 8px",color:T.white,fontSize:12,outline:"none",width:"100%"};return <tr key={l.id} style={{borderBottom:"1px solid "+T.border+"44"}}><td style={{padding:"4px"}}><input value={l.libelle} onChange={e=>upLine(l.id,"libelle",e.target.value)} placeholder="ex: Béton B25" style={iS}/></td><td style={{padding:"4px"}}><select value={l.categorie} onChange={e=>upLine(l.id,"categorie",e.target.value)} style={iS}>{CATS.map(c=><option key={c} value={c}>{c}</option>)}</select></td><td style={{padding:"4px"}}><input type="number" value={l.montant} onChange={e=>upLine(l.id,"montant",e.target.value)} style={{...iS,width:110}}/></td><td style={{padding:"4px"}}><input type="date" value={l.date} onChange={e=>upLine(l.id,"date",e.target.value)} style={{...iS,width:130}}/></td><td style={{padding:"4px"}}><input value={l.note} onChange={e=>upLine(l.id,"note",e.target.value)} style={iS}/></td><td style={{padding:"4px"}}><button onClick={()=>setLines(p=>p.length>1?p.filter(x=>x.id!==l.id):p)} style={{background:T.danger+"22",color:T.danger,border:"none",borderRadius:5,padding:"5px 8px",cursor:"pointer"}}>✕</button></td></tr>;})}</tbody></table></div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10}}><button onClick={()=>setLines(p=>[...p,newDepLine()])} style={{background:T.success+"22",color:T.success,border:"1px solid "+T.success+"44",borderRadius:7,padding:"7px 14px",fontWeight:700,cursor:"pointer",fontSize:12}}>+ Ligne</button>{totalS>0&&<div style={{fontWeight:700,color:T.primary,fontSize:13}}>Total : {fmt(totalS)}</div>}</div>
        </>}
      </Modal>}
    </div>}
  </div>;
}

// ── DÉBOURS SEC ───────────────────────────────────────────────────────────────
function Debourse({sessions,taches,ch,reload,T,isMobile}){
  const [selSid,setSelSid]=useState(null);const [showNew,setShowNew]=useState(false);const [sForm,setSForm]=useState({nom:"",chantier_id:"",taux_charges:40,coeff_fg:15,coeff_benef:10,description:""});const [saving,setSaving]=useState(false);const [editNom,setEditNom]=useState(null);const [newNom,setNewNom]=useState("");
  const selSess=sessions.find(s=>s.id===selSid);const selTaches=selSid?taches.filter(t=>t.session_id===selSid):[];
  function saveSession(){if(!sForm.nom)return;setSaving(true);sb("debourse_sessions").insert({nom:sForm.nom,chantier_id:sForm.chantier_id||null,taux_charges:parseFloat(sForm.taux_charges)||40,coeff_fg:parseFloat(sForm.coeff_fg)||15,coeff_benef:parseFloat(sForm.coeff_benef)||10,description:sForm.description}).then(r=>{setSaving(false);setShowNew(false);reload();if(r.data)setSelSid(r.data.id);});}
  function delSession(id){if(!window.confirm("Supprimer ?"))return;sb("debourse_taches").eq("session_id",id).del().then(()=>sb("debourse_sessions").eq("id",id).del().then(()=>{if(selSid===id)setSelSid(null);reload();}));}
  function renameSession(id){if(!newNom.trim())return;sb("debourse_sessions").eq("id",id).update({nom:newNom.trim()}).then(()=>{setEditNom(null);reload();});}
  function updateCfg(id,k,v){const u={};u[k]=parseFloat(v)||0;sb("debourse_sessions").eq("id",id).update(u).then(()=>reload());}
  return <div style={{display:"flex",flexDirection:"column",gap:14}}>
    <Card title="📁 Fichiers Débours Sec" action={<button onClick={()=>setShowNew(true)} style={{background:T.primary,color:"#fff",border:"none",borderRadius:7,padding:"7px 14px",fontWeight:700,cursor:"pointer",fontSize:12}}>+ Nouveau fichier</button>} T={T}>
      {sessions.length===0?<Empty msg="Aucun fichier." icon="📁"/>:<div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(200px,1fr))",gap:10}}>
        {sessions.map(s=>{const sts=taches.filter(t=>t.session_id===s.id);const lignes=sts.filter(t=>t.niveau===3);const totalPV=sts.filter(t=>t.niveau===1).reduce((a,t)=>a+(t.prix_vente_total||0),0);const totalDS=lignes.reduce((a,t)=>a+(t.debourse_sec_u||0)*(t.quantite||0),0);const active=selSid===s.id;const chNom=(ch.find(c=>c.id===s.chantier_id)||{}).nom||"";
          return <div key={s.id} style={{background:active?T.primary+"22":T.mid,border:"2px solid "+(active?T.primary:T.border),borderRadius:10,padding:"12px 14px",cursor:"pointer"}} onClick={()=>setSelSid(s.id)}>
            {editNom===s.id?<div onClick={e=>e.stopPropagation()} style={{display:"flex",flexDirection:"column",gap:5}}><input value={newNom} onChange={e=>setNewNom(e.target.value)} autoFocus style={{background:T.bg,border:"1px solid "+T.primary,borderRadius:5,padding:"5px 8px",color:T.white,fontSize:13,outline:"none"}} onKeyDown={e=>{if(e.key==="Enter")renameSession(s.id);if(e.key==="Escape")setEditNom(null);}}/><div style={{display:"flex",gap:4}}><button onClick={()=>renameSession(s.id)} style={{flex:1,background:T.success,color:"#fff",border:"none",borderRadius:5,padding:"5px",fontSize:11,cursor:"pointer",fontWeight:700}}>✔</button><button onClick={()=>setEditNom(null)} style={{background:T.mid,color:T.muted,border:"none",borderRadius:5,padding:"5px 8px",fontSize:11,cursor:"pointer"}}>✕</button></div></div>
            :<><div style={{fontWeight:800,fontSize:13,color:active?T.primary:T.white,marginBottom:4}}>{s.nom}</div>{chNom&&<div style={{fontSize:10,color:T.muted,marginBottom:4}}>🏗 {chNom}</div>}<div style={{fontSize:10,color:T.muted}}>{sts.length} lignes · {lignes.length} postes</div><div style={{fontSize:12,fontWeight:800,color:T.success,marginTop:6}}>{fmtS(totalPV)} XOF</div><div style={{fontSize:10,color:T.muted}}>DS: {fmtS(totalDS)}</div><div style={{display:"flex",gap:4,marginTop:8}} onClick={e=>e.stopPropagation()}><button onClick={()=>setSelSid(s.id)} style={{flex:1,background:active?T.primary:T.secondary+"22",color:active?"#fff":T.secondary,border:"none",borderRadius:6,padding:"5px",fontSize:10,cursor:"pointer",fontWeight:600}}>📂 Ouvrir</button><button onClick={()=>{setEditNom(s.id);setNewNom(s.nom);}} style={{background:T.warning+"22",color:T.warning,border:"none",borderRadius:6,padding:"5px 8px",fontSize:11,cursor:"pointer"}}>✏️</button><button onClick={()=>delSession(s.id)} style={{background:T.danger+"22",color:T.danger,border:"none",borderRadius:6,padding:"5px 8px",fontSize:11,cursor:"pointer"}}>🗑</button></div></>}
          </div>;})}
      </div>}
    </Card>
    {selSess&&<DebourseEditor key={selSid} sess={selSess} taches={selTaches} ch={ch} reload={reload} T={T} isMobile={isMobile} updateCfg={updateCfg} onClose={()=>setSelSid(null)}/>}
    {showNew&&<Modal title="📁 Nouveau fichier Débours Sec" onClose={()=>setShowNew(false)} onSave={saveSession} T={T}>{saving?<Spin/>:<div style={{display:"flex",flexDirection:"column",gap:10}}><FF label="Nom *" value={sForm.nom} onChange={v=>setSForm(p=>({...p,nom:v}))} full T={T}/><FS label="Chantier lié" value={sForm.chantier_id} onChange={v=>setSForm(p=>({...p,chantier_id:v}))} options={[["","— Aucun —"],...ch.map(c=>[c.id,c.nom])]} full T={T}/><FF label="Description" value={sForm.description} onChange={v=>setSForm(p=>({...p,description:v}))} rows={2} full T={T}/><div style={{background:T.mid,borderRadius:8,padding:"10px",display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}><div style={{fontSize:10,color:T.muted,gridColumn:"1/-1",fontWeight:600}}>Coefficients</div><FF label="Charges (%)" type="number" value={sForm.taux_charges} onChange={v=>setSForm(p=>({...p,taux_charges:v}))} T={T}/><FF label="FG (%)" type="number" value={sForm.coeff_fg} onChange={v=>setSForm(p=>({...p,coeff_fg:v}))} T={T}/><FF label="Bénéfice (%)" type="number" value={sForm.coeff_benef} onChange={v=>setSForm(p=>({...p,coeff_benef:v}))} T={T}/></div></div>}</Modal>}
  </div>;
}

function DebourseEditor({sess,taches:rawTaches,ch,reload,T,isMobile,updateCfg,onClose}){
  const cfg={tc:sess.taux_charges||40,fg:sess.coeff_fg||15,benef:sess.coeff_benef||10};
  const taches=renum([...rawTaches].sort((a,b)=>(a.ordre||0)-(b.ordre||0)));
  const cats1=taches.filter(t=>t.niveau===1);
  const [modal,setModal]=useState(null);const [form,setForm]=useState({});const [saving,setSaving]=useState(false);const [cfgLocal,setCfgLocal]=useState({tc:cfg.tc,fg:cfg.fg,benef:cfg.benef});
  const postes=taches.filter(t=>t.niveau===3);
  const grandDS=postes.reduce((a,t)=>a+(t.debourse_sec_u||0)*(t.quantite||0),0);
  const grandPV=cats1.reduce((a,t)=>a+(t.prix_vente_total||0),0);
  const chNom=(ch.find(c=>c.id===sess.chantier_id)||{}).nom||"";
  const pDS=calcDS(form.mo_u,form.mat_u,form.autres_u,cfg);
  const pPV=calcPV(pDS,cfg);
  const pTot=pPV*(parseFloat(form.quantite)||0);

  function openAddCat(){setForm({libelle:""});setModal("cat");}
  function openAddSubcat(pid){setForm({libelle:"",parent_id:pid});setModal("subcat");}
  function openAddPoste(pid){setForm({libelle:"",unite:"U",quantite:"",mo_u:"",mat_u:"",autres_u:"",pu_doc:"",parent_id:pid});setModal("poste");}
  function openEdit(t){if(t.niveau===1)setModal("editcat");else if(t.niveau===2)setModal("editsubcat");else setModal("editposte");setForm({id:t.id,libelle:t.libelle,unite:t.unite||"U",quantite:t.quantite||"",mo_u:t.mo_u||"",mat_u:t.mat_u||"",autres_u:t.autres_u||"",pu_doc:t.pu_doc||"",parent_id:t.parent_id});}
  async function saveCat(){if(!form.libelle)return;setSaving(true);await sb("debourse_taches").insert({session_id:sess.id,libelle:form.libelle,niveau:1,ordre:(cats1.length+1)*100,prix_vente_total:0});setSaving(false);setModal(null);reload();}
  async function saveSubcat(){if(!form.libelle)return;setSaving(true);const sib=taches.filter(t=>t.niveau===2&&t.parent_id===form.parent_id);await sb("debourse_taches").insert({session_id:sess.id,libelle:form.libelle,niveau:2,parent_id:form.parent_id||null,ordre:(form.parent_id||0)*100+(sib.length+1)*10,prix_vente_total:0});setSaving(false);setModal(null);reload();}
  async function savePoste(){if(!form.libelle)return;setSaving(true);const qte=parseFloat(form.quantite)||0;const ds=calcDS(form.mo_u,form.mat_u,form.autres_u,cfg);const pv=calcPV(ds,cfg);const sib=taches.filter(t=>t.niveau===3&&t.parent_id===form.parent_id);await sb("debourse_taches").insert({session_id:sess.id,libelle:form.libelle,niveau:3,parent_id:form.parent_id||null,ordre:(form.parent_id||0)*100+(sib.length+1),unite:form.unite||"U",quantite:qte,mo_u:parseFloat(form.mo_u)||0,mat_u:parseFloat(form.mat_u)||0,autres_u:parseFloat(form.autres_u)||0,pu_doc:parseFloat(form.pu_doc)||0,debourse_sec_u:Math.round(ds),prix_vente_u:Math.round(pv),prix_vente_total:Math.round(pv*qte)});setSaving(false);setModal(null);reload();}
  async function updateItem(){if(!form.libelle)return;setSaving(true);const qte=parseFloat(form.quantite)||0;const ds=calcDS(form.mo_u,form.mat_u,form.autres_u,cfg);const pv=calcPV(ds,cfg);const isL=modal==="editposte";await sb("debourse_taches").eq("id",form.id).update(isL?{libelle:form.libelle,unite:form.unite||"U",quantite:qte,mo_u:parseFloat(form.mo_u)||0,mat_u:parseFloat(form.mat_u)||0,autres_u:parseFloat(form.autres_u)||0,pu_doc:parseFloat(form.pu_doc)||0,debourse_sec_u:Math.round(ds),prix_vente_u:Math.round(pv),prix_vente_total:Math.round(pv*qte)}:{libelle:form.libelle});setSaving(false);setModal(null);reload();}
  async function delTache(t){if(!window.confirm("Supprimer \""+t.libelle+"\" ?"))return;const enfants=taches.filter(x=>x.parent_id===t.id);for(const e of enfants){for(const p of taches.filter(x=>x.parent_id===e.id))await sb("debourse_taches").eq("id",p.id).del();await sb("debourse_taches").eq("id",e.id).del();}await sb("debourse_taches").eq("id",t.id).del();reload();}
  async function saveCfg(){await sb("debourse_sessions").eq("id",sess.id).update({taux_charges:cfgLocal.tc,coeff_fg:cfgLocal.fg,coeff_benef:cfgLocal.benef});setModal(null);reload();}
  function exportCSVDebourse(){const rows=taches.map(t=>({Num:t.num||"",Désignation:t.libelle,Niveau:t.niveau,Qté:t.quantite||"",Unité:t.unite||"","MO/u":t.mo_u||0,"Mat/u":t.mat_u||0,"Matériel/u":t.autres_u||0,"DS/u":t.debourse_sec_u||0,"PV total":t.prix_vente_total||0}));exportCSV(rows,sess.nom);}
  function printDebourse(){
    const rows=taches.map(t=>{const isCat=t.niveau===1,isSS=t.niveau===2,isL=t.niveau===3;const bg=isCat?"background:#F9731622":isSS?"background:#3B82F611":"";const fw=isCat?"font-weight:800":isSS?"font-weight:700":"";return `<tr style="${bg}"><td style="padding-left:${isCat?4:isSS?16:32}px;${fw}">${t.num||""}</td><td style="padding-left:${isCat?4:isSS?16:32}px;${fw}">${t.libelle}</td><td style="text-align:right">${isL?t.quantite||"":""}</td><td>${isL?t.unite||"":""}</td><td style="text-align:right">${isL?fmtN(t.mo_u||0):""}</td><td style="text-align:right">${isL?fmtN(t.mat_u||0):""}</td><td style="text-align:right">${isL?fmtN(t.autres_u||0):""}</td><td style="text-align:right;font-weight:700">${isL?fmtN(t.debourse_sec_u||0):""}</td><td style="text-align:right;font-weight:800">${fmtN(t.prix_vente_total||0)}</td></tr>`;}).join("");
    const html=`<h1>Débours Sec — ${sess.nom}</h1>${chNom?`<p>Chantier : <strong>${chNom}</strong></p>`:""}<p>TC: ${cfg.tc}% · FG: ${cfg.fg}% · Bénéfice: ${cfg.benef}%</p><div class="kpi-grid"><div class="kpi"><div class="kpi-val">${fmtS(grandDS)}</div><div class="kpi-lbl">Débours sec</div></div><div class="kpi"><div class="kpi-val">${fmtS(grandPV)}</div><div class="kpi-lbl">Prix vente HT</div></div><div class="kpi"><div class="kpi-val">${fmtS(grandPV-grandDS)}</div><div class="kpi-lbl">Marge brute</div></div><div class="kpi"><div class="kpi-val">${cfg.benef}%</div><div class="kpi-lbl">Coeff bénéfice</div></div></div><table><thead><tr><th>N°</th><th>Désignation</th><th>Qté</th><th>U</th><th>MO/u</th><th>Mat/u</th><th>Matériel/u</th><th>DS/u</th><th>PV total</th></tr></thead><tbody>${rows}<tr class="total"><td colspan="7">TOTAL</td><td>${fmtN(grandDS)} XOF</td><td>${fmtN(grandPV)} XOF</td></tr></tbody></table>`;
    printHTML(html,sess.nom);
  }
  function btnS(color){return {background:color+"22",color:color,border:"none",borderRadius:5,padding:"3px 6px",fontSize:10,cursor:"pointer",fontWeight:600};}
  function renderT(t){
    const isCat=t.niveau===1,isSS=t.niveau===2,isLine=t.niveau===3;
    const children=isCat?taches.filter(x=>x.parent_id===t.id&&x.niveau===2):isSS?taches.filter(x=>x.parent_id===t.id&&x.niveau===3):[];
    const bgS=isCat?{background:"#F9731622",borderTop:"2px solid #F9731655"}:isSS?{background:"#3B82F611",borderTop:"1px solid #3B82F622"}:{};
    const detailCells=isLine
      ?[<td key="q" style={{padding:"7px 5px",textAlign:"right",fontSize:11}}>{fmtN(t.quantite)}</td>,
        <td key="u" style={{padding:"7px 5px",textAlign:"center",fontSize:10,color:T.muted}}>{t.unite}</td>,
        <td key="mat" style={{padding:"7px 5px",textAlign:"right",fontSize:11,color:T.secondary}}>{fmtN(t.mat_u)}</td>,
        <td key="mo" style={{padding:"7px 5px",textAlign:"right",fontSize:11,color:T.success}}>{fmtN(Math.round((t.mo_u||0)*(1+cfg.tc/100)))}</td>,
        <td key="aut" style={{padding:"7px 5px",textAlign:"right",fontSize:11,color:T.muted}}>{fmtN(t.autres_u)}</td>,
        <td key="ds" style={{padding:"7px 5px",textAlign:"right",fontSize:11,fontWeight:700,color:T.warning}}>{fmtN(t.debourse_sec_u)}</td>,
        <td key="pv" style={{padding:"7px 5px",textAlign:"right",fontSize:12,fontWeight:800,color:T.success}}>{fmtN(t.prix_vente_total)}</td>]
      :[<td key="sp" colSpan={6} style={{padding:"7px 5px"}}/>,
        <td key="pvt" style={{padding:"7px 5px",textAlign:"right",fontWeight:800,fontSize:isCat?13:12,color:isCat?T.primary:T.secondary}}>{fmtN(t.prix_vente_total)}</td>];
    const row=<tr key={t.id} style={{...bgS,borderBottom:"1px solid "+T.border+"33"}}>
      <td style={{padding:"7px 6px",fontSize:10,color:T.muted,fontWeight:700,width:40}}>{t.num}</td>
      <td style={{padding:"7px 6px",paddingLeft:isCat?8:isSS?22:40}}><span style={{fontWeight:isCat?800:isSS?700:400,fontSize:isCat?13:isSS?12:11,color:isCat?T.primary:isSS?T.secondary:T.white}}>{t.libelle}</span></td>
      {detailCells}
      <td style={{padding:"4px 5px",whiteSpace:"nowrap"}}><div style={{display:"flex",gap:3,justifyContent:"flex-end"}}>
        {isCat&&<button onClick={()=>openAddSubcat(t.id)} style={btnS(T.secondary)}>+SC</button>}
        {isSS&&<button onClick={()=>openAddPoste(t.id)} style={btnS(T.success)}>+P</button>}
        <button onClick={()=>openEdit(t)} style={btnS(T.warning)}>✏</button>
        <button onClick={()=>delTache(t)} style={btnS(T.danger)}>X</button>
      </div></td>
    </tr>;
    return [row,...children.flatMap(c=>renderT(c))];
  }
  const isPosteModal=modal==="poste"||modal==="editposte";
  const isNomModal=modal==="cat"||modal==="editcat"||modal==="subcat"||modal==="editsubcat";
  return <div style={{display:"flex",flexDirection:"column",gap:12}}>
    <div style={{background:T.card,border:"1px solid "+T.primary+"44",borderRadius:T.borderRadius,padding:"14px 16px"}}>
      <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:10,alignItems:"flex-start"}}>
        <div><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}><button onClick={onClose} style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:18,padding:0}}>←</button><div style={{fontWeight:800,fontSize:16,color:T.primary}}>{sess.nom}</div></div>{chNom&&<div style={{fontSize:11,color:T.muted}}>🏗 {chNom}</div>}</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          <button onClick={()=>{setCfgLocal({tc:cfg.tc,fg:cfg.fg,benef:cfg.benef});setModal("cfg");}} style={expBtn(T.muted)}>⚙️ Coefficients</button>
          <button onClick={exportCSVDebourse} style={expBtn(T.success)}>📥 CSV</button>
          <button onClick={printDebourse} style={expBtn(T.secondary)}>🖨️ PDF</button>
          <button onClick={openAddCat} style={{background:T.primary,color:"#fff",border:"none",borderRadius:7,padding:"6px 14px",fontWeight:700,cursor:"pointer",fontSize:12}}>+ Catégorie</button>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)",gap:8,marginTop:14}}>
        {[["DS",grandDS,T.warning],["PV HT",grandPV,T.success],["Marge",grandPV-grandDS,T.primary],["Lignes",postes.length,T.secondary]].map(([l,v,c])=><div key={l} style={{background:c+"11",border:"1px solid "+c+"33",borderRadius:7,padding:"8px 10px",textAlign:"center"}}><div style={{fontSize:9,color:T.muted}}>{l}</div><div style={{fontWeight:800,fontSize:13,color:c}}>{typeof v==="number"&&v>100?fmtS(v):v}</div></div>)}
      </div>
    </div>
    {taches.length===0?<Empty msg="Commencez par créer une catégorie" icon="📋"/>:
    <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:T.borderRadius,overflow:"hidden"}}><div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:800}}>
        <thead><tr style={{background:"#1a1a1a"}}>{["N°","Désignation","Qté","U","Matériaux","MO chargée","Matériel","DS/u","PV total",""].map((h,i)=><th key={i} style={{padding:"9px 5px",textAlign:i>3?"right":"left",color:T.muted,fontSize:9,fontWeight:600,whiteSpace:"nowrap",borderBottom:"1px solid "+T.border}}>{h}</th>)}</tr></thead>
        <tbody>{cats1.flatMap(t=>renderT(t))}<tr style={{background:T.primary+"22",borderTop:"2px solid "+T.primary}}><td colSpan={7} style={{padding:"8px",fontWeight:800,color:T.primary}}>TOTAL</td><td style={{padding:"8px",textAlign:"right",fontWeight:800,color:T.warning}}>{fmtN(grandDS)}</td><td style={{padding:"8px",textAlign:"right",fontWeight:800,color:T.success}}>{fmtN(grandPV)}</td><td/></tr></tbody>
      </table>
    </div></div>}
    {modal==="cfg"&&<Modal title="Coefficients" onClose={()=>setModal(null)} onSave={saveCfg} T={T}><FG cols={3}><FF label="Taux charges (%)" type="number" value={cfgLocal.tc} onChange={v=>setCfgLocal(p=>({...p,tc:v}))} T={T}/><FF label="Frais généraux (%)" type="number" value={cfgLocal.fg} onChange={v=>setCfgLocal(p=>({...p,fg:v}))} T={T}/><FF label="Bénéfice (%)" type="number" value={cfgLocal.benef} onChange={v=>setCfgLocal(p=>({...p,benef:v}))} T={T}/></FG></Modal>}
    {isNomModal&&<Modal title={modal.startsWith("edit")?"Modifier":"Ajouter"} onClose={()=>setModal(null)} onSave={modal==="cat"?saveCat:modal==="subcat"?saveSubcat:updateItem} T={T}><FF label="Libellé *" value={form.libelle} onChange={v=>setForm(p=>({...p,libelle:v}))} full T={T}/></Modal>}
    {isPosteModal&&<Modal title={modal==="poste"?"Nouveau poste":"Modifier poste"} onClose={()=>setModal(null)} onSave={modal==="poste"?savePoste:updateItem} T={T} wide>
      {saving?<Spin/>:<><FG cols={2}>
        <FF label="Libellé *" value={form.libelle} onChange={v=>setForm(p=>({...p,libelle:v}))} full T={T}/>
        <FS label="Unité" value={form.unite} onChange={v=>setForm(p=>({...p,unite:v}))} options={UNITES} T={T}/>
        <FF label="Quantité" type="number" value={form.quantite} onChange={v=>setForm(p=>({...p,quantite:v}))} T={T}/>
        <FF label="MO brute/u (XOF)" type="number" value={form.mo_u} onChange={v=>setForm(p=>({...p,mo_u:v}))} T={T}/>
        <FF label="Matériaux/u (XOF)" type="number" value={form.mat_u} onChange={v=>setForm(p=>({...p,mat_u:v}))} T={T}/>
        <FF label="Matériel/u (XOF)" type="number" value={form.autres_u} onChange={v=>setForm(p=>({...p,autres_u:v}))} T={T}/>
        <FF label="PU doc. (XOF)" type="number" value={form.pu_doc} onChange={v=>setForm(p=>({...p,pu_doc:v}))} T={T}/>
      </FG>
      {(parseFloat(form.quantite)>0||parseFloat(form.mo_u)>0||parseFloat(form.mat_u)>0)&&<div style={{background:T.mid,borderRadius:8,padding:"10px",marginTop:10,display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
        <div style={{textAlign:"center"}}><div style={{fontSize:9,color:T.muted}}>DS/u</div><div style={{fontWeight:800,color:T.warning,fontSize:13}}>{fmtN(Math.round(pDS))}</div></div>
        <div style={{textAlign:"center"}}><div style={{fontSize:9,color:T.muted}}>PV/u</div><div style={{fontWeight:800,color:T.success,fontSize:13}}>{fmtN(Math.round(pPV))}</div></div>
        <div style={{textAlign:"center"}}><div style={{fontSize:9,color:T.muted}}>PV total</div><div style={{fontWeight:800,color:T.primary,fontSize:13}}>{fmtN(Math.round(pTot))}</div></div>
      </div>}</>}
    </Modal>}
  </div>;
}

// ── INTERVENTIONS ─────────────────────────────────────────────────────────────
function IntervCard({i,ch,reload,T}){
  const [open,setOpen]=useState(false);
  const [showDep,setShowDep]=useState(false);
  const [showEdit,setShowEdit]=useState(false);
  const [lines,setLines]=useState([newDepLine()]);
  const [savingDep,setSavingDep]=useState(false);
  const [form,setForm]=useState({titre:i.titre,type:i.type,statut:i.statut,chantier_id:i.chantier_id||"",responsable:i.responsable||"",date_debut:i.date_debut||"",date_fin:i.date_fin||"",description:i.description||""});
  const chNom=(ch.find(c=>c.id===i.chantier_id)||{}).nom||"";
  const cout=totalDepI(i);
  function changeSt(st){sb("interventions").eq("id",i.id).update({statut:st}).then(()=>reload());}
  function del(){if(!window.confirm("Supprimer cette intervention ?"))return;sb("intervention_depenses").eq("intervention_id",i.id).del().then(()=>sb("interventions").eq("id",i.id).del().then(()=>reload()));}
  function upLine(id,k,v){setLines(prev=>prev.map(l=>l.id===id?{...l,[k]:v}:l));}
  async function saveDeps(){
    const valid=lines.filter(l=>l.libelle&&l.montant);
    if(!valid.length)return;
    setSavingDep(true);
    for(const l of valid){
      await sb("intervention_depenses").insert({intervention_id:i.id,libelle:l.libelle,categorie:l.categorie,montant:parseFloat(l.montant),date:l.date,note:l.note||""});
    }
    setSavingDep(false);setShowDep(false);setLines([newDepLine()]);reload();
  }
  function delDep(id){sb("intervention_depenses").eq("id",id).del().then(()=>reload());}
  function saveEdit(){
    sb("interventions").eq("id",i.id).update({titre:form.titre,type:form.type,statut:form.statut,chantier_id:form.chantier_id||null,responsable:form.responsable||null,date_debut:form.date_debut||null,date_fin:form.date_fin||null,description:form.description||null})
    .then(()=>{setShowEdit(false);reload();});
  }
  const totalS=lines.reduce((a,l)=>a+(parseFloat(l.montant)||0),0);
  const iS={background:"#1C1917",border:"1px solid #57534E",borderRadius:5,padding:"6px 8px",color:"#FAFAF9",fontSize:12,outline:"none",width:"100%"};
  return <div style={{background:T.card,border:"1px solid "+(i.statut==="En derive"?T.danger+"66":T.border),borderRadius:T.borderRadius}}>
    {/* EN-TÊTE */}
    <div style={{padding:"14px 16px"}}>
      <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8,marginBottom:8}}>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,fontSize:14}}>{i.titre}</div>
          <div style={{fontSize:11,color:T.muted,marginTop:2}}>
            {chNom&&<span>🏗 {chNom} </span>}{i.responsable&&<span>· 👷 {i.responsable} </span>}{i.date_debut&&<span>· 📅 {i.date_debut}</span>}
          </div>
        </div>
        <div style={{display:"flex",gap:4,flexWrap:"wrap",alignItems:"center"}}>
          {STATUTS_INT.map(st=><button key={st} onClick={()=>changeSt(st)} style={{padding:"3px 8px",borderRadius:20,border:"1px solid "+(i.statut===st?intStC(st,T):T.border),background:i.statut===st?intStC(st,T)+"33":"transparent",color:i.statut===st?intStC(st,T):T.muted,cursor:"pointer",fontSize:10,fontWeight:i.statut===st?700:400}}>{st}</button>)}
        </div>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6}}>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          <Badge label={i.type} color={T.warning} small/>
          <Badge label={i.statut} color={intStC(i.statut,T)} small/>
          {cout>0&&<Badge label={fmt(cout)} color={T.primary} small/>}
          <Badge label={(i.depenses||[]).length+" dépense(s)"} color={T.muted} small/>
        </div>
        <div style={{display:"flex",gap:5}}>
          <button onClick={()=>setOpen(p=>!p)} style={{background:T.secondary+"22",color:T.secondary,border:"1px solid "+T.secondary+"44",borderRadius:6,padding:"4px 10px",fontSize:11,cursor:"pointer",fontWeight:600}}>{open?"▲ Réduire":"▼ Détails"}</button>
          <button onClick={()=>setShowEdit(true)} style={{background:T.warning+"22",color:T.warning,border:"none",borderRadius:6,padding:"4px 8px",fontSize:11,cursor:"pointer"}}>✏️</button>
          <button onClick={del} style={{background:T.danger+"22",color:T.danger,border:"none",borderRadius:6,padding:"4px 8px",fontSize:11,cursor:"pointer"}}>🗑</button>
        </div>
      </div>
    </div>
    {/* DÉTAILS DÉPLIABLES */}
    {open&&<div style={{borderTop:"1px solid "+T.border,padding:"12px 16px"}}>
      {i.description&&<div style={{fontSize:12,color:T.muted,marginBottom:10,fontStyle:"italic"}}>{i.description}</div>}
      {i.date_fin&&<div style={{fontSize:11,color:T.muted,marginBottom:8}}>Date fin : {i.date_fin}</div>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div style={{fontWeight:700,fontSize:12}}>Dépenses ({(i.depenses||[]).length})</div>
        <button onClick={()=>{setLines([newDepLine()]);setShowDep(true);}} style={{background:T.primary,color:"#fff",border:"none",borderRadius:6,padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>+ Ajouter dépenses</button>
      </div>
      {(i.depenses||[]).length===0&&<div style={{textAlign:"center",padding:"12px",color:T.muted,fontSize:12}}>Aucune dépense enregistrée</div>}
      {(i.depenses||[]).map(d=><div key={d.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid "+T.border+"33"}}>
        <div><div style={{fontWeight:600,fontSize:12}}>{d.libelle}</div><div style={{display:"flex",gap:5,marginTop:2}}><Badge label={d.categorie} color={catC(d.categorie,T)} small/><span style={{fontSize:10,color:T.muted}}>{d.date}</span>{d.note&&<span style={{fontSize:10,color:T.muted}}>— {d.note}</span>}</div></div>
        <div style={{display:"flex",gap:5,alignItems:"center"}}><span style={{fontWeight:800,color:T.primary,fontSize:13}}>{fmt(d.montant)}</span><button onClick={()=>delDep(d.id)} style={{background:T.danger+"22",border:"none",color:T.danger,borderRadius:5,padding:"3px 7px",fontSize:10,cursor:"pointer"}}>✕</button></div>
      </div>)}
      {cout>0&&<div style={{display:"flex",justifyContent:"flex-end",marginTop:8}}><span style={{fontWeight:800,color:T.success,fontSize:13}}>Total : {fmt(cout)}</span></div>}
    </div>}
    {/* MODAL DÉPENSES */}
    {showDep&&<Modal title="Ajouter des dépenses" onClose={()=>setShowDep(false)} onSave={saveDeps} saveLabel={"Enregistrer "+lines.filter(l=>l.libelle&&l.montant).length+" ligne(s)"} T={T} wide>
      {savingDep?<Spin/>:<>
        <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:560}}><thead><tr style={{background:T.mid}}>{["Libellé *","Catégorie","Montant *","Date","Note",""].map((h,idx)=><th key={idx} style={{padding:"7px 8px",textAlign:"left",fontSize:10,color:T.muted,fontWeight:600}}>{h}</th>)}</tr></thead>
        <tbody>{lines.map(l=><tr key={l.id} style={{borderBottom:"1px solid "+T.border+"44"}}>
          <td style={{padding:"4px"}}><input value={l.libelle} onChange={e=>upLine(l.id,"libelle",e.target.value)} placeholder="ex: Pièce de rechange" style={iS}/></td>
          <td style={{padding:"4px"}}><select value={l.categorie} onChange={e=>upLine(l.id,"categorie",e.target.value)} style={iS}>{CATS.map(c=><option key={c} value={c}>{c}</option>)}</select></td>
          <td style={{padding:"4px"}}><input type="number" value={l.montant} onChange={e=>upLine(l.id,"montant",e.target.value)} style={{...iS,width:110}}/></td>
          <td style={{padding:"4px"}}><input type="date" value={l.date} onChange={e=>upLine(l.id,"date",e.target.value)} style={{...iS,width:130}}/></td>
          <td style={{padding:"4px"}}><input value={l.note} onChange={e=>upLine(l.id,"note",e.target.value)} style={iS}/></td>
          <td style={{padding:"4px"}}><button onClick={()=>setLines(p=>p.length>1?p.filter(x=>x.id!==l.id):p)} style={{background:T.danger+"22",color:T.danger,border:"none",borderRadius:5,padding:"5px 8px",cursor:"pointer"}}>✕</button></td>
        </tr>)}</tbody></table></div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10}}>
          <button onClick={()=>setLines(p=>[...p,newDepLine()])} style={{background:T.success+"22",color:T.success,border:"1px solid "+T.success+"44",borderRadius:7,padding:"7px 14px",fontWeight:700,cursor:"pointer",fontSize:12}}>+ Ligne</button>
          {totalS>0&&<div style={{fontWeight:700,color:T.primary,fontSize:13}}>Total : {fmt(totalS)}</div>}
        </div>
      </>}
    </Modal>}
    {/* MODAL MODIFIER */}
    {showEdit&&<Modal title="Modifier l'intervention" onClose={()=>setShowEdit(false)} onSave={saveEdit} T={T}>
      <FG cols={2}>
        <FF label="Titre *" value={form.titre} onChange={v=>setForm(p=>({...p,titre:v}))} full T={T}/>
        <FS label="Type" value={form.type} onChange={v=>setForm(p=>({...p,type:v}))} options={TYPES_INT} T={T}/>
        <FS label="Statut" value={form.statut} onChange={v=>setForm(p=>({...p,statut:v}))} options={STATUTS_INT} T={T}/>
        <FS label="Chantier lié" value={form.chantier_id} onChange={v=>setForm(p=>({...p,chantier_id:v}))} options={[["","— Aucun —"],...ch.map(c=>[c.id,c.nom])]} T={T}/>
        <FF label="Responsable" value={form.responsable} onChange={v=>setForm(p=>({...p,responsable:v}))} T={T}/>
        <FF label="Date début" type="date" value={form.date_debut} onChange={v=>setForm(p=>({...p,date_debut:v}))} T={T}/>
        <FF label="Date fin" type="date" value={form.date_fin} onChange={v=>setForm(p=>({...p,date_fin:v}))} T={T}/>
        <FF label="Description" value={form.description} onChange={v=>setForm(p=>({...p,description:v}))} rows={2} full T={T}/>
      </FG>
    </Modal>}
  </div>;
}

function Interventions({intv,ch,reload,T,isMobile}){
  const [showNew,setShowNew]=useState(false);const [saving,setSaving]=useState(false);
  const [fStatut,setFStatut]=useState("");const [fType,setFType]=useState("");
  const [form,setForm]=useState({titre:"",type:"Corrective",statut:"En cours",chantier_id:"",responsable:"",date_debut:tod(),date_fin:"",description:""});
  const up=(k,v)=>setForm(p=>({...p,[k]:v}));
  function save(){
    if(!form.titre){alert("Le titre est obligatoire");return;}
    setSaving(true);
    sb("interventions").insert({titre:form.titre,type:form.type,statut:form.statut,chantier_id:form.chantier_id||null,responsable:form.responsable||null,date_debut:form.date_debut||null,date_fin:form.date_fin||null,description:form.description||null,date_creation:tod()})
    .then(r=>{setSaving(false);if(r.error){alert("Erreur: "+JSON.stringify(r.error));return;}setShowNew(false);setForm({titre:"",type:"Corrective",statut:"En cours",chantier_id:"",responsable:"",date_debut:tod(),date_fin:"",description:""});reload();});
  }
  const filtered=intv.filter(i=>{if(fStatut&&i.statut!==fStatut)return false;if(fType&&i.type!==fType)return false;return true;});
  const enCours=intv.filter(i=>i.statut==="En cours").length;
  const termines=intv.filter(i=>i.statut==="Termine").length;
  const totalCout=intv.reduce((a,i)=>a+totalDepI(i),0);
  return <div style={{display:"flex",flexDirection:"column",gap:14}}>
    {/* KPIs */}
    <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)",gap:8}}>
      <Kpi icon="🔧" label="Total" value={intv.length} color={T.secondary} compact T={T}/>
      <Kpi icon="▶️" label="En cours" value={enCours} color={T.secondary} compact T={T}/>
      <Kpi icon="✅" label="Terminées" value={termines} color={T.success} compact T={T}/>
      <Kpi icon="💸" label="Coût total" value={fmtS(totalCout)} color={T.warning} compact T={T}/>
    </div>
    {/* FILTRES + BOUTON */}
    <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",justifyContent:"space-between"}}>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        <select value={fStatut} onChange={e=>setFStatut(e.target.value)} style={{background:T.mid,border:"1px solid "+T.border,borderRadius:7,padding:"6px 10px",color:T.white,fontSize:12,outline:"none"}}>
          <option value="">Tous statuts</option>{STATUTS_INT.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        <select value={fType} onChange={e=>setFType(e.target.value)} style={{background:T.mid,border:"1px solid "+T.border,borderRadius:7,padding:"6px 10px",color:T.white,fontSize:12,outline:"none"}}>
          <option value="">Tous types</option>{TYPES_INT.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        {(fStatut||fType)&&<button onClick={()=>{setFStatut("");setFType("");}} style={{background:T.danger+"22",color:T.danger,border:"none",borderRadius:7,padding:"6px 10px",fontSize:11,cursor:"pointer",fontWeight:700}}>✕ Reset</button>}
      </div>
      <button onClick={()=>setShowNew(true)} style={{background:T.primary,color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontWeight:700,cursor:"pointer",fontSize:13}}>+ Nouvelle intervention</button>
    </div>
    {/* LISTE */}
    {filtered.length===0&&<Empty msg="Aucune intervention" icon="🔧"/>}
    {filtered.map(i=><IntervCard key={i.id} i={i} ch={ch} reload={reload} T={T}/>)}
    {/* MODAL NOUVELLE */}
    {showNew&&<Modal title="Nouvelle intervention" onClose={()=>setShowNew(false)} onSave={save} T={T}>
      {saving?<Spin/>:<FG cols={2}>
        <FF label="Titre *" value={form.titre} onChange={v=>up("titre",v)} full T={T}/>
        <FS label="Type" value={form.type} onChange={v=>up("type",v)} options={TYPES_INT} T={T}/>
        <FS label="Statut" value={form.statut} onChange={v=>up("statut",v)} options={STATUTS_INT} T={T}/>
        <FS label="Chantier lié" value={form.chantier_id} onChange={v=>up("chantier_id",v)} options={[["","— Aucun —"],...ch.map(c=>[c.id,c.nom])]} T={T}/>
        <FF label="Responsable" value={form.responsable} onChange={v=>up("responsable",v)} T={T}/>
        <FF label="Date début" type="date" value={form.date_debut} onChange={v=>up("date_debut",v)} T={T}/>
        <FF label="Date fin" type="date" value={form.date_fin} onChange={v=>up("date_fin",v)} T={T}/>
        <FF label="Description" value={form.description} onChange={v=>up("description",v)} rows={2} full T={T}/>
      </FG>}
    </Modal>}
  </div>;
}

// ── RAPPORTS ──────────────────────────────────────────────────────────────────
function Rapports({ch,intv,T,isMobile}){
  const [tab,setTab]=useState("chantiers");
  const [fClient,setFClient]=useState("");const [fMois,setFMois]=useState("");const [fStatut,setFStatut]=useState("");const [fType,setFType]=useState("");const [fMoisFin,setFMoisFin]=useState("");const [fMinBudget,setFMinBudget]=useState("");const [fMaxBudget,setFMaxBudget]=useState("");const [search,setSearch]=useState("");const [fResponsable,setFResponsable]=useState("");
  const clients=useMemo(()=>[...new Set(ch.map(c=>c.client).filter(Boolean))].sort(),[ch]);
  const moisCh=useMemo(()=>[...new Set(ch.map(c=>getMois(c.date_debut)).filter(Boolean))].sort().reverse(),[ch]);
  const moisInt=useMemo(()=>[...new Set(intv.map(i=>getMois(i.date_debut)).filter(Boolean))].sort().reverse(),[intv]);
  const responsables=useMemo(()=>[...new Set(intv.map(i=>i.responsable).filter(Boolean))].sort(),[intv]);
  const chFiltres=useMemo(()=>ch.filter(c=>{
    if(fClient&&c.client!==fClient)return false;if(fMois&&getMois(c.date_debut)!==fMois)return false;if(fMoisFin&&getMois(c.date_fin)!==fMoisFin)return false;if(fStatut&&c.statut!==fStatut)return false;if(fType&&c.type!==fType)return false;if(fMinBudget&&c.budgetInitial<parseFloat(fMinBudget))return false;if(fMaxBudget&&c.budgetInitial>parseFloat(fMaxBudget))return false;if(search&&!c.nom.toLowerCase().includes(search.toLowerCase())&&!(c.client||"").toLowerCase().includes(search.toLowerCase()))return false;return true;
  }),[ch,fClient,fMois,fMoisFin,fStatut,fType,fMinBudget,fMaxBudget,search]);
  const intvFiltres=useMemo(()=>intv.filter(i=>{
    if(fMois&&getMois(i.date_debut)!==fMois)return false;if(fStatut&&i.statut!==fStatut)return false;if(fType&&i.type!==fType)return false;if(fResponsable&&i.responsable!==fResponsable)return false;if(search&&!(i.titre||"").toLowerCase().includes(search.toLowerCase()))return false;if(fClient){const chantier=ch.find(c=>c.id===i.chantier_id);if(!chantier||chantier.client!==fClient)return false;}return true;
  }),[intv,ch,fMois,fStatut,fType,fResponsable,fClient,search]);
  const statsCh=useMemo(()=>({totalBudget:chFiltres.reduce((a,c)=>a+c.budgetInitial,0),totalDep:chFiltres.reduce((a,c)=>a+totalDep(c),0),count:chFiltres.length,enDerive:chFiltres.filter(c=>c.statut==="En derive").length}),[chFiltres]);
  const statsInt=useMemo(()=>({count:intvFiltres.length,totalCout:intvFiltres.reduce((a,i)=>a+totalDepI(i),0),enCours:intvFiltres.filter(i=>i.statut==="En cours").length,termines:intvFiltres.filter(i=>i.statut==="Termine").length}),[intvFiltres]);
  function reset(){setFClient("");setFMois("");setFMoisFin("");setFStatut("");setFType("");setFMinBudget("");setFMaxBudget("");setFResponsable("");setSearch("");}
  const hasFiltre=fClient||fMois||fStatut||fType||fMinBudget||fMaxBudget||fResponsable||search||fMoisFin;
  const chParMois=useMemo(()=>{const m={};chFiltres.forEach(c=>{const mo=getMois(c.date_debut)||"?";if(!m[mo])m[mo]={mois:mo,budget:0,dep:0};m[mo].budget+=c.budgetInitial;m[mo].dep+=totalDep(c);});return Object.values(m).sort((a,b)=>a.mois.localeCompare(b.mois)).slice(-8);},[chFiltres]);
  const intvParMois=useMemo(()=>{const m={};intvFiltres.forEach(i=>{const mo=getMois(i.date_debut)||"?";if(!m[mo])m[mo]={mois:mo,n:0};m[mo].n++;});return Object.values(m).sort((a,b)=>a.mois.localeCompare(b.mois)).slice(-8);},[intvFiltres]);
  function exportChCSV(){exportCSV(chFiltres.map(c=>({Nom:c.nom,Client:c.client||"",Type:c.type||"",Statut:c.statut,Budget:c.budgetInitial,Dépenses:totalDep(c),Marge:c.budgetInitial-totalDep(c),"%":pct(totalDep(c),c.budgetInitial),Début:c.date_debut||"",Fin:c.date_fin||""})),"chantiers_"+tod());}
  function exportIntvCSV(){exportCSV(intvFiltres.map(i=>({Titre:i.titre||"",Type:i.type||"",Statut:i.statut||"",Chantier:(ch.find(c=>c.id===i.chantier_id)||{}).nom||"",Responsable:i.responsable||"",Début:i.date_debut||"",Fin:i.date_fin||"",Coût:totalDepI(i)})),"interventions_"+tod());}
  function exportDepCSV(){const rows=[];chFiltres.forEach(c=>{(c.depenses||[]).forEach(d=>{rows.push({Chantier:c.nom,Client:c.client||"",Libellé:d.libelle,Catégorie:d.categorie,Montant:d.montant,Date:d.date,Note:d.note||""});});});exportCSV(rows,"depenses_"+tod());}
  function printChantiers(){
    const rows=chFiltres.map(c=>{const d=totalDep(c),pp=pct(d,c.budgetInitial);return `<tr><td>${c.nom}</td><td>${c.client||"-"}</td><td>${c.type||"-"}</td><td>${c.statut}</td><td style="text-align:right">${fmtN(c.budgetInitial)}</td><td style="text-align:right">${fmtN(d)}</td><td style="text-align:right">${pp}%</td><td>${c.date_debut||"-"}</td></tr>`;}).join("");
    const html=`<h1>Rapport Chantiers — ${DT.companyName}</h1><p>${chFiltres.length} chantier(s)</p><div class="kpi-grid"><div class="kpi"><div class="kpi-val">${chFiltres.length}</div><div class="kpi-lbl">Chantiers</div></div><div class="kpi"><div class="kpi-val">${fmtS(statsCh.totalBudget)}</div><div class="kpi-lbl">Budget</div></div><div class="kpi"><div class="kpi-val">${fmtS(statsCh.totalDep)}</div><div class="kpi-lbl">Dépenses</div></div><div class="kpi"><div class="kpi-val">${statsCh.enDerive}</div><div class="kpi-lbl">En dérive</div></div></div><table><thead><tr><th>Nom</th><th>Client</th><th>Type</th><th>Statut</th><th>Budget</th><th>Dépenses</th><th>%</th><th>Début</th></tr></thead><tbody>${rows}<tr class="total"><td colspan="4">TOTAL</td><td>${fmtN(statsCh.totalBudget)} XOF</td><td>${fmtN(statsCh.totalDep)} XOF</td><td>${pct(statsCh.totalDep,statsCh.totalBudget)}%</td><td></td></tr></tbody></table>`;
    printHTML(html,"Rapport Chantiers");
  }
  function printInterventions(){
    const rows=intvFiltres.map(i=>{const cout=totalDepI(i);return `<tr><td>${i.titre||"-"}</td><td>${i.type||"-"}</td><td>${i.statut||"-"}</td><td>${(ch.find(c=>c.id===i.chantier_id)||{}).nom||"-"}</td><td>${i.responsable||"-"}</td><td>${i.date_debut||"-"}</td><td style="text-align:right">${cout>0?fmtN(cout)+" XOF":"-"}</td></tr>`;}).join("");
    const html=`<h1>Rapport Interventions — ${DT.companyName}</h1><div class="kpi-grid"><div class="kpi"><div class="kpi-val">${statsInt.count}</div><div class="kpi-lbl">Interventions</div></div><div class="kpi"><div class="kpi-val">${statsInt.enCours}</div><div class="kpi-lbl">En cours</div></div><div class="kpi"><div class="kpi-val">${statsInt.termines}</div><div class="kpi-lbl">Terminées</div></div><div class="kpi"><div class="kpi-val">${fmtS(statsInt.totalCout)}</div><div class="kpi-lbl">Coût</div></div></div><table><thead><tr><th>Titre</th><th>Type</th><th>Statut</th><th>Chantier</th><th>Responsable</th><th>Date début</th><th>Coût</th></tr></thead><tbody>${rows}<tr class="total"><td colspan="6">TOTAL</td><td>${fmtN(statsInt.totalCout)} XOF</td></tr></tbody></table>`;
    printHTML(html,"Rapport Interventions");
  }
  function printSynthese(){
    const parMois={};ch.forEach(c=>{const m=getMois(c.date_debut)||"?";if(!parMois[m])parMois[m]={mois:m,n:0,budget:0,dep:0};parMois[m].n++;parMois[m].budget+=c.budgetInitial;parMois[m].dep+=totalDep(c);});
    const parClient={};ch.forEach(c=>{const cl=c.client||"Inconnu";if(!parClient[cl])parClient[cl]={client:cl,n:0,budget:0,dep:0};parClient[cl].n++;parClient[cl].budget+=c.budgetInitial;parClient[cl].dep+=totalDep(c);});
    const lignesMois=Object.entries(parMois).sort((a,b)=>b[0].localeCompare(a[0])).map(([m,v])=>`<tr><td>${getMoisNom(m+"-01")}</td><td>${v.n}</td><td style="text-align:right">${fmtN(v.budget)} XOF</td><td style="text-align:right">${fmtN(v.dep)} XOF</td><td style="text-align:right">${pct(v.dep,v.budget)}%</td></tr>`).join("");
    const lignesCl=Object.values(parClient).sort((a,b)=>b.budget-a.budget).map(v=>`<tr><td>${v.client}</td><td>${v.n}</td><td style="text-align:right">${fmtN(v.budget)} XOF</td><td style="text-align:right">${fmtN(v.dep)} XOF</td></tr>`).join("");
    const html=`<h1>Synthèse — ${DT.companyName}</h1><div class="kpi-grid"><div class="kpi"><div class="kpi-val">${ch.length}</div><div class="kpi-lbl">Chantiers</div></div><div class="kpi"><div class="kpi-val">${fmtS(ch.reduce((a,c)=>a+c.budgetInitial,0))}</div><div class="kpi-lbl">Budget global</div></div><div class="kpi"><div class="kpi-val">${intv.length}</div><div class="kpi-lbl">Interventions</div></div><div class="kpi"><div class="kpi-val">${fmtS(intv.reduce((a,i)=>a+totalDepI(i),0))}</div><div class="kpi-lbl">Coût interventions</div></div></div><h2>Par mois</h2><table><thead><tr><th>Mois</th><th>Chantiers</th><th>Budget</th><th>Dépenses</th><th>%</th></tr></thead><tbody>${lignesMois}</tbody></table><h2>Par client</h2><table><thead><tr><th>Client</th><th>Chantiers</th><th>Budget</th><th>Dépenses</th></tr></thead><tbody>${lignesCl}</tbody></table>`;
    printHTML(html,"Synthèse");
  }
  const tabs=[["chantiers","Chantiers"],["interventions","Interventions"],["synthese","Synthèse"]];
  const selBg={padding:"8px 16px",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:700,border:"none"};
  return <div style={{display:"flex",flexDirection:"column",gap:14}}>
    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
      {tabs.map(([k,l])=><button key={k} onClick={()=>setTab(k)} style={{...selBg,background:tab===k?T.primary:T.card,color:tab===k?"#fff":T.muted,border:"1px solid "+(tab===k?T.primary:T.border)}}>{l}</button>)}
    </div>
    <Card title="Filtres" action={hasFiltre&&<button onClick={reset} style={{background:T.danger+"22",color:T.danger,border:"1px solid "+T.danger+"44",borderRadius:6,padding:"4px 10px",fontSize:11,cursor:"pointer",fontWeight:700}}>✕ Reset</button>} T={T}>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:10}}>
        <ISel T={T} label="Recherche" value={search} onChange={setSearch} style={{gridColumn:"1/-1"}}/>
        {tab!=="interventions"&&<div><label style={{fontSize:10,color:T.muted,display:"block",marginBottom:3}}>Client</label><select value={fClient} onChange={e=>setFClient(e.target.value)} style={{width:"100%",background:T.mid,border:"1px solid "+T.border,borderRadius:7,padding:"7px 8px",color:T.white,fontSize:12,outline:"none"}}><option value="">Tous</option>{clients.map(c=><option key={c} value={c}>{c}</option>)}</select></div>}
        <div><label style={{fontSize:10,color:T.muted,display:"block",marginBottom:3}}>Mois début</label><select value={fMois} onChange={e=>setFMois(e.target.value)} style={{width:"100%",background:T.mid,border:"1px solid "+T.border,borderRadius:7,padding:"7px 8px",color:T.white,fontSize:12,outline:"none"}}><option value="">Tous</option>{(tab==="interventions"?moisInt:moisCh).map(m=><option key={m} value={m}>{getMoisNom(m+"-01")}</option>)}</select></div>
        <div><label style={{fontSize:10,color:T.muted,display:"block",marginBottom:3}}>Statut</label><select value={fStatut} onChange={e=>setFStatut(e.target.value)} style={{width:"100%",background:T.mid,border:"1px solid "+T.border,borderRadius:7,padding:"7px 8px",color:T.white,fontSize:12,outline:"none"}}><option value="">Tous</option>{(tab==="interventions"?STATUTS_INT:STATUTS).map(s=><option key={s} value={s}>{s}</option>)}</select></div>
        <div><label style={{fontSize:10,color:T.muted,display:"block",marginBottom:3}}>Type</label><select value={fType} onChange={e=>setFType(e.target.value)} style={{width:"100%",background:T.mid,border:"1px solid "+T.border,borderRadius:7,padding:"7px 8px",color:T.white,fontSize:12,outline:"none"}}><option value="">Tous</option>{(tab==="interventions"?TYPES_INT:TYPES_CH).map(s=><option key={s} value={s}>{s}</option>)}</select></div>
        {tab==="interventions"&&<div><label style={{fontSize:10,color:T.muted,display:"block",marginBottom:3}}>Responsable</label><select value={fResponsable} onChange={e=>setFResponsable(e.target.value)} style={{width:"100%",background:T.mid,border:"1px solid "+T.border,borderRadius:7,padding:"7px 8px",color:T.white,fontSize:12,outline:"none"}}><option value="">Tous</option>{responsables.map(r=><option key={r} value={r}>{r}</option>)}</select></div>}
      </div>
    </Card>
    {tab==="chantiers"&&<><div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:8}}>
      <Kpi icon="🏗️" label="Chantiers" value={statsCh.count} color={T.primary} compact T={T}/>
      <Kpi icon="💰" label="Budget" value={fmtS(statsCh.totalBudget)} compact T={T}/>
      <Kpi icon="💸" label="Dépenses" value={fmtS(statsCh.totalDep)} color={T.warning} compact T={T}/>
      <Kpi icon="⚠️" label="En dérive" value={statsCh.enDerive} color={statsCh.enDerive>0?T.danger:T.success} compact T={T}/>
    </div>
    <Card title="Exports" T={T}><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
      <button onClick={exportChCSV} style={expBtn(T.success)}>📥 CSV Chantiers</button>
      <button onClick={exportDepCSV} style={expBtn(T.secondary)}>📥 CSV Dépenses</button>
      <button onClick={printChantiers} style={expBtn(T.primary)}>🖨️ PDF Chantiers</button>
      <button onClick={printSynthese} style={expBtn("#A855F7")}>📊 Synthèse PDF</button>
    </div></Card>
    {chFiltres.length===0?<Empty msg="Aucun résultat" icon="🔍"/>:<div style={{background:T.card,border:"1px solid "+T.border,borderRadius:T.borderRadius,overflow:"hidden"}}><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:700}}>
      <thead><tr style={{background:T.mid}}>{["Nom","Client","Type","Statut","Budget","Dépenses","%","Début"].map((h,i)=><th key={i} style={{padding:"8px",textAlign:i>3?"right":"left",fontSize:10,color:T.muted,fontWeight:600}}>{h}</th>)}</tr></thead>
      <tbody>{chFiltres.map(c=>{const d=totalDep(c),pp=pct(d,c.budgetInitial);return <tr key={c.id} style={{borderBottom:"1px solid "+T.border+"33"}}>
        <td style={{padding:"8px",fontWeight:700}}>{c.nom}</td><td style={{padding:"8px",color:T.muted}}>{c.client||"-"}</td>
        <td style={{padding:"8px"}}><Badge label={c.type||"-"} color={T.secondary} small/></td>
        <td style={{padding:"8px"}}><Badge label={c.statut} color={stC(c.statut,DT)} small/></td>
        <td style={{padding:"8px",textAlign:"right"}}>{fmtN(c.budgetInitial)}</td>
        <td style={{padding:"8px",textAlign:"right",color:T.warning}}>{fmtN(d)}</td>
        <td style={{padding:"8px",textAlign:"right"}}><span style={{color:pp>100?T.danger:pp>80?T.warning:T.success,fontWeight:700}}>{pp}%</span></td>
        <td style={{padding:"8px",color:T.muted}}>{c.date_debut||"-"}</td>
      </tr>;})}
      <tr style={{background:T.primary+"22"}}><td colSpan={4} style={{padding:"8px",fontWeight:800,color:T.primary}}>TOTAL</td><td style={{padding:"8px",textAlign:"right",fontWeight:800}}>{fmtN(statsCh.totalBudget)}</td><td style={{padding:"8px",textAlign:"right",fontWeight:800,color:T.warning}}>{fmtN(statsCh.totalDep)}</td><td style={{padding:"8px",textAlign:"right",fontWeight:800}}>{pct(statsCh.totalDep,statsCh.totalBudget)}%</td><td/></tr>
      </tbody></table></div></div>}
    {chParMois.length>1&&<Card title="Budget & Dépenses par mois" T={T}><ResponsiveContainer width="100%" height={160}><BarChart data={chParMois}><XAxis dataKey="mois" tick={{fill:T.muted,fontSize:9}}/><YAxis tickFormatter={fmtS} tick={{fill:T.muted,fontSize:9}}/><Tooltip formatter={v=>fmt(v)} contentStyle={{background:T.card,border:"1px solid "+T.border,color:T.white}}/><Bar dataKey="budget" fill={T.secondary} name="Budget" radius={[3,3,0,0]}/><Bar dataKey="dep" fill={T.primary} name="Dépenses" radius={[3,3,0,0]}/></BarChart></ResponsiveContainer></Card>}
    </>}
    {tab==="interventions"&&<><div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:8}}>
      <Kpi icon="🔧" label="Interventions" value={statsInt.count} color={T.secondary} compact T={T}/>
      <Kpi icon="▶️" label="En cours" value={statsInt.enCours} color={T.secondary} compact T={T}/>
      <Kpi icon="✅" label="Terminées" value={statsInt.termines} color={T.success} compact T={T}/>
      <Kpi icon="💸" label="Coût" value={fmtS(statsInt.totalCout)} color={T.warning} compact T={T}/>
    </div>
    <Card title="Exports" T={T}><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
      <button onClick={exportIntvCSV} style={expBtn(T.success)}>📥 CSV Interventions</button>
      <button onClick={printInterventions} style={expBtn(T.primary)}>🖨️ PDF Interventions</button>
    </div></Card>
    {intvFiltres.length===0?<Empty msg="Aucun résultat" icon="🔍"/>:<div style={{background:T.card,border:"1px solid "+T.border,borderRadius:T.borderRadius,overflow:"hidden"}}><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:600}}>
      <thead><tr style={{background:T.mid}}>{["Titre","Type","Statut","Chantier","Responsable","Début","Coût"].map((h,i)=><th key={i} style={{padding:"8px",textAlign:i>5?"right":"left",fontSize:10,color:T.muted,fontWeight:600}}>{h}</th>)}</tr></thead>
      <tbody>{intvFiltres.map(i=>{const cout=totalDepI(i);return <tr key={i.id} style={{borderBottom:"1px solid "+T.border+"33"}}>
        <td style={{padding:"8px",fontWeight:700}}>{i.titre||"-"}</td>
        <td style={{padding:"8px"}}><Badge label={i.type||"-"} color={T.warning} small/></td>
        <td style={{padding:"8px"}}><Badge label={i.statut||"-"} color={intStC(i.statut,DT)} small/></td>
        <td style={{padding:"8px",color:T.muted}}>{(ch.find(c=>c.id===i.chantier_id)||{}).nom||"-"}</td>
        <td style={{padding:"8px",color:T.secondary}}>{i.responsable||"-"}</td>
        <td style={{padding:"8px",color:T.muted}}>{i.date_debut||"-"}</td>
        <td style={{padding:"8px",textAlign:"right",fontWeight:700,color:T.primary}}>{cout>0?fmtN(cout)+" XOF":"-"}</td>
      </tr>;})}
      <tr style={{background:T.secondary+"22"}}><td colSpan={6} style={{padding:"8px",fontWeight:800,color:T.secondary}}>TOTAL</td><td style={{padding:"8px",textAlign:"right",fontWeight:800,color:T.warning}}>{fmtN(statsInt.totalCout)} XOF</td></tr>
      </tbody></table></div></div>}
    {intvParMois.length>1&&<Card title="Interventions par mois" T={T}><ResponsiveContainer width="100%" height={150}><BarChart data={intvParMois}><XAxis dataKey="mois" tick={{fill:T.muted,fontSize:9}}/><YAxis tick={{fill:T.muted,fontSize:9}}/><Tooltip contentStyle={{background:T.card,border:"1px solid "+T.border,color:T.white}}/><Bar dataKey="n" fill={T.secondary} name="Nombre" radius={[3,3,0,0]}/></BarChart></ResponsiveContainer></Card>}
    </>}
    {tab==="synthese"&&<SynthesePage ch={ch} intv={intv} T={T} isMobile={isMobile} printSynthese={printSynthese}/>}
  </div>;
}

function SynthesePage({ch,intv,T,isMobile,printSynthese}){
  const parClient=useMemo(()=>{const m={};ch.forEach(c=>{const cl=c.client||"Inconnu";if(!m[cl])m[cl]={client:cl,n:0,budget:0,dep:0};m[cl].n++;m[cl].budget+=c.budgetInitial;m[cl].dep+=totalDep(c);});return Object.values(m).sort((a,b)=>b.budget-a.budget);},[ch]);
  const parMois=useMemo(()=>{const m={};ch.forEach(c=>{const mo=getMois(c.date_debut)||"?";if(!m[mo])m[mo]={mois:mo,budget:0,dep:0};m[mo].budget+=c.budgetInitial;m[mo].dep+=totalDep(c);});return Object.values(m).sort((a,b)=>a.mois.localeCompare(b.mois)).slice(-10);},[ch]);
  const parType=useMemo(()=>{const m={};ch.forEach(c=>{const t=c.type||"?";if(!m[t])m[t]={type:t,n:0};m[t].n++;});return Object.values(m).sort((a,b)=>b.n-a.n);},[ch]);
  const COLORS=[DT.primary,DT.secondary,DT.success,DT.warning,"#A855F7",DT.muted];
  return <div style={{display:"flex",flexDirection:"column",gap:14}}>
    <Card title="Exports" T={T}><button onClick={printSynthese} style={expBtn(T.primary)}>🖨️ Synthèse PDF complète</button></Card>
    <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14}}>
      <Card title="Par client" T={T}>{parClient.slice(0,8).map(v=>{const pp=pct(v.dep,v.budget);return <div key={v.client} style={{padding:"7px 0",borderBottom:"1px solid "+T.border+"33"}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontWeight:600,fontSize:12}}>{v.client}</span><span style={{fontSize:11,color:T.muted}}>{v.n} chantier(s)</span></div><div style={{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:3}}><span style={{color:T.muted}}>Budget: {fmtS(v.budget)}</span><span style={{color:pp>80?T.danger:T.success,fontWeight:700}}>{pp}%</span></div><PBar p={pp} color={pp>100?T.danger:pp>80?T.warning:T.success} h={4}/></div>;})} {parClient.length===0&&<Empty msg="Aucune donnée" icon="👤"/>}</Card>
      <Card title="Par mois (début)" T={T}><ResponsiveContainer width="100%" height={220}><BarChart data={parMois}><XAxis dataKey="mois" tick={{fill:T.muted,fontSize:8}}/><YAxis tickFormatter={fmtS} tick={{fill:T.muted,fontSize:9}}/><Tooltip formatter={v=>fmt(v)} contentStyle={{background:T.card,border:"1px solid "+T.border,color:T.white}}/><Bar dataKey="budget" fill={T.secondary} name="Budget" radius={[3,3,0,0]}/><Bar dataKey="dep" fill={T.primary} name="Dépenses" radius={[3,3,0,0]}/></BarChart></ResponsiveContainer></Card>
    </div>
    <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14}}>
      <Card title="Par type de chantier" T={T}><ResponsiveContainer width="100%" height={170}><PieChart><Pie data={parType} dataKey="n" nameKey="type" cx="50%" cy="50%" outerRadius={65} label={e=>e.type+" ("+e.n+")"}>{parType.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip contentStyle={{background:T.card,border:"1px solid "+T.border,color:T.white}}/></PieChart></ResponsiveContainer></Card>
      <Card title="Résumé interventions" T={T}>{[["Total",intv.length,T.white],["En cours",intv.filter(i=>i.statut==="En cours").length,T.secondary],["Terminées",intv.filter(i=>i.statut==="Termine").length,T.success],["Urgences",intv.filter(i=>i.type==="Urgence").length,T.danger],["Coût total",fmt(intv.reduce((a,i)=>a+totalDepI(i),0)),T.warning]].map(([l,v,c])=><div key={l} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid "+T.border+"33",fontSize:12}}><span style={{color:T.muted}}>{l}</span><span style={{fontWeight:700,color:c}}>{v}</span></div>)}</Card>
    </div>
  </div>;
}

// ── KPI PAGE ──────────────────────────────────────────────────────────────────
function KpiPage({ch,intv,T,isMobile}){
  const totalB=ch.reduce((a,c)=>a+c.budgetInitial,0),totalD=ch.reduce((a,c)=>a+totalDep(c),0);
  const enCours=ch.filter(c=>c.statut==="En cours").length,enDerive=ch.filter(c=>c.statut==="En derive").length;
  const clotures=ch.filter(c=>c.statut==="Cloture");
  const perfData=clotures.map(c=>{const d=totalDep(c);return {nom:c.nom.slice(0,15),budget:c.budgetInitial,dep:d,marge:c.budgetInitial-d};});
  const intvParType=TYPES_INT.map(t=>({type:t,n:intv.filter(i=>i.type===t).length})).filter(d=>d.n>0);
  const COLORS=[DT.primary,DT.secondary,DT.success,DT.warning];
  return <div style={{display:"flex",flexDirection:"column",gap:14}}>
    <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)",gap:8}}>
      <Kpi icon="🏗️" label="Total chantiers" value={ch.length} T={T} color={T.primary} compact/>
      <Kpi icon="▶️" label="En cours" value={enCours} T={T} color={T.secondary} compact/>
      <Kpi icon="⚠️" label="En dérive" value={enDerive} T={T} color={enDerive>0?T.danger:T.success} compact/>
      <Kpi icon="✅" label="Clôturés" value={clotures.length} T={T} color={T.success} compact/>
      <Kpi icon="💰" label="Budget global" value={fmtS(totalB)} T={T} compact/>
      <Kpi icon="💸" label="Dépenses" value={fmtS(totalD)} T={T} color={T.warning} compact/>
      <Kpi icon="📈" label="Consommé" value={pct(totalD,totalB)+"%" } T={T} color={pct(totalD,totalB)>80?T.danger:T.success} compact/>
      <Kpi icon="🔧" label="Interventions" value={intv.length} T={T} color={T.secondary} compact/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14}}>
      {perfData.length>0&&<Card title="Performance chantiers clôturés" T={T}><ResponsiveContainer width="100%" height={200}><BarChart data={perfData}><XAxis dataKey="nom" tick={{fill:T.muted,fontSize:8}}/><YAxis tickFormatter={fmtS} tick={{fill:T.muted,fontSize:9}}/><Tooltip formatter={v=>fmt(v)} contentStyle={{background:T.card,border:"1px solid "+T.border,color:T.white}}/><Bar dataKey="budget" fill={T.secondary} name="Budget" radius={[3,3,0,0]}/><Bar dataKey="dep" fill={T.primary} name="Dépenses" radius={[3,3,0,0]}/></BarChart></ResponsiveContainer></Card>}
      {intvParType.length>0&&<Card title="Interventions par type" T={T}><ResponsiveContainer width="100%" height={200}><PieChart><Pie data={intvParType} dataKey="n" nameKey="type" cx="50%" cy="50%" outerRadius={75} label={e=>e.type+" ("+e.n+")"}>{intvParType.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip contentStyle={{background:T.card,border:"1px solid "+T.border,color:T.white}}/></PieChart></ResponsiveContainer></Card>}
    </div>
    {ch.length===0&&intv.length===0&&<Empty msg="Aucune donnée pour les KPIs" icon="📈"/>}
  </div>;
}
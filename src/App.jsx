import { useState, useEffect, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis } from "recharts";

// ── Supabase ──────────────────────────────────────────────────────────────────
const SUPA_URL = "https://mbkwpaxissvvjhewkggl.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ia3dwYXhpc3N2dmpoZXdrZ2dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MjQzOTMsImV4cCI6MjA4NzAwMDM5M30.Zo9aJVDByO8aVSADfSCc2m4jCI1qeXuWYQgVRT-a3LA";
const HDR = { "Content-Type":"application/json","apikey":SUPA_KEY,"Authorization":"Bearer "+SUPA_KEY };
const REST = SUPA_URL+"/rest/v1";

function sbFrom(t){
  return{
    _t:t,_f:[],_o:null,_s:"*",
    select(s){this._s=s;return this;},
    order(c,o){this._o="order="+c+(o?.ascending===false?".desc":".asc");return this;},
    eq(c,v){this._f.push(c+"=eq."+v);return this;},
    _url(){let u=REST+"/"+this._t+"?select="+this._s;if(this._f.length)u+="&"+this._f.join("&");if(this._o)u+="&"+this._o;return u;},
    async get(){const r=await fetch(this._url(),{headers:HDR});const d=await r.json();return r.ok?{data:d,error:null}:{data:null,error:d};},
    async insert(obj){const r=await fetch(REST+"/"+this._t,{method:"POST",headers:{...HDR,"Prefer":"return=representation"},body:JSON.stringify(obj)});const d=await r.json();return r.ok?{data:d,error:null}:{data:null,error:d};},
    async update(obj){const u=REST+"/"+this._t+(this._f.length?"?"+this._f.join("&"):"");const r=await fetch(u,{method:"PATCH",headers:{...HDR,"Prefer":"return=representation"},body:JSON.stringify(obj)});const d=await r.json();return r.ok?{data:d,error:null}:{data:null,error:d};},
    async del(){const u=REST+"/"+this._t+(this._f.length?"?"+this._f.join("&"):"");const r=await fetch(u,{method:"DELETE",headers:HDR});return r.ok?{error:null}:{error:await r.json()};}
  };
}
const sb={from:sbFrom};

// ── Responsive hook ───────────────────────────────────────────────────────────
function useBP(){
  const [bp,setBp]=useState(()=>{const w=window.innerWidth;return w<480?"xs":w<768?"sm":w<1024?"md":"lg";});
  useEffect(()=>{const fn=()=>{const w=window.innerWidth;setBp(w<480?"xs":w<768?"sm":w<1024?"md":"lg");};window.addEventListener("resize",fn);return()=>window.removeEventListener("resize",fn);},[]);
  return{bp,isMobile:bp==="xs"||bp==="sm"};
}

// ── Constantes ────────────────────────────────────────────────────────────────
const C={
  orange:"#F97316",dark:"#292524",mid:"#44403C",border:"#57534E",card:"#292524",
  bg:"#1C1917",white:"#FAFAF9",muted:"#A8A29E",light:"#78716C",
  green:"#22C55E",red:"#EF4444",yellow:"#EAB308",blue:"#3B82F6",purple:"#A855F7"
};
const CATS=["Main d'œuvre","Matériaux","Équipement","Transport","Sous-traitance","Divers"];
const UNITES=["U","m²","ml","m³","kg","t","forfait","h","j"];
const STATUT_DEVIS_COLOR={brouillon:C.muted,envoyé:C.blue,accepté:C.green,refusé:C.red};

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt=n=>new Intl.NumberFormat("fr-FR",{maximumFractionDigits:0}).format(n)+" XOF";
const fmtS=n=>{const a=Math.abs(n);if(a>=1e6)return(n/1e6).toFixed(1)+"M XOF";if(a>=1e3)return Math.round(n/1e3)+"k XOF";return n+" XOF";};
const pct=(v,t)=>t>0?Math.round(v/t*100):0;
const today=()=>new Date().toISOString().slice(0,10);
const addDays=(d,n)=>{const dt=new Date(d);dt.setDate(dt.getDate()+n);return dt.toISOString().slice(0,10);};
const stC=s=>({"En cours":C.blue,"En dérive":C.red,"Clôturé":C.green,"Planifié":C.yellow,"En pause":C.light,"Brouillon":C.muted,"En réception":C.orange}[s]||C.muted);
const catC=c=>({"Main d'œuvre":C.blue,"Matériaux":C.orange,"Équipement":C.yellow,"Transport":C.green,"Sous-traitance":C.purple,"Divers":C.muted}[c]||C.muted);
const totalDep=c=>(c.depenses||[]).reduce((a,d)=>a+Number(d.montant),0);
const ssb=(d,b)=>{const p=pct(d,b);if(p>100)return"Dépassement";if(p>=80)return"80% consommé";return"Conforme";};
const sbC=s=>({Conforme:C.green,"80% consommé":C.yellow,Dépassement:C.red}[s]||C.muted);
const genAlertes=ch=>{const al=[];ch.forEach(c=>{const d=totalDep(c),p=pct(d,c.budgetInitial);if(p>100)al.push({niveau:"critique",msg:"Dépassement budget : "+p+"%",chantier:c});else if(p>=80)al.push({niveau:"warning",msg:"Budget à "+p+"% consommé",chantier:c});if(c.statut==="En dérive")al.push({niveau:"critique",msg:"Chantier en dérive",chantier:c});});return al;};
let _devisSeq=1000;
const genNumero=()=>{_devisSeq++;return"DEV-"+new Date().getFullYear()+"-"+String(_devisSeq).padStart(4,"0");};

// ── Calculs devis ─────────────────────────────────────────────────────────────
function calcDevis(articles,tauxTVA,tauxRemise){
  const arts=articles.map(a=>({...a,total_ligne:parseFloat(((a.quantite||0)*(a.prix_unitaire||0)).toFixed(0))}));
  const sousTotal=arts.reduce((s,a)=>s+a.total_ligne,0);
  const montantRemise=parseFloat((sousTotal*(tauxRemise/100)).toFixed(0));
  const baseImp=sousTotal-montantRemise;
  const montantTVA=parseFloat((baseImp*(tauxTVA/100)).toFixed(0));
  const totalTTC=baseImp+montantTVA;
  return{articles:arts,sousTotal,montantRemise,baseImp,montantTVA,totalTTC};
}

// ── Génération Excel devis ────────────────────────────────────────────────────
async function genererExcelDevis(devis,articles,calc,chantierNom,templateFile){
  const wb=XLSX.utils.book_new();
  const rows=[];
  const entreprise={nom:"JEAN BTP SARL",adresse:"Zone Industrielle, Abidjan",tel:"+225 27 00 00 00",email:"devis@jeanbtp.ci",siret:"CI-ABJ-2024-B-12345"};

  // En-têtes et infos
  rows.push(["","","","","",""]);
  rows.push([entreprise.nom,"","","DEVIS N°",devis.numero,""]);
  rows.push([entreprise.adresse,"","","Date :",devis.date_creation,""]);
  rows.push([entreprise.tel,"","","Validité :",devis.date_validite,""]);
  rows.push([entreprise.email,"","","","",""]);
  rows.push(["SIRET : "+entreprise.siret,"","","","",""]);
  rows.push(["","","","","",""]);
  rows.push(["POUR :","","","","",""]);
  rows.push([devis.client_nom,"","","","",""]);
  rows.push([devis.client_adresse,"","","","",""]);
  rows.push([devis.client_telephone,"","","","",""]);
  rows.push([devis.client_email,"","","","",""]);
  if(chantierNom) rows.push(["Chantier : "+chantierNom,"","","","",""]);
  rows.push(["","","","","",""]);
  rows.push(["N°","DÉSIGNATION","QTÉ","UNITÉ","P.U. HT (XOF)","TOTAL HT (XOF)"]);

  articles.forEach((a,i)=>{
    rows.push([i+1,a.designation,a.quantite,a.unite,a.prix_unitaire,a.total_ligne]);
  });

  rows.push(["","","","","",""]);
  rows.push(["","","","","Sous-total HT",calc.sousTotal]);
  if(devis.taux_remise>0) rows.push(["","","","","Remise ("+devis.taux_remise+"%)",-calc.montantRemise]);
  rows.push(["","","","","Base imposable",calc.baseImp]);
  rows.push(["","","","","TVA ("+devis.taux_tva+"%)",calc.montantTVA]);
  rows.push(["","","","","","────────────"]);
  rows.push(["","","","","TOTAL TTC",calc.totalTTC]);
  rows.push(["","","","","",""]);
  rows.push(["Conditions de paiement :","","","","",""]);
  rows.push([devis.conditions_paiement,"","","","",""]);
  if(devis.notes){rows.push(["","","","","",""]);rows.push(["Notes :","","","","",""]);rows.push([devis.notes,"","","","",""]);}
  rows.push(["","","","","",""]);
  rows.push(["Signature client :","","","Signature entreprise :","",""]);
  rows.push(["","","","","",""]);
  rows.push(["__________________________","","","__________________________","",""]);

  const ws=XLSX.utils.aoa_to_sheet(rows);

  // Largeurs colonnes
  ws["!cols"]=[{wch:6},{wch:40},{wch:10},{wch:10},{wch:20},{wch:20}];

  // Merge cells titre entreprise
  ws["!merges"]=[
    {s:{r:1,c:0},e:{r:1,c:2}},
    {s:{r:2,c:0},e:{r:2,c:2}},
    {s:{r:3,c:0},e:{r:3,c:2}},
    {s:{r:7,c:0},e:{r:7,c:5}},
    {s:{r:8,c:0},e:{r:8,c:5}},
  ];

  XLSX.utils.book_append_sheet(wb,ws,"Devis");

  // Si template uploadé, on génère quand même le fichier enrichi
  const buf=XLSX.write(wb,{type:"array",bookType:"xlsx"});
  const blob=new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download=`Devis_${devis.numero}.xlsx`;a.click();
  URL.revokeObjectURL(url);
}

// ── Impression HTML ───────────────────────────────────────────────────────────
function imprimerDevis(devis,articles,calc,chantierNom){
  const entreprise={nom:"JEAN BTP SARL",adresse:"Zone Industrielle, Abidjan",tel:"+225 27 00 00 00",email:"devis@jeanbtp.ci",siret:"CI-ABJ-2024-B-12345"};
  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Devis ${devis.numero}</title>
  <style>
    body{margin:0;font-family:Arial,sans-serif;font-size:10pt;color:#222;}
    .page{padding:2cm;}
    .header{display:flex;justify-content:space-between;margin-bottom:24px;}
    .ent{font-size:9pt;color:#555;line-height:1.6;}
    .ent strong{font-size:13pt;color:#F97316;display:block;margin-bottom:4px;}
    .badge{background:#F97316;color:#fff;padding:4px 16px;border-radius:4px;font-size:11pt;font-weight:bold;}
    .meta{font-size:9pt;color:#555;margin-top:8px;line-height:1.6;}
    .client-box{background:#f9f9f9;border:1px solid #ddd;border-radius:6px;padding:12px 16px;margin:16px 0;}
    .client-box strong{display:block;font-size:9pt;color:#888;margin-bottom:4px;}
    table{width:100%;border-collapse:collapse;margin:16px 0;}
    th{background:#F97316;color:#fff;padding:8px;text-align:left;font-size:9pt;}
    td{padding:7px 8px;font-size:9pt;border-bottom:1px solid #eee;}
    tr:nth-child(even) td{background:#fafafa;}
    .right{text-align:right;}
    .totals{width:50%;margin-left:auto;border:1px solid #ddd;border-radius:6px;overflow:hidden;}
    .totals tr td{padding:8px 14px;}
    .totals .total-ttc{background:#F97316;color:#fff;font-weight:bold;font-size:11pt;}
    .footer{margin-top:32px;font-size:9pt;color:#666;}
    .signatures{display:flex;justify-content:space-between;margin-top:48px;}
    .sig-box{width:45%;border-top:2px solid #333;padding-top:8px;font-size:9pt;}
    @page{margin:1.5cm;size:A4;}
  </style></head><body><div class="page">
  <div class="header">
    <div class="ent"><strong>${entreprise.nom}</strong>${entreprise.adresse}<br>${entreprise.tel}<br>${entreprise.email}<br>SIRET : ${entreprise.siret}</div>
    <div style="text-align:right">
      <div class="badge">DEVIS</div>
      <div class="meta"><strong>N° ${devis.numero}</strong><br>Date : ${devis.date_creation}<br>Validité : ${devis.date_validite}</div>
    </div>
  </div>
  <div class="client-box">
    <strong>DESTINATAIRE</strong>
    <b>${devis.client_nom}</b><br>
    ${devis.client_adresse||""}<br>${devis.client_telephone||""} ${devis.client_email?`· ${devis.client_email}`:""}
    ${chantierNom?`<br><span style="color:#F97316">🏗️ Chantier : ${chantierNom}</span>`:""}
  </div>
  <table>
    <thead><tr><th>#</th><th>Désignation</th><th class="right">Qté</th><th>Unité</th><th class="right">P.U. HT</th><th class="right">Total HT</th></tr></thead>
    <tbody>
      ${articles.map((a,i)=>`<tr><td>${i+1}</td><td>${a.designation}</td><td class="right">${a.quantite}</td><td>${a.unite}</td><td class="right">${fmt(a.prix_unitaire)}</td><td class="right">${fmt(a.total_ligne)}</td></tr>`).join("")}
    </tbody>
  </table>
  <table class="totals">
    <tr><td>Sous-total HT</td><td class="right">${fmt(calc.sousTotal)}</td></tr>
    ${devis.taux_remise>0?`<tr><td>Remise (${devis.taux_remise}%)</td><td class="right" style="color:#ef4444">-${fmt(calc.montantRemise)}</td></tr>`:""}
    ${devis.taux_remise>0?`<tr><td>Base imposable</td><td class="right">${fmt(calc.baseImp)}</td></tr>`:""}
    <tr><td>TVA (${devis.taux_tva}%)</td><td class="right">${fmt(calc.montantTVA)}</td></tr>
    <tr class="total-ttc"><td><b>TOTAL TTC</b></td><td class="right"><b>${fmt(calc.totalTTC)}</b></td></tr>
  </table>
  <div class="footer">
    <b>Conditions de paiement :</b><br>${devis.conditions_paiement||"—"}
    ${devis.notes?`<br><br><b>Notes :</b><br>${devis.notes}`:""}
  </div>
  <div class="signatures">
    <div class="sig-box">Signature client</div>
    <div class="sig-box" style="text-align:right">Signature ${entreprise.nom}</div>
  </div>
</div></body></html>`;
  const w=window.open("","_blank");
  w.document.write(html);w.document.close();
  setTimeout(()=>{w.focus();w.print();},400);
}

// ── UI Atoms ──────────────────────────────────────────────────────────────────
const Badge=({label,color,small})=><span style={{background:color+"22",color,border:"1px solid "+color+"55",borderRadius:6,padding:small?"2px 7px":"3px 10px",fontSize:small?10:11,fontWeight:600,whiteSpace:"nowrap"}}>{label}</span>;
const PBar=({p,color,h})=><div style={{background:C.mid,borderRadius:99,height:h||8,overflow:"hidden"}}><div style={{width:Math.min(p,100)+"%",background:color||C.orange,height:"100%",borderRadius:99}}/></div>;
const Card=({title,children,pad})=><div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,padding:pad||"18px 20px"}}>{title&&<div style={{fontWeight:700,fontSize:14,marginBottom:14}}>{title}</div>}{children}</div>;
const EmptyState=({msg,icon})=><div style={{textAlign:"center",padding:"40px 20px",color:C.muted}}><div style={{fontSize:40,marginBottom:12}}>{icon}</div><div style={{fontSize:14}}>{msg}</div></div>;
const Spinner=()=><div style={{display:"flex",alignItems:"center",justifyContent:"center",height:200,flexDirection:"column",gap:12}}><div style={{width:36,height:36,border:"4px solid "+C.border,borderTop:"4px solid "+C.orange,borderRadius:"50%",animation:"spin 1s linear infinite"}}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>;
const KpiCard=({icon,label,value,sub,color,compact})=><div style={{background:C.card,border:"1px solid "+C.border,borderRadius:compact?10:12,padding:compact?"12px 14px":"16px 20px",flex:1,minWidth:compact?100:130}}><div style={{fontSize:compact?18:22,marginBottom:3}}>{icon}</div><div style={{fontSize:compact?16:20,fontWeight:700,color:color||C.white,lineHeight:1.2}}>{value}</div><div style={{fontSize:compact?10:12,color:C.muted,marginTop:2}}>{label}</div>{sub&&<div style={{fontSize:10,color:C.light,marginTop:3}}>{sub}</div>}</div>;

const Modal=({title,onClose,onSave,saveLabel,children,wide})=>(
  <div style={{position:"fixed",inset:0,background:"#00000099",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
    <div style={{background:C.dark,border:"1px solid "+C.border,borderRadius:"20px 20px 0 0",padding:"24px 20px",width:"100%",maxWidth:wide?800:600,maxHeight:"94vh",overflow:"auto",WebkitOverflowScrolling:"touch"}}>
      <div style={{width:40,height:4,background:C.border,borderRadius:99,margin:"0 auto 20px"}}/>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
        <div style={{fontWeight:800,fontSize:16}}>{title}</div>
        <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:20}}>✕</button>
      </div>
      {children}
      {onSave&&<div style={{display:"flex",gap:10,marginTop:20,justifyContent:"flex-end"}}>
        <button onClick={onClose} style={{padding:"10px 20px",background:C.mid,color:C.white,border:"none",borderRadius:10,cursor:"pointer"}}>Annuler</button>
        <button onClick={onSave} style={{padding:"10px 20px",background:C.orange,color:"#fff",border:"none",borderRadius:10,fontWeight:700,cursor:"pointer"}}>{saveLabel||"Enregistrer"}</button>
      </div>}
    </div>
  </div>
);

const FField=({label,value,onChange,type,full,placeholder,rows})=>(
  <div style={full?{gridColumn:"1/-1"}:{}}>
    <label style={{fontSize:11,color:C.muted,display:"block",marginBottom:4}}>{label}</label>
    {rows?<textarea value={value} onChange={e=>onChange(e.target.value)} rows={rows} placeholder={placeholder} style={{width:"100%",background:C.mid,border:"1px solid "+C.border,borderRadius:8,padding:"10px 12px",color:C.white,fontSize:14,boxSizing:"border-box",outline:"none",resize:"vertical"}}/>
    :<input type={type||"text"} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{width:"100%",background:C.mid,border:"1px solid "+C.border,borderRadius:8,padding:"10px 12px",color:C.white,fontSize:14,boxSizing:"border-box",outline:"none",WebkitAppearance:"none"}}/>}
  </div>
);
const FSelect=({label,value,onChange,options,full})=>(
  <div style={full?{gridColumn:"1/-1"}:{}}>
    <label style={{fontSize:11,color:C.muted,display:"block",marginBottom:4}}>{label}</label>
    <select value={value} onChange={e=>onChange(e.target.value)} style={{width:"100%",background:C.mid,border:"1px solid "+C.border,borderRadius:8,padding:"10px 12px",color:C.white,fontSize:14,boxSizing:"border-box",outline:"none",WebkitAppearance:"none"}}>
      {options.map(o=>Array.isArray(o)?<option key={o[0]} value={o[0]}>{o[1]}</option>:<option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);
const FGrid=({children,cols})=><div style={{display:"grid",gridTemplateColumns:`repeat(${cols||2},1fr)`,gap:12}}>{children}</div>;

// ── Supabase data hook ────────────────────────────────────────────────────────
function useData(){
  const [chantiers,setCh]=useState([]);
  const [interventions,setInt]=useState([]);
  const [devis,setDev]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null);

  const load=async()=>{
    setLoading(true);setError(null);
    try{
      const [r1,r2,r3,r4,r5]=await Promise.all([
        sb.from("chantiers").order("created_at",{ascending:false}).get(),
        sb.from("depenses").order("date",{ascending:false}).get(),
        sb.from("interventions").order("created_at",{ascending:false}).get(),
        sb.from("intervention_depenses").get(),
        sb.from("intervention_todos").get()
      ]);
      if(r1.error)throw r1.error;
      const ch=r1.data||[],dep=r2.data||[],intv=r3.data||[],idep=r4.data||[],todos=r5.data||[];
      setCh(ch.map(c=>({...c,budgetInitial:Number(c.budget_initial),dateDebut:c.date_debut,dateFin:c.date_fin,alertes:c.alertes||[],depenses:dep.filter(d=>d.chantier_id===c.id).map(d=>({...d,montant:Number(d.montant)}))})));
      setInt(intv.map(i=>({...i,dateCreation:i.date_creation,depenses:idep.filter(d=>d.intervention_id===i.id).map(d=>({...d,montant:Number(d.montant)})),todos:todos.filter(t=>t.intervention_id===i.id)})));
      // Devis en mémoire (pas de table Supabase pour cette démo)
    }catch(e){setError("Erreur : "+(e.message||JSON.stringify(e)));}
    setLoading(false);
  };
  useEffect(()=>{load();},[]);
  return{chantiers,interventions,devis,setDev,loading,error,reload:load};
}

// ═════════════════════════════════════════════════════════════════════════════
// APP
// ═════════════════════════════════════════════════════════════════════════════
export default function App(){
  const {chantiers,interventions,devis,setDev,loading,error,reload}=useData();
  const {isMobile,bp}=useBP();
  const [page,setPage]=useState("dashboard");
  const [selId,setSelId]=useState(null);
  const [onglet,setOnglet]=useState("infos");
  const [drawerOpen,setDrawerOpen]=useState(false);
  const [showNewCh,setShowNewCh]=useState(false);
  const [filterSt,setFilterSt]=useState("Tous");
  const [saving,setSaving]=useState(false);
  const [newChForm,setNewChForm]=useState({nom:"",client:"",localisation:"",type:"Construction",budgetInitial:"",dateDebut:"",dateFin:""});

  const selected=chantiers.find(c=>c.id===selId);
  const openCh=id=>{setSelId(id);setPage("fiche");setOnglet("infos");setDrawerOpen(false);};
  const navTo=p=>{setPage(p);setDrawerOpen(false);};

  const saveCh=async()=>{
    if(!newChForm.nom||!newChForm.budgetInitial)return;
    setSaving(true);
    await sb.from("chantiers").insert({nom:newChForm.nom,client:newChForm.client,localisation:newChForm.localisation,type:newChForm.type,budget_initial:parseFloat(newChForm.budgetInitial),date_debut:newChForm.dateDebut||null,date_fin:newChForm.dateFin||null,statut:"Brouillon",alertes:[],score:100,lat:5.35,lng:-4.0});
    setSaving(false);setShowNewCh(false);setNewChForm({nom:"",client:"",localisation:"",type:"Construction",budgetInitial:"",dateDebut:"",dateFin:""});reload();
  };
  const delCh=async id=>{await sb.from("chantiers").eq("id",id).del();setPage("chantiers");reload();};

  const nbAl=genAlertes(chantiers).filter(a=>a.niveau==="critique").length;
  const nbIntEC=interventions.filter(i=>i.statut==="En cours").length;
  const nbDevBrouillon=devis.filter(d=>d.statut==="brouillon").length;

  const navItems=[
    {key:"dashboard",icon:"📊",label:"Dashboard"},
    {key:"chantiers",icon:"🏗️",label:"Chantiers"},
    {key:"devis",icon:"📄",label:"Devis",badge:nbDevBrouillon},
    {key:"interventions",icon:"🔧",label:"Interventions",badge:nbIntEC},
    {key:"alertes",icon:"🔔",label:"Alertes",badge:nbAl},
    {key:"kpi",icon:"📈",label:"KPIs"},
    {key:"ia",icon:"🤖",label:"IA"},
    {key:"gestion",icon:"⚙️",label:"Gestion"},
  ];

  const Drawer=()=>(
    <>{<div onClick={()=>setDrawerOpen(false)} style={{position:"fixed",inset:0,background:"#0007",zIndex:150}}/>}
    <div style={{position:"fixed",left:0,top:0,bottom:0,width:280,background:C.dark,borderRight:"1px solid "+C.border,zIndex:151,padding:"50px 12px 12px",overflowY:"auto"}}>
      <button onClick={()=>setDrawerOpen(false)} style={{position:"absolute",top:16,right:16,background:"none",border:"none",color:C.muted,fontSize:22,cursor:"pointer"}}>✕</button>
      <div style={{padding:"0 8px 16px",marginBottom:8,borderBottom:"1px solid "+C.border}}>
        <div style={{fontWeight:700,fontSize:16}}>JEAN MANAGER</div>
        <div style={{fontSize:11,color:C.orange}}>☁️ Supabase</div>
      </div>
      {navItems.map(n=>(
        <button key={n.key} onClick={()=>navTo(n.key)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"14px 10px",borderRadius:8,border:"none",background:page===n.key?C.orange+"22":"transparent",color:page===n.key?C.orange:C.muted,cursor:"pointer",marginBottom:2,textAlign:"left"}}>
          <span style={{fontSize:20}}>{n.icon}</span>
          <span style={{fontSize:14,fontWeight:page===n.key?700:400,flex:1}}>{n.label}</span>
          {n.badge>0&&<span style={{background:C.red,color:"#fff",borderRadius:99,fontSize:10,padding:"1px 7px",fontWeight:700}}>{n.badge}</span>}
        </button>
      ))}
      <button onClick={()=>{reload();setDrawerOpen(false);}} style={{width:"100%",background:C.blue+"22",border:"1px solid "+C.blue+"44",color:C.blue,borderRadius:8,padding:10,fontSize:12,fontWeight:700,cursor:"pointer",marginTop:12}}>🔄 Synchroniser</button>
    </div></>
  );

  const BottomBar=()=>(
    <div style={{position:"fixed",bottom:0,left:0,right:0,background:C.dark,borderTop:"1px solid "+C.border,display:"flex",justifyContent:"space-around",padding:"8px 0 max(8px,env(safe-area-inset-bottom))",zIndex:100}}>
      {navItems.slice(0,5).map(n=>(
        <button key={n.key} onClick={()=>navTo(n.key)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,background:"none",border:"none",color:page===n.key?C.orange:C.muted,cursor:"pointer",padding:"4px 6px",position:"relative",minWidth:44}}>
          <span style={{fontSize:21}}>{n.icon}</span>
          <span style={{fontSize:9,fontWeight:page===n.key?700:400}}>{n.label}</span>
          {n.badge>0&&<span style={{position:"absolute",top:0,right:2,background:C.red,color:"#fff",borderRadius:99,fontSize:9,padding:"1px 5px",fontWeight:700}}>{n.badge}</span>}
        </button>
      ))}
      <button onClick={()=>setDrawerOpen(true)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,background:"none",border:"none",color:C.muted,cursor:"pointer",padding:"4px 6px",minWidth:44}}>
        <span style={{fontSize:21}}>☰</span><span style={{fontSize:9}}>Plus</span>
      </button>
    </div>
  );

  return(
    <div style={{display:"flex",height:"100vh",background:C.bg,color:C.white,fontFamily:"'Segoe UI',system-ui,sans-serif",overflow:"hidden"}}>
      <style>{`*{-webkit-tap-highlight-color:transparent;box-sizing:border-box;}input,select,textarea{font-size:16px!important;}@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Desktop sidebar */}
      {!isMobile&&(
        <div style={{width:bp==="md"?60:210,background:C.dark,borderRight:"1px solid "+C.border,display:"flex",flexDirection:"column",flexShrink:0}}>
          <div style={{padding:"18px 12px 16px",borderBottom:"1px solid "+C.border,display:"flex",alignItems:"center",gap:10}}>
            <div style={{background:C.orange,borderRadius:10,width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>🏗</div>
            {bp!=="md"&&<div><div style={{fontWeight:700,fontSize:13}}>JEAN MANAGER</div><div style={{fontSize:10,color:C.orange}}>☁️ Supabase</div></div>}
          </div>
          <nav style={{flex:1,padding:"10px 8px",overflowY:"auto"}}>
            {navItems.map(n=>(
              <button key={n.key} onClick={()=>setPage(n.key)} style={{width:"100%",display:"flex",alignItems:"center",gap:bp==="md"?0:10,padding:"10px",borderRadius:8,border:"none",background:page===n.key?C.orange+"22":"transparent",color:page===n.key?C.orange:C.muted,cursor:"pointer",marginBottom:2,justifyContent:bp==="md"?"center":"flex-start",position:"relative"}}>
                <span style={{fontSize:19,flexShrink:0}}>{n.icon}</span>
                {bp!=="md"&&<span style={{fontSize:13,fontWeight:page===n.key?700:400,flex:1}}>{n.label}</span>}
                {n.badge>0&&(bp==="md"?<span style={{position:"absolute",top:4,right:4,background:C.red,color:"#fff",borderRadius:99,fontSize:9,padding:"1px 4px",fontWeight:700}}>{n.badge}</span>:<span style={{background:C.red,color:"#fff",borderRadius:99,fontSize:10,padding:"1px 6px",fontWeight:700}}>{n.badge}</span>)}
              </button>
            ))}
          </nav>
          {bp!=="md"&&<div style={{padding:8,borderTop:"1px solid "+C.border}}><button onClick={reload} style={{width:"100%",background:C.blue+"22",border:"1px solid "+C.blue+"44",color:C.blue,borderRadius:8,padding:8,fontSize:11,fontWeight:700,cursor:"pointer"}}>🔄 Sync</button></div>}
        </div>
      )}

      {/* Main */}
      <div style={{flex:1,overflow:"auto",display:"flex",flexDirection:"column",paddingBottom:isMobile?72:0}}>
        {/* Topbar */}
        <div style={{background:C.dark,borderBottom:"1px solid "+C.border,padding:isMobile?"12px 16px":"12px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,position:"sticky",top:0,zIndex:50}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {isMobile&&<button onClick={()=>setDrawerOpen(true)} style={{background:"none",border:"none",color:C.muted,fontSize:22,cursor:"pointer",padding:"0 4px"}}>☰</button>}
            <div style={{fontSize:isMobile?14:16,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:isMobile?160:340}}>
              {page==="fiche"&&selected?"🏗️ "+selected.nom:navItems.find(n=>n.key===page)?.icon+" "+navItems.find(n=>n.key===page)?.label}
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            {(page==="chantiers"||page==="dashboard")&&<button onClick={()=>setShowNewCh(true)} style={{background:C.orange,color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",fontWeight:700,cursor:"pointer",fontSize:13}}>+{isMobile?"":" Chantier"}</button>}
            {page==="fiche"&&selected&&<button onClick={()=>{if(window.confirm("Supprimer ?"))delCh(selected.id);}} style={{background:C.red+"22",color:C.red,border:"1px solid "+C.red+"44",borderRadius:8,padding:"7px 12px",fontWeight:700,cursor:"pointer",fontSize:12}}>🗑️</button>}
          </div>
        </div>

        <div style={{flex:1,overflow:"auto",padding:isMobile?"12px":"24px",WebkitOverflowScrolling:"touch"}}>
          {loading?<Spinner/>:error?(
            <div style={{background:C.red+"11",border:"1px solid "+C.red+"44",borderRadius:12,padding:24,textAlign:"center"}}>
              <div style={{fontSize:32,marginBottom:8}}>⚠️</div>
              <div style={{color:C.red,fontWeight:700,marginBottom:8}}>Erreur Supabase</div>
              <div style={{color:C.muted,fontSize:13,marginBottom:16}}>{error}</div>
              <button onClick={reload} style={{background:C.orange,color:"#fff",border:"none",borderRadius:8,padding:"10px 24px",fontWeight:700,cursor:"pointer"}}>🔄 Réessayer</button>
            </div>
          ):<>
            {page==="dashboard"&&<DashboardPage chantiers={chantiers} openCh={openCh} interventions={interventions} devis={devis} navTo={navTo}/>}
            {page==="chantiers"&&<ChantiersPage chantiers={chantiers} openCh={openCh} filter={filterSt} setFilter={setFilterSt} delCh={delCh}/>}
            {page==="fiche"&&selected&&<FichePage chantier={selected} onglet={onglet} setOnglet={setOnglet} setPage={setPage} chantiers={chantiers} reload={reload}/>}
            {page==="devis"&&<DevisPage devis={devis} setDev={setDev} chantiers={chantiers}/>}
            {page==="interventions"&&<InterventionsPage interventions={interventions} chantiers={chantiers} reload={reload}/>}
            {page==="alertes"&&<AlertesPage chantiers={chantiers} openCh={openCh}/>}
            {page==="kpi"&&<KpiPage chantiers={chantiers}/>}
            {page==="ia"&&<IAPage chantiers={chantiers} openCh={openCh} interventions={interventions}/>}
            {page==="gestion"&&<GestionPage chantiers={chantiers} openCh={openCh} reload={reload}/>}
          </>}
        </div>
      </div>

      {isMobile&&<BottomBar/>}
      {isMobile&&drawerOpen&&<Drawer/>}

      {showNewCh&&(
        <Modal title="+ Nouveau Chantier" onClose={()=>setShowNewCh(false)} onSave={saveCh}>
          {saving?<Spinner/>:<FGrid cols={2}>
            <FField label="Nom *" value={newChForm.nom} onChange={v=>setNewChForm(p=>({...p,nom:v}))} full/>
            <FField label="Client *" value={newChForm.client} onChange={v=>setNewChForm(p=>({...p,client:v}))}/>
            <FSelect label="Type" value={newChForm.type} onChange={v=>setNewChForm(p=>({...p,type:v}))} options={["Construction","Réhabilitation","Maintenance"]}/>
            <FField label="Localisation" value={newChForm.localisation} onChange={v=>setNewChForm(p=>({...p,localisation:v}))} full/>
            <FField label="Budget (XOF) *" type="number" value={newChForm.budgetInitial} onChange={v=>setNewChForm(p=>({...p,budgetInitial:v}))} full/>
            <FField label="Date début" type="date" value={newChForm.dateDebut} onChange={v=>setNewChForm(p=>({...p,dateDebut:v}))}/>
            <FField label="Date fin" type="date" value={newChForm.dateFin} onChange={v=>setNewChForm(p=>({...p,dateFin:v}))}/>
          </FGrid>}
        </Modal>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 📄 MODULE DEVIS — Page principale
// ═════════════════════════════════════════════════════════════════════════════
function DevisPage({devis,setDev,chantiers}){
  const {isMobile}=useBP();
  const [showForm,setShowForm]=useState(false);
  const [editDevis,setEditDevis]=useState(null);
  const [viewDevis,setViewDevis]=useState(null);
  const [filterSt,setFilterSt]=useState("Tous");
  const [templateFile,setTemplateFile]=useState(null);
  const fileRef=useRef();

  const statuts=["Tous","brouillon","envoyé","accepté","refusé"];
  const filtered=filterSt==="Tous"?devis:devis.filter(d=>d.statut===filterSt);

  const totalCA=devis.filter(d=>d.statut==="accepté").reduce((a,d)=>a+d.total_ttc,0);
  const totalEnCours=devis.filter(d=>d.statut==="envoyé").reduce((a,d)=>a+d.total_ttc,0);
  const txConversion=devis.length>0?Math.round(devis.filter(d=>d.statut==="accepté").length/devis.length*100):0;

  const handleSave=(newDev)=>{
    if(editDevis){
      setDev(prev=>prev.map(d=>d.id===newDev.id?newDev:d));
    } else {
      setDev(prev=>[newDev,...prev]);
    }
    setShowForm(false);setEditDevis(null);
  };

  const handleDelete=id=>setDev(prev=>prev.filter(d=>d.id!==id));
  const handleStatut=(id,s)=>setDev(prev=>prev.map(d=>d.id===id?{...d,statut:s}:d));

  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(5,1fr)",gap:10}}>
        <KpiCard icon="📄" label="Total devis" value={devis.length} color={C.orange} compact={isMobile}/>
        <KpiCard icon="✅" label="Acceptés" value={devis.filter(d=>d.statut==="accepté").length} color={C.green} compact={isMobile}/>
        <KpiCard icon="📨" label="Envoyés" value={devis.filter(d=>d.statut==="envoyé").length} color={C.blue} compact={isMobile}/>
        <KpiCard icon="💰" label="CA accepté" value={fmtS(totalCA)} color={C.green} compact={isMobile}/>
        <KpiCard icon="📊" label="Taux conv." value={txConversion+"%"} color={txConversion>50?C.green:txConversion>25?C.yellow:C.red} compact={isMobile}/>
      </div>

      {/* Toolbar */}
      <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,padding:"12px 16px",display:"flex",flexDirection:"column",gap:10}}>
        {/* Template upload */}
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <div style={{fontSize:12,color:C.muted,flex:1}}>
            📁 Template Excel : {templateFile?<span style={{color:C.green,fontWeight:700}}>✅ {templateFile.name}</span>:<span style={{color:C.yellow}}>⚠️ Aucun template — export standard</span>}
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={e=>setTemplateFile(e.target.files[0])}/>
          <button onClick={()=>fileRef.current.click()} style={{background:C.blue+"22",color:C.blue,border:"1px solid "+C.blue+"44",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>
            📤 {templateFile?"Changer":"Importer"} template
          </button>
          {templateFile&&<button onClick={()=>setTemplateFile(null)} style={{background:C.red+"22",color:C.red,border:"1px solid "+C.red+"44",borderRadius:8,padding:"6px 10px",fontSize:12,cursor:"pointer"}}>✕</button>}
        </div>
        {/* Filtres + bouton */}
        <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",gap:4,overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
            {statuts.map(s=>(
              <button key={s} onClick={()=>setFilterSt(s)} style={{padding:"5px 12px",borderRadius:20,border:"1px solid "+(filterSt===s?C.orange:C.border),background:filterSt===s?C.orange:"transparent",color:filterSt===s?"#fff":C.muted,cursor:"pointer",fontSize:11,fontWeight:filterSt===s?700:400,whiteSpace:"nowrap",flexShrink:0,textTransform:"capitalize"}}>{s}</button>
            ))}
          </div>
          <button onClick={()=>{setEditDevis(null);setShowForm(true);}} style={{background:C.orange,color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontWeight:700,cursor:"pointer",fontSize:13,flexShrink:0}}>+ Nouveau devis</button>
        </div>
      </div>

      {/* Liste devis */}
      {filtered.length===0&&<EmptyState msg="Aucun devis trouvé" icon="📄"/>}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(380px,1fr))",gap:14}}>
        {filtered.map(d=>{
          const ch=chantiers.find(c=>c.id===d.chantier_id);
          return(
            <div key={d.id} style={{background:C.card,border:"1px solid "+C.border,borderRadius:14,padding:18,display:"flex",flexDirection:"column",gap:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                <div>
                  <div style={{fontWeight:800,fontSize:15,color:C.orange}}>{d.numero}</div>
                  <div style={{fontWeight:600,fontSize:14,marginTop:2}}>{d.client_nom}</div>
                  <div style={{fontSize:11,color:C.muted,marginTop:2}}>📅 {d.date_creation} · validité : {d.date_validite}</div>
                  {ch&&<div style={{fontSize:11,color:C.muted}}>🏗️ {ch.nom}</div>}
                </div>
                <Badge label={d.statut} color={STATUT_DEVIS_COLOR[d.statut]||C.muted}/>
              </div>

              <div style={{background:C.mid,borderRadius:8,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:10,color:C.muted}}>TOTAL TTC</div>
                  <div style={{fontWeight:800,fontSize:18,color:C.orange}}>{fmt(d.total_ttc)}</div>
                  <div style={{fontSize:10,color:C.muted}}>HT : {fmt(d.sous_total)} · TVA {d.taux_tva}%{d.taux_remise>0?" · Remise "+d.taux_remise+"%":""}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:10,color:C.muted}}>Articles</div>
                  <div style={{fontWeight:700,fontSize:16}}>{(d.articles||[]).length}</div>
                </div>
              </div>

              {/* Statut selector */}
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {["brouillon","envoyé","accepté","refusé"].map(s=>(
                  <button key={s} onClick={()=>handleStatut(d.id,s)} style={{padding:"4px 10px",borderRadius:20,border:"1px solid "+(d.statut===s?(STATUT_DEVIS_COLOR[s]||C.orange):C.border),background:d.statut===s?(STATUT_DEVIS_COLOR[s]||C.orange)+"22":"transparent",color:d.statut===s?(STATUT_DEVIS_COLOR[s]||C.orange):C.muted,cursor:"pointer",fontSize:10,fontWeight:d.statut===s?700:400,textTransform:"capitalize"}}>{s}</button>
                ))}
              </div>

              {/* Actions */}
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                <button onClick={()=>setViewDevis(d)} style={{flex:1,background:C.blue+"22",color:C.blue,border:"1px solid "+C.blue+"44",borderRadius:8,padding:"7px",fontSize:12,cursor:"pointer",fontWeight:600}}>👁️ Aperçu</button>
                <button onClick={()=>{genererExcelDevis(d,d.articles||[],calcDevis(d.articles||[],d.taux_tva,d.taux_remise),ch?.nom,templateFile);}} style={{flex:1,background:C.green+"22",color:C.green,border:"1px solid "+C.green+"44",borderRadius:8,padding:"7px",fontSize:12,cursor:"pointer",fontWeight:600}}>📥 Excel</button>
                <button onClick={()=>{imprimerDevis(d,d.articles||[],calcDevis(d.articles||[],d.taux_tva,d.taux_remise),ch?.nom);}} style={{flex:1,background:C.purple+"22",color:C.purple,border:"1px solid "+C.purple+"44",borderRadius:8,padding:"7px",fontSize:12,cursor:"pointer",fontWeight:600}}>🖨️ Print</button>
                <button onClick={()=>{setEditDevis(d);setShowForm(true);}} style={{background:C.yellow+"22",color:C.yellow,border:"1px solid "+C.yellow+"44",borderRadius:8,padding:"7px 10px",fontSize:12,cursor:"pointer"}}>✏️</button>
                <button onClick={()=>{if(window.confirm("Supprimer ce devis ?"))handleDelete(d.id);}} style={{background:C.red+"22",color:C.red,border:"1px solid "+C.red+"44",borderRadius:8,padding:"7px 10px",fontSize:12,cursor:"pointer"}}>🗑️</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Formulaire devis */}
      {showForm&&<DevisForm chantiers={chantiers} editDevis={editDevis} onSave={handleSave} onClose={()=>{setShowForm(false);setEditDevis(null);}}/>}

      {/* Aperçu devis */}
      {viewDevis&&<DevisApercu devis={viewDevis} chantiers={chantiers} templateFile={templateFile} onClose={()=>setViewDevis(null)}/>}
    </div>
  );
}

// ─── Formulaire Devis complet ─────────────────────────────────────────────────
function DevisForm({chantiers,editDevis,onSave,onClose}){
  const {isMobile}=useBP();
  const defArticle=()=>({id:Date.now(),designation:"",quantite:1,unite:"U",prix_unitaire:0,total_ligne:0});

  const [form,setForm]=useState(editDevis||{
    id:Date.now(),
    numero:genNumero(),
    statut:"brouillon",
    client_nom:"",client_adresse:"",client_telephone:"",client_email:"",
    chantier_id:"",
    date_creation:today(),
    date_validite:addDays(today(),30),
    taux_tva:18,
    taux_remise:0,
    conditions_paiement:"30% à la commande, 40% à mi-chantier, 30% à la livraison.",
    notes:"",
    articles:[defArticle()]
  });

  const up=(k,v)=>setForm(p=>({...p,[k]:v}));
  const upArt=(idx,k,v)=>setForm(p=>{
    const arts=[...p.articles];
    arts[idx]={...arts[idx],[k]:v};
    if(k==="quantite"||k==="prix_unitaire") arts[idx].total_ligne=(arts[idx].quantite||0)*(arts[idx].prix_unitaire||0);
    return{...p,articles:arts};
  });
  const addArt=()=>setForm(p=>({...p,articles:[...p.articles,defArticle()]}));
  const delArt=idx=>setForm(p=>({...p,articles:p.articles.filter((_,i)=>i!==idx)}));

  const calc=calcDevis(form.articles,form.taux_tva,form.taux_remise);

  const handleSave=()=>{
    if(!form.client_nom){alert("Le nom du client est requis.");return;}
    onSave({...form,...calc,sous_total:calc.sousTotal,montant_tva:calc.montantTVA,montant_remise:calc.montantRemise,total_ttc:calc.totalTTC,articles:calc.articles});
  };

  const sectionTitle=t=><div style={{fontWeight:700,fontSize:13,color:C.orange,marginBottom:12,marginTop:4,borderBottom:"1px solid "+C.border,paddingBottom:6}}>{t}</div>;

  return(
    <div style={{position:"fixed",inset:0,background:"#00000099",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div style={{background:C.dark,border:"1px solid "+C.border,borderRadius:"20px 20px 0 0",width:"100%",maxWidth:800,maxHeight:"96vh",overflow:"auto",WebkitOverflowScrolling:"touch",padding:"24px 20px"}}>
        <div style={{width:40,height:4,background:C.border,borderRadius:99,margin:"0 auto 20px"}}/>

        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div>
            <div style={{fontWeight:800,fontSize:18}}>{editDevis?"✏️ Modifier":"📄 Nouveau"} Devis</div>
            <div style={{fontSize:12,color:C.orange,fontWeight:700,marginTop:2}}>{form.numero}</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,fontSize:22,cursor:"pointer"}}>✕</button>
        </div>

        {/* Section client */}
        {sectionTitle("👤 Informations client")}
        <FGrid cols={isMobile?1:2}>
          <FField label="Nom client *" value={form.client_nom} onChange={v=>up("client_nom",v)} placeholder="SARL CONSTRUIRE ABIDJAN" full={isMobile}/>
          <FSelect label="Chantier lié" value={form.chantier_id} onChange={v=>up("chantier_id",v)} options={[["","— Aucun —"],...chantiers.map(c=>[c.id,c.nom])]}/>
          <FField label="Adresse client" value={form.client_adresse} onChange={v=>up("client_adresse",v)} placeholder="15 Avenue Houphouët-Boigny..."/>
          <FField label="Téléphone" value={form.client_telephone} onChange={v=>up("client_telephone",v)} placeholder="+225 07 00 00 00"/>
          <FField label="Email client" value={form.client_email} onChange={v=>up("client_email",v)} type="email" placeholder="contact@client.ci"/>
          <FField label="Date validité" value={form.date_validite} onChange={v=>up("date_validite",v)} type="date"/>
        </FGrid>

        {/* Section articles */}
        {sectionTitle("📦 Articles / Prestations")}
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:12}}>
          {/* En-tête colonnes */}
          {!isMobile&&(
            <div style={{display:"grid",gridTemplateColumns:"2fr 80px 80px 120px 110px 36px",gap:6}}>
              {["Désignation","Qté","Unité","P.U. HT","Total HT",""].map((h,i)=><div key={i} style={{fontSize:10,color:C.muted,fontWeight:700,padding:"0 4px"}}>{h}</div>)}
            </div>
          )}
          {form.articles.map((a,idx)=>(
            <div key={a.id} style={{background:C.mid,borderRadius:10,padding:"10px 12px"}}>
              {isMobile?(
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <div style={{background:C.orange,color:"#fff",borderRadius:6,width:22,height:22,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0}}>{idx+1}</div>
                    <input value={a.designation} onChange={e=>upArt(idx,"designation",e.target.value)} placeholder="Désignation..." style={{flex:1,background:C.dark,border:"1px solid "+C.border,borderRadius:7,padding:"7px 10px",color:C.white,fontSize:14,outline:"none"}}/>
                    <button onClick={()=>delArt(idx)} style={{background:C.red+"22",border:"none",color:C.red,borderRadius:6,padding:"6px 8px",cursor:"pointer",flexShrink:0}}>🗑️</button>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                    <div><div style={{fontSize:9,color:C.muted,marginBottom:2}}>QTÉ</div><input type="number" value={a.quantite} onChange={e=>upArt(idx,"quantite",parseFloat(e.target.value)||0)} style={{width:"100%",background:C.dark,border:"1px solid "+C.border,borderRadius:7,padding:"6px 8px",color:C.white,fontSize:14,outline:"none"}}/></div>
                    <div><div style={{fontSize:9,color:C.muted,marginBottom:2}}>UNITÉ</div>
                      <select value={a.unite} onChange={e=>upArt(idx,"unite",e.target.value)} style={{width:"100%",background:C.dark,border:"1px solid "+C.border,borderRadius:7,padding:"6px 8px",color:C.white,fontSize:14,outline:"none",WebkitAppearance:"none"}}>
                        {UNITES.map(u=><option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <div><div style={{fontSize:9,color:C.muted,marginBottom:2}}>P.U. HT</div><input type="number" value={a.prix_unitaire} onChange={e=>upArt(idx,"prix_unitaire",parseFloat(e.target.value)||0)} style={{width:"100%",background:C.dark,border:"1px solid "+C.border,borderRadius:7,padding:"6px 8px",color:C.white,fontSize:14,outline:"none"}}/></div>
                  </div>
                  <div style={{textAlign:"right",fontWeight:700,color:C.orange}}>Total : {fmt(a.total_ligne)}</div>
                </div>
              ):(
                <div style={{display:"grid",gridTemplateColumns:"2fr 80px 80px 120px 110px 36px",gap:6,alignItems:"center"}}>
                  <input value={a.designation} onChange={e=>upArt(idx,"designation",e.target.value)} placeholder="Désignation de la prestation..." style={{background:C.dark,border:"1px solid "+C.border,borderRadius:7,padding:"7px 10px",color:C.white,fontSize:14,outline:"none"}}/>
                  <input type="number" value={a.quantite} onChange={e=>upArt(idx,"quantite",parseFloat(e.target.value)||0)} style={{background:C.dark,border:"1px solid "+C.border,borderRadius:7,padding:"7px 8px",color:C.white,fontSize:14,outline:"none",textAlign:"center"}}/>
                  <select value={a.unite} onChange={e=>upArt(idx,"unite",e.target.value)} style={{background:C.dark,border:"1px solid "+C.border,borderRadius:7,padding:"7px 6px",color:C.white,fontSize:13,outline:"none",WebkitAppearance:"none",textAlign:"center"}}>
                    {UNITES.map(u=><option key={u} value={u}>{u}</option>)}
                  </select>
                  <input type="number" value={a.prix_unitaire} onChange={e=>upArt(idx,"prix_unitaire",parseFloat(e.target.value)||0)} style={{background:C.dark,border:"1px solid "+C.border,borderRadius:7,padding:"7px 8px",color:C.white,fontSize:14,outline:"none",textAlign:"right"}}/>
                  <div style={{fontWeight:700,color:C.orange,fontSize:13,textAlign:"right",padding:"0 4px"}}>{fmt(a.total_ligne)}</div>
                  <button onClick={()=>delArt(idx)} style={{background:C.red+"22",border:"none",color:C.red,borderRadius:6,padding:"6px 8px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>🗑️</button>
                </div>
              )}
            </div>
          ))}
          <button onClick={addArt} style={{background:C.orange+"22",border:"2px dashed "+C.orange+"66",color:C.orange,borderRadius:10,padding:"10px",fontWeight:700,cursor:"pointer",fontSize:13,width:"100%"}}>+ Ajouter un article</button>
        </div>

        {/* Section calculs */}
        {sectionTitle("💰 Paramètres financiers")}
        <FGrid cols={isMobile?1:3}>
          <FField label="TVA (%)" type="number" value={form.taux_tva} onChange={v=>up("taux_tva",parseFloat(v)||0)}/>
          <FField label="Remise (%)" type="number" value={form.taux_remise} onChange={v=>up("taux_remise",parseFloat(v)||0)}/>
          <div style={{background:C.orange+"11",border:"1px solid "+C.orange+"44",borderRadius:8,padding:"10px 14px",display:"flex",flexDirection:"column",justifyContent:"center"}}>
            <div style={{fontSize:10,color:C.muted}}>TOTAL TTC</div>
            <div style={{fontWeight:800,fontSize:18,color:C.orange}}>{fmt(calc.totalTTC)}</div>
          </div>
        </FGrid>

        {/* Preview calculs */}
        <div style={{background:C.mid,borderRadius:10,padding:"14px 16px",marginTop:12}}>
          {[
            ["Sous-total HT",fmt(calc.sousTotal),C.white],
            ...(form.taux_remise>0?[["Remise ("+form.taux_remise+"%)","- "+fmt(calc.montantRemise),C.red],["Base imposable",fmt(calc.baseImp),C.muted]]:  []),
            ["TVA ("+form.taux_tva+"%)",fmt(calc.montantTVA),C.muted],
          ].map(([k,v,col])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",fontSize:13,borderBottom:"1px solid "+C.border}}>
              <span style={{color:C.muted}}>{k}</span><span style={{fontWeight:600,color:col}}>{v}</span>
            </div>
          ))}
          <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",marginTop:4}}>
            <span style={{fontWeight:700,fontSize:14}}>TOTAL TTC</span>
            <span style={{fontWeight:800,fontSize:16,color:C.orange}}>{fmt(calc.totalTTC)}</span>
          </div>
        </div>

        {/* Conditions */}
        {sectionTitle("📋 Conditions & Notes")}
        <FGrid cols={1}>
          <FField label="Conditions de paiement" value={form.conditions_paiement} onChange={v=>up("conditions_paiement",v)} rows={2} full/>
          <FField label="Notes / Remarques" value={form.notes} onChange={v=>up("notes",v)} rows={2} full/>
        </FGrid>

        {/* Boutons */}
        <div style={{display:"flex",gap:10,marginTop:20,justifyContent:"flex-end",flexWrap:"wrap"}}>
          <button onClick={onClose} style={{padding:"10px 20px",background:C.mid,color:C.white,border:"none",borderRadius:10,cursor:"pointer"}}>Annuler</button>
          <button onClick={()=>{up("statut","brouillon");setTimeout(handleSave,50);}} style={{padding:"10px 20px",background:C.muted,color:"#fff",border:"none",borderRadius:10,fontWeight:700,cursor:"pointer"}}>💾 Brouillon</button>
          <button onClick={handleSave} style={{padding:"10px 24px",background:C.orange,color:"#fff",border:"none",borderRadius:10,fontWeight:700,cursor:"pointer",fontSize:14}}>✅ Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

// ─── Aperçu Devis ─────────────────────────────────────────────────────────────
function DevisApercu({devis:d,chantiers,templateFile,onClose}){
  const {isMobile}=useBP();
  const ch=chantiers.find(c=>c.id===d.chantier_id);
  const calc=calcDevis(d.articles||[],d.taux_tva,d.taux_remise);
  const entreprise={nom:"JEAN BTP SARL",adresse:"Zone Industrielle, Abidjan",tel:"+225 27 00 00 00",email:"devis@jeanbtp.ci",siret:"CI-ABJ-2024-B-12345"};
  return(
    <div style={{position:"fixed",inset:0,background:"#00000099",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div style={{background:"#fff",color:"#222",borderRadius:"20px 20px 0 0",width:"100%",maxWidth:780,maxHeight:"96vh",overflow:"auto",WebkitOverflowScrolling:"touch"}}>
        {/* Toolbar aperçu */}
        <div style={{background:C.dark,padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",borderRadius:"20px 20px 0 0",position:"sticky",top:0,zIndex:10}}>
          <div style={{fontWeight:700,color:C.white,fontSize:14}}>👁️ Aperçu — {d.numero}</div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>genererExcelDevis(d,d.articles||[],calc,ch?.nom,templateFile)} style={{background:C.green+"22",color:C.green,border:"1px solid "+C.green+"44",borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>📥 Excel</button>
            <button onClick={()=>imprimerDevis(d,d.articles||[],calc,ch?.nom)} style={{background:C.purple+"22",color:C.purple,border:"1px solid "+C.purple+"44",borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>🖨️ Imprimer</button>
            <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,fontSize:22,cursor:"pointer"}}>✕</button>
          </div>
        </div>

        {/* Corps du devis — style papier */}
        <div style={{padding:isMobile?"16px":"32px",fontFamily:"Arial,sans-serif"}}>
          {/* Header */}
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:24,gap:16,flexWrap:isMobile?"wrap":"nowrap"}}>
            <div>
              <div style={{fontSize:20,fontWeight:800,color:"#F97316"}}>{entreprise.nom}</div>
              <div style={{fontSize:11,color:"#666",lineHeight:1.7,marginTop:4}}>{entreprise.adresse}<br/>{entreprise.tel}<br/>{entreprise.email}<br/>SIRET : {entreprise.siret}</div>
            </div>
            <div style={{textAlign:isMobile?"left":"right"}}>
              <div style={{background:"#F97316",color:"#fff",borderRadius:6,padding:"6px 20px",fontWeight:800,fontSize:16,display:"inline-block"}}>DEVIS</div>
              <div style={{fontSize:11,color:"#666",marginTop:8,lineHeight:1.7}}>N° <strong style={{color:"#222"}}>{d.numero}</strong><br/>Date : {d.date_creation}<br/>Validité : {d.date_validite}</div>
            </div>
          </div>

          {/* Client */}
          <div style={{background:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:8,padding:"12px 16px",marginBottom:20}}>
            <div style={{fontSize:10,color:"#888",fontWeight:700,marginBottom:6,letterSpacing:1}}>DESTINATAIRE</div>
            <div style={{fontWeight:700,fontSize:14}}>{d.client_nom}</div>
            {d.client_adresse&&<div style={{fontSize:12,color:"#555",marginTop:2}}>{d.client_adresse}</div>}
            <div style={{fontSize:12,color:"#555",marginTop:2}}>{[d.client_telephone,d.client_email].filter(Boolean).join(" · ")}</div>
            {ch&&<div style={{fontSize:11,color:"#F97316",marginTop:4,fontWeight:600}}>🏗️ Chantier : {ch.nom}</div>}
          </div>

          {/* Table articles */}
          <table style={{width:"100%",borderCollapse:"collapse",marginBottom:20,fontSize:11}}>
            <thead>
              <tr style={{background:"#F97316",color:"#fff"}}>
                <th style={{padding:"8px",textAlign:"left",borderRadius:"4px 0 0 4px"}}>#</th>
                <th style={{padding:"8px",textAlign:"left"}}>Désignation</th>
                {!isMobile&&<><th style={{padding:"8px",textAlign:"center"}}>Qté</th><th style={{padding:"8px",textAlign:"center"}}>Unité</th><th style={{padding:"8px",textAlign:"right"}}>P.U. HT</th></>}
                <th style={{padding:"8px",textAlign:"right",borderRadius:"0 4px 4px 0"}}>Total HT</th>
              </tr>
            </thead>
            <tbody>
              {(d.articles||[]).map((a,i)=>(
                <tr key={a.id} style={{background:i%2===0?"#fff":"#fafafa",borderBottom:"1px solid #eee"}}>
                  <td style={{padding:"8px",color:"#888",fontWeight:600}}>{i+1}</td>
                  <td style={{padding:"8px"}}>
                    <div style={{fontWeight:600}}>{a.designation}</div>
                    {isMobile&&<div style={{fontSize:10,color:"#888"}}>{a.quantite} {a.unite} × {fmt(a.prix_unitaire)}</div>}
                  </td>
                  {!isMobile&&<><td style={{padding:"8px",textAlign:"center"}}>{a.quantite}</td><td style={{padding:"8px",textAlign:"center",color:"#888"}}>{a.unite}</td><td style={{padding:"8px",textAlign:"right"}}>{fmt(a.prix_unitaire)}</td></>}
                  <td style={{padding:"8px",textAlign:"right",fontWeight:700,color:"#F97316"}}>{fmt(a.total_ligne)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totaux */}
          <div style={{display:"flex",justifyContent:"flex-end"}}>
            <table style={{width:isMobile?"100%":"340px",borderCollapse:"collapse",border:"1px solid #eee",borderRadius:8,overflow:"hidden",fontSize:12}}>
              <tbody>
                <tr><td style={{padding:"8px 14px",color:"#666"}}>Sous-total HT</td><td style={{padding:"8px 14px",textAlign:"right",fontWeight:600}}>{fmt(calc.sousTotal)}</td></tr>
                {d.taux_remise>0&&<tr style={{background:"#FFF5F5"}}><td style={{padding:"8px 14px",color:"#ef4444"}}>Remise ({d.taux_remise}%)</td><td style={{padding:"8px 14px",textAlign:"right",color:"#ef4444",fontWeight:600}}>- {fmt(calc.montantRemise)}</td></tr>}
                {d.taux_remise>0&&<tr><td style={{padding:"8px 14px",color:"#666"}}>Base imposable</td><td style={{padding:"8px 14px",textAlign:"right",fontWeight:600}}>{fmt(calc.baseImp)}</td></tr>}
                <tr><td style={{padding:"8px 14px",color:"#666"}}>TVA ({d.taux_tva}%)</td><td style={{padding:"8px 14px",textAlign:"right",fontWeight:600}}>{fmt(calc.montantTVA)}</td></tr>
                <tr style={{background:"#F97316"}}><td style={{padding:"10px 14px",color:"#fff",fontWeight:800,fontSize:13}}>TOTAL TTC</td><td style={{padding:"10px 14px",textAlign:"right",color:"#fff",fontWeight:800,fontSize:15}}>{fmt(calc.totalTTC)}</td></tr>
              </tbody>
            </table>
          </div>

          {/* Footer */}
          {(d.conditions_paiement||d.notes)&&<div style={{marginTop:24,padding:"14px 16px",background:"#f9f9f9",borderRadius:8,fontSize:11,color:"#555"}}>
            {d.conditions_paiement&&<><strong style={{display:"block",marginBottom:4}}>Conditions de paiement :</strong><p style={{margin:0}}>{d.conditions_paiement}</p></>}
            {d.notes&&<><strong style={{display:"block",marginTop:10,marginBottom:4}}>Notes :</strong><p style={{margin:0}}>{d.notes}</p></>}
          </div>}

          {/* Signatures */}
          <div style={{display:"flex",justifyContent:"space-between",marginTop:32,gap:20}}>
            {["Signature client","Signature "+entreprise.nom].map(s=>(
              <div key={s} style={{flex:1,borderTop:"2px solid #333",paddingTop:8,fontSize:11,color:"#666",textAlign:"center"}}>{s}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Pages existantes (Dashboard, Chantiers, Fiche, Interventions, etc.)
// ═════════════════════════════════════════════════════════════════════════════

function DashboardPage({chantiers,openCh,interventions,devis,navTo}){
  const {isMobile}=useBP();
  const totalB=chantiers.reduce((a,c)=>a+c.budgetInitial,0);
  const totalD=chantiers.reduce((a,c)=>a+totalDep(c),0);
  const totalDevisCA=devis.filter(d=>d.statut==="accepté").reduce((a,d)=>a+d.total_ttc,0);
  const pieData=[
    {name:"En cours",value:chantiers.filter(c=>c.statut==="En cours").length,color:C.blue},
    {name:"En dérive",value:chantiers.filter(c=>c.statut==="En dérive").length,color:C.red},
    {name:"Planifié",value:chantiers.filter(c=>c.statut==="Planifié").length,color:C.yellow},
    {name:"Clôturé",value:chantiers.filter(c=>c.statut==="Clôturé").length,color:C.green},
  ].filter(d=>d.value>0);
  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(5,1fr)",gap:10}}>
        <KpiCard icon="🏗️" label="Chantiers" value={chantiers.length} color={C.orange} compact={isMobile}/>
        <KpiCard icon="💰" label="Budget" value={fmtS(totalB)} compact={isMobile}/>
        <KpiCard icon="📊" label="Consommé" value={pct(totalD,totalB)+"%"} color={pct(totalD,totalB)>80?C.red:C.green} compact={isMobile}/>
        <KpiCard icon="📄" label="Devis CA" value={fmtS(totalDevisCA)} color={C.green} compact={isMobile}/>
        <KpiCard icon="🔧" label="Interventions" value={interventions.filter(i=>i.statut==="En cours").length} color={C.blue} compact={isMobile}/>
      </div>

      {/* Raccourci devis */}
      {devis.filter(d=>d.statut==="envoyé").length>0&&(
        <div onClick={()=>navTo("devis")} style={{background:C.blue+"11",border:"1px solid "+C.blue+"44",borderRadius:12,padding:"14px 18px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{fontWeight:700,color:C.blue}}>📨 {devis.filter(d=>d.statut==="envoyé").length} devis en attente de réponse</div><div style={{fontSize:12,color:C.muted,marginTop:2}}>Cliquez pour gérer</div></div>
          <span style={{color:C.blue,fontSize:20}}>→</span>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:16}}>
        <Card title="Statuts chantiers">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart><Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={65} label={({name,value})=>name+"("+value+")"} labelLine={false}>
              {pieData.map((d,i)=><Cell key={i} fill={d.color}/>)}
            </Pie><Tooltip contentStyle={{background:C.dark,border:"1px solid "+C.border,color:C.white}}/></PieChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Devis par statut">
          {devis.length===0?<EmptyState msg="Aucun devis" icon="📄"/>:
          <div style={{display:"flex",flexDirection:"column",gap:8,paddingTop:4}}>
            {["brouillon","envoyé","accepté","refusé"].map(s=>{
              const nb=devis.filter(d=>d.statut===s).length;
              const total=devis.filter(d=>d.statut===s).reduce((a,d)=>a+d.total_ttc,0);
              return nb>0&&(
                <div key={s} style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <Badge label={s} color={STATUT_DEVIS_COLOR[s]||C.muted} small/>
                    <span style={{fontSize:12,color:C.muted}}>{nb} devis</span>
                  </div>
                  <span style={{fontWeight:700,fontSize:13}}>{fmtS(total)}</span>
                </div>
              );
            })}
          </div>}
        </Card>
      </div>

      <Card title="Chantiers actifs">
        {chantiers.filter(c=>c.statut!=="Clôturé"&&c.statut!=="Brouillon").slice(0,6).map(c=>{
          const d=totalDep(c),p=pct(d,c.budgetInitial);
          return(
            <div key={c.id} onClick={()=>openCh(c.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:"1px solid "+C.border,cursor:"pointer"}}>
              <div style={{flex:2}}><div style={{fontWeight:600,fontSize:13}}>{c.nom}</div><div style={{fontSize:11,color:C.muted}}>{c.client}</div></div>
              <Badge label={c.statut} color={stC(c.statut)}/>
              <div style={{flex:1,minWidth:80}}><PBar p={p} color={p>100?C.red:p>80?C.yellow:C.green} h={6}/><div style={{fontSize:10,color:C.muted,textAlign:"right",marginTop:2}}>{p}%</div></div>
            </div>
          );
        })}
        {chantiers.filter(c=>c.statut!=="Clôturé"&&c.statut!=="Brouillon").length===0&&<EmptyState msg="Aucun chantier actif" icon="🏗️"/>}
      </Card>
    </div>
  );
}

function ChantiersPage({chantiers,openCh,filter,setFilter,delCh}){
  const {isMobile}=useBP();
  const sts=["Tous","Planifié","En cours","En dérive","Clôturé","Brouillon"];
  const filtered=filter==="Tous"?chantiers:chantiers.filter(c=>c.statut===filter);
  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"flex",gap:6,overflowX:"auto",WebkitOverflowScrolling:"touch",paddingBottom:4}}>
        {sts.map(s=><button key={s} onClick={()=>setFilter(s)} style={{padding:"6px 12px",borderRadius:20,border:"1px solid "+(filter===s?C.orange:C.border),background:filter===s?C.orange:"transparent",color:filter===s?"#fff":C.muted,cursor:"pointer",fontSize:12,fontWeight:filter===s?700:400,whiteSpace:"nowrap",flexShrink:0}}>{s}</button>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(320px,1fr))",gap:14}}>
        {filtered.map(c=>{const d=totalDep(c),p=pct(d,c.budgetInitial),s=ssb(d,c.budgetInitial);return(
          <div key={c.id} onClick={()=>openCh(c.id)} style={{background:C.card,border:"1px solid "+(s==="Dépassement"?C.red+"66":C.border),borderRadius:14,padding:16,cursor:"pointer",position:"relative"}}
            onMouseEnter={e=>e.currentTarget.style.borderColor=C.orange} onMouseLeave={e=>e.currentTarget.style.borderColor=s==="Dépassement"?C.red+"66":C.border}>
            <button onClick={e=>{e.stopPropagation();if(window.confirm("Supprimer ?"))delCh(c.id);}} style={{position:"absolute",top:12,right:12,background:C.red+"22",border:"1px solid "+C.red+"44",color:C.red,borderRadius:6,padding:"3px 10px",fontSize:12,cursor:"pointer"}}>🗑️</button>
            <div style={{marginBottom:10,paddingRight:44}}><div style={{fontWeight:700,fontSize:15}}>{c.nom}</div><div style={{fontSize:12,color:C.muted}}>{c.client}</div>{c.localisation&&<div style={{fontSize:11,color:C.light}}>📍 {c.localisation}</div>}</div>
            <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}><Badge label={c.statut} color={stC(c.statut)}/><Badge label={c.type} color={C.orange} small/><Badge label={s} color={sbC(s)} small/></div>
            <div style={{marginBottom:4}}><div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}><span style={{color:C.muted}}>Budget</span><span style={{fontWeight:700,color:p>100?C.red:p>80?C.yellow:C.green}}>{p}%</span></div><PBar p={p} color={p>100?C.red:p>80?C.yellow:C.green}/></div>
            <div style={{marginTop:8,paddingTop:8,borderTop:"1px solid "+C.border,fontSize:12,color:C.muted}}>{fmtS(d)} / {fmtS(c.budgetInitial)}</div>
          </div>
        );})}
      </div>
      {filtered.length===0&&<EmptyState msg="Aucun chantier" icon="🏗️"/>}
    </div>
  );
}

function FichePage({chantier:c,onglet,setOnglet,setPage,chantiers,reload}){
  const {isMobile}=useBP();
  const onglets=["infos","budget","dépenses"];
  const dep=totalDep(c),depPct=pct(dep,c.budgetInitial),s=ssb(dep,c.budgetInitial);
  const [showNewDep,setShowNewDep]=useState(false);
  const [depForm,setDepForm]=useState({libelle:"",categorie:"Main d'œuvre",montant:"",date:today(),note:""});
  const [filterCat,setFilterCat]=useState("Toutes");
  const [showStatutMenu,setShowStatutMenu]=useState(false);
  const [saving,setSaving]=useState(false);
  const cycleVie=["Brouillon","Planifié","En cours","En pause","En dérive","En réception","Clôturé"];
  const cycleIdx=cycleVie.indexOf(c.statut);
  const changeSt=async st=>{await sb.from("chantiers").eq("id",c.id).update({statut:st});setShowStatutMenu(false);reload();};
  const addDep=async()=>{
    if(!depForm.libelle||!depForm.montant)return;setSaving(true);
    await sb.from("depenses").insert({chantier_id:c.id,libelle:depForm.libelle,categorie:depForm.categorie,montant:parseFloat(depForm.montant),date:depForm.date,note:depForm.note});
    setSaving(false);setShowNewDep(false);setDepForm({libelle:"",categorie:"Main d'œuvre",montant:"",date:today(),note:""});reload();
  };
  const delDep=async id=>{await sb.from("depenses").eq("id",id).del();reload();};
  const filteredDep=filterCat==="Toutes"?c.depenses:c.depenses.filter(d=>d.categorie===filterCat);
  return(
    <div style={{display:"flex",flexDirection:"column",gap:0}}>
      <button onClick={()=>setPage("chantiers")} style={{background:"none",border:"none",color:C.orange,cursor:"pointer",fontSize:13,marginBottom:12,textAlign:"left",padding:0}}>← Retour</button>
      <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:14,padding:isMobile?16:20,marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:10,marginBottom:12}}>
          <div style={{flex:1}}><div style={{fontSize:isMobile?18:22,fontWeight:800}}>{c.nom}</div><div style={{color:C.muted,fontSize:12,marginTop:4}}>👤 {c.client} · 📍 {c.localisation}</div></div>
          <div style={{position:"relative"}}>
            <button onClick={()=>setShowStatutMenu(p=>!p)} style={{display:"flex",alignItems:"center",gap:6,background:stC(c.statut)+"22",border:"2px solid "+stC(c.statut),borderRadius:8,padding:"6px 12px",color:stC(c.statut),cursor:"pointer",fontWeight:700,fontSize:12}}>{c.statut} ▼</button>
            {showStatutMenu&&<div style={{position:"absolute",right:0,top:"calc(100% + 6px)",background:C.dark,border:"1px solid "+C.border,borderRadius:10,zIndex:50,minWidth:170,boxShadow:"0 8px 24px #0008"}}>
              {cycleVie.map(st=><button key={st} onClick={()=>changeSt(st)} style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"10px 14px",border:"none",background:c.statut===st?stC(st)+"22":"transparent",color:c.statut===st?stC(st):C.white,cursor:"pointer",fontSize:13,textAlign:"left"}}><div style={{width:8,height:8,borderRadius:"50%",background:stC(st)}}/>{st}</button>)}
            </div>}
          </div>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}><Badge label={c.type} color={C.orange} small/><Badge label={s} color={sbC(s)} small/></div>
        <div style={{marginTop:14,overflowX:"auto",paddingBottom:4}}>
          <div style={{display:"flex",alignItems:"center",minWidth:"max-content"}}>
            {cycleVie.map((st,i)=>(
              <div key={st} style={{display:"flex",alignItems:"center"}}>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                  <button onClick={()=>changeSt(st)} style={{width:26,height:26,borderRadius:"50%",background:i===cycleIdx?C.orange:i<cycleIdx?C.green:C.mid,border:i===cycleIdx?"3px solid #FED7AA":"3px solid transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"#fff",cursor:"pointer"}}>{i<cycleIdx?"✓":i+1}</button>
                  <div style={{fontSize:8,color:i===cycleIdx?C.orange:i<cycleIdx?C.green:C.muted,whiteSpace:"nowrap",fontWeight:i===cycleIdx?700:400}}>{st}</div>
                </div>
                {i<cycleVie.length-1&&<div style={{width:16,height:2,background:i<cycleIdx?C.green:C.mid,marginBottom:12,flexShrink:0}}/>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{display:"flex",gap:4,marginBottom:16,overflowX:"auto",paddingBottom:2}}>
        {onglets.map(o=><button key={o} onClick={()=>setOnglet(o)} style={{padding:"8px 14px",borderRadius:8,border:"1px solid "+(onglet===o?C.orange:C.border),background:onglet===o?C.orange:C.card,color:onglet===o?"#fff":C.muted,cursor:"pointer",fontSize:12,fontWeight:onglet===o?700:400,whiteSpace:"nowrap",flexShrink:0,textTransform:"capitalize"}}>{o}{o==="dépenses"&&c.depenses.length>0&&<span style={{background:C.yellow,color:C.dark,borderRadius:99,fontSize:9,padding:"1px 5px",fontWeight:800,marginLeft:4}}>{c.depenses.length}</span>}</button>)}
      </div>

      {onglet==="infos"&&(
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14}}>
          <Card title="Informations">
            {[["Nom",c.nom],["Client",c.client],["Localisation",c.localisation],["Type",c.type],["Budget",fmt(c.budgetInitial)],["Dépenses",fmt(dep)],["Marge",fmt(c.budgetInitial-dep)],["Début",c.dateDebut],["Fin",c.dateFin]].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid "+C.border,fontSize:13,gap:8}}><span style={{color:C.muted}}>{k}</span><span style={{fontWeight:600,textAlign:"right",wordBreak:"break-word"}}>{v}</span></div>
            ))}
          </Card>
          <Card title="Synthèse budget">
            <div style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:6}}><span style={{color:C.muted}}>Consommé</span><strong style={{color:depPct>100?C.red:depPct>80?C.yellow:C.green}}>{depPct}%</strong></div><PBar p={depPct} color={depPct>100?C.red:depPct>80?C.yellow:C.green} h={14}/></div>
            {[["Budget",fmt(c.budgetInitial),C.white],["Dépenses",fmt(dep),C.yellow],["Marge",fmt(c.budgetInitial-dep),c.budgetInitial-dep>=0?C.green:C.red]].map(([k,v,col])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid "+C.border,fontSize:13}}><span style={{color:C.muted}}>{k}</span><span style={{fontWeight:700,color:col}}>{v}</span></div>
            ))}
          </Card>
        </div>
      )}

      {onglet==="budget"&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:10}}>
            <KpiCard icon="💰" label="Budget" value={fmtS(c.budgetInitial)} compact={isMobile}/>
            <KpiCard icon="🧾" label="Dépenses" value={fmtS(dep)} color={C.yellow} compact={isMobile}/>
            <KpiCard icon="💵" label="Marge" value={fmtS(c.budgetInitial-dep)} color={c.budgetInitial-dep>=0?C.green:C.red} compact={isMobile}/>
            <KpiCard icon="📊" label="%" value={depPct+"%"} color={depPct>100?C.red:depPct>80?C.yellow:C.green} compact={isMobile}/>
          </div>
          <Card title="Consommation"><PBar p={depPct} color={depPct>100?C.red:depPct>80?C.yellow:C.green} h={20}/></Card>
        </div>
      )}

      {onglet==="dépenses"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"flex",gap:6,justifyContent:"space-between",flexWrap:"wrap"}}>
            <div style={{display:"flex",gap:4,overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
              {["Toutes",...CATS].map(cat=><button key={cat} onClick={()=>setFilterCat(cat)} style={{padding:"5px 10px",borderRadius:20,border:"1px solid "+(filterCat===cat?C.orange:C.border),background:filterCat===cat?C.orange:"transparent",color:filterCat===cat?"#fff":C.muted,cursor:"pointer",fontSize:10,fontWeight:filterCat===cat?700:400,whiteSpace:"nowrap",flexShrink:0}}>{cat}</button>)}
            </div>
            <button onClick={()=>setShowNewDep(true)} style={{background:C.orange,color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontWeight:700,cursor:"pointer",fontSize:13,flexShrink:0}}>+ Ajouter</button>
          </div>
          {filteredDep.length===0&&<EmptyState msg="Aucune dépense" icon="🧾"/>}
          {filteredDep.map(d=>(
            <div key={d.id} style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
              <div style={{flex:1}}><div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}><div style={{width:7,height:7,borderRadius:"50%",background:catC(d.categorie)}}/><span style={{fontWeight:700,fontSize:13}}>{d.libelle}</span></div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}><Badge label={d.categorie} color={catC(d.categorie)} small/><span style={{fontSize:10,color:C.muted}}>📅 {d.date}</span>{d.note&&<span style={{fontSize:10,color:C.muted}}>{d.note}</span>}</div></div>
              <div style={{display:"flex",gap:6,alignItems:"center"}}><span style={{fontWeight:800,color:C.orange,fontSize:14}}>{fmtS(d.montant)}</span><button onClick={()=>delDep(d.id)} style={{background:C.red+"22",border:"1px solid "+C.red+"44",color:C.red,borderRadius:6,padding:"4px 8px",fontSize:11,cursor:"pointer"}}>🗑️</button></div>
            </div>
          ))}
          {filteredDep.length>0&&<div style={{background:C.card,border:"1px solid "+C.orange+"44",borderRadius:10,padding:"12px 14px",display:"flex",justifyContent:"space-between"}}><span style={{fontWeight:700,color:C.muted}}>Total</span><span style={{fontWeight:800,color:C.orange}}>{fmt(filteredDep.reduce((a,d)=>a+Number(d.montant),0))}</span></div>}
          {showNewDep&&(
            <Modal title="🧾 Nouvelle Dépense" onClose={()=>setShowNewDep(false)} onSave={addDep}>
              {saving?<Spinner/>:<FGrid cols={2}>
                <FField label="Libellé *" value={depForm.libelle} onChange={v=>setDepForm(p=>({...p,libelle:v}))} full/>
                <FSelect label="Catégorie" value={depForm.categorie} onChange={v=>setDepForm(p=>({...p,categorie:v}))} options={CATS}/>
                <FField label="Montant (XOF) *" type="number" value={depForm.montant} onChange={v=>setDepForm(p=>({...p,montant:v}))}/>
                <FField label="Date" type="date" value={depForm.date} onChange={v=>setDepForm(p=>({...p,date:v}))} full/>
                <FField label="Note" value={depForm.note} onChange={v=>setDepForm(p=>({...p,note:v}))} full/>
              </FGrid>}
            </Modal>
          )}
        </div>
      )}
    </div>
  );
}

function InterventionsPage({interventions,chantiers,reload}){
  const {isMobile}=useBP();
  const [filterT,setFilterT]=useState("Tous");
  const [filterS,setFilterS]=useState("Tous");
  const [showNew,setShowNew]=useState(false);
  const [viewId,setViewId]=useState(null);
  const [saving,setSaving]=useState(false);
  const [form,setForm]=useState({titre:"",description:"",type:"Corrective",intervenant:"",chantier:"",client:"",dateCreation:today(),duree:"",statut:"En attente"});
  const types=["Tous","Urgence","Préventive","Corrective","Inspection"];
  const statuts=["Tous","En attente","En cours","Terminée"];
  const STIC={"En attente":C.yellow,"En cours":C.blue,"Terminée":C.green};
  const totalIntDep=i=>(i.depenses||[]).reduce((a,d)=>a+Number(d.montant),0);
  const filtered=interventions.filter(i=>(filterT==="Tous"||i.type===filterT)&&(filterS==="Tous"||i.statut===filterS));
  const updateSt=async(id,s)=>{await sb.from("interventions").eq("id",id).update({statut:s});reload();};
  const delInt=async id=>{await sb.from("interventions").eq("id",id).del();reload();};
  const saveNew=async()=>{
    if(!form.titre)return;setSaving(true);
    await sb.from("interventions").insert({titre:form.titre,description:form.description,type:form.type,intervenant:form.intervenant,chantier:form.chantier,client:form.client,date_creation:form.dateCreation,duree:parseInt(form.duree)||1,statut:form.statut,facturee:false});
    setSaving(false);setShowNew(false);reload();
  };
  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:10}}>
        <KpiCard icon="🔧" label="Total" value={interventions.length} color={C.orange} compact={isMobile}/>
        <KpiCard icon="🚨" label="Urgences" value={interventions.filter(i=>i.type==="Urgence").length} color={C.red} compact={isMobile}/>
        <KpiCard icon="⚙️" label="En cours" value={interventions.filter(i=>i.statut==="En cours").length} color={C.blue} compact={isMobile}/>
        <KpiCard icon="💰" label="Coût" value={fmtS(interventions.reduce((a,i)=>a+totalIntDep(i),0))} color={C.yellow} compact={isMobile}/>
      </div>
      <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>
        <div style={{display:"flex",gap:4,overflowX:"auto"}}>{types.map(t=><button key={t} onClick={()=>setFilterT(t)} style={{padding:"5px 10px",borderRadius:20,border:"1px solid "+(filterT===t?C.orange:C.border),background:filterT===t?C.orange:"transparent",color:filterT===t?"#fff":C.muted,cursor:"pointer",fontSize:11,whiteSpace:"nowrap",flexShrink:0,fontWeight:filterT===t?700:400}}>{t}</button>)}</div>
        <div style={{display:"flex",gap:4,overflowX:"auto",justifyContent:"space-between"}}>
          <div style={{display:"flex",gap:4}}>{statuts.map(s=><button key={s} onClick={()=>setFilterS(s)} style={{padding:"5px 10px",borderRadius:20,border:"1px solid "+(filterS===s?C.orange:C.border),background:filterS===s?C.orange:"transparent",color:filterS===s?"#fff":C.muted,cursor:"pointer",fontSize:11,whiteSpace:"nowrap",flexShrink:0,fontWeight:filterS===s?700:400}}>{s}</button>)}</div>
          <button onClick={()=>setShowNew(true)} style={{background:C.orange,color:"#fff",border:"none",borderRadius:8,padding:"6px 14px",fontWeight:700,cursor:"pointer",fontSize:12,flexShrink:0}}>+ Nouvelle</button>
        </div>
      </div>
      {filtered.length===0&&<EmptyState msg="Aucune intervention" icon="🔧"/>}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(340px,1fr))",gap:12}}>
        {filtered.map(i=>(
          <div key={i.id} style={{background:C.card,border:"1px solid "+(i.type==="Urgence"?C.red+"66":C.border),borderRadius:14,padding:16,display:"flex",flexDirection:"column",gap:10}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:8}}>
              <div style={{flex:1}}><div style={{fontWeight:700,fontSize:14}}>{i.titre}</div><div style={{fontSize:11,color:C.muted}}>🏗️ {i.chantier||"—"} · 👤 {i.client||"—"}</div><div style={{fontSize:10,color:C.muted}}>📅 {i.dateCreation}</div></div>
              <Badge label={i.type} color={{Urgence:C.red,Préventive:C.blue,Corrective:C.orange,Inspection:C.purple}[i.type]||C.orange} small/>
            </div>
            {i.description&&<div style={{fontSize:12,color:C.muted,background:C.mid,borderRadius:6,padding:"7px 10px"}}>{i.description}</div>}
            <div style={{background:C.mid,borderRadius:8,padding:"10px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div><div style={{fontSize:10,color:C.muted}}>Coût</div><div style={{fontWeight:800,color:C.orange,fontSize:15}}>{fmtS(totalIntDep(i))}</div></div>
              <Badge label={i.facturee?"✅ Facturée":"❌ Non facturée"} color={i.facturee?C.green:C.red} small/>
            </div>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <select value={i.statut} onChange={e=>updateSt(i.id,e.target.value)} style={{flex:1,background:(STIC[i.statut]||C.muted)+"22",border:"1px solid "+(STIC[i.statut]||C.muted)+"55",borderRadius:6,padding:"5px 10px",color:STIC[i.statut]||C.muted,fontSize:12,cursor:"pointer",outline:"none",fontWeight:700,WebkitAppearance:"none"}}>
                {["En attente","En cours","Terminée"].map(s=><option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={()=>delInt(i.id)} style={{background:C.red+"22",border:"1px solid "+C.red+"44",color:C.red,borderRadius:6,padding:"6px 10px",fontSize:12,cursor:"pointer"}}>🗑️</button>
            </div>
          </div>
        ))}
      </div>
      {showNew&&<Modal title="🔧 Nouvelle Intervention" onClose={()=>setShowNew(false)} onSave={saveNew}>
        {saving?<Spinner/>:<FGrid cols={2}>
          <FField label="Titre *" value={form.titre} onChange={v=>setForm(p=>({...p,titre:v}))} full/>
          <FSelect label="Type" value={form.type} onChange={v=>setForm(p=>({...p,type:v}))} options={["Urgence","Préventive","Corrective","Inspection"]}/>
          <FSelect label="Statut" value={form.statut} onChange={v=>setForm(p=>({...p,statut:v}))} options={["En attente","En cours","Terminée"]}/>
          <FField label="Intervenant" value={form.intervenant} onChange={v=>setForm(p=>({...p,intervenant:v}))}/>
          <FSelect label="Chantier" value={form.chantier} onChange={v=>setForm(p=>({...p,chantier:v}))} options={["",...chantiers.map(c=>c.nom)]}/>
          <FField label="Client" value={form.client} onChange={v=>setForm(p=>({...p,client:v}))}/>
          <FField label="Date" type="date" value={form.dateCreation} onChange={v=>setForm(p=>({...p,dateCreation:v}))}/>
          <FField label="Durée (j)" type="number" value={form.duree} onChange={v=>setForm(p=>({...p,duree:v}))}/>
          <div style={{gridColumn:"1/-1"}}><label style={{fontSize:11,color:C.muted,display:"block",marginBottom:4}}>Description</label><textarea value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} rows={3} style={{width:"100%",background:C.mid,border:"1px solid "+C.border,borderRadius:8,padding:"10px 12px",color:C.white,fontSize:14,boxSizing:"border-box",outline:"none",resize:"vertical"}}/></div>
        </FGrid>}
      </Modal>}
    </div>
  );
}

function AlertesPage({chantiers,openCh}){
  const alertes=genAlertes(chantiers);
  const col={critique:C.red,warning:C.yellow,info:C.blue};
  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {alertes.length===0&&<EmptyState msg="Aucune alerte 🎉" icon="✅"/>}
      {alertes.map(({niveau,msg,chantier},i)=>(
        <div key={i} onClick={()=>openCh(chantier.id)} style={{background:C.card,border:"1px solid "+(col[niveau]||C.border)+"55",borderRadius:10,padding:"14px 16px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
          <div style={{flex:1}}><div style={{fontWeight:600,fontSize:13,color:col[niveau]}}>⚠️ {msg}</div><div style={{fontSize:11,color:C.muted,marginTop:3}}>{chantier.nom} · {chantier.client}</div></div>
          <Badge label={chantier.statut} color={stC(chantier.statut)}/>
        </div>
      ))}
    </div>
  );
}

function KpiPage({chantiers}){
  const {isMobile}=useBP();
  const totalB=chantiers.reduce((a,c)=>a+c.budgetInitial,0);
  const totalD=chantiers.reduce((a,c)=>a+totalDep(c),0);
  const marge=totalB-totalD;
  const pc=pct(totalD,totalB);
  const derives=chantiers.filter(c=>totalDep(c)>c.budgetInitial||c.statut==="En dérive");
  const clos=chantiers.filter(c=>c.statut==="Clôturé");
  const allDep=chantiers.flatMap(c=>c.depenses);
  const depCat=CATS.map(cat=>({cat,total:allDep.filter(d=>d.categorie===cat).reduce((a,d)=>a+Number(d.montant),0)})).filter(x=>x.total>0);
  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(5,1fr)",gap:10}}>
        <KpiCard icon="💰" label="Budget" value={fmtS(totalB)} compact={isMobile}/>
        <KpiCard icon="🧾" label="Dépenses" value={fmtS(totalD)} color={C.yellow} compact={isMobile}/>
        <KpiCard icon="💵" label="Marge" value={fmtS(marge)} color={marge>=0?C.green:C.red} compact={isMobile}/>
        <KpiCard icon="📉" label="Dérives" value={derives.length} color={derives.length>0?C.red:C.green} compact={isMobile}/>
        <KpiCard icon="🏁" label="Clôturés" value={clos.length} color={C.green} compact={isMobile}/>
      </div>
      <Card title="Consommation globale">
        <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:6}}><span style={{color:C.muted}}>Consommé</span><strong style={{color:pc>100?C.red:pc>80?C.yellow:C.green}}>{pc}%</strong></div>
        <PBar p={pc} color={pc>100?C.red:pc>80?C.yellow:C.green} h={18}/>
      </Card>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:16}}>
        <Card title="Dépenses par catégorie">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={depCat} layout="vertical" margin={{left:5,right:5}}>
              <XAxis type="number" tick={{fill:C.muted,fontSize:9}} tickFormatter={v=>Math.round(v/1000)+"k"}/>
              <YAxis type="category" dataKey="cat" tick={{fill:C.muted,fontSize:10}} width={80}/>
              <Tooltip contentStyle={{background:C.dark,border:"1px solid "+C.border,color:C.white}} formatter={v=>fmtS(v)}/>
              <Bar dataKey="total" radius={[0,4,4,0]}>{depCat.map(({cat},i)=><Cell key={i} fill={catC(cat)}/>)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Détail par chantier">
          {chantiers.map(c=>{const d=totalDep(c),p=pct(d,c.budgetInitial);return(
            <div key={c.id} style={{padding:"8px 0",borderBottom:"1px solid "+C.border}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}><span style={{fontWeight:600}}>{c.nom.split(" ").slice(0,2).join(" ")}</span><span style={{fontWeight:700,color:p>100?C.red:p>80?C.yellow:C.green}}>{p}%</span></div>
              <PBar p={p} color={p>100?C.red:p>80?C.yellow:C.green} h={6}/>
            </div>
          );})}
          {chantiers.length===0&&<EmptyState msg="Aucun chantier" icon="📊"/>}
        </Card>
      </div>
    </div>
  );
}

function IAPage({chantiers,openCh,interventions}){
  const {isMobile}=useBP();
  const [analysing,setAnalysing]=useState(false);
  const [iaResult,setIaResult]=useState(null);
  const [iaError,setIaError]=useState(null);
  const derives=chantiers.filter(c=>c.statut==="En dérive");
  const risques=chantiers.filter(c=>{const p=pct(totalDep(c),c.budgetInitial);return p>=80&&p<=100&&c.statut!=="En dérive";});

  const runIA=async()=>{
    setAnalysing(true);setIaError(null);setIaResult(null);
    try{
      const ctx={chantiers:chantiers.map(c=>({nom:c.nom,client:c.client,statut:c.statut,budgetInitial:c.budgetInitial,depensesTotal:totalDep(c)})),interventions:interventions.map(i=>({titre:i.titre,type:i.type,statut:i.statut}))};
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:"Expert BTP. Analyse ce portefeuille (XOF). Réponds UNIQUEMENT en JSON:\n"+JSON.stringify(ctx)+"\n\nFormat: {\"recommandations\":[{\"titre\":string,\"detail\":string,\"priorite\":\"haute\"|\"moyenne\"|\"basse\"}],\"scoreGlobal\":number,\"synthese\":string}"}]})});
      const data=await res.json();const text=(data.content||[]).map(i=>i.text||"").join("");
      setIaResult(JSON.parse(text.replace(/```json|```/g,"").trim()));
    }catch(e){setIaError("Erreur IA : "+e.message);}
    setAnalysing(false);
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{background:C.orange+"11",border:"1px solid "+C.orange+"44",borderRadius:14,padding:18}}>
        <div style={{fontSize:18,fontWeight:800,marginBottom:4}}>🤖 Intelligence Artificielle</div>
        <div style={{color:C.muted,fontSize:12,marginBottom:12}}>Analyse automatique du portefeuille</div>
        <button onClick={runIA} disabled={analysing} style={{background:C.orange,color:"#fff",border:"none",borderRadius:10,padding:"10px 20px",fontWeight:700,cursor:analysing?"wait":"pointer",fontSize:14}}>{analysing?"⏳ Analyse...":"▶ Lancer l'analyse"}</button>
        {iaError&&<div style={{color:C.red,fontSize:12,marginTop:10}}>{iaError}</div>}
      </div>
      <Card title="🚨 Dérives budgétaires">
        {derives.length===0&&risques.length===0?<div style={{color:C.green,padding:16,textAlign:"center"}}>✅ Aucune dérive</div>:<>
          {derives.map(c=><div key={c.id} onClick={()=>openCh(c.id)} style={{background:C.red+"11",border:"1px solid "+C.red+"33",borderRadius:8,padding:"12px",marginBottom:8,cursor:"pointer"}}><div style={{fontWeight:700,color:C.red}}>🔴 {c.nom}</div><div style={{fontSize:12,color:C.muted}}>{pct(totalDep(c),c.budgetInitial)}% consommé</div></div>)}
          {risques.map(c=><div key={c.id} onClick={()=>openCh(c.id)} style={{background:C.yellow+"11",border:"1px solid "+C.yellow+"33",borderRadius:8,padding:"12px",marginBottom:8,cursor:"pointer"}}><div style={{fontWeight:700,color:C.yellow}}>🟡 {c.nom}</div><div style={{fontSize:12,color:C.muted}}>{pct(totalDep(c),c.budgetInitial)}% — surveillance</div></div>)}
        </>}
      </Card>
      {!iaResult&&!analysing&&<EmptyState msg="Lancez l'analyse IA pour des recommandations" icon="🤖"/>}
      {analysing&&<Spinner/>}
      {iaResult&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{background:C.orange+"11",border:"1px solid "+C.orange+"44",borderRadius:12,padding:16}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
              <div style={{fontWeight:800,fontSize:15}}>📋 Synthèse</div>
              <div style={{background:(iaResult.scoreGlobal>70?C.green:iaResult.scoreGlobal>40?C.yellow:C.red)+"22",borderRadius:8,padding:"4px 12px",fontWeight:800,color:iaResult.scoreGlobal>70?C.green:iaResult.scoreGlobal>40?C.yellow:C.red}}>Score : {iaResult.scoreGlobal}/100</div>
            </div>
            <div style={{fontSize:13,color:C.muted}}>{iaResult.synthese}</div>
          </div>
          <Card title="🎯 Recommandations">
            {(iaResult.recommandations||[]).map((r,i)=>{const col=r.priorite==="haute"?C.red:r.priorite==="moyenne"?C.yellow:C.green;return(
              <div key={i} style={{background:col+"11",border:"1px solid "+col+"33",borderRadius:8,padding:"12px",marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}><div style={{fontWeight:700,color:col,fontSize:13}}>{r.titre}</div><Badge label={"Priorité "+r.priorite} color={col} small/></div>
                <div style={{fontSize:12,color:C.muted,marginTop:4}}>{r.detail}</div>
              </div>
            );})}
          </Card>
        </div>
      )}
    </div>
  );
}

function GestionPage({chantiers,openCh,reload}){
  const {isMobile}=useBP();
  const [confirmId,setConfirmId]=useState(null);
  const [search,setSearch]=useState("");
  const filtered=chantiers.filter(c=>c.nom.toLowerCase().includes(search.toLowerCase())||c.client.toLowerCase().includes(search.toLowerCase()));
  const delCh=async id=>{await sb.from("chantiers").eq("id",id).del();setConfirmId(null);reload();};
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
        {filtered.map(c=>{const dep=totalDep(c),p=pct(dep,c.budgetInitial),s=ssb(dep,c.budgetInitial);return(
          <div key={c.id} style={{background:C.mid,border:"1px solid "+(confirmId===c.id?C.red+"88":C.border),borderRadius:12,padding:"12px 14px",marginBottom:8}}>
            {confirmId===c.id?(
              <div><div style={{fontWeight:700,color:C.red,marginBottom:8}}>🗑️ Supprimer "{c.nom}" ?</div>
              <div style={{display:"flex",gap:10}}><button onClick={()=>setConfirmId(null)} style={{flex:1,padding:"9px",background:C.card,color:C.white,border:"1px solid "+C.border,borderRadius:8,cursor:"pointer"}}>Annuler</button><button onClick={()=>delCh(c.id)} style={{flex:1,padding:"9px",background:C.red,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700}}>Supprimer</button></div></div>
            ):(
              <div><div style={{display:"flex",justifyContent:"space-between",gap:8,marginBottom:6}}><div style={{flex:1}}><div style={{fontWeight:700,fontSize:14}}>{c.nom}</div><div style={{fontSize:11,color:C.muted}}>👤 {c.client}</div></div><div style={{display:"flex",gap:4}}><Badge label={c.statut} color={stC(c.statut)} small/><Badge label={s} color={sbC(s)} small/></div></div>
              <div style={{marginBottom:8}}><div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.muted,marginBottom:3}}><span>{fmtS(dep)}</span><span style={{fontWeight:700,color:p>100?C.red:p>80?C.yellow:C.green}}>{p}%</span></div><PBar p={p} color={p>100?C.red:p>80?C.yellow:C.green} h={6}/></div>
              <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><button onClick={()=>openCh(c.id)} style={{background:C.blue+"22",border:"1px solid "+C.blue+"44",color:C.blue,borderRadius:7,padding:"7px 14px",fontSize:12,cursor:"pointer",fontWeight:600}}>📋 Ouvrir</button><button onClick={()=>setConfirmId(c.id)} style={{background:C.red+"22",border:"1px solid "+C.red+"44",color:C.red,borderRadius:7,padding:"7px 12px",fontSize:12,cursor:"pointer",fontWeight:700}}>🗑️</button></div></div>
            )}
          </div>
        );})}
        {filtered.length===0&&<EmptyState msg="Aucun projet" icon="🔍"/>}
      </Card>
    </div>
  );
}
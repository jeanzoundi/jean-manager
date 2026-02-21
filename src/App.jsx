import React, { useState, useEffect, useRef, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const SUPA_URL = "https://mbkwpaxissvvjhewkggl.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ia3dwYXhpc3N2dmpoZXdrZ2dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MjQzOTMsImV4cCI6MjA4NzAwMDM5M30.Zo9aJVDByO8aVSADfSCc2m4jCI1qeXuWYQgVRT-a3LA";
const HDR = { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: "Bearer " + SUPA_KEY };
const REST = SUPA_URL + "/rest/v1";

function q(table) {
  var _t=table,_f=[],_o=null,_s="*";
  var api={
    select:function(s){_s=s;return api;},
    order:function(c,o){_o="order="+c+(o&&o.ascending===false?".desc":".asc");return api;},
    eq:function(c,v){_f.push(c+"=eq."+encodeURIComponent(v));return api;},
    get:function(){var u=REST+"/"+_t+"?select="+_s;if(_f.length)u+="&"+_f.join("&");if(_o)u+="&"+_o;return fetch(u,{headers:HDR}).then(function(r){return r.json().then(function(d){return r.ok?{data:d,error:null}:{data:null,error:d};});});},
    insert:function(p){return fetch(REST+"/"+_t,{method:"POST",headers:Object.assign({},HDR,{Prefer:"return=representation"}),body:JSON.stringify(p)}).then(function(r){return r.json().then(function(d){return r.ok?{data:Array.isArray(d)?d[0]:d,error:null}:{data:null,error:d};});});},
    update:function(p){var u=REST+"/"+_t+(_f.length?"?"+_f.join("&"):"");return fetch(u,{method:"PATCH",headers:Object.assign({},HDR,{Prefer:"return=representation"}),body:JSON.stringify(p)}).then(function(r){return r.json().then(function(d){return r.ok?{data:d,error:null}:{data:null,error:d};});});},
    del:function(){var u=REST+"/"+_t+(_f.length?"?"+_f.join("&"):"");return fetch(u,{method:"DELETE",headers:HDR}).then(function(r){return r.ok?{error:null}:r.json().then(function(d){return{error:d};});});}
  };
  return api;
}

const DT={primary:"#F97316",secondary:"#3B82F6",success:"#22C55E",danger:"#EF4444",warning:"#EAB308",bg:"#1C1917",card:"#292524",mid:"#44403C",border:"#57534E",white:"#FAFAF9",muted:"#A8A29E",sidebarWidth:220,borderRadius:12,fontFamily:"'Segoe UI',system-ui,sans-serif",companyName:"JEAN BTP SARL",companyAddress:"Zone Industrielle, Abidjan",companyTel:"+225 27 00 00 00",companyEmail:"devis@jeanbtp.ci",companySiret:"CI-ABJ-2024-B-12345"};

function useTheme(){
  var stored=DT;try{var s=localStorage.getItem("jm_t");if(s)stored=Object.assign({},DT,JSON.parse(s));}catch(e){}
  var _ref=useState(stored),T=_ref[0],setT=_ref[1];
  function upT(k,v){setT(function(p){var n=Object.assign({},p);n[k]=v;try{localStorage.setItem("jm_t",JSON.stringify(n));}catch(e){}return n;});}
  function resetT(){setT(DT);try{localStorage.removeItem("jm_t");}catch(e){}}
  return{T:T,upT:upT,resetT:resetT};
}
function useBP(){
  var _ref=useState(function(){var w=window.innerWidth;return w<480?"xs":w<768?"sm":w<1024?"md":"lg";}),bp=_ref[0],setBp=_ref[1];
  useEffect(function(){function fn(){var w=window.innerWidth;setBp(w<480?"xs":w<768?"sm":w<1024?"md":"lg");}window.addEventListener("resize",fn);return function(){window.removeEventListener("resize",fn);};},[]);
  return{bp:bp,isMobile:bp==="xs"||bp==="sm"};
}

var CATS=["Main d'oeuvre","Materiaux","Equipement","Transport","Sous-traitance","Divers"];
var UNITES=["U","m2","ml","m3","kg","t","forfait","h","j","ens."];
var STATUTS_CH=["Brouillon","Planifie","En cours","En derive","En reception","Cloture"];
var TYPES_INT=["Urgence","Preventive","Corrective","Inspection"];

function fmt(n){return new Intl.NumberFormat("fr-FR",{maximumFractionDigits:0}).format(n||0)+" XOF";}
function fmtS(n){var a=Math.abs(n||0);if(a>=1e6)return((n||0)/1e6).toFixed(1)+"M";if(a>=1e3)return Math.round((n||0)/1e3)+"k";return String(Math.round(n||0));}
function pct(v,t){return t>0?Math.round(v/t*100):0;}
function today(){return new Date().toISOString().slice(0,10);}
function uid(){return Date.now()+"-"+Math.random().toString(36).slice(2);}
function stC(s,T){var m={"En cours":T.secondary,"En derive":T.danger,"Cloture":T.success,"Planifie":T.warning,"En reception":T.primary,"Brouillon":T.muted};return m[s]||T.muted;}
function catC(c,T){var m={"Main d'oeuvre":T.secondary,"Materiaux":T.primary,"Equipement":T.warning,"Transport":T.success,"Sous-traitance":"#A855F7","Divers":T.muted};return m[c]||T.muted;}
function totalDep(c){return(c.depenses||[]).reduce(function(a,d){return a+Number(d.montant||0);},0);}
function parseNum(v){return parseFloat(String(v||"0").replace(/\s/g,"").replace(",",".").replace(/[^\d.-]/g,""))||0;}

function calcTache(t,tc,cfg){
  var q2=parseFloat(t.quantite)||0;
  var mo=((parseFloat(t.salaire)||0)/(parseFloat(t.rendement)||1))*(1+tc/100);
  var ds=mo+(parseFloat(t.materiau)||0)+(parseFloat(t.materiel)||0)+(parseFloat(t.sous_traitance)||0);
  var fg=ds*(cfg.fg/100);var pr=ds+fg;var bn=pr*(cfg.benef/100);var pv=pr+bn;
  return{mo:mo,ds:ds,fg:fg,pr:pr,bn:bn,pv:pv,pvt:pv*q2};
}

function exportCSV(rows,filename){
  var header=Object.keys(rows[0]).join(";");
  var body=rows.map(function(r){return Object.values(r).map(function(v){return'"'+String(v).replace(/"/g,'""')+'"';}).join(";");}).join("\n");
  var blob=new Blob(["\uFEFF"+header+"\n"+body],{type:"text/csv;charset=utf-8;"});
  var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename;a.click();
}
function exportDebourseHTML(sess,taches,cfg,chNom,T){
  var rows="";
  taches.forEach(function(t,i){
    var c=calcTache(t,cfg.tc,cfg);
    var bg=i%2===0?"#fff":"#f9f9f9";
    rows+="<tr style=\"background:"+bg+"\"><td>"+(i+1)+"</td><td>"+t.libelle+"</td><td style=\"text-align:center\">"+t.quantite+"</td><td style=\"text-align:center\">"+t.unite+"</td><td style=\"text-align:right\">"+fmt(Math.round(c.ds))+"</td><td style=\"text-align:right\">"+fmt(Math.round(c.pr))+"</td><td style=\"text-align:right;font-weight:700;color:"+T.primary+"\">"+fmt(Math.round(c.pvt))+"</td></tr>";
  });
  var tot=taches.reduce(function(acc,t){var c=calcTache(t,cfg.tc,cfg);return{ds:acc.ds+c.ds*(t.quantite||0),pr:acc.pr+c.pr*(t.quantite||0),pvt:acc.pvt+c.pvt};},{ds:0,pr:0,pvt:0});
  var style="body{font-family:sans-serif;margin:2cm;font-size:10pt;color:#222}h1{color:"+T.primary+"}h2{color:#555;font-size:12pt;margin-top:20px}table{width:100%;border-collapse:collapse;margin-bottom:20px}th{background:"+T.primary+";color:#fff;padding:8px;text-align:left}td{padding:7px 10px;border-bottom:1px solid #eee}.tot{background:"+T.primary+";color:#fff;font-weight:800}.info{background:#f5f5f5;padding:12px;border-radius:6px;margin-bottom:16px}";
  var html="<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Debours - "+sess.nom+"</title><style>"+style+"</style></head><body>"
    +"<h1>Debours Sec - "+sess.nom+"</h1>"
    +"<div class=\"info\">Chantier: <b>"+(chNom||"--")+"</b> | Charges: <b>"+cfg.tc+"%</b> | FG: <b>"+cfg.fg+"%</b> | Benefice: <b>"+cfg.benef+"%</b></div>"
    +"<table><thead><tr><th>#</th><th>Designation</th><th>Qte</th><th>Unite</th><th>Debours sec</th><th>Prix revient</th><th>PV total</th></tr></thead>"
    +"<tbody>"+rows+"<tr class=\"tot\"><td colspan=\"4\">TOTAL</td><td>"+fmt(Math.round(tot.ds))+"</td><td>"+fmt(Math.round(tot.pr))+"</td><td>"+fmt(Math.round(tot.pvt))+"</td></tr></tbody></table>"
    +"</body></html>";
  var w=window.open("","_blank");w.document.write(html);w.document.close();setTimeout(function(){w.focus();w.print();},500);
}
function exportChantierHTML(chantier,T){
  var dep=chantier.depenses||[];var totalB=chantier.budgetInitial,totalD=totalDep(chantier),pc=pct(totalD,totalB);
  var allRows="";dep.forEach(function(d,i){var bg=i%2===0?"#fff":"#f9f9f9";allRows+="<tr style=\"background:"+bg+"\"><td>"+(d.date||"")+"</td><td>"+d.libelle+"</td><td>"+d.categorie+"</td><td style=\"text-align:right\">"+fmt(d.montant)+"</td><td>"+(d.note||"")+"</td></tr>";});
  var style="body{font-family:sans-serif;margin:2cm;font-size:10pt}h1{color:"+T.primary+"}table{width:100%;border-collapse:collapse;margin-bottom:20px}th{background:"+T.primary+";color:#fff;padding:8px;text-align:left}td{padding:7px 10px;border-bottom:1px solid #eee}.tot{background:"+T.primary+";color:#fff;font-weight:800}";
  var html="<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Chantier - "+chantier.nom+"</title><style>"+style+"</style></head><body><h1>"+chantier.nom+"</h1><table><thead><tr><th>Date</th><th>Libelle</th><th>Categorie</th><th>Montant</th><th>Note</th></tr></thead><tbody>"+allRows+"<tr class=\"tot\"><td colspan=\"3\">TOTAL</td><td>"+fmt(totalD)+"</td><td></td></tr></tbody></table></body></html>";
  var w=window.open("","_blank");w.document.write(html);w.document.close();setTimeout(function(){w.focus();w.print();},500);
}
function exportChantierCSV(chantier){
  var rows=(chantier.depenses||[]).map(function(d){var r={};r["Date"]=d.date;r["Libelle"]=d.libelle;r["Categorie"]=d.categorie;r["Montant"]=d.montant;r["Note"]=d.note||"";return r;});
  if(!rows.length){alert("Aucune depense.");return;}exportCSV(rows,chantier.nom.replace(/\s/g,"_")+"_depenses.csv");
}

// ── UI Atoms ──────────────────────────────────────────────────────────────────
function Badge(p){return <span style={{background:p.color+"22",color:p.color,border:"1px solid "+p.color+"55",borderRadius:6,padding:p.small?"2px 7px":"3px 10px",fontSize:p.small?10:11,fontWeight:600,whiteSpace:"nowrap"}}>{p.label}</span>;}
function PBar(p){return <div style={{background:"#57534E",borderRadius:99,height:p.h||8,overflow:"hidden"}}><div style={{width:Math.min(p.p,100)+"%",background:p.color,height:"100%",borderRadius:99,transition:"width .4s"}}/></div>;}
function Empty(p){return <div style={{textAlign:"center",padding:"40px 20px",color:"#A8A29E"}}><div style={{fontSize:40,marginBottom:12}}>{p.icon}</div><div style={{fontSize:14}}>{p.msg}</div></div>;}
function Spin(){return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:180,flexDirection:"column",gap:12}}><div style={{width:36,height:36,border:"4px solid #57534E",borderTopColor:"#F97316",borderRadius:"50%",animation:"spin 1s linear infinite"}}/><style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style></div>;}
function Kpi(p){return <div style={{background:p.T.card,border:"1px solid "+p.T.border,borderRadius:p.compact?10:p.T.borderRadius,padding:p.compact?"12px 14px":"16px 20px",flex:1,minWidth:0}}><div style={{fontSize:p.compact?18:22,marginBottom:3}}>{p.icon}</div><div style={{fontSize:p.compact?15:20,fontWeight:700,color:p.color||p.T.white,lineHeight:1.2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.value}</div><div style={{fontSize:p.compact?10:12,color:p.T.muted,marginTop:2}}>{p.label}</div></div>;}
function Card(p){return <div style={{background:p.T.card,border:"1px solid "+p.T.border,borderRadius:p.T.borderRadius,padding:"18px 20px"}}>{p.title&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}><div style={{fontWeight:700,fontSize:14}}>{p.title}</div>{p.action}</div>}{p.children}</div>;}
function Modal(p){return <div style={{position:"fixed",inset:0,background:"#00000099",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}}><div style={{background:p.T.card,border:"1px solid "+p.T.border,borderRadius:"20px 20px 0 0",padding:"24px 20px",width:"100%",maxWidth:860,maxHeight:"96vh",overflow:"auto"}}><div style={{width:40,height:4,background:p.T.border,borderRadius:99,margin:"0 auto 20px"}}/><div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}><div style={{fontWeight:800,fontSize:16}}>{p.title}</div><button onClick={p.onClose} style={{background:"none",border:"none",color:p.T.muted,cursor:"pointer",fontSize:22}}>x</button></div>{p.children}{p.onSave&&<div style={{display:"flex",gap:10,marginTop:20,justifyContent:"flex-end"}}><button onClick={p.onClose} style={{padding:"10px 20px",background:p.T.mid,color:p.T.white,border:"none",borderRadius:10,cursor:"pointer"}}>Annuler</button><button onClick={p.onSave} style={{padding:"10px 20px",background:p.T.primary,color:"#fff",border:"none",borderRadius:10,fontWeight:700,cursor:"pointer"}}>{p.saveLabel||"Enregistrer"}</button></div>}</div></div>;}
function FF(p){var s={width:"100%",background:p.T.mid,border:"1px solid "+p.T.border,borderRadius:8,padding:"10px 12px",color:p.T.white,fontSize:14,boxSizing:"border-box",outline:"none"};return <div style={p.full?{gridColumn:"1/-1"}:{}}><label style={{fontSize:11,color:p.T.muted,display:"block",marginBottom:4}}>{p.label}</label>{p.rows?<textarea value={p.value||""} onChange={function(e){p.onChange(e.target.value);}} rows={p.rows} placeholder={p.placeholder} style={s}/>:<input type={p.type||"text"} value={p.value||""} onChange={function(e){p.onChange(e.target.value);}} placeholder={p.placeholder} style={s}/>}</div>;}
function FS(p){return <div style={p.full?{gridColumn:"1/-1"}:{}}><label style={{fontSize:11,color:p.T.muted,display:"block",marginBottom:4}}>{p.label}</label><select value={p.value||""} onChange={function(e){p.onChange(e.target.value);}} style={{width:"100%",background:p.T.mid,border:"1px solid "+p.T.border,borderRadius:8,padding:"10px 12px",color:p.T.white,fontSize:14,boxSizing:"border-box",outline:"none"}}>{p.options.map(function(o){return Array.isArray(o)?<option key={o[0]} value={o[0]}>{o[1]}</option>:<option key={o} value={o}>{o}</option>;})}</select></div>;}
function FG(p){return <div style={{display:"grid",gridTemplateColumns:"repeat("+(p.cols||2)+",1fr)",gap:12}}>{p.children}</div>;}

function useChantiers(){
  var _r=useState([]),data=_r[0],setData=_r[1];
  var _l=useState(true),loading=_l[0],setLoading=_l[1];
  var _e=useState(null),error=_e[0],setError=_e[1];
  var load=useCallback(function(){
    setLoading(true);setError(null);
    Promise.all([q("chantiers").order("created_at",{ascending:false}).get(),q("depenses").order("date",{ascending:false}).get()])
      .then(function(res){
        if(res[0].error)throw new Error(JSON.stringify(res[0].error));
        var ch=res[0].data||[],dep=res[1].data||[];
        setData(ch.map(function(c){return Object.assign({},c,{budgetInitial:Number(c.budget_initial||0),depenses:dep.filter(function(d){return d.chantier_id===c.id;}).map(function(d){return Object.assign({},d,{montant:Number(d.montant||0)});})});}));
        setLoading(false);
      }).catch(function(e){setError(e.message);setLoading(false);});
  },[]);
  useEffect(function(){load();},[]);
  return{data:data,loading:loading,error:error,reload:load};
}
function useInterventions(){
  var _r=useState([]),data=_r[0],setData=_r[1];
  var _l=useState(true),loading=_l[0],setLoading=_l[1];
  var load=useCallback(function(){
    setLoading(true);
    Promise.all([q("interventions").order("created_at",{ascending:false}).get(),q("intervention_depenses").get()])
      .then(function(res){
        var intv=res[0].data||[],idep=res[1].data||[];
        setData(intv.map(function(i){return Object.assign({},i,{depenses:idep.filter(function(d){return d.intervention_id===i.id;}).map(function(d){return Object.assign({},d,{montant:Number(d.montant||0)});})});}));
        setLoading(false);
      }).catch(function(){setLoading(false);});
  },[]);
  useEffect(function(){load();},[]);
  return{data:data,loading:loading,reload:load};
}
function useDebourse(){
  var _s=useState([]),sessions=_s[0],setSessions=_s[1];
  var _t=useState([]),taches=_t[0],setTaches=_t[1];
  var _l=useState(true),loading=_l[0],setLoading=_l[1];
  var load=useCallback(function(){
    setLoading(true);
    Promise.all([q("debourse_sessions").order("created_at",{ascending:false}).get(),q("debourse_taches").order("ordre").get()])
      .then(function(res){setSessions(res[0].data||[]);setTaches(res[1].data||[]);setLoading(false);})
      .catch(function(){setLoading(false);});
  },[]);
  useEffect(function(){load();},[]);
  return{sessions:sessions,taches:taches,loading:loading,reload:load};
}

// ── APP ROOT ──────────────────────────────────────────────────────────────────
export default function App(){
  var th=useTheme(),T=th.T,upT=th.upT,resetT=th.resetT;
  var ch=useChantiers(),intv=useInterventions(),db=useDebourse();
  var bp=useBP(),isMobile=bp.isMobile;
  var _p=useState("dashboard"),page=_p[0],setPage=_p[1];
  var _s=useState(null),selId=_s[0],setSelId=_s[1];
  var _d=useState(false),drawerOpen=_d[0],setDrawerOpen=_d[1];
  function navTo(p){setPage(p);setDrawerOpen(false);}
  function openCh(id){setSelId(id);setPage("fiche");setDrawerOpen(false);}
  function reloadAll(){ch.reload();intv.reload();db.reload();}
  var nbInt=intv.data.filter(function(i){return i.statut==="En cours";}).length;
  var nav=[{key:"dashboard",icon:"📊",label:"Dashboard"},{key:"chantiers",icon:"🏗️",label:"Chantiers"},{key:"debourse",icon:"🔢",label:"Debours Sec"},{key:"interventions",icon:"🔧",label:"Interventions",badge:nbInt},{key:"kpi",icon:"📈",label:"KPIs"},{key:"ia",icon:"🤖",label:"IA"},{key:"gestion",icon:"⚙️",label:"Gestion"},{key:"parametres",icon:"🎨",label:"Apparence"}];
  var selected=ch.data.find(function(c){return c.id===selId;});
  function NavBtn(p){var n=p.n,active=page===n.key||(page==="fiche"&&n.key==="chantiers");return <button onClick={function(){navTo(n.key);}} style={{width:"100%",display:"flex",alignItems:"center",gap:bp.bp==="md"?0:10,padding:"10px",borderRadius:8,border:"none",background:active?T.primary+"22":"transparent",color:active?T.primary:T.muted,cursor:"pointer",marginBottom:2,justifyContent:bp.bp==="md"?"center":"flex-start",position:"relative",fontFamily:T.fontFamily}}><span style={{fontSize:18,flexShrink:0}}>{n.icon}</span>{bp.bp!=="md"&&<span style={{fontSize:13,fontWeight:active?700:400,flex:1}}>{n.label}</span>}{n.badge>0&&<span style={{position:"absolute",top:4,right:4,background:T.danger,color:"#fff",borderRadius:99,fontSize:9,padding:"1px 5px",fontWeight:700}}>{n.badge}</span>}</button>;}
  return(
    <div style={{display:"flex",height:"100vh",background:T.bg,color:T.white,fontFamily:T.fontFamily,overflow:"hidden"}}>
      <style>{"*{box-sizing:border-box;}input,select,textarea{font-size:16px!important;}"}</style>
      {!isMobile&&<div style={{width:bp.bp==="md"?60:T.sidebarWidth,background:T.card,borderRight:"1px solid "+T.border,display:"flex",flexDirection:"column",flexShrink:0}}><div style={{padding:"18px 12px 16px",borderBottom:"1px solid "+T.border,display:"flex",alignItems:"center",gap:10}}><div style={{background:T.primary,borderRadius:10,width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>🏗</div>{bp.bp!=="md"&&<div style={{fontWeight:700,fontSize:13,lineHeight:1.3}}>{T.companyName}</div>}</div><nav style={{flex:1,padding:"10px 8px",overflowY:"auto"}}>{nav.map(function(n){return <NavBtn key={n.key} n={n}/>;})}</nav>{bp.bp!=="md"&&<div style={{padding:8,borderTop:"1px solid "+T.border}}><button onClick={reloadAll} style={{width:"100%",background:T.secondary+"22",border:"1px solid "+T.secondary+"44",color:T.secondary,borderRadius:8,padding:8,fontSize:11,fontWeight:700,cursor:"pointer"}}>Sync</button></div>}</div>}
      <div style={{flex:1,overflow:"auto",display:"flex",flexDirection:"column",paddingBottom:isMobile?68:0}}>
        <div style={{background:T.card,borderBottom:"1px solid "+T.border,padding:isMobile?"12px 16px":"12px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,position:"sticky",top:0,zIndex:50}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>{isMobile&&<button onClick={function(){setDrawerOpen(true);}} style={{background:"none",border:"none",color:T.muted,fontSize:22,cursor:"pointer"}}>☰</button>}<div style={{fontSize:isMobile?14:16,fontWeight:700}}>{page==="fiche"&&selected?"🏗️ "+selected.nom:(nav.find(function(n){return n.key===page;})||{icon:"",label:""}).label}</div></div>
          <button onClick={reloadAll} style={{background:T.secondary+"22",border:"1px solid "+T.secondary+"44",color:T.secondary,borderRadius:8,padding:"6px 12px",fontSize:12,cursor:"pointer",fontWeight:600}}>↺</button>
        </div>
        <div style={{flex:1,overflow:"auto",padding:isMobile?"12px":"24px"}}>
          {ch.error?<div style={{background:T.danger+"11",border:"1px solid "+T.danger+"44",borderRadius:12,padding:24,textAlign:"center"}}><div style={{color:T.danger,fontWeight:700,marginBottom:8}}>Erreur Supabase</div><div style={{color:T.muted,fontSize:13,marginBottom:16}}>{ch.error}</div><button onClick={reloadAll} style={{background:T.primary,color:"#fff",border:"none",borderRadius:8,padding:"10px 24px",fontWeight:700,cursor:"pointer"}}>Reessayer</button></div>:(
            <>
              {page==="dashboard"&&<Dashboard ch={ch.data} intv={intv.data} openCh={openCh} T={T}/>}
              {page==="chantiers"&&<Chantiers ch={ch.data} openCh={openCh} reload={ch.reload} T={T}/>}
              {page==="fiche"&&selected&&<Fiche chantier={selected} setPage={setPage} reload={ch.reload} T={T}/>}
              {page==="debourse"&&<Debourse sessions={db.sessions} taches={db.taches} ch={ch.data} reload={db.reload} T={T}/>}
              {page==="interventions"&&<Interventions intv={intv.data} ch={ch.data} reload={intv.reload} T={T}/>}
              {page==="kpi"&&<KpiPage ch={ch.data} intv={intv.data} T={T}/>}
              {page==="ia"&&<IA ch={ch.data} intv={intv.data} T={T}/>}
              {page==="gestion"&&<Gestion ch={ch.data} openCh={openCh} reload={ch.reload} T={T}/>}
              {page==="parametres"&&<Parametres T={T} upT={upT} resetT={resetT}/>}
            </>
          )}
        </div>
      </div>
      {isMobile&&<div style={{position:"fixed",bottom:0,left:0,right:0,background:T.card,borderTop:"1px solid "+T.border,display:"flex",justifyContent:"space-around",padding:"6px 0",zIndex:100}}>{nav.slice(0,5).map(function(n){var active=page===n.key;return <button key={n.key} onClick={function(){navTo(n.key);}} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,background:"none",border:"none",color:active?T.primary:T.muted,cursor:"pointer",padding:"4px 6px",position:"relative",minWidth:44}}><span style={{fontSize:20}}>{n.icon}</span><span style={{fontSize:9,fontWeight:active?700:400}}>{n.label}</span>{n.badge>0&&<span style={{position:"absolute",top:0,right:2,background:T.danger,color:"#fff",borderRadius:99,fontSize:9,padding:"1px 5px",fontWeight:700}}>{n.badge}</span>}</button>;})} <button onClick={function(){setDrawerOpen(true);}} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,background:"none",border:"none",color:T.muted,cursor:"pointer",padding:"4px 6px",minWidth:44}}><span style={{fontSize:20}}>☰</span><span style={{fontSize:9}}>Plus</span></button></div>}
      {isMobile&&drawerOpen&&<><div onClick={function(){setDrawerOpen(false);}} style={{position:"fixed",inset:0,background:"#0007",zIndex:150}}/><div style={{position:"fixed",left:0,top:0,bottom:0,width:280,background:T.card,borderRight:"1px solid "+T.border,zIndex:151,padding:"50px 12px 12px",overflowY:"auto"}}><button onClick={function(){setDrawerOpen(false);}} style={{position:"absolute",top:16,right:16,background:"none",border:"none",color:T.muted,fontSize:22,cursor:"pointer"}}>x</button><div style={{padding:"0 8px 16px",marginBottom:8,borderBottom:"1px solid "+T.border}}><div style={{fontWeight:700,fontSize:16}}>{T.companyName}</div></div>{nav.map(function(n){return <NavBtn key={n.key} n={n}/>;})}</div></>}
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function Dashboard(p){
  var ch=p.ch,intv=p.intv,openCh=p.openCh,T=p.T;
  var isMobile=useBP().isMobile;
  var totalB=ch.reduce(function(a,c){return a+c.budgetInitial;},0);
  var totalD=ch.reduce(function(a,c){return a+totalDep(c);},0);
  var pc=pct(totalD,totalB);
  var pieData=[{name:"En cours",value:ch.filter(function(c){return c.statut==="En cours";}).length,color:T.secondary},{name:"En derive",value:ch.filter(function(c){return c.statut==="En derive";}).length,color:T.danger},{name:"Planifie",value:ch.filter(function(c){return c.statut==="Planifie";}).length,color:T.warning},{name:"Cloture",value:ch.filter(function(c){return c.statut==="Cloture";}).length,color:T.success}].filter(function(d){return d.value>0;});
  var actifs=ch.filter(function(c){return c.statut!=="Cloture"&&c.statut!=="Brouillon";});
  return <div style={{display:"flex",flexDirection:"column",gap:16}}>
    <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:10}}>
      <Kpi icon="🏗️" label="Chantiers" value={ch.length} color={T.primary} compact={isMobile} T={T}/>
      <Kpi icon="💰" label="Budget total" value={fmtS(totalB)} compact={isMobile} T={T}/>
      <Kpi icon="📊" label="Consomme" value={pc+"%"} color={pc>80?T.danger:T.success} compact={isMobile} T={T}/>
      <Kpi icon="🔧" label="Interventions" value={intv.filter(function(i){return i.statut==="En cours";}).length} color={T.secondary} compact={isMobile} T={T}/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:16}}>
      <Card title="Statuts chantiers" T={T}>{pieData.length>0?<ResponsiveContainer width="100%" height={180}><PieChart><Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={65} label={function(e){return e.name+" ("+e.value+")";}  }>{pieData.map(function(d,i){return <Cell key={i} fill={d.color}/>;})}</Pie><Tooltip contentStyle={{background:T.card,border:"1px solid "+T.border,color:T.white}}/></PieChart></ResponsiveContainer>:<Empty msg="Aucun chantier" icon="🏗️"/>}</Card>
      <Card title="Chantiers actifs" T={T}>{actifs.slice(0,6).map(function(c){var d=totalDep(c),p2=pct(d,c.budgetInitial);return <div key={c.id} onClick={function(){openCh(c.id);}} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:"1px solid "+T.border,cursor:"pointer"}}><div style={{flex:2}}><div style={{fontWeight:600,fontSize:13}}>{c.nom}</div><div style={{fontSize:11,color:T.muted}}>{c.client}</div></div><div style={{flex:1}}><PBar p={p2} color={p2>100?T.danger:p2>80?T.warning:T.success} h={6}/><div style={{fontSize:10,color:T.muted,textAlign:"right",marginTop:2}}>{p2}%</div></div></div>;})} {actifs.length===0&&<Empty msg="Aucun chantier actif" icon="🏗️"/>}</Card>
    </div>
  </div>;
}

// ── CHANTIERS ─────────────────────────────────────────────────────────────────
function Chantiers(p){
  var ch=p.ch,openCh=p.openCh,reload=p.reload,T=p.T;
  var isMobile=useBP().isMobile;
  var _f=useState("Tous"),filter=_f[0],setFilter=_f[1];
  var _n=useState(false),showNew=_n[0],setShowNew=_n[1];
  var _sv=useState(false),saving=_sv[0],setSaving=_sv[1];
  var _fm=useState({nom:"",client:"",localisation:"",type:"Construction",budget_initial:"",date_debut:"",date_fin:""}),form=_fm[0],setForm=_fm[1];
  function up(k,v){setForm(function(p2){var n=Object.assign({},p2);n[k]=v;return n;});}
  function save(){if(!form.nom||!form.budget_initial)return;setSaving(true);q("chantiers").insert({nom:form.nom,client:form.client,localisation:form.localisation,type:form.type,budget_initial:parseFloat(form.budget_initial),date_debut:form.date_debut||null,date_fin:form.date_fin||null,statut:"Brouillon",alertes:[],score:100,lat:5.35,lng:-4.0}).then(function(){setSaving(false);setShowNew(false);setForm({nom:"",client:"",localisation:"",type:"Construction",budget_initial:"",date_debut:"",date_fin:""});reload();});}
  function del(id){if(!window.confirm("Supprimer ?"))return;q("chantiers").eq("id",id).del().then(function(){reload();});}
  var filtered=filter==="Tous"?ch:ch.filter(function(c){return c.statut===filter;});
  return <div style={{display:"flex",flexDirection:"column",gap:16}}>
    <div style={{display:"flex",gap:6,justifyContent:"space-between",flexWrap:"wrap",alignItems:"center"}}>
      <div style={{display:"flex",gap:4,overflowX:"auto"}}>{["Tous"].concat(STATUTS_CH).map(function(s){return <button key={s} onClick={function(){setFilter(s);}} style={{padding:"6px 12px",borderRadius:20,border:"1px solid "+(filter===s?T.primary:T.border),background:filter===s?T.primary:"transparent",color:filter===s?"#fff":T.muted,cursor:"pointer",fontSize:12,fontWeight:filter===s?700:400,whiteSpace:"nowrap",flexShrink:0}}>{s}</button>;})}</div>
      <button onClick={function(){setShowNew(true);}} style={{background:T.primary,color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontWeight:700,cursor:"pointer",fontSize:13}}>+ Nouveau</button>
    </div>
    <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(320px,1fr))",gap:14}}>
      {filtered.map(function(c){var d=totalDep(c),pp=pct(d,c.budgetInitial);return <div key={c.id} onClick={function(){openCh(c.id);}} style={{background:T.card,border:"1px solid "+(pp>100?T.danger+"66":T.border),borderRadius:T.borderRadius,padding:16,cursor:"pointer",position:"relative"}}><button onClick={function(e){e.stopPropagation();del(c.id);}} style={{position:"absolute",top:12,right:12,background:T.danger+"22",border:"1px solid "+T.danger+"44",color:T.danger,borderRadius:6,padding:"3px 10px",fontSize:11,cursor:"pointer"}}>X</button><div style={{marginBottom:10,paddingRight:60}}><div style={{fontWeight:700,fontSize:15}}>{c.nom}</div><div style={{fontSize:12,color:T.muted}}>{c.client} - {c.localisation}</div></div><div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}><Badge label={c.statut} color={stC(c.statut,T)}/><Badge label={c.type} color={T.primary} small/></div><div style={{marginBottom:4}}><div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}><span style={{color:T.muted}}>Budget consomme</span><span style={{fontWeight:700,color:pp>100?T.danger:pp>80?T.warning:T.success}}>{pp}%</span></div><PBar p={pp} color={pp>100?T.danger:pp>80?T.warning:T.success}/></div><div style={{marginTop:8,paddingTop:8,borderTop:"1px solid "+T.border,fontSize:12,color:T.muted}}>{fmtS(d)} / {fmtS(c.budgetInitial)} XOF</div></div>;})}
    </div>
    {filtered.length===0&&<Empty msg="Aucun chantier" icon="🏗️"/>}
    {showNew&&<Modal title="Nouveau chantier" onClose={function(){setShowNew(false);}} onSave={save} T={T}>{saving?<Spin/>:<FG cols={2}><FF label="Nom *" value={form.nom} onChange={function(v){up("nom",v);}} full T={T}/><FF label="Client" value={form.client} onChange={function(v){up("client",v);}} T={T}/><FS label="Type" value={form.type} onChange={function(v){up("type",v);}} options={["Construction","Rehabilitation","Maintenance","VRD","Genie Civil"]} T={T}/><FF label="Localisation" value={form.localisation} onChange={function(v){up("localisation",v);}} T={T}/><FF label="Budget (XOF) *" type="number" value={form.budget_initial} onChange={function(v){up("budget_initial",v);}} full T={T}/><FF label="Date debut" type="date" value={form.date_debut} onChange={function(v){up("date_debut",v);}} T={T}/><FF label="Date fin prevue" type="date" value={form.date_fin} onChange={function(v){up("date_fin",v);}} T={T}/></FG>}</Modal>}
  </div>;
}

// ── FICHE CHANTIER ────────────────────────────────────────────────────────────
function Fiche(p){
  var c=p.chantier,setPage=p.setPage,reload=p.reload,T=p.T;
  var isMobile=useBP().isMobile;
  var _t=useState("infos"),tab=_t[0],setTab=_t[1];
  var _sd=useState(false),showDep=_sd[0],setShowDep=_sd[1];
  var _fd=useState({libelle:"",categorie:"Main d'oeuvre",montant:"",date:today(),note:""}),fDep=_fd[0],setFDep=_fd[1];
  var _fc=useState("Toutes"),fCat=_fc[0],setFCat=_fc[1];
  var _sv=useState(false),saving=_sv[0],setSaving=_sv[1];
  var dep=totalDep(c),dp=pct(dep,c.budgetInitial);
  var filtered=fCat==="Toutes"?c.depenses:c.depenses.filter(function(d){return d.categorie===fCat;});
  function changeSt(st){q("chantiers").eq("id",c.id).update({statut:st}).then(function(){reload();});}
  function addDep(){if(!fDep.libelle||!fDep.montant)return;setSaving(true);q("depenses").insert({chantier_id:c.id,libelle:fDep.libelle,categorie:fDep.categorie,montant:parseFloat(fDep.montant),date:fDep.date,note:fDep.note}).then(function(){setSaving(false);setShowDep(false);setFDep({libelle:"",categorie:"Main d'oeuvre",montant:"",date:today(),note:""});reload();});}
  function delDep(id){q("depenses").eq("id",id).del().then(function(){reload();});}
  var depCatData=CATS.map(function(cat){return{cat:cat.split(" ")[0],total:c.depenses.filter(function(d){return d.categorie===cat;}).reduce(function(a,d){return a+d.montant;},0)};}).filter(function(x){return x.total>0;});
  return <div style={{display:"flex",flexDirection:"column",gap:0}}>
    <button onClick={function(){setPage("chantiers");}} style={{background:"none",border:"none",color:T.primary,cursor:"pointer",fontSize:13,marginBottom:12,textAlign:"left",padding:0}}>← Retour</button>
    <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:T.borderRadius,padding:isMobile?16:20,marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:10,marginBottom:12}}><div style={{flex:1}}><div style={{fontSize:isMobile?18:22,fontWeight:800}}>{c.nom}</div><div style={{color:T.muted,fontSize:12,marginTop:4}}>{c.client} - {c.localisation}</div></div><div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{STATUTS_CH.map(function(st){return <button key={st} onClick={function(){changeSt(st);}} style={{padding:"5px 10px",borderRadius:20,border:"1px solid "+(c.statut===st?stC(st,T):T.border),background:c.statut===st?stC(st,T)+"22":"transparent",color:c.statut===st?stC(st,T):T.muted,cursor:"pointer",fontSize:10,fontWeight:c.statut===st?700:400}}>{st}</button>;})}</div></div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}><Badge label={c.statut} color={stC(c.statut,T)}/><Badge label={c.type} color={T.primary} small/><div style={{marginLeft:"auto",display:"flex",gap:6}}><button onClick={function(){exportChantierCSV(c);}} style={{background:T.success+"22",color:T.success,border:"1px solid "+T.success+"44",borderRadius:8,padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>CSV</button><button onClick={function(){exportChantierHTML(c,T);}} style={{background:T.primary+"22",color:T.primary,border:"1px solid "+T.primary+"44",borderRadius:8,padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>PDF</button></div></div>
    </div>
    <div style={{display:"flex",gap:4,marginBottom:16,overflowX:"auto"}}>{[["infos","Infos"],["budget","Budget"],["depenses","Depenses ("+c.depenses.length+")"],["graphiques","Graphiques"]].map(function(o){return <button key={o[0]} onClick={function(){setTab(o[0]);}} style={{padding:"8px 14px",borderRadius:8,border:"1px solid "+(tab===o[0]?T.primary:T.border),background:tab===o[0]?T.primary:T.card,color:tab===o[0]?"#fff":T.muted,cursor:"pointer",fontSize:12,fontWeight:tab===o[0]?700:400,whiteSpace:"nowrap",flexShrink:0}}>{o[1]}</button>;})}  </div>
    {tab==="infos"&&<div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14}}><Card title="Informations" T={T}>{[["Nom",c.nom],["Client",c.client],["Localisation",c.localisation],["Type",c.type],["Statut",c.statut],["Debut",c.date_debut||"-"],["Fin prevue",c.date_fin||"-"]].map(function(row){return <div key={row[0]} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid "+T.border,fontSize:13,gap:8}}><span style={{color:T.muted}}>{row[0]}</span><span style={{fontWeight:600}}>{row[1]}</span></div>;})}</Card><Card title="Synthese" T={T}><div style={{marginBottom:14}}><div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:6}}><span style={{color:T.muted}}>Avancement budget</span><strong style={{color:dp>100?T.danger:dp>80?T.warning:T.success}}>{dp}%</strong></div><PBar p={dp} color={dp>100?T.danger:dp>80?T.warning:T.success} h={14}/></div>{[["Budget initial",fmt(c.budgetInitial),T.white],["Depenses",fmt(dep),T.warning],["Marge",fmt(c.budgetInitial-dep),c.budgetInitial-dep>=0?T.success:T.danger]].map(function(row){return <div key={row[0]} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid "+T.border,fontSize:13}}><span style={{color:T.muted}}>{row[0]}</span><span style={{fontWeight:700,color:row[2]}}>{row[1]}</span></div>;})}</Card></div>}
    {tab==="budget"&&<div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:10}}><Kpi icon="💰" label="Budget" value={fmtS(c.budgetInitial)} compact T={T}/><Kpi icon="🧾" label="Depenses" value={fmtS(dep)} color={T.warning} compact T={T}/><Kpi icon="💵" label="Marge" value={fmtS(c.budgetInitial-dep)} color={c.budgetInitial-dep>=0?T.success:T.danger} compact T={T}/><Kpi icon="📊" label="Consomme" value={dp+"%"} color={dp>100?T.danger:dp>80?T.warning:T.success} compact T={T}/></div>}
    {tab==="depenses"&&<div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",gap:6,justifyContent:"space-between",flexWrap:"wrap"}}><div style={{display:"flex",gap:4,overflowX:"auto"}}>{["Toutes"].concat(CATS).map(function(cat){return <button key={cat} onClick={function(){setFCat(cat);}} style={{padding:"5px 10px",borderRadius:20,border:"1px solid "+(fCat===cat?T.primary:T.border),background:fCat===cat?T.primary:"transparent",color:fCat===cat?"#fff":T.muted,cursor:"pointer",fontSize:10,whiteSpace:"nowrap",flexShrink:0}}>{cat}</button>;})}</div><div style={{display:"flex",gap:6}}><button onClick={function(){exportChantierCSV(c);}} style={{background:T.success+"22",color:T.success,border:"1px solid "+T.success+"44",borderRadius:8,padding:"7px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>CSV</button><button onClick={function(){setShowDep(true);}} style={{background:T.primary,color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontWeight:700,cursor:"pointer",fontSize:13}}>+ Depense</button></div></div>
      {filtered.length===0&&<Empty msg="Aucune depense" icon="🧾"/>}
      {filtered.map(function(d){return <div key={d.id} style={{background:T.card,border:"1px solid "+T.border,borderRadius:10,padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}><div style={{flex:1}}><div style={{fontWeight:700,fontSize:13}}>{d.libelle}</div><div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:4}}><Badge label={d.categorie} color={catC(d.categorie,T)} small/><span style={{fontSize:10,color:T.muted}}>{d.date}</span>{d.note&&<span style={{fontSize:10,color:T.muted}}>- {d.note}</span>}</div></div><div style={{display:"flex",gap:6,alignItems:"center"}}><span style={{fontWeight:800,color:T.primary,fontSize:14}}>{fmt(d.montant)}</span><button onClick={function(){delDep(d.id);}} style={{background:T.danger+"22",border:"1px solid "+T.danger+"44",color:T.danger,borderRadius:6,padding:"4px 8px",fontSize:11,cursor:"pointer"}}>X</button></div></div>;})}
      {showDep&&<Modal title="Nouvelle depense" onClose={function(){setShowDep(false);}} onSave={addDep} T={T}>{saving?<Spin/>:<FG cols={2}><FF label="Libelle *" value={fDep.libelle} onChange={function(v){setFDep(function(pp){return Object.assign({},pp,{libelle:v});});}} full T={T}/><FS label="Categorie" value={fDep.categorie} onChange={function(v){setFDep(function(pp){return Object.assign({},pp,{categorie:v});});}} options={CATS} T={T}/><FF label="Montant (XOF)" type="number" value={fDep.montant} onChange={function(v){setFDep(function(pp){return Object.assign({},pp,{montant:v});});}} T={T}/><FF label="Date" type="date" value={fDep.date} onChange={function(v){setFDep(function(pp){return Object.assign({},pp,{date:v});});}} T={T}/><FF label="Note" value={fDep.note} onChange={function(v){setFDep(function(pp){return Object.assign({},pp,{note:v});});}} full T={T}/></FG>}</Modal>}
    </div>}
    {tab==="graphiques"&&depCatData.length>0&&<Card title="Repartition des depenses" T={T}><ResponsiveContainer width="100%" height={220}><BarChart data={depCatData} layout="vertical" margin={{left:0,right:10}}><XAxis type="number" tick={{fill:T.muted,fontSize:9}} tickFormatter={function(v){return fmtS(v);}}/><YAxis type="category" dataKey="cat" tick={{fill:T.muted,fontSize:10}} width={70}/><Tooltip contentStyle={{background:T.card,border:"1px solid "+T.border,color:T.white}} formatter={function(v){return fmt(v);}}/><Bar dataKey="total" radius={[0,4,4,0]}>{depCatData.map(function(d,i){return <Cell key={i} fill={catC(d.cat,T)}/>;})}</Bar></BarChart></ResponsiveContainer></Card>}
  </div>;
}

// ── DEBOURS SEC INTELLIGENT ───────────────────────────────────────────────────
function Debourse(p){
  var sessions=p.sessions,taches=p.taches,ch=p.ch,reload=p.reload,T=p.T;
  var isMobile=useBP().isMobile;
  var _s=useState(null),selSid=_s[0],setSelSid=_s[1];
  var _n=useState(false),showNewS=_n[0],setShowNewS=_n[1];
  var _ia=useState(false),showIA=_ia[0],setShowIA=_ia[1];
  var _f=useState({nom:"",chantier_id:"",taux_charges:40,coeff_fg:15,coeff_benef:10}),sForm=_f[0],setSForm=_f[1];
  var _sv=useState(false),saving=_sv[0],setSaving=_sv[1];
  var selSess=sessions.find(function(s){return s.id===selSid;});
  var selTaches=selSid?taches.filter(function(t){return t.session_id===selSid;}) :[];
  function saveSession(){if(!sForm.nom)return;setSaving(true);q("debourse_sessions").insert({nom:sForm.nom,chantier_id:sForm.chantier_id||null,taux_charges:parseFloat(sForm.taux_charges),coeff_fg:parseFloat(sForm.coeff_fg),coeff_benef:parseFloat(sForm.coeff_benef)}).then(function(r){setSaving(false);setShowNewS(false);reload();if(r.data)setSelSid(r.data.id);});}
  function delSession(id){if(!window.confirm("Supprimer ?"))return;q("debourse_taches").eq("session_id",id).del().then(function(){q("debourse_sessions").eq("id",id).del().then(function(){setSelSid(null);reload();});});}
  function updateCfg(k,v){if(!selSid)return;q("debourse_sessions").eq("id",selSid).update({[k]:parseFloat(v)||0}).then(function(){reload();});}
  return <div style={{display:"flex",flexDirection:"column",gap:16}}>
    <Card title="Sessions de debours" action={<div style={{display:"flex",gap:6}}><button onClick={function(){setShowIA(true);}} style={{background:T.secondary+"22",color:T.secondary,border:"1px solid "+T.secondary+"44",borderRadius:8,padding:"6px 14px",fontWeight:700,cursor:"pointer",fontSize:12}}>🤖 IA Ouvrage</button><button onClick={function(){setShowNewS(true);}} style={{background:T.primary,color:"#fff",border:"none",borderRadius:8,padding:"6px 14px",fontWeight:700,cursor:"pointer",fontSize:12}}>+ Nouvelle</button></div>} T={T}>
      {sessions.length===0?<Empty msg="Aucune session — creez-en une" icon="🔢"/>:<div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:4}}>
        {sessions.map(function(s){var sts=taches.filter(function(t){return t.session_id===s.id;});var tot=sts.reduce(function(a,t){return a+(t.prix_vente_total||0);},0);var active=selSid===s.id;return <div key={s.id} onClick={function(){setSelSid(s.id);}} style={{background:active?T.primary+"22":T.mid,border:"2px solid "+(active?T.primary:T.border),borderRadius:10,padding:"12px 16px",cursor:"pointer",minWidth:180,flexShrink:0}}><div style={{fontWeight:700,fontSize:13,color:active?T.primary:T.white}}>{s.nom}</div><div style={{fontSize:11,color:T.muted,marginTop:4}}>{sts.length} tache(s)</div><div style={{fontSize:13,fontWeight:700,color:T.success,marginTop:4}}>{fmtS(tot)} XOF</div><button onClick={function(e){e.stopPropagation();delSession(s.id);}} style={{marginTop:8,background:T.danger+"22",border:"none",color:T.danger,borderRadius:6,padding:"3px 8px",fontSize:10,cursor:"pointer"}}>Supprimer</button></div>;})}
      </div>}
    </Card>
    {selSess&&<SessionDetail sess={selSess} taches={selTaches} reload={reload} T={T} isMobile={isMobile} updateCfg={updateCfg} ch={ch}/>}
    {showNewS&&<Modal title="Nouvelle session" onClose={function(){setShowNewS(false);}} onSave={saveSession} T={T}>{saving?<Spin/>:<FG cols={2}><FF label="Nom *" value={sForm.nom} onChange={function(v){setSForm(function(pp){return Object.assign({},pp,{nom:v});});}} full T={T}/><FS label="Chantier" value={sForm.chantier_id} onChange={function(v){setSForm(function(pp){return Object.assign({},pp,{chantier_id:v});});}} options={[["","- Aucun -"]].concat(ch.map(function(c){return[c.id,c.nom];}))  } full T={T}/><FF label="Charges (%)" type="number" value={sForm.taux_charges} onChange={function(v){setSForm(function(pp){return Object.assign({},pp,{taux_charges:v});});}} T={T}/><FF label="FG (%)" type="number" value={sForm.coeff_fg} onChange={function(v){setSForm(function(pp){return Object.assign({},pp,{coeff_fg:v});});}} T={T}/><FF label="Benefice (%)" type="number" value={sForm.coeff_benef} onChange={function(v){setSForm(function(pp){return Object.assign({},pp,{coeff_benef:v});});}} T={T}/></FG>}</Modal>}
    {showIA&&<IAOuvrageModal onClose={function(){setShowIA(false);}} sessions={sessions} reload={reload} T={T}/>}
  </div>;
}

// ── IA OUVRAGE MODAL — Décomposition intelligente ─────────────────────────────
async function callWithRetry(body, maxRetries=4){
    for(var attempt=1;attempt<=maxRetries;attempt++){
      var r=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(body)
      });
      if(r.ok)return r.json();
      var errText=await r.text();
      if(r.status===529||r.status===503||r.status===500){
        if(attempt<maxRetries){
          var delay=attempt*4000;
          await new Promise(function(res){setTimeout(res,delay);});
        } else throw new Error("Serveurs surchargés après "+maxRetries+" tentatives — réessayez dans 1-2 min");
      } else throw new Error("API "+r.status+": "+errText.slice(0,150));
    }
}

function IAOuvrageModal(p){
  var onClose=p.onClose,sessions=p.sessions,reload=p.reload,T=p.T;
  var _q=useState(""),query=_q[0],setQuery=_q[1];
  var _r=useState(null),result=_r[0],setResult=_r[1];
  var _l=useState(false),loading=_l[0],setLoading=_l[1];
  var _e=useState(null),err=_e[0],setErr=_e[1];
  var _sel=useState(""),selSess=_sel[0],setSelSess=_sel[1];
  var _imp=useState(false),importing=_imp[0],setImporting=_imp[1];
  var _done=useState(false),done=_done[0],setDone=_done[1];

  async function callWithRetryLocal(body, maxRetries=4){
    for(var attempt=1;attempt<=maxRetries;attempt++){
      var r=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(body)
      });
      if(r.ok)return r.json();
      var errText=await r.text();
      if(r.status===529||r.status===503||r.status===500){
        if(attempt<maxRetries){
          var delay=attempt*4000;
          setErr("⏳ Serveurs surchargés — nouvelle tentative "+attempt+"/"+maxRetries+" dans "+(delay/1000)+"s...");
          await new Promise(function(res){setTimeout(res,delay);});
          setErr(null);
        } else throw new Error("Serveurs surchargés après "+maxRetries+" tentatives — réessayez dans 1-2 min");
      } else throw new Error("API "+r.status+": "+errText.slice(0,150));
    }
  }

  async function analyze(){
    if(!query.trim())return;
    setLoading(true);setErr(null);setResult(null);setDone(false);
    try{
      var prompt="Expert BTP Cote d'Ivoire. Decompose cet ouvrage: "+query+"\n\n"
        +"Reponds UNIQUEMENT en lignes CSV pipe (pas d'intro, pas de commentaire):\n"
        +"LIBELLE|UNITE|QTE|SALAIRE_J|RENDEMENT|MATERIAUX_U|MATERIEL_U|ST_U|CATEGORIE|TYPE_OUVRIER|NB\n"
        +"Exemples:\n"
        +"Fouille mecanique|m3|10|0|0|0|12000|0|Materiel|conducteur|1\n"
        +"Beton proprete C10|m3|0.5|5000|1.5|85000|8000|0|Mixte|macon|2\n"
        +"Ferraillage HA12|kg|120|7500|80|680|0|0|MO|ferrailleur|2\n"
        +"Coffrage bois|m2|8|5500|4|9500|0|0|Mixte|coffreur|1\n"
        +"Beton arme C25|m3|2.4|6000|2|115000|15000|0|Mixte|macon|3\n"
        +"Max 15 lignes. Commence directement.";
      var data=await callWithRetryLocal({model:"claude-sonnet-4-20250514",max_tokens:8000,messages:[{role:"user",content:prompt}]});
      var txt=(data.content||[]).map(function(i){return i.text||"";}).join("").trim();
      // Parser CSV pipe — robuste, pas de JSON
      var lines=txt.split("\n").map(function(l){return l.trim();}).filter(function(l){
        return l.indexOf("|")>=2&&l.length>5&&!/^(libelle|designation|element|#)/i.test(l.split("|")[0]);
      });
      var items=[];
      lines.forEach(function(line){
        try{
          var parts=line.split("|");
          if(parts.length<8)return;
          var lib=parts[0].replace(/^[-*•\d.]+\s*/,"").trim();
          if(!lib||lib.length<2)return;
          items.push({
            libelle:lib,
            unite:String(parts[1]||"U").trim().slice(0,10),
            quantite:parseNum(parts[2])||1,
            salaire:parseNum(parts[3])||0,
            rendement:parseNum(parts[4])||1,
            materiau:parseNum(parts[5])||0,
            materiel:parseNum(parts[6])||0,
            sous_traitance:parseNum(parts[7])||0,
            categorie:String(parts[8]||"Mixte").trim().slice(0,20),
            typeOuvrier:String(parts[9]||"").trim().slice(0,20),
            nbOuvriers:parseInt(parts[10])||1
          });
        }catch(e){}
      });
      if(!items.length)throw new Error("Aucun element extrait — reformulez l ouvrage");
      // Calcul totaux par categorie
      var totMat=0,totMO=0,totMateriel=0,totST=0;
      items.forEach(function(t){
        var c=calcTache(t,cfg2.tc,cfg2);
        totMO+=c.mo*t.quantite;
        totMat+=(t.materiau||0)*t.quantite;
        totMateriel+=(t.materiel||0)*t.quantite;
        totST+=(t.sous_traitance||0)*t.quantite;
      });
      setResult({items:items,totMat:totMat,totMO:totMO,totMateriel:totMateriel,totST:totST});
    }catch(e){setErr(e.message);}
    setLoading(false);
  }

  async function importToSession(){
    if(!selSess||!result)return;
    setImporting(true);
    var sess=sessions.find(function(s){return s.id===selSess;});
    var cfg={tc:sess?sess.taux_charges:40,fg:sess?sess.coeff_fg:15,benef:sess?sess.coeff_benef:10};
    for(var i=0;i<result.length;i++){
      var t=result[i];
      var c=calcTache(t,cfg.tc,cfg);
      await q("debourse_taches").insert({
        session_id:selSess,libelle:t.libelle,unite:t.unite,quantite:t.quantite,
        salaire:t.salaire,rendement:t.rendement,materiau:t.materiau,
        materiel:t.materiel,sous_traitance:t.sous_traitance,
        main_oeuvre_u:Math.round(c.mo),debourse_sec_u:Math.round(c.ds),
        prix_revient_u:Math.round(c.pr),prix_vente_u:Math.round(c.pv),
        prix_vente_total:Math.round(c.pvt)
      });
    }
    setImporting(false);setDone(true);reload();
  }

  var cfg2={tc:40,fg:15,benef:10};
  if(selSess){var s2=sessions.find(function(s){return s.id===selSess;});if(s2)cfg2={tc:s2.taux_charges,fg:s2.coeff_fg,benef:s2.coeff_benef};}
  var items=result?result.items:[];
  var totDS=items.reduce(function(a,t){var c=calcTache(t,cfg2.tc,cfg2);return a+c.ds*t.quantite;},0);
  var totPV=items.reduce(function(a,t){var c=calcTache(t,cfg2.tc,cfg2);return a+c.pvt;},0);
  var totDSU=items.length>0?totDS/items.reduce(function(a,t){return a+t.quantite;},0):0;

  return <Modal title="🤖 IA — Décomposition intelligente d'ouvrage BTP" onClose={onClose} T={T}>
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{background:T.secondary+"11",border:"1px solid "+T.secondary+"44",borderRadius:10,padding:"12px 16px",fontSize:12,color:T.muted}}>
        Décrivez précisément un ouvrage BTP — l'IA applique les 4 étapes d'analyse (identification, décomposition MO/Matériaux/Matériel, vérification technique, récapitulatif) avec des ratios réalistes Côte d'Ivoire.
      </div>
      <FF label="Ouvrage à décomposer" value={query} onChange={setQuery} placeholder="Ex: Semelle filante 40x60cm béton armé C25/30, 1 m2 dallage béton armé ép.15cm, Maçonnerie parpaing 15cm..." rows={3} full T={T}/>
      <button onClick={analyze} disabled={loading||!query.trim()} style={{background:loading?T.mid:T.secondary,color:"#fff",border:"none",borderRadius:10,padding:"12px",fontWeight:700,cursor:loading?"wait":"pointer",fontSize:14}}>{loading?"🔍 Analyse en cours (4 étapes)...":"🤖 Analyser et décomposer l'ouvrage"}</button>
      {err&&<div style={{background:T.danger+"11",border:"1px solid "+T.danger+"44",borderRadius:8,padding:"10px 14px",color:T.danger,fontSize:12}}>⚠️ {err}</div>}
      {result&&<div style={{display:"flex",flexDirection:"column",gap:12}}>
        {/* KPIs récap */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
          {[["🧱 Matériaux",result.totMat,T.primary],["👷 Main d'œuvre",result.totMO,T.secondary],["⚙️ Matériel",result.totMateriel,T.warning],["🔨 DS Total",totDS,T.success]].map(function(r,i){return <div key={i} style={{background:r[2]+"11",border:"1px solid "+r[2]+"33",borderRadius:8,padding:"10px 12px",textAlign:"center"}}><div style={{fontSize:10,color:T.muted,marginBottom:4}}>{r[0]}</div><div style={{fontWeight:800,fontSize:13,color:r[2]}}>{fmtS(Math.round(r[1]))}</div></div>;})}
        </div>
        {/* Tableau détail */}
        <div style={{fontWeight:700,fontSize:13,color:T.primary,borderBottom:"1px solid "+T.border,paddingBottom:6}}>📋 Éléments constitutifs</div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:700}}>
            <thead><tr style={{background:T.mid}}>{["Désignation","Unité","Qte","Type ouvrier","Nb ouv.","MO/j","Rdt","Matériaux/u","Matériel/u","DS/u","PV/u"].map(function(h){return <th key={h} style={{padding:"7px 8px",textAlign:"left",color:T.muted,fontWeight:600,fontSize:10,whiteSpace:"nowrap"}}>{h}</th>;})}</tr></thead>
            <tbody>
              {items.map(function(t,i){
                var c=calcTache(t,cfg2.tc,cfg2);
                var catColor=t.categorie==="MO"?T.secondary:t.categorie==="Materiaux"?T.primary:t.categorie==="Materiel"?T.warning:T.success;
                return <tr key={i} style={{background:i%2===0?T.mid+"88":"transparent",borderBottom:"1px solid "+T.border+"44"}}>
                  <td style={{padding:"6px 8px",fontWeight:600}}><span style={{background:catColor+"22",color:catColor,borderRadius:4,padding:"1px 5px",fontSize:9,marginRight:4}}>{t.categorie}</span>{t.libelle}</td>
                  <td style={{padding:"6px 8px",color:T.muted,textAlign:"center"}}>{t.unite}</td>
                  <td style={{padding:"6px 8px",textAlign:"center",fontWeight:600}}>{t.quantite}</td>
                  <td style={{padding:"6px 8px",color:T.muted,fontSize:10}}>{t.typeOuvrier||"-"}</td>
                  <td style={{padding:"6px 8px",textAlign:"center",color:T.secondary}}>{t.nbOuvriers||1}</td>
                  <td style={{padding:"6px 8px",textAlign:"right",color:T.secondary}}>{fmtS(t.salaire)}</td>
                  <td style={{padding:"6px 8px",textAlign:"center"}}>{t.rendement}</td>
                  <td style={{padding:"6px 8px",textAlign:"right",color:T.primary}}>{fmtS(t.materiau)}</td>
                  <td style={{padding:"6px 8px",textAlign:"right",color:T.warning}}>{fmtS(t.materiel)}</td>
                  <td style={{padding:"6px 8px",textAlign:"right",color:T.white,fontWeight:700}}>{fmtS(Math.round(c.ds))}</td>
                  <td style={{padding:"6px 8px",textAlign:"right",color:T.success,fontWeight:700}}>{fmtS(Math.round(c.pv))}</td>
                </tr>;
              })}
              <tr style={{background:T.primary+"22",borderTop:"2px solid "+T.primary+"55"}}>
                <td colSpan={9} style={{padding:"8px",fontWeight:800,color:T.primary}}>TOTAL DÉBOURSÉ SEC</td>
                <td style={{padding:"8px",textAlign:"right",fontWeight:800,color:T.white,fontSize:13}}>{fmtS(Math.round(totDS))}</td>
                <td style={{padding:"8px",textAlign:"right",fontWeight:800,color:T.success,fontSize:13}}>{fmtS(Math.round(totPV))}</td>
              </tr>
            </tbody>
          </table>
        </div>
        {/* Récapitulatif global — Étape 4 */}
        <div style={{fontWeight:700,fontSize:13,color:T.primary,borderBottom:"1px solid "+T.border,paddingBottom:6,marginTop:4}}>📊 Récapitulatif global (Étape 4)</div>
        <div style={{background:T.mid,borderRadius:10,padding:"14px 16px"}}>
          {[["🧱 Total matériaux",Math.round(result.totMat),T.primary],["👷 Total main d'œuvre",Math.round(result.totMO),T.secondary],["⚙️ Total matériel",Math.round(result.totMateriel),T.warning],["🔗 Total sous-traitance",Math.round(result.totST),"#A855F7"]].map(function(r,i){return r[1]>0?<div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid "+T.border+"44",fontSize:13}}><span style={{color:T.muted}}>{r[0]}</span><span style={{fontWeight:700,color:r[2]}}>{fmt(r[1])}</span></div>:null;})}
          <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0 6px",fontSize:14,borderTop:"2px solid "+T.primary+"44",marginTop:4}}><span style={{fontWeight:800,color:T.primary}}>🔨 TOTAL DÉBOURSÉ SEC</span><span style={{fontWeight:800,color:T.primary,fontSize:15}}>{fmt(Math.round(totDS))}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",padding:"4px 0",fontSize:13}}><span style={{color:T.muted}}>📐 DS unitaire</span><span style={{fontWeight:700,color:T.white}}>{fmt(Math.round(totDSU))}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",padding:"4px 0",fontSize:13}}><span style={{color:T.muted}}>💰 Prix de vente HT (avec FG+bénéf.)</span><span style={{fontWeight:700,color:T.success}}>{fmt(Math.round(totPV))}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",padding:"4px 0",fontSize:13}}><span style={{color:T.muted}}>📈 Marge brute estimée</span><span style={{fontWeight:700,color:T.success}}>{totPV>0?Math.round((totPV-totDS)/totPV*100):0}%</span></div>
        </div>
        {!done?<div style={{display:"flex",gap:10,alignItems:"flex-end",flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:200}}><label style={{fontSize:11,color:T.muted,display:"block",marginBottom:4}}>Importer dans la session</label><select value={selSess} onChange={function(e){setSelSess(e.target.value);}} style={{width:"100%",background:T.mid,border:"1px solid "+T.border,borderRadius:8,padding:"10px 12px",color:T.white,fontSize:14,outline:"none"}}><option value="">-- Choisir une session --</option>{sessions.map(function(s){return <option key={s.id} value={s.id}>{s.nom}</option>;})}</select></div>
          <button onClick={importToSession} disabled={!selSess||importing} style={{background:selSess?T.success:T.mid,color:"#fff",border:"none",borderRadius:10,padding:"10px 20px",fontWeight:700,cursor:selSess?"pointer":"not-allowed",fontSize:13}}>{importing?"Import...":"✅ Importer"}</button>
        </div>:<div style={{background:T.success+"22",border:"1px solid "+T.success+"44",borderRadius:10,padding:"12px 16px",fontWeight:700,color:T.success,textAlign:"center"}}>✅ {items.length} éléments importés avec succès !</div>}
      </div>}
    </div>
  </Modal>;
}

// ── SESSION DETAIL ────────────────────────────────────────────────────────────
function SessionDetail(p){
  var sess=p.sess,taches=p.taches,reload=p.reload,T=p.T,isMobile=p.isMobile,updateCfg=p.updateCfg,ch=p.ch;
  var _sv=useState(false),saving=_sv[0],setSaving=_sv[1];
  var _imp=useState(false),importing=_imp[0],setImporting=_imp[1];
  var _log=useState(null),importLog=_log[0],setImportLog=_log[1];
  var _eid=useState(null),editingId=_eid[0],setEditingId=_eid[1];
  var _er=useState({}),editRow=_er[0],setEditRow=_er[1];
  var _sn=useState(false),showNew=_sn[0],setShowNew=_sn[1];
  var _tf=useState({libelle:"",unite:"U",quantite:0,salaire:0,rendement:1,materiau:0,materiel:0,sous_traitance:0}),tForm=_tf[0],setTForm=_tf[1];
  var fileRef=useRef();
  var cfg={tc:sess.taux_charges||40,fg:sess.coeff_fg||15,benef:sess.coeff_benef||10};
  var chNom=(ch.find(function(c){return c.id===sess.chantier_id;})||{}).nom||"";
  var totaux=taches.reduce(function(acc,t){var c=calcTache(t,cfg.tc,cfg);return{ds:acc.ds+c.ds*(t.quantite||0),pr:acc.pr+c.pr*(t.quantite||0),pvt:acc.pvt+c.pvt};},{ds:0,pr:0,pvt:0});

  function startEdit(t){setEditingId(t.id);setEditRow({libelle:t.libelle,unite:t.unite,quantite:t.quantite,salaire:t.salaire,rendement:t.rendement,materiau:t.materiau,materiel:t.materiel,sous_traitance:t.sous_traitance});}
  function cancelEdit(){setEditingId(null);setEditRow({});}
  function saveEdit(id){var c=calcTache(editRow,cfg.tc,cfg);q("debourse_taches").eq("id",id).update({libelle:editRow.libelle,unite:editRow.unite,quantite:parseFloat(editRow.quantite)||0,salaire:parseFloat(editRow.salaire)||0,rendement:parseFloat(editRow.rendement)||1,materiau:parseFloat(editRow.materiau)||0,materiel:parseFloat(editRow.materiel)||0,sous_traitance:parseFloat(editRow.sous_traitance)||0,main_oeuvre_u:Math.round(c.mo),debourse_sec_u:Math.round(c.ds),prix_revient_u:Math.round(c.pr),prix_vente_u:Math.round(c.pv),prix_vente_total:Math.round(c.pvt)}).then(function(){setEditingId(null);setEditRow({});reload();});}
  function upE(k,v){setEditRow(function(pp){var n=Object.assign({},pp);n[k]=v;return n;});}
  function delTache(id){q("debourse_taches").eq("id",id).del().then(function(){reload();});}
  function saveTache(){if(!tForm.libelle)return;setSaving(true);var c=calcTache(tForm,cfg.tc,cfg);q("debourse_taches").insert({session_id:sess.id,libelle:tForm.libelle,unite:tForm.unite,quantite:parseFloat(tForm.quantite)||0,salaire:parseFloat(tForm.salaire)||0,rendement:parseFloat(tForm.rendement)||1,materiau:parseFloat(tForm.materiau)||0,materiel:parseFloat(tForm.materiel)||0,sous_traitance:parseFloat(tForm.sous_traitance)||0,main_oeuvre_u:Math.round(c.mo),debourse_sec_u:Math.round(c.ds),prix_revient_u:Math.round(c.pr),prix_vente_u:Math.round(c.pv),prix_vente_total:Math.round(c.pvt)}).then(function(){setSaving(false);setShowNew(false);setTForm({libelle:"",unite:"U",quantite:0,salaire:0,rendement:1,materiau:0,materiel:0,sous_traitance:0});reload();});}

  async function callAI(messages,maxTok,retries=4){
    for(var attempt=1;attempt<=retries;attempt++){
      var r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:maxTok||1000,messages:messages})});
      if(r.ok){var d=await r.json();return(d.content||[]).map(function(i){return i.text||"";}).join("");}
      if((r.status===529||r.status===503)&&attempt<retries){await new Promise(function(res){setTimeout(res,attempt*4000);});}
      else{var e=await r.text();throw new Error("API "+r.status+": "+e.slice(0,200));}
    }
  }

  async function handleFile(file){
    setImporting(true);setImportLog(null);
    var ext=file.name.split(".").pop().toLowerCase();
    var isExcel=ext==="xlsx"||ext==="xls";
    var isPDF=file.type==="application/pdf";
    var isImg=file.type.indexOf("image/")===0;
    try{
      var allTaches=[];
      if(isExcel){
        var SheetJS=await import("https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs");
        var buf=await file.arrayBuffer();
        var wb=SheetJS.read(buf,{type:"array"});
        var ws=wb.Sheets[wb.SheetNames[0]];
        var raw=SheetJS.utils.sheet_to_json(ws,{header:1,defval:""});
        raw=raw.filter(function(r){return r.some(function(c){return String(c).trim()!=="";});});
        if(!raw.length)throw new Error("Feuille vide");
        // Analyse structure
        setImportLog({ok:true,msg:"🤖 Analyse structure du fichier..."});
        var sample=raw.slice(0,15);
        var p1="Tu es expert BTP. Analyse ce fichier Excel. Reponds en CSV pipe UNE SEULE LIGNE:\nTYPE|DEVISE|COL_LIBELLE|COL_QTE|COL_UNITE|COL_PU|COL_TOTAL|LIGNE_DEBUT|TOTAL_GENERAL\nLignes:"+JSON.stringify(sample)+"\nSi colonne inconnue mettre -1. Une seule ligne de reponse sans commentaire.";
        var t1=await callAI([{role:"user",content:p1}],150);
        var l1=t1.trim().split("\n").filter(function(l){return l.indexOf("|")>=0;});
        var mapping={colLibelle:0,colQuantite:-1,colUnite:-1,colPrixUnitaire:-1,colMontantTotal:-1,ligneDebut:1,totalGeneral:0,typeDoc:"devis",devise:"XOF"};
        if(l1.length>0){var pp=l1[l1.length-1].split("|");mapping.typeDoc=pp[0]||"devis";mapping.devise=pp[1]||"XOF";mapping.colLibelle=parseInt(pp[2])||0;mapping.colQuantite=parseInt(pp[3]);mapping.colUnite=parseInt(pp[4]);mapping.colPrixUnitaire=parseInt(pp[5]);mapping.colMontantTotal=parseInt(pp[6]);mapping.ligneDebut=parseInt(pp[7])||1;mapping.totalGeneral=parseNum(pp[8]);}
        setImportLog({ok:true,msg:"🔍 "+mapping.typeDoc.toUpperCase()+" detecte — extraction en cours..."});
        var dataRows=raw.slice(mapping.ligneDebut||1);
        var chunkSize=10;
        for(var ci=0;ci<dataRows.length;ci+=chunkSize){
          var chunk=dataRows.slice(ci,ci+chunkSize);
          var p2="Expert BTP. Extrait taches de ces lignes Excel. Reponds UNIQUEMENT en lignes CSV pipe:\nLIBELLE|QUANTITE|UNITE|PRIX_UNITAIRE|MONTANT_TOTAL|MO|MATERIAUX|MATERIEL|SOUS_TRAITANCE\n"
            +"Regles: ignore totaux/titres. Nombres sans symboles. Si PU manquant calcule PU=MT/QTE. Retourne lignes seulement.\n"
            +"Lignes:"+JSON.stringify(chunk);
          var t2=await callAI([{role:"user",content:p2}],1500);
          t2.trim().split("\n").forEach(function(line){
            line=line.trim();if(!line||line.indexOf("|")<0)return;
            var parts=line.split("|");if(parts.length<2)return;
            var lib=parts[0].replace(/^[-*•]\s*/,"").trim();
            if(!lib||lib.length<2||/^(libelle|total|sous.total)/i.test(lib))return;
            allTaches.push({libelle:lib,quantite:parseNum(parts[1])||1,unite:String(parts[2]||"U").trim(),prixUnitaire:parseNum(parts[3]),montantTotal:parseNum(parts[4]),mo:parseNum(parts[5]),materiaux:parseNum(parts[6]),materiel:parseNum(parts[7]),sousTraitance:parseNum(parts[8])});
          });
          setImportLog({ok:true,msg:"📊 "+Math.min(ci+chunkSize,dataRows.length)+"/"+dataRows.length+" lignes — "+allTaches.length+" taches"});
        }
      } else if(isPDF||isImg){
        setImportLog({ok:true,msg:"🔍 Lecture IA du document..."});
        var b64=await new Promise(function(res,rej){var rr=new FileReader();rr.onload=function(e){res(e.target.result.split(",")[1]);};rr.onerror=rej;rr.readAsDataURL(file);});
        var cb=isPDF?{type:"document",source:{type:"base64",media_type:file.type,data:b64}}:{type:"image",source:{type:"base64",media_type:file.type,data:b64}};
        var pp2="Expert BTP Cote d'Ivoire. Extrais TOUTES les taches de ce document. Reponds en lignes CSV pipe:\nLIBELLE|QUANTITE|UNITE|PRIX_UNITAIRE|MONTANT_TOTAL|MO|MATERIAUX|MATERIEL|SOUS_TRAITANCE\nIgnore totaux/TVA. Commence directement par les lignes.";
        var dd=await callWithRetryLocal({model:"claude-sonnet-4-20250514",max_tokens:3000,messages:[{role:"user",content:[cb,{type:"text",text:pp2}]}]});
        var tt=(dd.content||[]).map(function(i){return i.text||"";}).join("");
        tt.trim().split("\n").forEach(function(line){
          line=line.trim();if(!line||line.indexOf("|")<0)return;
          var parts=line.split("|");if(parts.length<2)return;
          var lib=parts[0].replace(/^[-*•]\s*/,"").trim();
          if(!lib||lib.length<2||/^(libelle|total)/i.test(lib))return;
          allTaches.push({libelle:lib,quantite:parseNum(parts[1])||1,unite:String(parts[2]||"U").trim(),prixUnitaire:parseNum(parts[3]),montantTotal:parseNum(parts[4]),mo:parseNum(parts[5]),materiaux:parseNum(parts[6]),materiel:parseNum(parts[7]),sousTraitance:parseNum(parts[8])});
        });
      } else throw new Error("Format non supporte");

      if(!allTaches.length)throw new Error("Aucune tache detectee");
      setImportLog({ok:true,msg:"💾 Import de "+allTaches.length+" taches..."});
      var imported=0;
      for(var i=0;i<allTaches.length;i++){
        var t=allTaches[i];var lib=String(t.libelle||"").trim();if(!lib)continue;
        var qte=parseFloat(t.quantite)||1;
        var mo2=parseFloat(t.mo)||0,mat=parseFloat(t.materiaux)||0,mat2=parseFloat(t.materiel)||0,st=parseFloat(t.sousTraitance)||0;
        var pu=parseFloat(t.prixUnitaire)||0;
        if(mo2===0&&mat===0&&mat2===0&&st===0&&pu>0)st=pu;
        var cc=calcTache({quantite:qte,salaire:mo2,rendement:1,materiau:mat,materiel:mat2,sous_traitance:st},cfg.tc,cfg);
        await q("debourse_taches").insert({session_id:sess.id,libelle:lib,unite:t.unite||"U",quantite:qte,salaire:mo2,rendement:1,materiau:mat,materiel:mat2,sous_traitance:st,main_oeuvre_u:Math.round(cc.mo),debourse_sec_u:Math.round(cc.ds),prix_revient_u:Math.round(cc.pr),prix_vente_u:Math.round(cc.pv),prix_vente_total:Math.round(cc.pvt)});
        imported++;
      }
      setImportLog({ok:true,msg:"✅ "+imported+" taches importees avec succes !"});
      reload();
    }catch(e){setImportLog({ok:false,msg:"Erreur: "+e.message});}
    setImporting(false);
  }

  function onFileChange(e){var file=e.target.files[0];if(!file)return;e.target.value="";handleFile(file);}
  var iS={background:T.bg,border:"1px solid "+T.border,borderRadius:5,padding:"4px 7px",color:T.white,fontSize:11,outline:"none",width:"100%"};
  return <div style={{display:"flex",flexDirection:"column",gap:14}}>
    <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)",gap:10}}>
      <Kpi icon="🔨" label="Debours sec" value={fmtS(Math.round(totaux.ds))} color={T.warning} compact={isMobile} T={T}/>
      <Kpi icon="🏷️" label="Prix de revient" value={fmtS(Math.round(totaux.pr))} color={T.secondary} compact={isMobile} T={T}/>
      <Kpi icon="💰" label="Prix de vente HT" value={fmtS(Math.round(totaux.pvt))} color={T.success} compact={isMobile} T={T}/>
    </div>
    <Card title={"Coefficients — "+sess.nom} T={T}>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)",gap:12}}>
        {[["Charges sociales (%)","taux_charges",cfg.tc],["Frais generaux (%)","coeff_fg",cfg.fg],["Benefice (%)","coeff_benef",cfg.benef]].map(function(row){return <div key={row[1]}><label style={{fontSize:11,color:T.muted,display:"block",marginBottom:4}}>{row[0]}</label><input type="number" defaultValue={row[2]} onBlur={function(e){updateCfg(row[1],e.target.value);}} style={{background:T.mid,border:"1px solid "+T.border,borderRadius:7,padding:"6px 8px",color:T.white,fontSize:12,outline:"none",width:"100%"}}/></div>;})}
      </div>
    </Card>
    <Card title={"Taches ("+taches.length+")"} action={
      <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"flex-end"}}>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.pdf,image/*" style={{display:"none"}} onChange={onFileChange}/>
        <button onClick={function(){fileRef.current.click();}} disabled={importing} style={{background:importing?T.mid:T.secondary+"22",color:T.secondary,border:"1px solid "+T.secondary+"44",borderRadius:8,padding:"6px 12px",fontWeight:700,cursor:importing?"wait":"pointer",fontSize:12}}>{importing?"⏳ Import...":"📂 Importer"}</button>
        <button onClick={function(){exportDebourseHTML(sess,taches,cfg,chNom,T);}} style={{background:T.primary+"22",color:T.primary,border:"1px solid "+T.primary+"44",borderRadius:8,padding:"6px 12px",fontWeight:700,cursor:"pointer",fontSize:12}}>PDF</button>
        <button onClick={function(){setShowNew(true);}} style={{background:T.primary,color:"#fff",border:"none",borderRadius:8,padding:"6px 14px",fontWeight:700,cursor:"pointer",fontSize:12}}>+ Tache</button>
      </div>} T={T}>
      {importLog&&<div style={{background:importLog.ok?T.success+"11":T.danger+"11",border:"1px solid "+(importLog.ok?T.success:T.danger)+"44",borderRadius:8,padding:"8px 14px",marginBottom:10,fontSize:12,fontWeight:600,color:importLog.ok?T.success:T.danger,whiteSpace:"pre-line"}}>{importLog.msg}<button onClick={function(){setImportLog(null);}} style={{float:"right",background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:14}}>x</button></div>}
      {taches.length===0&&<Empty msg="Aucune tache — ajoutez-en une, importez un fichier ou utilisez IA Ouvrage" icon="📋"/>}
      {taches.length>0&&<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:isMobile?600:900}}>
        <thead><tr style={{background:T.mid}}>{["#","Designation","Qte","Unite","Salaire","Rendement","Materiaux","Materiel","S-trait.","MO/u","DS/u","PR/u","PV/u","PV total",""].map(function(h,i){return <th key={i} style={{padding:"7px 8px",textAlign:i>8?"right":"left",color:T.muted,fontWeight:600,whiteSpace:"nowrap",fontSize:10,borderBottom:"2px solid "+T.border}}>{h}</th>;})}</tr></thead>
        <tbody>
          {taches.map(function(t,idx){var c=calcTache(t,cfg.tc,cfg);var isEditing=editingId===t.id;var previewC=isEditing?calcTache(editRow,cfg.tc,cfg):null;return <tr key={t.id} style={{background:isEditing?T.primary+"11":idx%2===0?T.mid+"88":"transparent",borderBottom:"1px solid "+T.border+"66"}}>
            <td style={{padding:"6px 8px",color:T.muted,fontSize:10}}>{idx+1}</td>
            {isEditing?<>
              <td style={{padding:"4px 6px"}}><input value={editRow.libelle||""} onChange={function(e){upE("libelle",e.target.value);}} style={Object.assign({},iS,{minWidth:140})}/></td>
              <td style={{padding:"4px 6px"}}><input type="number" value={editRow.quantite||0} onChange={function(e){upE("quantite",e.target.value);}} style={Object.assign({},iS,{width:60,textAlign:"center"})}/></td>
              <td style={{padding:"4px 6px"}}><select value={editRow.unite||"U"} onChange={function(e){upE("unite",e.target.value);}} style={Object.assign({},iS,{width:65})}>{UNITES.map(function(u){return <option key={u} value={u}>{u}</option>;})}</select></td>
              <td style={{padding:"4px 6px"}}><input type="number" value={editRow.salaire||0} onChange={function(e){upE("salaire",e.target.value);}} style={Object.assign({},iS,{width:80,textAlign:"right"})}/></td>
              <td style={{padding:"4px 6px"}}><input type="number" value={editRow.rendement||1} onChange={function(e){upE("rendement",e.target.value);}} style={Object.assign({},iS,{width:65,textAlign:"right"})}/></td>
              <td style={{padding:"4px 6px"}}><input type="number" value={editRow.materiau||0} onChange={function(e){upE("materiau",e.target.value);}} style={Object.assign({},iS,{width:80,textAlign:"right"})}/></td>
              <td style={{padding:"4px 6px"}}><input type="number" value={editRow.materiel||0} onChange={function(e){upE("materiel",e.target.value);}} style={Object.assign({},iS,{width:80,textAlign:"right"})}/></td>
              <td style={{padding:"4px 6px"}}><input type="number" value={editRow.sous_traitance||0} onChange={function(e){upE("sous_traitance",e.target.value);}} style={Object.assign({},iS,{width:80,textAlign:"right"})}/></td>
              <td style={{padding:"6px 8px",textAlign:"right",color:T.secondary,fontWeight:600}}>{fmtS(Math.round(previewC.mo))}</td>
              <td style={{padding:"6px 8px",textAlign:"right",color:T.warning,fontWeight:600}}>{fmtS(Math.round(previewC.ds))}</td>
              <td style={{padding:"6px 8px",textAlign:"right",color:T.muted}}>{fmtS(Math.round(previewC.pr))}</td>
              <td style={{padding:"6px 8px",textAlign:"right"}}>{fmtS(Math.round(previewC.pv))}</td>
              <td style={{padding:"6px 8px",textAlign:"right",color:T.success,fontWeight:700}}>{fmtS(Math.round(previewC.pvt))}</td>
              <td style={{padding:"4px 6px",whiteSpace:"nowrap"}}><button onClick={function(){saveEdit(t.id);}} style={{background:T.success,color:"#fff",border:"none",borderRadius:5,padding:"4px 8px",fontSize:10,cursor:"pointer",fontWeight:700,marginRight:4}}>OK</button><button onClick={cancelEdit} style={{background:T.danger+"22",color:T.danger,border:"1px solid "+T.danger+"44",borderRadius:5,padding:"4px 8px",fontSize:10,cursor:"pointer"}}>X</button></td>
            </>:<>
              <td style={{padding:"6px 8px",fontWeight:600}}>{t.libelle}</td>
              <td style={{padding:"6px 8px",textAlign:"center"}}>{t.quantite}</td>
              <td style={{padding:"6px 8px",textAlign:"center",color:T.muted}}>{t.unite}</td>
              <td style={{padding:"6px 8px",textAlign:"right",color:T.muted}}>{fmtS(t.salaire)}</td>
              <td style={{padding:"6px 8px",textAlign:"right",color:T.muted}}>{t.rendement}</td>
              <td style={{padding:"6px 8px",textAlign:"right",color:T.muted}}>{fmtS(t.materiau)}</td>
              <td style={{padding:"6px 8px",textAlign:"right",color:T.muted}}>{fmtS(t.materiel)}</td>
              <td style={{padding:"6px 8px",textAlign:"right",color:T.muted}}>{fmtS(t.sous_traitance)}</td>
              <td style={{padding:"6px 8px",textAlign:"right",color:T.secondary,fontWeight:600}}>{fmtS(Math.round(c.mo))}</td>
              <td style={{padding:"6px 8px",textAlign:"right",color:T.warning,fontWeight:600}}>{fmtS(Math.round(c.ds))}</td>
              <td style={{padding:"6px 8px",textAlign:"right",color:T.muted}}>{fmtS(Math.round(c.pr))}</td>
              <td style={{padding:"6px 8px",textAlign:"right"}}>{fmtS(Math.round(c.pv))}</td>
              <td style={{padding:"6px 8px",textAlign:"right",color:T.success,fontWeight:700}}>{fmtS(Math.round(c.pvt))}</td>
              <td style={{padding:"4px 6px",whiteSpace:"nowrap"}}><button onClick={function(){startEdit(t);}} style={{background:T.warning+"22",color:T.warning,border:"1px solid "+T.warning+"44",borderRadius:5,padding:"4px 8px",fontSize:10,cursor:"pointer",marginRight:4}}>Edit</button><button onClick={function(){delTache(t.id);}} style={{background:T.danger+"22",color:T.danger,border:"1px solid "+T.danger+"44",borderRadius:5,padding:"4px 8px",fontSize:10,cursor:"pointer"}}>X</button></td>
            </>}
          </tr>;})}
          <tr style={{background:T.primary+"22",borderTop:"2px solid "+T.primary+"55",fontWeight:800}}>
            <td colSpan={9} style={{padding:"8px 10px",color:T.primary,fontSize:11}}>TOTAL</td>
            <td style={{padding:"8px",textAlign:"right",color:T.secondary,fontSize:11}}></td>
            <td style={{padding:"8px",textAlign:"right",color:T.warning,fontSize:11}}>{fmtS(Math.round(totaux.ds))}</td>
            <td style={{padding:"8px",textAlign:"right",color:T.muted,fontSize:11}}>{fmtS(Math.round(totaux.pr))}</td>
            <td style={{padding:"8px",textAlign:"right",fontSize:11}}></td>
            <td style={{padding:"8px",textAlign:"right",color:T.success,fontSize:13}}>{fmtS(Math.round(totaux.pvt))}</td>
            <td></td>
          </tr>
        </tbody>
      </table></div>}
    </Card>
    {showNew&&<Modal title="Nouvelle tache" onClose={function(){setShowNew(false);}} onSave={saveTache} T={T}>{saving?<Spin/>:<FG cols={2}><FF label="Designation *" value={tForm.libelle} onChange={function(v){setTForm(function(pp){return Object.assign({},pp,{libelle:v});});}} full T={T}/><FS label="Unite" value={tForm.unite} onChange={function(v){setTForm(function(pp){return Object.assign({},pp,{unite:v});});}} options={UNITES} T={T}/><FF label="Quantite" type="number" value={tForm.quantite} onChange={function(v){setTForm(function(pp){return Object.assign({},pp,{quantite:v});});}} T={T}/><FF label="Salaire ouvrier (XOF/j)" type="number" value={tForm.salaire} onChange={function(v){setTForm(function(pp){return Object.assign({},pp,{salaire:v});});}} T={T}/><FF label="Rendement (u/j)" type="number" value={tForm.rendement} onChange={function(v){setTForm(function(pp){return Object.assign({},pp,{rendement:v});});}} T={T}/><FF label="Materiaux (XOF/u)" type="number" value={tForm.materiau} onChange={function(v){setTForm(function(pp){return Object.assign({},pp,{materiau:v});});}} T={T}/><FF label="Materiel (XOF/u)" type="number" value={tForm.materiel} onChange={function(v){setTForm(function(pp){return Object.assign({},pp,{materiel:v});});}} T={T}/><FF label="Sous-traitance (XOF/u)" type="number" value={tForm.sous_traitance} onChange={function(v){setTForm(function(pp){return Object.assign({},pp,{sous_traitance:v});});}} T={T}/></FG>}</Modal>}
  </div>;
}

function DepensesIntv(p){
  var intv=p.intv,reload=p.reload,T=p.T;
  var _open=useState(false),open=_open[0],setOpen=_open[1];
  var _edit=useState(null),editDep=_edit[0],setEditDep=_edit[1];
  var _f=useState({libelle:"",montant:"",date:today()}),form=_f[0],setForm=_f[1];
  var _sv=useState(false),saving=_sv[0],setSaving=_sv[1];
  var deps=intv.depenses||[];
  var total=deps.reduce(function(a,d){return a+d.montant;},0);

  function startEdit(d){setEditDep(d);setForm({libelle:d.libelle||"",montant:d.montant||"",date:d.date||today()});setOpen(true);}
  function resetForm(){setEditDep(null);setForm({libelle:"",montant:"",date:today()});}
  function upF(k,v){setForm(function(pp){return Object.assign({},pp,{[k]:v});});}

  function save(){
    if(!form.libelle||!form.montant)return;
    setSaving(true);
    var payload={libelle:form.libelle,montant:parseFloat(form.montant)||0,date:form.date};
    var op=editDep
      ?q("intervention_depenses").eq("id",editDep.id).update(payload)
      :q("intervention_depenses").insert(Object.assign({},payload,{intervention_id:intv.id}));
    op.then(function(){setSaving(false);setOpen(false);resetForm();reload();});
  }
  function del(id){if(!window.confirm("Supprimer ?"))return;q("intervention_depenses").eq("id",id).del().then(function(){reload();});}

  return <div style={{background:T.mid,borderRadius:8,padding:"10px 12px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:open&&deps.length?8:0}}>
      <div>
        <div style={{fontSize:10,color:T.muted}}>Coût total</div>
        <div style={{fontWeight:800,color:T.primary,fontSize:15}}>{fmt(total)}</div>
      </div>
      <button onClick={function(){resetForm();setOpen(function(v){return !v;});}} style={{background:T.primary+"22",border:"1px solid "+T.primary+"44",color:T.primary,borderRadius:6,padding:"5px 10px",fontSize:11,cursor:"pointer",fontWeight:700}}>
        {open?"Fermer":"+ Dépense"}
      </button>
    </div>

    {open&&<div style={{marginTop:10,borderTop:"1px solid "+T.border+"66",paddingTop:10,display:"flex",flexDirection:"column",gap:8}}>
      {/* Liste dépenses existantes */}
      {deps.map(function(d){return <div key={d.id} style={{display:"flex",alignItems:"center",gap:8,fontSize:12}}>
        <div style={{flex:1}}><span style={{fontWeight:600}}>{d.libelle}</span><span style={{color:T.muted,marginLeft:6}}>{d.date}</span></div>
        <span style={{fontWeight:700,color:T.warning}}>{fmt(d.montant)}</span>
        <button onClick={function(){startEdit(d);}} style={{background:T.warning+"22",border:"1px solid "+T.warning+"44",color:T.warning,borderRadius:5,padding:"3px 7px",fontSize:10,cursor:"pointer"}}>✏️</button>
        <button onClick={function(){del(d.id);}} style={{background:T.danger+"22",border:"1px solid "+T.danger+"44",color:T.danger,borderRadius:5,padding:"3px 7px",fontSize:10,cursor:"pointer"}}>🗑</button>
      </div>;})}

      {/* Formulaire ajout/édition */}
      <div style={{background:T.card,borderRadius:8,padding:"10px 12px",border:"1px solid "+T.border,marginTop:4}}>
        <div style={{fontWeight:600,fontSize:12,marginBottom:8,color:editDep?T.warning:T.primary}}>{editDep?"✏️ Modifier la dépense":"+ Nouvelle dépense"}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
          <FF label="Libellé *" value={form.libelle} onChange={function(v){upF("libelle",v);}} full T={T}/>
          <FF label="Montant (XOF) *" type="number" value={form.montant} onChange={function(v){upF("montant",v);}} T={T}/>
          <FF label="Date" type="date" value={form.date} onChange={function(v){upF("date",v);}} T={T}/>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          {editDep&&<button onClick={function(){resetForm();}} style={{background:T.mid,color:T.muted,border:"1px solid "+T.border,borderRadius:7,padding:"7px 14px",fontSize:12,cursor:"pointer"}}>Annuler</button>}
          <button onClick={save} disabled={saving} style={{background:saving?T.mid:T.success,color:"#fff",border:"none",borderRadius:7,padding:"7px 16px",fontWeight:700,fontSize:12,cursor:saving?"wait":"pointer"}}>{saving?"...":(editDep?"Enregistrer":"Ajouter")}</button>
        </div>
      </div>
    </div>}
  </div>;
}

// ── INTERVENTIONS ─────────────────────────────────────────────────────────────
function exportIntvCSV(data,label){
  if(!data.length){alert("Aucune intervention.");return;}
  var rows=data.map(function(i){return{Titre:i.titre,Type:i.type,Statut:i.statut,Intervenant:i.intervenant||"",Chantier:i.chantier||"",Date:i.date_creation||"",Description:i.description||"",Facturee:i.facturee?"Oui":"Non"};});
  exportCSV(rows,"interventions_"+(label||"export").replace(/\s/g,"_")+".csv");
}
function exportIntvHTML(data,label,T){
  if(!data.length){alert("Aucune intervention.");return;}
  var TC={Urgence:T.danger,Preventive:T.secondary,Corrective:T.primary,Inspection:"#A855F7"};
  var rows=data.map(function(i,idx){var bg=idx%2===0?"#fff":"#f9f9f9";var col=TC[i.type]||T.primary;return "<tr style='background:"+bg+"'><td>"+i.titre+"</td><td style='color:"+col+";font-weight:700'>"+i.type+"</td><td>"+i.statut+"</td><td>"+(i.intervenant||"-")+"</td><td>"+(i.chantier||"-")+"</td><td>"+(i.date_creation||"-")+"</td><td>"+(i.facturee?"✅":"❌")+"</td></tr>";}).join("");
  var style="body{font-family:sans-serif;margin:2cm;font-size:10pt}h1{color:"+T.primary+"}table{width:100%;border-collapse:collapse}th{background:"+T.primary+";color:#fff;padding:8px;text-align:left}td{padding:7px 10px;border-bottom:1px solid #eee}";
  var html="<!DOCTYPE html><html><head><meta charset='utf-8'><title>Interventions - "+label+"</title><style>"+style+"</style></head><body><h1>Interventions — "+label+"</h1><table><thead><tr><th>Titre</th><th>Type</th><th>Statut</th><th>Intervenant</th><th>Chantier</th><th>Date</th><th>Facturée</th></tr></thead><tbody>"+rows+"</tbody></table></body></html>";
  var w=window.open("","_blank");w.document.write(html);w.document.close();setTimeout(function(){w.focus();w.print();},500);
}

function Interventions(p){
  var intv=p.intv,ch=p.ch,reload=p.reload,T=p.T;
  var isMobile=useBP().isMobile;
  var _ft=useState("Tous"),fT=_ft[0],setFT=_ft[1];
  var _n=useState(false),showNew=_n[0],setShowNew=_n[1];
  var _edit=useState(null),editIntv=_edit[0],setEditIntv=_edit[1];
  var _sv=useState(false),saving=_sv[0],setSaving=_sv[1];
  var BLANK={titre:"",description:"",type:"Corrective",intervenant:"",chantier:"",date_creation:today(),statut:"En attente",facturee:false};
  var _fm=useState(BLANK),form=_fm[0],setForm=_fm[1];
  var STIC={"En attente":T.warning,"En cours":T.secondary,"Terminee":T.success};
  var TC={Urgence:T.danger,Preventive:T.secondary,Corrective:T.primary,Inspection:"#A855F7"};
  var filtered=intv.filter(function(i){return fT==="Tous"||i.type===fT;});
  function totalD(i){return(i.depenses||[]).reduce(function(a,d){return a+d.montant;},0);}
  function updSt(id,s){q("interventions").eq("id",id).update({statut:s}).then(function(){reload();});}
  function del(id){if(!window.confirm("Supprimer ?"))return;q("interventions").eq("id",id).del().then(function(){reload();});}

  function openNew(){setForm(BLANK);setEditIntv(null);setShowNew(true);}
  function openEdit(i){setForm({titre:i.titre||"",description:i.description||"",type:i.type||"Corrective",intervenant:i.intervenant||"",chantier:i.chantier||"",date_creation:i.date_creation||today(),statut:i.statut||"En attente",facturee:i.facturee||false});setEditIntv(i);setShowNew(true);}
  function upF(k,v){setForm(function(pp){return Object.assign({},pp,[k],{[k]:v});});}

  function save(){
    if(!form.titre)return;
    setSaving(true);
    var payload={titre:form.titre,description:form.description,type:form.type,intervenant:form.intervenant,chantier:form.chantier,date_creation:form.date_creation,statut:form.statut,facturee:form.facturee};
    var op=editIntv?q("interventions").eq("id",editIntv.id).update(payload):q("interventions").insert(Object.assign({},payload,{duree:1}));
    op.then(function(){setSaving(false);setShowNew(false);setEditIntv(null);reload();});
  }

  var exportLabel=fT==="Tous"?"toutes":fT;

  return <div style={{display:"flex",flexDirection:"column",gap:14}}>
    <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:10}}>
      <Kpi icon="🔧" label="Total" value={intv.length} color={T.primary} compact={isMobile} T={T}/>
      <Kpi icon="🚨" label="Urgences" value={intv.filter(function(i){return i.type==="Urgence";}).length} color={T.danger} compact={isMobile} T={T}/>
      <Kpi icon="⚙️" label="En cours" value={intv.filter(function(i){return i.statut==="En cours";}).length} color={T.secondary} compact={isMobile} T={T}/>
      <Kpi icon="💰" label="Cout total" value={fmtS(intv.reduce(function(a,i){return a+totalD(i);},0))} color={T.warning} compact={isMobile} T={T}/>
    </div>

    {/* Filtres + actions export */}
    <Card T={T}>
      <div style={{display:"flex",gap:8,justifyContent:"space-between",alignItems:"center",flexWrap:"wrap"}}>
        <div style={{display:"flex",gap:4,overflowX:"auto",flexWrap:"nowrap"}}>
          {["Tous"].concat(TYPES_INT).map(function(t){return <button key={t} onClick={function(){setFT(t);}} style={{padding:"5px 10px",borderRadius:20,border:"1px solid "+(fT===t?T.primary:T.border),background:fT===t?T.primary:"transparent",color:fT===t?"#fff":T.muted,cursor:"pointer",fontSize:11,whiteSpace:"nowrap",flexShrink:0}}>{t}</button>;})}
        </div>
        <div style={{display:"flex",gap:6,flexShrink:0,flexWrap:"wrap"}}>
          <button onClick={function(){exportIntvCSV(filtered,exportLabel);}} style={{background:T.success+"22",color:T.success,border:"1px solid "+T.success+"44",borderRadius:8,padding:"6px 12px",fontWeight:700,cursor:"pointer",fontSize:12}}>CSV {fT!=="Tous"?"("+fT+")":""}</button>
          <button onClick={function(){exportIntvHTML(filtered,exportLabel,T);}} style={{background:T.primary+"22",color:T.primary,border:"1px solid "+T.primary+"44",borderRadius:8,padding:"6px 12px",fontWeight:700,cursor:"pointer",fontSize:12}}>PDF {fT!=="Tous"?"("+fT+")":""}</button>
          <button onClick={openNew} style={{background:T.primary,color:"#fff",border:"none",borderRadius:8,padding:"6px 14px",fontWeight:700,cursor:"pointer",fontSize:12}}>+ Nouvelle</button>
        </div>
      </div>
      {/* Compteur */}
      <div style={{marginTop:10,fontSize:12,color:T.muted}}>{filtered.length} intervention(s) affichée(s){fT!=="Tous"?" — filtre : "+fT:""}</div>
    </Card>

    {filtered.length===0&&<Empty msg="Aucune intervention" icon="🔧"/>}
    <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(340px,1fr))",gap:12}}>
      {filtered.map(function(i){return <div key={i.id} style={{background:T.card,border:"1px solid "+(i.type==="Urgence"?T.danger+"66":T.border),borderRadius:T.borderRadius,padding:16,display:"flex",flexDirection:"column",gap:10}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:8}}>
          <div style={{flex:1}}><div style={{fontWeight:700,fontSize:14}}>{i.titre}</div><div style={{fontSize:11,color:T.muted}}>{i.chantier||"-"} — {i.date_creation}</div></div>
          <Badge label={i.type} color={TC[i.type]||T.primary} small/>
        </div>
        {i.intervenant&&<div style={{fontSize:12,color:T.muted}}>👷 {i.intervenant}</div>}
        {i.description&&<div style={{fontSize:12,color:T.muted,background:T.mid,borderRadius:6,padding:"7px 10px"}}>{i.description}</div>}
        <DepensesIntv intv={i} reload={reload} T={T}/>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <select value={i.statut} onChange={function(e){updSt(i.id,e.target.value);}} style={{flex:1,background:(STIC[i.statut]||T.muted)+"22",border:"1px solid "+(STIC[i.statut]||T.muted)+"55",borderRadius:6,padding:"5px 10px",color:STIC[i.statut]||T.muted,fontSize:12,cursor:"pointer",outline:"none",fontWeight:700}}>
            {["En attente","En cours","Terminee"].map(function(s){return <option key={s} value={s}>{s}</option>;})}
          </select>
          <button onClick={function(){openEdit(i);}} style={{background:T.warning+"22",border:"1px solid "+T.warning+"44",color:T.warning,borderRadius:6,padding:"6px 10px",fontSize:12,cursor:"pointer",fontWeight:700}}>✏️</button>
          <button onClick={function(){del(i.id);}} style={{background:T.danger+"22",border:"1px solid "+T.danger+"44",color:T.danger,borderRadius:6,padding:"6px 10px",fontSize:12,cursor:"pointer"}}>🗑</button>
        </div>
      </div>;})}
    </div>

    {showNew&&<Modal title={editIntv?"Modifier l'intervention":"Nouvelle intervention"} onClose={function(){setShowNew(false);setEditIntv(null);}} onSave={save} saveLabel={editIntv?"Enregistrer":"Créer"} T={T}>
      {saving?<Spin/>:<div style={{display:"flex",flexDirection:"column",gap:12}}>
        <FG cols={2}>
          <FF label="Titre *" value={form.titre} onChange={function(v){upF("titre",v);}} full T={T}/>
          <FS label="Type" value={form.type} onChange={function(v){upF("type",v);}} options={TYPES_INT} T={T}/>
          <FS label="Statut" value={form.statut} onChange={function(v){upF("statut",v);}} options={["En attente","En cours","Terminee"]} T={T}/>
          <FF label="Intervenant" value={form.intervenant} onChange={function(v){upF("intervenant",v);}} T={T}/>
          <FS label="Chantier" value={form.chantier} onChange={function(v){upF("chantier",v);}} options={[""].concat(ch.map(function(c){return c.nom;}))} T={T}/>
          <FF label="Date" type="date" value={form.date_creation} onChange={function(v){upF("date_creation",v);}} T={T}/>
          <FF label="Description" value={form.description} onChange={function(v){upF("description",v);}} rows={3} full T={T}/>
        </FG>
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderTop:"1px solid "+T.border}}>
          <input type="checkbox" id="facturee" checked={!!form.facturee} onChange={function(e){upF("facturee",e.target.checked);}} style={{width:18,height:18,cursor:"pointer"}}/>
          <label htmlFor="facturee" style={{fontSize:13,cursor:"pointer",fontWeight:600}}>Marquée comme facturée</label>
        </div>
      </div>}
    </Modal>}
  </div>;
}

// ── KPI ───────────────────────────────────────────────────────────────────────
function KpiPage(p){
  var ch=p.ch,intv=p.intv,T=p.T;
  var isMobile=useBP().isMobile;
  var totalB=ch.reduce(function(a,c){return a+c.budgetInitial;},0);
  var totalD=ch.reduce(function(a,c){return a+totalDep(c);},0);
  var marge=totalB-totalD,pc=pct(totalD,totalB);
  var depCat=CATS.map(function(cat){return{cat:cat,total:ch.reduce(function(a,c){return a+c.depenses.filter(function(d){return d.categorie===cat;}).reduce(function(s,d){return s+d.montant;},0);},0)};}).filter(function(x){return x.total>0;});
  return <div style={{display:"flex",flexDirection:"column",gap:16}}>
    <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:10}}>
      <Kpi icon="💰" label="Budget total" value={fmtS(totalB)} compact={isMobile} T={T}/>
      <Kpi icon="🧾" label="Depenses" value={fmtS(totalD)} color={T.warning} compact={isMobile} T={T}/>
      <Kpi icon="💵" label="Marge" value={fmtS(marge)} color={marge>=0?T.success:T.danger} compact={isMobile} T={T}/>
      <Kpi icon="📉" label="Consomme" value={pc+"%"} color={pc>100?T.danger:pc>80?T.warning:T.success} compact={isMobile} T={T}/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:16}}>
      <Card title="Depenses par categorie" T={T}>{depCat.length>0?<ResponsiveContainer width="100%" height={200}><BarChart data={depCat} layout="vertical" margin={{left:0,right:10}}><XAxis type="number" tick={{fill:T.muted,fontSize:9}} tickFormatter={function(v){return fmtS(v);}}/><YAxis type="category" dataKey="cat" tick={{fill:T.muted,fontSize:10}} width={80}/><Tooltip contentStyle={{background:T.card,border:"1px solid "+T.border,color:T.white}} formatter={function(v){return fmt(v);}}/><Bar dataKey="total" radius={[0,4,4,0]}>{depCat.map(function(d,i){return <Cell key={i} fill={catC(d.cat,T)}/>;})}</Bar></BarChart></ResponsiveContainer>:<Empty msg="Aucune depense" icon="📊"/>}</Card>
      <Card title="Budget par chantier" T={T}>{ch.map(function(c){var d=totalDep(c),pp=pct(d,c.budgetInitial);return <div key={c.id} style={{padding:"8px 0",borderBottom:"1px solid "+T.border}}><div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}><span style={{fontWeight:600}}>{c.nom}</span><span style={{fontWeight:700,color:pp>100?T.danger:pp>80?T.warning:T.success}}>{pp}%</span></div><PBar p={pp} color={pp>100?T.danger:pp>80?T.warning:T.success} h={6}/></div>;})} {ch.length===0&&<Empty msg="Aucun chantier" icon="📊"/>}</Card>
    </div>
  </div>;
}

// ── IA PORTEFEUILLE ───────────────────────────────────────────────────────────
function IA(p){
  var ch=p.ch,intv=p.intv,T=p.T;
  var _l=useState(false),loading=_l[0],setLoading=_l[1];
  var _r=useState(null),result=_r[0],setResult=_r[1];
  var _e=useState(null),error=_e[0],setError=_e[1];
  function run(){
    setLoading(true);setError(null);setResult(null);
    var ctx={chantiers:ch.map(function(c){return{nom:c.nom,statut:c.statut,budget:c.budgetInitial,depenses:totalDep(c),pct:pct(totalDep(c),c.budgetInitial)};}),interventions:intv.slice(0,20).map(function(i){return{titre:i.titre,type:i.type,statut:i.statut};})};
    fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1200,messages:[{role:"user",content:"Tu es expert BTP Cote d'Ivoire. Analyse ce portefeuille (XOF). Reponds UNIQUEMENT en JSON valide:\n"+JSON.stringify(ctx)+"\n\nFormat: {\"recommandations\":[{\"titre\":\"string\",\"detail\":\"string\",\"priorite\":\"haute\"}],\"scoreGlobal\":75,\"synthese\":\"string\",\"pointsForts\":[\"string\"],\"risques\":[\"string\"]}"}]})})
      .then(function(r){return r.json();})
      .then(function(data){var txt=(data.content||[]).map(function(i){return i.text||"";}).join("");var jm=txt.match(/\{[\s\S]*\}/);if(!jm)throw new Error("JSON invalide");setResult(JSON.parse(jm[0]));setLoading(false);})
      .catch(function(e){setError("Erreur: "+e.message);setLoading(false);});
  }
  return <div style={{display:"flex",flexDirection:"column",gap:14}}>
    <div style={{background:T.primary+"11",border:"1px solid "+T.primary+"44",borderRadius:T.borderRadius,padding:20}}>
      <div style={{fontSize:20,fontWeight:800,marginBottom:4}}>Analyse IA du portefeuille</div>
      <div style={{color:T.muted,fontSize:13,marginBottom:14}}>{ch.length} chantier(s) - {intv.length} interventions</div>
      <button onClick={run} disabled={loading} style={{background:T.primary,color:"#fff",border:"none",borderRadius:10,padding:"10px 24px",fontWeight:700,cursor:loading?"wait":"pointer",fontSize:14}}>{loading?"Analyse...":"Lancer l'analyse"}</button>
      {error&&<div style={{color:T.danger,fontSize:12,marginTop:10}}>{error}</div>}
    </div>
    {!result&&!loading&&<Empty msg="Lancez l'analyse pour obtenir des recommandations IA" icon="🤖"/>}
    {loading&&<Spin/>}
    {result&&<div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{background:T.primary+"11",border:"1px solid "+T.primary+"44",borderRadius:T.borderRadius,padding:18}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={{fontWeight:800,fontSize:16}}>Synthese</div><div style={{background:(result.scoreGlobal>70?T.success:result.scoreGlobal>40?T.warning:T.danger)+"22",borderRadius:8,padding:"6px 16px",fontWeight:800,fontSize:18,color:result.scoreGlobal>70?T.success:result.scoreGlobal>40?T.warning:T.danger}}>Score {result.scoreGlobal}/100</div></div>
        <div style={{fontSize:13,color:T.muted,marginBottom:12}}>{result.synthese}</div>
        {result.pointsForts&&result.pointsForts.length>0&&<div style={{marginBottom:10}}><div style={{fontWeight:700,color:T.success,fontSize:12,marginBottom:6}}>Points forts</div>{result.pointsForts.map(function(pp,i){return <div key={i} style={{fontSize:12,color:T.muted,marginBottom:3}}>✅ {pp}</div>;})}</div>}
        {result.risques&&result.risques.length>0&&<div><div style={{fontWeight:700,color:T.danger,fontSize:12,marginBottom:6}}>Risques</div>{result.risques.map(function(r,i){return <div key={i} style={{fontSize:12,color:T.muted,marginBottom:3}}>⚠️ {r}</div>;})}</div>}
      </div>
      <Card title="Recommandations" T={T}>{(result.recommandations||[]).map(function(r,i){var col=r.priorite==="haute"?T.danger:r.priorite==="moyenne"?T.warning:T.success;return <div key={i} style={{background:col+"11",border:"1px solid "+col+"33",borderRadius:8,padding:14,marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",gap:8,flexWrap:"wrap",marginBottom:6}}><div style={{fontWeight:700,color:col,fontSize:13}}>{r.titre}</div><Badge label={"Priorite "+r.priorite} color={col} small/></div><div style={{fontSize:12,color:T.muted}}>{r.detail}</div></div>;})}  </Card>
    </div>}
  </div>;
}

// ── GESTION ───────────────────────────────────────────────────────────────────
function Gestion(p){
  var ch=p.ch,openCh=p.openCh,reload=p.reload,T=p.T;
  var _c=useState(null),confirm=_c[0],setConfirm=_c[1];
  var _s=useState(""),search=_s[0],setSearch=_s[1];
  var filtered=ch.filter(function(c){return(c.nom+c.client).toLowerCase().indexOf(search.toLowerCase())>=0;});
  function del(id){q("chantiers").eq("id",id).del().then(function(){setConfirm(null);reload();});}
  return <div style={{display:"flex",flexDirection:"column",gap:14}}>
    <Card title="Tous les projets" T={T}>
      <input value={search} onChange={function(e){setSearch(e.target.value);}} placeholder="Rechercher..." style={{width:"100%",background:T.mid,border:"1px solid "+T.border,borderRadius:8,padding:"10px 14px",color:T.white,fontSize:14,boxSizing:"border-box",outline:"none",marginBottom:14}}/>
      {filtered.map(function(c){var dep=totalDep(c),pp=pct(dep,c.budgetInitial);return <div key={c.id} style={{background:T.mid,border:"1px solid "+(confirm===c.id?T.danger+"88":T.border),borderRadius:T.borderRadius,padding:"12px 14px",marginBottom:8}}>
        {confirm===c.id?<div><div style={{fontWeight:700,color:T.danger,marginBottom:8}}>Supprimer "{c.nom}" ?</div><div style={{display:"flex",gap:10}}><button onClick={function(){setConfirm(null);}} style={{flex:1,padding:"9px",background:T.card,color:T.white,border:"1px solid "+T.border,borderRadius:8,cursor:"pointer"}}>Annuler</button><button onClick={function(){del(c.id);}} style={{flex:1,padding:"9px",background:T.danger,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700}}>Confirmer</button></div></div>
        :<div><div style={{display:"flex",justifyContent:"space-between",gap:8,marginBottom:6}}><div><div style={{fontWeight:700,fontSize:14}}>{c.nom}</div><div style={{fontSize:11,color:T.muted}}>{c.client} - {c.type}</div></div><Badge label={c.statut} color={stC(c.statut,T)} small/></div><div style={{marginBottom:8}}><div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.muted,marginBottom:3}}><span>{fmt(dep)}</span><span style={{fontWeight:700,color:pp>100?T.danger:pp>80?T.warning:T.success}}>{pp}%</span></div><PBar p={pp} color={pp>100?T.danger:pp>80?T.warning:T.success} h={6}/></div><div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><button onClick={function(){openCh(c.id);}} style={{background:T.secondary+"22",border:"1px solid "+T.secondary+"44",color:T.secondary,borderRadius:7,padding:"7px 14px",fontSize:12,cursor:"pointer",fontWeight:600}}>Ouvrir</button><button onClick={function(){setConfirm(c.id);}} style={{background:T.danger+"22",border:"1px solid "+T.danger+"44",color:T.danger,borderRadius:7,padding:"7px 12px",fontSize:12,cursor:"pointer",fontWeight:700}}>X</button></div></div>}
      </div>;})}
      {filtered.length===0&&<Empty msg="Aucun resultat" icon="🔍"/>}
    </Card>
  </div>;
}

// ── PARAMETRES ────────────────────────────────────────────────────────────────
function Parametres(p){
  var T=p.T,upT=p.upT,resetT=p.resetT;
  var isMobile=useBP().isMobile;
  var presets=[{label:"BTP Orange",colors:{primary:"#F97316",secondary:"#3B82F6",bg:"#1C1917",card:"#292524"}},{label:"Bleu Pro",colors:{primary:"#2563EB",secondary:"#7C3AED",bg:"#0F172A",card:"#1E293B"}},{label:"Vert Nature",colors:{primary:"#16A34A",secondary:"#0891B2",bg:"#14532D",card:"#166534"}},{label:"Rouge BTP",colors:{primary:"#DC2626",secondary:"#D97706",bg:"#1C0A0A",card:"#2C1010"}},{label:"Dark Pro",colors:{primary:"#6366F1",secondary:"#EC4899",bg:"#000000",card:"#111111"}}];
  var uiColors=[["Principale","primary"],["Secondaire","secondary"],["Succes","success"],["Danger","danger"],["Avertissement","warning"],["Fond","bg"],["Carte","card"]];
  var companyFields=[["Nom","companyName"],["Adresse","companyAddress"],["Telephone","companyTel"],["Email","companyEmail"],["SIRET / RC","companySiret"]];
  return <div style={{display:"flex",flexDirection:"column",gap:20}}>
    <Card title="Themes predéfinis" T={T}>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(5,1fr)",gap:10}}>
        {presets.map(function(pp){return <button key={pp.label} onClick={function(){Object.keys(pp.colors).forEach(function(k){upT(k,pp.colors[k]);});}} style={{background:pp.colors.card,border:"2px solid "+pp.colors.primary,borderRadius:10,padding:"12px 10px",cursor:"pointer",textAlign:"left"}}><div style={{display:"flex",gap:4,marginBottom:6}}>{Object.values(pp.colors).map(function(c,i){return <div key={i} style={{width:14,height:14,borderRadius:"50%",background:c}}/>;})}</div><div style={{fontSize:11,fontWeight:700,color:pp.colors.primary}}>{pp.label}</div></button>;})}
      </div>
    </Card>
    <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:20}}>
      <Card title="Couleurs interface" T={T}>
        {uiColors.map(function(row){return <div key={row[1]} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid "+T.border}}><div style={{fontSize:13,fontWeight:600}}>{row[0]}</div><div style={{width:32,height:32,borderRadius:8,background:T[row[1]]||"#000",border:"2px solid "+T.border}}/></div>;})}
      </Card>
      <Card title="Informations entreprise" T={T}>
        {companyFields.map(function(row){return <div key={row[1]} style={{padding:"10px 0",borderBottom:"1px solid "+T.border}}><label style={{fontSize:11,color:T.muted,display:"block",marginBottom:4}}>{row[0]}</label><input value={T[row[1]]||""} onChange={function(e){upT(row[1],e.target.value);}} style={{width:"100%",background:T.mid,border:"1px solid "+T.border,borderRadius:8,padding:"8px 12px",color:T.white,fontSize:14,outline:"none",boxSizing:"border-box"}}/></div>;})}
      </Card>
    </div>
    <div style={{display:"flex",justifyContent:"flex-end"}}><button onClick={resetT} style={{background:T.danger+"22",color:T.danger,border:"1px solid "+T.danger+"44",borderRadius:8,padding:"10px 20px",fontWeight:700,cursor:"pointer"}}>Reinitialiser</button></div>
  </div>;
}
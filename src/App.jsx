import React, { useState, useEffect, useRef, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

const SUPA_URL = "https://mbkwpaxissvvjhewkggl.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ia3dwYXhpc3N2dmpoZXdrZ2dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MjQzOTMsImV4cCI6MjA4NzAwMDM5M30.Zo9aJVDByO8aVSADfSCc2m4jCI1qeXuWYQgVRT-a3LA";
const HDR = { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: "Bearer " + SUPA_KEY };
const REST = SUPA_URL + "/rest/v1";
const AI_URL = "/api/claude";
const AI_MODEL = "claude-sonnet-4-20250514";

function q(table){
  var _f=[],_s="*",_o=null;
  var api={
    select:function(s){_s=s;return api;},
    order:function(c,o){_o="order="+c+(o&&o.ascending===false?".desc":".asc");return api;},
    eq:function(c,v){_f.push(c+"=eq."+encodeURIComponent(v));return api;},
    get:function(){var u=REST+"/"+table+"?select="+_s;if(_f.length)u+="&"+_f.join("&");if(_o)u+="&"+_o;return fetch(u,{headers:HDR}).then(function(r){return r.json().then(function(d){return r.ok?{data:d,error:null}:{data:null,error:d};});});},
    insert:function(p){return fetch(REST+"/"+table,{method:"POST",headers:Object.assign({},HDR,{Prefer:"return=representation"}),body:JSON.stringify(p)}).then(function(r){return r.json().then(function(d){return r.ok?{data:Array.isArray(d)?d[0]:d,error:null}:{data:null,error:d};});});},
    update:function(p){var u=REST+"/"+table+(_f.length?"?"+_f.join("&"):"");return fetch(u,{method:"PATCH",headers:Object.assign({},HDR,{Prefer:"return=representation"}),body:JSON.stringify(p)}).then(function(r){return r.json().then(function(d){return r.ok?{data:d,error:null}:{data:null,error:d};});});},
    del:function(){var u=REST+"/"+table+(_f.length?"?"+_f.join("&"):"");return fetch(u,{method:"DELETE",headers:HDR}).then(function(r){return r.ok?{error:null}:r.json().then(function(d){return{error:d};});});}
  };
  return api;
}

async function aiCall(body,maxRetries){
  maxRetries=maxRetries||4;
  for(var attempt=1;attempt<=maxRetries;attempt++){
    try{
      var r=await fetch(AI_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      if(r.ok)return r.json();
      var et=await r.text();
      if((r.status===529||r.status===503||r.status===500)&&attempt<maxRetries){await new Promise(function(res){setTimeout(res,attempt*4000);});}
      else throw new Error("API "+r.status+": "+et.slice(0,150));
    }catch(e){
      if(attempt<maxRetries&&(e.message.indexOf("fetch")>=0||e.message.indexOf("network")>=0)){await new Promise(function(res){setTimeout(res,attempt*3000);});}
      else throw e;
    }
  }
  throw new Error("Echec apres "+maxRetries+" tentatives");
}
async function aiText(messages,maxTok){
  var d=await aiCall({model:AI_MODEL,max_tokens:maxTok||1000,messages:messages});
  return(d.content||[]).map(function(i){return i.text||"";}).join("");
}
function safeParseJSON(txt){
  try{var jm=txt.match(/\{[\s\S]*\}/);if(jm)return JSON.parse(jm[0]);}catch(e){}
  try{
    var jm2=txt.match(/\{[\s\S]*/);if(!jm2)return null;
    var s=jm2[0],opens=0,openb=0,inStr=false,esc=false;
    for(var i=0;i<s.length;i++){
      var c=s[i];
      if(esc){esc=false;continue;}
      if(c==="\\"&&inStr){esc=true;continue;}
      if(c==='"'){inStr=!inStr;continue;}
      if(inStr)continue;
      if(c==='{')opens++;else if(c==='}')opens--;
      else if(c==='[')openb++;else if(c===']')openb--;
    }
    if(inStr)s+='"';
    s=s.replace(/,\s*$/,"");
    for(var j=0;j<openb;j++)s+="]";
    for(var k=0;k<opens;k++)s+="}";
    return JSON.parse(s);
  }catch(e){return null;}
}

const DT={primary:"#F97316",secondary:"#3B82F6",success:"#22C55E",danger:"#EF4444",warning:"#EAB308",bg:"#1C1917",card:"#292524",mid:"#44403C",border:"#57534E",white:"#FAFAF9",muted:"#A8A29E",sidebarWidth:220,borderRadius:12,fontFamily:"'Segoe UI',system-ui,sans-serif",companyName:"JEAN BTP SARL",companyAddress:"Zone Industrielle, Abidjan",companyTel:"+225 27 00 00 00",companyEmail:"devis@jeanbtp.ci",companySiret:"CI-ABJ-2024-B-12345"};
var CATS=["Main d'oeuvre","Materiaux","Equipement","Transport","Sous-traitance","Divers"];
var UNITES=["U","m2","ml","m3","kg","t","forfait","h","j","ens."];
var STATUTS_CH=["Brouillon","Planifie","En cours","En derive","En reception","Cloture"];
var TYPES_INT=["Urgence","Preventive","Corrective","Inspection"];
var VOIES=["Appel téléphonique","SMS","Email","WhatsApp","Visite directe","Courrier","Radio","Application","Autre"];
var MOIS=["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

function fmt(n){return new Intl.NumberFormat("fr-FR",{maximumFractionDigits:0}).format(n||0)+" XOF";}
function fmtS(n){var a=Math.abs(n||0);if(a>=1e6)return((n||0)/1e6).toFixed(1)+"M";if(a>=1e3)return Math.round((n||0)/1e3)+"k";return String(Math.round(n||0));}
function pct(v,t){return t>0?Math.round(v/t*100):0;}
function today(){return new Date().toISOString().slice(0,10);}
function stC(s,T){var m={"En cours":T.secondary,"En derive":T.danger,"Cloture":T.success,"Planifie":T.warning,"En reception":T.primary,"Brouillon":T.muted};return m[s]||T.muted;}
function catC(c,T){var m={"Main d'oeuvre":T.secondary,"Materiaux":T.primary,"Equipement":T.warning,"Transport":T.success,"Sous-traitance":"#A855F7","Divers":T.muted};return m[c]||T.muted;}
function totalDep(c){return(c.depenses||[]).reduce(function(a,d){return a+Number(d.montant||0);},0);}
function totalDepIntv(i){return(i.depenses||[]).reduce(function(a,d){return a+Number(d.montant||0);},0);}
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
function exportChantierCSV(c){
  var rows=(c.depenses||[]).map(function(d){return{Date:d.date,Libelle:d.libelle,Categorie:d.categorie,Montant:d.montant,Note:d.note||""};});
  if(!rows.length){alert("Aucune depense.");return;}exportCSV(rows,c.nom.replace(/\s/g,"_")+"_depenses.csv");
}
function exportChantierHTML(c,T){
  var dep=c.depenses||[],totalD=totalDep(c);
  var rows=dep.map(function(d,i){var bg=i%2===0?"#fff":"#f9f9f9";return "<tr style='background:"+bg+"'><td>"+(d.date||"")+"</td><td>"+d.libelle+"</td><td>"+d.categorie+"</td><td style='text-align:right'>"+fmt(d.montant)+"</td><td>"+(d.note||"")+"</td></tr>";}).join("");
  var style="body{font-family:sans-serif;margin:2cm;font-size:10pt}h1{color:"+T.primary+"}table{width:100%;border-collapse:collapse}th{background:"+T.primary+";color:#fff;padding:8px;text-align:left}td{padding:7px 10px;border-bottom:1px solid #eee}.tot{background:"+T.primary+";color:#fff;font-weight:800}";
  var html="<!DOCTYPE html><html><head><meta charset='utf-8'><title>"+c.nom+"</title><style>"+style+"</style></head><body><h1>"+c.nom+"</h1><table><thead><tr><th>Date</th><th>Libelle</th><th>Categorie</th><th>Montant</th><th>Note</th></tr></thead><tbody>"+rows+"<tr class='tot'><td colspan='3'>TOTAL</td><td>"+fmt(totalD)+"</td><td></td></tr></tbody></table></body></html>";
  var w=window.open("","_blank");w.document.write(html);w.document.close();setTimeout(function(){w.focus();w.print();},500);
}
function exportDebourseHTML(sess,taches,cfg,chNom,T){
  var rows=taches.map(function(t,i){var c=calcTache(t,cfg.tc,cfg);var bg=i%2===0?"#fff":"#f9f9f9";return "<tr style='background:"+bg+"'><td>"+(i+1)+"</td><td>"+t.libelle+"</td><td style='text-align:center'>"+t.quantite+"</td><td style='text-align:center'>"+t.unite+"</td><td style='text-align:right'>"+fmt(Math.round(c.ds))+"</td><td style='text-align:right'>"+fmt(Math.round(c.pr))+"</td><td style='text-align:right;font-weight:700;color:"+T.primary+"'>"+fmt(Math.round(c.pvt))+"</td></tr>";}).join("");
  var tot=taches.reduce(function(acc,t){var c=calcTache(t,cfg.tc,cfg);return{ds:acc.ds+c.ds*(t.quantite||0),pr:acc.pr+c.pr*(t.quantite||0),pvt:acc.pvt+c.pvt};},{ds:0,pr:0,pvt:0});
  var style="body{font-family:sans-serif;margin:2cm;font-size:10pt}h1{color:"+T.primary+"}table{width:100%;border-collapse:collapse;margin-bottom:20px}th{background:"+T.primary+";color:#fff;padding:8px;text-align:left}td{padding:7px 10px;border-bottom:1px solid #eee}.tot{background:"+T.primary+";color:#fff;font-weight:800}";
  var html="<!DOCTYPE html><html><head><meta charset='utf-8'><title>Debours - "+sess.nom+"</title><style>"+style+"</style></head><body><h1>Debours Sec - "+sess.nom+"</h1><p>Chantier: <b>"+(chNom||"--")+"</b> | Charges: <b>"+cfg.tc+"%</b> | FG: <b>"+cfg.fg+"%</b> | Benefice: <b>"+cfg.benef+"%</b></p><table><thead><tr><th>#</th><th>Designation</th><th>Qte</th><th>Unite</th><th>Debours sec</th><th>Prix revient</th><th>PV total</th></tr></thead><tbody>"+rows+"<tr class='tot'><td colspan='4'>TOTAL</td><td>"+fmt(Math.round(tot.ds))+"</td><td>"+fmt(Math.round(tot.pr))+"</td><td>"+fmt(Math.round(tot.pvt))+"</td></tr></tbody></table></body></html>";
  var w=window.open("","_blank");w.document.write(html);w.document.close();setTimeout(function(){w.focus();w.print();},500);
}
function exportIntvCSV(data,label){
  if(!data.length){alert("Aucune intervention.");return;}
  exportCSV(data.map(function(i){
    var cout=totalDepIntv(i);
    var facture=parseFloat(i.montant_facture||0);
    var benef=facture>0?facture-cout:null;
    return{Titre:i.titre,Type:i.type,Statut:i.statut,Client:i.client||"",VoieReception:i.voie_reception||"",Intervenant:i.intervenant||"",Chantier:i.chantier||"",Date:i.date_creation||"",Description:i.description||"",CoutTotal:cout,MontantFacture:facture||"",Benefice:benef!==null?benef:"",Facturee:i.facturee?"Oui":"Non"};
  }), "interventions_"+label.replace(/\s/g,"_")+".csv");
}
function exportIntvHTML(data,label,T){
  if(!data.length){alert("Aucune intervention.");return;}
  var TC={Urgence:T.danger,Preventive:T.secondary,Corrective:T.primary,Inspection:"#A855F7"};
  var VOIE_ICO={"Appel téléphonique":"📞","SMS":"💬","Email":"📧","WhatsApp":"📱","Visite directe":"🚶","Courrier":"✉️","Radio":"📻","Application":"📲","Autre":"🔔"};
  var rows=data.map(function(i,idx){
    var bg=idx%2===0?"#fff":"#f9f9f9";
    var col=TC[i.type]||T.primary;
    var cout=totalDepIntv(i);
    var facture=parseFloat(i.montant_facture||0);
    var benef=facture>0?facture-cout:null;
    return "<tr style='background:"+bg+"'><td>"+i.titre+"</td><td style='color:"+col+";font-weight:700'>"+i.type+"</td><td>"+(i.client||"-")+"</td><td>"+(VOIE_ICO[i.voie_reception]||"")+" "+(i.voie_reception||"-")+"</td><td>"+(i.intervenant||"-")+"</td><td>"+(i.chantier||"-")+"</td><td>"+(i.date_creation||"-")+"</td><td style='text-align:right'>"+fmt(cout)+"</td><td style='text-align:right;color:"+(facture>0?"#16a34a":"#999")+"'>"+( facture>0?fmt(facture):"-")+"</td><td style='text-align:right;color:"+(benef!==null&&benef>=0?"#16a34a":"#dc2626")+"'>"+(benef!==null?fmt(benef):"-")+"</td><td>"+(i.facturee?"✅":"❌")+"</td></tr>";
  }).join("");
  var style="body{font-family:sans-serif;margin:2cm;font-size:9pt}h1{color:"+T.primary+"}table{width:100%;border-collapse:collapse}th{background:"+T.primary+";color:#fff;padding:7px;text-align:left;font-size:9pt}td{padding:6px 8px;border-bottom:1px solid #eee;font-size:9pt}";
  var html="<!DOCTYPE html><html><head><meta charset='utf-8'><title>Interventions - "+label+"</title><style>"+style+"</style></head><body><h1>Interventions — "+label+"</h1><table><thead><tr><th>Titre</th><th>Type</th><th>Client</th><th>Voie réception</th><th>Intervenant</th><th>Chantier</th><th>Date</th><th>Coût</th><th>Facturé</th><th>Bénéfice</th><th>Facturée</th></tr></thead><tbody>"+rows+"</tbody></table></body></html>";
  var w=window.open("","_blank");w.document.write(html);w.document.close();setTimeout(function(){w.focus();w.print();},500);
}

function useTheme(){
  var _ref=useState(DT),T=_ref[0],setT=_ref[1];
  function upT(k,v){setT(function(p){var n=Object.assign({},p);n[k]=v;return n;});}
  function resetT(){setT(DT);}
  return{T:T,upT:upT,resetT:resetT};
}
function useBP(){
  var _ref=useState(function(){var w=window.innerWidth;return w<480?"xs":w<768?"sm":w<1024?"md":"lg";}),bp=_ref[0],setBp=_ref[1];
  useEffect(function(){function fn(){var w=window.innerWidth;setBp(w<480?"xs":w<768?"sm":w<1024?"md":"lg");}window.addEventListener("resize",fn);return function(){window.removeEventListener("resize",fn);};},[]);
  return{bp:bp,isMobile:bp==="xs"||bp==="sm"};
}
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
    Promise.all([q("interventions").order("created_at",{ascending:false}).get(),q("intervention_depenses").order("date",{ascending:false}).get()])
      .then(function(res){
        var intv=res[0].data||[],idep=res[1].data||[];
        setData(intv.map(function(i){return Object.assign({},i,{depenses:idep.filter(function(d){return String(d.intervention_id)===String(i.id);}).map(function(d){return Object.assign({},d,{montant:Number(d.montant||0)});})});}));
        setLoading(false);
      }).catch(function(e){console.error(e);setLoading(false);});
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

// ── UI ATOMS ──────────────────────────────────────────────────────────────────
function Badge(p){return <span style={{background:p.color+"22",color:p.color,border:"1px solid "+p.color+"55",borderRadius:6,padding:p.small?"2px 7px":"3px 10px",fontSize:p.small?10:11,fontWeight:600,whiteSpace:"nowrap"}}>{p.label}</span>;}
function PBar(p){return <div style={{background:"#57534E",borderRadius:99,height:p.h||8,overflow:"hidden"}}><div style={{width:Math.min(p.p,100)+"%",background:p.color,height:"100%",borderRadius:99,transition:"width .4s"}}/></div>;}
function Empty(p){return <div style={{textAlign:"center",padding:"40px 20px",color:"#A8A29E"}}><div style={{fontSize:40,marginBottom:12}}>{p.icon}</div><div style={{fontSize:14}}>{p.msg}</div></div>;}
function Spin(){return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:120,flexDirection:"column",gap:12}}><div style={{width:32,height:32,border:"4px solid #57534E",borderTopColor:"#F97316",borderRadius:"50%",animation:"spin 1s linear infinite"}}/><style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style></div>;}
function Kpi(p){return <div style={{background:p.T.card,border:"1px solid "+p.T.border,borderRadius:p.compact?10:p.T.borderRadius,padding:p.compact?"12px 14px":"16px 20px",flex:1,minWidth:0}}><div style={{fontSize:p.compact?16:22,marginBottom:3}}>{p.icon}</div><div style={{fontSize:p.compact?14:20,fontWeight:700,color:p.color||p.T.white,lineHeight:1.2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.value}</div><div style={{fontSize:p.compact?10:12,color:p.T.muted,marginTop:2}}>{p.label}</div></div>;}
function Card(p){return <div style={{background:p.T.card,border:"1px solid "+p.T.border,borderRadius:p.T.borderRadius,padding:"18px 20px"}}>{p.title&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}><div style={{fontWeight:700,fontSize:14}}>{p.title}</div>{p.action}</div>}{p.children}</div>;}
function Modal(p){return <div style={{position:"fixed",inset:0,background:"#00000099",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}}><div style={{background:p.T.card,border:"1px solid "+p.T.border,borderRadius:"20px 20px 0 0",padding:"24px 20px",width:"100%",maxWidth:960,maxHeight:"96vh",overflow:"auto"}}><div style={{width:40,height:4,background:p.T.border,borderRadius:99,margin:"0 auto 20px"}}/><div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}><div style={{fontWeight:800,fontSize:16}}>{p.title}</div><button onClick={p.onClose} style={{background:"none",border:"none",color:p.T.muted,cursor:"pointer",fontSize:22}}>✕</button></div>{p.children}{p.onSave&&<div style={{display:"flex",gap:10,marginTop:20,justifyContent:"flex-end"}}><button onClick={p.onClose} style={{padding:"10px 20px",background:p.T.mid,color:p.T.white,border:"none",borderRadius:10,cursor:"pointer"}}>Annuler</button><button onClick={p.onSave} style={{padding:"10px 20px",background:p.T.primary,color:"#fff",border:"none",borderRadius:10,fontWeight:700,cursor:"pointer"}}>{p.saveLabel||"Enregistrer"}</button></div>}</div></div>;}
function FF(p){var s={width:"100%",background:p.T.mid,border:"1px solid "+p.T.border,borderRadius:8,padding:"10px 12px",color:p.T.white,fontSize:14,boxSizing:"border-box",outline:"none"};return <div style={p.full?{gridColumn:"1/-1"}:{}}><label style={{fontSize:11,color:p.T.muted,display:"block",marginBottom:4}}>{p.label}</label>{p.rows?<textarea value={p.value||""} onChange={function(e){p.onChange(e.target.value);}} rows={p.rows} style={s}/>:<input type={p.type||"text"} value={p.value||""} onChange={function(e){p.onChange(e.target.value);}} placeholder={p.placeholder} style={s}/>}</div>;}
function FS(p){return <div style={p.full?{gridColumn:"1/-1"}:{}}><label style={{fontSize:11,color:p.T.muted,display:"block",marginBottom:4}}>{p.label}</label><select value={p.value||""} onChange={function(e){p.onChange(e.target.value);}} style={{width:"100%",background:p.T.mid,border:"1px solid "+p.T.border,borderRadius:8,padding:"10px 12px",color:p.T.white,fontSize:14,boxSizing:"border-box",outline:"none"}}>{p.options.map(function(o){return Array.isArray(o)?<option key={o[0]} value={o[0]}>{o[1]}</option>:<option key={o} value={o}>{o}</option>;})}</select></div>;}
function FG(p){return <div style={{display:"grid",gridTemplateColumns:"repeat("+(p.cols||2)+",1fr)",gap:12}}>{p.children}</div>;}

// Icône voie réception
var VOIE_ICO={"Appel téléphonique":"📞","SMS":"💬","Email":"📧","WhatsApp":"📱","Visite directe":"🚶","Courrier":"✉️","Radio":"📻","Application":"📲","Autre":"🔔"};
var VOIE_COL={"Appel téléphonique":"#22C55E","SMS":"#3B82F6","Email":"#F97316","WhatsApp":"#22C55E","Visite directe":"#A855F7","Courrier":"#EAB308","Radio":"#EF4444","Application":"#0891B2","Autre":"#A8A29E"};

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
      {isMobile&&drawerOpen&&<><div onClick={function(){setDrawerOpen(false);}} style={{position:"fixed",inset:0,background:"#0007",zIndex:150}}/><div style={{position:"fixed",left:0,top:0,bottom:0,width:280,background:T.card,borderRight:"1px solid "+T.border,zIndex:151,padding:"50px 12px 12px",overflowY:"auto"}}><button onClick={function(){setDrawerOpen(false);}} style={{position:"absolute",top:16,right:16,background:"none",border:"none",color:T.muted,fontSize:22,cursor:"pointer"}}>✕</button><div style={{padding:"0 8px 16px",marginBottom:8,borderBottom:"1px solid "+T.border}}><div style={{fontWeight:700,fontSize:16}}>{T.companyName}</div></div>{nav.map(function(n){return <NavBtn key={n.key} n={n}/>;})}</div></>}
    </div>
  );
}

function Dashboard(p){
  var ch=p.ch,intv=p.intv,openCh=p.openCh,T=p.T,isMobile=useBP().isMobile;
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
      <Kpi icon="🔧" label="Interv. actives" value={intv.filter(function(i){return i.statut==="En cours";}).length} color={T.secondary} compact={isMobile} T={T}/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:16}}>
      <Card title="Statuts chantiers" T={T}>{pieData.length>0?<ResponsiveContainer width="100%" height={180}><PieChart><Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={65} label={function(e){return e.name+" ("+e.value+")"}}>{pieData.map(function(d,i){return <Cell key={i} fill={d.color}/>;})}</Pie><Tooltip contentStyle={{background:T.card,border:"1px solid "+T.border,color:T.white}}/></PieChart></ResponsiveContainer>:<Empty msg="Aucun chantier" icon="🏗️"/>}</Card>
      <Card title="Chantiers actifs" T={T}>{actifs.slice(0,6).map(function(c){var d=totalDep(c),p2=pct(d,c.budgetInitial);return <div key={c.id} onClick={function(){openCh(c.id);}} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:"1px solid "+T.border,cursor:"pointer"}}><div style={{flex:2}}><div style={{fontWeight:600,fontSize:13}}>{c.nom}</div><div style={{fontSize:11,color:T.muted}}>{c.client}</div></div><div style={{flex:1}}><PBar p={p2} color={p2>100?T.danger:p2>80?T.warning:T.success} h={6}/><div style={{fontSize:10,color:T.muted,textAlign:"right",marginTop:2}}>{p2}%</div></div></div>;})} {actifs.length===0&&<Empty msg="Aucun chantier actif" icon="🏗️"/>}</Card>
    </div>
  </div>;
}

function Chantiers(p){
  var ch=p.ch,openCh=p.openCh,reload=p.reload,T=p.T,isMobile=useBP().isMobile;
  var _f=useState("Tous"),filter=_f[0],setFilter=_f[1];
  var _n=useState(false),showNew=_n[0],setShowNew=_n[1];
  var _sv=useState(false),saving=_sv[0],setSaving=_sv[1];
  var _fm=useState({nom:"",client:"",localisation:"",type:"Construction",budget_initial:"",date_debut:"",date_fin:""}),form=_fm[0],setForm=_fm[1];
  function up(k,v){setForm(function(p2){var n=Object.assign({},p2);n[k]=v;return n;});}
  function save(){if(!form.nom||!form.budget_initial)return;setSaving(true);q("chantiers").insert({nom:form.nom,client:form.client,localisation:form.localisation,type:form.type,budget_initial:parseFloat(form.budget_initial),date_debut:form.date_debut||null,date_fin:form.date_fin||null,statut:"Brouillon",alertes:[],score:100,lat:5.35,lng:-4.0}).then(function(){setSaving(false);setShowNew(false);reload();});}
  function del(id){if(!window.confirm("Supprimer ?"))return;q("chantiers").eq("id",id).del().then(function(){reload();});}
  var filtered=filter==="Tous"?ch:ch.filter(function(c){return c.statut===filter;});
  return <div style={{display:"flex",flexDirection:"column",gap:16}}>
    <div style={{display:"flex",gap:6,justifyContent:"space-between",flexWrap:"wrap",alignItems:"center"}}>
      <div style={{display:"flex",gap:4,overflowX:"auto"}}>{["Tous"].concat(STATUTS_CH).map(function(s){return <button key={s} onClick={function(){setFilter(s);}} style={{padding:"6px 12px",borderRadius:20,border:"1px solid "+(filter===s?T.primary:T.border),background:filter===s?T.primary:"transparent",color:filter===s?"#fff":T.muted,cursor:"pointer",fontSize:12,fontWeight:filter===s?700:400,whiteSpace:"nowrap",flexShrink:0}}>{s}</button>;})}</div>
      <button onClick={function(){setShowNew(true);}} style={{background:T.primary,color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontWeight:700,cursor:"pointer",fontSize:13}}>+ Nouveau</button>
    </div>
    <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(300px,1fr))",gap:14}}>
      {filtered.map(function(c){var d=totalDep(c),pp=pct(d,c.budgetInitial);return <div key={c.id} onClick={function(){openCh(c.id);}} style={{background:T.card,border:"1px solid "+(pp>100?T.danger+"66":T.border),borderRadius:T.borderRadius,padding:16,cursor:"pointer",position:"relative"}}><button onClick={function(e){e.stopPropagation();del(c.id);}} style={{position:"absolute",top:12,right:12,background:T.danger+"22",border:"1px solid "+T.danger+"44",color:T.danger,borderRadius:6,padding:"3px 10px",fontSize:11,cursor:"pointer"}}>✕</button><div style={{marginBottom:10,paddingRight:60}}><div style={{fontWeight:700,fontSize:15}}>{c.nom}</div><div style={{fontSize:12,color:T.muted}}>{c.client} - {c.localisation}</div></div><div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}><Badge label={c.statut} color={stC(c.statut,T)}/><Badge label={c.type} color={T.primary} small/></div><div style={{marginBottom:4}}><div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}><span style={{color:T.muted}}>Budget consomme</span><span style={{fontWeight:700,color:pp>100?T.danger:pp>80?T.warning:T.success}}>{pp}%</span></div><PBar p={pp} color={pp>100?T.danger:pp>80?T.warning:T.success}/></div><div style={{marginTop:8,paddingTop:8,borderTop:"1px solid "+T.border,fontSize:12,color:T.muted}}>{fmtS(d)} / {fmtS(c.budgetInitial)} XOF</div></div>;})}
    </div>
    {filtered.length===0&&<Empty msg="Aucun chantier" icon="🏗️"/>}
    {showNew&&<Modal title="Nouveau chantier" onClose={function(){setShowNew(false);}} onSave={save} T={T}>{saving?<Spin/>:<FG cols={2}><FF label="Nom *" value={form.nom} onChange={function(v){up("nom",v);}} full T={T}/><FF label="Client" value={form.client} onChange={function(v){up("client",v);}} T={T}/><FS label="Type" value={form.type} onChange={function(v){up("type",v);}} options={["Construction","Rehabilitation","Maintenance","VRD","Genie Civil"]} T={T}/><FF label="Localisation" value={form.localisation} onChange={function(v){up("localisation",v);}} T={T}/><FF label="Budget (XOF) *" type="number" value={form.budget_initial} onChange={function(v){up("budget_initial",v);}} full T={T}/><FF label="Date debut" type="date" value={form.date_debut} onChange={function(v){up("date_debut",v);}} T={T}/><FF label="Date fin prevue" type="date" value={form.date_fin} onChange={function(v){up("date_fin",v);}} T={T}/></FG>}</Modal>}
  </div>;
}

function Fiche(p){
  var c=p.chantier,setPage=p.setPage,reload=p.reload,T=p.T,isMobile=useBP().isMobile;
  var _t=useState("infos"),tab=_t[0],setTab=_t[1];
  var _sd=useState(false),showDep=_sd[0],setShowDep=_sd[1];
  var _fd=useState({libelle:"",categorie:"Main d'oeuvre",montant:"",date:today(),note:""}),fDep=_fd[0],setFDep=_fd[1];
  var _fc=useState("Toutes"),fCat=_fc[0],setFCat=_fc[1];
  var _sv=useState(false),saving=_sv[0],setSaving=_sv[1];
  var dep=totalDep(c),dp=pct(dep,c.budgetInitial);
  var filtered=fCat==="Toutes"?c.depenses:c.depenses.filter(function(d){return d.categorie===fCat;});
  function changeSt(st){q("chantiers").eq("id",c.id).update({statut:st}).then(function(){reload();});}
  function addDep(){if(!fDep.libelle||!fDep.montant)return;setSaving(true);q("depenses").insert({chantier_id:c.id,libelle:fDep.libelle,categorie:fDep.categorie,montant:parseFloat(fDep.montant),date:fDep.date,note:fDep.note}).then(function(){setSaving(false);setShowDep(false);reload();});}
  function delDep(id){q("depenses").eq("id",id).del().then(function(){reload();});}
  var depCatData=CATS.map(function(cat){return{cat:cat.split(" ")[0],total:c.depenses.filter(function(d){return d.categorie===cat;}).reduce(function(a,d){return a+d.montant;},0)};}).filter(function(x){return x.total>0;});
  return <div style={{display:"flex",flexDirection:"column",gap:0}}>
    <button onClick={function(){setPage("chantiers");}} style={{background:"none",border:"none",color:T.primary,cursor:"pointer",fontSize:13,marginBottom:12,textAlign:"left",padding:0}}>← Retour</button>
    <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:T.borderRadius,padding:isMobile?16:20,marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:10,marginBottom:12,flexWrap:"wrap"}}><div style={{flex:1}}><div style={{fontSize:isMobile?18:22,fontWeight:800}}>{c.nom}</div><div style={{color:T.muted,fontSize:12,marginTop:4}}>{c.client} - {c.localisation}</div></div><div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{STATUTS_CH.map(function(st){return <button key={st} onClick={function(){changeSt(st);}} style={{padding:"5px 10px",borderRadius:20,border:"1px solid "+(c.statut===st?stC(st,T):T.border),background:c.statut===st?stC(st,T)+"22":"transparent",color:c.statut===st?stC(st,T):T.muted,cursor:"pointer",fontSize:10,fontWeight:c.statut===st?700:400}}>{st}</button>;})}</div></div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}><Badge label={c.statut} color={stC(c.statut,T)}/><Badge label={c.type} color={T.primary} small/><div style={{marginLeft:"auto",display:"flex",gap:6}}><button onClick={function(){exportChantierCSV(c);}} style={{background:T.success+"22",color:T.success,border:"1px solid "+T.success+"44",borderRadius:8,padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>CSV</button><button onClick={function(){exportChantierHTML(c,T);}} style={{background:T.primary+"22",color:T.primary,border:"1px solid "+T.primary+"44",borderRadius:8,padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>PDF</button></div></div>
    </div>
    <div style={{display:"flex",gap:4,marginBottom:16,overflowX:"auto"}}>{[["infos","Infos"],["budget","Budget"],["depenses","Depenses ("+c.depenses.length+")"],["graphiques","Graphiques"]].map(function(o){return <button key={o[0]} onClick={function(){setTab(o[0]);}} style={{padding:"8px 14px",borderRadius:8,border:"1px solid "+(tab===o[0]?T.primary:T.border),background:tab===o[0]?T.primary:T.card,color:tab===o[0]?"#fff":T.muted,cursor:"pointer",fontSize:12,fontWeight:tab===o[0]?700:400,whiteSpace:"nowrap",flexShrink:0}}>{o[1]}</button>;})}  </div>
    {tab==="infos"&&<div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14}}><Card title="Informations" T={T}>{[["Nom",c.nom],["Client",c.client],["Localisation",c.localisation],["Type",c.type],["Statut",c.statut],["Debut",c.date_debut||"-"],["Fin prevue",c.date_fin||"-"]].map(function(row){return <div key={row[0]} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid "+T.border,fontSize:13,gap:8}}><span style={{color:T.muted}}>{row[0]}</span><span style={{fontWeight:600}}>{row[1]}</span></div>;})}</Card><Card title="Synthese" T={T}><div style={{marginBottom:14}}><div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:6}}><span style={{color:T.muted}}>Avancement budget</span><strong style={{color:dp>100?T.danger:dp>80?T.warning:T.success}}>{dp}%</strong></div><PBar p={dp} color={dp>100?T.danger:dp>80?T.warning:T.success} h={14}/></div>{[["Budget initial",fmt(c.budgetInitial),T.white],["Depenses",fmt(dep),T.warning],["Marge",fmt(c.budgetInitial-dep),c.budgetInitial-dep>=0?T.success:T.danger]].map(function(row){return <div key={row[0]} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid "+T.border,fontSize:13}}><span style={{color:T.muted}}>{row[0]}</span><span style={{fontWeight:700,color:row[2]}}>{row[1]}</span></div>;})}</Card></div>}
    {tab==="budget"&&<div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:10}}><Kpi icon="💰" label="Budget" value={fmtS(c.budgetInitial)} compact T={T}/><Kpi icon="🧾" label="Depenses" value={fmtS(dep)} color={T.warning} compact T={T}/><Kpi icon="💵" label="Marge" value={fmtS(c.budgetInitial-dep)} color={c.budgetInitial-dep>=0?T.success:T.danger} compact T={T}/><Kpi icon="📊" label="Consomme" value={dp+"%"} color={dp>100?T.danger:dp>80?T.warning:T.success} compact T={T}/></div>}
    {tab==="depenses"&&<div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",gap:6,justifyContent:"space-between",flexWrap:"wrap"}}><div style={{display:"flex",gap:4,overflowX:"auto"}}>{["Toutes"].concat(CATS).map(function(cat){return <button key={cat} onClick={function(){setFCat(cat);}} style={{padding:"5px 10px",borderRadius:20,border:"1px solid "+(fCat===cat?T.primary:T.border),background:fCat===cat?T.primary:"transparent",color:fCat===cat?"#fff":T.muted,cursor:"pointer",fontSize:10,whiteSpace:"nowrap",flexShrink:0}}>{cat}</button>;})}</div><button onClick={function(){setShowDep(true);}} style={{background:T.primary,color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontWeight:700,cursor:"pointer",fontSize:13}}>+ Depense</button></div>
      {filtered.length===0&&<Empty msg="Aucune depense" icon="🧾"/>}
      {filtered.map(function(d){return <div key={d.id} style={{background:T.card,border:"1px solid "+T.border,borderRadius:10,padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}><div style={{flex:1}}><div style={{fontWeight:700,fontSize:13}}>{d.libelle}</div><div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:4}}><Badge label={d.categorie} color={catC(d.categorie,T)} small/><span style={{fontSize:10,color:T.muted}}>{d.date}</span></div></div><div style={{display:"flex",gap:6,alignItems:"center"}}><span style={{fontWeight:800,color:T.primary,fontSize:14}}>{fmt(d.montant)}</span><button onClick={function(){delDep(d.id);}} style={{background:T.danger+"22",border:"1px solid "+T.danger+"44",color:T.danger,borderRadius:6,padding:"4px 8px",fontSize:11,cursor:"pointer"}}>✕</button></div></div>;})}
      {showDep&&<Modal title="Nouvelle depense" onClose={function(){setShowDep(false);}} onSave={addDep} T={T}>{saving?<Spin/>:<FG cols={2}><FF label="Libelle *" value={fDep.libelle} onChange={function(v){setFDep(function(pp){var n=Object.assign({},pp);n.libelle=v;return n;});}} full T={T}/><FS label="Categorie" value={fDep.categorie} onChange={function(v){setFDep(function(pp){var n=Object.assign({},pp);n.categorie=v;return n;});}} options={CATS} T={T}/><FF label="Montant (XOF)" type="number" value={fDep.montant} onChange={function(v){setFDep(function(pp){var n=Object.assign({},pp);n.montant=v;return n;});}} T={T}/><FF label="Date" type="date" value={fDep.date} onChange={function(v){setFDep(function(pp){var n=Object.assign({},pp);n.date=v;return n;});}} T={T}/><FF label="Note" value={fDep.note} onChange={function(v){setFDep(function(pp){var n=Object.assign({},pp);n.note=v;return n;});}} full T={T}/></FG>}</Modal>}
    </div>}
    {tab==="graphiques"&&depCatData.length>0&&<Card title="Repartition des depenses" T={T}><ResponsiveContainer width="100%" height={220}><BarChart data={depCatData} layout="vertical"><XAxis type="number" tick={{fill:T.muted,fontSize:9}} tickFormatter={function(v){return fmtS(v);}}/><YAxis type="category" dataKey="cat" tick={{fill:T.muted,fontSize:10}} width={70}/><Tooltip contentStyle={{background:T.card,border:"1px solid "+T.border,color:T.white}} formatter={function(v){return fmt(v);}}/><Bar dataKey="total" radius={[0,4,4,0]}>{depCatData.map(function(d,i){return <Cell key={i} fill={catC(d.cat,T)}/>;})}</Bar></BarChart></ResponsiveContainer></Card>}
  </div>;
}

// ── DEBOURS ───────────────────────────────────────────────────────────────────
function Debourse(p){
  var sessions=p.sessions,taches=p.taches,ch=p.ch,reload=p.reload,T=p.T,isMobile=useBP().isMobile;
  var _s=useState(null),selSid=_s[0],setSelSid=_s[1];
  var _n=useState(false),showNewS=_n[0],setShowNewS=_n[1];
  var _ia=useState(false),showIA=_ia[0],setShowIA=_ia[1];
  var _ad=useState(false),showAD=_ad[0],setShowAD=_ad[1];
  var _f=useState({nom:"",chantier_id:"",taux_charges:40,coeff_fg:15,coeff_benef:10}),sForm=_f[0],setSForm=_f[1];
  var _sv=useState(false),saving=_sv[0],setSaving=_sv[1];
  var selSess=sessions.find(function(s){return s.id===selSid;});
  var selTaches=selSid?taches.filter(function(t){return t.session_id===selSid;}):[];
  function saveSession(){if(!sForm.nom)return;setSaving(true);q("debourse_sessions").insert({nom:sForm.nom,chantier_id:sForm.chantier_id||null,taux_charges:parseFloat(sForm.taux_charges),coeff_fg:parseFloat(sForm.coeff_fg),coeff_benef:parseFloat(sForm.coeff_benef)}).then(function(r){setSaving(false);setShowNewS(false);reload();if(r.data)setSelSid(r.data.id);});}
  function delSession(id){if(!window.confirm("Supprimer ?"))return;q("debourse_taches").eq("session_id",id).del().then(function(){q("debourse_sessions").eq("id",id).del().then(function(){setSelSid(null);reload();});});}
  function updateCfg(k,v){if(!selSid)return;var u={};u[k]=parseFloat(v)||0;q("debourse_sessions").eq("id",selSid).update(u).then(function(){reload();});}
  return <div style={{display:"flex",flexDirection:"column",gap:16}}>
    <Card title="Sessions de debours" action={<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
      <button onClick={function(){setShowAD(true);}} style={{background:"#A855F722",color:"#A855F7",border:"1px solid #A855F744",borderRadius:8,padding:"6px 12px",fontWeight:700,cursor:"pointer",fontSize:12}}>📂 Analyser doc</button>
      <button onClick={function(){setShowIA(true);}} style={{background:T.secondary+"22",color:T.secondary,border:"1px solid "+T.secondary+"44",borderRadius:8,padding:"6px 12px",fontWeight:700,cursor:"pointer",fontSize:12}}>🤖 IA Ouvrage</button>
      <button onClick={function(){setShowNewS(true);}} style={{background:T.primary,color:"#fff",border:"none",borderRadius:8,padding:"6px 12px",fontWeight:700,cursor:"pointer",fontSize:12}}>+ Nouvelle</button>
    </div>} T={T}>
      {sessions.length===0?<Empty msg="Aucune session" icon="🔢"/>:<div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:4}}>
        {sessions.map(function(s){var sts=taches.filter(function(t){return t.session_id===s.id;});var tot=sts.reduce(function(a,t){return a+(t.prix_vente_total||0);},0);var active=selSid===s.id;return <div key={s.id} onClick={function(){setSelSid(s.id);}} style={{background:active?T.primary+"22":T.mid,border:"2px solid "+(active?T.primary:T.border),borderRadius:10,padding:"12px 16px",cursor:"pointer",minWidth:180,flexShrink:0}}><div style={{fontWeight:700,fontSize:13,color:active?T.primary:T.white}}>{s.nom}</div><div style={{fontSize:11,color:T.muted,marginTop:4}}>{sts.length} tache(s)</div><div style={{fontSize:13,fontWeight:700,color:T.success,marginTop:4}}>{fmtS(tot)} XOF</div><button onClick={function(e){e.stopPropagation();delSession(s.id);}} style={{marginTop:8,background:T.danger+"22",border:"none",color:T.danger,borderRadius:6,padding:"3px 8px",fontSize:10,cursor:"pointer"}}>Supprimer</button></div>;})}
      </div>}
    </Card>
    {selSess&&<SessionDetail sess={selSess} taches={selTaches} reload={reload} T={T} isMobile={isMobile} updateCfg={updateCfg} ch={ch}/>}
    {showNewS&&<Modal title="Nouvelle session" onClose={function(){setShowNewS(false);}} onSave={saveSession} T={T}>{saving?<Spin/>:<FG cols={2}><FF label="Nom *" value={sForm.nom} onChange={function(v){setSForm(function(pp){var n=Object.assign({},pp);n.nom=v;return n;});}} full T={T}/><FS label="Chantier" value={sForm.chantier_id} onChange={function(v){setSForm(function(pp){var n=Object.assign({},pp);n.chantier_id=v;return n;});}} options={[["","- Aucun -"]].concat(ch.map(function(c){return[c.id,c.nom];}))} full T={T}/><FF label="Charges (%)" type="number" value={sForm.taux_charges} onChange={function(v){setSForm(function(pp){var n=Object.assign({},pp);n.taux_charges=v;return n;});}} T={T}/><FF label="FG (%)" type="number" value={sForm.coeff_fg} onChange={function(v){setSForm(function(pp){var n=Object.assign({},pp);n.coeff_fg=v;return n;});}} T={T}/><FF label="Benefice (%)" type="number" value={sForm.coeff_benef} onChange={function(v){setSForm(function(pp){var n=Object.assign({},pp);n.coeff_benef=v;return n;});}} T={T}/></FG>}</Modal>}
    {showIA&&<IAOuvrageModal onClose={function(){setShowIA(false);}} sessions={sessions} reload={reload} T={T}/>}
    {showAD&&<AnalyseDocModal onClose={function(){setShowAD(false);}} sessions={sessions} reload={reload} ch={ch} T={T}/>}
  </div>;
}

function AnalyseDocModal(p){
  var onClose=p.onClose,sessions=p.sessions,reload=p.reload,ch=p.ch,T=p.T;
  var _l=useState(false),loading=_l[0],setLoading=_l[1];
  var _e=useState(null),err=_e[0],setErr=_e[1];
  var _msg=useState(""),msg=_msg[0],setMsg=_msg[1];
  var _postes=useState([]),postes=_postes[0],setPostes=_postes[1];
  var _vals=useState({}),vals=_vals[0],setVals=_vals[1];
  var _imp=useState(false),importing=_imp[0],setImporting=_imp[1];
  var _done=useState(false),done=_done[0],setDone=_done[1];
  var _sess=useState(""),selSess=_sess[0],setSelSess=_sess[1];
  var _snom=useState(""),sessNom=_snom[0],setSessNom=_snom[1];
  var _prog=useState(0),prog=_prog[0],setProg=_prog[1];
  var fileRef=useRef();
  function evalFormule(formule,vars2,valsMap,pi,ei){
    try{var scope={};(vars2||[]).forEach(function(v){scope[v.nom]=parseFloat(valsMap["p"+pi+"_e"+ei+"_"+v.nom])||0;});var fn=new Function(...Object.keys(scope),"return ("+formule+")");var res=fn(...Object.values(scope));return isFinite(res)?Math.round(res*100)/100:0;}catch(e){return 0;}
  }
  function setVal(key,v){setVals(function(pp){var n=Object.assign({},pp);n[key]=v;return n;});}
  async function analyseDoc(file){
    setLoading(true);setErr(null);setPostes([]);setVals({});setDone(false);setProg(0);
    try{
      setMsg("📄 Lecture du document...");
      var texte="";
      var isPDF=file.type==="application/pdf",isImg=file.type.indexOf("image/")===0;
      if(isPDF||isImg){
        var b64=await new Promise(function(res,rej){var r=new FileReader();r.onload=function(e){res(e.target.result.split(",")[1]);};r.onerror=rej;r.readAsDataURL(file);});
        var cb=isPDF?{type:"document",source:{type:"base64",media_type:"application/pdf",data:b64}}:{type:"image",source:{type:"base64",media_type:file.type,data:b64}};
        var d0=await aiCall({model:AI_MODEL,max_tokens:6000,messages:[{role:"user",content:[cb,{type:"text",text:"Extrais TOUT le contenu texte de ce document BTP : postes, sous-postes, quantités, unités, prix unitaires. Retourne le texte brut complet."}]}]});
        texte=(d0.content||[]).map(function(i){return i.text||"";}).join("");
      } else if(file.name.match(/\.(xlsx|xls)$/i)){
        var SheetJS=await import("https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs");
        var buf=await file.arrayBuffer();var wb=SheetJS.read(buf,{type:"array"});var ws=wb.Sheets[wb.SheetNames[0]];texte=SheetJS.utils.sheet_to_csv(ws);
      } else {texte=await file.text();}
      setMsg("🔍 Identification des postes...");
      var prom1="Expert BTP CI. Analyse ce document BTP. JSON:\n{\"postes\":[{\"libelle\":\"str\",\"unite\":\"m3\",\"quantite\":25.5,\"prixDoc\":0}]}\nMax 20. JSON pur.\n"+texte.slice(0,5000);
      var r1=await aiCall({model:AI_MODEL,max_tokens:2000,messages:[{role:"user",content:prom1}]});
      var t1=(r1.content||[]).map(function(i){return i.text||"";}).join("");
      var p1=safeParseJSON(t1);
      if(!p1)throw new Error("Impossible d'identifier les postes");
      var postesBase=p1.postes||[];
      if(!postesBase.length)throw new Error("Aucun poste trouvé");
      var ps=[],iv={};
      for(var pi=0;pi<Math.min(postesBase.length,15);pi++){
        var pb=postesBase[pi];
        setProg(Math.round((pi/Math.min(postesBase.length,15))*100));
        setMsg("🔧 Décomposition "+(pi+1)+"/"+Math.min(postesBase.length,15)+" : "+pb.libelle);
        var prom2="Expert BTP CI. Décompose \""+pb.libelle+"\" | Unité: "+(pb.unite||"U")+" | Qte: "+(pb.quantite||1)+"\nJSON: {\"elements\":[{\"libelle\":\"str\",\"categorie\":\"Materiaux\",\"formule\":\"q*p\",\"description\":\"str\",\"vars\":[{\"nom\":\"q\",\"label\":\"Quantite\",\"valeur\":7,\"unite\":\"sacs\"}]}]}\n3-6 éléments. JSON pur.";
        try{
          var r2=await aiCall({model:AI_MODEL,max_tokens:2500,messages:[{role:"user",content:prom2}]});
          var t2=(r2.content||[]).map(function(i){return i.text||"";}).join("");
          var p2=safeParseJSON(t2);
          var elements=p2?p2.elements||[]:[];
          var poste={libelle:pb.libelle,unite:pb.unite||"U",quantite:pb.quantite||1,prixDoc:pb.prixDoc||0,elements:elements};
          ps.push(poste);
          elements.forEach(function(el,ei){(el.vars||[]).forEach(function(v){iv["p"+pi+"_e"+ei+"_"+v.nom]=v.valeur;});});
        }catch(e){ps.push({libelle:pb.libelle,unite:pb.unite||"U",quantite:pb.quantite||1,elements:[]});}
      }
      setProg(100);setPostes(ps);setVals(iv);setSessNom(file.name.replace(/\.[^.]+$/,"").slice(0,40));setMsg("");
    }catch(e){setErr(e.message);}
    setLoading(false);
  }
  async function genererProjet(){
    if(!sessNom.trim()){alert("Donnez un nom à la session");return;}
    setImporting(true);
    try{
      var cfg={taux_charges:40,coeff_fg:15,coeff_benef:10};
      var rs=await q("debourse_sessions").insert({nom:sessNom,chantier_id:null,taux_charges:cfg.taux_charges,coeff_fg:cfg.coeff_fg,coeff_benef:cfg.coeff_benef});
      if(!rs.data||rs.error)throw new Error("Erreur création session");
      var sid=rs.data.id,ordre=0;
      for(var pi=0;pi<postes.length;pi++){
        var po=postes[pi];var qte=po.quantite||1;
        var totMO=0,totMat=0,totMateriel=0,totST=0;
        (po.elements||[]).forEach(function(el,ei){var res=evalFormule(el.formule,el.vars,vals,pi,ei);var cat=el.categorie||"";if(cat==="MO")totMO+=res;else if(cat==="Materiaux")totMat+=res;else if(cat==="Materiel")totMateriel+=res;else totST+=res;});
        var ds=totMO+totMat+totMateriel+totST,fg=ds*(cfg.coeff_fg/100),pr=ds+fg,pv=pr*(1+cfg.coeff_benef/100);
        await q("debourse_taches").insert({session_id:sid,libelle:po.libelle,unite:po.unite,quantite:qte,salaire:totMO,rendement:1,materiau:totMat,materiel:totMateriel,sous_traitance:totST,main_oeuvre_u:Math.round(totMO),debourse_sec_u:Math.round(ds),prix_revient_u:Math.round(pr),prix_vente_u:Math.round(pv),prix_vente_total:Math.round(pv*qte),ordre:ordre++});
        for(var ei=0;ei<(po.elements||[]).length;ei++){var el=po.elements[ei];var res2=evalFormule(el.formule,el.vars,vals,pi,ei);var isMO=el.categorie==="MO";await q("debourse_taches").insert({session_id:sid,libelle:"  └ "+el.libelle,unite:"U",quantite:qte,salaire:isMO?res2:0,rendement:1,materiau:el.categorie==="Materiaux"?res2:0,materiel:el.categorie==="Materiel"?res2:0,sous_traitance:el.categorie==="Sous-traitance"?res2:0,main_oeuvre_u:isMO?Math.round(res2):0,debourse_sec_u:Math.round(res2),prix_revient_u:Math.round(res2*(1+cfg.coeff_fg/100)),prix_vente_u:Math.round(res2*(1+cfg.coeff_fg/100)*(1+cfg.coeff_benef/100)),prix_vente_total:Math.round(res2*(1+cfg.coeff_fg/100)*(1+cfg.coeff_benef/100)*qte),ordre:ordre++});}
      }
      setDone(true);reload();
    }catch(e){setErr("Erreur import: "+e.message);}
    setImporting(false);
  }
  var catColor={"MO":T.secondary,"Materiaux":T.primary,"Materiel":T.warning,"Transport":T.success,"Sous-traitance":"#A855F7","Divers":T.muted};
  return <Modal title="📂 IA — Analyse Document → Projet Débours Sec" onClose={onClose} T={T}>
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {!postes.length&&<div style={{background:T.mid,borderRadius:12,padding:24,textAlign:"center",border:"2px dashed "+T.border}}><div style={{fontSize:36,marginBottom:8}}>📂</div><div style={{fontWeight:700,fontSize:15,marginBottom:6}}>Importez votre document BTP</div><div style={{fontSize:12,color:T.muted,marginBottom:16}}>DPGF · Bordereau de prix · Devis · Excel · PDF · Image</div><input ref={fileRef} type="file" accept=".xlsx,.xls,.pdf,.csv,.txt,image/*" style={{display:"none"}} onChange={function(e){var f=e.target.files[0];if(f){e.target.value="";analyseDoc(f);}}}/><button onClick={function(){fileRef.current.click();}} disabled={loading} style={{background:T.secondary,color:"#fff",border:"none",borderRadius:10,padding:"12px 28px",fontWeight:700,cursor:loading?"wait":"pointer",fontSize:15}}>{loading?"⏳ Analyse...":"Choisir un document"}</button></div>}
      {loading&&<div style={{display:"flex",flexDirection:"column",gap:8}}><div style={{background:T.secondary+"11",border:"1px solid "+T.secondary+"33",borderRadius:8,padding:"10px 14px",fontSize:13,color:T.secondary,fontWeight:600}}>{msg}</div><div style={{background:T.mid,borderRadius:99,height:8,overflow:"hidden"}}><div style={{width:prog+"%",background:T.secondary,height:"100%",borderRadius:99,transition:"width .3s"}}/></div><div style={{fontSize:11,color:T.muted,textAlign:"right"}}>{prog}%</div></div>}
      {err&&<div style={{background:T.danger+"11",border:"1px solid "+T.danger+"44",borderRadius:8,padding:"10px 14px",color:T.danger,fontSize:12}}>⚠️ {err}</div>}
      {postes.length>0&&!done&&<div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div style={{background:T.success+"11",border:"1px solid "+T.success+"33",borderRadius:10,padding:"12px 16px"}}><div style={{fontWeight:700,color:T.success,fontSize:14}}>✅ {postes.length} postes analysés</div></div>
        <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:10,padding:"12px 16px"}}><FF label="Nom du projet débours à créer" value={sessNom} onChange={setSessNom} placeholder="Ex: DPGF Lot1 Gros Oeuvre" full T={T}/></div>
        {postes.map(function(po,pi){
          var totPoste=0;(po.elements||[]).forEach(function(el,ei){totPoste+=evalFormule(el.formule,el.vars,vals,pi,ei);});
          var pvTotal=totPoste*(1+0.15)*(1+0.10);
          return <div key={pi} style={{background:T.card,border:"1px solid "+T.border,borderRadius:12,overflow:"hidden"}}>
            <div style={{background:T.primary+"22",borderBottom:"1px solid "+T.border,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
              <div><div style={{fontWeight:800,fontSize:14,color:T.primary}}>{po.libelle}</div><div style={{fontSize:11,color:T.muted,marginTop:2}}>Qte: {po.quantite} {po.unite}</div></div>
              <div style={{textAlign:"right"}}><div style={{fontWeight:800,fontSize:15,color:T.warning}}>{fmt(Math.round(totPoste))} → <span style={{color:T.success}}>{fmt(Math.round(pvTotal*(po.quantite||1)))}</span></div></div>
            </div>
            <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:10}}>
              {(po.elements||[]).map(function(el,ei){var result=evalFormule(el.formule,el.vars,vals,pi,ei);var cc=catColor[el.categorie]||T.muted;return <div key={ei} style={{background:T.mid,borderRadius:10,padding:"10px 12px"}}><div style={{display:"flex",justifyContent:"space-between",gap:8,marginBottom:8}}><div style={{flex:1}}><div style={{display:"flex",gap:6,marginBottom:4,flexWrap:"wrap"}}><span style={{background:cc+"22",color:cc,borderRadius:5,padding:"1px 7px",fontSize:10,fontWeight:700}}>{el.categorie}</span><span style={{fontWeight:700,fontSize:13}}>{el.libelle}</span></div></div><div style={{textAlign:"right"}}><div style={{fontWeight:800,fontSize:15,color:cc}}>{fmt(Math.round(result))}</div></div></div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:6}}>{(el.vars||[]).map(function(v){var key="p"+pi+"_e"+ei+"_"+v.nom;return <div key={v.nom} style={{background:T.card,borderRadius:6,padding:"7px 10px"}}><div style={{fontSize:10,color:T.muted,marginBottom:3}}>{v.label}</div><div style={{display:"flex",alignItems:"center",gap:4}}><input type="number" value={vals[key]!==undefined?vals[key]:v.valeur} onChange={function(e){setVal(key,parseFloat(e.target.value)||0);}} style={{flex:1,background:T.mid,border:"1px solid "+cc+"55",borderRadius:5,padding:"5px 7px",color:T.white,fontSize:12,fontWeight:700,outline:"none",width:"100%"}}/><span style={{fontSize:9,color:T.muted,whiteSpace:"nowrap"}}>{v.unite}</span></div></div>;})} </div></div>;})}
            </div>
          </div>;
        })}
        <div style={{background:T.primary+"11",border:"1px solid "+T.primary+"33",borderRadius:10,padding:"14px 18px"}}><button onClick={genererProjet} disabled={importing||!sessNom.trim()} style={{width:"100%",background:importing?T.mid:T.success,color:"#fff",border:"none",borderRadius:10,padding:"12px",fontWeight:800,fontSize:15,cursor:importing?"wait":"pointer"}}>{importing?"⏳ Génération en cours...":"🚀 Générer le projet Débours Sec"}</button></div>
      </div>}
      {done&&<div style={{background:T.success+"11",border:"1px solid "+T.success+"44",borderRadius:12,padding:24,textAlign:"center"}}><div style={{fontSize:40,marginBottom:8}}>🎉</div><div style={{fontWeight:800,fontSize:18,color:T.success,marginBottom:8}}>Projet généré !</div><button onClick={onClose} style={{background:T.success,color:"#fff",border:"none",borderRadius:10,padding:"10px 24px",fontWeight:700,cursor:"pointer"}}>Voir le projet</button></div>}
    </div>
  </Modal>;
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
  function getSessCfg(sid){var s=sessions.find(function(s){return s.id===sid;});return s?{tc:s.taux_charges,fg:s.coeff_fg,benef:s.coeff_benef}:{tc:40,fg:15,benef:10};}
  async function analyze(){
    if(!query.trim())return;setLoading(true);setErr(null);setResult(null);setDone(false);
    try{
      var prompt="Expert BTP CI. Decompose: "+query+"\nCSV pipe:\nLIBELLE|UNITE|QTE|SALAIRE_J|RENDEMENT|MATERIAUX_U|MATERIEL_U|ST_U|CATEGORIE|TYPE_OUVRIER|NB\nMax 15 lignes.";
      var data=await aiCall({model:AI_MODEL,max_tokens:4000,messages:[{role:"user",content:prompt}]});
      var txt=(data.content||[]).map(function(i){return i.text||"";}).join("").trim();
      var items=[];
      txt.split("\n").map(function(l){return l.trim();}).filter(function(l){return l.indexOf("|")>=2&&l.length>5&&!/^(libelle|#)/i.test(l.split("|")[0]);}).forEach(function(line){
        try{var parts=line.split("|");if(parts.length<8)return;var lib=parts[0].replace(/^[-*•\d.]+\s*/,"").trim();if(!lib||lib.length<2)return;items.push({libelle:lib,unite:String(parts[1]||"U").trim().slice(0,10),quantite:parseNum(parts[2])||1,salaire:parseNum(parts[3]),rendement:parseNum(parts[4])||1,materiau:parseNum(parts[5]),materiel:parseNum(parts[6]),sous_traitance:parseNum(parts[7]),categorie:String(parts[8]||"Mixte").trim()});}catch(e){}
      });
      if(!items.length)throw new Error("Aucun element extrait");
      var cfg=getSessCfg(selSess);
      setResult({items:items});
    }catch(e){setErr(e.message);}
    setLoading(false);
  }
  async function importToSession(){
    if(!selSess||!result)return;setImporting(true);
    var cfg=getSessCfg(selSess);
    for(var i=0;i<result.items.length;i++){var t=result.items[i];var c=calcTache(t,cfg.tc,cfg);await q("debourse_taches").insert({session_id:selSess,libelle:t.libelle,unite:t.unite,quantite:t.quantite,salaire:t.salaire,rendement:t.rendement,materiau:t.materiau,materiel:t.materiel,sous_traitance:t.sous_traitance,main_oeuvre_u:Math.round(c.mo),debourse_sec_u:Math.round(c.ds),prix_revient_u:Math.round(c.pr),prix_vente_u:Math.round(c.pv),prix_vente_total:Math.round(c.pvt)});}
    setImporting(false);setDone(true);reload();
  }
  var cfg2=getSessCfg(selSess);var items=result?result.items:[];
  var totDS=items.reduce(function(a,t){var c=calcTache(t,cfg2.tc,cfg2);return a+c.ds*t.quantite;},0);
  var totPV=items.reduce(function(a,t){var c=calcTache(t,cfg2.tc,cfg2);return a+c.pvt;},0);
  return <Modal title="🤖 IA — Décomposition d'ouvrage" onClose={onClose} T={T}>
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <FF label="Ouvrage à décomposer" value={query} onChange={setQuery} placeholder="Ex: Semelle filante 40x60cm béton armé C25/30..." rows={3} full T={T}/>
      <button onClick={analyze} disabled={loading||!query.trim()} style={{background:loading?T.mid:T.secondary,color:"#fff",border:"none",borderRadius:10,padding:"12px",fontWeight:700,cursor:loading?"wait":"pointer",fontSize:14}}>{loading?"🔍 Analyse...":"🤖 Analyser"}</button>
      {err&&<div style={{background:T.danger+"11",border:"1px solid "+T.danger+"44",borderRadius:8,padding:"10px",color:T.danger,fontSize:12}}>⚠️ {err}</div>}
      {result&&<div style={{display:"flex",flexDirection:"column",gap:10}}>
        <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:500}}><thead><tr style={{background:T.mid}}>{["Désignation","Qte","Un.","DS/u","PV/u"].map(function(h){return <th key={h} style={{padding:"6px 8px",textAlign:"left",color:T.muted,fontSize:10}}>{h}</th>;})}</tr></thead><tbody>{items.map(function(t,i){var c=calcTache(t,cfg2.tc,cfg2);return <tr key={i} style={{background:i%2===0?T.mid+"88":"transparent"}}><td style={{padding:"5px 8px",fontWeight:600}}>{t.libelle}</td><td style={{padding:"5px 8px",textAlign:"center"}}>{t.quantite}</td><td style={{padding:"5px 8px",color:T.muted}}>{t.unite}</td><td style={{padding:"5px 8px",textAlign:"right",fontWeight:700}}>{fmtS(Math.round(c.ds))}</td><td style={{padding:"5px 8px",textAlign:"right",color:T.success,fontWeight:700}}>{fmtS(Math.round(c.pv))}</td></tr>;})}<tr style={{background:T.primary+"22"}}><td colSpan={3} style={{padding:"7px 8px",fontWeight:800,color:T.primary}}>TOTAL</td><td style={{padding:"7px 8px",textAlign:"right",fontWeight:800}}>{fmtS(Math.round(totDS))}</td><td style={{padding:"7px 8px",textAlign:"right",fontWeight:800,color:T.success}}>{fmtS(Math.round(totPV))}</td></tr></tbody></table></div>
        {!done?<div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-end"}}><div style={{flex:1,minWidth:180}}><label style={{fontSize:11,color:T.muted,display:"block",marginBottom:4}}>Importer dans</label><select value={selSess} onChange={function(e){setSelSess(e.target.value);}} style={{width:"100%",background:T.mid,border:"1px solid "+T.border,borderRadius:8,padding:"10px 12px",color:T.white,fontSize:14,outline:"none"}}><option value="">-- Session --</option>{sessions.map(function(s){return <option key={s.id} value={s.id}>{s.nom}</option>;})}</select></div><button onClick={importToSession} disabled={!selSess||importing} style={{background:selSess?T.success:T.mid,color:"#fff",border:"none",borderRadius:10,padding:"10px 20px",fontWeight:700,cursor:selSess?"pointer":"not-allowed",fontSize:13}}>{importing?"...":"✅ Importer"}</button></div>:<div style={{background:T.success+"22",border:"1px solid "+T.success+"44",borderRadius:10,padding:"12px",fontWeight:700,color:T.success,textAlign:"center"}}>✅ {items.length} éléments importés !</div>}
      </div>}
    </div>
  </Modal>;
}

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
  async function handleFile(file){
    setImporting(true);setImportLog(null);
    var ext=file.name.split(".").pop().toLowerCase();
    try{
      var allTaches=[];
      if(ext==="xlsx"||ext==="xls"){
        var SheetJS=await import("https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs");
        var buf=await file.arrayBuffer();var wb=SheetJS.read(buf,{type:"array"});var ws=wb.Sheets[wb.SheetNames[0]];var raw=SheetJS.utils.sheet_to_json(ws,{header:1,defval:""});
        raw=raw.filter(function(r){return r.some(function(c){return String(c).trim()!=="";});});
        setImportLog({ok:true,msg:"🤖 Analyse..."});
        for(var ci=0;ci<raw.length;ci+=10){
          var chunk=raw.slice(ci,ci+10);
          var t2=await aiText([{role:"user",content:"Expert BTP. Extrait taches. CSV pipe:\nLIBELLE|QTE|UNITE|PU|MT|MO|MAT|MATER|ST\nIgnore totaux.\n"+JSON.stringify(chunk)}],1500);
          t2.trim().split("\n").forEach(function(line){line=line.trim();if(!line||line.indexOf("|")<0)return;var parts=line.split("|");var lib=parts[0].replace(/^[-*•]\s*/,"").trim();if(!lib||lib.length<2||/^(libelle|total)/i.test(lib))return;allTaches.push({libelle:lib,quantite:parseNum(parts[1])||1,unite:String(parts[2]||"U").trim(),prixUnitaire:parseNum(parts[3]),mo:parseNum(parts[5]),materiaux:parseNum(parts[6]),materiel:parseNum(parts[7]),sousTraitance:parseNum(parts[8])});});
          setImportLog({ok:true,msg:"📊 "+Math.min(ci+10,raw.length)+"/"+raw.length+" lignes — "+allTaches.length+" taches"});
        }
      } else if(file.type==="application/pdf"||file.type.indexOf("image/")===0){
        var b64=await new Promise(function(res,rej){var rr=new FileReader();rr.onload=function(e){res(e.target.result.split(",")[1]);};rr.onerror=rej;rr.readAsDataURL(file);});
        var cb=file.type==="application/pdf"?{type:"document",source:{type:"base64",media_type:file.type,data:b64}}:{type:"image",source:{type:"base64",media_type:file.type,data:b64}};
        var dd=await aiCall({model:AI_MODEL,max_tokens:3000,messages:[{role:"user",content:[cb,{type:"text",text:"Expert BTP. Extrais taches. CSV pipe:\nLIBELLE|QTE|UNITE|PU|MT|MO|MAT|MATER|ST\nIgnore totaux."}]}]});
        var tt=(dd.content||[]).map(function(i){return i.text||"";}).join("");
        tt.trim().split("\n").forEach(function(line){line=line.trim();if(!line||line.indexOf("|")<0)return;var parts=line.split("|");var lib=parts[0].replace(/^[-*•]\s*/,"").trim();if(!lib||lib.length<2||/^(libelle|total)/i.test(lib))return;allTaches.push({libelle:lib,quantite:parseNum(parts[1])||1,unite:String(parts[2]||"U").trim(),prixUnitaire:parseNum(parts[3]),mo:parseNum(parts[5]),materiaux:parseNum(parts[6]),materiel:parseNum(parts[7]),sousTraitance:parseNum(parts[8])});});
      } else throw new Error("Format non supporté");
      if(!allTaches.length)throw new Error("Aucune tâche détectée");
      for(var i=0;i<allTaches.length;i++){var t=allTaches[i];var lib=String(t.libelle||"").trim();if(!lib)continue;var qte=parseFloat(t.quantite)||1;var mo=parseFloat(t.mo)||0,mat=parseFloat(t.materiaux)||0,mat2=parseFloat(t.materiel)||0,st=parseFloat(t.sousTraitance)||0;var pu=parseFloat(t.prixUnitaire)||0;if(mo===0&&mat===0&&mat2===0&&st===0&&pu>0)st=pu;var cc=calcTache({quantite:qte,salaire:mo,rendement:1,materiau:mat,materiel:mat2,sous_traitance:st},cfg.tc,cfg);await q("debourse_taches").insert({session_id:sess.id,libelle:lib,unite:t.unite||"U",quantite:qte,salaire:mo,rendement:1,materiau:mat,materiel:mat2,sous_traitance:st,main_oeuvre_u:Math.round(cc.mo),debourse_sec_u:Math.round(cc.ds),prix_revient_u:Math.round(cc.pr),prix_vente_u:Math.round(cc.pv),prix_vente_total:Math.round(cc.pvt)});}
      setImportLog({ok:true,msg:"✅ "+allTaches.length+" taches importees !"});reload();
    }catch(e){setImportLog({ok:false,msg:"Erreur: "+e.message});}
    setImporting(false);
  }
  function onFileChange(e){var file=e.target.files[0];if(!file)return;e.target.value="";handleFile(file);}
  var iS={background:T.bg,border:"1px solid "+T.border,borderRadius:5,padding:"4px 7px",color:T.white,fontSize:11,outline:"none",width:"100%"};
  return <div style={{display:"flex",flexDirection:"column",gap:14}}>
    <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)",gap:10}}>
      <Kpi icon="🔨" label="Debours sec" value={fmtS(Math.round(totaux.ds))} color={T.warning} compact T={T}/>
      <Kpi icon="🏷️" label="Prix revient" value={fmtS(Math.round(totaux.pr))} color={T.secondary} compact T={T}/>
      <Kpi icon="💰" label="Prix vente HT" value={fmtS(Math.round(totaux.pvt))} color={T.success} compact T={T}/>
    </div>
    <Card title={"Coefficients — "+sess.nom} T={T}><div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)",gap:12}}>{[["Charges (%)","taux_charges",cfg.tc],["FG (%)","coeff_fg",cfg.fg],["Benefice (%)","coeff_benef",cfg.benef]].map(function(row){return <div key={row[1]}><label style={{fontSize:11,color:T.muted,display:"block",marginBottom:4}}>{row[0]}</label><input type="number" defaultValue={row[2]} onBlur={function(e){updateCfg(row[1],e.target.value);}} style={{background:T.mid,border:"1px solid "+T.border,borderRadius:7,padding:"6px 8px",color:T.white,fontSize:12,outline:"none",width:"100%"}}/></div>;})}</div></Card>
    <Card title={"Taches ("+taches.length+")"} action={<div style={{display:"flex",gap:6,flexWrap:"wrap"}}><input ref={fileRef} type="file" accept=".xlsx,.xls,.pdf,image/*" style={{display:"none"}} onChange={onFileChange}/><button onClick={function(){fileRef.current.click();}} disabled={importing} style={{background:importing?T.mid:T.secondary+"22",color:T.secondary,border:"1px solid "+T.secondary+"44",borderRadius:8,padding:"6px 12px",fontWeight:700,cursor:importing?"wait":"pointer",fontSize:12}}>{importing?"⏳":"📂 Importer"}</button><button onClick={function(){exportDebourseHTML(sess,taches,cfg,chNom,T);}} style={{background:T.primary+"22",color:T.primary,border:"1px solid "+T.primary+"44",borderRadius:8,padding:"6px 12px",fontWeight:700,cursor:"pointer",fontSize:12}}>PDF</button><button onClick={function(){setShowNew(true);}} style={{background:T.primary,color:"#fff",border:"none",borderRadius:8,padding:"6px 12px",fontWeight:700,cursor:"pointer",fontSize:12}}>+ Tache</button></div>} T={T}>
      {importLog&&<div style={{background:importLog.ok?T.success+"11":T.danger+"11",border:"1px solid "+(importLog.ok?T.success:T.danger)+"44",borderRadius:8,padding:"8px 14px",marginBottom:10,fontSize:12,fontWeight:600,color:importLog.ok?T.success:T.danger}}>{importLog.msg}<button onClick={function(){setImportLog(null);}} style={{float:"right",background:"none",border:"none",color:T.muted,cursor:"pointer"}}>✕</button></div>}
      {taches.length===0&&<Empty msg="Aucune tache" icon="📋"/>}
      {taches.length>0&&<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:600}}>
        <thead><tr style={{background:T.mid}}>{["#","Designation","Qte","Un.","Salaire","Rdt","Mat.","Mater.","ST","MO/u","DS/u","PV total",""].map(function(h,i){return <th key={i} style={{padding:"6px 8px",textAlign:i>8?"right":"left",color:T.muted,fontWeight:600,fontSize:10,borderBottom:"2px solid "+T.border}}>{h}</th>;})}</tr></thead>
        <tbody>
          {taches.map(function(t,idx){var c=calcTache(t,cfg.tc,cfg);var isEdit=editingId===t.id;var pC=isEdit?calcTache(editRow,cfg.tc,cfg):null;var isDetail=String(t.libelle||"").startsWith("  └");return <tr key={t.id} style={{background:isEdit?T.primary+"11":isDetail?T.bg:idx%2===0?T.mid+"88":"transparent",borderBottom:"1px solid "+T.border+"44"}}>
            <td style={{padding:"5px 8px",color:T.muted,fontSize:10}}>{isDetail?"":idx+1}</td>
            {isEdit?<><td style={{padding:"4px 6px"}}><input value={editRow.libelle||""} onChange={function(e){upE("libelle",e.target.value);}} style={Object.assign({},iS,{minWidth:120})}/></td><td style={{padding:"4px 6px"}}><input type="number" value={editRow.quantite||0} onChange={function(e){upE("quantite",e.target.value);}} style={Object.assign({},iS,{width:55,textAlign:"center"})}/></td><td style={{padding:"4px 6px"}}><select value={editRow.unite||"U"} onChange={function(e){upE("unite",e.target.value);}} style={Object.assign({},iS,{width:60})}>{UNITES.map(function(u){return <option key={u} value={u}>{u}</option>;})}</select></td><td style={{padding:"4px 6px"}}><input type="number" value={editRow.salaire||0} onChange={function(e){upE("salaire",e.target.value);}} style={Object.assign({},iS,{width:70,textAlign:"right"})}/></td><td style={{padding:"4px 6px"}}><input type="number" value={editRow.rendement||1} onChange={function(e){upE("rendement",e.target.value);}} style={Object.assign({},iS,{width:55,textAlign:"right"})}/></td><td style={{padding:"4px 6px"}}><input type="number" value={editRow.materiau||0} onChange={function(e){upE("materiau",e.target.value);}} style={Object.assign({},iS,{width:70,textAlign:"right"})}/></td><td style={{padding:"4px 6px"}}><input type="number" value={editRow.materiel||0} onChange={function(e){upE("materiel",e.target.value);}} style={Object.assign({},iS,{width:70,textAlign:"right"})}/></td><td style={{padding:"4px 6px"}}><input type="number" value={editRow.sous_traitance||0} onChange={function(e){upE("sous_traitance",e.target.value);}} style={Object.assign({},iS,{width:70,textAlign:"right"})}/></td><td style={{padding:"5px 8px",textAlign:"right",color:T.secondary}}>{fmtS(Math.round(pC.mo))}</td><td style={{padding:"5px 8px",textAlign:"right",color:T.warning}}>{fmtS(Math.round(pC.ds))}</td><td style={{padding:"5px 8px",textAlign:"right",color:T.success,fontWeight:700}}>{fmtS(Math.round(pC.pvt))}</td><td style={{padding:"4px 6px",whiteSpace:"nowrap"}}><button onClick={function(){saveEdit(t.id);}} style={{background:T.success,color:"#fff",border:"none",borderRadius:4,padding:"3px 7px",fontSize:10,cursor:"pointer",marginRight:3}}>OK</button><button onClick={cancelEdit} style={{background:T.danger+"22",color:T.danger,border:"1px solid "+T.danger+"44",borderRadius:4,padding:"3px 7px",fontSize:10,cursor:"pointer"}}>✕</button></td></>
            :<><td style={{padding:"5px 8px",fontWeight:isDetail?400:600,color:isDetail?T.muted:T.white,fontSize:isDetail?10:11}}>{t.libelle}</td><td style={{padding:"5px 8px",textAlign:"center",color:isDetail?T.muted:T.white}}>{t.quantite}</td><td style={{padding:"5px 8px",color:T.muted}}>{t.unite}</td><td style={{padding:"5px 8px",textAlign:"right",color:T.muted}}>{fmtS(t.salaire)}</td><td style={{padding:"5px 8px",textAlign:"right",color:T.muted}}>{t.rendement}</td><td style={{padding:"5px 8px",textAlign:"right",color:T.muted}}>{fmtS(t.materiau)}</td><td style={{padding:"5px 8px",textAlign:"right",color:T.muted}}>{fmtS(t.materiel)}</td><td style={{padding:"5px 8px",textAlign:"right",color:T.muted}}>{fmtS(t.sous_traitance)}</td><td style={{padding:"5px 8px",textAlign:"right",color:T.secondary}}>{fmtS(Math.round(c.mo))}</td><td style={{padding:"5px 8px",textAlign:"right",color:T.warning,fontWeight:600}}>{fmtS(Math.round(c.ds))}</td><td style={{padding:"5px 8px",textAlign:"right",color:T.success,fontWeight:700}}>{isDetail?fmtS(Math.round(c.ds*t.quantite)):fmtS(Math.round(c.pvt))}</td><td style={{padding:"4px 6px",whiteSpace:"nowrap"}}>{!isDetail&&<><button onClick={function(){startEdit(t);}} style={{background:T.warning+"22",color:T.warning,border:"1px solid "+T.warning+"44",borderRadius:4,padding:"3px 7px",fontSize:10,cursor:"pointer",marginRight:3}}>✏️</button><button onClick={function(){delTache(t.id);}} style={{background:T.danger+"22",color:T.danger,border:"1px solid "+T.danger+"44",borderRadius:4,padding:"3px 7px",fontSize:10,cursor:"pointer"}}>🗑</button></>}</td></>}
          </tr>;})}
          <tr style={{background:T.primary+"22",borderTop:"2px solid "+T.primary+"55",fontWeight:800}}><td colSpan={9} style={{padding:"8px",color:T.primary,fontSize:11}}>TOTAL</td><td style={{padding:"8px",textAlign:"right",color:T.secondary}}></td><td style={{padding:"8px",textAlign:"right",color:T.warning}}>{fmtS(Math.round(totaux.ds))}</td><td style={{padding:"8px",textAlign:"right",color:T.success,fontSize:13}}>{fmtS(Math.round(totaux.pvt))}</td><td></td></tr>
        </tbody>
      </table></div>}
    </Card>
    {showNew&&<Modal title="Nouvelle tache" onClose={function(){setShowNew(false);}} onSave={saveTache} T={T}>{saving?<Spin/>:<FG cols={2}><FF label="Designation *" value={tForm.libelle} onChange={function(v){setTForm(function(pp){var n=Object.assign({},pp);n.libelle=v;return n;});}} full T={T}/><FS label="Unite" value={tForm.unite} onChange={function(v){setTForm(function(pp){var n=Object.assign({},pp);n.unite=v;return n;});}} options={UNITES} T={T}/><FF label="Quantite" type="number" value={tForm.quantite} onChange={function(v){setTForm(function(pp){var n=Object.assign({},pp);n.quantite=v;return n;});}} T={T}/><FF label="Salaire (XOF/j)" type="number" value={tForm.salaire} onChange={function(v){setTForm(function(pp){var n=Object.assign({},pp);n.salaire=v;return n;});}} T={T}/><FF label="Rendement (u/j)" type="number" value={tForm.rendement} onChange={function(v){setTForm(function(pp){var n=Object.assign({},pp);n.rendement=v;return n;});}} T={T}/><FF label="Materiaux (XOF/u)" type="number" value={tForm.materiau} onChange={function(v){setTForm(function(pp){var n=Object.assign({},pp);n.materiau=v;return n;});}} T={T}/><FF label="Materiel (XOF/u)" type="number" value={tForm.materiel} onChange={function(v){setTForm(function(pp){var n=Object.assign({},pp);n.materiel=v;return n;});}} T={T}/><FF label="Sous-traitance (XOF/u)" type="number" value={tForm.sous_traitance} onChange={function(v){setTForm(function(pp){var n=Object.assign({},pp);n.sous_traitance=v;return n;});}} T={T}/></FG>}</Modal>}
  </div>;
}

// ── DEPENSES INTERVENTIONS ────────────────────────────────────────────────────
function DepensesIntv(p){
  var intv=p.intv,reload=p.reload,T=p.T;
  var _open=useState(false),open=_open[0],setOpen=_open[1];
  var _edit=useState(null),editDep=_edit[0],setEditDep=_edit[1];
  var _f=useState({libelle:"",montant:"",date:today(),categorie:"Divers"}),form=_f[0],setForm=_f[1];
  var _sv=useState(false),saving=_sv[0],setSaving=_sv[1];
  var deps=intv.depenses||[];
  var total=deps.reduce(function(a,d){return a+d.montant;},0);
  function resetForm(){setEditDep(null);setForm({libelle:"",montant:"",date:today(),categorie:"Divers"});}
  function startEdit(d){setEditDep(d);setForm({libelle:d.libelle||"",montant:String(d.montant||""),date:d.date||today(),categorie:d.categorie||"Divers"});setOpen(true);}
  function upF(k,v){setForm(function(pp){var n=Object.assign({},pp);n[k]=v;return n;});}
  function save(){
    if(!form.libelle||!form.montant)return;setSaving(true);
    var payload={libelle:form.libelle,montant:parseFloat(form.montant)||0,date:form.date,categorie:form.categorie||"Divers"};
    var op=editDep?q("intervention_depenses").eq("id",editDep.id).update(payload):q("intervention_depenses").insert(Object.assign({},payload,{intervention_id:intv.id}));
    op.then(function(){setSaving(false);setOpen(false);resetForm();reload();}).catch(function(e){setSaving(false);});
  }
  function del(id){if(!window.confirm("Supprimer ?"))return;q("intervention_depenses").eq("id",id).del().then(function(){reload();});}
  return <div style={{background:T.mid,borderRadius:8,padding:"10px 12px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <div><div style={{fontSize:10,color:T.muted}}>Coût engagé</div><div style={{fontWeight:800,color:T.warning,fontSize:14}}>{fmt(total)}</div></div>
      <button onClick={function(){resetForm();setOpen(function(v){return !v;});}} style={{background:T.warning+"22",border:"1px solid "+T.warning+"44",color:T.warning,borderRadius:6,padding:"5px 10px",fontSize:11,cursor:"pointer",fontWeight:700}}>{open?"Fermer":"+ Dépense"}</button>
    </div>
    {open&&<div style={{marginTop:10,borderTop:"1px solid "+T.border+"66",paddingTop:10,display:"flex",flexDirection:"column",gap:8}}>
      {deps.map(function(d){return <div key={d.id} style={{display:"flex",alignItems:"center",gap:8,fontSize:12}}>
        <div style={{flex:1}}><span style={{fontWeight:600}}>{d.libelle}</span><span style={{color:T.muted,marginLeft:6,fontSize:10}}>{d.date}</span></div>
        <span style={{fontWeight:700,color:T.warning}}>{fmt(d.montant)}</span>
        <button onClick={function(){startEdit(d);}} style={{background:T.warning+"22",border:"1px solid "+T.warning+"44",color:T.warning,borderRadius:5,padding:"3px 7px",fontSize:10,cursor:"pointer"}}>✏️</button>
        <button onClick={function(){del(d.id);}} style={{background:T.danger+"22",border:"1px solid "+T.danger+"44",color:T.danger,borderRadius:5,padding:"3px 7px",fontSize:10,cursor:"pointer"}}>🗑</button>
      </div>;})}
      <div style={{background:T.card,borderRadius:8,padding:"10px 12px",border:"1px solid "+T.border}}>
        <div style={{fontWeight:600,fontSize:12,marginBottom:8,color:editDep?T.warning:T.primary}}>{editDep?"✏️ Modifier":"+ Nouvelle dépense"}</div>
        <FG cols={2}>
          <FF label="Libellé *" value={form.libelle} onChange={function(v){upF("libelle",v);}} full T={T}/>
          <FS label="Catégorie" value={form.categorie} onChange={function(v){upF("categorie",v);}} options={CATS} T={T}/>
          <FF label="Montant (XOF) *" type="number" value={form.montant} onChange={function(v){upF("montant",v);}} T={T}/>
          <FF label="Date" type="date" value={form.date} onChange={function(v){upF("date",v);}} T={T}/>
        </FG>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:10}}>
          {editDep&&<button onClick={resetForm} style={{background:T.mid,color:T.muted,border:"1px solid "+T.border,borderRadius:7,padding:"7px 14px",fontSize:12,cursor:"pointer"}}>Annuler</button>}
          <button onClick={save} disabled={saving} style={{background:saving?T.mid:T.success,color:"#fff",border:"none",borderRadius:7,padding:"7px 16px",fontWeight:700,fontSize:12,cursor:saving?"wait":"pointer"}}>{saving?"...":(editDep?"Enregistrer":"Ajouter")}</button>
        </div>
      </div>
    </div>}
  </div>;
}

// ── FACTURATION PANEL ─────────────────────────────────────────────────────────
function FacturationPanel(p){
  var intv=p.intv,reload=p.reload,T=p.T;
  var cout=totalDepIntv(intv);
  var facture=parseFloat(intv.montant_facture||0);
  var nonChiffre=!intv.montant_facture&&cout===0;
  var benef=facture>0?facture-cout:null;
  var margeP=facture>0&&cout>0?Math.round((facture-cout)/cout*100):null;
  var _edit=useState(false),editing=_edit[0],setEditing=_edit[1];
  var _val=useState(String(facture||"")),val=_val[0],setVal=_val[1];
  var _sv=useState(false),sv=_sv[0],setSv=_sv[1];
  function save(){
    setSv(true);
    var montant=parseFloat(val)||0;
    q("interventions").eq("id",intv.id).update({montant_facture:montant,facturee:montant>0}).then(function(){setSv(false);setEditing(false);reload();});
  }
  return <div style={{background:benef===null?T.mid:benef>=0?T.success+"11":T.danger+"11",border:"1px solid "+(benef===null?T.border:benef>=0?T.success+"55":T.danger+"55"),borderRadius:8,padding:"10px 12px"}}>
    <div style={{fontSize:10,color:T.muted,marginBottom:6,fontWeight:600}}>💰 FACTURATION</div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:9,color:T.muted}}>Coût engagé</div>
        <div style={{fontWeight:800,fontSize:13,color:cout>0?T.warning:T.muted}}>{cout>0?fmt(cout):"Non chiffré"}</div>
      </div>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:9,color:T.muted}}>Montant facturé</div>
        <div style={{fontWeight:800,fontSize:13,color:facture>0?T.primary:T.muted}}>{facture>0?fmt(facture):"—"}</div>
      </div>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:9,color:T.muted}}>Bénéfice</div>
        <div style={{fontWeight:800,fontSize:13,color:benef===null?T.muted:benef>=0?T.success:T.danger}}>{benef===null?"—":(benef>=0?"+":"")+fmt(benef)}</div>
      </div>
    </div>
    {margeP!==null&&<div style={{background:margeP>=0?T.success+"22":T.danger+"22",borderRadius:5,padding:"3px 8px",fontSize:10,fontWeight:700,color:margeP>=0?T.success:T.danger,textAlign:"center",marginBottom:8}}>Marge : {margeP>=0?"+":""}{margeP}%</div>}
    {nonChiffre&&<div style={{fontSize:10,color:T.muted,fontStyle:"italic",textAlign:"center",marginBottom:8}}>Intervention non chiffrée — coût à saisir via Dépenses</div>}
    {editing?<div style={{display:"flex",gap:6,alignItems:"center"}}><input type="number" value={val} onChange={function(e){setVal(e.target.value);}} placeholder="Montant facturé XOF" style={{flex:1,background:T.mid,border:"1px solid "+T.primary,borderRadius:6,padding:"7px 10px",color:T.white,fontSize:13,outline:"none"}}/><button onClick={save} disabled={sv} style={{background:T.success,color:"#fff",border:"none",borderRadius:6,padding:"7px 12px",fontWeight:700,fontSize:12,cursor:"pointer"}}>✔</button><button onClick={function(){setEditing(false);}} style={{background:T.mid,color:T.muted,border:"none",borderRadius:6,padding:"7px 10px",fontSize:12,cursor:"pointer"}}>✕</button></div>
    :<button onClick={function(){setVal(String(facture||""));setEditing(true);}} style={{width:"100%",background:T.primary+"22",border:"1px solid "+T.primary+"44",color:T.primary,borderRadius:6,padding:"6px",fontSize:11,fontWeight:700,cursor:"pointer"}}>{facture>0?"✏️ Modifier le montant facturé":"+ Saisir le montant facturé"}</button>}
  </div>;
}

// ── INTERVENTIONS ─────────────────────────────────────────────────────────────
function Interventions(p){
  var intv=p.intv,ch=p.ch,reload=p.reload,T=p.T,isMobile=useBP().isMobile;
  var _ft=useState("Tous"),fT=_ft[0],setFT=_ft[1];
  var _fm2=useState(""),fMois=_fm2[0],setFMois=_fm2[1];
  var _n=useState(false),showNew=_n[0],setShowNew=_n[1];
  var _edit=useState(null),editIntv=_edit[0],setEditIntv=_edit[1];
  var _sv=useState(false),saving=_sv[0],setSaving=_sv[1];
  var BLANK={titre:"",description:"",type:"Corrective",intervenant:"",client:"",voie_reception:"Appel téléphonique",chantier:"",date_creation:today(),statut:"En attente",facturee:false,montant_facture:""};
  var _fm=useState(BLANK),form=_fm[0],setForm=_fm[1];
  var STIC={"En attente":T.warning,"En cours":T.secondary,"Terminee":T.success};
  var TC={Urgence:T.danger,Preventive:T.secondary,Corrective:T.primary,Inspection:"#A855F7"};

  var filtered=intv.filter(function(i){
    var okType=fT==="Tous"||i.type===fT;
    var okMois=!fMois||(i.date_creation&&i.date_creation.slice(0,7)===fMois);
    return okType&&okMois;
  });

  function del(id){if(!window.confirm("Supprimer ?"))return;q("interventions").eq("id",id).del().then(function(){reload();});}
  function openNew(){setForm(BLANK);setEditIntv(null);setShowNew(true);}
  function openEdit(i){setForm({titre:i.titre||"",description:i.description||"",type:i.type||"Corrective",intervenant:i.intervenant||"",client:i.client||"",voie_reception:i.voie_reception||"Appel téléphonique",chantier:i.chantier||"",date_creation:i.date_creation||today(),statut:i.statut||"En attente",facturee:!!i.facturee,montant_facture:String(i.montant_facture||"")});setEditIntv(i);setShowNew(true);}
  function upF(k,v){setForm(function(pp){var n=Object.assign({},pp);n[k]=v;return n;});}
  function updSt(id,s){q("interventions").eq("id",id).update({statut:s}).then(function(){reload();});}
  function save(){
    if(!form.titre)return;setSaving(true);
    var payload={titre:form.titre,description:form.description,type:form.type,intervenant:form.intervenant,client:form.client,voie_reception:form.voie_reception,chantier:form.chantier,date_creation:form.date_creation,statut:form.statut,facturee:form.facturee,montant_facture:form.montant_facture?parseFloat(form.montant_facture):null};
    var op=editIntv?q("interventions").eq("id",editIntv.id).update(payload):q("interventions").insert(Object.assign({},payload,{duree:1}));
    op.then(function(){setSaving(false);setShowNew(false);setEditIntv(null);reload();});
  }

  var moisDispo=[];
  intv.forEach(function(i){if(i.date_creation&&i.date_creation.length>=7){var m=i.date_creation.slice(0,7);if(!moisDispo.includes(m))moisDispo.push(m);}});
  moisDispo.sort().reverse();

  // KPIs financiers
  var totalCout=intv.reduce(function(a,i){return a+totalDepIntv(i);},0);
  var totalFacture=intv.reduce(function(a,i){return a+parseFloat(i.montant_facture||0);},0);
  var totalBenef=totalFacture-totalCout;
  var nbNonChiffrees=intv.filter(function(i){return !i.montant_facture&&totalDepIntv(i)===0;}).length;

  var exportLabel=(fMois?MOIS[parseInt(fMois.slice(5,7))-1]+" "+fMois.slice(0,4):"Toutes")+(fT!=="Tous"?" - "+fT:"");

  return <div style={{display:"flex",flexDirection:"column",gap:14}}>
    {/* KPIs */}
    <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:10}}>
      <Kpi icon="🔧" label="Total interv." value={intv.length} color={T.primary} compact={isMobile} T={T}/>
      <Kpi icon="🧾" label="Coût engagé" value={fmtS(totalCout)} color={T.warning} compact={isMobile} T={T}/>
      <Kpi icon="💵" label="Facturé" value={fmtS(totalFacture)} color={T.primary} compact={isMobile} T={T}/>
      <Kpi icon="📈" label="Bénéfice net" value={fmtS(totalBenef)} color={totalBenef>=0?T.success:T.danger} compact={isMobile} T={T}/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:10}}>
      <Kpi icon="🚨" label="Urgences" value={intv.filter(function(i){return i.type==="Urgence";}).length} color={T.danger} compact={isMobile} T={T}/>
      <Kpi icon="⚙️" label="En cours" value={intv.filter(function(i){return i.statut==="En cours";}).length} color={T.secondary} compact={isMobile} T={T}/>
      <Kpi icon="✅" label="Terminées" value={intv.filter(function(i){return i.statut==="Terminee";}).length} color={T.success} compact={isMobile} T={T}/>
      <Kpi icon="❓" label="Non chiffrées" value={nbNonChiffrees} color={T.muted} compact={isMobile} T={T}/>
    </div>

    <Card T={T}>
      <div style={{display:"flex",gap:4,overflowX:"auto",marginBottom:10}}>
        {["Tous"].concat(TYPES_INT).map(function(t){return <button key={t} onClick={function(){setFT(t);}} style={{padding:"5px 10px",borderRadius:20,border:"1px solid "+(fT===t?T.primary:T.border),background:fT===t?T.primary:"transparent",color:fT===t?"#fff":T.muted,cursor:"pointer",fontSize:11,whiteSpace:"nowrap",flexShrink:0}}>{t}</button>;})}
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:10}}>
        <span style={{fontSize:12,color:T.muted,whiteSpace:"nowrap"}}>📅 Période :</span>
        <select value={fMois} onChange={function(e){setFMois(e.target.value);}} style={{background:T.mid,border:"1px solid "+T.border,borderRadius:8,padding:"6px 10px",color:T.white,fontSize:12,outline:"none"}}>
          <option value="">Toute la période</option>
          {moisDispo.map(function(m){var parts=m.split("-");return <option key={m} value={m}>{MOIS[parseInt(parts[1])-1]+" "+parts[0]}</option>;})}
        </select>
        {fMois&&<button onClick={function(){setFMois("");}} style={{background:T.danger+"22",color:T.danger,border:"1px solid "+T.danger+"44",borderRadius:6,padding:"4px 10px",fontSize:11,cursor:"pointer"}}>✕ Effacer</button>}
        <span style={{fontSize:11,color:T.muted}}>{filtered.length} résultat(s)</span>
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        <button onClick={function(){exportIntvCSV(filtered,exportLabel);}} style={{background:T.success+"22",color:T.success,border:"1px solid "+T.success+"44",borderRadius:8,padding:"6px 12px",fontWeight:700,cursor:"pointer",fontSize:12}}>CSV</button>
        <button onClick={function(){exportIntvHTML(filtered,exportLabel,T);}} style={{background:T.primary+"22",color:T.primary,border:"1px solid "+T.primary+"44",borderRadius:8,padding:"6px 12px",fontWeight:700,cursor:"pointer",fontSize:12}}>PDF</button>
        <button onClick={openNew} style={{background:T.primary,color:"#fff",border:"none",borderRadius:8,padding:"6px 14px",fontWeight:700,cursor:"pointer",fontSize:12,marginLeft:"auto"}}>+ Nouvelle</button>
      </div>
    </Card>

    {filtered.length===0&&<Empty msg="Aucune intervention" icon="🔧"/>}
    <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(360px,1fr))",gap:14}}>
      {filtered.map(function(i){
        var cout=totalDepIntv(i);
        var facture=parseFloat(i.montant_facture||0);
        return <div key={i.id} style={{background:T.card,border:"1px solid "+(i.type==="Urgence"?TC.Urgence+"66":T.border),borderRadius:T.borderRadius,padding:16,display:"flex",flexDirection:"column",gap:10}}>
          {/* Header */}
          <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"flex-start"}}>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:14}}>{i.titre}</div>
              <div style={{fontSize:11,color:T.muted,marginTop:2}}>{i.date_creation}</div>
            </div>
            <div style={{display:"flex",gap:4,flexWrap:"wrap",justifyContent:"flex-end"}}>
              <Badge label={i.type} color={TC[i.type]||T.primary} small/>
            </div>
          </div>

          {/* Client + Voie */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
            {i.client&&<div style={{background:T.mid,borderRadius:7,padding:"6px 10px"}}>
              <div style={{fontSize:9,color:T.muted,marginBottom:2}}>👤 CLIENT</div>
              <div style={{fontWeight:700,fontSize:12}}>{i.client}</div>
            </div>}
            {i.voie_reception&&<div style={{background:(VOIE_COL[i.voie_reception]||T.muted)+"11",border:"1px solid "+(VOIE_COL[i.voie_reception]||T.muted)+"33",borderRadius:7,padding:"6px 10px"}}>
              <div style={{fontSize:9,color:T.muted,marginBottom:2}}>📡 RÉCEPTION</div>
              <div style={{fontWeight:700,fontSize:12,color:VOIE_COL[i.voie_reception]||T.muted}}>{VOIE_ICO[i.voie_reception]||""} {i.voie_reception}</div>
            </div>}
          </div>

          {/* Chantier + Intervenant */}
          <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
            {i.chantier&&<span style={{fontSize:11,color:T.muted}}>🏗️ {i.chantier}</span>}
            {i.chantier&&i.intervenant&&<span style={{color:T.border,fontSize:11}}>|</span>}
            {i.intervenant&&<span style={{fontSize:11,color:T.muted}}>👷 {i.intervenant}</span>}
          </div>

          {/* Description */}
          {i.description&&<div style={{fontSize:12,color:T.muted,background:T.mid,borderRadius:6,padding:"7px 10px",fontStyle:"italic"}}>{i.description}</div>}

          {/* Dépenses */}
          <DepensesIntv intv={i} reload={reload} T={T}/>

          {/* Facturation */}
          <FacturationPanel intv={i} reload={reload} T={T}/>

          {/* Statut + actions */}
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <select value={i.statut} onChange={function(e){updSt(i.id,e.target.value);}} style={{flex:1,background:(STIC[i.statut]||T.muted)+"22",border:"1px solid "+(STIC[i.statut]||T.muted)+"55",borderRadius:6,padding:"5px 10px",color:STIC[i.statut]||T.muted,fontSize:12,cursor:"pointer",outline:"none",fontWeight:700}}>{["En attente","En cours","Terminee"].map(function(s){return <option key={s} value={s}>{s}</option>;})}</select>
            <button onClick={function(){openEdit(i);}} style={{background:T.warning+"22",border:"1px solid "+T.warning+"44",color:T.warning,borderRadius:6,padding:"6px 10px",fontSize:12,cursor:"pointer",fontWeight:700}}>✏️</button>
            <button onClick={function(){del(i.id);}} style={{background:T.danger+"22",border:"1px solid "+T.danger+"44",color:T.danger,borderRadius:6,padding:"6px 10px",fontSize:12,cursor:"pointer"}}>🗑</button>
          </div>
        </div>;
      })}
    </div>

    {showNew&&<Modal title={editIntv?"Modifier l'intervention":"Nouvelle intervention"} onClose={function(){setShowNew(false);setEditIntv(null);}} onSave={save} saveLabel={editIntv?"Enregistrer":"Créer"} T={T}>
      {saving?<Spin/>:<div style={{display:"flex",flexDirection:"column",gap:16}}>
        {/* Bloc Identification */}
        <div style={{background:T.mid,borderRadius:10,padding:"14px 16px"}}>
          <div style={{fontWeight:700,fontSize:13,color:T.primary,marginBottom:12}}>📋 Identification</div>
          <FG cols={2}>
            <FF label="Titre *" value={form.titre} onChange={function(v){upF("titre",v);}} full T={T}/>
            <FS label="Type" value={form.type} onChange={function(v){upF("type",v);}} options={TYPES_INT} T={T}/>
            <FF label="Date" type="date" value={form.date_creation} onChange={function(v){upF("date_creation",v);}} T={T}/>
            <FS label="Statut" value={form.statut} onChange={function(v){upF("statut",v);}} options={["En attente","En cours","Terminee"]} T={T}/>
          </FG>
        </div>

        {/* Bloc Client */}
        <div style={{background:T.mid,borderRadius:10,padding:"14px 16px"}}>
          <div style={{fontWeight:700,fontSize:13,color:T.secondary,marginBottom:12}}>👤 Client & Réception</div>
          <FG cols={2}>
            <FF label="Nom du client *" value={form.client} onChange={function(v){upF("client",v);}} placeholder="Ex: M. Kouassi, Société ABC..." T={T}/>
            <FS label="Voie de réception *" value={form.voie_reception} onChange={function(v){upF("voie_reception",v);}} options={VOIES} T={T}/>
            <FS label="Chantier concerné" value={form.chantier} onChange={function(v){upF("chantier",v);}} options={[""].concat(ch.map(function(c){return c.nom;}))} T={T}/>
            <FF label="Intervenant assigné" value={form.intervenant} onChange={function(v){upF("intervenant",v);}} placeholder="Nom du technicien..." T={T}/>
          </FG>
        </div>

        {/* Bloc Description */}
        <div style={{background:T.mid,borderRadius:10,padding:"14px 16px"}}>
          <div style={{fontWeight:700,fontSize:13,color:T.warning,marginBottom:12}}>📝 Description du problème</div>
          <FF label="Description" value={form.description} onChange={function(v){upF("description",v);}} rows={3} full T={T}/>
        </div>

        {/* Bloc Facturation */}
        <div style={{background:T.mid,borderRadius:10,padding:"14px 16px"}}>
          <div style={{fontWeight:700,fontSize:13,color:T.success,marginBottom:12}}>💰 Facturation</div>
          <FG cols={2}>
            <FF label="Montant facturé (XOF)" type="number" value={form.montant_facture} onChange={function(v){upF("montant_facture",v);}} placeholder="0 = non chiffré" T={T}/>
            <div style={{display:"flex",alignItems:"center",gap:10,paddingTop:20}}>
              <input type="checkbox" id="facturee_cb" checked={!!form.facturee} onChange={function(e){upF("facturee",e.target.checked);}} style={{width:18,height:18,cursor:"pointer"}}/>
              <label htmlFor="facturee_cb" style={{fontSize:13,cursor:"pointer",fontWeight:600}}>Marquée comme facturée</label>
            </div>
          </FG>
          {form.montant_facture&&<div style={{marginTop:8,fontSize:11,color:T.muted}}>ℹ️ Laissez vide si l'intervention n'est pas encore chiffrée — vous pourrez saisir le montant plus tard.</div>}
        </div>
      </div>}
    </Modal>}
  </div>;
}

// ── KPI ───────────────────────────────────────────────────────────────────────
function KpiPage(p){
  var ch=p.ch,intv=p.intv,T=p.T,isMobile=useBP().isMobile;
  var totalB=ch.reduce(function(a,c){return a+c.budgetInitial;},0);
  var totalD=ch.reduce(function(a,c){return a+totalDep(c);},0);
  var marge=totalB-totalD,pc=pct(totalD,totalB);
  var depCat=CATS.map(function(cat){return{cat:cat.split(" ")[0],total:ch.reduce(function(a,c){return a+c.depenses.filter(function(d){return d.categorie===cat;}).reduce(function(s,d){return s+d.montant;},0);},0)};}).filter(function(x){return x.total>0;});
  var totalIntv=intv.length;
  var totalCoutIntv=intv.reduce(function(a,i){return a+totalDepIntv(i);},0);
  var totalFactureIntv=intv.reduce(function(a,i){return a+parseFloat(i.montant_facture||0);},0);
  var totalBenefIntv=totalFactureIntv-totalCoutIntv;
  var intvTerminees=intv.filter(function(i){return i.statut==="Terminee";}).length;
  var tauxResolution=totalIntv>0?Math.round(intvTerminees/totalIntv*100):0;
  var intvParType=TYPES_INT.map(function(t){return{type:t,nb:intv.filter(function(i){return i.type===t;}).length};});
  var voieMap={};intv.forEach(function(i){var v=i.voie_reception||"Autre";if(!voieMap[v])voieMap[v]=0;voieMap[v]++;});
  var voieData=Object.entries(voieMap).map(function(e){return{voie:(VOIE_ICO[e[0]]||"")+" "+e[0].slice(0,10),nb:e[1]};}).sort(function(a,b){return b.nb-a.nb;});
  var moisMap={};intv.forEach(function(i){if(i.date_creation&&i.date_creation.length>=7){var m=i.date_creation.slice(0,7);if(!moisMap[m])moisMap[m]={mois:m,nb:0,cout:0,facture:0};moisMap[m].nb++;moisMap[m].cout+=totalDepIntv(i);moisMap[m].facture+=parseFloat(i.montant_facture||0);}});
  var intvMensuel=Object.values(moisMap).sort(function(a,b){return a.mois.localeCompare(b.mois);}).slice(-6).map(function(m){var parts=m.mois.split("-");return Object.assign({},m,{label:MOIS[parseInt(parts[1])-1].slice(0,3)+" "+parts[0].slice(2),benef:m.facture-m.cout});});
  return <div style={{display:"flex",flexDirection:"column",gap:16}}>
    <div style={{fontWeight:700,fontSize:14,color:T.primary,borderBottom:"1px solid "+T.border,paddingBottom:8}}>🏗️ Chantiers</div>
    <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:10}}>
      <Kpi icon="💰" label="Budget total" value={fmtS(totalB)} compact={isMobile} T={T}/>
      <Kpi icon="🧾" label="Depenses" value={fmtS(totalD)} color={T.warning} compact={isMobile} T={T}/>
      <Kpi icon="💵" label="Marge" value={fmtS(marge)} color={marge>=0?T.success:T.danger} compact={isMobile} T={T}/>
      <Kpi icon="📉" label="Consomme" value={pc+"%"} color={pc>100?T.danger:pc>80?T.warning:T.success} compact={isMobile} T={T}/>
    </div>
    <div style={{fontWeight:700,fontSize:14,color:T.secondary,borderBottom:"1px solid "+T.border,paddingBottom:8,marginTop:8}}>🔧 Interventions — Performance financière</div>
    <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:10}}>
      <Kpi icon="🔧" label="Total" value={totalIntv} color={T.primary} compact={isMobile} T={T}/>
      <Kpi icon="🧾" label="Coût engagé" value={fmtS(totalCoutIntv)} color={T.warning} compact={isMobile} T={T}/>
      <Kpi icon="💵" label="Facturé" value={fmtS(totalFactureIntv)} color={T.primary} compact={isMobile} T={T}/>
      <Kpi icon="📈" label="Bénéfice net" value={fmtS(totalBenefIntv)} color={totalBenefIntv>=0?T.success:T.danger} compact={isMobile} T={T}/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:10}}>
      <Kpi icon="📊" label="Taux résolution" value={tauxResolution+"%"} color={tauxResolution>70?T.success:T.warning} compact={isMobile} T={T}/>
      <Kpi icon="✅" label="Facturées" value={intv.filter(function(i){return i.facturee;}).length+"/"+totalIntv} color={T.success} compact={isMobile} T={T}/>
      <Kpi icon="❓" label="Non chiffrées" value={intv.filter(function(i){return !i.montant_facture&&totalDepIntv(i)===0;}).length} color={T.muted} compact={isMobile} T={T}/>
      <Kpi icon="🚨" label="Urgences" value={intv.filter(function(i){return i.type==="Urgence";}).length} color={T.danger} compact={isMobile} T={T}/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:16}}>
      <Card title="Dépenses chantiers par catégorie" T={T}>{depCat.length>0?<ResponsiveContainer width="100%" height={180}><BarChart data={depCat} layout="vertical"><XAxis type="number" tick={{fill:T.muted,fontSize:9}} tickFormatter={function(v){return fmtS(v);}}/><YAxis type="category" dataKey="cat" tick={{fill:T.muted,fontSize:10}} width={70}/><Tooltip contentStyle={{background:T.card,border:"1px solid "+T.border,color:T.white}} formatter={function(v){return fmt(v);}}/><Bar dataKey="total" radius={[0,4,4,0]}>{depCat.map(function(d,i){return <Cell key={i} fill={catC(d.cat,T)}/>;})}</Bar></BarChart></ResponsiveContainer>:<Empty msg="Aucune depense" icon="📊"/>}</Card>
      <Card title="Voies de réception" T={T}>{voieData.length>0?<ResponsiveContainer width="100%" height={180}><BarChart data={voieData}><XAxis dataKey="voie" tick={{fill:T.muted,fontSize:9}}/><YAxis tick={{fill:T.muted,fontSize:9}}/><Tooltip contentStyle={{background:T.card,border:"1px solid "+T.border,color:T.white}}/><Bar dataKey="nb" fill={T.secondary} radius={[4,4,0,0]}/></BarChart></ResponsiveContainer>:<Empty msg="Aucune donnée" icon="📡"/>}</Card>
      {intvMensuel.length>0&&<Card title="Évolution mensuelle — Coût vs Facturé vs Bénéfice" T={T}><ResponsiveContainer width="100%" height={200}><LineChart data={intvMensuel}><XAxis dataKey="label" tick={{fill:T.muted,fontSize:10}}/><YAxis tick={{fill:T.muted,fontSize:9}} tickFormatter={function(v){return fmtS(v);}}/><Tooltip contentStyle={{background:T.card,border:"1px solid "+T.border,color:T.white}} formatter={function(v){return fmt(v);}}/><Line type="monotone" dataKey="cout" stroke={T.warning} strokeWidth={2} name="Coût"/><Line type="monotone" dataKey="facture" stroke={T.primary} strokeWidth={2} name="Facturé"/><Line type="monotone" dataKey="benef" stroke={T.success} strokeWidth={2} strokeDasharray="5 5" name="Bénéfice"/></LineChart></ResponsiveContainer></Card>}
      <Card title="Interventions par type" T={T}><ResponsiveContainer width="100%" height={200}><BarChart data={intvParType}><XAxis dataKey="type" tick={{fill:T.muted,fontSize:9}}/><YAxis tick={{fill:T.muted,fontSize:9}}/><Tooltip contentStyle={{background:T.card,border:"1px solid "+T.border,color:T.white}}/><Bar dataKey="nb" radius={[4,4,0,0]}>{intvParType.map(function(d,i){var cols=[T.danger,T.secondary,T.primary,"#A855F7"];return <Cell key={i} fill={cols[i%cols.length]}/>;})}</Bar></BarChart></ResponsiveContainer></Card>
      <Card title="Budget par chantier" T={T}>{ch.map(function(c){var d=totalDep(c),pp=pct(d,c.budgetInitial);return <div key={c.id} style={{padding:"7px 0",borderBottom:"1px solid "+T.border}}><div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}><span style={{fontWeight:600}}>{c.nom}</span><span style={{fontWeight:700,color:pp>100?T.danger:pp>80?T.warning:T.success}}>{pp}%</span></div><PBar p={pp} color={pp>100?T.danger:pp>80?T.warning:T.success} h={6}/></div>;})} {ch.length===0&&<Empty msg="Aucun chantier" icon="📊"/>}</Card>
    </div>
  </div>;
}

// ── IA ────────────────────────────────────────────────────────────────────────
function IA(p){
  var ch=p.ch,intv=p.intv,T=p.T;
  var _l=useState(false),loading=_l[0],setLoading=_l[1];
  var _r=useState(null),result=_r[0],setResult=_r[1];
  var _e=useState(null),error=_e[0],setError=_e[1];
  function run(){
    setLoading(true);setError(null);setResult(null);
    var totalCout=intv.reduce(function(a,i){return a+totalDepIntv(i);},0);
    var totalFacture=intv.reduce(function(a,i){return a+parseFloat(i.montant_facture||0);},0);
    var ctx={chantiers:ch.map(function(c){return{nom:c.nom,statut:c.statut,budget:c.budgetInitial,depenses:totalDep(c),pct:pct(totalDep(c),c.budgetInitial)};}),interventions:{total:intv.length,cout:totalCout,facture:totalFacture,benef:totalFacture-totalCout,urgences:intv.filter(function(i){return i.type==="Urgence";}).length,liste:intv.slice(0,10).map(function(i){return{titre:i.titre,type:i.type,statut:i.statut,client:i.client,voie:i.voie_reception};})}};
    aiCall({model:AI_MODEL,max_tokens:1500,messages:[{role:"user",content:"Expert BTP CI. Analyse ce portefeuille. JSON valide uniquement:\n"+JSON.stringify(ctx)+"\nFormat: {\"recommandations\":[{\"titre\":\"str\",\"detail\":\"str\",\"priorite\":\"haute\"}],\"scoreGlobal\":75,\"synthese\":\"str\",\"pointsForts\":[\"str\"],\"risques\":[\"str\"]}"}]})
      .then(function(data){var txt=(data.content||[]).map(function(i){return i.text||"";}).join("");var parsed=safeParseJSON(txt);if(!parsed)throw new Error("JSON invalide");setResult(parsed);setLoading(false);})
      .catch(function(e){setError("Erreur: "+e.message);setLoading(false);});
  }
  return <div style={{display:"flex",flexDirection:"column",gap:14}}>
    <div style={{background:T.primary+"11",border:"1px solid "+T.primary+"44",borderRadius:T.borderRadius,padding:20}}>
      <div style={{fontSize:20,fontWeight:800,marginBottom:4}}>Analyse IA du portefeuille</div>
      <div style={{color:T.muted,fontSize:13,marginBottom:14}}>{ch.length} chantier(s) — {intv.length} interventions</div>
      <button onClick={run} disabled={loading} style={{background:T.primary,color:"#fff",border:"none",borderRadius:10,padding:"10px 24px",fontWeight:700,cursor:loading?"wait":"pointer",fontSize:14}}>{loading?"Analyse...":"Lancer l'analyse"}</button>
      {error&&<div style={{color:T.danger,fontSize:12,marginTop:10}}>{error}</div>}
    </div>
    {!result&&!loading&&<Empty msg="Lancez l'analyse pour obtenir des recommandations IA" icon="🤖"/>}
    {loading&&<Spin/>}
    {result&&<div style={{display:"flex",flexDirection:"column",gap:14}}>
      <Card T={T}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={{fontWeight:800,fontSize:16}}>Synthese</div><div style={{background:(result.scoreGlobal>70?T.success:result.scoreGlobal>40?T.warning:T.danger)+"22",borderRadius:8,padding:"6px 16px",fontWeight:800,fontSize:18,color:result.scoreGlobal>70?T.success:result.scoreGlobal>40?T.warning:T.danger}}>Score {result.scoreGlobal}/100</div></div><div style={{fontSize:13,color:T.muted,marginBottom:12}}>{result.synthese}</div>{result.pointsForts&&result.pointsForts.length>0&&<div style={{marginBottom:10}}><div style={{fontWeight:700,color:T.success,fontSize:12,marginBottom:6}}>Points forts</div>{result.pointsForts.map(function(pp,i){return <div key={i} style={{fontSize:12,color:T.muted,marginBottom:3}}>✅ {pp}</div>;})}</div>}{result.risques&&result.risques.length>0&&<div><div style={{fontWeight:700,color:T.danger,fontSize:12,marginBottom:6}}>Risques</div>{result.risques.map(function(r,i){return <div key={i} style={{fontSize:12,color:T.muted,marginBottom:3}}>⚠️ {r}</div>;})}</div>}</Card>
      <Card title="Recommandations" T={T}>{(result.recommandations||[]).map(function(r,i){var col=r.priorite==="haute"?T.danger:r.priorite==="moyenne"?T.warning:T.success;return <div key={i} style={{background:col+"11",border:"1px solid "+col+"33",borderRadius:8,padding:14,marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",gap:8,flexWrap:"wrap",marginBottom:6}}><div style={{fontWeight:700,color:col,fontSize:13}}>{r.titre}</div><Badge label={"Priorité "+r.priorite} color={col} small/></div><div style={{fontSize:12,color:T.muted}}>{r.detail}</div></div>;})}</Card>
    </div>}
  </div>;
}

function Gestion(p){
  var ch=p.ch,openCh=p.openCh,reload=p.reload,T=p.T;
  var _c=useState(null),confirm=_c[0],setConfirm=_c[1];
  var _s=useState(""),search=_s[0],setSearch=_s[1];
  var filtered=ch.filter(function(c){return(c.nom+c.client).toLowerCase().indexOf(search.toLowerCase())>=0;});
  function del(id){q("chantiers").eq("id",id).del().then(function(){setConfirm(null);reload();});}
  return <div style={{display:"flex",flexDirection:"column",gap:14}}><Card title="Tous les projets" T={T}>
    <input value={search} onChange={function(e){setSearch(e.target.value);}} placeholder="Rechercher..." style={{width:"100%",background:T.mid,border:"1px solid "+T.border,borderRadius:8,padding:"10px 14px",color:T.white,fontSize:14,boxSizing:"border-box",outline:"none",marginBottom:14}}/>
    {filtered.map(function(c){var dep=totalDep(c),pp=pct(dep,c.budgetInitial);return <div key={c.id} style={{background:T.mid,border:"1px solid "+(confirm===c.id?T.danger+"88":T.border),borderRadius:T.borderRadius,padding:"12px 14px",marginBottom:8}}>
      {confirm===c.id?<div><div style={{fontWeight:700,color:T.danger,marginBottom:8}}>Supprimer "{c.nom}" ?</div><div style={{display:"flex",gap:10}}><button onClick={function(){setConfirm(null);}} style={{flex:1,padding:"9px",background:T.card,color:T.white,border:"1px solid "+T.border,borderRadius:8,cursor:"pointer"}}>Annuler</button><button onClick={function(){del(c.id);}} style={{flex:1,padding:"9px",background:T.danger,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700}}>Confirmer</button></div></div>
      :<div><div style={{display:"flex",justifyContent:"space-between",gap:8,marginBottom:6}}><div><div style={{fontWeight:700,fontSize:14}}>{c.nom}</div><div style={{fontSize:11,color:T.muted}}>{c.client} - {c.type}</div></div><Badge label={c.statut} color={stC(c.statut,T)} small/></div><div style={{marginBottom:8}}><div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.muted,marginBottom:3}}><span>{fmt(dep)}</span><span style={{fontWeight:700,color:pp>100?T.danger:pp>80?T.warning:T.success}}>{pp}%</span></div><PBar p={pp} color={pp>100?T.danger:pp>80?T.warning:T.success} h={6}/></div><div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><button onClick={function(){openCh(c.id);}} style={{background:T.secondary+"22",border:"1px solid "+T.secondary+"44",color:T.secondary,borderRadius:7,padding:"7px 14px",fontSize:12,cursor:"pointer",fontWeight:600}}>Ouvrir</button><button onClick={function(){setConfirm(c.id);}} style={{background:T.danger+"22",border:"1px solid "+T.danger+"44",color:T.danger,borderRadius:7,padding:"7px 12px",fontSize:12,cursor:"pointer",fontWeight:700}}>✕</button></div></div>}
    </div>;})}
    {filtered.length===0&&<Empty msg="Aucun resultat" icon="🔍"/>}
  </Card></div>;
}

function Parametres(p){
  var T=p.T,upT=p.upT,resetT=p.resetT,isMobile=useBP().isMobile;
  var presets=[{label:"BTP Orange",colors:{primary:"#F97316",secondary:"#3B82F6",bg:"#1C1917",card:"#292524"}},{label:"Bleu Pro",colors:{primary:"#2563EB",secondary:"#7C3AED",bg:"#0F172A",card:"#1E293B"}},{label:"Vert Nature",colors:{primary:"#16A34A",secondary:"#0891B2",bg:"#14532D",card:"#166534"}},{label:"Rouge BTP",colors:{primary:"#DC2626",secondary:"#D97706",bg:"#1C0A0A",card:"#2C1010"}},{label:"Dark Pro",colors:{primary:"#6366F1",secondary:"#EC4899",bg:"#000000",card:"#111111"}}];
  var companyFields=[["Nom","companyName"],["Adresse","companyAddress"],["Telephone","companyTel"],["Email","companyEmail"],["SIRET / RC","companySiret"]];
  return <div style={{display:"flex",flexDirection:"column",gap:20}}>
    <Card title="Themes" T={T}><div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(5,1fr)",gap:10}}>{presets.map(function(pp){return <button key={pp.label} onClick={function(){Object.keys(pp.colors).forEach(function(k){upT(k,pp.colors[k]);});}} style={{background:pp.colors.card,border:"2px solid "+pp.colors.primary,borderRadius:10,padding:"12px 10px",cursor:"pointer",textAlign:"left"}}><div style={{display:"flex",gap:4,marginBottom:6}}>{Object.values(pp.colors).map(function(c,i){return <div key={i} style={{width:14,height:14,borderRadius:"50%",background:c}}/>;})}</div><div style={{fontSize:11,fontWeight:700,color:pp.colors.primary}}>{pp.label}</div></button>;})}</div></Card>
    <Card title="Entreprise" T={T}>{companyFields.map(function(row){return <div key={row[1]} style={{padding:"10px 0",borderBottom:"1px solid "+T.border}}><label style={{fontSize:11,color:T.muted,display:"block",marginBottom:4}}>{row[0]}</label><input value={T[row[1]]||""} onChange={function(e){upT(row[1],e.target.value);}} style={{width:"100%",background:T.mid,border:"1px solid "+T.border,borderRadius:8,padding:"8px 12px",color:T.white,fontSize:14,outline:"none",boxSizing:"border-box"}}/></div>;})}</Card>
    <div style={{display:"flex",justifyContent:"flex-end"}}><button onClick={resetT} style={{background:T.danger+"22",color:T.danger,border:"1px solid "+T.danger+"44",borderRadius:8,padding:"10px 20px",fontWeight:700,cursor:"pointer"}}>Réinitialiser</button></div>
  </div>;
}
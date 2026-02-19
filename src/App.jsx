import { useState, useEffect, useRef, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

// ── Supabase ──────────────────────────────────────────────────────────────────
const SUPA_URL = "https://mbkwpaxissvvjhewkggl.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ia3dwYXhpc3N2dmpoZXdrZ2dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MjQzOTMsImV4cCI6MjA4NzAwMDM5M30.Zo9aJVDByO8aVSADfSCc2m4jCI1qeXuWYQgVRT-a3LA";
const HDR = { "Content-Type":"application/json","apikey":SUPA_KEY,"Authorization":"Bearer "+SUPA_KEY };
const REST = SUPA_URL+"/rest/v1";

function sbFrom(t){
  var _t=t, _f=[], _o=null, _s="*";
  function url(){ var u=REST+"/"+_t+"?select="+_s; if(_f.length) u+="&"+_f.join("&"); if(_o) u+="&"+_o; return u; }
  var api={
    select: function(s){ _s=s; return api; },
    order:  function(c,o){ _o="order="+c+(o&&o.ascending===false?".desc":".asc"); return api; },
    eq:     function(c,v){ _f.push(c+"=eq."+v); return api; },
    get:    function(){ return fetch(url(),{headers:HDR}).then(function(r){ return r.json().then(function(d){ return r.ok?{data:d,error:null}:{data:null,error:d}; }); }); },
    insert: function(p){ return fetch(REST+"/"+_t,{method:"POST",headers:Object.assign({},HDR,{"Prefer":"return=representation"}),body:JSON.stringify(p)}).then(function(r){ return r.json().then(function(d){ return r.ok?{data:d,error:null}:{data:null,error:d}; }); }); },
    update: function(p){ var u=REST+"/"+_t+(_f.length?"?"+_f.join("&"):""); return fetch(u,{method:"PATCH",headers:Object.assign({},HDR,{"Prefer":"return=representation"}),body:JSON.stringify(p)}).then(function(r){ return r.json().then(function(d){ return r.ok?{data:d,error:null}:{data:null,error:d}; }); }); },
    del:    function(){ var u=REST+"/"+_t+(_f.length?"?"+_f.join("&"):""); return fetch(u,{method:"DELETE",headers:HDR}).then(function(r){ return r.ok?{error:null}:r.json().then(function(d){ return {error:d}; }); }); }
  };
  return api;
}
var sb = { from: sbFrom };

// ── Theme ─────────────────────────────────────────────────────────────────────
const DEFAULT_THEME = {
  primary:"#F97316", secondary:"#3B82F6", success:"#22C55E", danger:"#EF4444", warning:"#EAB308",
  bg:"#1C1917", card:"#292524", mid:"#44403C", border:"#57534E", white:"#FAFAF9", muted:"#A8A29E",
  sidebarWidth:210, borderRadius:12, fontFamily:"'Segoe UI',system-ui,sans-serif",
  companyName:"JEAN BTP SARL", companyAddress:"Zone Industrielle, Abidjan",
  companyTel:"+225 27 00 00 00", companyEmail:"devis@jeanbtp.ci", companySiret:"CI-ABJ-2024-B-12345",
};

function useTheme(){
  const [theme,setTheme] = useState(function(){ try{ var s=localStorage.getItem("jm_theme"); return s?Object.assign({},DEFAULT_THEME,JSON.parse(s)):DEFAULT_THEME; }catch(e){ return DEFAULT_THEME; } });
  function updateTheme(k,v){ setTheme(function(p){ var n=Object.assign({},p); n[k]=v; try{ localStorage.setItem("jm_theme",JSON.stringify(n)); }catch(e){} return n; }); }
  function resetTheme(){ setTheme(DEFAULT_THEME); try{ localStorage.removeItem("jm_theme"); }catch(e){} }
  return { theme, updateTheme, resetTheme };
}

function useBP(){
  const [bp,setBp] = useState(function(){ var w=window.innerWidth; return w<480?"xs":w<768?"sm":w<1024?"md":"lg"; });
  useEffect(function(){
    function fn(){ var w=window.innerWidth; setBp(w<480?"xs":w<768?"sm":w<1024?"md":"lg"); }
    window.addEventListener("resize",fn); return function(){ window.removeEventListener("resize",fn); };
  },[]);
  return { bp, isMobile: bp==="xs"||bp==="sm" };
}

// ── Constants ─────────────────────────────────────────────────────────────────
const CATS = ["Main d'oeuvre","Materiaux","Equipement","Transport","Sous-traitance","Divers"];
const UNITES = ["U","m2","ml","m3","kg","t","forfait","h","j","ens."];

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n){ return new Intl.NumberFormat("fr-FR",{maximumFractionDigits:0}).format(n)+" XOF"; }
function fmtS(n){ var a=Math.abs(n); if(a>=1e6) return (n/1e6).toFixed(1)+"M XOF"; if(a>=1e3) return Math.round(n/1e3)+"k XOF"; return n+" XOF"; }
function pct(v,t){ return t>0?Math.round(v/t*100):0; }
function today(){ return new Date().toISOString().slice(0,10); }
function addDays(d,n){ var dt=new Date(d); dt.setDate(dt.getDate()+n); return dt.toISOString().slice(0,10); }
function stC(s,T){ return ({  "En cours":T.secondary,"En derive":T.danger,"Cloture":T.success,"Planifie":T.warning,"En pause":T.muted,"Brouillon":T.muted,"En reception":T.primary}[s]||T.muted); }
function catC(c,T){ return ({"Main d'oeuvre":T.secondary,"Materiaux":T.primary,"Equipement":T.warning,"Transport":T.success,"Sous-traitance":"#A855F7","Divers":T.muted}[c]||T.muted); }
function totalDep(c){ return (c.depenses||[]).reduce(function(a,d){ return a+Number(d.montant); },0); }
function ssbFn(d,b){ var p=pct(d,b); if(p>100) return "Depassement"; if(p>=80) return "80pct consomme"; return "Conforme"; }
function sbC(s,T){ return ({Conforme:T.success,"80pct consomme":T.warning,Depassement:T.danger}[s]||T.muted); }
function genAlertes(ch,T){
  var al=[];
  ch.forEach(function(c){
    var d=totalDep(c), p=pct(d,c.budgetInitial);
    if(p>100) al.push({niveau:"critique",msg:"Depassement budget : "+p+"%",chantier:c});
    else if(p>=80) al.push({niveau:"warning",msg:"Budget a "+p+"% consomme",chantier:c});
    if(c.statut==="En derive") al.push({niveau:"critique",msg:"Chantier en derive",chantier:c});
  });
  return al;
}
var _seq=1000;
function genNumero(){ _seq++; return "DEV-"+new Date().getFullYear()+"-"+String(_seq).padStart(4,"0"); }

// ── Devis calculs ─────────────────────────────────────────────────────────────
function calcDevis(lots, tauxTVA, tauxRemise){
  var lotsCalc = (lots||[]).map(function(l){
    if(l.type==="article") return Object.assign({},l,{total_ligne:Math.round((l.quantite||0)*(l.prix_unitaire||0))});
    var arts = (l.articles||[]).map(function(a){ return Object.assign({},a,{total_ligne:Math.round((a.quantite||0)*(a.prix_unitaire||0))}); });
    var sousLots = (l.sousLots||[]).map(function(sl){
      var slArts = (sl.articles||[]).map(function(a){ return Object.assign({},a,{total_ligne:Math.round((a.quantite||0)*(a.prix_unitaire||0))}); });
      return Object.assign({},sl,{articles:slArts,total:slArts.reduce(function(s,a){ return s+a.total_ligne; },0)});
    });
    var totalArts = arts.reduce(function(s,a){ return s+a.total_ligne; },0);
    var totalSL = sousLots.reduce(function(s,sl){ return s+sl.total; },0);
    return Object.assign({},l,{articles:arts,sousLots:sousLots,total:totalArts+totalSL});
  });
  var sousTotal = lotsCalc.reduce(function(s,l){ return s+(l.total||l.total_ligne||0); },0);
  var montantRemise = Math.round(sousTotal*(tauxRemise/100));
  var baseImp = sousTotal-montantRemise;
  var montantTVA = Math.round(baseImp*(tauxTVA/100));
  var totalTTC = baseImp+montantTVA;
  return {lots:lotsCalc,sousTotal:sousTotal,montantRemise:montantRemise,baseImp:baseImp,montantTVA:montantTVA,totalTTC:totalTTC};
}

// ── PDF ───────────────────────────────────────────────────────────────────────
function exportPDF(devis, calc, chantierNom, T){
  var ent = {nom:T.companyName,adresse:T.companyAddress,tel:T.companyTel,email:T.companyEmail,siret:T.companySiret};
  var rows="";
  (calc.lots||[]).forEach(function(l,li){
    if(l.type==="lot"){
      rows+='<tr style="background:'+T.primary+'22"><td colspan="6" style="padding:8px 10px;font-weight:800;color:'+T.primary+'">LOT '+(li+1)+' - '+l.nom+'<span style="float:right">'+fmt(l.total)+'</span></td></tr>';
      (l.articles||[]).forEach(function(a,ai){ rows+='<tr><td>'+(li+1)+'.'+(ai+1)+'</td><td>'+a.designation+'</td><td>'+a.quantite+'</td><td>'+a.unite+'</td><td style="text-align:right">'+fmt(a.prix_unitaire)+'</td><td style="text-align:right;font-weight:700;color:'+T.primary+'">'+fmt(a.total_ligne)+'</td></tr>'; });
      (l.sousLots||[]).forEach(function(sl,sli){
        rows+='<tr style="background:'+T.secondary+'11"><td colspan="6" style="padding:6px 20px;font-weight:700;color:'+T.secondary+'">Sous-lot '+(li+1)+'.'+(sli+1)+' - '+sl.nom+'<span style="float:right">'+fmt(sl.total)+'</span></td></tr>';
        (sl.articles||[]).forEach(function(a,ai){ rows+='<tr><td>'+(li+1)+'.'+(sli+1)+'.'+(ai+1)+'</td><td>'+a.designation+'</td><td>'+a.quantite+'</td><td>'+a.unite+'</td><td style="text-align:right">'+fmt(a.prix_unitaire)+'</td><td style="text-align:right;font-weight:700;color:'+T.primary+'">'+fmt(a.total_ligne)+'</td></tr>'; });
      });
    } else if(l.type==="article"){
      rows+='<tr><td>'+(li+1)+'</td><td>'+l.designation+'</td><td>'+l.quantite+'</td><td>'+l.unite+'</td><td style="text-align:right">'+fmt(l.prix_unitaire)+'</td><td style="text-align:right;font-weight:700;color:'+T.primary+'">'+fmt(l.total_ligne)+'</td></tr>';
    }
  });
  var remiseRow = devis.taux_remise>0?'<tr><td>Remise ('+devis.taux_remise+'%)</td><td style="text-align:right;color:#ef4444">- '+fmt(calc.montantRemise)+'</td></tr>':"";
  var html='<!DOCTYPE html><html><head><meta charset="utf-8"><title>Devis '+devis.numero+'</title><style>body{font-family:sans-serif;margin:2cm;font-size:10pt}table{width:100%;border-collapse:collapse}th{background:'+T.primary+';color:#fff;padding:8px}td{padding:7px 10px;border-bottom:1px solid #eee}.ttc{background:'+T.primary+';color:#fff;font-weight:800}</style></head><body><h2 style="color:'+T.primary+'">'+ent.nom+'</h2><p>'+ent.adresse+' | '+ent.tel+' | '+ent.email+'</p><h1>DEVIS '+devis.numero+'</h1><p>Client : <b>'+devis.client_nom+'</b>'+(chantierNom?' | Chantier : '+chantierNom:'')+'</p><p>Date : '+devis.date_creation+' | Validite : '+devis.date_validite+'</p><table><thead><tr><th>#</th><th>Designation</th><th>Qte</th><th>Unite</th><th>P.U. HT</th><th>Total HT</th></tr></thead><tbody>'+rows+'</tbody></table><br><table style="width:300px;margin-left:auto"><tbody><tr><td>Sous-total HT</td><td style="text-align:right">'+fmt(calc.sousTotal)+'</td></tr>'+remiseRow+'<tr><td>TVA ('+devis.taux_tva+'%)</td><td style="text-align:right">'+fmt(calc.montantTVA)+'</td></tr><tr class="ttc"><td>TOTAL TTC</td><td style="text-align:right">'+fmt(calc.totalTTC)+'</td></tr></tbody></table></body></html>';
  var w=window.open("","_blank"); w.document.write(html); w.document.close(); setTimeout(function(){ w.focus(); w.print(); },500);
}

// ── UI Atoms ──────────────────────────────────────────────────────────────────
function Badge({label,color,small}){
  return React.createElement("span",{style:{background:color+"22",color:color,border:"1px solid "+color+"55",borderRadius:6,padding:small?"2px 7px":"3px 10px",fontSize:small?10:11,fontWeight:600,whiteSpace:"nowrap"}},label);
}
function PBar({p,color,h}){
  return React.createElement("div",{style:{background:"#57534E",borderRadius:99,height:h||8,overflow:"hidden"}},
    React.createElement("div",{style:{width:Math.min(p,100)+"%",background:color,height:"100%",borderRadius:99}})
  );
}
function EmptyState({msg,icon}){
  return React.createElement("div",{style:{textAlign:"center",padding:"40px 20px",color:"#A8A29E"}},
    React.createElement("div",{style:{fontSize:40,marginBottom:12}},icon),
    React.createElement("div",{style:{fontSize:14}},msg)
  );
}
function Spinner(){
  return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:200,flexDirection:"column",gap:12}}>
      <div style={{width:36,height:36,border:"4px solid #57534E",borderTopColor:"#F97316",borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
function KpiCard({icon,label,value,color,compact,T}){
  return (
    <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:compact?10:T.borderRadius,padding:compact?"12px 14px":"16px 20px",flex:1,minWidth:compact?100:130}}>
      <div style={{fontSize:compact?18:22,marginBottom:3}}>{icon}</div>
      <div style={{fontSize:compact?15:19,fontWeight:700,color:color||T.white,lineHeight:1.2}}>{value}</div>
      <div style={{fontSize:compact?10:12,color:T.muted,marginTop:2}}>{label}</div>
    </div>
  );
}
function Card({title,children,T}){
  return (
    <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:T.borderRadius,padding:"18px 20px"}}>
      {title&&<div style={{fontWeight:700,fontSize:14,marginBottom:14}}>{title}</div>}
      {children}
    </div>
  );
}
function Modal({title,onClose,onSave,saveLabel,children,T}){
  return (
    <div style={{position:"fixed",inset:0,background:"#00000099",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:"20px 20px 0 0",padding:"24px 20px",width:"100%",maxWidth:860,maxHeight:"96vh",overflow:"auto"}}>
        <div style={{width:40,height:4,background:T.border,borderRadius:99,margin:"0 auto 20px"}}/>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
          <div style={{fontWeight:800,fontSize:16}}>{title}</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:20}}>x</button>
        </div>
        {children}
        {onSave&&(
          <div style={{display:"flex",gap:10,marginTop:20,justifyContent:"flex-end"}}>
            <button onClick={onClose} style={{padding:"10px 20px",background:T.mid,color:T.white,border:"none",borderRadius:10,cursor:"pointer"}}>Annuler</button>
            <button onClick={onSave} style={{padding:"10px 20px",background:T.primary,color:"#fff",border:"none",borderRadius:10,fontWeight:700,cursor:"pointer"}}>{saveLabel||"Enregistrer"}</button>
          </div>
        )}
      </div>
    </div>
  );
}
function FField({label,value,onChange,type,full,placeholder,rows,T}){
  var s={width:"100%",background:T.mid,border:"1px solid "+T.border,borderRadius:8,padding:"10px 12px",color:T.white,fontSize:14,boxSizing:"border-box",outline:"none"};
  return (
    <div style={full?{gridColumn:"1/-1"}:{}}>
      <label style={{fontSize:11,color:T.muted,display:"block",marginBottom:4}}>{label}</label>
      {rows
        ? <textarea value={value} onChange={function(e){ onChange(e.target.value); }} rows={rows} placeholder={placeholder} style={s}/>
        : <input type={type||"text"} value={value} onChange={function(e){ onChange(e.target.value); }} placeholder={placeholder} style={s}/>
      }
    </div>
  );
}
function FSelect({label,value,onChange,options,full,T}){
  return (
    <div style={full?{gridColumn:"1/-1"}:{}}>
      <label style={{fontSize:11,color:T.muted,display:"block",marginBottom:4}}>{label}</label>
      <select value={value} onChange={function(e){ onChange(e.target.value); }} style={{width:"100%",background:T.mid,border:"1px solid "+T.border,borderRadius:8,padding:"10px 12px",color:T.white,fontSize:14,boxSizing:"border-box",outline:"none"}}>
        {options.map(function(o){ return Array.isArray(o)?<option key={o[0]} value={o[0]}>{o[1]}</option>:<option key={o} value={o}>{o}</option>; })}
      </select>
    </div>
  );
}
function FGrid({children,cols}){
  return <div style={{display:"grid",gridTemplateColumns:"repeat("+(cols||2)+",1fr)",gap:12}}>{children}</div>;
}

// ── Data hook ─────────────────────────────────────────────────────────────────
function useData(){
  const [chantiers,setCh] = useState([]);
  const [interventions,setInt] = useState([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState(null);

  function load(){
    setLoading(true); setError(null);
    Promise.all([
      sb.from("chantiers").order("created_at",{ascending:false}).get(),
      sb.from("depenses").order("date",{ascending:false}).get(),
      sb.from("interventions").order("created_at",{ascending:false}).get(),
      sb.from("intervention_depenses").get(),
      sb.from("intervention_todos").get()
    ]).then(function(results){
      var r1=results[0],r2=results[1],r3=results[2],r4=results[3],r5=results[4];
      if(r1.error) throw r1.error;
      var ch=r1.data||[], dep=r2.data||[], intv=r3.data||[], idep=r4.data||[], todos=r5.data||[];
      setCh(ch.map(function(c){ return Object.assign({},c,{budgetInitial:Number(c.budget_initial),dateDebut:c.date_debut,dateFin:c.date_fin,alertes:c.alertes||[],depenses:dep.filter(function(d){ return d.chantier_id===c.id; }).map(function(d){ return Object.assign({},d,{montant:Number(d.montant)}); })}); }));
      setInt(intv.map(function(i){ return Object.assign({},i,{dateCreation:i.date_creation,depenses:idep.filter(function(d){ return d.intervention_id===i.id; }).map(function(d){ return Object.assign({},d,{montant:Number(d.montant)}); }),todos:todos.filter(function(x){ return x.intervention_id===i.id; })}); }));
      setLoading(false);
    }).catch(function(e){ setError("Erreur : "+(e.message||JSON.stringify(e))); setLoading(false); });
  }
  useEffect(function(){ load(); },[]);
  return {chantiers,interventions,loading,error,reload:load};
}

// ═════════════════════════════════════════════════════════════════════════════
// APP ROOT
// ═════════════════════════════════════════════════════════════════════════════
export default function App(){
  const {theme:T,updateTheme,resetTheme} = useTheme();
  const {chantiers,interventions,loading,error,reload} = useData();
  const {isMobile,bp} = useBP();
  const [page,setPage] = useState("dashboard");
  const [selId,setSelId] = useState(null);
  const [onglet,setOnglet] = useState("infos");
  const [drawerOpen,setDrawerOpen] = useState(false);
  const [showNewCh,setShowNewCh] = useState(false);
  const [filterSt,setFilterSt] = useState("Tous");
  const [saving,setSaving] = useState(false);
  const [newChForm,setNewChForm] = useState({nom:"",client:"",localisation:"",type:"Construction",budgetInitial:"",dateDebut:"",dateFin:""});
  const [devis,setDevis] = useState([]);

  var selected = chantiers.find(function(c){ return c.id===selId; });

  function openCh(id){ setSelId(id); setPage("fiche"); setOnglet("infos"); setDrawerOpen(false); }
  function navTo(p){ setPage(p); setDrawerOpen(false); }

  function saveCh(){
    if(!newChForm.nom||!newChForm.budgetInitial) return;
    setSaving(true);
    sb.from("chantiers").insert({nom:newChForm.nom,client:newChForm.client,localisation:newChForm.localisation,type:newChForm.type,budget_initial:parseFloat(newChForm.budgetInitial),date_debut:newChForm.dateDebut||null,date_fin:newChForm.dateFin||null,statut:"Brouillon",alertes:[],score:100,lat:5.35,lng:-4.0}).then(function(){
      setSaving(false); setShowNewCh(false); setNewChForm({nom:"",client:"",localisation:"",type:"Construction",budgetInitial:"",dateDebut:"",dateFin:""}); reload();
    });
  }
  function delCh(id){ sb.from("chantiers").eq("id",id).del().then(function(){ setPage("chantiers"); reload(); }); }

  var nbAl = genAlertes(chantiers,T).filter(function(a){ return a.niveau==="critique"; }).length;
  var nbIntEC = interventions.filter(function(i){ return i.statut==="En cours"; }).length;

  var navItems = [
    {key:"dashboard",icon:"📊",label:"Dashboard"},
    {key:"chantiers",icon:"🏗️",label:"Chantiers"},
    {key:"devis",icon:"📄",label:"Devis"},
    {key:"interventions",icon:"🔧",label:"Interventions",badge:nbIntEC},
    {key:"alertes",icon:"🔔",label:"Alertes",badge:nbAl},
    {key:"kpi",icon:"📈",label:"KPIs"},
    {key:"ia",icon:"🤖",label:"IA"},
    {key:"gestion",icon:"⚙️",label:"Gestion"},
    {key:"styledevis",icon:"🖋",label:"Style Devis"},
    {key:"debourse",icon:"🔢",label:"Debourse Sec"},
    {key:"parametres",icon:"🎨",label:"Apparence"},
  ];

  function NavBtn({n}){
    return (
      <button onClick={function(){ navTo(n.key); }} style={{width:"100%",display:"flex",alignItems:"center",gap:bp==="md"?0:10,padding:"10px",borderRadius:8,border:"none",background:page===n.key?T.primary+"22":"transparent",color:page===n.key?T.primary:T.muted,cursor:"pointer",marginBottom:2,justifyContent:bp==="md"?"center":"flex-start",position:"relative",fontFamily:T.fontFamily}}>
        <span style={{fontSize:19,flexShrink:0}}>{n.icon}</span>
        {bp!=="md"&&<span style={{fontSize:13,fontWeight:page===n.key?700:400,flex:1}}>{n.label}</span>}
        {n.badge>0&&<span style={{position:"absolute",top:4,right:4,background:T.danger,color:"#fff",borderRadius:99,fontSize:9,padding:"1px 5px",fontWeight:700}}>{n.badge}</span>}
      </button>
    );
  }

  function Drawer(){
    return (
      <>
        <div onClick={function(){ setDrawerOpen(false); }} style={{position:"fixed",inset:0,background:"#0007",zIndex:150}}/>
        <div style={{position:"fixed",left:0,top:0,bottom:0,width:280,background:T.card,borderRight:"1px solid "+T.border,zIndex:151,padding:"50px 12px 12px",overflowY:"auto"}}>
          <button onClick={function(){ setDrawerOpen(false); }} style={{position:"absolute",top:16,right:16,background:"none",border:"none",color:T.muted,fontSize:22,cursor:"pointer"}}>x</button>
          <div style={{padding:"0 8px 16px",marginBottom:8,borderBottom:"1px solid "+T.border}}>
            <div style={{fontWeight:700,fontSize:16,color:T.white}}>{T.companyName}</div>
          </div>
          {navItems.map(function(n){ return <NavBtn key={n.key} n={n}/>; })}
          <button onClick={function(){ reload(); setDrawerOpen(false); }} style={{width:"100%",background:T.secondary+"22",border:"1px solid "+T.secondary+"44",color:T.secondary,borderRadius:8,padding:10,fontSize:12,fontWeight:700,cursor:"pointer",marginTop:12}}>Synchroniser</button>
        </div>
      </>
    );
  }

  function BottomBar(){
    return (
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:T.card,borderTop:"1px solid "+T.border,display:"flex",justifyContent:"space-around",padding:"8px 0",zIndex:100}}>
        {navItems.slice(0,5).map(function(n){
          return (
            <button key={n.key} onClick={function(){ navTo(n.key); }} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,background:"none",border:"none",color:page===n.key?T.primary:T.muted,cursor:"pointer",padding:"4px 6px",position:"relative",minWidth:44}}>
              <span style={{fontSize:21}}>{n.icon}</span>
              <span style={{fontSize:9,fontWeight:page===n.key?700:400}}>{n.label}</span>
              {n.badge>0&&<span style={{position:"absolute",top:0,right:2,background:T.danger,color:"#fff",borderRadius:99,fontSize:9,padding:"1px 5px",fontWeight:700}}>{n.badge}</span>}
            </button>
          );
        })}
        <button onClick={function(){ setDrawerOpen(true); }} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,background:"none",border:"none",color:T.muted,cursor:"pointer",padding:"4px 6px",minWidth:44}}>
          <span style={{fontSize:21}}>☰</span><span style={{fontSize:9}}>Plus</span>
        </button>
      </div>
    );
  }

  return (
    <div style={{display:"flex",height:"100vh",background:T.bg,color:T.white,fontFamily:T.fontFamily,overflow:"hidden"}}>
      <style>{`*{box-sizing:border-box;}input,select,textarea{font-size:16px!important;}@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {!isMobile&&(
        <div style={{width:bp==="md"?60:T.sidebarWidth,background:T.card,borderRight:"1px solid "+T.border,display:"flex",flexDirection:"column",flexShrink:0}}>
          <div style={{padding:"18px 12px 16px",borderBottom:"1px solid "+T.border,display:"flex",alignItems:"center",gap:10}}>
            <div style={{background:T.primary,borderRadius:10,width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>🏗</div>
            {bp!=="md"&&<div style={{fontWeight:700,fontSize:13,color:T.white}}>{T.companyName}</div>}
          </div>
          <nav style={{flex:1,padding:"10px 8px",overflowY:"auto"}}>
            {navItems.map(function(n){ return <NavBtn key={n.key} n={n}/>; })}
          </nav>
          {bp!=="md"&&(
            <div style={{padding:8,borderTop:"1px solid "+T.border}}>
              <button onClick={reload} style={{width:"100%",background:T.secondary+"22",border:"1px solid "+T.secondary+"44",color:T.secondary,borderRadius:8,padding:8,fontSize:11,fontWeight:700,cursor:"pointer"}}>Sync</button>
            </div>
          )}
        </div>
      )}

      <div style={{flex:1,overflow:"auto",display:"flex",flexDirection:"column",paddingBottom:isMobile?72:0}}>
        <div style={{background:T.card,borderBottom:"1px solid "+T.border,padding:isMobile?"12px 16px":"12px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,position:"sticky",top:0,zIndex:50}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {isMobile&&<button onClick={function(){ setDrawerOpen(true); }} style={{background:"none",border:"none",color:T.muted,fontSize:22,cursor:"pointer"}}>☰</button>}
            <div style={{fontSize:isMobile?14:16,fontWeight:700}}>
              {page==="fiche"&&selected?"🏗️ "+selected.nom:(navItems.find(function(n){ return n.key===page; })||{icon:"",label:""}).icon+" "+(navItems.find(function(n){ return n.key===page; })||{label:""}).label}
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            {(page==="chantiers"||page==="dashboard")&&<button onClick={function(){ setShowNewCh(true); }} style={{background:T.primary,color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",fontWeight:700,cursor:"pointer",fontSize:13}}>+ Chantier</button>}
            {page==="fiche"&&selected&&<button onClick={function(){ if(window.confirm("Supprimer ?")) delCh(selected.id); }} style={{background:T.danger+"22",color:T.danger,border:"1px solid "+T.danger+"44",borderRadius:8,padding:"7px 12px",fontWeight:700,cursor:"pointer",fontSize:12}}>Supprimer</button>}
          </div>
        </div>

        <div style={{flex:1,overflow:"auto",padding:isMobile?"12px":"24px"}}>
          {loading ? <Spinner/> : error ? (
            <div style={{background:T.danger+"11",border:"1px solid "+T.danger+"44",borderRadius:12,padding:24,textAlign:"center"}}>
              <div style={{color:T.danger,fontWeight:700,marginBottom:8}}>Erreur Supabase</div>
              <div style={{color:T.muted,fontSize:13,marginBottom:16}}>{error}</div>
              <button onClick={reload} style={{background:T.primary,color:"#fff",border:"none",borderRadius:8,padding:"10px 24px",fontWeight:700,cursor:"pointer"}}>Reessayer</button>
            </div>
          ) : (
            <>
              {page==="dashboard"&&<DashboardPage chantiers={chantiers} openCh={openCh} interventions={interventions} devis={devis} navTo={navTo} T={T}/>}
              {page==="chantiers"&&<ChantiersPage chantiers={chantiers} openCh={openCh} filter={filterSt} setFilter={setFilterSt} delCh={delCh} T={T}/>}
              {page==="fiche"&&selected&&<FichePage chantier={selected} onglet={onglet} setOnglet={setOnglet} setPage={setPage} reload={reload} T={T}/>}
              {page==="devis"&&<DevisPage devis={devis} setDevis={setDevis} chantiers={chantiers} T={T}/>}
              {page==="interventions"&&<InterventionsPage interventions={interventions} chantiers={chantiers} reload={reload} T={T}/>}
              {page==="alertes"&&<AlertesPage chantiers={chantiers} openCh={openCh} T={T}/>}
              {page==="kpi"&&<KpiPage chantiers={chantiers} T={T}/>}
              {page==="ia"&&<IAPage chantiers={chantiers} openCh={openCh} interventions={interventions} T={T}/>}
              {page==="gestion"&&<GestionPage chantiers={chantiers} openCh={openCh} reload={reload} T={T}/>}
              {page==="styledevis"&&<StyleDevisPage T={T} updateTheme={updateTheme}/>}
              {page==="debourse"&&<DeboursePage T={T}/>}
              {page==="parametres"&&<ParametresPage T={T} updateTheme={updateTheme} resetTheme={resetTheme}/>}
            </>
          )}
        </div>
      </div>

      {isMobile&&<BottomBar/>}
      {isMobile&&drawerOpen&&<Drawer/>}

      {showNewCh&&(
        <Modal title="+ Nouveau Chantier" onClose={function(){ setShowNewCh(false); }} onSave={saveCh} T={T}>
          {saving?<Spinner/>:(
            <FGrid cols={2}>
              <FField label="Nom *" value={newChForm.nom} onChange={function(v){ setNewChForm(function(p){ return Object.assign({},p,{nom:v}); }); }} full T={T}/>
              <FField label="Client" value={newChForm.client} onChange={function(v){ setNewChForm(function(p){ return Object.assign({},p,{client:v}); }); }} T={T}/>
              <FSelect label="Type" value={newChForm.type} onChange={function(v){ setNewChForm(function(p){ return Object.assign({},p,{type:v}); }); }} options={["Construction","Rehabilitation","Maintenance"]} T={T}/>
              <FField label="Localisation" value={newChForm.localisation} onChange={function(v){ setNewChForm(function(p){ return Object.assign({},p,{localisation:v}); }); }} T={T}/>
              <FField label="Budget (XOF) *" type="number" value={newChForm.budgetInitial} onChange={function(v){ setNewChForm(function(p){ return Object.assign({},p,{budgetInitial:v}); }); }} full T={T}/>
              <FField label="Date debut" type="date" value={newChForm.dateDebut} onChange={function(v){ setNewChForm(function(p){ return Object.assign({},p,{dateDebut:v}); }); }} T={T}/>
              <FField label="Date fin" type="date" value={newChForm.dateFin} onChange={function(v){ setNewChForm(function(p){ return Object.assign({},p,{dateFin:v}); }); }} T={T}/>
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
function DashboardPage({chantiers,openCh,interventions,devis,navTo,T}){
  const {isMobile} = useBP();
  var totalB = chantiers.reduce(function(a,c){ return a+c.budgetInitial; },0);
  var totalD = chantiers.reduce(function(a,c){ return a+totalDep(c); },0);
  var totalCA = devis.filter(function(d){ return d.statut==="accepte"; }).reduce(function(a,d){ return a+d.total_ttc; },0);
  var pieData = [
    {name:"En cours",value:chantiers.filter(function(c){ return c.statut==="En cours"; }).length,color:T.secondary},
    {name:"En derive",value:chantiers.filter(function(c){ return c.statut==="En derive"; }).length,color:T.danger},
    {name:"Planifie",value:chantiers.filter(function(c){ return c.statut==="Planifie"; }).length,color:T.warning},
    {name:"Cloture",value:chantiers.filter(function(c){ return c.statut==="Cloture"; }).length,color:T.success}
  ].filter(function(d){ return d.value>0; });
  var pc = pct(totalD,totalB);
  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(5,1fr)",gap:10}}>
        <KpiCard icon="🏗️" label="Chantiers" value={chantiers.length} color={T.primary} compact={isMobile} T={T}/>
        <KpiCard icon="💰" label="Budget" value={fmtS(totalB)} compact={isMobile} T={T}/>
        <KpiCard icon="📊" label="Consomme" value={pc+"%"} color={pc>80?T.danger:T.success} compact={isMobile} T={T}/>
        <KpiCard icon="📄" label="CA Devis" value={fmtS(totalCA)} color={T.success} compact={isMobile} T={T}/>
        <KpiCard icon="🔧" label="Interventions" value={interventions.filter(function(i){ return i.statut==="En cours"; }).length} color={T.secondary} compact={isMobile} T={T}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:16}}>
        <Card title="Statuts chantiers" T={T}>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={65}>
                {pieData.map(function(d,i){ return <Cell key={i} fill={d.color}/>; })}
              </Pie>
              <Tooltip contentStyle={{background:T.card,border:"1px solid "+T.border,color:T.white}}/>
            </PieChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Chantiers actifs" T={T}>
          {chantiers.filter(function(c){ return c.statut!=="Cloture"&&c.statut!=="Brouillon"; }).slice(0,5).map(function(c){
            var d=totalDep(c), p=pct(d,c.budgetInitial);
            return (
              <div key={c.id} onClick={function(){ openCh(c.id); }} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:"1px solid "+T.border,cursor:"pointer"}}>
                <div style={{flex:2}}><div style={{fontWeight:600,fontSize:13}}>{c.nom}</div><div style={{fontSize:11,color:T.muted}}>{c.client}</div></div>
                <div style={{flex:1}}><PBar p={p} color={p>100?T.danger:p>80?T.warning:T.success} h={6}/><div style={{fontSize:10,color:T.muted,textAlign:"right",marginTop:2}}>{p}%</div></div>
              </div>
            );
          })}
          {chantiers.filter(function(c){ return c.statut!=="Cloture"&&c.statut!=="Brouillon"; }).length===0&&<EmptyState msg="Aucun chantier actif" icon="🏗️"/>}
        </Card>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// CHANTIERS
// ═════════════════════════════════════════════════════════════════════════════
function ChantiersPage({chantiers,openCh,filter,setFilter,delCh,T}){
  const {isMobile} = useBP();
  var sts = ["Tous","Planifie","En cours","En derive","Cloture","Brouillon"];
  var filtered = filter==="Tous"?chantiers:chantiers.filter(function(c){ return c.statut===filter; });
  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4}}>
        {sts.map(function(s){
          return <button key={s} onClick={function(){ setFilter(s); }} style={{padding:"6px 12px",borderRadius:20,border:"1px solid "+(filter===s?T.primary:T.border),background:filter===s?T.primary:"transparent",color:filter===s?"#fff":T.muted,cursor:"pointer",fontSize:12,fontWeight:filter===s?700:400,whiteSpace:"nowrap",flexShrink:0}}>{s}</button>;
        })}
      </div>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(320px,1fr))",gap:14}}>
        {filtered.map(function(c){
          var d=totalDep(c), p=pct(d,c.budgetInitial), s=ssbFn(d,c.budgetInitial);
          return (
            <div key={c.id} onClick={function(){ openCh(c.id); }} style={{background:T.card,border:"1px solid "+(s==="Depassement"?T.danger+"66":T.border),borderRadius:T.borderRadius,padding:16,cursor:"pointer",position:"relative"}}>
              <button onClick={function(e){ e.stopPropagation(); if(window.confirm("Supprimer ?")) delCh(c.id); }} style={{position:"absolute",top:12,right:12,background:T.danger+"22",border:"1px solid "+T.danger+"44",color:T.danger,borderRadius:6,padding:"3px 10px",fontSize:12,cursor:"pointer"}}>Suppr.</button>
              <div style={{marginBottom:10,paddingRight:60}}><div style={{fontWeight:700,fontSize:15}}>{c.nom}</div><div style={{fontSize:12,color:T.muted}}>{c.client}</div></div>
              <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}><Badge label={c.statut} color={stC(c.statut,T)}/><Badge label={c.type} color={T.primary} small/></div>
              <div style={{marginBottom:4}}><div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}><span style={{color:T.muted}}>Budget</span><span style={{fontWeight:700,color:p>100?T.danger:p>80?T.warning:T.success}}>{p}%</span></div><PBar p={p} color={p>100?T.danger:p>80?T.warning:T.success}/></div>
              <div style={{marginTop:8,paddingTop:8,borderTop:"1px solid "+T.border,fontSize:12,color:T.muted}}>{fmtS(d)} / {fmtS(c.budgetInitial)}</div>
            </div>
          );
        })}
      </div>
      {filtered.length===0&&<EmptyState msg="Aucun chantier" icon="🏗️"/>}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// FICHE CHANTIER
// ═════════════════════════════════════════════════════════════════════════════
function FichePage({chantier:c,onglet,setOnglet,setPage,reload,T}){
  const {isMobile} = useBP();
  var dep = totalDep(c), depPct = pct(dep,c.budgetInitial);
  const [showNewDep,setShowNewDep] = useState(false);
  const [depForm,setDepForm] = useState({libelle:"",categorie:"Main d'oeuvre",montant:"",date:today(),note:""});
  const [filterCat,setFilterCat] = useState("Toutes");
  const [saving,setSaving] = useState(false);

  function addDep(){
    if(!depForm.libelle||!depForm.montant) return;
    setSaving(true);
    sb.from("depenses").insert({chantier_id:c.id,libelle:depForm.libelle,categorie:depForm.categorie,montant:parseFloat(depForm.montant),date:depForm.date,note:depForm.note}).then(function(){
      setSaving(false); setShowNewDep(false); setDepForm({libelle:"",categorie:"Main d'oeuvre",montant:"",date:today(),note:""}); reload();
    });
  }
  function delDep(id){ sb.from("depenses").eq("id",id).del().then(function(){ reload(); }); }
  function changeSt(st){ sb.from("chantiers").eq("id",c.id).update({statut:st}).then(function(){ reload(); }); }

  var filteredDep = filterCat==="Toutes"?c.depenses:c.depenses.filter(function(d){ return d.categorie===filterCat; });
  var onglets = ["infos","budget","depenses"];

  return (
    <div style={{display:"flex",flexDirection:"column",gap:0}}>
      <button onClick={function(){ setPage("chantiers"); }} style={{background:"none",border:"none",color:T.primary,cursor:"pointer",fontSize:13,marginBottom:12,textAlign:"left",padding:0}}>Retour</button>
      <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:T.borderRadius,padding:isMobile?16:20,marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:10,marginBottom:12}}>
          <div style={{flex:1}}><div style={{fontSize:isMobile?18:22,fontWeight:800}}>{c.nom}</div><div style={{color:T.muted,fontSize:12,marginTop:4}}>{c.client} - {c.localisation}</div></div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {["En cours","En derive","Planifie","Cloture"].map(function(st){
              return <button key={st} onClick={function(){ changeSt(st); }} style={{padding:"5px 10px",borderRadius:20,border:"1px solid "+(c.statut===st?stC(st,T):T.border),background:c.statut===st?stC(st,T)+"22":"transparent",color:c.statut===st?stC(st,T):T.muted,cursor:"pointer",fontSize:10,fontWeight:c.statut===st?700:400}}>{st}</button>;
            })}
          </div>
        </div>
        <Badge label={c.statut} color={stC(c.statut,T)}/>
      </div>
      <div style={{display:"flex",gap:4,marginBottom:16,overflowX:"auto"}}>
        {onglets.map(function(o){
          return <button key={o} onClick={function(){ setOnglet(o); }} style={{padding:"8px 14px",borderRadius:8,border:"1px solid "+(onglet===o?T.primary:T.border),background:onglet===o?T.primary:T.card,color:onglet===o?"#fff":T.muted,cursor:"pointer",fontSize:12,fontWeight:onglet===o?700:400,whiteSpace:"nowrap",flexShrink:0,textTransform:"capitalize"}}>{o}{o==="depenses"&&c.depenses.length>0&&<span style={{background:T.warning,color:T.card,borderRadius:99,fontSize:9,padding:"1px 5px",fontWeight:800,marginLeft:4}}>{c.depenses.length}</span>}</button>;
        })}
      </div>
      {onglet==="infos"&&(
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14}}>
          <Card title="Informations" T={T}>
            {[["Nom",c.nom],["Client",c.client],["Localisation",c.localisation],["Type",c.type],["Budget",fmt(c.budgetInitial)],["Depenses",fmt(dep)],["Marge",fmt(c.budgetInitial-dep)]].map(function(row){
              return <div key={row[0]} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid "+T.border,fontSize:13,gap:8}}><span style={{color:T.muted}}>{row[0]}</span><span style={{fontWeight:600}}>{row[1]}</span></div>;
            })}
          </Card>
          <Card title="Budget" T={T}>
            <div style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:6}}><span style={{color:T.muted}}>Consomme</span><strong style={{color:depPct>100?T.danger:depPct>80?T.warning:T.success}}>{depPct}%</strong></div><PBar p={depPct} color={depPct>100?T.danger:depPct>80?T.warning:T.success} h={14}/></div>
            {[["Budget",fmt(c.budgetInitial),T.white],["Depenses",fmt(dep),T.warning],["Marge",fmt(c.budgetInitial-dep),c.budgetInitial-dep>=0?T.success:T.danger]].map(function(row){
              return <div key={row[0]} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid "+T.border,fontSize:13}}><span style={{color:T.muted}}>{row[0]}</span><span style={{fontWeight:700,color:row[2]}}>{row[1]}</span></div>;
            })}
          </Card>
        </div>
      )}
      {onglet==="budget"&&(
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:10}}>
          <KpiCard icon="💰" label="Budget" value={fmtS(c.budgetInitial)} compact T={T}/>
          <KpiCard icon="🧾" label="Depenses" value={fmtS(dep)} color={T.warning} compact T={T}/>
          <KpiCard icon="💵" label="Marge" value={fmtS(c.budgetInitial-dep)} color={c.budgetInitial-dep>=0?T.success:T.danger} compact T={T}/>
          <KpiCard icon="📊" label="%" value={depPct+"%"} color={depPct>100?T.danger:depPct>80?T.warning:T.success} compact T={T}/>
        </div>
      )}
      {onglet==="depenses"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"flex",gap:6,justifyContent:"space-between",flexWrap:"wrap"}}>
            <div style={{display:"flex",gap:4,overflowX:"auto"}}>
              {["Toutes"].concat(CATS).map(function(cat){
                return <button key={cat} onClick={function(){ setFilterCat(cat); }} style={{padding:"5px 10px",borderRadius:20,border:"1px solid "+(filterCat===cat?T.primary:T.border),background:filterCat===cat?T.primary:"transparent",color:filterCat===cat?"#fff":T.muted,cursor:"pointer",fontSize:10,whiteSpace:"nowrap",flexShrink:0}}>{cat}</button>;
              })}
            </div>
            <button onClick={function(){ setShowNewDep(true); }} style={{background:T.primary,color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontWeight:700,cursor:"pointer",fontSize:13}}>+ Ajouter</button>
          </div>
          {filteredDep.length===0&&<EmptyState msg="Aucune depense" icon="🧾"/>}
          {filteredDep.map(function(d){
            return (
              <div key={d.id} style={{background:T.card,border:"1px solid "+T.border,borderRadius:10,padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                <div style={{flex:1}}><div style={{fontWeight:700,fontSize:13}}>{d.libelle}</div><div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:4}}><Badge label={d.categorie} color={catC(d.categorie,T)} small/><span style={{fontSize:10,color:T.muted}}>{d.date}</span></div></div>
                <div style={{display:"flex",gap:6,alignItems:"center"}}><span style={{fontWeight:800,color:T.primary,fontSize:14}}>{fmtS(d.montant)}</span><button onClick={function(){ delDep(d.id); }} style={{background:T.danger+"22",border:"1px solid "+T.danger+"44",color:T.danger,borderRadius:6,padding:"4px 8px",fontSize:11,cursor:"pointer"}}>X</button></div>
              </div>
            );
          })}
          {showNewDep&&(
            <Modal title="Nouvelle Depense" onClose={function(){ setShowNewDep(false); }} onSave={addDep} T={T}>
              {saving?<Spinner/>:(
                <FGrid cols={2}>
                  <FField label="Libelle *" value={depForm.libelle} onChange={function(v){ setDepForm(function(p){ return Object.assign({},p,{libelle:v}); }); }} full T={T}/>
                  <FSelect label="Categorie" value={depForm.categorie} onChange={function(v){ setDepForm(function(p){ return Object.assign({},p,{categorie:v}); }); }} options={CATS} T={T}/>
                  <FField label="Montant" type="number" value={depForm.montant} onChange={function(v){ setDepForm(function(p){ return Object.assign({},p,{montant:v}); }); }} T={T}/>
                  <FField label="Date" type="date" value={depForm.date} onChange={function(v){ setDepForm(function(p){ return Object.assign({},p,{date:v}); }); }} T={T}/>
                  <FField label="Note" value={depForm.note} onChange={function(v){ setDepForm(function(p){ return Object.assign({},p,{note:v}); }); }} full T={T}/>
                </FGrid>
              )}
            </Modal>
          )}
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// DEVIS
// ═════════════════════════════════════════════════════════════════════════════
function DevisPage({devis,setDevis,chantiers,T}){
  const {isMobile} = useBP();
  const [showForm,setShowForm] = useState(false);
  const [editDevis,setEditDevis] = useState(null);
  const [filterSt,setFilterSt] = useState("Tous");
  var statuts = ["Tous","brouillon","envoye","accepte","refuse"];
  var filtered = filterSt==="Tous"?devis:devis.filter(function(d){ return d.statut===filterSt; });
  var SDC = {brouillon:T.muted,envoye:T.secondary,accepte:T.success,refuse:T.danger};
  var totalCA = devis.filter(function(d){ return d.statut==="accepte"; }).reduce(function(a,d){ return a+d.total_ttc; },0);
  var txConv = devis.length>0?Math.round(devis.filter(function(d){ return d.statut==="accepte"; }).length/devis.length*100):0;

  function handleSave(d){ setDevis(function(p){ return editDevis?p.map(function(x){ return x.id===d.id?d:x; }):[d].concat(p); }); setShowForm(false); setEditDevis(null); }
  function handleDel(id){ setDevis(function(p){ return p.filter(function(d){ return d.id!==id; }); }); }
  function handleSt(id,s){ setDevis(function(p){ return p.map(function(d){ return d.id===id?Object.assign({},d,{statut:s}):d; }); }); }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:10}}>
        <KpiCard icon="📄" label="Total" value={devis.length} color={T.primary} compact={isMobile} T={T}/>
        <KpiCard icon="✅" label="Acceptes" value={devis.filter(function(d){ return d.statut==="accepte"; }).length} color={T.success} compact={isMobile} T={T}/>
        <KpiCard icon="💰" label="CA accepte" value={fmtS(totalCA)} color={T.success} compact={isMobile} T={T}/>
        <KpiCard icon="📊" label="Taux conv." value={txConv+"%"} color={txConv>50?T.success:txConv>25?T.warning:T.danger} compact={isMobile} T={T}/>
      </div>
      <div style={{display:"flex",gap:6,justifyContent:"space-between",alignItems:"center",flexWrap:"wrap"}}>
        <div style={{display:"flex",gap:4,overflowX:"auto"}}>
          {statuts.map(function(s){ return <button key={s} onClick={function(){ setFilterSt(s); }} style={{padding:"5px 12px",borderRadius:20,border:"1px solid "+(filterSt===s?T.primary:T.border),background:filterSt===s?T.primary:"transparent",color:filterSt===s?"#fff":T.muted,cursor:"pointer",fontSize:11,whiteSpace:"nowrap",flexShrink:0}}>{s}</button>; })}
        </div>
        <button onClick={function(){ setEditDevis(null); setShowForm(true); }} style={{background:T.primary,color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontWeight:700,cursor:"pointer",fontSize:13}}>+ Nouveau devis</button>
      </div>
      {filtered.length===0&&<EmptyState msg="Aucun devis" icon="📄"/>}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(360px,1fr))",gap:14}}>
        {filtered.map(function(d){
          var ch = chantiers.find(function(c){ return c.id===d.chantier_id; });
          return (
            <div key={d.id} style={{background:T.card,border:"1px solid "+T.border,borderRadius:T.borderRadius,padding:18,display:"flex",flexDirection:"column",gap:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                <div><div style={{fontWeight:800,fontSize:15,color:T.primary}}>{d.numero}</div><div style={{fontWeight:600,fontSize:14,marginTop:2}}>{d.client_nom}</div><div style={{fontSize:11,color:T.muted,marginTop:2}}>{d.date_creation} - validite : {d.date_validite}</div>{ch&&<div style={{fontSize:11,color:T.muted}}>🏗 {ch.nom}</div>}</div>
                <Badge label={d.statut} color={SDC[d.statut]||T.muted}/>
              </div>
              <div style={{background:T.mid,borderRadius:8,padding:"10px 14px"}}>
                <div style={{fontSize:10,color:T.muted}}>TOTAL TTC</div>
                <div style={{fontWeight:800,fontSize:18,color:T.primary}}>{fmt(d.total_ttc)}</div>
                <div style={{fontSize:10,color:T.muted}}>HT : {fmt(d.sous_total)} - TVA {d.taux_tva}%</div>
              </div>
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                {["brouillon","envoye","accepte","refuse"].map(function(s){ return <button key={s} onClick={function(){ handleSt(d.id,s); }} style={{padding:"4px 10px",borderRadius:20,border:"1px solid "+(d.statut===s?(SDC[s]||T.primary):T.border),background:d.statut===s?(SDC[s]||T.primary)+"22":"transparent",color:d.statut===s?(SDC[s]||T.primary):T.muted,cursor:"pointer",fontSize:10}}>{s}</button>; })}
              </div>
              <div style={{display:"flex",gap:6}}>
                <button onClick={function(){ exportPDF(d,calcDevis(d.lots||[],d.taux_tva||18,d.taux_remise||0),ch&&ch.nom,T); }} style={{flex:1,background:T.secondary+"22",color:T.secondary,border:"1px solid "+T.secondary+"44",borderRadius:8,padding:"7px",fontSize:12,cursor:"pointer",fontWeight:600}}>PDF</button>
                <button onClick={function(){ setEditDevis(d); setShowForm(true); }} style={{background:T.warning+"22",color:T.warning,border:"1px solid "+T.warning+"44",borderRadius:8,padding:"7px 10px",fontSize:12,cursor:"pointer"}}>Editer</button>
                <button onClick={function(){ if(window.confirm("Supprimer ?")) handleDel(d.id); }} style={{background:T.danger+"22",color:T.danger,border:"1px solid "+T.danger+"44",borderRadius:8,padding:"7px 10px",fontSize:12,cursor:"pointer"}}>X</button>
              </div>
            </div>
          );
        })}
      </div>
      {showForm&&<DevisForm chantiers={chantiers} editDevis={editDevis} onSave={handleSave} onClose={function(){ setShowForm(false); setEditDevis(null); }} T={T}/>}
    </div>
  );
}

function DevisForm({chantiers,editDevis,onSave,onClose,T}){
  const {isMobile} = useBP();
  function newArt(){ return {id:Date.now()+Math.random(),designation:"",quantite:1,unite:"U",prix_unitaire:0}; }
  function newLot(){ return {id:Date.now()+Math.random(),type:"lot",nom:"",articles:[newArt()],sousLots:[]}; }

  var initLots = editDevis&&editDevis.lots ? editDevis.lots : [Object.assign(newLot(),{nom:"Lot 1 - Gros oeuvre"})];
  var initForm = editDevis ? editDevis : {id:Date.now(),numero:genNumero(),statut:"brouillon",client_nom:"",client_adresse:"",client_telephone:"",client_email:"",chantier_id:"",date_creation:today(),date_validite:addDays(today(),30),taux_tva:18,taux_remise:0,conditions_paiement:"30% a la commande, 40% a mi-chantier, 30% a reception.",notes:"",lots:initLots};

  const [form,setForm] = useState(initForm);
  function up(k,v){ setForm(function(p){ return Object.assign({},p,{[k]:v}); }); }
  function upLots(fn){ setForm(function(p){ return Object.assign({},p,{lots:fn(p.lots)}); }); }

  function addLot(){ upLots(function(ls){ return ls.concat([Object.assign(newLot(),{nom:"Lot "+(ls.filter(function(l){ return l.type==="lot"; }).length+1)})]); }); }
  function addArticleLibre(){ upLots(function(ls){ return ls.concat([Object.assign({id:Date.now(),type:"article"},newArt())]); }); }
  function delLot(id){ upLots(function(ls){ return ls.filter(function(l){ return l.id!==id; }); }); }
  function upLot(id,k,v){ upLots(function(ls){ return ls.map(function(l){ return l.id===id?Object.assign({},l,{[k]:v}):l; }); }); }
  function addArtToLot(lotId){ upLots(function(ls){ return ls.map(function(l){ return l.id===lotId?Object.assign({},l,{articles:(l.articles||[]).concat([newArt()])}):l; }); }); }
  function delArtFromLot(lotId,artId){ upLots(function(ls){ return ls.map(function(l){ return l.id===lotId?Object.assign({},l,{articles:(l.articles||[]).filter(function(a){ return a.id!==artId; })}):l; }); }); }
  function upArtInLot(lotId,artId,k,v){ upLots(function(ls){ return ls.map(function(l){ return l.id===lotId?Object.assign({},l,{articles:(l.articles||[]).map(function(a){ return a.id===artId?Object.assign({},a,{[k]:v}):a; })}):l; }); }); }
  function upArtLibre(id,k,v){ upLots(function(ls){ return ls.map(function(l){ return l.id===id&&l.type==="article"?Object.assign({},l,{[k]:v}):l; }); }); }

  var calc = calcDevis(form.lots,form.taux_tva,form.taux_remise);

  function handleSave(){
    if(!form.client_nom){ alert("Nom du client requis."); return; }
    onSave(Object.assign({},form,{lots:calc.lots,sous_total:calc.sousTotal,montant_tva:calc.montantTVA,montant_remise:calc.montantRemise,total_ttc:calc.totalTTC}));
  }

  function ArtRow({a,onUp,onDel}){
    var tl = Math.round((a.quantite||0)*(a.prix_unitaire||0));
    return (
      <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:6,flexWrap:isMobile?"wrap":"nowrap"}}>
        <input value={a.designation} onChange={function(e){ onUp("designation",e.target.value); }} placeholder="Designation..." style={{flex:2,background:T.bg,border:"1px solid "+T.border,borderRadius:7,padding:"7px 10px",color:T.white,fontSize:13,outline:"none",minWidth:isMobile?"100%":0}}/>
        <input type="number" value={a.quantite} onChange={function(e){ onUp("quantite",parseFloat(e.target.value)||0); }} style={{width:70,background:T.bg,border:"1px solid "+T.border,borderRadius:7,padding:"7px 8px",color:T.white,fontSize:13,outline:"none",textAlign:"center"}}/>
        <select value={a.unite} onChange={function(e){ onUp("unite",e.target.value); }} style={{width:75,background:T.bg,border:"1px solid "+T.border,borderRadius:7,padding:"7px 6px",color:T.white,fontSize:12,outline:"none"}}>
          {UNITES.map(function(u){ return <option key={u} value={u}>{u}</option>; })}
        </select>
        <input type="number" value={a.prix_unitaire} onChange={function(e){ onUp("prix_unitaire",parseFloat(e.target.value)||0); }} style={{width:100,background:T.bg,border:"1px solid "+T.border,borderRadius:7,padding:"7px 8px",color:T.white,fontSize:13,outline:"none",textAlign:"right"}}/>
        <div style={{width:100,textAlign:"right",fontWeight:700,color:T.primary,fontSize:12}}>{fmtS(tl)}</div>
        <button onClick={onDel} style={{background:T.danger+"22",border:"none",color:T.danger,borderRadius:6,padding:"6px 8px",cursor:"pointer"}}>X</button>
      </div>
    );
  }

  return (
    <div style={{position:"fixed",inset:0,background:"#00000099",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:"20px 20px 0 0",width:"100%",maxWidth:860,maxHeight:"96vh",overflow:"auto",padding:"24px 20px"}}>
        <div style={{width:40,height:4,background:T.border,borderRadius:99,margin:"0 auto 20px"}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div><div style={{fontWeight:800,fontSize:18}}>{editDevis?"Modifier":"Nouveau"} Devis</div><div style={{fontSize:12,color:T.primary,fontWeight:700,marginTop:2}}>{form.numero}</div></div>
          <button onClick={onClose} style={{background:"none",border:"none",color:T.muted,fontSize:22,cursor:"pointer"}}>x</button>
        </div>

        <div style={{fontWeight:700,fontSize:13,color:T.primary,margin:"0 0 10px",borderBottom:"1px solid "+T.border,paddingBottom:6}}>Client</div>
        <FGrid cols={isMobile?1:2}>
          <FField label="Nom client *" value={form.client_nom} onChange={function(v){ up("client_nom",v); }} full={isMobile} T={T}/>
          <FSelect label="Chantier" value={form.chantier_id} onChange={function(v){ up("chantier_id",v); }} options={[["","- Aucun -"]].concat(chantiers.map(function(c){ return [c.id,c.nom]; }))} T={T}/>
          <FField label="Adresse" value={form.client_adresse} onChange={function(v){ up("client_adresse",v); }} T={T}/>
          <FField label="Telephone" value={form.client_telephone} onChange={function(v){ up("client_telephone",v); }} T={T}/>
          <FField label="Email" value={form.client_email} onChange={function(v){ up("client_email",v); }} type="email" T={T}/>
          <FField label="Validite" value={form.date_validite} onChange={function(v){ up("date_validite",v); }} type="date" T={T}/>
        </FGrid>

        <div style={{fontWeight:700,fontSize:13,color:T.primary,margin:"16px 0 10px",borderBottom:"1px solid "+T.border,paddingBottom:6}}>Lots et Articles</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {form.lots.map(function(l,li){
            if(l.type==="article"){
              return (
                <div key={l.id} style={{background:T.mid,borderRadius:8,padding:"10px 12px"}}>
                  <ArtRow a={l} onUp={function(k,v){ upArtLibre(l.id,k,v); }} onDel={function(){ delLot(l.id); }}/>
                </div>
              );
            }
            var lotCalc = calc.lots.find(function(x){ return x.id===l.id; });
            var lotTotal = lotCalc ? lotCalc.total : 0;
            return (
              <div key={l.id} style={{background:T.mid,border:"2px solid "+T.primary+"44",borderRadius:10,overflow:"hidden"}}>
                <div style={{background:T.primary+"22",padding:"10px 14px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                  <span style={{background:T.primary,color:"#fff",borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:800}}>LOT {li+1}</span>
                  <input value={l.nom} onChange={function(e){ upLot(l.id,"nom",e.target.value); }} placeholder="Nom du lot..." style={{flex:1,background:"transparent",border:"none",borderBottom:"1px dashed "+T.primary+"66",color:T.white,fontSize:14,fontWeight:700,outline:"none",padding:"2px 0",minWidth:120}}/>
                  <div style={{fontWeight:800,color:T.primary,fontSize:14}}>{fmtS(lotTotal)}</div>
                  <button onClick={function(){ delLot(l.id); }} style={{background:T.danger+"22",border:"1px solid "+T.danger+"44",color:T.danger,borderRadius:6,padding:"4px 10px",fontSize:11,cursor:"pointer"}}>X Lot</button>
                </div>
                <div style={{padding:"12px 14px",display:"flex",flexDirection:"column",gap:6}}>
                  {(l.articles||[]).map(function(a){ return <ArtRow key={a.id} a={a} onUp={function(k,v){ upArtInLot(l.id,a.id,k,v); }} onDel={function(){ delArtFromLot(l.id,a.id); }}/>; })}
                  <button onClick={function(){ addArtToLot(l.id); }} style={{background:T.primary+"11",border:"1px dashed "+T.primary+"55",color:T.primary,borderRadius:7,padding:"6px 12px",fontSize:11,cursor:"pointer",textAlign:"left",fontWeight:600}}>+ Article</button>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{display:"flex",gap:8,marginTop:10}}>
          <button onClick={addLot} style={{flex:1,background:T.primary+"22",border:"2px dashed "+T.primary+"66",color:T.primary,borderRadius:10,padding:"10px",fontWeight:700,cursor:"pointer"}}>+ Lot</button>
          <button onClick={addArticleLibre} style={{flex:1,background:T.mid,border:"2px dashed "+T.border,color:T.muted,borderRadius:10,padding:"10px",fontWeight:700,cursor:"pointer"}}>+ Article libre</button>
        </div>

        <div style={{fontWeight:700,fontSize:13,color:T.primary,margin:"16px 0 10px",borderBottom:"1px solid "+T.border,paddingBottom:6}}>Financier</div>
        <FGrid cols={isMobile?1:3}>
          <FField label="TVA (%)" type="number" value={form.taux_tva} onChange={function(v){ up("taux_tva",parseFloat(v)||0); }} T={T}/>
          <FField label="Remise (%)" type="number" value={form.taux_remise} onChange={function(v){ up("taux_remise",parseFloat(v)||0); }} T={T}/>
          <div style={{background:T.primary+"11",border:"1px solid "+T.primary+"44",borderRadius:8,padding:"10px 14px"}}>
            <div style={{fontSize:10,color:T.muted}}>TOTAL TTC</div>
            <div style={{fontWeight:800,fontSize:18,color:T.primary}}>{fmt(calc.totalTTC)}</div>
          </div>
        </FGrid>
        <div style={{background:T.mid,borderRadius:10,padding:"12px 16px",marginTop:10}}>
          {[["Sous-total HT",fmt(calc.sousTotal),T.white],["TVA",fmt(calc.montantTVA),T.muted]].map(function(row){
            return <div key={row[0]} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",fontSize:13,borderBottom:"1px solid "+T.border}}><span style={{color:T.muted}}>{row[0]}</span><span style={{fontWeight:600,color:row[2]}}>{row[1]}</span></div>;
          })}
          <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",marginTop:4}}><span style={{fontWeight:700}}>TOTAL TTC</span><span style={{fontWeight:800,fontSize:16,color:T.primary}}>{fmt(calc.totalTTC)}</span></div>
        </div>

        <div style={{fontWeight:700,fontSize:13,color:T.primary,margin:"16px 0 10px",borderBottom:"1px solid "+T.border,paddingBottom:6}}>Conditions</div>
        <FGrid cols={1}>
          <FField label="Conditions de paiement" value={form.conditions_paiement} onChange={function(v){ up("conditions_paiement",v); }} rows={2} full T={T}/>
          <FField label="Notes" value={form.notes} onChange={function(v){ up("notes",v); }} rows={2} full T={T}/>
        </FGrid>

        <div style={{display:"flex",gap:10,marginTop:20,justifyContent:"flex-end",flexWrap:"wrap"}}>
          <button onClick={onClose} style={{padding:"10px 20px",background:T.mid,color:T.white,border:"none",borderRadius:10,cursor:"pointer"}}>Annuler</button>
          <button onClick={handleSave} style={{padding:"10px 24px",background:T.primary,color:"#fff",border:"none",borderRadius:10,fontWeight:700,cursor:"pointer",fontSize:14}}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// INTERVENTIONS
// ═════════════════════════════════════════════════════════════════════════════
function InterventionsPage({interventions,chantiers,reload,T}){
  const {isMobile} = useBP();
  const [filterT,setFilterT] = useState("Tous");
  const [filterS,setFilterS] = useState("Tous");
  const [showNew,setShowNew] = useState(false);
  const [saving,setSaving] = useState(false);
  const [form,setForm] = useState({titre:"",description:"",type:"Corrective",intervenant:"",chantier:"",client:"",dateCreation:today(),duree:"",statut:"En attente"});
  var types = ["Tous","Urgence","Preventive","Corrective","Inspection"];
  var statuts = ["Tous","En attente","En cours","Terminee"];
  var filtered = interventions.filter(function(i){ return (filterT==="Tous"||i.type===filterT)&&(filterS==="Tous"||i.statut===filterS); });
  var STIC = {"En attente":T.warning,"En cours":T.secondary,"Terminee":T.success};
  function totalIntDep(i){ return (i.depenses||[]).reduce(function(a,d){ return a+Number(d.montant); },0); }
  function updateSt(id,s){ sb.from("interventions").eq("id",id).update({statut:s}).then(function(){ reload(); }); }
  function delInt(id){ sb.from("interventions").eq("id",id).del().then(function(){ reload(); }); }
  function saveNew(){
    if(!form.titre) return;
    setSaving(true);
    sb.from("interventions").insert({titre:form.titre,description:form.description,type:form.type,intervenant:form.intervenant,chantier:form.chantier,client:form.client,date_creation:form.dateCreation,duree:parseInt(form.duree)||1,statut:form.statut,facturee:false}).then(function(){
      setSaving(false); setShowNew(false); reload();
    });
  }
  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:10}}>
        <KpiCard icon="🔧" label="Total" value={interventions.length} color={T.primary} compact={isMobile} T={T}/>
        <KpiCard icon="🚨" label="Urgences" value={interventions.filter(function(i){ return i.type==="Urgence"; }).length} color={T.danger} compact={isMobile} T={T}/>
        <KpiCard icon="⚙️" label="En cours" value={interventions.filter(function(i){ return i.statut==="En cours"; }).length} color={T.secondary} compact={isMobile} T={T}/>
        <KpiCard icon="💰" label="Cout" value={fmtS(interventions.reduce(function(a,i){ return a+totalIntDep(i); },0))} color={T.warning} compact={isMobile} T={T}/>
      </div>
      <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:T.borderRadius,padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>
        <div style={{display:"flex",gap:4,overflowX:"auto"}}>{types.map(function(t){ return <button key={t} onClick={function(){ setFilterT(t); }} style={{padding:"5px 10px",borderRadius:20,border:"1px solid "+(filterT===t?T.primary:T.border),background:filterT===t?T.primary:"transparent",color:filterT===t?"#fff":T.muted,cursor:"pointer",fontSize:11,whiteSpace:"nowrap",flexShrink:0}}>{t}</button>; })}</div>
        <div style={{display:"flex",gap:4,justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",gap:4,overflowX:"auto"}}>{statuts.map(function(s){ return <button key={s} onClick={function(){ setFilterS(s); }} style={{padding:"5px 10px",borderRadius:20,border:"1px solid "+(filterS===s?T.primary:T.border),background:filterS===s?T.primary:"transparent",color:filterS===s?"#fff":T.muted,cursor:"pointer",fontSize:11,whiteSpace:"nowrap",flexShrink:0}}>{s}</button>; })}</div>
          <button onClick={function(){ setShowNew(true); }} style={{background:T.primary,color:"#fff",border:"none",borderRadius:8,padding:"6px 14px",fontWeight:700,cursor:"pointer",fontSize:12}}>+ Nouvelle</button>
        </div>
      </div>
      {filtered.length===0&&<EmptyState msg="Aucune intervention" icon="🔧"/>}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(340px,1fr))",gap:12}}>
        {filtered.map(function(i){
          return (
            <div key={i.id} style={{background:T.card,border:"1px solid "+(i.type==="Urgence"?T.danger+"66":T.border),borderRadius:T.borderRadius,padding:16,display:"flex",flexDirection:"column",gap:10}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:8}}>
                <div style={{flex:1}}><div style={{fontWeight:700,fontSize:14}}>{i.titre}</div><div style={{fontSize:11,color:T.muted}}>{i.chantier||"-"} - {i.dateCreation}</div></div>
                <Badge label={i.type} color={{Urgence:T.danger,Preventive:T.secondary,Corrective:T.primary,Inspection:"#A855F7"}[i.type]||T.primary} small/>
              </div>
              {i.description&&<div style={{fontSize:12,color:T.muted,background:T.mid,borderRadius:6,padding:"7px 10px"}}>{i.description}</div>}
              <div style={{background:T.mid,borderRadius:8,padding:"10px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div><div style={{fontSize:10,color:T.muted}}>Cout</div><div style={{fontWeight:800,color:T.primary,fontSize:15}}>{fmtS(totalIntDep(i))}</div></div>
                <Badge label={i.facturee?"Facturee":"Non facturee"} color={i.facturee?T.success:T.danger} small/>
              </div>
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <select value={i.statut} onChange={function(e){ updateSt(i.id,e.target.value); }} style={{flex:1,background:(STIC[i.statut]||T.muted)+"22",border:"1px solid "+(STIC[i.statut]||T.muted)+"55",borderRadius:6,padding:"5px 10px",color:STIC[i.statut]||T.muted,fontSize:12,cursor:"pointer",outline:"none",fontWeight:700}}>
                  {["En attente","En cours","Terminee"].map(function(s){ return <option key={s} value={s}>{s}</option>; })}
                </select>
                <button onClick={function(){ delInt(i.id); }} style={{background:T.danger+"22",border:"1px solid "+T.danger+"44",color:T.danger,borderRadius:6,padding:"6px 10px",fontSize:12,cursor:"pointer"}}>X</button>
              </div>
            </div>
          );
        })}
      </div>
      {showNew&&(
        <Modal title="Nouvelle Intervention" onClose={function(){ setShowNew(false); }} onSave={saveNew} T={T}>
          {saving?<Spinner/>:(
            <FGrid cols={2}>
              <FField label="Titre *" value={form.titre} onChange={function(v){ setForm(function(p){ return Object.assign({},p,{titre:v}); }); }} full T={T}/>
              <FSelect label="Type" value={form.type} onChange={function(v){ setForm(function(p){ return Object.assign({},p,{type:v}); }); }} options={["Urgence","Preventive","Corrective","Inspection"]} T={T}/>
              <FSelect label="Statut" value={form.statut} onChange={function(v){ setForm(function(p){ return Object.assign({},p,{statut:v}); }); }} options={["En attente","En cours","Terminee"]} T={T}/>
              <FField label="Intervenant" value={form.intervenant} onChange={function(v){ setForm(function(p){ return Object.assign({},p,{intervenant:v}); }); }} T={T}/>
              <FSelect label="Chantier" value={form.chantier} onChange={function(v){ setForm(function(p){ return Object.assign({},p,{chantier:v}); }); }} options={[""].concat(chantiers.map(function(c){ return c.nom; }))} T={T}/>
              <FField label="Date" type="date" value={form.dateCreation} onChange={function(v){ setForm(function(p){ return Object.assign({},p,{dateCreation:v}); }); }} T={T}/>
              <FField label="Description" value={form.description} onChange={function(v){ setForm(function(p){ return Object.assign({},p,{description:v}); }); }} rows={3} full T={T}/>
            </FGrid>
          )}
        </Modal>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ALERTES
// ═════════════════════════════════════════════════════════════════════════════
function AlertesPage({chantiers,openCh,T}){
  var alertes = genAlertes(chantiers,T);
  var col = {critique:T.danger,warning:T.warning,info:T.secondary};
  return (
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {alertes.length===0&&<EmptyState msg="Aucune alerte" icon="✅"/>}
      {alertes.map(function(al,i){
        return (
          <div key={i} onClick={function(){ openCh(al.chantier.id); }} style={{background:T.card,border:"1px solid "+(col[al.niveau]||T.border)+"55",borderRadius:T.borderRadius,padding:"14px 16px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
            <div><div style={{fontWeight:600,fontSize:13,color:col[al.niveau]}}>⚠ {al.msg}</div><div style={{fontSize:11,color:T.muted,marginTop:3}}>{al.chantier.nom} - {al.chantier.client}</div></div>
            <Badge label={al.chantier.statut} color={stC(al.chantier.statut,T)}/>
          </div>
        );
      })}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// KPI
// ═════════════════════════════════════════════════════════════════════════════
function KpiPage({chantiers,T}){
  const {isMobile} = useBP();
  var totalB = chantiers.reduce(function(a,c){ return a+c.budgetInitial; },0);
  var totalD = chantiers.reduce(function(a,c){ return a+totalDep(c); },0);
  var marge = totalB-totalD;
  var pc = pct(totalD,totalB);
  var allDep = chantiers.reduce(function(a,c){ return a.concat(c.depenses); },[]);
  var depCat = CATS.map(function(cat){ return {cat:cat,total:allDep.filter(function(d){ return d.categorie===cat; }).reduce(function(a,d){ return a+Number(d.montant); },0)}; }).filter(function(x){ return x.total>0; });
  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:10}}>
        <KpiCard icon="💰" label="Budget" value={fmtS(totalB)} compact={isMobile} T={T}/>
        <KpiCard icon="🧾" label="Depenses" value={fmtS(totalD)} color={T.warning} compact={isMobile} T={T}/>
        <KpiCard icon="💵" label="Marge" value={fmtS(marge)} color={marge>=0?T.success:T.danger} compact={isMobile} T={T}/>
        <KpiCard icon="📉" label="Consomme" value={pc+"%"} color={pc>100?T.danger:pc>80?T.warning:T.success} compact={isMobile} T={T}/>
      </div>
      <Card title="Depenses par categorie" T={T}>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={depCat} layout="vertical" margin={{left:5,right:5}}>
            <XAxis type="number" tick={{fill:T.muted,fontSize:9}} tickFormatter={function(v){ return Math.round(v/1000)+"k"; }}/>
            <YAxis type="category" dataKey="cat" tick={{fill:T.muted,fontSize:10}} width={80}/>
            <Tooltip contentStyle={{background:T.card,border:"1px solid "+T.border,color:T.white}} formatter={function(v){ return fmtS(v); }}/>
            <Bar dataKey="total" radius={[0,4,4,0]}>
              {depCat.map(function(d,i){ return <Cell key={i} fill={catC(d.cat,T)}/>; })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Par chantier" T={T}>
        {chantiers.map(function(c){
          var d=totalDep(c), p=pct(d,c.budgetInitial);
          return (
            <div key={c.id} style={{padding:"8px 0",borderBottom:"1px solid "+T.border}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}><span style={{fontWeight:600}}>{c.nom}</span><span style={{fontWeight:700,color:p>100?T.danger:p>80?T.warning:T.success}}>{p}%</span></div>
              <PBar p={p} color={p>100?T.danger:p>80?T.warning:T.success} h={6}/>
            </div>
          );
        })}
        {chantiers.length===0&&<EmptyState msg="Aucun chantier" icon="📊"/>}
      </Card>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// IA
// ═════════════════════════════════════════════════════════════════════════════
function IAPage({chantiers,openCh,interventions,T}){
  const [analysing,setAnalysing] = useState(false);
  const [iaResult,setIaResult] = useState(null);
  const [iaError,setIaError] = useState(null);

  function runIA(){
    setAnalysing(true); setIaError(null); setIaResult(null);
    var ctx = {
      chantiers: chantiers.map(function(c){ return {nom:c.nom,client:c.client,statut:c.statut,budgetInitial:c.budgetInitial,depensesTotal:totalDep(c)}; }),
      interventions: interventions.map(function(i){ return {titre:i.titre,type:i.type,statut:i.statut}; })
    };
    fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:"Expert BTP. Analyse ce portefeuille (XOF). Reponds UNIQUEMENT en JSON:\n"+JSON.stringify(ctx)+"\n\nFormat: {\"recommandations\":[{\"titre\":string,\"detail\":string,\"priorite\":\"haute\"|\"moyenne\"|\"basse\"}],\"scoreGlobal\":number,\"synthese\":string}"}]})})
    .then(function(res){ return res.json(); })
    .then(function(data){
      var text = (data.content||[]).map(function(i){ return i.text||""; }).join("");
      setIaResult(JSON.parse(text.replace(/```json|```/g,"").trim()));
      setAnalysing(false);
    })
    .catch(function(e){ setIaError("Erreur IA : "+e.message); setAnalysing(false); });
  }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{background:T.primary+"11",border:"1px solid "+T.primary+"44",borderRadius:T.borderRadius,padding:18}}>
        <div style={{fontSize:18,fontWeight:800,marginBottom:4}}>🤖 Intelligence Artificielle</div>
        <div style={{color:T.muted,fontSize:12,marginBottom:12}}>Analyse automatique du portefeuille</div>
        <button onClick={runIA} disabled={analysing} style={{background:T.primary,color:"#fff",border:"none",borderRadius:10,padding:"10px 20px",fontWeight:700,cursor:analysing?"wait":"pointer",fontSize:14}}>{analysing?"Analyse...":"Lancer l'analyse"}</button>
        {iaError&&<div style={{color:T.danger,fontSize:12,marginTop:10}}>{iaError}</div>}
      </div>
      {!iaResult&&!analysing&&<EmptyState msg="Lancez l'analyse IA" icon="🤖"/>}
      {analysing&&<Spinner/>}
      {iaResult&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{background:T.primary+"11",border:"1px solid "+T.primary+"44",borderRadius:T.borderRadius,padding:16}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
              <div style={{fontWeight:800,fontSize:15}}>Synthese</div>
              <div style={{background:(iaResult.scoreGlobal>70?T.success:iaResult.scoreGlobal>40?T.warning:T.danger)+"22",borderRadius:8,padding:"4px 12px",fontWeight:800,color:iaResult.scoreGlobal>70?T.success:iaResult.scoreGlobal>40?T.warning:T.danger}}>Score : {iaResult.scoreGlobal}/100</div>
            </div>
            <div style={{fontSize:13,color:T.muted}}>{iaResult.synthese}</div>
          </div>
          <Card title="Recommandations" T={T}>
            {(iaResult.recommandations||[]).map(function(r,i){
              var col = r.priorite==="haute"?T.danger:r.priorite==="moyenne"?T.warning:T.success;
              return (
                <div key={i} style={{background:col+"11",border:"1px solid "+col+"33",borderRadius:8,padding:"12px",marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}><div style={{fontWeight:700,color:col,fontSize:13}}>{r.titre}</div><Badge label={"Priorite "+r.priorite} color={col} small/></div>
                  <div style={{fontSize:12,color:T.muted,marginTop:4}}>{r.detail}</div>
                </div>
              );
            })}
          </Card>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// GESTION
// ═════════════════════════════════════════════════════════════════════════════
function GestionPage({chantiers,openCh,reload,T}){
  const {isMobile} = useBP();
  const [confirmId,setConfirmId] = useState(null);
  const [search,setSearch] = useState("");
  var filtered = chantiers.filter(function(c){ return c.nom.toLowerCase().includes(search.toLowerCase())||c.client.toLowerCase().includes(search.toLowerCase()); });
  function delCh(id){ sb.from("chantiers").eq("id",id).del().then(function(){ setConfirmId(null); reload(); }); }
  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:10}}>
        <KpiCard icon="🏗️" label="Total" value={chantiers.length} color={T.primary} compact={isMobile} T={T}/>
        <KpiCard icon="✅" label="Clotures" value={chantiers.filter(function(c){ return c.statut==="Cloture"; }).length} color={T.success} compact={isMobile} T={T}/>
        <KpiCard icon="⚙️" label="En cours" value={chantiers.filter(function(c){ return c.statut==="En cours"; }).length} color={T.secondary} compact={isMobile} T={T}/>
        <KpiCard icon="🚨" label="Derives" value={chantiers.filter(function(c){ return c.statut==="En derive"; }).length} color={T.danger} compact={isMobile} T={T}/>
      </div>
      <Card title="Projets" T={T}>
        <input value={search} onChange={function(e){ setSearch(e.target.value); }} placeholder="Rechercher..." style={{width:"100%",background:T.mid,border:"1px solid "+T.border,borderRadius:8,padding:"10px 14px",color:T.white,fontSize:14,boxSizing:"border-box",outline:"none",marginBottom:14}}/>
        {filtered.map(function(c){
          var dep=totalDep(c), p=pct(dep,c.budgetInitial);
          return (
            <div key={c.id} style={{background:T.mid,border:"1px solid "+(confirmId===c.id?T.danger+"88":T.border),borderRadius:T.borderRadius,padding:"12px 14px",marginBottom:8}}>
              {confirmId===c.id?(
                <div><div style={{fontWeight:700,color:T.danger,marginBottom:8}}>Supprimer "{c.nom}" ?</div>
                <div style={{display:"flex",gap:10}}><button onClick={function(){ setConfirmId(null); }} style={{flex:1,padding:"9px",background:T.card,color:T.white,border:"1px solid "+T.border,borderRadius:8,cursor:"pointer"}}>Annuler</button><button onClick={function(){ delCh(c.id); }} style={{flex:1,padding:"9px",background:T.danger,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700}}>Supprimer</button></div></div>
              ):(
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",gap:8,marginBottom:6}}><div><div style={{fontWeight:700,fontSize:14}}>{c.nom}</div><div style={{fontSize:11,color:T.muted}}>{c.client}</div></div><Badge label={c.statut} color={stC(c.statut,T)} small/></div>
                  <div style={{marginBottom:8}}><div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.muted,marginBottom:3}}><span>{fmtS(dep)}</span><span style={{fontWeight:700,color:p>100?T.danger:p>80?T.warning:T.success}}>{p}%</span></div><PBar p={p} color={p>100?T.danger:p>80?T.warning:T.success} h={6}/></div>
                  <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><button onClick={function(){ openCh(c.id); }} style={{background:T.secondary+"22",border:"1px solid "+T.secondary+"44",color:T.secondary,borderRadius:7,padding:"7px 14px",fontSize:12,cursor:"pointer",fontWeight:600}}>Ouvrir</button><button onClick={function(){ setConfirmId(c.id); }} style={{background:T.danger+"22",border:"1px solid "+T.danger+"44",color:T.danger,borderRadius:7,padding:"7px 12px",fontSize:12,cursor:"pointer",fontWeight:700}}>X</button></div>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length===0&&<EmptyState msg="Aucun projet" icon="🔍"/>}
      </Card>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// STYLE DEVIS PAGE
// ═════════════════════════════════════════════════════════════════════════════
function StyleDevisPage({T, updateTheme}){
  const {isMobile} = useBP();
  const fileEntRef = useRef();
  const fileCliRef = useRef();

  function loadLogo(ref, key){
    ref.current.click();
    ref.current.onchange = function(e){
      var f = e.target.files[0];
      if(!f) return;
      var r = new FileReader();
      r.onload = function(ev){ updateTheme(key, ev.target.result); };
      r.readAsDataURL(f);
    };
  }

  function ColorRow({label, k}){
    return (
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid "+T.border}}>
        <div style={{fontSize:13,fontWeight:600}}>{label}</div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:28,height:28,borderRadius:6,background:T[k],border:"2px solid "+T.border}}/>
          <input type="color" value={T[k]||"#000000"} onChange={function(e){ updateTheme(k,e.target.value); }} style={{width:36,height:28,border:"none",borderRadius:6,cursor:"pointer",padding:2,background:"none"}}/>
        </div>
      </div>
    );
  }

  // Live preview of the devis header
  var previewBg = T.devisBg || "#ffffff";
  var previewAccent = T.devisAccent || T.primary;
  var previewText = T.devisText || "#222222";
  var previewTableHead = T.devisTableHead || T.primary;
  var previewTableHeadText = T.devisTableHeadText || "#ffffff";
  var previewTotalBg = T.devisTotalBg || T.primary;
  var previewBorderRadius = T.devisBorderRadius !== undefined ? T.devisBorderRadius : 8;
  var previewFont = T.devisFont || "sans-serif";

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>

      {/* LOGOS */}
      <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:T.borderRadius,padding:"18px 20px"}}>
        <div style={{fontWeight:700,fontSize:15,marginBottom:14}}>🖼 Logos</div>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:16}}>

          {/* Logo entreprise */}
          <div style={{background:T.mid,borderRadius:10,padding:14,display:"flex",flexDirection:"column",gap:10,alignItems:"center"}}>
            <div style={{fontSize:12,color:T.muted,fontWeight:700}}>LOGO ENTREPRISE</div>
            {T.logoEntreprise
              ? <img src={T.logoEntreprise} alt="logo" style={{maxWidth:140,maxHeight:80,objectFit:"contain",borderRadius:6,background:"#fff",padding:4}}/>
              : <div style={{width:140,height:80,border:"2px dashed "+T.border,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",color:T.muted,fontSize:12}}>Aucun logo</div>
            }
            <div style={{display:"flex",gap:8}}>
              <input ref={fileEntRef} type="file" accept="image/*" style={{display:"none"}}/>
              <button onClick={function(){ loadLogo(fileEntRef,"logoEntreprise"); }} style={{background:T.primary,color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>Choisir</button>
              {T.logoEntreprise&&<button onClick={function(){ updateTheme("logoEntreprise",""); }} style={{background:T.danger+"22",color:T.danger,border:"1px solid "+T.danger+"44",borderRadius:8,padding:"7px 12px",fontSize:12,cursor:"pointer"}}>X</button>}
            </div>
          </div>

          {/* Logo client */}
          <div style={{background:T.mid,borderRadius:10,padding:14,display:"flex",flexDirection:"column",gap:10,alignItems:"center"}}>
            <div style={{fontSize:12,color:T.muted,fontWeight:700}}>LOGO CLIENT (par defaut)</div>
            {T.logoClient
              ? <img src={T.logoClient} alt="logo client" style={{maxWidth:140,maxHeight:80,objectFit:"contain",borderRadius:6,background:"#fff",padding:4}}/>
              : <div style={{width:140,height:80,border:"2px dashed "+T.border,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",color:T.muted,fontSize:12}}>Aucun logo</div>
            }
            <div style={{display:"flex",gap:8}}>
              <input ref={fileCliRef} type="file" accept="image/*" style={{display:"none"}}/>
              <button onClick={function(){ loadLogo(fileCliRef,"logoClient"); }} style={{background:T.secondary,color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>Choisir</button>
              {T.logoClient&&<button onClick={function(){ updateTheme("logoClient",""); }} style={{background:T.danger+"22",color:T.danger,border:"1px solid "+T.danger+"44",borderRadius:8,padding:"7px 12px",fontSize:12,cursor:"pointer"}}>X</button>}
            </div>
          </div>
        </div>
        <div style={{marginTop:10,fontSize:11,color:T.muted}}>Les logos apparaitront dans l'apercu et le PDF du devis. Format recommande : PNG transparent, max 500Ko.</div>
      </div>

      {/* COULEURS DEVIS */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:20}}>
        <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:T.borderRadius,padding:"18px 20px"}}>
          <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>🎨 Couleurs du devis</div>
          <ColorRow label="Fond general" k="devisBg"/>
          <ColorRow label="Couleur accent / titres" k="devisAccent"/>
          <ColorRow label="Texte principal" k="devisText"/>
          <ColorRow label="En-tete tableau" k="devisTableHead"/>
          <ColorRow label="Texte en-tete tableau" k="devisTableHeadText"/>
          <ColorRow label="Bandeau total TTC" k="devisTotalBg"/>
        </div>

        {/* TYPOGRAPHIE & MISE EN PAGE */}
        <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:T.borderRadius,padding:"18px 20px"}}>
          <div style={{fontWeight:700,fontSize:15,marginBottom:14}}>🔤 Typographie & Mise en page</div>

          <div style={{marginBottom:12}}>
            <label style={{fontSize:11,color:T.muted,display:"block",marginBottom:4}}>Police du devis</label>
            <select value={T.devisFont||"sans-serif"} onChange={function(e){ updateTheme("devisFont",e.target.value); }} style={{width:"100%",background:T.mid,border:"1px solid "+T.border,borderRadius:8,padding:"9px 12px",color:T.white,fontSize:14,outline:"none"}}>
              {["sans-serif","serif","monospace","Arial, sans-serif","Georgia, serif","Courier New, monospace","Trebuchet MS, sans-serif"].map(function(f){ return <option key={f} value={f}>{f.split(",")[0]}</option>; })}
            </select>
          </div>

          <div style={{marginBottom:12}}>
            <label style={{fontSize:11,color:T.muted,display:"block",marginBottom:4}}>Rayon des coins (px) : {previewBorderRadius}</label>
            <input type="range" min={0} max={20} value={previewBorderRadius} onChange={function(e){ updateTheme("devisBorderRadius",parseInt(e.target.value)); }} style={{width:"100%",accentColor:T.primary}}/>
          </div>

          <div style={{marginBottom:12}}>
            <label style={{fontSize:11,color:T.muted,display:"block",marginBottom:4}}>Titre du devis (texte libre)</label>
            <input value={T.devisTitre||"DEVIS"} onChange={function(e){ updateTheme("devisTitre",e.target.value); }} style={{width:"100%",background:T.mid,border:"1px solid "+T.border,borderRadius:8,padding:"9px 12px",color:T.white,fontSize:14,outline:"none",boxSizing:"border-box"}}/>
          </div>

          <div style={{marginBottom:12}}>
            <label style={{fontSize:11,color:T.muted,display:"block",marginBottom:4}}>Mention pied de page</label>
            <textarea value={T.devisMention||""} onChange={function(e){ updateTheme("devisMention",e.target.value); }} rows={2} placeholder="Mention legale, IBAN, site web..." style={{width:"100%",background:T.mid,border:"1px solid "+T.border,borderRadius:8,padding:"9px 12px",color:T.white,fontSize:13,outline:"none",boxSizing:"border-box",resize:"vertical"}}/>
          </div>

          <div>
            <label style={{fontSize:11,color:T.muted,display:"block",marginBottom:6}}>Afficher les colonnes</label>
            {[["showColRef","N° reference"],["showColUnite","Unite"],["showColPU","P.U. HT"],["showColTotal","Total HT"]].map(function(col){
              var checked = T[col[0]] !== false;
              return (
                <div key={col[0]} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                  <div onClick={function(){ updateTheme(col[0],!checked); }} style={{width:36,height:20,borderRadius:10,background:checked?T.primary:T.mid,cursor:"pointer",position:"relative",transition:"background .2s"}}>
                    <div style={{position:"absolute",top:2,left:checked?18:2,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left .2s"}}/>
                  </div>
                  <span style={{fontSize:13}}>{col[1]}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* APERCU LIVE */}
      <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:T.borderRadius,padding:"18px 20px"}}>
        <div style={{fontWeight:700,fontSize:15,marginBottom:14}}>👁 Apercu du devis</div>
        <div style={{background:previewBg,borderRadius:previewBorderRadius,padding:isMobile?"14px":"24px",fontFamily:previewFont,color:previewText,border:"1px solid #ddd"}}>

          {/* Header preview */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16,gap:12,flexWrap:"wrap"}}>
            <div style={{display:"flex",gap:12,alignItems:"center"}}>
              {T.logoEntreprise
                ? <img src={T.logoEntreprise} alt="logo" style={{height:52,maxWidth:120,objectFit:"contain"}}/>
                : <div style={{width:52,height:52,background:previewAccent,borderRadius:previewBorderRadius,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,color:"#fff"}}>🏗</div>
              }
              <div>
                <div style={{fontSize:15,fontWeight:800,color:previewAccent}}>{T.companyName}</div>
                <div style={{fontSize:10,color:"#777",lineHeight:1.6}}>{T.companyAddress}<br/>{T.companyTel}</div>
              </div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{background:previewAccent,color:"#fff",borderRadius:previewBorderRadius,padding:"5px 16px",fontWeight:800,fontSize:14,display:"inline-block"}}>{T.devisTitre||"DEVIS"}</div>
              <div style={{fontSize:10,color:"#777",marginTop:6,lineHeight:1.7}}>N° DEV-2025-0001<br/>Date : {today()}</div>
            </div>
          </div>

          {/* Client row */}
          <div style={{background:previewAccent+"15",borderLeft:"4px solid "+previewAccent,borderRadius:previewBorderRadius,padding:"10px 14px",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
            <div>
              <div style={{fontSize:9,color:"#999",fontWeight:700,letterSpacing:1}}>CLIENT</div>
              <div style={{fontWeight:700,fontSize:13}}>CLIENT EXEMPLE SARL</div>
              <div style={{fontSize:11,color:"#666"}}>Abidjan, Cote d'Ivoire</div>
            </div>
            {T.logoClient&&<img src={T.logoClient} alt="client" style={{height:40,maxWidth:80,objectFit:"contain"}}/>}
          </div>

          {/* Table preview */}
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:10,marginBottom:12}}>
            <thead>
              <tr style={{background:previewTableHead,color:previewTableHeadText}}>
                {T.showColRef!==false&&<th style={{padding:"6px 8px",textAlign:"left"}}>Ref</th>}
                <th style={{padding:"6px 8px",textAlign:"left"}}>Designation</th>
                <th style={{padding:"6px 8px",textAlign:"center"}}>Qte</th>
                {T.showColUnite!==false&&<th style={{padding:"6px 8px",textAlign:"center"}}>Unite</th>}
                {T.showColPU!==false&&<th style={{padding:"6px 8px",textAlign:"right"}}>P.U. HT</th>}
                {T.showColTotal!==false&&<th style={{padding:"6px 8px",textAlign:"right"}}>Total HT</th>}
              </tr>
            </thead>
            <tbody>
              {[["Fondations beton",2,"m3",85000],["Maconnerie parpaing",50,"m2",12000],["Couverture tole",1,"forfait",450000]].map(function(row,i){
                var tl = row[1]*row[3];
                return (
                  <tr key={i} style={{background:i%2===0?"#fff":"#f8f8f8",borderBottom:"1px solid #eee"}}>
                    {T.showColRef!==false&&<td style={{padding:"5px 8px",color:"#999"}}>{i+1}</td>}
                    <td style={{padding:"5px 8px"}}>{row[0]}</td>
                    <td style={{padding:"5px 8px",textAlign:"center"}}>{row[1]}</td>
                    {T.showColUnite!==false&&<td style={{padding:"5px 8px",textAlign:"center",color:"#888"}}>{row[2]}</td>}
                    {T.showColPU!==false&&<td style={{padding:"5px 8px",textAlign:"right"}}>{fmt(row[3])}</td>}
                    {T.showColTotal!==false&&<td style={{padding:"5px 8px",textAlign:"right",fontWeight:700,color:previewAccent}}>{fmt(tl)}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Total */}
          <div style={{display:"flex",justifyContent:"flex-end"}}>
            <table style={{width:220,borderCollapse:"collapse",fontSize:11}}>
              <tbody>
                <tr><td style={{padding:"5px 10px",color:"#666"}}>Sous-total HT</td><td style={{padding:"5px 10px",textAlign:"right",fontWeight:600}}>{fmt(1164000)}</td></tr>
                <tr><td style={{padding:"5px 10px",color:"#666"}}>TVA (18%)</td><td style={{padding:"5px 10px",textAlign:"right",fontWeight:600}}>{fmt(209520)}</td></tr>
                <tr style={{background:previewTotalBg,color:"#fff"}}><td style={{padding:"8px 10px",fontWeight:800}}>TOTAL TTC</td><td style={{padding:"8px 10px",textAlign:"right",fontWeight:800}}>{fmt(1373520)}</td></tr>
              </tbody>
            </table>
          </div>

          {T.devisMention&&<div style={{marginTop:12,padding:"8px 12px",background:"#f5f5f5",borderRadius:previewBorderRadius,fontSize:10,color:"#777"}}>{T.devisMention}</div>}
        </div>
      </div>

      <div style={{display:"flex",justifyContent:"flex-end"}}>
        <button onClick={function(){
          ["devisBg","devisAccent","devisText","devisTableHead","devisTableHeadText","devisTotalBg","devisFont","devisBorderRadius","devisTitre","devisMention","showColRef","showColUnite","showColPU","showColTotal","logoEntreprise","logoClient"].forEach(function(k){ updateTheme(k, DEFAULT_THEME[k] !== undefined ? DEFAULT_THEME[k] : undefined); });
        }} style={{background:T.danger+"22",color:T.danger,border:"1px solid "+T.danger+"44",borderRadius:8,padding:"10px 20px",fontWeight:700,cursor:"pointer"}}>
          Reinitialiser le style devis
        </button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// PARAMETRES
// ═════════════════════════════════════════════════════════════════════════════
function ParametresPage({T,updateTheme,resetTheme}){
  const {isMobile} = useBP();
  var presets = [
    {label:"BTP Orange",colors:{primary:"#F97316",secondary:"#3B82F6",bg:"#1C1917",card:"#292524"}},
    {label:"Bleu Pro",colors:{primary:"#2563EB",secondary:"#7C3AED",bg:"#0F172A",card:"#1E293B"}},
    {label:"Vert Nature",colors:{primary:"#16A34A",secondary:"#0891B2",bg:"#14532D",card:"#166534"}},
    {label:"Rouge BTP",colors:{primary:"#DC2626",secondary:"#D97706",bg:"#1C0A0A",card:"#2C1010"}},
    {label:"Dark Pro",colors:{primary:"#6366F1",secondary:"#EC4899",bg:"#000000",card:"#111111"}},
  ];
  function ColorRow({label,k}){
    return (
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid "+T.border}}>
        <div><div style={{fontSize:13,fontWeight:600}}>{label}</div><div style={{fontSize:11,color:T.muted,marginTop:2}}>{T[k]}</div></div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:32,height:32,borderRadius:8,background:T[k],border:"2px solid "+T.border}}/>
          <input type="color" value={T[k]} onChange={function(e){ updateTheme(k,e.target.value); }} style={{width:40,height:32,border:"none",borderRadius:6,cursor:"pointer",padding:2,background:"none"}}/>
        </div>
      </div>
    );
  }
  function TextRow({label,k,placeholder}){
    return (
      <div style={{padding:"10px 0",borderBottom:"1px solid "+T.border}}>
        <div style={{fontSize:11,color:T.muted,marginBottom:5}}>{label}</div>
        <input value={T[k]} onChange={function(e){ updateTheme(k,e.target.value); }} placeholder={placeholder} style={{width:"100%",background:T.mid,border:"1px solid "+T.border,borderRadius:8,padding:"8px 12px",color:T.white,fontSize:14,outline:"none",boxSizing:"border-box"}}/>
      </div>
    );
  }
  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:T.borderRadius,padding:"18px 20px"}}>
        <div style={{fontWeight:700,fontSize:14,marginBottom:14}}>Themes predefinies</div>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)",gap:10}}>
          {presets.map(function(p){
            return (
              <button key={p.label} onClick={function(){ Object.entries(p.colors).forEach(function(e){ updateTheme(e[0],e[1]); }); }} style={{background:p.colors.card,border:"2px solid "+p.colors.primary,borderRadius:10,padding:"12px",cursor:"pointer",textAlign:"left"}}>
                <div style={{display:"flex",gap:6,marginBottom:8}}>{Object.values(p.colors).map(function(c,i){ return <div key={i} style={{width:16,height:16,borderRadius:"50%",background:c}}/>; })}</div>
                <div style={{fontSize:12,fontWeight:700,color:p.colors.primary}}>{p.label}</div>
              </button>
            );
          })}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:20}}>
        <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:T.borderRadius,padding:"18px 20px"}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:4}}>Couleurs</div>
          <ColorRow label="Couleur principale" k="primary"/>
          <ColorRow label="Couleur secondaire" k="secondary"/>
          <ColorRow label="Succes" k="success"/>
          <ColorRow label="Danger" k="danger"/>
          <ColorRow label="Avertissement" k="warning"/>
          <ColorRow label="Fond general" k="bg"/>
          <ColorRow label="Fond carte" k="card"/>
        </div>
        <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:T.borderRadius,padding:"18px 20px"}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:4}}>Informations entreprise</div>
          <TextRow label="Nom entreprise" k="companyName" placeholder="JEAN BTP SARL"/>
          <TextRow label="Adresse" k="companyAddress" placeholder="Zone Industrielle, Abidjan"/>
          <TextRow label="Telephone" k="companyTel" placeholder="+225 27 00 00 00"/>
          <TextRow label="Email" k="companyEmail" placeholder="devis@jeanbtp.ci"/>
          <TextRow label="SIRET / RC" k="companySiret" placeholder="CI-ABJ-2024-B-12345"/>
        </div>
      </div>
      <div style={{display:"flex",justifyContent:"flex-end"}}>
        <button onClick={resetTheme} style={{background:T.danger+"22",color:T.danger,border:"1px solid "+T.danger+"44",borderRadius:8,padding:"10px 20px",fontWeight:700,cursor:"pointer"}}>Reinitialiser le theme</button>
      </div>
    </div>
  );
}
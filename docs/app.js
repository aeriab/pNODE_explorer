'use strict';
// ===================================================================== //
//  tipNODE Antibiotic Explorer — front end
// ===================================================================== //
const SVGNS = 'http://www.w3.org/2000/svg';
const PAD_L = 8, PAD_R = 14, LANE_H = 22, ABX_AXIS_H = 20, COMP_AXIS_H = 20;
const DOM_THRESH = 0.30;
const MAX_HORIZON = 90;   // always forecast/scroll to the full horizon we offer
const VIEW_DAYS = 45;     // days that fill the viewport at default zoom (scroll for the rest)
const TOP_N = 15;         // genera named in the legend (ranked over the whole trajectory)

const cvar = (name) => getComputedStyle(document.body).getPropertyValue(name).trim();

// ===================================================================== //
//  Taxa colours & ordering — Xavier / MSKCC (Ying Taur `yingtools2`) method
// ===================================================================== //
// Colour is assigned by TAXONOMY, not by abundance. Every genus is mapped to a
// palette GROUP keyed on its phylum / class / order / family, using the anchor
// hues the Xavier lab uses (Enterococcus green, Proteobacteria red, Bacteroidia
// teal, Lachnospiraceae salmon, Ruminococcaceae olive, other Clostridia tan,
// Actinobacteria mauve …) — extended with a distinct hue per remaining class so
// nothing collapses to grey. Within a group each member genus gets its own shade
// (a light→dark ramp, a port of yingtools2 `shades()`), so related organisms read
// as one colour family. Taxa are then STACKED in palette-group order so similar
// colours sit adjacent, with one hard rule: Enterococcus (group 0) is always drawn
// first — i.e. pinned to the very bottom of every stack.
const TAXONOMY = {"Abiotrophia":["Firmicutes","Bacilli","Lactobacillales","Aerococcaceae"],"Achromobacter":["Proteobacteria","Gammaproteobacteria","Burkholderiales","Alcaligenaceae"],"Acidaminococcus":["Firmicutes","Negativicutes","Selenomonadales","Acidaminococcaceae"],"Actinomyces":["Actinobacteria","Actinobacteria","Actinomycetales","Actinomycetaceae"],"Adlercreutzia":["Actinobacteria","Coriobacteriia","Coriobacteriales","Eggerthellaceae"],"Agathobacter":["Firmicutes","Clostridia","Clostridiales","Lachnospiraceae"],"Akkermansia":["Verrucomicrobia","Verrucomicrobiae","Verrucomicrobiales","Akkermansiaceae"],"Alistipes":["Bacteroidetes","Bacteroidia","Bacteroidales","Rikenellaceae"],"Alloscardovia":["Actinobacteria","Actinobacteria","Bifidobacteriales","Bifidobacteriaceae"],"Anaerococcus":["Firmicutes","Clostridia","Clostridiales","Family XI"],"Anaerofustis":["Firmicutes","Clostridia","Clostridiales","Eubacteriaceae"],"Anaerostipes":["Firmicutes","Clostridia","Clostridiales","Lachnospiraceae"],"Atopobium":["Actinobacteria","Coriobacteriia","Coriobacteriales","Atopobiaceae"],"Bacteroides":["Bacteroidetes","Bacteroidia","Bacteroidales","Bacteroidaceae"],"Bifidobacterium":["Actinobacteria","Actinobacteria","Bifidobacteriales","Bifidobacteriaceae"],"Bilophila":["Proteobacteria","Deltaproteobacteria","Desulfovibrionales","Desulfovibrionaceae"],"Blautia":["Firmicutes","Clostridia","Clostridiales","Lachnospiraceae"],"Butyricicoccus":["Firmicutes","Clostridia","Clostridiales","Ruminococcaceae"],"Candidatus Stoquefichus":["Firmicutes","Erysipelotrichia","Erysipelotrichales","Erysipelotrichaceae"],"Catabacter":["Firmicutes","Clostridia","Clostridiales","Catabacteraceae"],"Christensenellaceae R-7 group":["Firmicutes","Clostridia","Clostridiales","Christensenellaceae"],"Clostridioides":["Firmicutes","Clostridia","Clostridiales","Peptostreptococcaceae"],"Clostridium sensu stricto 1":["Firmicutes","Clostridia","Clostridiales","Clostridiaceae 1"],"Collinsella":["Actinobacteria","Coriobacteriia","Coriobacteriales","Coriobacteriaceae"],"Coprobacillus":["Firmicutes","Erysipelotrichia","Erysipelotrichales","Erysipelotrichaceae"],"Coprococcus 3":["Firmicutes","Clostridia","Clostridiales","Lachnospiraceae"],"Corynebacterium":["Actinobacteria","Actinobacteria","Corynebacteriales","Corynebacteriaceae"],"Corynebacterium 1":["Actinobacteria","Actinobacteria","Corynebacteriales","Corynebacteriaceae"],"Cuneatibacter":["Firmicutes","Clostridia","Clostridiales","Lachnospiraceae"],"Cutibacterium":["Actinobacteria","Actinobacteria","Propionibacteriales","Propionibacteriaceae"],"DTU089":["Firmicutes","Clostridia","Clostridiales","Ruminococcaceae"],"Dialister":["Firmicutes","Negativicutes","Selenomonadales","Veillonellaceae"],"Dorea":["Firmicutes","Clostridia","Clostridiales","Lachnospiraceae"],"Eggerthella":["Actinobacteria","Coriobacteriia","Coriobacteriales","Eggerthellaceae"],"Eisenbergiella":["Firmicutes","Clostridia","Clostridiales","Lachnospiraceae"],"Enterococcus":["Firmicutes","Bacilli","Lactobacillales","Enterococcaceae"],"Erysipelatoclostridium":["Firmicutes","Erysipelotrichia","Erysipelotrichales","Erysipelotrichaceae"],"Erysipelotrichaceae UCG-003":["Firmicutes","Erysipelotrichia","Erysipelotrichales","Erysipelotrichaceae"],"Escherichia-Shigella":["Proteobacteria","Gammaproteobacteria","Enterobacterales","Enterobacteriaceae"],"Eubacterium":["Firmicutes","Clostridia","Clostridiales","Eubacteriaceae"],"F0332":["Bacteroidetes","Bacteroidia","Bacteroidales","Prevotellaceae"],"Faecalibacterium":["Firmicutes","Clostridia","Clostridiales","Ruminococcaceae"],"Faecalitalea":["Firmicutes","Erysipelotrichia","Erysipelotrichales","Erysipelotrichaceae"],"Family XIII AD3011 group":["Firmicutes","Clostridia","Clostridiales","Family XIII"],"Finegoldia":["Firmicutes","Clostridia","Clostridiales","Family XI"],"Flavonifractor":["Firmicutes","Clostridia","Clostridiales","Ruminococcaceae"],"Fournierella":["Firmicutes","Clostridia","Clostridiales","Ruminococcaceae"],"Fusicatenibacter":["Firmicutes","Clostridia","Clostridiales","Lachnospiraceae"],"Fusobacterium":["Fusobacteria","Fusobacteriia","Fusobacteriales","Fusobacteriaceae"],"GCA-900066575":["Firmicutes","Clostridia","Clostridiales","Lachnospiraceae"],"Gemella":["Firmicutes","Bacilli","Bacillales","Gemellaceae"],"Haemophilus":["Proteobacteria","Gammaproteobacteria","Pasteurellales","Pasteurellaceae"],"Holdemanella":["Firmicutes","Erysipelotrichia","Erysipelotrichales","Erysipelotrichaceae"],"Holdemania":["Firmicutes","Erysipelotrichia","Erysipelotrichales","Erysipelotrichaceae"],"Hungatella":["Firmicutes","Clostridia","Clostridiales","Clostridiaceae 1"],"Intestinibacter":["Firmicutes","Clostridia","Clostridiales","Peptostreptococcaceae"],"Lachnoanaerobaculum":["Firmicutes","Clostridia","Clostridiales","Lachnospiraceae"],"Lachnoclostridium":["Firmicutes","Clostridia","Clostridiales","Lachnospiraceae"],"Lachnospiraceae FCS020 group":["Firmicutes","Clostridia","Clostridiales","Lachnospiraceae"],"Lachnospiraceae ND3007 group":["Firmicutes","Clostridia","Clostridiales","Lachnospiraceae"],"Lachnospiraceae NK4A136 group":["Firmicutes","Clostridia","Clostridiales","Lachnospiraceae"],"Lactobacillus":["Firmicutes","Bacilli","Lactobacillales","Lactobacillaceae"],"Lactococcus":["Firmicutes","Bacilli","Lactobacillales","Streptococcaceae"],"Lactonifactor":["Firmicutes","Clostridia","Clostridiales","Lachnospiraceae"],"Leptotrichia":["Fusobacteria","Fusobacteriia","Fusobacteriales","Leptotrichiaceae"],"Leuconostoc":["Firmicutes","Bacilli","Lactobacillales","Leuconostocaceae"],"Marvinbryantia":["Firmicutes","Clostridia","Clostridiales","Lachnospiraceae"],"Megasphaera":["Firmicutes","Negativicutes","Selenomonadales","Veillonellaceae"],"Mogibacterium":["Firmicutes","Clostridia","Clostridiales","Family XIII"],"Negativibacillus":["Firmicutes","Clostridia","Clostridiales","Ruminococcaceae"],"Odoribacter":["Bacteroidetes","Bacteroidia","Bacteroidales","Marinifilaceae"],"Oribacterium":["Firmicutes","Clostridia","Clostridiales","Lachnospiraceae"],"Oscillibacter":["Firmicutes","Clostridia","Clostridiales","Ruminococcaceae"],"Parabacteroides":["Bacteroidetes","Bacteroidia","Bacteroidales","Tannerellaceae"],"Parascardovia":["Actinobacteria","Actinobacteria","Bifidobacteriales","Bifidobacteriaceae"],"Parasutterella":["Proteobacteria","Gammaproteobacteria","Burkholderiales","Sutterellaceae"],"Parvimonas":["Firmicutes","Clostridia","Clostridiales","Family XI"],"Pediococcus":["Firmicutes","Bacilli","Lactobacillales","Lactobacillaceae"],"Peptoniphilus":["Firmicutes","Clostridia","Clostridiales","Family XI"],"Peptostreptococcus":["Firmicutes","Clostridia","Clostridiales","Peptostreptococcaceae"],"Phascolarctobacterium":["Firmicutes","Negativicutes","Selenomonadales","Acidaminococcaceae"],"Prevotella":["Bacteroidetes","Bacteroidia","Bacteroidales","Prevotellaceae"],"Prevotella 7":["Bacteroidetes","Bacteroidia","Bacteroidales","Prevotellaceae"],"Prevotella 9":["Bacteroidetes","Bacteroidia","Bacteroidales","Prevotellaceae"],"Propionibacterium":["Actinobacteria","Actinobacteria","Propionibacteriales","Propionibacteriaceae"],"Romboutsia":["Firmicutes","Clostridia","Clostridiales","Peptostreptococcaceae"],"Roseburia":["Firmicutes","Clostridia","Clostridiales","Lachnospiraceae"],"Rothia":["Actinobacteria","Actinobacteria","Micrococcales","Micrococcaceae"],"Ruminiclostridium":["Firmicutes","Clostridia","Clostridiales","Ruminococcaceae"],"Ruminiclostridium 5":["Firmicutes","Clostridia","Clostridiales","Ruminococcaceae"],"Ruminiclostridium 9":["Firmicutes","Clostridia","Clostridiales","Ruminococcaceae"],"Ruminococcaceae NK4A214 group":["Firmicutes","Clostridia","Clostridiales","Ruminococcaceae"],"Ruminococcaceae UCG-002":["Firmicutes","Clostridia","Clostridiales","Ruminococcaceae"],"Ruminococcaceae UCG-004":["Firmicutes","Clostridia","Clostridiales","Ruminococcaceae"],"Ruminococcaceae UCG-005":["Firmicutes","Clostridia","Clostridiales","Ruminococcaceae"],"Ruminococcaceae UCG-013":["Firmicutes","Clostridia","Clostridiales","Ruminococcaceae"],"Ruminococcaceae UCG-014":["Firmicutes","Clostridia","Clostridiales","Ruminococcaceae"],"Ruminococcus 1":["Firmicutes","Clostridia","Clostridiales","Ruminococcaceae"],"Ruminococcus 2":["Firmicutes","Clostridia","Clostridiales","Ruminococcaceae"],"Scardovia":["Actinobacteria","Actinobacteria","Bifidobacteriales","Bifidobacteriaceae"],"Sellimonas":["Firmicutes","Clostridia","Clostridiales","Lachnospiraceae"],"Serratia":["Proteobacteria","Gammaproteobacteria","Enterobacterales","Yersiniaceae"],"Shuttleworthia":["Firmicutes","Clostridia","Clostridiales","Lachnospiraceae"],"Staphylococcus":["Firmicutes","Bacilli","Bacillales","Staphylococcaceae"],"Stomatobaculum":["Firmicutes","Clostridia","Clostridiales","Lachnospiraceae"],"Streptococcus":["Firmicutes","Bacilli","Lactobacillales","Streptococcaceae"],"Subdoligranulum":["Firmicutes","Clostridia","Clostridiales","Ruminococcaceae"],"Terrisporobacter":["Firmicutes","Clostridia","Clostridiales","Peptostreptococcaceae"],"Turicibacter":["Firmicutes","Erysipelotrichia","Erysipelotrichales","Turicibacteraceae"],"Tyzzerella":["Firmicutes","Clostridia","Clostridiales","Lachnospiraceae"],"Tyzzerella 4":["Firmicutes","Clostridia","Clostridiales","Lachnospiraceae"],"UBA1819":["Firmicutes","Clostridia","Clostridiales","Ruminococcaceae"],"Veillonella":["Firmicutes","Negativicutes","Selenomonadales","Veillonellaceae"],"Weissella":["Firmicutes","Bacilli","Lactobacillales","Leuconostocaceae"],"[Clostridium] innocuum group":["Firmicutes","Erysipelotrichia","Erysipelotrichales","Erysipelotrichaceae"],"[Eubacterium] brachy group":["Firmicutes","Clostridia","Clostridiales","Family XIII"],"[Eubacterium] coprostanoligenes group":["Firmicutes","Clostridia","Clostridiales","Ruminococcaceae"],"[Eubacterium] fissicatena group":["Firmicutes","Clostridia","Clostridiales","Lachnospiraceae"],"[Eubacterium] hallii group":["Firmicutes","Clostridia","Clostridiales","Lachnospiraceae"],"[Eubacterium] nodatum group":["Firmicutes","Clostridia","Clostridiales","Family XIII"],"[Eubacterium] ventriosum group":["Firmicutes","Clostridia","Clostridiales","Lachnospiraceae"],"[Ruminococcus] gauvreauii group":["Firmicutes","Clostridia","Clostridiales","Lachnospiraceae"],"[Ruminococcus] gnavus group":["Firmicutes","Clostridia","Clostridiales","Lachnospiraceae"],"[Ruminococcus] torques group":["Firmicutes","Clostridia","Clostridiales","Lachnospiraceae"]};

// palette groups, in bottom→top stacking order. `test(taxon, genus)` is evaluated
// top-to-bottom, first match wins (specific genus/family rules precede the broad
// class/phylum fallbacks). taxon = [phylum, class, order, family].
const PALETTE_GROUPS = [
  { key:'Enterococcus',        anchor:'#129246', variation:0.15, test:(t,g)=> g==='Enterococcus' },
  { key:'Streptococcus',       anchor:'#9FB846', variation:0.12, test:(t,g)=> g==='Streptococcus' },
  { key:'Lactobacillus',       anchor:'#3B51A3', variation:0.12, test:(t,g)=> g==='Lactobacillus' },
  { key:'Staphylococcus',      anchor:'#F1EB25', variation:0.12, test:(t,g)=> g==='Staphylococcus' },
  { key:'Bacilli (other)',     anchor:'#8FBC8F', variation:0.30, test:(t)=> t[1]==='Bacilli' },
  { key:'Gammaproteobacteria', anchor:'#EE2C2C', variation:0.38, test:(t)=> t[1]==='Gammaproteobacteria' },
  { key:'Alphaproteobacteria', anchor:'#F0806C', variation:0.25, test:(t)=> t[1]==='Alphaproteobacteria' },
  { key:'Deltaproteobacteria', anchor:'#AA336A', variation:0.25, test:(t)=> t[1]==='Deltaproteobacteria' },
  { key:'Bacteroidia',         anchor:'#16C0B8', variation:0.34, test:(t)=> t[1]==='Bacteroidia' },
  { key:'Lachnospiraceae',     anchor:'#EC9B96', variation:0.34, test:(t)=> t[3]==='Lachnospiraceae' },
  { key:'Ruminococcaceae',     anchor:'#9AAE73', variation:0.34, test:(t)=> t[3]==='Ruminococcaceae' },
  { key:'Clostridia (other)',  anchor:'#9C854E', variation:0.34, test:(t)=> t[1]==='Clostridia' },
  { key:'Negativicutes',       anchor:'#653F99', variation:0.28, test:(t)=> t[1]==='Negativicutes' },
  { key:'Erysipelotrichia',    anchor:'#F5911E', variation:0.28, test:(t)=> t[1]==='Erysipelotrichia' },
  { key:'Actinobacteria',      anchor:'#A77097', variation:0.34, test:(t)=> t[0]==='Actinobacteria' },
  { key:'Verrucomicrobiae',    anchor:'#CA0BE8', variation:0.20, test:(t)=> t[1]==='Verrucomicrobiae' },
  { key:'Fusobacteriia',       anchor:'#E24AA0', variation:0.22, test:(t)=> t[1]==='Fusobacteriia' },
  { key:'Other',               anchor:'#9AA0A6', variation:0.28, test:()=> true },
];
const OTHER_GROUP = PALETTE_GROUPS.length - 1;
function groupIndexOf(genus){
  const t = TAXONOMY[genus] || ['','','',''];
  for(let i=0;i<PALETTE_GROUPS.length;i++){ if(PALETTE_GROUPS[i].test(t, genus)) return i; }
  return OTHER_GROUP;
}

// hex helpers + a faithful port of yingtools2::shades(): expand one anchor colour
// into `n` evenly-spaced shades from a lightened end (`variation` toward white),
// through the anchor, to a darkened end (`variation` toward black).
function _hex2rgb(h){ h=h.replace('#',''); return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]; }
function _rgb2hex(c){ return '#'+c.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join(''); }
function _mix(a,b,t){ return a.map((v,i)=>v+(b[i]-v)*t); }
function shades(anchor, n, variation){
  if(n<=1) return [anchor];
  const base=_hex2rgb(anchor), white=_mix(base,[255,255,255],variation), black=_mix(base,[0,0,0],variation);
  const out=[];
  for(let i=0;i<n;i++){
    const t=i/(n-1);                       // 0 (lightest) → 1 (darkest)
    out.push(_rgb2hex(t<0.5 ? _mix(white,base,t/0.5) : _mix(base,black,(t-0.5)/0.5)));
  }
  return out;
}

// Precompute, over the fixed set of real genera, each genus's palette group and its
// distinct within-group shade (members ordered by name → a stable light→dark ramp).
// Memoised on the taxa-list identity so colours never shift while scrubbing.
let _colorTaxaKey=null, _taxaColor={}, _taxaGroup={};
function ensureTaxaColors(taxa){
  if(!taxa || !taxa.length || _colorTaxaKey===taxa.length) return;
  _colorTaxaKey=taxa.length; _taxaColor={}; _taxaGroup={};
  const byGroup={};
  taxa.forEach(g=>{ const gi=groupIndexOf(g); _taxaGroup[g]=gi; (byGroup[gi]||(byGroup[gi]=[])).push(g); });
  Object.keys(byGroup).forEach(gi=>{
    const members=byGroup[gi].slice().sort((a,b)=>a.localeCompare(b));
    const grp=PALETTE_GROUPS[gi], sh=shades(grp.anchor, members.length, grp.variation);
    members.forEach((g,i)=> _taxaColor[g]=sh[i]);
  });
}
function taxaColor(t){
  if(_taxaColor[t]) return _taxaColor[t];
  const g=PALETTE_GROUPS[groupIndexOf(t)];
  return shades(g.anchor,1,g.variation)[0];
}

// BSI (bloodstream-infection) event marker colours — vivid, high-contrast, and
// deliberately distinct from the stacked-taxa fills underneath (both markers get
// a black outline so they read against any band). Enterococcus = green,
// gram-negative = red.
const BSI_COLORS = { entero:'#28c76f', gramneg:'#ff3b30' };
const BSI_LABELS = { entero:'Enterococcus BSI', gramneg:'Gram-negative BSI' };
const bsiTip = (ev) => {
  const span = (ev.span && ev.span[1] > ev.span[0])
    ? ` (day ${ev.span[0]}–${ev.span[1]})` : ` (day ${ev.day})`;
  return `${BSI_LABELS[ev.cat]||'BSI'}: ${ev.label}${span}`;
};

const S = {
  meta:null, patients:[], pid:null, t0:0, horizon:MAX_HORIZON,
  abxOrder:[], schedule:{}, baseSchedule:{}, observed:[],
  observedComposition:[], compTaxa:null, bsiEvents:[],
  fc:null, baseFc:null, readoutDay:14,
  pxPerDay:18, plotW:0, scrollPx:0,
  flowOn:false, perturbations:{}, matchAdministered:false,
  tuZoom:1, tuPan:{x:0,y:0},
};

const $ = (id) => document.getElementById(id);
const isExpanded = (panelId) => { const p=$(panelId); return !!p && !p.classList.contains('collapsed'); };
const el = (tag, attrs={}, kids=[]) => {
  const n = document.createElementNS(SVGNS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  for (const c of [].concat(kids)) n.appendChild(c);
  return n;
};
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const fmtPct = (v)=> (v*100).toFixed(v<0.1?1:0)+'%';

async function api(path, opts){ return window.LOCAL_API(path, opts); }

// --------------------------------------------------------------------- //
//  init
// --------------------------------------------------------------------- //
const DEFAULT_PID = '184';

async function init(){
  S.meta = await api('/api/meta');
  S.patients = await api('/api/patients');
  buildPatientDropdown('patientSearch','patientList');       // header switcher
  $('sampleSelect').addEventListener('change', ()=> S.pid && loadForecast(true));
  $('resetBtn').addEventListener('click', ()=>{ S.schedule=clone(S.baseSchedule); commit(); });
  $('clearBtn').addEventListener('click', ()=>{ S.schedule={}; commit(); });
  $('themeBtn').addEventListener('click', toggleTheme);
  // each panel (trajectory / observed abundance / abx timeline / taxUMAP) can be
  // independently collapsed to just its header, or expanded to show its body
  ['trajPanel','obsPanel','tuPanel','abxPanel'].forEach(pid=>{
    const panel=$(pid), btn=panel.querySelector('.panel-toggle');
    btn.addEventListener('click', ()=>{
      const collapsed=panel.classList.toggle('collapsed');
      btn.textContent = collapsed ? '▸' : '▾';
      btn.title = collapsed ? 'expand' : 'collapse';
      if(!collapsed && S.fc){   // a panel becoming visible needs its chart (re)drawn
        if(pid==='trajPanel') renderComposition();
        else if(pid==='obsPanel') renderObserved();
        else if(pid==='tuPanel') renderTaxumap();
        else if(pid==='abxPanel') renderAbx();
        applyScrollPx();   // a just-shown scroller was frozen at 0 while hidden
      }
    });
  });
  window.addEventListener('resize', ()=>{ if(S.fc){ layout(); renderAll(); }});
  setupPointer();
  setupCompTooltip();
  setupScrollSync();
  setupFlowControls();
  setupTaxumapZoom();
  setupTutorial();
  // deep-link: #p=<patientId> auto-opens that patient on load (used by the
  // tutorial's "search for a patient" step, and shareable links in general);
  // otherwise the explorer always opens straight on the default patient/sample
  // — there is no "pick a patient" landing screen.
  const hp=(location.hash.match(/p=([^&]+)/)||[])[1];
  const hid=hp?decodeURIComponent(hp):null;
  const startId = (hid && S.patients.some(p=>String(p.id)===hid)) ? hid
    : (S.patients.some(p=>String(p.id)===DEFAULT_PID) ? DEFAULT_PID : (S.patients[0]&&S.patients[0].id));
  if(startId) await selectPatient(startId);
}

function toggleTheme(){
  document.body.dataset.theme = document.body.dataset.theme==='dark'?'light':'dark';
  if(S.fc) renderAll();
}
const clone = (o)=>JSON.parse(JSON.stringify(o));

// --------------------------------------------------------------------- //
//  patient picker
// --------------------------------------------------------------------- //
function buildPatientDropdown(inpId, listId){
  const inp=$(inpId), list=$(listId);
  if(!inp || !list) return;
  const render=(q)=>{
    q=(q||'').toLowerCase();
    const items=S.patients.filter(p=>p.id.toLowerCase().includes(q)).slice(0,120);
    list.innerHTML='';
    for(const p of items){
      const d=document.createElement('div'); d.className='p-item';
      const meta=[];
      if(p.entero_bsi) meta.push('<span class="badge e">ENT-BSI</span>');
      if(p.nonentero_bsi) meta.push('<span class="badge n">GN-BSI</span>');
      d.innerHTML=`<span class="pid">${p.id}</span>
        <span class="pmeta">${meta.join('')}<span>${p.n_samples} samp</span></span>`;
      d.onclick=()=>{ inp.value=p.id; list.classList.add('hidden'); selectPatient(p.id); };
      list.appendChild(d);
    }
    list.classList.toggle('hidden', items.length===0);
  };
  inp.addEventListener('focus', ()=>render(inp.value));
  inp.addEventListener('input', ()=>render(inp.value));
  document.addEventListener('click', e=>{ if(!e.target.closest('.combo')) list.classList.add('hidden'); });
}

async function selectPatient(pid){
  const info = await api('/api/patient/'+encodeURIComponent(pid));
  S.pid=pid; S.abxOrder=info.abx_order; S.baseSchedule=info.schedule; S.observed=info.observed||[];
  S.observedComposition=info.observed_composition||[]; S.compTaxa=info.comp_taxa||null;
  S.bsiEvents=info.bsi||[];
  buildPerturbList();   // built once, from the fixed 15-class antibiotic set
  const sel=$('sampleSelect'); sel.innerHTML=''; sel.disabled=false;
  info.samples.forEach((s,i)=>{
    const o=document.createElement('option'); o.value=JSON.stringify(s);
    const rel = s.day>=0?`day +${s.day}`:`day ${s.day}`;
    o.textContent=`${s.sample_id||('#'+(i+1))}  (${rel} rel. HCT)`;
    sel.appendChild(o);
  });
  sel.selectedIndex = 0;   // auto-pick the patient's first 16S sample
  document.body.classList.add('has-patient');   // reveal header controls
  const hi=$('patientSearch'); if(hi) hi.value=pid;
  await loadForecast(true);
}

// --------------------------------------------------------------------- //
//  forecasting
// --------------------------------------------------------------------- //
function currentSample(){ return JSON.parse($('sampleSelect').value); }

async function loadForecast(resetSchedule){
  const smp=currentSample();
  if(resetSchedule){
    // start from the ACTUAL regimen for this patient, clipped to display window
    S.schedule=clone(S.baseSchedule);
  }
  $('app').classList.remove('empty');
  // baseline (actual regimen) forecast for comparison overlays
  S.t0=smp.day;
  S.readoutDay = S.t0 + Math.min(14, S.horizon);   // readout cursor default +14 d
  const body=(sched)=>({pid:S.pid, sample_id:smp.sample_id, horizon:S.horizon, schedule:sched});
  busy(true);
  S.baseFc = await api('/api/forecast',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(body(S.baseSchedule))});
  S.fc = await api('/api/forecast',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(body(S.schedule))});
  busy(false);
  computeTaxaOrder();
  buildLegend(); buildObsLegend(); layout(); renderAll();
}

let _inflight=false, _dirty=false;
async function commit(){ // recompute current-schedule forecast (throttled)
  if(_inflight){ _dirty=true; return; }
  _inflight=true; busy(true);
  const smp=currentSample();
  try{
    S.fc = await api('/api/forecast',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({pid:S.pid, sample_id:smp.sample_id, horizon:S.horizon, schedule:S.schedule})});
  }catch(e){ console.error(e); }
  _inflight=false; busy(false);
  renderAll();
  if(_dirty){ _dirty=false; commit(); }
}
let _busyN=0;
function busy(on){ _busyN+=on?1:-1; $('busy').classList.toggle('hidden', _busyN<=0); }

// --------------------------------------------------------------------- //
//  scales / layout
// --------------------------------------------------------------------- //
const xDay = (d)=> PAD_L + (d - S.t0)*S.pxPerDay;
const dayFromX = (x)=> S.t0 + (x - PAD_L)/S.pxPerDay;

function layout(){
  const cw = $('scrollAbx').clientWidth || 800;
  // zoom is fixed so VIEW_DAYS fill the viewport; the plot spans the full horizon,
  // so the user scrolls right to reach the maximum horizon we forecast.
  S.pxPerDay = Math.max(cw/ VIEW_DAYS, 12);
  S.plotW = PAD_L + S.horizon*S.pxPerDay + PAD_R;
}

// --------------------------------------------------------------------- //
//  horizontal scroll sync — the trajectory (prediction), observed-abundance
//  (samples) and antibiotic-timeline charts all share one day axis and must
//  stay pixel-for-pixel aligned. S.scrollPx is the single source of truth;
//  every render/expand/patient-switch re-applies it to all three containers
//  instead of relying only on mirroring 'scroll' events between them — a
//  collapsed panel's container is display:none, and assigning .scrollLeft on
//  a zero-size element is silently dropped by the browser, which is what let
//  the samples panel and the prediction panel drift out of sync after a
//  collapse/expand or patient/sample switch. Re-applying on every render
//  (including right after a panel becomes visible again) closes that gap.
// --------------------------------------------------------------------- //
const SCROLLERS = ['scrollComp','scrollObs','scrollAbx'];
function applyScrollPx(){
  SCROLLERS.forEach(id=>{
    const el=$(id); if(!el) return;
    const max=Math.max(0, el.scrollWidth-el.clientWidth);
    const px=clamp(S.scrollPx||0, 0, max);
    if(el.scrollLeft!==px) el.scrollLeft=px;
  });
}
function setupScrollSync(){
  const hScroll=SCROLLERS.map($);
  let syncing=false;
  hScroll.forEach(a=>a.addEventListener('scroll', ()=>{
    if(syncing) return; syncing=true;
    S.scrollPx=a.scrollLeft;
    applyScrollPx();
    syncing=false;
  }));
  // horizontal wheel/trackpad ANYWHERE over the left panel scrolls the shared
  // day-axis timeline — even over gaps, gutters, headings or text. Plain
  // vertical wheel is left alone so it scrolls the stage (all panels) as usual.
  $('stage').addEventListener('wheel', (e)=>{
    const horiz = Math.abs(e.deltaX) > Math.abs(e.deltaY);
    const dx = horiz ? e.deltaX : (e.shiftKey ? e.deltaY : 0);
    if(!dx || !S.fc) return;
    e.preventDefault();
    const ref=hScroll.find(el=>el.clientWidth>0) || hScroll[0];
    const max=Math.max(0, ref.scrollWidth-ref.clientWidth);
    S.scrollPx=clamp((S.scrollPx||0)+dx, 0, max);
    applyScrollPx();
  }, {passive:false});
}

function dayTicks(){
  // choose a "nice" day spacing
  const target = 70;                                  // px between ticks
  const raw = target/S.pxPerDay;
  const steps=[1,2,5,7,10,14,20,30];
  let step=steps.find(s=>s>=raw)||30;
  const ticks=[];
  for(let d=Math.ceil(S.t0/step)*step; d<=S.t0+S.horizon+1e-6; d+=step) ticks.push(+d.toFixed(3));
  return ticks;
}

// --------------------------------------------------------------------- //
//  composition charts (trajectory + observed abundance)
// --------------------------------------------------------------------- //
function renderAll(){ renderComposition(); renderObserved(); renderTaxumap(); renderAbx(); applyScrollPx(); }

// Order the genera for stacking by TAXONOMY (Xavier/MSKCC convention), not abundance:
// palette-group order, then genus name within a group, so same-colour relatives stack
// contiguously. Enterococcus (palette group 0) therefore sorts first — pinned to the
// very bottom of every stack (the one hard rule, needed so its band's top edge is
// directly comparable to the dashed actual-regimen Entero trace drawn from the axis).
// Abundance is used only to choose WHICH genera the legend names (the top TOP_N),
// which are then listed in stack order. Stable while the user scrubs/scrolls.
function computeTaxaOrder(){
  const taxa=(S.fc&&S.fc.composition.taxa)||S.compTaxa||[];
  const vals=S.fc&&S.fc.composition.values;
  ensureTaxaColors(taxa);
  const total=taxa.map((_,i)=>{
    let s=0; const col=vals&&vals[i]; if(col) for(let k=0;k<col.length;k++) s+=col[k];
    return s;
  });
  S.taxaOrder=taxa.map((_,i)=>i).sort((a,b)=>{
    const ga=_taxaGroup[taxa[a]], gb=_taxaGroup[taxa[b]];
    if(ga!==gb) return ga-gb;                 // palette-group order (Enterococcus first)
    return taxa[a].localeCompare(taxa[b]);    // then genus name within the colour family
  });
  const topSet=new Set(taxa.map((_,i)=>i).sort((a,b)=>total[b]-total[a]).slice(0,TOP_N));
  S.topTaxa=S.taxaOrder.filter(i=>topSet.has(i)).map(i=>taxa[i]);
}

function buildLegend(){
  const lg=$('compLegend'); lg.innerHTML='';
  (S.topTaxa||[]).forEach(t=>{
    const d=document.createElement('span'); d.className='leg';
    d.innerHTML=`<span class="sw" style="background:${taxaColor(t)}"></span>${t}`;
    lg.appendChild(d);
  });
  // the dashed baseline trace and the risk-mean overlay only appear in the
  // predicted (trajectory) view
  const d2=document.createElement('span'); d2.className='leg';
  d2.innerHTML=`<span class="sw" style="background:transparent;border-top:1.5px dashed var(--ink2);width:12px;height:0"></span>actual-regimen Entero`;
  lg.appendChild(d2);
  const d3=document.createElement('span'); d3.className='leg';
  d3.innerHTML=`<span class="sw" style="background:var(--tx-entero);width:12px;height:3px;border-radius:2px"></span>Enterococcus BSI risk (${enteroRiskWindowDays()}d mean)`;
  lg.appendChild(d3);
  appendBsiLegend(lg);
}

// append "● Enterococcus BSI / ● Gram-negative BSI" keys to a chart legend,
// but only for the classes this patient actually has an event for
function appendBsiLegend(lg){
  const cats=new Set((S.bsiEvents||[]).map(e=>e.cat));
  ['entero','gramneg'].forEach(cat=>{
    if(!cats.has(cat)) return;
    const d=document.createElement('span'); d.className='leg';
    d.innerHTML=`<span class="sw bsi-key" style="background:${BSI_COLORS[cat]};`+
      `border:1.5px solid #000;border-radius:50%"></span>${BSI_LABELS[cat]}`;
    lg.appendChild(d);
  });
}

function buildObsLegend(){
  const lg=$('obsLegend'); lg.innerHTML='';
  (S.topTaxa||[]).forEach(t=>{
    const d=document.createElement('span'); d.className='leg';
    d.innerHTML=`<span class="sw" style="background:${taxaColor(t)}"></span>${t}`;
    lg.appendChild(d);
  });
  appendBsiLegend(lg);
}

// shared renderer for the two stacked-composition charts (trajectory + observed);
// each draws into its own svg/gutter/scroll but shares the day-axis scale
function renderChartPanel(svgId, scrollId, gutterId, drawFn){
  const svg=$(svgId); const H=$(scrollId).clientHeight||300;
  const plotH=H-COMP_AXIS_H-4, top=4;
  svg.setAttribute('width',S.plotW); svg.setAttribute('height',H);
  svg.setAttribute('viewBox',`0 0 ${S.plotW} ${H}`); svg.innerHTML='';
  const g=el('g');
  const y=(v)=> top + (1-v)*plotH;                     // v in [0,1]
  drawFn(g, y);
  // y grid + axis ticks
  [0,0.25,0.5,0.75,1].forEach(v=>{
    g.appendChild(el('line',{x1:PAD_L,y1:y(v),x2:S.plotW-PAD_R,y2:y(v),class:'axis-tick',opacity:v===0?0:0.5}));
  });
  // day axis
  drawDayAxis(g, top+plotH, true);
  // BSI event markers (vertical lines) — under the readout cursor
  drawBsiMarkers(g, top, plotH);
  // readout cursor
  drawReadout(g, top, plotH, y);
  svg.appendChild(g);
  renderCompGutter(gutterId, scrollId, y, top, plotH);
}

// vertical BSI-event markers for the trajectory + observed-abundance charts:
// a coloured line (green Entero / red gram-neg) with a dark casing for contrast
// and an outlined lollipop head + hover tooltip naming the organism.
function drawBsiMarkers(g, top, plotH){
  (S.bsiEvents||[]).forEach(ev=>{
    if(ev.day < S.t0-1e-3 || ev.day > S.t0+S.horizon+1e-3) return;
    const x=xDay(ev.day), color=BSI_COLORS[ev.cat]||'#888';
    const grp=el('g',{class:'bsi-marker'});
    grp.appendChild(el('line',{x1:x,y1:top,x2:x,y2:top+plotH,stroke:'#000',
      'stroke-width':4,'stroke-opacity':0.28,'pointer-events':'none'}));
    grp.appendChild(el('line',{x1:x,y1:top,x2:x,y2:top+plotH,stroke:color,
      'stroke-width':2,'stroke-opacity':0.95,'pointer-events':'none'}));
    const head=el('circle',{cx:x.toFixed(1),cy:top.toFixed(1),r:5.5,fill:color,
      stroke:'#000','stroke-width':1.5,class:'bsi-head'});
    head.appendChild(el('title',{},[txt(bsiTip(ev))]));
    grp.appendChild(head);
    g.appendChild(grp);
  });
}

function renderComposition(){
  if(!S.fc || !isExpanded('trajPanel')) return;
  renderChartPanel('compSvg','scrollComp','compGutter', drawPredicted);
}

function renderObserved(){
  if(!S.fc || !isExpanded('obsPanel')) return;
  renderChartPanel('obsSvg','scrollObs','obsGutter', drawObservedBars);
}

// Enterococcus's per-day value as actually drawn in the stacked composition bands
// (renormalised over the real genera). fc.entero is the raw, un-renormalised model
// output, which drifts slightly from the band whenever probability mass sits in the
// non-biological placeholder slots — using the band value instead makes the outline/
// baseline traces land exactly on the band's top edge (Enterococcus is always the
// bottom band; see computeTaxaOrder), not just approximately.
function enteroBand(fc){
  const idx=fc.composition.taxa.indexOf('Enterococcus');
  return idx>=0 ? fc.composition.values[idx] : fc.entero;
}

// predicted view: stacked pNODE trajectory areas + dashed actual-regimen Entero trace
function drawPredicted(g, y){
  const days=S.fc.day, vals=S.fc.composition.values, taxa=S.fc.composition.taxa;
  const order=S.taxaOrder||taxa.map((_,i)=>i);   // taxonomic order; Enterococcus first (bottom of stack)
  let cum=new Array(days.length).fill(0);
  for(const ti of order){
    const upper=cum.map((c,i)=>c+vals[ti][i]);
    let d='M'+days.map((dd,i)=>`${xDay(dd).toFixed(1)},${y(cum[i]).toFixed(1)}`).join('L');
    d+='L'+days.map((dd,i)=>`${xDay(dd).toFixed(1)},${y(upper[i]).toFixed(1)}`).reverse().join('L')+'Z';
    g.appendChild(el('path',{d, fill:taxaColor(taxa[ti]), stroke:cvar('--surface-1'),
      'stroke-width':0.6, 'shape-rendering':'geometricPrecision', 'data-taxa':taxa[ti], 'data-idx':ti}));
    cum=upper;
  }
  if(S.baseFc){
    const be=enteroBand(S.baseFc), bd=S.baseFc.day;
    g.appendChild(el('path',{class:'baseline-trace',
      d:'M'+bd.map((dd,i)=>`${xDay(dd).toFixed(1)},${y(be[i]).toFixed(1)}`).join('L')}));
  }
  const e=enteroBand(S.fc);
  g.appendChild(el('path',{class:'entero-outline',
    d:'M'+days.map((dd,i)=>`${xDay(dd).toFixed(1)},${y(e[i]).toFixed(1)}`).join('L')}));
  drawEnteroRiskLine(g, y, days);
}

// Enterococcus BSI risk overlay: a bold, highlighted dark-green line tracking
// the TRAILING mean predicted Enterococcus fraction over a W-day window
// (W = the model's own risk_window, the same 21 d used to define "dominated"),
// anchored so the window never reaches before the start of the prediction
// (day t0) — it widens from a same-day value up to a full W-day trailing
// window as the forecast advances. Time-weighted (trapezoidal) so the fixed
// half-day forecast grid doesn't bias the average. Drawn with a halo so it
// reads clearly even where it crosses the (similarly dark-green) Enterococcus
// band itself.
function enteroRiskWindowDays(){ return (S.meta && S.meta.risk_window) || 21; }
function enteroRollingRisk(days, e){
  const W=enteroRiskWindowDays(), out=new Array(days.length);
  let lo=0;
  for(let i=0;i<days.length;i++){
    const dHi=days[i], dLo=Math.max(S.t0, dHi-W);
    while(lo<i && days[lo+1]<=dLo+1e-9) lo++;
    let sum=0, span=0;
    for(let k=lo;k<i;k++){
      const d0=Math.max(days[k],dLo), d1=days[k+1];
      if(d1<=d0) continue;
      const v0=interp(days,e,d0);
      sum+=(v0+e[k+1])/2*(d1-d0); span+=(d1-d0);
    }
    out[i]= span>1e-9 ? sum/span : e[i];
  }
  return out;
}
function drawEnteroRiskLine(g, y, days){
  const risk=enteroRollingRisk(days, S.fc.entero);
  const d='M'+days.map((dd,i)=>`${xDay(dd).toFixed(1)},${y(risk[i]).toFixed(1)}`).join('L');
  g.appendChild(el('path',{class:'entero-risk-halo', d}));
  g.appendChild(el('path',{class:'entero-risk-line', d}));
}

// observed view: measured 16S composition as 1-day-thick stacked bars at each sample day
function drawObservedBars(g, y){
  const taxa=(S.compTaxa)||(S.fc&&S.fc.composition.taxa)||[];
  const order=S.taxaOrder||taxa.map((_,i)=>i);   // same taxonomic genus order as the trajectory stack
  const barW=Math.max(S.pxPerDay, 2);   // one day thick
  (S.observedComposition||[]).forEach(o=>{
    if(o.day<S.t0-0.5 || o.day>S.t0+S.horizon+0.5) return;
    const xc=xDay(o.day); let cum=0;
    for(const ti of order){
      const v=o.values[ti]||0;
      if(v>1e-9){
        const yt=y(cum+v), yb=y(cum);
        g.appendChild(el('rect',{x:(xc-barW/2).toFixed(1), y:yt.toFixed(1),
          width:barW.toFixed(1), height:Math.max(yb-yt,0.4).toFixed(1),
          fill:taxaColor(taxa[ti]), stroke:cvar('--surface-1'), 'stroke-width':0.4,
          'data-taxa':taxa[ti], 'data-idx':ti, 'data-val':v}));
      }
      cum+=v;
    }
  });
}

// hover tooltip naming the taxon (and its abundance) under the cursor —
// attached to both the trajectory (predicted) and observed-abundance charts
let _tipEl=null;
function setupCompTooltip(){
  if(!_tipEl){ _tipEl=document.createElement('div'); _tipEl.className='tooltip';
    _tipEl.style.display='none'; document.body.appendChild(_tipEl); }
  ['compSvg','obsSvg'].forEach(attachCompTooltip);
}
function attachCompTooltip(svgId){
  const svg=$(svgId), tip=_tipEl, hide=()=>{ tip.style.display='none'; };
  svg.addEventListener('pointermove',(ev)=>{
    if(drag||readoutDrag){ hide(); return; }
    const t=ev.target, name=t&&t.getAttribute&&t.getAttribute('data-taxa');
    if(!name){ hide(); return; }
    let val=null;
    if(t.hasAttribute('data-val')) val=+t.getAttribute('data-val');
    else if(S.fc){   // predicted (trajectory) path: interpolate the value under the cursor
      val=interp(S.fc.day, S.fc.composition.values[+t.getAttribute('data-idx')], dayFromX(localX(ev,svg)));
    }
    tip.innerHTML=`<span class="tt-sw" style="background:${taxaColor(name)}"></span>${name}`+
      (val!=null?` <b>${(val*100).toFixed(1)}%</b>`:'');
    tip.style.display='block';
    tip.style.left=(ev.clientX+14)+'px'; tip.style.top=(ev.clientY+14)+'px';
  });
  svg.addEventListener('pointerleave', hide);
  svg.addEventListener('pointerdown', hide);
}

// --------------------------------------------------------------------- //
//  TaxUMAP view: reference-cloud backdrop + a bright dot at the pNODE-
//  predicted location, which traverses the map as the readout day changes.
// --------------------------------------------------------------------- //
let _tu=null;   // {w,h,dpr,map,fc}
function renderTaxumap(){
  if(!S.fc || !isExpanded('tuPanel')) return;
  const wrap=$('taxumapWrap');
  if(!(window.TAXUMAP && TAXUMAP.ready())){
    $('tuHint').textContent='loading TaxUMAP reference cloud…';
    if(window.TAXUMAP) TAXUMAP.load().then(()=>{ if(isExpanded('tuPanel')) renderTaxumap(); })
      .catch(e=>{ $('tuHint').textContent='TaxUMAP load failed: '+e.message; });
    return;
  }
  const w=wrap.clientWidth, h=wrap.clientHeight;
  if(w<10||h<10) return;
  const sizeChanged=!_tu||_tu.w!==w||_tu.h!==h;
  if(sizeChanged){ setupTaxumapMap(w,h); drawTaxumapBackdrop(false); }
  // the expensive part (TAXUMAP.project, ~90 calls) only runs when the
  // forecast actually changes; the cheap screen remap always runs below
  if(_tu.fc!==S.fc){ _tu.fc=S.fc; computeTaxumapPathData(); drawTaxumapLegend(); }
  renderTaxumapPathSvg();
  taxumapMoveDot();
  syncPerturbToAdministered();
  drawFlowField(false);
  // the flow field now fills in progressively over a few frames instead of
  // blocking (see startFlowFieldRecompute) — say so on the first-ever fill,
  // when there's nothing on screen yet, so it doesn't read as broken
  $('tuHint').textContent = (S.flowOn && _flowPending && !_flowCache.vectors)
    ? 'computing flow field…'
    : 'drag the ● to move along the predicted path · scroll to zoom · two fingers to pan';
}

// _tuBase holds the fixed "fit the whole reference cloud" transform (zoom=1,
// pan=0). The live map() below composes it with S.tuZoom/S.tuPan (persisted
// on S so a container resize doesn't reset the user's zoom level) so every
// consumer (backdrop, path, dot, flow field) sees one consistent transform.
let _tuBase=null;
function setupTaxumapMap(w,h){
  const info=TAXUMAP.info(); const [xmin,xmax,ymin,ymax]=info.bounds;
  const m=26, s=Math.min((w-2*m)/(xmax-xmin),(h-2*m)/(ymax-ymin));
  const offx=(w-s*(xmax-xmin))/2, offy=(h-s*(ymax-ymin))/2;
  _tuBase={xmin,xmax,ymin,ymax,s,offx,offy,w,h};
  const map=(x,y)=>{
    const bx=offx+(x-xmin)*s, by=h-(offy+(y-ymin)*s);         // zoom=1 baseline (invert y for screen)
    return [S.tuPan.x+bx*S.tuZoom, S.tuPan.y+by*S.tuZoom];
  };
  const dpr=Math.min(window.devicePixelRatio||1, 2);
  const cv=$('taxumapCanvas'); cv.width=Math.round(w*dpr); cv.height=Math.round(h*dpr);
  cv.style.width=w+'px'; cv.style.height=h+'px';
  const fc=$('flowCanvas'); fc.width=Math.round(w*dpr); fc.height=Math.round(h*dpr);
  fc.style.width=w+'px'; fc.style.height=h+'px';
  const svg=$('taxumapSvg'); svg.setAttribute('viewBox',`0 0 ${w} ${h}`); svg.innerHTML='';
  svg.appendChild(el('text',{x:w-8,y:h-7,'text-anchor':'end',fill:cvar('--muted'),'font-size':10},[txt('TaxUMAP-1 →')]));
  svg.appendChild(el('text',{x:11,y:15,fill:cvar('--muted'),'font-size':10},[txt('↑ TaxUMAP-2')]));
  _tu={w,h,dpr,map,fc:null};
}

// keep the pan within reach of the actual data: a positive pan.x always
// reveals empty margin beyond the cloud's top-left corner (base-space has
// nothing before 0), capped to a fixed ~1/4 of the viewport regardless of
// zoom, while the far side is capped so at least ~75% of the viewport still
// overlaps real content — that bound DOES grow with zoom (the more you've
// zoomed in, the more of the cloud there is to pan across before running out)
function clampTuPan(){
  if(!_tu) return;
  const w=_tu.w, h=_tu.h, Z=S.tuZoom, minOverlap=0.75;
  S.tuPan.x = clamp(S.tuPan.x, minOverlap*w - Z*w, w*(1-minOverlap));
  S.tuPan.y = clamp(S.tuPan.y, minOverlap*h - Z*h, h*(1-minOverlap));
}

// shared by both zoom and pan gestures: redraw immediately (cheap — re-
// transforms the cached backdrop bitmap and re-projects the cached
// streamlines, touching neither the 10k-point cloud nor the ODE integrator)
// and only do the expensive part (a crisp backdrop redraw) once the gesture
// settles. The flow field itself never needs a recompute here — it's fixed
// in data space and keyed on the perturbation set only (see drawFlowField).
let _tuZoomRAF=null, _tuSettleT=null;
function scheduleTuGestureRedraw(fCanvas){
  if(_tuZoomRAF) cancelAnimationFrame(_tuZoomRAF);
  _tuZoomRAF=requestAnimationFrame(()=>{
    drawTaxumapBackdrop(true); renderTaxumapPathSvg(); taxumapMoveDot(); drawFlowField(true);
  });
  if(fCanvas && fCanvas.style.opacity!=='0.5') fCanvas.style.opacity='0.5';
  clearTimeout(_tuSettleT);
  _tuSettleT=setTimeout(()=>{
    if(!isExpanded('tuPanel')) return;
    drawTaxumapBackdrop(false);   // one crisp redraw + a fresh cache snapshot
    // the flow field lives entirely in data space now (see the flow-field
    // section below) — zooming/panning never invalidates it, so this is
    // always a reprojection of the cached streamlines, never a recompute
    drawFlowField(true);
    if(fCanvas) fCanvas.style.opacity='1';
  }, 160);
}

function setupTaxumapZoom(){
  const wrap=$('taxumapWrap');
  const fCanvas=$('flowCanvas');
  // getBoundingClientRect() forces a layout if anything on the page is
  // layout-dirty — cheap in isolation, but wasteful to pay on every single
  // wheel tick of a gesture when the container isn't moving. Cache it for
  // the duration of a gesture and only re-measure once scrolling has fully
  // stopped (a resize mid-gesture is not a real scenario here).
  let rectCache=null;
  const clearRectCache=()=>{ rectCache=null; };
  wrap.addEventListener('wheel',(e)=>{
    if(!_tu||!_tuBase) return;
    e.preventDefault(); e.stopPropagation();
    // Trackpads report two-finger gestures as wheel events too. Browsers mark
    // an actual pinch with ctrlKey — the same convention used for
    // ctrl+wheel-to-zoom on a mouse — regardless of whether Ctrl is actually
    // held, so ctrlKey reliably means "zoom" either way. The remaining
    // ambiguity is a plain vertical wheel: a two-finger swipe and a classic
    // mouse wheel are otherwise indistinguishable through this event (both
    // can report deltaMode 0 depending on OS/browser — a notched "line"
    // deltaMode can't be relied on). A non-zero deltaX is the one signal a
    // mouse wheel essentially never produces but a real two-finger swipe
    // almost always does (natural hand motion is rarely perfectly vertical),
    // so that's the switch: any horizontal component means pan, everything
    // else keeps the original scroll-to-zoom behaviour.
    if(!e.ctrlKey && e.deltaX!==0){
      S.tuPan.x -= e.deltaX;
      S.tuPan.y -= e.deltaY;
      clampTuPan();
      scheduleTuGestureRedraw(fCanvas);
      return;
    }
    if(!rectCache) rectCache=wrap.getBoundingClientRect();
    const mx=e.clientX-rectCache.left, my=e.clientY-rectCache.top;
    const oldZoom=S.tuZoom;
    const factor=Math.exp(-e.deltaY*0.0016);
    const newZoom=clamp(oldZoom*factor, 1, 14);
    if(newZoom===oldZoom) return;
    // keep the data point under the cursor fixed on screen while zooming
    S.tuPan.x = mx - (mx-S.tuPan.x)/oldZoom*newZoom;
    S.tuPan.y = my - (my-S.tuPan.y)/oldZoom*newZoom;
    S.tuZoom = newZoom;
    clampTuPan();
    scheduleTuGestureRedraw(fCanvas);
  }, {passive:false});
  // the perturbations checklist floats over the map inside #taxumapWrap, so a
  // wheel over it would otherwise bubble to the handler above and zoom/pan the
  // map. Keep the gesture inside the panel: stop it reaching the map handler
  // and let the browser scroll the (overflow:auto) list natively.
  const pPanel=$('perturbPanel');
  if(pPanel) pPanel.addEventListener('wheel',(e)=>{ e.stopPropagation(); }, {passive:true});
  wrap.addEventListener('dblclick', ()=>{
    S.tuZoom=1; S.tuPan={x:0,y:0};
    if(isExpanded('tuPanel')){ drawTaxumapBackdrop(false); renderTaxumapPathSvg(); taxumapMoveDot(); drawFlowField(false); }
  });
  window.addEventListener('resize', clearRectCache);
}

// The reference cloud is ~10k points; redrawing all of them every animation
// frame during a zoom gesture (beginPath/arc/fill x10k, ~60 times/sec) is
// what made zooming feel sluggish. Instead we rasterize the cloud once,
// crisp, into an offscreen snapshot at the CURRENT zoom/pan, and while a
// gesture is in flight (fromCache=true) we just re-transform that single
// bitmap with drawImage — an O(1) op regardless of point count, since the
// map/pan/zoom is a pure affine transform (uniform scale + translate, no
// rotation), a cached raster can be re-scaled/re-translated and stay pixel-
// exact modulo raster resolution. The snapshot is refreshed (one real
// 10k-point redraw) once the gesture settles, so the map always ends up
// pixel-crisp; only the handful of frames mid-gesture trade a touch of
// raster softness for staying smooth — the same tradeoff map apps make.
// The backdrop dots and flow-field streamlines are drawn a touch thinner
// when zoomed all the way out (purely a stroke/dot-radius tweak, not a point
// count — every reference point is always drawn, none are ever dropped) and
// grow to their normal, already-tuned size by TU_LOD_ZOOM. tuLod() is 0 at
// zoom=1 and 1 at zoom>=TU_LOD_ZOOM.
const TU_LOD_ZOOM = 5;
const tuLod = ()=> clamp((S.tuZoom-1)/(TU_LOD_ZOOM-1), 0, 1);
const lerp = (a,b,t)=> a+(b-a)*t;

let _tuBackdropSnap=null;   // {canvas, zoom, pan}
function drawTaxumapBackdrop(fromCache){
  const ctx=$('taxumapCanvas').getContext('2d');
  if(fromCache && _tuBackdropSnap){
    const scale=S.tuZoom/_tuBackdropSnap.zoom;
    const tx=S.tuPan.x - scale*_tuBackdropSnap.pan.x, ty=S.tuPan.y - scale*_tuBackdropSnap.pan.y;
    ctx.setTransform(_tu.dpr,0,0,_tu.dpr,0,0);
    ctx.clearRect(0,0,_tu.w,_tu.h);
    ctx.setTransform(_tu.dpr*scale,0,0,_tu.dpr*scale, _tu.dpr*tx, _tu.dpr*ty);
    ctx.drawImage(_tuBackdropSnap.canvas, 0, 0, _tu.w, _tu.h);
    return;
  }
  const info=TAXUMAP.info();
  const bd=info.bdCoords, cls=info.bdClass, colors=info.classColors;
  const dotR=lerp(1.15, 2.0, tuLod());   // a touch bigger when zoomed out, to help fill in a thinner cloud
  // group by fill color so the whole cloud is a handful of fill() calls
  // instead of one beginPath/arc/fill per point — every reference point is
  // drawn regardless of zoom level; nothing is thinned out
  const byColor=new Map();
  for(let i=0;i<cls.length;i++){
    const col=colors[cls[i]]||'#888';
    if(!byColor.has(col)) byColor.set(col,[]);
    byColor.get(col).push(i);
  }
  const paint=(ctx2)=>{
    ctx2.globalAlpha=0.32;
    for(const [col,idxs] of byColor){
      ctx2.fillStyle=col; ctx2.beginPath();
      for(const i of idxs){
        const p=_tu.map(bd[2*i],bd[2*i+1]);
        ctx2.moveTo(p[0]+dotR,p[1]); ctx2.arc(p[0],p[1],dotR,0,6.2832);
      }
      ctx2.fill();
    }
    ctx2.globalAlpha=1;
  };
  ctx.setTransform(_tu.dpr,0,0,_tu.dpr,0,0);
  ctx.clearRect(0,0,_tu.w,_tu.h);
  paint(ctx);
  const snap=document.createElement('canvas');
  snap.width=Math.round(_tu.w*_tu.dpr); snap.height=Math.round(_tu.h*_tu.dpr);
  const sctx=snap.getContext('2d');
  sctx.setTransform(_tu.dpr,0,0,_tu.dpr,0,0);
  paint(sctx);
  _tuBackdropSnap={canvas:snap, zoom:S.tuZoom, pan:{x:S.tuPan.x,y:S.tuPan.y}};
}

// TAXUMAP.project() is an O(nRef≈10k) kNN search (~1.6ms/call) — projecting
// the ~90-point trajectory subsample cost ~137ms measured end to end, and
// the old code re-ran that on EVERY zoom animation frame (independent of
// whether flow lines were even on), which was the real source of the
// reported zoom stutter. The projection is a function of the patient's
// forecast alone — it doesn't depend on zoom/pan/size at all — so it only
// needs to run when the forecast changes; renderTaxumapPathSvg() below does
// the actual per-frame work (just remapping ~90 cached points through the
// current _tu.map()), which is cheap enough to call on every frame.
function computeTaxumapPathData(){
  _tu.dataPts=null; _tu.days=null;
  if(!S.fc||!S.fc.fullComp||!S.fc.fullComp.length) return;
  const comps=S.fc.fullComp, days=S.fc.day;
  const step=Math.max(1,Math.round(comps.length/90));
  const idxs=[];
  for(let i=0;i<comps.length;i+=step) idxs.push(i);
  if(idxs[idxs.length-1]!==comps.length-1) idxs.push(comps.length-1);
  _tu.dataPts=idxs.map(i=>TAXUMAP.project(comps[i]));   // data-space [x,y] or null; zoom-independent
  _tu.days=idxs.map(i=>days[i]);
}

// cheap per-frame part: remaps the cached data-space trajectory points
// through the CURRENT _tu.map() and redraws the SVG — safe to call on every
// zoom/pan frame since it does no TAXUMAP.project() calls at all.
function renderTaxumapPathSvg(){
  const svg=$('taxumapSvg'); const old=svg.querySelector('.tu-path'); if(old) old.remove();
  _tu.pts=null;
  if(!_tu.dataPts) return;
  const pts=_tu.dataPts.map(z=>z?_tu.map(z[0],z[1]):null);
  _tu.pts=pts;
  const g=el('g',{class:'tu-path'});
  const valid=pts.filter(Boolean);
  if(valid.length>1){
    g.appendChild(el('path',{d:'M'+valid.map(p=>`${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L'),
      fill:'none',stroke:cvar('--accent'),'stroke-width':1.6,'stroke-opacity':0.6,'stroke-linejoin':'round'}));
    g.appendChild(el('circle',{cx:valid[0][0],cy:valid[0][1],r:3.2,fill:cvar('--surface-1'),
      stroke:cvar('--ink2'),'stroke-width':1.3}));   // start (sample) marker
  }
  // BSI event dots: place each event on the path point nearest its day
  (S.bsiEvents||[]).forEach(ev=>{
    if(!_tu.days || !_tu.days.length) return;
    if(ev.day < _tu.days[0]-1e-3 || ev.day > _tu.days[_tu.days.length-1]+1e-3) return;
    let bi=0, bd=Infinity;
    for(let i=0;i<_tu.days.length;i++){ const dd=Math.abs(_tu.days[i]-ev.day); if(dd<bd){bd=dd;bi=i;} }
    const p=pts[bi]; if(!p) return;
    const circ=el('circle',{cx:p[0].toFixed(1),cy:p[1].toFixed(1),r:6.5,
      fill:BSI_COLORS[ev.cat]||'#888',stroke:'#000','stroke-width':2,class:'tu-bsi'});
    circ.appendChild(el('title',{},[txt(bsiTip(ev))]));
    g.appendChild(circ);
  });
  const dot=svg.querySelector('.tu-dot'); svg.insertBefore(g, dot||null);   // keep dot on top
}

// nearest cached path point to a local (x,y) in the taxumapSvg's own coordinate
// space — used while dragging the readout dot along the trajectory
function nearestTaxumapIndex(x,y){
  if(!_tu||!_tu.pts) return null;
  let bi=-1, bd=Infinity;
  for(let i=0;i<_tu.pts.length;i++){
    const p=_tu.pts[i]; if(!p) continue;
    const d=(p[0]-x)*(p[0]-x)+(p[1]-y)*(p[1]-y);
    if(d<bd){ bd=d; bi=i; }
  }
  return bi>=0?bi:null;
}

function taxumapMoveDot(){
  if(!S.fc||!_tu||!_tu.pts||!_tu.pts.length) return;
  const svg=$('taxumapSvg'), days=_tu.days;
  let bi=0,bd=Infinity;
  for(let i=0;i<days.length;i++){ const d=Math.abs(days[i]-S.readoutDay); if(d<bd){bd=d;bi=i;} }
  const p=_tu.pts[bi]; if(!p) return;
  _tu.dotPos=p;   // cached for the dot-grab hit-test in setupPointer()
  let dot=svg.querySelector('.tu-dot');
  if(!dot){
    dot=el('g',{class:'tu-dot'});
    dot.appendChild(el('circle',{class:'tu-dot-halo'}));
    dot.appendChild(el('circle',{class:'tu-dot-core'}));
    svg.appendChild(dot);
  }
  const halo=dot.children[0], core=dot.children[1];
  halo.setAttribute('cx',p[0].toFixed(1)); halo.setAttribute('cy',p[1].toFixed(1)); halo.setAttribute('fill',cvar('--accent'));
  core.setAttribute('cx',p[0].toFixed(1)); core.setAttribute('cy',p[1].toFixed(1));
  core.setAttribute('r',8); core.setAttribute('fill','#ffffff');
  core.setAttribute('stroke',cvar('--critical')); core.setAttribute('stroke-width',3);
  svg.appendChild(dot);   // ensure on top
}

function drawTaxumapLegend(){
  const info=TAXUMAP.info(), lg=$('tuLegend'); lg.innerHTML='';
  const title=document.createElement('div'); title.className='tu-row';
  title.style.fontWeight='600'; title.style.marginBottom='3px'; title.textContent='dominant class';
  lg.appendChild(title);
  [...new Set(info.bdClass)].sort((a,b)=>a-b).forEach(c=>{
    const row=document.createElement('div'); row.className='tu-row';
    row.innerHTML=`<span class="tu-sw" style="background:${info.classColors[c]}"></span>${info.classLabels[c]}`;
    lg.appendChild(row);
  });
  const cats=new Set((S.bsiEvents||[]).map(e=>e.cat));
  if(cats.size){
    const hd=document.createElement('div'); hd.className='tu-row';
    hd.style.fontWeight='600'; hd.style.marginTop='5px'; hd.textContent='BSI event';
    lg.appendChild(hd);
    ['entero','gramneg'].forEach(cat=>{
      if(!cats.has(cat)) return;
      const row=document.createElement('div'); row.className='tu-row';
      row.innerHTML=`<span class="tu-sw" style="background:${BSI_COLORS[cat]};`+
        `border:1.5px solid #000;border-radius:50%"></span>${BSI_LABELS[cat]}`;
      lg.appendChild(row);
    });
  }
}

// --------------------------------------------------------------------- //
//  TaxUMAP flow field — a map-wide instantaneous-velocity field showing where
//  community composition is predicted to DRIFT under a fixed, constant
//  antibiotic exposure (the toggled "Perturbations"), independent of any one
//  patient. Follows the streamline method of Schluter et al. 2023 (Cell Host
//  Microbe): a large set of real, observed reference communities are used as
//  SEEDs; each is advanced one short FLOW_DT=0.5-day step with the SAME
//  validated pNODE integrator (window.__tipnodeForecast) holding the toggled
//  classes continuously "on", re-projected back onto the map, and the
//  map-space displacement divided by FLOW_DT gives an instantaneous velocity
//  at that seed. Those sparse, ODE-accurate velocities are then interpolated
//  onto a continuous field by distance-weighted regression (sampleFlowField)
//  and traced into streamlines; regions too far from any real seed to have
//  support are masked rather than extrapolated into (see FLOW_SUPPORT_MIN_W).
//  Each traced point also carries the field's LOCAL interpolated speed there
//  (not just one magnitude for the whole line), so a streamline reads as a
//  little inferno-style heat ramp along its own length — thin and near-black
//  where the local flow is weak, through dark purple and a magenta/orange
//  transition, up to a thick, bright yellow where it's strongest — rather
//  than one flat colour/width for the entire streamline (see FLOW_RAMP,
//  drawFlowStreamline).
//  The seed grid spans the FULL reference map, fixed in data space — never
//  the current viewport — so the field is computed once per antibiotic
//  condition and merely re-projected through the live pan/zoom transform
//  afterwards; this is also what keeps the streamlines' directions stable
//  while zooming/panning (they used to be resampled per-viewport, which made
//  them visibly reshuffle direction on every zoom step).
// --------------------------------------------------------------------- //
const FLOW_DT = 0.5;          // short "instantaneous" step per seed, days (Schluter et al. 2023, Fig 5 legend)
const FLOW_GRID = 30;         // spatial bins per axis across the FIXED full reference map (see above) —
                               // this no longer depends on zoom/pan, so the discretization — and hence
                               // the streamlines' seed points and directions — never changes underneath you
const FLOW_MIN_DRIFT = 1e-4;  // skip samples the model predicts won't move (data-space units over
                               // one FLOW_DT step — scaled down from the old 7-day threshold since
                               // a genuinely instantaneous 0.5-day step moves much less per sample)
const FLOW_MAX_WIDTH = 4.4;   // width at the STRONGEST local flow in view (at full zoom — see TU_LOD_ZOOM)
const FLOW_MIN_WIDTH_FRAC = 0.16; // width at the WEAKEST local flow, as a fraction of FLOW_MAX_WIDTH —
                                   // thin where flow is negligible, thickening continuously up to
                                   // FLOW_MAX_WIDTH where it's strongest (see drawFlowStreamline)
const FLOW_COLOR_LEVELS = 14; // number of discrete colour buckets along FLOW_RAMP — kept as a handful
                               // of solid-fill runs per streamline (not a per-pixel gradient) so this
                               // stays cheap to draw every frame; 14 is fine-grained enough to read as
                               // a smooth gradient even though it's technically discrete
const FLOW_SUPPORT_MIN_W = 0.05; // minimum inverse-distance weight from the nearest seed vectors before a
                                  // point counts as having real sample support; below this the field is
                                  // masked (Schluter et al. 2023: "masking grid regions with little support
                                  // from real samples") instead of extrapolating a direction from far away
const STREAM_SEEDS = 52;          // long curved streamlines drawn (subsampled from the sample vectors) —
                                  // ~3/4 of the earlier count: fewer, bolder lines rather than a dense mesh
const STREAM_STEPS = 16;          // forward integration steps per streamline (data-space, field-guided)
const STREAM_BRANCH_AT = 7;       // step index where ~1/3 of streamlines fork off a second thread
const STREAM_BRANCH_LEN = 7;      // steps traced along a fork
const STREAM_BRANCH_ANGLE = 0.36; // radians (~21°) a fork rotates away from the main flow
const STREAM_MERGE_DIST_FRAC = 0.65; // how close (as a fraction of the field kernel width sigma) a streamline
                                     // must come to an already-traced one before it snaps onto it and the two
                                     // render as a single channel — the converging-streamline look of the
                                     // flow plots in Schluter et al. 2023, rather than a parallel bundle
const FLOW_MERGE_MAX_WIDEN = 2.6;    // cap on how much a fully-merged trunk widens / brightens vs a lone line

// spatial subsample of TaxUMAP reference indices, one real observed sample
// per grid cell, spanning the FIXED full reference map (info.bounds) — not
// whatever's currently visible, so this set of seeds (and therefore the
// field computed from them) never changes just because the user zoomed/panned
function pickFlowSamplePoints(info){
  const [xmin,xmax,ymin,ymax]=info.bounds;
  const cellW=(xmax-xmin)/FLOW_GRID||1, cellH=(ymax-ymin)/FLOW_GRID||1;
  const chosen=new Map();
  for(let r=0;r<info.nRef;r++){
    const x=info.knnCoords[2*r], y=info.knnCoords[2*r+1];
    const cx=Math.min(FLOW_GRID-1,Math.max(0,Math.floor((x-xmin)/cellW)));
    const cy=Math.min(FLOW_GRID-1,Math.max(0,Math.floor((y-ymin)/cellH)));
    const key=cx*FLOW_GRID+cy;
    if(!chosen.has(key)) chosen.set(key,r);   // first reference point claims each cell
  }
  return [...chosen.values()];
}

let _flowCache={key:null, vectors:null, dirs:null, streamlines:null, rawMag:null, magRef:null};
function activePerturbationSchedule(){
  const sched={};
  Object.keys(S.perturbations).forEach(cat=>{ if(S.perturbations[cat]) sched[cat]=[[0,FLOW_DT]]; });
  return sched;
}

// A full recompute calls TAXUMAP.project() (the ~1.6ms O(nRef) kNN search)
// once per sample point — up to FLOW_GRID² of them — which measured out to
// ~500-700ms of solid main-thread work: long enough to freeze the tab for a
// beat right as a zoom gesture settles. Rather than run it all in one go, it
// runs in small time-boxed batches spread across animation frames (the same
// idea as React's time-slicing, or how a map tile loads progressively
// instead of blocking the map): each batch runs for at most
// FLOW_CHUNK_BUDGET_MS before yielding back to the browser, so the page
// stays responsive and the current frame rate doesn't drop, even though the
// field itself takes a few more frames in wall-clock time to finish.
const FLOW_CHUNK_BUDGET_MS = 10;
let _flowPending=null;   // {key, idxs, i, vectors, N, schedule, info}

function startFlowFieldRecompute(key){
  // never abandon in-progress work for a newer key — under a fast/jittery
  // gesture the target can keep moving before one batch even finishes, and
  // restarting from scratch each time (re-running pickFlowSamplePoints,
  // throwing away whatever samples were already computed) was turning a few
  // big stalls into many smaller ones instead of actually finishing faster.
  // Once the current computation completes, flowChunkStep() re-checks against
  // whatever the state is BY THEN and kicks off a fresh one if still stale —
  // so requests naturally coalesce onto the latest target instead of racing.
  if(_flowPending) return;
  const N = S.fc && S.fc.fullComp && S.fc.fullComp[0] ? S.fc.fullComp[0].length : null;
  if(!N) return;
  const info = TAXUMAP.info();
  const idxs = pickFlowSamplePoints(info);
  const schedule = activePerturbationSchedule();
  _flowPending={key, idxs, i:0, vectors:[], N, schedule, info};
  requestAnimationFrame(flowChunkStep);
}

function flowChunkStep(){
  const p=_flowPending; if(!p) return;
  const t0=performance.now();
  while(p.i<p.idxs.length && performance.now()-t0<FLOW_CHUNK_BUDGET_MS){
    const r=p.idxs[p.i++];
    const x0=new Float64Array(p.N);
    for(let g=p.info.gptr[r]; g<p.info.gptr[r+1]; g++) x0[p.info.genI[g]]=p.info.gVal[g];
    let fc;
    try{ fc=window.__tipnodeForecast(x0,0,FLOW_DT,p.schedule); }
    catch(e){ continue; }
    const comp2=fc.fullComp[fc.fullComp.length-1];
    const p1=TAXUMAP.project(comp2);
    if(!p1) continue;
    const x0d=p.info.knnCoords[2*r], y0d=p.info.knnCoords[2*r+1];
    const rawDx=p1[0]-x0d, rawDy=p1[1]-y0d;
    if(Math.hypot(rawDx,rawDy)<FLOW_MIN_DRIFT) continue;
    // Schluter et al. 2023: "map-space displacement divided by Δt as an
    // instantaneous velocity" — direction is unaffected by the division, but
    // it keeps the vector's magnitude a true (map-units)/day velocity
    p.vectors.push([x0d,y0d,x0d+rawDx/FLOW_DT,y0d+rawDy/FLOW_DT]);
  }
  if(p.i<p.idxs.length){
    requestAnimationFrame(flowChunkStep);
    return;
  }
  const dirs = smoothFlowDirections(p.vectors);
  const rawMag = p.vectors.map(([x0,y0,x1,y1])=>Math.hypot(x1-x0,y1-y0));
  const streamlines = buildStreamlines(p.vectors, dirs, rawMag, p.info.bounds);
  // colour/width reference "strongest flow" level: the seed magnitudes are
  // heavily right-skewed (a handful of outlier seeds can sit far above the
  // typical value), so normalising against the true max compresses nearly
  // the entire field into the bottom of the ramp. A high percentile instead
  // means the bulk of ordinary flow spans the full black->purple->orange
  // ramp, and only the genuinely strongest ~15% of it saturates to yellow.
  const sortedMag=rawMag.slice().sort((a,b)=>a-b);
  const magRef=sortedMag.length ? Math.max(1e-6, sortedMag[clamp(Math.floor(sortedMag.length*0.85),0,sortedMag.length-1)]) : 1e-6;
  _flowCache={key:p.key, vectors:p.vectors, dirs, streamlines, rawMag, magRef};
  _flowPending=null;
  if(S.flowOn && isExpanded('tuPanel')){
    drawFlowField(true);   // paint the finished field — data-space cache, just reproject it
    $('tuHint').textContent='drag the ● to move along the predicted path · scroll to zoom · two fingers to pan';
  }
}

// spatially smooth each vector's direction against its neighbours (inverse-
// distance weighted) so the field reads as one continuous flow rather than
// independent arrows — this is the "averaging" that gives streamlines their
// coherent look, and is recomputed alongside the vectors themselves (once
// per settle, not per frame — see drawFlowField).
function smoothFlowDirections(vectors){
  return vectors.map(([x0,y0,x1,y1],i)=>{
    let wx=0, wy=0, wsum=0;
    for(let j=0;j<vectors.length;j++){
      const [ox0,oy0,ox1,oy1]=vectors[j];
      const d=Math.hypot(ox0-x0,oy0-y0);
      const w=1/(1+d*d*36);           // ~falls off within a couple grid cells
      const odx=ox1-ox0, ody=oy1-oy0, ol=Math.hypot(odx,ody)||1e-9;
      wx+=w*odx/ol; wy+=w*ody/ol; wsum+=w;
    }
    const l=Math.hypot(wx,wy)||1e-9;
    return [wx/l, wy/l];   // smoothed unit direction
  });
}

// inverse-distance-weighted direction AND local speed of the (already-
// direction-smoothed) field at an arbitrary data-space point — turns the
// handful of discrete sample vectors into a continuous field a streamline
// can be traced through, annotated with how strong the flow is right there
// (used to colour/width each streamline point-by-point — see
// drawFlowStreamline — rather than with one value for the whole line).
function sampleFlowField(vectors, dirs, mags, sigma2, x, y){
  let wx=0, wy=0, wsum=0, wmax=0, wmag=0;
  for(let j=0;j<vectors.length;j++){
    const dx=x-vectors[j][0], dy=y-vectors[j][1];
    const w=1/(1+(dx*dx+dy*dy)/sigma2);
    if(w>wmax) wmax=w;
    wx+=w*dirs[j][0]; wy+=w*dirs[j][1]; wsum+=w;
    wmag+=w*mags[j];
  }
  // Schluter et al. 2023: mask grid regions with little support from real
  // samples rather than extrapolate a direction from far-away vectors — if
  // even the single nearest seed is many kernel-widths away, treat this
  // point as unsupported. buildStreamlines() stops tracing when this
  // returns null, so a streamline simply ends instead of drifting through
  // empty space.
  if(wsum<1e-9 || wmax<FLOW_SUPPORT_MIN_W) return null;
  const l=Math.hypot(wx,wy)||1e-9;
  return { dir:[wx/l, wy/l], mag: wmag/wsum };
}

// traces STREAM_SEEDS long curved paths through the interpolated field, in
// DATA space so the traced points stay correct however the view is zoomed/
// panned afterwards (drawFlowField just re-maps them each frame — see
// below); a subset fork partway through for the "splits off" look. Each
// point is [x, y, localMag] — the field's interpolated speed AT that point,
// carried along so the renderer can vary colour/width along the streamline
// instead of using one value for the whole line. This only touches the
// already-computed sample vectors — no extra model calls.
//
// STREAMLINE MERGING: lines are traced one at a time and every point of an
// accepted line goes into a spatial hash. While tracing a new line, if it
// ever runs within STREAM_MERGE_DIST_FRAC·sigma of an already-traced line it
// snaps its last point onto that line and stops — so a bundle of near-
// parallel lines converging on the same attractor collapses into one shared
// channel instead of a smear of overlapping strokes. The flow each merged
// line was carrying is then accumulated onto its trunk from the junction
// downstream (`.acc` per point), and the renderer widens + brightens the
// trunk in proportion, reproducing the "tributaries joining a river" look of
// the streamline plots in Schluter et al. 2023.
function buildStreamlines(vectors, dirs, mags, bounds){
  if(!vectors.length) return [];
  const [xmin,xmax,ymin,ymax]=bounds;
  const L=Math.max(xmax-xmin, ymax-ymin)||1;
  const sigma=(L/FLOW_GRID)*1.4, sigma2=sigma*sigma, stepData=sigma*0.5;
  const stride=Math.max(1, Math.ceil(vectors.length/STREAM_SEEDS));
  const lines=[];

  // spatial hash over accepted-line points, cell size == merge radius so a
  // proximity test only ever scans the 3x3 block of cells around a query
  const mergeDist=sigma*STREAM_MERGE_DIST_FRAC, mergeDist2=mergeDist*mergeDist;
  const cell=mergeDist||1e-6, grid=new Map();
  const cellKey=(x,y)=>Math.floor(x/cell)+','+Math.floor(y/cell);
  function nearestOnAccepted(x,y){
    const cx=Math.floor(x/cell), cy=Math.floor(y/cell);
    let best=null, bd=mergeDist2;
    for(let gx=cx-1;gx<=cx+1;gx++) for(let gy=cy-1;gy<=cy+1;gy++){
      const arr=grid.get(gx+','+gy); if(!arr) continue;
      for(let k=0;k<arr.length;k++){
        const p=arr[k], dx=p.x-x, dy=p.y-y, d=dx*dx+dy*dy;
        if(d<bd){ bd=d; best=p; }
      }
    }
    return best;   // {x,y,li,pi} or null
  }
  function registerLine(li){
    const pts=lines[li].pts;
    for(let pi=0;pi<pts.length;pi++){
      const k=cellKey(pts[pi][0],pts[pi][1]);
      let arr=grid.get(k); if(!arr){ arr=[]; grid.set(k,arr); }
      arr.push({x:pts[pi][0], y:pts[pi][1], li, pi});
    }
  }
  // trace one path from (sx,sy); `skipMerge` steps are exempt from the merge
  // test (used so a fork doesn't instantly re-merge into its own parent).
  // Returns {branchAt,branchDir,branchMag} of the accepted line, or null if
  // the seed sat right on an existing line (skipped as redundant).
  function trace(sx, sy, sMag, seed, forks, skipMerge){
    if(nearestOnAccepted(sx,sy)) return null;
    let x=sx, y=sy;
    const pts=[[x,y,sMag]];
    let parent=null, joinIdx=0;
    let branchAt=null, branchDir=null, branchMag=sMag;
    for(let s=0;s<STREAM_STEPS;s++){
      const f=sampleFlowField(vectors,dirs,mags,sigma2,x,y); if(!f) break;
      x+=f.dir[0]*stepData; y+=f.dir[1]*stepData;
      if(s>=skipMerge){
        const hit=nearestOnAccepted(x,y);
        if(hit){
          pts.push([hit.x, hit.y, (f.mag+lines[hit.li].pts[hit.pi][2])*0.5]);
          parent=hit.li; joinIdx=hit.pi;
          break;
        }
      }
      pts.push([x,y,f.mag]);
      if(s===STREAM_BRANCH_AT && forks){ branchAt=[x,y]; branchDir=f.dir; branchMag=f.mag; }
    }
    lines.push({pts, seed, parent, joinIdx});
    registerLine(lines.length-1);
    return {branchAt, branchDir, branchMag};
  }

  for(let i=0;i<vectors.length;i+=stride){
    const res=trace(vectors[i][0], vectors[i][1], mags[i], i, (i/stride)%3===0, 1);
    if(!res || !res.branchAt) continue;
    // a fork: rotate off the main flow, then let the field bend it back
    const sign=((i/stride)%6<3)?1:-1;
    const c=Math.cos(STREAM_BRANCH_ANGLE*sign), s2=Math.sin(STREAM_BRANCH_ANGLE*sign);
    let bx=res.branchAt[0], by=res.branchAt[1];
    let bdx=res.branchDir[0]*c-res.branchDir[1]*s2, bdy=res.branchDir[0]*s2+res.branchDir[1]*c;
    const branch=[[bx,by,res.branchMag]];
    let bparent=null, bjoin=0;
    for(let s=0;s<STREAM_BRANCH_LEN;s++){
      const f=sampleFlowField(vectors,dirs,mags,sigma2,bx,by); if(!f) break;
      let dx=f.dir[0]+bdx*0.6, dy=f.dir[1]+bdy*0.6, dl=Math.hypot(dx,dy)||1e-9; dx/=dl; dy/=dl;
      bx+=dx*stepData; by+=dy*stepData;
      if(s>=3){   // let it clear its own parent line before it can merge
        const hit=nearestOnAccepted(bx,by);
        if(hit){ branch.push([hit.x,hit.y,(f.mag+lines[hit.li].pts[hit.pi][2])*0.5]); bparent=hit.li; bjoin=hit.pi; break; }
      }
      branch.push([bx,by,f.mag]); bdx=dx; bdy=dy;
    }
    lines.push({pts:branch, seed:i+0.5, parent:bparent, joinIdx:bjoin});
    registerLine(lines.length-1);
  }

  // flow accumulation. A line can only ever merge into an EARLIER-created one,
  // so descending index order visits every tributary before its trunk: push
  // each line's arriving flow (its accumulation at the junction) onto the
  // trunk from the join point to the trunk's end. Trunks that themselves merge
  // then carry the combined total onward.
  const acc=lines.map(l=>{ const a=new Float64Array(l.pts.length); a.fill(1); return a; });
  for(let li=lines.length-1;li>=0;li--){
    const par=lines[li].parent; if(par==null) continue;
    const arriving=acc[li][acc[li].length-1];
    const pa=acc[par], j=Math.min(lines[li].joinIdx, pa.length-1);
    for(let k=j;k<pa.length;k++) pa[k]+=arriving;
  }
  lines.forEach((l,li)=>{ l.acc=acc[li]; });
  return lines;
}

function clearFlowCanvas(){
  const cv=$('flowCanvas'); if(!cv||!_tu) return;
  const ctx=cv.getContext('2d');
  ctx.setTransform(_tu.dpr,0,0,_tu.dpr,0,0); ctx.clearRect(0,0,_tu.w,_tu.h);
}

// Catmull-Rom point on the segment through p1..p2 (p0/p3 shape the tangents)
// — turns the traced step points into a visually smooth curve rather than a
// jointed polyline. Works componentwise over however many numbers each point
// has, so the same function smooths plain [x,y] screen points and [x,y,mag]
// triples alike (the local-magnitude channel gets smoothed right along with
// position, so colour/width also ramp smoothly rather than jumping between
// the raw traced samples).
function catmullRom(p0,p1,p2,p3,t){
  const t2=t*t, t3=t2*t, n=p1.length, out=new Array(n);
  for(let k=0;k<n;k++){
    out[k]=0.5*((2*p1[k])+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t2+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t3);
  }
  return out;
}
function smoothPolyline(pts, perSeg){
  if(pts.length<3) return pts.slice();
  const ext=[pts[0], ...pts, pts[pts.length-1]];
  const out=[];
  for(let i=0;i<pts.length-1;i++){
    for(let s=0;s<perSeg;s++) out.push(catmullRom(ext[i],ext[i+1],ext[i+2],ext[i+3], s/perSeg));
  }
  out.push(pts[pts.length-1]);
  return out;
}

// Colour ramp for local flow strength: negligible flow reads as thin and
// almost black, strengthening through dark purple, a magenta/red-orange
// transition, orange, and finally a bright yellow at the strongest flow
// anywhere in view — an inferno-style heat ramp. A handful of stops linearly
// interpolated per point is indistinguishable from a true smooth gradient at
// this line thickness, for a fraction of the cost. Two variants: the panel
// background flips between near-black and near-white with the app's own
// light/dark toggle, and pure black-on-black or pale-yellow-on-white would
// both disappear, so the two ends of the ramp are nudged to stay visible
// against whichever background is live; the purple/magenta/orange middle
// (already mid-luminance) is shared.
const FLOW_RAMP_DARK = [
  [0.00, 36,  32,  40 ],   // dim charcoal — reads as "black" but stays visible on the dark panel
  [0.16, 58,  16,  84 ],   // dark purple
  [0.34, 118, 30,  120],   // purple
  [0.52, 190, 56,  96 ],   // lighter purple turning toward red/orange
  [0.68, 228, 92,  36 ],   // orange
  [0.84, 248, 162, 24],   // amber (intermediate step toward yellow)
  [1.00, 255, 234, 20 ],   // bright yellow
];
const FLOW_RAMP_LIGHT = [
  [0.00, 20,  17,  22 ],   // near-black — reads clearly on the light panel
  [0.16, 55,  16,  80 ],   // dark purple
  [0.34, 112, 28,  116],   // purple
  [0.52, 178, 48,  86 ],   // lighter purple turning toward red/orange
  [0.68, 206, 84,  24 ],   // orange
  [0.84, 210, 132, 10],   // amber
  [1.00, 216, 160, 0  ],   // deep gold — a pale yellow would wash out on a light background
];
const currentFlowRamp = ()=> document.body.dataset.theme==='light' ? FLOW_RAMP_LIGHT : FLOW_RAMP_DARK;
function flowRampColor(t, ramp){
  t=clamp(t,0,1);
  let i=0;
  while(i<ramp.length-2 && t>ramp[i+1][0]) i++;
  const [t0,r0,g0,b0]=ramp[i], [t1,r1,g1,b1]=ramp[i+1];
  const f=(t1>t0)?(t-t0)/(t1-t0):0;
  return `rgb(${Math.round(r0+(r1-r0)*f)},${Math.round(g0+(g1-g0)*f)},${Math.round(b0+(b1-b0)*f)})`;
}


// fills one solid-colour ribbon segment through screen-space points
// pts[i] = [x, y, halfWidth] (per-point half width, already computed by the
// caller) — a plain perpendicular-offset ribbon with flat end caps, no flare.
function fillRibbonRun(ctx, pts){
  const n=pts.length; if(n<2) return;
  const left=[], right=[];
  for(let i=0;i<n;i++){
    const p=pts[i], pa=pts[Math.max(0,i-1)], pb=pts[Math.min(n-1,i+1)];
    let tx=pb[0]-pa[0], ty=pb[1]-pa[1]; const tl=Math.hypot(tx,ty)||1; tx/=tl; ty/=tl;
    const nx=-ty, ny=tx, w=p[2];
    left.push([p[0]+nx*w, p[1]+ny*w]); right.push([p[0]-nx*w, p[1]-ny*w]);
  }
  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  for(let i=1;i<n;i++) ctx.lineTo(left[i][0], left[i][1]);
  for(let i=n-1;i>=0;i--) ctx.lineTo(right[i][0], right[i][1]);
  ctx.closePath();
  ctx.fill();
}

// draws one streamline as a sequence of colour/width "runs": at every point
// the LOCAL interpolated flow speed (carried on the point since
// buildStreamlines — not one magnitude for the whole line) sets both the
// ribbon's half-width (thin where flow is weak, up to FLOW_MAX_WIDTH where
// it's strongest) and a bucket along FLOW_RAMP. Consecutive points that land
// in the same bucket are merged into a single fillRibbonRun() call, so a
// fairly uniform stretch of flow costs one fill — only where the local speed
// actually crosses into a new bucket does the line get an extra seam — while
// width still varies continuously point-by-point within a run. Direction
// arrowheads are dropped along the line at a roughly fixed screen-space
// spacing (see the arrowhead block below), so every visible stretch of flow —
// each branch and each merged tributary is its own line here — carries clear
// direction cues.
const ARROW_SPACING = 120;  // px of screen length between successive arrowheads on a line
const ARROW_SIZE = 1.55;    // size multiplier vs the earlier single-arrowhead look

// one filled direction chevron on the local tangent at smoothed point i
function drawFlowArrow(ctx, pts, wArr, cArr, i, ramp, isBranch){
  const n=pts.length; i=Math.min(n-2, Math.max(1, i));
  const a=pts[i-1], b=pts[i+1], p=pts[i];
  let tx=b[0]-a[0], ty=b[1]-a[1]; const tl=Math.hypot(tx,ty)||1; tx/=tl; ty/=tl;
  const nx=-ty, ny=tx;
  const halfW=Math.max(wArr[i], 1.2);
  const flareW=clamp(halfW*2.0*ARROW_SIZE, 6, 11);
  const len=clamp(halfW*4.2*ARROW_SIZE, 12, 22);
  const tipX=p[0]+tx*len*0.55, tipY=p[1]+ty*len*0.55;
  const backX=p[0]-tx*len*0.45, backY=p[1]-ty*len*0.45;
  ctx.beginPath();
  ctx.moveTo(backX+nx*flareW, backY+ny*flareW);
  ctx.lineTo(tipX, tipY);
  ctx.lineTo(backX-nx*flareW, backY-ny*flareW);
  ctx.closePath();
  ctx.fillStyle=flowRampColor(cArr[i], ramp);
  ctx.globalAlpha=lerp(0.62,1,cArr[i])*(isBranch?0.85:1);
  ctx.fill();
}

function drawFlowStreamline(ctx, rawPts, maxMag, baseW, isBranch, seed, ramp){
  const pts=smoothPolyline(rawPts, 4);
  const n=pts.length; if(n<2) return;
  const widthScale=(isBranch?0.72:1)*1.0;   // ~2x the earlier flow-line thickness
  // p[3] = accumulated flow (1 for a line no other line merged into, higher on
  // a trunk downstream of one or more junctions). sqrt keeps the widening/
  // brightening sub-linear and capped so a heavily-merged trunk reads as one
  // bold channel without swamping the map.
  const accW=pts.map(p=>Math.min(FLOW_MERGE_MAX_WIDEN, Math.sqrt(Math.max(1, p[3]||1))));
  const tArr=pts.map(p=>clamp(p[2]/maxMag,0,1));
  const cArr=pts.map((p,i)=>clamp(tArr[i]*(1+0.16*(accW[i]-1)),0,1));   // colour/alpha run hotter where merged
  const wArr=tArr.map((t,i)=>baseW*lerp(FLOW_MIN_WIDTH_FRAC,1,t)*widthScale*accW[i]);
  const lvlArr=cArr.map(t=>Math.min(FLOW_COLOR_LEVELS-1, Math.floor(t*FLOW_COLOR_LEVELS)));
  let runStart=0;
  for(let i=1;i<n;i++){
    if(lvlArr[i]!==lvlArr[runStart] || i===n-1){
      const runPts=[];
      for(let k=runStart;k<=i;k++) runPts.push([pts[k][0],pts[k][1],wArr[k]]);
      const avgT=(cArr[runStart]+cArr[i])/2;
      ctx.fillStyle=flowRampColor(avgT, ramp);
      ctx.globalAlpha=lerp(0.32,0.95,avgT)*(isBranch?0.78:1);
      fillRibbonRun(ctx, runPts);
      runStart=i;   // next run starts at this shared boundary point — no gap
    }
  }
  // arrowheads along the line at a fixed screen-space spacing. Cumulative
  // screen length is walked once; a chevron is dropped every ARROW_SPACING px.
  // A branch also gets one just past its start so the fork's new direction is
  // immediately legible — where one channel fans into several, each resulting
  // line then carries its own arrowhead. Every line gets at least one.
  const cum=[0];
  for(let i=1;i<n;i++) cum[i]=cum[i-1]+Math.hypot(pts[i][0]-pts[i-1][0], pts[i][1]-pts[i-1][1]);
  const total=cum[n-1];
  const targets=[];
  if(isBranch && total>2) targets.push(Math.min(total*0.22, ARROW_SPACING*0.8));
  for(let d=ARROW_SPACING*0.7; d<total-2; d+=ARROW_SPACING) targets.push(d);
  if(!targets.length && total>1) targets.push(total*0.5);
  let lastD=-1e9;
  for(const d of targets){
    if(d-lastD < ARROW_SPACING*0.55) continue;
    let i=1; while(i<n-1 && cum[i]<d) i++;
    drawFlowArrow(ctx, pts, wArr, cArr, i, ramp, isBranch);
    lastD=d;
  }
}

function renderFlowFieldStreamlines(cache){
  const ctx=$('flowCanvas').getContext('2d');
  ctx.setTransform(_tu.dpr,0,0,_tu.dpr,0,0);
  const maxMag=cache.magRef || Math.max(1e-6, ...cache.rawMag);
  const ramp=currentFlowRamp();
  // thinner ceiling when zoomed all the way out (see TU_LOD_ZOOM) — recomputed
  // every call, including mid-gesture reprojection, so width tracks zoom
  // smoothly even though the underlying streamlines only retrace on settle
  const baseW=lerp(FLOW_MAX_WIDTH*0.36, FLOW_MAX_WIDTH, tuLod());
  cache.streamlines.forEach(line=>{
    const acc=line.acc;
    const screenPts=line.pts.map(([x,y,m],i)=>{ const p=_tu.map(x,y); return [p[0],p[1],m, acc?acc[i]:1]; });
    if(screenPts.length<2) return;
    const isBranch = line.seed % 1 !== 0;
    drawFlowStreamline(ctx, screenPts, maxMag, baseW, isBranch, line.seed, ramp);
  });
  ctx.globalAlpha=1;
}

// draws the current flow field. The field itself lives entirely in DATA
// space and is keyed only on the active perturbation set — never on zoom/pan
// — so `fromCache`=true (used while a zoom/pan gesture is in flight, and
// after every gesture settles) just re-projects the already-cached
// streamlines through the current pan/zoom instead of retracing them; the
// streamlines' directions never change from this, only their screen
// position/scale. When the perturbation set actually changes, it never
// blocks: the last-known field keeps rendering while
// startFlowFieldRecompute() fills in the new one across a few animation
// frames in the background (see above), then flowChunkStep() calls back in
// here once it's done.
function drawFlowField(fromCache){
  clearFlowCanvas();
  if(!S.flowOn || !_tu) return;
  if(fromCache && _flowCache.vectors){ renderFlowFieldStreamlines(_flowCache); return; }
  const key = Object.keys(S.perturbations).filter(c=>S.perturbations[c]).sort().join(',');
  if(_flowCache.key!==key || !_flowCache.vectors) startFlowFieldRecompute(key);
  if(_flowCache.vectors) renderFlowFieldStreamlines(_flowCache);   // last-known field, even if stale
}

// current antibiotic classes active in S.schedule at day `day` (interval-membership test)
function administeredAt(day){
  const set={};
  (S.abxOrder||[]).forEach(cat=>{
    const ivs=S.schedule[cat]||[];
    set[cat]=ivs.some(([s,e])=> day>=s-1e-6 && day<=e+1e-6);
  });
  return set;
}
// when "Match antibiotics administered" is on, keeps the Perturbations
// checklist locked to whatever the patient is actually receiving at the
// current readout day — called on every taxUMAP render (readout drag,
// schedule edit, patient/sample switch), so it tracks the dotted cursor live.
function syncPerturbToAdministered(){
  if(!S.matchAdministered) return;
  const set=administeredAt(S.readoutDay);
  const list=$('perturbList');
  Object.keys(set).forEach(cat=>{
    S.perturbations[cat]=set[cat];
    const input=list&&list.querySelector(`input[data-cat="${cat}"]`);
    if(input) input.checked=set[cat];
  });
}

// "Show flow lines" toggle + the "Perturbations" antibiotic checklist under it.
// The perturbation set is independent of the antibiotic-timeline editor: it
// drives ONLY the map-wide flow field (a constant, sustained-exposure query
// against the model), not the current patient's own forecast — unless
// "Match antibiotics administered" is checked, which instead drives the
// checklist FROM the patient's live schedule at the current readout day.
function buildPerturbList(){
  const list=$('perturbList'); if(!list || list.childElementCount) return;   // build once
  const cats=(S.abxOrder||[]).slice().sort((a,b)=>abxLabel(a).localeCompare(abxLabel(b)));
  cats.forEach(cat=>{
    S.perturbations[cat]=false;
    const lab=document.createElement('label'); lab.className='perturb-item';
    lab.innerHTML=`<input type="checkbox" data-cat="${cat}"><span class="perturb-swatch" style="background:${cvar('--flow')}"></span>${abxLabel(cat)}`;
    lab.querySelector('input').addEventListener('change',(e)=>{
      // reflect the checkbox instantly; defer the (expensive) recompute one
      // tick so the browser paints the toggle before the heavy work runs
      const checked=e.target.checked;
      if(S.matchAdministered){ S.matchAdministered=false; $('perturbMatchToggle').checked=false; }
      setTimeout(()=>{ S.perturbations[cat]=checked; if(S.fc) renderTaxumap(); },0);
    });
    list.appendChild(lab);
  });
}
function setupFlowControls(){
  $('flowToggle').addEventListener('change',(e)=>{
    const checked=e.target.checked;
    $('perturbPanel').classList.toggle('hidden', !checked);
    setTimeout(()=>{ S.flowOn=checked; if(S.fc) renderTaxumap(); },0);
  });
  $('perturbMatchToggle').addEventListener('change',(e)=>{
    const checked=e.target.checked;
    setTimeout(()=>{
      S.matchAdministered=checked;
      if(S.matchAdministered) syncPerturbToAdministered();
      if(S.fc) renderTaxumap();
    },0);
  });
}

function drawDayAxis(g, yBase, showLabels){
  g.appendChild(el('line',{x1:PAD_L,y1:yBase,x2:S.plotW-PAD_R,y2:yBase,class:'axis-base'}));
  dayTicks().forEach(d=>{
    g.appendChild(el('line',{x1:xDay(d),y1:yBase,x2:xDay(d),y2:yBase+4,class:'axis-base'}));
    if(showLabels){
      g.appendChild(el('text',{x:xDay(d),y:yBase+15,'text-anchor':'middle'},
        [txt(`${Math.round(d)}`)]));   // day relative to HCT
    }
  });
}

function drawReadout(g, top, plotH, y){
  const x=xDay(S.readoutDay);
  g.appendChild(el('line',{x1:x,y1:top,x2:x,y2:top+plotH,class:'readout-line'}));
  const handle=el('path',{class:'readout-handle',
    d:`M${x-6},${top} L${x+6},${top} L${x},${top+9} Z`});
  g.appendChild(handle);
}

function renderCompGutter(gutterId, scrollId, y, top, plotH){
  const gut=$(gutterId); gut.innerHTML='';
  const svg=el('svg',{width:132,height:$(scrollId).clientHeight||300});
  [0,0.25,0.5,0.75,1].forEach(v=>{
    svg.appendChild(el('text',{x:124,y:y(v)+3,'text-anchor':'end',class:'gut-ylabel'},[txt(v.toFixed(2))]));
  });
  svg.appendChild(el('text',{x:12,y:top+plotH/2,'text-anchor':'middle',class:'gut-ylabel',
    transform:`rotate(-90 12 ${top+plotH/2})`,fill:cvar('--muted')},[txt('relative abundance')]));
  gut.appendChild(svg);
}
const txt=(s)=>document.createTextNode(s);

// --------------------------------------------------------------------- //
//  antibiotic editor
// --------------------------------------------------------------------- //
function renderAbx(){
  if(!S.fc || !isExpanded('abxPanel')) return;
  const svg=$('abxSvg');
  const n=S.abxOrder.length;
  const plotH=n*LANE_H;
  const H=plotH+ABX_AXIS_H+2;
  // no internal scroll any more — the whole stage scrolls, so just size to fit all lanes
  $('scrollAbx').style.minHeight=(H+14)+'px';
  svg.setAttribute('width',S.plotW); svg.setAttribute('height',H);
  svg.setAttribute('viewBox',`0 0 ${S.plotW} ${H}`); svg.innerHTML='';
  const g=el('g');
  // lanes
  S.abxOrder.forEach((cat,li)=>{
    if(li%2===0) g.appendChild(el('rect',{x:PAD_L,y:li*LANE_H,width:S.plotW-PAD_L-PAD_R,height:LANE_H,class:'lane-alt'}));
    g.appendChild(el('line',{x1:PAD_L,y1:(li+1)*LANE_H,x2:S.plotW-PAD_R,y2:(li+1)*LANE_H,class:'axis-tick',opacity:0.35}));
  });
  // day gridlines
  dayTicks().forEach(d=>g.appendChild(el('line',{x1:xDay(d),y1:0,x2:xDay(d),y2:plotH,class:'axis-tick',opacity:0.3})));
  // bars — all drawn in the same green (no actual-vs-added distinction)
  S.abxOrder.forEach((cat,li)=>{
    const cur=(S.schedule[cat]||[]);
    cur.forEach(([s,e])=>{
      const s2=clamp(s,S.t0,S.t0+S.horizon), e2=clamp(e,S.t0,S.t0+S.horizon);
      if(e2<=s2 && !(e>=S.t0 && s<=S.t0+S.horizon)) return;
      const x=xDay(Math.max(s,S.t0)), w=Math.max(xDay(Math.min(e,S.t0+S.horizon))-x,3);
      g.appendChild(el('rect',{x,y:li*LANE_H+4,width:w,height:LANE_H-8,rx:3,
        fill:cvar('--accent2'),'fill-opacity':0.85,class:'abx-bar',
        'data-cat':cat,'data-s':s,'data-e':e}));
    });
  });
  // readout line across lanes
  g.appendChild(el('line',{x1:xDay(S.readoutDay),y1:0,x2:xDay(S.readoutDay),y2:plotH,class:'readout-line'}));
  // day axis
  drawDayAxis(g, plotH+2, true);
  svg.appendChild(g);
  renderAbxGutter();
}

// shorten a raw drug-class key ("glycopeptide_antibiotics") to a compact display
// label ("glycopeptide") — shared by the abx-timeline gutter and the
// Perturbations toggle list on the TaxUMAP flow field
function abxLabel(cat){
  return cat.replace(/_/g,' ').replace(' antibiotics','').replace(' derivatives','').replace(' agents','');
}

function renderAbxGutter(){
  const gut=$('abxGutter'); gut.innerHTML='';
  const svg=el('svg',{width:132,height:S.abxOrder.length*LANE_H+ABX_AXIS_H+2});
  S.abxOrder.forEach((cat,li)=>{
    const used=(S.baseSchedule[cat]&&S.baseSchedule[cat].length)|| (S.schedule[cat]&&S.schedule[cat].length);
    const label=abxLabel(cat);
    const t=el('text',{x:126,y:li*LANE_H+LANE_H/2+3.5,'text-anchor':'end',
      class:'gut-catlabel'+(used?'':' unused')},[txt(label.length>19?label.slice(0,18)+'…':label)]);
    svg.appendChild(t);
  });
  gut.appendChild(svg);
}

// --------------------------------------------------------------------- //
//  editing interactions
// --------------------------------------------------------------------- //
let drag=null, readoutDrag=null, tuDrag=false;
function refreshReadoutViews(){ renderComposition(); renderObserved(); renderTaxumap(); renderAbx(); }
function setupPointer(){   // attached ONCE from init()
  const near=(ev,sv)=> Math.abs(localX(ev,sv)-xDay(S.readoutDay))<7;
  // trajectory / observed-abundance charts: click anywhere to jump the readout
  // day there, then drag — same behaviour as the diversity/GMHI sparklines
  ['compSvg','obsSvg'].forEach(id=>{
    $(id).addEventListener('pointerdown',(ev)=>{
      if(!S.fc) return;
      readoutDrag=$(id);
      S.readoutDay=clamp(Math.round(dayFromX(localX(ev,$(id)))), S.t0, S.t0+S.horizon);
      refreshReadoutViews();
      ev.preventDefault();
    });
  });
  // taxUMAP: grab the readout dot and slide it along the predicted path —
  // the trajectory itself is unchanged, only the readout day (and hence the
  // dot's position along the path) moves forward/back as you drag
  $('taxumapSvg').addEventListener('pointerdown',(ev)=>{
    if(!S.fc || !_tu || !_tu.pts || !_tu.dotPos) return;
    const [x,y]=localXY(ev,$('taxumapSvg'));
    if(Math.hypot(x-_tu.dotPos[0], y-_tu.dotPos[1])<14){
      tuDrag=true; document.body.classList.add('tu-dragging'); ev.preventDefault();
    }
  });
  const abx=$('abxSvg');
  abx.addEventListener('pointerdown',(ev)=>{
    if(!S.fc) return;
    if(near(ev,abx)){ readoutDrag=abx; ev.preventDefault(); return; }
    const {day,lane}=hit(ev);
    if(lane<0||lane>=S.abxOrder.length) return;
    drag={cat:S.abxOrder[lane], lane, start:snap(day), cur:snap(day)};
    S._preSched=clone(S.schedule);
    ghost();
  });
  window.addEventListener('pointermove',(ev)=>{
    if(tuDrag){
      const [x,y]=localXY(ev,$('taxumapSvg'));
      const idx=nearestTaxumapIndex(x,y);
      if(idx!=null){ S.readoutDay=_tu.days[idx]; refreshReadoutViews(); }
      return;
    }
    if(readoutDrag){
      S.readoutDay=clamp(Math.round(dayFromX(localX(ev,readoutDrag))), S.t0, S.t0+S.horizon);
      refreshReadoutViews(); return;
    }
    if(drag){
      drag.cur=snap(dayFromX(localX(ev,abx)));
      ghost();
      if(Math.abs(drag.cur-drag.start)>=1){ applyDrag(true); throttledCommit(); }
    }
  });
  window.addEventListener('pointerup',()=>{
    readoutDrag=null;
    if(tuDrag){ tuDrag=false; document.body.classList.remove('tu-dragging'); }
    if(drag){
      const moved=Math.abs(drag.cur-drag.start);
      if(moved<0.75) removeBarAt(drag.cat, drag.start);
      else applyDrag(false);
      S._preSched=null; drag=null; clearGhost(); commit();
    }
  });
}

function localX(ev,svg){ const s=svg||$('abxSvg'); const r=s.getBoundingClientRect(); return ev.clientX-r.left; }
function localXY(ev,svg){ const r=svg.getBoundingClientRect(); return [ev.clientX-r.left, ev.clientY-r.top]; }
function hit(ev){
  const r=$('abxSvg').getBoundingClientRect();
  const x=ev.clientX-r.left, y=ev.clientY-r.top;
  const lane=Math.floor(y/LANE_H);
  const t=ev.target;
  return {day:dayFromX(x), lane, onBar: t && t.classList.contains('abx-bar') ? t : null};
}
const snap=(d)=> Math.round(d);   // snap to whole days

function applyDrag(preview){
  const s=Math.min(drag.start,drag.cur), e=Math.max(drag.start,drag.cur);
  const cat=drag.cat;
  const base = clone(S._preSched || S.schedule);   // schedule before this drag began
  const list=(base[cat]||[]).slice();
  list.push([s, Math.max(e, s+1)]);
  base[cat]=mergeIv(list);
  S.schedule=base;
  renderAbx();
}
function removeBarAt(cat, day){
  const list=(S.schedule[cat]||[]).filter(([s,e])=> !(day>=s-0.5 && day<=e+0.5));
  if(list.length) S.schedule[cat]=list; else delete S.schedule[cat];
  renderAbx();
}
function mergeIv(ivs){
  ivs=ivs.map(iv=>iv.slice()).sort((a,b)=>a[0]-b[0]);
  const out=[ivs[0]];
  for(let i=1;i<ivs.length;i++){ const [s,e]=ivs[i];
    if(s<=out[out.length-1][1]+0.01) out[out.length-1][1]=Math.max(out[out.length-1][1],e);
    else out.push([s,e]); }
  return out;
}

let _ghostEls=[];
function ghost(){
  clearGhost();
  if(!drag) return;
  const s=Math.min(drag.start,drag.cur), e=Math.max(drag.start,drag.cur);
  const x=xDay(s), w=Math.max(xDay(e)-x,3);
  const rect=el('rect',{x,y:drag.lane*LANE_H+4,width:w,height:LANE_H-8,rx:3,
    fill:cvar('--accent'),'fill-opacity':0.4,class:'ghost-bar'});
  $('abxSvg').querySelector('g').appendChild(rect); _ghostEls.push(rect);
}
function clearGhost(){ _ghostEls.forEach(e=>e.remove()); _ghostEls=[]; }

let _thr=0;
function throttledCommit(){ const now=performance.now(); if(now-_thr>140){ _thr=now; commit(); } }

// --------------------------------------------------------------------- //
//  small numeric helpers
// --------------------------------------------------------------------- //
function interp(days, arr, d){
  if(d<=days[0]) return arr[0];
  if(d>=days[days.length-1]) return arr[arr.length-1];
  let i=1; while(days[i]<d) i++;
  const f=(d-days[i-1])/(days[i]-days[i-1]);
  return arr[i-1]+f*(arr[i]-arr[i-1]);
}

// --------------------------------------------------------------------- //
//  guided tutorial — a top-to-bottom, left-to-right spotlight tour of the
//  explorer. Each step highlights one real element (a "cutout" through a
//  dimmed backdrop, built from four blocker rectangles so the background
//  stays inert while the highlighted element itself is still fully live —
//  the patient-search step genuinely drives selectPatient()), with a
//  pointer-bubble explaining it. Steps are computed fresh each time the
//  tour opens so the patient-search prompt reflects whoever's on screen.
// --------------------------------------------------------------------- //
const TUT = { steps:[], idx:0, active:false, waitTimer:null, reflow:null };

function tutorialSteps(){
  const targetPid = String(S.pid)==='557' ? '780' : '557';
  return [
    { target:'#patientCtl', focus:'#patientSearch', title:'Find a patient', body:
      `Search for and open patient <b>${targetPid}</b> to continue.`,
      waitFor:()=>String(S.pid)===targetPid, waitHint:`Waiting for you to open patient ${targetPid}…`, doneHint:'Moved on.' },
    { target:'#sampleCtl', title:'16S sample', body:
      `The forecast starts from whichever real stool sample is selected here.` },
    { target:'#trajPanel', title:'Predicted microbiome composition', body:
      `The glowing green line tracks the ${enteroRiskWindowDays()}-day trailing mean of predicted Enterococcus abundance, the model's bloodstream-infection risk signal.` },
    { target:'#obsPanel', title:'Observed microbiome composition', body:
      `These are the patient's actual measured 16S samples, on the same day axis as the forecast.` },
    { target:'#abxPanel', title:'Antibiotic timeline', body:
      `Drag on a lane to add a course of that drug class, or click a bar to remove one.` },
    { target:'#tuPanel', title:'TaxUMAP community map', body:
      `This map shows community types from thousands of real samples, with the dot marking this forecast's current position.` },
    { target:'#flowToggleLbl', title:'Flow lines and perturbations', body:
      `Checked drug classes show where the model predicts communities drift under sustained exposure to them.` },
  ];
}

function tutorialLabel(){ $('tutStepCount').textContent=(TUT.idx+1)+' / '+TUT.steps.length; }

function tutorialRenderStep(){
  const step=TUT.steps[TUT.idx];
  $('tutTitle').innerHTML=step.title;
  $('tutBody').innerHTML=step.body;
  tutorialLabel();
  $('tutPrevBtn').disabled = TUT.idx===0;
  $('tutNextBtn').textContent = TUT.idx===TUT.steps.length-1 ? 'Finish' : 'Next ▶';
  const hint=$('tutActionHint');
  if(step.waitFor){ hint.textContent=step.waitHint||''; hint.classList.remove('hidden'); }
  else hint.classList.add('hidden');
  const target = step.target ? document.querySelector(step.target) : null;
  // auto-open whichever panel this step lives in, if it's currently collapsed
  const panel = target && target.closest('.panel');
  if(panel && panel.classList.contains('collapsed')) panel.querySelector('.panel-toggle').click();
  if(target) target.scrollIntoView({block:'center', behavior:'instant'});
  if(step.focus){ const f=document.querySelector(step.focus); if(f) f.focus(); }
  requestAnimationFrame(()=>requestAnimationFrame(tutorialPosition));
  clearTimeout(TUT.waitTimer);
  if(step.waitFor) tutorialPoll();
}

function tutorialPoll(){
  const step=TUT.steps[TUT.idx];
  if(!TUT.active || !step || !step.waitFor) return;
  tutorialPosition();   // re-measure every tick — catches the patient dropdown opening/filtering
  if(step.waitFor()){
    $('tutActionHint').textContent = step.doneHint || 'Moved on.';
    $('tutRing').classList.remove('waiting');
    TUT.waitTimer=setTimeout(()=>{ if(TUT.active) tutorialNext(); }, 800);
    return;
  }
  $('tutRing').classList.add('waiting');
  TUT.waitTimer=setTimeout(tutorialPoll, 350);
}

// the target's own rect, unioned with any open (non-hidden) dropdown inside
// it — dropdowns are position:absolute so they don't expand their parent's
// natural bounding rect, but they still need to sit inside the spotlight
// cutout (e.g. the patient-search results list) or the blockers swallow clicks on them
function tutorialTargetRect(target){
  let r=target.getBoundingClientRect();
  const dd=target.querySelector('.dropdown:not(.hidden)');
  if(dd){
    const dr=dd.getBoundingClientRect();
    r={ top:Math.min(r.top,dr.top), left:Math.min(r.left,dr.left),
        right:Math.max(r.right,dr.right), bottom:Math.max(r.bottom,dr.bottom) };
  }
  return r;
}
function setRect(elm,x,y,w,h){ elm.style.left=x+'px'; elm.style.top=y+'px'; elm.style.width=Math.max(0,w)+'px'; elm.style.height=Math.max(0,h)+'px'; }

function tutorialPosition(){
  if(!TUT.active) return;
  const step=TUT.steps[TUT.idx];
  const vw=window.innerWidth, vh=window.innerHeight;
  const target = step.target ? document.querySelector(step.target) : null;
  const ring=$('tutRing'), card=$('tutCard');
  if(!target){
    setRect($('tutTop'),0,0,vw,vh); setRect($('tutBottom'),0,vh,vw,0);
    setRect($('tutLeft'),0,0,0,vh); setRect($('tutRight'),vw,0,0,vh);
    ring.style.display='none';
    card.dataset.arrow='none';
    const cw=card.offsetWidth||328, ch=card.offsetHeight||140;
    card.style.left=((vw-cw)/2)+'px'; card.style.top=((vh-ch)/2)+'px';
    return;
  }
  ring.style.display='block';
  const pad=7, r=tutorialTargetRect(target);
  const top=Math.max(0,r.top-pad), left=Math.max(0,r.left-pad),
        right=Math.min(vw,r.right+pad), bottom=Math.min(vh,r.bottom+pad);
  setRect($('tutTop'),0,0,vw,top);
  setRect($('tutBottom'),0,bottom,vw,vh-bottom);
  setRect($('tutLeft'),0,top,left,bottom-top);
  setRect($('tutRight'),right,top,vw-right,bottom-top);
  setRect(ring,left,top,right-left,bottom-top);
  if(!step.waitFor) ring.classList.remove('waiting');
  const gap=14, cw=card.offsetWidth||328, ch=card.offsetHeight||140;
  let place,x,y;
  if(bottom+gap+ch<=vh){ place='bottom'; x=left; y=bottom+gap; }
  else if(top-gap-ch>=0){ place='top'; x=left; y=top-gap-ch; }
  else if(right+gap+cw<=vw){ place='right'; x=right+gap; y=Math.max(8,top); }
  else { place='left'; x=Math.max(8,left-gap-cw); y=Math.max(8,top); }
  x=clamp(x,8,Math.max(8,vw-cw-8)); y=clamp(y,8,Math.max(8,vh-ch-8));
  card.style.left=x+'px'; card.style.top=y+'px'; card.dataset.arrow=place;
  card.style.setProperty('--arrow-x', clamp((left+right)/2-x,16,cw-16)+'px');
}

function tutorialNext(){ if(TUT.idx>=TUT.steps.length-1){ tutorialEnd(); return; } TUT.idx++; tutorialRenderStep(); }
function tutorialPrev(){ if(TUT.idx<=0) return; TUT.idx--; tutorialRenderStep(); }

function tutorialStart(){
  TUT.steps=tutorialSteps(); TUT.idx=0; TUT.active=true;
  $('tutOverlay').classList.remove('hidden');
  tutorialRenderStep();
  if(!TUT.reflow){
    TUT.reflow=()=>{ if(TUT.active) tutorialPosition(); };
    window.addEventListener('resize', TUT.reflow);
    $('stage').addEventListener('scroll', TUT.reflow);
  }
}
function tutorialEnd(){
  TUT.active=false; clearTimeout(TUT.waitTimer);
  $('tutOverlay').classList.add('hidden');
}

function setupTutorial(){
  $('tutorialBtn').addEventListener('click', tutorialStart);
  $('tutCloseBtn').addEventListener('click', tutorialEnd);
  $('tutNextBtn').addEventListener('click', tutorialNext);
  $('tutPrevBtn').addEventListener('click', tutorialPrev);
  window.addEventListener('keydown',(e)=>{
    if(!TUT.active) return;
    if(e.key==='Escape') tutorialEnd();
    else if(e.key==='ArrowRight') tutorialNext();
    else if(e.key==='ArrowLeft') tutorialPrev();
  });
  // the dimmed blockers sit on top of the page (so background clicks are
  // inert) but that also swallows the wheel event — forward it to the
  // scrolling stage manually so vertical scroll keeps working no matter
  // where over the screen the mouse is during the tour
  ['tutTop','tutBottom','tutLeft','tutRight'].forEach(id=>{
    $(id).addEventListener('wheel',(e)=>{
      e.preventDefault();
      $('stage').scrollTop += e.deltaY;
    }, {passive:false});
  });
}

// tiny faint "deployed commit" tag, top-right. A file committed to git can't
// contain its own commit hash, so resolve it live from GitHub — this always
// reflects whatever's actually on main. Silently stays blank if offline / rate
// limited.
(function showCommitTag(){
  const el=$('commitTag'); if(!el) return;
  fetch('https://api.github.com/repos/aeriab/pNODE_explorer/commits/main')
    .then(r=> r.ok ? r.json() : null)
    .then(j=>{ if(j && j.sha) el.textContent=j.sha.slice(0,7); })
    .catch(()=>{});
})();

init().catch(e=>{ console.error(e); alert('init failed: '+e.message); });

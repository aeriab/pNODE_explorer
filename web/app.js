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

// curated, biologically meaningful colours for the clinically salient genera
const TAXA_COLOR = {
  'Enterococcus':'--tx-entero','Escherichia-Shigella':'--tx-enterobact','Serratia':'--tx-nonferm',
  'Streptococcus':'--tx-strep','Lactobacillus':'--tx-lacto','Staphylococcus':'--tx-staph',
  'Blautia':'--tx-blautia','Faecalibacterium':'--tx-faecali','Bacteroides':'--tx-bacteroides',
  'Akkermansia':'--tx-akkermansia','Bifidobacterium':'--tx-bifido',
  '[Clostridium] innocuum group':'--tx-innocuum',
};
const cvar = (name) => getComputedStyle(document.body).getPropertyValue(name).trim();
// Every genus is now named explicitly (no aggregated "Other"), so the long tail of
// genera without a curated colour needs a stable, well-spread fill. Hash the name to
// an HSL triple — deterministic (same genus → same colour across patients/reloads)
// and distinct enough for the top-15 legend keys to be told apart.
const _genusColor = {};
function genusColor(name){
  if(name in _genusColor) return _genusColor[name];
  let h=2166136261>>>0;
  for(let i=0;i<name.length;i++){ h=(h^name.charCodeAt(i))>>>0; h=(h*16777619)>>>0; }
  const hue=h%360, sat=48+((h>>>9)%28), lit=42+((h>>>17)%18);
  return (_genusColor[name]=`hsl(${hue} ${sat}% ${lit}%)`);
}
const taxaColor = (t) => (TAXA_COLOR[t] ? cvar(TAXA_COLOR[t]) : genusColor(t));

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
  pxPerDay:18, plotW:0,
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
async function init(){
  S.meta = await api('/api/meta');
  S.patients = await api('/api/patients');
  buildPatientDropdown('patientSearch','patientList');       // header switcher
  buildPatientDropdown('patientSearchStart','patientListStart'); // start screen
  $('sampleSelect').addEventListener('change', ()=> S.pid && loadForecast(true));
  $('resetBtn').addEventListener('click', ()=>{ S.schedule=clone(S.baseSchedule); commit(); });
  $('clearBtn').addEventListener('click', ()=>{ S.schedule={}; commit(); });
  $('themeBtn').addEventListener('click', toggleTheme);
  // each panel (trajectory / observed abundance / taxUMAP / abx timeline) can be
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
      }
    });
  });
  window.addEventListener('resize', ()=>{ if(S.fc){ layout(); renderAll(); }});
  setupPointer();
  setupCompTooltip();
  // keep the trajectory / observed / antibiotic charts horizontally aligned
  // while scrolling — they all share the same day axis
  const hScroll=['scrollComp','scrollObs','scrollAbx'].map($);
  let syncing=false;
  hScroll.forEach(a=>a.addEventListener('scroll', ()=>{
    if(syncing) return; syncing=true;
    hScroll.forEach(b=>{ if(b!==a) b.scrollLeft=a.scrollLeft; });
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
    const a=hScroll[0];
    const nl=clamp(a.scrollLeft + dx, 0, Math.max(0, a.scrollWidth - a.clientWidth));
    hScroll.forEach(sc=>{ sc.scrollLeft=nl; });
  }, {passive:false});
  // deep-link: #p=<patientId> auto-opens that patient on load
  const hp=(location.hash.match(/p=([^&]+)/)||[])[1];
  if(hp){ const id=decodeURIComponent(hp); if(S.patients.some(p=>String(p.id)===id)) selectPatient(id); }
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
  const sel=$('sampleSelect'); sel.innerHTML=''; sel.disabled=false;
  info.samples.forEach((s,i)=>{
    const o=document.createElement('option'); o.value=JSON.stringify(s);
    const rel = s.day>=0?`day +${s.day}`:`day ${s.day}`;
    o.textContent=`${s.sample_id||('#'+(i+1))}  (${rel} rel. HCT)`;
    sel.appendChild(o);
  });
  sel.selectedIndex = 0;   // auto-pick the patient's first 16S sample
  document.body.classList.add('has-patient');   // reveal header controls, hide start screen
  const hi=$('patientSearch'); if(hi) hi.value=pid;
  const si=$('patientSearchStart'); if(si) si.value=pid;
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
function renderAll(){ renderComposition(); renderObserved(); renderTaxumap(); renderAbx(); renderMetrics(); }

// Rank every genus by its contribution across the WHOLE forecast trajectory (area
// under its band over all days t0..t0+horizon), independent of the readout day or
// scroll position. Drives both the stacking order (largest at the bottom) and which
// genera are named in the legend (top TOP_N). Stable while the user scrubs/scrolls.
// Enterococcus is forced to the very bottom of the stack (ahead of the rank sort) so
// its band's top edge sits at the same y as its raw value, letting it be compared
// directly against the dashed actual-regimen Entero trace drawn from the axis.
function computeTaxaOrder(){
  const taxa=(S.fc&&S.fc.composition.taxa)||S.compTaxa||[];
  const vals=S.fc&&S.fc.composition.values;
  const total=taxa.map((_,i)=>{
    let s=0; const col=vals&&vals[i]; if(col) for(let k=0;k<col.length;k++) s+=col[k];
    return s;
  });
  const enteroIdx=taxa.indexOf('Enterococcus');
  const rest=taxa.map((_,i)=>i).filter(i=>i!==enteroIdx).sort((a,b)=>total[b]-total[a]);
  S.taxaOrder = enteroIdx>=0 ? [enteroIdx, ...rest] : rest;
  S.topTaxa=S.taxaOrder.slice(0,TOP_N).map(i=>taxa[i]);
}

function buildLegend(){
  const lg=$('compLegend'); lg.innerHTML='';
  (S.topTaxa||[]).forEach(t=>{
    const d=document.createElement('span'); d.className='leg';
    d.innerHTML=`<span class="sw" style="background:${taxaColor(t)}"></span>${t}`;
    lg.appendChild(d);
  });
  // the dashed baseline trace only appears in the predicted (trajectory) view
  const d2=document.createElement('span'); d2.className='leg';
  d2.innerHTML=`<span class="sw" style="background:transparent;border-top:1.5px dashed var(--ink2);width:12px;height:0"></span>actual-regimen Entero`;
  lg.appendChild(d2);
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
  const order=S.taxaOrder||taxa.map((_,i)=>i);   // largest-contributing genus first (bottom of stack)
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
}

// observed view: measured 16S composition as 1-day-thick stacked bars at each sample day
function drawObservedBars(g, y){
  const taxa=(S.compTaxa)||(S.fc&&S.fc.composition.taxa)||[];
  const order=S.taxaOrder||taxa.map((_,i)=>i);   // same genus order as the trajectory stack
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
  if(sizeChanged){ setupTaxumapMap(w,h); drawTaxumapBackdrop(); }
  // legend + path both depend on the current patient's forecast (and BSI events)
  if(sizeChanged || _tu.fc!==S.fc){ _tu.fc=S.fc; drawTaxumapPath(); drawTaxumapLegend(); }
  taxumapMoveDot();
  $('tuHint').textContent='drag the ● (or the readout cursor elsewhere) to move along the predicted path';
}

function setupTaxumapMap(w,h){
  const info=TAXUMAP.info(); const [xmin,xmax,ymin,ymax]=info.bounds;
  const m=26, s=Math.min((w-2*m)/(xmax-xmin),(h-2*m)/(ymax-ymin));
  const offx=(w-s*(xmax-xmin))/2, offy=(h-s*(ymax-ymin))/2;
  const map=(x,y)=>[offx+(x-xmin)*s, h-(offy+(y-ymin)*s)];    // invert y for screen
  const dpr=Math.min(window.devicePixelRatio||1, 2);
  const cv=$('taxumapCanvas'); cv.width=Math.round(w*dpr); cv.height=Math.round(h*dpr);
  cv.style.width=w+'px'; cv.style.height=h+'px';
  const svg=$('taxumapSvg'); svg.setAttribute('viewBox',`0 0 ${w} ${h}`); svg.innerHTML='';
  svg.appendChild(el('text',{x:w-8,y:h-7,'text-anchor':'end',fill:cvar('--muted'),'font-size':10},[txt('TaxUMAP-1 →')]));
  svg.appendChild(el('text',{x:11,y:15,fill:cvar('--muted'),'font-size':10},[txt('↑ TaxUMAP-2')]));
  _tu={w,h,dpr,map,fc:null};
}

function drawTaxumapBackdrop(){
  const info=TAXUMAP.info(), ctx=$('taxumapCanvas').getContext('2d');
  ctx.setTransform(_tu.dpr,0,0,_tu.dpr,0,0);
  ctx.clearRect(0,0,_tu.w,_tu.h);
  const bd=info.bdCoords, cls=info.bdClass, colors=info.classColors;
  ctx.globalAlpha=0.32;
  for(let i=0;i<cls.length;i++){
    const p=_tu.map(bd[2*i],bd[2*i+1]);
    ctx.fillStyle=colors[cls[i]]||'#888';
    ctx.beginPath(); ctx.arc(p[0],p[1],2.0,0,6.2832); ctx.fill();
  }
  ctx.globalAlpha=1;
}

// projects a subsample of the predicted trajectory (~1 point/day) and caches
// the screen-space points + their days on _tu, both for drawing the path and
// for hit-testing the readout dot drag (nearestTaxumapIndex / taxumapMoveDot)
function drawTaxumapPath(){
  const svg=$('taxumapSvg'); const old=svg.querySelector('.tu-path'); if(old) old.remove();
  _tu.pts=null; _tu.days=null;
  if(!S.fc||!S.fc.fullComp||!S.fc.fullComp.length) return;
  const comps=S.fc.fullComp, days=S.fc.day;
  const step=Math.max(1,Math.round(comps.length/90));
  const idxs=[];
  for(let i=0;i<comps.length;i+=step) idxs.push(i);
  if(idxs[idxs.length-1]!==comps.length-1) idxs.push(comps.length-1);
  const pts=idxs.map(i=>{ const z=TAXUMAP.project(comps[i]); return z?_tu.map(z[0],z[1]):null; });
  _tu.pts=pts; _tu.days=idxs.map(i=>days[i]);
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
    if(!_tu.days.length) return;
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

function renderAbxGutter(){
  const gut=$('abxGutter'); gut.innerHTML='';
  const svg=el('svg',{width:132,height:S.abxOrder.length*LANE_H+ABX_AXIS_H+2});
  S.abxOrder.forEach((cat,li)=>{
    const used=(S.baseSchedule[cat]&&S.baseSchedule[cat].length)|| (S.schedule[cat]&&S.schedule[cat].length);
    const label=cat.replace(' antibiotics','').replace(' derivatives','').replace(' agents','');
    const t=el('text',{x:126,y:li*LANE_H+LANE_H/2+3.5,'text-anchor':'end',
      class:'gut-catlabel'+(used?'':' unused')},[txt(label.length>19?label.slice(0,18)+'…':label)]);
    svg.appendChild(t);
  });
  gut.appendChild(svg);
}

// --------------------------------------------------------------------- //
//  editing interactions
// --------------------------------------------------------------------- //
let drag=null, readoutDrag=null, sparkDrag=null, tuDrag=false;
function refreshReadoutViews(){ renderComposition(); renderObserved(); renderTaxumap(); renderAbx(); renderMetrics(); }
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
  // the diversity / GMHI sparklines: click-drag anywhere to move the readout day
  ['divSpark','gmhiSpark'].forEach(id=>{
    $(id).addEventListener('pointerdown',(ev)=>{
      if(!S.fc) return;
      sparkDrag=$(id); setReadoutFromSpark(sparkDrag, ev.clientX); ev.preventDefault();
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
    if(sparkDrag){ setReadoutFromSpark(sparkDrag, ev.clientX); return; }
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
    readoutDrag=null; sparkDrag=null;
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
// invert a sparkline's X scale (see sparkLine(): X=d=>2+(d-d0)/(dN-d0)*(w-4))
function setReadoutFromSpark(svg, clientX){
  if(!S.fc) return;
  const r=svg.getBoundingClientRect(), days=S.fc.day, w=r.width||svg.clientWidth;
  const day=days[0]+(clientX-r.left-2)/(w-4)*(days[days.length-1]-days[0]);
  S.readoutDay=clamp(Math.round(day), S.t0, S.t0+S.horizon);
  refreshReadoutViews();
}
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
//  metrics
// --------------------------------------------------------------------- //
function interp(days, arr, d){
  if(d<=days[0]) return arr[0];
  if(d>=days[days.length-1]) return arr[arr.length-1];
  let i=1; while(days[i]<d) i++;
  const f=(d-days[i-1])/(days[i]-days[i-1]);
  return arr[i-1]+f*(arr[i]-arr[i-1]);
}
// LOW uses <= so a zero-burden bottom tertile (q1 can be 0) is classified LOW, not MED
function tierOf(val,q1,q2){ return val<=q1?'LOW':(val>q2?'HIGH':'MED'); }

function renderMetrics(){
  const m=S.fc.metrics, ref=S.meta.risk_reference;
  // Enterococcus
  const et=tierOf(m['entero_days_above_0.3'], ref.entero.q1, ref.entero.q2);
  $('enteroTier').textContent=et; $('enteroTier').className='tier '+et;
  $('enteroPeak').textContent=m.entero_peak.toFixed(3);
  $('enteroDays').textContent=m['entero_days_above_0.3'].toFixed(1)+' d';
  // delta vs actual regimen
  const bd=S.baseFc.metrics['entero_days_above_0.3'];
  const dd=m['entero_days_above_0.3']-bd;
  const de=$('enteroDelta');
  if(Math.abs(dd)<0.05){ de.textContent='= actual regimen'; de.className='delta'; }
  else{ de.textContent=`${dd>0?'▲ +':'▼ '}${dd.toFixed(1)} d dominated vs actual`;
    de.className='delta '+(dd>0?'up':'down'); }
  sparkLine($('enteroSpark'), S.fc.day, S.fc.entero, {min:0,max:1,thr:DOM_THRESH,
    color:cvar('--tx-entero'), base:S.baseFc.entero});
  // Non-Enterococcus
  const nt=tierOf(m.nonentero_peak, ref.nonentero.q1, ref.nonentero.q2);
  $('nonTier').textContent=nt; $('nonTier').className='tier '+nt;
  $('nonPeak').textContent=m.nonentero_peak.toExponential(1);
  $('nonA0').textContent=m.nonentero_a0.toExponential(1);
  // readout-day metrics (client-side at readoutDay)
  const rd=S.readoutDay;
  const sh=interp(S.fc.day,S.fc.shannon,rd), iv=interp(S.fc.day,S.fc.invsimpson,rd),
        gm=interp(S.fc.day,S.fc.gmhi,rd);
  const relLbl=`@ ${rd-S.t0>=0?'+':''}${(rd-S.t0).toFixed(0)} d`;
  $('divAt').textContent=relLbl; $('gmhiAt').textContent=relLbl;
  $('shannonVal').textContent=sh.toFixed(2);
  $('invsimpVal').textContent=iv.toFixed(2);
  const inWin=(o)=>o.day>=S.t0-0.01&&o.day<=S.t0+S.horizon+0.01;
  sparkLine($('divSpark'), S.fc.day, S.fc.shannon, {color:cvar('--accent'), cursor:rd,
    obs:S.observed.filter(inWin).map(o=>[o.day,o.shannon])});
  $('gmhiVal').textContent=gm.toFixed(0);
  const fill=$('gmhiFill'); fill.style.width=gm+'%';
  fill.style.background = gm>=60?cvar('--good'):gm>=35?cvar('--warning'):cvar('--critical');
  sparkLine($('gmhiSpark'), S.fc.day, S.fc.gmhi, {min:0,max:100,color:cvar('--accent2'),cursor:rd,
    obs:S.observed.filter(inWin).map(o=>[o.day,o.gmhi])});
}

function sparkLine(svg, days, arr, opt={}){
  const w=svg.clientWidth||280, h=34; svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
  svg.innerHTML='';
  const mn=opt.min!==undefined?opt.min:Math.min(...arr);
  const mx=opt.max!==undefined?opt.max:Math.max(...arr)*1.05||1;
  const X=d=>2+(d-days[0])/(days[days.length-1]-days[0])*(w-4);
  const Y=v=>h-2-(v-mn)/(mx-mn||1)*(h-4);
  const g=el('g');
  if(opt.thr!==undefined) g.appendChild(el('line',{x1:2,y1:Y(opt.thr),x2:w-2,y2:Y(opt.thr),class:'thr-line'}));
  if(opt.base){ g.appendChild(el('path',{class:'baseline-trace',
    d:'M'+days.map((d,i)=>`${X(d).toFixed(1)},${Y(opt.base[i]).toFixed(1)}`).join('L')})); }
  g.appendChild(el('path',{fill:'none',stroke:opt.color,'stroke-width':1.8,
    d:'M'+days.map((d,i)=>`${X(d).toFixed(1)},${Y(arr[i]).toFixed(1)}`).join('L')}));
  if(opt.obs) opt.obs.forEach(([d,v])=>{
    if(d<days[0]||d>days[days.length-1]) return;
    g.appendChild(el('circle',{cx:X(d),cy:Y(v),r:2.6,fill:cvar('--ink'),
      stroke:opt.color,'stroke-width':1.3}));
  });
  if(opt.cursor!==undefined){
    g.appendChild(el('line',{x1:X(opt.cursor),y1:0,x2:X(opt.cursor),y2:h,class:'readout-line'}));
    g.appendChild(el('circle',{cx:X(opt.cursor),cy:Y(interp(days,arr,opt.cursor)),r:3,
      fill:opt.color,class:'cur-dot'}));
  }
  svg.appendChild(g);
}

init().catch(e=>{ console.error(e); alert('init failed: '+e.message); });

/* =====================================================================
   The Road Ahead — EU energy-price explorer (Chart.js)
   Merged into v2. Self-contained: reads RAW from energy-data.js
   (real EC Weekly Oil Bulletin + Eurostat household electricity prices).
   Chrome rethemed via scoped #energy-app CSS; multi-series data colours
   kept for legibility across up to 42 countries. Guarded to the
   dashboard page; inline-onclick handlers are exposed on window.
   ===================================================================== */
"use strict";
(function(){
if(!document.getElementById('oilChart') || typeof Chart==='undefined') return;
const CNAMES = RAW.country_names;

const PALETTE = ["#4fc3f7","#ff8a65","#a78bfa","#34d399","#fbbf24","#f472b6","#38bdf8","#fb923c","#818cf8","#4ade80","#facc15","#e879f9","#22d3ee","#f97316","#6366f1","#10b981","#eab308","#ec4899","#06b6d4","#ef4444","#8b5cf6","#22c55e","#f59e0b","#d946ef","#0ea5e9","#dc2626","#7c3aed","#16a34a","#d97706","#c026d3","#0284c7","#b91c1c","#6d28d9","#15803d","#b45309","#a21caf","#0369a1","#991b1b","#5b21b6","#166534","#92400e","#86198f"];

// ---- State ----
let selected = ['EU'];
let oilRange = 'all';
let oilView = 'weekly';
let seriesMode = 'all'; // all | petrol | diesel | elec

const allCountries = ['EU', ...Object.keys(CNAMES).sort((a,b)=>(CNAMES[a]||a).localeCompare(CNAMES[b]||b))];

const colorFor = code => PALETTE[allCountries.indexOf(code) % PALETTE.length];
const labelFor = code => code === 'EU' ? 'EU Average' : (CNAMES[code]||code) + ' (' + code + ')';

// ---- Country list ----
function filterCountries(q){ renderList(q.trim().toLowerCase()); }
function renderList(term=''){
  const el = document.getElementById('countryList'); el.innerHTML='';
  allCountries.forEach(code=>{
    const name = labelFor(code);
    if(term && !name.toLowerCase().includes(term) && !code.toLowerCase().includes(term)) return;
    const isSel = selected.includes(code), color = colorFor(code);
    const item = document.createElement('div');
    item.className = 'country-item' + (isSel?' selected':'');
    item.innerHTML = `<span class="swatch" style="background:${isSel?color:'var(--border)'}"></span><span>${name}</span>${isSel?'<span class="check">✓</span>':''}`;
    item.onclick = ()=>toggleCountry(code);
    el.appendChild(item);
  });
}
function toggleCountry(code){
  if(selected.includes(code)){ if(selected.length===1) return; selected = selected.filter(c=>c!==code); }
  else selected = [...selected, code];
  updateUI();
}
function clearAll(){ selected = ['EU']; updateUI(); }
function selectAll(){ selected = [...allCountries]; updateUI(); }

// ---- Tags ----
function renderTags(){
  const wrap = document.getElementById('tagsWrap'); wrap.innerHTML='';
  selected.forEach(code=>{
    const color = colorFor(code);
    const tag = document.createElement('div');
    tag.className='tag';
    tag.style.cssText = `background:${color}18;border-color:${color}44;color:${color}`;
    const shortName = code==='EU'?'EU Avg':(CNAMES[code]||code);
    tag.innerHTML = `<span style="width:8px;height:8px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0"></span>${shortName}${selected.length>1?`<span class="tag-x" onclick="toggleCountry('${code}')">✕</span>`:''}`;
    wrap.appendChild(tag);
  });
  document.getElementById('selCount').textContent = selected.length;
}

// ---- Chart defaults ----
Chart.defaults.color = '#64748b';
Chart.defaults.borderColor = '#1e2433';
Chart.defaults.font.family = 'Inter, sans-serif';
Chart.defaults.font.size = 11;
const tooltipDefaults = { backgroundColor:'#1a1e2a', borderColor:'#252a38', borderWidth:1, titleColor:'#e2e8f0', bodyColor:'#94a3b8', padding:10, cornerRadius:6, displayColors:true, boxWidth:10, boxHeight:10 };

// ---- Stat cards (EU aggregate) ----
(function(){
  const eu = RAW.eu_oil;
  const lastP = eu.petrol[eu.petrol.length-1], lastD = eu.diesel[eu.diesel.length-1];
  const lastDate = eu.dates[eu.dates.length-1];
  document.getElementById('stat-petrol').textContent = lastP ? '€'+(lastP/1000).toFixed(3)+'/L' : '—';
  document.getElementById('stat-diesel').textContent = lastD ? '€'+(lastD/1000).toFixed(3)+'/L' : '—';
  const yrAgo = lastDate.replace(/^\d{4}/, y=>String(+y-1));
  const pyIdx = eu.dates.findIndex(d=>d===yrAgo);
  if(pyIdx>=0){
    const pc=(lastP-eu.petrol[pyIdx])/eu.petrol[pyIdx]*100, dc=(lastD-eu.diesel[pyIdx])/eu.diesel[pyIdx]*100;
    const pe=document.getElementById('stat-petrol-chg'), de=document.getElementById('stat-diesel-chg');
    pe.textContent=(pc>0?'▲':'▼')+' '+Math.abs(pc).toFixed(1)+'% vs. year ago'; pe.className='stat-change '+(pc>0?'up':'down');
    de.textContent=(dc>0?'▲':'▼')+' '+Math.abs(dc).toFixed(1)+'% vs. year ago'; de.className='stat-change '+(dc>0?'up':'down');
  }
  const ev = RAW.eu_elec.values, lp=ev[ev.length-1], pp=ev[ev.length-2];
  document.getElementById('stat-elec').textContent = lp ? '€'+lp.toFixed(4) : '—';
  if(lp&&pp){
    const ec=(lp-pp)/pp*100, ee=document.getElementById('stat-elec-chg');
    ee.textContent=(ec>0?'▲':'▼')+' '+Math.abs(ec).toFixed(1)+'% · '+RAW.eu_elec.periods[RAW.eu_elec.periods.length-1];
    ee.className='stat-change '+(ec>0?'up':'down');
  }
})();

// ---- Helpers ----
function getAnnualOil(code){
  if(code==='EU'){
    const byYear={};
    RAW.eu_oil.dates.forEach((d,i)=>{
      const y=d.slice(0,4); (byYear[y] ||= {p:[],di:[]});
      if(RAW.eu_oil.petrol[i]!=null) byYear[y].p.push(RAW.eu_oil.petrol[i]);
      if(RAW.eu_oil.diesel[i]!=null) byYear[y].di.push(RAW.eu_oil.diesel[i]);
    });
    const years=Object.keys(byYear).sort();
    return { years,
      petrol: years.map(y=>byYear[y].p.length?+(byYear[y].p.reduce((a,b)=>a+b)/byYear[y].p.length).toFixed(1):null),
      diesel: years.map(y=>byYear[y].di.length?+(byYear[y].di.reduce((a,b)=>a+b)/byYear[y].di.length).toFixed(1):null) };
  }
  return RAW.oil_annual[code];
}
function getElec(code){
  if(code==='EU') return RAW.eu_elec;
  return RAW.elec_country[code] || null;
}
// semester period "2019-S1" -> fractional year 2019.0, "...-S2" -> 2019.5
function periodToYear(p){
  const m = p.match(/^(\d{4})-S([12])$/);
  if(!m) return null;
  return +m[1] + (m[2]==='2' ? 0.5 : 0);
}
function applyRange(labelsAsYears){
  if(oilRange==='all') return null; // no cutoff
  return (new Date().getFullYear()) - oilRange;
}

// ---- Combined chart ----
const oilCtx = document.getElementById('oilChart').getContext('2d');
let oilChart = new Chart(oilCtx, {
  type:'line',
  data:{ datasets:[] },
  options:{
    responsive:true, maintainAspectRatio:false,
    parsing:false,
    interaction:{ mode:'nearest', axis:'x', intersect:false },
    plugins:{
      legend:{ display:true, position:'top', align:'end', labels:{ boxWidth:10, boxHeight:10, padding:10, font:{size:10}, color:'#94a3b8' } },
      tooltip:{ ...tooltipDefaults, callbacks:{
        title: items => items.length ? fmtX(items[0].parsed.x) : '',
        label: i => i.dataset.yAxisID==='yElec'
          ? `  ${i.dataset.label}: €${i.parsed.y.toFixed(4)}/kWh`
          : `  ${i.dataset.label}: €${Math.round(i.parsed.y).toLocaleString()}/1000L`
      }},
      zoom:{
        zoom:{ wheel:{enabled:true}, pinch:{enabled:true}, mode:'x', onZoom:()=>showReset('oil') },
        pan:{ enabled:true, mode:'x', onPan:()=>showReset('oil') },
        limits:{ x:{ min:2004.9, max:2026.9 } }   // hard-clamped to actual data range (2005–2026)
      }
    },
    scales:{
      x:{ type:'linear', min:2004.9, max:2026.9, grid:{color:'#1a1e2a'}, ticks:{ maxTicksLimit:12, callback:v=>fmtX(v) } },
      yFuel:{ type:'linear', position:'left', grid:{color:'#1a1e2a'}, title:{display:true,text:'Fuel €/1000 L',color:'#94a3b8',font:{size:10}}, ticks:{ callback:v=>'€'+Math.round(v).toLocaleString() } },
      yElec:{ type:'linear', position:'right', grid:{drawOnChartArea:false}, title:{display:true,text:'Electricity €/kWh',color:'#a78bfa',font:{size:10}}, ticks:{ callback:v=>'€'+v.toFixed(3) } }
    }
  }
});

function fmtX(v){
  // v is a fractional year. Show year, and S1/S2 hint when fractional.
  const yr = Math.floor(v);
  const frac = v - yr;
  if(Math.abs(frac) < 0.01) return String(yr);
  if(Math.abs(frac-0.5) < 0.01) return yr + '·S2';
  // weekly points: approximate month
  const month = Math.round(frac*12)+1;
  return yr + '-' + String(month).padStart(2,'0');
}
function weekToYear(dateStr){
  const [y,m,d] = dateStr.split('-').map(Number);
  const start = Date.UTC(y,0,1), now = Date.UTC(y,m-1,d);
  const frac = (now-start)/(Date.UTC(y+1,0,1)-start);
  return y + frac;
}

function updateOilChart(){
  const datasets=[];
  const cutYear = applyRange();
  const useWeekly = oilView==='weekly' && selected.length===1 && selected[0]==='EU';
  const showP = seriesMode==='all'||seriesMode==='petrol';
  const showD = seriesMode==='all'||seriesMode==='diesel';
  const showE = seriesMode==='all'||seriesMode==='elec';

  // ---- Fuel (left axis) ----
  if(useWeekly){
    const xs = RAW.eu_oil.dates.map(weekToYear);
    const mkPts = arr => xs.map((x,i)=>({x, y:arr[i]})).filter(p=>p.y!=null && (cutYear===null||p.x>=cutYear));
    const euColor = colorFor('EU');
    if(showP) datasets.push({ label:'EU Petrol', yAxisID:'yFuel', data:mkPts(RAW.eu_oil.petrol), borderColor:euColor, backgroundColor:'transparent', borderWidth:2, pointRadius:0, pointHoverRadius:4, tension:0.3, fill:false, borderDash:[] });
    if(showD) datasets.push({ label:'EU Diesel', yAxisID:'yFuel', data:mkPts(RAW.eu_oil.diesel), borderColor:euColor, backgroundColor:'transparent', borderWidth:2, pointRadius:0, pointHoverRadius:4, tension:0.3, fill:false, borderDash:[6,3] });
  } else {
    selected.forEach(code=>{
      const d = getAnnualOil(code); if(!d) return;
      const cname = code==='EU'?'EU':(CNAMES[code]||code);
      const color = colorFor(code);
      const mk = arr => d.years.map((y,i)=>({x:+y, y:arr[i]})).filter(p=>p.y!=null && (cutYear===null||p.x>=cutYear));
      if(showP) datasets.push({ label:cname+' Petrol', yAxisID:'yFuel', data:mk(d.petrol), borderColor:color, backgroundColor:'transparent', borderWidth:2, pointRadius:2, pointHoverRadius:5, tension:0.3, fill:false, borderDash:[] });
      if(showD) datasets.push({ label:cname+' Diesel', yAxisID:'yFuel', data:mk(d.diesel), borderColor:color, backgroundColor:'transparent', borderWidth:1.5, pointRadius: (seriesMode==='diesel'?2:0), pointHoverRadius:4, tension:0.3, fill:false, borderDash:[4,3] });
    });
  }

  // ---- Electricity (right axis), dotted to distinguish from fuel ----
  if(showE){
    selected.forEach(code=>{
      const e = getElec(code); if(!e) return;
      const cname = code==='EU'?'EU27':(CNAMES[code]||code);
      const color = colorFor(code);
      const pts = e.periods.map((p,i)=>({x:periodToYear(p), y:e.values[i]})).filter(p=>p.x!=null && p.y!=null && (cutYear===null||p.x>=cutYear));
      datasets.push({ label:cname+' Electricity', yAxisID:'yElec', data:pts, borderColor:color, backgroundColor:'transparent', borderWidth:2, pointRadius:2, pointStyle:'rectRot', pointHoverRadius:5, tension:0.25, fill:false, borderDash:[2,2] });
    });
  }

  oilChart.data.datasets = datasets;
  // clamp pan/zoom to the actual loaded data extent (no drifting into empty years)
  const allX = datasets.flatMap(ds=>ds.data.map(p=>p.x));
  if(allX.length){
    oilChart.options.plugins.zoom.limits.x.min = Math.min(...allX);
    oilChart.options.plugins.zoom.limits.x.max = Math.max(...allX);
  }
  const sub = useWeekly
    ? 'EU fuel weekly €/1000 L (left) · electricity €/kWh per semester (right) · incl. taxes'
    : 'Fuel annual avg €/1000 L (left, solid=petrol dashed=diesel) · electricity €/kWh (right, dotted) · incl. taxes';
  document.getElementById('oilSubtitle').textContent = sub;
  oilChart.update();
}

// ---- Zoom helpers ----
function showReset(){ const b=document.getElementById('resetOil'); if(b) b.classList.add('visible'); }
window.resetZoom = function(){ oilChart.resetZoom(); const b=document.getElementById('resetOil'); if(b) b.classList.remove('visible'); };
window.setSeries = function(s){ seriesMode=s; document.querySelectorAll('#series-btns .range-btn').forEach(b=>b.classList.toggle('active', b.dataset.series===s)); updateOilChart(); };
window.setOilRange = function(r){ oilRange=r; document.querySelectorAll('#oil-range-btns .range-btn').forEach(b=>b.classList.toggle('active', b.dataset.range==r)); updateOilChart(); };
window.setOilView = function(v){ oilView=v; updateUI(); };

// ---- Master update ----
function updateUI(){
  renderList(document.getElementById('countrySearch').value.trim().toLowerCase());
  renderTags();
  const b=document.getElementById('resetOil'); if(b) b.classList.remove('visible');
  const canWeekly = selected.length===1 && selected[0]==='EU';
  const bw=document.getElementById('btnWeekly');
  bw.disabled=!canWeekly; bw.style.opacity=canWeekly?'1':'0.35';
  if(!canWeekly) oilView='annual';
  document.getElementById('btnWeekly').classList.toggle('active', oilView==='weekly');
  document.getElementById('btnAnnual').classList.toggle('active', oilView==='annual');
  updateOilChart();
}

renderList();
updateUI();
// expose handlers referenced by inline on* attributes in the markup
window.filterCountries = filterCountries;
window.toggleCountry  = toggleCountry;
window.clearAll       = clearAll;
window.selectAll      = selectAll;
})();

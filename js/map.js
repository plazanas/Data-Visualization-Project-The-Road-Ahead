/* =====================================================================
   The Road Ahead — interactive choropleth map (George Chrysikopoulos)
   Merged into v2. Self-contained: reads PAYLOAD + GEOJSON from
   map-data.js (real Eurostat road_eqr_carpda / road_eqs_carhab /
   demo_pjan + GISCO geometry). Rethemed to the site's teal palette.
   Wrapped in a guard so it only runs on the dashboard page.
   ===================================================================== */
"use strict";
(function(){
if(!document.getElementById('map-svg')) return;

const RAW_DATA   = PAYLOAD.data;
const CARHAB     = PAYLOAD.carhab;
const POPULATION = PAYLOAD.population;     // {country:{year:persons}}
const HAS_POP    = PAYLOAD.hasPopulation;
const YEARS      = PAYLOAD.years;
const ENG_LABELS = PAYLOAD.engineLabels;
const ENG_ORDER  = PAYLOAD.engineOrder;

// ── Controls ───────────────────────────────────────────────────────────────
const engSel   = document.getElementById('engine-select');
const slider   = document.getElementById('year-slider');
const yearDisp = document.getElementById('year-display');
const playBtn  = document.getElementById('play-btn');
const playIcon = document.getElementById('play-icon');
const normChk  = document.getElementById('normalize-toggle');
const normLbl  = document.getElementById('norm-label');

ENG_ORDER.forEach((code, i) => {
  const opt = document.createElement('option');
  opt.value = code; opt.textContent = ENG_LABELS[code] || code;
  if (i === 0) opt.selected = true;
  engSel.appendChild(opt);
});

slider.max = YEARS.length - 1;
slider.value = YEARS.length - 1;
yearDisp.textContent = YEARS[+slider.value];

if (!HAS_POP) {
  normChk.checked = false;
  normChk.disabled = true;
  normLbl.textContent = 'Per thousand inhabitants (needs demo_pjan)';
} else {
  normChk.checked = true;
}

// ── Play / Pause ───────────────────────────────────────────────────────────
let playing = false, playTimer = null;
const ICON_PLAY = '<polygon points="0,0 10,6 0,12"/>';
const ICON_PAUSE = '<rect x="0" y="0" width="3.5" height="12"/><rect x="6.5" y="0" width="3.5" height="12"/>';
function setPlaying(v){ playing=v; playIcon.innerHTML = v?ICON_PAUSE:ICON_PLAY; }
function stepYear(){
  const next=+slider.value+1;
  if(next>=YEARS.length){ setPlaying(false); clearInterval(playTimer); return; }
  slider.value=next; yearDisp.textContent=YEARS[next];
  updateMap(); if(selectedCC) renderSidebar(selectedCC,selectedName);
}
playBtn.addEventListener('click',()=>{
  if(playing){ setPlaying(false); clearInterval(playTimer); }
  else { if(+slider.value>=YEARS.length-1) slider.value=0; setPlaying(true); playTimer=setInterval(stepYear,850); }
});
slider.addEventListener('input',()=>{
  if(playing){ setPlaying(false); clearInterval(playTimer); }
  yearDisp.textContent=YEARS[+slider.value];
  updateMap(); if(selectedCC) renderSidebar(selectedCC,selectedName);
});
engSel.addEventListener('change',()=>{ updateMap(); if(selectedCC) renderSidebar(selectedCC,selectedName); });
normChk.addEventListener('change',()=>{
  document.getElementById('legend-title').textContent =
    normChk.checked ? 'Legend \u00b7 registrations per thousand inhabitants' : 'Legend \u00b7 absolute registrations';
  updateMap(); if(selectedCC) renderSidebar(selectedCC,selectedName);
});

// ── Helpers ────────────────────────────────────────────────────────────────
const fmt    = n => n==null ? '\u2013' : n.toLocaleString('en-GB');
const fmtF   = (n,d=2) => n==null ? '\u2013' : n.toFixed(d);
const fmtPct = n => n==null ? '\u2013' : (n>=0?'+':'')+n.toFixed(1)+'%';

const getPop = (cc,yr) => (POPULATION[cc] && POPULATION[cc][yr]!=null) ? POPULATION[cc][yr] : null;
const getRaw = (eng,cc,yr) => (RAW_DATA[eng] && RAW_DATA[eng][cc] && RAW_DATA[eng][cc][yr]!=null) ? RAW_DATA[eng][cc][yr] : null;

function getPerThousand(eng,cc,yr){
  const raw=getRaw(eng,cc,yr), pop=getPop(cc,yr);
  if(raw==null||pop==null||pop===0) return null;
  return raw / pop * 1000;
}
const getSeries = (eng,cc,norm) => YEARS.map(y=>({
  year:y, value: norm ? getPerThousand(eng,cc,y) : getRaw(eng,cc,y)
}));
function getValsByYear(eng,yr,norm){
  const out={};
  for(const cc of Object.keys(RAW_DATA[eng]||{})){
    const v = norm ? getPerThousand(eng,cc,yr) : getRaw(eng,cc,yr);
    if(v!=null) out[cc]=v;
  }
  return out;
}

// ── D3 SVG map ─────────────────────────────────────────────────────────────
const mapWrap=document.getElementById('map-wrap');
const svgEl=document.getElementById('map-svg');
const svg=d3.select('#map-svg');
const proj=d3.geoMercator();
const pathGen=d3.geoPath().projection(proj);
let colorScale=d3.scaleSequential().interpolator(d3.interpolate('#0e3a44','#00c2a0'));
let pathEls=null, selectedCC=null, selectedName=null, currentVals={};

// Fixed geographic window for Europe, given as the SW and NE corners only.
// A MultiPoint (not a Polygon) is used on purpose: Polygons are interpreted
// on the sphere with a winding order, and a wrongly-wound rectangle makes d3
// fit "the whole globe minus the box" -> zooms all the way out. Points have
// no winding, so fitExtent just frames the box between the two corners.
// Anything outside this window is clipped by the SVG viewBox: eastern Russia
// (past the Caucasus), France's overseas territories, the Atlantic islands.
//   West -11 (past Portugal/Ireland)  East 40 (Caucasus / E. Turkey)
//   South 34 (Mediterranean)          North 71 (northern Scandinavia)
const EUROPE_BBOX = { type:"MultiPoint", coordinates:[ [-11,34], [40,71] ] };

function resizeMap(){
  let W=mapWrap.clientWidth, H=mapWrap.clientHeight;
  // Guard against a not-yet-laid-out container (clientWidth/Height === 0).
  if(!W || !H){ requestAnimationFrame(resizeMap); return; }
  svgEl.setAttribute('viewBox',`0 0 ${W} ${H}`);
  // Fit the projection to the fixed European window (NOT to all polygons).
  proj.fitExtent([[0,0],[W,H]], EUROPE_BBOX);
  if(pathEls) pathEls.attr('d',pathGen);
}

svg.selectAll('.country-path')
  .data(GEOJSON.features).enter().append('path')
  .attr('class','country-path')
  .on('click',function(event,d){
    selectedCC=d.properties.CNTR_ID; selectedName=d.properties.NAME_ENGL;
    svg.selectAll('.country-path').classed('selected',false);
    d3.select(this).classed('selected',true);
    renderSidebar(selectedCC,selectedName);
  });
pathEls=svg.selectAll('.country-path');
resizeMap();
window.addEventListener('resize',resizeMap);

// ── Map colour update ──────────────────────────────────────────────────────
function updateMap(){
  const engine=engSel.value, year=YEARS[+slider.value], norm=normChk.checked;
  currentVals=getValsByYear(engine,year,norm);
  const allVals=Object.values(currentVals).filter(v=>v>0);
  const maxVal=allVals.length?Math.max(...allVals):1;
  colorScale.domain([0,maxVal]);
  document.getElementById('leg-min').textContent='0';
  document.getElementById('leg-max').textContent = norm ? fmtF(maxVal,1) : fmt(maxVal);
  pathEls
    .attr('fill',d=>{ const v=currentVals[d.properties.CNTR_ID]; return v!=null?colorScale(v):'var(--nodata)'; })
    .attr('fill-opacity',d=>currentVals[d.properties.CNTR_ID]!=null?0.85:0.45);
}

// ── Sidebar ────────────────────────────────────────────────────────────────
function renderSidebar(cc,name){
  const engine=engSel.value, year=YEARS[+slider.value], norm=normChk.checked;
  const panel=document.getElementById('info-panel');

  const rawAbsolute       = getRaw(engine,cc,year);
  const perThousandEngine = getPerThousand(engine,cc,year);
  const carsInStock       = (CARHAB[cc] && CARHAB[cc][year]!=null) ? CARHAB[cc][year] : null;
  const pop               = getPop(cc,year);

  const prevYr=YEARS[YEARS.indexOf(year)-1]??null;
  const curVal = norm ? perThousandEngine : rawAbsolute;
  const prevVal= prevYr ? (norm?getPerThousand(engine,cc,prevYr):getRaw(engine,cc,prevYr)) : null;
  const yoy=(curVal!=null&&prevVal!=null&&prevVal>0)?((curVal-prevVal)/prevVal)*100:null;

  const series=getSeries(engine,cc,norm);
  let peakYear=null,peakVal=null;
  series.forEach(d=>{ if(d.value!=null&&(peakVal==null||d.value>peakVal)){peakVal=d.value;peakYear=d.year;} });

  const valid=series.filter(d=>d.value>0);
  let cagr=null;
  if(valid.length>=2){
    const first=valid[0], last=valid[valid.length-1];
    const n=YEARS.indexOf(last.year)-YEARS.indexOf(first.year);
    if(n>0) cagr=(Math.pow(last.value/first.value,1/n)-1)*100;
  }

  const rawVals=getValsByYear(engine,year,false);
  const euroTot=Object.values(rawVals).reduce((s,v)=>s+v,0);
  const share=(rawAbsolute!=null&&euroTot>0)?(rawAbsolute/euroTot)*100:null;

  const yoyClass = yoy==null?'muted':yoy>=0?'green':'red';

  let html = `
    <div>
      <div class="country-name">${name}</div>
      <div class="country-sub">${cc} \u00b7 ${ENG_LABELS[engine]} \u00b7 ${year}</div>
    </div>
    <div class="stat-grid">

      <div class="stat-box full highlight">
        <div class="stat-val">${perThousandEngine!=null?fmtF(perThousandEngine,2):'\u2013'}</div>
        <div class="stat-label">&#9679; Selected-engine new registrations per thousand inhabitants${HAS_POP?' (map colour)':' \u2014 needs demo_pjan'}</div>
      </div>

      <div class="stat-box full">
        <div class="stat-val blue">${carsInStock!=null?fmt(carsInStock):'\u2013'}</div>
        <div class="stat-label">Total passenger cars in use per thousand inhabitants (all engines)</div>
      </div>

      <div class="stat-box full">
        <div class="stat-val">${fmt(rawAbsolute)}</div>
        <div class="stat-label">Absolute number of new registrations (selected engine)</div>
      </div>

      <div class="divider"></div>

      <div class="stat-box">
        <div class="stat-val ${yoyClass}">${fmtPct(yoy)}</div>
        <div class="stat-label">Change versus previous year</div>
      </div>
      <div class="stat-box">
        <div class="stat-val blue">${cagr!=null?fmtPct(cagr):'\u2013'}</div>
        <div class="stat-label">Compound annual growth rate (all years)</div>
      </div>
      <div class="stat-box">
        <div class="stat-val">${peakVal!=null?(norm?fmtF(peakVal,2):fmt(peakVal)):'\u2013'}</div>
        <div class="stat-label">Peak value (${peakYear??'\u2013'})</div>
      </div>
      <div class="stat-box">
        <div class="stat-val muted">${pop!=null?fmt(pop):'\u2013'}</div>
        <div class="stat-label">Population on 1 January (${year})</div>
      </div>
    </div>`;

  if(share!=null){
    const barW=Math.min(share*3.5,100);
    html += `
    <div>
      <div class="section-title">European market share (absolute) \u00b7 ${year}</div>
      <div class="share-bar-wrap"><div class="share-bar-fill" style="width:${barW}%"></div></div>
      <div class="share-text">${fmtF(share,2)}% of the European total</div>
    </div>`;
  }

  html += `
    <div class="chart-section">
      <div class="section-title">Trend ${YEARS[0]}\u2013${YEARS[YEARS.length-1]} \u00b7 ${norm?'per thousand inhabitants':'absolute'}</div>
      <svg id="ts-chart"></svg>
    </div>`;

  panel.innerHTML=html;
  drawChart(series,year,norm);
}

// ── Time-series chart ──────────────────────────────────────────────────────
function drawChart(series,selYear,norm){
  const el=document.getElementById('ts-chart'); if(!el) return;
  const W=el.parentElement.clientWidth||280, H=160;
  const mg={t:14,r:12,b:38,l:48}, iW=W-mg.l-mg.r, iH=H-mg.t-mg.b;
  const xScale=d3.scaleBand().domain(YEARS).range([0,iW]).padding(0.15);
  const maxY=Math.max(...series.filter(d=>d.value!=null).map(d=>d.value),1);
  const yScale=d3.scaleLinear().domain([0,maxY*1.1]).range([iH,0]);

  const s=d3.select('#ts-chart').attr('viewBox',`0 0 ${W} ${H}`).attr('width',W).attr('height',H);
  s.selectAll('*').remove();
  const defs=s.append('defs');
  const grad=defs.append('linearGradient').attr('id','areaGrad').attr('x1','0').attr('x2','0').attr('y1','0').attr('y2','1');
  grad.append('stop').attr('offset','0%').attr('stop-color','#00c2a0').attr('stop-opacity',0.4);
  grad.append('stop').attr('offset','100%').attr('stop-color','#00c2a0').attr('stop-opacity',0.02);
  const g=s.append('g').attr('transform',`translate(${mg.l},${mg.t})`);

  g.append('g').call(d3.axisLeft(yScale).ticks(4).tickSize(-iW).tickFormat(''))
    .call(a=>a.select('.domain').remove())
    .call(a=>a.selectAll('line').attr('stroke','#252c36').attr('stroke-dasharray','2,3'));

  g.append('path').datum(series).attr('d',d3.area()
      .defined(d=>d.value!=null).x(d=>xScale(d.year)+xScale.bandwidth()/2)
      .y0(iH).y1(d=>yScale(d.value)).curve(d3.curveMonotoneX))
    .attr('fill','url(#areaGrad)');
  g.append('path').datum(series).attr('d',d3.line()
      .defined(d=>d.value!=null).x(d=>xScale(d.year)+xScale.bandwidth()/2)
      .y(d=>yScale(d.value)).curve(d3.curveMonotoneX))
    .attr('fill','none').attr('stroke','#00c2a0').attr('stroke-width',1.8);

  series.filter(d=>d.value!=null).forEach(d=>{
    const isSel=d.year===selYear;
    g.append('circle').attr('cx',xScale(d.year)+xScale.bandwidth()/2).attr('cy',yScale(d.value))
      .attr('r',isSel?4.5:2.2).attr('fill',isSel?'#00c2a0':'#0a8f76')
      .attr('stroke',isSel?'#0d1117':'none').attr('stroke-width',isSel?2:0);
  });

  const sel=series.find(d=>d.year===selYear);
  if(sel&&sel.value!=null){
    const sx=xScale(selYear)+xScale.bandwidth()/2, sy=yScale(sel.value);
    g.append('line').attr('x1',sx).attr('x2',sx).attr('y1',0).attr('y2',iH)
      .attr('stroke','#fff').attr('stroke-width',1).attr('stroke-dasharray','3,3').attr('opacity',0.2);
    const lab = norm ? sel.value.toFixed(2)
      : (sel.value>=1e6?(sel.value/1e6).toFixed(2)+'M':sel.value>=1e3?(sel.value/1e3).toFixed(1)+'k':String(sel.value));
    g.append('text').attr('x',sx).attr('y',sy-8)
      .attr('text-anchor',sx>iW*0.72?'end':'middle')
      .attr('fill','#00c2a0').attr('font-size','8.5px').attr('font-family','DM Mono, monospace').text(lab);
  }

  g.append('g').attr('transform',`translate(0,${iH})`)
    .call(d3.axisBottom(xScale).tickValues(YEARS).tickSize(3))
    .call(a=>a.select('.domain').attr('stroke','#30363d'))
    .call(a=>a.selectAll('text').attr('fill','#8b949e').attr('font-size','7.5px')
      .attr('font-family','DM Mono, monospace').attr('transform','rotate(-45)')
      .attr('text-anchor','end').attr('dx','-3px').attr('dy','3px'))
    .call(a=>a.selectAll('line').attr('stroke','#30363d'));

  g.append('g').call(d3.axisLeft(yScale).ticks(4)
      .tickFormat(v=>norm?v.toFixed(1):v>=1e6?(v/1e6).toFixed(1)+'M':v>=1e3?(v/1e3).toFixed(0)+'k':v))
    .call(a=>a.select('.domain').remove())
    .call(a=>a.selectAll('text').attr('fill','#8b949e').attr('font-size','8px').attr('font-family','DM Mono, monospace'))
    .call(a=>a.selectAll('line').remove());
}

// ── Init ───────────────────────────────────────────────────────────────────
document.getElementById('legend-title').textContent =
  normChk.checked ? 'Legend \u00b7 registrations per thousand inhabitants' : 'Legend \u00b7 absolute registrations';
updateMap();
})();

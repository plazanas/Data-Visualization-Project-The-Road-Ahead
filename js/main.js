/* =====================================================================
   The Road Ahead — v2 main.js  (editorial theme + motion)
   ALL displayed figures are computed from data/*.json at runtime.
   Nothing is hard-coded (the choropleth map is the colleague's separate
   component and is not part of this file). The 0–100 km/h gauge is a
   thematic flourish about EV torque, not a dataset figure.
   ===================================================================== */
"use strict";

const DATA_BASE = "data/";   // v2 pages live one level below the shared data/
const REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;
const PAL = { ev:"#00c2a0", evBright:"#5cffe6", petrol:"#e76f33", diesel:"#caa53a" };
const round = v => Math.round(v);

/* ── tooltip ──────────────────────────────────────────── */
const tipEl = document.getElementById("tip");
function showTip(x,y,name,rows,light){
  if(!tipEl) return;
  tipEl.className = "tip show" + (light ? " light" : "");
  tipEl.innerHTML = `<div class="t-name">${name}</div>` +
    rows.map(([k,v])=>`<div class="t-row"><span class="k">${k}</span><span class="v">${v}</span></div>`).join("");
  const pad=14, w=tipEl.offsetWidth, h=tipEl.offsetHeight;
  let nx=x+pad, ny=y+pad;
  if(nx+w>window.innerWidth-8) nx=x-w-pad;
  if(ny+h>window.innerHeight-8) ny=y-h-pad;
  tipEl.style.left=nx+"px"; tipEl.style.top=ny+"px";
}
function hideTip(){ if(tipEl) tipEl.className="tip"; }

/* ── helpers ──────────────────────────────────────────── */
const setTxt=(id,txt)=>{ const e=document.getElementById(id); if(e) e.textContent=txt; };
const dotColor=s=> s>40?PAL.ev : s>15?"#5bb98a" : PAL.petrol;
const dispCode=c=> c==="EL"?"GR":c;   // show Greece as the familiar "GR" (data key stays Eurostat "EL")
/* ── statistics (computed live so values can never drift) ─ */
function pearson(xs,ys){
  const n=xs.length, mx=d3.mean(xs), my=d3.mean(ys);
  let sxy=0,sxx=0,syy=0;
  for(let i=0;i<n;i++){ const dx=xs[i]-mx, dy=ys[i]-my; sxy+=dx*dy; sxx+=dx*dx; syy+=dy*dy; }
  return sxy/Math.sqrt(sxx*syy);
}
function rank(a){
  const s=a.map((v,i)=>[v,i]).sort((p,q)=>p[0]-q[0]), r=Array(a.length);
  for(let i=0;i<s.length;){ let j=i; while(j<s.length&&s[j][0]===s[i][0]) j++;
    const avg=(i+j-1)/2+1; for(let k=i;k<j;k++) r[s[k][1]]=avg; i=j; }
  return r;
}
const spearman=(xs,ys)=>pearson(rank(xs),rank(ys));
const sgn=v=>(v>=0?"+":"−")+Math.abs(v).toFixed(2);   // signed, 2dp
function fillStats(rows){
  const g=rows.filter(r=>r.gdp_pps!=null&&r.ev_share!=null);
  const e=rows.filter(r=>r.elec_eur_kwh!=null&&r.ev_share!=null);
  const c=rows.filter(r=>r.petrol_per100!=null&&r.ev_per100!=null&&r.ev_share!=null);
  const rhoGdp=spearman(g.map(d=>d.gdp_pps),g.map(d=>d.ev_share));
  const rGdp =pearson (g.map(d=>d.gdp_pps),g.map(d=>d.ev_share));
  const rElec=pearson (e.map(d=>d.elec_eur_kwh),e.map(d=>d.ev_share));
  const rPet =pearson (c.map(d=>d.petrol_per100),c.map(d=>d.ev_share));
  const rGap =pearson (c.map(d=>d.petrol_per100-d.ev_per100),c.map(d=>d.ev_share));
  const ch=rows.filter(r=>r.charge_per_100k!=null&&r.ev_share!=null);
  const rChg=pearson(ch.map(d=>d.charge_per_100k),ch.map(d=>d.ev_share));
  setTxt("rho-gdp", sgn(rhoGdp));
  setTxt("r-elec-inline", sgn(rElec));
  setTxt("r-gap-inline", sgn(rGap));
  setTxt("r-gap-step", sgn(rGap));
  const m=document.getElementById("methods-note");
  if(m) m.innerHTML=`Methods — Pearson r against each country's 2024 BEV share (n = ${rows.filter(r=>r.ev_share!=null).length}, EU27 + Norway), computed live at page load: `+
    `GDP per capita <b>${sgn(rGdp)}</b> (rank ρ ${sgn(rhoGdp)}) · electricity price <b>${sgn(rElec)}</b> · petrol cost/100 km <b>${sgn(rPet)}</b> · running-cost gap <b>${sgn(rGap)}</b> · charging points/100k <b>${sgn(rChg)}</b>. `+
    `EV share = BEV ÷ total new registrations (Eurostat <a href="https://ec.europa.eu/eurostat/databrowser/view/road_eqr_carpda/default/table?lang=en" target="_blank" rel="noopener">road_eqr_carpda</a>); charging = <a href="https://alternative-fuels-observatory.ec.europa.eu/transport-mode/road" target="_blank" rel="noopener">EAFO</a> recharging points (2026) per 100k people (Eurostat <a href="https://ec.europa.eu/eurostat/databrowser/view/demo_pjan/default/table?lang=en" target="_blank" rel="noopener">demo_pjan</a> population 2024).`;
}
function countUp(id,target,suffix,dec){
  const el=document.getElementById(id); if(!el) return;
  dec=dec||0;
  if(REDUCE){ el.textContent=target.toFixed(dec)+suffix; return; }
  let s=null; const dur=1200;
  const step=ts=>{ if(!s)s=ts; const k=Math.min((ts-s)/dur,1); const v=target*(1-Math.pow(1-k,3));
    el.textContent=(dec?v.toFixed(dec):Math.round(v))+suffix; if(k<1)requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

/* ── boot: load everything, then render ───────────────── */
if(document.getElementById("page-dashboard")){
  Promise.all([
    fetch(DATA_BASE+"cost_current.json").then(r=>r.json()),
    fetch(DATA_BASE+"eu_trend.json").then(r=>r.json()),
    fetch(DATA_BASE+"elec_ev_by_year.json").then(r=>r.json()),
    fetch(DATA_BASE+"ev_share_by_year.json").then(r=>r.json())
  ]).then(([DATA,TREND,BYYEAR,SHARE])=>{
    const rows = DATA.rows.filter(r=>r.ev_per100!=null);
    fillHero(rows);
    fillStats(rows);
    renderGluedScatter(rows);
    renderCostBars(rows);
    fillCostCallouts(rows);
    renderEuTrend(TREND.rows);
    renderSlope(SHARE);
    renderSparklines(SHARE);
    renderPicker(rows, BYYEAR, TREND.rows);
  }).catch(err=>{
    console.error(err);
    document.querySelectorAll("[data-fallback]").forEach(el=>{
      el.innerHTML='<p style="color:#e76f33;font-size:13px;font-weight:600">Could not load data/*.json — serve over http (python -m http.server), not file://.</p>';
    });
  });
}

/* ── HERO : highest vs lowest EV share (data-driven) ──── */
function fillHero(rows){
  const ws = rows.filter(r=>r.ev_share!=null);
  const hi = ws.reduce((a,b)=>b.ev_share>a.ev_share?b:a);
  const lo = ws.filter(r=>r.ev_share>0).reduce((a,b)=>b.ev_share<a.ev_share?b:a);
  setTxt("hero-hi-cap", "electric · "+hi.name);
  setTxt("hero-lo-cap", "electric · "+lo.name);
  setTxt("hero-lead-hi", hi.name);
  setTxt("hero-lead-lo", lo.name);
  countUp("hero-hi-num", round(hi.ev_share), "%");
  countUp("hero-lo-num", round(lo.ev_share), "%");
}

/* ── ★ Glued transforming scatter (one chart, 4 encodings) ─
   Y = EV share (2024) always. Scrolling re-encodes X across 4 steps;
   the same dots glide between encodings. Merges old Acts "Wealth" + "Money". */
function linreg(xs,ys){
  const n=xs.length, mx=d3.mean(xs), my=d3.mean(ys);
  let sxy=0,sxx=0; for(let i=0;i<n;i++){ const dx=xs[i]-mx; sxy+=dx*(ys[i]-my); sxx+=dx*dx; }
  const slope=sxy/sxx; return {slope, intercept: my-slope*mx};
}
function renderGluedScatter(rows){
  const svg=d3.select("#glued-scatter"); if(svg.empty()) return;
  const pts=rows.filter(r=>r.gdp_pps!=null&&r.elec_eur_kwh!=null&&r.ev_share!=null&&r.petrol_per100!=null&&r.diesel_per100!=null&&r.ev_per100!=null)
    .map(r=>({code:r.code,name:r.name,ev_share:r.ev_share,gdp_pps:r.gdp_pps,elec_eur_kwh:r.elec_eur_kwh,
              petrol_per100:r.petrol_per100,diesel_per100:r.diesel_per100,ev_per100:r.ev_per100,
              charge_per_100k:r.charge_per_100k}));
  let FOSSIL="petrol";                                   // petrol/diesel switch
  const gapOf=d=>(FOSSIL==="petrol"?d.petrol_per100:d.diesel_per100)-d.ev_per100;
  const W=560,H=430,m={t:20,r:24,b:58,l:58}, iW=W-m.l-m.r, iH=H-m.t-m.b;
  const y=d3.scaleLinear().domain([0,90]).range([iH,0]);
  svg.selectAll("*").remove();
  const g=svg.append("g").attr("transform",`translate(${m.l},${m.t})`);
  [0,30,60,90].forEach(t=>{ g.append("line").attr("x1",0).attr("x2",iW).attr("y1",y(t)).attr("y2",y(t)).attr("stroke","rgba(255,255,255,.09)");
    g.append("text").attr("x",-9).attr("y",y(t)+4).attr("text-anchor","end").attr("font-size","12px").attr("fill","#a4a4ac").text(t+"%"); });
  g.append("text").attr("transform","rotate(-90)").attr("x",-iH/2).attr("y",-42).attr("text-anchor","middle").attr("font-size","12.5px").attr("font-weight","600").attr("fill","#a4a4ac").text("EV share of new cars →");
  const xAxisG=g.append("g"), quadG=g.append("g").style("opacity",0);
  const regLine=g.append("line").attr("stroke","#fff").attr("stroke-width",1.6).attr("stroke-dasharray","5,4").style("opacity",0);
  const dots=g.append("g").selectAll("circle").data(pts,d=>d.code).join("circle")
    .attr("r",d=>(d.code==="NO"||d.code==="PL")?7:5).attr("opacity",.9).attr("cy",d=>y(d.ev_share)).style("cursor","pointer");
  const LBL=new Set(["NO","DK","DE","HU","IE","PL","NL","SE"]);
  const labels=g.append("g").selectAll("text").data(pts.filter(d=>LBL.has(d.code)),d=>d.code).join("text")
    .attr("font-size","9px").attr("font-weight","600").attr("fill","#cfcfd4").attr("text-anchor","middle").attr("dy",-9).attr("pointer-events","none")
    .attr("y",d=>y(d.ev_share)).text(d=>dispCode(d.code));

  const STEPS=[
    {key:"gdp_pps",      dom:[60,250], xlab:"GDP per capita (PPS, EU = 100) →", title:"EV share vs GDP per capita"},
    {key:"elec_eur_kwh", dom:[0.10,0.42], xlab:"Electricity price (€/kWh) →", title:"EV share vs electricity price"},
    {key:"gap"},
    {key:"charge_per_100k", xlab:"Public charging points per 100k people →", title:"EV share vs charging points"},
    {key:"gap", quad:true}
  ];
  const medShare=d3.median(pts,d=>d.ev_share);
  const medGap=()=>d3.median(pts,gapOf);
  const valOf=(d,s)=> s.key==="gap"?gapOf(d):d[s.key];
  const domOf=s=>{
    if(s.key==="gap"){ const v=pts.map(gapOf); return [Math.floor(d3.min(v)-0.5),Math.ceil(d3.max(v)+0.5)]; }
    if(s.key==="charge_per_100k") return [0, Math.ceil(d3.max(pts,d=>d.charge_per_100k)/100)*100];
    return s.dom; };
  const cap=w=>w[0].toUpperCase()+w.slice(1);
  const xlabOf=s=> s.key==="gap" ? `Running-cost saving, ${FOSSIL} − EV (€/100 km) →` : s.xlab;
  const titleOf=s=> s.quad ? "Running cost can't separate the clusters" : s.key==="gap" ? `EV share vs running-cost gap (${cap(FOSSIL)})` : s.title;
  const quadColor=d=>{ const mg=medGap(); return (gapOf(d)<mg&&d.ev_share>=medShare)?PAL.ev:(gapOf(d)>=mg&&d.ev_share<medShare)?PAL.petrol:"#8a8a90"; };
  const rColor=r=>{const a=Math.abs(r);return a>=.45?PAL.ev:a>=.25?PAL.diesel:PAL.petrol;};
  const rLabel=r=>{const a=Math.abs(r);return a>=.6?"strong":a>=.45?"moderate":a>=.25?"weak":"≈ none";};
  function setChip(i,vals){ const chip=document.getElementById("chip-"+i); if(!chip) return;
    const r=pearson(vals,pts.map(d=>d.ev_share)); chip.textContent="r = "+sgn(r)+" · "+rLabel(r); chip.style.color=rColor(r); }
  setChip(0,pts.map(d=>d.gdp_pps));
  setChip(1,pts.map(d=>d.elec_eur_kwh));
  setChip(3,pts.map(d=>d.charge_per_100k));
  setTxt("r-charge-step", sgn(pearson(pts.map(d=>d.charge_per_100k),pts.map(d=>d.ev_share))));
  const chip4=document.getElementById("chip-4"); if(chip4){ chip4.textContent="policy decides"; chip4.style.color=PAL.ev; }
  const fillGapChip=()=>setChip(2,pts.map(gapOf));
  fillGapChip();

  const clamp=(v,dom)=>Math.max(dom[0],Math.min(dom[1],v));
  function updateXAxis(s,x){ xAxisG.selectAll("*").remove();
    x.ticks(6).forEach(t=>xAxisG.append("text").attr("x",x(t)).attr("y",iH+20).attr("text-anchor","middle").attr("font-size","12px").attr("fill","#a4a4ac").text(s.key==="elec_eur_kwh"?t.toFixed(2):t));
    xAxisG.append("text").attr("x",iW/2).attr("y",iH+46).attr("text-anchor","middle").attr("font-size","12.5px").attr("font-weight","600").attr("fill","#a4a4ac").text(xlabOf(s));
  }
  function drawQuad(x){ const mg=medGap(); quadG.selectAll("*").remove();
    quadG.append("line").attr("x1",x(mg)).attr("x2",x(mg)).attr("y1",0).attr("y2",iH).attr("stroke","rgba(255,255,255,.3)").attr("stroke-dasharray","3,4");
    quadG.append("line").attr("x1",0).attr("x2",iW).attr("y1",y(medShare)).attr("y2",y(medShare)).attr("stroke","rgba(255,255,255,.3)").attr("stroke-dasharray","3,4");
    quadG.append("text").attr("x",4).attr("y",12).attr("font-size","10px").attr("font-weight","700").attr("fill",PAL.ev).text("policy-led adopters");
    quadG.append("text").attr("x",iW-4).attr("y",iH-6).attr("text-anchor","end").attr("font-size","10px").attr("font-weight","700").attr("fill",PAL.petrol).text("cost-rich, stalled");
  }
  const ftWrap=document.getElementById("fossil-toggle");
  let cur=-1, curStep=STEPS[0];
  function setStep(i){ if(i===cur||i<0||i>=STEPS.length) return; cur=i; render(); }
  function render(){ const s=curStep=STEPS[cur]; const dom=domOf(s);
    const x=d3.scaleLinear().domain(dom).range([0,iW]); const dur=REDUCE?0:900;
    dots.transition().duration(dur).ease(d3.easeCubicInOut)
      .attr("cx",d=>x(clamp(valOf(d,s),dom))).attr("cy",d=>y(d.ev_share)).attr("fill",d=>s.quad?quadColor(d):dotColor(d.ev_share));
    labels.transition().duration(dur).ease(d3.easeCubicInOut).attr("x",d=>x(clamp(valOf(d,s),dom))).attr("y",d=>y(d.ev_share));
    updateXAxis(s,x);
    if(s.quad){ regLine.transition().duration(dur).style("opacity",0); drawQuad(x); quadG.transition().duration(dur).style("opacity",1); }
    else { quadG.transition().duration(dur).style("opacity",0);
      const {slope,intercept}=linreg(pts.map(d=>valOf(d,s)),pts.map(d=>d.ev_share));
      regLine.transition().duration(dur).style("opacity",.85)
        .attr("x1",x(dom[0])).attr("y1",y(intercept+slope*dom[0])).attr("x2",x(dom[1])).attr("y2",y(intercept+slope*dom[1])); }
    setTxt("glued-title", titleOf(s));
    if(ftWrap) ftWrap.hidden = (s.key!=="gap");
    document.querySelectorAll('#decides [data-step]').forEach((el,idx)=>el.classList.toggle("active",idx===cur));
  }
  if(ftWrap){ ftWrap.querySelectorAll(".ft-btn").forEach(b=>b.addEventListener("click",()=>{
    FOSSIL=b.dataset.fossil; ftWrap.querySelectorAll(".ft-btn").forEach(x=>x.classList.toggle("active",x===b));
    fillGapChip(); render(); })); }
  const tipFor=(e,d)=>{ const s=curStep;
    const xrow = s.key==="gdp_pps" ? ["GDP/cap","PPS "+d.gdp_pps]
      : s.key==="elec_eur_kwh" ? ["Electricity","€"+d.elec_eur_kwh.toFixed(3)+"/kWh"]
      : s.key==="charge_per_100k" ? ["Charging",d.charge_per_100k+" /100k"]
      : [cap(FOSSIL)+" saving","€"+gapOf(d).toFixed(2)+" /100km"];
    showTip(e.clientX,e.clientY,d.name,[xrow,["EV share",round(d.ev_share)+"%"]],false); };
  dots.on("mouseenter",function(e,d){ d3.select(this).attr("opacity",1); tipFor(e,d); })
      .on("mousemove",function(e,d){ tipFor(e,d); })
      .on("mouseleave",function(){ d3.select(this).attr("opacity",.9); hideTip(); });

  // pinned scroller → active step from scroll progress (one context at a time)
  const scroller=document.getElementById("glue-scroller"), N=STEPS.length;
  function activeStep(){
    if(!scroller) return 0;
    const r=scroller.getBoundingClientRect();
    const total=r.height-innerHeight;
    const p = total>0 ? Math.min(Math.max(-r.top/total,0),1) : 0;
    return Math.min(N-1, Math.floor(p*N));
  }
  let tk=false;
  const onScroll=()=>{ if(!tk){ tk=true; requestAnimationFrame(()=>{ tk=false; setStep(activeStep()); }); } };
  addEventListener("scroll",onScroll,{passive:true});
  addEventListener("resize",onScroll);
  setStep(activeStep());
}

/* ── Cost bars (light section) ────────────────────────── */
function renderCostBars(rows){
  const wrap=document.getElementById("cost-bars"); if(!wrap) return; wrap.innerHTML="";
  const data=rows.filter(r=>r.petrol_per100!=null)
    .sort((a,b)=>(b.petrol_per100-b.ev_per100)-(a.petrol_per100-a.ev_per100));
  const max=Math.max(...data.map(c=>Math.max(c.ev_per100,c.diesel_per100||0,c.petrol_per100)));
  const ABBR={Netherlands:"Neth.",Luxembourg:"Lux."};
  const line=(cls,val,col)=>{ const pct=(val/max*80).toFixed(1);
    return `<div class="bar-line"><div class="bar-fill ${cls}" data-w="${pct}"></div><span class="bar-num" style="color:${col};left:calc(${pct}% + 7px)">€${val}</span></div>`; };
  data.forEach(c=>{
    const row=document.createElement("div"); row.className="bar-row";
    row.title=`${c.name}: EV €${c.ev_per100} · diesel €${c.diesel_per100} · petrol €${c.petrol_per100} / 100 km`;
    row.innerHTML=`<div class="bar-name">${ABBR[c.name]||c.name}</div><div class="bar-group">`+
      line("bar-ev",c.ev_per100,"var(--accent)")+
      line("bar-diesel",c.diesel_per100,"#b8901f")+
      line("bar-petrol",c.petrol_per100,"var(--petrol)")+`</div>`;
    wrap.appendChild(row);
  });
  const grow=()=>wrap.querySelectorAll(".bar-fill").forEach((el,i)=>setTimeout(()=>el.style.width=el.dataset.w+"%", REDUCE?0:18*Math.floor(i/3)));
  if(REDUCE){ grow(); return; }
  new IntersectionObserver((es,o)=>es.forEach(e=>{ if(e.isIntersecting){ grow(); o.disconnect(); } }),{threshold:.12}).observe(wrap);
}
function fillCostCallouts(rows){
  const ev=rows.filter(r=>r.ev_per100!=null).reduce((a,b)=>b.ev_per100<a.ev_per100?b:a);
  const die=rows.filter(r=>r.diesel_per100!=null).reduce((a,b)=>b.diesel_per100>a.diesel_per100?b:a);
  const pe=rows.filter(r=>r.petrol_per100!=null).reduce((a,b)=>b.petrol_per100>a.petrol_per100?b:a);
  setTxt("cost-ev-k","to drive 100 km on electricity in "+ev.name);
  setTxt("cost-die-k","to drive 100 km on diesel in "+die.name);
  setTxt("cost-pe-k","to drive 100 km on petrol in "+pe.name);
  // set placeholder so elements aren't blank before animation
  const evEl=document.getElementById("cost-ev-v"), dieEl=document.getElementById("cost-die-v"), peEl=document.getElementById("cost-pe-v");
  if(evEl) evEl.textContent="€0.00";
  if(dieEl) dieEl.textContent="€0.00";
  if(peEl) peEl.textContent="€0.00";
  // animate only when the section scrolls into view
  if(REDUCE){
    if(evEl) evEl.textContent="€"+ev.ev_per100.toFixed(2);
    if(dieEl) dieEl.textContent="€"+die.diesel_per100.toFixed(2);
    if(peEl) peEl.textContent="€"+pe.petrol_per100.toFixed(2);
    return;
  }
  const trigger=document.getElementById("cost-ev-v");
  if(!trigger) return;
  let played=false;
  new IntersectionObserver((entries,obs)=>{
    entries.forEach(e=>{ if(e.isIntersecting && !played){ played=true; obs.disconnect();
      prefixEuro(evEl, ev.ev_per100);
      prefixEuro(dieEl, die.diesel_per100);
      prefixEuro(peEl, pe.petrol_per100);
    }});
  },{threshold:0.4}).observe(trigger);
}
function prefixEuro(el,target){
  if(!el) return;
  let s=null; const dur=1300;
  const step=ts=>{ if(!s)s=ts; const k=Math.min((ts-s)/dur,1); el.textContent="€"+(target*(1-Math.pow(1-k,3))).toFixed(2); if(k<1)requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

/* ── Over time : EU trend line w/ flowing current (dark) ─ */
function renderEuTrend(rows){
  rows=rows.filter(r=>r.ev_per100!=null);
  const W=900,H=380,m={t:18,r:122,b:50,l:58}, iW=W-m.l-m.r, iH=H-m.t-m.b;
  const x=d3.scaleLinear().domain([rows[0].year,rows[rows.length-1].year]).range([0,iW]);
  const maxY=Math.max(...rows.map(r=>Math.max(r.petrol_per100||0,r.diesel_per100||0)))*1.12;
  const y=d3.scaleLinear().domain([0,maxY]).range([iH,0]);
  const s=d3.select("#eu-trend"); if(s.empty())return; s.selectAll("*").remove();
  const g=s.append("g").attr("transform",`translate(${m.l},${m.t})`);
  y.ticks(6).forEach(t=>{ g.append("line").attr("x1",0).attr("x2",iW).attr("y1",y(t)).attr("y2",y(t)).attr("stroke","rgba(255,255,255,.08)"); g.append("text").attr("x",-9).attr("y",y(t)+4).attr("text-anchor","end").attr("font-size","12px").attr("fill","#a4a4ac").text("€"+t); });
  x.ticks(9).forEach(t=>g.append("text").attr("x",x(t)).attr("y",iH+22).attr("text-anchor","middle").attr("font-size","12px").attr("fill","#a4a4ac").text(round(t)));
  g.append("text").attr("transform","rotate(-90)").attr("x",-iH/2).attr("y",-42).attr("text-anchor","middle").attr("font-size","12.5px").attr("font-weight","600").attr("fill","#a4a4ac").text("Cost to drive 100 km (€) →");
  g.append("text").attr("x",iW/2).attr("y",iH+44).attr("text-anchor","middle").attr("font-size","12.5px").attr("font-weight","600").attr("fill","#a4a4ac").text("Year →");
  const series=[["ev_per100",PAL.ev,"Electric"],["diesel_per100",PAL.diesel,"Diesel"],["petrol_per100",PAL.petrol,"Petrol"]];
  const line=d3.line().defined(d=>d.v!=null).x(d=>x(d.year)).y(d=>y(d.v)).curve(d3.curveMonotoneX);
  series.forEach(([k,col,lbl])=>{
    const dd=rows.map(r=>({year:r.year,v:r[k]}));
    g.append("path").datum(dd).attr("fill","none").attr("stroke",col).attr("stroke-width",2.6).attr("d",line);
    const last=dd.filter(d=>d.v!=null).slice(-1)[0];
    if(last){ g.append("circle").attr("cx",x(last.year)).attr("cy",y(last.v)).attr("r",3.5).attr("fill",col);
      g.append("text").attr("x",iW+9).attr("y",y(last.v)+4).attr("font-size","12px").attr("font-weight","700").attr("fill",col).text(lbl+" €"+last.v.toFixed(1)); }
  });
  // flowing current along the Electric line
  if(!REDUCE){
    const evData=rows.map(r=>({year:r.year,v:r.ev_per100}));
    const flow=g.append("path").datum(evData).attr("fill","none").attr("stroke",PAL.evBright).attr("stroke-width",2.8).attr("stroke-linecap","round").attr("d",line);
    const L=flow.node().getTotalLength(); flow.attr("stroke-dasharray",`16 ${L}`);
    let t0=null; const dur=2600;
    const run=ts=>{ if(!t0)t0=ts; const k=((ts-t0)%dur)/dur; flow.attr("stroke-dashoffset",L-(k*(L+16))); requestAnimationFrame(run); };
    requestAnimationFrame(run);
  }
}

/* ── Acceleration : slope chart 2019→2024 (light) ─────── */
function renderSlope(SH){
  const svg=d3.select("#slope-chart"); if(svg.empty()) return;
  const rows=SH.countries.map(c=>({code:c.code,name:c.name,a:SH.shares[c.code]&&SH.shares[c.code]["2019"],b:SH.shares[c.code]&&SH.shares[c.code]["2024"]}))
    .filter(d=>d.a!=null&&d.b!=null);
  const W=480,H=440,m={t:36,r:96,b:22,l:42}, iW=W-m.l-m.r, iH=H-m.t-m.b;
  const y=d3.scaleLinear().domain([0,90]).range([iH,0]);
  svg.selectAll("*").remove();
  const g=svg.append("g").attr("transform",`translate(${m.l},${m.t})`);
  [0,30,60,90].forEach(t=>{ g.append("line").attr("x1",0).attr("x2",iW).attr("y1",y(t)).attr("y2",y(t)).attr("stroke","rgba(12,12,13,.08)");
    g.append("text").attr("x",-8).attr("y",y(t)+4).attr("text-anchor","end").attr("font-size","11px").attr("fill","#9a9aa1").text(t+"%"); });
  g.append("text").attr("x",0).attr("y",-14).attr("text-anchor","middle").attr("font-size","12.5px").attr("font-weight","700").attr("fill","#6b6b70").text("2019");
  g.append("text").attr("x",iW).attr("y",-14).attr("text-anchor","middle").attr("font-size","12.5px").attr("font-weight","700").attr("fill","#6b6b70").text("2024");
  const top=new Set(rows.slice().sort((p,q)=>q.b-p.b).slice(0,5).map(d=>d.code));
  const slopeTip=(e,d)=>showTip(e.clientX,e.clientY,d.name,[["2019",Math.round(d.a)+"%"],["2024",Math.round(d.b)+"%"],["change","+"+Math.round(d.b-d.a)+" pts"]],true);
  function drawLine(d,key){ const col=key?PAL.ev:"#c7c7cc";
    g.append("line").attr("x1",0).attr("y1",y(d.a)).attr("x2",iW).attr("y2",y(d.b))
      .attr("stroke",col).attr("stroke-width",key?2.6:1).attr("opacity",key?1:.55).style("cursor","pointer")
      .on("mouseenter",function(e){ d3.select(this).attr("stroke-width",key?3.4:2).attr("opacity",1); slopeTip(e,d); })
      .on("mousemove",e=>slopeTip(e,d)).on("mouseleave",function(){ d3.select(this).attr("stroke-width",key?2.6:1).attr("opacity",key?1:.55); hideTip(); });
    g.append("circle").attr("cx",0).attr("cy",y(d.a)).attr("r",key?3:2).attr("fill",col);
    g.append("circle").attr("cx",iW).attr("cy",y(d.b)).attr("r",key?3:2).attr("fill",col);
  }
  rows.filter(d=>!top.has(d.code)).forEach(d=>drawLine(d,false));
  rows.filter(d=>top.has(d.code)).forEach(d=>drawLine(d,true));
  // right-side labels for highlighted, with simple vertical declutter
  const labels=rows.filter(d=>top.has(d.code)).map(d=>({yy:y(d.b),txt:dispCode(d.code)+" "+Math.round(d.b)+"%"})).sort((p,q)=>p.yy-q.yy);
  for(let i=1;i<labels.length;i++){ if(labels[i].yy-labels[i-1].yy<13) labels[i].yy=labels[i-1].yy+13; }
  labels.forEach(l=>g.append("text").attr("x",iW+8).attr("y",l.yy+3).attr("font-size","11px").attr("font-weight","700").attr("fill",PAL.ev).text(l.txt));
}

/* ── Acceleration : 28-country sparkline small-multiples ── */
function renderSparklines(SH){
  const wrap=document.getElementById("spark-grid"); if(!wrap) return; wrap.innerHTML="";
  const yrs=SH.years, key=String(yrs[yrs.length-1]);
  const data=SH.countries.map(c=>({code:c.code,name:c.name,
      series:yrs.map(yr=>{ const v=SH.shares[c.code]&&SH.shares[c.code][String(yr)]; return v==null?null:v; }),
      last:SH.shares[c.code]&&SH.shares[c.code][key]}))
    .filter(d=>d.last!=null).sort((p,q)=>q.last-p.last);
  const gMax=Math.max(...data.map(d=>Math.max(...d.series.filter(v=>v!=null))));
  const W=110,H=34,pad=3, x=i=>pad+i/(yrs.length-1)*(W-2*pad), y=v=>H-pad-(v/gMax)*(H-2*pad);
  data.forEach(d=>{
    const col=dotColor(d.last);
    const pts=d.series.map((v,i)=>v==null?null:[x(i),y(v)]).filter(Boolean);
    const path=pts.map((p,i)=>(i?"L":"M")+p[0].toFixed(1)+" "+p[1].toFixed(1)).join(" ");
    const last=pts[pts.length-1];
    const card=document.createElement("div"); card.className="spark-card";
    card.title=`${d.name}: ${Math.round(d.last)}% BEV in 2024 (from ${Math.round(d.series.find(v=>v!=null))}% in ${yrs[d.series.findIndex(v=>v!=null)]})`;
    card.innerHTML=`<div class="sc-top"><span class="sc-code">${dispCode(d.code)}</span><span class="sc-val" style="color:${col}">${Math.round(d.last)}%</span></div>`+
      `<svg viewBox="0 0 ${W} ${H}"><path d="${path}" fill="none" stroke="${col}" stroke-width="1.6"/><circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="2" fill="${col}"/></svg>`;
    wrap.appendChild(card);
  });
}

/* ── Payoff : country picker + per-country trend (dark) ── */
function renderPicker(rows, byYear, euTrend){
  const grid=document.getElementById("picker-grid"), res=document.getElementById("result");
  if(!grid) return;
  const data=rows.filter(r=>r.petrol_per100!=null).sort((a,b)=>a.name.localeCompare(b.name));
  data.forEach(c=>{
    const btn=document.createElement("button"); btn.className="pbtn"; btn.textContent=c.name;
    btn.onclick=()=>{
      grid.querySelectorAll(".pbtn").forEach(x=>x.classList.remove("active")); btn.classList.add("active");
      const save=(c.petrol_per100-c.ev_per100).toFixed(2);
      const yearly=round((c.petrol_per100-c.ev_per100)*150);
      const verdict = (c.petrol_per100-c.ev_per100>5)
        ? `In ${c.name}, an EV costs €${c.ev_per100} vs €${c.petrol_per100} on petrol per 100 km — a saving of <b>€${save}</b>. Over 15,000 km a year that's <b>≈ €${yearly} saved</b>. The case is strong, and it shows in the ${round(c.ev_share)}% EV share.`
        : `In ${c.name}, an EV saves €${save} per 100 km vs petrol — a real but smaller edge. EV share here is ${round(c.ev_share)}%.`;
      setTxt("r-country", c.name+" · cost to drive 100 km");
      setTxt("r-ev","€"+c.ev_per100); setTxt("r-petrol","€"+c.petrol_per100); setTxt("r-save","€"+save);
      const saveDie=(c.diesel_per100-c.ev_per100).toFixed(2);
      setTxt("r-ev2","€"+c.ev_per100); setTxt("r-diesel","€"+c.diesel_per100); setTxt("r-save-die","€"+saveDie);
      const v=document.getElementById("r-verdict"); if(v) v.innerHTML=verdict;
      setTxt("ct-title", c.name+" — electric running cost over time");
      renderCountryTrend(c.code, byYear, euTrend);
      res.classList.add("show");
    };
    grid.appendChild(btn);
  });
}
function renderCountryTrend(code, byYear, euTrend){
  const years=byYear.years, evMap=byYear.ev_per100[code]||{};
  const evPts=years.map(y=>({year:y,v:evMap[String(y)]})).filter(d=>d.v!=null);
  const euYears=euTrend.filter(r=>r.year>=years[0]);
  const W=760,H=280,m={t:16,r:120,b:34,l:48}, iW=W-m.l-m.r, iH=H-m.t-m.b;
  const x=d3.scaleLinear().domain([years[0],years[years.length-1]]).range([0,iW]);
  const maxY=Math.max(...euYears.map(r=>Math.max(r.petrol_per100||0,r.diesel_per100||0)),...evPts.map(d=>d.v))*1.12;
  const y=d3.scaleLinear().domain([0,maxY]).range([iH,0]);
  const s=d3.select("#ctrend"); if(s.empty())return; s.selectAll("*").remove();
  const g=s.append("g").attr("transform",`translate(${m.l},${m.t})`);
  y.ticks(5).forEach(t=>{ g.append("line").attr("x1",0).attr("x2",iW).attr("y1",y(t)).attr("y2",y(t)).attr("stroke","rgba(255,255,255,.08)"); g.append("text").attr("x",-8).attr("y",y(t)+3).attr("text-anchor","end").attr("font-size","10px").attr("fill","#8a8a90").text("€"+t); });
  x.ticks(8).forEach(t=>g.append("text").attr("x",x(t)).attr("y",iH+18).attr("text-anchor","middle").attr("font-size","10px").attr("fill","#8a8a90").text(round(t)));
  const line=d3.line().defined(d=>d.v!=null).x(d=>x(d.year)).y(d=>y(d.v)).curve(d3.curveMonotoneX);
  [["petrol_per100",PAL.petrol,"Petrol · EU"],["diesel_per100",PAL.diesel,"Diesel · EU"]].forEach(([k,col,lbl])=>{
    const dd=euYears.map(r=>({year:r.year,v:r[k]}));
    g.append("path").datum(dd).attr("fill","none").attr("stroke",col).attr("stroke-width",1.6).attr("stroke-dasharray","4,4").attr("opacity",.7).attr("d",line);
    const last=dd.filter(d=>d.v!=null).slice(-1)[0];
    if(last) g.append("text").attr("x",iW+8).attr("y",y(last.v)+4).attr("font-size","10px").attr("fill",col).attr("opacity",.85).text(lbl);
  });
  g.append("path").datum(evPts).attr("fill","none").attr("stroke",PAL.ev).attr("stroke-width",2.8).attr("d",line);
  const lastEv=evPts.slice(-1)[0];
  if(lastEv){ g.append("circle").attr("cx",x(lastEv.year)).attr("cy",y(lastEv.v)).attr("r",3.5).attr("fill",PAL.ev);
    g.append("text").attr("x",iW+8).attr("y",y(lastEv.v)+4).attr("font-size","11px").attr("font-weight","700").attr("fill",PAL.ev).text("EV €"+lastEv.v.toFixed(1)); }
}

/* ── scroll reveal + nav scrollspy (all pages) ────────── */
(function(){
  const io=new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting) e.target.classList.add("vis"); }),{threshold:.12});
  document.querySelectorAll(".reveal").forEach(el=>io.observe(el));
  const links=document.querySelectorAll(".nav-links a[data-sec]");
  if(links.length){
    const secs=[...links].map(a=>a.dataset.sec);
    let tick=false;
    const upd=()=>{ tick=false; let cur=secs[0];
      secs.forEach(id=>{ const el=document.getElementById(id); if(el && window.scrollY>=el.offsetTop-180) cur=id; });
      links.forEach(a=>a.classList.toggle("active",a.dataset.sec===cur));
    };
    window.addEventListener("scroll",()=>{ if(!tick){ tick=true; requestAnimationFrame(upd); } },{passive:true});
    upd();
  }
})();

/* ── MOTION 2 : 0→100 km/h speedometer (thematic flourish) ─ */
(function(){
  const host=document.getElementById("gauge-host"); if(!host) return;
  const arc=document.getElementById("gauge-val"), needle=document.getElementById("needle"), num=document.getElementById("gauge-num");
  const cx=150,cy=150,r=120,target=100;
  function setVal(v){ arc.style.strokeDashoffset=100-v; const a=(180-v/100*180)*Math.PI/180;
    needle.setAttribute("x2",cx+r*Math.cos(a)); needle.setAttribute("y2",cy-r*Math.sin(a)); num.textContent=Math.round(v); }
  if(REDUCE){ setVal(target); return; }
  let played=false;
  new IntersectionObserver((es,o)=>es.forEach(e=>{ if(e.isIntersecting&&!played){ played=true; let s=null; const dur=1700;
    const fr=ts=>{ if(!s)s=ts; const k=Math.min((ts-s)/dur,1); setVal(target*(1-Math.pow(1-k,3))); if(k<1)requestAnimationFrame(fr); }; requestAnimationFrame(fr); } }),{threshold:.5}).observe(host);
})();

/* ── MOTION 3 : scroll-linked EV on a charge rail ─────── */
(function(){
  const car=document.getElementById("car"), charge=document.getElementById("charge"); if(!car) return;
  let tick=false;
  function upd(){ tick=false; const max=document.documentElement.scrollHeight-innerHeight;
    const p=max>0?Math.min(Math.max(scrollY/max,0),1):0; const pct=2+p*96;
    car.style.left=pct+"%"; if(charge) charge.style.width=pct+"%"; }
  addEventListener("scroll",()=>{ if(!tick){ tick=true; requestAnimationFrame(upd); } },{passive:true});
  addEventListener("resize",upd); upd();
})();

/* ── MAP : intro fade-out on scroll + refit the (now larger) map box ── */
(function(){
  const intros=[...document.querySelectorAll(".fade-intro")];
  if(intros.length && !REDUCE){
    let tk=false;
    const upd=()=>{ tk=false; intros.forEach(intro=>{ const r=intro.getBoundingClientRect();
      intro.style.opacity=Math.max(0,Math.min(1,(r.bottom-100)/(r.height*0.7))); }); };
    addEventListener("scroll",()=>{ if(!tk){ tk=true; requestAnimationFrame(upd); } },{passive:true}); upd();
  }
  // map.js / Chart.js fit to their containers on load & window-resize; nudge once layout settles
  addEventListener("load",()=>setTimeout(()=>dispatchEvent(new Event("resize")),160));
})();

/* ── Energy explorer: search bar always visible; click it to drop the
   country list as a floating menu; click outside to close ── */
(function(){
  const sw=document.getElementById("searchWrap"), inp=document.getElementById("countrySearch");
  if(!sw||!inp) return;
  const open=()=>sw.classList.add("open");
  inp.addEventListener("focus",open);
  inp.addEventListener("click",open);
  document.addEventListener("mousedown",e=>{ if(!sw.contains(e.target)) sw.classList.remove("open"); });
})();

/* ── Hero scroll-cue: hide once the user scrolls past the hero ── */
(function(){
  const cue=document.querySelector(".cue"); if(!cue) return;
  let tk=false;
  const upd=()=>{ tk=false; const hero=document.querySelector(".hero");
    if(!hero) return;
    const gone=window.scrollY>hero.offsetHeight*0.55;
    cue.style.opacity=gone?"0":"";
    cue.style.pointerEvents=gone?"none":""; };
  addEventListener("scroll",()=>{ if(!tk){ tk=true; requestAnimationFrame(upd); } },{passive:true});
  upd();
})();

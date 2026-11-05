"use strict";
/* ---------- 繪製 ---------- */
const esc=s=>String(s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const swatch=c=>c.stripe?`linear-gradient(90deg,${c.c} 50%,${c.stripe} 50%)`:c.c;
function pathD(pts){
  if(pts.length<2) return '';
  let d=`M${pts[0].x} ${pts[0].y}`;
  for(let i=1;i<pts.length-1;i++){
    const a=pts[i-1],b=pts[i],c=pts[i+1];
    const r=Math.min(2.5,(Math.abs(a.x-b.x)+Math.abs(a.y-b.y))/2,(Math.abs(c.x-b.x)+Math.abs(c.y-b.y))/2);
    const ux=sgn(b.x-a.x),uy=sgn(b.y-a.y),vx=sgn(c.x-b.x),vy=sgn(c.y-b.y);
    d+=`L${b.x-ux*r} ${b.y-uy*r}Q${b.x} ${b.y} ${b.x+vx*r} ${b.y+vy*r}`;
  }
  const e=pts[pts.length-1];return d+`L${e.x} ${e.y}`;
}
function renderBoard(){
  const P=S.plate,B=S.box,bo=boxOrigin(),dr=sheetRect('door'),fr=sheetRect('field');let h='';
  h+=`<rect class="boxr" x="${bo.x}" y="${bo.y}" width="${B.w}" height="${B.h}" rx="4"/>`;
  h+=`<text class="dim" x="${bo.x+6}" y="${bo.y+B.h-6}">電控箱 ${B.w} × ${B.h} × ${B.d} mm</text>`;
  h+=`<text class="sheet-t" x="${bo.x}" y="${bo.y-8}">底板</text>`;
  if(useDoor()){
    h+=`<rect class="doorr" x="${dr.x}" y="${dr.y}" width="${dr.w}" height="${dr.h}" rx="4"/>`;
    h+=`<text class="sheet-t" x="${dr.x}" y="${dr.y-8}">${doorTitle()}</text>`;
    h+=`<text class="dim" x="${dr.x+6}" y="${dr.y+dr.h-6}">${doorShort()} ${dr.w} × ${dr.h} mm</text>`;
  }
  for(const z of S.fields) h+=`<g class="zoneg" data-zone="${z.id}"><rect class="fieldr" x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="4"/><rect class="zone-h" x="${z.x}" y="${z.y}" width="${Math.min(z.w,Math.max(120,[...z.name].length*14+60))}" height="22" rx="4"/><text class="field-t" x="${z.x+6}" y="${z.y+16}">${esc(z.name)}</text></g>`;
  const door=S.wires.filter(w=>wireKind(w)==='door').length+S.wires.filter(w=>{const a=devOf(w.a.d)?.sheet,b=devOf(w.b.d)?.sheet;return (a==='door'&&b==='field')||(a==='field'&&b==='door');}).length;
  const hh=Math.max(14,door*2.6+8);
  if(useDoor()) h+=`<rect class="harness" x="${P.w}" y="${S.hinge-hh/2}" width="${dr.x-P.w}" height="${hh}"/><text class="harness-t" x="${(P.w+dr.x)/2}" y="${S.hinge-hh/2-4}" text-anchor="middle">${S.doorMode==='console'?'到操作台':'過門線束'} ${door} 條</text>`;
  h+=`<rect class="plate" x="0" y="0" width="${P.w}" height="${P.h}" rx="2"/>`;
  [[8,8],[P.w-8,8],[8,P.h-8],[P.w-8,P.h-8]].forEach(([x,y])=>h+=`<circle class="hole" cx="${x}" cy="${y}" r="3"/>`);
  for(let x=0;x<=P.w;x+=100) h+=`<line class="tick" x1="${x}" y1="-5" x2="${x}" y2="-1"/><text class="dim" x="${x}" y="-8" text-anchor="middle">${x}</text>`;
  for(let y=100;y<=P.h;y+=100) h+=`<line class="tick" x1="-5" y1="${y}" x2="-1" y2="${y}"/><text class="dim" x="-8" y="${y+3}" text-anchor="end">${y}</text>`;
  h+=`<text class="dim" x="${P.w}" y="${P.h+12}" text-anchor="end">底板 ${P.w} × ${P.h} mm</text>`;
  for(const d of S.ducts){
    const a=axis(d);
    h+=`<g class="duct" data-duct="${d.id}"><rect class="duct-body" x="${d.x}" y="${d.y}" width="${d.w}" height="${d.h}"/>`;
    if(a==='h') h+=`<path class="duct-teeth" d="M${d.x} ${d.y+1.5}H${d.x+d.w}M${d.x} ${d.y+d.h-1.5}H${d.x+d.w}"/>`;
    else h+=`<path class="duct-teeth" d="M${d.x+1.5} ${d.y}V${d.y+d.h}M${d.x+d.w-1.5} ${d.y}V${d.y+d.h}"/>`;
    h+='</g>';
  }
  const order=[...S.devices].sort((a,b)=>(tplOf(b).noOv?1:0)-(tplOf(a).noOv?1:0));
  for(const d of order){
    const t=tplOf(d);
    h+=`<g class="dev" data-dev="${d.id}">`;
    if(t.round) h+=`<rect class="body" x="${d.x}" y="${d.y}" width="${t.w}" height="${t.h}" rx="${Math.min(t.w,t.h)/2}" fill="${t.f}"/>`;
    else h+=`<rect class="body" x="${d.x}" y="${d.y}" width="${t.w}" height="${t.h}" rx="2.5" fill="${t.f}"/>`;
    const cy=d.y+t.h/2,small=t.w<28||t.h<26,tagSize=small?Math.max(4.5,Math.min(t.w/3.6,8)):10;
    if(t.noOv) h+=`<text class="sub" x="${d.x+t.w/2}" y="${cy+1.5}" text-anchor="middle" fill="${t.i}">${esc(d.tag)} 鋁軌 ${t.w} mm</text>`;
    else{
      h+=`<text class="tag" style="font-size:${tagSize}px" x="${d.x+t.w/2}" y="${cy+tagSize*.25}" text-anchor="middle" fill="${t.i}">${esc(d.tag)}</text>`;
      if(!small) h+=`<text class="sub" x="${d.x+t.w/2}" y="${cy+8}" text-anchor="middle" fill="${t.i}">${esc(t.b)}</text>`;
    }
    const tr=t.terms.length>30?1.3:t.terms.length>14?1.7:2.3;
    for(const p of t.terms){
      const x=d.x+p.x,y=d.y+p.y;
      h+=`<circle class="term" cx="${x}" cy="${y}" r="${tr}"/>`;
      h+=`<text class="tl" x="${x+(p.side==='left'?5:p.side==='right'?-5:0)}" y="${y+(p.side==='top'?5.8:p.side==='bottom'?-3.6:1)}" text-anchor="middle" fill="${t.i}">${esc(p.id)}</text>`;
    }
    h+='</g>';
  }
  const by=boxBottom();
  for(const g of S.glands){
    h+=`<g class="glandg" data-gland="${g.id}"><circle class="gland" cx="${g.x}" cy="${by}" r="7"/><text class="gland-t" x="${g.x+10}" y="${by+13}">${esc(g.id)} ${esc(g.spec.split(' ')[0])}</text></g>`;
  }
  $('board').innerHTML=h;
}
function wireInner(w,r){
  const col=colorOf(w),sw=gw(w.gauge),d=pathD(r.pts),kind=wireKind(w);
  const dash=kind==='ext'?' stroke-dasharray="7 3" style="stroke-linecap:butt"':'';
  let s=`<path class="vis" d="${d}" stroke="${col.k}" stroke-width="${sw+.9}"/>`;
  s+=`<path class="vis" d="${d}" stroke="${col.c}" stroke-width="${sw}"${dash}/>`;
  if(col.stripe) s+=`<path class="vis" d="${d}" stroke="${col.stripe}" stroke-width="${sw}" stroke-dasharray="6 6" style="stroke-linecap:butt"/>`;
  if(r.warn) s+=`<path class="warnline" d="${d}"/>`;
  return s;
}
function renderWires(){
  let h='';const cableLabel=new Map();
  for(const w of S.wires){
    const r=ROUTES.get(w.id); if(!r) continue;
    h+=`<g class="wire" data-wid="${w.id}">${wireInner(w,r)}<path class="hit" d="${pathD(r.pts)}"/>`;
    const [a,b]=[r.pts[0],r.pts[1]];
    if(a&&b){const v=Math.abs(a.x-b.x)<.01,dir=v?sgn(b.y-a.y):sgn(b.x-a.x),L=Math.min(13,(Math.abs(a.x-b.x)+Math.abs(a.y-b.y))/2);
      const tx=a.x+(v?0:dir*L),ty=a.y+(v?dir*L:0);
      h+=`<text class="wn" x="${tx}" y="${ty}" text-anchor="middle" dominant-baseline="central" ${v?`transform="rotate(-90 ${tx} ${ty})"`:''}>${w.no}</text>`;}
    h+='</g>';
    if(wireKind(w)==='ext'&&w.ext&&w.ext.cable){
      const fd=devOf(w.a.d).sheet==='field'?w.a.d:w.b.d;
      const k=w.ext.cable+'|'+fd;
      if(!cableLabel.has(k)){const d=devOf(fd);cableLabel.set(k,{x:d.x+tplOf(d).w/2,y:d.y+tplOf(d).h+11,t:`${w.ext.cable} → ${d.tag}`});}
    }
  }
  $('wires').innerHTML=h;
  let t='';
  cableLabel.forEach(c=>t+=`<text class="ct" x="${c.x}" y="${c.y}" text-anchor="middle">${esc(c.t)}</text>`);
  for(const d of S.ducts){
    const a=axis(d),u=DUCTUSE.get(d.id)||{n:0,pct:0};
    const lx=a==='h'?d.x+d.w-4:d.x+d.w/2,ly=a==='h'?d.y+d.h/2+2:d.y+d.h-6;
    t+=`<text class="duct-label${u.pct>S.fillLimit?' over':''}" x="${lx}" y="${ly}" text-anchor="${a==='h'?'end':'middle'}">${d.id} · ${u.n} 條 · ${u.pct}%</text>`;
  }
  const flagged=new Set();
  ISSUES.forEach(i=>{if(i.k==='dev'||i.k==='duct') flagged.add(i.k+'|'+i.id);});
  flagged.forEach(s=>{
    const [k,id]=s.split('|'),o=k==='dev'?devOf(id):S.ducts.find(d=>d.id===id);if(!o) return;
    const r=rectOf(k,o);t+=`<rect class="issue-rect" x="${r.x-1}" y="${r.y-1}" width="${r.w+2}" height="${r.h+2}" rx="2"/>`;
  });
  const rh=railHit&&devOf(railHit);
  if(rh){const rt=tplOf(rh);t+=`<rect class="rail-hit" x="${rh.x-1}" y="${rh.y-1}" width="${rt.w+2}" height="${rt.h+2}" rx="2"/>`;}
  if(picked){
    const b=pickedBox(); if(b) t+=`<rect class="picked" x="${b.x-2}" y="${b.y-2}" width="${b.w+4}" height="${b.h+4}" rx="3"/>`;
  }
  $('top').innerHTML=t;
  applyWireClasses();
}
function pickedBox(){
  if(!picked) return null;
  if(picked.k==='dev'){const d=devOf(picked.id);if(!d)return null;const t=tplOf(d);return {x:d.x,y:d.y,w:t.w,h:t.h};}
  if(picked.k==='zone'){const z=S.fields.find(x=>x.id===picked.id);return z?{x:z.x,y:z.y,w:z.w,h:z.h}:null;}
  if(picked.k==='gland'){const g=S.glands.find(x=>x.id===picked.id);return g?{x:g.x-8,y:boxBottom()-8,w:16,h:16}:null;}
  const d=S.ducts.find(x=>x.id===picked.id);return d?{x:d.x,y:d.y,w:d.w,h:d.h}:null;
}
function passes(w){
  if(filt.color&&w.color!==filt.color) return false;
  if(filt.gauge&&w.gauge!==filt.gauge) return false;
  if(filt.dev&&w.a.d!==filt.dev&&w.b.d!==filt.dev) return false;
  if(filt.kind&&wireKind(w)!==filt.kind) return false;
  return true;
}
function applyWireClasses(){
  // 線束模式下，選到的線要從線束拉開，所以選取改變時重算線道
  if(bundle&&sel!==bundleSel){computeRoutes();renderWires();return;}
  const focus=listHover||hoverW||sel;
  const g=$('wires');g.classList.toggle('focus',!!focus);
  g.querySelectorAll('.wire').forEach(el=>{
    const id=el.dataset.wid,w=S.wires.find(x=>x.id===id);
    el.classList.toggle('on',id===focus);
    el.classList.toggle('off',w?!passes(w):false);
  });
  const f=focus&&g.querySelector(`.wire[data-wid="${focus}"]`);
  if(f&&g.lastElementChild!==f) g.appendChild(f);
  renderOverlay();
}
function renderOverlay(){
  const k=view.k,inv=`scale(${1/k})`;let h='';
  const focus=listHover||hoverW||sel;
  if(focus){
    const w=S.wires.find(x=>x.id===focus),r=ROUTES.get(focus);
    if(w&&r){
      const ends=[[r.pts[0],w.a],[r.pts[r.pts.length-1],w.b]];
      for(const [p,e] of ends){
        const t=`${e.d}·${e.t}`,tw=[...t].reduce((s,c)=>s+(c.charCodeAt(0)>255?14:8),0)+14;
        h+=`<g transform="translate(${p.x} ${p.y}) ${inv}"><circle class="end-ring" r="8"/><rect class="pill-bg" x="10" y="-11" width="${tw}" height="22" rx="4"/><text class="pill-t" x="17" y="5">${esc(t)}</text></g>`;
      }
      w.wps.forEach(p=>h+=`<circle class="wp" cx="${p.x}" cy="${p.y}" r="${(focus===sel?6:3.5)/k}"/>`);
    }
  }
  if(draft){
    const a=draft.a,wps=draft.wps;
    const end=draft.end?endpoint(draft.end,0):snap?{x:snap.x,y:snap.y,side:snap.side,dev:snap.d,sheet:devOf(snap.d).sheet}:wpAnchor(cursor);
    const pts=previewPts(a,wps,end);
    if(draft.pop){const col=keyColor(last.color);h+=`<path d="${pathD(pts)}" fill="none" stroke="${col.k}" stroke-width="${gw(last.gauge)+.9}"/><path d="${pathD(pts)}" fill="none" stroke="${col.c}" stroke-width="${gw(last.gauge)}"/>`;}
    else h+=`<path class="draft" d="${pathD(pts)}"/>`;
    wps.forEach(p=>h+=`<circle class="wp" cx="${p.x}" cy="${p.y}" r="${4/k}"/>`);
    const s=endpoint(a,0);h+=`<g transform="translate(${s.x} ${s.y}) ${inv}"><circle class="end-ring" r="8"/></g>`;
  }
  if(snap&&mode==='wire'&&!(draft&&draft.pop)){
    const n=countAt(snap.d,snap.t);
    const t=`${snap.tag}·${snap.t}`+(snap.desc?` ${snap.desc}`:'')+(n?` 已接 ${n}`:'');
    const tw=[...t].reduce((s,c)=>s+(c.charCodeAt(0)>255?14:8),0)+16;
    const flip=snap.x*k+view.x+tw+30>$('svg').clientWidth;
    const dx=(cursor.x-snap.x)*k,dy=(cursor.y-snap.y)*k;
    h+=`<g transform="translate(${snap.x} ${snap.y}) ${inv}"><line class="snap-teth" x1="0" y1="0" x2="${dx}" y2="${dy}"/><circle class="snap-ring" r="13"/><circle class="snap-dot" r="4.5"/>`+
       `<rect class="pill-bg" x="${flip?-18-tw:18}" y="-13" width="${tw}" height="26" rx="4"/><text class="pill-t" x="${flip?-10-tw:26}" y="5">${esc(t)}</text></g>`;
  }
  $('ov').innerHTML=h;
  $('ov').style.pointerEvents='none';
}
const countAt=(d,t)=>S.wires.filter(w=>(w.a.d===d&&w.a.t===t)||(w.b.d===d&&w.b.t===t)).length;
function applyView(){
  $('world').setAttribute('transform',`translate(${view.x} ${view.y}) scale(${view.k})`);
  $('svg').classList.toggle('z2',view.k>=2.2);
  $('svg').classList.toggle('labels-on',showNo);
  $('svg').classList.toggle('place',mode==='place');
  renderOverlay();
}
function fit(){
  const r=$('svg').getBoundingClientRect();if(!r.width||!r.height)return;
  const o=boxOrigin(),dr=useDoor()?sheetRect('door'):{x:o.x,y:o.y,w:S.box.w,h:S.box.h},fr=sheetRect('field');
  const x0=Math.min(0,o.x,fr.x)-16,y0=Math.min(0,o.y,dr.y,fr.y)-20,x1=Math.max(S.plate.w,dr.x+dr.w,fr.x+fr.w)+6,y1=Math.max(o.y+S.box.h+30,fr.y+fr.h)+6;
  const bw=x1-x0,bh=y1-y0,mx=8,top=6,bot=44;
  const k=Math.min((r.width-2*mx)/bw,(r.height-top-bot)/bh);
  view.k=k;view.x=(r.width-bw*k)/2-x0*k;view.y=top+(r.height-top-bot-bh*k)/2-y0*k;view.manual=false;applyView();
}
function fitSheet(s){
  const r=$('svg').getBoundingClientRect();if(!r.width||!r.height)return;
  const R=s==='plate'?(()=>{const o=boxOrigin();return {x:o.x,y:o.y,w:S.box.w,h:S.box.h};})():sheetRect(s);
  const pad=14,bot=44,k=Math.min((r.width-2*pad)/R.w,(r.height-pad-bot)/R.h);
  view.k=k;view.x=(r.width-R.w*k)/2-R.x*k;view.y=pad+(r.height-pad-bot-R.h*k)/2-R.y*k;view.manual=true;applyView();
}
function zoomAt(f,sx,sy){
  const k=Math.max(.25,Math.min(14,view.k*f)),q=k/view.k;
  view.x=sx-(sx-view.x)*q;view.y=sy-(sy-view.y)*q;view.k=k;view.manual=true;applyView();
}
function recompute(){computeRoutes();renderBoard();renderWires();renderList();renderDetail();renderStats();renderIssues();syncSizes();updateHint();}
function renderIssues(){
  $('issuesH').textContent=ISSUES.length?`檢查　${ISSUES.length} 項`:'檢查';
  const max=12,rows=ISSUES.slice(0,max);
  $('issues').innerHTML=ISSUES.length?rows.map((x,i)=>x.k?`<button class="issue" data-iss="${i}">${esc(x.t)}</button>`:`<div class="issue">${esc(x.t)}</div>`).join('')+(ISSUES.length>max?`<p class="ok">還有 ${ISSUES.length-max} 項，先處理上面的問題。</p>`:''):`<p class="ok">尺寸、深度、擺放與走線都沒有發現問題。</p>`;
}
function applyDoorMode(){
  const m=S.doorMode||'door';
  KINDS.door=m==='console'?'操作台':'過門';SHEET_N.door=doorShort();
  const dm=$('dm');if(document.activeElement!==dm)dm.value=m;
  ['dw','dh','hy'].forEach(id=>$(id).closest('label').hidden=m==='none');
  $('vDoor').hidden=m==='none';$('vDoor').textContent=doorShort();
}
function syncSizes(){
  const set=(id,v)=>{const el=$(id);if(document.activeElement!==el)el.value=v;};
  applyDoorMode();
  set('bw',S.box.w);set('bh',S.box.h);set('bd',S.box.d);set('bk',S.box.back);set('pw',S.plate.w);set('ph',S.plate.h);set('dw',S.door.w);set('dh',S.door.h);set('hy',S.hinge);set('fl',S.fillLimit);
}
let toastT=0;
function toast(s){const t=$('toast');t.textContent=s;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,3200);}


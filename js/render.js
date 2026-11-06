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
// 器具編號放中間會壓到接點（含接點旁的文字）時，改放到接點之間最寬的直向空白帶；空白帶太窄就直書
function tagPlace(d,t,fs,small){
  const n=[...String(d.tag)].reduce((s,c)=>s+(c.charCodeAt(0)>255?1:.62),0),cx=t.w/2,cy=t.h/2,pad=1.5;
  const span=p=>p.side==='right'?[p.x-11,p.x+3]:p.side==='left'?[p.x-3,p.x+11]:[p.x-4,p.x+4];
  const tw=n*fs,bot=small?fs*.4:8+fs*.1;
  if(small) return {x:cx,y:cy,fs}; // 小器具維持原樣
  // 只有接點圓點真的落在編號範圍內才移動
  if(!t.terms.some(p=>p.x>cx-tw/2-2.5&&p.x<cx+tw/2+2.5&&p.y>cy-fs*.7-2.5&&p.y<cy+bot+2.5)) return {x:cx,y:cy,fs};
  const sp=t.terms.map(span).sort((a,b)=>a[0]-b[0]);let x=0,gx=cx,gw=0;
  for(const [a,b] of [...sp,[t.w,t.w]]){if(a-x>gw){gw=a-x;gx=(a+x)/2;}x=Math.max(x,b);}
  gw-=2*pad;
  if(gw>=n*Math.min(fs,6)) {const f=Math.min(fs,gw/n);return {x:gx,y:cy,fs:f,sub:gw>=9};}
  if(gw>=4){const f=Math.min(fs,gw/1.1,(t.h-6)/n);return {x:gx,y:cy,fs:f,rot:true};}
  return {x:cx,y:cy,fs};
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
  const rank=d=>tplOf(d).noOv?0:d.on?2:1; // 鋁軌在最下面，正面附件畫在接觸器上面
  const order=[...S.devices].sort((a,b)=>rank(a)-rank(b));
  for(const d of order){
    const t=tplOf(d);
    h+=`<g class="dev${d.on?' rider':''}" data-dev="${d.id}">`; // 裝在接觸器正面的附件畫成半透明，看得到底下的線圈與輔助接點
    if(t.round) h+=`<rect class="body" x="${d.x}" y="${d.y}" width="${t.w}" height="${t.h}" rx="${Math.min(t.w,t.h)/2}" fill="${t.f}"/>`;
    else h+=`<rect class="body" x="${d.x}" y="${d.y}" width="${t.w}" height="${t.h}" rx="2.5" fill="${t.f}"/>`;
    // 器具上的示意圖形（例如伺服的內置回生電阻）；旋轉的器具不畫
    if(t.deco&&!d.rot) t.deco.forEach(g=>{if(g.k==='res'){const cx=d.x+g.x+g.w/2;h+=`<g class="deco"><line x1="${cx}" y1="${d.y+(g.a??g.y-4)}" x2="${cx}" y2="${d.y+g.y-.3}"/><line x1="${cx}" y1="${d.y+g.y+g.h+.3}" x2="${cx}" y2="${d.y+(g.b??g.y+g.h+4)}"/><rect x="${d.x+g.x}" y="${d.y+g.y}" width="${g.w}" height="${g.h}" rx=".6"/><text x="${cx+g.w/2+2}" y="${d.y+g.y+g.h/2}" dominant-baseline="central">${esc(g.label||'')}</text></g>`;}});
    const bodyEnd=h.length; // 短路片插在外殼後面，編號與接點畫在它上面
    const cy=d.y+t.h/2,small=t.w<28||t.h<26,tagSize=small?Math.max(4.5,Math.min(t.w/3.6,8)):10;
    if(d.on) h+=`<text class="tag" style="font-size:5px" x="${d.x+t.w/2}" y="${d.y+5.5}" text-anchor="middle" fill="${t.i}">${esc(d.tag)}</text>`; // 附件編號放上緣，不和接觸器的編號疊在一起
    else if(t.noOv) h+=`<text class="sub" x="${d.x+t.w/2}" y="${cy+1.5}" text-anchor="middle" fill="${t.i}">${esc(d.tag)} 鋁軌 ${t.w} mm</text>`;
    else{
      const L=tagPlace(d,t,tagSize,small);
      const tx=d.x+L.x,ty=d.y+L.y;
      h+=L.rot?`<text class="tag" style="font-size:${L.fs.toFixed(2)}px" x="${tx}" y="${ty}" text-anchor="middle" dominant-baseline="central" transform="rotate(-90 ${tx} ${ty})" fill="${t.i}">${esc(d.tag)}</text>`
        :`<text class="tag" style="font-size:${L.fs.toFixed(2)}px" x="${tx}" y="${ty+L.fs*.25}" text-anchor="middle" fill="${t.i}">${esc(d.tag)}</text>`;
      if(!small&&!L.rot&&L.sub!==false) h+=`<text class="sub" x="${d.x+L.x}" y="${d.y+L.y+Math.max(5.5,L.fs*.8)}" text-anchor="middle" fill="${t.i}"${L.fs<10?` style="font-size:${Math.max(3,L.fs*.44).toFixed(2)}px"`:''}>${esc(t.b)}</text>`;
    }
    const tr=t.terms.length>30?1.3:t.terms.length>14?1.7:2.3;
    for(const p of t.terms){
      const x=d.x+p.x,y=d.y+p.y;
      h+=`<circle class="term" cx="${x}" cy="${y}" r="${tr}"/>`;
      const lb=termLabel(d,p.id),sm=lb!==p.id&&SLOT_RE.exec(p.id);
      // 極距很密的端子（例如 FX5U 左側 5 極端子）：標籤照手冊直寫
      if(t.vlab&&!d.rot&&t.vlab.includes(p.id)&&(p.side==='top'||p.side==='bottom')){const up=p.side==='bottom',ty=y+(up?-2.6:2.6);h+=`<text class="tl" x="${x}" y="${ty}" text-anchor="${up?'start':'end'}" dominant-baseline="central" transform="rotate(-90 ${x} ${ty})" fill="${t.i}" style="font-size:2.4px">${esc(lb)}</text>`;continue;}
      if(!(sm&&(sm[2]==='B'||sm[2]==='D'))) h+=`<text class="tl" x="${x+(p.side==='left'?5:p.side==='right'?-5:0)}" y="${y+(p.side==='top'?5.8:p.side==='bottom'?-3.6:1)}" text-anchor="middle" fill="${t.i}"${sm?` style="font-size:${Math.min(3.2,7.2/Math.max(2,[...lb].length)).toFixed(2)}px"`:''}>${esc(lb)}</text>`; // 同一片上下兩點只標一次；端子號依長度縮小字體，避免和隔壁重疊
    }
    // 短路片：以每片上下接點的中點連成一條，旋轉後也對得上
    (d.jumpers||[]).forEach(j=>{
      // 上排、下排插槽：從中點沿上下接點的方向各偏 8%（2202-1401 約 4 mm）
      const off=j.row===2?.08:-.08;
      const mid=i=>{const a=t.terms.find(q=>q.id===i+'A'),c=t.terms.find(q=>q.id===i+'C');return a&&c?{x:d.x+(a.x+c.x)/2+(c.x-a.x)*off,y:d.y+(a.y+c.y)/2+(c.y-a.y)*off}:null;};
      const p0=mid(j.at),p1=mid(Math.min(j.at+j.p-1,d.count||t.cnt||0));if(!p0||!p1)return;
      const jh=`<g class="jumper"><line x1="${p0.x}" y1="${p0.y}" x2="${p1.x}" y2="${p1.y}"/><text x="${(p0.x+p1.x)/2}" y="${(p0.y+p1.y)/2+1.2}" text-anchor="middle">${j.p}P</text></g>`;
      h=h.slice(0,bodyEnd)+jh+h.slice(bodyEnd);
    });
    h+='</g>';
  }
  const by=boxBottom();
  for(const g of S.glands){
    const P=glandPt(g),lx=P.side==='left'?P.x-10:P.x+10,ly=P.side==='bottom'?P.y+13:P.side==='top'?P.y-8:P.y+15,an=P.side==='left'?' text-anchor="end"':'';
    h+=`<g class="glandg" data-gland="${g.id}"><circle class="gland" cx="${P.x}" cy="${P.y}" r="7"/><text class="gland-t" x="${lx}" y="${ly}"${an}>${esc(g.id)} ${esc(g.spec.split(' ')[0])}</text></g>`;
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
/* 線號位置：w.lab 是拖曳過的位置（離起點的路徑比例 0～1）；w.labAt 是選單選的固定位置
   start 起點端（預設）、end 終點端、mid 中間、both 兩端都標 */
const labPath=(w,r)=>r.tails?r.tails[0]:r.pts;
const pathLen=p=>{let L=0;for(let i=1;i<p.length;i++)L+=Math.abs(p[i].x-p[i-1].x)+Math.abs(p[i].y-p[i-1].y);return L;};
function pointAt(p,s){ // 沿折線走 s mm 的位置與該段方向
  for(let i=1;i<p.length;i++){const a=p[i-1],b=p[i],L=Math.abs(b.x-a.x)+Math.abs(b.y-a.y);
    if(s<=L||i===p.length-1){const t=L?Math.min(1,Math.max(0,s/L)):0;return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,v:Math.abs(a.x-b.x)<.01&&Math.abs(a.y-b.y)>.01};}
    s-=L;}
  return p[0]?{x:p[0].x,y:p[0].y,v:false}:null;
}
function labelSpots(w,r){
  const p=labPath(w,r);if(!p||p.length<2) return [];
  const L=pathLen(p),end=Math.min(13,L/2);
  if(w.lab!=null) return [pointAt(p,w.lab*L)];
  const at=w.labAt||'start',out=[];
  if(at==='start'||at==='both') out.push(pointAt(p,end));
  if(at==='end'||at==='both'){const q=r.tails?r.tails[1]:p,ql=pathLen(q);out.push(pointAt(q,ql-Math.min(13,ql/2)));}
  if(at==='mid') out.push(pointAt(p,L/2));
  return out.filter(Boolean);
}
// 把滑鼠位置投影到線上，回傳路徑比例
function labFrac(w,r,m){
  const p=labPath(w,r),L=pathLen(p);if(!L) return 0;let best=1e9,bs=0,acc=0;
  for(let i=1;i<p.length;i++){const a=p[i-1],b=p[i],l=Math.abs(b.x-a.x)+Math.abs(b.y-a.y);
    const t=l?Math.max(0,Math.min(1,((m.x-a.x)*(b.x-a.x)+(m.y-a.y)*(b.y-a.y))/(((b.x-a.x)**2+(b.y-a.y)**2)||1))):0;
    const q={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},d=Math.hypot(q.x-m.x,q.y-m.y);if(d<best){best=d;bs=acc+t*l;}acc+=l;}
  return Math.round(bs/L*1000)/1000;
}
function renderWires(){
  let h='',boH='';const cableLabel=new Map();
  // 電纜外被畫在芯線下面；剝線點畫成小方塊，可以拖曳
  (S.cables||[]).forEach(c=>{
    const r=CABROUTES.get(c.id);if(!r) return;
    const d=pathD(r.pts),sw=cabStroke(c),ext=coresOf(c).some(w=>wireKind(w)==='ext');
    let m=null,ml=-1;for(let i=1;i<r.pts.length;i++){const a=r.pts[i-1],b=r.pts[i],L=Math.abs(a.x-b.x)+Math.abs(a.y-b.y);if(L>ml){ml=L;m={a,b};}}
    h+=`<g class="cab${selCab===c.id?' on':''}" data-cab="${c.id}"><path class="cab-o" d="${d}" stroke-width="${sw+1.2}"/><path class="cab-v${ext?' ext':''}" d="${d}" stroke-width="${sw}"/><path class="hit" d="${d}"/>`;
    if(m&&ml>20){const v=Math.abs(m.a.x-m.b.x)<.01,tx=(m.a.x+m.b.x)/2,ty=(m.a.y+m.b.y)/2;h+=`<text class="cab-t" x="${tx}" y="${ty}" text-anchor="middle" dominant-baseline="central"${v?` transform="rotate(-90 ${tx} ${ty})"`:''}>${esc(c.no)}</text>`;}
    // 剝線點放在最上層，才不會被芯線擋住拖不到
    ['a','b'].forEach(k=>{const p=r[k];boH+=`<rect class="bo${p.auto?'':' set'}" data-bo="${c.id}|${k}" data-on="${selCab===c.id?1:0}" x="${p.x-2.2}" y="${p.y-2.2}" width="4.4" height="4.4" rx=".8"><title>${esc(c.no)} ${k==='a'?'A':'B'} 端剝線點${p.auto?'（自動）':''}，可拖曳</title></rect>`;});
    h+='</g>';
  });
  for(const w of S.wires){
    const r=ROUTES.get(w.id); if(!r) continue;
    // 電纜芯線只畫剝線點到接點那兩段
    const segs=r.tails||[r.pts],vis=r.tails?{...r}:r;
    h+=`<g class="wire${r.cab?' core':''}" data-wid="${w.id}">${segs.map(p=>wireInner(w,{...vis,pts:p})).join('')}${segs.map(p=>`<path class="hit" d="${pathD(p)}"/>`).join('')}`;
    labelSpots(w,r).forEach(p=>{h+=`<text class="wn" data-lab="${w.id}" x="${p.x}" y="${p.y}" text-anchor="middle" dominant-baseline="central"${p.v?` transform="rotate(-90 ${p.x} ${p.y})"`:''}>${esc(w.no)}</text>`;});
    h+='</g>';
    if(wireKind(w)==='ext'&&w.ext&&w.ext.cable){
      const fd=devOf(w.a.d).sheet==='field'?w.a.d:w.b.d;
      const k=w.ext.cable+'|'+fd;
      if(!cableLabel.has(k)){const d=devOf(fd);cableLabel.set(k,{x:d.x+tplOf(d).w/2,y:d.y+tplOf(d).h+11,t:`${w.ext.cable} → ${d.tag}`});}
    }
  }
  $('wires').innerHTML=h+`<g class="bos">${boH}</g>`;
  $('wires').dataset.k=''; // 重畫過，樣式要重新套
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
  if(flashR) t+=`<rect class="flash-r" x="${flashR.x-4}" y="${flashR.y-4}" width="${flashR.w+8}" height="${flashR.h+8}" rx="4"/>`;
  const rh=railHit&&devOf(railHit);
  if(rh){const rt=tplOf(rh);t+=`<rect class="rail-hit" x="${rh.x-1}" y="${rh.y-1}" width="${rt.w+2}" height="${rt.h+2}" rx="2"/>`;}
  multi.forEach(s=>{const b=selBox(s);if(b)t+=`<rect class="picked" x="${b.x-2}" y="${b.y-2}" width="${b.w+4}" height="${b.h+4}" rx="3"/>`;});
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
  if(picked.k==='gland'){const g=S.glands.find(x=>x.id===picked.id);if(!g)return null;const P=glandPt(g);return {x:P.x-8,y:P.y-8,w:16,h:16};}
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
  // 滑鼠只是經過（沒有點選）：不改任何導線的樣式，只在最上層畫一條高亮線。
  // 改所有導線的透明度、搬動元素會讓整張圖重畫，畫面放大時重畫量很大，容易閃黑。
  const focus=listHover||sel,g=$('wires');
  const key=focus+'|'+JSON.stringify(filt);
  if(g.dataset.k===key){renderOverlay();return;}
  g.dataset.k=key;
  g.classList.toggle('focus',!!focus);
  // 點選或在清單上停留時，兩端接點上的並線一起淡淡亮起
  const fw=(listHover||sel)&&S.wires.find(x=>x.id===(listHover||sel)),rel=new Set();
  if(fw){const pr=parallelOf(fw);[...pr.a,...pr.b].forEach(x=>rel.add(x.id));}
  g.querySelectorAll('.wire').forEach(el=>{
    const id=el.dataset.wid,w=S.wires.find(x=>x.id===id);
    el.classList.toggle('on',id===focus);
    el.classList.toggle('rel',rel.has(id)&&id!==focus);
    el.classList.toggle('off',w?!passes(w):false);
  });
  const f=focus&&g.querySelector(`.wire[data-wid="${focus}"]`);
  const bos=g.querySelector('.bos');
  if(f&&f.nextElementSibling!==bos) g.insertBefore(f,bos);
  renderOverlay();
}
function renderOverlay(){
  const k=view.k,inv=`scale(${1/k})`;let h='';
  const focus=listHover||hoverW||sel;
  if(hoverW&&hoverW!==sel&&hoverW!==listHover){const r=ROUTES.get(hoverW);if(r)(r.tails||[r.pts]).forEach(p=>h+=`<path class="hov" d="${pathD(p)}"/>`);}
  if(focus){
    const w=S.wires.find(x=>x.id===focus),r=ROUTES.get(focus);
    if(w&&r){
      const ends=[[r.pts[0],w.a],[r.pts[r.pts.length-1],w.b]];
      for(const [p,e] of ends){
        const t=epText(e),tw=[...t].reduce((s,c)=>s+(c.charCodeAt(0)>255?14:8),0)+14;
        h+=`<g transform="translate(${p.x} ${p.y}) ${inv}"><circle class="end-ring" r="8"/><rect class="pill-bg" x="10" y="-11" width="${tw}" height="22" rx="4"/><text class="pill-t" x="17" y="5">${esc(t)}</text></g>`;
      }
      w.wps.forEach(p=>h+=`<circle class="wp" cx="${p.x}" cy="${p.y}" r="${(focus===sel?6:3.5)/k}"/>`);
    }
  }
  if(draft){
    const a=draft.a,wps=draft.wps;
    const end=draft.end?endpoint(draft.end,0):snap?{x:snap.x,y:snap.y,side:snap.side,dev:snap.d,sheet:devOf(snap.d).sheet}:wpAnchor(cursor);
    const pts=previewPts(a,wps,end,draft.pop&&last.direct);
    if(draft.pop){const col=keyColor(last.color);h+=`<path d="${pathD(pts)}" fill="none" stroke="${col.k}" stroke-width="${gw(last.gauge)+.9}"/><path d="${pathD(pts)}" fill="none" stroke="${col.c}" stroke-width="${gw(last.gauge)}"/>`;}
    else h+=`<path class="draft" d="${pathD(pts)}"/>`;
    wps.forEach(p=>h+=`<circle class="wp" cx="${p.x}" cy="${p.y}" r="${4/k}"/>`);
    const s=endpoint(a,0);h+=`<g transform="translate(${s.x} ${s.y}) ${inv}"><circle class="end-ring" r="8"/></g>`;
  }
  if(snap&&mode==='wire'&&!(draft&&draft.pop)){
    const n=countAt(snap.d,snap.t);
    const t=`${snap.tag}·${termLabel(devOf(snap.d),snap.t)}`+(snap.desc?` ${snap.desc}`:'')+(n?` 已接 ${n}`:'');
    const tw=[...t].reduce((s,c)=>s+(c.charCodeAt(0)>255?14:8),0)+16;
    const flip=snap.x*k+view.x+tw+30>$('svg').clientWidth;
    const dx=(cursor.x-snap.x)*k,dy=(cursor.y-snap.y)*k;
    h+=`<g transform="translate(${snap.x} ${snap.y}) ${inv}"><line class="snap-teth" x1="0" y1="0" x2="${dx}" y2="${dy}"/><circle class="snap-ring" r="13"/><circle class="snap-dot" r="4.5"/>`+
       `<rect class="pill-bg" x="${flip?-18-tw:18}" y="-13" width="${tw}" height="26" rx="4"/><text class="pill-t" x="${flip?-10-tw:26}" y="5">${esc(t)}</text></g>`;
  }
  if(boxSel){const x=Math.min(boxSel.x0,boxSel.x1),y=Math.min(boxSel.y0,boxSel.y1);h+=`<rect class="boxsel" x="${x}" y="${y}" width="${Math.abs(boxSel.x1-boxSel.x0)}" height="${Math.abs(boxSel.y1-boxSel.y0)}"/>`;}
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
/* 新增或貼上物件後：不在畫面內就平移過去（不改縮放），並閃一下外框 */
const boxRect=()=>{const o=boxOrigin();return {x:o.x,y:o.y,w:S.box.w,h:S.box.h};};
function viewCenter(){const r=$('svg').getBoundingClientRect();return {x:(r.width/2-view.x)/view.k,y:((r.height-44)/2-view.y)/view.k};}
let flashR=null,flashT=0;
function reveal(R){
  if(!R) return;
  const r=$('svg').getBoundingClientRect(),k=view.k,m=24;
  const x0=R.x*k+view.x,y0=R.y*k+view.y,x1=(R.x+R.w)*k+view.x,y1=(R.y+R.h)*k+view.y;
  if(x0<m||y0<m||x1>r.width-m||y1>r.height-44-m){
    view.x=r.width/2-(R.x+R.w/2)*k;view.y=(r.height-44)/2-(R.y+R.h/2)*k;view.manual=true;applyView();
  }
  flashR=R;clearTimeout(flashT);renderWires();
  flashT=setTimeout(()=>{flashR=null;renderWires();},1300);
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
  const m=S.doorMode||'door';
  $('setSum').innerHTML=[`箱 ${S.box.w}×${S.box.h}×${S.box.d}`,`底板 ${S.plate.w}×${S.plate.h}`,m==='none'?'不使用面板':`${m==='console'?'操作台':'門板'} ${S.door.w}×${S.door.h}`].map(t=>`<span>${esc(t)}</span>`).join('');
  $('warnMixed').checked=!!S.warnMixedNo;
  set('bw',S.box.w);set('bh',S.box.h);set('bd',S.box.d);set('bk',S.box.back);set('pw',S.plate.w);set('ph',S.plate.h);set('dw',S.door.w);set('dh',S.door.h);set('hy',S.hinge);set('fl',S.fillLimit);
}
let toastT=0;
function toast(s){const t=$('toast');t.textContent=s;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,3200);}


"use strict";
/* ---------- 多選（擺放模式） ----------
   multi 存兩個以上的選取 {k,id}；只選一個時照舊用 picked。
   可選器具、線槽、出線口。鋁軌上的器具與正面附件會跟著主體移動、複製。 */
const objOf=s=>s.k==='dev'?devOf(s.id):s.k==='duct'?S.ducts.find(d=>d.id===s.id):s.k==='gland'?S.glands.find(g=>g.id===s.id):null;
const inMulti=(k,id)=>multi.some(s=>s.k===k&&s.id===id);
let boxSel=null; // 框選中的範圍 {x0,y0,x1,y1}
function selBox(s){
  const o=objOf(s);if(!o) return null;
  if(s.k==='dev'){const t=tplOf(o);return {x:o.x,y:o.y,w:t.w,h:t.h};}
  if(s.k==='gland'){const P=glandPt(o);return {x:P.x-8,y:P.y-8,w:16,h:16};}
  return {x:o.x,y:o.y,w:o.w,h:o.h};
}
function setMulti(list){
  const seen=new Set();list=list.filter(s=>{const k=s.k+'|'+s.id;if(seen.has(k)||!objOf(s))return false;seen.add(k);return true;});
  if(list.length>1){multi=list;picked=null;}else{multi=[];picked=list[0]||null;}
  sel=null;renderWires();renderDetail();updateHint();
}
function toggleSel(s){
  const cur=multi.length?multi.slice():picked&&picked.k!=='zone'?[picked]:[];
  const i=cur.findIndex(x=>x.k===s.k&&x.id===s.id);
  if(i>=0)cur.splice(i,1);else cur.push(s);
  setMulti(cur);
}
function selectAll(){setMulti([...S.devices.map(d=>({k:'dev',id:d.id})),...S.ducts.map(d=>({k:'duct',id:d.id})),...S.glands.map(g=>({k:'gland',id:g.id}))]);}
const curSel=()=>multi.length?multi:picked&&picked.k!=='zone'?[picked]:[];

/* 框選：Shift＋拖曳空白處 */
function startBox(e,p){act={t:'box',x0:p.x,y0:p.y,sx:e.clientX,sy:e.clientY,moved:false,id:e.pointerId,add:curSel().slice()};svg.setPointerCapture(e.pointerId);}
function moveBox(p){boxSel={x0:act.x0,y0:act.y0,x1:p.x,y1:p.y};renderOverlay();}
function endBox(a){
  const b=boxSel;boxSel=null;if(!b){renderOverlay();return;}
  const R={x:Math.min(b.x0,b.x1),y:Math.min(b.y0,b.y1),w:Math.abs(b.x1-b.x0),h:Math.abs(b.y1-b.y0)};
  const hit=r=>r.x<R.x+R.w&&r.x+r.w>R.x&&r.y<R.y+R.h&&r.y+r.h>R.y;
  const got=[...S.devices.map(d=>({k:'dev',id:d.id})),...S.ducts.map(d=>({k:'duct',id:d.id})),...S.glands.map(g=>({k:'gland',id:g.id}))].filter(s=>hit(selBox(s)));
  setMulti([...a.add,...got]);renderOverlay();
}

/* 移動：拖曳選取中的任一個、方向鍵、輸入距離 */
function moveSet(){ // 選取的物件加上要一起帶走的器具，不重複
  const devs=new Set(),list=[];
  multi.forEach(s=>{const o=objOf(s);if(!o)return;if(s.k==='dev'){[o,...carried(o)].forEach(d=>devs.add(d));}else list.push({k:s.k,o});});
  devs.forEach(d=>list.push({k:'dev',o:d}));
  return list;
}
function baseOf(items){return items.map(it=>it.k==='gland'?{...it,P:glandPt(it.o)}:{...it,x:it.o.x,y:it.o.y});}
function applyShift(base,dx,dy){
  base.forEach(it=>{
    if(it.k==='gland'){glandTo(it.o,{x:it.P.x+(it.P.ny?dx:0),y:it.P.y+(it.P.nx?dy:0)});return;}
    it.o.x=r1(it.x+dx);it.o.y=r1(it.y+dy);
    const R=rectOf(it.k,it.o);it.o.sheet=sheetAt({x:R.x+R.w/2,y:R.y+R.h/2});
    if(it.k==='duct'&&it.o.sheet==='field')it.o.sheet='plate';
  });
}
function startMultiDrag(e,p,copy){
  let copied=null;
  if(copy){copied=pasteMulti(makeClipMulti(),0,0);multi=copied.sel;}
  act={t:'multi',sx:e.clientX,sy:e.clientY,px:p.x,py:p.y,moved:false,id:e.pointerId,base:baseOf(moveSet()),copied};
  svg.setPointerCapture(e.pointerId);if(copy)recompute();renderWires();renderDetail();
}
function moveMulti(p){
  const dx=Math.round((p.x-act.px)/5)*5,dy=Math.round((p.y-act.py)/5)*5;
  applyShift(act.base,dx,dy);computeRoutes();renderBoard();renderWires();
}
function endMultiDrag(a){
  if(a.copied&&!a.moved){dropMulti(a.copied);multi=[];recompute();return;} // Ctrl＋點一下沒拖：不複製
  if(a.moved)commit();recompute();
}
function shiftSel(dx,dy){applyShift(baseOf(moveSet()),dx,dy);commit();recompute();}

/* 刪除、旋轉 */
function deleteMulti(){
  const ids=new Set(multi.filter(s=>s.k==='dev').map(s=>s.id));
  S.devices.forEach(d=>{if(d.on&&ids.has(d.on)&&!ids.has(d.id))delete d.on;});
  const n=multi.length;
  S.devices=S.devices.filter(d=>!ids.has(d.id));
  S.wires=S.wires.filter(w=>!ids.has(w.a.d)&&!ids.has(w.b.d));
  S.ducts=S.ducts.filter(d=>!inMulti('duct',d.id));
  S.glands=S.glands.filter(g=>!inMulti('gland',g.id));
  if(ids.has(filt.dev))filt.dev='';
  multi=[];commit();recompute();toast(`已刪除 ${n} 個物件；可按復原`);
}
function rotateDev(d){
  const a=tplOf(d),cx=d.x+a.w/2,cy=d.y+a.h/2;
  d.rot=((d.rot||0)+90)%360;if(!d.rot)delete d.rot;
  const b=tplOf(d);d.x=Math.round((cx-b.w/2)/5)*5;d.y=Math.round((cy-b.h/2)/5)*5;
  riders(d).forEach(r=>placeOn(r,d));
}
function rotateMulti(){
  const ds=multi.filter(s=>s.k==='dev').map(objOf).filter(d=>d&&!d.on&&!isRail(d));
  if(!ds.length){toast('選取中沒有可以旋轉的器具');return;}
  ds.forEach(rotateDev);commit();recompute();
}

/* 對齊與等距：器具、線槽與出線口，以選取範圍的外框為準；正面附件與鋁軌上的器具跟著主體。
   出線口以中心點計算，只沿著它所在的箱面移動（箱底、箱頂的出線口左右移，側面的上下移） */
function alignTargets(){
  const items=multi.filter(s=>s.k==='dev'||s.k==='duct'||s.k==='gland').map(s=>({k:s.k,o:objOf(s)})).filter(it=>it.o);
  const carriedSet=new Set();items.forEach(it=>{if(it.k==='dev')carried(it.o).forEach(d=>carriedSet.add(d));});
  return items.filter(it=>!carriedSet.has(it.o));
}
function moveItem(it,dx,dy){
  if(!dx&&!dy) return;
  if(it.k==='gland'){const P=glandPt(it.o),g=it.o;if(P.ny)g.x=r1(g.x+dx);else g.y=r1(g.y+dy);return;} // 不吸 5 mm 格點，等距才會剛好相等
  const extra=it.k==='dev'?carried(it.o):[];
  it.o.x=r1(it.o.x+dx);it.o.y=r1(it.o.y+dy);extra.forEach(d=>{d.x=r1(d.x+dx);d.y=r1(d.y+dy);});
}
function alignSel(op){
  const its=alignTargets();if(its.length<2){toast('至少要選兩個器具、線槽或出線口');return;}
  const R=it=>{if(it.k==='gland'){const P=glandPt(it.o);return {x:P.x,y:P.y,w:0,h:0};}return rectOf(it.k,it.o);};
  const x0=Math.min(...its.map(i=>R(i).x)),x1=Math.max(...its.map(i=>R(i).x+R(i).w)),y0=Math.min(...its.map(i=>R(i).y)),y1=Math.max(...its.map(i=>R(i).y+R(i).h));
  const dist=(axis)=>{
    const P=axis==='x'?'x':'y',L=axis==='x'?'w':'h';
    const s=its.slice().sort((a,b)=>(R(a)[P]+R(a)[L]/2)-(R(b)[P]+R(b)[L]/2));
    if(s.length<3){toast('等距排列至少要選三個');return false;}
    const total=s.reduce((t,i)=>t+R(i)[L],0),span=(axis==='x'?x1-x0:y1-y0),gap=(span-total)/(s.length-1);
    let at=axis==='x'?x0:y0;
    s.forEach(i=>{const r=R(i),d=at-r[P];moveItem(i,axis==='x'?d:0,axis==='x'?0:d);at+=r[L]+gap;});
    return true;
  };
  if(op==='dh'||op==='dv'){if(!dist(op==='dh'?'x':'y'))return;}
  else its.forEach(i=>{const r=R(i);
    const dx=op==='l'?x0-r.x:op==='r'?x1-r.x-r.w:op==='hc'?(x0+x1)/2-(r.x+r.w/2):0;
    const dy=op==='t'?y0-r.y:op==='b'?y1-r.y-r.h:op==='vc'?(y0+y1)/2-(r.y+r.h/2):0;
    moveItem(i,dx,dy);});
  commit();recompute();
}

/* 複製：兩端都在選取範圍內的線一起複製，配新線號；電纜編號也換新 */
function makeClipMulti(){
  const devs=new Set();multi.forEach(s=>{const o=objOf(s);if(s.k==='dev'&&o)[o,...carried(o)].forEach(d=>devs.add(d));});
  const ids=new Set([...devs].map(d=>d.id));
  return {k:'multi',n:0,devs:snapCopy([...devs]),ducts:snapCopy(multi.filter(s=>s.k==='duct').map(objOf).filter(Boolean)),glands:snapCopy(multi.filter(s=>s.k==='gland').map(objOf).filter(Boolean)),
    wires:snapCopy(S.wires.filter(w=>ids.has(w.a.d)&&ids.has(w.b.d))),top:multi.filter(s=>s.k==='dev').map(s=>s.id)};
}
function pasteMulti(c,dx,dy){
  const idm={},gm={},cm={},made={devs:[],ducts:[],glands:[],wires:[]};
  c.devs.forEach(e=>{const d=snapCopy(e);d.x=r1(d.x+dx);d.y=r1(d.y+dy);d.id=d.tag=newDevId(d);idm[e.id]=d.id;S.devices.push(d);made.devs.push(d);});
  made.devs.forEach(d=>{if(d.on){if(idm[d.on])d.on=idm[d.on];else delete d.on;}});
  c.ducts.forEach(e=>{const d=snapCopy(e);d.x=r1(d.x+dx);d.y=r1(d.y+dy);d.id=nextId('D',id=>S.ducts.some(x=>x.id===id));S.ducts.push(d);made.ducts.push(d);});
  c.glands.forEach(e=>{const g=snapCopy(e),P=glandPt(g);glandTo(g,{x:P.x+(P.ny?dx:0),y:P.y+(P.nx?dy:0)});g.id=nextId('G',id=>S.glands.some(x=>x.id===id));gm[e.id]=g.id;S.glands.push(g);made.glands.push(g);});
  const nm={}; // 線號對照：原本同號的線，複製後仍然同號，但換成新號碼
  c.wires.forEach(e=>{
    const w=snapCopy(e);
    if(!nm[e.no]){const n=nextWireNo();nm[e.no]='W'+String(n).padStart(3,'0');S.nextNo=n+1;}
    w.id='w'+Date.now().toString(36)+'_'+made.wires.length+'_'+Math.random().toString(36).slice(2,6);w.no=nm[e.no];
    w.a.d=idm[e.a.d];w.b.d=idm[e.b.d];w.wps=(w.wps||[]).map(p=>({x:p.x+dx,y:p.y+dy}));
    if(w.gland)w.gland=gm[w.gland]||w.gland;
    // 電纜芯線：複製成新的電纜（同一條電纜的芯線還是在同一條新電纜裡），剝線點改回自動
    if(w.cab){const o=cabOf(w.cab);if(o){if(!cm[o.id]){const n=newCable('',o.spec);n.cores=snapCopy(o.cores);n.fieldLen=o.fieldLen;if(o.direct)n.direct=true;if(o.wps)n.wps=o.wps.map(q=>({x:q.x+dx,y:q.y+dy}));cm[o.id]=n.id;made.cables=(made.cables||[]).concat(n);}w.cab=cm[o.id];}else delete w.cab;delete w.ext;}
    else if(w.ext&&w.ext.cable){if(!cm[e.ext.cable])cm[e.ext.cable]=nextCable();w.ext.cable=cm[e.ext.cable];}
    S.wires.push(w);made.wires.push(w);
  });
  made.sel=[...c.top.map(id=>({k:'dev',id:idm[id]})),...made.ducts.map(d=>({k:'duct',id:d.id})),...made.glands.map(g=>({k:'gland',id:g.id}))];
  return made;
}
function dropMulti(m){
  const dv=new Set(m.devs),du=new Set(m.ducts),gl=new Set(m.glands),wi=new Set(m.wires);
  S.devices=S.devices.filter(d=>!dv.has(d));S.ducts=S.ducts.filter(d=>!du.has(d));S.glands=S.glands.filter(g=>!gl.has(g));S.wires=S.wires.filter(w=>!wi.has(w));if(m.cables){const cs=new Set(m.cables);S.cables=S.cables.filter(c=>!cs.has(c));}
}
function pasteHereMulti(){
  const c=clip;let dx,dy;
  const rs=[...c.devs.map(d=>({x:d.x,y:d.y,w:tplOf(d).w,h:tplOf(d).h})),...c.ducts];
  if(cursorIn&&rs.length){
    const x0=Math.min(...rs.map(r=>r.x)),x1=Math.max(...rs.map(r=>r.x+r.w)),y0=Math.min(...rs.map(r=>r.y)),y1=Math.max(...rs.map(r=>r.y+r.h));
    dx=Math.round((cursor.x-(x0+x1)/2)/5)*5;dy=Math.round((cursor.y-(y0+y1)/2)/5)*5;
  }else{c.n++;dx=dy=20*c.n;}
  const m=pasteMulti(c,dx,dy);
  if(mode!=='place')setMode('place');
  multi=m.sel.length>1?m.sel:[];picked=m.sel.length===1?m.sel[0]:null;sel=null;
  commit();recompute();
  const xs=m.sel.map(selBox).filter(Boolean);
  if(xs.length){const x0=Math.min(...xs.map(r=>r.x)),y0=Math.min(...xs.map(r=>r.y)),x1=Math.max(...xs.map(r=>r.x+r.w)),y1=Math.max(...xs.map(r=>r.y+r.h));reveal({x:x0,y:y0,w:x1-x0,h:y1-y0});}
  toast(`已貼上 ${m.sel.length} 個物件${m.wires.length?`、${m.wires.length} 條線`:''}；可按復原`);
}

/* 右側面板 */
function multiDetail(box){
  const by=k=>multi.filter(s=>s.k===k).map(s=>{const o=objOf(s);return o?esc(s.k==='dev'?o.tag:o.id):'';}).join(' ');
  const nd=multi.filter(s=>s.k==='dev').length,nu=multi.filter(s=>s.k==='duct').length,ng=multi.filter(s=>s.k==='gland').length;
  const btn=(op,t,l)=>`<button class="tool" data-al="${op}" title="${l}">${t}</button>`;
  box.hidden=false;
  box.innerHTML=`<div class="big">已選 ${multi.length} 個 ${hq('multi')}</div>${hn('multi','Shift＋點可加入或移出選取；拖曳其中任一個可一起移動，Ctrl＋拖曳一起複製。兩端都在選取範圍內的線會一起複製。')}<dl>${nd?`<dt>器具</dt><dd>${by('dev')}</dd>`:''}${nu?`<dt>線槽</dt><dd>${by('duct')}</dd>`:''}${ng?`<dt>出線口</dt><dd>${by('gland')}</dd>`:''}</dl>
    <div><div class="sub-h">對齊（以選取範圍的外框為準）</div><div class="row aligns" style="justify-content:flex-start">${btn('l','靠左','左緣對齊')}${btn('hc','水平置中','中心線對齊到左右正中')}${btn('r','靠右','右緣對齊')}${btn('t','靠上','上緣對齊')}${btn('vc','垂直置中','中心線對齊到上下正中')}${btn('b','靠下','下緣對齊')}</div></div>
    <div><div class="sub-h">等距排列（至少三個）</div><div class="row" style="justify-content:flex-start">${btn('dh','水平等距','左右間隔相等')}${btn('dv','垂直等距','上下間隔相等')}</div></div>
    ${moveHtml(false)}
    <div class="row"><button class="tool" id="mRot">各自旋轉 90°</button><button class="tool" id="mCopy">複製一份</button><button class="tool danger" id="mDel">刪除 ${multi.length} 個</button></div>
`;
}
$('detail').addEventListener('click',e=>{
  if(!multi.length) return;
  const b=e.target.closest('button');if(!b) return;
  if(b.dataset.al){alignSel(b.dataset.al);return;}
  if(b.id==='mRot'){rotateMulti();return;}
  if(b.id==='mDel'){deleteMulti();return;}
  if(b.id==='mCopy'){clip=makeClipMulti();const was=cursorIn;cursorIn=false;pasteHereMulti();cursorIn=was;return;}
});

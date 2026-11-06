"use strict";
/* ---------- 互動 ---------- */
const svg=$('svg');
function toWorld(ev){
  const r=svg.getBoundingClientRect(),sx=ev.clientX-r.left,sy=ev.clientY-r.top;
  return {sx,sy,x:(sx-view.x)/view.k,y:(sy-view.y)/view.k};
}
function findSnap(wp,alt){
  if(alt) return null;
  const R=16/view.k;let best=null,bd=R*R;
  for(const d of S.devices){
    const t=tplOf(d);
    if(wp.x<d.x-R||wp.x>d.x+t.w+R||wp.y<d.y-R||wp.y>d.y+t.h+R) continue;
    for(const p of t.terms){
      const x=d.x+p.x,y=d.y+p.y,q=(x-wp.x)**2+(y-wp.y)**2;
      if(q<bd){bd=q;best={d:d.id,t:p.id,x,y,side:p.side,desc:p.desc,tag:d.tag};}
    }
  }
  return best;
}
function showTip(id,sx,sy){
  const tip=$('tip');
  if(!id){tip.hidden=true;return;}
  const w=S.wires.find(x=>x.id===id),r=ROUTES.get(id);if(!w||!r){tip.hidden=true;return;}
  const c=colorOf(w),kind=wireKind(w);
  tip.innerHTML=`<b>${w.no}</b>　${esc(c.n)}　${w.gauge} mm²　${KINDS[kind]}<br>${esc(epText(w.a))} → ${esc(epText(w.b))}<br>${r.via.length?'經 '+esc(r.via.join(' → ')):'直接跨接'}${r.gland?' → '+esc(r.gland):''}　${(r.len/1000).toFixed(2)} m`+(w.ext&&w.ext.cable?`<br>電纜 ${esc(w.ext.cable)}　芯 ${esc(w.ext.core)}`:'')+(r.warn?`<br><span class="flag">${esc(r.warn)}</span>`:'');
  tip.hidden=false;
  const st=$('stage').getBoundingClientRect();
  const tw=tip.offsetWidth,th=tip.offsetHeight;
  let x=sx+14,y=sy+14;if(x+tw>st.width-6)x=sx-tw-14;if(y+th>st.height-6)y=sy-th-14;
  tip.style.left=Math.max(6,x)+'px';tip.style.top=Math.max(6,y)+'px';
}
function hoverUpdate(e){
  const p=toWorld(e);cursor=p;
  if(mode==='view'){ // 檢視：只顯示導線提示
    const g=e.target.closest&&e.target.closest('.wire'),hw=g?g.dataset.wid:null;
    if(hw!==hoverW){hoverW=hw;applyWireClasses();}showTip(hw,p.sx,p.sy);return;
  }
  if(mode!=='wire'||(draft&&draft.pop)){if(snap){snap=null;renderOverlay();}return;}
  const s=findSnap(p,e.altKey);
  const was=snap;snap=s;
  let hw=null;
  if(!s&&!draft){const g=e.target.closest&&e.target.closest('.wire');hw=g?g.dataset.wid:null;}
  if(hw!==hoverW){hoverW=hw;applyWireClasses();}
  else if(s||was||draft) renderOverlay();
  showTip(hw,p.sx,p.sy);
}
let act=null;
svg.addEventListener('pointerdown',e=>{
  const p=toWorld(e);cursor=p;
  if(mode==='wire'&&e.pointerType!=='mouse') hoverUpdate(e);
  if(mode==='place'&&e.button===0){
    const dg=e.target.closest('[data-dev]'),cg=e.target.closest('[data-duct]'),gg=e.target.closest('[data-gland]'),zg=!dg&&!cg&&!gg&&e.target.closest('.zone-h,.zoneg .field-t')&&e.target.closest('[data-zone]');
    // 多選：Shift＋點加入或移出、Shift＋拖曳空白處框選；拖曳選取中的任一個一起移動
    const hitK=gg?'gland':dg?'dev':cg?'duct':null,hitId=gg?gg.dataset.gland:dg?dg.dataset.dev:cg?cg.dataset.duct:null;
    if(e.shiftKey){if(hitK){toggleSel({k:hitK,id:hitId});return;}if(!zg){startBox(e,p);return;}}
    if(hitK&&multi.length>1&&inMulti(hitK,hitId)){startMultiDrag(e,p,e.ctrlKey||e.metaKey);return;}
    if(multi.length){multi=[];}
    // Ctrl（Mac 用 Cmd）＋拖曳：原物件留在原地，拖著走的是複本
    if((e.ctrlKey||e.metaKey)&&(dg||cg||gg||zg)){
      const k=zg?'zone':gg?'gland':dg?'dev':'duct';
      const src=zg?S.fields.find(z=>z.id===zg.dataset.zone):gg?S.glands.find(x=>x.id===gg.dataset.gland):dg?devOf(dg.dataset.dev):S.ducts.find(d=>d.id===cg.dataset.duct);
      const r=pasteClip(makeClip(k,src),0,0),obj=r.main;
      picked={k,id:obj.id};sel=null;
      act={t:k==='zone'?'zone':k==='gland'?'gland':'drag',obj,ox:p.x-obj.x,oy:p.y-obj.y,sx:e.clientX,sy:e.clientY,moved:false,id:e.pointerId,copy:r,src:{k,id:src.id}};
      if(k==='zone'||r.extras.length) act.mounted=r.extras.map(d=>({d,dx:d.x-obj.x,dy:d.y-obj.y}));
      computeRoutes();renderBoard();
      svg.setPointerCapture(e.pointerId);renderWires();renderDetail();updateHint();return;
    }
    if(zg){
      const obj=S.fields.find(z=>z.id===zg.dataset.zone);
      picked={k:'zone',id:obj.id};sel=null;
      act={t:'zone',obj,ox:p.x-obj.x,oy:p.y-obj.y,sx:e.clientX,sy:e.clientY,moved:false,id:e.pointerId,mounted:S.devices.filter(d=>inZone(obj,d)).map(d=>({d,dx:d.x-obj.x,dy:d.y-obj.y}))};
      svg.setPointerCapture(e.pointerId);renderWires();renderDetail();updateHint();return;
    }
    if(gg){
      const obj=S.glands.find(x=>x.id===gg.dataset.gland);
      picked={k:'gland',id:obj.id};sel=null;
      act={t:'gland',obj,ox:p.x-obj.x,sx:e.clientX,sy:e.clientY,moved:false,id:e.pointerId};
      svg.setPointerCapture(e.pointerId);renderWires();renderDetail();updateHint();return;
    }
    if(dg||cg){
      const obj=dg?devOf(dg.dataset.dev):S.ducts.find(d=>d.id===cg.dataset.duct);
      picked={k:dg?'dev':'duct',id:obj.id};sel=null;
      act={t:'drag',obj,ox:p.x-obj.x,oy:p.y-obj.y,sx:e.clientX,sy:e.clientY,moved:false,id:e.pointerId};
      if(dg){const c=carried(obj);if(c.length) act.mounted=c.map(d=>({d,dx:d.x-obj.x,dy:d.y-obj.y}));}
      svg.setPointerCapture(e.pointerId);renderWires();renderDetail();updateHint();return;
    }
  }
  if(mode==='wire'&&!draft&&sel&&e.button===0){
    const w=S.wires.find(x=>x.id===sel);
    const wp=w&&w.wps.find(q=>Math.hypot((q.x-p.x)*view.k,(q.y-p.y)*view.k)<=10);
    if(wp){snap=null;hoverW=null;$('tip').hidden=true;act={t:'wp',wp,sx:e.clientX,sy:e.clientY,moved:false,id:e.pointerId};renderOverlay();return;}
  }
  act={t:'press',sx:e.clientX,sy:e.clientY,vx:view.x,vy:view.y,moved:false,btn:e.button,alt:e.altKey,id:e.pointerId,target:e.target};
});
svg.addEventListener('pointermove',e=>{
  if(!act){hoverUpdate(e);return;}
  const dx=e.clientX-act.sx,dy=e.clientY-act.sy;
  if(!act.moved&&Math.hypot(dx,dy)<4) return;
  if(!act.moved){act.moved=true;try{svg.setPointerCapture(act.id);}catch(_){}$('tip').hidden=true;}
  if(act.t==='box'){moveBox(toWorld(e));return;}
  if(act.t==='multi'){moveMulti(toWorld(e));return;}
  if(act.t==='drag'){
    const p=toWorld(e),o=act.obj;
    o.x=Math.round((p.x-act.ox)/5)*5;o.y=Math.round((p.y-act.oy)/5)*5;
    const r=picked.k==='dev'?rectOf('dev',o):rectOf('duct',o);
    o.sheet=sheetAt({x:r.x+r.w/2,y:r.y+r.h/2});
    if(picked.k==='duct'&&o.sheet==='field') o.sheet='plate';
    railHit=null;
    if(picked.k==='dev'&&!isRail(o)){
      if(attachOf(o)){if(e.altKey)delete o.on;else railHit=hostSnap(o,p.x-act.ox,p.y-act.oy);if(!o.on&&o.tpl==='mrbat6v1-f')o.tpl=BAT_BASE;}
      else if(!e.altKey) railHit=railSnap(o,p.x-act.ox,p.y-act.oy);
    }
    if(act.mounted) act.mounted.forEach(m=>{m.d.x=r1(o.x+m.dx);m.d.y=r1(o.y+m.dy);m.d.sheet=o.sheet;});
    computeRoutes();renderBoard();renderWires();
  }else if(act.t==='zone'){
    const p=toWorld(e),z=act.obj;
    z.x=Math.round((p.x-act.ox)/10)*10;z.y=Math.round((p.y-act.oy)/10)*10;
    act.mounted.forEach(m=>{m.d.x=r1(z.x+m.dx);m.d.y=r1(z.y+m.dy);});
    computeRoutes();renderBoard();renderWires();
  }else if(act.t==='gland'){
    glandTo(act.obj,toWorld(e)); // 吸到最近的箱面
    computeRoutes();renderBoard();renderWires();
  }else if(act.t==='wp'){
    const p=toWorld(e);act.wp.x=Math.round(p.x/5)*5;act.wp.y=Math.round(p.y/5)*5;
    computeRoutes();renderWires();
  }else{
    view.x=act.vx+dx;view.y=act.vy+dy;view.manual=true;applyView();
  }
});
svg.addEventListener('pointerup',e=>{
  const a=act;act=null;
  if(!a) return;
  if(railHit){railHit=null;renderWires();}
  if(a.t==='box'){endBox(a);return;}
  if(a.t==='multi'){endMultiDrag(a);return;}
  if(a.copy&&!a.moved){dropClip(a.copy);picked=a.src;recompute();return;} // Ctrl＋點一下沒拖：不複製
  if(a.t==='wp'&&!a.moved&&noteTap(e)&&tryDouble(toWorld(e))) return;
  if(a.t==='drag'||a.t==='wp'||a.t==='gland'||a.t==='zone'){ if(a.moved){commit();} recompute(); return; }
  if(a.moved||a.btn!==0) return;
  if(mode==='wire') clickWire(e,a); else if(mode==='view') viewClick(a); else {picked=null;multi=[];sel=null;renderWires();renderDetail();updateHint();}
});
svg.addEventListener('pointercancel',()=>{act=null;});
svg.addEventListener('pointerenter',()=>{cursorIn=true;});
svg.addEventListener('pointerleave',()=>{cursorIn=false;});
svg.addEventListener('pointerleave',()=>{if(!act&&(snap||hoverW)){snap=null;hoverW=null;$('tip').hidden=true;applyWireClasses();}});
// 檢視模式點一下：選線或看器具，不做任何修改
function viewClick(a){
  const t=a.target&&a.target.closest?a.target:null,g=t&&t.closest('.wire'),dg=!g&&t&&t.closest('[data-dev]'),cg=!g&&!dg&&t&&t.closest('[data-duct]'),gg=!g&&!dg&&!cg&&t&&t.closest('[data-gland]');
  sel=g?g.dataset.wid:null;picked=dg?{k:'dev',id:dg.dataset.dev}:cg?{k:'duct',id:cg.dataset.duct}:gg?{k:'gland',id:gg.dataset.gland}:null;
  renderList();renderWires();renderDetail();updateHint();
}
function clickWire(e,a){
  const p=toWorld(e);cursor=p;
  const s=findSnap(p,e.altKey);
  if(draft){
    if(draft.pop) return;
    if(s){
      if(s.d===draft.a.d&&s.t===draft.a.t) return;
      draft.end={d:s.d,t:s.t};openPop();return;
    }
    draft.wps.push({x:Math.round(p.x/5)*5,y:Math.round(p.y/5)*5});
    renderOverlay();updateHint();return;
  }
  const dbl=noteTap(e);
  if(dbl&&sel&&tryDouble(p)) return;
  if(s){draft={a:{d:s.d,t:s.t},wps:[]};sel=null;hoverW=null;$('tip').hidden=true;renderList();renderDetail();applyWireClasses();updateHint();return;}
  const g=a.target&&a.target.closest&&a.target.closest('.wire');
  sel=g?g.dataset.wid:null;
  renderList();renderDetail();applyWireClasses();updateHint();
}
// 回傳點在折線上的累積距離與垂直距離，用來決定新中繼點插在第幾個
function polyPos(pts,p){
  let s=0,best={s:0,d:Infinity};
  for(let i=1;i<pts.length;i++){
    const a=pts[i-1],b=pts[i],L=Math.hypot(b.x-a.x,b.y-a.y)||1;
    const t=Math.max(0,Math.min(1,((p.x-a.x)*(b.x-a.x)+(p.y-a.y)*(b.y-a.y))/(L*L)));
    const d=Math.hypot(a.x+(b.x-a.x)*t-p.x,a.y+(b.y-a.y)*t-p.y);
    if(d<best.d) best={s:s+t*L,d};
    s+=L;
  }
  return best;
}
// 選取導線時會調整繪製順序，瀏覽器原生的 dblclick 因此不會觸發，所以自己判斷連點。
let lastTap=null;
function noteTap(e){
  const now=performance.now(),dbl=!!lastTap&&now-lastTap.t<450&&Math.hypot(e.clientX-lastTap.x,e.clientY-lastTap.y)<8;
  lastTap=dbl?null:{t:now,x:e.clientX,y:e.clientY};
  return dbl;
}
function tryDouble(p){
  const w=S.wires.find(x=>x.id===sel),r=ROUTES.get(sel);if(!w||!r) return false;
  const i=w.wps.findIndex(q=>Math.hypot((q.x-p.x)*view.k,(q.y-p.y)*view.k)<=10);
  if(i>=0){w.wps.splice(i,1);commit();recompute();return true;}
  const at=polyPos(r.pts,p);
  if(at.d*view.k>10) return false;
  const idx=w.wps.filter(q=>polyPos(r.pts,q).s<at.s).length;
  w.wps.splice(idx,0,{x:Math.round(p.x/5)*5,y:Math.round(p.y/5)*5});
  commit();recompute();return true;
}
svg.addEventListener('wheel',e=>{e.preventDefault();const p=toWorld(e);zoomAt(Math.exp(-e.deltaY*.0015),p.sx,p.sy);},{passive:false});
svg.addEventListener('contextmenu',e=>{if(draft&&!draft.pop){e.preventDefault();cancelDraft();}});

/* ---------- 複製與貼上 ----------
   剪貼簿只存在這個頁面。鋁軌連軌上器具、現場區連區內器具一起複製；導線不複製。 */
let clip=null,cursorIn=false;
const nextId=(pre,has)=>{let i=1;while(has(pre+i))i++;return pre+i;};
const newDevId=d=>nextId((resolveTpl(d.tpl,d.count)||{pre:'U'}).pre,id=>tagUsed(id));
const snapCopy=o=>JSON.parse(JSON.stringify(o));
function makeClip(k,o){
  const extras=k==='zone'?S.devices.filter(d=>inZone(o,d)):k==='dev'?carried(o):[];
  return {k,o:snapCopy(o),extras:snapCopy(extras),n:0};
}
const clipName=c=>(c.k==='zone'?c.o.name:c.k==='dev'?c.o.tag:c.o.id)+(c.extras.length?`（含 ${c.extras.length} 個器具）`:'');
function pasteClip(c,dx,dy){
  const sh=o=>{o.x=r1(o.x+dx);o.y=r1(o.y+dy);return o;};
  let main;
  const idm={};
  if(c.k==='dev'){main=sh(snapCopy(c.o));main.id=main.tag=newDevId(main);idm[c.o.id]=main.id;S.devices.push(main);}
  else if(c.k==='duct'){main=sh(snapCopy(c.o));main.id=nextId('D',id=>S.ducts.some(x=>x.id===id));S.ducts.push(main);}
  else if(c.k==='gland'){main=snapCopy(c.o);const P=glandPt(main);glandTo(main,{x:P.x+(P.ny?dx:0),y:P.y+(P.nx?dy:0)});main.id=nextId('G',id=>S.glands.some(x=>x.id===id));S.glands.push(main);}
  else{main=sh(snapCopy(c.o));main.id=nextId('Z',id=>S.fields.some(x=>x.id===id));main.name=(c.o.name+'（複製）').slice(0,20);S.fields.push(main);}
  const extras=c.extras.map(e=>{const d=sh(snapCopy(e));d.id=d.tag=newDevId(d);idm[e.id]=d.id;S.devices.push(d);return d;});
  // 正面附件改接到複本的接觸器；只複製附件本身時先拆開
  [main,...extras].forEach(d=>{if(d&&d.on){if(idm[d.on])d.on=idm[d.on];else delete d.on;}});
  return {k:c.k,main,extras};
}
function dropClip(r){
  const ids=new Set(r.extras.map(d=>d.id));if(r.k==='dev')ids.add(r.main.id);
  S.devices=S.devices.filter(d=>!ids.has(d.id));
  if(r.k==='duct')S.ducts=S.ducts.filter(x=>x!==r.main);
  if(r.k==='gland')S.glands=S.glands.filter(x=>x!==r.main);
  if(r.k==='zone')S.fields=S.fields.filter(x=>x!==r.main);
}
// 滑鼠在畫面上就貼在游標處（物件中心對準游標），否則貼在原物件右下，連續貼會一直往右下
function pasteHere(){
  const c=clip,o=c.o;let dx,dy;
  if(cursorIn){
    const w=c.k==='dev'?tplOf(o).w:c.k==='gland'?0:o.w,h=c.k==='dev'?tplOf(o).h:c.k==='gland'?0:o.h;
    dx=c.k==='gland'?0:Math.round((cursor.x-w/2)/5)*5-o.x;dy=c.k==='gland'?0:Math.round((cursor.y-h/2)/5)*5-o.y;
  }else{c.n++;dx=dy=20*c.n;}
  const r=pasteClip(c,dx,dy),m=r.main;
  if(r.k==='gland'&&cursorIn) glandTo(m,cursor);
  if(r.k==='dev'||r.k==='duct'){const R=rectOf(r.k,m);m.sheet=sheetAt({x:R.x+R.w/2,y:R.y+R.h/2});if(r.k==='duct'&&m.sheet==='field')m.sheet='plate';}
  if(r.k==='dev'){r.extras.forEach(d=>d.sheet=m.sheet);if(attachOf(m))hostSnap(m,m.x,m.y);else if(!isRail(m))railSnap(m,m.x,m.y);}
  if(mode!=='place') setMode('place');
  sel=null;picked={k:r.k,id:m.id};commit();recompute();reveal(pickedBox());
  toast(`已貼上 ${r.k==='zone'?m.name:m.id}${r.extras.length?`（含 ${r.extras.length} 個器具）`:''}；可按復原`);
}
let moveStep=10;
const r1=v=>Math.round(v*10)/10;
function pickedObj(){
  if(!picked) return null;
  if(picked.k==='zone') return S.fields.find(z=>z.id===picked.id);
  return picked.k==='dev'?devOf(picked.id):picked.k==='gland'?S.glands.find(g=>g.id===picked.id):S.ducts.find(d=>d.id===picked.id);
}
function moveBy(dir,keepFocus){
  const n=moveStep,dx=dir==='l'?-n:dir==='r'?n:0,dy=dir==='u'?-n:dir==='d'?n:0;
  if(multi.length){shiftSel(dx,dy);if(keepFocus){const el=document.querySelector(`#detail [data-mv="${dir}"]`);if(el)el.focus();}return true;}
  const o=pickedObj();if(!o) return false;
  if(picked.k==='zone'){S.devices.filter(d=>inZone(o,d)).forEach(d=>{d.x=r1(d.x+dx);d.y=r1(d.y+dy);});o.x=r1(o.x+dx);o.y=r1(o.y+dy);}
  else if(picked.k==='gland'){const P=glandPt(o),along=P.ny?dx:dy;if(!along) return false;glandTo(o,{x:P.x+(P.ny?dx:0),y:P.y+(P.nx?dy:0)});}
  else{const mt=picked.k==='dev'?carried(o):[];o.x=r1(o.x+dx);o.y=r1(o.y+dy);syncSheet(o);shiftAll(mt,dx,dy,o.sheet);}
  commit();recompute();
  if(keepFocus){const el=document.querySelector(`#detail [data-mv="${dir}"]`);if(el)el.focus();}
  return true;
}
/* ---------- H-66 鋁軌（DIN 35 mm）----------
   器具以高度中心對齊鋁軌中心；同一支軌上的器具會互相靠齊。
   伺服、濾波器、風扇、再生電阻、接地銅板一般用螺絲鎖底板，不吸附。 */
const NO_DIN=new Set(['fn3270','fn2010','gnd13','gnd15','mec10','rxlg','fan4']);
const isRail=d=>!!d&&tplOf(d).noOv;
const railH=r=>{const t=tplOf(r);return t.w>=t.h;};
function dinOk(d){
  if(!d||d.on||attachOf(d)||d.sheet!=='plate'||d.rot===90||d.rot===270||NO_DIN.has(d.tpl)) return false;
  const t=tplOf(d);return !t.noOv&&t.cat!==C5&&t.cat!==C9;
}
// 掛在這支鋁軌上的器具：高度中心對到軌道中心，水平中心落在軌道範圍內
function mountedOn(r){
  if(!isRail(r)||!railH(r)) return [];
  const rt=tplOf(r),cy=r.y+rt.h/2;
  return S.devices.filter(d=>{
    if(d===r||d.sheet!==r.sheet||!dinOk(d)) return false;
    const t=tplOf(d),cx=d.x+t.w/2;
    return Math.abs(d.y+t.h/2-cy)<.6&&cx>=r.x&&cx<=r.x+rt.w;
  });
}
// 移動器具時要一起帶走的：鋁軌上的器具，以及這些器具（含自己）的正面附件
function carried(d){const base=isRail(d)?mountedOn(d):[];return [...base,...[d,...base].flatMap(riders)];}
// 正面附件拖到電磁接觸器上：置中裝上；離開就拆下
function hostSnap(o,x,y){
  const t=tplOf(o),c={x:x+t.w/2,y:y+t.h/2},below=attachOf(o)==='below';
  // 掛在下方的附件：拖到驅動器上或驅動器正下方都算
  const h=S.devices.find(d=>{if(!hostOk(d,o))return false;const R=rectOf('dev',d);return inR(c,below?{x:R.x,y:R.y,w:R.w,h:R.h+t.h+12}:R);});
  if(!h){delete o.on;return null;}
  placeOn(o,h);o.on=h.id;return h.id;
}
function shiftAll(list,dx,dy,sheet){list.forEach(d=>{d.x=r1(d.x+dx);d.y=r1(d.y+dy);d.sheet=sheet;});}
// 拖曳時呼叫：x、y 是未對齊格點的位置。吸附成功回傳鋁軌 id
function railSnap(o,x,y){
  if(!dinOk(o)) return null;
  const t=tplOf(o),cx=x+t.w/2,cyD=y+t.h/2,reach=Math.max(12,t.h*.3);
  let best=null,bd=reach;
  for(const r of S.devices){
    if(!isRail(r)||r.sheet!==o.sheet||!railH(r)) continue;
    const rt=tplOf(r),d=Math.abs(cyD-(r.y+rt.h/2));
    if(cx>=r.x&&cx<=r.x+rt.w&&d<bd){bd=d;best=r;}
  }
  if(!best) return null;
  const rt=tplOf(best);
  o.y=r1(best.y+rt.h/2-t.h/2);o.x=Math.round(x);
  // 靠齊：左右邊緣離相鄰器具或軌道端點很近時貼齊
  const tol=Math.max(3,8/view.k);let fix=null,fd=tol;
  const edge=(v)=>{const d=Math.abs(v-o.x);if(d<fd){fd=d;fix=v;}};
  mountedOn(best).forEach(n=>{if(n===o)return;const nw=tplOf(n).w;edge(n.x+nw);edge(n.x-t.w);});
  edge(best.x);edge(best.x+rt.w-t.w);
  if(fix!==null) o.x=r1(fix);
  return best.id;
}
function syncSheet(o){
  const r=picked.k==='dev'?rectOf('dev',o):rectOf('duct',o);
  o.sheet=sheetAt({x:r.x+r.w/2,y:r.y+r.h/2});
  if(picked.k==='duct'&&o.sheet==='field') o.sheet='plate';
}
function moveHtml(horizOnly){
  const b=(d,t,l)=>`<button class="tool" data-mv="${d}" aria-label="${l}">${t}</button>`;
  return `<div><div class="sub-h">移動距離 mm</div><div class="row" style="justify-content:flex-start;align-items:center"><input id="mvD" type="number" min="0.1" step="1" value="${moveStep}" aria-label="移動距離" style="width:72px;border:1px solid var(--line);background:var(--panel-2);border-radius:5px;padding:5px 6px;font-family:var(--mono);font-size:12.5px">${b('l','←','向左')}${horizOnly?'':b('u','↑','向上')+b('d','↓','向下')}${b('r','→','向右')}</div></div>`;
}
function gapsOf(d){
  const a=rectOf('dev',d),R=devRef(d),g={l:a.x-R.x,r:R.x+R.w-a.x-a.w,u:a.y-R.y,d:R.y+R.h-a.y-a.h},n={l:'邊',r:'邊',u:'邊',d:'邊'};
  const hit=(id,r)=>{
    const ov=a.y<r.y+r.h&&r.y<a.y+a.h,oh=a.x<r.x+r.w&&r.x<a.x+a.w;
    if(ov){const L=a.x-(r.x+r.w),G=r.x-(a.x+a.w);if(L>=0&&L<g.l){g.l=L;n.l=id;}if(G>=0&&G<g.r){g.r=G;n.r=id;}}
    if(oh){const U=a.y-(r.y+r.h),D=r.y-(a.y+a.h);if(U>=0&&U<g.u){g.u=U;n.u=id;}if(D>=0&&D<g.d){g.d=D;n.d=id;}}
  };
  S.devices.forEach(o=>{if(o!==d&&o.sheet===d.sheet&&!tplOf(o).noOv)hit(o.tag,rectOf('dev',o));});
  S.ducts.forEach(c=>{if(c.sheet===d.sheet)hit(c.id,rectOf('duct',c));});
  const f=k=>`${r1(g[k])}（${esc(n[k])}）`;
  return `<dt>左間距</dt><dd>${f('l')}</dd><dt>右間距</dt><dd>${f('r')}</dd><dt>上間距</dt><dd>${f('u')}</dd><dt>下間距</dt><dd>${f('d')}</dd>`;
}
function rotatePicked(){
  if(multi.length){rotateMulti();return true;}
  if(!picked||picked.k!=='dev') return false;
  const d=devOf(picked.id);if(!d) return false;
  const a=tplOf(d),cx=d.x+a.w/2,cy=d.y+a.h/2;
  d.rot=((d.rot||0)+90)%360;if(!d.rot)delete d.rot;
  const b=tplOf(d);d.x=Math.round((cx-b.w/2)/5)*5;d.y=Math.round((cy-b.h/2)/5)*5;
  riders(d).forEach(r=>placeOn(r,d));
  commit();recompute();return true;
}
function deleteSel(){
  if(multi.length){deleteMulti();return true;}
  if(sel){S.wires=S.wires.filter(w=>w.id!==sel);sel=null;commit();recompute();return true;}
  if(picked){
    if(picked.k==='dev'){riders(devOf(picked.id)).forEach(r=>delete r.on);S.devices=S.devices.filter(d=>d.id!==picked.id);S.wires=S.wires.filter(w=>w.a.d!==picked.id&&w.b.d!==picked.id);if(filt.dev===picked.id)filt.dev='';}
    else if(picked.k==='gland') S.glands=S.glands.filter(g=>g.id!==picked.id);
    else if(picked.k==='zone'){
      const z=S.fields.find(x=>x.id===picked.id),n=S.devices.filter(d=>inZone(z,d)).length;
      if(S.fields.length<=1){toast('至少要留一個現場區');return true;}
      if(n){toast(`${z.name}裡還有 ${n} 個器具，請先移走或刪除`);return true;}
      S.fields=S.fields.filter(x=>x!==z);
    }
    else S.ducts=S.ducts.filter(d=>d.id!==picked.id);
    picked=null;commit();recompute();return true;
  }
  return false;
}
document.addEventListener('keydown',e=>{
  if(!$('ed').hidden) return;
  const typing=/INPUT|SELECT|TEXTAREA/.test(e.target.tagName);
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?$('redo').click():$('undo').click();return;}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();$('redo').click();return;}
  if(!$('setDlg').hidden){if(e.key==='Escape')setDialog(false);return;}
  if(mode==='view'&&!typing){
    const k=e.key.toLowerCase();
    if(e.key==='Escape'){sel=null;picked=null;renderList();renderWires();renderDetail();return;}
    if(!e.ctrlKey&&!e.metaKey&&!e.altKey){if(k==='w')setMode('wire');else if(k==='m')setMode('place');}
    if(((e.ctrlKey||e.metaKey)&&['z','y','v','a'].includes(k))||/^(Delete|Backspace|Arrow)/.test(e.key))e.preventDefault();
    return;
  }
  if(typing) return;
  if((e.ctrlKey||e.metaKey)&&!e.altKey&&!e.shiftKey){
    const k=e.key.toLowerCase();
    if(k==='a'&&mode==='place'){e.preventDefault();selectAll();return;}
    if(k==='c'&&mode==='place'&&multi.length){clip=makeClipMulti();e.preventDefault();toast(`已複製 ${multi.length} 個物件，按 Ctrl＋V 貼上`);return;}
    if(k==='v'&&clip&&clip.k==='multi'&&!draft){e.preventDefault();pasteHereMulti();return;}
    if(k==='c'&&mode==='place'&&picked){const o=pickedObj();if(o){clip=makeClip(picked.k,o);e.preventDefault();toast(`已複製 ${clipName(clip)}，按 Ctrl＋V 貼上`);}return;}
    if(k==='v'&&clip&&!draft){e.preventDefault();pasteHere();return;}
  }
  if(e.key==='Escape'){if(draft)cancelDraft();else{sel=null;picked=null;multi=[];renderList();renderWires();renderDetail();updateHint();}return;}
  if(draft&&draft.pop&&e.key==='Enter'){e.preventDefault();finishWire();return;}
  if(draft&&!draft.pop&&e.key==='Backspace'){e.preventDefault();if(draft.wps.length){draft.wps.pop();renderOverlay();updateHint();}else cancelDraft();return;}
  if(draft) return;
  if(e.key==='Delete'||e.key==='Backspace'){if(deleteSel())e.preventDefault();return;}
  if((e.key==='r'||e.key==='R')&&rotatePicked()){e.preventDefault();return;}
  const arrow={ArrowLeft:'l',ArrowRight:'r',ArrowUp:'u',ArrowDown:'d'}[e.key];
  if(arrow&&mode==='place'&&(picked||multi.length)&&moveBy(arrow,false)){e.preventDefault();return;}
  if(e.key==='w'||e.key==='W')setMode('wire');
  if(e.key==='v'||e.key==='V')setMode('view');
  if(e.key==='m'||e.key==='M')setMode('place');
});

/* 面板事件 */
$('mWire').onclick=()=>setMode('wire');
$('mPlace').onclick=()=>setMode('place');
$('mView').onclick=()=>setMode('view');
$('undo').onclick=()=>{if(!hist.u.length)return;hist.r.push(JSON.stringify(S));draft=null;closePop();restore(hist.u.pop());};
$('redo').onclick=()=>{if(!hist.r.length)return;hist.u.push(JSON.stringify(S));draft=null;closePop();restore(hist.r.pop());};
$('bundle').onclick=e=>{bundle=!bundle;e.currentTarget.setAttribute('aria-pressed',bundle);computeRoutes();renderWires();};
$('labels').onclick=e=>{showNo=!showNo;e.currentTarget.setAttribute('aria-pressed',showNo);applyView();};
$('zi').onclick=()=>{const r=svg.getBoundingClientRect();zoomAt(1.35,r.width/2,r.height/2);};
$('zo').onclick=()=>{const r=svg.getBoundingClientRect();zoomAt(1/1.35,r.width/2,r.height/2);};
$('fit').onclick=fit;
$('vPlate').onclick=()=>fitSheet('plate');$('vDoor').onclick=()=>fitSheet('door');$('vField').onclick=()=>fitSheet('field');
$('newTpl').onclick=()=>openEditor(null,null);
/* 在 Claude Artifact 內改走平台的存檔對話框；其他環境 dlReady 為 null */
const dlReady=window.claude&&window.claude.use?window.claude.use('downloads'):Promise.resolve(null);
function showIO(text){$('ioText').value=text;$('io').hidden=false;$('ioText').focus();$('ioText').select();}
$('ioClose').onclick=()=>{$('io').hidden=true;};
$('ioCopy').onclick=()=>{
  const fb=()=>{$('ioText').focus();$('ioText').select();toast('請按 Ctrl+C 複製已選取的內容');};
  if(navigator.clipboard) navigator.clipboard.writeText($('ioText').value).then(()=>toast('已複製'),fb); else fb();
};
async function saveFile(name,data,okMsg){
  let dl=null;try{dl=await dlReady;}catch(_){}
  if(!dl){ /* 一般網頁（GitHub Pages、本機）：直接用瀏覽器下載 */
    try{
      const url=URL.createObjectURL(new Blob([data],{type:name.endsWith('.csv')?'text/csv;charset=utf-8':'application/json'}));
      const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),10000);toast(okMsg);
    }catch(_){showIO(data);}
    return;
  }
  try{await dl.save({filename:name,data});toast(okMsg);}
  catch(err){
    if(err&&err.code==='declined') toast('已取消匯出');
    else if(err&&err.code==='rate_limited') toast('已有存檔視窗開啟中，請先處理');
    else showIO(data);
  }
}
const stamp=()=>{const d=new Date(),p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}`;};
$('exportB').onclick=()=>saveFile(`配線專案-${stamp()}.json`,JSON.stringify(S,null,1),'已匯出專案檔');
$('listCsv').onclick=exportCsv;
$('printB').onclick=()=>{try{window.print();}catch(_){toast('這個檢視無法列印，請下載後用瀏覽器開啟');}};
$('importB').onclick=()=>$('importF').click();
$('importF').onchange=e=>{
  const f=e.target.files[0];e.target.value='';if(!f) return;
  const r=new FileReader();
  r.onerror=()=>toast('讀不到這個檔案，請重新選擇');
  r.onload=()=>{
    let n=null;try{n=normalize(JSON.parse(r.result));}catch(_){}
    if(!n){toast('這不是配線專案檔，盤面沒有變更');return;}
    S=n.state;resetUi();commit();recompute();renderPalette();fit();
    toast(n.dropped?`已匯入，略過 ${n.dropped} 筆無法辨識的資料；可按復原`:'已匯入專案；可按復原');
  };
  r.readAsText(f);
};
function resetUi(){draft=null;closePop();sel=null;picked=null;multi=[];filt.color=null;filt.gauge=null;filt.dev='';filt.kind=null;}
// 箱體或底板改尺寸時，面板與現場區的原點會移動，裡面的東西要一起平移
function withShift(fn){
  const d0=doorO(),f0=fieldO();fn();
  const d1=doorO(),f1=fieldO(),dd={x:d1.x-d0.x,y:d1.y-d0.y},df={x:f1.x-f0.x,y:f1.y-f0.y};
  const mv=(o,s)=>{if(s==='door'){o.x+=dd.x;o.y+=dd.y;}else if(s==='field'){o.x+=df.x;o.y+=df.y;}};
  S.devices.forEach(o=>mv(o,o.sheet));S.ducts.forEach(o=>mv(o,o.sheet));S.fields.forEach(z=>mv(z,'field'));
}
const sizeInput=(id,fn,shift)=>{$(id).onchange=e=>{const v=Number(e.target.value);if(e.target.value===''||!isFinite(v)){syncSizes();return;}if(shift)withShift(()=>fn(v));else fn(v);commit();e.target.blur();recompute();if(!view.manual)fit();};};
sizeInput('bw',v=>S.box.w=Math.max(100,v),true);sizeInput('bh',v=>S.box.h=Math.max(100,v),true);
sizeInput('bd',v=>S.box.d=Math.max(50,v));sizeInput('bk',v=>S.box.back=Math.max(0,v));
sizeInput('pw',v=>S.plate.w=Math.max(100,v),true);sizeInput('ph',v=>S.plate.h=Math.max(100,v),true);
sizeInput('dw',v=>S.door.w=Math.max(100,v));sizeInput('dh',v=>S.door.h=Math.max(100,v));
sizeInput('hy',v=>S.hinge=v);
$('warnMixed').onchange=e=>{if(e.target.checked)S.warnMixedNo=true;else delete S.warnMixedNo;commit();recompute();};
$('dm').onchange=e=>{
  const v=e.target.value,n=S.devices.filter(d=>d.sheet==='door').length;
  if(v==='none'&&n){toast(`面板上還有 ${n} 個器具，請先移走或刪除`);e.target.value=S.doorMode||'door';return;}
  S.doorMode=v;commit();e.target.blur();recompute();if(!view.manual)fit();renderList();
};sizeInput('fl',v=>S.fillLimit=Math.min(100,Math.max(5,v)));
$('issues').addEventListener('click',e=>{
  const b=e.target.closest('[data-iss]');if(!b)return;const x=ISSUES[Number(b.dataset.iss)];if(!x)return;
  if(mode==='view'){sel=x.k==='wire'?x.id:null;picked=x.k&&x.k!=='wire'&&x.k!=='doormode'?{k:x.k,id:x.id}:null;renderList();renderWires();renderDetail();return;}
  if(x.k==='doormode'){setDialog(true);const dm=$('dm');dm.focus();dm.classList.add('flash');setTimeout(()=>dm.classList.remove('flash'),1600);return;}
  if(x.k==='wire'){if(mode!=='wire')setMode('wire');picked=null;sel=x.id;}
  else{if(mode!=='place')setMode('place');sel=null;picked={k:x.k,id:x.id};}
  recompute();
});
$('sample').onclick=()=>{S=normalize(sampleState()).state;resetUi();commit();recompute();renderPalette();fit();};
/* 清除選單：先選範圍，再在選單內確認；箱體尺寸、面板模式、現場區與自訂器具都保留 */
const CLEAR={
  wires:{n:'只清除線',what:()=>`${S.wires.length} 條線`,ok:()=>S.wires.length>0,run:()=>{S.wires=[];}},
  devs:{n:'清除器具和線',what:()=>`${S.devices.length} 個器具、${S.wires.length} 條線`,ok:()=>S.devices.length+S.wires.length>0,run:()=>{S.devices=[];S.wires=[];}},
  all:{n:'全部清空',what:()=>`${S.devices.length} 個器具、${S.wires.length} 條線、${S.ducts.length} 條線槽、${S.glands.length} 個出線口`,ok:()=>S.devices.length+S.wires.length+S.ducts.length+S.glands.length>0,run:()=>{S.devices=[];S.wires=[];S.ducts=[];S.glands=[];}}
};
function clearMenu(step){
  const m=$('clearM');
  if(step){
    const c=CLEAR[step];
    m.innerHTML=`<p class="mq">確定要${c.n.replace('只','')}？<br><b>會刪除 ${esc(c.what())}</b><br>刪除後可以按「復原」救回。</p><div class="row"><button class="tool" data-clr="">取消</button><button class="tool danger" data-clr-go="${step}">確定清除</button></div>`;
    placeMenu(m);m.querySelector('[data-clr-go]').focus();return;
  }
  m.innerHTML=Object.entries(CLEAR).map(([k,c])=>`<button class="mi" role="menuitem" data-clr="${k}"${c.ok()?'':' disabled'}><span>${c.n}</span><small>${esc(c.what())}</small></button>`).join('')+`<div style="padding:4px 8px 2px"><span class="note">會保留哪些 ${hq('clear')}</span>${hn('clear','箱體尺寸、面板設定、現場區與自訂器具都會保留。')}</div>`;
}
// 下拉選單打開後確認在畫面內：預設對齊按鈕右緣往左展開，左邊超出就改往右，右邊超出就往左移
function placeMenu(m){
  m.style.left='';m.style.right='0';
  const r=m.getBoundingClientRect(),W=document.documentElement.clientWidth,pr=m.offsetParent.getBoundingClientRect();
  if(r.left<8){m.style.right='auto';m.style.left=Math.min(0,W-8-r.width-pr.left)+'px';if(m.getBoundingClientRect().left<8)m.style.left=(8-pr.left)+'px';}
  else if(r.right>W-8){m.style.right=(r.right-(W-8))+'px';}
}
/* 檔案選單：匯出、匯入、列印、範例。點了項目就關閉 */
function setFileMenu(open){$('fileM').hidden=!open;$('fileB').setAttribute('aria-expanded',open);if(open){placeMenu($('fileM'));const f=$('fileM').querySelector('.mi:not(:disabled)');if(f)f.focus();}}
$('fileB').onclick=e=>{e.stopPropagation();setClearMenu(false);setFileMenu($('fileM').hidden);};
$('fileM').addEventListener('click',e=>{if(e.target.closest('.mi'))setFileMenu(false);});
document.addEventListener('click',e=>{if(!$('fileM').hidden&&!e.target.closest('#fileM,#fileB'))setFileMenu(false);});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('fileM').hidden){setFileMenu(false);$('fileB').focus();e.stopImmediatePropagation();}},true);
function setClearMenu(open){$('clearM').hidden=!open;$('clearB').setAttribute('aria-expanded',open);if(open){clearMenu(null);placeMenu($('clearM'));const f=$('clearM').querySelector('.mi:not(:disabled)');if(f)f.focus();}}
$('clearB').onclick=e=>{e.stopPropagation();setFileMenu(false);setClearMenu($('clearM').hidden);};
$('clearM').addEventListener('click',e=>{
  e.stopPropagation();const b=e.target.closest('button');if(!b)return;
  if(b.dataset.clrGo){const c=CLEAR[b.dataset.clrGo],msg=c.what();c.run();filt.dev='';resetUi();setClearMenu(false);commit();recompute();toast(`已清除 ${msg}；可按復原`);return;}
  if(b.dataset.clr) clearMenu(b.dataset.clr); else setClearMenu(false);
});
document.addEventListener('click',e=>{if(!$('clearM').hidden&&!e.target.closest('#clearM,#clearB'))setClearMenu(false);});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('clearM').hidden){setClearMenu(false);$('clearB').focus();e.stopImmediatePropagation();}},true);
try{ if(localStorage.getItem(OLDKEY)&&!localStorage.getItem(KEY)) $('oldDraft').hidden=false; }catch(_){}
$('oldDraft').onclick=()=>{
  try{const n=normalize(JSON.parse(localStorage.getItem(OLDKEY)));if(n){S=n.state;resetUi();commit();recompute();fit();toast('已讀回舊版暫存；可按復原');}}catch(_){toast('舊版暫存讀取失敗');}
  $('oldDraft').hidden=true;
};
/* 說明 */
$('helpB').onclick=()=>setHelp($('helpP').hidden);
$('helpClose').onclick=()=>setHelp(false);
$('helpReset').onclick=()=>{try{localStorage.removeItem('wiring-sim-help-seen');}catch(_){}setHelp(false);helpDot();toast('已重設：還沒看過的提示會在「? 說明」上顯示小紅點');};
// ? 按鈕：展開或收合旁邊的說明（用捕獲階段，選單裡的 ? 也能用，不會把選單關掉）
document.addEventListener('click',e=>{
  const b=e.target.closest&&e.target.closest('.hq');if(!b)return;
  e.stopPropagation();e.preventDefault();
  const k=b.dataset.help,open=!helpOpen.has(k);if(open)helpOpen.add(k);else helpOpen.delete(k);
  document.querySelectorAll(`.hq[data-help="${k}"]`).forEach(x=>x.setAttribute('aria-expanded',open));
  document.querySelectorAll(`[data-helpfor="${k}"]`).forEach(x=>x.hidden=!open);
},true);
/* 盤面設定視窗：欄位 id 不變，原本的尺寸輸入處理照常運作 */
function setDialog(open){
  $('setDlg').hidden=!open;
  if(open){syncSizes();$('bw').focus();}else $('setOpen').focus();
}
$('setOpen').onclick=()=>setDialog(true);
$('leftClose').onclick=()=>setLeft(true,true);
$('leftOpen').onclick=$('leftLib').onclick=()=>{setLeft(false,true);$('libQ').focus();};
$('leftSet').onclick=()=>setDialog(true);
$('setClose').onclick=()=>setDialog(false);
$('setDlg').addEventListener('click',e=>{if(e.target===$('setDlg'))setDialog(false);});
$('libQ').oninput=renderPalette;
// 器具庫捲下去後出現「回到最上」
{const sc=document.querySelector('#left .scroll'),tt=$('toTop');
 sc.addEventListener('scroll',()=>{tt.hidden=sc.scrollTop<300;},{passive:true});
 tt.onclick=()=>{const rm=matchMedia('(prefers-reduced-motion: reduce)').matches;sc.scrollTo({top:0,behavior:rm?'auto':'smooth'});};}
$('palette').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(mode==='view'&&b.matches('.lib')){toast('檢視模式不能新增，按「擺放」或「接線」切換');return;}
  if(b.dataset.add){
    const base=resolveTpl(b.dataset.add);let i=1;while(tagUsed(base.pre+i))i++;
    const vc=viewCenter(),zp=picked&&picked.k==='zone'&&S.fields.find(z=>z.id===picked.id),pd=picked&&picked.k==='dev'&&devOf(picked.id);
    const zone=zp||zoneAt(vc)||(pd&&pd.sheet==='field'&&zoneOf(pd))||S.fields[0];
    const id=base.pre+i,sheet=base.sheet==='door'&&!useDoor()?'plate':base.sheet||'plate',R=sheet==='field'?zone:sheet==='plate'?boxRect():sheetRect(sheet),d={id,tag:id,tpl:b.dataset.add,sheet,x:0,y:0};
    if(base.gen) d.count=base.cnt;
    const t=resolveTpl(b.dataset.add,d.count),c=inR(vc,R)?vc:{x:R.x+R.w/2,y:R.y+R.h/2}; // 畫面中央在該區域內就放在畫面中央
    d.x=Math.round((c.x-t.w/2)/5)*5;d.y=Math.round((c.y-t.h/2)/5)*5;
    S.devices.push(d);
    setMode('place');picked={k:'dev',id};
  }else if(b.dataset.ductAdd){
    let i=1;while(S.ducts.some(d=>d.id==='D'+i))i++;
    const h=b.dataset.ductAdd==='h',wd=Number(b.dataset.dw),w=h?300:wd,hh=h?wd:300,vc=viewCenter(),c=inR(vc,boxRect())?vc:{x:S.plate.w/2,y:S.plate.h/2};
    S.ducts.push({id:'D'+i,sheet:'plate',dp:Number(b.dataset.dd),x:Math.round((c.x-w/2)/5)*5,y:Math.round((c.y-hh/2)/5)*5,w,h:hh});
    setMode('place');picked={k:'duct',id:'D'+i};
  }else if(b.dataset.zoneAdd!==undefined){
    let i=1;while(S.fields.some(z=>z.id==='Z'+i))i++;
    const f0=S.fields[0],bot=Math.max(...S.fields.map(z=>z.y+z.h));
    S.fields.push({id:'Z'+i,name:'現場 '+i,x:f0?f0.x:0,y:bot+40,w:f0?Math.min(f0.w,600):600,h:FIELD_H});
    setMode('place');picked={k:'zone',id:'Z'+i};
  }else if(b.dataset.glandAdd){
    let i=1;while(S.glands.some(g=>g.id==='G'+i))i++;
    const vc=viewCenter(),B=boxRect(),gx=vc.x>B.x+8&&vc.x<B.x+B.w-8?vc.x:S.plate.w/2;
    S.glands.push({id:'G'+i,x:Math.round(gx/5)*5,spec:b.dataset.glandAdd});
    setMode('place');picked={k:'gland',id:'G'+i};
  }else return;
  commit();recompute();reveal(pickedBox());
});
$('list').addEventListener('click',e=>{const b=e.target.closest('[data-wl]');if(!b)return;const v=sel===b.dataset.wl?null:b.dataset.wl;if(mode==='place')setMode('wire');sel=v;renderList();renderDetail();applyWireClasses();updateHint();});
$('list').addEventListener('pointerover',e=>{const b=e.target.closest('[data-wl]');const v=b?b.dataset.wl:null;if(v!==listHover){listHover=v;applyWireClasses();}});
$('list').addEventListener('pointerleave',()=>{listHover=null;applyWireClasses();});
$('detail').addEventListener('change',e=>{if(e.target.id==='mvD'){const v=Number(e.target.value);if(v>0)moveStep=v;else e.target.value=moveStep;}});
$('detail').addEventListener('change',e=>{
  if(e.target.dataset.slot===undefined) return;
  const d=picked&&devOf(picked.id);if(!d) return;
  const L=(d.labels||[]).slice();L[Number(e.target.dataset.slot)]=e.target.value.trim().slice(0,10);
  for(let i=0;i<L.length;i++) if(L[i]==null) L[i]='';
  setSlots(d,L);
});
// 新增線徑、顏色名稱的輸入框按 Enter 等於按旁邊的「新增」
['detail','pop'].forEach(id=>$(id).addEventListener('keydown',e=>{
  if(e.key!=='Enter'||!e.target.closest('.newc'))return;const b=e.target.closest('.newc').querySelector('button');if(b){e.preventDefault();e.stopPropagation();b.click();}
}));
$('detail').addEventListener('input',e=>{if(e.target.id==='mvD'){const v=Number(e.target.value);if(v>0)moveStep=v;}});
$('detail').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.pw){sel=b.dataset.pw;renderList();renderDetail();applyWireClasses();return;} // 點並線跳過去
  if(b.id==='delWire'||b.id==='delPicked'){deleteSel();return;}
  if(b.dataset.mv){moveBy(b.dataset.mv,true);return;}
  if(b.id==='rotDev'){rotatePicked();return;}
  if(b.id==='detachAux'){const d=devOf(picked.id),h=d&&devOf(d.on);if(!h)return;delete d.on;if(d.tpl==='mrbat6v1-f')d.tpl=BAT_BASE;d.x=r1(h.x+tplOf(h).w+10);commit();recompute();toast(`已把 ${d.tag} 從 ${h.tag} 拆下`);return;}
  if(b.id==='slotRevert'){const d=devOf(picked.id),src=slotSource(d);if(!src)return;revertSlots(d,src);commit();recompute();renderPalette();toast(`已換回 ${TPL[src].n}，可以每片填端子號；可按復原`);return;}
  if(b.id==='jAdd'||b.dataset.jdel!==undefined){
    const d=devOf(picked.id);if(!d)return;
    if(b.dataset.jdel!==undefined){d.jumpers.splice(Number(b.dataset.jdel),1);if(!d.jumpers.length)delete d.jumpers;commit();recompute();return;}
    const n=d.count||resolveTpl(d.tpl).cnt,at=Math.round(Number($('jAt').value)),p=Number($('jP').value),row=Number($('jRow').value)===2?2:1;
    if(!(at>=1)||at+p-1>n){toast(`短路片超出範圍：這組端子台只有 ${n} 片`);return;}
    if((d.jumpers||[]).some(j=>(j.row||1)===row&&at<=j.at+j.p-1&&j.at<=at+p-1)){toast(`${row===2?'下排':'上排'}和已經有的短路片重疊了，可以改插另一排`);return;}
    (d.jumpers=d.jumpers||[]).push({at,p,row});commit();recompute();toast(`已加入${row===2?'下排':'上排'} ${p}P 短路片（第 ${at}～${at+p-1} 片）`);return;
  }
  if(b.id==='slotSeq'||b.id==='slotClr'){
    const d=devOf(picked.id),n=d.count||resolveTpl(d.tpl).cnt,f=Math.round(Number($('slotFrom').value)||1);
    setSlots(d,b.id==='slotClr'?[]:Array.from({length:n},(_,i)=>String(f+i)));renderDetail();return;
  }
  if(b.id==='editTpl'){const d=devOf(picked.id);openEditor(d.tpl,d);return;}
  const w=sel&&S.wires.find(x=>x.id===sel);if(!w)return;
  if(b.id==='clearWp') w.wps=[];
  else if(b.dataset.dg) w.gauge=Number(b.dataset.dg);
  else if(b.dataset.newg){const v=addTempGauge(b.dataset.newg);if(v==null)return;w.gauge=v;}
  else if(b.dataset.newc) applyColor(w,addTemp(b.dataset.newc));
  else if(b.dataset.pc) applyColor(w,b.dataset.pc);
  else return;
  commit();recompute();
});
$('right').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.fc){filt.color=filt.color===b.dataset.fc?null:b.dataset.fc;renderList();applyWireClasses();}
  if(b.dataset.fg){const g=Number(b.dataset.fg);filt.gauge=filt.gauge===g?null:g;renderList();applyWireClasses();}
  if(b.dataset.fk){filt.kind=filt.kind===b.dataset.fk?null:b.dataset.fk;renderList();applyWireClasses();}
});
$('tabAll').onclick=()=>{tab='all';renderList();};
$('tabExt').onclick=()=>{tab='ext';renderList();};
$('tabBom').onclick=()=>{tab='bom';renderList();};
$('tabLen').onclick=()=>{tab='len';renderList();};
$('list').addEventListener('change',e=>{if(e.target.id==='spareIn'){const v=Number(e.target.value);if(!(v>=0)){e.target.value=spare();return;}S.spare=Math.min(5000,Math.round(v));commit();renderList();}});
$('fDev').onchange=e=>{filt.dev=e.target.value;renderList();applyWireClasses();};


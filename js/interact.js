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
  tip.innerHTML=`<b>${w.no}</b>　${esc(c.n)}　${w.gauge} mm²　${KINDS[kind]}<br>${esc(w.a.d)}·${esc(w.a.t)} → ${esc(w.b.d)}·${esc(w.b.t)}<br>${r.via.length?'經 '+esc(r.via.join(' → ')):'直接跨接'}${r.gland?' → '+esc(r.gland):''}　${(r.len/1000).toFixed(2)} m`+(w.ext&&w.ext.cable?`<br>電纜 ${esc(w.ext.cable)}　芯 ${esc(w.ext.core)}`:'')+(r.warn?`<br><span class="flag">${esc(r.warn)}</span>`:'');
  tip.hidden=false;
  const st=$('stage').getBoundingClientRect();
  const tw=tip.offsetWidth,th=tip.offsetHeight;
  let x=sx+14,y=sy+14;if(x+tw>st.width-6)x=sx-tw-14;if(y+th>st.height-6)y=sy-th-14;
  tip.style.left=Math.max(6,x)+'px';tip.style.top=Math.max(6,y)+'px';
}
function hoverUpdate(e){
  const p=toWorld(e);cursor=p;
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
    const dg=e.target.closest('[data-dev]'),cg=e.target.closest('[data-duct]'),gg=e.target.closest('[data-gland]');
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
  if(act.t==='drag'){
    const p=toWorld(e),o=act.obj;
    o.x=Math.round((p.x-act.ox)/5)*5;o.y=Math.round((p.y-act.oy)/5)*5;
    const r=picked.k==='dev'?rectOf('dev',o):rectOf('duct',o);
    o.sheet=sheetAt({x:r.x+r.w/2,y:r.y+r.h/2});
    if(picked.k==='duct'&&o.sheet==='field') o.sheet='plate';
    computeRoutes();renderBoard();renderWires();
  }else if(act.t==='gland'){
    const p=toWorld(e),o=boxOrigin();
    act.obj.x=Math.max(o.x+8,Math.min(o.x+S.box.w-8,Math.round((p.x-act.ox)/5)*5));
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
  if(a.t==='wp'&&!a.moved&&noteTap(e)&&tryDouble(toWorld(e))) return;
  if(a.t==='drag'||a.t==='wp'||a.t==='gland'){ if(a.moved){commit();} recompute(); return; }
  if(a.moved||a.btn!==0) return;
  if(mode==='wire') clickWire(e,a); else {picked=null;sel=null;renderWires();renderDetail();updateHint();}
});
svg.addEventListener('pointercancel',()=>{act=null;});
svg.addEventListener('pointerleave',()=>{if(!act&&(snap||hoverW)){snap=null;hoverW=null;$('tip').hidden=true;applyWireClasses();}});
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

let moveStep=10;
const r1=v=>Math.round(v*10)/10;
function pickedObj(){
  if(!picked) return null;
  return picked.k==='dev'?devOf(picked.id):picked.k==='gland'?S.glands.find(g=>g.id===picked.id):S.ducts.find(d=>d.id===picked.id);
}
function moveBy(dir,keepFocus){
  const o=pickedObj();if(!o) return false;
  const n=moveStep,dx=dir==='l'?-n:dir==='r'?n:0,dy=dir==='u'?-n:dir==='d'?n:0;
  if(picked.k==='gland'){if(!dx) return false;const b=boxOrigin();o.x=Math.max(b.x+8,Math.min(b.x+S.box.w-8,r1(o.x+dx)));}
  else{o.x=r1(o.x+dx);o.y=r1(o.y+dy);syncSheet(o);}
  commit();recompute();
  if(keepFocus){const el=document.querySelector(`#detail [data-mv="${dir}"]`);if(el)el.focus();}
  return true;
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
  const a=rectOf('dev',d),R=sheetRect(d.sheet),g={l:a.x-R.x,r:R.x+R.w-a.x-a.w,u:a.y-R.y,d:R.y+R.h-a.y-a.h},n={l:'邊',r:'邊',u:'邊',d:'邊'};
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
  if(!picked||picked.k!=='dev') return false;
  const d=devOf(picked.id);if(!d) return false;
  const a=tplOf(d),cx=d.x+a.w/2,cy=d.y+a.h/2;
  d.rot=((d.rot||0)+90)%360;if(!d.rot)delete d.rot;
  const b=tplOf(d);d.x=Math.round((cx-b.w/2)/5)*5;d.y=Math.round((cy-b.h/2)/5)*5;
  commit();recompute();return true;
}
function deleteSel(){
  if(sel){S.wires=S.wires.filter(w=>w.id!==sel);sel=null;commit();recompute();return true;}
  if(picked){
    if(picked.k==='dev'){S.devices=S.devices.filter(d=>d.id!==picked.id);S.wires=S.wires.filter(w=>w.a.d!==picked.id&&w.b.d!==picked.id);if(filt.dev===picked.id)filt.dev='';}
    else if(picked.k==='gland') S.glands=S.glands.filter(g=>g.id!==picked.id);
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
  if(typing) return;
  if(e.key==='Escape'){if(draft)cancelDraft();else{sel=null;picked=null;renderList();renderWires();renderDetail();updateHint();}return;}
  if(draft&&draft.pop&&e.key==='Enter'){e.preventDefault();finishWire();return;}
  if(draft&&!draft.pop&&e.key==='Backspace'){e.preventDefault();if(draft.wps.length){draft.wps.pop();renderOverlay();updateHint();}else cancelDraft();return;}
  if(draft) return;
  if(e.key==='Delete'||e.key==='Backspace'){if(deleteSel())e.preventDefault();return;}
  if((e.key==='r'||e.key==='R')&&rotatePicked()){e.preventDefault();return;}
  const arrow={ArrowLeft:'l',ArrowRight:'r',ArrowUp:'u',ArrowDown:'d'}[e.key];
  if(arrow&&mode==='place'&&picked&&moveBy(arrow,false)){e.preventDefault();return;}
  if(e.key==='w'||e.key==='W')setMode('wire');
  if(e.key==='m'||e.key==='M')setMode('place');
});

/* 面板事件 */
$('mWire').onclick=()=>setMode('wire');
$('mPlace').onclick=()=>setMode('place');
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
$('extCsv').onclick=()=>{
  const q=v=>{let s=String(v==null?'':v);if(/^[=+\-@]/.test(s))s="'"+s;return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
  const rows=[['電纜編號','芯線','電纜規格','線號','線徑mm²','線色','箱內端','出線口','現場端','現場設備','備註']];
  S.wires.filter(w=>wireKind(w)==='ext').sort((a,b)=>String(a.ext?.cable).localeCompare(String(b.ext?.cable))).forEach(w=>{
    const af=devOf(w.a.d).sheet==='field',f=af?w.a:w.b,n=af?w.b:w.a,fd=devOf(f.d),t=tplOf(fd);
    rows.push([w.ext?.cable,w.ext?.core,specName(w.ext?.spec),w.no,w.gauge,colorOf(w).n,`${n.d}·${n.t}`,ROUTES.get(w.id)?.gland||'',`${f.d}·${f.t}`,t.n,t.note||'']);
  });
  saveFile(`外線表-${stamp()}.csv`,'﻿'+rows.map(r=>r.map(q).join(',')).join('\r\n'),'已匯出外線表');
};
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
function resetUi(){draft=null;closePop();sel=null;picked=null;filt.color=null;filt.gauge=null;filt.dev='';filt.kind=null;}
// 箱體或底板改尺寸時，面板與現場區的原點會移動，裡面的東西要一起平移
function withShift(fn){
  const d0=doorO(),f0=fieldO();fn();
  const d1=doorO(),f1=fieldO(),dd={x:d1.x-d0.x,y:d1.y-d0.y},df={x:f1.x-f0.x,y:f1.y-f0.y};
  const mv=(o,s)=>{if(s==='door'){o.x+=dd.x;o.y+=dd.y;}else if(s==='field'){o.x+=df.x;o.y+=df.y;}};
  S.devices.forEach(o=>mv(o,o.sheet));S.ducts.forEach(o=>mv(o,o.sheet));
}
const sizeInput=(id,fn,shift)=>{$(id).onchange=e=>{const v=Number(e.target.value);if(e.target.value===''||!isFinite(v)){syncSizes();return;}if(shift)withShift(()=>fn(v));else fn(v);commit();e.target.blur();recompute();if(!view.manual)fit();};};
sizeInput('bw',v=>S.box.w=Math.max(100,v),true);sizeInput('bh',v=>S.box.h=Math.max(100,v),true);
sizeInput('bd',v=>S.box.d=Math.max(50,v));sizeInput('bk',v=>S.box.back=Math.max(0,v));
sizeInput('pw',v=>S.plate.w=Math.max(100,v),true);sizeInput('ph',v=>S.plate.h=Math.max(100,v),true);
sizeInput('dw',v=>S.door.w=Math.max(100,v));sizeInput('dh',v=>S.door.h=Math.max(100,v));
sizeInput('hy',v=>S.hinge=v);sizeInput('fl',v=>S.fillLimit=Math.min(100,Math.max(5,v)));
$('issues').addEventListener('click',e=>{
  const b=e.target.closest('[data-iss]');if(!b)return;const x=ISSUES[Number(b.dataset.iss)];if(!x)return;
  if(x.k==='wire'){if(mode!=='wire')setMode('wire');picked=null;sel=x.id;}
  else{if(mode!=='place')setMode('place');sel=null;picked={k:x.k,id:x.id};}
  recompute();
});
$('sample').onclick=()=>{S=normalize(sampleState()).state;resetUi();commit();recompute();renderPalette();fit();};
$('clearW').onclick=()=>{if(!S.wires.length)return;S.wires=[];resetUi();commit();recompute();};
try{ if(localStorage.getItem(OLDKEY)&&!localStorage.getItem(KEY)) $('oldDraft').hidden=false; }catch(_){}
$('oldDraft').onclick=()=>{
  try{const n=normalize(JSON.parse(localStorage.getItem(OLDKEY)));if(n){S=n.state;resetUi();commit();recompute();fit();toast('已讀回舊版暫存；可按復原');}}catch(_){toast('舊版暫存讀取失敗');}
  $('oldDraft').hidden=true;
};
$('libQ').oninput=renderPalette;
$('palette').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.add){
    const base=resolveTpl(b.dataset.add);let i=1;while(S.devices.some(d=>d.id===base.pre+i))i++;
    const id=base.pre+i,sheet=base.sheet||'plate',R=sheetRect(sheet),d={id,tag:id,tpl:b.dataset.add,sheet,x:0,y:0};
    if(base.gen) d.count=base.cnt;
    const t=resolveTpl(b.dataset.add,d.count);
    d.x=Math.round((R.x+R.w/2-t.w/2)/5)*5;d.y=Math.round((R.y+R.h/2-t.h/2)/5)*5;
    S.devices.push(d);
    setMode('place');picked={k:'dev',id};
  }else if(b.dataset.ductAdd){
    let i=1;while(S.ducts.some(d=>d.id==='D'+i))i++;
    const h=b.dataset.ductAdd==='h',wd=Number(b.dataset.dw),w=h?300:wd,hh=h?wd:300;
    S.ducts.push({id:'D'+i,sheet:'plate',dp:Number(b.dataset.dd),x:Math.round((S.plate.w-w)/10)*5,y:Math.round((S.plate.h-hh)/10)*5,w,h:hh});
    setMode('place');picked={k:'duct',id:'D'+i};
  }else if(b.dataset.glandAdd){
    let i=1;while(S.glands.some(g=>g.id==='G'+i))i++;
    S.glands.push({id:'G'+i,x:Math.round(S.plate.w/10)*5,spec:b.dataset.glandAdd});
    setMode('place');picked={k:'gland',id:'G'+i};
  }else return;
  commit();recompute();
});
$('list').addEventListener('click',e=>{const b=e.target.closest('[data-wl]');if(!b)return;const v=sel===b.dataset.wl?null:b.dataset.wl;if(mode!=='wire')setMode('wire');sel=v;renderList();renderDetail();applyWireClasses();updateHint();});
$('list').addEventListener('pointerover',e=>{const b=e.target.closest('[data-wl]');const v=b?b.dataset.wl:null;if(v!==listHover){listHover=v;applyWireClasses();}});
$('list').addEventListener('pointerleave',()=>{listHover=null;applyWireClasses();});
$('detail').addEventListener('change',e=>{if(e.target.id==='mvD'){const v=Number(e.target.value);if(v>0)moveStep=v;else e.target.value=moveStep;}});
$('detail').addEventListener('input',e=>{if(e.target.id==='mvD'){const v=Number(e.target.value);if(v>0)moveStep=v;}});
$('detail').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.id==='delWire'||b.id==='delPicked'){deleteSel();return;}
  if(b.dataset.mv){moveBy(b.dataset.mv,true);return;}
  if(b.id==='rotDev'){rotatePicked();return;}
  if(b.id==='editTpl'){const d=devOf(picked.id);openEditor(d.tpl,d);return;}
  const w=sel&&S.wires.find(x=>x.id===sel);if(!w)return;
  if(b.id==='clearWp') w.wps=[];
  else if(b.dataset.dg) w.gauge=Number(b.dataset.dg);
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
$('fDev').onchange=e=>{filt.dev=e.target.value;renderList();applyWireClasses();};


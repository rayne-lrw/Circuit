"use strict";
/* ---------- 拖線段：選取中的線（或電纜外皮），滑鼠移到線槽外的一段上會出現雙箭頭，拖曳整段平移 ----------
   做法：拖的那段兩端、以及前後兩段的另一端各放一個中繼點（已經有中繼點就直接移動），放開後把拿掉也不影響路徑的中繼點清掉。
   不可以拖：接點出來的第一段與進接點的最後一段、線槽裡的段、穿過箱壁（出線口）的段；拖曳時不跨過箱壁。 */
const SEG_TOL=6;      // 滑鼠離線段幾個螢幕像素內算點到
const near=(a,b,t=.6)=>Math.abs(a.x-b.x)<t&&Math.abs(a.y-b.y)<t;
function segTarget(){
  if(sel){const w=S.wires.find(x=>x.id===sel),r=w&&ROUTES.get(w.id);if(!w||!r||r.cab)return null;return {kind:'wire',w,pts:r.pts,wps:w.wps};}
  if(selCab){const c=cabOf(selCab),r=c&&CABROUTES.get(c.id);if(!c||!r)return null;return {kind:'cab',c,pts:r.pts,wps:c.wps||[]};}
  return null;
}
function segAt(p){
  if(mode!=='wire'||draft)return null;
  const T=segTarget();if(!T)return null;
  const P=T.pts,n=P.length,tol=SEG_TOL/view.k,B=boxRect(),onWall=q=>(Math.abs(q.x-B.x)<.6||Math.abs(q.x-B.x-B.w)<.6||Math.abs(q.y-B.y)<.6||Math.abs(q.y-B.y-B.h)<.6);
  let best=null,bd=tol;
  for(let i=1;i<n-2;i++){
    const a=P[i],b=P[i+1],hz=Math.abs(a.y-b.y)<.01,vt=Math.abs(a.x-b.x)<.01;
    if(!(hz||vt)||Math.hypot(a.x-b.x,a.y-b.y)<2)continue;
    const m={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
    if(S.ducts.some(d=>inR(m,d)))continue;                       // 線槽裡的段：線道是自動排的
    if(inR(a,B)!==inR(b,B)||(onWall(a)&&onWall(b)))continue;      // 穿過箱壁（出線口）的段
    const d=hz?(p.x>=Math.min(a.x,b.x)&&p.x<=Math.max(a.x,b.x)?Math.abs(p.y-a.y):1e9):(p.y>=Math.min(a.y,b.y)&&p.y<=Math.max(a.y,b.y)?Math.abs(p.x-a.x):1e9);
    if(d<bd){bd=d;best={i,hz};}
  }
  return best?{...T,...best,pts:P.map(q=>({x:q.x,y:q.y})),wps:T.wps.map(q=>({x:q.x,y:q.y}))}:null;
}
const segCursor=p=>{const g=segAt(p);return g?(g.hz?'ns-resize':'ew-resize'):'';};
// 開始拖：整理出中繼點清單（照沿線順序），記住拖的那兩點在清單裡的位置
function segPrep(g){
  const P=g.pts,n=P.length,B=boxRect(),onWall=q=>(Math.abs(q.x-B.x)<.6||Math.abs(q.x-B.x-B.w)<.6||Math.abs(q.y-B.y)<.6||Math.abs(q.y-B.y-B.h)<.6);
  // 中繼點在路徑上的位置（第幾個點，或在第幾段上）
  const pos=q=>{for(let k=0;k<n;k++)if(near(P[k],q))return k;for(let k=0;k<n-1;k++){const a=P[k],b=P[k+1];if(q.x>=Math.min(a.x,b.x)-.5&&q.x<=Math.max(a.x,b.x)+.5&&q.y>=Math.min(a.y,b.y)-.5&&q.y<=Math.max(a.y,b.y)+.5)return k+.5;}return 1e6;};
  const idx=[g.i-1,g.i,g.i+1,g.i+2].filter(k=>k>=1&&k<=n-2&&!(k!==g.i&&k!==g.i+1&&onWall(P[k])));
  const keep=g.wps.filter(q=>!idx.some(k=>near(P[k],q))).map(q=>({q,k:pos(q)}));
  const add=idx.map(k=>({q:{x:P[k].x,y:P[k].y},k,mv:k===g.i||k===g.i+1}));
  const list=[...keep,...add].sort((a,b)=>a.k-b.k);
  g.list=list.map(e=>e.q);g.mv=list.filter(e=>e.mv).map(e=>e.q);g.orig=g.pts[g.i][g.hz?'y':'x'];
}
// 拖曳中：拖的那段平移到新位置（1 mm 格點），不跨過箱壁
function segMove(a,e){
  const g=a.g;if(!g.list)segPrep(g);
  const p=toWorld(e),B=boxRect(),A=g.pts[g.i],Bp=g.pts[g.i+1],k=g.hz?'y':'x';
  let v=Math.round(g.orig+(p[k]-a.p0[k]));
  const inside=inR({x:(A.x+Bp.x)/2,y:(A.y+Bp.y)/2},B),lo=g.hz?B.y:B.x,hi=g.hz?B.y+B.h:B.x+B.w;
  const span=g.hz?[Math.min(A.x,Bp.x),Math.max(A.x,Bp.x)]:[Math.min(A.y,Bp.y),Math.max(A.y,Bp.y)],slo=g.hz?B.x:B.y,shi=g.hz?B.x+B.w:B.y+B.h;
  if(inside)v=Math.max(lo+2,Math.min(hi-2,v));
  else if(span[1]>slo&&span[0]<shi){if(g.orig<=lo)v=Math.min(v,lo-2);else if(g.orig>=hi)v=Math.max(v,hi+2);}
  g.mv.forEach(q=>q[k]=v);
  const wps=g.list.map(q=>({x:q.x,y:q.y}));
  if(g.kind==='wire'){g.w.wps=wps;const el=$('wires').querySelector(`.wire[data-wid="${g.w.id}"]`);if(el)el.style.visibility='hidden';dragPrev={w:g.w,pts:wirePreview(g.w)};renderOverlay();}
  else{g.c.wps=wps;frame(()=>{computeRoutes();renderWires();renderOverlay();});}
}
// 放開：合併太近的中繼點，再把拿掉也不影響路徑的中繼點清掉
function segEnd(a){
  const g=a.g;dragPrev=null;
  const get=()=>g.kind==='wire'?g.w.wps:(g.c.wps||[]),set=v=>{if(g.kind==='wire')g.w.wps=v;else{if(v.length)g.c.wps=v;else delete g.c.wps;}};
  const route=()=>{if(g.kind==='wire')return wirePreview(g.w);computeRoutes();const r=CABROUTES.get(g.c.id);return r?r.pts:[];};
  const key=pts=>pts.map(q=>q.x.toFixed(1)+','+q.y.toFixed(1)).join(' ');
  let L=get().filter((q,i,arr)=>!arr.slice(0,i).some(x=>near(x,q,1)));set(L);
  const base=key(route());
  for(let i=L.length-1;i>=0;i--){const t=L.filter((_,j)=>j!==i);set(t);if(key(route())===base)L=t;else set(L);}
  set(L);commit();recompute();
}

"use strict";
/* ---------- 走線：線槽路網 ---------- */
function junctions(){
  const J=[];
  for(const h of S.ducts) if(axis(h)==='h') for(const v of S.ducts) if(axis(v)==='v'&&v.sheet===h.sheet){
    const x=center(v),y=center(h);
    if(x>=h.x&&x<=h.x+h.w&&y>=v.y&&y<=v.y+v.h) J.push({x,y,h,v});
  }
  return J;
}
const onD=(j,d)=>j.h===d||j.v===d;
const along=(j,d)=>axis(d)==='h'?j.x:j.y;
function segHits(ax,ay,bx,by,exclude){
  const x0=Math.min(ax,bx),x1=Math.max(ax,bx),y0=Math.min(ay,by),y1=Math.max(ay,by);
  for(const d of S.devices){
    if(exclude&&exclude.includes(d.id)) continue;
    const t=tplOf(d);if(t.noOv) continue;
    if(x1>d.x+1&&x0<d.x+t.w-1&&y1>d.y+1&&y0<d.y+t.h-1) return d;
  }
  return null;
}
function exits(P){
  if(P.inDuct) return [{duct:P.inDuct,along:axis(P.inDuct)==='h'?P.x:P.y,cost:0,blocked:false}];
  const out=[];
  for(const dir of ['top','bottom','left','right']){
    const vert=dir==='top'||dir==='bottom';
    let best=null,bd=1e9;
    for(const d of S.ducts){
      if(d.sheet!==P.sheet||axis(d)!==(vert?'h':'v')) continue;
      let dist;
      if(vert){
        if(P.x<d.x||P.x>d.x+d.w) continue;
        dist=dir==='top'?P.y-(d.y+d.h):d.y-P.y;
      }else{
        if(P.y<d.y||P.y>d.y+d.h) continue;
        dist=dir==='left'?P.x-(d.x+d.w):d.x-P.x;
      }
      if(dist>=-0.01&&dist<bd){bd=dist;best=d;}
    }
    if(!best) continue;
    const ex=vert?P.x:(dir==='left'?P.x-bd:P.x+bd), ey=vert?(dir==='top'?P.y-bd:P.y+bd):P.y;
    const blocked=!!segHits(P.x,P.y,ex,ey,P.dev?[P.dev]:null);
    let cost=bd+(blocked?3000:0);
    if(P.side&&dir!==P.side) cost+=500; // 不從接點正常出線方向走，等於線要壓過自身器具
    out.push({duct:best,along:vert?P.x:P.y,cost,blocked});
  }
  return out;
}
function ductPath(a,b,J){
  if(a.duct===b.duct) return {ducts:[a.duct],cost:Math.abs(a.along-b.along)};
  const n=J.length,dist=new Array(n).fill(Infinity),prev=new Array(n).fill(null),done=new Array(n).fill(false);
  J.forEach((j,i)=>{if(onD(j,a.duct)){dist[i]=Math.abs(along(j,a.duct)-a.along)+20;prev[i]={i:-1,duct:a.duct};}});
  for(let c=0;c<n;c++){
    let u=-1;for(let i=0;i<n;i++) if(!done[i]&&dist[i]<Infinity&&(u<0||dist[i]<dist[u])) u=i;
    if(u<0) break; done[u]=true;
    for(let i=0;i<n;i++){ if(done[i]||i===u) continue;
      const s=[J[u].h,J[u].v].find(d=>onD(J[i],d)); if(!s) continue;
      const w=dist[u]+Math.abs(along(J[u],s)-along(J[i],s))+20;
      if(w<dist[i]){dist[i]=w;prev[i]={i:u,duct:s};}
    }
  }
  let best=-1,bc=Infinity;
  for(let i=0;i<n;i++) if(onD(J[i],b.duct)&&dist[i]<Infinity){const c=dist[i]+Math.abs(along(J[i],b.duct)-b.along);if(c<bc){bc=c;best=i;}}
  if(best<0) return null;
  const seq=[b.duct];let cur=best;
  while(cur>=0){const p=prev[cur];if(seq[0]!==p.duct)seq.unshift(p.duct);cur=p.i;}
  return {ducts:seq,cost:bc};
}
function directPts(A,B){
  const av=A.side==='top'||A.side==='bottom', bv=B.side==='top'||B.side==='bottom';
  if(Math.abs(A.x-B.x)<.01||Math.abs(A.y-B.y)<.01) if(!(A.side&&A.side===B.side)) return [A,B];
  if(av&&bv){
    const ad=A.side==='top'?-1:1, bd=B.side==='top'?-1:1;
    if(A.side===B.side){const y=ad<0?Math.min(A.y,B.y)-12:Math.max(A.y,B.y)+12;return [A,{x:A.x,y},{x:B.x,y},B];}
    if((B.y-A.y)*ad>0){const y=A.midY??B.midY??(A.y+B.y)/2;return [A,{x:A.x,y},{x:B.x,y},B];}
    const y1=A.y+ad*12,y2=B.y+bd*12,mx=(A.x+B.x)/2;
    return [A,{x:A.x,y:y1},{x:mx,y:y1},{x:mx,y:y2},{x:B.x,y:y2},B];
  }
  if(av) return [A,{x:A.x,y:B.y},B];
  if(bv) return [A,{x:B.x,y:A.y},B];
  return [A,{x:B.x,y:A.y},B];
}
function clean(pts,A,B){
  const ex=[A.dev,B.dev].filter(Boolean);
  for(let i=0;i<pts.length-1;i++){
    const last=i===pts.length-2,first=i===0;
    const skip=first&&last?ex:first?(A.dev?[A.dev]:[]):last?(B.dev?[B.dev]:[]):[];
    if(segHits(pts[i].x,pts[i].y,pts[i+1].x,pts[i+1].y,skip)) return false;
  }
  return true;
}
function routeLeg(A,B,J){
  if(A.sheet!==B.sheet) return {direct:true,pts:directPts(A,B)};
  if(!A.inDuct&&!B.inDuct&&!A.must&&!B.must){
    const d=directPts(A,B), ok=clean(d,A,B), m=Math.abs(A.x-B.x)+Math.abs(A.y-B.y);
    if(ok&&(!(A.dev&&B.dev)||m<=95)) return {direct:true,pts:d};
  }
  let best=null;
  for(const a of exits(A)) for(const b of exits(B)){
    const p=ductPath(a,b,J); if(!p) continue;
    const cost=a.cost+b.cost+p.cost;
    if(!best||cost<best.cost) best={cost,ducts:p.ducts,blocked:a.blocked||b.blocked};
  }
  if(!best) return {direct:true,pts:directPts(A,B),warn:A.sheet==='plate'?'無線槽可走':null}; // 面板與現場本來就不一定有線槽
  return {ducts:best.ducts,warn:best.blocked?'穿過其他器具':null};
}
function realize(wid,anchors,legs,lane){
  const pts=[{x:anchors[0].x,y:anchors[0].y}],runs=[];
  let cur=pts[0],last=null,open=null;
  legs.forEach((leg,i)=>{
    const to=anchors[i+1];
    if(leg.direct){ leg.pts.slice(1).forEach(p=>pts.push({x:p.x,y:p.y})); cur=to; last=null; return; }
    for(const d of leg.ducts){
      if(d===last) continue;
      const c=lane(wid,d), p=axis(d)==='h'?{x:cur.x,y:c}:{x:c,y:cur.y};
      pts.push(p);cur=p;
      if(open){open.i1=pts.length-1;runs.push(open);}
      open={d,i0:pts.length-1};last=d;
    }
    const p=axis(last)==='h'?{x:to.x,y:cur.y}:{x:cur.x,y:to.y};
    pts.push(p);cur=p;
    if(!to.inDuct){open.i1=pts.length-1;runs.push(open);open=null;pts.push({x:to.x,y:to.y});cur=to;last=null;}
  });
  return {pts,runs};
}
function simplify(pts){
  const o=[];
  for(const p of pts){
    const q=o[o.length-1]; if(q&&Math.abs(q.x-p.x)<.01&&Math.abs(q.y-p.y)<.01) continue;
    if(o.length>=2){const r=o[o.length-2];
      if((Math.abs(r.x-q.x)<.01&&Math.abs(q.x-p.x)<.01&&(q.y-r.y)*(p.y-q.y)>0)||(Math.abs(r.y-q.y)<.01&&Math.abs(q.y-p.y)<.01&&(q.x-r.x)*(p.x-q.x)>0)){o[o.length-1]=p;continue;}}
    o.push(p);
  }
  return o;
}
function locate(p,sheet){return S.ducts.find(d=>d.sheet===sheet&&inR(p,d))||null;}
function endpoint(e,off){
  const d=devOf(e.d),t=termOf(d,e.t);
  const v=t.side==='top'||t.side==='bottom';
  return {x:d.x+t.x+(v?off:0),y:d.y+t.y+(v?0:off),side:t.side,dev:d.id,sheet:d.sheet};
}
function wpAnchor(p){const s=sheetAt(p);return {x:p.x,y:p.y,sheet:s,inDuct:locate(p,s)};}
function gates(from,to,ctr,fieldX,glandId){
  if(from==='field'||to==='field'){
    const g=(glandId&&S.glands.find(x=>x.id===glandId))||S.glands.reduce((b,x)=>!b||Math.abs(x.x-fieldX)<Math.abs(b.x-fieldX)?x:b,null);
    const gx=g?g.x:S.plate.w/2,i=ctr.g++,y=boxBottom();
    const a={x:gx+((i%14)-6.5)*1.6,y,sheet:'plate',must:true,side:'bottom',midY:y+12+(i%24)*2.2,gland:g?g.id:null};
    return [a];
  }
  const i=ctr.h++,y=S.hinge+(i-(ctr.hn-1)/2)*2.6,H1={x:S.plate.w,y,sheet:'plate',must:true,side:null},H2={x:doorO().x,y,sheet:'door',side:null};
  return from==='plate'?[H1,H2]:[H2,H1];
}
function buildAnchors(ea,eb,wps,ctr,glandId){
  const sa=ea.sheet,sb=eb.sheet;
  const chain=sa===sb?[sa]:(sa!=='plate'&&sb!=='plate')?[sa,'plate',sb]:[sa,sb];
  const fieldX=sa==='field'?ea.x:eb.x;
  const out=[ea];
  chain.forEach((sh,i)=>{
    wps.forEach(p=>{const a=wpAnchor(p);if(a.sheet===sh)out.push(a);});
    if(i<chain.length-1) gates(sh,chain[i+1],ctr,fieldX,glandId).forEach(x=>out.push(x));
  });
  out.push(eb);
  return out;
}

const ROUTES=new Map(); const DUCTUSE=new Map(); let ISSUES=[];
function rectOf(k,o){if(k==='dev'){const t=tplOf(o);return {x:o.x,y:o.y,w:t.w,h:t.h};}return {x:o.x,y:o.y,w:o.w,h:o.h};}
const overlap=(a,b)=>a.x+a.w>b.x+1&&b.x+b.w>a.x+1&&a.y+a.h>b.y+1&&b.y+b.h>a.y+1;
const outside=(r,P)=>r.x<P.x-.01||r.y<P.y-.01||r.x+r.w>P.x+P.w+.01||r.y+r.h>P.y+P.h+.01;
function computeIssues(){
  const out=[],P=S.plate,B=S.box;
  if(P.w>B.w||P.h>B.h) out.push({t:`底板 ${P.w}×${P.h} 比電控箱 ${B.w}×${B.h} 大`});
  if(S.door.w<B.w||S.door.h<B.h) out.push({t:`面板 ${S.door.w}×${S.door.h} 蓋不住電控箱 ${B.w}×${B.h}`});
  const P0=sheetRect('plate'),D0=sheetRect('door');
  S.devices.forEach(d=>{if(d.sheet==='field')return;const R=d.sheet==='door'?D0:P0;if(outside(rectOf('dev',d),R)) out.push({t:`${d.tag} 超出${d.sheet==='door'?'面板':'底板'}`,k:'dev',id:d.id});});
  S.ducts.forEach(d=>{if(outside(rectOf('duct',d),d.sheet==='door'?D0:P0)) out.push({t:`線槽 ${d.id} 超出${d.sheet==='door'?'面板':'底板'}`,k:'duct',id:d.id});});
  S.devices.forEach((a,i)=>{
    if(a.sheet==='field'||tplOf(a).noOv) return;
    const ra=rectOf('dev',a);
    S.devices.slice(i+1).forEach(b=>{if(b.sheet===a.sheet&&!tplOf(b).noOv&&overlap(ra,rectOf('dev',b))) out.push({t:`${a.tag} 與 ${b.tag} 重疊`,k:'dev',id:a.id});});
    S.ducts.forEach(c=>{if(c.sheet===a.sheet&&overlap(ra,rectOf('duct',c))) out.push({t:`${a.tag} 壓到線槽 ${c.id}`,k:'dev',id:a.id});});
  });
  // 深度：關門後面板器具投影到底板，兩者深度相加不可超過可用深度
  const room=B.d-B.back,bo=boxOrigin(),dO=doorO();
  const plateDevs=S.devices.filter(d=>d.sheet==='plate'&&!tplOf(d).noOv),doorDevs=S.devices.filter(d=>d.sheet==='door');
  plateDevs.forEach(d=>{if(tplOf(d).d>room) out.push({t:`${d.tag} 深 ${tplOf(d).d} mm，超過可用深度 ${room} mm`,k:'dev',id:d.id});});
  doorDevs.forEach(d=>{
    const t=tplOf(d);
    if(t.d>room){out.push({t:`${d.tag} 深 ${t.d} mm，超過可用深度 ${room} mm`,k:'dev',id:d.id});return;}
    const pr={x:bo.x+B.w-(d.x-dO.x)-t.w,y:d.y-dO.y+bo.y,w:t.w,h:t.h};
    plateDevs.forEach(p=>{const pt=tplOf(p);if(overlap(pr,rectOf('dev',p))&&pt.d+t.d>room) out.push({t:`關門時 ${d.tag} 會撞到 ${p.tag}（${t.d}＋${pt.d}＞${room} mm）`,k:'dev',id:d.id});});
  });
  S.ducts.forEach(d=>{
    const u=DUCTUSE.get(d.id);if(!u) return;
    if(u.pct>S.fillLimit) out.push({t:`線槽 ${d.id} 占用 ${u.pct}%，超過上限 ${S.fillLimit}%`,k:'duct',id:d.id});
    else if(u.pitch<1.5) out.push({t:`線槽 ${d.id} 排了 ${u.lanes} 道線，畫面過密，建議加寬或分流`,k:'duct',id:d.id});
  });
  S.wires.forEach(w=>{const r=ROUTES.get(w.id);if(r&&r.warn) out.push({t:`${w.no} ${r.warn}`,k:'wire',id:w.id});});
  return out;
}
const key=(e)=>e.d+'|'+e.t;
function computeRoutes(){
  ROUTES.clear();DUCTUSE.clear();bundleSel=sel;
  const J=junctions();
  const use=new Map();
  S.wires=S.wires.filter(w=>{const a=devOf(w.a.d),b=devOf(w.b.d);return a&&b&&termOf(a,w.a.t)&&termOf(b,w.b.t);});
  S.wires.forEach(w=>{for(const e of [w.a,w.b]){const k=key(e);use.set(k,(use.get(k)||0)+1);}});
  const seen=new Map();
  const off=(e)=>{const k=key(e),n=use.get(k)||1,i=seen.get(k)||0;seen.set(k,i+1);return (i-(n-1)/2)*1.7;};
  const ctr={h:0,g:0,hn:S.wires.filter(w=>{const a=devOf(w.a.d).sheet,b=devOf(w.b.d).sheet;return a!==b&&(a==='door'||b==='door');}).length};
  const center_=(_,d)=>center(d);
  const items=S.wires.map(w=>{
    const anchors=buildAnchors(endpoint(w.a,off(w.a)),endpoint(w.b,off(w.b)),w.wps,ctr,w.gland);
    const legs=[];for(let i=0;i<anchors.length-1;i++) legs.push(routeLeg(anchors[i],anchors[i+1],J));
    return {w,anchors,legs,first:realize(w.id,anchors,legs,center_)};
  });
  // 線道分配
  const perDuct=new Map();
  for(const it of items){
    const seenD=new Map();
    for(const r of it.first.runs){
      const a=axis(r.d),c=center(r.d),slice=it.first.pts.slice(r.i0,r.i1+1).map(p=>a==='h'?p.x:p.y);
      const lo=Math.min(...slice),hi=Math.max(...slice);
      const pv=it.first.pts[r.i0-1],nx=it.first.pts[r.i1+1];
      const cr=p=>p?sgn((a==='h'?p.y:p.x)-c):0;
      const s=cr(pv)+cr(nx);
      if(seenD.has(r.d)){const e=seenD.get(r.d);e.lo=Math.min(e.lo,lo);e.hi=Math.max(e.hi,hi);e.score+=s;}
      else{const e={id:it.w.id,lo,hi,score:s,g:it.w.gauge};seenD.set(r.d,e);if(!perDuct.has(r.d))perDuct.set(r.d,[]);perDuct.get(r.d).push(e);}
    }
  }
  const lanes=new Map();
  for(const [d,list] of perDuct){
    // 依起點排序可用最少線道；再把總長短的線道放外側，出線時少跨過別條線
    const place=(arr)=>{
      const ls=[];
      for(const e of [...arr].sort((a,b)=>a.lo-b.lo)){
        let L=ls.find(x=>e.lo-5>x.end);
        if(!L){L={end:-Infinity,len:0,items:[]};ls.push(L);}
        L.end=Math.max(L.end,e.hi);L.len+=e.hi-e.lo;L.items.push(e);
      }
      ls.sort((a,b)=>a.len-b.len).forEach((L,i)=>L.items.forEach(e=>e.l=i));
      return ls.length;
    };
    const up=list.filter(e=>e.score<0),dn=list.filter(e=>e.score>0);
    list.filter(e=>e.score===0).forEach(e=>(up.length<=dn.length?up:dn).push(e));
    const nu=place(up),nd=place(dn),T=nu+nd;
    const a=axis(d),lo=a==='h'?d.y:d.x,hi=lo+(a==='h'?d.h:d.w),pad=3.5,avail=hi-lo-2*pad;
    const c=(lo+hi)/2;
    // 占用率取線槽內最擠那一段的導線截面積
    const ev=[];list.forEach(e=>{const ar=Math.PI/4*(OD[e.g]||4)**2;ev.push([e.lo,ar],[e.hi+.01,-ar]);});
    ev.sort((x,y)=>x[0]-y[0]);let cur=0,peak=0;ev.forEach(([,v])=>{cur+=v;peak=Math.max(peak,cur);});
    const section=Math.min(d.w,d.h)*(d.dp||40);
    DUCTUSE.set(d.id,{n:list.length,lanes:T,pitch:T>1?Math.min(3.4,avail/(T-1)):3.4,pct:Math.round(peak/section*100)});
    if(bundle){
      // 選取的那條線放回自己的線道，其他維持收攏
      const p=Math.min(.7,avail/Math.max(T,1)),sp=T>1?Math.min(3.4,avail/(T-1)):0;
      up.forEach(e=>lanes.set(e.id+'|'+d.id,e.id===sel&&T>1?lo+pad+e.l*sp:c+(e.l-(T-1)/2)*p));
      dn.forEach(e=>lanes.set(e.id+'|'+d.id,e.id===sel&&T>1?hi-pad-e.l*sp:c+((T-1-e.l)-(T-1)/2)*p));
    }else{
      const p=T>1?Math.min(3.4,avail/(T-1)):0;
      up.forEach(e=>lanes.set(e.id+'|'+d.id,T===1?c:lo+pad+e.l*p));
      dn.forEach(e=>lanes.set(e.id+'|'+d.id,T===1?c:hi-pad-e.l*p));
    }
  }
  for(const it of items){
    const f=realize(it.w.id,it.anchors,it.legs,(id,d)=>lanes.get(id+'|'+d.id)??center(d));
    const pts=simplify(f.pts);
    let len=0;for(let i=1;i<pts.length;i++)len+=Math.abs(pts[i].x-pts[i-1].x)+Math.abs(pts[i].y-pts[i-1].y);
    const via=[];f.runs.forEach(r=>{if(via[via.length-1]!==r.d.id)via.push(r.d.id);});
    const warn=(it.legs.find(l=>l.warn)||{}).warn||null;
    const g=it.anchors.find(a=>a.gland);
    ROUTES.set(it.w.id,{pts,len,via,warn,gland:g?g.gland:null});
  }
  ISSUES=computeIssues();
}
function previewPts(a,wps,end){
  const J=junctions();
  const anchors=buildAnchors(endpoint(a,0),end,wps,{h:0,g:0,hn:1},null);
  const legs=[];for(let i=0;i<anchors.length-1;i++) legs.push(routeLeg(anchors[i],anchors[i+1],J));
  return simplify(realize('_',anchors,legs,(_,d)=>center(d)).pts);
}


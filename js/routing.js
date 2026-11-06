"use strict";
/* ---------- 走線：線槽路網 ---------- */
function junctions(){
  const J=[];
  for(const h of S.ducts) if(axis(h)==='h') for(const v of S.ducts) if(axis(v)==='v'&&v.sheet===h.sheet){
    // 外框碰到或重疊就算相接（容許 3 mm 間隙），包含水平線槽頂在垂直線槽側邊的 T 字接法；轉角在兩條中心線的交點
    const x=center(v),y=center(h),tol=3;
    if(v.x<=h.x+h.w+tol&&v.x+v.w>=h.x-tol&&h.y<=v.y+v.h+tol&&h.y+h.h>=v.y-tol) J.push({x,y,h,v});
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
  const OPP={top:'bottom',bottom:'top',left:'right',right:'left'};
  for(const dir of ['top','bottom','left','right']){
    if(P.dev&&P.side&&dir===OPP[P.side]) continue; // 器具接點不可反方向出線，會從器具本體上穿過去
    if(P.backOf&&dir===P.backOf) continue; // 往中繼點出線的轉入點：不可再往接點那邊走
    const vert=dir==='top'||dir==='bottom';
    let best=null,bd=1e9,ba=0;
    for(const d of S.ducts){
      if(d.sheet!==P.sheet) continue;
      // 往上下找：橫向線槽從側面進；直向線槽從端頭進。往左右同理。
      const across=axis(d)===(vert?'h':'v');
      let dist;const tol=3; // 容許 3 mm：線槽之間的小縫、同一接點多條線錯開，都不該找不到線槽
      if(vert){
        if(P.x<d.x-tol||P.x>d.x+d.w+tol) continue;
        dist=dir==='top'?P.y-(d.y+d.h):d.y-P.y;
      }else{
        if(P.y<d.y-tol||P.y>d.y+d.h+tol) continue;
        dist=dir==='left'?P.x-(d.x+d.w):d.x-P.x;
      }
      if(dist<-0.01||dist>=bd) continue;
      bd=dist;best=d;
      ba=across?(vert?P.x:P.y):(vert?(dir==='top'?d.y+d.h:d.y):(dir==='left'?d.x+d.w:d.x));
    }
    if(!best) continue;
    const ex=vert?P.x:(dir==='left'?P.x-bd:P.x+bd), ey=vert?(dir==='top'?P.y-bd:P.y+bd):P.y;
    const blocked=!!segHits(P.x,P.y,ex,ey,P.dev?famIds(P.dev):null); // 接觸器與正面附件互相不算阻擋
    let cost=bd+(blocked?3000:0);
    if(P.side&&dir!==P.side) cost+=500; // 不從接點正常出線方向走，等於線要壓過自身器具
    out.push({duct:best,along:ba,cost,blocked});
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
// 要接到出線點，但起點在器具的另一側：從器具旁邊繞過去，不穿過器具本體
function aroundPts(A,B){
  const s=B.side,d=devOf(B.dev);if(!d||!s) return null;
  const r=rectOf('dev',d),v={top:[0,-1],bottom:[0,1],left:[-1,0],right:[1,0]}[s];
  if((A.x-B.x)*v[0]+(A.y-B.y)*v[1]>=-.01) return null; // 起點已經在出線方向那一側
  if(s==='top'||s==='bottom'){const lx=Math.abs(A.x-(r.x-STUB))<Math.abs(A.x-(r.x+r.w+STUB))?r.x-STUB:r.x+r.w+STUB;return [A,{x:lx,y:A.y},{x:lx,y:B.y},B];}
  const ly=Math.abs(A.y-(r.y-STUB))<Math.abs(A.y-(r.y+r.h+STUB))?r.y-STUB:r.y+r.h+STUB;return [A,{x:A.x,y:ly},{x:B.x,y:ly},B];
}
function directPts(A,B){
  if(B.stub&&!A.stub||(B.stub&&A.stub&&A.dev!==B.dev)){const p=aroundPts(A,B);if(p)return p;}
  if(A.stub&&!B.stub){const p=aroundPts(B,A);if(p)return p.reverse();}
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
// loose：每一段都不把起訖兩端的器具算成阻擋（直接拉線時，轉角那段會進到終點器具裡）
function clean(pts,A,B,loose){
  const fa=A.dev?famIds(A.dev):[],fb=B.dev?famIds(B.dev):[];
  for(let i=0;i<pts.length-1;i++){
    const last=i===pts.length-2,first=i===0;
    const skip=loose||first&&last?[...fa,...fb]:first?fa:last?fb:[];
    if(segHits(pts[i].x,pts[i].y,pts[i+1].x,pts[i+1].y,skip)) return false;
  }
  return true;
}
function routeLeg(A,B,J,noDuct){
  if(A.dev&&B.dev&&A.sheet===B.sheet&&famIds(A.dev).includes(B.dev)&&!A.stub&&!B.stub) return {direct:true,pts:directPts(A,B)};
  if((B.stub&&!A.stub&&A.dev===B.dev)||(A.stub&&!B.stub&&A.dev===B.dev)) return {direct:true,pts:[A,B]}; // 接點↔出線點
  if(A.sheet!==B.sheet) return {direct:true,pts:directPts(A,B)};
  // 指定不進線槽（例如動力線直接拉）：直接連到下一點，穿過其他器具時提示
  if(noDuct){const d=directPts(A,B);return {direct:true,pts:d,warn:A.sheet==='plate'&&!clean(d,A,B,true)?'直接拉線穿過其他器具':null};}
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
function realize(wid,anchors,legs,lane0){
  // 中繼點只落在一條線槽裡：這條線在那條線槽裡沿中繼點的位置走（進出都一樣，不會橫移再折回）；
  // 落在兩條線槽交界時不改，只橫移經過
  const ovr=new Map();
  anchors.forEach(a=>{if(!a.wp||a.bo||!a.inDuct||ovr.has(a.inDuct))return;if(S.ducts.filter(d=>d.sheet===a.sheet&&inR(a,d)).length!==1)return;ovr.set(a.inDuct,axis(a.inDuct)==='h'?a.y:a.x);});
  // 中繼點也落在前後相鄰線槽的寬度範圍內（點在轉角附近）：那條線槽也沿中繼點的位置走，轉角就在中繼點上
  anchors.forEach((a,i)=>{
    if(!a.wp||a.bo||!a.inDuct) return;
    [legs[i-1],legs[i]].forEach(L=>{(L&&L.ducts||[]).forEach(d=>{
      if(d===a.inDuct||ovr.has(d)||axis(d)===axis(a.inDuct)) return;
      const v=axis(d)==='h'?a.y:a.x,lo=axis(d)==='h'?d.y:d.x,hi=lo+(axis(d)==='h'?d.h:d.w);
      if(v>=lo&&v<=hi) ovr.set(d,v);
    });});
  });
  const lane=(id,d)=>ovr.has(d)?ovr.get(d):lane0(id,d);
  const pts=[{x:anchors[0].x,y:anchors[0].y}],runs=[];
  let cur=pts[0],last=null,open=null;
  legs.forEach((leg,i)=>{
    const to=anchors[i+1];
    if(leg.direct){ leg.pts.slice(1).forEach(p=>pts.push({x:p.x,y:p.y})); cur=to; last=null; return; }
    for(const d of leg.ducts){
      if(d===last) continue;
      const c=lane(wid,d);
      // 從線槽端頭進去時，先沿原方向走到端頭，進了線槽再對齊線道，不在器具旁邊橫移
      if(!last){
        if(axis(d)==='h'&&(cur.x<d.x||cur.x>d.x+d.w)){const q={x:cur.x<d.x?d.x+2:d.x+d.w-2,y:cur.y};pts.push(q);cur=q;}
        else if(axis(d)==='v'&&(cur.y<d.y||cur.y>d.y+d.h)){const q={x:cur.x,y:cur.y<d.y?d.y+2:d.y+d.h-2};pts.push(q);cur=q;}
      }
      const p=axis(d)==='h'?{x:cur.x,y:c}:{x:c,y:cur.y};
      pts.push(p);cur=p;
      if(open){open.i1=pts.length-1;runs.push(open);}
      open={d,i0:pts.length-1};last=d;
    }
    // 從線槽端頭出來接到旁邊的接點：先在線槽裡對齊接點，再沿原方向出去
    if(!to.inDuct&&axis(last)==='h'&&(to.x<last.x||to.x>last.x+last.w)){const ex=to.x<last.x?last.x+2:last.x+last.w-2;pts.push({x:ex,y:cur.y});pts.push({x:ex,y:to.y});cur={x:ex,y:to.y};}
    else if(!to.inDuct&&axis(last)==='v'&&(to.y<last.y||to.y>last.y+last.h)){const ey=to.y<last.y?last.y+2:last.y+last.h-2;pts.push({x:cur.x,y:ey});pts.push({x:to.x,y:ey});cur={x:to.x,y:ey};}
    const p=axis(last)==='h'?{x:to.x,y:cur.y}:{x:cur.x,y:to.y};
    pts.push(p);cur=p;
    // 中繼點在線槽裡：從線道橫移到中繼點的實際位置，下一段從那裡出發
    if(to.wp&&to.inDuct&&(Math.abs(p.x-to.x)>.01||Math.abs(p.y-to.y)>.01)){pts.push({x:to.x,y:to.y});cur={x:to.x,y:to.y};last=null;if(open){open.i1=pts.length-2;runs.push(open);open=null;}}
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
function wpAnchor(p){const s=sheetAt(p);return {x:p.x,y:p.y,sheet:s,inDuct:locate(p,s),wp:true};}
function gates(from,to,ctr,fieldP,glandId){
  if(from==='field'||to==='field'){
    // 沒指定就選離現場設備最近的出線口
    const dist=g=>{const P=glandPt(g);return Math.hypot(P.x-fieldP.x,P.y-fieldP.y);};
    const g=(glandId&&S.glands.find(x=>x.id===glandId))||S.glands.reduce((b,x)=>!b||dist(x)<dist(b)?x:b,null);
    const i=ctr.g++,k=(i%24)*2.2,sp=((i%14)-6.5)*1.6,by=boxBottom();
    if(!g||(g.side||'bottom')==='bottom'){
      const gx=g?g.x:S.plate.w/2;
      const a={x:gx+sp,y:by,sheet:'plate',must:true,side:'bottom',midY:by+12+k,gland:g?g.id:null};
      return to==='field'?[a]:[a];
    }
    // 側面或頂部：先往箱外拉出一段，再沿箱外繞到箱底下方，不穿過箱體
    const P=glandPt(g),o=boxOrigin(),bx0=o.x,bx1=o.x+S.box.w;
    const a={x:P.x+(P.ny?sp:0),y:P.y+(P.nx?sp:0),sheet:'plate',must:true,side:P.side,gland:g.id};
    const out={x:a.x+P.nx*(12+k),y:a.y+P.ny*(12+k),sheet:'field',side:'bottom',midY:by+12+k};
    const pts=[a,out];
    if(P.side==='top'){const sx=fieldP.x<(bx0+bx1)/2?bx0-12-k:bx1+12+k;out.side=null;pts.push({x:sx,y:out.y,sheet:'field',side:'bottom',midY:by+12+k});} // 頂部：出箱後先水平移到側面，再往下
    return from==='field'?pts.reverse():pts;
  }
  const i=ctr.h++,y=S.hinge+(i-(ctr.hn-1)/2)*2.6,H1={x:S.plate.w,y,sheet:'plate',must:true,side:null},H2={x:doorO().x,y,sheet:'door',side:null};
  return from==='plate'?[H1,H2]:[H2,H1];
}
// 出線點：從接點沿出線方向拉到器具外框外 6 mm。路徑從這裡開始算，最後也從這裡沿接點方向接進去
const STUB=6;
function stubOf(P){
  if(!P.side||!P.dev) return null;
  const d=devOf(P.dev),r=rectOf('dev',d),s=P.side;
  const L=(s==='top'?P.y-r.y:s==='bottom'?r.y+r.h-P.y:s==='left'?P.x-r.x:r.x+r.w-P.x)+STUB;
  const q={x:P.x+(s==='left'?-L:s==='right'?L:0),y:P.y+(s==='top'?-L:s==='bottom'?L:0),sheet:P.sheet,side:s,dev:P.dev,stub:true};
  q.inDuct=locate(q,q.sheet); // 出線點已經在線槽裡就直接進線槽
  return q;
}
// 使用者把中繼點放在接點出線方向的反方向：照中繼點的意思，直接從接點往中繼點那邊出線（壓過自己的器具），
// 不先往外拉再繞回來。出線點放在接點往器具內 4 mm，線在那裡轉 90 度接進接點。只影響有中繼點的線
const BACK_IN=4;
function backStub(P,W){
  if(!W||!P.dev||!P.side||W.sheet!==P.sheet) return null;
  const v={top:[0,-1],bottom:[0,1],left:[-1,0],right:[1,0]}[P.side];
  if((W.x-P.x)*v[0]+(W.y-P.y)*v[1]>=0) return null;
  // 中繼點要在這個器具的正後方：越過器具另一邊的外框，而且橫向在器具寬度範圍內，才算是使用者要從這邊出線
  const r=rectOf('dev',devOf(P.dev));
  if(v[0]===0?(W.x<r.x||W.x>r.x+r.w):(W.y<r.y||W.y>r.y+r.h)) return null;
  if(P.side==='top'?W.y<=r.y+r.h:P.side==='bottom'?W.y>=r.y:P.side==='left'?W.x<=r.x+r.w:W.x>=r.x) return null;
  const q={x:P.x-v[0]*BACK_IN,y:P.y-v[1]*BACK_IN,sheet:P.sheet,side:null,backOf:P.side,dev:P.dev,stub:true};
  q.inDuct=locate(q,q.sheet);return q;
}
function buildAnchors(ea,eb,wps,ctr,glandId){
  const sa=ea.sheet,sb=eb.sheet;
  const chain=sa===sb?[sa]:(sa!=='plate'&&sb!=='plate')?[sa,'plate',sb]:[sa,sb];
  const fieldP=sa==='field'?ea:eb;
  // 同一組器具（主體與正面附件、伺服電池）之間的線直接在器具前面連，不拉出線點
  const fam=ea.dev&&eb.dev&&ea.sheet===eb.sheet&&famIds(ea.dev).includes(eb.dev);
  const w0=wps.length?wpAnchor(wps[0]):null,w1=wps.length?wpAnchor(wps[wps.length-1]):null;
  const out=[ea],qa=fam?null:(backStub(ea,w0)||stubOf(ea)),qb=fam?null:(backStub(eb,w1)||stubOf(eb));
  if(fam&&!wps.length){out.push(eb);out.local=true;return out;}
  if(qa) out.push(qa);
  chain.forEach((sh,i)=>{
    wps.forEach(p=>{const a=wpAnchor(p);if(a.sheet===sh)out.push(a);});
    if(i<chain.length-1) gates(sh,chain[i+1],ctr,fieldP,glandId).forEach(x=>out.push(x));
  });
  if(qb) out.push(qb);
  out.push(eb);
  return out;
}

const ROUTES=new Map(),ROUTES_MANUAL=new Set(),CABROUTES=new Map(); const DUCTUSE=new Map(); let ISSUES=[];
function rectOf(k,o){if(k==='dev'){const t=tplOf(o);return {x:o.x,y:o.y,w:t.w,h:t.h};}return {x:o.x,y:o.y,w:o.w,h:o.h};}
const overlap=(a,b)=>a.x+a.w>b.x+1&&b.x+b.w>a.x+1&&a.y+a.h>b.y+1&&b.y+b.h>a.y+1;
const outside=(r,P)=>r.x<P.x-.01||r.y<P.y-.01||r.x+r.w>P.x+P.w+.01||r.y+r.h>P.y+P.h+.01;
function computeIssues(){
  const out=[],P=S.plate,B=S.box;
  const BX={...boxOrigin(),w:B.w,h:B.h};
  S.fields.forEach(z=>{if(overlap(z,BX)||(useDoor()&&overlap(z,sheetRect('door')))) out.push({t:`${z.name}與電控箱或面板重疊`,k:'zone',id:z.id});});
  if(P.w>B.w||P.h>B.h) out.push({t:`底板 ${P.w}×${P.h} 比電控箱 ${B.w}×${B.h} 大`});
  if(isDoorPanel()&&(S.door.w<B.w||S.door.h<B.h)) out.push({t:`面板 ${S.door.w}×${S.door.h} 蓋不住電控箱 ${B.w}×${B.h}；如果是獨立操作台，點這裡到「盤面設定」改選面板`,k:'doormode'});
  const P0=sheetRect('plate'),D0=sheetRect('door');
  // 器具可以放在底板、面板、現場區以外（例如裝在箱體外側板金），所以不檢查器具是否在範圍內
  S.ducts.forEach(d=>{if(outside(rectOf('duct',d),d.sheet==='door'?D0:P0)) out.push({t:`線槽 ${d.id} 超出${d.sheet==='door'?doorShort():'底板'}`,k:'duct',id:d.id});});
  S.devices.forEach((a,i)=>{
    if(a.sheet==='field'||tplOf(a).noOv) return;
    const ra=rectOf('dev',a);
    S.devices.slice(i+1).forEach(b=>{if(a.on===b.id||b.on===a.id||(a.on&&a.on===b.on))return;if(b.sheet===a.sheet&&!tplOf(b).noOv&&overlap(ra,rectOf('dev',b))) out.push({t:`${a.tag} 與 ${b.tag} 重疊`,k:'dev',id:a.id});});
    // 線槽可以局部切除讓器具，所以器具壓到線槽不警告
  });
  // 深度：關門後面板器具投影到底板，兩者深度相加不可超過可用深度
  const room=B.d-B.back,bo=boxOrigin(),dO=doorO();
  // 完全在箱體外的器具（裝在箱外板金）不算深度與關門碰撞
  // 正面附件的深度併入接觸器計算
  const plateDevs=S.devices.filter(d=>d.sheet==='plate'&&!d.on&&!tplOf(d).noOv&&overlap(rectOf('dev',d),BX)),doorDevs=S.devices.filter(d=>d.sheet==='door');
  plateDevs.forEach(d=>{const dd=effDepth(d);if(dd>room) out.push({t:`${d.tag} ${riders(d).length?'含正面附件':''}深 ${dd} mm，超過可用深度 ${room} mm`,k:'dev',id:d.id});});
  if(!useDoor()) doorDevs.forEach(d=>out.push({t:`面板已設為不使用，但 ${d.tag} 還在面板上`,k:'dev',id:d.id}));
  // 獨立操作台不是門，不做深度與關門碰撞檢查
  if(isDoorPanel()) doorDevs.forEach(d=>{
    const t=tplOf(d);
    if(t.d>room){out.push({t:`${d.tag} 深 ${t.d} mm，超過可用深度 ${room} mm`,k:'dev',id:d.id});return;}
    const pr={x:bo.x+B.w-(d.x-dO.x)-t.w,y:d.y-dO.y+bo.y,w:t.w,h:t.h};
    plateDevs.forEach(p=>{const pd=effDepth(p);if(overlap(pr,rectOf('dev',p))&&pd+t.d>room) out.push({t:`關門時 ${d.tag} 會撞到 ${p.tag}（${t.d}＋${pd}＞${room} mm）`,k:'dev',id:d.id});});
  });
  S.ducts.forEach(d=>{
    const u=DUCTUSE.get(d.id);if(!u) return;
    if(u.pct>S.fillLimit) out.push({t:`線槽 ${d.id} 占用 ${u.pct}%，超過上限 ${S.fillLimit}%`,k:'duct',id:d.id});
    // 線道多到畫面上靠得很近只是顯示問題，不列在檢查清單（選取線槽時在右側說明）
  });
  S.wires.forEach(w=>{const r=ROUTES.get(w.id);if(r&&r.warn) out.push({t:`${wireRef(w)} ${r.warn}`,k:'wire',id:w.id});});
  // 有中繼點的線在同一條直線上沿原路折返：多半是中繼點放的位置讓線跑過頭再回來
  S.wires.forEach(w=>{if(!w.wps.length||w.cab)return;const r=ROUTES.get(w.id);if(r&&backtrack(r.pts))out.push({t:`${wireRef(w)} 在中繼點前後沿原路折返，建議移動中繼點`,k:'wire',id:w.id});});
  (S.cables||[]).forEach(c=>{
    const cw=coresOf(c),sp=specCores(c.spec).length,seen=new Map();
    if(sp&&c.cores.length>sp) out.push({t:`電纜 ${c.no} 規格是 ${sp} 芯，芯線表有 ${c.cores.length} 芯`,k:'cable',id:c.id});
    cw.forEach(w=>{if(seen.has(w.core))out.push({t:`電纜 ${c.no} 的芯線 ${w.core} 接了兩次（${seen.get(w.core).no}、${w.no}）`,k:'wire',id:w.id});else seen.set(w.core,w);});
    const fd=new Set(cw.filter(w=>devOf(w.b.d).sheet==='field').map(w=>w.b.d));
    if(fd.size>1) out.push({t:`電纜 ${c.no} 的芯線接到 ${fd.size} 個現場設備（${[...fd].map(tagOf).join('、')}），一條電纜通常只到一個設備`,k:'cable',id:c.id});
    if(cw.some(w=>wireKind(w)==='ext')&&cw.some(w=>wireKind(w)!=='ext')) out.push({t:`電纜 ${c.no} 有些芯線到現場、有些在箱內，請確認`,k:'cable',id:c.id});
  });
  S.devices.forEach(d=>{const n=d.count||(resolveTpl(d.tpl)||{}).cnt||0;(d.jumpers||[]).forEach(j=>{if(j.at+j.p-1>n)out.push({t:`${d.tag} 的 ${j.p}P 短路片超出片數（只有 ${n} 片）`,k:'dev',id:d.id});});});
  // 同號但電位不相連：多半是打錯號碼；反過來同一電位有不同線號，可在盤面設定開啟提示
  const nets=netsOf(),byNo=new Map();
  S.wires.forEach(w=>{if(!byNo.has(w.no))byNo.set(w.no,new Map());const m=byNo.get(w.no),n=nets.get(w.id);if(!m.has(n))m.set(n,[]);m.get(n).push(w);});
  byNo.forEach((m,no)=>{if(m.size>1){const g=[...m.values()].sort((a,b)=>a.length-b.length)[0];out.push({t:`線號 ${no} 分成 ${m.size} 組不相連的電位，請確認是不是打錯號碼`,k:'wire',id:g[0].id});}});
  if(S.warnMixedNo){
    const byNet=new Map();S.wires.forEach(w=>{const n=nets.get(w.id);if(!byNet.has(n))byNet.set(n,new Set());byNet.get(n).add(w.no);});
    byNet.forEach((set,n)=>{if(set.size>1){const w=S.wires.find(x=>nets.get(x.id)===n);out.push({t:`同一電位有不同線號：${[...set].sort(natCmp).join('、')}`,k:'wire',id:w.id});}});
  }
  return out;
}
function backtrack(p){
  for(let i=2;i<p.length;i++){const a=p[i-2],b=p[i-1],c=p[i];
    const col=(Math.abs(a.x-b.x)<.01&&Math.abs(b.x-c.x)<.01)||(Math.abs(a.y-b.y)<.01&&Math.abs(b.y-c.y)<.01);
    if(col&&((b.x-a.x)*(c.x-b.x)+(b.y-a.y)*(c.y-b.y))<-.01) return true;}
  return false;
}
const key=(e)=>e.d+'|'+e.t;
function computeRoutes(){
  ROUTES.clear();DUCTUSE.clear();ROUTES_MANUAL.clear();CABROUTES.clear();fixBatteries();syncCables();bundleSel=sel;
  const J=junctions();
  const use=new Map();
  S.wires=S.wires.filter(w=>{const a=devOf(w.a.d),b=devOf(w.b.d);return a&&b&&termOf(a,w.a.t)&&termOf(b,w.b.t);});
  S.wires.forEach(w=>{for(const e of [w.a,w.b]){const k=key(e);use.set(k,(use.get(k)||0)+1);}});
  const seen=new Map();
  const off=(e)=>{const k=key(e),n=use.get(k)||1,i=seen.get(k)||0;seen.set(k,i+1);return (i-(n-1)/2)*1.7;};
  const ctr={h:0,g:0,hn:S.wires.filter(w=>{const a=devOf(w.a.d).sheet,b=devOf(w.b.d).sheet;return a!==b&&(a==='door'||b==='door');}).length};
  const center_=(_,d)=>center(d);
  const legsOf=(anchors,noDuct)=>{const L=[];for(let i=0;i<anchors.length-1;i++){const A=anchors[i],B=anchors[i+1];L.push(routeLeg(A,B,J,noDuct||(A.wp&&B.wp&&!A.bo&&!B.bo)));}return L;};
  const job=(id,g,anchors,legs,manual,od)=>({id,g,od,anchors,legs,manual,first:realize(id,anchors,legs,center_)});
  const items=[];
  S.wires.forEach(w=>{
    if(w.cab&&cabOf(w.cab)) return; // 電纜芯線另外算
    const anchors=buildAnchors(endpoint(w.a,off(w.a)),endpoint(w.b,off(w.b)),w.wps,ctr,w.gland);
    // 有中繼點：線一定經過每個中繼點的位置；中繼點與中繼點之間照點的位置直接連（手動），
    // 接點到第一個中繼點、最後一個中繼點到接點照樣自動走線槽
    const manual=w.wps.length>0;
    const it=job(w.id,w.gauge,anchors,legsOf(anchors,!!w.direct),manual);it.w=w;items.push(it);
  });
  // 電纜：外被從 A 端剝線點走到 B 端剝線點，每一芯從接點走到剝線點
  const cabJobs=[];
  (S.cables||[]).forEach(c=>{
    const cw=coresOf(c);if(!cw.length) return;
    const ea=cw.map(w=>endpoint(w.a,off(w.a))),eb=cw.map(w=>endpoint(w.b,off(w.b)));
    const side=(k,ends)=>{const o=c.bo&&c.bo[k];const p=o?{x:o.x,y:o.y,sheet:sheetAt(o)}:autoBO(ends,ends[0].sheet);return {x:p.x,y:p.y,sheet:p.sheet,inDuct:locate(p,p.sheet),wp:true,bo:true,auto:!o};};
    const A=side('a',ea),B=side('b',eb);
    const sa=buildAnchors(A,B,[],ctr,c.gland),sh=job('S:'+c.id,0,sa,legsOf(sa,false),false,cabOD(c));items.push(sh);
    const tails=cw.map((w,i)=>{
      const ta=buildAnchors(ea[i],{...A},[],ctr,null),tb=buildAnchors({...B},eb[i],[],ctr,null);
      const ja=job(w.id+'#a',w.gauge,ta,legsOf(ta,false),false),jb=job(w.id+'#b',w.gauge,tb,legsOf(tb,false),false);
      items.push(ja,jb);return {w,ja,jb};
    });
    cabJobs.push({c,A,B,sh,tails});
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
      else{const e={id:it.id,lo,hi,score:s,g:it.g,od:it.od};seenD.set(r.d,e);if(!perDuct.has(r.d))perDuct.set(r.d,[]);perDuct.get(r.d).push(e);}
    }
  }
  // 手動路徑：依實際線段落在哪條線槽，計入占用率（不分配線道）
  const manualUse=new Map(),manualVia=new Map();
  for(const it of items){
    if(!it.manual) continue;
    const pts=simplify(it.first.pts),via=[];
    const own=[];it.legs.forEach((L,i)=>{if(L.direct&&it.anchors[i].wp&&it.anchors[i+1].wp)own.push(...L.pts.map((q,j)=>j?[L.pts[j-1],q]:null).filter(Boolean));});
    const isOwn=(a,b)=>own.some(([p,q])=>Math.abs(p.x-a.x)+Math.abs(p.y-a.y)+Math.abs(q.x-b.x)+Math.abs(q.y-b.y)<.1);
    for(let i=1;i<pts.length;i++){
      const a=pts[i-1],b=pts[i];
      for(const d of S.ducts){
        const R={x:d.x-.5,y:d.y-.5,w:d.w+1,h:d.h+1};
        if(!inR(a,R)||!inR(b,R)) continue;
        const ax=axis(d),lo=Math.min(ax==='h'?a.x:a.y,ax==='h'?b.x:b.y),hi=Math.max(ax==='h'?a.x:a.y,ax==='h'?b.x:b.y);
        if(hi-lo<1) continue;
        if(!isOwn(a,b)) continue;
        if(!manualUse.has(d))manualUse.set(d,[]);manualUse.get(d).push({id:it.id,lo,hi,g:it.g});
        if(via[via.length-1]!==d.id)via.push(d.id);
      }
    }
    manualVia.set(it.id,via);
  }
  manualUse.forEach((l,d)=>{if(!perDuct.has(d))perDuct.set(d,[]);});
  // 線道分配只算自動那幾段；同一條線同一段線槽已經有自動線道時，手動段不重複計數
  manualUse.forEach((l,d)=>{const auto=new Set((perDuct.get(d)||[]).map(e=>e.id));manualUse.set(d,l.filter(e=>!auto.has(e.id)));});
  const lanes=new Map();
  for(const [d,list0] of perDuct){
    const list=list0,mlist=manualUse.get(d)||[];
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
    const ev=[];[...list,...mlist].forEach(e=>{const ar=Math.PI/4*(e.od||odOf(e.g))**2;ev.push([e.lo,ar],[e.hi+.01,-ar]);});
    ev.sort((x,y)=>x[0]-y[0]);let cur=0,peak=0;ev.forEach(([,v])=>{cur+=v;peak=Math.max(peak,cur);});
    const section=Math.min(d.w,d.h)*(d.dp||40);
    DUCTUSE.set(d.id,{n:list.length+new Set(mlist.map(e=>e.id)).size,lanes:T,pitch:T>1?Math.min(3.4,avail/(T-1)):3.4,pct:Math.round(peak/section*100)});
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
  const FIN=new Map();
  for(const it of items){
    const f=realize(it.id,it.anchors,it.legs,(id,d)=>lanes.get(id+'|'+d.id)??center(d));
    const pts=simplify(f.pts);
    let len=0;for(let i=1;i<pts.length;i++)len+=Math.abs(pts[i].x-pts[i-1].x)+Math.abs(pts[i].y-pts[i-1].y);
    const via=[];f.runs.forEach(r=>{if(via[via.length-1]!==r.d.id)via.push(r.d.id);});
    if(it.manual)(manualVia.get(it.id)||[]).forEach(id=>{if(!via.includes(id))via.push(id);});
    let warn=(it.legs.find(l=>l.warn)||{}).warn||null;
    if(it.manual&&warn==='直接拉線穿過其他器具')warn='手動路徑穿過其他器具';
    const g=it.anchors.find(a=>a.gland);
    FIN.set(it.id,{pts,len,via,warn,gland:g?g.gland:null});
    if(it.w){ROUTES_MANUAL.add(it.manual?it.w.id:null);ROUTES.set(it.w.id,FIN.get(it.id));}
  }
  cabJobs.forEach(({c,A,B,sh,tails})=>{
    const S0=FIN.get(sh.id);
    CABROUTES.set(c.id,{...S0,a:{x:A.x,y:A.y,auto:A.auto},b:{x:B.x,y:B.y,auto:B.auto}});
    tails.forEach(({w,ja,jb})=>{
      const ra=FIN.get(ja.id),rb=FIN.get(jb.id),parts=[ra,S0,rb],via=[];
      parts.forEach(p=>p.via.forEach(id=>{if(via[via.length-1]!==id)via.push(id);}));
      const warn=(parts.find(p=>p.warn)||{}).warn||null;
      ROUTES.set(w.id,{pts:simplify([...ra.pts,...S0.pts,...rb.pts]),len:ra.len+S0.len+rb.len,via,warn,gland:S0.gland,cab:c.id,parts:[ra.pts,S0.pts,rb.pts],tails:[ra.pts,rb.pts]});
    });
  });
  ISSUES=computeIssues();
}
function previewPts(a,wps,end,noDuct){
  const J=junctions();
  const anchors=buildAnchors(endpoint(a,0),end,wps,{h:0,g:0,hn:1},null);
  const legs=[];for(let i=0;i<anchors.length-1;i++) legs.push(routeLeg(anchors[i],anchors[i+1],J,noDuct||wps.length>0));
  return simplify(realize('_',anchors,legs,(_,d)=>center(d)).pts);
}


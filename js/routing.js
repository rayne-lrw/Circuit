"use strict";
/* ---------- 走線：線槽路網 ---------- */
function junctions(){
  const J=[];
  for(const h of S.ducts) if(axis(h)==='h') for(const v of S.ducts) if(axis(v)==='v'&&v.sheet===h.sheet){
    // 外框碰到或重疊就算相接（容許 10 mm 間隙，畫線槽時沒對齊也接得上），包含水平線槽頂在垂直線槽側邊的 T 字接法；轉角在兩條中心線的交點
    const x=center(v),y=center(h),tol=10;
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
    const t=tplOf(d);if(t.noOv||t.sym==='diode') continue; // 二極體很小，導線不把它當成阻擋
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
    if(P.gland&&P.side&&dir!==OPP[P.side]) cost+=300; // 出線口：進箱後優先直直往箱內走，不沿著箱壁橫移
    out.push({duct:best,along:ba,cost,blocked});
  }
  // 正前方、正下方都沒對到、但轉一個彎就能進的最近線槽（例如線槽在斜前方）：也列為候選，稍微加一點代價
  for(const d of S.ducts){
    if(d.sheet!==P.sheet) continue;
    const h=axis(d)==='h',cl=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
    const ex=cl(P.x,d.x+2,d.x+d.w-2),ey=cl(P.y,d.y+2,d.y+d.h-2);
    // 進入點：沿線槽寬度方向貼著線槽邊；先沿線槽長邊方向移到範圍內，再轉進去（和實際畫出來的走法一樣）
    const inX=P.x>=d.x&&P.x<=d.x+d.w,inY=P.y>=d.y&&P.y<=d.y+d.h;
    if(h?inX:inY) continue; // 已經正對著，上面的方向搜尋會處理
    const corner=h?{x:ex,y:P.y}:{x:P.x,y:ey},entry=h?{x:ex,y:P.y<d.y?d.y:d.y+d.h}:{x:P.x<d.x?d.x:d.x+d.w,y:ey};
    const first=h?(ex>P.x?'right':'left'):(ey>P.y?'bottom':'top');
    if(P.dev&&P.side&&first===OPP[P.side]) continue;
    if(P.backOf&&first===P.backOf) continue;
    const dist=Math.abs(corner.x-P.x)+Math.abs(corner.y-P.y)+Math.abs(entry.x-corner.x)+Math.abs(entry.y-corner.y);
    const ex2=P.dev?famIds(P.dev):null,blocked=!!(segHits(P.x,P.y,corner.x,corner.y,ex2)||segHits(corner.x,corner.y,entry.x,entry.y,ex2));
    let cost=dist+40+(blocked?3000:0);if(P.side&&first!==P.side)cost+=500;
    out.push({duct:d,along:h?ex:ey,cost,blocked});
  }
  return out;
}
// 從某個進線槽位置到每個線槽轉角的最短距離（和 ductPath 同樣算法，但一次算完所有轉角，查表用）
function ductDist(a,J){
  const n=J.length,dist=new Array(n).fill(Infinity),done=new Array(n).fill(false);
  J.forEach((j,i)=>{if(onD(j,a.duct))dist[i]=Math.abs(along(j,a.duct)-a.along)+20;});
  for(let c=0;c<n;c++){let u=-1;for(let i=0;i<n;i++)if(!done[i]&&dist[i]<Infinity&&(u<0||dist[i]<dist[u]))u=i;if(u<0)break;done[u]=true;
    for(let i=0;i<n;i++){if(done[i]||i===u)continue;const s=[J[u].h,J[u].v].find(d=>onD(J[i],d));if(!s)continue;const w=dist[u]+Math.abs(along(J[u],s)-along(J[i],s))+20;if(w<dist[i])dist[i]=w;}}
  // 到某條線槽上某個位置的距離
  return c=>{if(c.duct===a.duct)return Math.abs(a.along-c.along);let b=Infinity;for(let i=0;i<n;i++)if(dist[i]<Infinity&&onD(J[i],c.duct))b=Math.min(b,dist[i]+Math.abs(along(J[i],c.duct)-c.along));return b;};
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
  // 器具裝在箱外時，不從箱體那一側繞（會繞進箱子裡）
  const o=boxOrigin(),inBoxX=v=>v>o.x&&v<o.x+S.box.w,inBoxY=v=>v>o.y&&v<o.y+S.box.h,ob=B.sheet==='plate'&&outBox(B);
  if(s==='top'||s==='bottom'){let c=[r.x-STUB,r.x+r.w+STUB].sort((p,q)=>Math.abs(A.x-p)-Math.abs(A.x-q));if(ob&&inBoxX(c[0])&&!inBoxX(c[1])&&inBoxY(B.y))c.reverse();const lx=c[0];return [A,{x:lx,y:A.y},{x:lx,y:B.y},B];}
  let c=[r.y-STUB,r.y+r.h+STUB].sort((p,q)=>Math.abs(A.y-p)-Math.abs(A.y-q));if(ob&&inBoxY(c[0])&&!inBoxY(c[1]))c.reverse();const ly=c[0];return [A,{x:A.x,y:ly},{x:B.x,y:ly},B];
}
function directPts(A,B){
  if(B.stub&&!A.stub||(B.stub&&A.stub&&A.dev!==B.dev)){const p=aroundPts(A,B);if(p)return p;}
  if(A.stub&&!B.stub){const p=aroundPts(B,A);if(p)return p.reverse();}
  // 現場的自動剝線點：外皮從器具另一側過來時沿器具外圍繞過去（芯線那段是同一台器具，不套用）
  if(B.boDev&&A.dev!==B.boDev&&!A.boDev){const p=aroundPts(A,{...B,dev:B.boDev,side:B.boSide});if(p)return p;}
  if(A.boDev&&B.dev!==A.boDev&&!B.boDev){const p=aroundPts(B,{...A,dev:A.boDev,side:A.boSide});if(p)return p.reverse();}
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
// 箱外（現場區、箱子旁邊）的線段不可以穿過箱體：直角線會穿過時，改走另一個方向的直角，或沿箱子外側（離箱壁 12 mm）繞過去，取最短的
function crossBox(pts){const o=boxOrigin(),x0=o.x+.5,x1=o.x+S.box.w-.5,y0=o.y+.5,y1=o.y+S.box.h-.5;
  for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i];if(Math.max(a.x,b.x)>x0&&Math.min(a.x,b.x)<x1&&Math.max(a.y,b.y)>y0&&Math.min(a.y,b.y)<y1)return true;}return false;}
function avoidBox(A,B){
  const o=boxOrigin(),m=12,L=o.x-m,R=o.x+S.box.w+m,T=o.y-m,D=o.y+S.box.h+m,len=p=>p.reduce((s,q,i)=>i?s+Math.abs(q.x-p[i-1].x)+Math.abs(q.y-p[i-1].y):0,0);
  const c=[[A,{x:A.x,y:B.y},B],[A,{x:B.x,y:A.y},B],...[T,D].map(Y=>[A,{x:A.x,y:Y},{x:B.x,y:Y},B]),...[L,R].map(X=>[A,{x:X,y:A.y},{x:X,y:B.y},B]),
    // 兩點在箱子的對角兩側：繞過一個角
    ...[[L,T],[R,T],[L,D],[R,D]].flatMap(([X,Y])=>[[A,{x:A.x,y:Y},{x:X,y:Y},{x:X,y:B.y},B],[A,{x:X,y:A.y},{x:X,y:Y},{x:B.x,y:Y},B]])];
  return c.filter(p=>!crossBox(p)).sort((a,b)=>len(a)-len(b))[0]||null;
}
// pts[0] 是出線口外面那一點：第一段是很短的橫移、第二段沿出線口方向，就把橫移推到第二段的盡頭；推完如果在同一條線上來回，拿掉中間那點
function slideJog(pts,side,ok){
  if(pts.length<3)return pts;const v=side==='top'||side==='bottom',G=pts[0],P1=pts[1],P2=pts[2];
  const jog=v?(Math.abs(G.y-P1.y)<.01&&Math.abs(G.x-P1.x)>.05&&Math.abs(G.x-P1.x)<25&&Math.abs(P1.x-P2.x)<.01):(Math.abs(G.x-P1.x)<.01&&Math.abs(G.y-P1.y)>.05&&Math.abs(G.y-P1.y)<25&&Math.abs(P1.y-P2.y)<.01);
  if(!jog)return pts;
  let r=[G,v?{x:G.x,y:P2.y}:{x:P2.x,y:G.y},...pts.slice(2)];
  for(let i=1;i<r.length-1;i++){const a=r[i-1],b=r[i],c=r[i+1],h=Math.abs(a.y-b.y)<.01&&Math.abs(b.y-c.y)<.01,w=Math.abs(a.x-b.x)<.01&&Math.abs(b.x-c.x)<.01;
    if((h&&(b.x-a.x)*(c.x-b.x)<=0)||(w&&(b.y-a.y)*(c.y-b.y)<=0)||(Math.abs(a.x-b.x)<.01&&Math.abs(a.y-b.y)<.01)){r.splice(i,1);i--;}}
  return ok(r)?r:pts; // 推上去會穿過器具或箱體（原本的橫移是在避開東西）：維持原樣
}
function routeLeg(A,B,J,noDuct){
  // 兩點都在箱外：直接連，會穿過箱體就繞過去（箱外沒有線槽）
  // 箱外有線槽時才找線槽走；但一端是使用者放的中繼點（不在線槽裡）時，照中繼點直接連（中繼點就是使用者指定的路線）
  const fieldDucts=A.sheet==='field'&&S.ducts.some(d=>d.sheet==='field')&&!((A.wp&&!A.bo&&!A.inDuct)||(B.wp&&!B.bo&&!B.inDuct));
  if(A.sheet==='field'&&B.sheet==='field'&&!(A.dev&&B.dev&&A.dev===B.dev)&&!fieldDucts){let d=directPts(A,B);
    if(crossBox(d)){const q=avoidBox(A,B);if(q)d=q;}
    // 出線口正外面的小折角（同一個出線口多條線錯開造成）：推到下一個轉角合併，不在出線口正上方小折一下
    const okp=p=>!crossBox(p)&&clean(p,A,B,true);
    if(A.gout)d=slideJog(d,A.gout,okp);if(B.gout)d=slideJog(d.slice().reverse(),B.gout,okp).reverse();
    return {direct:true,pts:d};}
  // 線圈二極體到線圈的自動短線：直接轉一個彎接過去，不照接點方向繞
  if(A.dev&&B.dev&&(tplOf(devOf(A.dev)).coil||tplOf(devOf(B.dev)).coil)&&famIds(A.dev).includes(B.dev)) return {direct:true,pts:Math.abs(A.x-B.x)<.01||Math.abs(A.y-B.y)<.01?[A,B]:[A,{x:A.x,y:B.y},B]};
  if(A.dev&&B.dev&&A.sheet===B.sheet&&famIds(A.dev).includes(B.dev)&&!A.stub&&!B.stub) return {direct:true,pts:directPts(A,B)};
  if((B.stub&&!A.stub&&A.dev===B.dev)||(A.stub&&!B.stub&&A.dev===B.dev)){ // 接點↔出線點；有偏移時先在接點旁橫移再轉出去
    const T=A.stub?B:A,Q=A.stub?A:B;if(!(T.ox||T.oy)||Math.abs(T.x-Q.x)<.01||Math.abs(T.y-Q.y)<.01) return {direct:true,pts:[A,B]};
    const v=T.side==='top'||T.side==='bottom',m=v?{x:Q.x,y:T.y}:{x:T.x,y:Q.y};return {direct:true,pts:A.stub?[A,m,B]:[A,m,B]};}
  if(A.sheet!==B.sheet) return {direct:true,pts:directPts(A,B)};
  // 指定不進線槽（例如動力線直接拉）：直接連到下一點，穿過其他器具時提示
  if(noDuct){
    let d=directPts(A,B);
    if(A.sheet==='plate'&&!clean(d,A,B,true)){
      const V={top:[0,1],bottom:[0,-1],left:[1,0],right:[-1,0]},alt=[];
      if(A.gland&&A.side&&V[A.side]){const v=V[A.side],q={x:A.x+v[0]*6,y:A.y+v[1]*6};alt.push(v[1]?[A,q,{x:B.x,y:q.y},B]:[A,q,{x:q.x,y:B.y},B]);}
      if(B.gland&&B.side&&V[B.side]){const v=V[B.side],q={x:B.x+v[0]*6,y:B.y+v[1]*6};alt.push(v[1]?[A,{x:A.x,y:q.y},q,B]:[A,{x:q.x,y:A.y},q,B]);}
      if(!A.gland&&!B.gland)alt.push([A,{x:B.x,y:A.y},B],[A,{x:A.x,y:B.y},B]);
      const ok=alt.find(p=>clean(p,A,B,true));if(ok)d=ok;
    }
    return {direct:true,pts:d,warn:A.sheet==='plate'&&!clean(d,A,B,true)?'直接拉線穿過其他器具':null};}
  if(!A.inDuct&&!B.inDuct&&!A.must&&!B.must){
    const d=directPts(A,B), ok=clean(d,A,B)&&!(A.sheet==='field'&&crossBox(d)), m=Math.abs(A.x-B.x)+Math.abs(A.y-B.y);
    // 箱內：兩端都是器具時，近的（95 mm 內）才直接拉；箱外有線槽時同樣規則，其他都先找線槽走（找不到才直接拉）
    if(ok&&(fieldDucts?(A.dev&&B.dev&&m<=95):(!(A.dev&&B.dev)||m<=95))) return {direct:true,pts:d};
  }
  let best=null;
  for(const a of exits(A)) for(const b of exits(B)){
    const p=ductPath(a,b,J); if(!p) continue;
    const cost=a.cost+b.cost+p.cost;
    if(!best||cost<best.cost) best={cost,ducts:p.ducts,blocked:a.blocked||b.blocked};
  }
  if(!best){let d=directPts(A,B);if(A.sheet==='field'&&crossBox(d)){const q=avoidBox(A,B);if(q)d=q;}return {direct:true,pts:d,warn:A.sheet==='plate'?'無線槽可走':null};} // 面板與現場本來就不一定有線槽
  // 箱外：線槽只是順路才走。走線槽比直接拉遠很多（超過 1.3 倍再加 50 mm），或要穿過器具才進得了線槽，就直接拉；箱外不發穿過器具的警告
  if(A.sheet==='field'){
    const len=p=>p.reduce((s,q,i)=>i?s+Math.abs(q.x-p[i-1].x)+Math.abs(q.y-p[i-1].y):0,0);
    let d=directPts(A,B);if(crossBox(d)){const q=avoidBox(A,B);if(q)d=q;}
    const viaD=len(realize('_',[A,B],[{ducts:best.ducts}],(_,x)=>center(x)).pts);
    if(best.blocked||viaD>len(d)*1.3+50) return {direct:true,pts:d};
    return {ducts:best.ducts,warn:null};
  }
  return {ducts:best.ducts,warn:best.blocked?'穿過其他器具':null};
}
function realize(wid,anchors,legs,lane0){
  // 中繼點只落在一條線槽裡：這條線在那條線槽裡沿中繼點的位置走（進出都一樣，不會橫移再折回）；
  // 落在兩條線槽交界時不改，只橫移經過
  const ovr=new Map();
  // 自動剝線點已經移到外皮的線道上：芯線和外皮在那條線槽都走剝線點的位置（手動移過的剝線點照舊不改線道）；同一條線槽裡使用者放的中繼點優先
  [...anchors.filter(a=>!a.bo),...anchors.filter(a=>a.bo)].forEach(a=>{if(!a.wp||(a.bo&&a.auto===false)||!a.inDuct||ovr.has(a.inDuct))return;if(S.ducts.filter(d=>d.sheet===a.sheet&&inR(a,d)).length!==1)return;ovr.set(a.inDuct,axis(a.inDuct)==='h'?a.y:a.x);});
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
        // 從出線口進箱、要從線槽端頭進去：先往箱內直走到線道再橫移（沒撞到器具時）；
        // 會撞到就至少先往內退 6 mm，不貼著箱壁邊線橫走
        const G=anchors[i];
        if(G&&G.gland&&G.side&&((axis(d)==='h'&&(cur.x<d.x||cur.x>d.x+d.w))||(axis(d)==='v'&&(cur.y<d.y||cur.y>d.y+d.h)))){
          const h=axis(d)==='h',endA=h?(cur.x<d.x?d.x+2:d.x+d.w-2):(cur.y<d.y?d.y+2:d.y+d.h-2);
          const q1=h?{x:cur.x,y:c}:{x:c,y:cur.y},q2=h?{x:endA,y:c}:{x:c,y:endA};
          const inward=h?(G.side==='top'||G.side==='bottom'):(G.side==='left'||G.side==='right');
          if(inward&&!segHits(cur.x,cur.y,q1.x,q1.y)&&!segHits(q1.x,q1.y,q2.x,q2.y)){pts.push(q1,q2);cur=q2;}
          else{const v={top:[0,1],bottom:[0,-1],left:[1,0],right:[-1,0]}[G.side];const q={x:cur.x+v[0]*6,y:cur.y+v[1]*6};pts.push(q);cur=q;}
        }
        const W=anchors[i],hh=axis(d)==='h',offL=hh?(cur.x<d.x||cur.x>d.x+d.w):(cur.y<d.y||cur.y>d.y+d.h),offS=hh?(cur.y<d.y||cur.y>d.y+d.h):(cur.x<d.x||cur.x>d.x+d.w);
        if(W&&W.wp&&!W.bo&&!W.gland&&offL&&offS){
          const e=hh?(cur.x<d.x?d.x+2:d.x+d.w-2):(cur.y<d.y?d.y+2:d.y+d.h-2),q1=hh?{x:cur.x,y:c}:{x:c,y:cur.y},q2=hh?{x:e,y:c}:{x:c,y:e};
          if(!segHits(cur.x,cur.y,q1.x,q1.y)&&!segHits(q1.x,q1.y,q2.x,q2.y)){pts.push(q1,q2);cur=q2;}
        }
        if(axis(d)==='h'&&(cur.x<d.x||cur.x>d.x+d.w)){const q={x:cur.x<d.x?d.x+2:d.x+d.w-2,y:cur.y};pts.push(q);cur=q;}
        else if(axis(d)==='v'&&(cur.y<d.y||cur.y>d.y+d.h)){const q={x:cur.x,y:cur.y<d.y?d.y+2:d.y+d.h-2};pts.push(q);cur=q;}
      }
      const p=axis(d)==='h'?{x:cur.x,y:c}:{x:c,y:cur.y};
      pts.push(p);cur=p;
      if(open){open.i1=pts.length-1;runs.push(open);}
      open={d,i0:pts.length-1};last=d;
    }
    // 從線槽端頭出去接到出線口：沿線道直走到出線口正下（或正旁）方再往箱壁出去；會撞到器具就先在離箱壁 6 mm 處橫移，不貼著箱壁邊線
    if(!to.inDuct&&to.gland&&to.side&&((axis(last)==='h'&&(to.x<last.x||to.x>last.x+last.w))||(axis(last)==='v'&&(to.y<last.y||to.y>last.y+last.h)))){
      const h=axis(last)==='h',q1=h?{x:to.x,y:cur.y}:{x:cur.x,y:to.y};
      const inward=h?(to.side==='top'||to.side==='bottom'):(to.side==='left'||to.side==='right');
      if(inward&&!segHits(cur.x,cur.y,q1.x,q1.y)&&!segHits(q1.x,q1.y,to.x,to.y)){pts.push(q1);cur=q1;}
      else{const v={top:[0,1],bottom:[0,-1],left:[1,0],right:[-1,0]}[to.side],e=h?(to.x<last.x?last.x+2:last.x+last.w-2):(to.y<last.y?last.y+2:last.y+last.h-2);
        const iw={x:to.x+v[0]*6,y:to.y+v[1]*6},q2=h?{x:e,y:cur.y}:{x:cur.x,y:e},q3=h?{x:e,y:iw.y}:{x:iw.x,y:e};pts.push(q2,q3,iw);cur=iw;}
      if(open){open.i1=pts.length-1;runs.push(open);open=null;}pts.push({x:to.x,y:to.y});cur=to;last=null;return;
    }
    // 出線槽往斜對面的中繼點：沿線道直接出端頭走到中繼點正下（旁）方再轉過去，不先在端頭轉彎再橫移（沒撞到器具時）
    {const hh=axis(last)==='h',offL=hh?(to.x<last.x||to.x>last.x+last.w):(to.y<last.y||to.y>last.y+last.h),offS=hh?(to.y<last.y||to.y>last.y+last.h):(to.x<last.x||to.x>last.x+last.w);
     if(to.wp&&!to.bo&&!to.gland&&!to.inDuct&&offL&&offS){const q=hh?{x:to.x,y:cur.y}:{x:cur.x,y:to.y};
       if(!segHits(cur.x,cur.y,q.x,q.y)&&!segHits(q.x,q.y,to.x,to.y)){pts.push(q);if(open){open.i1=pts.length-1;runs.push(open);open=null;}pts.push({x:to.x,y:to.y});cur=to;last=null;return;}}}
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
// 拿掉同一直線上折回的點（fixed 裡的點是必經點，不拿）
function unfold(pts,fixed){
  const isFix=b=>fixed.some(f=>Math.abs(f.x-b.x)<.6&&Math.abs(f.y-b.y)<.6);
  for(let guard=0;guard<50;guard++){let hit=-1;
    for(let i=1;i<pts.length-1;i++){const a=pts[i-1],b=pts[i],c=pts[i+1];if(isFix(b))continue;
      if((Math.abs(a.y-b.y)<.01&&Math.abs(b.y-c.y)<.01&&(b.x-a.x)*(c.x-b.x)<0)||(Math.abs(a.x-b.x)<.01&&Math.abs(b.x-c.x)<.01&&(b.y-a.y)*(c.y-b.y)<0)){hit=i;break;}}
    if(hit<0)break;pts=simplify([...pts.slice(0,hit),...pts.slice(hit+1)]);}
  return pts;
}
const plen=p=>p.reduce((s,q,i)=>i?s+Math.abs(q.x-p[i-1].x)+Math.abs(q.y-p[i-1].y):s,0);
// T 是芯線尾段（從接點走到剝線點，最後一點是剝線點），nx 是外皮離開剝線點的下一點。尾段最後一小段（5 mm 內）和外皮方向相反時，把它前面那一橫段平移到剝線點上；回傳新的尾段，不用改就回傳 null
function joinFix(T,nx){const n=T.length;if(n<4)return null;const u=T[n-3],a=T[n-2],b=T[n-1];
  const vt=Math.abs(a.x-b.x)<.01&&Math.abs(b.x-nx.x)<.01,hz=Math.abs(a.y-b.y)<.01&&Math.abs(b.y-nx.y)<.01;if(!vt&&!hz)return null;
  const k=vt?'y':'x';if((b[k]-a[k])*(nx[k]-b[k])>=0||Math.abs(a[k]-b[k])>5||Math.abs(u[k]-a[k])>.01)return null;
  return simplify([...T.slice(0,n-3),{...u,[k]:b[k]},{...a,[k]:b[k]},b]);}
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
  return {x:d.x+t.x+(v?off:0),y:d.y+t.y+(v?0:off),side:t.side,dev:d.id,sheet:d.sheet,ox:t.ox||0,oy:t.oy||0};
}
function wpAnchor(p){const s=sheetAt(p);return {x:p.x,y:p.y,sheet:s,inDuct:locate(p,s),wp:true};}
function gates(from,to,ctr,fieldP,glandId){
  if(from==='field'||to==='field'){
    // 沒指定就選離現場設備最近的出線口
    const dist=g=>{const P=glandPt(g);return Math.hypot(P.x-fieldP.x,P.y-fieldP.y);};
    // 指定的出線口優先，其次是現場設備（或箱外器具）設定的預設出線口，都沒有就選最近的
    const dg=fieldP.dev&&devOf(fieldP.dev),gid=glandId||(dg&&dg.gland);
    const g=(gid&&S.glands.find(x=>x.id===gid))||S.glands.reduce((b,x)=>!b||dist(x)<dist(b)?x:b,null);
    // 同一個出線口的多條線在出線口直徑範圍內錯開（M20 約 ±4 mm），外面再依序往外拉開，不會偏到出線口旁邊
    const i=ctr.g++,k=(i%24)*2.2,sp=((i%8)-3.5)*1.1,by=boxBottom();
    const o=boxOrigin(),W=S.box.w,H=S.box.h,fp=(fieldP.dev&&stubOf(fieldP))||fieldP;
    // 箱底出線口、對方在箱子下方：照原本的走法（往下出去）
    if((!g||(g.side||'bottom')==='bottom')&&fp.y>by){
      const gx=g?g.x:S.plate.w/2;
      return [{x:gx+sp,y:by,sheet:'plate',must:true,side:'bottom',midY:by+12+k,gland:g?g.id:null}];
    }
    const P=g?glandPt(g):{x:S.plate.w/2,y:by,side:'bottom',nx:0,ny:1};
    const a={x:P.x+(P.ny?sp:0),y:P.y+(P.nx?sp:0),sheet:'plate',must:true,side:P.side,gland:g?g.id:null};
    // 對方在出線口那一面的外側：出去後直接過去。往外拉的距離不超過對方離箱壁的距離，不會拉出去又折回來（翹一段）
    const beyond={top:fp.y<o.y,bottom:fp.y>o.y+H,left:fp.x<o.x,right:fp.x>o.x+W};
    const m=12+k;
    if(beyond[P.side]){
      const far=(fp.x-a.x)*P.nx+(fp.y-a.y)*P.ny,ext=far<=0?m:Math.min(m,Math.max(.5,far));
      const pts=[a,{x:a.x+P.nx*ext,y:a.y+P.ny*ext,sheet:'field',side:null,gout:P.side}];
      return from==='field'?pts.reverse():pts;
    }
    // 對方在別的面：出去後沿著箱體外圍（離箱壁 m）繞到對方那一面，不穿過箱體、不貼著箱壁
    const out={x:a.x+P.nx*m,y:a.y+P.ny*m,sheet:'field',side:null},R={x0:o.x-m,y0:o.y-m,x1:o.x+W+m,y1:o.y+H+m};
    const hs=v=>v==='left'||v==='right',cx=v=>v==='left'?R.x0:R.x1,cy=v=>v==='top'?R.y0:R.y1;
    const corner=(u,v)=>hs(u)?{x:cx(u),y:cy(v)}:{x:cx(v),y:cy(u)};
    const opp={top:'bottom',bottom:'top',left:'right',right:'left'}[P.side],adj=hs(P.side)?['top','bottom']:['left','right'];
    const t=adj.find(v=>beyond[v])||opp,cs=[];
    if(t!==opp) cs.push(corner(P.side,t));
    else{const via=adj.map(v=>[corner(P.side,v),corner(t,v)]).sort((p,q)=>(Math.abs(p[0].x-out.x)+Math.abs(p[0].y-out.y)+Math.abs(p[1].x-fp.x)+Math.abs(p[1].y-fp.y))-(Math.abs(q[0].x-out.x)+Math.abs(q[0].y-out.y)+Math.abs(q[1].x-fp.x)+Math.abs(q[1].y-fp.y)))[0];cs.push(...via);}
    const pts=[a,out,...cs.map(q=>({x:q.x,y:q.y,sheet:'field',side:null}))];
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
  // 有出線偏移的接點（例如 16EX）：先橫移到偏移位置，再沿出線方向出去
  const q={x:P.x+(P.ox||0)+(s==='left'?-L:s==='right'?L:0),y:P.y+(P.oy||0)+(s==='top'?-L:s==='bottom'?L:0),sheet:P.sheet,side:s,dev:P.dev,stub:true,ox:P.ox,oy:P.oy};
  // 箱外器具的出線點不可落進箱體（例如裝在箱頂、接點朝下）：停在箱壁外 1 mm
  if(outBox(P)){const o=boxOrigin(),B={x:o.x,y:o.y,w:S.box.w,h:S.box.h};if(inR(q,B)){if(s==='bottom')q.y=Math.max(P.y,o.y-1);else if(s==='top')q.y=Math.min(P.y,o.y+S.box.h+1);else if(s==='right')q.x=Math.max(P.x,o.x-1);else q.x=Math.min(P.x,o.x+S.box.w+1);}}
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
// 裝在箱體外面的器具（例如箱頂的端子台、回生電阻）：和箱內器具之間的線要經過出線口，跟現場設備一樣
function outBox(P){
  if(P.sheet!=='plate'||!P.dev) return false;
  const d=devOf(P.dev);if(!d) return false;const r=rectOf('dev',d),o=boxOrigin();
  return r.x>=o.x+S.box.w-.01||r.x+r.w<=o.x+.01||r.y>=o.y+S.box.h-.01||r.y+r.h<=o.y+.01;
}
function buildAnchors(ea,eb,wps,ctr,glandId){
  const sa=outBox(ea)?'field':ea.sheet,sb=outBox(eb)?'field':eb.sheet;
  const chain=sa===sb?[sa]:(sa!=='plate'&&sb!=='plate')?[sa,'plate',sb]:[sa,sb];
  const fieldP=sa==='field'?ea:eb;
  // 同一組器具（主體與正面附件、伺服電池）之間的線直接在器具前面連，不拉出線點
  const fam=ea.dev&&eb.dev&&ea.sheet===eb.sheet&&famIds(ea.dev).includes(eb.dev);
  // 外線（一端在現場或箱外）：中繼點在箱子外面就算箱外的點（排在出線口之前），即使不在現場區裡
  const ext=chain.includes('field'),BX={...boxOrigin(),w:S.box.w,h:S.box.h};
  const wpA=p=>{const a=wpAnchor(p);if(ext&&a.sheet==='plate'&&!inR(p,BX)){a.sheet='field';a.inDuct=null;}return a;};
  const w0=wps.length?wpA(wps[0]):null,w1=wps.length?wpA(wps[wps.length-1]):null;
  const out=[ea];let qa=fam?null:(backStub(ea,w0)||stubOf(ea)),qb=fam?null:(backStub(eb,w1)||stubOf(eb));
  // 兩個接點面對面、距離近到兩邊的出線點會交錯（例如兩台小器具並排）：出線點都改到兩點正中間，直接連過去，不會誤以為要繞到對方背面
  if(qa&&qb&&!wps.length&&sa===sb&&ea.dev!==eb.dev&&qa.stub&&qb.stub){
    const V={top:[0,-1],bottom:[0,1],left:[-1,0],right:[1,0]},va=V[ea.side],vb=V[eb.side];
    if(va&&vb&&va[0]===-vb[0]&&va[1]===-vb[1]){
      const gap=(eb.x-ea.x)*va[0]+(eb.y-ea.y)*va[1],over=(qb.x-qa.x)*va[0]+(qb.y-qa.y)*va[1];
      if(gap>0&&over<0){const m=va[0]?{x:(ea.x+eb.x)/2}:{y:(ea.y+eb.y)/2};qa={...qa,...m};qb={...qb,...m};}
    }else if(va&&vb&&va[0]!==-vb[0]){
      // 兩個接點方向互相垂直、一邊的出線點拉得比另一邊的出線點還遠（還沒越過器具邊緣）：縮回到和另一邊齊平，直接轉一個彎過去
      const pull=(Q,e,P)=>{const v=V[e.side],d=devOf(e.dev);if(!d)return Q;const r=rectOf('dev',d),back=-((P.x-Q.x)*v[0]+(P.y-Q.y)*v[1]),
        gap={left:r.x-Q.x,right:Q.x-(r.x+r.w),top:r.y-Q.y,bottom:Q.y-(r.y+r.h)}[e.side];
        return back>.01&&back<gap?{...Q,...(v[0]?{x:P.x}:{y:P.y})}:Q;};
      qb=pull(qb,eb,qa);qa=pull(qa,ea,qb);
    }
  }
  if(fam&&!wps.length){out.push(eb);out.local=true;return out;}
  if(qa) out.push(qa);
  chain.forEach((sh,i)=>{
    wps.forEach(p=>{const a=wpA(p);if(a.sheet===sh)out.push(a);});
    if(i<chain.length-1){
      // 有箱外的中繼點：沿箱子外圍繞到出線口要從離出線口最近的那個中繼點算起（不然中繼點到出線口那段會穿過箱子）
      const fw=wps.map(wpA).filter(a=>a.sheet==='field'),near=sh==='field'?fw[fw.length-1]:chain[i+1]==='field'?fw[0]:null;
      const gid=glandId||(fieldP.dev&&devOf(fieldP.dev)&&devOf(fieldP.dev).gland)||null;
      gates(sh,chain[i+1],ctr,near?{x:near.x,y:near.y,sheet:'field'}:fieldP,gid).forEach(x=>out.push(x));
    }
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
  S.ducts.forEach(d=>{
    // 箱外線槽（走線架、浪管）不在底板上：只檢查有沒有壓到箱體
    if(d.virtual)return;
    if(d.sheet==='field'){if(overlap(rectOf('duct',d),BX)) out.push({t:`箱外線槽 ${d.id} 壓到箱體，請移到箱子外面`,k:'duct',id:d.id});return;}
    if(outside(rectOf('duct',d),d.sheet==='door'?D0:P0)) out.push({t:`線槽 ${d.id} 超出${d.sheet==='door'?doorShort():'底板'}`,k:'duct',id:d.id});});
  S.devices.forEach((a,i)=>{
    if(a.sheet==='field'||tplOf(a).noOv||tplOf(a).sym==='diode') return;
    const ra=rectOf('dev',a);
    S.devices.slice(i+1).forEach(b=>{if(a.on===b.id||b.on===a.id||(a.on&&a.on===b.on)||tplOf(b).sym==='diode')return;if(b.sheet===a.sheet&&!tplOf(b).noOv&&overlap(ra,rectOf('dev',b))) out.push({t:`${a.tag} 與 ${b.tag} 重疊`,k:'dev',id:a.id});});
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
    const u=DUCTUSE.get(d.id);if(!u||d.virtual) return;
    if(u.pct>S.fillLimit) out.push({t:`線槽 ${d.id} 占用 ${u.pct}%，超過上限 ${S.fillLimit}%`,k:'duct',id:d.id});
    // 線道多到畫面上靠得很近只是顯示問題，不列在檢查清單（選取線槽時在右側說明）
  });
  S.wires.forEach(w=>{const r=ROUTES.get(w.id);if(r&&r.warn) out.push({t:`${wireRef(w)} ${r.warn}`,k:'wire',id:w.id});});
  // 有中繼點的線在同一條直線上沿原路折返：多半是中繼點放的位置讓線跑過頭再回來
  // 自我檢查：路徑在同一條直線上折回、外線穿過箱壁的次數不對。分清楚是中繼點（使用者放的）造成，還是程式走線不理想
  const BXR={...boxOrigin(),w:S.box.w,h:S.box.h},cabSeen=new Set();
  S.wires.forEach(w=>{const r=ROUTES.get(w.id);if(!r)return;const c=w.cab&&cabOf(w.cab);
    if(c){if(cabSeen.has(c.id))return;
      // 照折返的那一點判斷原因：中繼點、手動移過的剝線點、自動剝線點，或程式走線
      const f=foldAt(r.pts);if(f){cabSeen.add(c.id);const R=CABROUTES.get(c.id),on=q=>q&&Math.abs(q.x-f.x)<1.5&&Math.abs(q.y-f.y)<1.5;
        const why=(c.wps||[]).some(on)?'在外皮的中繼點沿原路折返，建議移動或清除中繼點':['a','b'].some(k=>c.bo&&c.bo[k]&&R&&on(R[k]))?'在手動移過的剝線點沿原路折返，建議把剝線點改回自動或移到外皮要去的那一側':R&&['a','b'].some(k=>on(R[k]))?'的芯線在剝線點沿原路折返，可以拖曳剝線點到外皮要去的那一側':'的路徑沿原路折返（程式走線不理想），可以加中繼點調整';
        out.push({t:`電纜 ${c.no} ${why}`,k:'cable',id:c.id});}
      return;}
    if(backtrack(r.pts))out.push({t:w.wps.length?`${wireRef(w)} 在中繼點前後沿原路折返，建議移動中繼點`:`${wireRef(w)} 的路徑沿原路折返（程式走線不理想），可以加中繼點調整`,k:'wire',id:w.id});
    // 外線穿過箱壁應該只有出線口那一次；箱內線不應該穿出去（有中繼點時照使用者的路線，不檢查）
    if(!w.wps.length&&!plugWire(w)){const A=endpoint(w.a,0),B=endpoint(w.b,0),ia=inR(A,BXR)&&!outBox(A),ib=inR(B,BXR)&&!outBox(B),want=ia===ib?0:1;
      const n=r.pts.filter((q,i)=>i&&inR(q,BXR)!==inR(r.pts[i-1],BXR)).length;if(n!==want&&A.sheet!=='door'&&B.sheet!=='door')out.push({t:`${wireRef(w)} 穿過箱壁 ${n} 次（${want?'應該只從出線口進出一次':'箱內的線不應該穿出箱子'}）`,k:'wire',id:w.id});}
  });
  // 二極體接在線圈上：K 要接 +、A 接 −；AC 線圈不能接二極體
  {const P=new Map(),f=k=>{while(P.has(k)&&P.get(k)!==k)k=P.get(k);return k;},u=(a,b)=>{const x=f(a),y=f(b);if(x!==y)P.set(x,y);};
   S.wires.forEach(w=>u(endKey(w,'a'),endKey(w,'b')));
   const coils=S.devices.map(h=>({h,c:coilOf(h)})).filter(x=>x.c);
   S.devices.filter(d=>tplOf(d).sym==='diode').forEach(d=>{
     const a=f(nodeKey({d:d.id,t:'A'})),k=f(nodeKey({d:d.id,t:'K'}));
     coils.forEach(({h,c})=>{
       const p=f(nodeKey({d:h.id,t:c.p})),m=f(nodeKey({d:h.id,t:c.m})),on=(a===p||a===m)&&(k===p||k===m)&&a!==k;
       if(!on) return;
       if(c.ac) out.push({t:`${d.tag} 二極體接在 ${h.tag} 的 AC 線圈上：交流線圈不能接二極體（會短路），請改用突波吸收器`,k:'dev',id:d.id});
       else if(k===m&&a===p) out.push({t:`${d.tag} 二極體接反：K（陰極）要接 ${h.tag} 的 ${c.p}（+），A 接 ${c.m}（−）；如果線圈極性本來就相反，到 ${h.tag} 的器具資料勾選「線圈極性對調」`,k:'dev',id:d.id});
     });
   });}
  (S.cables||[]).forEach(c=>{
    const cw=coresOf(c),sp=specDef(c.spec).length,seen=new Map();
    if(sp&&c.cores.length>sp) out.push({t:`電纜 ${c.no} 規格是 ${sp} 芯，芯線表有 ${c.cores.length} 芯`,k:'cable',id:c.id});
    cw.forEach(w=>{if(seen.has(w.core))out.push({t:`電纜 ${c.no} 的芯線 ${w.core} 接了兩次（${seen.get(w.core).no}、${w.no}）`,k:'wire',id:w.id});else seen.set(w.core,w);});
    // 一條電纜的芯線可以分到好幾個現場設備（例如同一條電纜分出去接兩台），不警告
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
// 回傳第一個沿原路折回的轉折點（沒有就 null）
function foldAt(p){
  for(let i=2;i<p.length;i++){const a=p[i-2],b=p[i-1],c=p[i];
    const col=(Math.abs(a.x-b.x)<.01&&Math.abs(b.x-c.x)<.01)||(Math.abs(a.y-b.y)<.01&&Math.abs(b.y-c.y)<.01);
    if(col&&((b.x-a.x)*(c.x-b.x)+(b.y-a.y)*(c.y-b.y))<-.01) return b;}
  return null;
}
function backtrack(p){
  for(let i=2;i<p.length;i++){const a=p[i-2],b=p[i-1],c=p[i];
    const col=(Math.abs(a.x-b.x)<.01&&Math.abs(b.x-c.x)<.01)||(Math.abs(a.y-b.y)<.01&&Math.abs(b.y-c.y)<.01);
    if(col&&((b.x-a.x)*(c.x-b.x)+(b.y-a.y)*(c.y-b.y))<-.01) return true;}
  return false;
}
// 接到插座「插頭」點的線：外部插頭的電線，實際隨使用者拉，不檢查穿過器具
const plugWire=w=>[w.a,w.b].some(e=>e.t==='插頭');
const key=(e)=>e.d+'|'+e.t;
// hint：上一輪發現自動剝線點有折返時，外皮實際過來的點（電纜 id|a 或 b → 點），這一輪剝線點改往那裡靠
let BOHINT={}; // 上次發現剝線點折返後調整用的目標，下次直接沿用（不用每次都多算一輪）
/* ---------- 現場區走線方式（z.route）----------
   auto：自動幹線，程式在現場區靠箱子那一側放一條看不見的箱外線槽，外線沿它排好再進出線口（不存檔、不算材料）
   duct：照使用者放的箱外線槽（沒放就直接拉，舊檔都是這個）
   direct：直接拉，這一區的箱外線槽不拿來走線 */
let TRUNKS=[];
const zoneRoute=z=>z&&z.route||'duct';
function zoneNear(r){const c={x:r.x+r.w/2,y:r.y+r.h/2};let best=null,bd=Infinity;
  (S.fields||[]).forEach(z=>{const dx=Math.max(z.x-c.x,0,c.x-z.x-z.w),dy=Math.max(z.y-c.y,0,c.y-z.y-z.h),q=dx*dx+dy*dy;if(q<bd){bd=q;best=z;}});return best;}
function zoneTrunks(){
  const out=[],BX={...boxOrigin(),w:S.box.w,h:S.box.h};
  for(const z of S.fields||[]){if(zoneRoute(z)!=='auto')continue;
    // 現場區在箱子的哪一側：幹線放在現場區面向箱子的那一邊
    const side=z.y+z.h<=BX.y?'top':z.y>=BX.y+BX.h?'bottom':z.x+z.w<=BX.x?'left':z.x>=BX.x+BX.w?'right':null;if(!side)continue;
    const devs=S.devices.filter(d=>d.sheet==='field'&&zoneOf(d)===z).map(d=>rectOf('dev',d));if(!devs.length)continue;
    const ids=new Set(S.devices.filter(d=>d.sheet==='field'&&zoneOf(d)===z).map(d=>d.id));
    const n=S.wires.filter(w=>ids.has(w.a.d)||ids.has(w.b.d)).length,T=Math.min(60,Math.max(24,Math.round(n*1.2)+12));
    const hz=side==='top'||side==='bottom',gl=S.glands.filter(g=>(g.side||'bottom')===side).map(glandPt);
    // 長度涵蓋所有器具的外框和出線口，兩頭多留 30 mm（剝線點、出線點常在器具外框外一點點）
    const lo0=Math.min(...devs.map(r=>hz?r.x:r.y),...gl.map(g=>hz?g.x:g.y)),hi0=Math.max(...devs.map(r=>hz?r.x+r.w:r.y+r.h),...gl.map(g=>hz?g.x:g.y));
    const zl=hz?z.x+6:z.y+6,zh=hz?z.x+z.w-6:z.y+z.h-6;
    let lo=Math.max(zl,lo0-30),hi=Math.min(zh,hi0+30);if(hi-lo<40)continue;
    // 先放在現場區裡、器具和邊框之間；放不下就放到現場區和箱子中間的空隙；都放不下就不放
    const near=side==='top'?Math.max(...devs.map(r=>r.y+r.h)):side==='bottom'?Math.min(...devs.map(r=>r.y)):side==='left'?Math.max(...devs.map(r=>r.x+r.w)):Math.min(...devs.map(r=>r.x));
    const edge=side==='top'?z.y+z.h:side==='bottom'?z.y:side==='left'?z.x+z.w:z.x,wall=side==='top'?BX.y:side==='bottom'?BX.y+BX.h:side==='left'?BX.x:BX.x+BX.w;
    const out1=side==='top'||side==='left'; // 幹線往正方向是靠近箱子
    let p=null;
    if(out1){if(edge-8-T>=near+8)p=edge-8-T;else if(wall-edge>=T+16)p=edge+(wall-edge-T)/2;}
    else{if(edge+8+T<=near-8)p=edge+8;else if(edge-wall>=T+16)p=wall+(edge-wall-T)/2;}
    if(p==null)continue;p=Math.round(p);
    out.push(hz?{id:'~'+z.id,x:Math.round(lo),y:p,w:Math.round(hi-lo),h:T,dp:65,sheet:'field',virtual:true,zone:z.id}:{id:'~'+z.id,x:p,y:Math.round(lo),w:T,h:Math.round(hi-lo),dp:65,sheet:'field',virtual:true,zone:z.id});}
  return out;
}
// 算路徑時暫時把自動幹線加進線槽清單，「直接拉」的現場區拿掉那一區的箱外線槽；算完還原
function withTrunks(fn){
  if(S.ducts._v)return fn();
  const real=S.ducts,v=zoneTrunks(),ds=[...real.filter(d=>!(d.sheet==='field'&&zoneRoute(zoneNear(d))==='direct')),...v];ds._v=1;
  S.ducts=ds;try{return fn();}finally{S.ducts=real;}
}
function computeRoutes(hint){withTrunks(()=>{TRUNKS=S.ducts.filter(d=>d.virtual);computeRoutes0(hint);});}
function computeRoutes0(hint){hint=hint&&hint.retry?hint:BOHINT;const sigs={};
  ROUTES.clear();DUCTUSE.clear();ROUTES_MANUAL.clear();CABROUTES.clear();fixBatteries();syncCoilWires();syncCables();bundleSel=sel;
  const J=junctions();
  const use=new Map();
  S.wires=S.wires.filter(w=>{const a=devOf(w.a.d),b=devOf(w.b.d);return a&&b&&termOf(a,w.a.t)&&termOf(b,w.b.t);});
  S.wires.forEach(w=>{for(const e of [w.a,w.b]){const k=key(e);use.set(k,(use.get(k)||0)+1);}});
  const seen=new Map();
  const off=(e)=>{const k=key(e),n=use.get(k)||1,i=seen.get(k)||0;seen.set(k,i+1);return (i-(n-1)/2)*1.7;};
  const ctr={h:0,g:0,hn:S.wires.filter(w=>{const a=devOf(w.a.d).sheet,b=devOf(w.b.d).sheet;return a!==b&&(a==='door'||b==='door');}).length};
  const center_=(_,d)=>center(d);
  // 中繼點之間、出線口與緊接的中繼點之間：照點直接連（使用者手動指定的路徑）
  const manualLeg=(A,B)=>(A.wp&&B.wp&&!A.bo&&!B.bo)||(A.gland&&B.wp&&!B.bo)||(A.wp&&!A.bo&&B.gland);
  const legsOf=(anchors,noDuct)=>{const L=[];for(let i=0;i<anchors.length-1;i++){const A=anchors[i],B=anchors[i+1];L.push(routeLeg(A,B,J,noDuct||manualLeg(A,B)));}return L;};
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
  // 電纜：外皮從 A 端剝線點走到 B 端剝線點，每一芯從接點走到剝線點
  const cabJobs=[];
  (S.cables||[]).forEach(c=>{
    const cw=coresOf(c),P=c.plug||{};if(!cw.length&&!(P.a&&P.b)) return;
    const ea=cw.map(w=>endpoint(w.a,off(w.a))),eb=cw.map(w=>endpoint(w.b,off(w.b)));
    // 接頭那一端：外皮直接走到接頭（接點），不剝線
    // 剝線點要往哪裡靠：一端在箱內、另一端在箱外（或箱外器具）時是出線口，兩端都在箱內時是另一端芯線的中心
    const cen=es=>es.length?{x:es.reduce((s,e)=>s+e.x,0)/es.length,y:es.reduce((s,e)=>s+e.y,0)/es.length}:null;
    const fieldOf=es=>es.some(e=>e.sheet==='field'||outBox(e));
    const cgl=c.gland||([...cw.map(w=>devOf(w.b.d)),P.b&&devOf(P.b.d)].find(d=>d&&d.gland)||{}).gland;
    const glandNear=q=>{const g=(cgl&&S.glands.find(x=>x.id===cgl))||(q&&S.glands.reduce((b,x)=>{const t=glandPt(x),u=b&&glandPt(b);return !b||Math.abs(t.x-q.x)+Math.abs(t.y-q.y)<Math.abs(u.x-q.x)+Math.abs(u.y-q.y)?x:b;},null));return g?glandPt(g):null;};
    // 兩端同在箱內（或同在箱外）：往另一端；一內一外：往出線口（以箱外那一端找最近的出線口，或電纜指定的出線口）
    // 兩端同側時目標帶著另一端的芯線接點（剝線點照那些芯線實際會進的線槽算距離）
    const tgt=(mine,other)=>!mine.length?null:fieldOf(mine)===fieldOf(other)?(other.length?{...cen(other),ends:other}:null):glandNear(cen(fieldOf(mine)?mine:other));
    // 記住的調整目標只在兩端接點都沒動時才沿用（簽章不同就作廢）
    const sig=[...ea,...eb].map(e=>Math.round(e.x)+','+Math.round(e.y)).join(';'),hintFor=k=>{const h=hint[k];return h&&h.sig===sig?h:null;};sigs[c.id]=sig;
    const side=(k,ends)=>{if(P[k])return endpoint(P[k],0);const o=c.bo&&c.bo[k];const p=o?{x:o.x,y:o.y,sheet:sheetAt(o)}:autoBO(ends,ends[0].sheet,hintFor(c.id+'|'+k)||((c.wps||[]).length?{...(k==='a'?c.wps[0]:c.wps[c.wps.length-1]),uw:1}:null)||(k==='a'?tgt(ea,eb):tgt(eb,ea)));return {x:p.x,y:p.y,sheet:p.sheet,inDuct:locate(p,p.sheet),wp:true,bo:true,auto:!o,...(!o&&p.dev&&p.side?{boDev:p.dev,boSide:p.side}:{})};};
    const A=side('a',ea),B=side('b',eb);
    // 外皮可以加中繼點、可以不進線槽；電纜本來就能走線槽外，穿過其他器具不警告
    const cg=c.gland||([...cw.map(w=>devOf(w.b.d)),P.b&&devOf(P.b.d)].find(d=>d&&d.gland)||{}).gland; // 電纜：指定的出線口，其次是現場設備的預設出線口
    const sa=buildAnchors(A,B,c.wps||[],ctr,cg),sh=job('S:'+c.id,0,sa,legsOf(sa,!!c.direct),false,cabOD(c));sh.cab=true;items.push(sh);
    const tails=cw.map((w,i)=>{
      const ta=P.a?null:buildAnchors(ea[i],{...A},[],ctr,null),tb=P.b?null:buildAnchors({...B},eb[i],[],ctr,null);
      const ja=ta&&job(w.id+'#a',w.gauge,ta,legsOf(ta,false),false),jb=tb&&job(w.id+'#b',w.gauge,tb,legsOf(tb,false),false);
      if(ja)items.push(ja);if(jb)items.push(jb);return {w,ja,jb};
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
  // 剝線點在線槽裡：移到外皮在那條線槽實際走的線道上，芯線直接走到外皮的線道會合（不會先走到中心線、外皮再橫移到自己的線道）
  cabJobs.forEach(({A,B,sh,tails})=>{
    [[A,'a'],[B,'b']].forEach(([P,k])=>{if(!P.bo||!P.auto||!P.inDuct)return;
      // 同一條線槽裡有使用者放的中繼點：外皮在這條線槽照中繼點的位置走，剝線點也對齊那裡
      const uw=sh.anchors.find(a=>a.wp&&!a.bo&&a.inDuct===P.inDuct&&S.ducts.filter(d=>d.sheet===a.sheet&&inR(a,d)).length===1);
      const L=uw?(axis(P.inDuct)==='h'?uw.y:uw.x):lanes.get(sh.id+'|'+P.inDuct.id);if(L==null)return;
      const h=axis(P.inDuct)==='h';if(h)P.y=L;else P.x=L;
      tails.forEach(({ja,jb})=>{const j=k==='a'?ja:jb;if(!j)return;const q=k==='a'?j.anchors[j.anchors.length-1]:j.anchors[0];if(h)q.y=L;else q.x=L;});});
  });
  const FIN=new Map();
  for(const it of items){
    const f=realize(it.id,it.anchors,it.legs,(id,d)=>lanes.get(id+'|'+d.id)??center(d));
    // 最後一道整理：同一直線上走過去又折回來的點，只要不是必經點（接點、中繼點、剝線點、出線口）就拿掉
    const pts=unfold(simplify(f.pts),it.anchors.filter((a,i)=>i===0||i===it.anchors.length-1||a.wp||a.gland));
    let len=0;for(let i=1;i<pts.length;i++)len+=Math.abs(pts[i].x-pts[i-1].x)+Math.abs(pts[i].y-pts[i-1].y);
    const via=[];f.runs.forEach(r=>{if(via[via.length-1]!==r.d.id)via.push(r.d.id);});
    if(it.manual)(manualVia.get(it.id)||[]).forEach(id=>{if(!via.includes(id))via.push(id);});
    let warn=(it.legs.find(l=>l.warn)||{}).warn||null;
    if(it.manual&&warn==='直接拉線穿過其他器具')warn='手動路徑穿過其他器具';
    if(it.w&&warn&&warn.includes('穿過')&&plugWire(it.w))warn=null; // 插頭線本來就隨使用者拉，不警告穿過器具
    if(it.cab&&warn&&(warn.includes('穿過')||warn==='無線槽可走'))warn=null; // 電纜外皮本來就能走線槽外
    const g=it.anchors.find(a=>a.gland);
    FIN.set(it.id,{pts,len,via,warn,gland:g?g.gland:null});
    if(it.w){ROUTES_MANUAL.add(it.manual?it.w.id:null);ROUTES.set(it.w.id,FIN.get(it.id));}
  }
  cabJobs.forEach(({c,A,B,sh,tails})=>{
    const S0=FIN.get(sh.id);
    // 自動剝線點：外皮離開剝線點的第一小段（4 mm 內）是往芯線來的方向折回，就把剝線點挪到那個轉彎處，芯線直接接過去
    [[A,'a'],[B,'b']].forEach(([P,k])=>{if(!P.bo||!P.auto||S0.pts.length<3)return;const sp=k==='a'?S0.pts:S0.pts.slice().reverse(),q=sp[1];
      if(Math.hypot(q.x-sp[0].x,q.y-sp[0].y)>4)return;
      const tl=tails.map(t=>k==='a'?t.ja:t.jb).filter(Boolean).map(j=>FIN.get(j.id));
      const back=tl.some(r=>{const T=k==='a'?r.pts:r.pts.slice().reverse(),n=T.length;if(n<2)return false;const u=T[n-2],v=T[n-1];return (v.x-u.x)*(q.x-v.x)+(v.y-u.y)*(q.y-v.y)<0;});
      if(!back)return;
      sp.shift();sp[0]={x:q.x,y:q.y};const np=k==='a'?sp:sp.reverse();S0.pts=simplify(np);P.x=q.x;P.y=q.y;
      tl.forEach(r=>{const T=r.pts;if(k==='a'){const u=T[T.length-2];T[T.length-1]={x:q.x,y:q.y};if(u&&Math.abs(u.x-q.x)>.01&&Math.abs(u.y-q.y)>.01)T.splice(T.length-1,0,Math.abs(u.x-T[T.length-1].x)<Math.abs(u.y-T[T.length-1].y)?{x:u.x,y:q.y}:{x:q.x,y:u.y});r.pts=simplify(T);}
        else{const u=T[1];T[0]={x:q.x,y:q.y};if(u&&Math.abs(u.x-q.x)>.01&&Math.abs(u.y-q.y)>.01)T.splice(1,0,{x:q.x,y:u.y});r.pts=simplify(T);}});});
    CABROUTES.set(c.id,{...S0,a:A.bo?{x:A.x,y:A.y,auto:A.auto}:null,b:B.bo?{x:B.x,y:B.y,auto:B.auto}:null});
    const none={pts:[],len:0,via:[],warn:null}; // 接頭那一端沒有芯線段
    tails.forEach(({w,ja,jb})=>{
      let ra=ja?FIN.get(ja.id):none,rb=jb?FIN.get(jb.id):none;
      // 芯線尾段的線道和剝線點差幾 mm（手動剝線點不在線道上）：芯線到剝線點前會先跑過頭再折回來，把尾段最後那一橫段移到剝線點的位置
      const S=S0.pts;if(S.length>=2){const fa=joinFix(ra.pts,S[1]),fb=joinFix(rb.pts.slice().reverse(),S[S.length-2]);
        if(fa)ra={...ra,pts:fa,len:plen(fa)};if(fb){const t=fb.reverse();rb={...rb,pts:t,len:plen(t)};}}
      const parts=[ra,S0,rb],via=[];
      parts.forEach(p=>p.via.forEach(id=>{if(via[via.length-1]!==id)via.push(id);}));
      const warn=(parts.find(p=>p.warn)||{}).warn||null;
      ROUTES.set(w.id,{pts:simplify([...ra.pts,...S0.pts,...rb.pts]),len:ra.len+S0.len+rb.len,via,warn,gland:S0.gland,cab:c.id,parts:[ra.pts,S0.pts,rb.pts],tails:[ra.pts,rb.pts]});
    });
  });
  // 自動剝線點還有折返（外皮從另一邊繞過來）：以外皮實際過來的點當目標，重新放剝線點再算一輪（只重算一次）
  if(!hint.retry){const nh={...BOHINT,retry:true};let n=0;
    cabJobs.forEach(({c,A,B,tails})=>{const R0=CABROUTES.get(c.id);if(!R0)return;[[A,'a'],[B,'b']].forEach(([P,k])=>{if(!P.bo||!P.auto)return;
      const L0=R0.pts,dz=q=>Math.abs(q.x-P.x)+Math.abs(q.y-P.y),sp=L0.length&&dz(L0[0])<=dz(L0[L0.length-1])?L0:L0.slice().reverse();if(sp.length<2)return;const q=sp[1],o=sp[0]; // 外皮從靠這個剝線點的那一端算起
      const bad=tails.some(({w})=>{const r=ROUTES.get(w.id);const T=r&&r.tails&&(k==='a'?r.tails[0]:r.tails[1].slice().reverse());if(!T||T.length<2)return false;const v=T[T.length-1],u=T[T.length-2];
        const col=(Math.abs(u.y-v.y)<.01&&Math.abs(v.y-q.y)<.01)||(Math.abs(u.x-v.x)<.01&&Math.abs(v.x-q.x)<.01);return col&&(v.x-u.x)*(q.x-o.x)+(v.y-u.y)*(q.y-o.y)<0;});
      // 同一個調整已經試過（上次就是用這個目標）就不再重算，免得修不掉的折返每次都多算一輪
      const key=c.id+'|'+k,old=BOHINT[key];if(bad&&!(old&&old.sig===sigs[c.id]&&Math.abs(old.x-q.x)<.5&&Math.abs(old.y-q.y)<.5)){nh[key]={x:q.x,y:q.y,sig:sigs[c.id]};n++;}});
      // 兩端都有折返：只調整 B 端，A 端留著當基準（兩端同時往對方靠會互換位置，折返還在）
      // 外皮只有兩個點（兩端直接相連）時，調整的目標就是另一個剝線點，會把外皮縮成 0 或兩端互換：這種情況不重算；外皮中間有轉角時兩端各自調整
      if(R0.pts.length<=2)['a','b'].forEach(k=>{if(nh[c.id+'|'+k]&&nh[c.id+'|'+k]!==BOHINT[c.id+'|'+k]){delete nh[c.id+'|'+k];n--;}});});
    if(n){BOHINT={...nh};delete BOHINT.retry;computeRoutes(nh);return;}}
  ISSUES=computeIssues();
}
// 拖曳中繼點時的預覽：只算這一條線（線槽中心線），放開後再整張重算線道
function wirePreview(w){return withTrunks(()=>wirePreview0(w));}
function wirePreview0(w){
  const J=junctions(),A=buildAnchors(endpoint(w.a,0),endpoint(w.b,0),w.wps,{h:0,g:0,hn:1},w.gland),legs=[];
  for(let i=0;i<A.length-1;i++){const a=A[i],b=A[i+1];legs.push(routeLeg(a,b,J,!!w.direct||(a.wp&&b.wp&&!a.bo&&!b.bo)||(a.gland&&b.wp)||(a.wp&&b.gland)));}
  return simplify(realize('_',A,legs,(_,d)=>center(d)).pts);
}
function previewPts(a,wps,end,noDuct,gland){return withTrunks(()=>previewPts0(a,wps,end,noDuct,gland));}
function previewPts0(a,wps,end,noDuct,gland){
  const J=junctions();
  const anchors=buildAnchors(endpoint(a,0),end,wps,{h:0,g:0,hn:1},gland||null);
  // 和實際算路徑一樣：只有中繼點之間、出線口和緊接的中繼點之間照點直接連，其餘照樣走線槽（預覽才不會和放開後不一樣）
  const man=(A,B)=>(A.wp&&B.wp&&!A.bo&&!B.bo&&B!==anchors[anchors.length-1])||(A.gland&&B.wp&&!B.bo&&B!==anchors[anchors.length-1])||(A.wp&&!A.bo&&B.gland);
  const legs=[];for(let i=0;i<anchors.length-1;i++) legs.push(routeLeg(anchors[i],anchors[i+1],J,noDuct||man(anchors[i],anchors[i+1])));
  return simplify(realize('_',anchors,legs,(_,d)=>center(d)).pts);
}


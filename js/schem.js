"use strict";
/* ---------- 正式電路圖（IEC 60617 符號，A3 橫式，列印成 PDF） ----------
   全部從配線資料自動產生，不另外畫：
   - 用模擬引擎的「最壞情況」模式取得每個器具的動作元素（接點、線圈、負載、斷路器極、PLC 點）與只靠導線相連的接點分組
   - 主回路：從 AC 電源沿著斷路器、保險絲、接觸器主接點追到用電器具，畫成樹狀（各相垂直線、分歧處畫分配線）
   - 控制回路（展開圖）：每個 DC 電源的 ＋ 與 − 是上下兩條電源線，中間的接點與負載做串並聯化簡後垂直畫出；
     共用的前段（例如急停）只畫一次，太寬時把中間電位拉成新的電源線、跨頁接續
   - PLC I/O：每點一欄，上面是接的現場器具，下面是 PLC 端子與位址
   - 端子台表、線號表、材料表放在最後；每頁有欄號 1～10、列號 A～F 與標題欄，線圈下方列出接點在哪一頁哪一欄
   - schemVerify：把畫出來的圖反推回接點連接，和原本配線比對（測試用） */
const SC={W:420,H:297,M:10,COLS:10,U:19,X0:34,X1:404,RT:42,RB:236};
const SC_PH=['R','S','T','L1','L2','L3','L','N'];
const scEsc=s=>esc(String(s==null?'':s));
const scTrim=(s,n)=>{s=String(s||'');return s.length>n?s.slice(0,n-1)+'…':s;};

/* ---------- 1. 模型：節點、元素 ---------- */
function schemModel(){
  const save=SIMST;let r;try{SIMST=null;simReset();SIMST.all=true;r=simRun();}finally{SIMST=save;}
  const {els,node,wireKeys}=r.topo;
  const P=new Map(),f=k=>{k=node(k);if(!P.has(k))P.set(k,k);while(P.get(k)!==k){P.set(k,P.get(P.get(k)));k=P.get(k);}return k;},un=(a,b)=>{const x=f(a),y=f(b);if(x!==y)P.set(x,y);};
  const isFuse=d=>/保險絲/.test(tplOf(d).n||'')&&!tplOf(d).cat.startsWith('端子');
  // 不畫出來的內部導通（電源供應器 +V1／+V2、插座 L／N）先合併
  els.forEach(e=>{if(e.k==='pass'&&!isFuse(e.d))un(e.aK,e.bK);});
  const E=[],srcs=[],acs=[];let n=0;
  const act=(e)=>{const d=e.d;switch(e.by){case 'coil':return d.id+(e.g?'#'+e.g:'');case 'host':case 'hostbrk':case 'hosttrip':case 'hostel':return d.on||d.id;case 'op':return d.on||d.id;default:return d.id;}};
  const add=(o)=>{o.id='e'+(++n);E.push(o);return o;};
  els.forEach(e=>{const d=e.d;
    if(e.k==='sw')add({d,el:e,k:e.nc?'nc':'no',a:e.aK,b:e.bK,ta:e.a,tb:e.b,act:act(e),by:e.by,ctl:true});
    else if(e.k==='brk')add({d,el:e,k:'brk',a:e.aK,b:e.bK,ta:e.a,tb:e.b,act:d.id,ctl:true});
    else if(e.k==='pass'&&isFuse(d))add({d,el:e,k:'fuse',a:e.aK,b:e.bK,ta:e.a,tb:e.b,act:d.id,ctl:true});
    else if(e.k==='sens')add({d,el:e,k:'sens',a:e.toK,b:e.outK,ta:e.to,tb:e.out,act:d.id,ctl:true});
    else if(e.k==='plcY')e.pairsK.forEach(([y,yk,ck],i)=>add({d,el:e,k:'plcy',a:ck,b:yk,ta:e.pairs[i][1],tb:y,act:d.id,ctl:true,pt:y}));
    else if(e.k==='coil')add({d,el:e,k:'coil',a:e.aK,b:e.bK,ta:e.a,tb:e.b,act:d.id+(e.g?'#'+e.g:''),load:true});
    else if(e.k==='load'||e.k==='pwr')add({d,el:e,k:e.k,a:e.aK,b:e.bK,ta:e.a,tb:e.b,act:d.id,load:true,name:e.name||(e.k==='pwr'?'電源':'負載'),aux:!!e.aux});
    else if(e.k==='plcX')e.ptsK.forEach(([t,k])=>add({d,el:e,k:'plcx',a:k,b:e.comK,ta:t,tb:e.com,act:d.id,load:true,pt:t}));
    else if(e.k==='src')srcs.push({d,e,p:e.pK,nn:e.nK,v:e.v||'DC',inK:e.inK,inT:e.in});
    else if(e.k==='ac')acs.push({d,e});});
  E.forEach(e=>{e.u=f(e.a);e.v=f(e.b);});
  // 有接線的元素才畫（沒接線的接點不出現在圖上）
  const wiredNode=new Set();S.wires.forEach(w=>{const wk=wireKeys.get(w.id);if(wk)wk.keys.forEach(k=>wiredNode.add(f(k)));(wk&&wk.pairs||[]).forEach(([a,b])=>{wiredNode.add(f(a));wiredNode.add(f(b));});});
  // 節點名稱：接在這一點的線最常用的線號
  const cnt=new Map();S.wires.forEach(w=>{const wk=wireKeys.get(w.id);if(!wk)return;const ks=new Set();wk.pairs.forEach(([a,b])=>{ks.add(f(a));ks.add(f(b));});wk.keys.forEach(k=>ks.add(f(k)));
    ks.forEach(k=>{if(!cnt.has(k))cnt.set(k,new Map());const m=cnt.get(k);m.set(w.no,(m.get(w.no)||0)+1);});});
  const netName=k=>{const m=cnt.get(k);if(!m)return '';return [...m.entries()].sort((a,b)=>b[1]-a[1]||natCmp(a[0],b[0]))[0][0];};
  // 相別：從 AC 電源沿著接點傳下去
  const phase=new Map(),adj=new Map(),link=(x,e)=>{if(!adj.has(x))adj.set(x,[]);adj.get(x).push(e);};
  E.filter(e=>e.ctl).forEach(e=>{link(e.u,e);link(e.v,e);});
  const acNodes=[];acs.forEach(({d,e})=>{e.phK.forEach((k,i)=>acNodes.push([f(k),e.ph[i],d]));if(e.nK)acNodes.push([f(e.nK),'N',d]);});
  { const q=[];acNodes.forEach(([k,ph])=>{if(!phase.has(k)){phase.set(k,ph);q.push(k);}});
    while(q.length){const x=q.shift();(adj.get(x)||[]).forEach(e=>{const y=e.u===x?e.v:e.u;if(!phase.has(y)){phase.set(y,phase.get(x));q.push(y);}});} }
  return {E,srcs,acs,acNodes,f,netName,phase,adj,wiredNode,res:r};
}

/* ---------- 2. 串並聯化簡 ---------- */
const scLeaf=e=>({t:'leaf',e,rev:false});
function scRev(t){if(t.t==='leaf')return {...t,rev:!t.rev};if(t.t==='ser')return {t:'ser',c:t.c.slice().reverse().map(scRev),nodes:(t.nodes||[]).slice().reverse()};return {t:'par',c:t.c.map(scRev)};}
function scSer(a,b,mid){return {t:'ser',c:[...(a.t==='ser'?a.c:[a]),...(b.t==='ser'?b.c:[b])],nodes:[...(a.t==='ser'?a.nodes:[]),mid,...(b.t==='ser'?b.nodes:[])]};}
function scPar(list){const c=[];list.forEach(x=>{if(x.t==='par')c.push(...x.c);else c.push(x);});return {t:'par',c};}
// edges: [{u,v,t}]，回傳從 P 到 N 的樹（化簡不完的部分改用路徑列舉）
function spReduce(edges,Pn,Nn){
  let E=edges.filter(e=>e.u!==e.v).map(e=>({...e}));
  // 只留和 P、N 相連的部分
  { const g=new Map();E.forEach(e=>{[e.u,e.v].forEach(x=>{if(!g.has(x))g.set(x,[]);});g.get(e.u).push(e.v);g.get(e.v).push(e.u);});
    const seen=new Set([Pn]),q=[Pn];while(q.length){const x=q.shift();(g.get(x)||[]).forEach(y=>{if(!seen.has(y)){seen.add(y);q.push(y);}});}
    if(!seen.has(Nn))return null;E=E.filter(e=>seen.has(e.u)); }
  for(let guard=0;guard<100000;guard++){let ch=false;
    const deg=new Map();E.forEach(e=>{deg.set(e.u,(deg.get(e.u)||0)+1);deg.set(e.v,(deg.get(e.v)||0)+1);});
    // 斷頭（只接一端的分支）去掉
    const dead=E.filter(e=>(e.u!==Pn&&e.u!==Nn&&deg.get(e.u)===1)||(e.v!==Pn&&e.v!==Nn&&deg.get(e.v)===1));
    if(dead.length){const s=new Set(dead);E=E.filter(e=>!s.has(e));continue;}
    // 並聯：兩端相同的邊合併
    const grp=new Map();E.forEach(e=>{const k=e.u<e.v?e.u+'\u0000'+e.v:e.v+'\u0000'+e.u;if(!grp.has(k))grp.set(k,[]);grp.get(k).push(e);});
    for(const L of grp.values())if(L.length>1){const a=L[0],t=scPar(L.map(e=>e.u===a.u?e.t:scRev(e.t)));const s=new Set(L);E=E.filter(e=>!s.has(e));E.push({u:a.u,v:a.v,t});ch=true;break;}
    if(ch)continue;
    // 串聯：只接兩條邊的中間點合併
    for(const [m,dg] of deg){if(dg!==2||m===Pn||m===Nn)continue;const two=E.filter(e=>e.u===m||e.v===m);if(two.length!==2)continue;
      const [e1,e2]=two,x=e1.u===m?e1.v:e1.u,y=e2.u===m?e2.v:e2.u;const t1=e1.v===m?e1.t:scRev(e1.t),t2=e2.u===m?e2.t:scRev(e2.t);
      E=E.filter(e=>e!==e1&&e!==e2);if(x!==y)E.push({u:x,v:y,t:scSer(t1,t2,m)});ch=true;break;}
    if(!ch)break;}
  if(!E.length)return null;
  if(E.length===1&&((E[0].u===Pn&&E[0].v===Nn)||(E[0].u===Nn&&E[0].v===Pn)))return E[0].u===Pn?E[0].t:scRev(E[0].t);
  // 化簡不完（橋接）：列出 P→N 的每一條路徑，重複出現的元素加註
  const g=new Map();E.forEach(e=>{[e.u,e.v].forEach(x=>{if(!g.has(x))g.set(x,[]);});g.get(e.u).push(e);g.get(e.v).push(e);});
  const paths=[];const walk=(x,used,acc,nodes)=>{if(paths.length>=40||acc.length>30)return;if(x===Nn){paths.push({c:acc.slice(),nodes:nodes.slice(0,-1)});return;}
    for(const e of g.get(x)||[]){if(used.has(e))continue;const y=e.u===x?e.v:e.u;if(nodes.includes(y))continue;used.add(e);acc.push(e.u===x?e.t:scRev(e.t));nodes.push(y);walk(y,used,acc,nodes);nodes.pop();acc.pop();used.delete(e);}};
  walk(Pn,new Set(),[],[]);
  if(!paths.length)return null;
  const mark=t=>{if(t.t==='leaf')return {...t,dup:true};return {...t,c:t.c.map(mark)};};
  return scPar(paths.map(p=>{const c=p.c.map(mark);return c.length===1?c[0]:{t:'ser',c:c.flatMap(x=>x.t==='ser'?x.c:[x]),nodes:[]};}));
}

/* ---------- 3. 符號（IEC 60617，垂直方向；x 是線的位置，c 是符號中心） ---------- */
const SY={
  line:(x,y1,y2)=>y2-y1>.01?`<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}"/>`:'',
  no:(x,c)=>`<line x1="${x}" y1="${c+3}" x2="${x-3.2}" y2="${c-3.3}"/>`,
  nc:(x,c)=>`<line x1="${x}" y1="${c+3}" x2="${x+3.4}" y2="${c-3.6}"/><line x1="${x}" y1="${c-3}" x2="${x+3.6}" y2="${c-3}"/>`,
  brk:(x,c)=>SY.no(x,c)+`<path d="M${x-1} ${c-4}l2 2M${x+1} ${c-4}l-2 2"/>`,
  fuse:(x,c)=>`<rect x="${x-1.5}" y="${c-4}" width="3" height="8" fill="#fff"/><line x1="${x}" y1="${c-4}" x2="${x}" y2="${c+4}"/>`,
  btn:(x,c)=>`<path d="M${x-1.6} ${c} H${x-6.5}" stroke-dasharray="1 .8"/><path d="M${x-6.5} ${c-1.6}V${c+1.6}"/>`,
  trip:(x,c)=>`<path d="M${x-1.6} ${c} H${x-4.5}" stroke-dasharray="1 .8"/><path d="M${x-4.5} ${c}v-1.3h-1.3v2.6h-1.3v-1.3"/>`,
  sensA:(x,c)=>`<path d="M${x-1.6} ${c} H${x-4.5}" stroke-dasharray="1 .8"/><path d="M${x-4.5} ${c}l-1.4 -1.4l-1.4 1.4l1.4 1.4z"/>`,
  coil:(x,c)=>`<rect x="${x-4}" y="${c-2.6}" width="8" height="5.2" fill="#fff"/>`,
  lamp:(x,c)=>`<circle cx="${x}" cy="${c}" r="3" fill="#fff"/><path d="M${x-2.1} ${c-2.1}l4.2 4.2M${x+2.1} ${c-2.1}l-4.2 4.2"/>`,
  box:(x,c,t)=>`<rect x="${x-5.5}" y="${c-3}" width="11" height="6" fill="#fff"/><text class="s-in" x="${x}" y="${c+.7}">${scEsc(scTrim(t,6))}</text>`,
  plcx:(x,c,t)=>`<rect x="${x-4.5}" y="${c-2.6}" width="9" height="5.2" fill="#fff"/><text class="s-in" x="${x}" y="${c+.8}">${scEsc(scTrim(t,6))}</text>`,
  dot:(x,y)=>`<circle class="s-dot" cx="${x}" cy="${y}" r=".7"/>`,
  motor:(x,c,t)=>`<circle cx="${x}" cy="${c}" r="5.5" fill="#fff"/><text class="s-in" x="${x}" y="${c+.2}" style="font-size:3px">M</text><text class="s-in" x="${x}" y="${c+3.2}" style="font-size:1.8px">${scEsc(t||'')}</text>`,
};
const scIsLoad=e=>!!e.load;
const scLamp=e=>/燈/.test(e.name||'');
function scDevName(d){const t=tplOf(d);return scTrim((d.model&&t.model?d.model:'')||t.n,16);}

/* ---------- 4. 版面：樹的大小與畫法（垂直：串聯往下、並聯往右） ---------- */
function scSize(t,LH){if(t.t==='leaf')return {w:1,h:LH};if(t.t==='ser'){const s=t.c.map(c=>scSize(c,LH));return {w:Math.max(...s.map(q=>q.w)),h:s.reduce((a,q)=>a+q.h,0)};}
  const s=t.c.map(c=>scSize(c,LH));return {w:s.reduce((a,q)=>a+q.w,0),h:Math.max(...s.map(q=>q.h))+6};}
function scWidth(t){return scSize(t,10).w;}
// ctx：{LH, put(leafInfo)：記錄位置, M：模型}
function scDraw(t,x,y,H,ctx){
  const LH=ctx.LH;let h='';
  if(t.t==='leaf')return scLeafSvg(t,x,y,H,ctx);
  if(t.t==='ser'){const sz=t.c.map(c=>scSize(c,LH)),nat=sz.reduce((a,q)=>a+q.h,0),extra=Math.max(0,H-nat);
    const last=t.c[t.c.length-1],stretchBefore=last.t==='leaf'&&scIsLoad(last.e)?t.c.length-1:-1;let yy=y;
    t.c.forEach((c,i)=>{if(i===stretchBefore&&extra>0){h+=SY.line(x,yy,yy+extra);yy+=extra;}
      h+=scDraw(c,x,yy,sz[i].h,ctx);yy+=sz[i].h;
      if(i<t.c.length-1&&t.nodes&&t.nodes[i]!=null){const nm=ctx.M.netName(t.nodes[i]);if(nm)h+=`<text class="s-net" x="${x+1}" y="${yy+.6}">${scEsc(nm)}</text>`;}});
    if(stretchBefore<0&&extra>0)h+=SY.line(x,yy,y+H);
    return h;}
  // 並聯
  const sz=t.c.map(c=>scSize(c,LH));let xx=x;const xs=[];t.c.forEach((c,i)=>{xs.push(xx);xx+=sz[i].w*SC.U;});
  const top=y,bot=y+H,inH=H-6;
  h+=`<line x1="${x}" y1="${top}" x2="${xs[xs.length-1]}" y2="${top}"/><line x1="${x}" y1="${bot}" x2="${xs[xs.length-1]}" y2="${bot}"/>`;
  t.c.forEach((c,i)=>{h+=SY.line(xs[i],top,top+3)+scDraw(c,xs[i],top+3,inH,ctx)+SY.line(xs[i],top+3+inH,bot);if(i>0&&i<t.c.length-1)h+=SY.dot(xs[i],top)+SY.dot(xs[i],bot);});
  if(t.c.length>1){h+=SY.dot(x,top)+SY.dot(x,bot);}
  return h;}
function scLeafSvg(t,x,y,H,ctx){
  const e=t.e,c=y+Math.min(H,ctx.LH)/2,d=e.d;let h=SY.line(x,y,c-4)+SY.line(x,c+4,y+H);
  const [tTop,tBot]=t.rev?[e.tb,e.ta]:[e.ta,e.tb];
  if(e.k==='no'||e.k==='plcy')h+=SY.no(x,c);else if(e.k==='nc')h+=SY.nc(x,c);else if(e.k==='brk')h+=SY.brk(x,c);else if(e.k==='fuse')h+=SY.fuse(x,c);
  else if(e.k==='sens')h+=SY.no(x,c)+SY.sensA(x,c);else if(e.k==='coil')h+=SY.coil(x,c);else if(e.k==='plcx')h+=SY.plcx(x,c,ptName(e));
  else if(scLamp(e))h+=SY.lamp(x,c);else h+=SY.box(x,c,e.name);
  if((e.k==='no'||e.k==='nc')&&(e.by==='btn'||e.by==='op'))h+=SY.btn(x,c);else if((e.k==='no'||e.k==='nc')&&e.by==='trip')h+=SY.trip(x,c);
  if(!['coil','plcx','load','pwr'].includes(e.k)||e.k==='coil'){h+=SY.line(x,c-4,c-3)+SY.line(x,c+3,c+4);}
  // 文字：器具編號（接點標示動作來源）、說明、接點號
  const actDev=devOf(String(e.act).split('#')[0]),own=d.tag,tag=e.ctl&&actDev&&actDev!==d&&['coil','host','hostbrk','hosttrip','hostel','op'].includes(e.by)?`${actDev.tag}`:own;
  const sub=tag!==own?own:e.k==='plcy'?ptName(e):e.k==='plcx'?'':scTrim(scDevName(d),8);
  h+=`<text class="s-tag" x="${x+4.6}" y="${c-.6}"${tag.length>6?` style="font-size:${Math.max(1.5,2.4*6/tag.length)}px"`:''}>${scEsc(tag)}${t.dup?'＊':''}</text><text class="s-sub" x="${x+4.6}" y="${c+2.2}">${scEsc(sub)}</text>`;
  h+=`<text class="s-term" x="${x-1}" y="${c-4.4}">${scEsc(scTrim(termLabel(d,tTop)||tTop,6))}</text><text class="s-term" x="${x-1}" y="${c+6.2}">${scEsc(scTrim(termLabel(d,tBot)||tBot,6))}</text>`;
  ctx.put({e,x,y:c});
  if(e.k==='coil')h+=`<text class="s-xref" x="${x}" y="${c+5.6}">\u0001C:${scEsc(e.act)}\u0001</text>`;
  return h;}
const ptName=e=>{const g=typeof cnSig==='function'?cnSig(e.d,e.pt):e.pt,P=e.k==='plcy'?'Y':'X',alt=/^\d+$/.test(g)?P+g:null;
  return (typeof qName==='function'&&qName(e.d,g))||(typeof chainName==='function'&&(chainName(e.d,g)||(alt&&chainName(e.d,alt))))||termLabel(e.d,e.pt)||g;};

/* ---------- 5. 頁面 ---------- */
// 圖框：外框、欄號 1～10、列號 A～F、標題欄（專案、圖名、日期、頁次）
function scFrame(pg,meta){
  const {W,H,M}=SC,cw=(W-2*M)/SC.COLS,rh=(H-2*M)/6;let h=`<rect class="s-frame" x="${M}" y="${M}" width="${W-2*M}" height="${H-2*M}"/><rect class="s-frame2" x="${M+5}" y="${M+5}" width="${W-2*M-10}" height="${H-2*M-10}"/>`;
  for(let i=0;i<SC.COLS;i++){const x=M+i*cw;if(i)h+=`<line class="s-grid" x1="${x}" y1="${M}" x2="${x}" y2="${M+5}"/><line class="s-grid" x1="${x}" y1="${H-M-5}" x2="${x}" y2="${H-M}"/>`;h+=`<text class="s-gl" x="${x+cw/2}" y="${M+3.6}">${i+1}</text><text class="s-gl" x="${x+cw/2}" y="${H-M-1.4}">${i+1}</text>`;}
  for(let j=0;j<6;j++){const y=M+j*rh;if(j)h+=`<line class="s-grid" x1="${M}" y1="${y}" x2="${M+5}" y2="${y}"/><line class="s-grid" x1="${W-M-5}" y1="${y}" x2="${W-M}" y2="${y}"/>`;h+=`<text class="s-gl" x="${M+2.5}" y="${y+rh/2+1}">${'ABCDEF'[j]}</text><text class="s-gl" x="${W-M-2.5}" y="${y+rh/2+1}">${'ABCDEF'[j]}</text>`;}
  // 標題欄（右下）
  const bx=W-M-5-170,by=H-M-5-22;
  h+=`<rect class="s-tb" x="${bx}" y="${by}" width="170" height="22"/><line class="s-tbl" x1="${bx}" y1="${by+11}" x2="${bx+170}" y2="${by+11}"/><line class="s-tbl" x1="${bx+110}" y1="${by}" x2="${bx+110}" y2="${by+22}"/><line class="s-tbl" x1="${bx+140}" y1="${by+11}" x2="${bx+140}" y2="${by+22}"/>
    <text class="s-tbk" x="${bx+1.5}" y="${by+3}">專案</text><text class="s-tbv" x="${bx+12}" y="${by+7.5}">${scEsc(scTrim(meta.title,30))}</text>
    <text class="s-tbk" x="${bx+111.5}" y="${by+3}">日期</text><text class="s-tbv" x="${bx+120}" y="${by+7.5}">${scEsc(meta.date)}</text>
    <text class="s-tbk" x="${bx+1.5}" y="${by+14}">圖名</text><text class="s-tbv" x="${bx+12}" y="${by+18.8}">${scEsc(scTrim(pg.title,30))}</text>
    <text class="s-tbk" x="${bx+111.5}" y="${by+14}">產生</text><text class="s-tbs" x="${bx+111.5}" y="${by+19.5}">配線模擬器 ${scEsc(meta.ver)}</text>
    <text class="s-tbk" x="${bx+141.5}" y="${by+14}">頁次</text><text class="s-tbv" x="${bx+150}" y="${by+18.8}">\u0001P:${pg.no}\u0001 / \u0001N\u0001</text>`;
  return h;}
const scCol=x=>Math.min(SC.COLS,Math.max(1,Math.floor((x-SC.M)/((SC.W-2*SC.M)/SC.COLS))+1));

/* ---------- 6. 主回路（AC）：電源 → 開關 → 用電器具 的樹 ---------- */
function scMainPages(M,pages,newPage,meta){
  const {E,phase,adj,acNodes,f}=M;if(!acNodes.length)return;
  // 從電源往下的最短路徑（只走接點）
  const par=new Map(),q=[];acNodes.forEach(([k])=>{if(!par.has(k)){par.set(k,null);q.push(k);}});
  while(q.length){const x=q.shift();(adj.get(x)||[]).forEach(e=>{const y=e.u===x?e.v:e.u;if(!par.has(y)){par.set(y,{e,from:x});q.push(y);}});}
  const pathTo=k=>{const out=[];let x=k,g=0;while(par.get(x)&&g++<200){const p=par.get(x);out.unshift(p.e);x=p.from;}return out;};
  // 用電項目：每一組電源輸入各自追路徑（例如伺服的主電源走 K1M、控制電源走 K0M，分開畫）
  const items=[];
  E.filter(e=>e.load&&!e.aux&&e.k!=='plcx').forEach(e=>{if(phase.has(e.u)&&phase.has(e.v)&&M.wiredNode.has(e.u))items.push({d:e.d,terms:[{k:e.u,t:e.ta},{k:e.v,t:e.tb}],name:e.k==='coil'?'線圈':e.name});});
  M.srcs.forEach(s=>{if(s.inK){const a=f(s.inK[0]),b=f(s.inK[1]);if(phase.has(a)&&phase.has(b))items.push({d:s.d,terms:[{k:a,t:s.inT[0]},{k:b,t:s.inT[1]}],name:'AC 輸入',src:s});}});
  if(!items.length)return;
  const groups=new Map();
  items.forEach(it=>{const chains=it.terms.map(t=>({t,edges:pathTo(t.k),ph:phase.get(t.k)}));
    // 每台開關在各相路徑上最早出現的位置；同一層的器具（例如兩相各走一個單極斷路器）放在同一格
    const rank=new Map();chains.forEach(ch=>ch.edges.forEach((e,i)=>{const id=e.d.id;if(!rank.has(id)||rank.get(id)>i)rank.set(id,i);}));
    const lv=new Map();rank.forEach((r,id)=>{if(!lv.has(r))lv.set(r,[]);lv.get(r).push(id);});
    const levels=[...lv.entries()].sort((a,b)=>a[0]-b[0]).map(([,ids])=>ids.sort());
    const sig=it.d.id+'|'+levels.map(l=>l.join('+')).join('>');
    if(!groups.has(sig))groups.set(sig,{d:it.d,terms:[],names:[],chains:[],levels,src:null});
    const g=groups.get(sig);it.terms.forEach(t=>{if(!g.terms.some(x=>x.k===t.k))g.terms.push(t);});if(!g.names.includes(it.name))g.names.push(it.name);g.chains.push(...chains);if(it.src)g.src=it.src;});
  // 樹：節點是一層開關（多極算一台），葉子是用電項目
  const root={id:'ROOT',kids:[],poles:new Map(),devs:[]},nodes=new Map([['ROOT',root]]);
  const phOrd=p=>{const i=SC_PH.indexOf(p);return i<0?99:i;};
  [...groups.values()].sort((a,b)=>natCmp(a.d.tag,b.d.tag)).forEach(g=>{
    let cur=root,key='ROOT';
    g.levels.forEach(ids=>{key+='>'+ids.join('+');if(!nodes.has(key)){const nd={id:key,devs:ids.map(devOf),d:devOf(ids[0]),kids:[],poles:new Map()};nodes.set(key,nd);cur.kids.push(nd);}cur=nodes.get(key);
      g.chains.forEach(ch=>ch.edges.filter(e=>ids.includes(e.d.id)).forEach(e=>{if(!cur.poles.has(e.id))cur.poles.set(e.id,{e,ph:ch.ph});}));});
    const leaf={id:key+'>C:'+g.d.id+g.names.join(),d:g.d,kids:[],poles:new Map(),cons:g,chains:g.chains};cur.kids.push(leaf);});
  const phases=[...new Set(acNodes.map(a=>a[1]))].sort((a,b)=>phOrd(a)-phOrd(b));
  const PX=4.2,phX=ph=>Math.max(0,phases.indexOf(ph))*PX;
  const ownW=nd=>nd.cons?Math.max(2,Math.ceil((phases.length*PX+16)/SC.U)):Math.max(1,Math.ceil((phases.length*PX+12)/SC.U));
  const wOf=nd=>nd._w!=null?nd._w:(nd._w=Math.max(ownW(nd),nd.kids.reduce((a,k)=>a+wOf(k),0)));
  const LV=27,motorDone=new Set();
  const drawNode=(nd,x,y,ctx)=>{ // x：這一格的左緣；y：上端
    let h='';
    if(nd.cons){ // 用電項目：方框，上緣各相端子
      const c=nd.cons,w=ownW(nd)*SC.U-4,bx=x+1;
      c.terms.forEach(t=>{const ph=phase.get(t.k),xx=x+3+phX(ph);h+=SY.line(xx,y,y+8)+`<text class="s-term" x="${xx-.6}" y="${y+7.6}">${scEsc(termLabel(c.d,t.t)||t.t)}</text>`;const nm=M.netName(t.k);if(nm)h+=`<text class="s-netv" transform="translate(${xx+.7} ${y+1}) rotate(90)">${scEsc(nm)}</text>`;});
      const nmTxt=c.names.filter(n=>n&&n!=='AC 輸入'&&n!=='電源').join('、');
      h+=`<rect class="s-dev" x="${bx}" y="${y+8}" width="${w}" height="13"/><text class="s-tag" x="${bx+1.5}" y="${y+12.6}">${scEsc(c.d.tag)}${nmTxt?`<tspan class="s-sub" dx="1.5">${scEsc(scTrim(nmTxt,10))}</tspan>`:''}</text><text class="s-sub" x="${bx+1.5}" y="${y+16}">${scEsc(scTrim(tplOf(c.d).n,Math.floor(w/1.9)))}</text>`;
      if(c.src)h+=`<text class="s-xr2" x="${bx+1.5}" y="${y+19.6}">${scEsc(c.src.v)} 輸出 → 第 \u0001S:${scEsc(c.d.id)}\u0001 頁</text>`;
      // 接在這台 U／V／W 的馬達（同一台器具只畫一次）
      if(!motorDone.has(c.d.id)){const mot=scMotorsOf(M,c);if(mot.length){motorDone.add(c.d.id);mot.forEach((m,i)=>{const mx=x+(i+.5)*(w/mot.length)+1;h+=SY.line(mx,y+21,y+25)+SY.motor(mx,y+31,'')+`<text class="s-tag" x="${mx+6.5}" y="${y+30}">${scEsc(m.tag)}</text><text class="s-sub" x="${mx+6.5}" y="${y+33}">${scEsc(scTrim(tplOf(m).n,12))}</text>`;ctx.put({motor:m,x:mx,y:y+31});});}}
      ctx.put({e:{d:c.d,act:c.d.id,k:'cons'},x:bx,y:y+12});
      return h;}
    // 開關：每一極一個符號；同一層有好幾台時，每極下面標自己的器具編號
    const poles=[...nd.poles.values()].sort((a,b)=>phOrd(a.ph)-phOrd(b.ph)),multi=nd.devs.length>1;
    poles.forEach(p=>{const xx=x+3+phX(p.ph),c0=y+9,e=p.e;
      h+=SY.line(xx,y,c0-4)+SY.line(xx,c0+4,y+LV-6);
      h+=e.k==='brk'?SY.brk(xx,c0):e.k==='fuse'?SY.fuse(xx,c0):e.k==='nc'?SY.nc(xx,c0):SY.no(xx,c0);if(e.k!=='fuse')h+=SY.line(xx,c0-4,c0-3)+SY.line(xx,c0+3,c0+4);
      h+=`<text class="s-term" x="${xx-.6}" y="${c0-4.4}">${scEsc(termLabel(e.d,e.ta))}</text><text class="s-term" x="${xx-.6}" y="${c0+6.4}">${scEsc(termLabel(e.d,e.tb))}</text>`;
      if(multi)h+=`<text class="s-sub" x="${xx+.5}" y="${c0+9.5}">${scEsc(e.d.tag)}</text>`;
      ctx.put({e,x:xx,y:c0,node:nd.id});});
    const same=nd.devs.length===1&&poles.length>1;
    if(same){const xs=poles.map(p=>x+3+phX(p.ph));h+=`<line class="s-mech" x1="${Math.min(...xs)-3}" y1="${y+9}" x2="${Math.max(...xs)-1}" y2="${y+9}"/>`;}
    const p0=poles[0],ac=p0&&devOf(String(p0.e.act||'').split('#')[0]),tg=nd.devs.length>1?nd.devs.map(d=>d.tag).join('、'):(ac&&ac!==nd.d&&p0.e.k!=='brk'?ac.tag:nd.d.tag);
    const tx=x+4+(poles.length?Math.max(...poles.map(p=>phX(p.ph))):0)+2;
    h+=`<text class="s-tag" x="${tx}" y="${y+8.5}">${scEsc(tg)}</text><text class="s-sub" x="${tx}" y="${y+11.5}">${scEsc(scTrim(tplOf(nd.d).n,12))}</text>`;
    nd._pgCtx=ctx;
    if(nd._trunc){poles.forEach(p=>{const xx=x+3+phX(p.ph);h+=SY.line(xx,y+LV-6,y+LV-2);});h+=`<text class="s-pot" x="${x+3+phX(poles[0]?poles[0].ph:'')+4}" y="${y+LV+1.5}">→ 第 \u0001T:${scEsc(nd.id)}\u0001 頁</text>`;return h;}
    h+=drawKids(nd,x,y+LV-6,ctx,poles.map(p=>p.ph));
    return h;};
  const drawKids=(nd,x,y,ctx,phs)=>{let h='',xx=x;const kx=[];nd.kids.forEach(k=>{kx.push(xx);xx+=wOf(k)*SC.U;});phs=[...new Set(phs)];
    if(nd.kids.length>1){phs.forEach(ph=>{const yb=y+1+Math.max(0,phases.indexOf(ph))*1.6,used=nd.kids.map((k,i)=>[k,kx[i]]).filter(([k])=>scUses(k,ph));if(!used.length)return;
      const xa=x+3+phX(ph),xs=used.map(([k,kx0])=>kx0+3+phX(ph));h+=SY.line(xa,y,yb)+`<line x1="${Math.min(xa,...xs)}" y1="${yb}" x2="${Math.max(xa,...xs)}" y2="${yb}"/>`;
      used.forEach(([k,kx0])=>{const x2=kx0+3+phX(ph);h+=SY.line(x2,yb,y+8)+(x2!==xa?SY.dot(x2,yb):'');});});
      nd.kids.forEach((k,i)=>{h+=drawNode(k,kx[i],y+8,ctx);});}
    else if(nd.kids.length===1){const k=nd.kids[0];phs.forEach(ph=>{if(scUses(k,ph))h+=SY.line(x+3+phX(ph),y,y+8);});h+=drawNode(k,x,y+8,ctx);}
    return h;};
  // 分頁：分支依序排，一頁放不下就換頁；單一分支比一頁還寬時，本頁只畫到那台開關，
  // 它下面的分支放到後面的頁，從標明「某台負載側」的分配線接續
  const cap=Math.floor((SC.X1-SC.X0)/SC.U),plan=[];
  const layout=(kids,bus)=>{let grp={bus,items:[]},cw=0;plan.push(grp);const later=[];
    kids.forEach(k=>{let w=wOf(k);if(w>cap&&!k.cons){k._trunc=true;k._w=ownW(k);w=k._w;later.push(k);}
      if(cw+w>cap&&grp.items.length){grp={bus,items:[],cont:true};plan.push(grp);cw=0;}grp.items.push(k);cw+=w;});
    later.forEach(k=>{const phs=[...new Set([...k.poles.values()].map(p=>p.ph))].sort((a,b)=>phOrd(a)-phOrd(b));
      const lbl=phs.map(ph=>{const p=[...k.poles.values()].find(q=>q.ph===ph);return {ph,net:M.netName(p.e.v)}});
      const start=plan.length;layout(k.kids,{from:k,lbl});k._contAt=plan[start];});};
  layout(root.kids,null);
  const srcTag=[...new Set(acNodes.map(a=>a[2].tag))].join('、');
  plan.forEach((g,gi)=>{const pg=newPage(`主回路${plan.length>1?`（${gi+1}/${plan.length}）`:''}`,'main');g.pg=pg;let h='';const ctx={put:o=>pg.pos.push(o)};
    const y0=30,bus=g.bus;
    phases.forEach((ph,i)=>{const y=y0+i*4,b=bus&&bus.lbl.find(q=>q.ph===ph);if(bus&&!b)return;
      h+=`<line class="s-bus" x1="${SC.X0-8}" y1="${y}" x2="${SC.X1}" y2="${y}"/><text class="s-railn" x="${SC.X0-9}" y="${y+1}" text-anchor="end">${scEsc(b&&b.net?b.net:ph)}</text>`;});
    h+=`<text class="s-sec" x="${SC.X0-8}" y="${y0-4}">${bus?`接續 ${scEsc(bus.from.devs.map(d=>d.tag).join('、'))} 負載側（第 \u0001M:${scEsc(bus.from.id)}\u0001 頁）`:`電源 ${scEsc(srcTag)}`}${g.cont?'（續）':''}</text>`;
    let x=SC.X0;g.items.forEach(k=>{phases.forEach(ph=>{if(scUses(k,ph)){const xx=x+3+phX(ph),yb=y0+phases.indexOf(ph)*4;h+=SY.dot(xx,yb)+SY.line(xx,yb,y0+phases.length*4+6);}});h+=drawNode(k,x,y0+phases.length*4+6,ctx);x+=wOf(k)*SC.U;});
    pg.body=h;});
  // 截斷處的頁碼
  nodes.forEach(nd=>{if(nd._trunc&&nd._contAt)M.contPage=Object.assign(M.contPage||{},{[nd.id]:nd._contAt});});
  plan.forEach(g=>{if(g.bus)(M.fromPage=M.fromPage||{})[g.bus.from.id]=g.bus.from._pg;});
}

function scUses(nd,ph){if(nd.cons)return nd.cons.terms.some(t=>nd.chains.some(c=>c.t.k===t.k&&c.ph===ph));for(const p of nd.poles.values())if(p.ph===ph)return true;return nd.kids.some(k=>scUses(k,ph));}
// 接在用電器具 U／V／W 的馬達（照導線與端子台的同電位找）
function scMotorsOf(M,c){const out=new Set(),UVW=/^(U|V|W)\d?$/;const t=tplOf(c.d);
  t.terms.filter(p=>UVW.test(p.id)).forEach(p=>{const k=M.f(nodeKey({d:c.d.id,t:p.id}));if(!M.wiredNode.has(k))return;
    S.devices.forEach(m=>{if(m===c.d||!/馬達/.test(tplOf(m).cat||''))return;if(tplOf(m).terms.some(q=>UVW.test(q.id)&&M.f(nodeKey({d:m.id,t:q.id}))===k))out.add(m);});});
  return [...out];}

/* ---------- 7. 控制回路（DC）：每個電源一段展開圖 ---------- */
function scCtrlPages(M,pages,newPage){
  const groups=new Map();M.srcs.forEach(s=>{const p=M.f(s.p),n=M.f(s.nn);if(!M.wiredNode.has(p))return;const k=p+'|'+n;if(!groups.has(k))groups.set(k,{p,n,srcs:[]});groups.get(k).srcs.push(s);});
  const used=new Set();const secs=[];
  [...groups.values()].sort((a,b)=>natCmp(a.srcs[0].d.tag,b.srcs[0].d.tag)).forEach(G=>{
    const edges=M.E.filter(e=>!e.aux&&!(M.phase.has(e.u)&&M.phase.has(e.v))&&M.wiredNode.has(e.u)&&M.wiredNode.has(e.v)).map(e=>({u:e.u,v:e.v,t:scLeaf(e)}));
    const tree=spReduce(edges,G.p,G.n);if(!tree)return;
    const lv=scLeaves(tree);lv.forEach(l=>used.add(l.e.id));secs.push({G,tree});});
  M.ctrlTrees=secs; // 測試用
  secs.forEach(({G,tree})=>{
    const tags=G.srcs.map(s=>s.d.tag).join('、'),v=G.srcs[0].v,topName=`${v} ＋`,botName=`${v} −`;
    // 版面：太高時縮小格高；太寬時把中間電位拉成新的電源線
    let LH=16;const avail=SC.RB-SC.RT-14;for(;LH>8;LH-=1){if(scMaxH(tree,LH)<=avail)break;}
    const cap=Math.floor((SC.X1-SC.X0)/SC.U),segs=[];
    const place=(seg,t)=>{const w=scWidth(t);if(w<=cap){seg.items.push({t});return;}
      if(t.t==='par'){t.c.forEach(c=>place(seg,c));return;}
      if(t.t==='ser'){let i=0,bw=-1;t.c.forEach((c,j)=>{const w2=scWidth(c);if(w2>bw){bw=w2;i=j;}});
        const pre=t.c.slice(0,i),suf=t.c.slice(i+1),nA=i>0?t.nodes[i-1]:null,nB=i<t.c.length-1?t.nodes[i]:null;
        const nmA=nA!=null?(M.netName(nA)||'電位'):seg.top,nmB=nB!=null?(M.netName(nB)||'電位'):seg.bot;
        const mk=a=>a.length===1?a[0]:{t:'ser',c:a,nodes:[]};
        if(pre.length)seg.items.push({t:mk(pre),botLbl:nmA});if(suf.length)seg.items.push({t:mk(suf),topLbl:nmB});
        const ns={top:nmA,bot:nmB,items:[]};segs.push(ns);place(ns,t.c[i]);return;}
      seg.items.push({t});};
    const s0={top:topName,bot:botName,items:[]};segs.push(s0);place(s0,tree);
    // 排進頁面
    const all=[];segs.forEach((sg,si)=>sg.items.forEach(it=>all.push({...it,seg:si})));
    let pg=null,x=0,pIdx=0;const pgs=[];
    const open=()=>{pg=newPage(`控制回路 ${v}（${tags}）`,'ctrl',G.srcs.map(s=>s.d.id));pgs.push(pg);x=SC.X0;pg.spans=[];pIdx++;};
    all.forEach(it=>{const w=scWidth(it.t);if(!pg||x+w*SC.U>SC.X1+0.1)open();
      let sp=pg.spans[pg.spans.length-1];if(!sp||sp.seg!==it.seg){sp={seg:it.seg,x0:x,x1:x,items:[]};pg.spans.push(sp);}
      sp.items.push({...it,x});sp.x1=x;x+=w*SC.U;});
    pgs.forEach((pg,pi)=>{let h=`<text class="s-sec" x="${SC.X0-8}" y="${SC.RT-12}">控制回路　${scEsc(v)}　電源 ${scEsc(tags)}${pi?'（續）':''}</text>`;const ctx={LH,M,put:o=>pg.pos.push(o)};
      pg.spans.forEach(sp=>{const sg=segs[sp.seg],xa=sp.x0-4,xb=sp.x1+6;
        h+=`<line class="s-rail" x1="${xa}" y1="${SC.RT}" x2="${xb}" y2="${SC.RT}"/><line class="s-rail" x1="${xa}" y1="${SC.RB}" x2="${xb}" y2="${SC.RB}"/>`;
        h+=`<text class="s-railn" x="${xa}" y="${SC.RT-2}">${scEsc(sg.top)}</text><text class="s-railn" x="${xa}" y="${SC.RB+4}">${scEsc(sg.bot)}</text>`;
        sp.items.forEach(it=>{const sz=scSize(it.t,LH);let y=SC.RT,H=SC.RB-SC.RT;
          if(it.topLbl){h+=`<text class="s-pot" x="${it.x}" y="${SC.RT+5}">↓ ${scEsc(it.topLbl)}</text>`;y=SC.RT+8;H-=8;}
          else h+=SY.dot(it.x,SC.RT);
          if(it.botLbl){H=Math.min(H,sz.h+4);h+=scDraw(it.t,it.x,y,H-4,ctx)+SY.line(it.x,y+H-4,y+H)+`<text class="s-pot" x="${it.x}" y="${y+H+3.5}">↓ ${scEsc(it.botLbl)}</text>`;}
          else{h+=scDraw(it.t,it.x,y,H,ctx)+SY.dot(it.x,SC.RB);}});});
      pg.body=h;});
  });
  return used;
}
const scLeaves=t=>t.t==='leaf'?[t]:t.c.flatMap(scLeaves);
function scMaxH(t,LH){return scSize(t,LH).h;}

/* ---------- 8. PLC I/O：每點一欄 ---------- */
function scPlcPages(M,pages,newPage){
  const plcs=S.devices.filter(d=>M.E.some(e=>e.d===d&&(e.k==='plcx'||e.k==='plcy'))).sort((a,b)=>natCmp(a.tag,b.tag));
  const byNode=new Map();M.E.forEach(e=>[e.u,e.v].forEach(k=>{if(!byNode.has(k))byNode.set(k,[]);byNode.get(k).push(e);}));
  plcs.forEach(d=>['plcx','plcy'].forEach(kind=>{
    const pts=M.E.filter(e=>e.d===d&&e.k===kind&&M.wiredNode.has(kind==='plcx'?e.u:e.v));if(!pts.length)return;
    const per=16,cw=22;
    for(let i=0;i<pts.length;i+=per){const part=pts.slice(i,i+per),pg=newPage(`PLC ${kind==='plcx'?'輸入':'輸出'}　${d.tag}${pts.length>per?`（${i/per+1}）`:''}`,'plc');
      const dn=tplOf(d).n,hd=d.tag===dn||dn.startsWith(d.tag)?dn:`${d.tag}　${dn}`;let h=`<text class="s-sec" x="${SC.X0-8}" y="30">PLC ${kind==='plcx'?'輸入':'輸出'}　${scEsc(hd)}</text>`;
      const bx=SC.X0,by=168,bw=part.length*cw+8;
      h+=`<rect class="s-dev" x="${bx}" y="${by}" width="${bw}" height="22"/><text class="s-tag" x="${bx+2}" y="${by+19}">${scEsc(scTrim(hd,50))}</text>`;
      part.forEach((e,j)=>{const x=bx+6+j*cw+cw/2-4,k=kind==='plcx'?e.u:e.v,nm=M.netName(k);
        h+=`<text class="s-in" x="${x}" y="${by+5}" style="font-size:2.4px;font-weight:700">${scEsc(ptName(e))}</text><text class="s-in" x="${x}" y="${by+9}">${scEsc(termLabel(d,e.pt)||e.pt)}</text>`;
        h+=SY.line(x,92,by)+(nm?`<text class="s-netv" transform="translate(${x+.7} ${by-14}) rotate(90)">${scEsc(nm)}</text>`:'');
        // 接在這一點的現場器具
        const nb=(byNode.get(k)||[]).filter(q=>q!==e&&!(q.d===d&&q.k===kind)).sort((a,b)=>(a.load===(kind==='plcy')?-1:1)-(b.load===(kind==='plcy')?-1:1));
        const f0=nb[0];
        if(f0){const c=80;const g=f0.k;h+=SY.line(x,60,c-4)+SY.line(x,c+4,92);
          h+=g==='coil'?SY.coil(x,c):g==='nc'?SY.nc(x,c):g==='sens'?SY.no(x,c)+SY.sensA(x,c):g==='no'||g==='brk'||g==='plcy'?SY.no(x,c):scLamp(f0)?SY.lamp(x,c):SY.box(x,c,f0.name||'');
          if((g==='no'||g==='nc')&&(f0.by==='btn'||f0.by==='op'))h+=SY.btn(x,c);
          const ad=devOf(String(f0.act).split('#')[0]),tg=f0.ctl&&ad&&ad!==f0.d&&['coil','host','op'].includes(f0.by)?ad.tag:f0.d.tag;
          h+=`<text class="s-tag" x="${x+4.4}" y="${c-.6}">${scEsc(tg)}</text><text class="s-sub" x="${x+4.4}" y="${c+2.2}">${scEsc(scTrim(scDevName(f0.d),9))}</text>`;
          const far=f0.u===k?f0.v:f0.u,fn=M.netName(far);h+=`<text class="s-pot" x="${x}" y="58">${scEsc(fn||'')}</text>`;
          if(nb.length>1)h+=`<text class="s-sub" x="${x-3}" y="100">另有 ${nb.length-1} 個</text>`;
          pg.pos.push({e:f0,x,y:c});}
        else h+=`<text class="s-sub" x="${x-3}" y="88">（只有接線）</text>`;
        pg.pos.push({e,x,y:by});});
      // 共點
      const coms=[...new Set(part.map(e=>kind==='plcx'?e.tb:e.ta))].filter(Boolean);
      h+=`<text class="s-sub" x="${bx}" y="${by+28}">共點：${scEsc(coms.map(c=>{const k=M.f(nodeKey({d:d.id,t:c}));const nm=M.netName(k);return `${termLabel(d,c)||c}${nm?' → '+nm:''}`;}).join('、'))}</text>`;
      pg.body=h;}
  }));
}

/* ---------- 9. 表格頁（端子台、線號、材料） ---------- */
function scTablePages(newPage,title,head,rows,per=34){
  if(!rows.length)return;for(let i=0;i<rows.length;i+=per){const pg=newPage(`${title}${rows.length>per?`（${i/per+1}）`:''}`,'table');
    pg.html=`<table class="s-table"><thead><tr>${head.map(h=>`<th>${scEsc(h)}</th>`).join('')}</tr></thead><tbody>${rows.slice(i,i+per).map(r=>`<tr>${r.map(v=>`<td>${scEsc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;}}

/* ---------- 10. 組合全部頁面 ---------- */
function schemBuild(){
  const M=schemModel(),pages=[];let no=0;
  const d=new Date(),p2=n=>String(n).padStart(2,'0'),meta={date:`${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`,title:S.docTitle||'（未命名專案）',ver:($('ver')&&$('ver').textContent)||''};
  const newPage=(title,kind,src)=>{const pg={no:++no,title,kind,src,pos:[],body:'',html:''};pages.push(pg);return pg;};
  const cover=newPage('封面與圖例','cover'),index=newPage('圖面目錄','index');
  scMainPages(M,pages,newPage,meta);
  const used=scCtrlPages(M,pages,newPage);
  scPlcPages(M,pages,newPage);
  { const T=tbTables();T.forEach(t=>scTablePages(newPage,`端子台 ${t.d.tag}`,['片／端子','接線（點：線號 → 對端）'],[...t.rows,...(t.jump.length?[['短路片',t.jump.join('、')]]:[])]));}
  scTablePages(newPage,'線號表',['線號','線徑','線色','起點','終點'],[...S.wires].sort((a,b)=>natCmp(a.no,b.no)).map(w=>[w.no,w.gauge,colorOf(w).n,epShort(w.a),epShort(w.b)]));
  { const bom=bomRows();scTablePages(newPage,'材料表',['分類','品名／型號','廠牌','數量','單位','器具編號'],bom.map(r=>[r.sec,r.name,r.brand,r.qty,r.unit,r.tags]),30); }
  // 封面
  const cnt=k=>pages.filter(p=>p.kind===k).length;
  cover.body=`<text class="s-big" x="${SC.W/2}" y="70">電路圖</text><text class="s-big2" x="${SC.W/2}" y="84">${scEsc(meta.title)}</text>
    <text class="s-cv" x="${SC.W/2}" y="96">${scEsc(meta.date)}　${S.devices.length} 器具　${S.wires.length} 條線　共 \u0001N\u0001 頁</text>
    <text class="s-cv" x="${SC.W/2}" y="104">由盤面配線模擬器依配線資料自動產生；符號照 IEC 60617。器具接點、規格請以原廠資料與實物為準。</text>`+scLegend(60,130);
  // 圖面目錄
  const rows=pages.map(p=>[p.no,p.title]);index.html=`<table class="s-table s-idx"><thead><tr><th>頁</th><th>圖名</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r[0]}</td><td>${scEsc(r[1])}</td></tr>`).join('')}</tbody></table>`;
  // 未畫進控制回路、也不在主回路的有接線負載（例如接到沒有動作資料的器具），列在目錄頁
  const noSim=S.devices.filter(x=>!hasSim(x)&&S.wires.some(w=>w.a.d===x.id||w.b.d===x.id)&&!isTB(x)).map(x=>x.tag);
  if(noSim.length)index.html+=`<p class="s-note">沒有動作資料、電路圖只出現在端子台表與線號表的器具：${scEsc(noSim.join('、'))}</p>`;
  // 交互參照：線圈下方列出接點在哪一頁哪一欄；電源供應器輸出接到哪一頁
  const loc=new Map();pages.forEach(pg=>pg.pos.forEach(o=>{if(!o.e)return;const k=o.e.act;if(!loc.has(k))loc.set(k,[]);loc.get(k).push({o,s:`${pg.no}.${scCol(o.x)}`});}));
  const xref=act=>{const L=(loc.get(act)||[]).filter(x=>x.o.e.ctl&&['no','nc'].includes(x.o.e.k)).map(x=>`${x.o.e.k==='nc'?'⊥':'∟'}${termLabel(x.o.e.d,x.o.e.ta)}-${termLabel(x.o.e.d,x.o.e.tb)} ${x.s}`);
    return L.slice(0,4).map((t,i)=>`<tspan x="0" dy="${i?2.2:0}">${scEsc(t)}</tspan>`).join('')+(L.length>4?`<tspan x="0" dy="2.2">…等 ${L.length} 個</tspan>`:'');};
  const srcPage=id=>{const pg=pages.find(p=>p.kind==='ctrl'&&(p.src||[]).includes(id));return pg?pg.no:'—';};
  const fill=s=>s.replace(/<text class="s-xref" x="([\d.]+)" y="([\d.]+)">\u0001C:([^\u0001]*)\u0001<\/text>/g,(m,x,y,a)=>`<text class="s-xref" transform="translate(${x} ${y})">${xref(a.replace(/&amp;/g,'&'))}</text>`)
    .replace(/\u0001S:([^\u0001]*)\u0001/g,(m,id)=>srcPage(id)).replace(/\u0001T:([^\u0001]*)\u0001/g,(m,id)=>{const g=(M.contPage||{})[id.replace(/&gt;/g,'>').replace(/&amp;/g,'&')];return g&&g.pg?g.pg.no:'—';}).replace(/\u0001M:([^\u0001]*)\u0001/g,(m,id)=>{const k=id.replace(/&gt;/g,'>').replace(/&amp;/g,'&');const pg=pages.find(p=>p.pos.some(o=>o.node===k));return pg?pg.no:'—';}).replace(/\u0001P:(\d+)\u0001/g,'$1').replace(/\u0001N\u0001/g,String(pages.length));
  return {M,pages:pages.map(pg=>({...pg,svg:fill(`<svg class="s-svg" viewBox="0 0 ${SC.W} ${SC.H}" xmlns="http://www.w3.org/2000/svg">${scFrame(pg,meta)}<text class="s-ptitle" x="${SC.M+8}" y="${SC.M+12}">${scEsc(pg.title)}</text>${pg.body}</svg>`),html:fill(pg.html||'')})),used,meta};
}
// 圖例
function scLegend(x,y){const L=[['no','常開接點'],['nc','常閉接點'],['brk','斷路器'],['fuse','保險絲'],['btn','按鈕（手動）'],['trip','熱動（積熱電驛）'],['sens','感測器輸出'],['coil','線圈'],['lamp','指示燈'],['box','負載／器具電源'],['plcx','PLC 輸入']];
  let h=`<text class="s-sec" x="${x}" y="${y-8}">圖例（IEC 60617）</text>`;
  L.forEach(([k,t],i)=>{const xx=x+i*28,c=y+8;h+=SY.line(xx,y,c-4)+SY.line(xx,c+4,y+16);
    h+=k==='btn'?SY.no(xx,c)+SY.btn(xx,c):k==='trip'?SY.nc(xx,c)+SY.trip(xx,c):k==='sens'?SY.no(xx,c)+SY.sensA(xx,c):k==='box'?SY.box(xx,c,'負載'):k==='plcx'?SY.plcx(xx,c,'X0'):SY[k](xx,c);
    if(['no','nc','brk','btn','trip','sens'].includes(k))h+=SY.line(xx,c-4,c-3)+SY.line(xx,c+3,c+4);
    h+=`<text class="s-sub" x="${xx-6}" y="${y+22}">${t}</text>`;});
  h+=`<text class="s-sub" x="${x}" y="${y+34}">接點旁的大字是器具編號（輔助接點、裝在操作部上的接點塊標示帶動它的器具）；左邊小字是端子號；線上的小字是線號。</text>
    <text class="s-sub" x="${x}" y="${y+38}">線圈下方列出它的接點在第幾頁第幾欄（∟ 常開、⊥ 常閉）；頁面上下的 1～10 是欄號、左右的 A～F 是列號。＊ 表示同一個接點因為迴路無法化簡而出現在多處。</text>`;
  return h;}
function schemPrintHtml(){const B=schemBuild();return B.pages.map(pg=>`<section class="pg sch"><div class="sch-pg">${pg.svg}${pg.html?`<div class="sch-body">${pg.html}</div>`:''}</div></section>`).join('');}

/* ---------- 11. 驗證：圖反推回連接，要和配線一致 ---------- */
function schemVerify(B){
  B=B||schemBuild();const M=B.M,bad=[];let checked=0;
  // 控制回路：每個葉子從樹的位置推出兩端節點，必須等於元素真正的兩端
  const groups=new Map();M.srcs.forEach(s=>{const p=M.f(s.p),n=M.f(s.nn);if(M.wiredNode.has(p))groups.set(p+'|'+n,{p,n});});
  groups.forEach(G=>{const edges=M.E.filter(e=>!e.aux&&!(M.phase.has(e.u)&&M.phase.has(e.v))&&M.wiredNode.has(e.u)&&M.wiredNode.has(e.v)).map(e=>({u:e.u,v:e.v,t:scLeaf(e)}));
    const tree=spReduce(edges,G.p,G.n);if(!tree)return;
    const walk=(t,a,b)=>{if(t.t==='leaf'){if(t.dup)return;checked++;const [x,y]=t.rev?[t.e.v,t.e.u]:[t.e.u,t.e.v];if(x!==a||y!==b)bad.push(`${t.e.d.tag} ${t.e.ta}-${t.e.tb}`);return;}
      if(t.t==='par'){t.c.forEach(c=>walk(c,a,b));return;}
      const ns=[a,...(t.nodes||[]),b];if(ns.length!==t.c.length+1){t.c.forEach(c=>{if(c.t==='leaf')return;});return;}t.c.forEach((c,i)=>walk(c,ns[i],ns[i+1]));};
    walk(tree,G.p,G.n);});
  bad.checked=checked; // 檢查了幾個元素（避免空檢查）
  return bad;}

/* ---------- 12. 工具分頁：專案名稱、預覽、列印 ---------- */
function schemSectionHtml(){
  return `<div class="bom-h">正式電路圖</div><p class="note">依配線自動產生 A3 橫式電路圖（IEC 60617 符號）：封面與圖例、目錄、主回路、控制回路（每個 DC 電源一段展開圖）、PLC 輸入輸出、端子台表、線號表、材料表。每頁有欄號、列號與標題欄，線圈下方列出接點在哪一頁哪一欄。列印時選「另存為 PDF」，紙張 A3 橫式。</p>
    <label class="sch-ttl">標題欄的專案名稱<input id="schTitle" maxlength="60" placeholder="（未命名專案）" value="${esc(S.docTitle||'')}"></label>
    <div class="row" style="justify-content:flex-start"><button class="tool" id="schPrev">預覽</button><button class="tool" id="schPrint">列印電路圖（PDF）</button></div>`;}
function schemSectionBind(){
  const t=$('schTitle');if(t)t.onchange=()=>{const v=t.value.trim().slice(0,60);if(v)S.docTitle=v;else delete S.docTitle;commit();};
  const p=$('schPrint');if(p)p.onclick=()=>toolPrint('schem');
  const v=$('schPrev');if(v)v.onclick=schemPreview;}
function schemPreview(){
  let o=$('schPrevBox');if(!o){o=document.createElement('div');o.id='schPrevBox';document.body.appendChild(o);}
  let html;try{html=schemPrintHtml();}catch(e){toast('產生電路圖時發生錯誤：'+e.message);return;}
  o.innerHTML=`<div class="sch-bar"><b>電路圖預覽</b><span class="note">實際列印為 A3 橫式</span><button class="tool" id="schPrevPrint">列印（PDF）</button><button class="tool" id="schPrevClose">關閉 ✕</button></div><div class="sch-pages">${html}</div>`;
  o.hidden=false;$('schPrevClose').onclick=()=>{o.hidden=true;o.innerHTML='';};$('schPrevPrint').onclick=()=>{o.hidden=true;o.innerHTML='';toolPrint('schem');};}

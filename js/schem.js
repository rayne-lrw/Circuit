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
const SC={W:420,H:297,M:10,COLS:10,U:30,X0:36,X1:404,RT:44,RB:236};
/* 畫法：IEC 60617（現行 JIS C 0617 相同），控制回路電源線在上下、迴路垂直 */
const SC_V={U:30,X0:36,X1:404,RT:44,RB:236};

const SC_PH=['R','S','T','L1','L2','L3','L','N'];
const scEsc=s=>esc(String(s==null?'':s));
const scTrim=(s,n)=>{s=String(s||'');return s.length>n?s.slice(0,n-1)+'…':s;};
// 估計文字寬度（mm）：中文字約 1 個字高，英數約 0.6 個字高
const scTW=(s,fs)=>[...String(s||'')].reduce((a,ch)=>a+(ch.charCodeAt(0)>0x2e80?1:/[A-Z0-9]/.test(ch)?.66:.56),0)*fs;
// 讓文字放進 w mm：先縮字到 minFs，還放不下就截斷；回傳 {t, fs}
function scFit(s,w,fs,minFs){s=String(s||'');minFs=minFs||fs*.72;let f=fs;const tw=scTW(s,fs);if(tw>w)f=Math.max(minFs,fs*w/tw*.999);/* .999：縮完剛好等寬時避免浮點誤差又被截 */let t=s;while(t.length>1&&scTW(t,f)>w)t=t.slice(0,-1);if(t!==s)t=t.slice(0,-1)+'…';return {t,fs:Math.round(f*100)/100};}
const scTx=(cls,x,y,s,w,fs,extra)=>{const F=scFit(s,w,fs);return `<text class="${cls}" x="${x}" y="${y}"${F.fs!==fs||extra?` style="${F.fs!==fs?`font-size:${F.fs}px;`:''}${extra||''}"`:''}>${scEsc(F.t)}</text>`;};
// 換行：照估算寬度斷行（英數連在一起的盡量不拆），回傳每一行
function scWrap(s,w,fs){const tk=String(s||'').match(/（[^）]{1,6}）|[A-Za-z0-9.\-_/+#()%ΩØø]+|\s+|./gu)||[],L=[];let cur='';
  const push=()=>{if(cur.trim())L.push(cur.trim());cur='';};
  tk.forEach(t=>{if(scTW(cur+t,fs)<=w){cur+=t;return;}if(cur.trim())push();if(/^\s+$/.test(t))return;
    if(scTW(t,fs)<=w){cur=t;return;}for(const ch of t){if(scTW(cur+ch,fs)>w&&cur){push();}cur+=ch;}});push();return L;}
// 多行文字：先試縮到 85%，還放不下就換行（最多 maxL 行，超過才截斷）；水平模式（座標會對調）只用一行
const scTxW=(cls,x,y,s,w,fs,maxL,lh,extra)=>{s=String(s||'');if(maxL<=1)return scTx(cls,x,y,s,w,fs,extra);
  let f=fs,L=scWrap(s,w,f);if(L.length>1&&scTW(s,fs*.85)<=w){f=fs*.85;L=[s];}
  // 型號這類英數字串比一行寬一點：先縮字，不把型號拆開
  else{const tk=s.match(/[A-Za-z0-9.\-_/+#()%Ω]+/g)||[],mx=Math.max(0,...tk.map(t=>scTW(t,fs)));if(mx>w&&mx*.85<=w){f=fs*.85;L=scWrap(s,w,f);}}
  if(L.length>maxL){const r=L.slice(maxL-1).join('');L=L.slice(0,maxL-1);L.push(scFit(r,w,f,f).t);}
  return `<text class="${cls}" x="${x}" y="${y}"${f!==fs||extra?` style="${f!==fs?`font-size:${Math.round(f*100)/100}px;`:''}${extra||''}"`:''}>${L.map((t,i)=>`<tspan x="${x}" dy="${i?lh:0}">${scEsc(t)}</tspan>`).join('')}</text>`;};
const SCF={tag:3.8,sub:2.8,term:2.5,net:2.4,xref:2.4,inn:2.6}; // 字級（mm），和 CSS 一致

/* ---------- 1. 模型：節點、元素 ---------- */
function schemModel(){
  const save=SIMST;let r;try{SIMST=null;simReset();SIMST.all=true;r=simRun();}finally{SIMST=save;}
  const {els,node,wireKeys}=r.topo;
  const P=new Map(),f=k=>{k=node(k);if(!P.has(k))P.set(k,k);while(P.get(k)!==k){P.set(k,P.get(P.get(k)));k=P.get(k);}return k;},un=(a,b)=>{const x=f(a),y=f(b);if(x!==y)P.set(x,y);};
  const isFuse=d=>/保險絲/.test(tplOf(d).n||'')&&!tplOf(d).cat.startsWith('端子');
  // 不畫出來的內部導通（電源供應器 +V1／+V2、插座 L／N）先合併
  const isOL=d=>els.some(q=>q.d===d&&q.k==='sw'&&q.by==='trip'); // 積熱電驛：主回路的熱動元件要畫出來
  els.forEach(e=>{if(e.k==='pass'&&!isFuse(e.d)&&!isOL(e.d))un(e.aK,e.bK);});
  const E=[],srcs=[],acs=[],pnoz=[];let n=0;
  const act=(e)=>{const d=e.d;switch(e.by){case 'coil':return d.id+(e.g?'#'+e.g:'');case 'host':case 'hostbrk':case 'hosttrip':case 'hostel':return d.on||d.id;case 'op':return d.on||d.id;default:return d.id;}};
  const add=(o)=>{o.id='e'+(++n);E.push(o);return o;};
  els.forEach(e=>{const d=e.d;
    if(e.k==='sw')add({d,el:e,k:e.nc?'nc':'no',a:e.aK,b:e.bK,ta:e.a,tb:e.b,act:act(e),by:e.by,ctl:true});
    else if(e.k==='brk')add({d,el:e,k:'brk',a:e.aK,b:e.bK,ta:e.a,tb:e.b,act:d.id,ctl:true});
    else if(e.k==='pass'&&isOL(d))add({d,el:e,k:'ol',a:e.aK,b:e.bK,ta:e.a,tb:e.b,act:d.id,ctl:true});
    else if(e.k==='pass'&&isFuse(d))add({d,el:e,k:'fuse',a:e.aK,b:e.bK,ta:e.a,tb:e.b,act:d.id,ctl:true});
    else if(e.k==='sens')add({d,el:e,k:'sens',a:e.toK,b:e.outK,ta:e.to,tb:e.out,act:d.id,ctl:true});
    else if(e.k==='plcY')e.pairsK.forEach(([y,yk,ck],i)=>add({d,el:e,k:'plcy',a:ck,b:yk,ta:e.pairs[i][1],tb:y,act:d.id,ctl:true,pt:y}));
    else if(e.k==='coil')add({d,el:e,k:'coil',a:e.aK,b:e.bK,ta:e.a,tb:e.b,act:d.id+(e.g?'#'+e.g:''),load:true});
    else if(e.k==='load'||e.k==='pwr')add({d,el:e,k:e.k,a:e.aK,b:e.bK,ta:e.a,tb:e.b,act:d.id,load:true,name:e.name||(e.k==='pwr'?'電源':'負載'),aux:!!e.aux});
    else if(e.k==='plcX')e.ptsK.forEach(([t,k])=>add({d,el:e,k:'plcx',a:k,b:e.comK,ta:t,tb:e.com,act:d.id,load:true,pt:t}));
    else if(e.k==='src')srcs.push({d,e,p:e.pK,nn:e.nK,v:e.v||'DC',inK:e.inK,inT:e.in});
    else if(e.k==='ac')acs.push({d,e});
    else if(e.k==='pnoz'&&e.insK)pnoz.push({d,e});}); // 安全繼電器的輸入迴路：在控制回路頁當成小段畫
  S.devices.filter(d=>/^diode/.test(d.tpl)&&!els.some(e=>e.d===d)).forEach(d=>{const T=(tplOf(d).terms||[]).map(t=>t.id);
    if(T.includes('A')&&T.includes('K'))add({d,k:'diode',a:nodeKey({d:d.id,t:'A'}),b:nodeKey({d:d.id,t:'K'}),ta:'A',tb:'K',act:d.id,ctl:true});});
  E.forEach(e=>{e.u=f(e.a);e.v=f(e.b);});
  // 多線式感測器：電源（棕－藍）和輸出（棕→黑／白）是同一顆，畫在一起
  E.forEach(e=>{if(e.k==='pwr'&&E.some(q=>q.d===e.d&&q.k==='sens'))e.sensPwr=true;});
  // 有接線的元素才畫（沒接線的接點不出現在圖上）
  const wiredNode=new Set();S.wires.forEach(w=>{const wk=wireKeys.get(w.id);if(wk)wk.keys.forEach(k=>wiredNode.add(f(k)));(wk&&wk.pairs||[]).forEach(([a,b])=>{wiredNode.add(f(a));wiredNode.add(f(b));});});
  // 節點名稱：接在這一點的線最常用的線號
  const cnt=new Map();S.wires.forEach(w=>{const wk=wireKeys.get(w.id);if(!wk)return;const ks=new Set();wk.pairs.forEach(([a,b])=>{ks.add(f(a));ks.add(f(b));});wk.keys.forEach(k=>ks.add(f(k)));
    const wt=wk.pairs&&wk.pairs.length>1?.4:1; /* 排線（一條線很多針）的線號比單線不優先 */ks.forEach(k=>{if(!cnt.has(k))cnt.set(k,new Map());const m=cnt.get(k);m.set(w.no,(m.get(w.no)||0)+wt);});});
  const netName=k=>{const m=cnt.get(k);if(!m)return '';return [...m.entries()].sort((a,b)=>b[1]-a[1]||natCmp(a[0],b[0]))[0][0];};
  // 相別：從 AC 電源沿著接點傳下去
  const phase=new Map(),adj=new Map(),link=(x,e)=>{if(!adj.has(x))adj.set(x,[]);adj.get(x).push(e);};
  E.filter(e=>e.ctl).forEach(e=>{link(e.u,e);link(e.v,e);});
  const acNodes=[];acs.forEach(({d,e})=>{e.phK.forEach((k,i)=>acNodes.push([f(k),e.ph[i],d]));if(e.nK)acNodes.push([f(e.nK),'N',d]);});
  { const q=[];acNodes.forEach(([k,ph])=>{if(!phase.has(k)){phase.set(k,ph);q.push(k);}});
    while(q.length){const x=q.shift();(adj.get(x)||[]).forEach(e=>{const y=e.u===x?e.v:e.u;if(!phase.has(y)){phase.set(y,phase.get(x));q.push(y);}});} }
  return {E,srcs,acs,pnoz,acNodes,f,netName,phase,adj,wiredNode,res:r};
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
  diode:(x,c,dn)=>{const a=dn?-2:2;return `<path d="M${x-2.6} ${c+a} L${x+2.6} ${c+a} L${x} ${c-a} Z" fill="#fff"/><line x1="${x-2.6}" y1="${c-a}" x2="${x+2.6}" y2="${c-a}"/><line x1="${x}" y1="${c-4}" x2="${x}" y2="${c+4}"/>`;}, // 三角形指向陰極 K
  ol:(x,c)=>`<rect x="${x-2.2}" y="${c-4}" width="4.4" height="8" fill="#fff"/><path d="M${x} ${c-4} L${x} ${c-2} L${x+1.2} ${c-2} L${x+1.2} ${c+.4} L${x-1.2} ${c+.4} L${x-1.2} ${c+2} L${x} ${c+2} L${x} ${c+4}"/>`,
  co:(x,c,x2)=>`<line x1="${x}" y1="${c-3}" x2="${x+3.3}" y2="${c+2.9}"/><line x1="${x+2.2}" y1="${c+3.2}" x2="${x2}" y2="${c+3.2}"/>`,
  fuse:(x,c)=>`<rect x="${x-1.5}" y="${c-4}" width="3" height="8" fill="#fff"/><line x1="${x}" y1="${c-4}" x2="${x}" y2="${c+4}"/>`,
  btn:(x,c)=>`<path d="M${x-1.6} ${c} H${x-6.5}" stroke-dasharray="1 .8"/><path d="M${x-6.5} ${c-1.6}V${c+1.6}"/>`,
  trip:(x,c)=>`<path d="M${x-1.6} ${c} H${x-4.5}" stroke-dasharray="1 .8"/><path d="M${x-4.5} ${c}v-1.3h-1.3v2.6h-1.3v-1.3"/>`,
  sensA:(x,c)=>`<path d="M${x-1.6} ${c} H${x-4.5}" stroke-dasharray="1 .8"/><path d="M${x-4.5} ${c}l-1.4 -1.4l-1.4 1.4l1.4 1.4z"/>`,
  coil:(x,c)=>`<rect x="${x-4}" y="${c-2.6}" width="8" height="5.2" fill="#fff"/>`,
  lamp:(x,c,d)=>`<circle cx="${x}" cy="${c}" r="3" fill="#fff"/><path d="M${x-2.1} ${c-2.1}l4.2 4.2M${x+2.1} ${c-2.1}l-4.2 4.2"/>`,
  box:(x,c,t)=>`<rect x="${x-6.5}" y="${c-3.4}" width="13" height="6.8" fill="#fff"/>`+(scFit(t,11.4,SCF.inn).t===t?scTx('s-in',x,c+1,t,11.4,SCF.inn):`<text class="s-in" style="font-size:2.1px">${scWrap(t,11.4,2.1).slice(0,2).map((q,i)=>`<tspan x="${x}" y="${c-.3+i*2.5}">${scEsc(q)}</tspan>`).join('')}</text>`), // 方框裡放不下就分兩行
  plcx:(x,c,t)=>`<rect x="${x-5.5}" y="${c-3.2}" width="11" height="6.4" fill="#fff"/>`+scTx('s-in',x,c+1,t,9.6,SCF.inn),
  dot:(x,y)=>`<circle class="s-dot" cx="${x}" cy="${y}" r=".7"/>`,
  motor:(x,c,t)=>`<circle cx="${x}" cy="${c}" r="5.5" fill="#fff"/><text class="s-in" x="${x}" y="${c+.2}" style="font-size:3px">M</text><text class="s-in" x="${x}" y="${c+3.2}" style="font-size:1.8px">${scEsc(t||'')}</text>`,
};
const scIsLoad=e=>!!e.load&&!e.sensPwr; // 感測器電源不當負載往下推（要和輸出接點並排）
const scHasLoad=t=>t.t==='leaf'?scIsLoad(t.e):t.c.some(scHasLoad);
const scLamp=e=>/燈/.test(e.name||'');
function scDevName(d){const t=tplOf(d);return scTrim((d.model&&t.model?d.model:'')||t.n,16);}

/* ---------- 4. 版面：樹的大小與畫法（垂直：串聯往下、並聯往右） ---------- */
let SC_XR=new Map();const scXrEx=e=>{if(e.k!=="coil")return 0;const n=Math.min(4,SC_XR.get(e.act)||0);return n>1?(n-1)*2.9+3:0;};
function scSize(t,LH){if(t.t==='leaf')return {w:1,h:LH+scXrEx(t.e)};if(t.t==='ser'){const s=t.c.map(c=>scSize(c,LH));return {w:Math.max(...s.map(q=>q.w)),h:s.reduce((a,q)=>a+q.h,0)};}
  const s=t.c.map(c=>scSize(c,LH));return {w:s.reduce((a,q)=>a+q.w,0),h:Math.max(...s.map(q=>q.h))+6};}
function scWidth(t){return scSize(t,10).w;}
// ctx：{LH, put(leafInfo)：記錄位置, M：模型}
function scDraw(t,x,y,H,ctx){
  const LH=ctx.LH;let h='';
  if(t.t==='leaf')return scLeafSvg(t,x,y,H,ctx);
  if(t.t==='ser'){const sz=t.c.map(c=>scSize(c,LH)),nat=sz.reduce((a,q)=>a+q.h,0),extra=Math.max(0,H-nat);
    const stretchBefore=t.c.findIndex(scHasLoad);let yy=y; // 線圈、負載一律往下對齊：從第一個含負載的部分開始往下推
    t.c.forEach((c,i)=>{if(i===stretchBefore&&extra>0){h+=SY.line(x,yy,yy+extra);yy+=extra;}
      h+=scDraw(c,x,yy,sz[i].h,ctx);yy+=sz[i].h;
      if(i<t.c.length-1&&t.nodes&&t.nodes[i]!=null){const nm=ctx.M.netName(t.nodes[i]);const sensUp=t.c[i].t==='leaf'&&(t.c[i].e.k==='sens'||t.c[i].e.sensPwr||t.c[i]._ln>3);
        if(nm)h+=scTx('s-net',x+1.2,t.c[i+1].t==='par'||t.c[i].t==='par'||sensUp?yy+3.6:yy+.9,nm,SC.U*.45,SCF.net);}});
    if(stretchBefore<0&&extra>0)h+=SY.line(x,yy,y+H);
    return h;}
  // 並聯
  const sz=t.c.map(c=>scSize(c,LH));let xx=x;const xs=[];t.c.forEach((c,i)=>{xs.push(xx);xx+=sz[i].w*SC.U;});
  const top=y,bot=y+H,inH=H-6,so=t.c.map((c,i)=>{const sv=scSensHead(c);if(!sv)return null;
    const j=t.c.findIndex((q,jj)=>jj<i&&q.t==='leaf'&&q.e.sensPwr&&q.e.d===sv.leaf.e.d);return j<0?null:{sv,j};});
  const co=t.c.map(()=>null);for(let i=0;i+1<t.c.length;i++){if(so[i]||so[i+1]||co[i])continue;const a=scHeadOf(t.c[i]),b=scHeadOf(t.c[i+1]);if(scCoPair(a,b)){a.leaf.co={x2:xs[i+1]};co[i+1]={i,b};}}
  so.forEach((v,i)=>{if(!v&&co[i])so[i]={co:co[i]};});
  const tops=t.c.map((c,i)=>i).filter(i=>!so[i]),tr=xs[Math.max(...tops)];const outN=new Map();
  h+=`<line x1="${x}" y1="${top}" x2="${tr}" y2="${top}"/><line x1="${x}" y1="${bot}" x2="${xs[xs.length-1]}" y2="${bot}"/>`;
  t.c.forEach((c,i)=>{if(so[i]&&so[i].co){const q=so[i].co;h+=scCoOut(q.b,xs[q.i],top+3+LH/2,xs[i],top+3+inH,ctx)+SY.line(xs[i],top+3+inH,bot);}
    else if(so[i]){const {sv,j}=so[i],k=outN.get(j)||0;outN.set(j,k+1);h+=scSensOut(sv,xs[j],top+3+LH/2,k,xs[i],top+3+inH,ctx)+SY.line(xs[i],top+3+inH,bot);}
    else h+=SY.line(xs[i],top,top+3)+scDraw(c,xs[i],top+3,inH,ctx)+SY.line(xs[i],top+3+inH,bot);
    if(i>0&&i<t.c.length-1)h+=SY.dot(xs[i],bot);if(i>0&&!so[i]&&xs[i]<tr)h+=SY.dot(xs[i],top);});
  if(t.c.length>1){h+=SY.dot(x,bot);if(tr>x)h+=SY.dot(x,top);}
  return h;}
function scLeafSvg(t,x,y,H,ctx){
  const e=t.e,d=e.d,c=scIsLoad(e)&&H>ctx.LH?y+H-ctx.LH/2:y+Math.min(H,ctx.LH)/2,box=['load','pwr','plcx'].includes(e.k)&&!scLamp(e),g=4;let h=SY.line(x,y,c-g)+SY.line(x,c+g,y+H); // 水平時方框沿線方向較長，線要停在框外
  const [tTop,tBot]=t.rev?[e.tb,e.ta]:[e.ta,e.tb];
  if(t.co)h+=SY.co(x,c,t.co.x2);else if(e.k==='no'||e.k==='plcy')h+=SY.no(x,c);else if(e.k==='nc')h+=SY.nc(x,c);else if(e.k==='brk')h+=SY.brk(x,c);else if(e.k==='fuse')h+=SY.fuse(x,c);else if(e.k==='ol')h+=SY.ol(x,c);else if(e.k==='diode')h+=SY.diode(x,c,tTop==='A');
  else if(e.k==='sens')h+=SY.no(x,c)+SY.sensA(x,c);else if(e.k==='coil')h+=SY.coil(x,c);else if(e.k==='plcx')h+=SY.plcx(x,c,ptName(e));
  else if(scLamp(e))h+=SY.lamp(x,c,d);else h+=SY.box(x,c,e.sensPwr?'感測器':e.name);
  if((e.k==='no'||e.k==='nc')&&(e.by==='btn'||e.by==='op'))h+=SY.btn(x,c);else if((e.k==='no'||e.k==='nc')&&e.by==='trip')h+=SY.trip(x,c);
  if(!['coil','plcx','load','pwr'].includes(e.k)||e.k==='coil'){h+=SY.line(x,c-4,c-3)+SY.line(x,c+3,c+4);}
  // 文字：器具編號（接點標示動作來源）、說明、接點號；從符號右緣外面開始，寬度限制在這一格內
  const hw=e.k==='plcx'?5.5:['load','pwr'].includes(e.k)&&!scLamp(e)?6.5:e.k==='coil'?4:scLamp(e)?3.2:3.6,tx=t.co?t.co.x2+1.6:x+hw+1,tw=e.k==='sens'||e.sensPwr?SC.U-7.5-hw-1.5:SC.U-hw-8.2; // 感測器有虛線框：文字寫到框的右緣為止
  const actDev=devOf(String(e.act).split('#')[0]),own=d.tag,faHost=!e.ctl&&d.on&&tplOf(d).rackKind==='fa'&&devOf(d.on),tag=faHost?faHost.tag:e.ctl&&actDev&&actDev!==d&&['coil','host','hostbrk','hosttrip','hostel','op'].includes(e.by)?`${actDev.tag}`:own; // 照光按鈕的燈（FA 轉接器）：寫操作部的編號
  const sub=tag!==own?own:e.k==='plcy'?ptName(e):e.k==='plcx'?'':((d.model&&tplOf(d).model?d.model:'')||tplOf(d).n);
  if(e.sensPwr){ // 多線式感測器的方塊：棕接上方、藍接下方，黑／白輸出從右側直接拉出去（在控制回路排版時畫），編號寫在方塊下方
    const w2=SC.U-3;h+=scTx('s-tag',x+1.4,c+8.6,tag,w2,SCF.tag)+scTxW('s-sub',x+1.4,c+11.9,sub,w2,SCF.sub,4,2.9);
    h+=scTx('s-term',x-1,c-4.8,termLabel(d,tTop)||tTop,Math.min(9,SC.U*.32),SCF.term)+scTx('s-term',x-1,c+7.4,termLabel(d,tBot)||tBot,Math.min(9,SC.U*.32),SCF.term);
    ctx.put({e,x,y:c});return h;}
  const sfs=SCF.sub;
  const isS=e.k==='sens'||e.sensPwr,tagL=scWrap(tag+(t.dup?'＊':''),tw,SCF.tag),t2=tagL.length>1&&scTW(tag,SCF.tag*.85)>tw; // 編號太長換兩行
  h+=t2?scTxW('s-tag',tx,c-.2-3.9,tag+(t.dup?'＊':''),tw,SCF.tag,2,3.9):scTx('s-tag',tx,c-.2,tag+(t.dup?'＊':''),tw,SCF.tag);
  if(sub){const L=scWrap(sub,tw,sfs),up=!isS&&scIsLoad(e)&&e.k!=='coil'&&L.length>3&&scTW(sub,sfs*.85)>tw&&H-ctx.LH>=Math.min(L.length,7)*sfs*1.04+(t2?3.9:0)+6; // 上方要有空間才往上寫
    t._ln=up?0:Math.min(L.length,4);h+=up?scTxW('s-sub',tx,c-4.4-(Math.min(L.length,7)-1)*sfs*1.04-(t2?3.9:0),sub,tw,sfs,7,sfs*1.04):scTxW('s-sub',tx,c+3.6,sub,tw,sfs,4,sfs*1.04);}
  // 端子號在線的左邊、符號上下；左邊空間（到前一格的文字）有限，太長就縮
  const lw=Math.min(9,SC.U*.32),tl=hw>4?c-hw-1.4:c-4.8,bl=hw>4?c+hw+2.9:c+7.4;
  h+=scTx('s-term',x-1,tl,termLabel(d,tTop)||tTop,lw,SCF.term)+scTx('s-term',x-1,bl,termLabel(d,tBot)||tBot,lw,SCF.term);
  ctx.put({e,x,y:c});
  // 線圈的接點對照：寫在線圈「上方」右側（線圈都靠下，下方是電源線）
  if(e.k==='coil')h+=`<text class="s-xref" x="${tx}" y="${c-4.6}">\u0001U:${scEsc(e.act)}\u0001</text>`;
  return h;}
// 沒有串接在主機旁的擴充模組（用延長電纜接、或盤面上分開放）：位址照盤面位置推定，排在主機與已串接模組的後面
function scChainGuess(d,p){const T=tplOf(d);if(d.on||T.chainKind!=='r'||typeof chainOk!=='function')return null;
  const hosts=S.devices.filter(h=>h!==d&&!h.on&&chainOk(h,d)&&tplOf(h).chainAddr);if(!hosts.length)return null;
  const dist=h=>(h.sheet===d.sheet?0:1e6)+Math.hypot(h.x-d.x,h.y-d.y),h=hosts.sort((a,b)=>dist(a)-dist(b))[0],ht=tplOf(h),rule=ht.chainAddr;
  let a=rule==='word'?((p==='X'?ht.xw:ht.yw)||0):(p==='X'?(ht.chainX??round8(octTerms(ht,'X'))):(ht.chainY??round8(octTerms(ht,'Y'))));
  chainOf(h,'r').forEach(m=>{a+=chainUse(tplOf(m),p,rule);});
  const loose=S.devices.filter(m=>!m.on&&tplOf(m).chainKind==='r'&&chainOk(h,m)).sort((x,y)=>(x.sheet===y.sheet?0:x.sheet<y.sheet?-1:1)||x.y-y.y||x.x-y.x);
  for(const m of loose){if(m===d)return {a,rule,host:h};a+=chainUse(tplOf(m),p,rule);}return null;}
function scChainGuessName(d,t){const m=/^([XY])(\d+)(?:\.(\d+))?$/.exec(t);if(!m)return null;const st=scChainGuess(d,m[1]);if(!st||!chainUse(tplOf(d),m[1],st.rule))return null;
  if(st.rule==='word')return m[3]==null?null:`${m[1]}${st.a+(+m[2])}.${m[3]}`;if(!/^[0-7]+$/.test(m[2])||m[3]!=null)return null;return m[1]+(st.a+parseInt(m[2],8)).toString(8);}
const ptName=e=>{const g=typeof cnSig==='function'?cnSig(e.d,e.pt):e.pt,P=e.k==='plcy'?'Y':'X',alt=/^\d+$/.test(g)?P+g:null;
  return (typeof qName==='function'&&qName(e.d,g))||(typeof chainName==='function'&&(chainName(e.d,g)||(alt&&chainName(e.d,alt))))||scChainGuessName(e.d,g)||(alt&&scChainGuessName(e.d,alt))||termLabel(e.d,e.pt)||g;};

/* 水平畫法：控制回路照垂直的版面算好，再把座標對調（x↔y）：電源線變成左右兩條、迴路變成橫的；
   符號跟著轉 90°（接點刀片、按鈕操作線都在線的上方），文字不轉 */

/* ---------- 5. 頁面 ---------- */
// 圖框：外框、欄號 1～10、列號 A～F、標題欄（專案、圖名、日期、頁次）
function scFrame(pg,meta){
  const {W,H,M}=SC,cw=(W-2*M)/SC.COLS,rh=(H-2*M)/6;let h=`<rect class="s-frame" x="${M}" y="${M}" width="${W-2*M}" height="${H-2*M}"/><rect class="s-frame2" x="${M+5}" y="${M+5}" width="${W-2*M-10}" height="${H-2*M-10}"/>`;
  for(let i=0;i<SC.COLS;i++){const x=M+i*cw;if(i)h+=`<line class="s-grid" x1="${x}" y1="${M}" x2="${x}" y2="${M+5}"/><line class="s-grid" x1="${x}" y1="${H-M-5}" x2="${x}" y2="${H-M}"/>`;h+=`<text class="s-gl" x="${x+cw/2}" y="${M+3.6}">${i+1}</text><text class="s-gl" x="${x+cw/2}" y="${H-M-1.4}">${i+1}</text>`;}
  for(let j=0;j<6;j++){const y=M+j*rh;if(j)h+=`<line class="s-grid" x1="${M}" y1="${y}" x2="${M+5}" y2="${y}"/><line class="s-grid" x1="${W-M-5}" y1="${y}" x2="${W-M}" y2="${y}"/>`;h+=`<text class="s-gl" x="${M+2.5}" y="${y+rh/2+1}">${'ABCDEF'[j]}</text><text class="s-gl" x="${W-M-2.5}" y="${y+rh/2+1}">${'ABCDEF'[j]}</text>`;}
  // 標題欄（右下）
  const bx=W-M-5-170,by=H-M-5-22;
  h+=`<rect class="s-tb" x="${bx}" y="${by}" width="170" height="22"/><line class="s-tbl" x1="${bx}" y1="${by+11}" x2="${bx+170}" y2="${by+11}"/><line class="s-tbl" x1="${bx+110}" y1="${by}" x2="${bx+110}" y2="${by+22}"/><line class="s-tbl" x1="${bx+140}" y1="${by+11}" x2="${bx+140}" y2="${by+22}"/>
    <text class="s-tbk" x="${bx+1.5}" y="${by+3}">專案</text>`+scTx('s-tbv',bx+12,by+7.5,meta.title,96,3.4)+`
    <text class="s-tbk" x="${bx+111.5}" y="${by+3}">日期</text><text class="s-tbv" x="${bx+120}" y="${by+7.5}">${scEsc(meta.date)}</text>
    <text class="s-tbk" x="${bx+1.5}" y="${by+14}">圖名</text>`+scTx('s-tbv',bx+12,by+18.8,pg.title,96,3.4)+`
    <text class="s-tbk" x="${bx+111.5}" y="${by+14}">產生</text><text class="s-tbs" x="${bx+111.5}" y="${by+19.5}">配線模擬器 ${scEsc(meta.ver)}</text>
    <text class="s-tbk" x="${bx+141.5}" y="${by+14}">頁次</text><text class="s-tbv" x="${bx+150}" y="${by+18.8}">\u0001P:${pg.no}\u0001 / \u0001N\u0001</text>`;
  return h;}
const scCol=x=>Math.min(SC.COLS,Math.max(1,Math.floor((x-SC.M)/((SC.W-2*SC.M)/SC.COLS))+1));

/* ---------- 6. 主回路（AC）：電源 → 開關 → 用電器具 的樹 ---------- */
function scMainPages(M,pages,newPage,meta){
  const uidE=e=>e.d.id+(e.el&&e.el.g&&e.el.by==='coil'?'#'+e.el.g:''),devU=u=>devOf(String(u).split('#')[0]); // 一體式正反轉：每組線圈的接點是一個單位
  const {E,phase,adj,acNodes,f,acs}=M;if(!acNodes.length)return;
  // 從電源往下的最短路徑（只走接點）
  const par=new Map(),q=[];acNodes.forEach(([k])=>{if(!par.has(k)){par.set(k,null);q.push(k);}});
  while(q.length){const x=q.shift();(adj.get(x)||[]).forEach(e=>{const y=e.u===x?e.v:e.u;if(!par.has(y)){par.set(y,{e,from:x});q.push(y);}});}
  const pathTo=k=>{const out=[];let x=k,g=0;while(par.get(x)&&g++<200){const p=par.get(x);out.unshift(p.e);x=p.from;}return out;};
  // 用電項目：每一組電源輸入各自追路徑（例如伺服的主電源走 K1M、控制電源走 K0M，分開畫）
  const items=[];
  E.filter(e=>e.load&&!e.aux&&e.k!=='plcx').forEach(e=>{if(!(phase.has(e.u)&&phase.has(e.v)&&M.wiredNode.has(e.u)))return;
    if(tplOf(e.d).m3){(tplOf(e.d).m3g||[['U','V','W']]).forEach((g,gi)=>{const T=g.map(t=>({k:f(nodeKey({d:e.d.id,t})),t})).filter(t=>phase.has(t.k));if(T.length)items.push({d:e.d,terms:T,name:gi?g.join(' '):'',m3:true,m3i:gi});});return;} // 三相馬達：三個端子（六端子馬達分兩組）
    items.push({d:e.d,terms:[{k:e.u,t:e.ta},{k:e.v,t:e.tb}],name:e.k==='coil'?'線圈':e.name});});
  M.srcs.forEach(s=>{if(s.inK){const a=f(s.inK[0]),b=f(s.inK[1]);if(phase.has(a)&&phase.has(b))items.push({d:s.d,terms:[{k:a,t:s.inT[0]},{k:b,t:s.inT[1]}],name:'AC 輸入',src:s});}});
  S.devices.filter(d=>simElems(d).some(e=>e.k==='grp'&&e.t==='插頭')&&simElems(d).some(e=>e.k==='pass')).forEach(d=>{
    const T=['L','N'].map(t=>({k:f(nodeKey({d:d.id,t})),t})).filter(t=>phase.has(t.k)&&M.wiredNode.has(t.k));if(T.length!==2)return;
    // 插著的器具：插頭線（或電纜接頭）一端在插座口、另一端在這台器具，而且它的電源接在插座的火線 L 上
    const pl=scPlugged(d),plugged=[];
    for(let i=items.length-1;i>=0;i--){const it=items[i],p=pl.find(q=>q.d===it.d);if(p&&it.terms.some(t=>t.k===T[0].k)){plugged.unshift({...it,via:p});items.splice(i,1);}}
    items.push({d,terms:T,name:'插座',plugged});});
  // AC 控制回路：斷路器／保險絲後面有線圈（接觸器、繼電器）的支路，畫成控制回路展開圖（自保持、互鎖才畫得出來）；主回路只標「控制回路 → 第 N 頁」
  { const isProt=e=>e.k==='brk'||e.k==='fuse';
    const walk=k=>{const out=[];let x=k,g=0;while(par.get(x)&&g++<200){const q=par.get(x);out.unshift({e:q.e,n:x});x=q.from;}return {src:x,steps:out};};
    const cut=k=>{const w=walk(k);let i=-1;w.steps.forEach((st,j)=>{if(isProt(st.e))i=j;});return i<0?{node:w.src,edge:null,up:[]}:{node:w.steps[i].n,edge:w.steps[i].e,up:w.steps.slice(0,i+1).map(st=>st.e)};};
    const secs=new Map();
    const ctlIt=it=>it.name==='線圈'||(/燈/.test(it.name||'')&&it.terms.length===2&&it.terms.some(t=>pathTo(t.k).some(e=>e.k==='no'||e.k==='nc')));
    items.filter(ctlIt).forEach(it=>{const [a,b]=it.terms.map(t=>cut(t.k)),[A,B]=walk(it.terms[0].k).steps.length>=walk(it.terms[1].k).steps.length?[a,b]:[b,a];
      if(!A.edge)return;const key=A.node+'|'+B.node;if(!secs.has(key))secs.set(key,{p:A.node,n:B.node,edge:A.edge,excl:new Set([...A.up,...B.up].map(e=>e.id))});});
    secs.forEach(sc=>{const on=k=>walk(k).steps.some(st=>st.n===sc.p)||k===sc.p;
      if(items.some(it=>!it.src&&!it.plugged&&!ctlIt(it)&&!(/燈/.test(it.name||'')&&it.terms.length===2)&&it.terms.some(t=>on(t.k))))return; // 這個點還接著主回路的其他負載（例如直接接在主斷路器後面）：不拆成控制回路頁，留在主回路
      for(let i=items.length-1;i>=0;i--){const it=items[i];if(it.src||it.plugged)continue;if(it.terms.some(t=>on(t.k)))items.splice(i,1);}
      const d=sc.edge.d,tb=sc.edge.u===sc.p?sc.edge.ta:sc.edge.tb,v=`AC ${phase.get(sc.p)||''}-${phase.get(sc.n)||''}`;
      M.srcs.push({d,e:{p:tb,n:phase.get(sc.n)||''},p:sc.p,nn:sc.n,v,ac:true,excl:sc.excl});
      items.push({d,terms:[{k:sc.p,t:tb},{k:sc.n,t:''}],name:'控制回路',ctlRef:{v}});}); }
  // 多相負載的每一相都走同一台開關（正反轉時不會一相走 KMF、一相走 KMR）；另一台在後面畫成「並接」
  { const dlA=new Map(),dA=k=>{if(!dlA.has(k))dlA.set(k,pathTo(k).length);return dlA.get(k);},SW=['brk','no','nc','fuse','ol'];
    items.forEach(it=>{if(it.terms.length<2||it.terms.some(t=>t.edges))return;
      const feeds=it.terms.map(t=>(adj.get(t.k)||[]).filter(e=>SW.includes(e.k)&&phase.has(e.u)&&phase.has(e.v)).filter(e=>{const o=e.u===t.k?e.v:e.u;return dA(o)<dA(t.k)||(dA(o)===dA(t.k)&&e.v===t.k);}));
      const last=it.terms.map(t=>{const q=par.get(t.k);return q?uidE(q.e):null;});if(last.every(d=>d===last[0]))return;
      const cand=[...new Set(feeds[0].map(uidE))].filter(u=>feeds.every(F=>F.some(e=>uidE(e)===u))).sort(natCmp);if(!cand.length)return;
      it.terms.forEach((t,i)=>{const e=feeds[i].find(q=>uidE(q)===cand[0]),up=e.u===t.k?e.v:e.u;t.edges=[...pathTo(up),e];t.ph=phase.get(up);});}); }
  const ctlNodes=new Set();M.srcs.filter(q=>q.ac).forEach(q=>{const st=[q.p];ctlNodes.add(q.p);while(st.length){const x=st.pop();(adj.get(x)||[]).forEach(e=>{if(q.excl.has(e.id))return;const y=e.u===x?e.v:e.u;if(!ctlNodes.has(y)&&y!==q.nn){ctlNodes.add(y);st.push(y);}});}});
  { const used=new Set();items.forEach(it=>it.terms.forEach(t=>pathTo(t.k).forEach(e=>used.add(e.d.id))));const dead=new Map();
    const SWK=['brk','no','nc','fuse','ol'],isSw=e=>e.ctl&&SWK.includes(e.k)&&phase.has(e.u)&&phase.has(e.v),dl=new Map(),dOf=k=>{if(!dl.has(k))dl.set(k,pathTo(k).length);return dl.get(k);};
    const downOf=e=>dOf(e.u)<dOf(e.v)?e.v:dOf(e.v)<dOf(e.u)?e.u:e.v; // 一樣遠時（正反轉＋積熱電驛的橋接）照器具端子方向：L→T、1→2
    const deadNode=k=>!items.some(it=>it.terms.some(t=>t.k===k))&&!E.some(q=>q.load&&(q.u===k||q.v===k))&&!ctlNodes.has(k)&&(adj.get(k)||[]).every(q=>isSw(q)&&downOf(q)===k); // 後面沒有別的接點、也沒接負載（負載在控制回路頁）
    E.filter(isSw).forEach(e=>{const k=downOf(e);if(k==null||!deadNode(k))return;const up=k===e.u?e.v:e.u,others=(adj.get(k)||[]).filter(q=>q.d!==e.d).map(q=>q.d.tag);
      if(!dead.has(uidE(e)))dead.set(uidE(e),{d:e.d,terms:[],with:new Set()});const o=dead.get(uidE(e));others.forEach(t=>o.with.add(t));o.terms.push({k,t:k===e.u?e.ta:e.tb,edges:[...pathTo(up),e],ph:phase.get(up)});});
    // 並接到用電器具的另一條路（正反轉：KMF→TH 和 KMR 都接到馬達 M1）：主路徑以外的開關也畫一支，標「並接」
    { const onChain=new Set();items.forEach(it=>it.terms.forEach(t=>(t.edges||pathTo(t.k)).forEach(e=>onChain.add(e.id))));const itemNodes=new Set(items.filter(it=>!it.ctlRef).flatMap(it=>it.terms.map(t=>t.k)));
      E.filter(isSw).forEach(e=>{if(onChain.has(e.id))return;const k=downOf(e);if(k==null||!itemNodes.has(k)||ctlNodes.has(k))return;const up=k===e.u?e.v:e.u,on=items.find(it=>it.terms.some(t=>t.k===k));
        if(!dead.has(uidE(e)))dead.set(uidE(e),{d:e.d,terms:[],with:new Set(),to:new Set()});const o=dead.get(uidE(e));(o.to||(o.to=new Set())).add(on.d.tag);(adj.get(k)||[]).filter(q=>q.d!==e.d&&onChain.has(q.id)).forEach(q=>o.with.add(q.d.tag));
        o.terms.push({k,t:k===e.u?e.ta:e.tb,edges:[...pathTo(up),e],ph:phase.get(up)});}); }
    dead.forEach(o=>{if(used.has(o.d.id)&&!o.to)return; /* 已用到的器具其他極沒接：備用極，畫在原本那台上，不另外拉出線 */o.terms.sort((a,b)=>SC_PH.indexOf(a.ph)-SC_PH.indexOf(b.ph));items.push({d:o.d,terms:o.terms,name:'出線',outlet:true,with:[...o.with],to:o.to?[...o.to]:null});}); }
  if(!items.length)return;
  const groups=new Map(),dl2=new Map(),dOf2=k=>{if(!dl2.has(k))dl2.set(k,pathTo(k).length);return dl2.get(k);},upPh=e=>phase.get(dOf2(e.u)<=dOf2(e.v)?e.u:e.v);
  items.forEach(it=>{const chains=it.terms.map(t=>({t,edges:t.edges||pathTo(t.k),ph:t.ph||phase.get(t.k)}));
    // 每台開關在各相路徑上最早出現的位置；同一層的器具（例如兩相各走一個單極斷路器）放在同一格
    // 層：每台開關排在它上游所有開關的下一層（例如 N 極直接從電源來的 4P 斷路器，仍排在上游主斷路器下面）
    const rank=new Map();chains.forEach(ch=>ch.edges.forEach(e=>{if(!rank.has(uidE(e)))rank.set(uidE(e),0);}));
    for(let g=0,ch=true;ch&&g<50;g++){ch=false;chains.forEach(c=>{const ids=c.edges.map(uidE).filter((v,i,a)=>a.indexOf(v)===i);for(let i=1;i<ids.length;i++){const need=rank.get(ids[i-1])+1;if(rank.get(ids[i])<need){rank.set(ids[i],need);ch=true;}}});}
    const lv=new Map();rank.forEach((r,id)=>{if(!lv.has(r))lv.set(r,[]);lv.get(r).push(id);});
    const levels=[...lv.entries()].sort((a,b)=>a[0]-b[0]).map(([,ids])=>ids.sort());
    const sig=it.d.id+'|'+levels.map(l=>l.join('+')).join('>');
    if(!groups.has(sig))groups.set(sig,{d:it.d,terms:[],names:[],chains:[],levels,src:null});
    const g=groups.get(sig);if(it.m3){g.m3=true;g.m3i=it.m3i||0;}if(it.outlet){g.outlet=true;g.with=it.with||[];g.to=it.to;}if(it.ctlRef)g.ctlRef=it.ctlRef;if(it.plugged&&it.plugged.length)g.plugged=it.plugged;it.terms.forEach(t=>{if(!g.terms.some(x=>x.k===t.k&&(x.t===t.t||!it.outlet)))g.terms.push(t);});if(!g.names.includes(it.name))g.names.push(it.name);g.chains.push(...chains);if(it.src)g.src=it.src;});
  // 樹：節點是一層開關（多極算一台），葉子是用電項目
  const root={id:'ROOT',kids:[],poles:new Map(),devs:[]},nodes=new Map([['ROOT',root]]);
  const phOrd=p=>{const i=SC_PH.indexOf(p);return i<0?99:i;};
  [...groups.values()].sort((a,b)=>natCmp(a.d.tag,b.d.tag)).forEach(g=>{
    let cur=root,key='ROOT';
    g.levels.forEach(ids=>{key+='>'+ids.join('+');if(!nodes.has(key)){const nd={id:key,devs:ids.map(devU),units:ids,d:devU(ids[0]),kids:[],poles:new Map()};nodes.set(key,nd);cur.kids.push(nd);}cur=nodes.get(key);
      g.chains.forEach(ch=>ch.edges.filter(e=>ids.includes(uidE(e))).forEach(e=>{if(!cur.poles.has(e.id))cur.poles.set(e.id,{e,ph:upPh(e)||ch.ph});}));});
    const leaf={id:key+'>C:'+g.d.id+g.names.join(),d:g.d,kids:[],poles:new Map(),cons:g,chains:g.chains};cur.kids.push(leaf);});
  // 每一層的分支照編號排（F101、F102、…），不受用電器具編號或接線先後影響
  { const usedE=new Set();nodes.forEach(nd=>nd.poles.forEach((v,k)=>usedE.add(k)));
    nodes.forEach(nd=>{if(!nd.devs)return;E.filter(e=>(e.k==='brk'||e.k==='fuse')&&nd.devs.includes(e.d)&&!usedE.has(e.id)).forEach(e=>{const ph=upPh(e);if(!ph||[...nd.poles.values()].some(q=>q.ph===ph))return;nd.poles.set(e.id,{e,ph});usedE.add(e.id);});}); }
  M.mainNodes=nodes; // 測試用
  const tagKey=nd=>nd.cons?nd.d.tag:nd.devs.map(d=>d.tag).sort(natCmp)[0];
  const sortKids=nd=>{nd.kids.sort((a,b)=>natCmp(tagKey(a),tagKey(b)));nd.kids.forEach(sortKids);};sortKids(root);
  const phases=[...new Set(acNodes.map(a=>a[1]))].sort((a,b)=>phOrd(a)-phOrd(b));
  const PX=5.5,BS=5,phX=ph=>Math.max(0,phases.indexOf(ph))*PX;
  const ownW=nd=>nd.cons?Math.max(2,Math.ceil((phases.length*PX+18)/SC.U)):Math.max(1,Math.ceil((phases.length*PX+16)/SC.U));
  const wOf=nd=>nd._w!=null?nd._w:(nd._w=Math.max(ownW(nd),nd.kids.reduce((a,k)=>a+wOf(k),0)));
  const usedPh=nd=>phases.filter(ph=>scUses(nd,ph));
  const LV=32,motorDone=new Set();
  const drawNode=(nd,x,y,ctx)=>{ // x：這一格的左緣；y：上端
    let h='';
    if(nd.cons&&nd.cons.m3){ // 三相馬達：三條線進 M 3~ 圓圈
      const c=nd.cons,xs=c.terms.map(t=>x+3+phX(t.ph||phase.get(t.k))),cx=(Math.min(...xs)+Math.max(...xs))/2,cy=y+19,r=6.5;
      c.terms.forEach((t,i)=>{const xx=xs[i],dy=Math.sqrt(Math.max(0,r*r-(xx-cx)*(xx-cx)));h+=SY.line(xx,y,cy-dy)+`<text class="s-term" x="${xx-.6}" y="${y+9.4}">${scEsc(termLabel(c.d,t.t)||t.t)}</text>`;
        const w0=S.wires.find(q=>q.no&&[q.a,q.b].some(z=>z.d===c.d.id&&z.t===t.t)),nm=w0?w0.no:M.netName(t.k);if(nm){const F=scFit(nm,8.6,2.3,1.3);h+=`<text class="s-netv" transform="translate(${xx+.8} ${y+.6}) rotate(90)"${F.fs!==2.3?` style="font-size:${F.fs}px"`:''}>${scEsc(F.t)}</text>`;}});
      h+=`<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff"/><text class="s-in" x="${cx}" y="${cy+.3}" style="font-size:3.4px">M</text><text class="s-in" x="${cx}" y="${cy+3.6}" style="font-size:2.4px">3~</text>`;
      const tw=ownW(nd)*SC.U-(cx+r+1.5-x)-2;h+=scTx('s-tag',cx+r+1.5,cy-.6,c.d.tag+(c.m3i?'　'+c.names.filter(Boolean).join(''):''),tw,SCF.tag)+scTxW('s-sub',cx+r+1.5,cy+3,c.m3i?'繞組另一端（Δ／Y 切換）':tplOf(c.d).n,tw,SCF.sub,2,2.9);
      ctx.put({e:{d:c.d,act:c.d.id,k:'cons'},x:cx,y:cy,terms:c.terms.map(t=>c.d.id+'|'+t.t)});return h;}
    if(nd.cons&&nd.cons.ctlRef){ // AC 控制回路：畫在控制回路頁
      const c=nd.cons,w=ownW(nd)*SC.U-4;
      c.terms.forEach(t=>{const xx=x+3+phX(phase.get(t.k)),nm=M.netName(t.k);h+=SY.line(xx,y,y+8)+`<path d="M${xx-1.2} ${y+6.4} L${xx} ${y+8.6} L${xx+1.2} ${y+6.4}"/>`+(nm?`<text class="s-netv" transform="translate(${xx+.8} ${y+.6}) rotate(90)">${scEsc(nm)}</text>`:'');});
      h+=scTx('s-tag',x+1,y+13,'控制回路',w,SCF.tag)+`<text class="s-xr2" x="${x+1}" y="${y+16.8}">${scEsc(c.ctlRef.v)}\u0001S:${scEsc(c.d.id)}\u0001</text>`;
      ctx.put({e:{d:c.d,act:c.d.id,k:'cons'},x:x+1,y:y+12,terms:[]});return h;}
    if(nd.cons&&nd.cons.outlet){ // 出線：開關後面沒有用電器具，標出接到哪裡
      const c=nd.cons,w=ownW(nd)*SC.U-4;let x9=x+3;const star=c.terms.length>1&&c.terms.every(t=>t.k===c.terms[0].k);
      c.terms.forEach(t=>{const xx=x+3+phX(t.ph||phase.get(t.k));x9=Math.max(x9,xx);const w0=S.wires.find(q=>q.no&&[q.a,q.b].some(z=>z.d===c.d.id&&z.t===t.t));
        h+=SY.line(xx,y,y+8.6)+(star?'':`<path d="M${xx-1.2} ${y+6.4} L${xx} ${y+8.6} L${xx+1.2} ${y+6.4}"/>`)+(w0?`<text class="s-netv" transform="translate(${xx+.8} ${y+.6}) rotate(90)">${scEsc(w0.no)}</text>`:'');});
      const to=[...new Set(c.terms.flatMap(t=>S.wires.flatMap(q=>[[q.a,q.b],[q.b,q.a]]).filter(([a])=>a.d===c.d.id&&a.t===t.t).map(([,b])=>{const o=devOf(b.d);return o?`${o.tag}：${termLabel(o,b.t)}`:'';}).filter(Boolean)))];
      
      h+=(star?`<line x1="${Math.min(...c.terms.map(t=>x+3+phX(t.ph||phase.get(t.k))))}" y1="${y+8.6}" x2="${Math.max(...c.terms.map(t=>x+3+phX(t.ph||phase.get(t.k))))}" y2="${y+8.6}"/>`:'')+scTx('s-tag',x+1,y+13,star?'星形接點（Y）':c.to?'並接':'出線',w,SCF.tag)+scTxW('s-sub',x+1,y+16.8,star?'三相在這裡短接':(c.to?`→ ${c.to.join('、')}`:to.length?'→ '+to.join('、'):'（沒有接用電器具）')+(c.with&&c.with.length?`（與 ${[...new Set(c.with)].join('、')} 出線並接）`:''),w,SCF.sub,4,2.9);
      ctx.put({e:{d:c.d,act:c.d.id,k:'cons'},x:x+1,y:y+12,terms:c.terms.map(t=>c.d.id+'|'+t.t)});return h;}
    if(nd.cons){ // 用電項目：方框，上緣各相端子
      const c=nd.cons,w=ownW(nd)*SC.U-4,bx=x+1;
      c.terms.forEach(t=>{const ph=phase.get(t.k),xx=x+3+phX(ph);h+=SY.line(xx,y,y+10)+`<text class="s-term" x="${xx-.6}" y="${y+9.4}">${scEsc(termLabel(c.d,t.t)||t.t)}</text>`;const w0=S.wires.find(w=>w.no&&[w.a,w.b].some(q=>q.d===c.d.id&&q.t===t.t)),nm=w0?w0.no:M.netName(t.k); /* 先用接在這個端子上的線號 */if(nm){const F=scFit(nm,8.6,2.3,1.3);h+=`<text class="s-netv" transform="translate(${xx+.8} ${y+.6}) rotate(90)"${F.fs!==2.3?` style="font-size:${F.fs}px"`:''}>${scEsc(F.t)}</text>`;}});
      const nmTxt=c.names.filter(n=>n&&n!=='AC 輸入'&&n!=='電源').join('、');
      h+=`<rect class="s-dev" x="${bx}" y="${y+10}" width="${w}" height="22"/>`+scTx('s-tag',bx+1.5,y+14.6,c.d.tag+(nmTxt?'　'+nmTxt:''),w-3,SCF.tag)+scTxW('s-sub',bx+1.5,y+18.6,tplOf(c.d).n,w-3,SCF.sub,2,2.9);
      if(c.src)h+=`<text class="s-xr2" x="${bx+1.5}" y="${y+29.4}">${scEsc(c.src.v)} 輸出\u0001S:${scEsc(c.d.id)}\u0001</text>`;
      // 接在這台 U／V／W 的馬達（同一台器具只畫一次）
      if(!motorDone.has(c.d.id)){const mot=scMotorsOf(M,c);if(mot.length){motorDone.add(c.d.id);mot.forEach((m,i)=>{const mx=x+(i+.5)*(w/mot.length)+1,mw=w/mot.length-9;h+=SY.line(mx,y+32,y+36)+SY.motor(mx,y+42,'')+scTx('s-tag',mx+7,y+41,m.tag,mw,SCF.tag)+scTxW('s-sub',mx+7,y+44.5,tplOf(m).n,mw,SCF.sub,2,2.9);ctx.put({motor:m,x:mx,y:y+42});});}}
      ctx.put({e:{d:c.d,act:c.d.id,k:'cons'},x:bx,y:y+14,terms:c.terms.map(t=>c.d.id+'|'+t.t)});
      // 插在這個插座上的器具：從插座口往下畫插頭線，再畫器具方框
      (c.plugged||[]).forEach((p,i,A)=>{const pw=(w-(A.length-1)*2)/A.length,px=bx+i*(pw+2),lx=px+9,cy=y+32;
        h+=SY.line(lx,cy,cy+9)+scTx('s-term',lx-.6,cy+3.2,'插座口',8,SCF.term)+(p.via.no?scTx('s-net',lx+1.2,cy+5.2,p.via.no,pw-12,SCF.net):'')+scTx('s-term',lx-.6,cy+8.4,termLabel(p.d,p.via.t)||p.via.t,8,SCF.term);
        h+=`<rect class="s-dev" x="${px}" y="${cy+9}" width="${pw}" height="17"/>`+scTx('s-tag',px+1.5,cy+13.6,p.d.tag+(p.name&&p.name!=='電源'&&p.name!=='AC 輸入'?'　'+p.name:''),pw-3,SCF.tag)+scTxW('s-sub',px+1.5,cy+17.6,tplOf(p.d).n,pw-3,SCF.sub,2,2.9);
        if(p.src)h+=`<text class="s-xr2" x="${px+1.5}" y="${cy+24.4}">${scEsc(p.src.v)} 輸出\u0001S:${scEsc(p.d.id)}\u0001</text>`;
        ctx.put({e:{d:p.d,act:p.d.id,k:'cons'},x:px,y:cy+13,terms:[p.d.id+'|'+p.via.t,c.d.id+'|插頭',...p.terms.map(t=>p.d.id+'|'+t.t)]});});
      return h;}
    // 開關：每一極一個符號；同一層有好幾台時，每極下面標自己的器具編號
    const poles=[...nd.poles.values()].sort((a,b)=>phOrd(a.ph)-phOrd(b.ph)),multi=nd.devs.length>1,c0=y+10;
    poles.forEach(p=>{const xx=x+3+phX(p.ph),e=p.e;
      h+=SY.line(xx,y,c0-4)+SY.line(xx,c0+4,y+LV-6);
      h+=e.k==='brk'?SY.brk(xx,c0):e.k==='fuse'?SY.fuse(xx,c0):e.k==='ol'?SY.ol(xx,c0):e.k==='nc'?SY.nc(xx,c0):SY.no(xx,c0);if(e.k!=='fuse'&&e.k!=='ol')h+=SY.line(xx,c0-4,c0-3)+SY.line(xx,c0+3,c0+4);
      { const lg=poles.some(q=>scTW(termLabel(q.e.d,q.e.ta),SCF.term)>PX-.9||scTW(termLabel(q.e.d,q.e.tb),SCF.term)>PX-.9),st=0; // 端子號太長（L1(2)）：縮小到放得進極距
        const fit=t=>{const F=scFit(t,PX-.9,SCF.term,1.4);return `${F.fs!==SCF.term?` style="font-size:${F.fs}px"`:''}>${scEsc(F.t)}`;};
        h+=`<text class="s-term" x="${xx-.6}" y="${c0-4.6-st}"${fit(termLabel(e.d,e.ta))}</text><text class="s-term" x="${xx-.6}" y="${c0+7+st}"${fit(termLabel(e.d,e.tb))}</text>`; }
      if(multi)h+=`<text class="s-sub" x="${xx+.6}" y="${c0+11}">${scEsc(e.d.tag)}</text>`;
      ctx.put({e,x:xx,y:c0,node:nd.id});});
    // 這一層沒經過開關的相（例如單極斷路器的 N）直接往下通過
    const phs=nd._trunc?poles.map(p=>p.ph):usedPh(nd),poleSet=new Set(poles.map(p=>p.ph));
    phs.forEach(ph=>{if(!poleSet.has(ph))h+=SY.line(x+3+phX(ph),y,y+LV-6);});
    if(nd.devs.length===1&&poles.length>1){const xs=poles.map(p=>x+3+phX(p.ph));h+=`<line class="s-mech" x1="${Math.min(...xs)-3}" y1="${c0}" x2="${Math.max(...xs)-1}" y2="${c0}"/>`;}
    const p0=poles[0],ac=p0&&devOf(String(p0.e.act||'').split('#')[0]),gs=(nd.units||[]).map(u=>String(u).split('#')[1]).filter(Boolean),tg=(nd.devs.length>1?nd.devs.map(d=>d.tag).join('、'):(ac&&ac!==nd.d&&p0.e.k!=='brk'?ac.tag:nd.d.tag))+(gs.length?`（${gs.join('、')}）`:'');
    const tx=x+4+Math.max(0,...[...phs,...poles.map(p=>p.ph)].map(phX))+2+(poles.some(p=>p.e.k==='nc'&&phX(p.ph)===Math.max(0,...[...phs,...poles.map(q=>q.ph)].map(phX)))?2.2:0); // 最右一極是常閉時，橫桿往右凸，文字再往右
    { const aw=x+wOf(nd)*SC.U-tx-2;h+=scTx('s-tag',tx,y+9.5,tg,aw,SCF.tag)+scTxW('s-sub',tx,y+13.2,(ac&&ac!==nd.d&&p0.e.k!=='brk'&&nd.devs.length===1?nd.d.tag+'　':'')+tplOf(nd.d).n,aw,SCF.sub,2,2.9); // 別台帶動的接點（接點塊、輔助接點）：說明前面寫自己的編號
      const th=S.devices.find(r=>r.on===nd.d.id&&tplOf(r).plug&&tplOf(r).trip);
      if(th){const cy=y+22;poles.forEach(p=>{const xx=x+3+phX(p.ph);h+=SY.ol(xx,cy);});h+=scTx('s-tag',tx,cy+.6,th.tag,aw,SCF.tag)+scTx('s-sub',tx,cy+3.8,tplOf(th).n,aw,SCF.sub);
        ctx.put({e:{d:th,act:th.id,k:'cons'},x:tx,y:cy,terms:(tplOf(th).terms||[]).filter(t=>/^[LT]\d$/.test(t.id)).map(t=>th.id+'|'+t.id)});} }
    if(nd._trunc){if(!nd._sameSub){poles.forEach(p=>{const xx=x+3+phX(p.ph);h+=SY.line(xx,y+LV-6,y+LV-2);});h+=`<text class="s-pot" x="${x+3+phX(poles[0]?poles[0].ph:'')+5}" y="${y+LV+2}">→ 第 \u0001T:${scEsc(nd.id)}\u0001 頁</text>`;}return h;}
    h+=drawKids(nd,x,y+LV-6,ctx,phs);
    return h;};
  const drawKids=(nd,x,y,ctx,phs)=>{let h='',xx=x;const kx=[];nd.kids.forEach(k=>{kx.push(xx);xx+=wOf(k)*SC.U;});phs=[...new Set(phs)];
    if(nd.kids.length>1){phs.forEach(ph=>{const yb=y+1+Math.max(0,phases.indexOf(ph))*2,used=nd.kids.map((k,i)=>[k,kx[i]]).filter(([k])=>scUses(k,ph));if(!used.length)return;
      const xa=x+3+phX(ph),xs=used.map(([k,kx0])=>kx0+3+phX(ph));h+=SY.line(xa,y,yb)+`<line x1="${Math.min(xa,...xs)}" y1="${yb}" x2="${Math.max(xa,...xs)}" y2="${yb}"/>`;
      used.forEach(([k,kx0])=>{const x2=kx0+3+phX(ph);h+=SY.line(x2,yb,y+9);});
      const lo=Math.min(xa,...xs),hi=Math.max(xa,...xs); // 節點只畫在三條以上線交會的地方；轉角（L 形）不畫
      [...new Set([xa,...xs])].forEach(px=>{const n=(Math.abs(px-xa)<.01?1:0)+(xs.some(q=>Math.abs(q-px)<.01)?1:0)+(px>lo+.01?1:0)+(px<hi-.01?1:0);if(n>=3)h+=SY.dot(px,yb);});});
      nd.kids.forEach((k,i)=>{h+=drawNode(k,kx[i],y+9,ctx);});}
    else if(nd.kids.length===1){const k=nd.kids[0];phs.forEach(ph=>{if(scUses(k,ph))h+=SY.line(x+3+phX(ph),y,y+9);});h+=drawNode(k,x,y+9,ctx);}
    return h;};
  // 分頁：分支依序排，一頁放不下就換頁。單一分支比一頁還寬時（例如總開關 Q1），只畫到那台開關，
  // 它的負載側拉成第二組分配線，下面的分支接著畫在同一頁右邊；放不下再換頁，新頁的分配線標明是哪台的負載側
  const cap=Math.floor((SC.X1-SC.X0)/SC.U),plan=[];
  const newG=(bus,cont)=>{const g={bus,items:[],cont,sub:null,w:0};plan.push(g);return g;};
  const lblOf=k=>[...new Set([...k.poles.values()].map(p=>p.ph))].sort((a,b)=>phOrd(a)-phOrd(b)).map(ph=>{const p=[...k.poles.values()].find(q=>q.ph===ph);return {ph,net:M.netName(p.e.v)};});
  const run=(kids,bus,host)=>{let g,list,used;
    if(host){g=host.g;g.sub={from:host.k,lbl:bus.lbl,x0:g.w,items:[]};list=g.sub.items;used=g.w;}else{g=newG(bus,false);list=g.items;used=0;}
    const later=[];
    kids.forEach(k=>{let w=wOf(k);if(w>cap&&!k.cons){k._trunc=true;k._w=ownW(k);w=k._w;later.push(k);}
      if(used+w>cap&&(list.length||host)){g=newG(bus,true);list=g.items;used=0;host=null;}
      list.push(k);k._g=g;used+=w;if(list===g.items)g.w=used;});
    later.forEach(k=>{const kg=k._g,b2={from:k,lbl:lblOf(k)};
      if(!kg.sub&&kg.items[kg.items.length-1]===k&&kg.w<cap-1){k._sameSub=true;run(k.kids,b2,{g:kg,k});}
      else{const start=plan.length;run(k.kids,b2,null);k._contAt=plan[start];}});};
  run(root.kids,null,null);
  const srcTag=[...new Set(acNodes.map(a=>a[2].tag))].join('、');
  const busRow=(lbl,y0,xa,xb,labelX)=>{let h='';lbl.forEach((b,i)=>{const y=y0+i*BS;h+=`<line class="s-bus" x1="${xa}" y1="${y}" x2="${xb}" y2="${y}"/><text class="s-railn" x="${labelX}" y="${y+1.1}" text-anchor="end">${scEsc(b.net||b.ph)}</text>`;});return h;};
  const hang=(items,x,yBus,lblPh,yTop,ctx)=>{let h='';items.forEach(k=>{lblPh.forEach((ph,i)=>{if(scUses(k,ph)){const xx=x+3+phX(ph),yb=yBus+i*BS;h+=SY.dot(xx,yb)+SY.line(xx,yb,yTop);}});h+=drawNode(k,x,yTop,ctx);x+=wOf(k)*SC.U;});return h;};
  const srcTerms=acs.flatMap(({d,e})=>[...e.ph,...(e.n?[e.n]:[])].map(t=>d.id+'|'+t));
  plan.forEach((g,gi)=>{const pg=newPage(`主回路${plan.length>1?`（${gi+1}/${plan.length}）`:''}`,'main');g.pg=pg;let h='';const ctx={put:o=>pg.pos.push(o)};
    if(gi===0)pg.pos.push({x:0,y:0,terms:srcTerms});
    const y0=38,lbl=g.bus?g.bus.lbl:phases.map(ph=>({ph,net:ph})),yTop=y0+lbl.length*BS+6;
    h+=busRow(lbl,y0,SC.X0-6,SC.X1,SC.X0-7);
    h+=`<text class="s-sec" x="${SC.X0-6}" y="${y0-5}">${g.bus?`接續 ${scEsc(g.bus.from.devs.map(d=>d.tag).join('、'))} 負載側（第 \u0001M:${scEsc(g.bus.from.id)}\u0001 頁）`:`電源 ${scEsc(srcTag)}`}${g.cont?'（續）':''}</text>`;
    h+=hang(g.items,SC.X0,y0,lbl.map(b=>b.ph),yTop,ctx);
    if(g.sub){ // 同一頁的第二組分配線：從截斷那台開關的負載側往右拉
      const k=g.sub.from;let kx=SC.X0;for(const it of g.items){if(it===k)break;kx+=wOf(it)*SC.U;}
      const ySub=yTop+LV+2,xs0=SC.X0+g.sub.x0*SC.U;
      g.sub.lbl.forEach((b,i)=>{const xx=kx+3+phX(b.ph),y=ySub+i*BS;h+=SY.line(xx,yTop+LV-6,y)+`<line class="s-bus" x1="${xx}" y1="${y}" x2="${SC.X1}" y2="${y}"/><text class="s-railn" x="${xs0-2}" y="${y-1}" text-anchor="end">${scEsc(b.net||b.ph)}</text>`;});
      h+=hang(g.sub.items,xs0,ySub,g.sub.lbl.map(b=>b.ph),ySub+g.sub.lbl.length*BS+6,ctx);}
    pg.body=h;});
  // 截斷處的頁碼
  nodes.forEach(nd=>{if(nd._trunc&&nd._contAt)M.contPage=Object.assign(M.contPage||{},{[nd.id]:nd._contAt});});
}

function scUses(nd,ph){if(nd.cons)return nd.cons.terms.some(t=>nd.chains.some(c=>c.t.k===t.k&&c.ph===ph));for(const p of nd.poles.values())if(p.ph===ph)return true;return nd.kids.some(k=>scUses(k,ph));}
// 接在用電器具 U／V／W 的馬達（照導線與端子台的同電位找）
// 插在插座口（插頭）上的器具：導線或兩端接頭的電纜
function scPlugged(d){const isP=t=>t==='插頭'||String(t).startsWith('插頭.'),out=[];
  S.wires.forEach(w=>[[w.a,w.b],[w.b,w.a]].forEach(([a,b])=>{if(a.d===d.id&&isP(a.t)&&b.d!==d.id){const o=devOf(b.d);if(o&&!isTB(o))out.push({d:o,t:b.t,no:w.no||''});}}));
  (S.cables||[]).forEach(c=>{const P=c.plug||{};[['a','b'],['b','a']].forEach(([x,y])=>{if(P[x]&&P[y]&&P[x].d===d.id&&isP(P[x].t)){const o=devOf(P[y].d);if(o)out.push({d:o,t:P[y].t,no:c.no||''});}});});return out;}
function scMotorsOf(M,c){const out=new Set(),UVW=/^(U|V|W)\d?$/;const t=tplOf(c.d);
  t.terms.filter(p=>UVW.test(p.id)).forEach(p=>{const k=M.f(nodeKey({d:c.d.id,t:p.id}));if(!M.wiredNode.has(k))return;
    S.devices.forEach(m=>{if(m===c.d||!/馬達/.test(tplOf(m).cat||''))return;if(tplOf(m).terms.some(q=>UVW.test(q.id)&&M.f(nodeKey({d:m.id,t:q.id}))===k))out.add(m);});});
  return [...out];}

/* ---------- 7. 控制回路（DC）：每個電源一段展開圖 ---------- */
// 一段控制回路（一組上下電源線）的元素化簡成樹。AC 段：排除保護器上游；
// 只留在上下電源線之間的部分：從上面走得到（不經過下面）、也從下面走得到（不經過上面），掛在電源線外的東西（例如 N 相接到主回路）不算
function scSecTree(M,G){const ac=G.srcs[0].ac;
  const edges=M.E.filter(e=>!e.aux&&(ac?!G.srcs.some(q=>q.excl.has(e.id)):!(M.phase.has(e.u)&&M.phase.has(e.v)))&&M.wiredNode.has(e.u)&&M.wiredNode.has(e.v)).map(e=>({u:e.u,v:e.v,t:scLeaf(e)}));
  const ad=new Map();edges.forEach(e=>{[[e.u,e.v],[e.v,e.u]].forEach(([x,y])=>{if(!ad.has(x))ad.set(x,[]);ad.get(x).push(y);});});
  const reach=(a,stop)=>{const R=new Set([a]),st=[a];while(st.length){const x=st.pop();if(x===stop)continue;(ad.get(x)||[]).forEach(y=>{if(!R.has(y)){R.add(y);st.push(y);}});}return R;};
  const R1=reach(G.p,G.n),R2=reach(G.n,G.p),inn=k=>R1.has(k)&&R2.has(k);
  return spReduce(edges.filter(e=>inn(e.u)&&inn(e.v)),G.p,G.n);}
function scCtrlPages(M,pages,newPage){
  // 安全繼電器：輸入端子兩兩之間經過接點（急停、門開關）相通的，各當成一段（上下電源線就是那兩個端子；配對照實際接線找）
  (M.pnoz||[]).forEach(({d,e})=>{const ins=[...e.ins,...(e.auto?[e.auto[0]]:[])],K=[...e.insK.map(M.f),...(e.auto?[M.f(nodeKey({d:d.id,t:e.auto[0]}))]:[])],used=new Set(),usedL=new Set(); // 重置端子（S34）也算：手動重置按鈕；同一個接點只出現在一段
    const nIns=e.ins.length;for(let i=0;i<K.length;i++)for(let j=i+1;j<K.length;j++){if((j<nIns&&(used.has(i)||used.has(j)))||(j>=nIns&&used.has(j))||K[i]===K[j])continue; /* 重置端子可以和已配對的輸入端子再配一次 */const t=scSecTree(M,{p:K[i],n:K[j],srcs:[{}]});
      if(t&&scLeaves(t).length&&!scLeaves(t).some(l=>usedL.has(l.e.id))){scLeaves(t).forEach(l=>usedL.add(l.e.id));used.add(i);used.add(j);M.srcs.push({d,e:{p:ins[i],n:ins[j]},p:K[i],nn:K[j],v:'安全輸入',safety:true});}}});
  const groups=new Map();M.srcs.forEach(s=>{const p=M.f(s.p),n=M.f(s.nn);if(!M.wiredNode.has(p))return;const k=p+'|'+n;if(!groups.has(k))groups.set(k,{p,n,srcs:[]});groups.get(k).srcs.push(s);});
  const used=new Set();const secs=[];
  [...groups.values()].sort((a,b)=>natCmp(a.srcs[0].d.tag,b.srcs[0].d.tag)).forEach(G=>{
    const tree=scSecTree(M,G);if(!tree)return;
    const lv=scLeaves(tree);lv.forEach(l=>used.add(l.e.id));secs.push({G,tree});});
  const loadKey=t=>{const sl=scLeaves(t).find(l=>l.e.k==='sens'||l.e.sensPwr);if(sl)return sl.e.d.tag+(sl.e.sensPwr?' 0':' 1'+sl.e.tb);const L=scLeaves(t).filter(l=>scIsLoad(l.e));if(!L.length)return '';const e=L[0].e;return e.k==='plcx'?'~'+e.d.tag+' '+ptName(e):e.d.tag;};
  const sortPar=t=>{if(t.t==='leaf')return;t.c.forEach(sortPar);if(t.t!=='par')return;t.c.sort((a,b)=>natCmp(loadKey(a),loadKey(b)));
    for(let i=0;i<t.c.length;i++){const a=scHeadOf(t.c[i]);if(!a||a.leaf.e.k!=='no')continue;const j=t.c.findIndex((c,jj)=>jj!==i&&scCoPair(a,scHeadOf(c)));if(j<0||j===i+1)continue;
      const [nc]=t.c.splice(j,1);t.c.splice(j<i?i:i+1,0,nc);if(j<i)i--;}};
  secs.forEach(s=>sortPar(s.tree));
  M.ctrlTrees=secs; // 測試用
  // 排版：每段先算好要畫的分支（太寬時拉出中間電位），再依序排進頁面；放得下的小段共用同一頁
  let pg=null,x=0;const ctrlPgs=[];
  const open=()=>{pg=newPage('控制回路','ctrl',[]);pg.spans=[];pg.secs=[];ctrlPgs.push(pg);x=SC.X0;};
  secs.forEach(({G,tree})=>{
    const tags=G.srcs.map(s=>s.d.tag).join('、'),v=G.srcs[0].v,sec={v,tags,ids:G.srcs.map(s=>s.d.id)};
    // 版面：太高時縮小格高；太寬時把中間電位拉成新的電源線
    let LH=24;const avail=SC.RB-SC.RT-14;for(;LH>12;LH-=1){if(scMaxH(tree,LH)<=avail)break;}
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
    // 電源線名稱用那一點實際的線號（沒有線號才寫電壓），旁邊小字註明是哪台電源的哪個端子
    const s0={top:M.netName(G.p)||`${v} ＋`,bot:M.netName(G.n)||`${v} −`,topSub:G.srcs.map(q=>`${q.d.tag} ${termLabel(q.d,q.e.p)}`).join('、'),botSub:G.srcs.map(q=>`${q.d.tag} ${termLabel(q.d,q.e.n)}`).join('、'),items:[]};segs.push(s0);place(s0,tree);
    const all=[];segs.forEach((sg,si)=>sg.items.forEach(it=>all.push({...it,seg:sg})));
    const total=all.reduce((a,it)=>a+scWidth(it.t),0)*SC.U;
    // 整段放得進這一頁剩下的空間就接著放（中間空一格），否則換新頁
    if(!pg||x+SC.U+total>SC.X1+.1)open();else x+=SC.U;
    let first=true;
    // 同一顆感測器的電源與輸出整組一起換頁，不拆開
    const sensOf=t=>{const l=scLeaves(t).find(q=>q.e.k==='sens'||q.e.sensPwr);return l?l.e.d.id:null;};
    all.forEach((it,ii)=>{const w=scWidth(it.t),sid=sensOf(it.t),prev=ii>0?sensOf(all[ii-1].t):null;let need=w;
      if(sid&&sid!==prev)for(let j=ii+1;j<all.length&&sensOf(all[j].t)===sid&&all[j].seg===it.seg;j++)need+=scWidth(all[j].t);
      if(x+(need*SC.U>SC.X1-SC.X0?w:need)*SC.U>SC.X1+0.1){open();first=true;}
      if(!pg.secs.includes(sec)){pg.secs.push(sec);pg.src.push(...sec.ids);pg.pos.push({x:0,y:0,terms:G.srcs.flatMap(q=>[q.d.id+'|'+q.e.p,q.d.id+'|'+q.e.n,...(tplOf(q.d).terms||[]).filter(t=>[G.p,G.n].includes(M.f(nodeKey({d:q.d.id,t:t.id})))).map(t=>q.d.id+'|'+t.id)])});}
      let sp=pg.spans[pg.spans.length-1];if(!sp||sp.seg!==it.seg||sp.sec!==sec){sp={seg:it.seg,sec,x0:x,x1:x,items:[],LH,head:first?'':'（續）',newSec:!pg.spans.some(s=>s.sec===sec)};pg.spans.push(sp);first=false;}
      sp.items.push({...it,x});sp.x1=x;x+=w*SC.U;});
  });
  ctrlPgs.forEach(pg=>{pg.title=`控制回路 ${[...new Set(pg.secs.map(s=>`${s.v}（${s.tags}）`))].join('、')}`;let h='';
    pg.spans.forEach(sp=>{const sg=sp.seg,xa=sp.x0-5,xb=sp.x1+7,ctx={LH:sp.LH,M,put:o=>pg.pos.push(o)};
      if(sp.newSec)h+=`<text class="s-sec" x="${xa}" y="${SC.RT-13}">${scEsc(sp.sec.v)}　${sp.sec.v==="安全輸入"?"":"電源 "}${scEsc(sp.sec.tags)}${sp.head}</text>`;
      h+=`<line class="s-rail" x1="${xa}" y1="${SC.RT}" x2="${xb}" y2="${SC.RT}"/><line class="s-rail" x1="${xa}" y1="${SC.RB}" x2="${xb}" y2="${SC.RB}"/>`;
      h+=`<text class="s-railn" x="${xa}" y="${SC.RT-2.2}">${scEsc(sg.top)}${sg.topSub?`<tspan class="s-sub" dx="1.5">（${scEsc(sg.topSub)}）</tspan>`:''}</text><text class="s-railn" x="${xa}" y="${SC.RB+4.6}">${scEsc(sg.bot)}${sg.botSub?`<tspan class="s-sub" dx="1.5">（${scEsc(sg.botSub)}）</tspan>`:''}</text>`;
      const outN=new Map();
      sp.items.forEach((it,i)=>{const nx=sp.items[i+1];if(it.coB||!nx||it.topLbl||it.botLbl||nx.topLbl||nx.botLbl)return;const a=scHeadOf(it.t),b=scHeadOf(nx.t);if(scCoPair(a,b)){a.leaf.co={x2:nx.x};nx.coB={b,x1:it.x};}});
      sp.items.forEach(it=>{if(it.coB){h+=scCoOut(it.coB.b,it.coB.x1,SC.RT+sp.LH/2,it.x,SC.RB,ctx)+SY.dot(it.x,SC.RB);return;}const sz=scSize(it.t,sp.LH);let y=SC.RT,H=SC.RB-SC.RT;
        // 多線式感測器的輸出：不再畫一個「棕→黑」接點，黑／白線從感測器方塊右側直接拉到這一欄往下（越遠的欄出線越高，線不交叉）
        const sv=!it.topLbl&&!it.botLbl&&scSensHead(it.t),P=sv&&pg.pos.find(o=>o.e&&o.e.sensPwr&&o.e.d===sv.leaf.e.d&&o.x<it.x&&it.x-o.x<=SC.U*3.1+.1);
        if(P){const dv=sv.leaf.e.d,k=outN.get(dv.id)||0;outN.set(dv.id,k+1);h+=scSensOut(sv,P.x,P.y,k,it.x,SC.RB,ctx)+SY.dot(it.x,SC.RB);return;}
        if(it.topLbl){h+=`<text class="s-pot" x="${it.x}" y="${SC.RT+5.5}">↓ ${scEsc(it.topLbl)}</text>`;y=SC.RT+8;H-=8;}
        else h+=SY.dot(it.x,SC.RT);
        if(it.botLbl){H=Math.min(H,sz.h+4);h+=scDraw(it.t,it.x,y,H-4,ctx)+SY.line(it.x,y+H-4,y+H)+`<text class="s-pot" x="${it.x}" y="${y+H+4}">↓ ${scEsc(it.botLbl)}</text>`;}
        else{h+=scDraw(it.t,it.x,y,H,ctx)+SY.dot(it.x,SC.RB);}});});
    pg.body=h;});
  return used;
}
const scLeaves=t=>t.t==='leaf'?[t]:t.c.flatMap(scLeaves);
// 感測器輸出：從方塊（中心 px,py）右側第 k 條出線拉到 x，往下畫其餘部分到 yEnd
function scSensOut(sv,px,py,k,x,yEnd,ctx){const dv=sv.leaf.e.d,ey=py+1.8-k*3.6;
  let h=`<line x1="${px+6.5}" y1="${ey}" x2="${x}" y2="${ey}"/>`+scTx('s-term',px+7.3,ey-.7,termLabel(dv,sv.leaf.e.tb)||sv.leaf.e.tb,x-px-9,SCF.term,'text-anchor:start');
  const nm=sv.node!=null?ctx.M.netName(sv.node):'';if(nm)h+=scTx('s-net',x+1.2,ey+3.6,nm,SC.U*.45,SCF.net);
  h+=sv.rest?scDraw(sv.rest,x,ey,yEnd-ey,ctx):SY.line(x,ey,yEnd);ctx.put({e:sv.leaf.e,x,y:ey});return h;}
// 支路開頭的葉子與後面剩下的部分
function scHeadOf(t){if(t.t==='leaf')return {leaf:t,rest:null,node:null};
  if(t.t==='ser'&&t.c[0].t==='leaf'){const r=t.c.slice(1);return {leaf:t.c[0],rest:r.length===1?r[0]:{t:'ser',c:r,nodes:(t.nodes||[]).slice(1)},node:(t.nodes||[])[0]};}return null;}
// 切換接點（1C）：同一個器具、同一個動作來源、共點相同的常開＋常閉，排在相鄰兩欄時畫成一個切換接點
const scTopT=l=>l.rev?l.e.tb:l.e.ta;
const scCoPair=(a,b)=>!!(a&&b&&a.leaf.e.d===b.leaf.e.d&&a.leaf.e.act===b.leaf.e.act&&a.leaf.e.k==='no'&&b.leaf.e.k==='nc'&&scTopT(a.leaf)===scTopT(b.leaf));
// 常閉那一欄：從切換接點右側拉過來，再往下畫其餘部分
function scCoOut(b,x1,c,x2,yEnd,ctx){const e=b.leaf.e,tb=b.leaf.rev?e.ta:e.tb,yy=Math.max(c+3.2,Math.min(c+14,yEnd-ctx.LH));let h=scTx('s-term',x2-1,c+7.4,termLabel(e.d,tb)||tb,Math.min(9,SC.U*.32),SCF.term);
  const nm=b.node!=null?ctx.M.netName(b.node):'';if(nm)h+=scTx('s-net',x2-1,c+10.6,nm,SC.U*.4,SCF.net,'text-anchor:end');
  h+=SY.line(x2,c+3.2,yy)+(b.rest?scDraw(b.rest,x2,yy,yEnd-yy,ctx):SY.line(x2,yy,yEnd));ctx.put({e,x:x2,y:c});return h;} // 常閉那一欄的其餘部分從文字下面開始
// 支路開頭是感測器輸出（sens）時，回傳那個葉子與後面剩下的部分
function scSensHead(t){if(t.t==='leaf')return t.e.k==='sens'?{leaf:t,rest:null,node:null}:null;
  if(t.t==='ser'&&t.c[0].t==='leaf'&&t.c[0].e.k==='sens'){const r=t.c.slice(1);return {leaf:t.c[0],rest:r.length===1?r[0]:{t:'ser',c:r,nodes:(t.nodes||[]).slice(1)},node:(t.nodes||[])[0]};}return null;}
function scMaxH(t,LH){return scSize(t,LH).h;}

/* ---------- 8. PLC I/O：每點一欄，每頁上下兩組 ---------- */
function scPlcPages(M,pages,newPage){
  const plcs=S.devices.filter(d=>M.E.some(e=>e.d===d&&(e.k==='plcx'||e.k==='plcy'))).sort((a,b)=>natCmp(a.tag,b.tag));
  const byNode=new Map();M.E.forEach(e=>[e.u,e.v].forEach(k=>{if(!byNode.has(k))byNode.set(k,[]);byNode.get(k).push(e);}));
  const blocks=[],per=16,cw=22;
  plcs.forEach(d=>['plcx','plcy'].forEach(kind=>{const pts=M.E.filter(e=>e.d===d&&e.k===kind&&M.wiredNode.has(kind==='plcx'?e.u:e.v));
    for(let i=0;i<pts.length;i+=per)blocks.push({d,kind,part:pts.slice(i,i+per),n:pts.length>per?i/per+1:0});}));
  const drawBlock=(B,yo,pg)=>{const {d,kind,part}=B;
    const dn=tplOf(d).n,hd=d.tag===dn||dn.startsWith(d.tag)?dn:`${d.tag}　${dn}`,io=kind==='plcx'?'輸入':'輸出',gs=scChainGuess(d,kind==='plcx'?'X':'Y');
    let h=`<text class="s-sec" x="${SC.X0-6}" y="${yo}">PLC ${io}　${scEsc(hd)}${B.n?`（${B.n}）`:''}</text>`+(gs?scTx('s-sub',SC.X0-6,yo+5,`位址推定：沒有串接在 ${gs.host.tag} 旁邊，照盤面位置排在後面（實際以擴充電纜連接順序為準）`,300,SCF.sub):'');
    const bx=SC.X0,by=yo+68,bw=Math.max(part.length*cw+8,scTW(hd,SCF.tag)+6); // 點數少時框也要放得下器具名稱
    h+=`<rect class="s-dev" x="${bx}" y="${by}" width="${bw}" height="18"/>`+scTx('s-tag',bx+2,by+16,hd,bw-4,SCF.tag);
    part.forEach((e,j)=>{const x=bx+6+j*cw+cw/2-4,k=kind==='plcx'?e.u:e.v,nm=M.netName(k);
      h+=`<text class="s-in" x="${x}" y="${by+5}" style="font-weight:700">${scEsc(ptName(e))}</text><text class="s-in" x="${x}" y="${by+9.5}">${scEsc(termLabel(d,e.pt)||e.pt)}</text>`;
      h+=SY.line(x,yo+42,by)+(nm?`<text class="s-netv" transform="translate(${x+.9} ${yo+46}) rotate(90)">${scEsc(nm)}</text>`:'');
      // 接在這一點的現場器具（輸入：接點、感測器；輸出：線圈、燈）
      const nb=(byNode.get(k)||[]).filter(q=>q!==e&&q.k!=='diode'&&!(q.d===d&&q.k===kind)).sort((a,b)=>(a.load===(kind==='plcy')?-1:1)-(b.load===(kind==='plcy')?-1:1));
      const f0=nb[0];
      if(f0){const c=yo+28,g=f0.k;h+=SY.line(x,yo+12,c-4)+SY.line(x,c+4,yo+42);
        h+=g==='coil'?SY.coil(x,c):g==='nc'?SY.nc(x,c):g==='sens'?SY.no(x,c)+SY.sensA(x,c):g==='no'||g==='brk'||g==='plcy'?SY.no(x,c):scLamp(f0)?SY.lamp(x,c,f0.d):SY.box(x,c,f0.name||'');
        if(['no','nc','sens','brk','plcy'].includes(g))h+=SY.line(x,c-4,c-3)+SY.line(x,c+3,c+4);
        if((g==='no'||g==='nc')&&(f0.by==='btn'||f0.by==='op'))h+=SY.btn(x,c);
        const ad=devOf(String(f0.act).split('#')[0]),tg=f0.ctl&&ad&&ad!==f0.d&&['coil','host','op'].includes(f0.by)?ad.tag:f0.d.tag;
        const sb0=(f0.d.model&&tplOf(f0.d).model?f0.d.model:'')||tplOf(f0.d).n,nl=Math.min(nb.length>1?4:5,scWrap(sb0,cw-6,SCF.sub).length);
        h+=scTx('s-tag',x+4.6,c-.4,tg,cw-6,SCF.tag)+scTxW('s-sub',x+4.6,c+3,sb0,cw-6,SCF.sub,nb.length>1?4:5,2.9);
        const far=f0.u===k?f0.v:f0.u,fn=M.netName(far);h+=`<text class="s-pot" x="${x}" y="${yo+10}">${scEsc(fn||'')}</text>`;
        if(nb.length>1)h+=scTx('s-sub',x+4.6,c+3+nl*2.9,`＋${[...new Set(nb.slice(1).map(q=>q.d.tag))].join('、')}`,cw-6,SCF.sub); // 同一點還接了別的器具：列編號
        pg.pos.push({e:f0,x,y:c});}
      else h+=`<text class="s-sub" x="${x+1.2}" y="${yo+60}">（只有接線）</text>`;
      pg.pos.push({e,x,y:by});});
    const coms=[...new Set(part.map(e=>kind==='plcx'?e.tb:e.ta))].filter(Boolean);
    h+=`<text class="s-sub" x="${bx}" y="${by+23}">共點：${scEsc(coms.map(c=>{const k=M.f(nodeKey({d:d.id,t:c}));const nm=M.netName(k);return `${termLabel(d,c)||c}${nm?' → '+nm:''}`;}).join('、'))}</text>`;
    return h;};
  for(let i=0;i<blocks.length;i+=2){const two=blocks.slice(i,i+2);
    const pg=newPage(`PLC ${two.map(B=>`${B.kind==='plcx'?'輸入':'輸出'} ${B.d.tag}${B.n?`（${B.n}）`:''}`).join('、')}`,'plc');
    pg.body=two.map((B,j)=>drawBlock(B,j?140:34,pg)).join('');}
}

/* ---------- 8b. 伺服接線圖：每台伺服列出所有有接線的端子，拉到對端器具 ----------
   主回路與控制回路只畫有電氣動作的部分；光纖（SSCNET）、編碼器、電池、再生電阻、馬達與煞車這類接頭／接線在這裡一次列清楚。
   光纖畫虛線；接馬達的 U／V／W／E 收到馬達符號，馬達自己的其他端子（煞車 B1／B2、編碼器）列在馬達旁邊，並標出煞車在控制回路第幾頁；
   型錄有 CN2（編碼器）但沒有接線的，標「沒有接線」提醒補線。 */
function scServoPages(M,newPage,pages){
  const servos=S.devices.filter(d=>tplOf(d).cat===C5&&!tplOf(d).attach&&hasSim(d)&&S.wires.some(w=>w.a.d===d.id||w.b.d===d.id)).sort((a,b)=>natCmp(a.tag,b.tag));
  scConnPages(M,newPage,pages,servos,'伺服接線','servo',null);}
/* 其他接線：有接線、但哪一頁圖上都沒出現的端子（通訊板、接頭、接線盒…），用同樣的接線圖畫出來；接地端子不列（都接到接地銅板） */
function scOtherPages(M,newPage,pages){
  const cov=new Set(),addC=k=>{cov.add(k);const i=k.indexOf('.',k.indexOf('|'));if(i>0)cov.add(k.slice(0,i));};
  pages.forEach(pg=>pg.pos.forEach(o=>{const e=o.e;if(e&&e.d){if(e.ta)addC(e.d.id+'|'+e.ta);if(e.tb)addC(e.d.id+'|'+e.tb);}(o.terms||[]).forEach(addC);}));
  // 只有導通的轉接器（5521 轉接座這類）：端子所在的點已經畫在圖上就算畫過
  const dn=new Set();pages.forEach(pg=>pg.pos.forEach(o=>{const e=o.e;if(e&&e.u!=null){dn.add(e.u);dn.add(e.v);}}));
  cov.forEach(k=>{const i=k.indexOf('|');if(i>0)dn.add(M.f(nodeKey({d:k.slice(0,i),t:k.slice(i+1)})));});
  S.devices.forEach(d=>{const E=simElems(d);if(!E.length||!E.every(e=>e.k==='pass'||e.k==='grp'))return;(tplOf(d).terms||[]).forEach(t=>{const sub=E.find(e=>e.k==='grp'&&e.t===t.id);
    const ks=sub?sub.sub.map(x=>t.id+'.'+x):[t.id];if(ks.every(x=>dn.has(M.f(nodeKey({d:d.id,t:x})))))cov.add(d.id+'|'+t.id);});});
  const devs=S.devices.filter(d=>!isTB(d)&&!busOf(d)).filter(d=>scTermsWired(d).some(t=>!cov.has(d.id+'|'+t)&&!scEarth(d,t))).sort((a,b)=>natCmp(a.tag,b.tag));
  scConnPages(M,newPage,pages,devs,'其他接線','other',t=>d=>!cov.has(d.id+'|'+t)&&!scEarth(d,t));}
const scTL=(d,t)=>{const l=termLabel(d,t)||t,q=termOf(d,t),m=q&&/^第\s*(\d+)\s*腳/.exec(q.desc||'');return m&&l!==m[1]?`${l}（${m[1]}腳）`:l;};
const scEarth=(d,t)=>{const p=termOf(d,t);return typeof isEarthTerm==='function'&&!!p&&isEarthTerm(p);};
const scTermsWired=d=>[...new Set([...S.wires.flatMap(w=>[w.a,w.b]).filter(e=>e.d===d.id).map(e=>e.t),...(S.cables||[]).flatMap(c=>c.plug?['a','b'].map(k=>c.plug[k]).filter(q=>q&&q.d===d.id).map(q=>q.t):[])])];
function scConnPages(M,newPage,pages,devList,title,kind,keep){if(!devList.length)return;
  const nk=(d,t)=>M.f(nodeKey({d:d.id,t}));
  // 一個節點上（導線、端子台同片、短路片都算同一點）除了自己以外的器具端子；端子台只在找不到其他器具時列出
  const wiresAt=(d,t)=>S.wires.filter(w=>(w.a.d===d.id&&w.a.t===t)||(w.b.d===d.id&&w.b.t===t));
  // 對端：照導線直接接到哪裡；接到端子台時往後追，後面只有一兩台器具才展開（0V、接地這種共用的寫到端子台為止）
  const ends=(d,t)=>{const out=[];wiresAt(d,t).forEach(w=>{const o=(w.a.d===d.id&&w.a.t===t)?w.b:w.a,od=devOf(o.d);if(!od)return;
    if(isTB(od)&&!busOf(od)){const k=nk(od,o.t),more=[];S.wires.forEach(w2=>[w2.a,w2.b].forEach(q=>{const qd=devOf(q.d);if(!qd||isTB(qd)||(q.d===d.id&&q.t===t)||nk(qd,q.t)!==k)return;if(!more.some(x=>x.d===qd&&x.t===q.t))more.push({d:qd,t:q.t});}));
      if(more.length&&more.length<=2){more.forEach(m=>out.push({...m,via:`${od.tag}:${termLabel(od,o.t)}`}));return;}}
    if(!out.some(x=>x.d===od&&x.t===o.t))out.push({d:od,t:o.t});});
    return out;};
  // 電纜接頭端：plug.a／plug.b 直接插在器具接頭上（兩端都是接頭時沒有芯線）
  const plugsAt=(d,t)=>(S.cables||[]).filter(c=>c.plug&&['a','b'].some(k=>c.plug[k]&&c.plug[k].d===d.id&&c.plug[k].t===t)).map(c=>{const k=c.plug.a&&c.plug.a.d===d.id&&c.plug.a.t===t?'a':'b',o=c.plug[k==='a'?'b':'a'];return {c,o:o&&devOf(o.d)?{d:devOf(o.d),t:o.t}:null};});
  const termsWired=scTermsWired;
  const cabNo=w=>{const c=w.cab&&(S.cables||[]).find(c=>c.id===w.cab);return c?c.no||'':'';};
  const ORD=['L1','L2','L3','L11','L21','P+','C','D','P3','P4','N-','U','V','W','PE','E','PE2','CN1A','CN1B','CN2','CN2L','CN3','CN4','CN5','CN8'];
  const ordOf=t=>{const i=ORD.indexOf(t);return i<0?500:i;};
  const blocks=devList.map(sv=>{const T=tplOf(sv),wired=termsWired(sv).filter(t=>!keep||keep(t)(sv)).sort((a,b)=>ordOf(a)-ordOf(b)||natCmp(a,b));
    const rows=wired.map(t=>{const pl=plugsAt(sv,t);return {t,ends:[...ends(sv,t),...pl.filter(q=>q.o).map(q=>q.o)],ws:wiresAt(sv,t),pl};});
    // 型錄有編碼器接頭但沒接線
    if(kind==='servo')T.terms.filter(p=>/^CN2$/.test(p.id)&&!wired.includes(p.id)).forEach(p=>rows.push({t:p.id,miss:true})); // CN2L（線性編碼器）是選配，不提醒
    // 接到同一台馬達的列排在一起（U V W、接地、編碼器），收線時不會穿過其他列
    const mi=r=>kind==='servo'&&!r.miss&&r.ends.length&&/馬達/.test(tplOf(r.ends[0].d).cat||'');const f0=rows.findIndex(mi);
    if(f0>=0){const mr=rows.filter(mi),rest=rows.filter(r=>!mi(r));rest.splice(f0,0,...mr);rows.length=0;rows.push(...rest);}
    return {sv,rows};});
  const RH=7.2,colW=190;
  const draw=(B,x0,pg,y0)=>{const {sv,rows}=B;let h=scTx('s-sec',x0,y0,`${sv.tag}　${tplOf(sv).n}`,colW-4,4);
    const by=y0+6,bh=rows.length*RH+11,bx=x0,bw=34; // 框底下多留一行放器具編號
    h+=`<rect class="s-dev" x="${bx}" y="${by}" width="${bw}" height="${bh}"/>`+scTx('s-tag',bx+2,by+bh-2,sv.tag,bw-4,SCF.tag);
    // 馬達：U／V／W／E 接到同一台馬達的列，收成一個馬達符號
    const motorRows=rows.filter(r=>kind==='servo'&&!r.miss&&r.ends.length&&/馬達/.test(tplOf(r.ends[0].d).cat||'')),mot=motorRows.length?motorRows[0].ends[0].d:null;
    let band=null;if(mot){const my0=by+4+rows.indexOf(motorRows[0])*RH+motorRows.length*RH/2,no=termsWired(mot).length-motorRows.length;band=[my0-7,my0+10+Math.max(0,no)*6.4+5];}
    rows.forEach((r,i)=>{const y=by+4+i*RH+RH/2,xl=bx+bw,xr=x0+96,lim=band&&y>band[0]-3&&y<band[1]+3?x0+117:x0+colW;
      h+=scTx('s-term',xl-1,y+.9,scTL(sv,r.t),bw-6,SCF.term);
      if(r.miss){h+=`<line x1="${xl}" y1="${y}" x2="${xl+6}" y2="${y}"/>`+scTx('s-sub',xl+8,y+1,`${r.t}（編碼器）：沒有接線`,colW-bw-14,SCF.sub,'fill:#a00');return;}
      const fiber=r.ws.some(w=>/光纖|SSCNET|fiber/i.test(w.no||'')||/^CN1[AB]$/.test(r.t)),self=r.ends.length&&r.ends.every(e=>e.d===sv);
      const isMot=mot&&r.ends.some(e=>e.d===mot);
      const xe=isMot?x0+120:xr;
      h+=`<line x1="${xl}" y1="${y}" x2="${xe}" y2="${y}"${fiber?' stroke-dasharray="2 1.2"':''}/>`;
      const lab=[...r.ws.map(w=>w.no+(cabNo(w)?`（${cabNo(w)}）`:'')),...(r.pl||[]).map(q=>`${q.c.no}　${q.c.spec||''}`)].filter((v,j,a)=>a.indexOf(v)===j).join('、');
      if(lab)h+=scTx('s-net',xl+2,y-1,lab,xe-xl-4,SCF.net);
      pg.pos.push({x:xl,y,terms:[sv.id+'|'+r.t,...r.ends.map(e=>e.d.id+'|'+e.t)]});
      if(isMot){const mx=x0+132,my=by+4+rows.indexOf(motorRows[0])*RH+motorRows.length*RH/2;h+=`<line x1="${xe}" y1="${y}" x2="${mx-7}" y2="${my}"/>`;return;}
      const far=self?r.ends.map(e=>`${scTL(sv,e.t)}（同一台）`).join('、'):r.ends.map(e=>`${e.d.tag}：${scTL(e.d,e.t)}${e.via?`（經 ${e.via}）`:''}`).join('、');
      // 對端編號，後面同一行接型號（灰色小字）
      const room=lim-xr-4,F=scFit(far||'—',room,3.1,1.8);h+=`<text class="s-tag" x="${xr+1.5}" y="${y+1.1}" style="font-size:${F.fs}px">${scEsc(F.t)}</text>`;
      const used=scTW(F.t,F.fs)+3,nm=r.ends.length&&!self?tplOf(r.ends[0].d).n:'';if(nm&&scTW(nm,SCF.sub*.9*.85)<=room-used)h+=scTx('s-sub',xr+1.5+used,y+1.1,nm,room-used,SCF.sub*.9,'fill:#555'); // 型號是補充資訊：放得下完整才寫
      pg.pos.push({e:{d:sv,act:sv.id,k:'servo'},x:xl,y,terms:[sv.id+'|'+r.t]});});
    if(mot){const mr=motorRows,mx=x0+132,my=by+4+rows.indexOf(mr[0])*RH+mr.length*RH/2;
      h+=SY.motor(mx,my,'')+scTx('s-tag',mx+8,my-1,mot.tag,colW-(mx-x0)-10,SCF.tag)+scTx('s-sub',mx+8,my+3,tplOf(mot).n,colW-(mx-x0)-10,SCF.sub);
      // 馬達自己的其他端子（煞車、編碼器…）
      const others=termsWired(mot).filter(t=>!mr.some(r=>r.ends.some(e=>e.d===mot&&e.t===t)));
      const brakeEl=M.E.find(e=>e.d===mot&&e.load);
      others.forEach((t,i)=>{const y=my+10+i*6.4,w=[...wiresAt(mot,t),...plugsAt(mot,t).map(q=>({no:q.c.no}))],ed=[...ends(mot,t),...plugsAt(mot,t).filter(q=>q.o).map(q=>q.o)].filter(e=>e.d!==mot);
        h+=`<line x1="${mx}" y1="${my+5.5}" x2="${mx}" y2="${y}"/><line x1="${mx}" y1="${y}" x2="${mx+6}" y2="${y}"/>`+scTx('s-term',mx-1,y+.9,termLabel(mot,t),9,SCF.term);
        h+=scTx('s-sub',mx+7,y+1,`${w.map(q=>q.no).join('、')} → ${ed.map(e=>`${e.d.tag}：${termLabel(e.d,e.t)}`).join('、')||'—'}`,colW-(mx-x0)-9,SCF.sub);pg.pos.push({x:mx,y,terms:[mot.id+'|'+t]});});
      if(brakeEl&&others.length)h+=scTx('s-xr2',mx+7,my+10+others.length*6.4+2,`${brakeEl.name||'煞車'}的控制見第 \u0001D:${mot.id}\u0001 頁`,colW-(mx-x0)-9,SCF.xref);}
    return h;};
  // 排版：兩欄，區塊高度照列數（有馬達時加上馬達與煞車的範圍）；放不下換欄、換頁
  const hOf=B=>{const mr=B.rows.filter(r=>kind==='servo'&&!r.miss&&r.ends.length&&/馬達/.test(tplOf(r.ends[0].d).cat||''));let h=B.rows.length*RH+11+12;
    if(mr.length){const mot=mr[0].ends[0].d,no=termsWired(mot).length-mr.length,my=mr.length*RH/2+B.rows.indexOf(mr[0])*RH+4;h=Math.max(h,my+10+Math.max(0,no)*6.4+12);}return h;};
  let pg=null,col=0,y=0;const Y0=34,YMAX=250;const tags=[];
  const flush=()=>{if(pg)pg.title=`${title} ${tags.join('、')}`;};
  blocks.forEach(B=>{const hh=hOf(B);if(!pg||y+hh>YMAX){if(pg&&col===0&&Y0+hh<=YMAX){col=1;y=Y0;}else{flush();pg=newPage(title,kind);pg.body='';tags.length=0;col=0;y=Y0;}}
    pg.body+=draw(B,30+col*(colW+4),pg,y);tags.push(B.sv.tag);y+=hh+6;});flush();
}

/* ---------- 9. 表格頁：小表合併在同一頁，大表分頁 ---------- */
function scTablePages(newPage,title,head,rows,per=34){scPackTables(newPage,title,[{t:'',head,rows}],per);}
function scPackTables(newPage,title,secs,per=34){
  const chunks=[];secs.forEach(s=>{if(!s.rows.length)return;for(let i=0;i<s.rows.length;i+=per-2)chunks.push({...s,rows:s.rows.slice(i,i+per-2),cont:i>0});});
  if(!chunks.length)return;
  const pagesL=[];let cur=null,used=0;chunks.forEach(c=>{const need=c.rows.length+(c.t?3:1);if(!cur||used+need>per){cur=[];pagesL.push(cur);used=0;}cur.push(c);used+=need;});
  pagesL.forEach((L,i)=>{const names=[...new Set(L.map(c=>c.t).filter(Boolean))];
    const pg=newPage(`${title}${names.length?' '+names.join('、'):''}${!names.length&&pagesL.length>1?`（${i+1}）`:''}`,'table');
    pg.html=L.map(c=>`${c.t?`<h4 class="s-th">${scEsc(c.t)}${c.cont?'（續）':''}</h4>`:''}<table class="s-table"><thead><tr>${c.head.map(h=>`<th>${scEsc(h)}</th>`).join('')}</tr></thead><tbody>${c.rows.map(r=>`<tr>${r.map(v=>`<td>${scEsc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`).join('');});}

/* ---------- 10. 組合全部頁面 ---------- */
function schemBuild(){
  const M=schemModel(),pages=[];let no=0;
  SC_XR=new Map();{const G=new Map();M.E.filter(e=>e.ctl&&['no','nc'].includes(e.k)&&M.wiredNode.has(e.u)&&M.wiredNode.has(e.v)).forEach(e=>{if(!G.has(e.act))G.set(e.act,new Set());G.get(e.act).add(e.k+(M.phase.has(e.u)?'m':e.id));});G.forEach((v,k)=>SC_XR.set(k,v.size));}
  const d=new Date(),p2=n=>String(n).padStart(2,'0'),meta={date:`${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`,title:S.docTitle||'（未命名專案）',ver:($('ver')&&$('ver').textContent)||''};
  const newPage=(title,kind,src)=>{const pg={no:++no,title,kind,src,pos:[],body:'',html:''};pages.push(pg);return pg;};
  const cover=newPage('封面與圖例','cover'),index=newPage('圖面目錄','index');
  scMainPages(M,pages,newPage,meta);
  const used=scCtrlPages(M,pages,newPage);
  scPlcPages(M,pages,newPage);
  scServoPages(M,newPage,pages);
  scOtherPages(M,newPage,pages);
  scPackTables(newPage,'端子台',tbTables().map(t=>({t:t.d.tag,head:['片／端子','接線（點：線號 → 對端）'],rows:[...t.rows,...(t.jump.length?[['短路片',t.jump.join('、')]]:[])]})));
  scTablePages(newPage,'線號表',['線號','線徑','線色','起點','終點'],[...S.wires].sort((a,b)=>natCmp(a.no,b.no)).map(w=>[w.no,w.gauge,colorOf(w).n,epShort(w.a),epShort(w.b)]));
  { const bom=bomRows();scTablePages(newPage,'材料表',['分類','品名／型號','廠牌','數量','單位','器具編號'],bom.map(r=>[r.sec,r.name,r.brand,r.qty,r.unit,r.tags]),30); }
  // 封面
  const cnt=k=>pages.filter(p=>p.kind===k).length;
  cover.body=`<text class="s-big" x="${SC.W/2}" y="70">電路圖</text><text class="s-big2" x="${SC.W/2}" y="84">${scEsc(meta.title)}</text>
    <text class="s-cv" x="${SC.W/2}" y="96">${scEsc(meta.date)}　${S.devices.length} 器具　${S.wires.length} 條線　共 \u0001N\u0001 頁</text>
    <text class="s-cv" x="${SC.W/2}" y="104">由盤面配線模擬器依配線資料自動產生；符號照 IEC 60617（與現行 JIS C 0617 相同）。器具接點、規格請以原廠資料與實物為準。</text>`+scLegend(60,130);
  // 圖面目錄
  const rows=pages.map(p=>[p.no,p.title]);index.html=`<table class="s-table s-idx"><thead><tr><th>頁</th><th>圖名</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r[0]}</td><td>${scEsc(r[1])}</td></tr>`).join('')}</tbody></table>`;
  // 未畫進控制回路、也不在主回路的有接線負載（例如接到沒有動作資料的器具），列在目錄頁
  const noSim=S.devices.filter(x=>!hasSim(x)&&S.wires.some(w=>w.a.d===x.id||w.b.d===x.id)&&!isTB(x)).map(x=>x.tag);
  if(noSim.length)index.html+=`<p class="s-note">沒有動作資料、電路圖只出現在端子台表與線號表的器具：${scEsc(noSim.join('、'))}</p>`;
  // 交互參照：線圈下方列出接點在哪一頁哪一欄；電源供應器輸出接到哪一頁
  const loc=new Map();pages.forEach(pg=>pg.pos.forEach(o=>{if(!o.e)return;const k=o.e.act;if(!loc.has(k))loc.set(k,[]);loc.get(k).push({o,s:`${pg.no}.${scCol(o.x)}`});}));
  // 同一個位置的同類接點（例如主接點 L1-T1、L2-T2、L3-T3）合成一行
  const xrefL=act=>{const G=new Map();(loc.get(act)||[]).filter(x=>x.o.e.ctl&&['no','nc'].includes(x.o.e.k)).forEach(x=>{const pgn=x.s.split(/[.-]/)[0],k=x.o.e.k+'|'+(x.o.e.k&&M.phase.has(x.o.e.u)?pgn:x.s);if(!G.has(k))G.set(k,{nc:x.o.e.k==='nc',s:x.s,c:[],p:[]});const g=G.get(k);if(!g.c.includes(x.s))g.c.push(x.s);g.p.push(`${termLabel(x.o.e.d,x.o.e.ta)}-${termLabel(x.o.e.d,x.o.e.tb)}`);});
    return [...G.values()].map(g=>`${g.nc?'⊥':'∟'}${g.p.length>2?(scTW(g.p[0]+'～'+g.p[g.p.length-1],2.4)>14?'主接點':g.p[0]+'～'+g.p[g.p.length-1]):g.p.join(' ')} ${g.c.length>1?g.c[0]+'–'+g.c[g.c.length-1].split(/[.-]/).pop():g.s}`);};
  const xref=act=>{const L=xrefL(act);
    return L.slice(0,4).map((t,i)=>`<tspan x="0" dy="${i?2.7:0}">${scEsc(t)}</tspan>`).join('')+(L.length>4?`<tspan x="0" dy="2.7">…等 ${L.length} 個</tspan>`:'');};
  const srcPage=id=>{const pg=pages.find(p=>p.kind==='ctrl'&&(p.src||[]).includes(id));return pg?pg.no:'—';};
  const xrefU=act=>{const L=xrefL(act);
    const rows=L.length>4?[...L.slice(0,3),`另 ${L.length-3} 個`]:L;return {n:rows.length,h:rows.map((t,i)=>{const F=scFit(t,SC_V.U-7,2.4,1.5);return `<tspan x="0" dy="${i?2.9:0}"${F.fs!==2.4?` style="font-size:${F.fs}px"`:''}>${scEsc(F.t)}</tspan>`;}).join('')};};
  const fill=s=>s.replace(/<text class="s-xref" x="([\d.]+)" y="([\d.]+)">\u0001U:([^\u0001]*)\u0001<\/text>/g,(m,x,y,a)=>{const X=xrefU(a.replace(/&amp;/g,'&'));return `<text class="s-xref" transform="translate(${x} ${(+y-(X.n-1)*2.9).toFixed(2)})">${X.h}</text>`;}).replace(/<text class="s-xref" x="([\d.]+)" y="([\d.]+)">\u0001C:([^\u0001]*)\u0001<\/text>/g,(m,x,y,a)=>`<text class="s-xref" transform="translate(${x} ${y})">${xref(a.replace(/&amp;/g,'&'))}</text>`)
    .replace(/\u0001S:([^\u0001]*)\u0001/g,(m,id)=>{const n=srcPage(id);return n==='—'?'（沒有接負載）':` → 第 ${n} 頁`;}).replace(/\u0001T:([^\u0001]*)\u0001/g,(m,id)=>{const g=(M.contPage||{})[id.replace(/&gt;/g,'>').replace(/&amp;/g,'&')];return g&&g.pg?g.pg.no:'—';}).replace(/\u0001M:([^\u0001]*)\u0001/g,(m,id)=>{const k=id.replace(/&gt;/g,'>').replace(/&amp;/g,'&');const pg=pages.find(p=>p.pos.some(o=>o.node===k));return pg?pg.no:'—';}).replace(/\u0001D:([^\u0001]*)\u0001/g,(m,id)=>{const pg=pages.find(p=>p.kind==='ctrl'&&p.pos.some(o=>o.e&&o.e.d&&o.e.d.id===id));return pg?pg.no:'—';}).replace(/\u0001P:(\d+)\u0001/g,'$1').replace(/\u0001N\u0001/g,String(pages.length));
  return {M,pages:pages.map(pg=>({...pg,svg:fill(`<svg class="s-svg" viewBox="0 0 ${SC.W} ${SC.H}" xmlns="http://www.w3.org/2000/svg">${scFrame(pg,meta)}<text class="s-ptitle" x="${SC.M+8}" y="${SC.M+13}">${scEsc(pg.title)}</text>${pg.body}</svg>`),html:fill(pg.html||'')})),used,meta};
}
// 圖例
function scLegend(x,y){const L=[['no','常開接點'],['nc','常閉接點'],['brk','斷路器'],['fuse','保險絲'],['ol','熱動元件'],['btn','按鈕（手動）'],['trip','熱動（積熱電驛）'],['sens','感測器輸出'],['coil','線圈'],['diode','二極體'],['lamp','指示燈'],['box','負載／器具電源'],['plcx','PLC 輸入']];
  let h=`<text class="s-sec" x="${x}" y="${y-8}">圖例（IEC 60617）</text>`;
  L.forEach(([k,t],i)=>{const xx=x+i*28,c=y+8;h+=SY.line(xx,y,c-4)+SY.line(xx,c+4,y+16);
    h+=k==='diode'?SY.diode(xx,c,true):k==='btn'?SY.no(xx,c)+SY.btn(xx,c):k==='trip'?SY.nc(xx,c)+SY.trip(xx,c):k==='sens'?SY.no(xx,c)+SY.sensA(xx,c):k==='box'?SY.box(xx,c,'負載'):k==='plcx'?SY.plcx(xx,c,'X0'):SY[k](xx,c);
    if(['no','nc','brk','btn','trip','sens'].includes(k))h+=SY.line(xx,c-4,c-3)+SY.line(xx,c+3,c+4);
    h+=`<text class="s-sub" x="${xx-7}" y="${y+23}">${t}</text>`;});
  h+=`<text class="s-sub" x="${x}" y="${y+36}">接點旁的大字是器具編號（輔助接點、裝在操作部上的接點塊標示帶動它的器具）；左邊小字是端子號；線上的小字是線號。</text>
    <text class="s-sub" x="${x}" y="${y+41}">線圈下方列出它的接點在第幾頁第幾欄（∟ 常開、⊥ 常閉）；頁面上下的 1～10 是欄號、左右的 A～F 是列號。＊ 表示同一個接點因為迴路無法化簡而出現在多處。</text>`;
  return h;}
function schemPrintHtml(){const B=schemBuild();return B.pages.map(pg=>`<section class="pg sch"><div class="sch-pg">${pg.svg}${pg.html?`<div class="sch-body">${pg.html}</div>`:''}</div></section>`).join('');}

/* ---------- 11. 驗證：圖反推回連接，要和配線一致 ---------- */
function schemVerify(B){
  B=B||schemBuild();const M=B.M,bad=[];let checked=0;
  // 控制回路：每個葉子從樹的位置推出兩端節點，必須等於元素真正的兩端
  const groups=new Map();M.srcs.forEach(s=>{const p=M.f(s.p),n=M.f(s.nn);if(!M.wiredNode.has(p))return;const k=p+'|'+n;if(!groups.has(k))groups.set(k,{p,n,srcs:[]});groups.get(k).srcs.push(s);});
  groups.forEach(G=>{const tree=scSecTree(M,G);if(!tree)return;
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

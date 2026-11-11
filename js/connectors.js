"use strict";
/* ---------- 連接器：整個連接器（牛角、MIL、D-sub、20 針）在圖上只算一個接點 ----------
   器具資料載入後，把連接器的針腳收成一個接點（CN1、CN2…），針腳變成成組接點的子導線：
   - 接頭對接頭（排線）：一條線接兩個連接器，模擬照針腳名稱一一對接
   - 接頭對散線：線接在單一支針腳上，接點寫成 'CN1.B20'（圖上從連接器那一點出去）
   來源：
   - 三菱 Q 模組 t.conn（針腳 → 訊號）、柏叡／A6TB 轉接座 t.adpc（針腳 → 牛角針腳接點）
   - 台達 AH／AS 的 t.cnDef（建資料時標好每個連接器有哪些接點）
   - t.cnAuto 或三菱 FX 連接器型（說明寫「連接器」「D-sub」、不是彈簧夾端子）：依位置自動分群
   每個連接器記在 t.cns[cid] = {type, keys:[針腳], sig:{針腳:訊號／原接點名}, desc, box:[x0,y0,x1,y1]}；
   舊檔接在原本針腳接點的線，讀檔時照 t.pinMap 換成 'CN1.針腳' */
(function(){
const FXSER=new Set(['FX5UC','FX5 增設','FX2N 擴展模塊','FX 特殊功能','FX3U 特殊轉接器','FX3U 功能擴展板','FX5 擴充板']);
const near=(a,b)=>Math.hypot(a[1]-b[1],a[2]-b[2])<3.05;
// 依位置分群：相鄰 3 mm 內連成一群；同一欄（x 範圍相疊）、上下只隔幾格空腳的群合併
function clusters(T){
  const par=T.map((_,i)=>i),f=i=>par[i]===i?i:(par[i]=f(par[i])),u=(i,j)=>{par[f(i)]=f(j);};
  T.forEach((a,i)=>T.forEach((b,j)=>{if(j>i&&near(a,b))u(i,j);}));
  let g=Object.values(T.reduce((m,t,i)=>{(m[f(i)]=m[f(i)]||[]).push(t);return m;},{}));
  const box=c=>[Math.min(...c.map(t=>t[1])),Math.min(...c.map(t=>t[2])),Math.max(...c.map(t=>t[1])),Math.max(...c.map(t=>t[2]))];
  for(let ch=true;ch;){ch=false;
    for(let i=0;i<g.length&&!ch;i++)for(let j=i+1;j<g.length&&!ch;j++){const A=box(g[i]),B=box(g[j]);
      const xo=A[0]<=B[2]+3.1&&B[0]<=A[2]+3.1,yg=Math.max(A[1],B[1])-Math.min(A[3],B[3]);
      if(xo&&yg<=8){g[i]=g[i].concat(g[j]);g.splice(j,1);ch=true;}}}
  return g.filter(c=>c.length>=4).sort((a,b)=>box(a)[1]-box(b)[1]||box(a)[0]-box(b)[0]);
}
const MAP=['a','b','p','n','out','to','com'],LIST=['pts','in','ins','auto','ph'];
function rewrite(e,m){const r={...e},R=v=>m[v]||v;MAP.forEach(k=>{if(r[k]!=null)r[k]=R(r[k]);});LIST.forEach(k=>{if(Array.isArray(r[k]))r[k]=r[k].map(R);});
  if(Array.isArray(r.pairs))r.pairs=r.pairs.map(([y,c])=>[R(y),R(c)]);return r;}
// defs：[{cid,type,pins:[[針腳, 原接點ID]]}]
function apply(id,defs){
  const t=TPL[id];if(!defs.length)return;
  const pinMap={},cns={},byId=new Map(t.t.map(x=>[x[0],x]));
  // 連接器名稱和原本的接點撞名（例如 AH10PM 本來就有通訊埠 CN1）：往後找沒用過的編號
  const pinIds=new Set(defs.flatMap(d=>d.pins.map(p=>p[1]))),taken=new Set(t.t.map(x=>x[0]).filter(x=>!pinIds.has(x)));
  defs.forEach(d=>{if(taken.has(d.cid)){let k=1;while(taken.has('CN'+k)||defs.some(o=>o!==d&&o.cid==='CN'+k))k++;d.cid='CN'+k;}taken.add(d.cid);});
  defs.forEach(({cid,type,pins})=>{const P=pins.filter(([,tid])=>byId.has(tid));if(!P.length)return;
    const xs=P.map(([,tid])=>byId.get(tid)),box=[Math.min(...xs.map(x=>x[1])),Math.min(...xs.map(x=>x[2])),Math.max(...xs.map(x=>x[1])),Math.max(...xs.map(x=>x[2]))];
    const sides={};xs.forEach(x=>{sides[x[3]]=(sides[x[3]]||0)+1;});
    cns[cid]={type,keys:P.map(([k])=>k),sig:Object.fromEntries(P.map(([k,tid])=>[k,tid])),desc:Object.fromEntries(P.map(([k,tid])=>[k,(byId.get(tid)[4]||'')])),box,
      side:Object.entries(sides).sort((a,b)=>b[1]-a[1])[0][0]};
    P.forEach(([k,tid])=>{pinMap[tid]=cid+'.'+k;});});
  if(!Object.keys(cns).length)return;
  // 接點：拿掉針腳，加上連接器本身
  t.t=t.t.filter(x=>!pinMap[x[0]]).concat(Object.entries(cns).map(([cid,c])=>[cid,+((c.box[0]+c.box[2])/2).toFixed(2),+((c.box[1]+c.box[3])/2).toFixed(2),c.side,`連接器 ${cid}（${c.type}${/針|P$/.test(c.type)?'':' 針'}，${c.keys.length} 支針腳）`]));
  // 動作資料：針腳換成成組接點的子導線
  const base=Array.isArray(t.sim)?t.sim:(SIMDEF[id]?SIMDEF[id]():[]);
  const sim=[...Object.entries(cns).map(([cid,c])=>({k:'grp',t:cid,sub:c.keys})),...base.map(e=>rewrite(e,pinMap))];
  // 同電位組有針腳的：改成模擬的直通（子導線不能用同電位組）；沒有針腳的照舊
  const keep=[];(t.links||[]).forEach(g=>{if(!g.some(x=>pinMap[x])){keep.push(g);return;}const m=g.map(x=>pinMap[x]||x);for(let i=1;i<m.length;i++)sim.push({k:'pass',a:m[0],b:m[i]});});
  t.links=keep.length?keep:null;t.sim=sim;t.cns=cns;t.pinMap=pinMap;delete t.terms;
}
Object.keys(TPL).forEach(id=>{const t=TPL[id];if(t.gen||!t.t)return;
  if(t.conn){apply(id,Object.entries(t.conn).map(([cn,c])=>({cid:'CN'+cn,type:c.type,pins:Object.entries(c.pins)})));Object.entries(t.conn).forEach(([cn,c])=>{c.cid='CN'+cn;});return;}
  if(t.adpc){apply(id,Object.entries(t.adpc).map(([cn,c])=>({cid:'CN'+cn,type:c.type,pins:Object.entries(c.pins)})));Object.entries(t.adpc).forEach(([cn,c])=>{c.cid='CN'+cn;});return;}
  if(t.cnDef){apply(id,t.cnDef.map(c=>({cid:c.cid,type:c.type,pins:c.ids.map(x=>[x,x])})));return;}
  const fx=FXSER.has(t.ser)&&/連接器|D-sub/.test(t.note||'')&&!/彈簧夾/.test(t.note||'');
  if(t.cnAuto||fx){const g=clusters(t.t);apply(id,g.map((c,i)=>({cid:g.length>1?'CN'+(i+1):'CN1',type:/D-sub 9/.test(t.note||'')?'D-sub 9':String(c.length),pins:c.map(x=>[x[0],x[0]])})));}
});
})();

/* ---------- 連接器的查詢（畫面、模擬、讀檔共用） ---------- */
// 'CN1.B20' → {cid:'CN1', key:'B20', c}；不是連接器的子導線就回 null
function cnSub(d,t){if(!d||typeof t!=='string')return null;const i=t.indexOf('.');if(i<1)return null;const cs=tplOf(d).cns;if(!cs)return null;
  const cid=t.slice(0,i),c=cs[cid],key=t.slice(i+1);return c&&c.keys.includes(key)?{cid,key,c}:null;}
// 整個連接器（'CN1'）
const cnWhole=(d,t)=>{const cs=d&&tplOf(d).cns;return cs&&cs[t]?cs[t]:null;};
// 針腳對應的訊號（三菱 Q：B20 → X00；其他針腳名稱就是訊號）；不是針腳就原樣
const cnSig=(d,t)=>{const s=cnSub(d,t);return s?s.c.sig[s.key]:t;};
// 接線有沒有接到這個點（直接接在針腳上，或整個連接器接排線）
const wiredAt=(w,id,t)=>{const m=e=>e.d===id&&(e.t===t||(t.indexOf('.')>0&&e.t===t.slice(0,t.indexOf('.'))));return m(w.a)||m(w.b);};

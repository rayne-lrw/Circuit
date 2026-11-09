"use strict";
/* ---------- 電纜：一條電纜有好幾芯，每一芯就是一條導線（w.cab 指到電纜，w.core 是芯線名稱） ----------
   芯線的 a 端是電纜的 A 端，b 端是 B 端；外部電纜的 B 端在現場。
   剝線點：剝掉外皮、芯線分開走的位置。兩端各一個，預設自動放在最近的線槽裡，可以拖曳（存在 c.bo.a / c.bo.b）。
   電纜外皮從 A 端剝線點走到 B 端剝線點（外部電纜經過出線口），芯線只畫剝線點到接點那一段。 */
const AWG={24:.2,22:.3,20:.5,18:.75,16:1.25,14:2};
const CORE_RE=/黃綠|棕|藍|黑|紅|白|灰|綠/g, CORE_KEY={棕:'brown',藍:'blue',黑:'black',紅:'red',白:'white',灰:'gray',綠:'green',黃綠:'ground'};
// 電料清單裡的電纜；另外加上這次開啟頁面時臨時新增的規格，和專案裡已經用到的規格
const cableInv=()=>INV.filter(r=>r[0].includes('細纜')||/^伺服(動力|編碼|煞車)線/.test(r[0])).map(r=>`${r[0]} ${r[1]}`);
const tempSpecs=[];
function cableSpecs(cur){
  const s=[...cableInv()];
  [...tempSpecs,...((typeof S!=='undefined'&&S&&S.cables)||[]).map(c=>c.spec),cur].forEach(x=>{if(x&&!s.includes(x))s.push(x);});
  return s;
}
function specGauge(spec){
  const s=String(spec||''),mm=s.match(/(\d+(?:\.\d+)?)\s*mm²/),aw=s.match(/(\d+)\s*AWG/i);
  return mm?Number(mm[1]):aw?(AWG[aw[1]]||.5):.75;
}
// 從規格文字解析芯數、線徑與芯線顏色。看不懂的規格回傳空陣列，由使用者自己加芯線
function specCores(spec){
  const s=String(spec||''),m=s.match(/(\d+)\s*C(?![a-z])/i)||s.match(/(\d+)\s*芯/);
  if(!m) return [];
  const n=Math.max(1,Math.min(60,Number(m[1]))),g=specGauge(s);
  const tail=s.slice(m.index+m[0].length),cols=tail.match(CORE_RE)||[];
  let cores;
  if(/^伺服動力線/.test(s)&&n===4) cores=[['U','black'],['V','black'],['W','black'],['E','ground']];
  else if(tail.includes('號碼')){const pe=cols.includes('黃綠');cores=[...Array(n)].map((_,i)=>pe&&i===n-1?['E','ground']:[String(i+1),'black']);}
  else if(cols.length===n){const seen={};cores=cols.map(c=>{seen[c]=(seen[c]||0)+1;return [cols.filter(x=>x===c).length>1?c+seen[c]:c,CORE_KEY[c]];});}
  else cores=[...Array(n)].map((_,i)=>[String(i+1),'black']);
  if(s.includes('隔離')) cores.push(['SH','gray']); // 隔離網（接地用）
  return cores.map(([k,c])=>({n:k,c,g}));
}
const cabOf=id=>(S.cables||[]).find(c=>c.id===id);
const coresOf=c=>S.wires.filter(w=>w.cab===c.id);
const coreDef=(c,n)=>c.cores.find(k=>k.n===n);
function nextCableNo(){const u=new Set((S.cables||[]).map(c=>c.no));let i=1;while(u.has('C'+String(i).padStart(2,'0')))i++;return 'C'+String(i).padStart(2,'0');}
const newCabId=()=>'c'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
function newCable(no,spec){
  const c={id:newCabId(),no:(no||'').trim()||nextCableNo(),spec:spec||'',cores:specCores(spec),bo:{},fieldLen:0};
  S.cables.push(c);return c;
}
const freeCore=c=>{const u=new Set(coresOf(c).map(w=>w.core));return c.cores.find(k=>!u.has(k.n));};
// 外徑估算：芯線束起來再加外皮，用來算線槽占用率與畫面粗細
const cabOD=c=>{const n=Math.max(1,c.cores.length),g=(c.cores[0]&&c.cores[0].g)||.75;return Math.max(4,1.2*Math.sqrt(n)*odOf(g)+1.5);};
const cabStroke=c=>{const n=Math.max(1,c.cores.length),g=(c.cores[0]&&c.cores[0].g)||.75;return Math.min(5,.9*Math.sqrt(n)*gw(g)+.8);};
// 把一條線編進電纜：用那一芯的顏色與線徑；現場端放在 b 端；已經有芯線時，靠同一側器具的那端當 a 端
function attachCore(w,c,name){
  let k=name?coreDef(c,name):null;
  const used=new Set(coresOf(c).filter(x=>x!==w).map(x=>x.core));
  if(k&&used.has(k.n)&&w.core!==k.n) k=null;
  if(!k&&name&&!coreDef(c,name)){k={n:String(name).slice(0,10),c:w.color,g:w.gauge};c.cores.push(k);}
  if(!k) k=c.cores.find(x=>!used.has(x.n));
  if(!k){k={n:String(c.cores.length+1),c:w.color,g:w.gauge};c.cores.push(k);}
  w.cab=c.id;w.core=k.n;paintCore(w,k);
  w.wps=[];delete w.direct;delete w.gland;
  const af=devOf(w.a.d).sheet==='field',bf=devOf(w.b.d).sheet==='field';
  let flip=af&&!bf;
  if(!af&&!bf){
    const others=coresOf(c).filter(x=>x!==w),E=c.ends||{},A=new Set([...others.map(x=>x.a.d),...(E.a||[])]),B=new Set([...others.map(x=>x.b.d),...(E.b||[])]);
    flip=(B.has(w.a.d)||A.has(w.b.d))&&!(A.has(w.a.d)||B.has(w.b.d));
  }
  if(flip){const t=w.a;w.a=w.b;w.b=t;}
  return k;
}
// 芯線顏色可能是臨時新增的顏色：色碼存在芯線定義上，重新整理後也不會變
function paintCore(w,k){w.gauge=k.g;applyColor(w,k.c);if(k.hex){w.hex=k.hex;w.cname=k.cn||'自訂';}}
function setCoreColor(k,key){k.c=key;const t=tempColors[key];if(t){k.hex=t.c;k.cn=t.n;}else{delete k.hex;delete k.cn;}}
const coreColor=k=>k.hex?{n:k.cn||'自訂',c:k.hex,k:casing(k.hex)}:(COLORS[k.c]||COLORS.black);
// 外皮顏色：c.color 是顏色鍵，臨時顏色的色碼存在 c.hex，重新整理後也不會變
const cabColor=c=>c.hex?{n:c.cname||'自訂',c:c.hex,k:casing(c.hex)}:c.color?keyColor(c.color):null;
function setCabColor(c,key){if(!key){delete c.color;delete c.hex;delete c.cname;return;}c.color=key;const t=tempColors[key];if(t){c.hex=t.c;c.cname=t.n;}else{delete c.hex;delete c.cname;}}
function detachCore(w){delete w.cab;delete w.core;delete w.ext;}
// 存檔時外線表用的欄位跟著電纜同步
function syncCables(){
  if(!Array.isArray(S.cables)) S.cables=[];
  // 電纜兩端器具：刪掉的器具拿掉
  S.cables.forEach(c=>{if(!c.ends)return;['a','b'].forEach(k=>{if(c.ends[k])c.ends[k]=c.ends[k].filter(id=>devOf(id));});});
  S.wires.forEach(w=>{
    if(!w.cab) return;
    const c=cabOf(w.cab);if(!c){detachCore(w);return;}
    // 外部電纜的現場端一律放在 b 端（舊檔的外線可能是從現場畫進箱內）
    const A=devOf(w.a.d),B=devOf(w.b.d);if(A&&B&&A.sheet==='field'&&B.sheet!=='field'){const t=w.a;w.a=w.b;w.b=t;}
    if(wireKind(w)==='ext') w.ext={cable:c.no,core:w.core,spec:c.spec};else delete w.ext;
  });
}
// 舊檔：外線上有電纜編號的，依編號組成電纜
function migrateCables(st){
  st.wires.forEach(w=>{
    if(w.cab||!w.ext||!w.ext.cable) return;
    let c=st.cables.find(x=>x.no===w.ext.cable);
    if(!c){c={id:'c'+(st.cables.length+1)+'_'+Math.random().toString(36).slice(2,6),no:w.ext.cable,spec:w.ext.spec||'',cores:specCores(w.ext.spec),bo:{},fieldLen:0};st.cables.push(c);}
    if(!c.spec&&w.ext.spec){c.spec=w.ext.spec;}
    if(!c.gland&&w.gland) c.gland=w.gland; // 舊檔把出線口記在每一芯上
    const used=new Set(st.wires.filter(x=>x.cab===c.id).map(x=>x.core));
    let k=w.ext.core&&c.cores.find(x=>x.n===w.ext.core&&!used.has(x.n));
    // 舊檔的芯線名稱和規格對不上（例如 R、S、T）：把規格裡下一個空的芯改成那個名稱
    if(!k&&w.ext.core&&!c.cores.some(x=>x.n===w.ext.core)){const tk=st.wires.filter(x=>x.ext&&x.ext.cable===c.no&&x!==w).map(x=>x.ext.core);k=c.cores.find(x=>!used.has(x.n)&&!tk.includes(x.n));if(k)k.n=w.ext.core;else{k={n:w.ext.core,c:w.color,g:w.gauge};c.cores.push(k);}}
    if(!k) k=c.cores.find(x=>!used.has(x.n));
    if(!k){k={n:String(c.cores.length+1),c:w.color,g:w.gauge};c.cores.push(k);}
    w.cab=c.id;w.core=k.n;
  });
}
// 剝線點自動位置：這一側芯線出線點的中心，投影到最近的線槽中心線；沒有線槽（現場）就往出線方向推一點
function autoBO(ends,sheet){
  if(!ends.length) return null;
  const ps=ends.map(e=>stubOf(e)||e),cx=ps.reduce((s,p)=>s+p.x,0)/ps.length,cy=ps.reduce((s,p)=>s+p.y,0)/ps.length;
  const ds=S.ducts.filter(d=>d.sheet===sheet);
  if(!ds.length||sheet==='field'){
    const cnt={};ends.forEach(e=>{if(e.side)cnt[e.side]=(cnt[e.side]||0)+1;});
    const side=Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a])[0]||'bottom',v={top:[0,-1],bottom:[0,1],left:[-1,0],right:[1,0]}[side];
    // 記下剝線點是靠哪台器具、在哪一側：外皮從另一側過來時要繞過器具，不能直接穿過去
    const dc={};ends.forEach(e=>{if(e.dev)dc[e.dev]=(dc[e.dev]||0)+1;});const dev=Object.keys(dc).sort((a,b)=>dc[b]-dc[a])[0]||null;
    return {x:cx+v[0]*14,y:cy+v[1]*14,sheet,side:cnt[side]?side:null,dev};
  }
  const dist=d=>{const dx=Math.max(d.x-cx,0,cx-d.x-d.w),dy=Math.max(d.y-cy,0,cy-d.y-d.h);return Math.hypot(dx,dy);};
  const d=ds.reduce((b,x)=>dist(x)<dist(b)?x:b),cl=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  return axis(d)==='h'?{x:cl(cx,d.x+4,d.x+d.w-4),y:center(d),sheet}:{x:center(d),y:cl(cy,d.y+4,d.y+d.h-4),sheet};
}

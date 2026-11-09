"use strict";
/* ---------- 電纜：一條電纜有好幾芯，每一芯就是一條導線（w.cab 指到電纜，w.core 是芯線名稱） ----------
   芯線的 a 端是電纜的 A 端，b 端是 B 端；外部電纜的 B 端在現場。
   剝線點：剝掉外皮、芯線分開走的位置。兩端各一個，預設自動放在最近的線槽裡，可以拖曳（存在 c.bo.a / c.bo.b）。
   電纜外皮從 A 端剝線點走到 B 端剝線點（外部電纜經過出線口），芯線只畫剝線點到接點那一段。 */
/* 電纜規格：不從文字解析。
   內建規格（電料清單裡的電纜）照下表固定芯線：[線徑 mm², "芯線名稱:顏色 …"]；
   自訂規格由使用者在「自訂規格」視窗逐芯填好，存在專案裡（S.cableSpecs＝[{name,cores:[{n,c,g,hex?,cn?}],color?}]） */
const SPEC_DEF={
  "CSA細纜 0.5mm²*2C 棕藍":[0.5,"棕:brown 藍:blue"],
  "CSA細纜 0.5mm²*3C 棕藍黑":[0.5,"棕:brown 藍:blue 黑:black"],
  "CSA細纜 0.5mm²*10C 耐屈尺防油超軟-號碼":[0.5,"1:black 2:black 3:black 4:black 5:black 6:black 7:black 8:black 9:black 10:black"],
  "CSA細纜 0.5mm²*16C 號碼":[0.5,"1:black 2:black 3:black 4:black 5:black 6:black 7:black 8:black 9:black 10:black 11:black 12:black 13:black 14:black 15:black 16:black"],
  "CSA細纜 0.75mm²*2C 棕藍":[0.75,"棕:brown 藍:blue"],
  "CSA細纜 0.75mm²*3C 棕藍/黃綠":[0.75,"棕:brown 藍:blue 黃綠:ground"],
  "CSA細纜 0.75mm²*3C 黑白/黃綠":[0.75,"黑:black 白:white 黃綠:ground"],
  "CSA細纜 0.75mm²*3C 耐屈尺防油超軟-棕藍/黃綠":[0.75,"棕:brown 藍:blue 黃綠:ground"],
  "CSA細纜 0.3mm²*4C 耐繞曲隔離電纜":[0.3,"1:black 2:black 3:black 4:black SH:gray"],
  "CSA細纜 0.75mm²*6C 號碼":[0.75,"1:black 2:black 3:black 4:black 5:black 6:black"],
  "CSA細纜 1.25mm²*2C 棕藍":[1.25,"棕:brown 藍:blue"],
  "CSA細纜 8mm²*4C 號碼/黃綠":[8,"1:black 2:black 3:black E:ground"],
  "CSA細纜 0.75mm²*2C 黑白":[0.75,"黑:black 白:white"],
  "伺服動力線 J4 5.5mm²*4C":[5.5,"U:black V:black W:black E:ground"],
  "伺服動力線 J4 耐繞曲2mm²*4C":[2,"U:black V:black W:black E:ground"],
  "伺服動力線 JE 0.75mm²*4C":[0.75,"U:black V:black W:black E:ground"],
  "伺服編碼線 J4 20AWG*6C":[0.5,"1:black 2:black 3:black 4:black 5:black 6:black"],
  "伺服編碼線 J4 耐繞曲20AWG*6C":[0.5,"1:black 2:black 3:black 4:black 5:black 6:black"],
  "伺服編碼線 JE 20AWG*6C":[0.5,"1:black 2:black 3:black 4:black 5:black 6:black"],
  "伺服煞車線 J4 1.25mm²*2C":[1.25,"1:black 2:black"],
  "伺服煞車線 JE 0.5mm²*2C":[0.5,"1:black 2:black"]
};
const cableInv=()=>INV.filter(r=>r[0].includes('細纜')||/^伺服(動力|編碼|煞車)線/.test(r[0])).map(r=>`${r[0]} ${r[1]}`);
const isBuiltinSpec=name=>!!SPEC_DEF[name];
const customSpec=(name,st)=>((st||(typeof S!=='undefined'&&S)||{}).cableSpecs||[]).find(x=>x.name===name)||null;
// 規格的芯線定義（複本）；不認得的規格回傳空陣列（舊檔的電纜芯線本來就存在電纜上）
function specDef(name,st){
  const b=SPEC_DEF[name];if(b)return b[1].split(' ').map(t=>{const i=t.lastIndexOf(':');return {n:t.slice(0,i),c:t.slice(i+1),g:b[0]};});
  const c=customSpec(name,st);return c?c.cores.map(k=>({...k})):[];
}
// 規格下拉的選項：電料清單、這個專案的自訂規格、其他（舊檔裡用過但沒有定義的）
function cableSpecs(cur){
  const inv=cableInv(),cus=((typeof S!=='undefined'&&S&&S.cableSpecs)||[]).map(x=>x.name),other=[];
  [...((typeof S!=='undefined'&&S&&S.cables)||[]).map(c=>c.spec),cur].forEach(x=>{if(x&&!inv.includes(x)&&!cus.includes(x)&&!other.includes(x))other.push(x);});
  return {inv,cus,other};
}
const cabOf=id=>(S.cables||[]).find(c=>c.id===id);
const coresOf=c=>S.wires.filter(w=>w.cab===c.id);
const coreDef=(c,n)=>c.cores.find(k=>k.n===n);
function nextCableNo(){const u=new Set((S.cables||[]).map(c=>c.no));let i=1;while(u.has('C'+String(i).padStart(2,'0')))i++;return 'C'+String(i).padStart(2,'0');}
const newCabId=()=>'c'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
function newCable(no,spec){
  const c={id:newCabId(),no:(no||'').trim()||nextCableNo(),spec:spec||'',cores:specDef(spec),bo:{},fieldLen:0};
  const cs=customSpec(spec);if(cs&&cs.color)setCabColor(c,cs.color); // 自訂規格有指定外皮顏色
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
  // 拉線時放的中繼點：芯線跟著電纜外皮走，所以中繼點改放到外皮上（外皮還沒有中繼點時）
  if(w.wps&&w.wps.length&&!(c.wps&&c.wps.length))c.wps=w.wps.map(p=>({x:p.x,y:p.y}));
  w.wps=[];delete w.direct;delete w.gland;
  const af=devOf(w.a.d).sheet==='field',bf=devOf(w.b.d).sheet==='field';
  let flip=af&&!bf;
  if(!af&&!bf){
    const others=coresOf(c).filter(x=>x!==w),E=c.ends||{},A=new Set([...others.map(x=>x.a.d),...(E.a||[])]),B=new Set([...others.map(x=>x.b.d),...(E.b||[])]);
    flip=(B.has(w.a.d)||A.has(w.b.d))&&!(A.has(w.a.d)||B.has(w.b.d));
  }
  if(flip){const t=w.a;w.a=w.b;w.b=t;}
  plugFix(w,c);
  return k;
}
/* 接頭：電纜某一端是接頭（c.plug.a / c.plug.b＝{d,t}，例如伺服編碼線插在 CN2），那一端不剝線，外皮直接進接頭；
   芯線的那一端一律是接頭那個接點。兩端都是接頭時不用接芯線 */
const samePt=(e,p)=>!!(p&&e&&e.d===p.d&&e.t===p.t);
const plugOf=(c,k)=>c&&c.plug&&c.plug[k]||null;
const bothPlug=c=>!!(plugOf(c,'a')&&plugOf(c,'b'));
function plugFix(w,c){
  const A=plugOf(c,'a'),B=plugOf(c,'b');
  if((A&&samePt(w.b,A)&&!samePt(w.a,A))||(B&&samePt(w.a,B)&&!samePt(w.b,B))){const t=w.a;w.a=w.b;w.b=t;}
  if(A&&!samePt(w.a,A))w.a={d:A.d,t:A.t};
  if(B&&!samePt(w.b,B))w.b={d:B.d,t:B.t};
}
// 電纜兩端對調（芯線兩端、剝線點、接頭、兩端器具一起換）
function swapCableSides(c){
  coresOf(c).forEach(w=>{const t=w.a;w.a=w.b;w.b=t;});
  const sw=o=>{if(!o)return o;const r={};if(o.b)r.a=o.b;if(o.a)r.b=o.a;return r;};
  c.bo=sw(c.bo)||{};if(c.plug)c.plug=sw(c.plug);if(c.ends)c.ends=sw(c.ends);
}
// 外部電纜：有芯線到現場，或接頭裝在現場／箱外的器具
const cabExt=c=>coresOf(c).some(w=>wireKind(w)==='ext')||['a','b'].some(k=>{const p=plugOf(c,k),d=p&&devOf(p.d);return !!(d&&(d.sheet==='field'||(typeof outBox==='function'&&outBox({dev:d.id,sheet:d.sheet}))));});
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
  // 接頭：器具或接點不見了就改回散線
  S.cables.forEach(c=>{if(!c.plug)return;['a','b'].forEach(k=>{const p=c.plug[k],d=p&&devOf(p.d);if(p&&!(d&&termOf(d,p.t)))delete c.plug[k];});if(!c.plug.a&&!c.plug.b)delete c.plug;});
  // 電纜兩端器具：刪掉的器具拿掉
  S.cables.forEach(c=>{if(!c.ends)return;['a','b'].forEach(k=>{if(c.ends[k])c.ends[k]=c.ends[k].filter(id=>devOf(id));});});
  S.wires.forEach(w=>{
    if(!w.cab) return;
    const c=cabOf(w.cab);if(!c){detachCore(w);return;}
    // 外部電纜的現場端一律放在 b 端（舊檔的外線可能是從現場畫進箱內）
    const A=devOf(w.a.d),B=devOf(w.b.d);if(A&&B&&A.sheet==='field'&&B.sheet!=='field'){const t=w.a;w.a=w.b;w.b=t;}
    if(c.plug)plugFix(w,c);
    if(wireKind(w)==='ext') w.ext={cable:c.no,core:w.core,spec:c.spec};else delete w.ext;
  });
}
// 舊檔：外線上有電纜編號的，依編號組成電纜
function migrateCables(st){
  st.wires.forEach(w=>{
    if(w.cab||!w.ext||!w.ext.cable) return;
    let c=st.cables.find(x=>x.no===w.ext.cable);
    if(!c){c={id:'c'+(st.cables.length+1)+'_'+Math.random().toString(36).slice(2,6),no:w.ext.cable,spec:w.ext.spec||'',cores:specDef(w.ext.spec,st),bo:{},fieldLen:0};st.cables.push(c);}
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

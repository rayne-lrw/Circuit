"use strict";
/* ---------- 狀態 ---------- */
const KEY='wiring-sim-draft-v2',OLDKEY='wiring-sim-draft-v1';
let S=null;
try{const raw=localStorage.getItem(KEY); if(raw){const n=normalize(JSON.parse(raw));if(n)S=n.state;}}catch(e){}
if(!S) S=normalize(sampleState()).state;
const hist={u:[],r:[]};
function commit(){hist.u.push(snapshotPrev);if(hist.u.length>100)hist.u.shift();hist.r=[];snapshotPrev=JSON.stringify(S);save();syncUndo();}
let snapshotPrev=JSON.stringify(S);
function save(){try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}}
function restore(j){S=JSON.parse(j);snapshotPrev=j;sel=null;selCab=null;cabPick=null;coreEdit=null;picked=null;multi=[];recompute();renderPalette();save();syncUndo();if(!view.manual)fit();}
const $=id=>document.getElementById(id);
function syncUndo(){const v=mode==='view';$('undo').disabled=v||!hist.u.length;$('redo').disabled=v||!hist.r.length;}

let mode='wire', sel=null, picked=null, bundle=false, showNo=false, tab='all';
let view={k:1,x:0,y:0,manual:false};
/* 說明：? 按鈕展開或收合旁邊的說明文字，展開狀態在這次開啟的頁面內保留 */
const helpOpen=new Set();
const hq=k=>`<button class="hq" data-help="${k}" aria-expanded="${helpOpen.has(k)}" aria-label="說明">?</button>`;
const hn=(k,t)=>`<p class="note hn" data-helpfor="${k}"${helpOpen.has(k)?'':' hidden'}>${t}</p>`;
const LAB_AT=[['start','起點端'],['end','終點端'],['mid','中間'],['both','兩端都標']]; // 線號標示位置
let dragPrev=null, hoverCab=null; // 拖曳中繼點時的單線預覽 {w,pts}
let cabPickCore=null; // 在圖上接芯線時，目前要接的那一芯
let selCab=null, cabPick=null, coreEdit=null; // 選取的電纜、「接下一芯」中的電纜、芯線表正在編輯的那一芯
let draft=null, railHit=null, bundleSel=null, multi=[], renameOffer=null, swapOffer=null;   // {a:{d,t},wps:[],end?:{d,t},pop:false,ext:{}}
let snap=null, hoverW=null, cursor={x:0,y:0,sx:0,sy:0}, listHover=null;
let last={gauge:1.25,color:'white',direct:false};
const filt={color:null,gauge:null,dev:'',kind:null};

const devOf=id=>S.devices.find(d=>d.id===id);
const ROTM=new WeakMap();
function rotated(b,r){
  r=((r||0)%360+360)%360;if(!r||!b) return b;
  let m=ROTM.get(b);if(!m){m={};ROTM.set(b,m);}
  if(!m[r]){
    const nx={top:'right',right:'bottom',bottom:'left',left:'top'};let w=b.w,h=b.h,ts=b.terms.map(t=>({...t}));
    for(let i=0;i<r/90;i++){const H=h;ts=ts.map(t=>({...t,x:H-t.y,y:t.x,side:nx[t.side]||t.side,...(t.ox!=null?{ox:-(t.oy||0),oy:t.ox}:{}),...(t.ls?{ls:nx[t.ls]}:{})}));[w,h]=[h,w];}
    m[r]={...b,w,h,terms:ts};
  }
  return m[r];
}
const tplOf=d=>rotated(resolveTpl(d.tpl,d.count),d.rot);
// 接點；連接器的單一針腳（'CN1.B20'）位置就是連接器那一點
const termOf=(d,t)=>{const T=tplOf(d).terms,x=T.find(x=>x.id===t);if(x||typeof cnSub!=='function')return x;const s=cnSub(d,t);if(!s)return undefined;const c=T.find(q=>q.id===s.cid);return c&&{...c,id:t,desc:s.c.desc[s.key]||''};};
const axis=d=>d.w>=d.h?'h':'v';
const center=d=>axis(d)==='h'?d.y+d.h/2:d.x+d.w/2;
const sgn=v=>v>0.01?1:v<-0.01?-1:0;
/* 展開圖座標：底板左上為原點；電控箱置中包住底板；面板內側攤在箱體右邊；現場區在下方 */
const GAP_D=120,GAP_F=90,FIELD_H=210;
const boxOrigin=()=>({x:(S.plate.w-S.box.w)/2,y:(S.plate.h-S.box.h)/2});
const doorO=()=>{const b=boxOrigin();return {x:b.x+S.box.w+GAP_D,y:b.y};};
const fieldO=()=>{const b=boxOrigin();return {x:b.x,y:b.y+S.box.h+GAP_F};};
function sheetRect(s){
  if(s==='door'){const o=doorO();return {x:o.x,y:o.y,w:S.door.w,h:S.door.h};}
  if(s==='field'){ // 所有現場區的外框
    const Z=S.fields||[];if(!Z.length){const o=fieldO(),d=doorO();return {x:o.x,y:o.y,w:d.x+S.door.w-o.x,h:FIELD_H};}
    const x0=Math.min(...Z.map(z=>z.x)),y0=Math.min(...Z.map(z=>z.y)),x1=Math.max(...Z.map(z=>z.x+z.w)),y1=Math.max(...Z.map(z=>z.y+z.h));
    return {x:x0,y:y0,w:x1-x0,h:y1-y0};
  }
  return {x:0,y:0,w:S.plate.w,h:S.plate.h};
}
const inR=(p,r)=>p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h;
/* 現場區可以有好幾個、可移動：S.fields=[{id,name,x,y,w,h}] */
const zoneAt=p=>(S.fields||[]).find(z=>inR(p,z))||null;
/* 現場器具、箱外線槽屬於哪個現場區記在 o.zone（存檔）：拖現場區只帶走屬於它的東西，框重疊、蓋到別區也不會搶走。
   歸屬只在這些時候改：單獨拖器具（或線槽）放進另一區、在現場區右側按「收進這一區」「歸到所在的現場區」。
   舊檔或新放的器具沒有記錄時，照所在位置（不在任何框裡就找最近的一區）補上 */
const objCenter=o=>{const t=o.tpl?tplOf(o):o;return {x:o.x+t.w/2,y:o.y+t.h/2};};
function zoneOf(d){const z=d.zone&&(S.fields||[]).find(x=>x.id===d.zone);return z||geoZone(d);}
function syncZones(){
  const has=id=>(S.fields||[]).some(z=>z.id===id);
  [...S.devices,...S.ducts].forEach(o=>{if(o.sheet!=='field'){delete o.zone;return;}if(!o.zone||!has(o.zone)){const z=geoZone(o);if(z)o.zone=z.id;}});
}
// 單獨拖放的器具或線槽：放下時在哪個框裡就歸那一區（不在任何框裡就維持原本的區）
// 放在兩個框重疊的地方：原本那一區也蓋得到就不換，否則歸最上面（後畫）的那一區
function zoneDrop(o){if(!o||o.sheet!=='field')return;const c=objCenter(o),zs=(S.fields||[]).filter(z=>inR(c,z));if(!zs.length||zs.some(z=>z.id===o.zone))return;o.zone=zs[zs.length-1].id;}
// 框裡但不屬於這區的；屬於這區但在框外的（器具和箱外線槽）
const zoneObjs=()=>[...S.devices,...S.ducts].filter(o=>o.sheet==='field');
// 線槽要整條在框裡才算（長線槽中心點剛好落在別的框裡，不要被收走）
const inZoneRect=(o,z)=>o.tpl?inR(objCenter(o),z):o.x>=z.x&&o.y>=z.y&&o.x+o.w<=z.x+z.w&&o.y+o.h<=z.y+z.h;
const zoneForeign=z=>zoneObjs().filter(o=>zoneOf(o)!==z&&inZoneRect(o,z));
const zoneAway=z=>zoneObjs().filter(o=>zoneOf(o)===z&&!inR(objCenter(o),z));
function geoZone(d){
  const c=objCenter(d),z=zoneAt(c);if(z) return z;
  let best=null,bd=Infinity;
  (S.fields||[]).forEach(z=>{const dx=Math.max(z.x-c.x,0,c.x-z.x-z.w),dy=Math.max(z.y-c.y,0,c.y-z.y-z.h),q=dx*dx+dy*dy;if(q<bd){bd=q;best=z;}});
  return best;
}
const devRef=d=>d.sheet==='field'?(zoneOf(d)||sheetRect('field')):sheetRect(d.sheet);
// 拖現場框時一起帶走的東西：框裡的現場器具、箱外線槽、線和電纜外皮的中繼點、電纜剝線點（都是有 x、y 的物件）
function zoneCarry(z){
  // 只帶走屬於這一區的東西：區內器具；整條都在框裡的箱外線槽；接到區內器具的線和電纜在框裡的中繼點、剝線點
  // （剛新增或拖過別區的框可能蓋到其他區的線，那些不能跟著走）
  const out=S.devices.filter(d=>inZone(z,d)),ids=new Set(out.map(d=>d.id)),mine=w=>ids.has(w.a.d)||ids.has(w.b.d);
  S.ducts.forEach(d=>{if(d.sheet==='field'&&zoneOf(d)===z)out.push(d);});
  S.wires.forEach(w=>{if(mine(w))(w.wps||[]).forEach(p=>{if(inR(p,z))out.push(p);});});
  (S.cables||[]).forEach(c=>{if(!S.wires.some(w=>w.cab===c.id&&mine(w)))return;(c.wps||[]).forEach(p=>{if(inR(p,z))out.push(p);});['a','b'].forEach(k=>{const p=c.bo&&c.bo[k];if(p&&inR(p,z))out.push(p);});});
  return out;
}
const inZone=(z,d)=>d.sheet==='field'&&zoneOf(d)===z;
/* 面板模式：door 門板（比箱體小會警告、做關門碰撞檢查）、console 獨立操作台（不檢查）、none 不使用 */
const useDoor=()=>S.doorMode!=='none';
const isDoorPanel=()=>!S.doorMode||S.doorMode==='door';
const doorTitle=()=>S.doorMode==='console'?'操作台':'面板內側（開門攤平）';
const doorShort=()=>S.doorMode==='console'?'操作台':'面板';
const sheetAt=p=>useDoor()&&inR(p,sheetRect('door'))?'door':zoneAt(p)?'field':'plate';
const boxBottom=()=>boxOrigin().y+S.box.h;
const wireKind=w=>{const a=devOf(w.a.d),b=devOf(w.b.d);if(!a||!b)return 'in';if(a.sheet==='field'||b.sheet==='field')return 'ext';if(a.sheet==='door'||b.sheet==='door')return 'door';return 'in';};
/* 端子台端子號：WAGO 2202 系列每片一個號碼存在 d.labels，只用來顯示；
   接點本身仍是 1A、1B…，所以改號碼不會影響已接好的線 */
const SLOT_RE=/^(\d+)([A-D])$/;
const hasSlots=t=>!!(t&&t.gen&&t.cntLabel==='片數');
// 接點顯示名稱：接點別名（使用者依公司習慣改的名稱，器具還是原本的）優先，端子台用片上標籤
function termLabel(d,t){if(d&&d.alias&&d.alias[t])return d.alias[t];
  // 連接器針腳：CN1-B20（三菱 Q 再附實際位址），針腳名稱就是訊號的直接換成實際位址
  if(typeof cnSub==='function'){const s=cnSub(d,t);if(s){const g=s.c.sig[s.key],a=(d.rack!=null&&typeof qName==='function'&&qName(d,g))||(d.on&&d.chain!=null&&typeof chainName==='function'&&chainName(d,g))||null;
    return g===s.key?`${s.cid}-${a||g}`:`${s.cid}-${s.key}${a||/^[XY]/.test(g)?`(${a||g})`:''}`;}}if(d&&d.rack!=null&&typeof qName==='function'){const q=qName(d,t);if(q)return q;}if(d&&d.on&&d.chain!=null&&typeof chainName==='function'){const q=chainName(d,t);if(q)return q;}if(!d||!d.labels)return t;const m=SLOT_RE.exec(t);return (m&&d.labels[m[1]-1])||t;}
/* 出線口：可裝在箱體四面。side=bottom/top 用 x 定位，left/right 用 y 定位 */
const GSIDE={bottom:'箱底',top:'箱頂',left:'左側',right:'右側'};
function glandPt(g){
  const o=boxOrigin(),B={x:o.x,y:o.y,w:S.box.w,h:S.box.h},s=g.side||'bottom';
  if(s==='top') return {x:g.x,y:B.y,side:s,nx:0,ny:-1};
  if(s==='left') return {x:B.x,y:g.y,side:s,nx:-1,ny:0};
  if(s==='right') return {x:B.x+B.w,y:g.y,side:s,nx:1,ny:0};
  return {x:g.x,y:B.y+B.h,side:'bottom',nx:0,ny:1};
}
// 把出線口移到點 p 最近的那一面，離角落至少 8 mm
function glandTo(g,p){
  const o=boxOrigin(),B={x:o.x,y:o.y,w:S.box.w,h:S.box.h},cl=(v,a,b)=>Math.max(a+8,Math.min(b-8,Math.round(v/5)*5));
  const d={bottom:Math.abs(p.y-B.y-B.h),top:Math.abs(p.y-B.y),left:Math.abs(p.x-B.x),right:Math.abs(p.x-B.x-B.w)};
  const s=Object.keys(d).reduce((a,b)=>d[b]<d[a]?b:a);
  g.side=s;
  if(s==='bottom'||s==='top'){g.x=cl(p.x,B.x,B.x+B.w);g.y=g.y??B.y+B.h/2;}else{g.y=cl(p.y,B.y,B.y+B.h);g.x=g.x??B.x+B.w/2;}
}
/* 正面附件（例如 LADN 輔助接點）：d.on 記住裝在哪個接觸器上，跟著接觸器移動 */
const riders=d=>S.devices.filter(x=>x.on===d.id);
// 附件種類：front 疊在接觸器正面中央（深度相加）；below 掛在伺服驅動器下方（深度不相加）
const attachOf=d=>tplOf(d).attach||null;
/* 線圈：接點說明有「線圈」的兩個接點；A1、14、8 是 +，A2、13、7 是 −（器具資料可以對調） */
const COIL_P=['A1','14','8'],COIL_M=['A2','13','7'];
function coilOf(d){
  if(!d)return null;const t=tplOf(d);if(t.sym)return null;const c=(t.terms||[]).filter(p=>/線圈/.test(p.desc||''));if(c.length!==2)return null;
  let p=c.find(x=>COIL_P.includes(x.id)),m=c.find(x=>COIL_M.includes(x.id));if(!p||!m){p=c[0];m=c[1];}
  return d.coilSwap?{p:m.id,m:p.id,ac:/AC\d/.test(t.n)}:{p:p.id,m:m.id,ac:/AC\d/.test(t.n)};
}
// 線圈二極體附件：裝在線圈上就自動接 K→+、A→−；拆下就移除自動接的線。每次重算時同步，拖曳、拆下、復原都一致
function syncCoilWires(){
  S.devices.forEach(r=>{
    if(!tplOf(r).coil) return;
    const h=r.on&&devOf(r.on),c=h&&coilOf(h),mine=S.wires.filter(w=>w.auto==='coil'&&(w.a.d===r.id||w.b.d===r.id));
    if(!c){if(mine.length)S.wires=S.wires.filter(w=>!mine.includes(w));return;}
    [['K',c.p],['A',c.m]].forEach(([dt,ht])=>{
      let w=mine.find(x=>x.a.d===r.id&&x.a.t===dt);
      if(w){w.b={d:h.id,t:ht};return;}
      const n=nextWireNo(),inh=inheritNo({d:h.id,t:ht},{d:h.id,t:ht}).no,no=inh||'W'+String(n).padStart(3,'0');
      if(!inh)S.nextNo=n+1;
      S.wires.push({id:'w'+n+'_'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),no,a:{d:r.id,t:dt},b:{d:h.id,t:ht},wps:[],gauge:.75,color:'black',direct:true,auto:'coil'});
    });
  });
  S.wires=S.wires.filter(w=>w.auto!=='coil'||(devOf(w.a.d)&&tplOf(devOf(w.a.d)).coil&&devOf(w.a.d).on===w.b.d));
}
/* ---------- 底座插槽（三菱 Q 系列）：基板 t.rack=[{k:'pwr'|'cpu'|'io',x,w}]，模組 t.rackKind 是能裝的槽種類，d.rack 記住裝在第幾槽 ---------- */
const RACK_KIND={pwr:'電源',spwr:'電源',rpwr:'電源',cpu:'CPU',io:'I/O'};
const rackN=t=>t.rackKind==='io'?Math.max(1,Math.round(t.w/27.4)):1;
// 基板上每一槽被哪一台模組佔用（寬的模組佔好幾槽）
function rackUse(h,except){const m=new Map();riders(h).forEach(r=>{if(r===except||r.rack==null)return;for(let i=0;i<rackN(tplOf(r));i++)m.set(r.rack+i,r);});return m;}
function rackFit(h,o,i){const R=tplOf(h).rack,ot=tplOf(o),n=rackN(ot),use=rackUse(h,o);if(!R||!ot.rackKind)return false;for(let k=0;k<n;k++){const s=R[i+k];if(!s||s.k!==ot.rackKind||use.has(i+k))return false;}return true;}
// 離指標最近、種類對、還空著的槽
function rackPick(h,o,cx){const R=tplOf(h).rack||[],w=tplOf(o).w;let best=null;R.forEach((s,i)=>{if(!rackFit(h,o,i))return;const dd=Math.abs(h.x+s.x+w/2-cx);if(!best||dd<best.d)best={i,d:dd};});return best?best.i:null;}
// 槽的顯示名稱：電源、CPU、I/O 槽從 0 開始編號
function rackName(t,i){const R=t.rack,s=R&&R[i];if(!s)return '';if(s.k!=='io'){const same=R.filter(x=>x.k===s.k);return RACK_KIND[s.k]+(same.length>1?same.indexOf(s)+1:'');}return String(R.slice(0,i).filter(x=>x.k==='io').length);}
// I/O 位址：主基板從 0 槽開始，每槽依裝的模組點數佔位址（空槽算 16 點）；擴展基板接在主基板後面，依擴展級數排列
const isMainBase=h=>!!(h&&tplOf(h).rack&&!tplOf(h).qext);
// 擴展基板接在哪個主基板：有指定就用指定的，沒有就用專案裡第一個主基板
function qMainOf(h){if(!tplOf(h).qext)return h;const m=h.main&&devOf(h.main);if(isMainBase(m))return m;return S.devices.find(isMainBase)||null;}
// 擴展級數：有指定就用，沒有就依擴展基板在專案裡的順序（1 起）
function qStage(h){if(h.stage)return h.stage;const m=qMainOf(h),ex=S.devices.filter(d=>tplOf(d).qext&&qMainOf(d)===m),used=new Set(ex.map(d=>d.stage).filter(Boolean));let k=0;for(const d of ex.filter(d=>!d.stage)){do k++;while(used.has(k));if(d===h)return Math.min(7,k);}return 1;}
// 一個基板的 I/O 槽總點數
function qBasePts(h){const R=tplOf(h).rack||[],use=rackUse(h);let a=0;R.forEach((s,i)=>{if(s.k!=='io')return;const m=use.get(i);if(!m)a+=16;else if(m.rack===i)a+=tplOf(m).qpts||16*rackN(tplOf(m));});return a;}
// 基板的起始位址：主基板 0；擴展基板 = 主基板＋級數較小的擴展基板
function qBaseStart(h){if(!tplOf(h).qext)return 0;const m=qMainOf(h);if(!m)return 0;const st=qStage(h);
  return qBasePts(m)+S.devices.filter(d=>d!==h&&tplOf(d).qext&&qMainOf(d)===m&&(qStage(d)<st||(qStage(d)===st&&S.devices.indexOf(d)<S.devices.indexOf(h)))).reduce((a,d)=>a+qBasePts(d),0);}
// 第 i 槽的起始位址
function qAddrAt(h,i){const R=tplOf(h).rack||[],use=rackUse(h);let a=qBaseStart(h);for(let j=0;j<i;j++){if(!R[j]||R[j].k!=='io')continue;const m=use.get(j);if(!m)a+=16;else if(m.rack===j)a+=tplOf(m).qpts||16*rackN(tplOf(m));}return a;}
function qAddr(d){
  if(!d||d.rack==null||!d.on)return null;const t=tplOf(d);if(t.rackKind!=='io')return null;const h=devOf(d.on);if(!h||!tplOf(h).rack)return null;
  return {start:qAddrAt(h,d.rack),n:t.qpts||16*rackN(t)};
}
const qHex=v=>v.toString(16).toUpperCase().padStart(2,'0');
/* 台達 AH 的位址規則（基板 t.addr==='ah'）：X、Y 各自連續，依槽位順序分給數位模組（模組 t.xw／t.yw 是佔用的字數），空槽與類比模組不佔
   模組接點用模組內的「字.位元」（X0.5、Y1.3），裝上後加上起始字號（X3.5…） */
const isAhBase=h=>!!(h&&tplOf(h).addr==='ah');
// 同一套系統（主基板＋接在它後面的擴展基板，依擴展級數）的基板順序
function qSystem(h){const m=qMainOf(h);if(!m)return [h];const ex=S.devices.filter(d=>tplOf(d).qext&&qMainOf(d)===m).sort((a,b)=>qStage(a)-qStage(b)||S.devices.indexOf(a)-S.devices.indexOf(b));return [m,...ex];}
function ahStart(d){
  const h=d.on&&devOf(d.on);if(!h)return null;let x=0,y=0;
  for(const b of qSystem(h)){const R=tplOf(b).rack||[],use=rackUse(b);for(let i=0;i<R.length;i++){const m=use.get(i);if(!m||m.rack!==i)continue;if(m===d)return {x,y};const t=tplOf(m);x+=t.xw||0;y+=t.yw||0;}}
  return null;
}
// 模組的位址範圍文字（槽位表、預覽、詳細資料用）
function addrText(d){
  const h=d&&d.on&&devOf(d.on);if(!h||d.rack==null)return '';const t=tplOf(d);
  if(isAhBase(h)){const s=ahStart(d);if(!s)return '';const p=[];if(t.xw)p.push(`X${s.x}.0～X${s.x+t.xw-1}.15`);if(t.yw)p.push(`Y${s.y}.0～Y${s.y+t.yw-1}.15`);return p.join('、');}
  const a=qAddr(d);return a?`${qHex(a.start)}～${qHex(a.start+a.n-1)}`:'';
}

// 模組的接點 X00～X0F 換成依槽位算出的實際位址（沒裝在基板上就回傳 null）
function qName(d,t){
  const h=d&&d.on&&devOf(d.on);
  if(isAhBase(h)){const m=/^([XY])(\d+)\.(\d+)$/.exec(t);if(!m||!(m[1]==='X'?tplOf(d).xw:tplOf(d).yw))return null;const st=ahStart(d);return st?`${m[1]}${(m[1]==='X'?st.x:st.y)+(+m[2])}.${m[3]}`:null;}
  const m=/^([XY])([0-9A-F]+)$/.exec(t);if(!m)return null;const a=qAddr(d);return a?m[1]+qHex(a.start+parseInt(m[2],16)):null;}
/* ---------- 往右／往左串接（三菱 FX5、FX3U，台達 AS、DVP）：主機 t.chain={r:族,l:族}；模組 t.chainKind='r'|'l'、t.chainFam=族（或族清單）
   d.on 是主機、d.chain 是由主機往外的順序；串接的模組上緣對齊主機、一台貼一台，跟著主機移動 ---------- */
const chainOf=(h,side)=>riders(h).filter(r=>tplOf(r).chainKind===side).sort((a,b)=>(a.chain??0)-(b.chain??0));
function chainOk(h,o){const t=tplOf(h),ot=tplOf(o),f=t.chain&&t.chain[ot.chainKind];return !!f&&(Array.isArray(ot.chainFam)?ot.chainFam.includes(f):ot.chainFam===f);}
function chainReflow(h){if(!h)return;const t=tplOf(h);['r','l'].forEach(side=>{let x=side==='r'?h.x+t.w:h.x;chainOf(h,side).forEach((m,i)=>{const mt=tplOf(m);m.chain=i;if(side==='r'){m.x=r1(x);x+=mt.w;}else{x-=mt.w;m.x=r1(x);}m.y=r1(h.y);m.sheet=h.sheet;});});}
// 串接區：主機右緣（或左緣）到串接尾端再多一台的寬度；回傳插入的順序
function chainZone(h,o){const t=tplOf(h),ot=tplOf(o),side=ot.chainKind,list=chainOf(h,side).filter(m=>m!==o),len=list.reduce((a,m)=>a+tplOf(m).w,0);
  return side==='r'?{x:h.x+t.w*0.6,y:h.y-15,w:t.w*0.4+len+ot.w+25,h:t.h+30}:{x:h.x-len-ot.w-25,y:h.y-15,w:len+ot.w+25+t.w*0.4,h:t.h+30};}
function chainPick(h,o,cx){const side=tplOf(o).chainKind,list=chainOf(h,side).filter(m=>m!==o);for(let k=0;k<list.length;k++){const m=list[k],mc=m.x+tplOf(m).w/2;if(side==='r'?cx<mc:cx>mc)return k;}return list.length;}
// 串接模組的位址：oct（FX、DVP：8 進位，每台以 8 點為單位）或 word（台達 AS：字.位元）；主機自己的點數在前面
const octTerms=(t,p)=>{const re=new RegExp('^'+p+'[0-7]+$');return (t.terms||[]).filter(x=>re.test(x.id)).length+Object.values(t.cns||{}).reduce((n,c)=>n+Object.values(c.sig).filter(v=>re.test(v)).length,0);};
const round8=n=>Math.ceil(n/8)*8;
function chainUse(t,p,rule){if(rule==='word')return (p==='X'?t.xw:t.yw)||0;const k=p==='X'?t.chainX:t.chainY;return k!=null?k:round8(octTerms(t,p));}
function chainStart(d,p){const h=d.on&&devOf(d.on);if(!h)return null;const ht=tplOf(h),rule=ht.chainAddr;if(!rule||tplOf(d).chainKind!=='r')return null;
  let a=rule==='word'?((p==='X'?ht.xw:ht.yw)||0):(p==='X'?(ht.chainX??round8(octTerms(ht,'X'))):(ht.chainY??round8(octTerms(ht,'Y'))));
  for(const m of chainOf(h,'r')){if(m===d)return {a,rule};a+=chainUse(tplOf(m),p,rule);}return null;}
function chainName(d,t){const m=/^([XY])(\d+)(?:\.(\d+))?$/.exec(t);if(!m)return null;const st=chainStart(d,m[1]);if(!st||!chainUse(tplOf(d),m[1],st.rule))return null;
  if(st.rule==='word')return m[3]==null?null:`${m[1]}${st.a+(+m[2])}.${m[3]}`;if(!/^[0-7]+$/.test(m[2])||m[3]!=null)return null;return m[1]+(st.a+parseInt(m[2],8)).toString(8);}
function chainText(d){const p=[];['X','Y'].forEach(L=>{const st=chainStart(d,L),t=tplOf(d);if(!st)return;const n=chainUse(t,L,st.rule);if(!n)return;
  p.push(st.rule==='word'?`${L}${st.a}.0～${L}${st.a+n-1}.15`:`${L}${st.a.toString(8)}～${L}${(st.a+n-1).toString(8)}`);});return p.join('、');}
function hostOk(h,o){if(!h||h===o||h.on||h.sheet!==o.sheet)return false;const t=tplOf(h);if(t.attach||t.noOv)return false;const ot=tplOf(o);if(ot.chainKind)return chainOk(h,o);if(ot.rackKind)return !!t.rack&&rackPick(h,o,h.x)!=null;if(ot.coil)return !!coilOf(h);if(ot.attach==='under')return (ot.fits||[]).includes(h.tpl);if(ot.attach==='side')return t.cat===(ot.hostCat||C2)&&(!ot.fits||ot.fits.includes(h.tpl))&&!riders(h).some(r=>r!==o&&attachOf(r)==='side'&&!!tplOf(r).sideL===!!ot.sideL);if(ot.fits&&!ot.fits.includes(h.tpl))return false;if(ot.at&&!ot.at[h.tpl])return false;return attachOf(o)==='below'?t.cat===C5:t.cat===(ot.hostCat||C2);}
// 伺服電池的安裝位置：預設掛在下方距左緣 6 mm（MR-J4-200B 外型圖）；
// MR-J4-700B 依外型圖直立裝在正面右側區塊中間（CN1A、CN1B 左邊），露出 21×69.3 那一面；
// MR-JE-40B 依外型圖裝在正面電池座（CN4 下方、CN1A／CN1B 左邊）
const BAT_AT={j4700:{x:116.4,y:74.2,tpl:'mrbat6v1-f'},je40:{x:4.4,y:40.7,tpl:'mrbat6v1-je'}};
const BAT_VAR=new Set(['mrbat6v1-f','mrbat6v1-je']);
// 舊檔：已經裝在驅動器上的電池，外形或位置跟現在的安裝位置不同時重新裝一次
function fixBatteries(){S.devices.forEach(r=>{if(!r.on||attachOf(r)!=='below')return;const h=devOf(r.on),a=h&&BAT_AT[h.tpl];if(a&&r.tpl!==a.tpl)placeOn(r,h);});}
const BAT_BASE='mrbat6v1';
const batFront=(r,h)=>attachOf(r)==='below'&&!!BAT_AT[h.tpl];
function placeOn(r,h){
  const ht=tplOf(h);
  if(attachOf(r)==='below'){
    const a=BAT_AT[h.tpl];
    if(r.tpl===BAT_BASE||BAT_VAR.has(r.tpl)) r.tpl=a&&a.tpl||BAT_BASE;
    delete r.rot;
    const t=tplOf(r);
    if(a){r.x=r1(h.x+a.x);r.y=r1(h.y+a.y);}else{r.x=r1(h.x+Math.min(6,Math.max(0,ht.w-t.w)));r.y=r1(h.y+ht.h);}
  }else if(attachOf(r)==='under'){
    // 熱電驛插在接觸器下方：三支銅片插進 2/T1、4/T2、6/T3（位置依原廠 MSO 組合圖）
    const t=tplOf(r),a=t.under&&t.under[h.tpl]||{x:(ht.w-t.w)/2,y:ht.h-2};delete r.rot;r.x=r1(h.x+a.x);r.y=r1(h.y+a.y);
  }else if(attachOf(r)==='side'){
    // 側裝輔助接點：貼在接觸器右側，上下置中
    const t=tplOf(r);delete r.rot;r.x=r1(t.sideL?h.x-t.w:h.x+ht.w);r.y=r1(h.y+(ht.h-t.h)/2); // sideL：貼在左側（GV2 的 GVAN）
  }else if(tplOf(r).coil){
    // 線圈二極體：橫放在器具下邊緣的線上（不蓋住接點），水平位置對齊線圈兩個接點，K 朝向線圈 + 那一側
    const c=coilOf(h),P=ht.terms.find(p=>p.id===c.p),M=ht.terms.find(p=>p.id===c.m);
    let best=null;
    for(const rot of [90,270]){
      r.rot=rot;const t=tplOf(r),K=t.terms.find(p=>p.id==='K'),A=t.terms.find(p=>p.id==='A');
      const cx=Math.max(t.w/2,Math.min(ht.w-t.w/2,(P.x+M.x)/2)),x=cx-t.w/2,y=ht.h-t.h/2;
      const cost=Math.hypot(x+K.x-P.x,y+K.y-P.y)+Math.hypot(x+A.x-M.x,y+A.y-M.y);
      if(!best||cost<best.cost)best={rot,x,y,cost};
    }
    r.rot=best.rot;r.x=r1(h.x+best.x);r.y=r1(h.y+best.y);
  }else if(tplOf(r).chainKind){chainReflow(h);
  }else if(tplOf(r).rackKind){
    // 插槽模組：沒有指定槽或那一槽不能裝，就裝到第一個能裝的槽
    if(r.rack==null||!rackFit(h,r,r.rack)){const i=rackPick(h,r,h.x);if(i!=null)r.rack=i;}
    const s=(ht.rack||[])[r.rack];if(s){r.x=r1(h.x+s.x);r.y=r1(h.y+(ht.h-tplOf(r).h)/2);}
  }else{const t=tplOf(r),a=t.at&&t.at[h.tpl]||(t.frontAt&&{x:(ht.w-t.w)/2,y:t.frontAt.y});if(a){r.x=r1(h.x+a.x);r.y=r1(h.y+a.y);}else{r.x=r1(h.x+(ht.w-t.w)/2);r.y=r1(h.y+(ht.h-t.h)/2);}} // 指定位置的附件（例如 PLC 擴充板）照位置裝，其他置中
}
const famIds=id=>{const d=devOf(id);if(!d)return [id];return [d.id,...(d.on?[d.on]:[]),...riders(d).map(r=>r.id)];};
const effDepth=d=>Math.max(tplOf(d).d+Math.max(0,...riders(d).filter(r=>attachOf(r)==='front').map(r=>tplOf(r).d)),...riders(d).filter(r=>attachOf(r)==='slot').map(r=>tplOf(r).d)); // 插槽模組的深度是從底板量起的整體深度
/* 器具編號：d.tag 是顯示用、可以改；d.id 是內部識別，導線用它接，改編號不影響接線 */
const tagOf=id=>{const d=devOf(id);return d?d.tag:id;};
// 新器具配編號時避開所有編號與內部識別碼；改編號時只看編號（內部識別碼使用者看不到）
const tagUsed=(v,except)=>S.devices.some(d=>d!==except&&(d.tag===v||d.id===v));
const tagOwner=(v,except)=>S.devices.find(d=>d!==except&&d.tag===v)||null;
/* 並線：接在同一個接點上的其他線；端子台同一片的上下各點算同一個接點 */
/* 短路片：d.jumpers=[{at:起始片,p:片數}]，被接起來的幾片算同一個電位。回傳該片所屬的組（組內最小的片號） */
function slotGroup(d,i){
  const J=d&&d.jumpers;if(!J||!J.length) return i;
  const P=new Map(),f=k=>{while(P.has(k)&&P.get(k)!==k)k=P.get(k);return k;};
  J.forEach(j=>{for(let k=j.at;k<j.at+j.p;k++){const a=f(k),b=f(j.at);if(a!==b)P.set(Math.max(a,b),Math.min(a,b));else if(!P.has(k))P.set(k,k);}});
  return f(i);
}
// 全部接點同電位的器具（接地銅板、共點排）：器具範本預設，也可以在器具資料逐台開關
const BUS_RE=/接地銅|銅排|共點排|接地排/;
function busOf(d){if(!d)return false;if(d.bus!=null)return d.bus;const t=tplOf(d);return !!(t.bus||BUS_RE.test(t.n||''));}
// 器具內部本來就相通的接點（例如 NHT 端子台同一極的 L1、T1）
// 同電位接點組：範本固定的（例如 NHT 上下同極）加上這台自己設定的短路片（d.links，接線盒用）
const linksOf=d=>{if(!d)return null;const a=tplOf(d).links,b=d.links;return a&&b?[...a,...b]:a||b||null;};
function linkOf(d,t){const L=linksOf(d);if(!L)return -1;return L.findIndex(g=>g.includes(t));}
function sameNode(e){
  const d=devOf(e.d);if(busOf(d)) return x=>x.d===e.d;
  const li=linkOf(d,e.t);if(li>=0) return x=>x.d===e.d&&linkOf(d,x.t)===li;
  const m=d&&hasSlots(tplOf(d))&&SLOT_RE.exec(e.t);
  if(!m) return x=>x.d===e.d&&x.t===e.t;
  const g=slotGroup(d,+m[1]);
  return x=>{if(x.d!==e.d)return false;const k=SLOT_RE.exec(x.t);return !!k&&slotGroup(d,+k[1])===g;};
}
// 電纜接頭端：每一芯是接頭裡不同的腳位，雖然畫在同一個接點，電位各自獨立
const pinEnd=(w,k)=>!!(w.cab&&samePt(w[k],plugOf(cabOf(w.cab),k)));
const endKey=(w,k)=>pinEnd(w,k)?nodeKey(w[k])+'|pin:'+w.cab+':'+w.core:nodeKey(w[k]);
const atNode=(f,x)=>(f(x.a)&&!pinEnd(x,'a'))||(f(x.b)&&!pinEnd(x,'b'));
function parallelOf(w){
  const fa=sameNode(w.a),fb=sameNode(w.b),others=S.wires.filter(x=>x!==w);
  return {a:pinEnd(w,'a')?[]:others.filter(x=>atNode(fa,x)),b:pinEnd(w,'b')?[]:others.filter(x=>atNode(fb,x))};
}
/* 電位：導線把兩端的接點連起來；端子台同一片的上下各點算同一點。回傳 線 id → 電位編號 */
// 插接：附件的接點直接插在主機的接點上（士林 TH-P 的 2/T1 經熱元件接到接觸器的 2/T1），兩邊算同一點
function plugTo(d,t){if(!d||!d.on)return null;const m=tplOf(d).plug;if(!m||!m[t])return null;const h=devOf(d.on);return h?{d:h.id,t:m[t]}:null;}
// 可逆組：機械互鎖記住左右兩台接觸器（d.pair）；拖其中一台三台一起動
const ilockOf=d=>d&&(tplOf(d).ilock?d:S.devices.find(m=>tplOf(m).ilock&&m.pair&&m.pair.includes(d.id)))||null;
function ilockGroup(d){const m=ilockOf(d);if(!m)return [];return [m,...(m.pair||[]).map(devOf).filter(Boolean)].filter(x=>x!==d);}
// 機械互鎖的位置：左邊接觸器右緣，右邊接觸器接在互鎖右邊，三台上緣對齊
function ilockPlace(m,L,R){const lt=tplOf(L),mt=tplOf(m);m.x=r1(L.x+lt.w);m.y=r1(L.y+(lt.h-mt.h)/2);R.x=r1(m.x+mt.w);R.y=L.y;R.sheet=m.sheet=L.sheet;}
function nodeKey(e){const d=devOf(e.d);const pk=plugTo(d,e.t);if(pk)return nodeKey(pk);if(busOf(d))return e.d+'|*';const li=linkOf(d,e.t);if(li>=0)return e.d+'|~'+li;const m=d&&hasSlots(tplOf(d))&&SLOT_RE.exec(e.t);return e.d+'|'+(m?'#'+slotGroup(d,+m[1]):e.t);}
function netsOf(){
  const P=new Map(),f=k=>{while(P.get(k)!==k){P.set(k,P.get(P.get(k)));k=P.get(k);}return k;};
  const add=k=>{if(!P.has(k))P.set(k,k);};
  S.wires.forEach(w=>{const a=endKey(w,'a'),b=endKey(w,'b');add(a);add(b);P.set(f(a),f(b));});
  const m=new Map();S.wires.forEach(w=>m.set(w.id,f(endKey(w,'a'))));return m;
}
// 線號可以重複（共點、同電位用同一個號碼）；重複時用「線號＋兩端」指出是哪一條
const sameNo=w=>S.wires.filter(x=>x!==w&&x.no===w.no);
const wireRef=w=>sameNo(w).length?`${w.no}（${epText(w.a)} → ${epText(w.b)}）`:w.no;
// 新線預設線號：起點或終點的接點已經有線，就沿用（同電位）；否則取下一個沒人用的號碼
function inheritNo(a,b){
  const fa=sameNode(a),fb=sameNode(b),on=f=>S.wires.find(x=>atNode(f,x));
  const wa=on(fa),wb=on(fb);
  return {no:(wa||wb||{}).no||null,a:wa&&wa.no,b:wb&&wb.no};
}
// 自動配號跳過已用過的號碼
const noUsed=(v,except)=>S.wires.some(w=>w!==except&&w.no===v);
function nextWireNo(){let n=S.nextNo||1;while(noUsed('W'+String(n).padStart(3,'0')))n++;return n;}
const epText=e=>`${tagOf(e.d)}·${termLabel(devOf(e.d),e.t)}`;
const KINDS={in:'箱內',door:'過門',ext:'外線'};


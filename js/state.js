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
function restore(j){S=JSON.parse(j);snapshotPrev=j;sel=null;picked=null;recompute();renderPalette();save();syncUndo();if(!view.manual)fit();}
const $=id=>document.getElementById(id);
function syncUndo(){$('undo').disabled=!hist.u.length;$('redo').disabled=!hist.r.length;}

let mode='wire', sel=null, picked=null, bundle=false, showNo=false, tab='all';
let view={k:1,x:0,y:0,manual:false};
let draft=null, railHit=null, bundleSel=null;   // {a:{d,t},wps:[],end?:{d,t},pop:false,ext:{}}
let snap=null, hoverW=null, cursor={x:0,y:0,sx:0,sy:0}, listHover=null;
let last={gauge:1.25,color:'white'};
const filt={color:null,gauge:null,dev:'',kind:null};

const devOf=id=>S.devices.find(d=>d.id===id);
const ROTM=new WeakMap();
function rotated(b,r){
  r=((r||0)%360+360)%360;if(!r||!b) return b;
  let m=ROTM.get(b);if(!m){m={};ROTM.set(b,m);}
  if(!m[r]){
    const nx={top:'right',right:'bottom',bottom:'left',left:'top'};let w=b.w,h=b.h,ts=b.terms.map(t=>({...t}));
    for(let i=0;i<r/90;i++){const H=h;ts=ts.map(t=>({...t,x:H-t.y,y:t.x,side:nx[t.side]||t.side}));[w,h]=[h,w];}
    m[r]={...b,w,h,terms:ts};
  }
  return m[r];
}
const tplOf=d=>rotated(resolveTpl(d.tpl,d.count),d.rot);
const termOf=(d,t)=>tplOf(d).terms.find(x=>x.id===t);
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
function zoneOf(d){
  const t=tplOf(d),c={x:d.x+t.w/2,y:d.y+t.h/2},z=zoneAt(c);if(z) return z;
  let best=null,bd=Infinity;
  (S.fields||[]).forEach(z=>{const dx=Math.max(z.x-c.x,0,c.x-z.x-z.w),dy=Math.max(z.y-c.y,0,c.y-z.y-z.h),q=dx*dx+dy*dy;if(q<bd){bd=q;best=z;}});
  return best;
}
const devRef=d=>d.sheet==='field'?(zoneOf(d)||sheetRect('field')):sheetRect(d.sheet);
const inZone=(z,d)=>{if(d.sheet!=='field')return false;const t=tplOf(d);return inR({x:d.x+t.w/2,y:d.y+t.h/2},z);};
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
function termLabel(d,t){if(!d||!d.labels)return t;const m=SLOT_RE.exec(t);return (m&&d.labels[m[1]-1])||t;}
/* 正面附件（例如 LADN 輔助接點）：d.on 記住裝在哪個接觸器上，跟著接觸器移動 */
const riders=d=>S.devices.filter(x=>x.on===d.id);
function hostOk(h,o){if(!h||h===o||h.on||h.sheet!==o.sheet)return false;const t=tplOf(h);return t.cat===C2&&!t.front&&!t.noOv;}
const famIds=id=>{const d=devOf(id);if(!d)return [id];return [d.id,...(d.on?[d.on]:[]),...riders(d).map(r=>r.id)];};
const effDepth=d=>tplOf(d).d+Math.max(0,...riders(d).map(r=>tplOf(r).d));
/* 器具編號：d.tag 是顯示用、可以改；d.id 是內部識別，導線用它接，改編號不影響接線 */
const tagOf=id=>{const d=devOf(id);return d?d.tag:id;};
const tagUsed=(v,except)=>S.devices.some(d=>d!==except&&(d.tag===v||d.id===v));
const epText=e=>`${tagOf(e.d)}·${termLabel(devOf(e.d),e.t)}`;
const KINDS={in:'箱內',door:'過門',ext:'外線'};


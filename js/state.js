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
  if(s==='field'){const o=fieldO(),d=doorO();return {x:o.x,y:o.y,w:d.x+S.door.w-o.x,h:FIELD_H};}
  return {x:0,y:0,w:S.plate.w,h:S.plate.h};
}
const inR=(p,r)=>p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h;
const sheetAt=p=>inR(p,sheetRect('door'))?'door':inR(p,sheetRect('field'))?'field':'plate';
const boxBottom=()=>boxOrigin().y+S.box.h;
const wireKind=w=>{const a=devOf(w.a.d),b=devOf(w.b.d);if(!a||!b)return 'in';if(a.sheet==='field'||b.sheet==='field')return 'ext';if(a.sheet==='door'||b.sheet==='door')return 'door';return 'in';};
const KINDS={in:'箱內',door:'過門',ext:'外線'};


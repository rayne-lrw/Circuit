"use strict";
/* ---------- 清單寬面板：線號表、電纜、材料表、線長、審查、工具整塊移到盤面右邊的寬欄 ----------
   盤面留在左邊照常看圖、點線；右側面板只剩器具資料、檢查、篩選。寬度可以拖左緣調整，
   展開狀態與寬度記在這台電腦的瀏覽器。清單的 DOM 直接搬過去，按鈕事件都不用重綁 */
const WIDE_KEY='wiring-sim-wide';
function widePref(){try{return Object.assign({on:false,w:640},JSON.parse(localStorage.getItem(WIDE_KEY)||'{}'));}catch(_){return {on:false,w:640};}}
function wideSave(p){try{localStorage.setItem(WIDE_KEY,JSON.stringify(p));}catch(_){}}
const wideMax=()=>Math.max(380,window.innerWidth-700);
function wideWidth(w){const m=document.querySelector('main');w=Math.round(Math.min(wideMax(),Math.max(360,w)));m.style.setProperty('--wideW',w+'px');return w;}
function setWide(on,save){
  const m=document.querySelector('main'),box=$('listBox');if(!m||!box)return;
  m.classList.toggle('wl',!!on);$('wide').hidden=!on;
  (on?$('wideScroll'):document.querySelector('#right .scroll')).appendChild(box);
  $('wideB').hidden=!!on;
  if(on)wideWidth(widePref().w);
  if(save){const p=widePref();p.on=!!on;wideSave(p);}
  if(view.manual)applyView();else fit();
}
$('wideB').onclick=()=>setWide(true,true);
$('wideClose').onclick=()=>setWide(false,true);
$('wideGrip').onpointerdown=e=>{e.preventDefault();const g=$('wideGrip');g.setPointerCapture(e.pointerId);const R=$('wide').getBoundingClientRect().right;let w=null;
  g.onpointermove=ev=>{w=wideWidth(R-ev.clientX);};
  g.onpointerup=()=>{g.onpointermove=g.onpointerup=null;if(w!=null){const p=widePref();p.w=w;wideSave(p);}if(!view.manual)fit();};};
window.addEventListener('resize',()=>{if(document.querySelector('main.wl'))wideWidth(widePref().w);});
if(widePref().on)setWide(true,false);

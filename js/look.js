"use strict";
/* ---------- 器具實體圖（外觀切換：實體／簡化，存在這台電腦的瀏覽器） ----------
   兩層：
   1. 基本層（所有器具）：本體立體感、端子台底座、螺絲頭。端子台與螺絲直接依接點位置畫，
      接點位置是照外形圖建的，所以不會上下左右顛倒。
   2. 細節層（只有核對過原廠外形圖／照片的系列）：把手、跳脫鈕、測試鈕、按鈕頭……
      每一項都寫資料來源（LOOKS 的 src）與畫了什麼（feat）；沒有資料能確認位置的系列只畫基本層。
   規則：細節的相對位置照原廠圖（上下左右不能反），大小距離抓大概；細節不能蓋住接點。
   模擬時的動作效果（把手 ON／OFF、漏電指示、按鈕按下）畫在疊加層 lookSim。 */
const lookOn=()=>{try{return opPref().look!=='simple';}catch(_){return true;}};
// 端子台底座：同一邊、同一排（距離 4 mm 內）的接點畫一條深色底座
function lookRows(t){const rows=[];
  (t.terms||[]).forEach(p=>{const s=p.side,hz=s==='top'||s==='bottom',k=hz?p.y:p.x;
    let r=rows.find(r=>r.s===s&&Math.abs(r.k-k)<4);if(!r){r={s,k,hz,ps:[]};rows.push(r);}r.ps.push(p);});
  return rows;}
function lookBase(d,t,tr){
  if(!lookOn()||t.sym||t.noOv||t.gen||t.round)return '';
  let h=`<rect class="lk-hi" x="${d.x+.8}" y="${d.y+.8}" width="${Math.max(0,t.w-1.6)}" height="${Math.max(0,t.h*.45)}" rx="${t.rx||2}"/>`;
  if(t.cns)return h; // 連接器器具（針腳收成一個接點）：只畫本體
  const pad=Math.max(2.4,tr*1.9);
  lookRows(t).forEach(r=>{if(r.ps.length<2&&t.terms.length>2)return;
    const a=r.ps.map(p=>r.hz?p.x:p.y),lo=Math.min(...a)-pad,hi=Math.max(...a)+pad,c=r.k;
    const x=r.hz?Math.max(0,lo):Math.max(0,c-pad),y=r.hz?Math.max(0,c-pad):Math.max(0,lo);
    const w=r.hz?Math.min(t.w,hi)-x:Math.min(t.w,c+pad)-x,hh=r.hz?Math.min(t.h,c+pad)-y:Math.min(t.h,hi)-y;
    if(w>0&&hh>0)h+=`<rect class="lk-tb" x="${d.x+x}" y="${d.y+y}" width="${w}" height="${hh}" rx="1"/>`;});
  return h;}
// 螺絲頭：接點圓上加一條起子槽（接點本身還是原本的圓，點選、接線都不變）
function lookScrew(x,y,tr){return lookOn()&&tr>=1.5?`<line class="lk-slot" x1="${x-tr*.62}" y1="${y}" x2="${x+tr*.62}" y2="${y}"/>`:'';}

/* ---------- 細節層：逐系列核對 ----------
   m(id,t)：哪些型號；src：核對的資料；feat：畫了什麼（給核對表用）；draw(d,t)：細節；sim(d,t,st)：模擬疊加 */
const LK_BRK=(d,t,o={})=>{ // 塑殼斷路器：把手在正中央（上下兩排端子中間）
  const r=lookRows(t).filter(r=>r.hz),top=Math.max(...r.filter(r=>r.s==='top').map(r=>r.k),0),bot=Math.min(...r.filter(r=>r.s==='bottom').map(r=>r.k),t.h);
  // 4P：把手中心線在右邊三極中間（型錄 BW125-4P 72.5／120、BW160-4P 87.5／140；士林 4P 外形圖同樣偏右）
  const xs=(t.terms||[]).filter(p=>p.side==='top').map(p=>p.x).sort((a,b)=>a-b),cx=xs.length===4?(xs[1]+xs[2]+xs[3])/3:t.w/2;
  const mid=(top+bot)/2,span=bot-top,ww=Math.min(40,t.w*.34,Math.max(10,(xs.length===4?t.w*.75:t.w)*.3)),hh=Math.min(span*.42,ww*1.5),x=cx-ww/2,y=mid-hh/2;
  return {x,y,w:ww,h:hh};};
function lkHandle(d,t,g,on){const k=g.w*.62,kh=g.h*.44,kx=d.x+g.x+(g.w-k)/2,ky=d.y+g.y+(on?g.h*.06:g.h*.5);
  return `<rect class="lk-well" x="${d.x+g.x}" y="${d.y+g.y}" width="${g.w}" height="${g.h}" rx="1.5"/><rect class="lk-knob" x="${kx}" y="${ky}" width="${k}" height="${kh}" rx="1"/>`;}
const LOOKS=[
  {name:'富士 G-TWIN BW 無熔絲斷路器',m:(id,t)=>t.ser==='G-TWIN BW',src:'富士 G-TWIN 型錄 06/39～06/45 外形尺寸圖',
   feat:'把手（正中央，ON 在上）、跳脫鈕（把手右下）',
   draw:(d,t)=>{const g=LK_BRK(d,t),s=Math.min(4,g.w*.22);return lkHandle(d,t,g,false).replace('lk-knob','lk-knob lk-off')+`<rect class="lk-trip" x="${d.x+g.x+g.w+1.2}" y="${d.y+g.y+g.h-s}" width="${s}" height="${s*.7}" rx=".6"/>`;},
   sim:(d,t,st)=>{const g=LK_BRK(d,t);return lkHandle(d,t,g,!!st.on[d.id]).replace('lk-well','lk-well lk-sim');},tag:t=>lkTagAbove(t)},
  {name:'富士 G-TWIN EW 漏電斷路器',m:(id,t)=>t.ser==='G-TWIN EW',src:'富士 G-TWIN 漏電斷路器型錄 07/36～07/41 外形尺寸圖',
   feat:'把手（正中央）、漏電跳脫指示鈕（把手右上）、跳脫鈕（把手右下）、測試鈕（跳脫鈕下方）',
   draw:(d,t)=>{const g=LK_BRK(d,t),s=Math.min(4,g.w*.22),x=d.x+g.x+g.w+1.2;
     return lkHandle(d,t,g,false).replace('lk-knob','lk-knob lk-off')+`<rect class="lk-elind" x="${x}" y="${d.y+g.y}" width="${s}" height="${s*.7}" rx=".6"/><rect class="lk-trip" x="${x}" y="${d.y+g.y+g.h*.55}" width="${s}" height="${s*.7}" rx=".6"/><circle class="lk-test" cx="${x+s/2}" cy="${d.y+g.y+g.h+s*.4}" r="${s*.42}"/>`;},
   sim:(d,t,st)=>{const g=LK_BRK(d,t),s=Math.min(4,g.w*.22),x=d.x+g.x+g.w+1.2,el=st.btrip&&st.btrip[d.id]==='el';
     return lkHandle(d,t,g,!!st.on[d.id]).replace('lk-well','lk-well lk-sim')+(el?`<rect class="lk-elind on" x="${x}" y="${d.y+g.y}" width="${s}" height="${s*.7}" rx=".6"/>`:'');},tag:t=>lkTagAbove(t)},
  {name:'士林 NF／NV 塑殼斷路器',m:(id,t)=>t.ser==='NF 無熔線'||t.ser==='NV 漏電',src:'士林 2026 版斷路器型錄第 38 頁外形圖（2P／3P／4P 正面圖）',
   feat:'把手（正中央，ON 在上）',
   draw:(d,t)=>lkHandle(d,t,LK_BRK(d,t),false).replace('lk-knob','lk-knob lk-off'),
   sim:(d,t,st)=>lkHandle(d,t,LK_BRK(d,t),!!st.on[d.id]).replace('lk-well','lk-well lk-sim'),tag:t=>lkTagAbove(t)},
  {name:'施耐德 Acti9 iC60N 小型斷路器',m:(id,t)=>t.ser==='Acti9 iC60N',src:'施耐德 iC60N 型錄 CA901002E 第 8 頁外型尺寸',
   feat:'撥桿（正面中間一條，跨所有極，ON 在上）',
   draw:(d,t)=>{const y=t.h*.4,h=t.h*.2;return `<rect class="lk-well" x="${d.x+2}" y="${d.y+y}" width="${t.w-4}" height="${h}" rx="1.2"/><rect class="lk-knob lk-off" x="${d.x+3}" y="${d.y+y+h*.5}" width="${t.w-6}" height="${h*.42}" rx=".8"/>`;},
   sim:(d,t,st)=>{const y=t.h*.4,h=t.h*.2,on=!!st.on[d.id];return `<rect class="lk-well lk-sim" x="${d.x+2}" y="${d.y+y}" width="${t.w-4}" height="${h}" rx="1.2"/><rect class="lk-knob" x="${d.x+3}" y="${d.y+y+(on?h*.08:h*.5)}" width="${t.w-6}" height="${h*.42}" rx=".8"/>`;},
   tag:t=>{const top=Math.max(0,...lookRows(t).filter(r=>r.s==='top').map(r=>r.k));return {x:t.w/2,y:(top+t.h*.4)/2+1,room:t.h*.4-top-4};}},
  {name:'士林 BH 分電盤用斷路器',m:(id,t)=>t.ser==='BH 分電盤',src:'士林 2026 版斷路器型錄第 18～19 頁產品照片（撥桿在正面中間）',
   feat:'撥桿（正面中間，跨所有極，ON 在上）',
   draw:(d,t)=>LOOKS.find(L=>L.name.includes('iC60')).draw(d,t),sim:(d,t,st)=>LOOKS.find(L=>L.name.includes('iC60')).sim(d,t,st),tag:t=>LOOKS.find(L=>L.name.includes('iC60')).tag(t)},
  {name:'IDEC YW 操作部',m:(id,t)=>/^yw\d/.test(id)&&(t.cbHost||t.op||/^yw1p/.test(id))&&!(t.terms||t.t||[]).length,src:'IDEC YW 系列型錄 TP1173 外形尺寸圖（正面為圓形框＋操作頭）',
   feat:'圓形框與操作頭（正面中心）；選擇開關、鑰匙開關的把手方向（L／C／R）',
   draw:(d,t)=>lkYW(d,t,null),sim:(d,t,st)=>lkYW(d,t,st),tag:()=>'above'}];
// IDEC YW：外框圓＋操作頭；選擇開關畫把手（直立＝C 或 2 位置的 L…依位置轉 45°／90°）；按著時操作頭變小
function lkYW(d,t,st){const cx=d.x+t.w/2,cy=d.y+t.h/2,R=Math.min(t.w,t.h)/2-1.5,op=t.op||{};
  let h=st?'':`<circle class="lk-bezel" cx="${cx}" cy="${cy}" r="${R}"/>`;
  if(op.k==='sel'){const pos=(st&&st.sel&&st.sel[d.id])||op.def,ang=op.n===3?{L:-45,C:0,R:45}[pos]:{L:0,R:90}[pos];
    h+=`<g transform="rotate(${ang} ${cx} ${cy})"><circle class="lk-head" cx="${cx}" cy="${cy}" r="${R*.62}"/><rect class="lk-lever" x="${cx-R*.16}" y="${cy-R*.6}" width="${R*.32}" height="${R*1.2}" rx="${R*.1}"/></g>`;return h;}
  const pr=st&&(op.k==='mom'?st.press.has(d.id+'|按下'):op.k==='alt'?!!st.on[d.id]:false);
  h+=`<circle class="lk-head${pr?' pressed':''}" style="fill:${pr?'#2b8cff':t.f}" cx="${cx}" cy="${cy}" r="${R*(pr?.6:.7)}"/>`;return h;}
// 編號放在上排端子和把手之間
function lkTagAbove(t){const top=Math.max(0,...lookRows(t).filter(r=>r.s==='top'&&r.hz).map(r=>r.k)),g=LK_BRK(null,t);return {x:g.x+g.w/2,y:(top+g.y)/2+2,room:g.y-top-5};}
// render.js 用：有細節層的器具，編號放在哪（'above'＝器具上方；{x,y,room}＝器具內、可用高度）
function lookTag(d,t){if(!lookOn()||d.rot)return null;const L=lookOf(d.tpl,t);return L&&L.tag?L.tag(t):null;}
const lookOf=(id,t)=>LOOKS.find(L=>L.m(id,t))||null;
function lookDetail(d,t){if(!lookOn()||d.rot)return '';const L=lookOf(d.tpl,t);return L?`<g class="lk-det">${L.draw(d,t)}</g>`:'';}
function lookSim(st){if(!lookOn()||!st)return '';let h='';S.devices.forEach(d=>{if(d.rot)return;const t=tplOf(d),L=lookOf(d.tpl,t);if(L&&L.sim)h+=`<g class="lk-det">${L.sim(d,t,st)}</g>`;});return h;}

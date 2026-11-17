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
/* ---------- PLC 正面（照手冊「各部分的名稱」圖）：位置用「本體寬度比例 x」與「上下兩排端子之間的區域比例 v」 ----------
   部件：cover＝蓋板（light／dark）、leds＝I/O 指示燈列、stat＝狀態燈（第一個是 PWR，pw 指定有電時亮的燈）、rj45＝乙太網路接頭 */
function lkBand(t){const r=lookRows(t).filter(r=>r.hz),top=Math.max(0,...r.filter(r=>r.k<t.h/2).map(r=>r.k)),bot=Math.min(t.h,...r.filter(r=>r.k>=t.h/2).map(r=>r.k));
  return {y0:top+3.2,y1:bot-3.2};}
function lkPanel(d,t,spec,st){const B=lkBand(t),H=B.y1-B.y0;if(H<12)return '';const X=f=>d.x+f*t.w,Y=v=>d.y+B.y0+v*H,live=st&&st.res&&st.res.dev[d.id]&&st.res.dev[d.id].on.length;let h='';
  spec.forEach(s=>{const x=X(s.x0),y=Y(s.v0),w=X(s.x1)-x,hh=Y(s.v1)-y;if(w<=0||hh<=0)return;
    if(s.k==='cover'){if(!st)h+=`<rect class="lk-cover ${s.c||'dark'}" x="${x}" y="${y}" width="${w}" height="${hh}" rx="1"/>`;return;}
    if(s.k==='rj45'){if(!st)h+=`<rect class="lk-rj" x="${x}" y="${y}" width="${w}" height="${hh}" rx=".6"/><rect class="lk-rjh" x="${x+w*.2}" y="${y+hh*.25}" width="${w*.6}" height="${hh*.5}"/>`;return;}
    if(s.k==='leds'){if(st)return;const n=Math.max(4,Math.min(16,Math.floor(w/3.2))),r=Math.min(.75,hh/6),lab=Math.min(2.6,hh*.45);
      h+=`<text class="lk-lab" x="${x}" y="${y+hh*.42}" style="font-size:${lab}px">${s.lab}</text>`;
      for(let row=0;row<2;row++)for(let i=0;i<n;i++)h+=`<circle class="lk-led" cx="${x+lab*2.4+(w-lab*2.6)*(i+.5)/n}" cy="${y+hh*(row?.78:.35)}" r="${r}"/>`;return;}
    if(s.k==='stat'){const n=s.labs.length,r=Math.min(.9,hh/n/2.6),fs=Math.min(2.4,hh/n*.7);
      s.labs.forEach((L,i)=>{const cy=y+hh*(i+.5)/n,on=st&&live&&(s.pw||[0]).includes(i);if(st&&!on)return;
        h+=`${st?'':`<text class="lk-lab" x="${x}" y="${cy+fs*.35}" style="font-size:${fs}px">${L}</text>`}<circle class="lk-led${on?' on':''}" cx="${x+w-r-.3}" cy="${cy}" r="${r}"/>`;});}});
  return h;}
const LK_PLC={
  FX5U:{src:'三菱 MELSEC iQ-F FX5S/FX5UJ/FX5U/FX5UC 用戶手冊（硬體篇）3.1「FX5U CPU 模塊」各部分的名稱',feat:'左側上蓋板（SD 卡、RS-485 在內）、CARD／RD／SD／SD-RD 燈、乙太網路接頭、中間擴充板蓋板、右側輸入燈（上）、PWR／ERR／P.RUN／BAT（中）、輸出燈（下）',
    spec:[{k:'cover',c:'light',x0:0,x1:.2,v0:0,v1:1},{k:'cover',x0:.2,x1:.92,v0:0,v1:1},{k:'stat',labs:['CARD','RD','SD','SD/RD'],x0:.27,x1:.4,v0:.04,v1:.42,pw:[]},{k:'rj45',x0:.26,x1:.36,v0:.55,v1:.9},{k:'cover',c:'mid',x0:.43,x1:.66,v0:.02,v1:.98},
      {k:'leds',lab:'IN',x0:.69,x1:.92,v0:.02,v1:.27},{k:'stat',labs:['PWR','ERR','P.RUN','BAT'],x0:.68,x1:.79,v0:.33,v1:.64,pw:[0,2]},{k:'leds',lab:'OUT',x0:.68,x1:.92,v0:.7,v1:.96}],tag:{x:.545,v:.5}},
  FX5UJ:{src:'三菱 MELSEC iQ-F FX5S/FX5UJ/FX5U/FX5UC 用戶手冊（硬體篇）3.1「FX5UJ CPU 模塊」各部分的名稱',feat:'左側周邊設備蓋板（USB、SD 卡、RUN/STOP）、中間偏左擴充板蓋板、右側輸入燈（上）、PWR／ERR／P.RUN／CARD／LAN（中）、輸出燈（下）',
    spec:[{k:'cover',c:'light',x0:0,x1:.21,v0:0,v1:1},{k:'cover',x0:.21,x1:.5,v0:0,v1:1},{k:'leds',lab:'IN',x0:.63,x1:.89,v0:.02,v1:.26},
      {k:'stat',labs:['PWR','ERR','P.RUN','CARD','LAN'],x0:.72,x1:.89,v0:.32,v1:.68,pw:[0,2]},{k:'leds',lab:'OUT',x0:.62,x1:.89,v0:.73,v1:.97}],tag:{x:.355,v:.5}},
  FX5S:{src:'三菱 MELSEC iQ-F FX5S/FX5UJ/FX5U/FX5UC 用戶手冊（硬體篇）3.1「FX5S CPU 模塊」各部分的名稱',feat:'左上乙太網路接頭、左下周邊設備蓋板、中間偏左擴充板蓋板、右側輸入燈（上）、PWR／ERR／P.RUN／LAN（中）、輸出燈（下）',
    spec:[{k:'rj45',x0:.05,x1:.17,v0:.04,v1:.34},{k:'cover',c:'light',x0:.01,x1:.2,v0:.42,v1:.98},{k:'cover',x0:.21,x1:.53,v0:0,v1:1},{k:'leds',lab:'IN',x0:.72,x1:.97,v0:.03,v1:.24},
      {k:'stat',labs:['PWR','ERR','P.RUN','LAN'],x0:.82,x1:.97,v0:.34,v1:.62,pw:[0,2]},{k:'leds',lab:'OUT',x0:.7,x1:.97,v0:.76,v1:.97}],tag:{x:.37,v:.5}},
  FX3U:{src:'三菱 FX3U 系列用戶手冊（硬體篇）2.2.1「各部位名稱及功能（正面）」',feat:'左側上蓋板（記憶卡在內）、右側輸入燈（上）、POWER／RUN／BATT／ERROR（右側中間）、輸出燈（下）；RUN/STOP 開關在本體左側面，正面看不到不畫',
    spec:[{k:'cover',c:'light',x0:0,x1:.44,v0:0,v1:1},{k:'leds',lab:'IN',x0:.48,x1:.98,v0:.04,v1:.22},{k:'stat',labs:['POWER','RUN','BATT','ERROR'],x0:.73,x1:.88,v0:.28,v1:.78,pw:[0,1]},{k:'leds',lab:'OUT',x0:.47,x1:.72,v0:.62,v1:.92}],tag:{x:.59,v:.38}}};
Object.entries(LK_PLC).forEach(([ser,P])=>LOOKS.push({name:`三菱 ${ser} CPU`,m:(id,t)=>t.ser===ser&&!t.chainKind&&(t.terms||[]).length>8,src:P.src,feat:P.feat,
  draw:(d,t)=>lkPanel(d,t,P.spec,null),sim:(d,t,st)=>lkPanel(d,t,P.spec,st),tag:t=>{const B=lkBand(t);return {x:P.tag.x*t.w,y:B.y0+P.tag.v*(B.y1-B.y0)+3,room:Math.min(14,(B.y1-B.y0)*.4)};}}));
// 三菱 Q 通用型 CPU（Q02U、Q03UD、Q04UDH～Q26UDH）：手冊同一張「各部位的名稱」圖
const LK_QU=new Set(['q02ucpu','q03udcpu','q04udhcpu','q06udhcpu','q10udhcpu','q13udhcpu','q20udhcpu','q26udhcpu']);
LOOKS.push({name:'三菱 Q 通用型 CPU（Q02U～Q26UDH）',m:id=>LK_QU.has(id),src:'三菱 QCPU 用戶手冊（硬件設計／維護點檢篇）6.1.3「Q02UCPU、Q03UDCPU、Q04UDHCPU…Q26UDHCPU」各部位的名稱',
  feat:'上方型號名牌、右上 MODE／RUN／ERR.／USER／BAT.／BOOT 燈、下半部 USB 蓋（上）與 RS-232 蓋（下）、最下方序號牌',
  draw:(d,t)=>lkPanel(d,t,LK_QSPEC,null),sim:(d,t,st)=>lkPanel(d,t,LK_QSPEC,st),tag:t=>({x:t.w/2,y:t.h*.4,room:6})});
const LK_QSPEC=[{k:'stat',labs:['MODE','RUN','ERR.','USER','BAT.','BOOT'],x0:.3,x1:.85,v0:.05,v1:.22,pw:[0,1]},{k:'cover',c:'light',x0:.04,x1:.96,v0:.58,v1:.74},{k:'cover',c:'light',x0:.04,x1:.96,v0:.75,v1:.9}];
// 施耐德 LRD3（LRD313～LRD380、L 型）：輔助端子（上）與主端子（下）之間的面板
LOOKS.push({name:'施耐德 TeSys LRD3 熱過載繼電器（LRD313～LRD380）',m:id=>/^lrd3\d\d/.test(id),src:'施耐德 LRD3pp 安裝說明書 AAV37571（圖 O、P、Q：正面面板）',
  feat:'面板在輔助端子與主端子之間：左側電流設定旋鈕、旋鈕右邊 H／A（手動／自動）切換、右側上方 RESET 鈕（藍）、下方 STOP 鈕（紅）',
  draw:(d,t)=>{const B=lkLrdBand(t),H=B.y1-B.y0;if(H<8)return '';const y=d.y+B.y0,cx=d.x+t.w*.22,r=Math.min(H*.42,t.w*.12),bw=t.w*.16,bh=H*.36;
    return `<rect class="lk-cover mid" x="${d.x+t.w*.04}" y="${y}" width="${t.w*.92}" height="${H}" rx="1"/><circle class="lk-dial" cx="${cx}" cy="${y+H/2}" r="${r}"/><line class="lk-dialp" x1="${cx}" y1="${y+H/2}" x2="${cx+r*.7}" y2="${y+H/2-r*.7}"/>`+
      `<rect class="lk-sel" x="${d.x+t.w*.42}" y="${y+H*.2}" width="${t.w*.07}" height="${H*.6}" rx=".5"/><text class="lk-lab" x="${d.x+t.w*.505}" y="${y+H*.35}" style="font-size:2px">H</text><text class="lk-lab" x="${d.x+t.w*.505}" y="${y+H*.85}" style="font-size:2px">A</text>`+
      `<rect class="lk-reset" x="${d.x+t.w*.78}" y="${y+H*.08}" width="${bw}" height="${bh}" rx=".6"/><rect class="lk-trip" x="${d.x+t.w*.78}" y="${y+H*.56}" width="${bw}" height="${bh}" rx=".6"/>`;},
  tag:t=>{const B=lkLrdBand(t);return {x:t.w*.62,y:B.y0+(B.y1-B.y0)*.62,room:4};}});
// LRD3：面板在輔助端子（95～98）那一排和主端子（2/T1…）那一排之間
function lkLrdBand(t){const ys=lookRows(t).filter(r=>r.hz).map(r=>r.k).sort((a,b)=>a-b);return ys.length>=2?{y0:ys[0]+3.2,y1:ys[1]-3.2}:{y0:0,y1:0};}
// 電磁接觸器：上下主端子之間正中央的動作指示窗（可動件吸合時往下）
function lkMC(d,t,st){const B=lkBand(t),H=B.y1-B.y0;if(H<10)return '';const w=Math.min(16,t.w*.3),h=Math.min(H*.4,w*1.3),x=d.x+t.w/2-w/2,y=d.y+B.y0+H/2-h/2,on=st&&st.res&&st.res.dev[d.id]&&st.res.dev[d.id].coil;
  return (st?'':`<rect class="lk-well" x="${x}" y="${y}" width="${w}" height="${h}" rx="1"/>`)+`<rect class="lk-arm${on?' on':''}" x="${x+w*.18}" y="${y+(on?h*.5:h*.12)}" width="${w*.64}" height="${h*.38}" rx=".6"/>`;}
LOOKS.push({name:'士林 S-P 電磁接觸器',m:(id,t)=>t.ser==='S-P 接觸器',src:'士林 MS-P 系列外觀尺寸圖集（S-P11 第 7 頁、S-P50T、S-P100TS 正面圖）',
  feat:'動作指示窗（正面中央，上下主端子之間）；吸合時可動件往下',draw:(d,t)=>lkMC(d,t,null),sim:(d,t,st)=>lkMC(d,t,st),tag:t=>lkMCTag(t)});
LOOKS.push({name:'施耐德 TeSys D 電磁接觸器（LC1D）',m:(id,t)=>t.ser==='TeSys D 接觸器'||t.ser==='TeSys D Advanced 接觸器',src:'施耐德 TeSys 型錄 B8/107～B8/108 外形尺寸圖（正面圖）',
  feat:'動作指示窗（正面中央，上下主端子之間）；吸合時可動件往下',draw:(d,t)=>lkMC(d,t,null),sim:(d,t,st)=>lkMC(d,t,st),tag:t=>lkMCTag(t)});
function lkMCTag(t){const B=lkBand(t),H=B.y1-B.y0;return {x:t.w/2,y:B.y0+H*.15+1,room:Math.min(8,H*.2)};}
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
// 旋轉的器具：細節照沒旋轉的外形畫在器具中心，再整組順時針轉（和 tplOf 的接點旋轉方向一樣）
const lkRot=d=>((d.rot||0)%360+360)%360;
function lkWrap(d,t,fn){const r=lkRot(d);if(!r)return fn(d,t);const t0=resolveTpl(d.tpl,d.count),cx=d.x+t.w/2,cy=d.y+t.h/2,d0={...d,x:cx-t0.w/2,y:cy-t0.h/2};
  const h=fn(d0,t0);return h?`<g transform="rotate(${r} ${cx} ${cy})">${h}</g>`:'';}
function lookTag(d,t){if(!lookOn())return null;const L=lookOf(d.tpl,t);if(!L||!L.tag)return null;const r=lkRot(d);if(!r)return L.tag(t);
  const t0=resolveTpl(d.tpl,d.count),g=L.tag(t0);if(g==='above'||!g)return g;let x=g.x,y=g.y,w=t0.w,h=t0.h;for(let i=0;i<r/90;i++){[x,y]=[h-y,x];[w,h]=[h,w];}return {...g,x,y};}
const lookOf=(id,t)=>LOOKS.find(L=>L.m(id,t))||null;
function lookDetail(d,t){if(!lookOn())return '';const L=lookOf(d.tpl,t);if(!L)return '';const h=lkWrap(d,t,(a,b)=>L.draw(a,b));return h?`<g class="lk-det">${h}</g>`:'';}
function lookSim(st){if(!lookOn()||!st)return '';let h='';S.devices.forEach(d=>{const t=tplOf(d),L=lookOf(d.tpl,t);if(L&&L.sim){const x=lkWrap(d,t,(a,b)=>L.sim(a,b,st));if(x)h+=`<g class="lk-det">${x}</g>`;}});return h;}

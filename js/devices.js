"use strict";
/* ---------- 基礎資料 ---------- */
const GAUGES=[[0.5,.9],[0.75,1.0],[1.25,1.3],[2,1.7],[3.5,2.1],[5.5,2.6],[8,3.1],[14,3.7]];
// 表上沒有的線徑（臨時新增）依表內插；超過最大值依截面積開根號外推
function interpG(tab,g){
  const t=tab.slice().sort((a,b)=>a[0]-b[0]),e=t.find(x=>x[0]===g);if(e)return e[1];
  if(g<t[0][0]) return t[0][1]*Math.sqrt(g/t[0][0]);
  const L=t[t.length-1];if(g>L[0]) return L[1]*Math.sqrt(g/L[0]);
  const i=t.findIndex(x=>x[0]>g),a=t[i-1],b=t[i];return a[1]+(b[1]-a[1])*(g-a[0])/(b[0]-a[0]);
}
const gw=g=>interpG(GAUGES,g);
// 臨時線徑只存在這次開啟的頁面；專案裡已經用到的線徑會一直出現在選單上
const tempGauges=[];
function gaugeList(cur){const s=new Set([...GAUGES.map(x=>x[0]),...tempGauges,...(S?S.wires.map(w=>w.gauge):[])]);if(cur!=null)s.add(cur);return [...s].filter(g=>g>0).sort((a,b)=>a-b);}
function gaugeChips(cur,attr,pre){
  return `<div class="chips">${gaugeList(cur).map(g=>`<button class="chip" data-${attr}="${g}" aria-pressed="${cur===g}">${g}</button>`).join('')}</div>
  <div class="newc newg"><input id="${pre}G" type="number" min="0.1" max="300" step="0.05" placeholder="其他線徑，例如 0.3" aria-label="新增線徑 mm²"><span class="note">mm²</span><button class="tool" data-newg="${pre}">新增</button></div>`;
}
function addTempGauge(pre){
  const v=Math.round(Number($(pre+'G').value)*100)/100;
  if(!(v>=0.1&&v<=300)){toast('線徑請填 0.1～300 mm²');return null;}
  if(!gaugeList().includes(v)) tempGauges.push(v);
  return v;
}
const COLORS={
  white:{n:'白',c:'#fbfbf6',k:'#2b2f2e'}, black:{n:'黑',c:'#17181a',k:'#f5f5ee'}, red:{n:'紅',c:'#d6202c',k:'#3c0a0e'},
  brown:{n:'棕',c:'#7d4a22',k:'#f0e2d2'}, blue:{n:'藍',c:'#1763d6',k:'#04183a'}, ground:{n:'黃綠',c:'#159a4b',k:'#032a13',stripe:'#f4c400'},
  green:{n:'綠',c:'#159a4b',k:'#032a13'}, gray:{n:'灰',c:'#7f8785',k:'#1d2120'},
  // 舊暫存檔可能用到，不列入建線選單
  yellow:{n:'黃',c:'#f4c400',k:'#3f3300',legacy:true}, orange:{n:'橘',c:'#f0781e',k:'#3f1c02',legacy:true}
};
// 臨時顏色只存在這次開啟的頁面，重新整理後選單回到預設；已接的線把色碼存在線上，所以顏色不變。
const tempColors={};
function casing(hex){
  const n=parseInt(hex.slice(1),16),r=n>>16&255,g=n>>8&255,b=n&255;
  return (0.299*r+0.587*g+0.114*b)>110?'#222725':'#f4f4ee';
}
const keyColor=k=>tempColors[k]||COLORS[k]||COLORS.black;
const colorOf=w=>w.hex?{n:w.cname||'自訂',c:w.hex,k:casing(w.hex)}:(COLORS[w.color]||COLORS.black);
function applyColor(w,key){
  const t=tempColors[key];w.color=key;
  if(t){w.hex=t.c;w.cname=t.n;}else if(COLORS[key]){delete w.hex;delete w.cname;}
}
function addTemp(pre){
  const hex=$(pre+'Hex').value.toLowerCase(),name=$(pre+'Name').value.trim().slice(0,8)||'自訂';
  const key='x'+hex.slice(1);tempColors[key]={n:name,c:hex,k:casing(hex)};return key;
}
function colorChips(cur,pre,w){
  const items=[...Object.entries(COLORS).filter(([,c])=>!c.legacy),...Object.entries(tempColors)];
  if(w&&!items.some(([k])=>k===w.color)) items.push([w.color,colorOf(w)]);
  return `<div class="chips">${items.map(([k,c])=>`<button class="chip color" data-pc="${k}" aria-pressed="${cur===k}"><span class="sw" style="background:${swatch(c)}"></span>${esc(c.n)}</button>`).join('')}</div>
  <div class="newc"><input type="color" id="${pre}Hex" value="#8e44ad" aria-label="選擇新顏色"><input id="${pre}Name" maxlength="8" placeholder="顏色名稱（可不填）" aria-label="顏色名稱"><button class="tool" data-newc="${pre}">新增</button></div>`;
}
const OD={0.5:2.4,0.75:2.8,1.25:3.2,2:3.6,3.5:4.2,5.5:5,8:5.8,14:7.6}; // 導線外徑估算值，用來算線槽占用率
const odOf=g=>interpG(Object.entries(OD).map(([k,v])=>[Number(k),v]),g);
/* ---------- 接點排列工具 ---------- */
const pole=(ids,xs,y,side,desc)=>ids.map((id,i)=>[id,xs[i],y,side,desc]);
function row(ids,y,side,w,desc,m=7){const n=ids.length;return ids.map((id,i)=>[id,n===1?w/2:m+(w-2*m)*i/(n-1),y,side,desc]);}
function nfb(w,h){const xs=[w*.18,w*.5,w*.82];return [...pole(['1','3','5'],xs,10,'top','電源側'),...pole(['2','4','6'],xs,h-10,'bottom','負載側')];}
function brk(p,h){const w=18*p,xs=[...Array(p)].map((_,i)=>9+18*i);const up=['1','3','5','7'].slice(0,p),dn=['2','4','6','8'].slice(0,p);return [...pole(up,xs,7,'top','電源側'),...pole(dn,xs,h-7,'bottom','負載側')];}
function mc(h,w=45){const k=w/45,xs=[12*k,22.5*k,33*k];return [...pole(['L1','L2','L3'],xs,7,'top','主接點'),['A1',5,18,'top','線圈'],['13',w-5,18,'top','常開輔助'],
  ...pole(['T1','T2','T3'],xs,h-7,'bottom','主接點'),['A2',5,h-18,'bottom','線圈'],['14',w-5,h-18,'bottom','常開輔助']];}
function mc4(h,w){const xs=[8,18,w-18,w-8];return [...pole(['1','3','R1','R3'],xs,7,'top','主接點'),['A1',5,18,'top','線圈'],...pole(['2','4','R2','R4'],xs,h-7,'bottom','主接點'),['A2',5,h-18,'bottom','線圈']];}
function tor(h){const xs=[12,22.5,33];return [...pole(['L1','L2','L3'],xs,7,'top','主迴路入'),...pole(['T1','T2','T3'],xs,h-7,'bottom','主迴路出'),['95',5,h-16,'bottom','常閉接點'],['96',40,h-16,'bottom','常閉接點']];}
function strip(n){const t=[];for(let i=1;i<=n;i++){const x=4+6*i-3;t.push([i+'上',x,8,'top','端子 '+i]);t.push([i+'下',x,52,'bottom','端子 '+i]);}return t;}
function wago4(n){const t=[];for(let i=1;i<=n;i++){const x=1+5.2*(i-.5);t.push([i+'A',x-1,6,'top','端子 '+i+' 上']);t.push([i+'B',x+1,13,'top','端子 '+i+' 上']);t.push([i+'C',x-1,57,'bottom','端子 '+i+' 下']);t.push([i+'D',x+1,64,'bottom','端子 '+i+' 下']);}return t;}
function wago2(n){const t=[];for(let i=1;i<=n;i++){const x=1+5.2*(i-.5);t.push([i+'A',x,6,'top','端子 '+i+' 上']);t.push([i+'C',x,42.5,'bottom','端子 '+i+' 下']);}return t;}
function nterm(n,pitch,h,side,y){const t=[];for(let i=1;i<=n;i++)t.push([String(i),pitch*(i-.5),y,side,'第 '+i+' 點']);return t;}
// 依外型圖與照片：接點位置對到實物的區塊與順序，不追求接點間的精確距離
function deca(w,h){return [...row(['L1','L2','L3'],7,'top',w,'主接點',9),['13',w*.3,20,'top','常開輔助'],['21',w*.55,20,'top','常閉輔助'],['A1',w*.82,20,'top','線圈'],...row(['T1','T2','T3'],h-7,'bottom',w,'主接點',9),['14',w*.3,h-20,'bottom','常開輔助'],['22',w*.55,h-20,'bottom','常閉輔助'],['A2',w*.82,h-20,'bottom','線圈']];}
function sockMY(w,h,top,up,lo,bot){
  const rowAt=(ids,y,side,desc,sh)=>ids.map((id,i)=>[id,w*(i+.5)/ids.length+sh,y,side,desc]);
  return [...rowAt(top,8,'top','接點',-1.2),...rowAt(up,18,'top','接點',1.2),...rowAt(lo,h-18,'bottom','共點',-1.2),...rowAt(bot,h-8,'bottom','線圈',1.2)];
}
const SOCK8=sockMY(23,72,['4','1'],['8','5'],['12','9'],['14','13']);
const SOCK14=sockMY(31,72,['4','3','2','1'],['8','7','6','5'],['12','11','10','9'],['14','13']);
const SENS3=[['棕',10,8,'top','+24V'],['藍',25,8,'top','0V'],['黑',40,8,'top','輸出']];
const LOOK={dark:['#2f3437','#f1f2ee'],mid:['#54595b','#f1f2ee'],gray:['#a9adaa','#15181a'],light:['#e3e1d6','#23211a'],blue:['#2c3f4e','#eef3f5'],red:['#7a2a2a','#fff3f1'],steel:['#8e9794','#10140f']};
/* ---------- 器具庫：[inv, 分類, 廠牌, 名稱, 寬, 高, 深, 字首, 外殼, 接點, 其他] 尺寸為參考值 ---------- */
const TPL={};
function def(id,inv,cat,b,n,w,h,d,pre,look,terms,x={}){TPL[id]={inv:[].concat(inv||[]),cat,b,n,w,h,d,pre,f:LOOK[look][0],i:LOOK[look][1],t:terms,sheet:x.sheet||'plate',gen:x.gen||null,cnt:x.cnt||null,cntLabel:x.cntLabel||null,noOv:!!x.noOv,round:!!x.round,legacy:!!x.legacy,front:!!x.front,jumper:!!x.jumper,tagAt:x.tagAt||null,links:x.links||null,sym:x.sym||null,model:!!x.model,coil:!!x.coil,vlab:x.vlab||null,hostCat:x.hostCat||null,at:x.at||null,deco:x.deco||null,bus:!!x.bus,attach:x.attach||(x.front?'front':null),note:x.note||''};}
const C1='斷路器',C2='電磁接觸器',C3='繼電器／計時',C4='PLC',C5='伺服驅動',C6='電源／濾波',C7='端子台／接地',C8='網路／插座',C9='其他元件',D1='面板：按鈕與顯示',F1='現場：馬達',F2='現場：感測器',F3='現場：接線盒與其他';
def('fuji-bw50',null,C1,'FUJI','BW50EAG 3P50A',75,100,84,'Q','dark',[...pole(['1','3','5'],[12.5,37.5,62.5],10,'top','電源側'),...pole(['2','4','6'],[12.5,37.5,62.5],90,'bottom','負載側')]);
[['3P40A',3],['3P16A',3],['3P4A',3],['2P4A',2],['1P6A',1],['1P4A',1],['1P2A',1],['1P1A',1]].forEach(([r,p])=>def('ic60-'+r,null,C1,'施耐德','iC60N '+r,18*p,85,78.5,'Q','light',brk(p,85)));
def('gv2me16',null,C1,'施耐德','GV2ME16 9-14A',45,89,78.5,'QM','dark',nfb(45,89));
def('gv2me32',null,C1,'施耐德','GV2ME32 24-32A',45,89,78.5,'QM','dark',nfb(45,89));
def('lc1d09',null,C2,'施耐德','LC1D09BL DC24V',45,77,95,'K','dark',deca(45,77));
def('lc1d18',null,C2,'施耐德','LC1D18BL DC24V',45,77,95,'K','dark',deca(45,77));
def('lc1d38',null,C2,'施耐德','LC1D38BL DC24V',45,85,101,'K','dark',deca(45,85));
def('lc1d258',null,C2,'施耐德','LC1D258BL DC24V 2NO+2NC',45,91,107,'K','dark',[...row(['1','R1','R3','3'],7,'top',45,'主接點',7),['A1',37,20,'top','線圈'],...row(['2','R2','R4','4'],84,'bottom',45,'主接點',7),['A2',37,71,'bottom','線圈']]);
def('ladn40',null,C2,'施耐德','LADN40 輔助 4A',43.9,47,36.2,'KX','mid',[...pole(['53','63','73','83'],[5.9,16.4,27,37.6],9.6,'top','常開'),...pole(['54','64','74','84'],[5.9,16.4,27,37.6],37.4,'bottom','常開')],{note:'裝在接觸器正面：拖到電磁接觸器上會自動裝上，深度與接觸器相加',front:true});
def('cu11',null,C2,'TECO','CU-11 AC220V',45,70,82,'K','light',[...pole(['L1','L2','L3','13'],[6.75,17.25,27.75,38.25],7,'top','主接點／輔助'),...pole(['T1','T2','T3','14'],[6.75,17.25,27.75,38.25],63,'bottom','主接點／輔助'),['A1',4,24,'top','線圈'],['A2',4,46,'bottom','線圈']],{note:'線圈接點位置未從照片確認'});
def('sp16',null,C2,'士林','S-P16 AC220V',53,81,83.5,'K','light',[...pole(['L1','L2','L3'],[9,21,33],10,'top','主接點'),['A2',16,3,'top','線圈'],['A1',28,3,'top','線圈'],['13',46,8,'top','常開輔助'],['21',46,18,'top','常閉輔助'],...pole(['T1','T2','T3'],[9,21,33],71,'bottom','主接點'),['14',46,63,'bottom','常開輔助'],['22',46,73,'bottom','常閉輔助']]);
def('my2n-24',null,C3,'OMRON','MY2N DC24V＋PYF08A 座',23,72,66,'KA','blue',SOCK8,{note:'台製座的接點編號以實物為準'});
def('my2n-220',null,C3,'OMRON','MY2N AC220V＋PYF08A 座',23,72,66,'KA','blue',SOCK8,{note:'台製座的接點編號以實物為準'});
def('pyf14a',null,C3,'OMRON','PYF14A 座（MY4 用）',31,72,66,'KA','blue',SOCK14);
def('ly4n',null,C3,'OMRON','LY4N-J DC24V＋PTF14A 座',45.5,78.5,65,'KA','blue',sockMY(45.5,78.5,['4','3','2','1'],['8','7','6','5'],['12','11','10','9'],['14','13']),{note:'清單沒有這個座，尺寸與接點依 PTF14A'});
def('ly2j',null,C3,'OMRON','LY2J＋PTF08A 座',28.5,78.5,65,'KA','blue',sockMY(28.5,78.5,['4','1'],['6','3'],['5','2'],['8','7']),{note:'清單沒有這個座，尺寸與接點依 PTF08A'});
def('fotek',null,C3,'FOTEK','MY-6S-2P 計時 6s AC220V',23,72,80,'T','mid',SOCK8,{note:'接點依 MY 座推定'});
def('g6d',null,C3,'bore','G6D-OC16V 繼電器模組 16P',121.3,86,40,'RM','steel',[...row(['C+','C-','1','2','3','4','5','6','7','8'],8,'top',121.3,'輸出',6),...row(['9','10','11','12','13','14','15','16'],78,'bottom',121.3,'輸出',6)],{note:'尺寸依同型商品圖'});
def('pnoz',null,C3,'PILZ','PNOZ X2.8P 安全繼電器',22.5,94,121,'SR','light',[...row(['A1','13','23','33'],6,'top',22.5,'電源／安全接點',3),...row(['S52','S34','41','42'],14,'top',22.5,'回授／輔助',4),...row(['S11','S12','S21','S22'],80,'bottom',22.5,'輸入',4),...row(['A2','14','24','34'],88,'bottom',22.5,'電源／安全接點',3)]);
const FX5U_I=['L','N','FG','S/S','0V','24V',...['0','1','2','3','4','5','6','7','10','11','12','13','14','15','16','17'].map(x=>'X'+x)];
const FX5U_O=['COM0','Y0','Y1','Y2','Y3','COM1','Y4','Y5','Y6','Y7','COM2','Y10','Y11','Y12','Y13','COM3','Y14','Y15','Y16','Y17'];
// 依端子排列圖：上下各兩排錯開，後排比前排右移半格；空白格（•）不放接點
const FX5U_ROW=(ids,x0,y,side,desc)=>ids.map((id,i)=>id&&[id,+(x0+11*i).toFixed(2),y,side,desc(id)]).filter(Boolean);
const FX5U_D=id=>/^X/.test(id)?'輸入':/^Y/.test(id)?'輸出':/^COM/.test(id)?'輸出共點':id==='FG'?'接地':id==='S/S'?'輸入共點':'電源';
def('fx5u32',null,C4,'三菱','FX5U-32MT/ES',150,90,83,'PLC','dark',[
  ...FX5U_ROW(['FG','S/S','0V','X0','X2','X4','X6','X10','X12','X14','X16',null],17,5,'top',FX5U_D),
  ...FX5U_ROW(['L','N',null,'24V','X1','X3','X5','X7','X11','X13','X15','X17'],10.9,11,'top',FX5U_D),
  ...FX5U_ROW(['Y0','Y2',null,'Y4','Y6',null,'Y10','Y12',null,'Y14','Y16',null],17,79,'bottom',FX5U_D),
  ...FX5U_ROW(['COM0','Y1','Y3','COM1','Y5','Y7','COM2','Y11','Y13','COM3','Y15','Y17'],10.9,85,'bottom',FX5U_D),
  ['LAN',44,62,'bottom','內建乙太網路埠（RJ45）'],
  // 左側：內置類比量端子（上，接線從上方插入）與內置 RS-485 端子（下，通道 1，接線從下方插入），各 5 極歐式端子
  ...[['V1+','類比輸入 1'],['V2+','類比輸入 2'],['V-','類比輸入共點'],['VO+','類比輸出 V+'],['VO-','類比輸出 V-']].map(([id,d],i)=>[id,15.1+3.1*i,20,'top',d]),
  ...[['SG','RS-485 SG（GND）'],['SDB','RS-485 SDB（TXD-）'],['SDA','RS-485 SDA（TXD+）'],['RDB','RS-485 RDB（RXD-）'],['RDA','RS-485 RDA（RXD+）']].map(([id,d],i)=>[id,15.1+3.1*i,66,'bottom',d]),
],{note:'端子位置依端子排列圖，上下各兩排錯開；左側上方類比量、下方 RS-485（通道 1）；網路埠在左側黑色面板下方（依外型圖估算）；通道 2 的擴充板另外從器具庫拖到 PLC 上',vlab:['V1+','V2+','V-','VO+','VO-','SG','SDB','SDA','RDB','RDA']});
// FX5-232-BD：RS-232 擴充板，裝在 FX5U 正面中間（通道 2）。D-sub 9 針（公），7～9 腳不使用不畫
def('fx5-232bd',null,C4,'三菱','FX5-232-BD RS-232 擴充板',38,51.4,6.6,'BD','dark',[
  ...[['CD','1','CD（DCD）'],['RD','2','RD（RXD）'],['SD','3','SD（TXD）'],['ER','4','ER（DTR）'],['SG','5','SG（GND）']].map(([id,n,d],i)=>[id,+(6.1+3.8*i).toFixed(1),40.8,'bottom',`第${n}腳 ${d}`]),
  ['DR',8,44.7,'bottom','第6腳 DR（DSR）']],
  {front:true,hostCat:C4,at:{fx5u32:{x:60,y:17}},vlab:['CD','RD','SD','ER','SG','DR'],note:'拖到 FX5U 上會自動裝在正面中間（通道 2），跟著 PLC 移動；D-sub 9 針，7～9 腳不使用；深度依外型圖凸出約 6.6 mm'});
// FX5-16EX：兩排錯開的端子，接點文字在左邊；出線先往左偏到端子文字左側，中線以上往上、中線以下往下。
// 往上的越下面的接點偏得越左、往下的越上面的接點偏得越左，彼此不交叉
{const T=[...[['S/S',7.1],['1',14.3],['3',21.4],['5',28.6],['6',35.7],['7',42.9],['10',50.4],['11',57.5],['13',64.7],['15',71.8],['17',79]].map(([id,y])=>[id,29,y]),...[['0',10.9],['2',17.9],['4',25],['12',61.1],['14',68.3],['16',75.4]].map(([id,y])=>[id,36,y])];
 const up=T.filter(t=>t[2]<45).sort((a,b)=>a[2]-b[2]),dn=T.filter(t=>t[2]>=45).sort((a,b)=>b[2]-a[2]);
 const ex=new Map();up.forEach((t,i)=>ex.set(t[0],21-i*1.3));dn.forEach((t,i)=>ex.set(t[0],21-i*1.3));
 def('fx516ex',null,C4,'三菱','FX5-16EX/ES 16IN',40,90,83,'EX','dark',T.map(([id,x,y])=>[id,x,y,y<45?'top':'bottom',id==='S/S'?'輸入共點':'輸入',{ox:+(ex.get(id)-x).toFixed(2),oy:0,ls:'right'}]),{note:'接點位置依端子排列示意圖，左右兩排錯開；出線往左偏再上下出線'});}
def('fx54ad',null,C4,'三菱','FX5-4AD-ADP 4CH 類比',17.6,106,74,'AD','dark',['V1+','I1+','COM1','V2+','I2+','COM2','V3+','I3+','COM3','V4+','I4+','COM4','FG'].map((id,i)=>[id,8,28.8+i*4.29,'right',id==='FG'?'接地':'類比輸入']),{note:'24V 由 CPU 內部供電，模組上沒有電源端子；本體深 74 mm，含上方突出部 89.1 mm'});
def('fx540ssc',null,C4,'三菱','FX5-40SSC-S 4軸運動',50,90,83,'SSC','dark',[...[['24V',6],['0V',13],['FG',20]].map(([id,x])=>[id,x,83,'bottom',id==='FG'?'接地':'電源']),['SSCNET',37.5,80,'bottom','正面接頭']],{note:'DIN 軌中心在高度正中；電源端子在左下，SSCNET 在右下'});
// 伺服電池：掛在驅動器下方（依 MR-J4-200B 外型圖：距左緣 6 mm、高 21 mm），只有一個接頭
def('mrbat6v1',null,C5,'三菱','MR-BAT6V1SET 伺服電池',38.5,21,0,'BT','dark',[['BAT',19.3,11,'top','電池接頭（接驅動器 CN4）']],{attach:'below',note:'拖到伺服驅動器上會自動裝上：MR-J4-700B 裝在正面右側 CN4 附近，MR-JE-40B 裝在正面電池座，其他掛在下方距左緣 6 mm；跟著驅動器移動；側視長度約 69.3 mm'});
// 同一顆電池裝在 MR-J4-700B 正面時看到的是 21×69.3 那一面；不列在器具庫，裝上時自動換用
def('mrbat6v1-f',null,C5,'三菱','MR-BAT6V1SET 伺服電池',21,69.3,0,'BT','dark',[['BAT',10.5,64,'bottom','電池接頭（接驅動器 CN4）']],{attach:'below',legacy:true,note:'裝在 MR-J4-700B 正面'});
def('mrbat6v1-je',null,C5,'三菱','MR-BAT6V1SET 伺服電池',22.6,49,0,'BT','dark',[['BAT',11.3,10,'top','電池接頭（接驅動器 CN4）']],{attach:'below',legacy:true,note:'裝在 MR-JE-40B 正面電池座（CN1A、CN1B 左邊）'});
const SVT=['L1','L2','L3','P+','C','D','L11','L21'],SVB=['U','V','W','PE','CN1A','CN1B','CN2','CN3','CN4'];
def('j4700',null,C5,'三菱','MR-J4-700B 7kW',172,300,200,'SV','blue',[...[['L1',25.3],['L2',40],['L3',53.3],['P+',66.1],['C',81.3],['U',94.7],['V',107.2],['W',120.5]].map(([id,x])=>[id,x,277.8,'bottom','TE1 主迴路 M4']),['L11',136,277.8,'bottom','TE2 控制電源 M3.5'],['L21',147.2,277.8,'bottom','TE2 控制電源 M3.5'],...[['N-',24],['P3',50.7],['P4',64]].map(([id,x])=>[id,x,249.8,'bottom','TE3 M4']),['PE',38.7,296,'bottom','接地 M4'],['PE2',53.3,296,'bottom','接地 M4'],...[['CN5',47.2],['CN3',68.5],['CN8',91.2],['CN1A',106.4],['CN1B',128.5],['CN2',149.9],['CN2L',160.5],['CN4',171.2]].map(([id,y])=>[id,151,y,'right','正面接頭'])],{note:'端子台在正面蓋板內；前方接頭需預留約 80 mm；上方排氣、下方吸氣'});
def('j4200',null,C5,'三菱','MR-J4-200B 2kW',90,168,195,'SV','blue',[...['L1','L2','L3','N-','P3','P4'].map((id,i)=>[id,16.7,31.8+i*7.8,'top','CNP1']),...['P+','C','D','L11','L21'].map((id,i)=>[id,14.5,80+i*4.85,'top','CNP2']),...['U','V','W'].map((id,i)=>[id,17.4,123.5+i*8.85,'bottom','CNP3']),['PE',20.9,162.4,'bottom','接地 M4'],['CN5',76,26.4,'right','正面接頭'],['CN3',73,52,'right','正面接頭'],['CN8',73,74.6,'right','正面接頭'],['CN1A',73,85.9,'right','正面接頭'],['CN1B',73,100,'right','正面接頭'],['CN2',73,135.7,'right','正面接頭'],['CN2L',73,145,'right','正面接頭'],['CN4',73,157.6,'right','正面接頭']],{note:'前方接頭需預留約 80 mm；底部冷卻風扇吸氣'});
def('je40',null,C5,'三菱','MR-JE-40B 400W',50,168,135,'SV','blue',[...['L1','L2','L3','P+','C','U','V','W'].map((id,i)=>[id,37,109.8+i*4.89,'bottom','CNP1']),['E',37,149,'bottom','CNP1 接地'],['PE',39,157.9,'bottom','接地 M4'],['CN5',25.3,3,'top','正面接頭'],['CN4',17.2,22,'left','正面接頭'],['CN3',37.8,24.2,'right','正面接頭'],['CN1A',37.8,52.9,'right','正面接頭'],['CN1B',37.8,75.6,'right','正面接頭'],['CN2',37.8,94.7,'right','正面接頭'],['R1',12,109,'top','內置回生電阻（示意）'],['R2',12,159,'bottom','內置回生電阻（示意）']],{note:'前方接頭需預留約 80 mm；左下 R1、R2 為內置回生電阻示意',deco:[{k:'res',x:9,y:120,w:6,h:28,a:109,b:159,label:'內置電阻'}]});
def('drl120',null,C6,'台達','DRL-24V120W 電源',30,123.6,116.8,'PS','steel',[...row(['L','N','FG'],115,'bottom',30,'AC 輸入',6),...row(['+V1','+V2','-V1','-V2'],9,'top',30,'DC 24V',4)]);
def('fn3270',null,C6,'SCHAFFNER','FN3270H-50 3P50A 濾波',85,170,80,'FL','steel',[...row(['L1','L2','L3','PE'],10,'top',85,'LINE',12),...row(['L1\'','L2\'','L3\'','PE\''],160,'bottom',85,'LOAD',12)]);
def('fn2010',null,C6,'SCHAFFNER','FN2010-10-06 1φ10A 濾波',35,64,29.3,'FL','steel',[['L',2,21.5,'left','LINE'],['PE',2,32,'left','接地'],['N',2,42.5,'left','LINE'],['L\'',33,21.5,'right','LOAD'],['N\'',33,42.5,'right','LOAD']],{note:'6.3 mm 快速端子，左右各突出本體約 10 mm；LINE、LOAD 方向以實物標示為準'});
def('w2202-1401',null,C7,'WAGO','2202-1401 端子台 2對2',0,69.9,39.5,'X','gray',null,{gen:n=>({w:5.2*n+2,h:69.9,t:wago4(n)}),cnt:12,cntLabel:'片數',jumper:true});
def('w2202-1201',null,C7,'WAGO','2202-1201 端子台 1對1',0,48.5,39.5,'X','gray',null,{gen:n=>({w:5.2*n+2,h:48.5,t:wago2(n)}),cnt:10,cntLabel:'片數',jumper:true});
def('w2202-1611',null,C7,'WAGO','2202-1611 保險絲端子台',0,48,45,'FU','gray',null,{gen:n=>({w:5.2*n+2,h:48,t:wago2(n)}),cnt:3,cntLabel:'片數'});
def('nht60',null,C7,'賀電','NHT-60 電木端子台 3P',60,50,35,'TB','dark',[...row(['L1','L2','L3'],8,'top',60,'電源側',10),...row(['T1','T2','T3'],42,'bottom',60,'負載側',10)],{links:[['L1','T1'],['L2','T2'],['L3','T3']]}); // 同一極上下兩端同電位
def('gnd13',null,C7,'','接地銅板 13P',104,18,15,'E','steel',nterm(13,8,18,'top',9),{bus:true});
def('gnd15',null,C7,'','接地銅板 15P',120,18,15,'E','steel',nterm(15,8,18,'top',9),{bus:true});
def('mec10',null,C7,'賀電','MEC-15-53 短路銅片 10P',80,14,8,'E','steel',nterm(10,8,14,'top',7));
[['231-604 針型 4極',4],['231-104 孔型 4極',4],['231-606 針型 6極',6],['231-106 孔型 6極',6],['231-612 針型 12極',12],['231-112 孔型 12極',12]].forEach(([n,p])=>def('w'+n.slice(0,7),null,C7,'WAGO',n,5*p+2,18,20,'CN','gray',nterm(p,5,18,'top',9)));
def('w852-111',null,C8,'WAGO','852-111 交換器 5埠 100M',23.4,109.2,73.8,'SW','gray',[['24V',4,6,'top','電源（上方）'],['0V',11.7,6,'top','電源（上方）'],['FG',19.4,6,'top','接地'],...['P1','P2','P3','P4','P5'].map((id,i)=>[id,12,28+i*16,'right','正面網路埠'])]);
def('w852-1111',null,C8,'WAGO','852-1111 交換器 5埠 1000M',23.4,109.2,73.8,'SW','gray',[['24V',4,6,'top','電源（上方）'],['0V',11.7,6,'top','電源（上方）'],['FG',19.4,6,'top','接地'],...['P1','P2','P3','P4','P5'].map((id,i)=>[id,12,28+i*16,'right','正面網路埠'])]);
def('ac30',null,C8,'CHNT','AC30-124 軌道插座 16A',35,76,42,'XS','light',[['E',17.5,7,'top','接地'],['N',10,69,'bottom',''],['L',25,69,'bottom',''],['插頭',24,54,'right','插座口：外部插頭插在這裡（示意）']],{note:'尺寸依同系列 AC30-103 商品頁（手工量測）；中間「插頭」點用來標示外部插頭插進插座的連線'});
def('eoab',null,C8,'Phoenix contact','EO-AB 軌道插座 15A',54,80,50,'XS','light',row(['L','N','E'],8,'top',54,'',12));
def('rxlg',null,C9,'鼎億自動化','RXLG 再生電阻 500W 6.7Ω',60,215,30,'R','steel',row(['P','C'],8,'top',60,'',15));
def('fan4',null,C9,'GULF海灣電氣','風扇 4" 220V',120,38,120,'FAN','dark',[['L',113,12,'right',''],['N',113,26,'right','']],{note:'接點在短邊；畫成側面 120×38 mm（箱內通常裝在側板或門上，不平放在底板）；深度 120 mm'});
def('h66',null,C9,'','H-66 鋁軌',0,35,8,'RL','steel',null,{gen:n=>({w:n,h:35,t:[]}),cnt:300,cntLabel:'長度 mm',noOv:true});
const PB=(no)=>[...row(['X1','X2'],6,'top',30,'指示燈',8),...row(no,35,'bottom',30,'接點',8)];
def('yw1b',null,D1,'IDEC','YW1B-V4E02R 緊急停止 2NC',40,40,46,'ES','red',[...row(['1','2'],8,'top',40,'NC1',10),...row(['1\'','2\''],32,'bottom',40,'NC2',10)],{sheet:'door',round:true});
def('yw1l-r',null,D1,'IDEC','YW1L 照光按鈕 1NC 紅',30,41.4,46,'PB','red',PB(['1','2']),{sheet:'door',round:true});
def('yw1l-g',null,D1,'IDEC','YW1L 照光按鈕 1NO 綠',30,41.4,46,'PB','blue',PB(['3','4']),{sheet:'door',round:true});
def('yw1s',null,D1,'IDEC','YW1S-2E10 選擇開關 1NO',30,41.4,45.8,'SS','dark',row(['3','4'],35,'bottom',30,'接點',8),{sheet:'door',round:true,note:'面板前方突出 24 mm；面板厚 0.8～6 mm'});
// 金屬開關：1、2 是 NC（常閉），3、4 是 NO（常開），+、- 是指示燈
const PY2201_T=()=>[...row(['1','2','+'],7,'top',25,'',4),...row(['3','4','-'],18,'bottom',25,'',4)].map(t=>(t[4]={'1':'NC 常閉','2':'NC 常閉','3':'NO 常開','4':'NO 常開','+':'指示燈 +','-':'指示燈 −'}[t[0]],t));
def('py2201-g',null,D1,'','PY2201A-24G 金屬開關 綠光 Ø22',25,25,37,'SB','blue',PY2201_T(),{sheet:'door',round:true,note:'1NO/1NC 環形 LED；接點編號以實物為準'});
def('py2201-r',null,D1,'','PY2201A-24R 金屬開關 紅光 Ø22',25,25,37,'SB','red',PY2201_T(),{sheet:'door',round:true,note:'1NO/1NC 環形 LED；接點編號以實物為準'});
def('gs2107',null,D1,'三菱','GS2107 人機 7"',206,155,50,'HMI','dark',row(['24V','0V','FG','LAN'],10,'bottom',206,'',30),{sheet:'door'});
def('nextech',null,D1,'Nextech','AP 21.5" 圖控介面 DC12V',511.2,314.9,70,'HMI','dark',[['DC-IN',140.4,306.9,'bottom','12V DC 接頭'],['LAN1',475.5,306.9,'bottom','RJ45 GbE'],['LAN2',454.9,306.9,'bottom','RJ45 GbE'],['COM1',358.1,306.9,'bottom','RS232'],['COM2',265.6,306.9,'bottom','RS232'],['COM3',244.6,306.9,'bottom','RS232'],['COM4',222.6,306.9,'bottom','RS232']],{sheet:'door',note:'前框 531.2×334.9、背面本體 511.2×314.9；RK3588、Android 14；底部 I/O：RJ45×2、HDMI、USB 3.0×4、RS232×4、12V DC-IN、On/Off（C14 AC 輸入為選配）；I/O 位置依照片估計，面板內側看左右相反；深度圖上未標示'});
def('lk3214',null,D1,'隆光','LK3214K 二連插座',49,89,30,'XS','light',row(['L','N','E'],8,'top',49,'',8),{sheet:'door'});
def('hgsr702',null,F1,'三菱','HG-SR702BJK 7kW',130,70,0,'M','dark',[...row(['U','V','W','E'],8,'top',70,'動力',8),['B1',84,8,'top','煞車'],['B2',96,8,'top','煞車'],['ENC',118,8,'top','編碼器']],{sheet:'field'});
def('hgsr202',null,F1,'三菱','HG-SR202JK 2kW',110,60,0,'M','dark',[...row(['U','V','W','E'],8,'top',70,'動力',8),['ENC',96,8,'top','編碼器']],{sheet:'field'});
def('hgkn43',null,F1,'三菱','HG-KN43BJK 400W',110,50,0,'M','dark',[...row(['U','V','W','E'],8,'top',56,'動力',6),['B1',66,8,'top','煞車'],['B2',78,8,'top','煞車'],['ENC',98,8,'top','編碼器']],{sheet:'field'});
def('field-power',null,F1,'','外部電源進線 3P',90,40,0,'PWR','mid',row(['R','S','T','E'],8,'top',90,'電源',12),{sheet:'field'});
def('e2e',null,F2,'OMRON','E2E-X8B1D18 近接 2線',50,30,0,'SQ','steel',[['棕',15,8,'top','+'],['藍',35,8,'top','-']],{sheet:'field'});
def('d4mc',null,F2,'OMRON','D4MC-5020 極限 1A1B',60,35,0,'LS','steel',row(['11','12','23','24'],8,'top',60,'',8),{sheet:'field'});
def('pzg102',null,F2,'基恩斯','PZ-G102B 光電',50,30,0,'PH','steel',SENS3,{sheet:'field'});
def('pzg101',null,F2,'基恩斯','PZ-G101P 光電 PNP',50,30,0,'PH','steel',SENS3,{sheet:'field'});
def('eesx676',null,F2,'OMRON','EE-SX676P-WR 光電素子 PNP',50,30,0,'PH','steel',SENS3,{sheet:'field'});
def('eespx302',null,F2,'OMRON','EE-SPX302 光電素子 NPN',50,30,0,'PH','steel',SENS3,{sheet:'field'});
def('qlnp',null,F2,'','QL-NP 訊號轉換 NPN→PNP',60,30,0,'CV','steel',row(['+','-','IN','OUT'],8,'top',60,'',8),{sheet:'field'});
// 光柵與量測光柵：接收器（RX）與投光器（TX）各一台，接點依配線圖用線色命名
const GRATING=[['棕','+24V'],['藍','0V'],['黑','輸出 1（接 PLC 輸入）'],['白','輸出 2（接 PLC 輸入）'],['灰','同步（接另一台的灰線）'],['SHD','隔離網（接地）']];
const MEASURE=[['棕','+24V'],['藍','0V'],['黑','RS-232 輸出（接 PLC RS-232 第 2 腳）'],['白','同步（接另一台的白線）'],['綠','接地']];
def('glr22',null,F2,'基恩斯','GL-R22L 光柵 接收器 RX',60,40,0,'LC','steel',row(GRATING.map(x=>x[0]),8,'top',60,'',6).map((t,i)=>(t[4]=GRATING[i][1],t)),{sheet:'field'});
def('glr22-t',null,F2,'基恩斯','GL-R22L 光柵 投光器 TX',60,40,0,'LC','steel',row(GRATING.map(x=>x[0]),8,'top',60,'',6).map((t,i)=>(t[4]=['黑','白'].includes(t[0])?'未使用':GRATING[i][1],t)),{sheet:'field'});
def('ga096',null,F2,'斯邁德','GA0-96H 量測光柵 接收器 RX',60,40,0,'LC','steel',row(MEASURE.map(x=>x[0]),8,'top',60,'',7).map((t,i)=>(t[4]=MEASURE[i][1],t)),{sheet:'field'});
def('ga096-t',null,F2,'斯邁德','GA0-96H 量測光柵 投光器 TX',60,40,0,'LC','steel',row(MEASURE.map(x=>x[0]),8,'top',60,'',7).map((t,i)=>(t[4]=t[0]==='黑'?'未使用':MEASURE[i][1],t)),{sheet:'field'});
def('tb10',null,F3,'ETAN','TB-PG-10P 接線盒',86,40,0,'JB','mid',nterm(10,8,40,'top',8),{sheet:'field'});
def('tb15',null,F3,'ETAN','TB-PG-15P 接線盒',126,40,0,'JB','mid',nterm(15,8,40,'top',8),{sheet:'field'});
def('ths62',null,F3,'天得','THS-62 吊車接線盒',60,60,0,'CB','light',row(['1','2','3','4','5','6'],8,'top',60,'',6),{sheet:'field'});
// 舊版範例用的器具，只為了能讀回舊暫存，不列在器具庫
const LEG={legacy:true};
def('sch_mc',null,C2,'施耐德','TeSys D 接觸器',45,85,100,'K','dark',mc(85),LEG);def('sch_tor',null,C2,'施耐德','LRD 積熱電驛',45,65,90,'F','mid',tor(65),LEG);def('sch_gv',null,C1,'施耐德','GV2 馬達保護',45,90,97,'Q','dark',nfb(45,90),LEG);
def('sl_mc',null,C2,'士林','S-P 接觸器',45,85,85,'K','light',mc(85),LEG);def('sl_tor',null,C2,'士林','TH-P 積熱電驛',45,65,85,'F','light',tor(65),LEG);def('sl_nfb',null,C1,'士林','BM 無熔絲 3P',75,130,68,'Q','dark',nfb(75,130),LEG);
def('me_mc',null,C2,'三菱','S-T 接觸器',45,85,85,'K','gray',mc(85),LEG);def('me_tor',null,C2,'三菱','TH-T 積熱電驛',45,65,85,'F','gray',tor(65),LEG);def('me_nf',null,C1,'三菱','NF 無熔絲 3P',75,130,68,'Q','dark',nfb(75,130),LEG);
def('wg_10',null,C7,'WAGO','2002 端子台 10 片',68,60,35,'X','gray',strip(10),LEG);def('wg_20',null,C7,'WAGO','2002 端子台 20 片',128,60,35,'X','gray',strip(20),LEG);
def('wg_rl',null,C3,'WAGO','788 繼電器',22,70,60,'KA','steel',[['A1',6,7,'top','線圈'],['A2',16,7,'top','線圈'],['11',4,63,'bottom','共點'],['12',11,63,'bottom','常閉'],['14',18,63,'bottom','常開']],LEG);
def('de_plc',null,C4,'台達','DVP PLC 14 點',170,100,80,'PLC','blue',[...['S/S','X0','X1','X2','X3','X4','X5','X6','X7','24V','0V'].map((id,i)=>[id,15+i*14,9,'top',i===0?'輸入共點':i>8?'電源':'輸入']),...['C0','Y0','Y1','Y2','Y3','Y4','Y5','C1'].map((id,i)=>[id,20+i*18,91,'bottom',id[0]==='C'?'輸出共點':'輸出'])],LEG);
def('de_ps',null,C6,'台達','24V 電源供應器',70,120,110,'PS','steel',[['L',15,9,'top','AC 輸入'],['N',35,9,'top','AC 輸入'],['FG',55,9,'top','接地'],['+V',20,111,'bottom','DC 輸出'],['-V',50,111,'bottom','DC 輸出']],LEG);
const DUCTINV=[['線槽 65×65','PVC-65x65x1700mm',65,65],['線槽 45×65','PVC-45x65x1700mm',45,65],['線槽 33×65','PVC-33x65x1700mm',33,65]];
const GLANDINV=['M40 浪管接頭','M32 浪管接頭','M25 浪管接頭','M20 電纜固定頭','M20-14 電纜固定頭'];
// 尺寸核對狀態：2 原廠資料，1 網路商品頁或同系列資料；沒列的都是未核對。接點排列目前都沒有查到可讀的原廠圖。
const VER={'nextech':[1,'外型圖'],'ac30':[1,'同系列商品頁'],'j4200':[2,'Mitsubishi 外型圖'],'fx516ex':[2,'Mitsubishi 外型圖'],'fn2010':[2,'Schaffner 規格表'],'ladn40':[1,'外型圖'],'yw1s':[1,'IDEC 外型圖'],'lk3214':[1,'商品頁，標示僅供參考'],'gv2me16':[2,'Schneider 規格表'],'gv2me32':[2,'Schneider 規格表'],'lc1d38':[2,'Schneider 規格表'],'fx5u32':[2,'Mitsubishi 產品頁'],'j4700':[2,'Mitsubishi 產品頁'],'drl120':[2,'Delta 產品頁'],'w2202-1401':[2,'WAGO 規格表'],'w2202-1201':[2,'WAGO 規格表'],'pnoz':[2,'Pilz 手冊'],
  'fuji-bw50':[1,'外型圖'],'cu11':[1,'商品尺寸圖'],'sp16':[1,'型錄表'],'ic60-3P40A':[1,'商品頁資料'],'ic60-3P16A':[1,'同系列商品頁資料'],'ic60-3P4A':[1,'同系列商品頁資料'],'ic60-2P4A':[1,'由每極 18 mm 推算'],'ic60-1P6A':[1,'由每極 18 mm 推算'],'ic60-1P4A':[1,'由每極 18 mm 推算'],'ic60-1P2A':[1,'由每極 18 mm 推算'],'ic60-1P1A':[1,'由每極 18 mm 推算'],
  'lc1d09':[1,'同框架資料'],'lc1d18':[1,'商品頁與規格表片段'],'lc1d258':[1,'商品頁資料'],'je40':[2,'Mitsubishi 外型圖'],'fn3270':[1,'Schaffner 表格與 Mouser'],'w852-111':[1,'商品頁資料'],'w852-1111':[1,'高度來自商品頁，寬深依同系列'],'yw1l-g':[1,'外型圖與商品頁'],'yw1l-r':[1,'同系列外型圖'],'yw1b':[1,'外型圖，深度為面板後方'],'gs2107':[1,'單一商品頁資料'],'my2n-24':[1,'PYF08A 外型圖'],'my2n-220':[1,'PYF08A 外型圖'],'pyf14a':[1,'PYF14A 外型圖片段'],'ly4n':[1,'PTF14A 外型圖'],'ly2j':[1,'PTF08A 外型圖'],'g6d':[1,'同型商品圖'],'fx540ssc':[2,'Mitsubishi 外型圖'],'fx5-232bd':[2,'Mitsubishi 外型圖'],'fx54ad':[2,'Mitsubishi 外型圖'],'py2201-g':[1,'商品外型圖'],'py2201-r':[1,'商品外型圖']};
// 接點位置看過照片或外型圖的器具
const TERM_OK=new Set(['ladn40','fx516ex','fx54ad','fn2010','fuji-bw50','lc1d09','lc1d18','lc1d38','lc1d258','cu11','sp16','gv2me16','gv2me32','my2n-24','my2n-220','pyf14a','ly4n','ly2j','pnoz','fx5u32','j4700','j4200','je40','drl120','w2202-1401','w2202-1201','w852-111','w852-1111','yw1l-g','yw1l-r','py2201-g','py2201-r','ic60-3P40A','ic60-3P16A','ic60-3P4A','ic60-2P4A','ic60-1P6A','ic60-1P4A','ic60-1P2A','ic60-1P1A']);
function verText(id,t){if(t.ok)return '已對照型錄或實物';const v=VER[id];return v?(v[0]===2?'原廠資料：':'參考：')+v[1]:'未核對';}
function resolveTpl(id,count){
  const b=(S&&S.tpls&&S.tpls[id])||TPL[id];if(!b) return null;
  if(!b.gen){if(!b.terms)b.terms=(b.t||[]).map(([id2,x,y,side,desc,ex])=>({id:id2,x,y,side,desc,...(ex||{})}));return b;}
  const c=count||b.cnt,k=id+'|'+c;
  if(!resolveTpl.m.has(k)){const g=b.gen(c);resolveTpl.m.set(k,{...b,gen:b.gen,w:g.w,h:g.h,terms:g.t.map(([i2,x,y,side,desc])=>({id:i2,x,y,side,desc}))});}
  return resolveTpl.m.get(k);
}
resolveTpl.m=new Map();
// 二極體：A（陽極）、K（陰極），本體畫二極體符號，型號可以每台自訂（材料表照型號列，預設「二極體」）
def('diode',null,C9,'','二極體',20,18,8,'D','light',[['A',3,13.5,'left','陽極'],['K',17,13.5,'right','陰極']],{sym:'diode',model:true,note:'通用二極體，自己拉線接；方向：電流從 A 流向 K'});
// 線圈二極體（飛輪二極體）：拖到繼電器座或接觸器上自動裝上，並自動接到線圈兩端（K 接 +、A 接 −）
def('diode-coil',null,C3,'','二極體（線圈用）',8,18,0,'D','light',[['K',4,3,'top','陰極：接線圈 +'],['A',4,15,'bottom','陽極：接線圈 −']],{sym:'diode',model:true,coil:true,front:true,note:'拖到繼電器座或接觸器上會自動裝上並接到線圈兩端（K 接 +、A 接 −），拆下時自動接的兩條線一起移除；只能用在直流線圈'});
// 一整排很密的接點（伺服驅動器的 CNP 接頭）：出線先橫移到旁邊的空白走線帶，再依器具中線往上或往下出線，
// 往上的越下面的接點偏得越遠、往下的越上面的接點偏得越遠，彼此不交叉；接點文字放在另一側（和 16EX 同樣做法）
function laneExit(id,ids,lane,x0,step,allDown){
  const T=TPL[id];if(!T||!T.t)return;const mid=allDown?-1:T.h/2,tu=T.t.filter(t=>ids.includes(t[0]));
  const up=tu.filter(t=>t[2]<mid).sort((a,b)=>a[2]-b[2]),dn=tu.filter(t=>t[2]>=mid).sort((a,b)=>b[2]-a[2]),dir=lane==='left'?-1:1;
  [up,dn].forEach(g=>g.forEach((t,i)=>{const x=x0+dir*i*step;t[3]=t[2]<mid?'top':'bottom';t[5]={ox:+(x-t[1]).toFixed(2),oy:0,ls:lane==='left'?'left':'right'};}));
}
// 伺服驅動器：全部往下出線
laneExit('j4200',['L1','L2','L3','N-','P3','P4','P+','C','D','L11','L21','U','V','W','PE'],'left',11,.7,true);
laneExit('je40',['L1','L2','L3','P+','C','U','V','W','E','PE'],'left',33,1,true);
// 各接點各自的說明（原本一排共用「A／B」合併說明，容易誤導）
function termDesc(id,map){const T=TPL[id];if(!T||!T.t)return;T.t.forEach(t=>{if(map[t[0]]!=null)t[4]=map[t[0]];});}
termDesc('cu11',{L1:'主接點',L2:'主接點',L3:'主接點',T1:'主接點',T2:'主接點',T3:'主接點','13':'輔助接點 NO','14':'輔助接點 NO'});
termDesc('pnoz',{A1:'電源 +24V',A2:'電源 0V','13':'安全接點 NO','14':'安全接點 NO','23':'安全接點 NO','24':'安全接點 NO','33':'安全接點 NO','34':'安全接點 NO','41':'輔助接點 NC','42':'輔助接點 NC',S52:'重置迴路',S34:'重置迴路'});
// THS-62 吊掛式按鈕盒：上下、左右兩組各自互鎖，兩組的共通線（型錄 1）內部相通，所以只有一個 COM。
// 接點名稱照功能，說明裡寫型錄編號；四個功能點放在對應按鈕旁邊，順序和按鈕一樣
def('ths62',null,F3,'','THS-62 吊掛式按鈕盒 上下左右',60,175.5,50,'PB','light',[
  ['COM',30,6,'top','共通線（型錄 1，兩組相通）'],
  ['上',52,56,'right','↑ 上（第一組 2，控制 1）'],['下',52,86,'right','↓ 下（第一組 3，控制 2）'],
  ['左',52,116,'right','← 左（第二組 2，控制 1）'],['右',52,146,'right','→ 右（第二組 3，控制 2）']],
  {sheet:'field',tagAt:{x:30,y:28},note:'外形 60×175.5 mm（不含上方出線套管，總長 300 mm），深 50 mm；上下一組、左右一組各自互鎖，同一組不能同時導通',
   deco:[{k:'btn',x:30,y:56,dir:'up'},{k:'btn',x:30,y:86,dir:'down'},{k:'btn',x:30,y:116,dir:'left'},{k:'btn',x:30,y:146,dir:'right'}]});

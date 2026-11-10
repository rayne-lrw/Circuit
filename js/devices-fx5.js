"use strict";
/* ---------- 三菱 MELSEC iQ-F（FX5S／FX5UJ／FX5U／FX5UC 與增設設備） ----------
   資料來源：MELSEC iQ-F FX5S/FX5UJ/FX5U/FX5UC 用戶手冊（硬體篇）SH(NA)-082453CHN-K
   - 外形尺寸照手冊外形尺寸圖；端子名稱、順序、上下排錯開、空端子、共點分組照手冊端子排列圖
   - 端子在器具上的實際 mm 位置手冊沒有標：照排列圖等距估算（相對位置正確，距離是大概）
   - 增設模組的接點用模組內的編號（X0～、Y0～）；實際位址依接在第幾台而定
   已經有的型號不重做：FX5U-32MT/ES（fx5u32）、FX5-16EX/ES（fx516ex）、FX5-40SSC-S、FX5-232-BD、FX5-4AD-ADP */
(function(){
const MIT='三菱',SRC='三菱 FX5 硬體手冊 外形尺寸圖',NOTE='接點名稱、順序、共點分組依手冊端子排列圖；端子實際位置依排列圖等距估算';
// 八進位編號：0～7、10～17…（跳過 8、9）
const oct=(a,b)=>{const o=[];for(let v=a;v<=b;v++)if(!/[89]/.test(String(v)))o.push(v);return o;};
// 一排端子：數字承接前一個 X／Y 開頭的名稱（手冊寫法「X0 2 4 6」）；「.」是空端子；「|」是兩組端子台中間的空隙
function tok(row,pre){const out=[];row.trim().split(/\s+/).forEach(t=>{if(t==='|'){out.push('|');return;}if(t==='.'){out.push(null);return;}
  if(/^[XY]\d+$/.test(t)){pre=t[0];out.push(t);return;}if(/^\d+$/.test(t)){out.push(pre+t);return;}out.push(t);});return out;}
const DESC=raw=>{const id=String(raw).replace(/\(\d+\)$/,'');return /^X/.test(id)?'輸入':/^Y/.test(id)?'輸出':/^(COM\d|\+V)/.test(id)?'輸出共點':/^COM$/.test(id)?'輸入共點':/^S\/S/.test(id)?'輸入共點':id==='FG'?'接地':/^(24V|0V)/.test(id)?'DC24V 供給電源':/^[LN]$/.test(id)?'AC 電源':/^[+-]$/.test(id)?'DC24V 電源':'';};
// 同名端子（手冊上同名、內部相通）：第二個起改名「名稱(2)」並設為器具內部同電位
function dedup(list){const seen=new Map(),links=[];list.forEach(t=>{const id=t[0],c=(seen.get(id)||0)+1;seen.set(id,c);if(c>1){t[0]=id+'('+c+')';let g=links.find(g=>g[0]===id);if(!g){g=[id];links.push(g);}g.push(t[0]);}});return links;}
// 橫式端子台（CPU、電源內置 I/O）：上方兩排、下方兩排，每排上下錯開半格
function hTerms(W,H,R,desc=DESC){
  const rows={tu:tok(R.tu,'X'),tl:tok(R.tl,'X'),bu:tok(R.bu,'Y'),bl:tok(R.bl,'Y')},n=Math.max(...Object.values(rows).map(a=>a.length)),m=10,p=(W-2*m)/(n-.5),T=[];
  const put=(a,y,side,sh)=>a.forEach((id,i)=>{if(id&&id!=='|')T.push([id,+(m+sh+p*i).toFixed(2),y,side,desc(id)]);});
  put(rows.tu,5,'top',p/2);put(rows.tl,11,'top',0);put(rows.bu,H-11,'bottom',p/2);put(rows.bl,H-5,'bottom',0);
  return {T,links:dedup(T)};
}
// 直式端子台（增設 I/O）：左右兩排錯開，接點文字在右邊；出線先往左偏，中線以上往上、以下往下（和 FX5-16EX/ES 一樣）
function vTerms(L,R,desc=DESC){
  const T=[...L.map(([id,k])=>[id,29,+(7.1+7.15*k).toFixed(2)]),...R.map(([id,k])=>[id,36,+(7.1+7.15*(k+.5)).toFixed(2)])].filter(t=>t[0]&&t[0]!=='.');
  const up=T.filter(t=>t[2]<45).sort((a,b)=>a[2]-b[2]),dn=T.filter(t=>t[2]>=45).sort((a,b)=>b[2]-a[2]),ex=new Map();
  up.forEach((t,i)=>ex.set(t[0],21-i*1.3));dn.forEach((t,i)=>ex.set(t[0],21-i*1.3));
  const out=T.map(([id,x,y])=>[id,x,y,y<45?'top':'bottom',desc(id),{ox:+(ex.get(id)-x).toFixed(2),oy:0,ls:'right'}]);
  return {T:out,links:dedup(out)};
}
// 連接器／彈簧夾端子：每組兩欄針腳，由上往下；多組連接器左右排（FX5UC 64、96 點）
function pinTerms(W,groups,desc=DESC){
  const T=[],pp=2.6;
  groups.forEach(g=>g.cols.forEach((col,ci)=>col.forEach((id,ri)=>{if(id&&id!=='.')T.push([id,+(g.x+ci*pp).toFixed(2),+(g.y+ri*pp).toFixed(2),'right',desc(id)]);})));
  return {T,links:dedup(T)};
}
// 動作資料：電源、DC24V 供給電源、PLC 輸入（依輸入共點分組）、PLC 輸出（依輸出共點分組）
function simOf(T,{pwr,svc,cpu,xin,yout}){
  const ids=new Set(T.map(t=>t[0])),sim=[];
  if(pwr)sim.push({k:'pwr',a:pwr[0],b:pwr[1]});
  if(svc&&ids.has('24V')&&ids.has('0V'))sim.push({k:'src',p:'24V',n:'0V',v:'24V',in:pwr});
  (xin||[]).forEach(([com,pts])=>{const P=pts.filter(x=>ids.has(x));if(P.length&&ids.has(com))sim.push({k:'plcX',com,pts:P,...(cpu?{cpu:true}:{})});});
  const pairs=[];(yout||[]).forEach(([com,ys])=>ys.forEach(y=>{if(ids.has(y)&&ids.has(com))pairs.push([y,com]);}));
  if(pairs.length)sim.push({k:'plcY',pairs,...(cpu?{cpu:true}:{})});
  return sim;
}
const X=(a,b)=>oct(a,b).map(v=>'X'+v),Y=(a,b)=>oct(a,b).map(v=>'Y'+v);
const ess=(g,s)=>s?g.map(([c,y])=>[c.replace(/^COM(\d)/,'+V$1'),y]):g;
const essRow=(r,s)=>s?r.replace(/COM(\d)/g,'+V$1'):r;
function cpu(id,ser,name,W,H,D,R,o){
  const {T,links}=hTerms(W,H,R);
  def(id,null,C4,MIT,name,W,H,D,'PLC','dark',T,{ser,links:links.length?links:null,note:NOTE+'；'+o.note,
    sim:simOf(T,{pwr:o.ac?['L','N']:['+','-'],svc:o.ac,cpu:true,xin:[['S/S',X(0,77)]],yout:o.yout})});
  VER[id]=[2,SRC];
}

/* ---------- CPU：端子排列（上上、上下、下上、下下四排） ---------- */
const g4=n=>{const out=[];for(let i=0;i<n;i++){const a=Math.floor(i/2)*10+(i%2)*4;out.push(['COM'+i,Y(a,a+3)]);}return out;};
// FX5U
const FX5U={
  32:{W:150,tu:'FG S/S 0V X0 2 4 6 X10 12 14 16 .',tl:'L N . 24V 1 3 5 7 11 13 15 17',tud:'FG S/S . X0 2 4 6 X10 12 14 16 .',tld:'+ - . . 1 3 5 7 11 13 15 17',
    bu:'Y0 2 . Y4 6 . Y10 12 . Y14 16 .',bl:'COM0 1 3 COM1 5 7 COM2 11 13 COM3 15 17',g:g4(4)},
  64:{W:220,tu:'FG S/S 0V 0V X0 2 4 6 X10 12 14 16 X20 22 24 26 X30 32 34 36 .',tl:'L N . 24V 24V 1 3 5 7 11 13 15 17 21 23 25 27 31 33 35 37',
    tud:'FG S/S . . X0 2 4 6 X10 12 14 16 X20 22 24 26 X30 32 34 36 .',tld:'+ - . . . 1 3 5 7 11 13 15 17 21 23 25 27 31 33 35 37',
    bu:'Y0 2 . Y4 6 . Y10 12 . Y14 16 . Y20 22 24 26 Y30 32 34 36 COM5',bl:'COM0 1 3 COM1 5 7 COM2 11 13 COM3 15 17 COM4 21 23 25 27 31 33 35 37',g:[...g4(4),['COM4',Y(20,27)],['COM5',Y(30,37)]]},
  80:{W:285,tu:'FG S/S 0V 0V X0 2 4 6 X10 12 14 16 | . X20 22 24 26 . X30 32 34 36 . X40 42 44 46 .',tl:'L N . 24V 24V 1 3 5 7 11 13 15 | 17 . 21 23 25 27 . 31 33 35 37 . 41 43 45 47',
    tud:'FG S/S . . X0 2 4 6 X10 12 14 16 | . X20 22 24 26 . X30 32 34 36 . X40 42 44 46 .',tld:'+ - . . . 1 3 5 7 11 13 15 | 17 . 21 23 25 27 . 31 33 35 37 . 41 43 45 47',
    bu:'Y0 2 . Y4 6 . Y10 12 . Y14 16 . Y20 22 24 26 | . . Y30 32 34 36 . Y40 42 44 46 .',bl:'COM0 1 3 COM1 5 7 COM2 11 13 COM3 15 17 COM4 21 23 25 | 27 . COM5 31 33 35 37 COM6 41 43 45 47',
    g:[...g4(4),['COM4',Y(20,27)],['COM5',Y(30,37)],['COM6',Y(40,47)]]}};
// FX5S（AC 電源型下排有 DC24V 供給電源 0V／24V；DC 電源型是空端子）
const FX5S={
  30:{W:100,tu:'FG S/S 1 3 5 7 11 13 15 17',tl:'L N X0 2 4 6 X10 12 14 16',bu:'0V Y0 2 COM1 5 7 Y10 12 Y13 15',bl:'24V COM0 1 3 Y4 6 COM2 11 COM3 14',
    g:[['COM0',Y(0,3)],['COM1',Y(4,7)],['COM2',Y(10,12)],['COM3',Y(13,15)]]},
  40:{W:130,tu:'FG S/S 1 3 5 7 11 13 15 17 21 23 25 27',tl:'L N X0 2 4 6 X10 12 14 16 X20 22 24 26',bu:'0V Y0 2 . Y4 6 . Y10 12 . Y14 16 .',bl:'24V COM0 1 3 COM1 5 7 COM2 11 13 COM3 15 17',g:g4(4)},
  60:{W:175,tu:'FG S/S 1 3 5 7 11 13 15 17 21 23 25 27 31 33 35 37 41 43',tl:'L N X0 2 4 6 X10 12 14 16 X20 22 24 26 X30 32 34 36 X40 42',
    bu:'0V Y0 2 . Y4 6 . Y10 12 . Y14 16 . Y20 22 . Y24 26 .',bl:'24V COM0 1 3 COM1 5 7 COM2 11 13 COM3 15 17 COM4 21 23 COM5 25 27',g:g4(6)},
  80:{W:235,tu:'FG S/S 1 3 5 7 11 13 15 17 21 23 25 | 27 31 33 35 37 41 43 45 47 51 53 55 57',tl:'L N X0 2 4 6 X10 12 14 16 X20 22 24 | 26 X30 32 34 36 X40 42 44 46 X50 52 54 56',
    bu:'0V Y0 2 . Y4 6 . Y10 12 . Y14 16 . | . Y20 22 . Y24 26 . Y30 32 . Y34 36 .',bl:'24V COM0 1 3 COM1 5 7 COM2 11 13 COM3 15 17 | . COM4 21 23 COM5 25 27 COM6 31 33 COM7 35 37',g:g4(8)}};
// FX5UJ
const FX5UJ={
  24:{W:95,tu:'FG S/S 1 3 5 7 11 13 15',tl:'L N X0 2 4 6 X10 12 14',bu:'0V Y0 2 Y3 5 Y6 10 .',bl:'24V COM0 1 COM1 4 COM2 7 11',
    g:[['COM0',['Y0','Y1','Y2']],['COM1',['Y3','Y4','Y5']],['COM2',['Y6','Y7','Y10','Y11']]]},
  40:{W:130,tu:'FG S/S 1 3 5 7 11 13 15 17 21 23 25 27',tl:'L N X0 2 4 6 X10 12 14 16 X20 22 24 26',bu:'0V Y0 2 . Y4 6 . Y10 12 . Y14 16 .',bl:'24V COM0 1 3 COM1 5 7 COM2 11 13 COM3 15 17',g:g4(4)},
  60:{W:175,tu:FX5S[60].tu,tl:FX5S[60].tl,bu:FX5S[60].bu,bl:FX5S[60].bl,g:g4(6)}};
// 產生 6 種：MR/ES、MT/ES、MT/ESS（AC 電源）、MR/DS、MT/DS、MT/DSS（DC 電源）
const KINDS=[['MR/ES',1,0,'AC 電源、繼電器輸出'],['MT/ES',1,0,'AC 電源、電晶體 sink 輸出'],['MT/ESS',1,1,'AC 電源、電晶體 source 輸出'],['MR/DS',0,0,'DC 電源、繼電器輸出'],['MT/DS',0,0,'DC 電源、電晶體 sink 輸出'],['MT/DSS',0,1,'DC 電源、電晶體 source 輸出']];
const svcOff=r=>r.replace(/^0V /,'. ').replace(/^24V /,'. '); // DC 電源型沒有 DC24V 供給電源
const acToDc=r=>r.replace(/^L N /,'+ - ');
[['FX5U',FX5U,'FX5U',83,90],['FX5S',FX5S,'FX5S',79,90],['FX5UJ',FX5UJ,'FX5UJ',83,90]].forEach(([fam,TB,ser,D,H])=>Object.entries(TB).forEach(([pts,M])=>KINDS.forEach(([k,ac,s,txt])=>{
  const name=`${fam}-${pts}${k}`,id=('fx'+fam.slice(2)+'-'+pts+k.replace('/','-')).toLowerCase();if(id==='fx5u-32mt-es')return; // 已有 fx5u32
  const R=ac?{tu:M.tu,tl:M.tl,bu:essRow(M.bu,s),bl:essRow(M.bl,s)}:{tu:M.tud||M.tu,tl:M.tld||acToDc(M.tl),bu:essRow(fam==='FX5U'?M.bu:svcOff(M.bu),s),bl:essRow(fam==='FX5U'?M.bl:svcOff(M.bl),s)};
  cpu(id,ser,name,M.W,H,D,R,{ac,yout:ess(M.g,s),note:`${txt}；輸入 sink／source 看 S/S 接法`});})));

/* ---------- FX5UC：連接器型、彈簧夾端子型（DC24V 電源連接器 +、−、接地） ---------- */
function uc(id,name,W,D,conns,o){
  const pw=[['+',4,74,'left','DC24V 電源（紅）'],['-',4,77,'left','DC24V 電源（黑）'],['FG',4,80,'left','接地（綠）']];
  const {T,links}=pinTerms(W,conns);const all=[...pw,...T];
  def(id,null,C4,MIT,name,W,90,D,'PLC','dark',all,{ser:'FX5UC',links:links.length?links:null,note:NOTE+'；'+o.note,
    sim:simOf(all,{pwr:['+','-'],cpu:true,xin:o.xin,yout:o.yout})});
  VER[id]=[2,SRC];
}
const colPair=(a,b,com,pre)=>[[...(pre==='X'?X(a,a+7):Y(a,a+7)),com,'.'],[...(pre==='X'?X(a+10,a+17):Y(a+10,a+17)),com,'.']];
// 連接器：右側直排，上面輸入、下面輸出；64、96 點的連接器左右並排
const ucConn=(W,n,inCom,outCom)=>{const g=[];for(let c=0;c<n;c++){const x=W-7-(n-1-c)*6.5;g.push({x,y:12,cols:colPair(c*20,c*20,inCom(c),'X')});g.push({x,y:50,cols:colPair(c*20,c*20,outCom(c),'Y')});}return g;};
[[32,42.1,1],[64,62.2,2],[96,82.3,3]].forEach(([p,W,n])=>{
  const xs=c=>X(c*20,c*20+17),ys=c=>Y(c*20,c*20+17),r=[...Array(n).keys()];
  uc(`fx5uc-${p}mt-d`,`FX5UC-${p}MT/D`,W,89.1,ucConn(W,n,()=>'COM',c=>'COM'+c),{note:'連接器型（輸入、輸出各 20 針）、電晶體 sink 輸出、輸入 sink 專用；輸入的 COM 全部內部相通',
    xin:[['COM',r.flatMap(xs)]],yout:r.map(c=>['COM'+c,ys(c)])});
  uc(`fx5uc-${p}mt-dss`,`FX5UC-${p}MT/DSS`,W,89.1,ucConn(W,n,c=>'COM'+c,c=>'+V'+c),{note:'連接器型（輸入、輸出各 20 針）、電晶體 source 輸出、輸入 sink／source',
    xin:r.map(c=>['COM'+c,xs(c)]),yout:r.map(c=>['+V'+c,ys(c)])});});
// 彈簧夾端子型
const tsCols=(a,com,pre)=>[[...(pre==='X'?X(a,a+7):Y(a,a+7)),com],[...(pre==='X'?X(a+10,a+17):Y(a+10,a+17)),com]];
uc('fx5uc-32mt-ds-ts','FX5UC-32MT/DS-TS',48.1,93.7,[{x:38,y:12,cols:tsCols(0,'S/S','X')},{x:38,y:50,cols:tsCols(0,'COM0','Y')}],{note:'彈簧夾端子型、電晶體 sink 輸出、輸入 sink／source',xin:[['S/S',X(0,17)]],yout:[['COM0',Y(0,17)]]});
uc('fx5uc-32mt-dss-ts','FX5UC-32MT/DSS-TS',48.1,93.7,[{x:38,y:12,cols:tsCols(0,'S/S','X')},{x:38,y:50,cols:tsCols(0,'+V0','Y')}],{note:'彈簧夾端子型、電晶體 source 輸出、輸入 sink／source',xin:[['S/S',X(0,17)]],yout:[['+V0',Y(0,17)]]});
// 繼電器型：每點兩個端子（內部相通）
const dbl=(ids,com)=>[[...ids,com],[...ids,com]];
uc('fx5uc-32mr-ds-ts','FX5UC-32MR/DS-TS',68.2,93.7,[{x:46,y:12,cols:dbl(X(0,7),'S/S0')},{x:55,y:12,cols:dbl(X(10,17),'S/S1')},{x:46,y:50,cols:dbl(Y(0,7),'COM0')},{x:55,y:50,cols:dbl(Y(10,17),'COM1')}],
  {note:'彈簧夾端子型、繼電器輸出、每點兩個端子內部相通；輸入 X0～7 共點 S/S0、X10～17 共點 S/S1',xin:[['S/S0',X(0,7)],['S/S1',X(10,17)]],yout:[['COM0',Y(0,7)],['COM1',Y(10,17)]]});

/* ---------- 增設 I/O 模組（擴展電纜型，寬 40） ---------- */
function exMod(id,name,L,R,o){
  const {T,links}=vTerms(L,R);
  def(id,null,C4,MIT,name,40,90,83,o.pre||'EX','dark',T,{ser:'FX5 增設',links:links.length?links:null,note:NOTE+'；'+o.note,sim:simOf(T,{xin:o.xin,yout:o.yout})});
  VER[id]=[2,SRC];
}
const LS=(ids,k0=0)=>ids.map((id,i)=>[id,k0+i]);
exMod('fx5-8ex-es','FX5-8EX/ES',[['.',0],['X0',1],['X2',2],['.',8],['X4',9],['X6',10]],[['S/S',0],['X1',1],['X3',2],['.',8],['X5',9],['X7',10]],{note:'8 點輸入、sink／source',xin:[['S/S',X(0,7)]]});
[['fx5-8eyr-es','FX5-8EYR/ES','繼電器輸出',0],['fx5-8eyt-es','FX5-8EYT/ES','電晶體 sink 輸出',0],['fx5-8eyt-ess','FX5-8EYT/ESS','電晶體 source 輸出',1]].forEach(([id,n,txt,s])=>{
  const c0=s?'+V0':'COM0',c1=s?'+V1':'COM1';
  exMod(id,n,[['.',0],['Y0',1],['Y2',2],['.',8],['Y4',9],['Y6',10]],[[c0,0],['Y1',1],['Y3',2],[c1,8],['Y5',9],['Y7',10]],{pre:'EY',note:'8 點'+txt+'，4 點一個共點',yout:[[c0,Y(0,3)],[c1,Y(4,7)]]});});
[['fx5-16eyr-es','FX5-16EYR/ES','繼電器輸出',0],['fx5-16eyt-es','FX5-16EYT/ES','電晶體 sink 輸出',0],['fx5-16eyt-ess','FX5-16EYT/ESS','電晶體 source 輸出',1]].forEach(([id,n,txt,s])=>{
  const c0=s?'+V0':'COM0',c1=s?'+V1':'COM1';
  exMod(id,n,LS([c0,'Y1','Y3','Y5','Y6','Y7','Y10','Y11','Y13','Y15','Y17']),[['Y0',0],['Y2',1],['Y4',2],['Y12',7],['Y14',8],['Y16',9],[c1,10]],{pre:'EY',note:'16 點'+txt+'，8 點一個共點',yout:[[c0,Y(0,7)],[c1,Y(10,17)]]});});
[['fx5-16er-es','FX5-16ER/ES','繼電器輸出',0],['fx5-16et-es','FX5-16ET/ES','電晶體 sink 輸出',0],['fx5-16et-ess','FX5-16ET/ESS','電晶體 source 輸出',1],
 ['fx5-16et-es-h','FX5-16ET/ES-H','高速脈衝、電晶體 sink 輸出（X0～5 200kHz）',0],['fx5-16et-ess-h','FX5-16ET/ESS-H','高速脈衝、電晶體 source 輸出（X0～5 200kHz）',1]].forEach(([id,n,txt,s])=>{
  const c=s?'+V':'COM';
  exMod(id,n,LS(['S/S','X1','X3','X5','X6','X7','Y0','Y1','Y3','Y5','Y7']),[['X0',0],['X2',1],['X4',2],['Y2',7],['Y4',8],['Y6',9],[c,10]],{pre:'EX',note:'8 點輸入（sink／source）＋8 點'+txt,xin:[['S/S',X(0,7)]],yout:[[c,Y(0,7)]]});});

/* ---------- 電源內置輸入輸出模組（寬 150，端子台和 CPU 一樣上下兩排） ---------- */
[['ER/ES',1,0,'AC 電源、繼電器輸出'],['ET/ES',1,0,'AC 電源、電晶體 sink 輸出'],['ET/ESS',1,1,'AC 電源、電晶體 source 輸出'],['ER/DS',0,0,'DC 電源、繼電器輸出'],['ET/DS',0,0,'DC 電源、電晶體 sink 輸出'],['ET/DSS',0,1,'DC 電源、電晶體 source 輸出']].forEach(([k,ac,s,txt])=>{
  const id='fx5-32'+k.replace('/','-').toLowerCase(),R={tu:ac?'FG S/S 0V X0 2 4 6 X10 12 14 16 .':'FG S/S . X0 2 4 6 X10 12 14 16 .',tl:ac?'L N . 24V 1 3 5 7 11 13 15 17':'+ - . . 1 3 5 7 11 13 15 17',
    bu:'Y0 2 . Y4 6 . Y10 12 . Y14 16 .',bl:essRow('COM0 1 3 COM1 5 7 COM2 11 13 COM3 15 17',s)};
  const {T,links}=hTerms(150,90,R);
  def(id,null,C4,MIT,'FX5-32'+k,150,90,83,'EX','dark',T,{ser:'FX5 增設',links:links.length?links:null,note:NOTE+'；電源內置 16 點輸入＋16 點輸出、'+txt,
    sim:simOf(T,{pwr:ac?['L','N']:['+','-'],svc:ac,xin:[['S/S',X(0,17)]],yout:ess(g4(4),s)})});
  VER[id]=[2,SRC];});

/* ---------- 增設 I/O 模組（擴展連接器型、彈簧夾端子型）：針腳兩欄，左欄 0～7、右欄 10～17 ---------- */
function cMod(id,name,W,D,groups,o){
  const {T,links}=pinTerms(W,groups);
  def(id,null,C4,MIT,name,W,90,D,o.pre||'EX','dark',T,{ser:'FX5 增設',links:links.length?links:null,note:NOTE+'；'+o.note,sim:simOf(T,{xin:o.xin,yout:o.yout})});
  VER[id]=[2,SRC];
}
const cx=W=>W-6.5;
// 輸入
cMod('fx5-c16ex-d','FX5-C16EX/D',14.6,87,[{x:cx(14.6),y:25,cols:colPair(0,0,'COM','X')}],{note:'連接器型 16 點輸入、sink 專用；COM 內部相通',xin:[['COM',X(0,17)]]});
cMod('fx5-c16ex-ds','FX5-C16EX/DS',14.6,87,[{x:cx(14.6),y:25,cols:colPair(0,0,'COM0','X')}],{note:'連接器型 16 點輸入、sink／source',xin:[['COM0',X(0,17)]]});
cMod('fx5-c32ex-d','FX5-C32EX/D',20.1,87,[{x:cx(20.1),y:12,cols:colPair(0,0,'COM','X')},{x:cx(20.1),y:50,cols:colPair(20,20,'COM','X')}],{note:'連接器型 32 點輸入、sink 專用；兩組連接器的 COM 全部內部相通；大號碼那組是 X20～37',xin:[['COM',X(0,37)]]});
cMod('fx5-c32ex-ds','FX5-C32EX/DS',20.1,87,[{x:cx(20.1),y:12,cols:colPair(0,0,'COM0','X')},{x:cx(20.1),y:50,cols:colPair(20,20,'COM0','X')}],{note:'連接器型 32 點輸入、sink／source；COM0 全部內部相通；大號碼那組是 X20～37',xin:[['COM0',X(0,37)]]});
cMod('fx5-c32ex-ds-ts','FX5-C32EX/DS-TS',20.1,93.7,[{x:cx(20.1),y:12,cols:tsCols(0,'S/S','X')},{x:cx(20.1),y:50,cols:tsCols(20,'S/S','X')}],{note:'彈簧夾端子型 32 點輸入、sink／source；S/S 全部內部相通；第二組是 X20～37',xin:[['S/S',X(0,37)]]});
// 輸出
cMod('fx5-c16eyr-d-ts','FX5-C16EYR/D-TS',30.7,93.7,[{x:16,y:12,cols:dbl(Y(0,7),'COM0')},{x:16,y:50,cols:dbl(Y(10,17),'COM1')}],{pre:'EY',note:'彈簧夾端子型 16 點繼電器輸出、每點兩個端子內部相通',yout:[['COM0',Y(0,7)],['COM1',Y(10,17)]]});
cMod('fx5-c16eyt-d','FX5-C16EYT/D',14.6,87,[{x:cx(14.6),y:25,cols:colPair(0,0,'COM0','Y')}],{pre:'EY',note:'連接器型 16 點電晶體 sink 輸出',yout:[['COM0',Y(0,17)]]});
cMod('fx5-c16eyt-dss','FX5-C16EYT/DSS',14.6,87,[{x:cx(14.6),y:25,cols:colPair(0,0,'+V0','Y')}],{pre:'EY',note:'連接器型 16 點電晶體 source 輸出',yout:[['+V0',Y(0,17)]]});
cMod('fx5-c32eyt-d','FX5-C32EYT/D',20.1,87,[{x:cx(20.1),y:12,cols:colPair(0,0,'COM0','Y')},{x:cx(20.1),y:50,cols:colPair(20,20,'COM1','Y')}],{pre:'EY',note:'連接器型 32 點電晶體 sink 輸出；大號碼那組是 Y20～37',yout:[['COM0',Y(0,17)],['COM1',Y(20,37)]]});
cMod('fx5-c32eyt-dss','FX5-C32EYT/DSS',20.1,87,[{x:cx(20.1),y:12,cols:colPair(0,0,'+V0','Y')},{x:cx(20.1),y:50,cols:colPair(20,20,'+V1','Y')}],{pre:'EY',note:'連接器型 32 點電晶體 source 輸出；大號碼那組是 Y20～37',yout:[['+V0',Y(0,17)],['+V1',Y(20,37)]]});
cMod('fx5-c32eyt-d-ts','FX5-C32EYT/D-TS',20.1,93.7,[{x:cx(20.1),y:12,cols:tsCols(0,'COM0','Y')},{x:cx(20.1),y:50,cols:tsCols(20,'COM1','Y')}],{pre:'EY',note:'彈簧夾端子型 32 點電晶體 sink 輸出；第二組是 Y20～37',yout:[['COM0',Y(0,17)],['COM1',Y(20,37)]]});
cMod('fx5-c32eyt-dss-ts','FX5-C32EYT/DSS-TS',20.1,93.7,[{x:cx(20.1),y:12,cols:tsCols(0,'+V0','Y')},{x:cx(20.1),y:50,cols:tsCols(20,'+V1','Y')}],{pre:'EY',note:'彈簧夾端子型 32 點電晶體 source 輸出；第二組是 Y20～37',yout:[['+V0',Y(0,17)],['+V1',Y(20,37)]]});
// 輸入輸出
cMod('fx5-c32et-d','FX5-C32ET/D',20.1,87,[{x:cx(20.1),y:12,cols:colPair(0,0,'COM','X')},{x:cx(20.1),y:50,cols:colPair(0,0,'COM0','Y')}],{note:'連接器型 16 點輸入（sink 專用）＋16 點電晶體 sink 輸出',xin:[['COM',X(0,17)]],yout:[['COM0',Y(0,17)]]});
cMod('fx5-c32et-dss','FX5-C32ET/DSS',20.1,87,[{x:cx(20.1),y:12,cols:colPair(0,0,'COM0','X')},{x:cx(20.1),y:50,cols:colPair(0,0,'+V0','Y')}],{note:'連接器型 16 點輸入（sink／source）＋16 點電晶體 source 輸出',xin:[['COM0',X(0,17)]],yout:[['+V0',Y(0,17)]]});
cMod('fx5-c32et-ds-ts','FX5-C32ET/DS-TS',20.1,93.7,[{x:cx(20.1),y:12,cols:tsCols(0,'S/S','X')},{x:cx(20.1),y:50,cols:tsCols(0,'COM0','Y')}],{note:'彈簧夾端子型 16 點輸入（sink／source）＋16 點電晶體 sink 輸出',xin:[['S/S',X(0,17)]],yout:[['COM0',Y(0,17)]]});
cMod('fx5-c32et-dss-ts','FX5-C32ET/DSS-TS',20.1,93.7,[{x:cx(20.1),y:12,cols:tsCols(0,'S/S','X')},{x:cx(20.1),y:50,cols:tsCols(0,'+V0','Y')}],{note:'彈簧夾端子型 16 點輸入（sink／source）＋16 點電晶體 source 輸出',xin:[['S/S',X(0,17)]],yout:[['+V0',Y(0,17)]]});

/* ---------- 擴展轉接器（裝在 CPU 左邊，寬 17.6、高 106） ---------- */
const adp=(ids,desc)=>ids.map((id,i)=>id&&[id,8,+(28.8+i*4.29).toFixed(2),'right',desc(id)]).filter(Boolean);
const PWR3=[['+',8,90,'right','DC24V 電源（+）'],['-',8,93.5,'right','DC24V 電源（−）'],['FG',8,97,'right','接地']];
const anaD=io=>id=>id==='FG'?'接地':/^COM/.test(id)?'公共':/^I\d-?$/.test(id)?'公共輸入':`類比${io}`;
def('fx5-4a-adp',null,C4,MIT,'FX5-4A-ADP 類比 2 入 2 出',17.6,106,74,'AD','dark',[...adp(['V1+','I1+','COM1','V2+','I2+','COM2',null,'V3+','I3+','COM3','V4+','I4+','COM4'],id=>/^[VI][12]/.test(id)?'類比輸入':/^[VI][34]/.test(id)?'類比輸出':'公共'),...PWR3],
  {ser:'FX5 轉接器',note:'CH1、CH2 輸入，CH3、CH4 輸出；電源連接器 DC24V 外部供電；'+NOTE,sim:[{k:'load',a:'+',b:'-',name:'電源',polar:true}]});VER['fx5-4a-adp']=[2,SRC];
def('fx5-4da-adp',null,C4,MIT,'FX5-4DA-ADP 4CH 類比輸出',17.6,106,74,'DA','dark',[...adp(['V1+','I1+','COM1','V2+','I2+','COM2','V3+','I3+','COM3','V4+','I4+','COM4'],anaD('輸出')),...PWR3],
  {ser:'FX5 轉接器',note:'電源連接器 DC24V 外部供電；'+NOTE,sim:[{k:'load',a:'+',b:'-',name:'電源',polar:true}]});VER['fx5-4da-adp']=[2,SRC];
def('fx5-4ad-pt-adp',null,C4,MIT,'FX5-4AD-PT-ADP 4CH 測溫電阻',17.6,106,74,'AD','dark',adp(['L1+','L1-','I1-','L2+','L2-','I2-','L3+','L3-','I3-','L4+','L4-','I4-'],id=>/^I/.test(id)?'測溫電阻公共輸入':'測溫電阻輸入'),
  {ser:'FX5 轉接器',note:'由 CPU 內部供電；'+NOTE});VER['fx5-4ad-pt-adp']=[2,SRC];
def('fx5-4ad-tc-adp',null,C4,MIT,'FX5-4AD-TC-ADP 4CH 熱電偶',17.6,106,74,'AD','dark',adp([null,'L1+','L1-',null,'L2+','L2-',null,'L3+','L3-',null,'L4+','L4-'],()=>'熱電偶輸入'),
  {ser:'FX5 轉接器',note:'由 CPU 內部供電；'+NOTE});VER['fx5-4ad-tc-adp']=[2,SRC];
def('fx5-485adp',null,C4,MIT,'FX5-485ADP RS-485 轉接器',17.6,106,74,'ADP','dark',[['RDA','RXD+'],['RDB','RXD-'],['SDA','TXD+'],['SDB','TXD-'],['SG','信號地']].map(([id,d],i)=>[id,8,72+i*4.3,'right','RS-485 '+d]),
  {ser:'FX5 轉接器',note:'歐式端子排 5 極、內建終端電阻；'+NOTE});VER['fx5-485adp']=[2,SRC];
def('fx5-232adp',null,C4,MIT,'FX5-232ADP RS-232C 轉接器',17.6,106,74,'ADP','dark',[['CD',1],['RD',2],['SD',3],['ER',4],['SG',5],['DR',6]].map(([id,pin],i)=>[id,8,70+i*3.2,'right',`第${pin}腳 ${id}`]),
  {ser:'FX5 轉接器',vlab:['CD','RD','SD','ER','SG','DR'],note:'D-sub 9 針（公），7～9 腳不使用；'+NOTE});VER['fx5-232adp']=[2,SRC];

/* ---------- 擴充板（裝在 CPU 正面，FX5UC 沒有擴充板插槽） ---------- */
const BDHOST=Object.keys(TPL).filter(k=>/^fx5(u|s|uj)-\d+m/.test(k)||k==='fx5u32');
const bdAt=()=>Object.fromEntries(BDHOST.map(k=>{const t=TPL[k];return [k,{x:+Math.max(16,t.w*.4-19).toFixed(1),y:17}];}));
def('fx5-485-bd',null,C4,MIT,'FX5-485-BD RS-485 擴充板',38,51.4,15.4,'BD','dark',[['SDB',21,'TXD-'],['RDB',27,'RXD-'],['SG',15,'信號地'],['SDA',24,'TXD+'],['RDA',30,'RXD+']].map(([id,x,d],i)=>[id,x,i<2?40:46,'bottom','RS-485 '+d]),
  {ser:'FX5 擴充板',front:true,hostCat:C4,at:bdAt(),note:'拖到 FX5U／FX5UJ／FX5S 上會自動裝在正面；歐式端子排 5 極、內建終端電阻；'+NOTE});VER['fx5-485-bd']=[2,SRC];
def('fx5-422-bd-got',null,C4,MIT,'FX5-422-BD-GOT RS-422 擴充板（接 GOT）',38,51.4,15.4,'BD','dark',[['GOT',19,40,'bottom','MINI-DIN 8 針（母），接 GOT']],
  {ser:'FX5 擴充板',front:true,hostCat:C4,at:bdAt(),note:'拖到 FX5U／FX5UJ／FX5S 上會自動裝在正面；'+NOTE});VER['fx5-422-bd-got']=[2,SRC];
// 原本的 FX5-232-BD 也可以裝到新的 CPU 上
if(TPL['fx5-232bd'])TPL['fx5-232bd'].at={...bdAt(),...TPL['fx5-232bd'].at};
// 給 devices-fx3.js 共用
self.FXLIB={oct,tok,DESC,dedup,hTerms,vTerms,pinTerms,simOf};
})();

"use strict";
/* ---------- 三菱 FX3U 系列與 FX2N／FX0N 增設設備、FX 端子模組 ----------
   資料來源：FX3U 系列微型可編程控制器 用戶手冊［硬件篇］（簡體中文版）
   - 外形尺寸照手冊外形尺寸圖；端子名稱、順序、上下排錯開、空端子、共點分組照手冊「端子排列」圖（不照接線示意圖）
   - 端子在器具上的實際 mm 位置手冊沒有標：照排列圖等距估算（相對位置正確，距離是大概）
   - FX2N 擴展單元／模塊在手冊上每 8 點都從 X0（Y0）重新標，這裡依序命名成 X0～7、X10～17…（實際位址看接在第幾台）
   - 同一組通道的端子在手冊上名稱相同（例如每通道都叫 V+），這裡加上通道號（V1+、V2+…）
   - 只有通訊接頭的器具：手冊有針腳表的畫成每支針一個接點；沒有針腳表的整個接頭畫成一個接點 */
(function(){
if(!self.FXLIB)return;
const {oct,tok,DESC,dedup,hTerms,vTerms,pinTerms,simOf}=self.FXLIB;
const MIT='三菱',SRC='三菱 FX3U 硬件手冊 外形尺寸圖',NOTE='接點名稱、順序、共點分組依手冊端子排列圖；端子實際位置依排列圖等距估算';
const X=(a,b)=>oct(a,b).map(v=>'X'+v),Y=(a,b)=>oct(a,b).map(v=>'Y'+v);
// 接點說明：FX5 的說明再補上 FX3U／FX2N 常見的端子
const D3=raw=>{const id=String(raw).replace(/\(\d+\)$/,'');
  if(/^(24\+|24-|24V\+|24V-)$/.test(id))return 'DC24V 電源';if(id==='5+')return 'DC5V 輸入共點';if(/^(SLD|FG)$/.test(id))return '接地／遮蔽';
  if(/^(SG|SGA|SGB|DG|DGND|LG)$/.test(id))return '信號地';if(/^(RDA|RDB|SDA|SDB)$/.test(id))return 'RS-485／422';if(/^(DA|DB)$/.test(id))return 'CC-Link';
  if(/^C2-/.test(id))return 'CN2：'+D3(id.slice(3));return DESC(id);};
const ver=id=>{VER[id]=[2,SRC];};
const linksOf=l=>l&&l.length?l:null;
const pwrLoad=T=>{const ids=new Set(T.map(t=>t[0]));return ids.has('24+')&&ids.has('24-')?[{k:'load',a:'24+',b:'24-',name:'電源',polar:true}]:null;};
// 列字串轉換：DC 電源型（L N → ⊕ ⊖；DC24V 供給電源的 0V／24V 變空端子）；電晶體 source 輸出（COMn → +V(n−1)）
const mapTok=(r,f)=>r.split(/\s+/).map(f).join(' ');
const dcRow=(r,keepSvc)=>mapTok(r.replace(/^L N\b/,'+ -'),t=>!keepSvc&&(t==='0V'||t==='24V')?'.':t);
const essRow=r=>mapTok(r,t=>/^COM\d+$/.test(t)?'+V'+(+t.slice(3)-1):t);
const essG=g=>g.map(([c,ys])=>[/^COM\d+$/.test(c)?'+V'+(+c.slice(3)-1):c,ys]);
// 4 點一組（COM1～4：Y0～3、Y4～7、Y10～13、Y14～17），之後 8 點一組
const g4=()=>[['COM1',Y(0,3)],['COM2',Y(4,7)],['COM3',Y(10,13)],['COM4',Y(14,17)]];
const g8=(c0,a,n)=>[...Array(n).keys()].map(i=>['COM'+(c0+i),Y(a+i*10,a+i*10+7)]);

/* ---------- 多組端子排（64M UA1、80M、128M：上下各兩組錯開，依排列圖像素位置換算） ---------- */
function absTerms(W,H,box,pitch,rows,desc){
  const Y0={tu1:[5,'top'],tl1:[11,'top'],tu2:[17,'top'],tl2:[23,'top'],bu2:[H-23,'bottom'],bl2:[H-17,'bottom'],bu1:[H-11,'bottom'],bl1:[H-5,'bottom']};
  const k=W/(box[1]-box[0]),T=[];
  Object.entries(rows).forEach(([key,[px,str]])=>{const [y,side]=Y0[key];tok(str,key[0]==='t'?'X':'Y').forEach((id,i)=>{if(id&&id!=='|')T.push([id,+((px-box[0]+i*pitch)*k).toFixed(2),y,side,desc(id)]);});});
  return {T,links:dedup(T)};
}

/* ---------- FX3U 基本單元 ---------- */
function base(id,name,W,T,links,o){
  def(id,null,C4,MIT,name,W,90,86,'PLC','dark',T,{ser:'FX3U',links:linksOf(links),note:NOTE+'；'+o.note,
    sim:simOf(T,{pwr:o.ac?['L','N']:['+','-'],svc:o.ac,cpu:true,xin:o.xin,yout:o.yout})});
  ver(id);
}
const KINDS={'MR/ES':[1,0,'AC 電源、繼電器輸出'],'MT/ES':[1,0,'AC 電源、電晶體 sink 輸出'],'MS/ES':[1,0,'AC 電源、SSR（閘流體）輸出'],'MT/ESS':[1,1,'AC 電源、電晶體 source 輸出'],
  'MR/DS':[0,0,'DC 電源、繼電器輸出'],'MT/DS':[0,0,'DC 電源、電晶體 sink 輸出'],'MT/DSS':[0,1,'DC 電源、電晶體 source 輸出']};
const idOf=(fam,pts,k)=>(fam+'-'+pts+k.replace('/','-')).toLowerCase();
// 16M：每個輸出點一個共點；繼電器型手冊把接點兩端都標成同一個 Y（第二個叫 Y0(2)，兩端不是同電位）
['MR/ES','MT/ES','MT/ESS','MR/DS','MT/DS','MT/DSS'].forEach(k=>{const [ac,s,txt]=KINDS[k],mr=/^MR/.test(k);
  const tu='FG S/S 0V X0 2 4 6 . . .',tl='L N . 24V X1 3 5 7 . .',bu='. Y0 1 2 3 4 5 6 7 .';
  const bl=mr?'. Y0 1 2 3 4 5 6 7 .':'. '+[...Array(8).keys()].map(i=>(s?'+V':'COM')+i).join(' ')+' .';
  const R=ac?{tu,tl,bu,bl}:{tu:dcRow(tu),tl:dcRow(tl),bu,bl};
  const {T,links}=hTerms(130,90,R,D3);
  const L=mr?links.filter(g=>!/^Y\d+$/.test(g[0])):links;
  if(mr)T.forEach(t=>{if(/^Y\d+\(2\)$/.test(t[0]))t[4]='輸出（接點另一端）';});
  base(idOf('FX3U',16,k),'FX3U-16'+k,130,T,L,{ac,note:txt+(mr?'；每點獨立接點，兩端都標 Y':'；每點一個共點')+'；輸入 sink／source 看 S/S 接法',
    xin:[['S/S',X(0,7)]],yout:Y(0,7).map((y,i)=>mr?[y+'(2)',[y]]:[(s?'+V':'COM')+i,[y]])});
});
// 32M、48M、64M：一組端子排（上兩排輸入、下兩排輸出）
const B1={
  32:{W:150,tu:'FG S/S 0V X0 2 4 6 X10 12 14 16 .',tl:'L N . 24V X1 3 5 7 X11 13 15 17',bu:'Y0 2 . Y4 6 . Y10 12 . Y14 16 .',bl:'COM1 Y1 3 COM2 Y5 7 COM3 Y11 13 COM4 Y15 17',
    g:g4(),x:X(0,17),k:['MR/ES','MT/ES','MS/ES','MT/ESS','MR/DS','MT/DS','MT/DSS']},
  48:{W:182,tu:'FG S/S 0V X0 2 4 6 X10 12 14 16 X20 22 24 26 .',tl:'L N . 24V X1 3 5 7 X11 13 15 17 X21 23 25 27',bu:'Y0 2 . Y4 6 . Y10 12 . Y14 16 Y20 22 24 26 COM5',
    bl:'COM1 Y1 3 COM2 Y5 7 COM3 Y11 13 COM4 Y15 17 Y21 23 25 27',g:[...g4(),['COM5',Y(20,27)]],x:X(0,27),k:['MR/ES','MT/ES','MT/ESS','MR/DS','MT/DS','MT/DSS']},
  64:{W:220,tu:'FG S/S 0V 0V X0 2 4 6 X10 12 14 16 X20 22 24 26 X30 32 34 36 .',tl:'L N . 24V 24V X1 3 5 7 X11 13 15 17 X21 23 25 27 X31 33 35 37',
    bu:'Y0 2 . Y4 6 . Y10 12 . Y14 16 . Y20 22 24 26 Y30 32 34 36 COM6',bl:'COM1 Y1 3 COM2 Y5 7 COM3 Y11 13 COM4 Y15 17 COM5 Y21 23 25 27 Y31 33 35 37',
    g:[...g4(),...g8(5,20,2)],x:X(0,37),k:['MR/ES','MT/ES','MS/ES','MT/ESS','MR/DS','MT/DS','MT/DSS']}};
Object.entries(B1).forEach(([pts,M])=>M.k.forEach(k=>{const [ac,s,txt]=KINDS[k];
  const R={tu:ac?M.tu:dcRow(M.tu),tl:ac?M.tl:dcRow(M.tl),bu:s?essRow(M.bu):M.bu,bl:s?essRow(M.bl):M.bl};
  const {T,links}=hTerms(M.W,90,R,D3);
  base(idOf('FX3U',pts,k),`FX3U-${pts}${k}`,M.W,T,links,{ac,note:txt+'；輸入 sink／source 看 S/S 接法',xin:[['S/S',M.x]],yout:s?essG(M.g):M.g});}));
// 32M、64M 的 AC 輸入型（MR/UA1）：輸入共點 COM
{const R={tu:'FG . COM COM X0 2 4 6 . . X10 12 14 16 . .',tl:'L N . . . X1 3 5 7 . . X11 13 15 17 .',bu:'Y0 2 . . Y4 6 . . . Y10 12 . . Y14 16 .',bl:'COM1 Y1 3 . COM2 Y5 7 . . COM3 Y11 13 . COM4 Y15 17'};
  const {T,links}=hTerms(182,90,R,D3);
  base('fx3u-32mr-ua1','FX3U-32MR/UA1',182,T,links,{ac:1,note:'AC 電源、AC100V 輸入、繼電器輸出；兩個 COM 內部相通',xin:[['COM',X(0,17)]],yout:g4()});}
{const {T,links}=absTerms(285,90,[195,745],22.5,{
    tu1:[230,'FG . . COM COM X0 2 4 6 . X10 12'],tl1:[219,'L N . . . . X1 3 5 7 . X11'],
    tu2:[385,'X14 16 . . . X20 22 24 26 . . X30 32 34 36 .'],tl2:[375,'X13 15 17 . . . X21 23 25 27 . . X31 33 35 37'],
    bu2:[477,'Y22 24 26 . . . . Y30 32 34 36 .'],bl2:[466,'Y21 23 25 27 . . . COM6 Y31 33 35 37'],
    bu1:[230,'Y0 2 . Y4 6 . . . Y10 12 . Y14 16 . . Y20'],bl1:[210,'COM1 Y1 3 COM2 Y5 7 . . COM3 Y11 13 COM4 Y15 17 . COM5']},D3);
  base('fx3u-64mr-ua1','FX3U-64MR/UA1',285,T,links,{ac:1,note:'AC 電源、AC100V 輸入、繼電器輸出；上下各兩組端子排錯開',xin:[['COM',X(0,37)]],yout:[...g4(),...g8(5,20,2)]});}
// 80M、128M：上下各兩組端子排
const B2={
  80:{W:285,box:[190,738],p:22.3,g:[...g4(),...g8(5,20,3)],x:X(0,47),k:['MR/ES','MT/ES','MT/ESS','MR/DS','MT/DS','MT/DSS'],rows:{
    tu1:[225,'FG S/S 0V 0V X0 2 4 6 X10 12 14 16'],tl1:[214,'L N . 24V 24V X1 3 5 7 X11 13 15'],
    tu2:[381,'. X20 22 24 26 . X30 32 34 36 . X40 42 44 46 .'],tl2:[369,'X17 . X21 23 25 27 . X31 33 35 37 . X41 43 45 47'],
    bu2:[470,'. . Y30 32 34 36 . Y40 42 44 46 .'],bl2:[459,'Y27 . COM6 Y31 33 35 37 COM7 Y41 43 45 47'],
    bu1:[225,'Y0 2 . Y4 6 . Y10 12 . Y14 16 . Y20 22 24 26'],bl1:[214,'COM1 Y1 3 COM2 Y5 7 COM3 Y11 13 COM4 Y15 17 COM5 Y21 23 25']}},
  128:{W:350,box:[15,1235],p:44.5,g:[...g4(),...g8(5,20,6)],x:X(0,77),k:['MR/ES','MT/ES','MT/ESS'],rows:{
    tu1:[45,'FG S/S 0V 0V X0 2 4 6 X10 12 14 16 X20 22 24 26'],tl1:[20,'L N . 24V 24V X1 3 5 7 X11 13 15 17 X21 23 25'],
    tu2:[243,'X30 32 34 36 X40 42 44 46 X50 52 54 56 X60 62 64 66 X70 72 74 76 .'],tl2:[222,'X27 X31 33 35 37 X41 43 45 47 X51 53 55 57 X61 63 65 67 X71 73 75 77'],
    bu2:[465,'Y44 46 COM8 Y51 53 55 57 Y60 62 64 66 COM10 Y71 73 75 77'],bl2:[445,'Y43 45 47 Y50 52 54 56 COM9 Y61 63 65 67 Y70 72 74 76'],
    bu1:[42,'Y0 2 COM2 Y5 7 Y10 12 COM4 Y15 17 Y20 22 24 26 COM6 Y31 33 35 37 Y40 42'],bl1:[20,'COM1 Y1 3 Y4 6 COM3 Y11 13 Y14 16 COM5 Y21 23 25 27 Y30 32 34 36 COM7 Y41']}}};
Object.entries(B2).forEach(([pts,M])=>M.k.forEach(k=>{const [ac,s,txt]=KINDS[k];
  const rows=Object.fromEntries(Object.entries(M.rows).map(([key,[px,r]])=>[key,[px,key[0]==='t'?(ac?r:dcRow(r)):(s?essRow(r):r)]]));
  const {T,links}=absTerms(M.W,90,M.box,M.p,rows,D3);
  base(idOf('FX3U',pts,k),`FX3U-${pts}${k}`,M.W,T,links,{ac,note:txt+'；上下各兩組端子排錯開；輸入 sink／source 看 S/S 接法',xin:[['S/S',M.x]],yout:s?essG(M.g):M.g});}));

/* ---------- FX2N 擴展單元（內建電源） ---------- */
function unit(id,name,W,R,o){
  const {T,links}=hTerms(W,90,R,D3),sim=simOf(T,{pwr:o.ac?['L','N']:['+','-'],svc:o.ac,xin:o.xin,yout:o.yout});
  if(o.ac&&o.svc24)sim.splice(1,0,{k:'src',p:'24+',n:'COM',v:'24V',in:['L','N']});
  def(id,null,C4,MIT,name,W,90,87,'EX','dark',T,{ser:'FX2N 擴展單元',links:linksOf(links),note:NOTE+'；'+o.note,sim});ver(id);
}
const U={32:{W:150,x:X(0,17),g:g4(),bu:B1[32].bu,bl:B1[32].bl,tuS:B1[32].tu,tlS:B1[32].tl,tu:'FG . COM X0 2 4 6 X10 12 14 16 .',tl:'L N . 24+ X1 3 5 7 X11 13 15 17'},
  48:{W:182,x:X(0,27),g:[...g4(),['COM5',Y(20,27)]],bu:B1[48].bu,bl:B1[48].bl,tuS:B1[48].tu,tlS:B1[48].tl,tu:'FG . COM X0 2 4 6 X10 12 14 16 X20 22 24 26 .',tl:'L N . 24+ X1 3 5 7 X11 13 15 17 X21 23 25 27'}};
[['32ER-ES/UL',32,1,0,1,'繼電器輸出'],['48ER-ES/UL',48,1,0,1,'繼電器輸出'],['48ER-DS',48,0,0,1,'DC 電源、繼電器輸出'],
 ['32ET-ESS/UL',32,1,1,1,'電晶體 source 輸出'],['48ET-ESS/UL',48,1,1,1,'電晶體 source 輸出'],['48ET-DSS',48,0,1,1,'DC 電源、電晶體 source 輸出'],
 ['32ER',32,1,0,0,'繼電器輸出'],['48ER',48,1,0,0,'繼電器輸出'],['48ER-D',48,0,0,0,'DC 電源、繼電器輸出'],['32ET',32,1,0,0,'電晶體 sink 輸出'],['48ET',48,1,0,0,'電晶體 sink 輸出'],
 ['48ET-D',48,0,0,0,'DC 電源、電晶體 sink 輸出'],['32ES',32,1,0,0,'SSR（閘流體）輸出']].forEach(([k,p,ac,s,es,txt])=>{const M=U[p];
  const tu=es?M.tuS:M.tu,tl=es?M.tlS:M.tl,R={tu,tl:ac?tl:tl.replace(/^L N\b/,'+ -'),bu:s?essRow(M.bu):M.bu,bl:s?essRow(M.bl):M.bl};
  unit(('fx2n-'+k.replace(/\//g,'-')).toLowerCase(),'FX2N-'+k,M.W,R,{ac,svc24:!es,xin:[[es?'S/S':'COM',M.x]],yout:s?essG(M.g):M.g,
    note:(ac?'AC 電源、':'')+txt+(es?'；輸入 sink／source 看 S/S 接法':'；輸入 sink 專用（COM 是輸入共點，也是 24+ 供給電源的 0V）')+'；手冊上每 8 點從 X0／Y0 重標，這裡依序編號'});});
unit('fx2n-48er-ua1-ul','FX2N-48ER-UA1/UL',220,{tu:'FG . COM COM X0 2 4 6 . . X10 12 14 16 . . X20 22 24 26 .',tl:'L N . . . X1 3 5 7 . . X11 13 15 17 . . X21 23 25 27',
  bu:'Y0 2 . Y4 6 . . . Y10 12 . Y14 16 . . . Y20 22 24 26 .',bl:'COM1 Y1 3 COM2 Y5 7 . . COM3 Y11 13 COM4 Y15 17 . . COM5 Y21 23 25 27'},
  {ac:1,xin:[['COM',X(0,27)]],yout:[...g4(),['COM5',Y(20,27)]],note:'AC 電源、AC100V 輸入、繼電器輸出；兩個 COM 內部相通'});

/* ---------- FX2N 擴展模塊（無電源，直式端子） ---------- */
function mod(id,name,W,L,R,o){
  const {T,links}=vTerms(L,R,D3);let lk=links;
  if(o.pairY){lk=links.filter(g=>!/^Y\d+$/.test(g[0]));T.forEach(t=>{if(/^Y\d+\(2\)$/.test(t[0]))t[4]='輸出（接點另一端）';});}
  def(id,null,C4,MIT,name,W,90,87,o.pre||'EX','dark',T,{ser:'FX2N 擴展模塊',links:linksOf(lk),note:NOTE+'；'+o.note,sim:simOf(T,{xin:o.xin,yout:o.yout})});ver(id);
}
const LS=(ids,k0=0)=>ids.map((id,i)=>[id,k0+i]);
const in8=c=>[[['.',0],['X0',1],['X2',2],['.',8],['X4',9],['X6',10]],[[c,0],['X1',1],['X3',2],['.',8],['X5',9],['X7',10]]];
const in16=c=>[LS([c,'X1','X3','X5','X6','X7','X10','X11','X13','X15','X17']),[['X0',0],['X2',1],['X4',2],['X12',7],['X14',8],['X16',9],['.',10]]];
const out8=(c1,c2)=>[[['.',0],['Y0',1],['Y2',2],['.',8],['Y4',9],['Y6',10]],[[c1,0],['Y1',1],['Y3',2],[c2,8],['Y5',9],['Y7',10]]];
const out16=(c1,c2)=>[LS([c1,'Y1','Y3','Y5','Y6','Y7','Y10','Y11','Y13','Y15','Y17']),[['Y0',0],['Y2',1],['Y4',2],['Y12',7],['Y14',8],['Y16',9],[c2,10]]];
mod('fx2n-8er-es-ul','FX2N-8ER-ES/UL',43,[['.',0],['X0',1],['X2',2],['.',8],['Y0',9],['Y2',10]],[['S/S',0],['X1',1],['X3',2],['COM1',8],['Y1',9],['Y3',10]],
  {note:'4 點輸入（sink／source）＋4 點繼電器輸出；上面輸入、下面輸出',xin:[['S/S',X(0,3)]],yout:[['COM1',Y(0,3)]]});
mod('fx2n-8er','FX2N-8ER',43,[['.',0],['X0',1],['X2',2],['.',8],['Y0',9],['Y2',10]],[['24+',0],['X1',1],['X3',2],['COM1',8],['Y1',9],['Y3',10]],
  {note:'4 點輸入（sink 專用）＋4 點繼電器輸出；上面輸入、下面輸出',xin:[['24+',X(0,3)]],yout:[['COM1',Y(0,3)]]});
[['8ex-es-ul','FX2N-8EX-ES/UL','S/S','8 點輸入、sink／source'],['8ex','FX2N-8EX','24+','8 點輸入、sink 專用'],['8ex-ua1-ul','FX2N-8EX-UA1/UL','COM','8 點 AC100V 輸入']].forEach(([id,n,c,txt])=>
  mod('fx2n-'+id,n,43,...in8(c),{note:txt,xin:[[c,X(0,7)]]}));
[['16ex-es-ul','FX2N-16EX-ES/UL','S/S','16 點輸入、sink／source'],['16ex','FX2N-16EX','24+','16 點輸入、sink 專用']].forEach(([id,n,c,txt])=>
  mod('fx2n-'+id,n,40,...in16(c),{note:txt+'；上面 8 點是小號碼、下面 8 點是大號碼',xin:[[c,X(0,17)]]}));
[['8eyr-es-ul','FX2N-8EYR-ES/UL','繼電器',0],['8eyr','FX2N-8EYR','繼電器',0],['8eyt','FX2N-8EYT','電晶體 sink',0],['8eyt-h','FX2N-8EYT-H','電晶體 sink（大電流）',0],['8eyt-ess-ul','FX2N-8EYT-ESS/UL','電晶體 source',1]].forEach(([id,n,txt,s])=>{
  const c1=s?'+V0':'COM1',c2=s?'+V1':'COM2';mod('fx2n-'+id,n,43,...out8(c1,c2),{pre:'EY',note:'8 點'+txt+'輸出，4 點一個共點',yout:[[c1,Y(0,3)],[c2,Y(4,7)]]});});
[['16eyr-es-ul','FX2N-16EYR-ES/UL','繼電器',0],['16eyr','FX2N-16EYR','繼電器',0],['16eyt','FX2N-16EYT','電晶體 sink',0],['16eys','FX2N-16EYS','SSR（閘流體）',0],['16eyt-ess-ul','FX2N-16EYT-ESS/UL','電晶體 source',1]].forEach(([id,n,txt,s])=>{
  const c1=s?'+V0':'COM1',c2=s?'+V1':'COM2';mod('fx2n-'+id,n,40,...out16(c1,c2),{pre:'EY',note:'16 點'+txt+'輸出，8 點一個共點；上面 8 點是小號碼、下面 8 點是大號碼',yout:[[c1,Y(0,7)],[c2,Y(10,17)]]});});
mod('fx2n-8eyr-s-es-ul','FX2N-8EYR-S-ES/UL',40,LS(['Y0','Y1','.','Y2','Y3','Y3','Y4','Y4','Y5','.','Y7']),[['Y0',0],['Y1',1],['Y2',2],['Y5',7],['Y6',8],['Y6',9],['Y7',10]],
  {pre:'EY',pairY:true,note:'8 點繼電器輸出、每點獨立接點（兩個端子都標 Y，第二個叫 Y0(2)…）',yout:Y(0,7).map(y=>[y+'(2)',[y]])});
// 連接器型（20 針，A 側小號碼、B 側大號碼）
function cmod(id,name,cols,o){
  const {T,links}=pinTerms(40,[{x:33.5,y:25,cols}],D3);
  def(id,null,C4,MIT,name,40,90,87,o.pre||'EX','dark',T,{ser:'FX2N 擴展模塊',links:linksOf(links),note:NOTE+'；'+o.note,sim:simOf(T,{xin:o.xin,yout:o.yout})});ver(id);
}
cmod('fx2n-16ex-c','FX2N-16EX-C',[[...X(0,7),'.','24+'],[...X(10,17),'.','24+']],{note:'連接器型 16 點輸入、sink 專用；左欄 A 側（針 1～10）、右欄 B 側（針 11～20）',xin:[['24+',X(0,17)]]});
cmod('fx2n-16exl-c','FX2N-16EXL-C',[[...X(0,7),'.','5+'],[...X(10,17),'.','5+']],{note:'連接器型 16 點 DC5V（TTL）輸入；左欄 A 側（針 1～10）、右欄 B 側（針 11～20）',xin:[['5+',X(0,17)]]});
cmod('fx2n-16eyt-c','FX2N-16EYT-C',[[...Y(0,7),'COM','.'],[...Y(10,17),'COM','.']],{pre:'EY',note:'連接器型 16 點電晶體 sink 輸出；左欄 A 側（針 1～10）、右欄 B 側（針 11～20）；兩個 COM 內部相通',yout:[['COM',Y(0,17)]]});

/* ---------- 特殊功能單元／模塊（端子在上方，上下兩排錯開） ---------- */
function sp(id,name,W,R,o={}){
  const H=o.H||90,{T,links}=hTerms(W,H,{tu:R.tu||'',tl:R.tl||'',bu:R.bu||'',bl:R.bl||''},D3);
  const all=[...T,...(o.extra||[])];
  def(id,null,C4,MIT,name,W,H,o.D||87,o.pre||'SP','dark',all,{ser:o.ser||'FX 特殊功能',links:linksOf(o.noLink?null:links),note:(o.note?o.note+'；':'')+NOTE,...(pwrLoad(all)?{sim:pwrLoad(all)}:{})});ver(id);
}
sp('fx0n-3a','FX0N-3A 類比 2 入 1 出',43,{tu:'VIN2 IIN2 COM2 . . VOUT',tl:'VIN1 IIN1 COM1 . . IOUT COM'},{pre:'AD',note:'CH1、CH2 輸入，VOUT／IOUT 輸出；由 PLC 內部供電'});
sp('fx2n-2ad','FX2N-2AD 2CH 類比輸入',43,{tu:'VIN2 IIN2 COM',tl:'VIN1 IIN1 COM'},{pre:'AD',note:'兩個 COM 內部相通；由 PLC 內部供電'});
sp('fx2n-2da','FX2N-2DA 2CH 類比輸出',43,{tu:'VOUT2 IOUT2 COM2',tl:'VOUT1 IOUT1 COM1'},{pre:'DA',note:'由 PLC 內部供電'});
const AD4={tu:'24- V1+ I1+ . V2+ I2+ V3+ . I3+ V4+ I4+',tl:'24+ FG VI1- . FG VI2- FG . VI3- FG VI4-'},DA4={tu:AD4.tu,tl:'24+ FG VI1- . . VI2- . . VI3- . VI4-'};
sp('fx3u-4ad','FX3U-4AD 4CH 類比輸入',55,AD4,{pre:'AD',note:'DC24V 外部供電；FG 和接地端子內部相通'});
sp('fx3u-4da','FX3U-4DA 4CH 類比輸出',55,DA4,{pre:'DA',note:'DC24V 外部供電'});
sp('fx2n-4ad','FX2N-4AD 4CH 類比輸入',55,AD4,{pre:'AD',note:'DC24V 外部供電；FG 和接地端子內部相通'});
sp('fx2n-4da','FX2N-4DA 4CH 類比輸出',55,DA4,{pre:'DA',note:'DC24V 外部供電'});
sp('fx2n-4ad-pt','FX2N-4AD-PT 4CH 測溫電阻',55,{tu:'24- I1- L1- . I2- L2- I3- . L3- I4- L4-',tl:'24+ FG L1+ . FG L2+ FG . L3+ FG L4+'},{pre:'AD',note:'DC24V 外部供電'});
sp('fx2n-4ad-tc','FX2N-4AD-TC 4CH 熱電偶',55,{tu:'24- SLD L1- . SLD L2- SLD . L3- SLD L4-',tl:'24+ FG L1+ . . L2+ . . L3+ . L4+'},{pre:'AD',note:'DC24V 外部供電；SLD 內部相通'});
sp('fx2n-5a','FX2N-5A 類比 4 入 1 出',55,{tu:'24- VO+ IO+ . VI1- V2+ I2+ . VI3- V4+ I4+',tl:'24+ FG VIO- . V1+ I1+ VI2- . V3+ I3+ VI4-'},{pre:'AD',note:'IN1～IN4 輸入、VO／IO 輸出；DC24V 外部供電'});
sp('fx3u-4lc','FX3U-4LC 4CH 溫度控制',90,{tu:'FG CT1A FG TC1- CT2A FG TC2- OUT1 OUT2',tl:'24+ 24- CT1B PTA1 TC1+ CT2B PTA2 TC2+ COM1',bu:'. CT3A FG TC3- CT4A FG TC4- OUT3 OUT4',bl:'. . CT3B PTA3 TC3+ CT4B PTA4 TC4+ COM2'},
  {D:86,pre:'TC',note:'上下兩組端子排；TCn− 端子在測溫電阻時是 PTB、TCn+ 是 PTB／VL+；CTnA／CTnB 是比流器兩端；OUT 是電晶體輸出'});
sp('fx2n-2lc','FX2N-2LC 2CH 溫度控制',55,{tu:'24- OUT1 OUT2 . CT1A FG TC1- . CT2A FG TC2-',tl:'24+ FG COM . CT1B PTA1 TC1+ . CT2B PTA2 TC2+'},{pre:'TC',note:'TCn− 在測溫電阻時是 PTB；CTnA／CTnB 是比流器兩端'});
sp('fx2n-8ad','FX2N-8AD 8CH 類比輸入',75,{tu:'FG V1+ I1+ COM1 V3+ I3+ COM3 .',tl:'24+ 24- V2+ I2+ COM2 V4+ I4+ COM4',bu:'V6+ I6+ COM6 V8+ I8+ COM8 . .',bl:'V5+ I5+ COM5 V7+ I7+ COM7 . .'},{D:75,pre:'AD',note:'上下兩組端子排（M3.5）'});
sp('fx2n-1hc','FX2N-1HC 高速計數',55,{tu:'A24+ A5+ B24+ . B5+ XD24 XP24 . XP5 YH+ YS+',tl:'A12+ A- B12+ . B- XD5 COMD . COMP YH- YS-'},{pre:'HC',note:'A、B 相依電壓接 24／12／5V 端子；由 PLC 內部供電'});
const PG1={tu:'COM0 RP PG0+ . . . CLR STOP DOG',tl:'VIN FP PG0- . . . COM1 S/S S/S'};
sp('fx3u-1pg','FX3U-1PG 1 軸定位',43,PG1,{pre:'PG',note:'兩個 S/S 內部相通'});
sp('fx2n-1pg','FX2N-1PG(-E) 1 軸定位',43,PG1,{pre:'PG',note:'兩個 S/S 內部相通'});
sp('fx2n-1rm-set','FX2N-1RM(-E)-SET 旋轉凸輪開關',97,{bu:'. . . . . S/S 24+ 24-',bl:'. . . . . B0 B1 FG'},{H:111,D:60,pre:'RM',note:'外形含顯示面板；端子在右下；另附 F2-720RSV 旋轉編碼器'});
sp('fx2n-32asi-m','FX2N-32ASI-M AS-i 主站',55,{tu:'ASI+ ASI- FG',tl:'ASI+ ASI- .'},{pre:'NW',note:'AS-i 端子上下兩組內部相通'});
sp('fx3u-16ccl-m','FX3U-16CCL-M CC-Link 主站',55,{tu:'24- . . . . DA DB',tl:'24+ FG . . . . DG SLD'},{pre:'NW',note:'CC-Link 端子排 M3.5'});
sp('fx2n-16ccl-m','FX2N-16CCL-M CC-Link 主站',85,{tu:'24-',tl:'24+ FG . SLD DG DA DB'},{pre:'NW',note:'電源端子 M3、信號端子 M3.5'});
sp('fx2n-32ccl','FX2N-32CCL CC-Link 從站',43,{tu:'24- . . . DA DB DG',tl:'24+ FG . . DA DB SLD'},{pre:'NW',note:'DA、DB 上下兩組內部相通（跨接用）'});
sp('fx3u-64ccl','FX3U-64CCL CC-Link 從站',55,{tu:'24- . . . DA DB',tl:'24+ FG . . DG SLD'},{pre:'NW'});
sp('fx2n-16lnk-m','FX2N-16LNK-M MELSEC-I/O LINK 主站',43,{tu:'24- . . . DG RUNB',tl:'24+ FG . . DATA RUNA'},{pre:'NW'});
// 通訊接頭：手冊有針腳表的每支針一個接點（直排在接頭位置）
const dsub=(x,y,list,side='left')=>list.map(([id,pin],i)=>[id,x,+(y+i*2.6).toFixed(2),side,`第${pin}腳 ${id}`]);
const RS232=[['CD',1],['RD',2],['SD',3],['ER',4],['SG',5],['DR',6]];
sp('fx2n-232if','FX2N-232IF RS-232C 介面',55,{tu:'FG',tl:'24+ 24-'},{pre:'NW',extra:dsub(14,50,[...RS232,['RS',7],['CS',8],['CI',9]]),note:'D-sub 9 針（公）'});
sp('fx3u-enet-l','FX3U-ENET-L 乙太網路',55,{tu:'24-',tl:'24+ FG'},{pre:'NW',extra:dsub(14,62,[['TD+',1],['TD-',2],['RD+',3],['RD-',6]]),note:'RJ45（10BASE-T／100BASE-TX），4、5、7、8 腳不使用'});
// 只有接頭／針腳的單元
function pinDev(id,name,W,H,D,T,o){
  const links=dedup(T);T.forEach(t=>{if(!t[4])t[4]=D3(t[0]);});
  def(id,null,C4,MIT,name,W,H,D,o.pre||'SP','dark',T,{ser:o.ser||'FX 特殊功能',links:linksOf(links),note:o.note+'；'+NOTE,...(pwrLoad(T)?{sim:pwrLoad(T)}:{}),...(o.vlab?{vlab:o.vlab}:{})});ver(id);
}
const pcol=(x,y,list)=>list.map((id,i)=>id&&id!=='.'?[id,x,+(y+i*2.6).toFixed(2),'right','']:null).filter(Boolean);
const pcon=(x,y,a,b)=>[...pcol(x,y,a),...pcol(x+2.6,y,b)];
{const ch=(c,x)=>pcon(x,14,[`A24+`,'A5+','.','B24+','B5+','.','P24+','P5+','.','.','XD24','.','.','YH1+','.','YH2+','.','.','.','.'].map(t=>t==='.'?t:c+':'+t),
   ['A12+','A-','.','B12+','B-','.','P12+','P-','.','.','XD5','COMD','.','YH1-','.','YH2-','.','.','.','.'].map(t=>t==='.'?t:c+':'+t));
  pinDev('fx3u-2hc','FX3U-2HC 2CH 高速計數',55,90,87,[...ch('1',8),...ch('2',24)],{pre:'HC',note:'40 針連接器 CH1、CH2 各一個；接點名稱前面的 1:、2: 是通道'});}
pinDev('fx3u-20ssc-h','FX3U-20SSC-H 2 軸定位（SSCNET III）',55,90,87,pcon(8,20,['X-INT0','.','X-INT1','X-ΦA+','X-ΦA-','X-ΦB+','X-ΦB-','X-DOG','S/S','X-START'],['Y-INT0','.','Y-INT1','Y-ΦA+','Y-ΦA-','Y-ΦB+','Y-ΦB-','Y-DOG','S/S','Y-START']),
  {pre:'PG',note:'20 針連接器，NC 腳省略；兩個 S/S 內部相通；伺服用 SSCNET III 光纖另接'});
pinDev('fx2n-10pg','FX2N-10PG 1 軸定位',43,90,87,pcon(8,20,['VIN+','FP+','RP+','PG0+','CLR+','ΦA+','ΦB+','DOG','S/S','X0'],['VIN-','FP-','RP-','PG0-','CLR-','ΦA-','ΦB-','START','S/S','X1']),{pre:'PG',note:'20 針連接器；兩個 S/S 內部相通'});
pinDev('fx2n-10gm','FX2N-10GM 1 軸定位',60,90,87,[...pcon(8,20,['START','STOP','ZRN','FWD','RVS','DOG','LSF','LSR','COM1','Y4'],['X0','X1','X2','X3','Y0','Y1','Y2','Y3','COM1','Y5']),
  ...pcon(24,20,['SVRDY','COM2','CLR','COM3','.','FP','VIN','VIN','COM5','ST1'],['SVEND','COM2','PG0','COM4','.','RP','VIN','VIN','COM5','ST2'])],{pre:'PG',note:'CON1（輸入輸出）、CON2（伺服）兩個 20 針連接器；同名腳內部相通'});
pinDev('fx2n-20gm','FX2N-20GM 2 軸定位',86,90,87,[...pcon(8,20,['Y00','Y01','Y02','Y03','Y04','Y05','Y06','Y07','COM1','.'],['X00','X01','X02','X03','X04','X05','X06','X07','COM1','.']),
  ...pcon(24,20,['Y:START','Y:STOP','Y:ZRN','Y:FWD','Y:RVS','Y:DOG','Y:LSF','Y:LSR','COM1','.'],['X:START','X:STOP','X:ZRN','X:FWD','X:RVS','X:DOG','X:LSF','X:LSR','COM1','.']),
  ...pcon(40,20,['X:SVRDY','COM2','X:CLR','COM3','.','X:FP','VIN','VIN','COM5','ST1'],['X:SVEND','COM2','X:PG0','COM4','.','X:RP','VIN','VIN','COM5','ST2']),
  ...pcon(56,20,['Y:SVRDY','COM6','Y:CLR','COM7','.','Y:FP','VIN','VIN','COM9','ST3'],['Y:SVEND','COM6','Y:PG0','COM8','.','Y:RP','VIN','VIN','COM9','ST4'])],
  {pre:'PG',note:'CON1（通用輸入輸出）、CON2（X、Y 軸輸入）、CON3（X 軸伺服）、CON4（Y 軸伺服）四個 20 針連接器；X:、Y: 是軸；同名腳內部相通'});
pinDev('fx3u-128asl-m','FX3U-128ASL-M AnyWireASLINK 主站',43,90,87,[['24V',6,50,'left','DC24V 電源'],['0V',6,54.3,'left','DC24V 電源'],['DP',6,58.6,'left','傳輸線 +'],['DN',6,62.9,'left','傳輸線 −'],['LG',6,67.2,'left','信號地']],
  {pre:'NW',note:'歐式端子排 5 極'});
const DP=[['RXD/TXD-P',3],['DGND',5],['VP',6],['RXD/TXD-N',8]];
pinDev('fx3u-64dp-m','FX3U-64DP-M PROFIBUS-DP 主站',43,90,87,dsub(10,48,DP),{pre:'NW',note:'D-sub 9 針（母），1、2、4、7、9 腳不使用'});
pinDev('fx3u-32dp','FX3U-32DP PROFIBUS-DP 從站',43,90,87,dsub(10,48,[DP[0],['RTS',4],...DP.slice(1)]),{pre:'NW',note:'D-sub 9 針（母），1、2、7、9 腳不使用'});
pinDev('fx2n-64cl-m','FX2N-64CL-M CC-Link/LT 主站',43,90,87,[['CC-Link/LT',14,70,'bottom','CC-Link/LT 接頭（手冊沒有針腳表）']],{pre:'NW',note:'CC-Link/LT 接頭在正面下方'});

/* ---------- 電源 ---------- */
sp('fx3u-1psu-5v','FX3U-1PSU-5V 擴展電源',55,{tu:'L N',tl:'. FG'},{pre:'PS',ser:'FX 電源',note:'AC 電源；供 DC5V／DC24V 給後段擴展設備'});
TPL['fx3u-1psu-5v'].sim=[{k:'pwr',a:'L',b:'N'}];
sp('fx2n-20psu','FX2N-20PSU DC24V 電源',65,{tu:'. . FG . . .',tl:'. . L N . .',bu:'. 24V+ 24V- . . .',bl:'. . 24V+ 24V- . .'},{D:75,pre:'PS',ser:'FX 電源',noLink:false,note:'AC 輸入、DC24V 2A 輸出；同名端子內部相通'});
TPL['fx2n-20psu'].sim=[{k:'pwr',a:'L',b:'N'},{k:'src',p:'24V+',n:'24V-',v:'24V',in:['L','N']}];

/* ---------- 特殊轉接器（裝在 FX3U 左側，歐式端子直排，寬 17.6、高 106） ---------- */
function adp(id,name,ids,o){
  const T=ids.map((t,i)=>t&&[t,8,+(24.8+i*4.29).toFixed(2),'right',D3(t)]).filter(Boolean),links=dedup(T);
  def(id,null,C4,MIT,name,o.W||17.6,106,74,o.pre||'AD','dark',[...T,...(o.extra||[])],{ser:'FX3U 特殊轉接器',links:linksOf(o.noLink?null:links),note:(o.note?o.note+'；':'')+NOTE,...(pwrLoad(T)?{sim:pwrLoad(T)}:{})});ver(id);
}
const A10=(a,b)=>[...a,null,...b];
adp('fx3u-4ad-adp','FX3U-4AD-ADP 4CH 類比輸入',A10(['24+','24-','FG','V1+','I1+','COM1','V2+','I2+','COM2','V3+'],['I3+','COM3','V4+','I4+','COM4']),{note:'上面 10 極、下面 5 極'});
adp('fx3u-4da-adp','FX3U-4DA-ADP 4CH 類比輸出',A10(['24+','24-','FG','V1+','I1+','COM1','V2+','I2+','COM2','V3+'],['I3+','COM3','V4+','I4+','COM4']),{pre:'DA',note:'上面 10 極、下面 5 極'});
adp('fx3u-3a-adp','FX3U-3A-ADP 類比 2 入 1 出',A10(['24+','24-','FG',null,'V1+','I1+','COM1','V2+','I2+','COM2'],['VO','IO','COM']),{note:'CH1、CH2 輸入，VO／IO 輸出'});
const PT=A10(['24+','24-','FG','L1+','L1-','I1-','L2+','L2-','I2-','L3+'],['L3-','I3-','L4+','L4-','I4-']);
adp('fx3u-4ad-pt-adp','FX3U-4AD-PT-ADP 4CH 測溫電阻',PT,{note:'Pt100'});
adp('fx3u-4ad-ptw-adp','FX3U-4AD-PTW-ADP 4CH 測溫電阻（寬範圍）',PT,{note:'Pt100，端子和 4AD-PT-ADP 相同'});
adp('fx3u-4ad-pnk-adp','FX3U-4AD-PNK-ADP 4CH 測溫電阻',PT,{note:'Pt1000／Ni1000'});
adp('fx3u-4ad-tc-adp','FX3U-4AD-TC-ADP 4CH 熱電偶',A10(['24+','24-','FG',null,null,'J-type','J-type','L1+','L1-','L2+'],['L2-','L3+','L3-','L4+','L4-']),
  {noLink:true,note:'用 J 型熱電偶時兩個 J-type 端子短接'});
adp('fx3u-485adp','FX3U-485ADP(-MB) RS-485 轉接器',[null,null,null,null,null,null,null,null,null,null,null,'RDA','RDB','SDA','SDB','SG'],{pre:'ADP',note:'歐式端子排 5 極、內建終端電阻 330Ω／110Ω'});
adp('fx3u-4hsx-adp','FX3U-4HSX-ADP 高速輸入',['X0/3+','X0/3-','X1/4+','X1/4-','X2/5+','X2/5-','X6/7+','X6/7-','SG','SG'],{pre:'ADP',note:'差動線性驅動輸入；兩個 SG 內部相通'});
adp('fx3u-2hsy-adp','FX3U-2HSY-ADP 高速脈衝輸出',['Y0/2+','Y0/2-','Y4/6+','Y4/6-','SGA','Y1/3+','Y1/3-','Y5/7+','Y5/7-','SGB'],{pre:'ADP',note:'差動線性驅動輸出；脈衝方式用開關切換'});
adp('fx3u-232adp','FX3U-232ADP(-MB) RS-232C 轉接器',[],{pre:'ADP',extra:dsub(8,62,RS232,'right'),note:'D-sub 9 針（公），7～9 腳不使用'});
TPL['fx3u-232adp'].vlab=RS232.map(r=>r[0]);
adp('fx3u-enet-adp','FX3U-ENET-ADP 乙太網路轉接器',[],{W:23,pre:'ADP',extra:[...dsub(11,62,[['TD+',1],['TD-',2],['RD+',3],['RD-',6]],'right'),['FG',11,80,'right','接地端子（M2.5）']],note:'RJ45，4、5、7、8 腳不使用'});

/* ---------- 功能擴展板（裝在 FX3U 正面） ---------- */
const BDHOST=Object.keys(TPL).filter(k=>/^fx3u-\d+m/.test(k));
const bdAt=Object.fromEntries(BDHOST.map(k=>[k,{x:24,y:22}]));
const bd=(id,name,T,o)=>{def(id,null,C4,MIT,name,53.5,46.1,19.6,'BD','dark',T,{ser:'FX3U 功能擴展板',front:true,hostCat:C4,at:bdAt,note:'拖到 FX3U 基本單元上會自動裝在正面；'+o.note+'；'+NOTE,...(o.vlab?{vlab:o.vlab}:{})});ver(id);};
bd('fx3u-485-bd','FX3U-485-BD RS-485 擴展板',['RDA','RDB','SDA','SDB','SG'].map((id,i)=>[id,48,+(12+i*4.3).toFixed(2),'right',D3(id)]),{note:'歐式端子排 5 極、內建終端電阻'});
bd('fx3u-232-bd','FX3U-232-BD RS-232C 擴展板',dsub(48,14,RS232,'right'),{vlab:RS232.map(r=>r[0]),note:'D-sub 9 針（公），7～9 腳不使用'});
bd('fx3u-422-bd','FX3U-422-BD RS-422 擴展板',[['RS-422',48,23,'right','MINI DIN 8 針（母）']],{note:'接頭整個畫成一個接點（手冊沒有針腳表）'});
bd('fx3u-usb-bd','FX3U-USB-BD USB 擴展板',[['USB',48,23,'right','USB Mini-B']],{note:'接頭整個畫成一個接點'});

/* ---------- 介面模組（編程用轉換器） ---------- */
def('fx-232awc-h',null,C4,MIT,'FX-232AWC-H RS-232C／RS-422 轉換器',80,60,25,'NW','dark',[['RS-232C',4,30,'left','D-sub 25 針（母）'],['RS-422',76,30,'right','D-sub 25 針（母）']],
  {ser:'FX 介面',note:'兩個接頭各畫成一個接點（手冊沒有針腳表）；'+NOTE});ver('fx-232awc-h');
def('fx-usb-aw',null,C4,MIT,'FX-USB-AW USB／RS-422 轉換器',62,21,17,'NW','dark',[['RS-422',2,10.5,'left','MINI DIN 8 針（公）'],['USB',60,10.5,'right','USB Mini-B']],
  {ser:'FX 介面',note:'兩個接頭各畫成一個接點；'+NOTE});ver('fx-usb-aw');

/* ---------- 端子模組 FX-16E-TB、FX-32E-TB 等（150×55，端子在下方兩排） ---------- */
function tb(id,name,R,note){
  const {T,links}=hTerms(150,55,{tu:R.tu||'',tl:R.tl||'',bu:R.bu||'',bl:R.bl||''},D3);
  def(id,null,C4,MIT,name,150,55,45,'TB','dark',T,{ser:'FX 端子模組',links:linksOf(links),note:note+'；同名端子內部相通；'+NOTE});ver(id);
}
const tbOut=(p,c,o=0)=>({u:`. ${p}${1+o} ${3+o} ${c} ${5+o} ${7+o} ${c} ${p}${11+o} ${13+o} ${c} ${15+o} ${17+o} ${c}`,l:`. ${p}${o} ${2+o} ${c} ${4+o} ${6+o} ${c} ${p}${10+o} ${12+o} ${c} ${14+o} ${16+o} ${c}`});
const tbIn=(p,c,o=0)=>({u:`${c} ${p}${1+o} ${3+o} . ${5+o} ${7+o} . ${p}${11+o} ${13+o} . ${15+o} ${17+o} .`,l:`${c} ${p}${o} ${2+o} . ${4+o} ${6+o} . ${p}${10+o} ${12+o} . ${14+o} ${16+o} .`});
{const o=tbOut('Y','COM'),i=tbIn('X','24+');
  tb('fx-16e-tb-y','FX-16E-TB（接輸出模塊）',{bu:o.u,bl:o.l},'接 FX2N-16EYT-C 等連接器型輸出；左半小號碼、右半大號碼');
  tb('fx-16e-tb-x','FX-16E-TB（接輸入模塊）',{bu:i.u,bl:i.l},'接 FX2N-16EX-C 等連接器型輸入；左半小號碼、右半大號碼');
  const o2=tbOut('Y','C2-COM',20),i2=tbIn('X','C2-24+',20);
  tb('fx-32e-tb-y','FX-32E-TB（接輸出）',{tu:o2.u,tl:o2.l,bu:o.u,bl:o.l},'下方 CN1（Y0～17）、上方 CN2（Y20～37，共點叫 C2-COM）；實際位址看接的模塊');
  tb('fx-32e-tb-x','FX-32E-TB（接輸入）',{tu:i2.u,tl:i2.l,bu:i.u,bl:i.l},'下方 CN1（X0～17）、上方 CN2（X20～37，共點叫 C2-24+）；實際位址看接的模塊');}
tb('fx-16ex-a1-tb','FX-16EX-A1-TB AC100V 輸入端子模組',{bu:'24+ X1 3 COM1 5 7 COM2 X11 13 COM3 15 17 COM4',bl:'24- X0 2 COM1 4 6 COM2 X10 12 COM3 14 16 COM4'},'AC100V 輸入轉成 DC 給 FX2N-16EX-C；4 點一個共點');
[['fx-16eyr-tb','FX-16EYR-TB 繼電器輸出端子模組'],['fx-16eys-tb','FX-16EYS-TB 閘流體輸出端子模組'],['fx-16eyt-tb','FX-16EYT-TB 電晶體輸出端子模組'],['fx-16eyt-h-tb','FX-16EYT-H-TB 電晶體輸出端子模組（大電流）']].forEach(([id,n])=>
  tb(id,n,{bu:'24+ Y1 3 COM1 5 7 COM2 Y11 13 COM3 15 17 COM4',bl:'24- Y0 2 COM1 4 6 COM2 Y10 12 COM3 14 16 COM4'},'接 FX2N-16EYT-C 等連接器型輸出；4 點一個共點'));
})();

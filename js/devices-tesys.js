"use strict";
/* ---------- 施耐德 TeSys：Deca 接觸器、Deca Advanced 大電流接觸器、GV2 馬達保護斷路器、LRD／LR9D 過電流繼電器 ----------
   資料來源：施耐德《TeSys Catalog 2026》型號清單與尺寸圖、se.com 產品規格書正面照片、原廠安裝說明書
   - LC1D09～D38：規格書正面照片（1L1 3L2 5L3／13NO 21NC A1／14NO 22NC A2／2T1 4T2 6T3）；外型 45×77（D09～D18）、45×85（D25～D38）
     線圈：AC220V（M7）、DC24V（BD）、DC24V 低耗電（BL）；其他電壓可在型號欄改（例如 LC1D09P7）
   - LC1D115A／D150A、LC1DT200A：型錄尺寸圖的端子標示（主接點間距 35；97×152、四極 132×152），線圈 AC/DC 共用
   - GV2P、GV2ME、GV2L、GV2LE、GV2RT：規格書與實物正面照片（1L1 3L2 5L3／2T1 4T2 6T3），44.5×89；GV2ME 和庫裡的 GV2ME16 同一個機框
   - LRD01～35、LRD05L～32L：輔助端子照實物照片左到右 97NO、98NO、95NC、96NC，下排 2T1 4T2 6T3；
     插在 LC1D 下方，可裝的接觸器照型錄對照表（例如 LRD35 只能裝 D32、D38）；裝上後高度照型錄 b（D09～D18 123、D25～D38 137）
   - LR9D01／02／08／32：安裝說明書 95NC 96NC 97NO 98NO 在上、2T1 4T2 6T3 在下；裝上後高度 130／140
   - 端子實際 mm 位置依圖估算，相對位置照原廠 */
(function(){
const SE='施耐德',SRC='施耐德 TeSys Catalog 2026、se.com 產品規格書與安裝說明書';
const ver=id=>{VER[id]=[2,SRC];};
// 接觸器動作：線圈吸合時主接點、13-14 閉合，21-22 打開
const CSIM=(n4)=>[{k:'coil',a:'A1',b:'A2'},...[['L1','T1'],['L2','T2'],['L3','T3'],...(n4?[['L4','T4']]:[]),['13','14']].map(([a,b])=>({k:'sw',a,b,by:'coil'})),{k:'sw',a:'21',b:'22',nc:true,by:'coil'}];

/* ---------- Deca 接觸器 LC1D09～D38 ---------- */
const COIL=[['M7','AC220V'],['BD','DC24V'],['BL','DC24V 低耗電']];
const DECA=[['09',77,'9A',[84,93]],['12',77,'12A',[84,93]],['18',77,'18A',[84,93]],['25',85,'25A',[90,99]],['32',85,'32A',[90,99]],['38',85,'38A',[90,99]]];
const LC1D=[];
DECA.forEach(([r,H,a,dd])=>COIL.forEach(([c,v])=>{
  const exist={'09BL':'lc1d09','18BL':'lc1d18','38BL':'lc1d38'}[r+c];if(exist){LC1D.push([exist,r]);return;} // 庫裡已有的型號略過
  const id=`lc1d${r}${c.toLowerCase()}`;LC1D.push([id,r]);
  def(id,null,C2,SE,`LC1D${r}${c} ${v}`,45,H,c==='M7'?dd[0]:dd[1],'K','dark',deca(45,H),{ser:'TeSys D 接觸器',model:true,sim:CSIM(false),
    note:`Deca 接觸器 ${a}（AC-3）；端子排列照規格書正面照片；線圈 ${v}，其他電壓改型號後兩碼（例如 P7＝AC230V、F7＝AC110V）`});ver(id);
}));

/* ---------- Deca Advanced LC1D115A／D150A、LC1DT200A ---------- */
const BIG=(n4)=>{const W=n4?132:97,xs=n4?[12.7,47.7,82.2,117.5]:[13,48,83],ax=n4?[57.3,71.1,91]:[37.3,54.3,71.8];
  return [...['L1','L2','L3','L4'].slice(0,xs.length).map((id,i)=>[id,xs[i],16,'top',`主接點 ${2*i+1}/${id}`]),
    ['13',ax[0],56,'top','常開輔助 13NO'],['21',ax[1],56,'top','常閉輔助 21NC'],['A1',ax[2],56,'top','線圈'],
    ['14',ax[0],97,'bottom','常開輔助 14NO'],['22',ax[1],97,'bottom','常閉輔助 22NC'],['A2',ax[2],97,'bottom','線圈'],
    ...['T1','T2','T3','T4'].slice(0,xs.length).map((id,i)=>[id,xs[i],136,'bottom',`主接點 ${2*i+2}/${id}`])];};
[['LC1D115A','115A',false],['LC1D150A','150A',false],['LC1DT200A','200A（AC-1）四極',true]].forEach(([m,a,n4])=>[['BNE','AC/DC 24～60V'],['KUE','AC/DC 100～250V']].forEach(([c,v])=>{
  const id=(m+c).toLowerCase();
  def(id,null,C2,SE,`${m}${c} ${v}`,n4?132:97,152,149,'K','dark',BIG(n4),{ser:'TeSys D Advanced 接觸器',model:true,sim:CSIM(n4),
    note:`Deca Advanced 接觸器 ${a}；端子排列照型錄尺寸圖（主接點間距 35 mm）；電子式線圈 AC/DC 共用；兩側可加 LAD8N 輔助接點`});ver(id);}));

/* ---------- GV2 馬達保護斷路器 ---------- */
const GV2=[['01','0.1～0.16'],['02','0.16～0.25'],['03','0.25～0.4'],['04','0.4～0.63'],['05','0.63～1'],['06','1～1.6'],['07','1.6～2.5'],['08','2.5～4'],['10','4～6.3'],['14','6～10'],['16','9～14'],['20','13～18'],['21','17～23'],['22','20～25'],['32','24～32']];
const BRK=[['1','2'],['3','4'],['5','6']].map(([a,b])=>({k:'brk',a,b}));
GV2.forEach(([r,A])=>{
  const p='gv2p'+r;
  def(p,null,C1,SE,`GV2P${r} ${A}A`,44.5,89,97,'QM','dark',[...[['1',6.7,10],['3',22.25,10],['5',37.8,10]].map(([id,x,y])=>[id,x,y,'top',`${id}/L${(+id+1)/2} 電源側`]),...[['2',6.7,79],['4',22.25,79],['6',37.8,79]].map(([id,x,y])=>[id,x,y,'bottom',`${id}/T${id/2} 負載側`])],
    {ser:'TeSys GV2 馬達保護',sim:BRK,note:`旋鈕操作；熱動電磁式，設定電流 ${A}A；端子排列照規格書正面照片（1L1 3L2 5L3／2T1 4T2 6T3）`});ver(p);
  const m='gv2me'+r;if(TPL[m])return; // 庫裡已有 GV2ME16、GV2ME32
  def(m,null,C1,SE,`GV2ME${r} ${A}A`,45,89,78.5,'QM','dark',nfb(45,89),{ser:'TeSys GV2 馬達保護',sim:BRK,note:`按鈕操作；熱動電磁式，設定電流 ${A}A；端子排列照實物照片（1L1 3L2 5L3／2T1 4T2 6T3），和庫裡的 GV2ME16 同一個機框`});ver(m);
});

// GV2L（旋鈕、只有電磁跳脫）、GV2LE（按鈕、只有電磁跳脫）、GV2RT（按鈕、熱動電磁式）：實物照片 1L1 3L2 5L3／2T1 4T2 6T3，和 GV2ME 同一個機框
const MAGR={'03':'0.4','04':'0.63','05':'1','06':'1.6','07':'2.5','08':'4','10':'6.3','14':'10','16':'14','20':'18','22':'25','32':'32'};
Object.entries(MAGR).forEach(([r,A])=>[['GV2L','旋鈕',97],['GV2LE','按鈕',78.5]].forEach(([s,op,D])=>{const id=(s+r).toLowerCase();
  def(id,null,C1,SE,`${s}${r} ${A}A 電磁式`,44.5,89,D,'QM','dark',nfb(44.5,89),{ser:'TeSys GV2 馬達保護',sim:BRK,
    note:`${op}操作；只有電磁跳脫（短路保護，額定 ${A}A），過載保護要另外配熱電驛；端子排列照實物照片（1L1 3L2 5L3／2T1 4T2 6T3）`});ver(id);}));
GV2.filter(([r])=>+r>=3&&+r<=21).forEach(([r,A])=>{const id='gv2rt'+r;
  def(id,null,C1,SE,`GV2RT${r} ${A}A`,44.5,89,78.5,'QM','dark',nfb(44.5,89),{ser:'TeSys GV2 馬達保護',sim:BRK,
    note:`按鈕操作；熱動電磁式，設定電流 ${A}A；端子排列照實物照片（1L1 3L2 5L3／2T1 4T2 6T3）`});ver(id);});

/* ---------- LRD 熱動過電流繼電器、LR9D 電子式過電流繼電器：插在 LC1D 下方 ---------- */
// 可裝的接觸器（型錄對照表）：D09～D38、D12～D38、D18～D38、D25～D38、D32／D38
const hosts=from=>LC1D.filter(([,r])=>+r>=from).map(([id])=>id);
const TRIP=[{k:'sw',a:'95',b:'96',nc:true,by:'trip',btn:'跳脫'},{k:'sw',a:'97',b:'98',by:'trip',btn:'跳脫'}];
const under=(fits,y1,y2)=>Object.fromEntries(fits.map(id=>[id,{x:0,y:(TPL[id].h>80?y2:y1)}]));
function relay(id,name,H,aux,fits,y1,y2,note){
  const T=[...aux.map(([t,x])=>[t,x,H-26,'top',(/9[56]/.test(t)?'跳脫常閉 ':'跳脫常開 ')+t+(/9[56]/.test(t)?'NC':'NO')]),
    ...[['T1',10],['T2',22.5],['T3',35]].map(([t,x],i)=>[t,x,H-8,'bottom',`主迴路出 ${2*i+2}/${t}（接馬達）`])];
  def(id,null,C2,SE,name,45,H,71,'F','dark',T,{ser:'TeSys 過電流繼電器',sim:TRIP,trip:true,attach:'under',fits,under:under(fits,y1,y2),plug:{T1:'T1',T2:'T2',T3:'T3'},
    note:`拖到 ${fits.length} 種 LC1D 接觸器下方會自動裝上（${note}），三支銅片插進 2/T1、4/T2、6/T3，和接觸器的 2/T1… 算同一點；模擬：點一下跳脫（95-96 打開、97-98 閉合），再點一下復歸，詳細資料可改自動復歸`});ver(id);}
const LRDX=[['01','0.1～0.16',9],['02','0.16～0.25',9],['03','0.25～0.4',9],['04','0.4～0.63',9],['05','0.63～1',9],['06','1～1.6',9],['07','1.6～2.5',9],['08','2.5～4',9],['10','4～6',9],['12','5.5～8',9],['14','7～10',9],['16','9～13',12],['21','12～18',18],['22','16～24',25],['32','23～32',25],['35','30～38',32]];
const LRDAUX=[['97',7],['98',17],['95',28],['96',38]];
LRDX.forEach(([r,A,from])=>relay('lrd'+r,`LRD${r} ${A}A Class 10`,52,LRDAUX,hosts(from),71,85,'輔助端子照實物照片 97NO 98NO 95NC 96NC'));
// Class 20（LRD..L）
[['05','0.63～1',9],['06','1～1.6',9],['07','1.6～2.5',9],['08','2.5～4',9],['10','4～6',9],['12','5.5～8',9],['14','7～10',9],['16','9～13',12],['21','12～18',18],['22','17～24',25],['32','23～32',25]].forEach(([r,A,from])=>
  relay('lrd'+r+'l',`LRD${r}L ${A}A Class 20`,52,LRDAUX,hosts(from),71,85,'輔助端子照實物照片 97NO 98NO 95NC 96NC'));
[['01','0.1～0.5'],['02','0.4～2'],['08','1.6～8'],['32','6.4～32']].forEach(([r,A])=>
  relay('lr9d'+r,`LR9D${r} ${A}A 電子式`,56,[['95',7],['96',17],['97',28],['98',38]],hosts(9),74,84,'端子照安裝說明書 95NC 96NC 97NO 98NO；Class 5／10／20／30 可選'));

/* ---------- 第二批（修正版合輯的官網照片與說明書） ---------- */
const TERM=(a)=>a.map(([id,x,y,side,desc])=>[id,x,y,side,desc]);
const LAY4=(xs,y,ax,ay1,ay2,yb,n4)=>TERM([...['L1','L2','L3','L4'].slice(0,n4?4:3).map((id,i)=>[id,xs[i],y,'top',`主接點 ${2*i+1}/${id}`]),
  ['13',ax[0],ay1,'top','常開輔助 13NO'],['21',ax[1],ay1,'top','常閉輔助 21NC'],['A1',ax[2],ay1,'top','線圈'],['14',ax[0],ay2,'bottom','常開輔助 14NO'],['22',ax[1],ay2,'bottom','常閉輔助 22NC'],['A2',ax[2],ay2,'bottom','線圈'],
  ...['T1','T2','T3','T4'].slice(0,n4?4:3).map((id,i)=>[id,xs[i],yb,'bottom',`主接點 ${2*i+2}/${id}`])]);
// LC1D40A～D80A（55×122）：照片 1L1 3L2 5L3／13NO 21NC A1／14NO 22NC A2／2T1 4T2 6T3，輔助與線圈那塊偏右
const D40=[];const COIL2=[['M7','AC220V'],['BD','DC24V'],['BNE','AC/DC 24～60V（Deca Advanced）']];
[['40A','40A'],['50A','50A'],['65A','65A'],['80A','80A']].forEach(([r,a])=>COIL2.forEach(([c,v])=>{const id=`lc1d${r}${c}`.toLowerCase();D40.push([id,r]);
  def(id,null,C2,SE,`LC1D${r}${c} ${v}`,55,122,120,'K','dark',LAY4([9.8,27.3,45],10,[22.5,32.6,43],40,78,108),{ser:c==='BNE'?'TeSys D Advanced 接觸器':'TeSys D 接觸器',model:true,sim:CSIM(false),
    note:`Deca 接觸器 ${a}（AC-3）；端子排列照官網產品照片（輔助與線圈那塊偏右）；線圈 ${v}${c==='BNE'?'':'，其他電壓改型號後兩碼'}；主接點六角螺絲（LADALLEN4）`});ver(id);}));
// Deca Advanced LC1D09BNE～D38BNE：照片和 Deca 同一個排列，線圈標 AC/DC A1
[['09',77],['12',77],['18',77],['25',85],['32',85],['38',85]].forEach(([r,H])=>{const id=`lc1d${r}bne`;LC1D.push([id,r]);
  def(id,null,C2,SE,`LC1D${r}BNE AC/DC 24～60V`,45,H,H===77?86:93,'K','dark',deca(45,H),{ser:'TeSys D Advanced 接觸器',model:true,sim:CSIM(false),
    note:'Deca Advanced 電子控制接觸器；端子排列照官網產品照片（線圈標 AC/DC A1，沒有極性）'});ver(id);});
// BNE 也能裝 LRD01～35、LR9D：照同電流規格的 M7 機種加進可裝清單
Object.values(TPL).forEach(t=>{if(t.ser!=='TeSys 過電流繼電器'||!t.fits)return;['09','12','18','25','32','38'].forEach(r=>{const m=`lc1d${r}m7`,b=`lc1d${r}bne`;if(t.fits.includes(m)&&!t.fits.includes(b)){t.fits.push(b);t.under[b]={...t.under[m]};}});});
// 四極 LC1DT20～DT40（45 寬）、LC1DT60A／DT80A（70 寬）：照片 1L1 3L2 5L3 7L4／13NO 21NC A1／14NO 22NC A2／2T1 4T2 6T3 8T4
[['DT20',85],['DT25',85],['DT32',91],['DT40',91]].forEach(([r,H])=>[['M7','AC220V'],['BD','DC24V']].forEach(([c,v])=>{const id=`lc1${r}${c}`.toLowerCase(),k=H/85;
  def(id,null,C2,SE,`LC1${r}${c} ${v} 四極`,45,H,H===85?92:99,'K','dark',LAY4([6.5,17,27.8,38],+(9.8*k).toFixed(1),[17.5,28,38.8],+(27.7*k).toFixed(1),+(65.8*k).toFixed(1),+(75*k).toFixed(1),true),
    {ser:'TeSys D 接觸器',model:true,sim:CSIM(true),note:`四極接觸器 ${r.slice(2)}A（AC-1）；端子排列照官網產品照片；線圈 ${v}`});ver(id);}));
[['DT60A','60A'],['DT80A','80A']].forEach(([r,a])=>[['M7','AC220V'],['BD','DC24V']].forEach(([c,v])=>{const id=`lc1${r}${c}`.toLowerCase();
  def(id,null,C2,SE,`LC1${r}${c} ${v} 四極`,70,122,120,'K','dark',LAY4([9.4,26.9,44.5,61.5],10,[30.4,41,51.5],38,78,107,true),
    {ser:'TeSys D 接觸器',model:true,sim:CSIM(true),note:`四極接觸器 ${a}（AC-1）；端子排列照官網產品照片；寬 70（型錄與說明書；有一張外型圖寫 72）`});ver(id);}));

/* ---------- LC2K 一體式正逆轉（兩台 LC1K 並排、內建機械互鎖） ---------- */
// 一台兩組線圈：左邊 F（正轉）、右邊 R（逆轉）；原廠內部接線：上排 L1-L1、L2-L2、L3-L3 並聯，下排左 T1↔右 T3、T2↔T2、左 T3↔右 T1 交叉
[['0610','6A','13'],['0601','6A','21'],['0910','9A','13'],['1210','12A','13']].forEach(([r,a,ax])=>[['M7','AC220V'],['BD','DC24V']].forEach(([c,v])=>{
  const id=`lc2k${r}${c}`.toLowerCase(),nc=ax==='21',bx=nc?'22':'14',xs=[5.3,13.9,22.6,31.1,39.7],sh=45.1;
  const half=(s,o)=>[[`L1${s}`,xs[0]+o,11.7,'top','主接點 1/L1'],[`L2${s}`,xs[1]+o,11.7,'top','主接點 3/L2'],[`L3${s}`,xs[2]+o,11.7,'top','主接點 5/L3'],[`${ax}${s}`,xs[3]+o,11.7,'top',nc?'常閉輔助 21NC':'常開輔助 13NO'],[`A1${s}`,xs[4]+o,11.7,'top','線圈'],
    [`T1${s}`,xs[0]+o,46.3,'bottom','主接點 2/T1'],[`T2${s}`,xs[1]+o,46.3,'bottom','主接點 4/T2'],[`T3${s}`,xs[2]+o,46.3,'bottom','主接點 6/T3'],[`${bx}${s}`,xs[3]+o,46.3,'bottom',nc?'常閉輔助 22NC':'常開輔助 14NO'],[`A2${s}`,xs[4]+o,46.3,'bottom','線圈']];
  const sw=(s,g)=>[{k:'coil',a:'A1'+s,b:'A2'+s,g},...[['L1','T1'],['L2','T2'],['L3','T3']].map(([x,y])=>({k:'sw',a:x+s,b:y+s,by:'coil',g})),{k:'sw',a:ax+s,b:bx+s,by:'coil',g,...(nc?{nc:true}:{})}];
  def(id,null,C2,SE,`LC2K${r}${c} ${v} 正逆轉`,90.6,58,57,'K','dark',[...half('',0),...half('(2)',sh)],{ser:'TeSys LC2K 正逆轉',model:true,
    links:[['L1','L1(2)'],['L2','L2(2)'],['L3','L3(2)'],['T1','T3(2)'],['T2','T2(2)'],['T3','T1(2)']],sim:[...sw('','F'),...sw('(2)','R'),{k:'mlock',g:['F','R']}],
    note:`LC1K ${a} 兩台一體，內建機械互鎖；原廠內部已接好：上排三相並聯、下排左 2/T1 接右 6/T3（換相）；左邊正轉、右邊逆轉，各自的線圈 A1／A2；模擬兩組線圈不會同時吸合；電氣互鎖要自己用${nc?'常閉 21-22':'外加的常閉接點'}接；端子排列照官網產品照片`});ver(id);}));

/* ---------- LC2D 正逆轉組：兩台 LC1D＋機械互鎖，放下時自動接好原廠的並聯與換相線 ---------- */
const PW=[['L1','L1'],['L2','L2'],['L3','L3'],['T1','T3'],['T2','T2'],['T3','T1']];
[...['09','12','18','25','32','38'].map(r=>[r,0.6,'LAD9R1V']),...['40A','50A','65A','80A'].map(r=>[r,9,'LAD4CM'])].forEach(([r,gap,lad])=>['M7','BD'].forEach(c=>{
  const k=`lc1d${r}${c}`.toLowerCase();if(!TPL[k])return;const id=`lc2d${r}${c}`.toLowerCase();
  def(id,null,C2,SE,`LC2D${r}${c} 正逆轉組（機械互鎖 ${lad}）`,gap,+(TPL[k].h*0.6).toFixed(1),40,'ML','mid',[],{ser:'TeSys LC2D 正逆轉組',ilock:true,pair:k,prewire:PW,
    note:`放下時左右各放一台 ${TPL[k].n}，三台一起移動，並自動接好原廠的主迴路：上排三相並聯、下排左 2/T1 接右 6/T3（換相）；模擬兩台不會同時吸合；電氣互鎖要自己用兩台的 21-22 接；整組寬 ${gap<1?90:119}（型錄 LC2D 尺寸圖）`});ver(id);}));

/* ---------- 正面輔助接點 LADN／LADC、延時模組 LADT／LADR／LADS ---------- */
const FRONT=(id,name,W,H,D,T,sim,note)=>{def(id,null,C2,SE,name,W,H,D,'KX','dark',T,{ser:'TeSys D 附件',front:true,sim,note:`疊在接觸器正面：拖到 LC1D 上會自動裝上，跟著接觸器的線圈動作；${note}`});ver(id);};
const HS=(a,b,nc)=>({k:'sw',a,b,by:'host',...(nc?{nc:true}:{})});
FRONT('ladn11','LADN11 輔助接點 1NO+1NC',23,49,37,[['53',5.8,8.4,'top','常開 53NO'],['61',16.6,8.4,'top','常閉 61NC'],['54',5.8,40.6,'bottom','常開 54NO'],['62',16.6,40.6,'bottom','常閉 62NC']],[HS('53','54'),HS('61','62',1)],'端子照官網產品照片');
const N22=(a,b)=>[['53',6.4,8.4,'top','常開 53NO'],['61',17,8.4,'top','常閉 61NC'],[a[0],27.9,8.4,'top',`常閉 ${a[0]}NC`],[b[0],38.5,8.4,'top',`常開 ${b[0]}NO`],['54',6.4,40.3,'bottom','常開 54NO'],['62',17,40.3,'bottom','常閉 62NC'],[a[1],27.9,40.3,'bottom',`常閉 ${a[1]}NC`],[b[1],38.5,40.3,'bottom',`常開 ${b[1]}NO`]];
FRONT('ladn22','LADN22 輔助接點 2NO+2NC',44,49,37,N22(['71','72'],['83','84']),[HS('53','54'),HS('61','62',1),HS('71','72',1),HS('83','84')],'端子照官網產品照片');
FRONT('ladc22','LADC22 輔助接點 2NO+2NC（含先開後閉）',44,49,37,N22(['75','76'],['87','88']),[HS('53','54'),HS('61','62',1),HS('75','76',1),HS('87','88')],'75-76 常閉先開、87-88 常開後閉；模擬不分先後；端子照官網產品照片');
[['T','通電延時',['55','56','67','68'],1],['R','斷電延時',['57','58','65','66'],0],['S','Y-Δ 用延時',['55','56','67','68'],1]].forEach(([k,txt,[a,b,c2,d2],tNC])=>(k==='S'?[['2','1～30']]:[['0','0.3～3'],['2','1～30'],['4','10～180']]).forEach(([r,sec])=>{
  const id=`lad${k}${r}`.toLowerCase(),L=tNC?'常閉':'常開',R=tNC?'常開':'常閉';
  FRONT(id,`LAD${k}${r} ${txt} ${sec} 秒`,44,47,57,[[a,6.4,8.3,'top',`${L} ${a}`],[c2,37.2,8.3,'top',`${R} ${c2}`],[b,6.4,37.5,'bottom',`${L} ${b}`],[d2,37.2,37.5,'bottom',`${R} ${d2}`]],
    [HS(a,b,tNC),HS(c2,d2,!tNC)],`${txt} ${sec} 秒（1NO+1NC）；模擬沒有時間，接觸器吸合後接點就切換（不算延遲時間）；端子照官網產品照片`);}));

/* ---------- GV3P 馬達保護斷路器（55×132） ---------- */
[['13','9～13'],['18','12～18'],['25','17～25'],['32','23～32'],['40','30～40'],['50','37～50'],['65','48～65'],['73','62～73'],['80','70～80']].forEach(([r,A])=>{const id='gv3p'+r;
  def(id,null,C1,SE,`GV3P${r} ${A}A`,55,132,136,'QM','dark',[...[['1',9.6],['3',27.5],['5',45.5]].map(([t,x])=>[t,x,13,'top',`${t}/L${(+t+1)/2} 電源側`]),...[['2',9.6],['4',27.5],['6',45.5]].map(([t,x])=>[t,x,121,'bottom',`${t}/T${t/2} 負載側`])],
    {ser:'TeSys GV3 馬達保護',sim:BRK,note:`旋鈕操作；熱動電磁式，設定電流 ${A}A；上排 1L1 3L2 5L3 照官網產品照片，下排 2T1 4T2 6T3 本體沒印字、照接線圖`});ver(id);});

/* ---------- LRD313～380：插在 LC1D40A～D80A 下方（裝上後高度 185） ---------- */
const host40=rs=>D40.filter(([,r])=>rs.includes(r)).map(([id])=>id),R3=['40A','50A','65A'];
const relay3=(id,name,fits)=>{const T=[...[['97',10.9],['98',21.6],['95',32.6],['96',43.2]].map(([t,x])=>[t,x,39,'top',(/9[56]/.test(t)?'跳脫常閉 ':'跳脫常開 ')+t]),...[['T1',10],['T2',27.3],['T3',45.2]].map(([t,x],i)=>[t,x,61,'bottom',`主迴路出 ${2*i+2}/${t}（接馬達）`])];
  def(id,null,C2,SE,name,55,70,123,'F','dark',T,{ser:'TeSys 過電流繼電器',sim:TRIP,trip:true,attach:'under',fits,under:Object.fromEntries(fits.map(h=>[h,{x:0,y:115}])),plug:{T1:'T1',T2:'T2',T3:'T3'},
    note:`拖到 LC1D40A～D80A 下方會自動裝上（可裝機種照型錄對照表），銅片插進 2/T1…，和接觸器算同一點；輔助端子 97NO 98NO 95NC 96NC（LRD 系列同一個排列，照實物照片 LRD356）；模擬可跳脫／復歸`});ver(id);};
[['313','9～13',R3],['318','12～18',R3],['325','17～25',R3],['332','23～32',R3],['340','30～40',R3],['350','37～50',R3],['365','48～65',['50A','65A']],['380','62～80',['80A']]].forEach(([r,A,rs])=>relay3('lrd'+r,`LRD${r} ${A}A Class 10`,host40(rs)));
[['313','9～13'],['318','12～18'],['325','17～25'],['332','23～32'],['340','30～40'],['350','37～50'],['365','48～65']].forEach(([r,A])=>relay3('lrd'+r+'l',`LRD${r}L ${A}A Class 20`,host40(r==='365'?['50A','65A']:R3)));

/* ---------- GV2 附加接點：GVAE 正面、GVAN／GVAD 左側（跟著斷路器 ON／OFF） ---------- */
const GVH=[...GV2.map(([r])=>'gv2p'+r),...GV2.map(([r])=>'gv2me'+r).filter(id=>TPL[id])];
const BS=(a,b,nc)=>({k:'sw',a,b,by:'hostbrk',...(nc?{nc:true}:{})});
[['GVAE11','1NO+1NC',[['13',7.2],['14',15],['21',28.1],['22',36.5]],[BS('13','14'),BS('21','22',1)]],['GVAE20','2NO',[['13',7.2],['14',15],['23',28.1],['24',36.5]],[BS('13','14'),BS('23','24')]]].forEach(([m,txt,T,sim])=>{const id=m.toLowerCase();
  def(id,null,C1,SE,`${m} 正面附加接點 ${txt}`,44.5,12.9,32.1,'QX','dark',T.map(([t,x])=>[t,x,6.5,'top',(/[34]$/.test(t)?'常開 ':'常閉 ')+t]),{ser:'TeSys GV2 附件',front:true,hostCat:C1,fits:[...GVH,...Object.keys(TPL).filter(k=>/^gv3p/.test(k))],frontAt:{y:18},sim,
    note:'插在 GV2／GV3 正面上方端子下的插槽：拖到斷路器上會自動裝上，接點跟著斷路器 ON／OFF；官網照片四顆螺絲沒印編號，左右兩對的編號順序依接線圖推定'});ver(id);});
[['GVAN11','1NO+1NC',[['31',8.6,'常閉 31'],['43',17.2,'常開 43'],['44',69.6,'常開 44'],['32',78.7,'常閉 32']],[BS('43','44'),BS('31','32',1)],'43-44 常開、31-32 常閉'],
 ['GVAD1010','1NO 故障＋1NO',[['53',8.6,'常開 53'],['97',17.2,'故障常開 97'],['98',69.6,'故障常開 98'],['54',78.7,'常開 54']],[BS('53','54')],'53-54 常開跟著 ON／OFF；97-98 是故障跳脫訊號（模擬沒有故障跳脫，一直打開）']].forEach(([m,txt,T,sim,nt])=>{const id=m.toLowerCase();
  def(id,null,C1,SE,`${m} 左側附加接點 ${txt}`,9.3,89.2,65.8,'QX','dark',T.map(([t,y,dsc])=>[t,4.65,y,y<45?'top':'bottom',dsc]),{ser:'TeSys GV2 附件',attach:'side',sideL:true,hostCat:C1,fits:[...GVH,...Object.keys(TPL).filter(k=>/^gv3p/.test(k))],sim,
    note:`貼在 GV2／GV3 左側：拖到斷路器上會自動裝上；${nt}；端子編號照本體印字，哪個在外側、哪個在內側依印字錯開方式推定`});ver(id);});
})();

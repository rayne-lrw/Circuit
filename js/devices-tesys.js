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
})();

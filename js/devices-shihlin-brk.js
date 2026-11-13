"use strict";
/* ---------- 士林 斷路器：NF 無熔線、NV 漏電、BH 分電盤用、NVB／NVP 住宅用漏電 ----------
   資料來源：士林 2026 版斷路器型錄（NF 規格表 02～05、NV 規格表 12～17、BH 18～19、NVB／NVP 20、外形尺寸 38～39）
   - 同一框架容量因型式不同會有不同外形（例如 NF100-CN 與 NF100-HN），這裡照「外形組 × 框架 × 極數 × 電流」每種做一個，同組的型式（CN／SN／HN…）在型號欄改
   - 端子：外形圖每極上下各一顆、沒印編號；推定上排電源側 1 3 5、下排負載側 2 4 6，由左到右；
     4P 外形圖左極標 N（38 頁），所以 4P 是 N 1 3 5／N 2 4 6（下排的 N 叫 N(2)）
   - 2P 用 3P 框架（225AF 以上）時端子在左右兩極；深度用含把手的總深（ca）
   - 內部附件（AL／AX／SHT／UVT）型錄沒有接點標號，等資料再做
   - 模擬：每極一個斷路器接點；NV、NVB、NVP 有「測試」按鈕（ON 時按下漏電跳脫） */
(function(){
const SL='士林',SRC='士林 2026 版斷路器型錄',ver=id=>{VER[id]=[2,SRC];};
// 外形組：寬（依極數）、高、總深、極距、端子離上下緣、3P 框架做 2P
const G={
  A:{w:{2:50,3:75,4:100},h:130,d:90,p:25,ty:10},
  B:{w:{2:60,3:90,4:120},h:155,d:90,p:30,ty:12},
  C:{w:{2:105,3:105,4:140},h:165,d:92,p:35,ty:13,wide2:true},
  D:{w:{2:140,3:140,4:185},h:257,d:155,p:44,ty:20,wide2:true},
  E:{w:{3:210,4:280},h:275,d:155,p:70,ty:22},
  BH:{w:{1:25,2:50,3:75},h:95,d:77.5,p:25,ty:8},
  BP:{w:{1:25,2:50,3:75},h:74,d:74,p:25,ty:7},
  BA:{w:{1:25,2:50,3:75},h:79,d:77.5,p:25,ty:7}};
const UP=['1','3','5'],DN=['2','4','6'];
// 端子與模擬：poles 可以是 1、2、3、4（4P 左極 N）、'1N'（1P+N：左 N 右 1，寬 50）、'1W'（1P 2 線式：寬 25 裡左 N 右 1）
function terms(g,P){const W=P==='1N'?(g.w.N||50):g.w[P==='1W'?1:P],T=[],S=[];
  const add=(top,bot,x)=>{T.push([top,+x.toFixed(1),g.ty,'top','電源側'+(top==='N'?' 中性線':'')],[bot,+x.toFixed(1),g.h-g.ty,'bottom','負載側'+(top==='N'?' 中性線':'')]);S.push({k:'brk',a:top,b:bot});};
  if(P==='1W'){add('N','N(2)',W*0.28);add('1','2',W*0.72);return {W,T,S};}
  if(P==='1N'){add('N','N(2)',W/2-g.p/2);add('1','2',W/2+g.p/2);return {W,T,S};}
  const n=P===4?3:P,slots=P===2&&g.wide2?[-1,1]:[...Array(P)].map((_,i)=>i-(P-1)/2),xs=slots.map(s=>W/2+s*g.p);
  if(P===4){add('N','N(2)',xs[0]);xs.slice(1).forEach((x,i)=>add(UP[i],DN[i],x));}else xs.forEach((x,i)=>add(UP[i],DN[i],x));
  return {W,T,S};}
const PN={'1W':'1P 2 線式','1N':'1P+N'};
function fam(pre,ser,gk,af,models,byP,o={}){const g=G[gk];Object.entries(byP).forEach(([P,amps])=>{const pk=isNaN(+P)?P:+P,{W,T,S}=terms(g,pk);
  amps.forEach(a=>{const id=`${pre.toLowerCase()}${af}${o.tag||''}-${String(P).toLowerCase()}p${a}`.replace('-1wp','-1w').replace('-1np','-1n');
    def(id,null,C1,SL,`${o.nm||pre+af} ${PN[P]||P+'P'} ${a}A${o.tag==='h'?'（大框）':o.tag==='c'?'（小框）':''}${o.el?' 漏電':''}`,W,g.h,g.d,o.el?'ELB':'Q','light',T,{ser,model:true,
      sim:[...S,...(o.el?[{k:'eltest',btn:'測試'}]:[])],
      note:`${models}；${PN[P]||P+'P'} ${a}A；同外形的型式在型號欄改${o.note?'；'+o.note:''}；外形照型錄 ${W}×${g.h}×${g.d}（深度含把手）；`+
        `端子編號推定${P===4?'（左極 N，照外形圖）':P==='1W'||P==='1N'?'（N 在左邊）':''}${P===2&&g.wide2?'；2P 是 3P 框架拿掉中間極':''}${o.el?'；模擬：ON 時在模擬面板按「測試」會漏電跳脫（漏電本身不模擬），點斷路器復歸':''}`});ver(id);});});}
const F=(a,b)=>a.filter(x=>x>=b[0]&&x<=b[1]);
const A10=[10,15,20,30,40,50,60,75,100],A125=[...A10,125];
/* ---------- NF 無熔線斷路器 ---------- */
const NF=(af,gk,models,amps,poles=[2,3,4],o)=>fam('NF','NF 無熔線',gk,af,models,Object.fromEntries(poles.map(p=>[p,amps])),o);
NF(30,'A','NF30-SN',[3,5,10,15,20,30]);
NF(50,'A','NF50-CN／SN／HN',[10,15,20,30,40,50]);
NF(100,'A','NF100-CN／MN／SN',A10);
NF(100,'B','NF100-HN（125AF 外形）',A10,[2,3,4],{tag:'h'});
NF(125,'A','NF125-CT／ST（100AF 外形）',A125,[2,3,4],{tag:'c'});
NF(125,'B','NF125-SN／HN／HT',A125);
NF(225,'C','NF225-CN／SN',[125,150,175,200,225],[2,3,4],{note:'額定電流可調 80%、100%'});
NF(250,'C','NF250-CN／SN／HT',[125,150,175,200,225,250],[2,3,4],{note:'CN／SN 額定電流可調 80%、100%'});
NF(400,'D','NF400-CN／SN／HN／RN／UN',[250,300,350,400]);
NF(630,'D','NF630-ST／LT／HT',[500,600,630],[3,4]);
NF(800,'E','NF800-CN／SN（700、800A）、NF800-HN／RN（500～800A）',[500,600,630,700,800],[3,4]);
/* ---------- NV 漏電斷路器（3P：1φ2W、1φ3W、3φ3W；4P：3φ4W） ---------- */
const NV=(af,gk,models,amps,o={})=>fam('NV','NV 漏電',gk,af,models,{3:amps,4:amps},{el:true,note:'3P 用於 1φ2W、1φ3W、3φ3W，4P 用於 3φ4W；額定感度電流在型號欄改'+(o.note?'；'+o.note:''),tag:o.tag});
NV(30,'A','NV30-SN',[15,20,30]);
NV(50,'A','NV50-SN／HN',[15,20,30,40,50]);
NV(100,'B','NV100-CN（60～100A）／MN／SN',[15,20,30,40,50,60,75,100]);
NV(125,'B','NV125-SN／HN',[15,20,30,40,50,60,75,100,125]);
NV(125,'A','NV125-CT／ST（TYPE A，100AF 外形）',[15,20,30,40,50,60,75,100,125],{tag:'c'});
NV(225,'C','NV225-CN／SN',[125,150,175,200,225],{note:'額定電流可調 80%、100%'});
NV(250,'C','NV250-CN／SN',[250],{note:'額定電流可調 80%、100%'});
NV(400,'D','NV400-CN／SN／HN／UN',[250,300,350,400]);
NV(630,'D','NV630-HT',[500,600,630]);
NV(800,'E','NV800-RN',[500,600,630,700,800]);
/* ---------- BH 分電盤用（每極 25 mm）：螺栓式 BH／BHU／BHH／BHS，插入式 BPL／BLU／BLS，BAH ---------- */
const BHL=(pre,af,gk,models,byP,note)=>fam(pre,'BH 分電盤',gk,af,models,byP,{note});
BHL('BH',100,'BH','BH／BHU／BHH／BHS（壓著端子）',{1:A10,2:A10,3:A10},'1P 有 110V、220V 兩種，型號欄改');
BHL('BPL',100,'BP','BPL／BLU／BLS（插入式）',{1:[15,20,30,40,50],2:[15,20,30,40,50,60,75,100],3:[15,20,30,40,50,60,75,100]},'插入式：電源側插在分電盤匯流排上（這裡當一般端子），負載側壓著端子');
BHL('BAH',100,'BA','BAH（插入式）',{1:[15,20,30,40,50],2:[15,20,30,40,50,60,75,100],3:[15,20,30,40,50,60,75,100]},'插入式：電源側插在分電盤匯流排上（這裡當一般端子），負載側壓著端子');
/* ---------- NVB／NVP 住宅用漏電斷路器（1φ2W，15～50A） ---------- */
const NA=[15,20,30,40,50],NVBF=(pre,gk,h,d,models,byP,note)=>{G[gk]={w:{1:25,2:50,3:75},h,d,p:25,ty:8};fam(pre,'NVB 住宅漏電',gk,50,models,byP,{el:true,note,nm:models.split('（')[0].split('／')[0]});};
NVBF('NVB','NVL',110,78.4,'NVB-50L／50UL',{'1W':NA,2:NA},'1P 2 線式 110V、2P 220V；額定感度電流在型號欄改');
NVBF('NVBHS','NVS',97,78.5,'NVB-50HS',{'1W':NA,2:NA},'1P 2 線式 110V／220V、2P 220V');
NVBF('NVBHM','NVM',100,79.5,'NVB-50HM',{'1W':NA,2:NA},'1P 2 線式 110～220V、2P 220V');
G.NVH={w:{1:25,2:75,N:50},h:95,d:77.5,p:25,ty:8};fam('NVBH','NVB 住宅漏電','NVH',50,'NVB-50H',{'1N':NA,2:NA},{el:true,nm:'NVB-50H',note:'1P+N 110／220V（寬 50）、2P 220／380V（寬 75）'});
NVBF('NVP','NVPL',92,78.4,'NVP-50L／50UL（插入式）',{'1W':NA,2:NA},'插入式：電源側插在分電盤匯流排上（這裡當一般端子）');
})();

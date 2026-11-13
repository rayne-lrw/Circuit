"use strict";
/* ---------- IDEC YW 系列 ø22 控制元件：操作部＋可拆裝接點塊 ----------
   資料來源：IDEC YW 系列型錄 TP1173（各型號接點結構表、接點塊安裝位置、外形尺寸圖、保養用零件）
   - 操作部背後有 ①②③ 三個接點塊位置（各 10 mm）；接點塊拖上去裝、拖離拆下（插槽機制）
   - 器具庫列型錄標準組合（例如 YW1B-M1E11）：放下時照接點結構把接點塊裝好，之後可以自己拆裝
   - 照光型的 ② 固定是全電壓型轉接器（FA，燈 X1／X2）；緊急停止不能裝雙接點塊（型錄註明）
   - 端子編號型錄沒印，依 IDEC 慣例推定：常閉 1-2、常開 3-4；FA 的燈端子推定 X1／X2
   - 裝在操作部上時端子照位置編序號（IEC 60947-5-1，state.js 的 ywNo）：① 1x、② 2x、③ 3x；雙接點塊後面那個接點 ① 4x、② 5x、③ 6x
   - 顏色、樹脂框（YW1）／金屬框（YW4）、燈的電壓不影響接線，在型號欄改（例如 YW1B-M1E11G、YW4B-…）
   - 模擬：按鈕瞬時型按著才動作、交替型與緊急停止點一下切換；選擇開關照凸輪位置：
     2 位置所有接點在 R 被壓下；3 位置 ① 在 L、② 在 L 和 R、③ 在 R 被壓下（照型錄接點動作表）
   - 外形：正面 30×41.4（ø40 蘑菇頭與緊急停止 40×41.4），面板後方 45.8 */
(function(){
const ID='IDEC',SRC='IDEC YW 系列型錄 TP1173';
const ver=id=>{VER[id]=[2,SRC];};
/* ---------- 接點塊 ---------- */
const BLK=(id,name,T,sim,o={})=>{def(id,null,D1,ID,name,10,41.4,41.4,'CB','light',T,{sheet:'door',ser:'YW 接點塊',rackKind:o.fa?'fa':'cb',attach:'slot',...(o.dbl?{dbl:true}:{}),sim,
  note:`${o.fa?'全電壓型轉接器（照光按鈕、指示燈的燈，裝在 ② 的位置）':'接點塊'}：拖到 YW 操作部上會裝進空的位置，跟著操作部動作${o.fa?'':'，裝上後端子照位置編號（① 1x、② 2x、③ 3x）'}；端子編號依 IDEC 慣例推定${o.note?'；'+o.note:''}`});ver(id);};
const C=(a,b,x,nc)=>[[a,x,10.7,'top',(nc?'常閉 ':'常開 ')+a.replace(/\(\d\)/,'')],[b,x,30.7,'bottom',(nc?'常閉 ':'常開 ')+b.replace(/\(\d\)/,'')]];
const SW=(a,b,nc)=>({k:'sw',a,b,by:'op',...(nc?{nc:true}:{})});
BLK('yw-e10','YW-E10 接點塊 1NO',C('3','4',5),[SW('3','4')]);
BLK('yw-e01','YW-E01 接點塊 1NC',C('1','2',5,1),[SW('1','2',1)]);
BLK('yw-ew20','YW-EW20 雙接點塊 2NO',[...C('3','4',2.8),...C('3(2)','4(2)',7.2)],[SW('3','4'),SW('3(2)','4(2)')],{dbl:true,note:'兩個接點前後疊在同一個位置'});
BLK('yw-ew11','YW-EW11 雙接點塊 1NO-1NC',[...C('3','4',2.8),...C('1','2',7.2,1)],[SW('3','4'),SW('1','2',1)],{dbl:true,note:'兩個接點前後疊在同一個位置'});
BLK('yw-ew02','YW-EW02 雙接點塊 2NC',[...C('1','2',2.8,1),...C('1(2)','2(2)',7.2,1)],[SW('1','2',1),SW('1(2)','2(2)',1)],{dbl:true,note:'兩個接點前後疊在同一個位置'});
BLK('yw-fa','YW 全電壓型轉接器（FA）',[['X1',5,10.7,'top','燈 X1'],['X2',5,30.7,'bottom','燈 X2']],[{k:'load',a:'X1',b:'X2',name:'燈'}],{fa:true});

/* ---------- 操作部 ---------- */
// 接點結構 → ①②③ 裝什麼（型錄的接點塊安裝位置表）
const NO='yw-e10',NC='yw-e01',FA='yw-fa';
const ST={'10':[NO,0,0],'01':[0,0,NC],'20':[NO,0,NO],'02':[NC,0,NC],'11':[NO,0,NC],'30':[NO,NO,NO],'03':[NC,NC,NC],'21':[NO,NC,NO],'12':[NO,NC,NC]};
const ST3={'20':[NO,0,NO],'20N1':[0,NO,NO],'02':[NC,0,NC],'02N1':[0,NC,NC],'11':[NO,0,NC],'11N1':[NC,0,NO],'11N2':[NO,NC,0],'11N3':[0,NC,NO],'11N4':[0,NO,NC],'30':[NO,NO,NO],'03':[NC,NC,NC],'21':[NO,NC,NO],'12':[NC,NO,NC]};
const TXT=c=>({'10':'1NO','01':'1NC','20':'2NO','02':'2NC','11':'1NO-1NC','30':'3NO','03':'3NC','21':'2NO-1NC','12':'1NO-2NC'}[c.slice(0,2)]||c)+(c.length>2?`（${c}）`:'');
const ACT2={0:['R'],1:['R'],2:['R']},ACT3={0:['L'],1:['L','R'],2:['R']};
function op(id,model,name,ser,pre,look,W,cbs,o){
  const off=(W-30)/2,illum=cbs[1]===FA;
  const T=o.lamp?[['X1',W/2,10.7,'top','燈 X1'],['X2',W/2,30.7,'bottom','燈 X2']]:[];
  def(id,null,D1,ID,`${model} ${name}`,W,41.4,45.8,pre,look,T,{sheet:'door',round:true,model:true,ser,cbHost:true,op:o.op||null,noDbl:!!o.noDbl,
    ...(o.lamp?{sim:[{k:'load',a:'X1',b:'X2',name:'燈'}]}:o.op&&o.op.k==='mom'?{sim:[{k:'op',btn:'按下'}]}:{}),
    cbs:o.lamp?null:cbs.map(x=>x||null),rack:o.lamp?null:[{k:'cb',x:off,w:10},{k:illum?'fa':'cb',x:off+10,w:10},{k:'cb',x:off+20,w:10}],
    note:`${o.note}；顏色、框（樹脂 YW1／金屬 YW4）${illum||o.lamp?'、燈的電壓':''}在型號欄改；${o.lamp?'燈端子 X1／X2 推定':'背後 ①②③ 接點塊可以拆裝，放下時照型錄接點結構裝好'}；正面 ${W}×41.4、面板後方 45.8；面板厚 0.8～6 mm`});ver(id);
  if(o.lamp){delete TPL[id].rack;delete TPL[id].cbHost;}
}
const lc=s=>s.toLowerCase();
// 按鈕開關（樹脂框 YW1B）：平頭 M1E／A1E、凸頭 M2E／A2E、ø40 蘑菇頭 M4E／A4E
const BASIC=['10','01','20','02','11'];
[['M1','平頭',30,Object.keys(ST)],['A1','平頭',30,BASIC],['M2','凸頭',30,BASIC],['A2','凸頭',30,BASIC],['M4','ø40 蘑菇頭',40,BASIC],['A4','ø40 蘑菇頭',40,BASIC]].forEach(([k,head,W,cs])=>cs.forEach(c=>{
  const mom=k[0]==='M',m=`YW1B-${k}E${c}`;
  op(lc(m),m,`按鈕 ${head} ${mom?'瞬時':'交替'} ${TXT(c)}`,'YW 按鈕開關','PB','dark',W,ST[c],{op:{k:mom?'mom':'alt'},note:`${head}按鈕，${mom?'瞬時型：按著才動作':'交替型：按一下動作、再按一下復歸'}`});}));
// 照光按鈕開關（YW1L）：② 是全電壓型轉接器
[['M2','凸頭',30],['A2','凸頭',30],['M4','ø40 蘑菇頭',40],['A4','ø40 蘑菇頭',40]].forEach(([k,head,W])=>BASIC.forEach(c=>{
  const mom=k[0]==='M',m=`YW1L-${k}E${c}`,s=ST[c];
  op(lc(m),m,`照光按鈕 ${head} ${mom?'瞬時':'交替'} ${TXT(c)}`,'YW 按鈕開關','PB','dark',W,[s[0],FA,s[2]],{op:{k:mom?'mom':'alt'},note:`照光${head}按鈕，${mom?'瞬時型':'交替型'}；燈在 ② 的全電壓型轉接器（X1／X2）`});}));
// 緊急停止（按下鎖定、拉出／旋轉復歸）
['01','02','03','11','12','21'].forEach(c=>{const m=`YW1B-V4E${c}R`;
  op(lc(m),m,`緊急停止 ø40 ${TXT(c)}`,'YW 緊急停止','ES','red',40,ST[c],{op:{k:'alt'},noDbl:true,note:'按下鎖定、拉出或旋轉復歸（模擬點一下鎖定、再點一下復歸）；不能裝雙接點塊'});});
['01','02','11'].forEach(c=>{const m=`YW1L-V4E${c}R`,s=ST[c];
  op(lc(m),m,`照光緊急停止 ø40 ${TXT(c)}`,'YW 緊急停止','ES','red',40,[s[0],FA,s[2]],{op:{k:'alt'},noDbl:true,note:'照光型，按下鎖定、拉出或旋轉復歸；燈在 ② 的全電壓型轉接器；不能裝雙接點塊'});});
// 選擇開關（YW1S）與鑰匙選擇開關（YW1K）
const SEL=[['YW1S','選擇開關','YW 選擇開關','SS','dark',''],['YW1K','鑰匙選擇開關','YW 鑰匙開關','SS','dark','A']];
SEL.forEach(([s,nm,ser,pre,look,keyA])=>{
  [['2'+keyA,'交替',null],['21'+(keyA?'B':''),'從右復歸','R']].forEach(([k,txt,ret])=>Object.keys(ST).forEach(c=>{const m=`${s}-${k}E${c}`;
    op(lc(m),m,`${nm} 2 位置 ${txt} ${TXT(c)}`,ser,pre,look,30,ST[c],{op:{k:'sel',n:2,def:'L',act:ACT2,ret},note:`2 位置（L／R，90°）${txt}；接點在 R 被壓下（常開閉合、常閉打開）${ret?'；R 放開回 L':''}；模擬點右半邊切到 R、左半邊回 L`});}));
  [['3'+keyA,'交替',''],['31'+(keyA?'B':''),'從右復歸','R'],['32'+(keyA?'C':''),'從左復歸','L'],['33'+(keyA?'D':''),'雙向復歸','LR']].forEach(([k,txt,ret])=>Object.keys(ST3).forEach(c=>{const m=`${s}-${k}E${c}`;
    op(lc(m),m,`${nm} 3 位置 ${txt} ${TXT(c)}`,ser,pre,look,30,ST3[c],{op:{k:'sel',n:3,def:'C',act:ACT3,ret},note:`3 位置（L／C／R，45°）${txt}；① 在 L、② 在 L 和 R、③ 在 R 被壓下；模擬點左半邊切到 L、右半邊切到 R（再點一次回 C）${ret?`；${ret==='LR'?'兩邊':ret==='R'?'R 那邊':'L 那邊'}放開回 C`:''}`});}));
});
// 指示燈
op('yw1p-1uq','YW1P-1UQ','指示燈 平頭（一體型）','YW 指示燈','PL','dark',30,[0,0,0],{lamp:true,note:'一體型指示燈（燈與端子一體），X1／X2 有電就亮'});
op('yw1p-1eq','YW1P-1EQ','指示燈 平頭（組合型）','YW 指示燈','PL','dark',30,[0,FA,0],{note:'組合型指示燈，燈在 ② 的全電壓型轉接器（X1／X2）'});
op('yw1p-2teq','YW1P-2TEQ','指示燈 凸頭（組合型）','YW 指示燈','PL','dark',30,[0,FA,0],{note:'組合型指示燈，燈在 ② 的全電壓型轉接器（X1／X2）'});
})();

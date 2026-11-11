"use strict";
/* ---------- 三菱 MELSEC-Q 系列（底座插槽式）：先做試用的 5 種 ----------
   資料來源：QCPU 用戶手冊（硬件設計／維護點檢篇）外形尺寸圖、各部位名稱圖；I/O 模塊用戶手冊的端子排編號／信號名稱表
   - 基板記住每一槽的位置（電源槽、CPU 槽、I/O 槽 0～），模組拖到基板上會吸到最近的空槽、跟著基板移動
   - 槽位置：電源模組寬 55.2、CPU 與 I/O 每槽寬 27.4，靠右排列，左邊剩下的是擴展電纜接頭區（依外形圖估算）
   - I/O 模組的接點用模組上的編號（X00～X0F），裝到基板上後依槽位自動換成實際位址（0 槽 X00～、1 槽 X10～…）
   - 18 點端子排：TB1、3、5…在左排，TB2、4、6…在右排，上下錯開半格（端子實際 mm 位置是大概） */
(function(){
const MIT='三菱',SRC='三菱 QCPU 用戶手冊 外形尺寸圖',NOTE='接點名稱與順序依手冊；端子實際位置依外形圖估算';
const ver=id=>{VER[id]=[2,SRC];};
const IO=27.4,PW=55.2;
// 基板：n 個 I/O 槽，靠右排列
function rackOf(W,n){const end=W-0.5,io=[...Array(n).keys()].map(j=>({k:'io',x:+(end-IO*(n-j)).toFixed(2),w:IO}));const cpu={k:'cpu',x:+(io[0].x-IO).toFixed(2),w:IO};return [{k:'pwr',x:+(cpu.x-PW).toFixed(2),w:PW},cpu,...io];}
def('q35b',null,C4,MIT,'Q35B 主基板（5 槽）',245,98,44.1,'QB','mid',[],{ser:'Q 基板',rack:rackOf(245,5),noOv:false,
  note:'電源槽、CPU 槽、I/O 槽 5 個；把模組拖到基板上會自動吸到槽位；基板本身沒有接線端子；'+NOTE});ver('q35b');
// 電源模組：前面板右側一排端子（ERR 兩個是接點、FG、LG、AC 輸入 N、L）
const pT=(ids)=>ids.map(([id,d],i)=>[id,44,+(50+i*7).toFixed(1),'right',d]);
def('q61p',null,C4,MIT,'Q61P 電源模組（AC100–240V 輸入、DC5V 6A）',PW,98,90,'PS','dark',
  pT([['ERR','ERR 接點（正常時 ON）'],['ERR(2)','ERR 接點另一端'],['FG','接地'],['LG','濾波器接地'],['N','AC 電源輸入'],['L','AC 電源輸入']]),
  {ser:'Q 電源',rackKind:'pwr',attach:'slot',sim:[{k:'pwr',a:'L',b:'N'}],note:'裝在基板的電源槽；ERR 接點在運轉正常時閉合；'+NOTE});ver('q61p');
// CPU：只有通訊接口（每個接口畫成一個接點）
def('q03udvcpu',null,C4,MIT,'Q03UDVCPU 通用型 CPU',IO,98,115,'CPU','dark',[['USB',13.7,55,'right','USB Mini-B 接口'],['ETH',13.7,88,'bottom','乙太網路 RJ45 接口']],
  {ser:'Q CPU',rackKind:'cpu',attach:'slot',vlab:['USB','ETH'],note:'裝在基板的 CPU 槽；另有 SD 卡槽；接口各畫成一個接點；'+NOTE});ver('q03udvcpu');
// 18 點端子排
const hex=v=>v.toString(16).toUpperCase().padStart(2,'0');
function tb18(sig,desc){return sig.map((id,i)=>{if(!id)return null;const L=i%2===0,k=Math.floor(i/2);return [id,L?10.5:18.5,+(20+k*8.2+(L?0:4.1)).toFixed(2),L?'left':'right',desc(id,i+1)];}).filter(Boolean);}
const X16=[...Array(16).keys()].map(i=>'X'+hex(i)),Y16=[...Array(16).keys()].map(i=>'Y'+hex(i));
const ioDesc=(id,tb)=>`TB${tb} `+(/^X/.test(id)?'輸入':/^Y/.test(id)?'輸出':id==='COM'?'共點':'');
def('qx40',null,C4,MIT,'QX40 DC 輸入模組（16 點、正公共端）',IO,98,90,'QX','dark',tb18([...X16,'COM',null],ioDesc),
  {ser:'Q 輸入輸出',rackKind:'io',attach:'slot',qpts:16,sim:[{k:'plcX',com:'COM',pts:X16}],
   note:'DC24V 輸入、16 點一個共點（TB17）、TB18 空；裝在基板上後 X00～X0F 依槽位換成實際位址；'+NOTE});ver('qx40');
def('qy10',null,C4,MIT,'QY10 繼電器輸出模組（16 點）',IO,98,90,'QY','dark',tb18([...Y16,'COM',null],ioDesc),
  {ser:'Q 輸入輸出',rackKind:'io',attach:'slot',qpts:16,sim:[{k:'plcY',pairs:Y16.map(y=>[y,'COM'])}],
   note:'24VDC 2A／240VAC 2A、16 點一個共點（TB17）、TB18 空；裝在基板上後 Y00～Y0F 依槽位換成實際位址；'+NOTE});ver('qy10');
})();

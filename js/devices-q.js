"use strict";
/* ---------- 三菱 MELSEC-Q 系列（底座插槽式） ----------
   資料來源：QCPU 用戶手冊（硬件設計／維護點檢篇）外形尺寸圖、各部位名稱圖、規格表；
            I/O 模塊用戶手冊的端子排編號／連接器引腳編號與信號名稱表、連接器／端子排轉換模組連接圖與外形圖
   - 基板記住每一槽的位置（電源槽、CPU 槽、I/O 槽 0～），模組拖到基板上會吸到最近的空槽、跟著基板移動
   - 槽位置：電源模組寬 55.2（超薄型 27.4、冗餘 83）、CPU 與 I/O 每槽寬 27.4，靠右排列（依外形圖估算）
   - I/O 模組的接點用模組上的信號名稱（X00～、Y00～），裝到基板上後依槽位自動換成實際位址
   - 端子實際 mm 位置是依外形圖估算的大概位置；名稱與順序依手冊信號名稱表 */
(function(){
const MIT='三菱',SRC='三菱 QCPU 用戶手冊／I/O 模塊用戶手冊 外形尺寸圖',NOTE='接點名稱與順序依手冊；端子實際位置依外形圖估算';
const ver=id=>{VER[id]=[2,SRC];};
const IO=27.4,PW=55.2,PWS=27.4,PWR=83;
const idOf=n=>n.toLowerCase().replace(/[^a-z0-9]+/g,'-');
const {dedup}=self.FXLIB||{dedup:()=>[]};

/* ---------- 基板 ---------- */
// kinds：槽種類由左到右（pwr 電源、spwr 超薄型電源、rpwr 冗餘電源、cpu、io），靠右排列
function rackOf(W,kinds){const wd={pwr:PW,spwr:PWS,rpwr:PWR,cpu:IO,io:IO};let x=W-0.5;return kinds.slice().reverse().map(k=>{x-=wd[k];return {k,x:+x.toFixed(2),w:wd[k]};}).reverse();}
const ios=n=>Array(n).fill('io');
function base(name,W,D,kinds,o){
  const id=idOf(name),n=kinds.filter(k=>k==='io').length;
  def(id,null,C4,MIT,`${name} ${o.ext?'擴展基板':'主基板'}（${n} 槽）`,W,98,D,'QB','mid',[],{ser:'Q 基板',rack:rackOf(W,kinds),
    note:(o.note?o.note+'；':'')+(o.ext?'擴展基板：右側可設定接在哪個主基板與擴展級數，I/O 位址接在主基板後面；':'')+'基板本身沒有接線端子；'+NOTE});
  TPL[id].qext=!!o.ext;ver(id);
}
[['Q33B',189,3],['Q35B',245,5],['Q38B',328,8],['Q312B',439,12]].forEach(([n,W,k])=>base(n,W,44.1,['pwr','cpu',...ios(k)],{}));
[['Q35DB',245,5],['Q38DB',328,8],['Q312DB',439,12]].forEach(([n,W,k])=>base(n,W,44.1,['pwr','cpu',...ios(k)],{note:'多 CPU 高速主基板'}));
[['Q32SB',114,2],['Q33SB',142,3],['Q35SB',197.5,5]].forEach(([n,W,k])=>base(n,W,18.5,['spwr','cpu',...ios(k)],{note:'超薄型主基板，只能裝 Q61SP 電源，不能擴展'}));
base('Q38RB',439,44.1,['rpwr','rpwr','cpu',...ios(8)],{note:'冗餘電源主基板，裝兩台冗餘電源模組'});
[['Q52B',106,2],['Q55B',189,5]].forEach(([n,W,k])=>base(n,W,44.1,ios(k),{ext:true,note:'不需要電源模組（由主基板供電）'}));
[['Q63B',189,3],['Q65B',245,5],['Q68B',328,8],['Q612B',439,12]].forEach(([n,W,k])=>base(n,W,44.1,['pwr',...ios(k)],{ext:true,note:'要裝電源模組'}));
base('Q68RB',439,44.1,['rpwr','rpwr',...ios(8)],{ext:true,note:'冗餘電源擴展基板'});

/* ---------- 電源模組：前面板右側一排端子（ERR 兩個是接點、FG、LG、輸入兩個） ---------- */
function pwr(name,W,D,kind,inp,o){
  const id=idOf(name),x=W-11,ac=inp==='AC';
  const T=[['ERR',x,50,'right','ERR 接點（正常時閉合）'],['ERR(2)',x,57,'right','ERR 接點另一端'],['FG',x,64,'right','接地'],['LG',x,71,'right','濾波器接地'],
    ...(ac?[['N',x,78,'right','AC 電源輸入'],['L',x,85,'right','AC 電源輸入']]:[['+24V',x,78,'right','DC24V 電源輸入 +'],['24G',x,85,'right','DC24V 電源輸入 −']])];
  if(o.out24)T.push(['+24V',10,50,'left','DC24V 輸出 +（供外部使用）'],['24G',10,57,'left','DC24V 輸出 −']);
  if(o.life)T.push(['LIFE',10,50,'left','LIFE OUT 接點（壽命警報）'],['LIFE(2)',10,57,'left','LIFE OUT 接點另一端']);
  const sim=[{k:'pwr',a:ac?'L':'+24V',b:ac?'N':'24G',...(ac?{}:{polar:true})},{k:'sw',a:'ERR',b:'ERR(2)',by:'host'}];
  if(o.out24)sim.push({k:'src',p:'+24V',n:'24G',v:'24V',in:['L','N']});
  def(id,null,C4,MIT,`${name} 電源模組（${o.txt}）`,W,98,D,'PS','dark',T,{ser:'Q 電源',rackKind:kind,attach:'slot',sim:sim.slice(0,1).concat(o.out24?sim.slice(2):[]),
    note:`裝在基板的${kind==='spwr'?'超薄型基板電源槽':kind==='rpwr'?'冗餘電源槽':'電源槽'}；ERR 接點在運轉正常時閉合；${o.note?o.note+'；':''}${NOTE}`});ver(id);
}
pwr('Q61P-A1',PW,90,'pwr','AC',{txt:'AC100–120V 輸入、DC5V 6A'});
pwr('Q61P-A2',PW,90,'pwr','AC',{txt:'AC200–240V 輸入、DC5V 6A'});
pwr('Q61P',PW,90,'pwr','AC',{txt:'AC100–240V 輸入、DC5V 6A'});
pwr('Q62P',PW,90,'pwr','AC',{txt:'AC100–240V 輸入、DC5V 3A／DC24V 0.6A',out24:true,note:'左側 +24V、24G 是 DC24V 輸出'});
pwr('Q63P',PW,90,'pwr','DC',{txt:'DC24V 輸入、DC5V 6A'});
pwr('Q64P',PW,115,'pwr','AC',{txt:'AC100–120／200–240V 輸入、DC5V 8.5A'});
pwr('Q64PN',PW,115,'pwr','AC',{txt:'AC100–240V 輸入、DC5V 8.5A'});
pwr('Q61P-D',PW,90,'pwr','AC',{txt:'AC100–240V 輸入、DC5V 6A、壽命檢測',life:true,note:'左側 LIFE OUT 接點'});
pwr('Q61SP',PWS,104,'spwr','AC',{txt:'超薄型、AC100–240V 輸入、DC5V 2A'});
pwr('Q63RP',PWR,115,'rpwr','DC',{txt:'冗餘、DC24V 輸入、DC5V 8.5A'});
pwr('Q64RP',PWR,115,'rpwr','AC',{txt:'冗餘、AC100–120／200–240V 輸入、DC5V 8.5A'});
pwr('Q64RPN',PWR,115,'rpwr','AC',{txt:'冗餘、AC100–240V 輸入、DC5V 8.5A'});

/* ---------- CPU：只有通訊接口（每個接口畫成一個接點） ---------- */
const PORT={USB:['USB',13.7,62,'right','USB 接口'],RS:['RS-232',13.7,74,'right','RS-232 接口'],ETH:['ETH',13.7,88,'bottom','乙太網路 RJ45 接口']};
function cpu(name,D,ports,txt){const id=idOf(name);
  def(id,null,C4,MIT,`${name} ${txt}`,IO,98,D,'CPU','dark',ports.map(p=>PORT[p]),{ser:'Q CPU',rackKind:'cpu',attach:'slot',vlab:ports.map(p=>PORT[p][0]),
    note:'裝在基板的 CPU 槽；接口各畫成一個接點；'+NOTE});ver(id);}
[['Q00CPU','基本型'],['Q01CPU','基本型']].forEach(([n,t])=>cpu(n,89.3,['RS'],t+' CPU'));
cpu('Q02CPU',89.3,['RS'],'高性能型 CPU');
['Q02HCPU','Q06HCPU','Q12HCPU','Q25HCPU'].forEach(n=>cpu(n,89.3,['USB','RS'],'高性能型 CPU'));
['Q02PHCPU','Q06PHCPU','Q12PHCPU','Q25PHCPU'].forEach(n=>cpu(n,89.3,['USB','RS'],'過程 CPU'));
['Q00UCPU','Q01UCPU','Q02UCPU'].forEach(n=>cpu(n,89.3,['USB','RS'],'通用型 CPU'));
['Q03UDCPU','Q04UDHCPU','Q06UDHCPU','Q10UDHCPU','Q13UDHCPU','Q20UDHCPU','Q26UDHCPU'].forEach(n=>cpu(n,89.3,['USB'],'通用型 CPU'));
['Q03UDECPU','Q04UDEHCPU','Q06UDEHCPU','Q10UDEHCPU','Q13UDEHCPU','Q20UDEHCPU','Q26UDEHCPU','Q50UDEHCPU','Q100UDEHCPU'].forEach(n=>cpu(n,115,['USB','ETH'],'通用型 CPU（內建乙太網路）'));
['Q03UDVCPU','Q04UDVCPU','Q06UDVCPU','Q13UDVCPU','Q26UDVCPU'].forEach(n=>cpu(n,115,['USB','ETH'],'高速通用型 CPU'));
['Q04UDPVCPU','Q06UDPVCPU','Q13UDPVCPU','Q26UDPVCPU'].forEach(n=>cpu(n,115,['USB','ETH'],'過程用通用型 CPU'));

/* ---------- 一體型 CPU（Q00JCPU、Q00UJCPU）：CPU、電源、5 槽基板一體 ---------- */
[['Q00JCPU',['RS']],['Q00UJCPU',['USB','RS']]].forEach(([n,ports])=>{const id=idOf(n),W=244.4;
  const T=[['FG',62,55,'left','接地'],['LG',62,62,'left','濾波器接地'],['N',62,69,'left','AC 電源輸入'],['L',62,76,'left','AC 電源輸入'],
    ...ports.map((p,i)=>[PORT[p][0],95,62+i*12,'right',PORT[p][4]])];
  def(id,null,C4,MIT,`${n} 一體型 CPU（含電源、5 槽基板）`,W,98,98,'CPU','dark',T,{ser:'Q CPU',rack:rackOf(W,ios(5)),vlab:ports.map(p=>PORT[p][0]),
    sim:[{k:'pwr',a:'L',b:'N'}],note:'CPU、電源（AC100–240V）、5 個 I/O 槽做成一台；I/O 模組拖到右側槽位；'+NOTE});ver(id);});

/* ---------- I/O 模組 ---------- */
// 信號名稱依手冊表格：TB 是 18 點端子排（TB1～18）；C 是 40 針連接器（B20、A20、B19…A01）；C2 是兩個 40 針連接器；D 是 37 針 D-sub（1～37）
const IOD={
  'QX10':['TB','X00 X01 X02 X03 X04 X05 X06 X07 X08 X09 X0A X0B X0C X0D X0E X0F COM .'],
  'QX10-TS':['TB','X00 X01 X02 X03 X04 X05 X06 X07 X08 X09 X0A X0B X0C X0D X0E X0F COM .'],
  'QX28':['TB','X00 . X01 . X02 . X03 . X04 . X05 . X06 . X07 . COM .'],
  'QX40':['TB','X00 X01 X02 X03 X04 X05 X06 X07 X08 X09 X0A X0B X0C X0D X0E X0F COM .'],
  'QX40-S1':['TB','X00 X01 X02 X03 X04 X05 X06 X07 X08 X09 X0A X0B X0C X0D X0E X0F COM .'],
  'QX40-TS':['TB','X00 X01 X02 X03 X04 X05 X06 X07 X08 X09 X0A X0B X0C X0D X0E X0F COM .'],
  'QX41':['C','X00 X10 X01 X11 X02 X12 X03 X13 X04 X14 X05 X15 X06 X16 X07 X17 X08 X18 X09 X19 X0A X1A X0B X1B X0C X1C X0D X1D X0E X1E X0F X1F . . . . COM . COM .'],
  'QX41-S1':['C','X00 X10 X01 X11 X02 X12 X03 X13 X04 X14 X05 X15 X06 X16 X07 X17 X08 X18 X09 X19 X0A X1A X0B X1B X0C X1C X0D X1D X0E X1E X0F X1F . . . . COM . COM .'],
  'QX42':['C2','X00 X10 X01 X11 X02 X12 X03 X13 X04 X14 X05 X15 X06 X16 X07 X17 X08 X18 X09 X19 X0A X1A X0B X1B X0C X1C X0D X1D X0E X1E X0F X1F . . . . COM1 . COM1 . X20 X30 X21 X31 X22 X32 X23 X33 X24 X34 X25 X35 X26 X36 X27 X37 X28 X38 X29 X39 X2A X3A X2B X3B X2C X3C X2D X3D X2E X3E X2F X3F . . . . COM2 . COM2 .'],
  'QX42-S1':['C2','X00 X10 X01 X11 X02 X12 X03 X13 X04 X14 X05 X15 X06 X16 X07 X17 X08 X18 X09 X19 X0A X1A X0B X1B X0C X1C X0D X1D X0E X1E X0F X1F . . . . COM1 . COM1 . X20 X30 X21 X31 X22 X32 X23 X33 X24 X34 X25 X35 X26 X36 X27 X37 X28 X38 X29 X39 X2A X3A X2B X3B X2C X3C X2D X3D X2E X3E X2F X3F . . . . COM2 . COM2 .'],
  'QX50':['TB','X00 X01 X02 X03 X04 X05 X06 X07 X08 X09 X0A X0B X0C X0D X0E X0F COM .'],
  'QX70':['TB','X00 X01 X02 X03 X04 X05 X06 X07 X08 X09 X0A X0B X0C X0D X0E X0F COM .'],
  'QX71':['C','X00 X10 X01 X11 X02 X12 X03 X13 X04 X14 X05 X15 X06 X16 X07 X17 X08 X18 X09 X19 X0A X1A X0B X1B X0C X1C X0D X1D X0E X1E X0F X1F . . . . COM . COM .'],
  'QX72':['C2','X00 X10 X01 X11 X02 X12 X03 X13 X04 X14 X05 X15 X06 X16 X07 X17 X08 X18 X09 X19 X0A X1A X0B X1B X0C X1C X0D X1D X0E X1E X0F X1F . . . . COM1 . COM1 . X20 X30 X21 X31 X22 X32 X23 X33 X24 X34 X25 X35 X26 X36 X27 X37 X28 X38 X29 X39 X2A X3A X2B X3B X2C X3C X2D X3D X2E X3E X2F X3F . . . . COM2 . COM2 .'],
  'QX80':['TB','X00 X01 X02 X03 X04 X05 X06 X07 X08 X09 X0A X0B X0C X0D X0E X0F . COM'],
  'QX80-TS':['TB','X00 X01 X02 X03 X04 X05 X06 X07 X08 X09 X0A X0B X0C X0D X0E X0F . COM'],
  'QX81':['D','X00 X02 X04 X06 X08 X0A X0C X0E X10 X12 X14 X16 X18 X1A X1C X1E COM COM . X01 X03 X05 X07 X09 X0B X0D X0F X11 X13 X15 X17 X19 X1B X1D X1F COM .'],
  'QX82':['C2','X00 X10 X01 X11 X02 X12 X03 X13 X04 X14 X05 X15 X06 X16 X07 X17 X08 X18 X09 X19 X0A X1A X0B X1B X0C X1C X0D X1D X0E X1E X0F X1F . . . . COM1 . COM1 . X20 X30 X21 X31 X22 X32 X23 X33 X24 X34 X25 X35 X26 X36 X27 X37 X28 X38 X29 X39 X2A X3A X2B X3B X2C X3C X2D X3D X2E X3E X2F X3F . . . . COM2 . COM2 .'],
  'QX82-S1':['C2','X00 X10 X01 X11 X02 X12 X03 X13 X04 X14 X05 X15 X06 X16 X07 X17 X08 X18 X09 X19 X0A X1A X0B X1B X0C X1C X0D X1D X0E X1E X0F X1F . . . . COM1 . COM1 . X20 X30 X21 X31 X22 X32 X23 X33 X24 X34 X25 X35 X26 X36 X27 X37 X28 X38 X29 X39 X2A X3A X2B X3B X2C X3C X2D X3D X2E X3E X2F X3F . . . . COM2 . COM2 .'],
  'QY10':['TB','Y00 Y01 Y02 Y03 Y04 Y05 Y06 Y07 Y08 Y09 Y0A Y0B Y0C Y0D Y0E Y0F COM .'],
  'QY10-TS':['TB','Y00 Y01 Y02 Y03 Y04 Y05 Y06 Y07 Y08 Y09 Y0A Y0B Y0C Y0D Y0E Y0F COM .'],
  'QY22':['TB','Y00 Y01 Y02 Y03 Y04 Y05 Y06 Y07 Y08 Y09 Y0A Y0B Y0C Y0D Y0E Y0F COM .'],
  'QY40P':['TB','Y00 Y01 Y02 Y03 Y04 Y05 Y06 Y07 Y08 Y09 Y0A Y0B Y0C Y0D Y0E Y0F 12/24VDC COM'],
  'QY40P-TS':['TB','Y00 Y01 Y02 Y03 Y04 Y05 Y06 Y07 Y08 Y09 Y0A Y0B Y0C Y0D Y0E Y0F 12/24VDC COM'],
  'QY41P':['C','Y00 Y10 Y01 Y11 Y02 Y12 Y03 Y13 Y04 Y14 Y05 Y15 Y06 Y16 Y07 Y17 Y08 Y18 Y09 Y19 Y0A Y1A Y0B Y1B Y0C Y1C Y0D Y1D Y0E Y1E Y0F Y1F . . . . 12/24VDC COM 12/24VDC COM'],
  'QY42P':['C2','Y00 Y10 Y01 Y11 Y02 Y12 Y03 Y13 Y04 Y14 Y05 Y15 Y06 Y16 Y07 Y17 Y08 Y18 Y09 Y19 Y0A Y1A Y0B Y1B Y0C Y1C Y0D Y1D Y0E Y1E Y0F Y1F . . . . 12/24VDC COM1 12/24VDC COM1 Y20 Y30 Y21 Y31 Y22 Y32 Y23 Y33 Y24 Y34 Y25 Y35 Y26 Y36 Y27 Y37 Y28 Y38 Y29 Y39 Y2A Y3A Y2B Y3B Y2C Y3C Y2D Y3D Y2E Y3E Y2F Y3F . . . . 12/24VDC COM2 12/24VDC COM2'],
  'QY50':['TB','Y00 Y01 Y02 Y03 Y04 Y05 Y06 Y07 Y08 Y09 Y0A Y0B Y0C Y0D Y0E Y0F 12/24VDC COM'],
  'QY70':['TB','Y00 Y01 Y02 Y03 Y04 Y05 Y06 Y07 Y08 Y09 Y0A Y0B Y0C Y0D Y0E Y0F 5/12VDC COM'],
  'QY71':['C','Y00 Y10 Y01 Y11 Y02 Y12 Y03 Y13 Y04 Y14 Y05 Y15 Y06 Y16 Y07 Y17 Y08 Y18 Y09 Y19 Y0A Y1A Y0B Y1B Y0C Y1C Y0D Y1D Y0E Y1E Y0F Y1F . . . . 5/12VDC COM 5/12VDC COM'],
  'QY80':['TB','Y00 Y01 Y02 Y03 Y04 Y05 Y06 Y07 Y08 Y09 Y0A Y0B Y0C Y0D Y0E Y0F COM 0V'],
  'QY80-TS':['TB','Y00 Y01 Y02 Y03 Y04 Y05 Y06 Y07 Y08 Y09 Y0A Y0B Y0C Y0D Y0E Y0F COM 0V'],
  'QY81P':['D','Y00 Y02 Y04 Y06 Y08 Y0A Y0C Y0E Y10 Y12 Y14 Y16 Y18 Y1A Y1C Y1E COM COM 0V Y01 Y03 Y05 Y07 Y09 Y0B Y0D Y0F Y11 Y13 Y15 Y17 Y19 Y1B Y1D Y1F COM 0V'],
  'QH42P':['C2','X00 X10 X01 X11 X02 X12 X03 X13 X04 X14 X05 X15 X06 X16 X07 X17 X08 X18 X09 X19 X0A X1A X0B X1B X0C X1C X0D X1D X0E X1E X0F X1F . . . . COM1 . COM1 . Y00 Y10 Y01 Y11 Y02 Y12 Y03 Y13 Y04 Y14 Y05 Y15 Y06 Y16 Y07 Y17 Y08 Y18 Y09 Y19 Y0A Y1A Y0B Y1B Y0C Y1C Y0D Y1D Y0E Y1E Y0F Y1F . . . . 12/24VDC COM2 12/24VDC COM2'],
  'QX41Y41P':['C2','X00 X10 X01 X11 X02 X12 X03 X13 X04 X14 X05 X15 X06 X16 X07 X17 X08 X18 X09 X19 X0A X1A X0B X1B X0C X1C X0D X1D X0E X1E X0F X1F . . . . COM1 . COM1 . Y20 Y30 Y21 Y31 Y22 Y32 Y23 Y33 Y24 Y34 Y25 Y35 Y26 Y36 Y27 Y37 Y28 Y38 Y29 Y39 Y2A Y3A Y2B Y3B Y2C Y3C Y2D Y3D Y2E Y3E Y2F Y3F . . . . 12/24VDC COM2 12/24VDC COM2'],
  'QX48Y57':['TB','X00 X01 X02 X03 X04 X05 X06 X07 COM1 Y08 Y09 Y0A Y0B Y0C Y0D Y0E 12/24VDC COM2'],
  'QY18A':['TB','Y00 Y00 Y01 Y01 Y02 Y02 Y03 Y03 Y04 Y04 Y05 Y05 Y06 Y06 Y07 Y07 . .'],
  'QY68A':['TB','Y00 Y00 Y01 Y01 Y02 Y02 Y03 Y03 Y04 Y04 Y05 Y05 Y06 Y06 Y07 Y07 . .']
};
const NAME={QX10:'AC 輸入（AC100–120V）16 點',QX28:'AC 輸入（AC100–240V）8 點',QX40:'DC 輸入（正公共端）16 點','QX40-S1':'高速 DC 輸入（正公共端）16 點',
  QX41:'DC 輸入（正公共端）32 點','QX41-S1':'高速 DC 輸入（正公共端）32 點',QX42:'DC 輸入（正公共端）64 點','QX42-S1':'高速 DC 輸入（正公共端）64 點',
  QX50:'DC48V 輸入 16 點',QX70:'DC5／12V 輸入 16 點',QX71:'DC5／12V 輸入 32 點',QX72:'DC5／12V 輸入 64 點',QX80:'DC 輸入（負公共端）16 點',QX81:'DC 輸入（負公共端）32 點（D-sub）',
  QX82:'DC 輸入（負公共端）64 點','QX82-S1':'高速 DC 輸入（負公共端）64 點',QY10:'繼電器輸出 16 點',QY18A:'繼電器輸出（全點獨立）8 點',QY22:'閘流體輸出 16 點',
  QY40P:'電晶體輸出（漏型）16 點',QY41P:'電晶體輸出（漏型）32 點',QY42P:'電晶體輸出（漏型）64 點',QY50:'電晶體輸出（漏型、0.5A）16 點',QY68A:'電晶體輸出（全點獨立）8 點',
  QY70:'TTL／CMOS 輸出 16 點',QY71:'TTL／CMOS 輸出 32 點',QY80:'電晶體輸出（源型）16 點',QY81P:'電晶體輸出（源型）32 點（D-sub）',
  QH42P:'輸入 32 點＋輸出 32 點',QX41Y41P:'輸入 32 點＋輸出 32 點',QX48Y57:'輸入 8 點＋輸出 7 點'};
const nameOf=m=>NAME[m]||NAME[m.replace(/-TS$/,'')]+'（彈簧夾端子）';
const sigD=id=>/^X/.test(id)?'輸入':/^Y/.test(id)?'輸出':/^COM/.test(id)?'共點':id==='0V'?'0V':/V/.test(id)?'外部供應電源':'';
// 連接器針腳位置：每個連接器兩欄（B 左、A 右），由上往下 20→1；兩個連接器上下排；D-sub 兩欄（1～19、20～37）
function ioTerms(kind,sigs){
  const T=[],pins={};
  const put=(pin,id,x,y,side,cn,key=pin)=>{if(!id)return;T.push([id,+x.toFixed(2),+y.toFixed(2),side,`${pin} ${sigD(id)}`]);(pins[cn]=pins[cn]||{})[key]=T.length-1;};
  if(kind==='TB')sigs.forEach((id,i)=>{const L=i%2===0,k=Math.floor(i/2);put('TB'+(i+1),id,L?10.5:18.5,20+k*8.2+(L?0:4.1),L?'left':'right',null);});
  else if(kind==='C'||kind==='C2'){const pp=kind==='C'?2.6:2.2;sigs.forEach((id,i)=>{const c=Math.floor(i/40),j=i%40,row=Math.floor(j/2),A=j%2===1,num=20-row;
    put(`${kind==='C2'?c+1:''}${A?'A':'B'}${String(num).padStart(2,'0')}`,id,A?14.4:11.8,(kind==='C'?30:6+c*46)+row*pp,A?'right':'left',kind==='C2'?String(c+1):'1',`${A?'A':'B'}${String(num).padStart(2,'0')}`);});}
  else {const order=[1,20,2,21,3,22,4,23,5,24,6,25,7,26,8,27,9,28,10,29,11,30,12,31,13,32,14,33,15,34,16,35,17,36,18,37,19];
    sigs.forEach((id,i)=>{const pin=order[i],c2=pin>=20;put(String(pin),id,c2?14.4:11.8,c2?29.3+(pin-20)*2.6:28+(pin-1)*2.6,c2?'right':'left','1');});}
  const links=dedup(T);
  // 全點獨立的輸出：同名兩端是接點兩端，不是同電位
  const conn={};Object.entries(pins).forEach(([cn,m])=>{conn[cn]={type:kind==='D'?'37':'40',pins:Object.fromEntries(Object.entries(m).map(([p,i])=>[p,T[i][0]]))};});
  return {T,links,conn};
}
Object.entries(IOD).forEach(([m,[kind,s]])=>{
  const sigs=s.split(' ').map(x=>x==='.'?null:x),{T,links,conn}=ioTerms(kind,sigs),id=idOf(m),indep=/^QY(18A|68A)$/.test(m);
  const ids=new Set(T.map(t=>t[0])),xs=T.map(t=>t[0]).filter(x=>/^X[0-9A-F]{2}$/.test(x)),ys=T.map(t=>t[0]).filter(x=>/^Y[0-9A-F]{2}$/.test(x));
  // 共點：兩組的（COM1／COM2）依連接器或 X／Y 分；其他一組
  const two=ids.has('COM1')&&ids.has('COM2'),xc=two?(ys.length?'COM1':null):'COM',sim=[];
  if(xs.length){if(two&&!ys.length){sim.push({k:'plcX',com:'COM1',pts:xs.filter(x=>parseInt(x.slice(1),16)<0x20)},{k:'plcX',com:'COM2',pts:xs.filter(x=>parseInt(x.slice(1),16)>=0x20)});}
    else sim.push({k:'plcX',com:two?'COM1':'COM',pts:xs});}
  if(ys.length){if(indep)sim.push({k:'plcY',pairs:ys.map(y=>[y,y+'(2)'])});
    else if(two&&!xs.length)sim.push({k:'plcY',pairs:ys.map(y=>[y,parseInt(y.slice(1),16)<0x20?'COM1':'COM2'])});
    else sim.push({k:'plcY',pairs:ys.map(y=>[y,two?'COM2':'COM'])});}
  const lk=indep?links.filter(g=>!/^Y/.test(g[0])):links;
  if(indep)T.forEach(t=>{if(/^Y.*\(2\)$/.test(t[0]))t[4]=t[4]+'（接點另一端）';});
  const qpts=kind==='C2'&&!(xs.length&&ys.length)?64:kind==='TB'?16:32;
  def(id,null,C4,MIT,`${m} ${nameOf(m)}`,IO,98,90,ys.length&&xs.length?'QH':ys.length?'QY':'QX','dark',T,{ser:'Q 輸入輸出',rackKind:'io',attach:'slot',qpts,
    links:lk.length?lk:null,sim,note:`${kind==='TB'?'18 點端子排':kind==='D'?'37 針 D-sub 連接器':kind==='C2'?'兩個 40 針連接器（上面 1、下面 2）':'40 針連接器'}；裝在基板上後接點依槽位換成實際位址；${NOTE}`});
  if(kind!=='TB')TPL[id].conn=conn;ver(id);
});

/* ---------- 連接器／端子排轉換模組（A6TB 系列，牛角插座轉螺絲端子台） ----------
   左邊是連接器針腳（接排線用），右邊是螺絲端子；針腳和端子在模組內部相通。選取後右側「接排線」可自動拉一條排線到 I/O 模組的連接器 */
function hRow(W,str,y,side,x0,x1){const a=str.split(' '),p=(x1-x0)/(a.length-1||1);return a.map((id,i)=>[id,+(x0+p*i).toFixed(2),y,side]);}
function adapter(name,W,txt,rows,map,type){
  const id=idOf(name),x0=18,x1=W-6,T=[];
  rows.forEach(([str,y,side,sh])=>hRow(W,str,y,side,x0+(sh?3:0),x1-(sh?0:3)).forEach(t=>{if(t[0]!=='.')T.push([...t,/^[0-9A-F]{1,2}$/.test(t[0])?`信號 ${t[0]}（第 ${parseInt(t[0],16)} 點）`:t[0]==='COM'?'共點':/C$/.test(t[0])?'感測器電源':'電源 '+t[0]]);}));
  // 連接器針腳（左側直排）
  const pinIds=type==='40'?[...Array(20).keys()].flatMap(r=>[`B${String(20-r).padStart(2,'0')}`,`A${String(20-r).padStart(2,'0')}`]):[...Array(37).keys()].map(i=>'P'+(i+1));
  pinIds.forEach((p,i)=>{const A=type==='40'?i%2===1:i>=19,row=type==='40'?Math.floor(i/2):(i>=19?i-19:i);T.push([p,A?7.2:4.6,+((type==='40'?14:13)+row*(type==='40'?2.6:2.7)+(type==='37'&&A?1.3:0)).toFixed(2),'left','連接器針腳 '+p.replace(/^P/,'')]);});
  const links=dedup(T),groups=[];
  // 端子 ↔ 針腳：map 是 端子名稱 → 針腳清單；同名端子（含 (2)）都算
  Object.entries(map).forEach(([term,pins])=>{const g=T.map(t=>t[0]).filter(x=>x===term||x.replace(/\(\d+\)$/,'')===term);groups.push([...g,...pins]);});
  // 合併重複的群組
  const all=[...links,...groups],merged=[];all.forEach(g=>{const m=merged.find(h=>h.some(x=>g.includes(x)));if(m)g.forEach(x=>{if(!m.includes(x))m.push(x);});else merged.push([...g]);});
  def(id,null,C4,MIT,`${name} 連接器／端子排轉換模組（${txt}）`,W,78.5,52,'TB','light',T,{ser:'Q 連接器轉端子台',links:merged.filter(g=>g.length>1),
    note:`${type==='40'?'40 針連接器（牛角插座）':'37 針 D-sub 連接器'}轉螺絲端子；選取後右側「接排線」可以自動接到 I/O 模組的連接器；針腳與端子的對應依手冊連接圖；${NOTE}`});
  TPL[id].adpc={'1':{type,pins:Object.fromEntries(pinIds.map(p=>[type==='40'?p:p.slice(1),p]))}};ver(id);
}
const B40=n=>`B${String(n).padStart(2,'0')}`,A40=n=>`A${String(n).padStart(2,'0')}`;
const hexs=a=>[...Array(16).keys()].map(i=>(a+i).toString(16).toUpperCase());
const map40=()=>Object.fromEntries([...hexs(0).map((h,i)=>[h,[B40(20-i)]]),...hexs(16).map((h,i)=>[h,[A40(20-i)]])]);
// 37 針 D-sub：X／Y 00～0F、10～1F 對應的針腳（依 QX81／QY81P 信號表）
const D37=[1,20,2,21,3,22,4,23,5,24,6,25,7,26,8,27,9,28,10,29,11,30,12,31,13,32,14,33,15,34,16,35];
const map37=()=>Object.fromEntries([...hexs(0),...hexs(16)].map((h,i)=>[h,['P'+D37[i]]]));
const R36=[['0 2 4 6 8 A C E 24V',5,'top',1],['1 3 5 7 9 B D F 0V',11,'top',0],['11 13 15 17 19 1B 1D 1F 0V',67.5,'bottom',1],['10 12 14 16 18 1A 1C 1E 24V',73.5,'bottom',0]];
const R54=[['0 COM 2 4 COM 6 8 COM A C COM E COM 0V',5,'top',0],['1 COM 3 5 COM 7 9 COM B D COM F 24V',11,'top',1],
  ['11 COM 13 15 COM 17 19 COM 1B 1D COM 1F 24V',67.5,'bottom',1],['10 COM 12 14 COM 16 18 COM 1A 1C COM 1E COM 0V',73.5,'bottom',0]];
const PC=Array(8).fill('+C -C').join(' ');
const R70=[[PC+' +C 0V',5,'top',0],['0 1 2 3 4 5 6 7 8 9 A B C D E F 24V',11,'top',1],['10 11 12 13 14 15 16 17 18 19 1A 1B 1C 1D 1E 1F 24V',67.5,'bottom',1],[PC+' +C 0V',73.5,'bottom',0]];
adapter('A6TBXY36',120,'輸入、輸出共用，32 點',R36,{...map40(),'24V':['B01','B02'],'0V':['A01','A02']},'40');
adapter('A6TBXY54',155,'輸入、輸出共用，32 點，二線式感測器用 COM 端子',R54,{...map40(),COM:['B01','B02'],'0V':['A01','A02']},'40');
adapter('A6TBX70',190,'輸入用，32 點，三線式感測器用 +C／−C 端子',R70,{...map40(),'+C':['B01','B02'],'-C':['A01','A02'],'24V':['B01'],'0V':['A01']},'40');
adapter('A6TBX36-E',120,'輸入用（D-sub 37 針，QX81）',R36,{...map37(),'0V':['P17','P18','P36']},'37');
adapter('A6TBY36-E',120,'輸出用（D-sub 37 針，QY81P）',R36,{...map37(),'24V':['P17','P18','P36'],'0V':['P19','P37']},'37');
adapter('A6TBX54-E',155,'輸入用（D-sub 37 針，QX81），二線式感測器用 COM 端子',R54,{...map37(),COM:['P17','P18','P36'],'0V':['P17']},'37');
adapter('A6TBY54-E',155,'輸出用（D-sub 37 針，QY81P）',R54,{...map37(),'24V':['P17','P18','P36'],COM:['P19','P37'],'0V':['P19']},'37');
adapter('A6TBX70-E',190,'輸入用（D-sub 37 針，QX81），三線式感測器用 +C／−C 端子',R70,{...map37(),'-C':['P17','P18','P36'],'0V':['P17']},'37');
})();

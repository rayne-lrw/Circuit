"use strict";
/* ---------- 台達 AH500 系列（背板插槽式） ----------
   資料來源：AH500 硬體及操作手冊（端子配置、外觀尺寸、預設起始位址）、台達 AH 產品型錄（外觀尺寸表）
   - 背板：左邊是延伸接口，接著電源槽（寬 50）、CPU 槽（寬 40，運動控制背板 35）、I/O 槽（每槽 35）往右排（依部位介紹圖估算）
   - 位址：X、Y 各自連續，依背板與槽位順序分給數位模組（16 點佔 1 個字、32 點 2 個字、64 點 4 個字），空槽與類比模組不佔
   - 模組接點用模組內的「字.位元」（X0.0～X0.15、X1.0…），裝上背板後依槽位換成實際位址
   - 端子名稱與順序依手冊「輸入輸出端子配置」；端子實際 mm 位置依外觀圖估算 */
(function(){
const DT='台達',SRC='台達 AH500 硬體及操作手冊',NOTE='端子名稱與順序依手冊端子配置；端子實際位置依外觀圖估算';
const ver=id=>{VER[id]=[2,SRC];};
const idOf=n=>n.toLowerCase().replace(/[^a-z0-9]+/g,'-');
const {dedup}=self.FXLIB||{dedup:()=>[]};
const PW=50,CPU=40,IO=35;

/* ---------- 背板 ---------- */
function rackOf(W,kinds,cpuW){const wd={pwr:PW,cpu:cpuW||CPU,io:IO};let x=W-6;return kinds.slice().reverse().map(k=>{x-=wd[k];return {k,x:+x.toFixed(2),w:wd[k]};}).reverse();}
const ios=n=>Array(n).fill('io');
function bp(name,W,kinds,o){
  const id=idOf(name),n=kinds.filter(k=>k==='io').length;
  def(id,null,C4,DT,`${name} ${o.ext?'延伸背板':'主背板'}（${n} 槽）`,W,110,23.6,'BP','mid',[],{ser:'台達 AH 背板',rack:rackOf(W,kinds,o.cpuW),
    note:(o.note?o.note+'；':'')+(o.ext?'延伸背板：右側可設定接在哪個主背板與延伸順序，I/O 位址接在主背板後面；':'')+'背板本身沒有接線端子；'+NOTE});
  TPL[id].qext=!!o.ext;TPL[id].addr='ah';ver(id);
}
[['AHBP04M1-5A',298,4],['AHBP06M1-5A',369,6],['AHBP08M1-5A',440,8],['AHBP12M1-5A',582,12]].forEach(([n,W,k])=>bp(n,W,['pwr','cpu',...ios(k)],{}));
[['AHBP04MR1-5A',348,4],['AHBP06MR1-5A',419,6],['AHBP08MR1-5A',490,8]].forEach(([n,W,k])=>bp(n,W,['pwr','cpu',...ios(k)],{note:'備援主背板（搭配備援 CPU）'}));
[['AHBP03M2-5A',257,3],['AHBP05M2-5A',328,5],['AHBP07M2-5A',399,7]].forEach(([n,W,k])=>bp(n,W,['pwr','cpu',...ios(k)],{cpuW:IO,note:'運動控制主背板'}));
[['AHBP06E1-5A',328,6],['AHBP08E1-5A',399,8]].forEach(([n,W,k])=>bp(n,W,['pwr',...ios(k)],{ext:true}));
[['AHBP06ER1-5A',398,6],['AHBP08ER1-5A',469,8]].forEach(([n,W,k])=>bp(n,W,['pwr',...ios(k)],{ext:true,note:'備援延伸背板'}));

/* ---------- 數位 I/O 模組 ---------- */
// 18／20 點脫落式端子：由上往下依序，左右兩欄交錯（第 1 個在左欄）
function tbTerms(labs){return labs.map((id,i)=>{if(!id)return null;const L=i%2===0,k=Math.floor(i/2);return [id,L?13:23,+(22+k*8.5+(L?0:4.25)).toFixed(2),L?'left':'right'];}).filter(Boolean);}
// 連接器：cols 是各欄由上往下的信號；兩欄一個連接器，64 點兩個連接器左右排
function cnTerms(cols){const T=[];cols.forEach((col,c)=>{const conn=Math.floor(c/2),A=c%2===1,x=(cols.length>2?10+conn*12:15)+(A?2.6:0);col.forEach((id,r)=>{if(id)T.push([id,+x.toFixed(2),+(28+r*2.6).toFixed(2),A?'right':'left']);});});return T;}
const W16=p=>[...Array(16).keys()].map(i=>`${p}0.${i}`),W8=p=>[...Array(8).keys()].map(i=>`${p}0.${i}`);
const desc=id=>/^X/.test(id)?'輸入 '+id:/^Y/.test(id)?'輸出 '+id:/^S\/S/.test(id)?'輸入共點 S/S':/^COM/.test(id)?'共點 '+id.replace(/\(\d+\)$/,''):/^UP/.test(id)?'UP：外部 24VDC +':/^ZP/.test(id)?'ZP：外部 24VDC −':id==='NC'?'空端子':'';
// 共點分組：連續排列中，共點歸給它前面最近的那一個字（S/S 在 0.x 後面就是第 0 字的共點）
function groupCommons(seq){let w=0;return seq.map(id=>{if(!id)return id;const m=/^[XY](\d+)\./.exec(id);if(m){w=+m[1];return id;}if(/^(S\/S|UP|ZP)$/.test(id))return w?`${id}${w}`:id;return id;});}
function dio(name,T,o){
  const id=idOf(name);T.forEach(t=>{if(!t[4])t[4]=desc(t[0]);});const links=dedup(T);
  T.forEach(t=>{t[4]=desc(t[0]);});
  const ids=new Set(T.map(t=>t[0])),xs=[...ids].filter(x=>/^X\d+\.\d+$/.test(x)),ys=[...ids].filter(x=>/^Y\d+\.\d+$/.test(x)),sim=[];
  const word=x=>+/^[XY](\d+)/.exec(x)[1],grp=(base,w)=>{const c=w?`${base}${w}`:base;return ids.has(c)?c:base;};
  if(xs.length){const ws=[...new Set(xs.map(word))];ws.forEach(w=>sim.push({k:'plcX',com:o.xcom?o.xcom:grp('S/S',w),pts:xs.filter(x=>word(x)===w)}));}
  if(ys.length)sim.push({k:'plcY',pairs:ys.map(y=>[y,o.ycom?o.ycom(y):grp(o.yc||'ZP',word(y))])});
  def(id,null,C4,DT,`${name} ${o.txt}`,IO,110,103,ys.length&&xs.length?'DIO':ys.length?'DO':'DI','dark',T,{ser:'台達 AH 數位 I/O',rackKind:'io',attach:'slot',
    xw:o.xw||0,yw:o.yw||0,links:links.length?links:null,sim,note:`${o.form}；裝上背板後接點依槽位換成實際位址；${NOTE}`});ver(id);
}
const S2=['S/S','S/S'];
dio('AH16AM10N-5A',tbTerms([...W16('X'),...S2]),{txt:'數位輸入 16 點（24VDC）',xw:1,form:'18 點脫落式端子'});
dio('AH16AM30N-5A',tbTerms([...W16('X'),'COM','COM']),{txt:'數位輸入 16 點（120／240VAC）',xw:1,xcom:'COM',form:'18 點脫落式端子'});
dio('AH16AR10N-5A',tbTerms([...W16('X'),...S2]),{txt:'中斷型數位輸入 16 點（24VDC）',xw:1,form:'18 點脫落式端子'});
const g4=y=>'COM'+Math.floor(+/\.(\d+)$/.exec(y)[1]/4);
const relay16=['Y0.0','Y0.1','Y0.2','Y0.3','COM0','Y0.4','Y0.5','Y0.6','Y0.7','COM1','Y0.8','Y0.9','Y0.10','Y0.11','COM2','Y0.12','Y0.13','Y0.14','Y0.15','COM3'];
dio('AH16AN01R-5A',tbTerms(relay16),{txt:'繼電器輸出 16 點',yw:1,ycom:g4,form:'20 點脫落式端子，4 點一個共點'});
dio('AH16AN01S-5A',tbTerms(relay16),{txt:'閘流體（TRIAC）輸出 16 點',yw:1,ycom:g4,form:'20 點脫落式端子，4 點一個共點'});
dio('AH16AN01T-5A',tbTerms([...W16('Y'),'UP','ZP']),{txt:'電晶體輸出 16 點（NPN）',yw:1,yc:'ZP',form:'18 點脫落式端子；UP／ZP 接外部 24VDC'});
dio('AH16AN01P-5A',tbTerms([...W16('Y'),'UP','ZP']),{txt:'電晶體輸出 16 點（PNP）',yw:1,yc:'UP',form:'18 點脫落式端子；UP／ZP 接外部 24VDC'});
dio('AH16AP11R-5A',tbTerms([...W8('X'),'S/S','Y0.0','Y0.1','Y0.2','Y0.3','COM0','Y0.4','Y0.5','Y0.6','Y0.7','COM1']),{txt:'輸入 8 點＋繼電器輸出 8 點',xw:1,yw:1,ycom:g4,form:'19 點脫落式端子'});
dio('AH16AP11T-5A',tbTerms([...W8('X'),'S/S',...W8('Y'),'UP','ZP']),{txt:'輸入 8 點＋電晶體輸出 8 點（NPN）',xw:1,yw:1,yc:'ZP',form:'19 點脫落式端子'});
dio('AH16AP11P-5A',tbTerms([...W8('X'),'S/S',...W8('Y'),'UP','ZP']),{txt:'輸入 8 點＋電晶體輸出 8 點（PNP）',xw:1,yw:1,yc:'UP',form:'19 點脫落式端子'});
// 32 點 -5A：40 針連接器，左欄第 0 字、右欄第 1 字，每欄下面接共點（右欄的共點屬於第 1 字）
const seqW=(p,w)=>[...Array(16).keys()].map(i=>`${p}${w}.${i}`);
const c5A=(p,tail)=>[[...seqW(p,0),...tail],[...seqW(p,1),...tail.map(x=>x?x+'1':x)]];
dio('AH32AM10N-5A',cnTerms(c5A('X',['','','S/S','S/S'])),{txt:'數位輸入 32 點（24VDC）',xw:2,form:'40 針連接器（左欄 X0.0～0.15、右欄 X1.0～1.15）；共點 S/S 每 16 點一組'});
dio('AH32AN02T-5A',cnTerms(c5A('Y',['UP','UP','ZP','ZP'])),{txt:'電晶體輸出 32 點（NPN）',yw:2,yc:'ZP',form:'40 針連接器；UP／ZP 每 16 點一組'});
dio('AH32AN02P-5A',cnTerms(c5A('Y',['UP','UP','ZP','ZP'])),{txt:'電晶體輸出 32 點（PNP）',yw:2,yc:'UP',form:'40 針連接器；UP／ZP 每 16 點一組'});
// -5B（37 針 D-sub）、-5C（40 針 MIL）：手冊表格每列兩個，依序排（左欄、右欄交錯）
const pairs=seq=>{const L=[],R=[];seq.forEach((x,i)=>(i%2?R:L).push(x));return [L,R];};
dio('AH32AM10N-5B',cnTerms(pairs(groupCommons([...seqW('X',0),'S/S','S/S','NC',...seqW('X',1),'S/S','S/S']))),{txt:'數位輸入 32 點（24VDC）',xw:2,form:'37 針 D-sub 連接器；共點 S/S 每 16 點一組'});
dio('AH32AN02T-5B',cnTerms(pairs(groupCommons([...seqW('Y',0),'ZP','ZP','UP',...seqW('Y',1),'ZP','UP']))),{txt:'電晶體輸出 32 點（NPN）',yw:2,yc:'ZP',form:'37 針 D-sub 連接器'});
dio('AH32AN02P-5B',cnTerms(pairs(groupCommons([...seqW('Y',0),'ZP','UP','UP',...seqW('Y',1),'ZP','UP']))),{txt:'電晶體輸出 32 點（PNP）',yw:2,yc:'UP',form:'37 針 D-sub 連接器'});
dio('AH32AM10N-5C',cnTerms(pairs(groupCommons([...seqW('X',0),'S/S','S/S','','',...seqW('X',1),'S/S','S/S']))),{txt:'數位輸入 32 點（24VDC）',xw:2,form:'40 針 MIL 連接器（可接 UB-10 配線模組）'});
dio('AH32AN02T-5C',cnTerms(pairs(groupCommons([...seqW('Y',0),'ZP','ZP','UP','UP',...seqW('Y',1),'ZP','ZP','UP','UP']))),{txt:'電晶體輸出 32 點（NPN）',yw:2,yc:'ZP',form:'40 針 MIL 連接器'});
dio('AH32AN02P-5C',cnTerms(pairs(groupCommons([...seqW('Y',0),'ZP','ZP','UP','UP',...seqW('Y',1),'ZP','ZP','UP','UP']))),{txt:'電晶體輸出 32 點（PNP）',yw:2,yc:'UP',form:'40 針 MIL 連接器'});
// 64 點 -5C：兩個 40 針連接器；手冊表格每列四格（連接器 1 左、右，連接器 2 左、右）
const rev=(p,w)=>[...Array(8).keys()].flatMap(i=>[`${p}${w}.${15-2*i}`,`${p}${w}.${14-2*i}`]);
const fw=(p,w)=>[...Array(16).keys()].map(i=>`${p}${w}.${i}`);
function c64(p,head,tail){
  // 連接器 1：head（2 列）、第 1 字由大到小、head（2 列）、第 0 字由大到小；連接器 2：第 2 字、tail（2 列）、第 3 字、tail（2 列）
  // 共點分組：連接器 1 前半屬第 1 字、後半屬第 0 字；連接器 2 前半屬第 2 字、後半屬第 3 字
  const tag=(arr,w1,w2)=>{const h=arr.length/2;return arr.map((x,i)=>/^(S\/S|UP|ZP)$/.test(x)?((i<h?w1:w2)?x+(i<h?w1:w2):x):x);};
  return [...pairs(tag([...head,...rev(p,1),...head,...rev(p,0)],1,0)),...pairs(tag([...fw(p,2),...tail,...fw(p,3),...tail],2,3))];
}
dio('AH64AM10N-5C',cnTerms(c64('X',['NC','NC','S/S','S/S'],['S/S','S/S','NC','NC'])),{txt:'數位輸入 64 點（24VDC）',xw:4,form:'兩個 40 針 MIL 連接器；共點 S/S 每 16 點一組'});
dio('AH64AN02T-5C',cnTerms(c64('Y',['UP','UP','ZP','ZP'],['ZP','ZP','UP','UP'])),{txt:'電晶體輸出 64 點（NPN）',yw:4,yc:'ZP',form:'兩個 40 針 MIL 連接器'});
dio('AH64AN02P-5C',cnTerms(c64('Y',['UP','UP','ZP','ZP'],['ZP','ZP','UP','UP'])),{txt:'電晶體輸出 64 點（PNP）',yw:4,yc:'UP',form:'兩個 40 針 MIL 連接器'});

/* ---------- 電源、CPU、類比、溫度、網路、運動控制模組、配線模組（端子配置依手冊，子圖逐一核對） ---------- */
const AHX=[["AH04AD-5A", "tb", 35, 110, 103, [["V0+", "VI0-", "I0+", "V1+", "VI1-", "I1+", "V2+", "VI2-", "I2+", "V3+", "VI3-", "I3+", "", "", "", "", "", "ZP", "UP", "SG"]], [], "每通道 V+ / VI- / I+（CH0~CH3）；UP/ZP 外部 24V 電源 +/-（ZP=0V）；SG 信號地；第13~17點空白。-10~+10V / -20~+20mA", false], ["AH08AD-5A", "cn", 35, 110, 103, [["", "I0+", "V0+", "VI0-", "", "I1+", "V1+", "VI1-", "", "I2+", "V2+", "VI2-", "", "I3+", "V3+", "VI3-", "", "", "SG", ""], ["", "I4+", "V4+", "VI4-", "", "I5+", "V5+", "VI5-", "", "I6+", "V6+", "VI6-", "", "I7+", "V7+", "VI7-", "", "", "SG", ""]], [], "每通道 I+ / V+ / VI-（左欄 CH0~3，右欄 CH4~7）；SG 信號地；空白=未用。-10~+10V / -20~+20mA", false], ["AH08AD-5B", "tb", 35, 110, 103, [["V0+", "V0-", "V1+", "V1-", "V2+", "V2-", "V3+", "V3-", "SLD", "SLD", "V4+", "V4-", "V5+", "V5-", "V6+", "V6-", "V7+", "V7-", "SLD", "SLD"]], [], "8 通道電壓輸入 V+/V-；SLD 屏蔽。-10~+10V", false], ["AH08AD-5C", "tb", 35, 110, 103, [["I0+", "I0-", "I1+", "I1-", "I2+", "I2-", "I3+", "I3-", "SLD", "SLD", "I4+", "I4-", "I5+", "I5-", "I6+", "I6-", "I7+", "I7-", "SLD", "SLD"]], [], "8 通道電流輸入 I+/I-；SLD 屏蔽。±20mA / 0/4~20mA", false], ["AH04DA-5A", "tb", 35, 110, 103, [["VO0", "AG", "IO0", "SLD", "VO1", "AG", "IO1", "SLD", "VO2", "AG", "IO2", "SLD", "VO3", "AG", "IO3", "SLD", "UP", "ZP", "SG", "SG"]], [], "每通道 VO（電壓輸出）/ AG（類比地）/ IO（電流輸出）/ SLD；UP/ZP 外部 24V +/-；SG。-10~+10V / 0/4~20mA", false], ["AH08DA-5A", "cn", 35, 110, 103, [["", "IO0", "VO0", "AG", "", "IO1", "VO1", "AG", "", "IO2", "VO2", "AG", "", "IO3", "VO3", "AG", "", "", "SG", "UP"], ["", "IO4", "VO4", "AG", "", "IO5", "VO5", "AG", "", "IO6", "VO6", "AG", "", "IO7", "VO7", "AG", "", "", "SG", "ZP"]], [], "每通道 IO / VO / AG（左 CH0~3，右 CH4~7）；SG；UP(左)/ZP(右) 外部 24V。-10~+10V / 0/4~20mA", false], ["AH08DA-5B", "tb", 35, 110, 103, [["VO0", "AG", "VO1", "AG", "VO2", "AG", "VO3", "AG", "VO4", "AG", "VO5", "AG", "VO6", "AG", "VO7", "AG", "UP", "ZP", "SG", "SG"]], [], "8 通道電壓輸出 VO/AG；UP/ZP 外部 24V；SG。-10~+10V", false], ["AH08DA-5C", "tb", 35, 110, 103, [["IO0", "AG", "IO1", "AG", "IO2", "AG", "IO3", "AG", "IO4", "AG", "IO5", "AG", "IO6", "AG", "IO7", "AG", "UP", "ZP", "SG", "SG"]], [], "8 通道電流輸出 IO/AG；UP/ZP 外部 24V；SG。0/4~20mA", false], ["AH06XA-5A", "tb", 35, 110, 103, [["V0+", "VI0-", "I0+", "V1+", "VI1-", "I1+", "V2+", "VI2-", "I2+", "V3+", "VI3-", "I3+", "VO0", "IO0", "AG", "VO1", "IO1", "ZP", "UP", "SG"]], [], "第1~12點 AI：每通道 V+/VI-/I+（CH0~3）；第13~17點 AO：VO0,IO0,AG(共用),VO1,IO1；ZP/UP 外部 24V；SG。AI ±10V,±20mA；AO ±10V,0/4~20mA", false], ["AH04PT-5A", "tb", 35, 110, 103, [["O0+", "I0+", "I0-", "O0-", "FG", "O1+", "I1+", "I1-", "O1-", "FG", "O2+", "I2+", "I2-", "O2-", "FG", "O3+", "I3+", "I3-", "O3-", "FG"]], [], "RTD 2/3/4 線：每通道 O+ / I+ / I- / O-，FG 接地（CH0~3）", false], ["AH04TC-5A", "tb", 35, 110, 103, [["I0+", "I0-", "I1+", "I1-", "I2+", "I2-", "I3+", "I3-", "FG", "FG", "", "", "", "", "", "", "", "", "", ""]], [], "熱電偶 J,K,R,S,T,E,N：每通道 I+/I-（CH0~3），FG", false], ["AH08TC-5A", "tb", 35, 110, 103, [["I0+", "I0-", "I1+", "I1-", "I2+", "I2-", "I3+", "I3-", "FG", "FG", "I4+", "I4-", "I5+", "I5-", "I6+", "I6-", "I7+", "I7-", "FG", "FG"]], [], "熱電偶 8 通道 I+/I-，FG", false], ["AH08PTG-5A", "cn", 35, 110, 103, [["O0+", "O0-", "O1+", "O1-", "FG", "O2+", "O2-", "O3+", "O3-", "O4+", "O4-", "O5+", "O5-", "FG", "O6+", "O6-", "O7+", "O7-", "", "UP"], ["I0+", "I0-", "I1+", "I1-", "FG", "I2+", "I2-", "I3+", "I3-", "I4+", "I4-", "I5+", "I5-", "FG", "I6+", "I6-", "I7+", "I7-", "", "ZP"]], [], "RTD 2/3/4 線 8 通道：每通道 O+/O-（左）與 I+/I-（右）；FG；UP/ZP 外部 24V。注意 2.8.2 部位介紹圖印成 ZP UP，2.8.3 與 2.8.4 端子配置圖為 UP(左) ZP(右)，以 2.8.4 為準", false], ["AH10SCM-5A", "blocks", 35, 110, 103, [["TX+", "TX-", "RX+", "RX-", "GND", "FG"], ["TX+", "TX-", "RX+", "RX-", "GND", "FG"]], [], "RS-422：TX+/TX-/RX+/RX-；RS-485：D+=RX+，D-=RX-；GND；FG", false], ["AH15SCM-5A", "ports", 35, 110, 103, [], ["COM1", "COM2"], "兩組 DB9 RS-232；手冊此節無 DB9 腳位表", true], ["AH10EN-5A", "ports", 35, 110, 103, [], ["X1", "X2"], "兩個 RJ-45 (Auto MDI/MDIX，10/100M)，上 X1 下 X2；手冊標題寫 AH10EN-5/AH15EN-5A", false], ["AH15EN-5A", "ports", 35, 110, 103, [], ["X1", "X2"], "兩個 RJ-45 (Auto MDI/MDIX，10/100M)，上 X1 下 X2；手冊標題寫 AH10EN-5/AH15EN-5A", false], ["AH10COPM-5A", "col", 35, 110, 103, [["", "CAN+", "SHLD", "CAN-", "GND"]], [], "4 CAN+ (CAN_H)，3 SHLD 遮罩，2 CAN- (CAN_L)，1 GND (0VDC)，5 保留", false], ["AH10DNET-5A", "col", 35, 110, 103, [["V+", "CAN_H", "SHIELD", "CAN_L", "V-"]], [], "5 V+ 24VDC 紅；4 CAN_H 白；3 SHIELD；2 CAN_L 藍；1 V- 0VDC 黑", true], ["AH10PFBM-5A", "cn", 35, 110, 103, [["", "", "RxD/TxD-P", "", "DGND"], ["", "", "VP", "RxD/TxD-N", ""]], [], "3 RxD/TxD-P(B)，5 DGND(C)，6 VP，8 RxD/TxD-N(A)，其餘 N/C", true], ["AH10PFBS-5A", "cn", 35, 110, 103, [["", "", "RxD/TxD-P", "", "DGND"], ["", "", "VP", "RxD/TxD-N", ""]], [], "3 RxD/TxD-P(B)，5 DGND(C)，6 VP，8 RxD/TxD-N(A)，其餘 N/C", true], ["AHRTU-ETHN-5A", "ports", 40, 110, 103, [], ["X1", "X2"], "EtherNet/IP、MODBUS TCP；IP 旋鈕 192.168.1.x；無螺絲端子", false], ["AHRTU-DNET-5A", "col", 40, 110, 103, [["V+", "CAN_H", "SHIELD", "CAN_L", "V-"]], [], "V+ 24VDC 紅，CAN_H 白，SHIELD，CAN_L 藍，V- 0VDC 黑", true], ["AH02HC-5A", "blocks", 35, 110, 103, [["X0.8+", "X0.8-", "X0.9+", "X0.9-", "X0.10+", "X0.10-", "X0.11+", "X0.11-", ""], ["X0.0+", "X0.0-", "X0.1+", "X0.1-", "", "Y0.8", "C0", "Y0.9", "C1"]], [], "X0.8±/X0.9± CH0 計數 A/B (CntA0/CntB0)；X0.10±/X0.11± CH1 (CntA1/CntB1)；X0.0± Rst0，X0.1± Rst1；Y0.8/C0 Out0/COM0，Y0.9/C1 Out1/COM1", false], ["AH04HC-5A", "cn", 35, 110, 103, [["C3", "C2", "C1", "C0", "-", "-", "X0.3-", "X0.15-", "X0.14-", "X0.2-", "X0.13-", "X0.12-", "X0.1-", "X0.11-", "X0.10-", "X0.0-", "X0.9-", "X0.8-"], ["Y0.11", "Y0.10", "Y0.9", "Y0.8", "-", "-", "X0.3+", "X0.15+", "X0.14+", "X0.2+", "X0.13+", "X0.12+", "X0.1+", "X0.11+", "X0.10+", "X0.0+", "X0.9+", "X0.8+"]], [], "C0~C3=COM0~3，Y0.8~Y0.11=Out0~3；X0.0~X0.3± Rst0~3；X0.8/9± CH0 A/B，X0.10/11± CH1，X0.12/13± CH2，X0.14/15± CH3", true], ["AH05PM-5A", "blocks", 35, 110, 103, [["S/S", "X0.0", "X0.1", "X0.8", "X0.9", "X0.12", "X0.13", "Y0.0+", "Y0.0-"], ["Y0.1+", "Y0.1-", "Y0.2+", "Y0.2-", "Y0.3+", "Y0.3-", "Y0.8", "Y0.9", "COM"]], [], "S/S 輸入共點；X0.0/X0.1 PG0/PG1(X0.0 亦 Rst0)；X0.8/X0.9 MPGA/MPGB(CntA0/B0)；X0.12/X0.13 DOG0/DOG1；Y0.0± A0，Y0.1± B0，Y0.2± A1，Y0.3± B1（差動）；Y0.8/Y0.9 CLR0/CLR1；COM", false], ["AH10PM-5A", "cn", 35, 110, 103, [["C3", "C2", "C1", "C0", "NC", "Y0.7-", "Y0.6-", "Y0.5-", "Y0.4-", "Y0.3-", "Y0.2-", "Y0.1-", "Y0.0-", "NC", "NC", "X0.15", "X0.13", "X0.11", "X0.9", "NC", "NC", "X0.3-", "X0.2-", "X0.1-", "X0.0-"], ["Y0.11", "Y0.10", "Y0.9", "Y0.8", "NC", "Y0.7+", "Y0.6+", "Y0.5+", "Y0.4+", "Y0.3+", "Y0.2+", "Y0.1+", "Y0.0+", "NC", "S/S", "X0.14", "X0.12", "X0.10", "X0.8", "NC", "NC", "X0.3+", "X0.2+", "X0.1+", "X0.0+"]], ["CN1", "USB", "ETH"], "Y0.0~Y0.7± 差動脈波 A0/B0…A3/B3；Y0.8~Y0.11 CLR0~3；C0~C3 COM0~3；X0.0~X0.3± PG0~3；X0.8/X0.9 MPGA/B；X0.10~X0.15 DOG；S/S", false], ["AH15PM-5A", "cn", 35, 110, 103, [["Y0.11", "Y0.9", "COM", "Y0.7-", "Y0.6-", "Y0.5-", "Y0.4-", "Y0.3-", "Y0.2-", "Y0.1-", "Y0.0-", "X1.5", "X1.3", "X1.1", "X0.15", "X0.13", "X0.11", "X0.9-", "X0.8-", "X0.7", "X0.5", "X0.3-", "X0.2-", "X0.1-", "X0.0-"], ["Y0.10", "Y0.8", "Y0.7+", "Y0.6+", "Y0.5+", "Y0.4+", "Y0.3+", "Y0.2+", "Y0.1+", "Y0.0+", "S/S", "X1.4", "X1.2", "X1.0", "X0.14", "X0.12", "X0.10", "X0.9+", "X0.8+", "X0.6", "X0.4", "X0.3+", "X0.2+", "X0.1+", "X0.0+"]], ["CN1", "USB", "ETH"], "Y0.0~Y0.7± 差動 A/B；Y0.8~Y0.11 CLR0~3；X1.0~X1.5 LSP3/LSN3/CHG0~3；X0.10~X0.15 LSP/LSN；X0.8/9± MPGA/B；X0.4~X0.7 DOG0~3；X0.0~X0.3± PG0~3；S/S；COM", false], ["AH20MC-5A", "cn", 35, 110, 103, [["C3", "C2", "C1", "C0", "NC", "NC", "X0.3-", "X0.15-", "X0.14-", "X0.2-", "X0.13-", "X0.12-", "X0.1-", "X0.11-", "X0.10-", "X0.0-", "X0.9-", "X0.8-"], ["Y0.11", "Y0.10", "Y0.9", "Y0.8", "NC", "NC", "X0.3+", "X0.15+", "X0.14+", "X0.2+", "X0.13+", "X0.12+", "X0.1+", "X0.11+", "X0.10+", "X0.0+", "X0.9+", "X0.8+"]], ["CN1", "DMCNet", "ETH", "USB"], "C0~3 COM0~3/Y0.8~11 Out0~3；X0.0~3± Rst；X0.8/9± MPGA/B；X0.10~15± DOG/計數", false], ["UB-10-IO16C", "board", 125, 50.8, 87, [["C3", "C2", "C1", "C0", "N/C", "N/C", "X0.3-", "X0.15-", "X0.14-", "X0.2-", "X0.13-", "X0.12-", "X0.1-", "X0.11-", "X0.10-", "X0.0-", "X0.9-", "X0.8-", "24G", "24G", "FE"], ["Y0.11", "Y0.10", "Y0.9", "Y0.8", "N/C", "N/C", "X0.3+", "X0.15+", "X0.14+", "X0.2+", "X0.13+", "X0.12+", "X0.1+", "X0.11+", "X0.10+", "X0.0+", "X0.9+", "X0.8+", "N/C", "24V", "24V"]], [], "", false], ["UB-10-IO24C", "board", 157, 50.8, 87, [["C3", "C2", "C1", "C0", "N/C", "Y0.7-", "Y0.6-", "Y0.5-", "Y0.4-", "Y0.3-", "Y0.2-", "Y0.1-", "Y0.0-", "N/C", "N/C", "X0.15", "X0.13", "X0.11", "X0.9", "N/C", "N/C", "X0.3-", "X0.2-", "X0.1-", "X0.0-", "24G", "24G", "FE"], ["Y0.11", "Y0.10", "Y0.9", "Y0.8", "N/C", "Y0.7+", "Y0.6+", "Y0.5+", "Y0.4+", "Y0.3+", "Y0.2+", "Y0.1+", "Y0.0+", "N/C", "S/S", "X0.14", "X0.12", "X0.10", "X0.8", "N/C", "N/C", "X0.3+", "X0.2+", "X0.1+", "X0.0+", "N/C", "24V", "24V"]], [], "", false], ["UB-10-IO34C", "board", 157, 50.8, 87, [["Y0.11", "Y0.9", "COM", "Y0.7-", "Y0.6-", "Y0.5-", "Y0.4-", "Y0.3-", "Y0.2-", "Y0.1-", "Y0.0-", "X1.5", "X1.3", "X1.1", "X0.15", "X0.13", "X0.11", "X0.9-", "X0.8-", "X0.7", "X0.5", "X0.3-", "X0.2-", "X0.1-", "X0.0-", "24G", "24G", "FE"], ["Y0.10", "Y0.8", "Y0.7+", "Y0.6+", "Y0.5+", "Y0.4+", "Y0.3+", "Y0.2+", "Y0.1+", "Y0.0+", "S/S", "X1.4", "X1.2", "X1.0", "X0.14", "X0.12", "X0.10", "X0.9+", "X0.8+", "X0.6", "X0.4", "X0.3+", "X0.2+", "X0.1+", "X0.0+", "N/C", "24V", "24V"]], [], "", false], ["AHPS05-5A", "col", 50, 110, 103, [["VS-", "VS+", "NC", "FG", "LG", "N", "L"]], [], "VS-/VS+ 外部 24VDC 偵測；NC 空端子；FG 功能接地；LG 大地接地；L/N 100~240VAC 輸入", false], ["AHPS15-5A", "col", 50, 110, 103, [["VS-", "VS+", "NC", "FG", "FE", "24G", "+24V"]], [], "VS-/VS+ 外部 24VDC 偵測；NC；FG 功能接地；FE 大地接地；24G/+24V DC 電源輸入", false], ["AHCPU501-RS2", "ports", 40, 110, 103, [], ["COM2", "COM1", "USB"], "", false], ["AHCPU501-EN", "ports", 40, 110, 103, [], ["ETH", "COM", "USB"], "", false], ["AHCPU511-RS2", "ports", 40, 110, 103, [], ["COM2", "COM1", "USB"], "", false], ["AHCPU511-EN", "ports", 40, 110, 103, [], ["ETH", "COM", "USB"], "", false], ["AHCPU521-RS2", "ports", 40, 110, 103, [], ["COM2", "COM1", "USB"], "", false], ["AHCPU521-EN", "ports", 40, 110, 103, [], ["ETH", "COM", "USB"], "", false], ["AHCPU531-RS2", "ports", 40, 110, 103, [], ["COM2", "COM1", "USB"], "", false], ["AHCPU531-EN", "ports", 40, 110, 103, [], ["ETH", "COM", "USB"], "", false], ["AHCPU560-EN2", "col", 40, 110, 103, [["D-", "D+", "SG", "RX", "TX"]], ["ETH1", "ETH2", "USB", "SYNC"], "COM 端子：D-/D+ RS-485，SG 信號地，RX/TX RS-232", false]];
const SKIP=new Set(['','-','NC','N/C','?']);
const pdesc=id=>/^(FG|FE|SLD|SHLD|SHIELD|LG)$/.test(id)?'接地／遮蔽':/^(AG|SG|GND|DGND|24G|ZP|VS-|V-)$/.test(id)?'信號地／0V':/^(UP|\+24V|VS\+|V\+)$/.test(id)?'外部電源 +':/^[LN]$/.test(id)?'AC 電源輸入':/^(ETH|X1|X2|ETH1|ETH2)$/.test(id)?'乙太網路 RJ-45':/^COM\d?$/.test(id)?'通訊埠（DB9）':id==='USB'?'mini USB':id==='SYNC'?'同步光纖埠':'';
function ahLayout([m,lay,W,H,D,cols,ports]){
  const T=[];const add=(id,x,y,side)=>{if(!SKIP.has(id))T.push([id,+x.toFixed(2),+y.toFixed(2),side,pdesc(id)]);};
  if(lay==='tb')T.push(...tbTerms(cols[0].map(x=>SKIP.has(x)?null:x)).map(t=>[...t,pdesc(t[0])]));
  else if(lay==='cn')T.push(...cnTerms(cols.map(c=>c.map(x=>SKIP.has(x)?'':x))).map(t=>[...t,pdesc(t[0])]));
  else if(lay==='blocks'){const seen=new Set(cols[0]);cols.forEach((c,ci)=>{const p=Math.min(8,80/(c.length-1||1));c.forEach((id,r)=>add(ci&&seen.has(id)&&!SKIP.has(id)?`B2:${id}`:id,ci?24:12,22+r*p,ci?'right':'left'));});}
  else if(lay==='col'){const c=cols[0],p=c.length>5?7:4.5;c.forEach((id,r)=>add(id,W-12,(W>=40?40:42)+r*p,'right'));}
  else if(lay==='board'){cols.forEach((c,ri)=>{const p=(W-12)/(c.length-1||1);c.forEach((id,k)=>add(id,6+k*p,ri?H-8:8,ri?'bottom':'top'));});}
  // 通訊埠：只有埠的畫在中間；和端子／連接器同一台的放到右緣上方
  ports.forEach((id,i)=>lay==='ports'?add(id,W/2,40+i*14,'left'):lay==='col'?add(id,W/2-6,22+i*7,'left'):add(id,W-3,14+i*6,'right'));
  // 同一台裡的重複名稱（例如多個 AG、SLD）在模組內相通
  const links=dedup(T);T.forEach(t=>{if(!t[4])t[4]=pdesc(t[0].replace(/\(\d+\)$/,''));});return {T,links};
}
AHX.forEach(r=>{
  const [m,lay,W,H,D,cols,ports,note,med]=r,id=idOf(m),{T,links}=ahLayout(r);
  const board=/^UB-10/.test(m),kind=/^AHPS/.test(m)?'pwr':/^(AHCPU|AHRTU)/.test(m)?'cpu':board?null:'io';
  const name=m+' '+(kind==='pwr'?'電源模組':kind==='cpu'?(/RTU/.test(m)?'遠程 I/O 通訊模組':'CPU 模組'):board?'配線模組（運動控制模組用）':
    /AD|DA|XA/.test(m)?'類比 I/O 模組':/PT|TC/.test(m)?'溫度模組':/HC|PM|MC/.test(m)?'運動控制模組':'網路模組');
  const sim=m==='AHPS05-5A'?[{k:'pwr',a:'L',b:'N'}]:m==='AHPS15-5A'?[{k:'pwr',a:'+24V',b:'24G',polar:true}]:null;
  def(id,null,board?C7:C4,DT,name,W,H,D,kind==='pwr'?'PS':kind==='cpu'?'CPU':board?'TB':'AM','dark',T,{ser:board?'台達 AH 配線模組':kind==='pwr'?'台達 AH 電源':kind==='cpu'?'台達 AH CPU':'台達 AH 特殊模組',
    ...(kind?{rackKind:kind,attach:'slot'}:{}),links:links.length?links:null,...(sim?{sim}:{}),
    note:`${note?note+'；':''}${med?'部分腳位方向依手冊表格推定；':''}${kind==='cpu'?'通訊埠各畫成一個接點；':''}${NOTE}`});ver(id);
});
})();

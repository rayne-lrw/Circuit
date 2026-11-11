"use strict";
/* ---------- 動作模擬（邏輯導通，只看 ON／OFF） ----------
   電源給電位（DC 的 ＋／−、AC 的各相），導線和器具內部導通的接點把電位傳出去；
   負載兩端分別接到同一個電源的 ＋ 和 −（或 AC 不同相）就動作；線圈動作後接點切換，再算一輪，直到穩定。

   器具動作資料（元素清單），接點寫法：'A1'；成組接點的子導線寫 '5521公.+'：
     {k:'grp',t,sub:[…]}            成組接點：一個接點代表多條導線（插頭、DC 接頭）；兩個成組接點之間的線照子導線名稱一一對接
     {k:'pass',a,b}                 一直導通（濾波器、端子台、轉接頭）
     {k:'brk',a,b}                  斷路器：器具 ON 才導通（模擬開始全部 OFF）
     {k:'ac',ph:[…],n}              AC 電源（一直有電）：各相接點，n 是中性線接點（可省略）
     {k:'src',p,n,v,in:[a,b]}       DC 電源：in 兩端有電才輸出（省略就一直有電）；v 是顯示用的電壓
     {k:'load',a,b,name,polar}      負載：有電就動作；polar 表示有極性，接反顯示「極性相反」
     {k:'coil',a,b}                 線圈：有電時這台的接點（by:'coil'）切換
     {k:'pwr',a,b}                  器具本身的電源：有電時 PLC 輸出、感測器才會動作
     {k:'sw',a,b,nc,by,btn,g}       接點：by='coil'（自己的線圈；g 是一台多組線圈時的組名）、'hostbrk'（裝在哪台斷路器上就跟它的 ON／OFF）、'host'（裝在哪台上就跟哪台的線圈）、'btn'（使用者按著）、'latch'（安全繼電器）、'trip'（積熱電驛跳脫）、'op'（IDEC 接點塊跟著操作部）；nc 是常閉
     {k:'sens',out,to,btn}          感測器輸出：器具有電且觸發時，out 和 to（棕＝PNP、藍＝NPN）導通
     {k:'plcX',com,pts:[…]}         PLC 輸入：輸入點和 com 分別是同一電源的 ＋／− 就 ON
     {k:'plcY',pairs:[[Y,COM]…]}    PLC 輸出：該 Y 點 ON 且 PLC 有電時 Y 和 COM 導通
     {k:'pnoz',…}                   安全繼電器（簡化）：見 PNOZ 說明 */
const SIMDEF={};
const sd=(ids,f)=>[].concat(ids).forEach(id=>SIMDEF[id]=f);
const pairs=(arr,mk)=>arr.map(([a,b])=>mk(a,b));
// 斷路器：上下相對的極導通
sd(['fuji-bw50','ic60-3P40A','ic60-3P16A','ic60-3P4A','gv2me16','gv2me32'],()=>pairs([['1','2'],['3','4'],['5','6']],(a,b)=>({k:'brk',a,b})));
sd('ic60-2P4A',()=>pairs([['1','2'],['3','4']],(a,b)=>({k:'brk',a,b})));
sd(['ic60-1P6A','ic60-1P4A','ic60-1P2A','ic60-1P1A'],()=>[{k:'brk',a:'1',b:'2'}]);
// 接觸器：線圈 A1／A2，主接點與輔助接點
const CONT=[{k:'coil',a:'A1',b:'A2'},...pairs([['L1','T1'],['L2','T2'],['L3','T3'],['13','14']],(a,b)=>({k:'sw',a,b,by:'coil'})),{k:'sw',a:'21',b:'22',nc:true,by:'coil'}];
sd(['lc1d09','lc1d18','lc1d38'],()=>CONT);
sd('cu11',()=>CONT.filter(e=>e.a!=='21'));
sd('lc1d258',()=>[{k:'coil',a:'A1',b:'A2'},{k:'sw',a:'1',b:'2',by:'coil'},{k:'sw',a:'3',b:'4',by:'coil'},{k:'sw',a:'R1',b:'R2',nc:true,by:'coil'},{k:'sw',a:'R3',b:'R4',nc:true,by:'coil'}]);
sd('ladn40',()=>pairs([['53','54'],['63','64'],['73','74'],['83','84']],(a,b)=>({k:'sw',a,b,by:'host'})));
// 繼電器（PYF08A 座）：線圈 13／14；9 共點 5 常開 1 常閉；12 共點 8 常開 4 常閉
const MY2=[{k:'coil',a:'13',b:'14'},{k:'sw',a:'9',b:'5',by:'coil'},{k:'sw',a:'9',b:'1',nc:true,by:'coil'},{k:'sw',a:'12',b:'8',by:'coil'},{k:'sw',a:'12',b:'4',nc:true,by:'coil'}];
sd(['my2n-24','my2n-220','fotek'],()=>MY2);
const MY4=[{k:'coil',a:'13',b:'14'},...[[9,5,1],[10,6,2],[11,7,3],[12,8,4]].flatMap(([c,o,n])=>[{k:'sw',a:''+c,b:''+o,by:'coil'},{k:'sw',a:''+c,b:''+n,nc:true,by:'coil'}])];
sd(['pyf14a','ly4n'],()=>MY4);
// 安全繼電器 PNOZ X2.8P（簡化）：A1／A2 有電，輸入 S11、S12、S21、S22 每一點都和其中另一點導通（急停沒按，不管急停跨接在哪兩點），
// 再重置一次就保持：S34 和 S12 短接是自動重置，否則按「重置」；保持時 13–14、23–24、33–34 導通、41–42 斷開；輸入斷開或斷電就解除
sd('pnoz',()=>[{k:'pwr',a:'A1',b:'A2'},{k:'pnoz',ins:['S11','S12','S21','S22'],auto:['S34','S12'],btn:'重置'},...pairs([['13','14'],['23','24'],['33','34']],(a,b)=>({k:'sw',a,b,by:'latch'})),{k:'sw',a:'41',b:'42',nc:true,by:'latch'}]);
// PLC
const FX5Y=[['Y0','COM0'],['Y1','COM0'],['Y2','COM0'],['Y3','COM0'],['Y4','COM1'],['Y5','COM1'],['Y6','COM1'],['Y7','COM1'],['Y10','COM2'],['Y11','COM2'],['Y12','COM2'],['Y13','COM2'],['Y14','COM3'],['Y15','COM3'],['Y16','COM3'],['Y17','COM3']];
sd('fx5u32',()=>[{k:'pwr',a:'L',b:'N'},{k:'src',p:'24V',n:'0V',v:'24V',in:['L','N']},{k:'plcX',cpu:true,com:'S/S',pts:['X0','X1','X2','X3','X4','X5','X6','X7','X10','X11','X12','X13','X14','X15','X16','X17']},{k:'plcY',cpu:true,pairs:FX5Y}]);
sd('fx516ex',()=>[{k:'plcX',com:'S/S',pts:['0','1','2','3','4','5','6','7','10','11','12','13','14','15','16','17']}]);
sd('fx540ssc',()=>[{k:'load',a:'24V',b:'0V',name:'電源'}]);
// 伺服驅動器（黑盒子）：只看主電源、控制電源有沒有電
// 三相主電源 L1／L2／L3：兩兩之間都算負載，三相接好時三條線都有電流（單相接 L1、L3 也算有電）；配盤模擬不判斷欠相
const MAIN3=()=>['L1','L2','L3'].flatMap((a,i,A)=>A.slice(i+1).map(b=>({k:'load',a,b,name:'主電源'})));
sd(['j4700','j4200'],()=>[...MAIN3(),{k:'load',a:'L11',b:'L21',name:'控制電源'}]);
sd('je40',MAIN3);
// 電源、濾波
sd('drl120',()=>[{k:'src',p:'+V1',n:'-V1',v:'24V',in:['L','N']},{k:'pass',a:'+V1',b:'+V2'},{k:'pass',a:'-V1',b:'-V2'}]);
sd('fn3270',()=>pairs([['L1',"L1'"],['L2',"L2'"],['L3',"L3'"],['PE',"PE'"]],(a,b)=>({k:'pass',a,b})));
sd('fn2010',()=>pairs([['L',"L'"],['N',"N'"]],(a,b)=>({k:'pass',a,b})));
sd('nht60',()=>pairs([['L1','T1'],['L2','T2'],['L3','T3']],(a,b)=>({k:'pass',a,b})));
// 插座：中間「插頭」口是成組接點（L、N、E）
const SOCKET=[{k:'grp',t:'插頭',sub:['L','N','E']},{k:'pass',a:'插頭.L',b:'L'},{k:'pass',a:'插頭.N',b:'N'},{k:'pass',a:'插頭.E',b:'E'}];
sd(['ac30','lk3214'],()=>SOCKET);
sd(['w852-111','w852-1111','gs2107'],()=>[{k:'load',a:'24V',b:'0V',name:'電源'}]);
sd('nextech',()=>[{k:'grp',t:'DC-IN',sub:['+','-']},{k:'load',a:'DC-IN.+',b:'DC-IN.-',name:'電源',polar:true}]);
sd('fan4',()=>[{k:'load',a:'L',b:'N',name:'風扇'}]);
sd('lamp',()=>[{k:'load',a:'L/+',b:'N/−',name:'燈'}]);
// 面板按鈕
sd('yw1b',()=>[{k:'sw',a:'1',b:'2',nc:true,by:'btn',btn:'按下'},{k:'sw',a:"1'",b:"2'",nc:true,by:'btn',btn:'按下'}]);
sd('yw1l-r',()=>[{k:'sw',a:'1',b:'2',nc:true,by:'btn',btn:'按下'},{k:'load',a:'X1',b:'X2',name:'指示燈'}]);
sd('yw1l-g',()=>[{k:'sw',a:'3',b:'4',by:'btn',btn:'按下'},{k:'load',a:'X1',b:'X2',name:'指示燈'}]);
sd('yw1s',()=>[{k:'sw',a:'3',b:'4',by:'btn',btn:'切換'}]);
sd(['py2201-g','py2201-r'],()=>[{k:'sw',a:'1',b:'2',nc:true,by:'btn',btn:'按下'},{k:'sw',a:'3',b:'4',by:'btn',btn:'按下'},{k:'load',a:'+',b:'-',name:'指示燈',polar:true}]);
// 現場
sd('field-power',()=>[{k:'ac',ph:['R','S','T']}]);
sd(['hgsr702','hgkn43'],()=>[{k:'load',a:'B1',b:'B2',name:'煞車釋放'}]);
sd(['dms6015','dms8015'],()=>[{k:'load',a:'VCC',b:'GND',name:'電源',polar:true}]);
sd('e2e',()=>[{k:'pwr',a:'棕',b:'藍'},{k:'sens',out:'黑',to:'棕',btn:'觸發'}]);
sd('pzg101',()=>[{k:'pwr',a:'棕',b:'藍'},{k:'sens',out:'黑',to:'棕',btn:'觸發'}]);
sd('pzg102',()=>[{k:'pwr',a:'棕',b:'藍'},{k:'sens',out:'黑',to:'棕',btn:'觸發'},{k:'sens',out:'白',to:'藍',btn:'觸發'}]);
sd('glr22',()=>[{k:'pwr',a:'棕',b:'藍'},{k:'sens',out:'黑',to:'棕',btn:'遮光'},{k:'sens',out:'白',to:'棕',btn:'遮光'}]);
sd(['glr22-t','ga096','ga096-t'],()=>[{k:'load',a:'棕',b:'藍',name:'電源',polar:true}]);
sd('d4mc',()=>[{k:'sw',a:'C',b:'A',by:'btn',btn:'觸發'},{k:'sw',a:'C',b:'B',nc:true,by:'btn',btn:'觸發'}]);
sd('ths62',()=>['上','下','左','右'].map(b=>({k:'sw',a:'COM',b,by:'btn',btn:b})));
sd('qlnp',()=>[{k:'pwr',a:'+',b:'-'},{k:'sens',out:'OUT',to:'+',btn:'IN 有訊號'}]);
// 雷射一組
sd('laser-ps',()=>[{k:'grp',t:'AC',sub:['L','N','E']},{k:'grp',t:'5521公',sub:['+','-']},{k:'src',p:'5521公.+',n:'5521公.-',v:'3V',in:['AC.L','AC.N']}]);
sd('dc5521f-tb',()=>[{k:'grp',t:'5521母',sub:['+','-']},{k:'pass',a:'5521母.+',b:'V+'},{k:'pass',a:'5521母.-',b:'V-'}]);
sd('dc5525m-tb',()=>[{k:'grp',t:'5525公',sub:['+','-']},{k:'pass',a:'5525公.+',b:'V+'},{k:'pass',a:'5525公.-',b:'V-'}]);
sd('laser-dot',()=>[{k:'grp',t:'5525母',sub:['+','-']},{k:'load',a:'5525母.+',b:'5525母.-',name:'雷射',polar:true}]);

// 這台器具的動作資料：自訂器具用 t.sim，從內建器具複製來的（src）用原本的
function simElems(d){
  const t=tplOf(d);if(!t)return [];
  if(Array.isArray(t.sim))return t.sim;
  const key=SIMDEF[d.tpl]?d.tpl:t.src&&SIMDEF[t.src]?t.src:null;
  return key?SIMDEF[key]():[];
}
const hasSim=d=>simElems(d).length>0;

/* ---------- 引擎 ---------- */
let SIMST=null; // 模擬狀態：{on:{斷路器}, press:Set('器具|按鈕'), y:Set('器具|Y0'), coil:{}, latch:{}, res}
function simReset(){SIMST={on:{},press:new Set(),y:new Set(),coil:{},latch:{},trip:{},sel:{},res:null};}
function simRun(){
  if(!SIMST)simReset();
  const st=SIMST,devs=S.devices,E=new Map();devs.forEach(d=>E.set(d.id,simElems(d)));
  // 接點鍵：沿用電位的 nodeKey（端子台同片、短路片、同電位群組都算同一點）；成組接點的子導線另外加上 .名稱
  const tk=(d,t)=>{const i=t.indexOf('.');const base=i>0&&grpOf(d,t.slice(0,i))?t.slice(0,i):t;return nodeKey({d:d.id,t:base})+(base!==t?t.slice(base.length):'');};
  const grpOf=(d,t)=>(E.get(d.id)||[]).find(e=>e.k==='grp'&&e.t===t);
  // 導線（固定）：成組接點兩端照子導線名稱對接
  const base=new Map(),bf=k=>{if(!base.has(k))base.set(k,k);while(base.get(k)!==k){base.set(k,base.get(base.get(k)));k=base.get(k);}return k;},bu=(a,b)=>{const x=bf(a),y=bf(b);if(x!==y)base.set(x,y);};
  const wireKeys=new Map(),warn=[];
  S.wires.forEach(w=>{const da=devOf(w.a.d),db=devOf(w.b.d);if(!da||!db)return;const ga=grpOf(da,w.a.t),gb=grpOf(db,w.b.t);
    if(ga||gb){if(ga&&gb){const ks=[],pr=[];ga.sub.forEach((s,i)=>{const t=gb.sub.includes(s)?s:gb.sub[i];if(t==null)return;const a=tk(da,w.a.t+'.'+s),b=tk(db,w.b.t+'.'+t);bu(a,b);ks.push(a);pr.push([a,b]);});wireKeys.set(w.id,{keys:ks,pairs:pr});}
      else{warn.push(`${wireRef(w)}：成組接點（${ga?epText(w.a):epText(w.b)}）接到一般接點，模擬時不算導通`);wireKeys.set(w.id,{keys:[],pairs:[]});}return;}
    const a=endKey(w,'a'),b=endKey(w,'b');bu(a,b);wireKeys.set(w.id,{keys:[a],pairs:[[a,b]]});});
  // 器具內部元素，換成接點鍵
  const els=[];devs.forEach(d=>(E.get(d.id)||[]).forEach(e=>{const r={...e,d};['a','b','p','n','out','to','com'].forEach(f=>{if(e[f]!=null)r[f+'K']=tk(d,e[f]);});
    if(e.in)r.inK=e.in.map(t=>tk(d,t));if(e.ph)r.phK=e.ph.map(t=>tk(d,t));if(e.pts)r.ptsK=e.pts.map(t=>[t,tk(d,t)]);if(e.pairs)r.pairsK=e.pairs.map(([y,c])=>[y,tk(d,y),tk(d,c)]);
    if(e.ins)r.insK=e.ins.map(t=>tk(d,t));if(e.auto)r.autoK=e.auto.map(t=>tk(d,t));els.push(r);}));
  const pressed=(d,btn)=>st.press.has(d.id+'|'+btn);
  // 積熱電驛跳脫：手動復歸是點一下切換（跳脫後保持）；自動復歸是按著才跳脫
  // IDEC YW 接點塊：跟著裝在哪個操作部動作。按鈕瞬時＝按著、交替／緊急停止＝點一下切換；
  // 選擇開關照位置：凸輪在哪些位置壓下這個插槽的接點（常開閉合、常閉打開）
  const opAct=b=>{const h=b.on&&devOf(b.on),op=h&&tplOf(h).op;if(!op)return false;
    if(op.k==='mom')return pressed(h,'按下');if(op.k==='alt')return !!st.on[h.id];
    if(op.k==='sel'){const pos=(st.sel&&st.sel[h.id])||op.def;return ((op.act||{})[b.rack]||[]).includes(pos);}return false;};
  // 線圈鍵：一台一組線圈用器具 id；一台多組線圈（LC2K）用 器具 id#組名
  const ck=e=>e.d.id+(e.g?'#'+e.g:'');
  const tripped=d=>d.thReset==='auto'?pressed(d,'跳脫'):!!(st.trip&&st.trip[d.id]);
  // 機械互鎖：兩台線圈同時有電時，原本就吸合的那台保持，另一台吸不進去（同時通電時左邊那台優先）
  const locks=S.devices.filter(m=>tplOf(m).ilock&&Array.isArray(m.pair)&&m.pair.every(id=>devOf(id)));
  // 有自己電源接點的器具（PLC CPU、感測器）要有電才動作；增設模組沒有電源接點，跟著 CPU 走，不另外判斷
  const pwrDev=new Set(els.filter(e=>e.k==='pwr').map(e=>e.d.id));
  // 左側串接的電源模組（台達 AS-PS02）有電時，主機也有電
  /* 匯流排供電：沒有自己電源接點的增設模組、轉接器、基板上的 CPU 與 I/O 模組，吃上游的電
     - 往右串接：往左找最近一台有自己電源的器具（CPU 或擴展單元）；往左串接的轉接器：吃主機
     - 插槽：同一塊基板的電源模組（沒有電源槽的擴展基板吃主基板）；Q00UJ 這種一體型基板自己就是電源
     - 要外部 24V 的模組（類比、定位等，動作資料是 load）：上游有電而且 24V 也有電才算有電
     - 沒裝到主機或基板上的模組沒有電 */
  const busKind=d=>{if(pwrDev.has(d.id))return false;const t=tplOf(d);return !!(t.chainKind||['io','cpu'].includes(t.rackKind));};
  const extEls=new Map();els.forEach(e=>{if(e.k==='load'&&busKind(e.d)){if(!extEls.has(e.d.id))extEls.set(e.d.id,[]);extEls.get(e.d.id).push(e);}});
  const busSrc=d=>{const h=d.on&&devOf(d.on);if(!h)return [];const t=tplOf(d);
    if(t.chainKind==='r'){const L=chainOf(h,'r'),i=L.indexOf(d);for(let j=i-1;j>=0;j--)if(pwrDev.has(L[j].id))return [L[j]];return [h];}
    if(t.chainKind)return [h];
    const pm=b=>[...(pwrDev.has(b.id)?[b]:[]),...riders(b).filter(r=>pwrDev.has(r.id))];
    let src=pm(h);if(!src.length&&tplOf(h).qext&&typeof qMainOf==='function'){const m=qMainOf(h);if(m&&m!==h)src=pm(m);}return src;};
  const selfLive=(d,P)=>!!P[d.id]||chainOf(d,'l').some(m=>tplOf(m).feedsHost&&P[m.id]);
  const liveWhy=(d,P,ext)=>{if(pwrDev.has(d.id))return selfLive(d,P)?'':'電源沒電';if(!busKind(d))return '';
    const src=busSrc(d);if(!src.length)return '沒有裝到主機或基板上';if(!src.some(x=>!pwrDev.has(x.id)||selfLive(x,P)))return `${src.map(x=>x.tag).join('、')} 沒電`;
    if(extEls.has(d.id)&&!ext[d.id])return '外部 24V 沒電';return '';};
  const plcDevs=[...new Set(els.filter(e=>['plcX','plcY','pwr'].includes(e.k)||busKind(e.d)).map(e=>e.d))];S.devices.forEach(d=>{if(busKind(d)&&!plcDevs.includes(d))plcDevs.push(d);});
  let coil={...st.coil},latch={...st.latch},powered={},sensOn={},res=null,unstable=false;const seen=new Set();
  for(let it=0;it<40;it++){
    // 1. 目前狀態下導通的接點
    const P=new Map(base),f=k=>{if(!P.has(k))P.set(k,k);while(P.get(k)!==k){P.set(k,P.get(P.get(k)));k=P.get(k);}return k;},u=(a,b)=>{const x=f(a),y=f(b);if(x!==y)P.set(x,y);};
    const conducting=[];
    els.forEach(e=>{let on=false;
      if(e.k==='pass')on=true;
      else if(e.k==='brk')on=!!st.on[e.d.id];
      else if(e.k==='sw'){const act=e.by==='coil'?coil[ck(e)]:e.by==='host'?coil[e.d.on]:e.by==='hostbrk'?!!(e.d.on&&st.on[e.d.on]):e.by==='op'?opAct(e.d):e.by==='latch'?latch[e.d.id]:e.by==='btn'?pressed(e.d,e.btn):e.by==='trip'?tripped(e.d):false;on=e.nc?!act:!!act;}
      else if(e.k==='sens')on=!!(sensOn[e.d.id+'|'+e.out]);
      if(on){u(e.aK||e.outK,e.bK||e.toK);conducting.push(e);}
      if(e.k==='plcY')e.pairsK.forEach(([y,yk,ck])=>{if(powered['L|'+e.d.id]&&st.y.has(e.d.id+'|'+y)){u(yk,ck);conducting.push({k:'plcY',d:e.d,aK:yk,bK:ck,y});}});});
    // 2. 電位：AC 電源一直有電；DC 電源要輸入有電才輸出（可能一層接一層，算到不再變）
    const lab=new Map(),add=(k,l)=>{const r=f(k);if(!lab.has(r))lab.set(r,new Set());lab.get(r).add(l);};
    els.filter(e=>e.k==='ac').forEach(e=>{e.phK.forEach((k,i)=>add(k,`A|${e.d.id}|${e.ph[i]}`));if(e.nK)add(e.nK,`A|${e.d.id}|N`);});
    const srcOn=new Set();
    for(let g=0;g<8;g++){let ch=false;els.filter(e=>e.k==='src'&&!srcOn.has(e)).forEach(e=>{if(!e.inK||feed(lab,f,e.inK[0],e.inK[1]).on){srcOn.add(e);add(e.pK,`D|${e.d.id}|+|${e.v||''}`);add(e.nK,`D|${e.d.id}|-|${e.v||''}`);ch=true;}});if(!ch)break;}
    // 3. 負載、線圈、器具電源、PLC 輸入、感測器、安全繼電器
    const nc={},np={},ns={},loads=[];let nl={...latch};
    els.forEach(e=>{
      if(e.k==='load'||e.k==='coil'||e.k==='pwr'){const r=feed(lab,f,e.aK,e.bK,e.polar);if(e.k==='coil'&&r.on)nc[ck(e)]=true;if(e.k==='pwr'&&r.on)np[e.d.id]=true;loads.push({e,...r});}});
    locks.forEach(m=>{const [a,b]=m.pair;if(nc[a]&&nc[b]){if(coil[b]&&!coil[a])delete nc[a];else delete nc[b];}});
    // 同一台裡的機械互鎖（LC2K 一體式正逆轉）：兩組線圈同時有電時，原本吸合的那組保持
    els.forEach(e=>{if(e.k!=='mlock')return;const [a,b]=e.g.map(g=>e.d.id+'#'+g);if(nc[a]&&nc[b]){if(coil[b]&&!coil[a])delete nc[a];else delete nc[b];}});
    { const ext={};loads.forEach(l=>{if(l.on&&extEls.has(l.e.d.id))ext[l.e.d.id]=true;});plcDevs.forEach(d=>{if(!liveWhy(d,np,ext))np['L|'+d.id]=true;}); }
    els.forEach(e=>{if(e.k==='sens'&&np[e.d.id]&&pressed(e.d,e.btn))ns[e.d.id+'|'+e.out]=true;});
    els.forEach(e=>{if(e.k!=='pnoz')return;const R=e.insK.map(f),chOk=R.every((r,i)=>R.some((q,j)=>j!==i&&q===r)),pw=np[e.d.id];
      if(!pw||!chOk)nl[e.d.id]=false;else if((e.autoK&&f(e.autoK[0])===f(e.autoK[1]))||pressed(e.d,e.btn))nl[e.d.id]=true;});
    const key=JSON.stringify([nc,np,ns,nl]);
    const same=JSON.stringify(nc)===JSON.stringify(coil)&&JSON.stringify(np)===JSON.stringify(powered)&&JSON.stringify(ns)===JSON.stringify(sensOn)&&JSON.stringify(nl)===JSON.stringify(latch);
    res={f,lab,loads,conducting,srcOn,els};
    if(same)break;
    if(seen.has(key)){unstable=true;break;}seen.add(key);
    coil=nc;powered=np;sensOn=ns;latch=nl;
  }
  st.coil=coil;st.latch=latch;
  // 結果整理
  const {f,lab,loads,conducting}=res;
  const labOf=k=>lab.get(f(k))||new Set();
  const shorts=[];lab.forEach((set,r)=>{const by=new Map();set.forEach(l=>{const [t,id,pole]=l.split('|');const g=t+id;if(!by.has(g))by.set(g,new Set());by.get(g).add(pole);});
    by.forEach((ps,g)=>{if(g[0]==='D'&&ps.has('+')&&ps.has('-'))shorts.push(r);else if(g[0]==='A'&&[...ps].filter(p=>p!=='N').length>1)shorts.push(r);});});
  const shortSet=new Set(shorts);
  // PLC 輸入
  // 點位名稱：連接器針腳先換成訊號（三菱 Q 的 B20 → X00），再換成實際位址
  const pName=(e,t)=>{const g=typeof cnSig==='function'?cnSig(e.d,t):t;return qName(e.d,g)||chainName(e.d,g)||(e.cpu?g:`${e.d.tag}·${g}`);};
  const live=d=>!!powered['L|'+d.id];
  const X=[];els.filter(e=>e.k==='plcX').forEach(e=>e.ptsK.forEach(([t,k])=>X.push({d:e.d,t,name:pName(e,t),on:live(e.d)&&feed(lab,f,k,e.comK).on,...(live(e.d)?{}:{nopwr:true})})));
  const Y=[];els.filter(e=>e.k==='plcY').forEach(e=>e.pairsK.forEach(([y])=>{if(termOf(e.d,y))Y.push({d:e.d,y,name:pName(e,y),on:st.y.has(e.d.id+'|'+y),...(live(e.d)?{}:{nopwr:true}),wired:S.wires.some(w=>wiredAt(w,e.d.id,y))});}));
  // 每條線：電位、有沒有電流
  const wires={};S.wires.forEach(w=>{const wk=wireKeys.get(w.id);if(!wk||!wk.keys.length){wires[w.id]={pot:'none'};return;}
    const ls=new Set();wk.keys.forEach(k=>labOf(k).forEach(l=>ls.add(l)));wires[w.id]={pot:potOf(ls),ls:[...ls],short:wk.keys.some(k=>shortSet.has(f(k)))};});
  const cur=currentWires(res,wireKeys,loads);cur.forEach(id=>{if(wires[id])wires[id].cur=true;});
  const devState={};loads.forEach(l=>{const d=l.e.d;if(!devState[d.id])devState[d.id]={on:[],rev:[]};const nm=l.e.name||(l.e.k==='coil'?'線圈':'電源'),S2=devState[d.id];if(l.on&&!S2.on.includes(nm))S2.on.push(nm);if(l.rev&&!S2.rev.includes(l.e.name||'電源'))S2.rev.push(l.e.name||'電源');});
  Object.keys(coil).forEach(k=>{if(coil[k]){const id=k.split('#')[0];devState[id]=devState[id]||{on:[],rev:[]};devState[id].coil=true;if(k.includes('#'))(devState[id].groups=devState[id].groups||[]).push(k.split('#')[1]);}});
  locks.forEach(m=>m.pair.forEach(id=>{const s=devState[id];if(s&&!coil[id]){const i=s.on.indexOf('線圈');if(i>=0)s.on[i]='線圈有電但被機械互鎖擋住';}}));
  Object.keys(latch).forEach(id=>{if(latch[id]){devState[id]=devState[id]||{on:[],rev:[]};devState[id].latch=true;}});
  // 匯流排供電的模組：有電就亮（顯示「電源」）；沒電的列出原因；要外部 24V 的，上游沒電時 24V 有電也不算亮
  const ext={};loads.forEach(l=>{if(l.on&&extEls.has(l.e.d.id))ext[l.e.d.id]=true;});const nopwr=[];
  plcDevs.forEach(d=>{if(!busKind(d))return;const why=liveWhy(d,powered,ext),s=devState[d.id]=devState[d.id]||{on:[],rev:[]};
    if(!why){if(!extEls.has(d.id))s.on.push('電源');return;}
    const nm=new Set((extEls.get(d.id)||[]).map(e=>e.name||'電源'));s.on=s.on.filter(n=>!nm.has(n));s.nopwr=why;nopwr.push({d,why});});
  st.res={wires,dev:devState,X,Y,shorts:shorts.length,unstable,warn,conducting,nopwr};
  return st.res;
}
// 兩點之間有沒有電：同一個 DC 電源的 ＋／−（接反時 polar 才算「極性相反」），或同一個 AC 電源的不同相（或相和中性線）
function feed(lab,f,a,b,polar){
  const A=lab.get(f(a)),B=lab.get(f(b));if(!A||!B)return {on:false};
  for(const la of A)for(const lb of B){const [ta,ia,pa,va]=la.split('|'),[tb,ib,pb]=lb.split('|');if(ta!==tb||ia!==ib)continue;
    if(ta==='D'){if(pa==='+'&&pb==='-')return {on:true,src:ia,v:va};if(pa==='-'&&pb==='+')return polar?{on:false,rev:true,src:ia}:{on:true,src:ia,v:va};}
    else if(pa!==pb)return {on:true,src:ia,v:'AC'};}
  return {on:false};
}
// 電位分類：p（DC ＋）、n（DC −）、ac（AC 相）、none
function potOf(ls){let p=false,n=false,a=false;ls.forEach(l=>{const [t,,pole]=l.split('|');if(t==='A'){if(pole!=='N')a=true;else n=true;}else if(pole==='+')p=true;else n=true;});return p?'p':a?'ac':n?'n':'none';}
// 有電流的線：每個動作中的負載，兩端各自沿導線和導通的接點，找最近的電源 ＋（另一端找 −；AC 找任一相）；路上的線就有電流（平行的線只標最短那條）
function currentWires(res,wireKeys,loads){
  const {conducting,srcOn}=res,els=res.els,adj=new Map(),link=(a,b,id)=>{if(!adj.has(a))adj.set(a,[]);if(!adj.has(b))adj.set(b,[]);adj.get(a).push([b,id]);adj.get(b).push([a,id]);};
  wireKeys.forEach((wk,id)=>wk.pairs.forEach(([a,b])=>link(a,b,id)));
  conducting.forEach(e=>link(e.aK||e.outK,e.bK||e.toK,null));
  const goal=new Map(),mark=(k,tag)=>{if(!goal.has(k))goal.set(k,new Set());goal.get(k).add(tag);};
  srcOn.forEach(e=>{mark(e.pK,e.d.id+'|+');mark(e.nK,e.d.id+'|-');});
  els.filter(e=>e.k==='ac').forEach(e=>{e.phK.forEach(k=>mark(k,e.d.id+'|ac'));if(e.nK)mark(e.nK,e.d.id+'|ac');});
  const out=new Set();
  const bfs=(start,tag)=>{const prev=new Map([[start,null]]),q=[start];while(q.length){const x=q.shift();if(goal.has(x)&&goal.get(x).has(tag)){let y=x;while(prev.get(y)){const [p,id]=prev.get(y);if(id)out.add(id);y=p;}return;}(adj.get(x)||[]).forEach(([y,id])=>{if(!prev.has(y)){prev.set(y,[x,id]);q.push(y);}});}};
  loads.filter(l=>l.on&&l.src).forEach(l=>{const s=l.src;if(l.v==='AC'){bfs(l.e.aK,s+'|ac');bfs(l.e.bK,s+'|ac');}else{const rev=l.rev;bfs(l.e.aK,s+'|+');bfs(l.e.bK,s+'|-');bfs(l.e.aK,s+'|-');bfs(l.e.bK,s+'|+');}});
  return out;
}

/* ---------- 自訂器具的動作資料：讀檔時檢查（內容不可信） ---------- */
const SIM_K=['grp','pass','brk','coil','load','pwr','src','ac','sw','sens','plcX','plcY','pnoz'];
function simClean(sim,ids){
  if(!Array.isArray(sim))return null;
  const ss=(v,n)=>String(v==null?'':v).slice(0,n),grp=new Map();
  sim.forEach(e=>{if(e&&e.k==='grp'&&ids.has(ss(e.t,12))&&Array.isArray(e.sub))grp.set(ss(e.t,12),e.sub.slice(0,6).map(x=>ss(x,6)).filter(Boolean));});
  const T=v=>{const s=ss(v,20);if(ids.has(s)&&!grp.has(s))return s;const i=s.indexOf('.');if(i>0&&grp.has(s.slice(0,i))&&grp.get(s.slice(0,i)).includes(s.slice(i+1)))return s;return null;};
  const out=[];
  sim.slice(0,60).forEach(e=>{if(!e||!SIM_K.includes(e.k))return;let r=null;
    if(e.k==='grp'){const t=ss(e.t,12);if(grp.has(t)&&grp.get(t).length)r={k:'grp',t,sub:grp.get(t)};}
    else if(['pass','brk','coil','pwr'].includes(e.k)){const a=T(e.a),b=T(e.b);if(a&&b&&a!==b)r={k:e.k,a,b};}
    else if(e.k==='load'){const a=T(e.a),b=T(e.b);if(a&&b&&a!==b)r={k:'load',a,b,name:ss(e.name,12)||'負載',...(e.polar?{polar:true}:{})};}
    else if(e.k==='src'){const p=T(e.p),n=T(e.n),i=Array.isArray(e.in)?e.in.map(T):null;if(p&&n&&p!==n)r={k:'src',p,n,v:ss(e.v,8)||'DC',...(i&&i[0]&&i[1]?{in:i}:{})};}
    else if(e.k==='ac'){const ph=(Array.isArray(e.ph)?e.ph:[]).map(T).filter(Boolean).slice(0,3);if(ph.length)r={k:'ac',ph,...(T(e.n)?{n:T(e.n)}:{})};}
    else if(e.k==='plcX'){const com=T(e.com),pts=(Array.isArray(e.pts)?e.pts:[]).map(T).filter(Boolean).slice(0,64);if(com&&pts.length)r={k:'plcX',com,pts,...(e.cpu?{cpu:true}:{})};}
    else if(e.k==='plcY'){const pr=(Array.isArray(e.pairs)?e.pairs:[]).filter(Array.isArray).map(([y,c])=>[T(y),T(c)]).filter(([y,c])=>y&&c).slice(0,64);if(pr.length)r={k:'plcY',pairs:pr,...(e.cpu?{cpu:true}:{})};}
    else if(e.k==='pnoz'){const ins=(Array.isArray(e.ins)?e.ins:[]).map(T).filter(Boolean),au=Array.isArray(e.auto)?e.auto.map(T):null;if(ins.length>=2)r={k:'pnoz',ins,...(au&&au[0]&&au[1]?{auto:au}:{}),btn:ss(e.btn,8)||'重置'};}
    else if(e.k==='sw'){const a=T(e.a),b=T(e.b),by=['coil','btn','host','latch'].includes(e.by)?e.by:'coil';if(a&&b&&a!==b)r={k:'sw',a,b,by,...(e.nc?{nc:true}:{}),...(by==='btn'?{btn:ss(e.btn,8)||'按下'}:{})};}
    else if(e.k==='sens'){const out=T(e.out),to=T(e.to);if(out&&to&&out!==to)r={k:'sens',out,to,btn:ss(e.btn,8)||'觸發'};}
    if(r)out.push(r);});
  return out.length?out:null;
}

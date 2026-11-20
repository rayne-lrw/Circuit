"use strict";
/* ---------- 工具分頁：線號標籤、端子台接線表、電源負載、版本比較 ----------
   都是從現有的配線資料產生，不改專案內容（電源負載的實測值除外，存在 S.loadMeas）。 */
let toolPrintKind=null; // 列印時只印某一種（'labels'、'tb'、'load'、'diff'），buildPrint 會先看這個
function toolPrint(kind){toolPrintKind=kind;try{window.print();}finally{setTimeout(()=>{toolPrintKind=null;},500);}}
const epShort=e=>`${tagOf(e.d)}:${termLabel(devOf(e.d),e.t)}`;

/* ---------- 線號標籤：每條線兩端各一張，寫線號與這一端／對端 ---------- */
function labelRows(){const out=[];[...S.wires].sort((a,b)=>natCmp(a.no,b.no)).forEach(w=>{
  out.push({no:w.no,end:'A',here:epShort(w.a),there:epShort(w.b),gauge:w.gauge,color:colorOf(w).n});
  out.push({no:w.no,end:'B',here:epShort(w.b),there:epShort(w.a),gauge:w.gauge,color:colorOf(w).n});});return out;}
const LABEL_HEAD=['線號','端','這一端','對端','線徑mm²','線色'];
function labelCsv(){saveFile(`線號標籤-${stamp()}.csv`,toCsv([LABEL_HEAD,...labelRows().map(r=>[r.no,r.end,r.here,r.there,r.gauge,r.color])]),'已匯出線號標籤');}
function labelPrintHtml(meta){const rs=labelRows();
  return `<section class="pg"><div class="ph"><b>線號標籤（每條線兩端各一張，共 ${rs.length} 張）</b><span>${esc(meta)}</span></div><div class="lbl-grid">${rs.map(r=>`<div class="lbl"><b>${esc(r.no)}</b><span>${esc(r.here)}</span><small>→ ${esc(r.there)}</small></div>`).join('')}</div></section>`;}

/* ---------- 端子台接線表：每個端子台一張，每片列出各點接的線與對端 ---------- */
const isTB=d=>{const t=tplOf(d);return hasSlots(t)||t.cat==='端子台／接地';};
function tbTables(){return S.devices.filter(isTB).filter(d=>S.wires.some(w=>w.a.d===d.id||w.b.d===d.id)).sort((a,b)=>natCmp(a.tag,b.tag)).map(d=>{
  const t=tplOf(d),rows=new Map();
  t.terms.forEach(p=>{const m=SLOT_RE.exec(p.id),k=m?m[1]:p.id;if(!rows.has(k))rows.set(k,[]);rows.get(k).push(p.id);});
  const body=[...rows.entries()].sort((a,b)=>natCmp(a[0],b[0])).map(([k,ids])=>{
    const ws=ids.flatMap(id=>S.wires.filter(w=>(w.a.d===d.id&&w.a.t===id)||(w.b.d===d.id&&w.b.t===id)).map(w=>{const o=w.a.d===d.id&&w.a.t===id?w.b:w.a;return `${SLOT_RE.exec(id)?SLOT_RE.exec(id)[2]+'：':''}${w.no} → ${epShort(o)}`;}));
    const lab=hasSlots(t)?(termLabel(d,k+'A').replace(/A$/,'')||k):termLabel(d,k);return [lab&&lab!==k?`${k}（${lab}）`:k,ws.join('　')||'—'];});
  const J=(d.jumpers||[]).map(j=>`第 ${j.at}～${j.at+j.p-1} 片（${j.row===2?'下排':'上排'}）`);
  return {d,head:['片／端子','接線（點：線號 → 對端）'],rows:body,jump:J};});}
function tbPrintHtml(meta){return tbTables().map(T=>`<section class="pg"><div class="ph"><b>端子台接線表　${esc(T.d.tag)}　${esc(tplOf(T.d).n)}</b><span>${esc(meta)}</span></div>${T.jump.length?`<p class="pnote">短路片：${esc(T.jump.join('、'))}</p>`:''}${tableHtml(T.head,T.rows)}</section>`).join('')||'<section class="pg"><p>沒有接線的端子台。</p></section>';}

/* ---------- 工具分頁 ---------- */
function renderTools(){
  $('listH').textContent='工具';
  const tbs=tbTables();
  let h=`<div class="bom-h">線號標籤</div><p class="note">每條線兩端各一張：線號、這一端的器具:接點、對端。共 ${S.wires.length*2} 張。</p>
    <div class="row" style="justify-content:flex-start"><button class="tool" id="lblCsv"${S.wires.length?'':' disabled'}>匯出 CSV（標籤機用）</button><button class="tool" id="lblPrint"${S.wires.length?'':' disabled'}>列印標籤</button></div>
    <div class="bom-h">端子台接線表</div><p class="note">每個端子台一張表，每片列出接的線與對端，可以貼在盤門內。有接線的端子台 ${tbs.length} 個${tbs.length?'：'+esc(tbs.map(t=>t.d.tag).join('、')):''}。</p>
    <div class="row" style="justify-content:flex-start"><button class="tool" id="tbPrint"${tbs.length?'':' disabled'}>列印端子台接線表</button></div>`;
  if(typeof schemSectionHtml==='function')h+=schemSectionHtml();
  if(typeof loadSectionHtml==='function')h+=loadSectionHtml();
  if(typeof diffSectionHtml==='function')h+=diffSectionHtml();
  $('list').innerHTML=h;
  const on=(id,f)=>{const el=$(id);if(el)el.onclick=f;};
  on('lblCsv',labelCsv);on('lblPrint',()=>toolPrint('labels'));on('tbPrint',()=>toolPrint('tb'));
  if(typeof schemSectionBind==='function')schemSectionBind();
  if(typeof loadSectionBind==='function')loadSectionBind();
  if(typeof diffSectionBind==='function')diffSectionBind();
}

/* ---------- 24V 電源負載計算 ----------
   作法：
   1. 用模擬引擎跑「最壞情況」：所有開關、按鈕、接點、PLC 輸出都當作閉合（SIMST.all），找出每個負載可能吃到哪一個 DC 電源
   2. 每個負載的電流：內建資料（只放原廠型錄查得到的值，附出處）→ 使用者填的實測／銘牌值（S.loadMeas，優先）→ 都沒有就列為「沒有資料」
   3. 匯流排供電的 PLC 增設模組：內部 DC24V 消費電流算在供電的主機（型錄的計算方式）
   4. 主機自己的輸入點接自己的 24V：型錄的 24V 電源容量已經扣掉，不重複算；接別的電源才算每點輸入電流
   機械互鎖的兩台、正逆轉這類實際上不會同時動作的負載也會一起算（保守）。 */
const LD_TESYS='施耐德 TeSys 型錄 B8/27「Coils consumption characteristics」：BL 線圈 24V 吸合 2.4 W、保持 2.4 W';
const LD_FX5='三菱 FX5 型錄（201502 TC0601）消耗電流表';
const LD_FX5U='三菱 FX5 型錄（201502 TC0601）FX5U 規格概要';
// 負載資料：[比對（器具名稱）, 元素名稱, 穩態 mA, 突入 mA, 出處]
const LOAD_DB=[
  [/^LC1D(09|18|38|258)BL\b|^LC1D\d+BL\b/,'線圈',100,100,LD_TESYS+'（2.4 W ÷ 24 V ＝ 100 mA）'],
  [/^FX5-40SSC-S\b/,'電源',250,null,LD_FX5+'：FX5-40SSC-S DC24V 外部供電 250 mA'],
];
// 匯流排模組的內部 DC24V 消費電流（由主機供電）
// 輸入模組：輸入迴路接外部電源時內部消費 0 mA（輸入電流改由外部電源出）
const LD_FX5M='三菱 FX5 使用者手冊（硬體篇）I/O 模組性能規格';
const BUS_DB=[[/^FX5-8EX\/ES\b/,50,true],[/^FX5-16EX\/ES\b/,85,true],[/^FX5-8EY[RT]\/ESS?\b/,75],[/^FX5-16EY[RT]\/ESS?\b/,125]];
// 電源容量：[比對（器具名稱）, 電壓, mA, 出處]
const CAP_DB=[
  [/^DRL-24V120W\b/,'24V',5000,'型號 24V 120W（120 W ÷ 24 V ＝ 5 A）'],
  [/^FX5U-32M[RT]\/ESS?\b/,'24V',400,LD_FX5U+'：DC24V 電源容量 400 mA 以下（32M）'],
  [/^FX5U-(64|80)M[RT]\/ESS?\b/,'24V',1100,LD_FX5U+'：DC24V 電源容量 1100 mA 以下（64M、80M）'],
];
// 主機輸入點電流（接到別的電源時才算）
const XIN_DB=[[/^FX5U-\d+M/,t=>/^X([2-9]\d|1\d\d)/.test(t)?4:5.3,LD_FX5U+'：輸入 DC24V 5.3 mA（X020 之後 4 mA）'],[/^FX5-(8|16)EX\/ES\b/,()=>4,LD_FX5M+'：FX5-8EX/ES、16EX/ES 輸入信號電流 4.0 mA']];
const ldMeas=k=>{const v=S.loadMeas&&S.loadMeas[k];return typeof v==='number'?v:null;};
const ldFind=(db,n)=>db.find(r=>r[0].test(n));
function loadCalc(){
  const save=SIMST;let r;try{SIMST=null;simReset();SIMST.all=true;r=simRun();}finally{SIMST=save;}
  const srcs=new Map(),srcKey=(id,v)=>id+'|'+(v||''),get=(id,v)=>{const k=srcKey(id,v);if(!srcs.has(k)){const d=devOf(id),n=tplOf(d).n,c=ldFind(CAP_DB,n),mk='cap|'+d.tpl+'|'+(v||'');
      srcs.set(k,{d,v:v||'DC',items:[],capKey:mk,cap:ldMeas(mk)!=null?{mA:ldMeas(mk),src:'使用者填寫'}:c?{mA:c[2],src:c[3]}:null});}return srcs.get(k);};
  const item=(S0,d,name,key,db,extra)=>{const m=ldMeas(key);S0.items.push({d,name,key,mA:m!=null?m:db?db.mA:null,inrush:m!=null?null:db?db.in:null,src:m!=null?'使用者填寫':db?db.src:'',...extra});};
  // 1. 接線上的負載、線圈、器具電源
  const seen=new Set();
  r.loads.forEach(l=>{if(!l.on||l.v==='AC'||!l.src||l.e.aux)return;const e=l.e,d=e.d,name=e.k==='coil'?'線圈'+(e.g?'（'+e.g+'）':''):e.name||(e.k==='pwr'?'電源':'負載');
    const k=d.id+'|'+name;if(seen.has(k))return;seen.add(k);
    const n=tplOf(d).n,hit=LOAD_DB.find(x=>x[0].test(n)&&x[1]===name.replace(/（.*）$/,''));
    item(get(l.src,l.v),d,name,d.tpl+'|'+name,hit?{mA:hit[2],in:hit[3],src:hit[4]}:null);});
  // 2. PLC 輸入點（接到別台電源的）
  const host=new Map();r.bus.forEach(({d,src})=>{const h=src.find(x=>simElems(x).some(e=>e.k==='src'));if(h)host.set(d.id,h);});
  const xs=new Map();r.X.forEach(x=>{if(!x.on||!x.src||x.v==='AC')return;if(x.src===x.d.id||(host.get(x.d.id)||{}).id===x.src)return;const S0=get(x.src,x.v); // 接自己的 24V：型錄容量已扣掉，不重複算
    const k=x.src+'|'+x.d.id;if(!xs.has(k))xs.set(k,{S0,d:x.d,pts:[]});xs.get(k).pts.push(x);});
  xs.forEach(({S0,d,pts})=>{const n=tplOf(d).n,hit=ldFind(XIN_DB,n),key=d.tpl+'|輸入點';const m=ldMeas(key);
    S0.items.push({d,name:`輸入 ${pts.length} 點（${pts.map(x=>x.name.replace(/^.*·/,'')).join('、')}）`,key,per:true,mA:m!=null?m*pts.length:hit?Math.round(pts.reduce((s,x)=>s+hit[1](x.t),0)*10)/10:null,src:m!=null?`使用者填寫（每點 ${m} mA）`:hit?hit[2]:'',n:pts.length});});
  // 3. 匯流排供電模組的內部 DC24V（算在供電主機的 24V）
  r.bus.forEach(({d})=>{const h=host.get(d.id);if(!h)return;const v=(simElems(h).find(e=>e.k==='src')||{}).v;
    const n=tplOf(d).n,hit=ldFind(BUS_DB,n),key=d.tpl+'|內部24V';const m=ldMeas(key);
    if(!hit&&m==null&&!/EX|EY|E[RT]\b/.test(n))return; // 沒有 24V 內部消費的模組（通信板等）不列
    const ext=hit&&hit[2]&&r.X.some(x=>x.d===d&&x.on&&x.src&&x.src!==h.id);
    item(get(h.id,v),d,'內部 DC24V（匯流排）',key,hit?ext?{mA:0,in:null,src:LD_FX5M+'：輸入迴路使用外部電源時 0 mA（輸入電流算在外部電源）'}:{mA:hit[1],in:null,src:LD_FX5+'：'+n.split(' ')[0]+' DC24V 內部消費電流 '+hit[1]+' mA'}:null);});
  const out=[...srcs.values()].map(S0=>{const known=S0.items.filter(i=>i.mA!=null),total=Math.round(known.reduce((s,i)=>s+i.mA,0)*10)/10;
    const inr=Math.round(known.reduce((s,i)=>s+(i.inrush!=null?i.inrush:i.mA),0)*10)/10,unk=S0.items.filter(i=>i.mA==null);
    const pct=S0.cap?total/S0.cap.mA*100:null;return {...S0,total,inrush:inr,unknown:unk.length,pct,level:pct==null?'':pct>=100?'err':pct>=80?'warn':'ok'};})
    .sort((a,b)=>natCmp(a.d.tag,b.d.tag));
  return {srcs:out,shorts:r.shorts};
}
const ldShort=t=>!t?'沒有資料':t.split('：')[0].replace(/「.*?」|（.*?）/g,'').replace(/^三菱 |^施耐德 /,'');
const ldLevelText=s=>s.cap==null?'沒有容量資料':s.level==='err'?'超過容量':s.level==='warn'?'超過 80%':'容量內';
function ldRows(s){return s.items.map(i=>[`${i.d.tag}（${tplOf(i.d).n}）`,i.name,i.mA==null?'沒有資料':i.mA,i.inrush!=null&&i.inrush!==i.mA?i.inrush:'',i.src||'—']);}
const LD_HEAD=['器具','項目','穩態 mA','突入 mA','依據'];
function loadSectionHtml(){
  const L=loadCalc();
  let h=`<div class="bom-h">24V 電源負載</div><p class="note">最壞情況：所有開關、接點、PLC 輸出都當作閉合，列出每個 DC 電源可能帶到的負載。電流只用原廠型錄查得到的值（附出處）；沒有資料的請填實測值或銘牌值（每種器具填一次，存在專案裡）。機械互鎖這類不會同時動作的負載也一起算，結果偏保守。</p>`;
  if(!L.srcs.length)return h+'<p class="note">沒有接到負載的 DC 電源。</p>';
  if(L.shorts)h+=`<p class="note ld-err">注意：所有接點閉合時有 ${L.shorts} 處 ＋／− 短路（例如正逆轉兩邊同時閉合），這些地方的分配可能不準。</p>`;
  L.srcs.forEach((s,si)=>{const capTxt=s.cap?`${s.cap.mA} mA`:'—';
    h+=`<div class="ld-src ld-${s.level||'na'}"><b>${esc(s.d.tag)}　${esc(tplOf(s.d).n)}　${esc(s.v)}</b>
      <div>合計 <b>${s.total} mA</b>${s.cap?`／容量 ${capTxt}（${Math.round(s.pct)}%）`:''}　<span class="ld-lv">${ldLevelText(s)}</span>${s.inrush>s.total?`　全部同時吸合的突入 ${s.inrush} mA`:''}</div>
      ${s.unknown?`<div class="ld-unk">還有 ${s.unknown} 項沒有資料，合計只算有資料的部分（實際會更大）</div>`:''}
      <div class="ld-cap">容量依據：${s.cap?esc(s.cap.src):'沒有資料'}<label>容量 mA <input type="number" min="0" step="any" class="ld-in" data-k="${esc(s.capKey)}" value="${ldMeas(s.capKey)??''}"></label></div>
      ${s.items.map(i=>`<div class="ld-it${i.mA==null?' ld-none':''}"><span class="ld-tag" title="${esc(tplOf(i.d).n)}">${esc(i.d.tag)}</span><span class="ld-nm">${esc(i.name)}</span><b>${i.mA==null?'？':i.mA+' mA'}</b>${i.inrush!=null&&i.inrush!==i.mA?`<small>突入 ${i.inrush}</small>`:''}<small class="ld-cite" title="${esc(i.src||'')}">${esc(ldShort(i.src))}</small><input type="number" min="0" step="any" class="ld-in" data-k="${esc(i.key)}" value="${ldMeas(i.key)??''}" placeholder="${i.per?'每點':'實測'}" title="${i.per?'每點':'每台'}的實測或銘牌電流 mA；同型號器具共用"></div>`).join('')}</div>`;});
  return h+`<div class="row" style="justify-content:flex-start"><button class="tool" id="ldPrint">列印電源負載表</button></div>`;
}
function loadSectionBind(){
  document.querySelectorAll('#list .ld-in').forEach(el=>{el.onchange=()=>{const k=el.dataset.k,v=el.value.trim()===''?null:Number(el.value);
    if(v!=null&&!(v>=0&&v<1e6)){toast('請填 0 以上的數字');return;}S.loadMeas=S.loadMeas||{};if(v==null)delete S.loadMeas[k];else S.loadMeas[k]=v;if(!Object.keys(S.loadMeas).length)delete S.loadMeas;commit();renderTools();};});
  const b=$('ldPrint');if(b)b.onclick=()=>toolPrint('load');
}
function loadPrintHtml(meta){const L=loadCalc();
  return L.srcs.map(s=>`<section class="pg"><div class="ph"><b>24V 電源負載　${esc(s.d.tag)}　${esc(tplOf(s.d).n)}</b><span>${esc(meta)}</span></div>
    <p class="pnote">合計 ${s.total} mA${s.cap?`／容量 ${s.cap.mA} mA（${Math.round(s.pct)}%）`:''}，${ldLevelText(s)}${s.unknown?`；${s.unknown} 項沒有資料（未計入）`:''}。容量依據：${esc(s.cap?s.cap.src:'沒有資料')}。最壞情況（所有接點閉合）計算。</p>${tableHtml(LD_HEAD,ldRows(s),[2,3])}</section>`).join('')||'<section class="pg"><p>沒有接到負載的 DC 電源。</p></section>';}

/* ---------- 版本比較：讀另一份專案檔（舊版），跟目前盤面比 ----------
   器具用內部識別碼（d.id）對應；導線用兩端（器具識別碼:接點）對應，所以改線號、改線色算「變更」而不是刪掉再加。
   舊檔只放在記憶體，不存進專案。 */
let diffOld=null,diffShow=true; // {name, st}
function diffCalc(){if(!diffOld)return null;const O=diffOld.st;
  const oDev=new Map(O.devices.map(d=>[d.id,d])),nDev=new Map(S.devices.map(d=>[d.id,d]));
  const oName=d=>{const t=(O.tpls&&O.tpls[d.tpl])||TPL[d.tpl];return t?t.n||d.tpl:d.tpl;},nName=d=>tplOf(d).n;
  const dev={add:S.devices.filter(d=>!oDev.has(d.id)),del:O.devices.filter(d=>!nDev.has(d.id)),chg:[]};
  S.devices.forEach(d=>{const o=oDev.get(d.id);if(!o)return;const c=[];
    if(o.tpl!==d.tpl||(o.count||0)!==(d.count||0))c.push(`型號 ${oName(o)} → ${nName(d)}`);
    if(o.tag!==d.tag)c.push(`編號 ${o.tag} → ${d.tag}`);
    if(o.sheet!==d.sheet)c.push('換到另一面');else if(Math.hypot((o.x||0)-d.x,(o.y||0)-d.y)>0.5)c.push(`移動 ${Math.round(Math.hypot(o.x-d.x,o.y-d.y))} mm`);
    if((o.rot||0)!==(d.rot||0))c.push(`旋轉 ${o.rot||0}° → ${d.rot||0}°`);
    if((o.on||'')!==(d.on||''))c.push('安裝位置（裝在哪台上）改變');
    if(JSON.stringify(o.jumpers||[])!==JSON.stringify(d.jumpers||[]))c.push('短路片改變');
    if(c.length)dev.chg.push({d,c});});
  const ek=(e)=>e.d+':'+e.t,wk=w=>[ek(w.a),ek(w.b)].sort().join('↔');
  const oW=new Map();O.wires.forEach(w=>{const k=wk(w);if(!oW.has(k))oW.set(k,[]);oW.get(k).push(w);});
  const wire={add:[],del:[],chg:[]};
  S.wires.forEach(w=>{const L=oW.get(wk(w));if(!L||!L.length){wire.add.push(w);return;}
    const i=Math.max(0,L.findIndex(o=>o.no===w.no)),o=L.splice(i,1)[0],c=[];
    if(o.no!==w.no)c.push(`線號 ${o.no} → ${w.no}`);if(+o.gauge!==+w.gauge)c.push(`線徑 ${o.gauge} → ${w.gauge}`);
    if(colorOf(o).n!==colorOf(w).n)c.push(`線色 ${colorOf(o).n} → ${colorOf(w).n}`);if((o.cab||'')!==(w.cab||''))c.push('所屬電纜改變');
    if(c.length)wire.chg.push({w,c});});
  oW.forEach(L=>L.forEach(w=>wire.del.push(w)));
  const oEp=e=>{const d=oDev.get(e.d);return `${d?d.tag:e.d}:${e.t}`;};
  return {dev,wire,oEp,oName,n:dev.add.length+dev.del.length+dev.chg.length+wire.add.length+wire.del.length+wire.chg.length};}
function diffLines(D){const L=[];
  D.dev.add.forEach(d=>L.push(['器具','新增',`${d.tag}（${tplOf(d).n}）`,'']));
  D.dev.del.forEach(d=>L.push(['器具','刪除',`${d.tag}（${D.oName(d)}）`,'']));
  D.dev.chg.forEach(x=>L.push(['器具','變更',`${x.d.tag}（${tplOf(x.d).n}）`,x.c.join('；')]));
  D.wire.add.forEach(w=>L.push(['導線','新增',`${w.no}：${epShort(w.a)} ↔ ${epShort(w.b)}`,'']));
  D.wire.del.forEach(w=>L.push(['導線','刪除',`${w.no}：${D.oEp(w.a)} ↔ ${D.oEp(w.b)}`,'']));
  D.wire.chg.forEach(x=>L.push(['導線','變更',`${x.w.no}：${epShort(x.w.a)} ↔ ${epShort(x.w.b)}`,x.c.join('；')]));
  return L;}
function diffSectionHtml(){
  let h=`<div class="bom-h">版本比較</div><p class="note">選一份之前的專案檔（舊版），跟目前的盤面比較：新增、刪除、變更的器具與導線。新增的在圖上標綠色、變更的標橘色；刪除的只列在清單。</p>
    <div class="row" style="justify-content:flex-start"><button class="tool" id="diffPick">選擇舊版專案檔…</button>${diffOld?'<button class="tool" id="diffClear">清除比較</button>':''}</div><input type="file" id="diffF" accept=".json,application/json" hidden>`;
  const D=diffCalc();if(!D)return h;
  const c=(a,b,x)=>`新增 ${a}、刪除 ${b}、變更 ${x}`;
  h+=`<p class="note">比較對象：<b>${esc(diffOld.name)}</b>（舊）→ 目前盤面<br>器具：${c(D.dev.add.length,D.dev.del.length,D.dev.chg.length)}<br>導線：${c(D.wire.add.length,D.wire.del.length,D.wire.chg.length)}</p>`;
  if(!D.n)return h+'<p class="note">兩份完全一樣。</p>';
  h+=`<div class="row" style="justify-content:flex-start"><label class="chk"><input type="checkbox" id="diffShow"${diffShow?' checked':''}> 在圖上標示</label><button class="tool" id="diffPrint">列印比較報告</button></div>`;
  h+=`<div class="diff-list">${diffLines(D).map(r=>`<div class="diff-it diff-${r[1]==='新增'?'add':r[1]==='刪除'?'del':'chg'}"><span>${r[0]}${r[1]}</span> ${esc(r[2])}${r[3]?`<small>${esc(r[3])}</small>`:''}</div>`).join('')}</div>`;
  return h;}
function diffSectionBind(){
  const f=$('diffF');if(!f)return;
  $('diffPick').onclick=()=>f.click();
  f.onchange=e=>{const file=e.target.files[0];e.target.value='';if(!file)return;const r=new FileReader();r.onerror=()=>toast('讀不到這個檔案');
    r.onload=()=>{let n=null;try{n=normalize(JSON.parse(r.result));}catch(_){}if(!n){toast('這不是配線專案檔');return;}diffOld={name:file.name,st:n.state};diffShow=true;renderTools();renderOverlay();toast('已載入舊版，比較結果在下方');};r.readAsText(file);};
  const c=$('diffClear');if(c)c.onclick=()=>{diffOld=null;renderTools();renderOverlay();};
  const s=$('diffShow');if(s)s.onchange=()=>{diffShow=s.checked;renderOverlay();};
  const p=$('diffPrint');if(p)p.onclick=()=>toolPrint('diff');}
// 圖上標示（renderOverlay 呼叫）
function diffOv(){if(!diffOld||!diffShow||mode==='sim')return '';const D=diffCalc();if(!D)return '';let h='';
  const box=(d,k)=>{const b=rectOf('dev',d);return `<rect class="diff-${k}" x="${b.x-3}" y="${b.y-3}" width="${b.w+6}" height="${b.h+6}" rx="3"/>`;};
  const line=(w,k)=>{const R=ROUTES.get(w.id);return R?`<path class="diff-w diff-${k}" d="${pathD(R.pts)}"/>`:'';};
  D.dev.add.forEach(d=>h+=box(d,'add'));D.dev.chg.forEach(x=>h+=box(x.d,'chg'));D.wire.add.forEach(w=>h+=line(w,'add'));D.wire.chg.forEach(x=>h+=line(x.w,'chg'));
  return `<g class="diff-ov">${h}</g>`;}
function diffPrintHtml(meta){const D=diffCalc();if(!D)return '<section class="pg"><p>沒有載入比較的舊版。</p></section>';
  return `<section class="pg"><div class="ph"><b>版本比較：${esc(diffOld.name)}（舊）→ 目前</b><span>${esc(meta)}</span></div>
    <p class="pnote">器具：新增 ${D.dev.add.length}、刪除 ${D.dev.del.length}、變更 ${D.dev.chg.length}；導線：新增 ${D.wire.add.length}、刪除 ${D.wire.del.length}、變更 ${D.wire.chg.length}。</p>
    ${tableHtml(['對象','異動','內容','說明'],diffLines(D))}</section>`;}

"use strict";
/* ---------- 模擬模式畫面 ----------
   有電的線依電位加光暈（＋紅、−藍、AC 橘），沒電的線變淡；有電流的迴路加流動的虛線。
   圖上按著按鈕、感測器才算按下（放開就放開）；點斷路器切換 ON／OFF。右側面板：斷路器、PLC Y（切換）、X 燈號、可操作的器具、動作中的器具（依類別分組）。 */
let simOv='';
const SIM_POT={p:'＋',n:'−',ac:'AC'};
// 滑鼠移到線上：這條線的電位
function simTip(w){const s=SIMST&&SIMST.res&&SIMST.res.wires[w.id];if(!s)return '';
  if(s.pot==='none')return '<br>沒電';
  const t=[...new Set((s.ls||[]).map(l=>{const [k,id,pole,v]=l.split('|');return k==='A'?`AC ${pole}（${tagOf(id)}）`:`${v||'DC'} ${pole==='+'?'＋':'−'}（${tagOf(id)}）`;}))];
  return `<br>${s.short?'<span class="flag">短路</span>　':''}${esc(t.join('、'))}${s.cur?'　有電流':''}`;}
// 重算並重畫
function simRefresh(){if(mode!=='sim')return;simRun();simPaint();renderDetail();}
function simPaint(){
  const r=SIMST&&SIMST.res;const g=$('wires');if(!g)return;g.classList.toggle('simon',!!r);if(!r){simOv='';return;}
  g.querySelectorAll('.wire').forEach(el=>{const w=r.wires[el.dataset.wid]||{pot:'none'};el.classList.toggle('live',w.pot!=='none');});
  // 光暈與電流畫在最上層
  let h='';const col={p:'#ff3b3b',n:'#3b7bff',ac:'#ff9a1f'};
  S.wires.forEach(w=>{const s=r.wires[w.id],R=ROUTES.get(w.id);if(!s||s.pot==='none'||!R)return;const d=pathD(R.pts),c=s.short?'#ff2bd6':col[s.pot];
    h+=`<path class="sim-glow" d="${d}" style="stroke:${c}"/>`;if(s.cur)h+=`<path class="sim-cur" d="${d}" style="stroke:${c}"/>`;});
  h+=lookSim(SIMST);
  h+=pracOv(); // 故障排除練習：公布的答案 // 實體圖：把手 ON／OFF、漏電指示、按鈕按下、選擇開關位置
  // 器具：動作中綠框、極性相反橘框、按著藍框
  S.devices.forEach(d=>{const s=r.dev[d.id],b=rectOf('dev',d),pr=[...SIMST.press].some(k=>k.startsWith(d.id+'|')),brk=simElems(d).some(e=>e.k==='brk');const tr=SIMST.trip&&SIMST.trip[d.id];
    const cls=s&&s.rev.length?'rev':pr||tr?'press':(s&&(s.coil||s.latch||s.on.length))?'on':brk&&!SIMST.on[d.id]?'brkoff':null;if(!cls)return;
    h+=`<rect class="sim-dev ${cls}" x="${b.x-2}" y="${b.y-2}" width="${b.w+4}" height="${b.h+4}" rx="3"/>`;
    if(cls==='rev')h+=`<text class="sim-lab rev" x="${b.x+b.w/2}" y="${b.y-4}" text-anchor="middle">極性相反</text>`;
    if(cls==='brkoff')h+=`<text class="sim-lab off" x="${b.x+b.w/2}" y="${b.y-4}" text-anchor="middle">OFF</text>`;});
  // PLC 輸入、輸出點：ON 的點畫一個圓點
  [...r.X.filter(x=>x.on).map(x=>[x,'x']),...r.Y.filter(y=>y.on).map(y=>[{d:y.d,t:y.y},'y'])].forEach(([x,k])=>{const e=termOf(x.d,x.t);if(!e)return;const p=endpoint({d:x.d.id,t:x.t},0);h+=`<circle class="sim-io ${k}" cx="${p.x}" cy="${p.y}" r="2.6"/>`;});
  simOv=h;renderOverlay();
}
// 圖上操作：器具有斷路器就切換；有按鈕、感測器就按著（多個按鈕時取離游標最近的那個接點所屬的按鈕）
function simPointerDown(e,p){
  // 依位置找器具（導線蓋在器具上面也點得到）：可以操作的器具優先，同樣時取面積小的（例如裝在接觸器上的附件）
  const under=S.devices.filter(x=>inR(p,rectOf('dev',x))).sort((a,b)=>{const oa=simElems(a).some(e=>e.btn||e.k==='brk'||e.by==='trip')?0:1,ob=simElems(b).some(e=>e.btn||e.k==='brk'||e.by==='trip')?0:1;if(oa!==ob)return oa-ob;const ra=rectOf('dev',a),rb=rectOf('dev',b);return ra.w*ra.h-rb.w*rb.h;});
  let d=under[0]||null;
  // 點到裝在操作部上的接點塊：當成點操作部
  if(d&&d.on&&tplOf(d).rackKind&&devOf(d.on)&&tplOf(devOf(d.on)).op)d=devOf(d.on);
  if(!d){act={t:'press',sx:e.clientX,sy:e.clientY,vx:view.x,vy:view.y,moved:false,btn:e.button,id:e.pointerId,target:e.target,pan:true};svg.setPointerCapture(e.pointerId);return;}
  const els=simElems(d);
  if(els.some(x=>x.k==='brk')){brkClick(d.id);return;}
  const op=tplOf(d).op;
  if(op&&op.k==='alt'){SIMST.on[d.id]=!SIMST.on[d.id];simRefresh();return;}
  if(op&&op.k==='sel'){const R=rectOf('dev',d),left=p.x<R.x+R.w/2,side=left?'L':'R',cur=SIMST.sel[d.id]||op.def,spring=(op.ret||'').includes(side);
    // 3 位置：點左半邊切到 L（已在 L 就回 C），右半邊同理；有彈簧的那一邊按著才在那個位置。2 位置：L／R 兩個位置
    const next=op.n===3?(cur===side&&!spring?'C':side):side,back=spring?(op.n===3?'C':op.def):null;
    SIMST.sel[d.id]=next;simRefresh();if(back){act={t:'simsel',id:d.id,back,pid:e.pointerId,sx:e.clientX,sy:e.clientY,moved:false};try{svg.setPointerCapture(e.pointerId);}catch(_){}}return;}
  if(els.some(x=>x.by==='trip')&&d.thReset!=='auto'){SIMST.trip[d.id]=!SIMST.trip[d.id];simRefresh();return;}
  const btns=[...new Set(els.filter(x=>x.btn).map(x=>x.btn))];if(!btns.length){act={t:'press',sx:e.clientX,sy:e.clientY,vx:view.x,vy:view.y,moved:false,btn:e.button,id:e.pointerId,target:e.target,pan:true};svg.setPointerCapture(e.pointerId);return;}
  let btn=btns[0];
  if(btns.length>1){let bd=Infinity;els.filter(x=>x.btn).forEach(x=>[x.a,x.b,x.out].filter(Boolean).forEach(t=>{if(!termOf(d,t))return;const q=endpoint({d:d.id,t},0),dd=Math.hypot(q.x-p.x,q.y-p.y);if(dd<bd&&btns.filter(b=>els.some(y=>y.btn===b&&(y.a===t||y.b===t||y.out===t))).length===1){bd=dd;btn=x.btn;}}));}
  simPress(d.id,btn,true);act={t:'simpress',key:d.id+'|'+btn,id:e.pointerId,sx:e.clientX,sy:e.clientY,moved:false};svg.setPointerCapture(e.pointerId);
}
function simPress(id,btn,on){const k=id+'|'+btn;if(on)SIMST.press.add(k);else SIMST.press.delete(k);simRefresh();}
// 右側面板
function simPanel(box){
  box.hidden=false;const r=SIMST.res||simRun();
  const brks=S.devices.filter(d=>simElems(d).some(e=>e.k==='brk')).sort((a,b)=>natCmp(a.tag,b.tag));
  const opE=d=>simElems(d).filter(e=>e.btn&&(e.by!=='trip'||d.thReset==='auto'));
  const ops=S.devices.filter(d=>opE(d).length).sort((a,b)=>natCmp(a.tag,b.tag));
  const alts=S.devices.filter(d=>(tplOf(d).op||{}).k==='alt').sort((a,b)=>natCmp(a.tag,b.tag)),sels=S.devices.filter(d=>(tplOf(d).op||{}).k==='sel').sort((a,b)=>natCmp(a.tag,b.tag));
  const ths=S.devices.filter(d=>d.thReset!=='auto'&&simElems(d).some(e=>e.by==='trip')).sort((a,b)=>natCmp(a.tag,b.tag));
  const Y=r.Y.filter(y=>y.wired),X=r.X.filter(x=>S.wires.some(w=>wiredAt(w,x.d.id,x.t)));
  // 動作中：依器具類別分組（順序同材料表），組內照編號自然排序
  const actG=new Map();Object.entries(r.dev).filter(([id,s])=>(s.coil||s.latch||s.on.length)&&devOf(id)).forEach(([id,s])=>{const d=devOf(id),c=(resolveTpl(d.tpl,d.count)||{}).cat||'其他';if(!actG.has(c))actG.set(c,[]);
    actG.get(c).push({tag:d.tag,txt:s.coil?'線圈':s.latch?'保持':s.on.join('＋')});});
  const ord=CAT_ORDER(),actH=[...actG.entries()].sort((a,b)=>(ord.indexOf(a[0])+1||99)-(ord.indexOf(b[0])+1||99)).map(([c,L])=>`<div class="act-g"><span class="act-c">${esc(c)}</span><div class="sim-chips">${L.sort((a,b)=>natCmp(a.tag,b.tag)).map(x=>`<span class="sim-chip on act">${esc(x.tag)} <small>${esc(x.txt)}</small></span>`).join('')}</div></div>`).join('');
  const np=(r.nopwr||[]).filter(x=>x.d.on||S.wires.some(w=>w.a.d===x.d.id||w.b.d===x.d.id));
  const rev=Object.entries(r.dev).filter(([id,s])=>s.rev.length).map(([id,s])=>esc(tagOf(id)));
  const msg=[r.shorts?`<p class="sim-bad">短路 ${r.shorts} 處（桃紅色的線），請檢查配線</p>`:'',r.unstable?'<p class="sim-bad">迴路一直切換停不下來（不穩定），可能是自我保持或互鎖接錯</p>':'',rev.length?`<p class="sim-warn">極性相反：${rev.join('、')}</p>`:'',...r.warn.map(t=>`<p class="sim-warn">${esc(t)}</p>`),np.length?`<p class="sim-warn">模組沒電（輸入輸出不動作）：${np.map(x=>`${esc(x.d.tag)}（${esc(x.why)}）`).join('、')}</p>`:''].join('');
  const noSim=S.devices.filter(d=>!hasSim(d)&&S.wires.some(w=>w.a.d===d.id||w.b.d===d.id)&&!['端子台／接地'].includes((resolveTpl(d.tpl,d.count)||{}).cat)).map(d=>d.tag);
  box.innerHTML=`<div class="big">模擬</div><p class="note">圖上按著按鈕、感測器才算按下；點斷路器切換 ON／OFF。有電的線：＋紅、−藍、AC 橘；流動的虛線是有電流的迴路。</p>${msg}
  <div class="sub-h">斷路器</div><div class="sim-chips">${brks.map(d=>`<button class="sim-chip${SIMST.on[d.id]?' on':''}${SIMST.btrip&&SIMST.btrip[d.id]?' trip':''}" data-sim-brk="${d.id}">${esc(d.tag)}${SIMST.btrip&&SIMST.btrip[d.id]?(SIMST.btrip[d.id]==='el'?' 漏電跳脫（點一下復歸）':' 跳脫（點一下復歸）'):''}</button>`).join('')}</div>
  ${alts.length?`<div class="sub-h">保持型開關（點一下切換）</div><div class="sim-chips">${alts.map(d=>`<button class="sim-chip${SIMST.on[d.id]?' on':''}" data-sim-alt="${d.id}">${esc(d.tag)}${SIMST.on[d.id]?' 動作中':''}</button>`).join('')}</div>`:''}
  ${sels.length?`<div class="sub-h">選擇開關（圖上點左半邊／右半邊切換）</div><div class="sim-chips">${sels.map(d=>{const op=tplOf(d).op,cur=SIMST.sel[d.id]||op.def;return (op.n===3?['L','C','R']:['L','R']).map(q=>`<button class="sim-chip${cur===q?' on':''}" data-sim-sel="${d.id}|${q}">${esc(d.tag)} ${q}</button>`).join('');}).join('')}</div>`:''}
  ${ths.length?`<div class="sub-h">積熱電驛（點一下跳脫／復歸）</div><div class="sim-chips">${ths.map(d=>`<button class="sim-chip${SIMST.trip[d.id]?' on':''}" data-sim-trip="${d.id}">${esc(d.tag)}${SIMST.trip[d.id]?' 跳脫中':''}</button>`).join('')}</div>`:''}
  <div class="row" style="justify-content:flex-start"><button class="tool" data-sim-all="1">全部 ON</button><button class="tool" data-sim-all="0">全部 OFF</button><button class="tool" id="simReset">全部重置</button></div>
  ${Y.length?`<div class="sub-h">PLC 輸出（點一下切換）</div><div class="sim-chips">${Y.map(y=>`<button class="sim-chip y${y.on?' on':''}${y.nopwr?' nopwr':''}"${y.nopwr?' title="模組沒電，輸出不動作"':''} data-sim-y="${y.d.id}|${y.y}">${esc(y.name)}</button>`).join('')}</div>`:''}
  ${X.length?`<div class="sub-h">PLC 輸入</div><div class="sim-chips">${X.map(x=>`<span class="sim-chip x${x.on?' on':''}${x.nopwr?' nopwr':''}"${x.nopwr?' title="模組沒電，輸入不動作"':''}>${esc(x.name)}</span>`).join('')}</div>`:''}
  ${ops.length?`<div class="sub-h">按著操作</div><div class="sim-chips">${ops.flatMap(d=>[...new Set(opE(d).map(e=>e.btn))].map(b=>`<button class="sim-chip op${SIMST.press.has(d.id+'|'+b)?' on':''}" data-sim-op="${d.id}|${b}">${esc(d.tag)} ${esc(b)}</button>`)).join('')}</div>`:''}
  <div class="sub-h">動作中</div>${actH||'<p class="note">沒有</p>'}
  ${pracHtml()}
  ${(()=>{const cu=S.devices.filter(d=>S.tpls&&S.tpls[d.tpl]).map(d=>d.tag);return cu.length?`<p class="note cus-note">用到自訂器具（未核對，結果以你設定的模擬動作為準）：${esc(cu.join('、'))}</p>`:'';})()}
  ${noSim.length?`<p class="note">沒有動作資料、模擬時只當導線的器具：${esc(noSim.join('、'))}</p>`:''}`;
}
document.addEventListener('pointerdown',e=>{if(mode!=='sim')return;const b=e.target.closest&&e.target.closest('[data-sim-op]');if(!b)return;const [id,btn]=b.dataset.simOp.split('|');simPress(id,btn,true);
  const up=()=>{simPress(id,btn,false);document.removeEventListener('pointerup',up);document.removeEventListener('pointercancel',up);};document.addEventListener('pointerup',up);document.addEventListener('pointercancel',up);});
document.addEventListener('click',e=>{if(mode!=='sim')return;const t=e.target;
  const tg=t.closest&&t.closest('[data-sim-alt]');if(tg){SIMST.on[tg.dataset.simAlt]=!SIMST.on[tg.dataset.simAlt];simRefresh();return;}
  const se=t.closest&&t.closest('[data-sim-sel]');if(se){const [id,q]=se.dataset.simSel.split('|');SIMST.sel[id]=q;simRefresh();return;}
  const tp=t.closest&&t.closest('[data-sim-trip]');if(tp){SIMST.trip[tp.dataset.simTrip]=!SIMST.trip[tp.dataset.simTrip];simRefresh();return;}
  const bk=t.closest&&t.closest('[data-sim-brk]');if(bk){brkClick(bk.dataset.simBrk);return;}
  const al=t.closest&&t.closest('[data-sim-all]');if(al){S.devices.filter(d=>simElems(d).some(x=>x.k==='brk')).forEach(d=>{SIMST.on[d.id]=al.dataset.simAll==='1';if(SIMST.btrip)delete SIMST.btrip[d.id];});simRefresh();return;}
  const y=t.closest&&t.closest('[data-sim-y]');if(y){const k=y.dataset.simY;if(SIMST.y.has(k))SIMST.y.delete(k);else SIMST.y.add(k);simRefresh();return;}
  if(t.id==='simReset'){simReset();simRefresh();return;}
});
// 進出模擬模式
function simEnter(){simReset();simRun();}
function simLeave(){simFault=null;simPrac=null;SIMST=null;simOv='';const g=$('wires');if(g)g.classList.remove('simon');}

// 斷路器：跳脫中點一下是復歸（還是 OFF），再點一下才 ON
function brkClick(id){if(SIMST.btrip&&SIMST.btrip[id]){delete SIMST.btrip[id];SIMST.on[id]=false;toast(`${tagOf(id)} 已復歸，再點一下 ON`);}else SIMST.on[id]=!SIMST.on[id];simRefresh();}

/* ---------- 故障排除練習 ----------
   隨機在「會影響動作」的地方放一個故障：斷線（最壞情況下有電流的線）、線圈燒毀（會被送電的線圈）、
   接點熔著（線圈帶動的常開接點）、接點接觸不良（按鈕的常開接點）。操作模擬找出來，再從清單選答案；可以公布答案。 */
const FAULT_K={wire:'斷線',coil:'線圈燒毀（有電也不吸合）',weld:'接點熔著（一直閉合）',open:'接點接觸不良（按了也不通）'};
let simPrac=null; // {tries, done, show, hint:{sc,step,L,kind}, hints, level}
function faultCands(){
  const save=SIMST,F=simFault;let r;try{simFault=null;SIMST=null;simReset();SIMST.all=true;r=simRun();}finally{SIMST=save;simFault=F;}
  const wired=(d,t)=>S.wires.some(w=>wiredAt(w,d.id,t));
  const C={wire:S.wires.filter(w=>r.wires[w.id]&&r.wires[w.id].cur).map(w=>({k:'wire',id:w.id})),coil:[],weld:[],open:[]};
  const fedCoil=new Set(r.loads.filter(l=>l.e.k==='coil'&&l.on).map(l=>l.e.d.id));
  S.devices.forEach(d=>{const els=simElems(d);
    if(fedCoil.has(d.id)&&els.some(e=>e.k==='coil'))C.coil.push({k:'coil',d:d.id});
    els.forEach(e=>{if(e.k!=='sw'||e.nc||!wired(d,e.a)||!wired(d,e.b))return;
      if(e.by==='coil'&&fedCoil.has(d.id))C.weld.push({k:'weld',d:d.id,a:e.a,b:e.b});
      if(e.by==='btn')C.open.push({k:'open',d:d.id,a:e.a,b:e.b});});});
  return C;}
/* 出題要「看得出來」：用一般操作（斷路器全部 ON，再逐一按按鈕、切開關、開 PLC 輸出、讓熱電驛跳脫）
   比較有故障與沒故障的結果。簡單：要有器具動作或 PLC 輸入不同；進階：只差某條線有沒有電、有沒有電流也算（要量電壓才找得到）。
   第一個看得出差異的操作與差異內容，當作提示 */
let pracLevel='easy';
function pracScenarios(){
  const out=[{txt:'斷路器全部 ON',act:null}];
  S.devices.forEach(d=>{const els=simElems(d),op=tplOf(d).op;
    [...new Set(els.filter(e=>e.btn&&(e.by!=='trip'||d.thReset==='auto')).map(e=>e.btn))].forEach(b=>out.push({txt:`按著 ${d.tag} ${b}`,act:st=>st.press.add(d.id+'|'+b),rel:st=>st.press.delete(d.id+'|'+b),relTxt:`按 ${d.tag} ${b} 再放開`}));
    if(op&&op.k==='alt')out.push({txt:`${d.tag} 切換`,act:st=>{st.on[d.id]=true;}});
    if(op&&op.k==='sel')(op.n===3?['L','C','R']:['L','R']).filter(q=>q!==op.def).forEach(q=>out.push({txt:`${d.tag} 切到 ${q}`,act:st=>{st.sel[d.id]=q;}}));
    if(d.thReset!=='auto'&&els.some(e=>e.by==='trip'))out.push({txt:`${d.tag} 跳脫`,act:st=>{st.trip[d.id]=true;}});
    els.filter(e=>e.k==='plcY').forEach(e=>e.pairs.forEach(([y])=>{if(S.wires.some(w=>wiredAt(w,d.id,y)))out.push({txt:`PLC 輸出 ${typeof chainName==='function'&&chainName(d,y)||(qName&&qName(d,y))||(e.cpu?y:d.tag+' '+y)} ON`,act:st=>st.y.add(d.id+'|'+y)});}));});
  return out;}
// 一個操作的結果：每一步的器具狀態、PLC 輸入、線的電位與電流
function pracRun(sc,F){
  const save=SIMST,F0=simFault,snaps=[];
  try{simFault=F;SIMST=null;simReset();const st=SIMST;S.devices.forEach(d=>{if(simElems(d).some(e=>e.k==='brk'))st.on[d.id]=true;});
    const snap=(txt)=>{const r=simRun(),dv={},x={},w={};
      S.devices.forEach(d=>{const q=r.dev[d.id];const on=q?[...(q.coil?['吸合']:[]),...(q.latch?['保持']:[]),...q.on.filter(n=>n!=='線圈'||!q.coil).map(n=>n==='線圈'?'線圈有電但沒吸合':n)]:[];dv[d.id]=on.length?on.join('＋'):'';});
      Object.keys(st.btrip||{}).forEach(id=>{if(st.btrip[id])dv[id]=(dv[id]?dv[id]+'＋':'')+'跳脫';});
      r.X.forEach(q=>{x[q.d.id+'|'+q.t]=q.on?q.name:'';});
      S.wires.forEach(q=>{const v=r.wires[q.id];w[q.id]=v?(v.pot==='none'?'':'有電')+(v.cur?'＋有電流':''):'';});
      snaps.push({txt,dv,x,w});};
    snap('斷路器全部 ON');
    if(sc.act){sc.act(st);snap(sc.txt);if(sc.rel){sc.rel(st);snap(sc.relTxt);}}
  }finally{SIMST=save;simFault=F0;}
  return snaps;}
const pracDescDev=v=>v||'不動作';
function pracDiff(A,B,level,skip){ // skip：斷線那一條本身不列進提示（不然直接洩題）
  for(let i=0;i<A.length;i++){const a=A[i],b=B[i],L=[];
    Object.keys(a.dv).forEach(id=>{if(a.dv[id]!==b.dv[id])L.push(`${tagOf(id)} 應該「${pracDescDev(a.dv[id])}」，實際「${pracDescDev(b.dv[id])}」`);});
    Object.keys(a.x).forEach(k=>{if(a.x[k]!==b.x[k])L.push(`輸入 ${a.x[k]||b.x[k]} 應該 ${a.x[k]?'ON':'OFF'}，實際 ${b.x[k]?'ON':'OFF'}`);});
    if(L.length)return {step:a.txt,L,kind:'dev'};
    if(level==='hard'){const W=[];Object.keys(a.w).forEach(id=>{if(a.w[id]!==b.w[id]&&!(skip&&id===skip)){const w=S.wires.find(q=>q.id===id);W.push(`線號 ${w?w.no:'?'} 應該「${a.w[id]||'沒電'}」，實際「${b.w[id]||'沒電'}」`);}});
      if(W.length)return {step:a.txt,L:W,kind:'wire'};}}
  return null;}
function pracStart(){
  const C=faultCands(),ks=Object.keys(C).filter(k=>C[k].length);if(!ks.length){toast('沒有可以出題的迴路（先把線圈、按鈕接好）');return;}
  const SC=pracScenarios(),base=SC.map(sc=>pracRun(sc,null)),t0=performance.now(),shuf=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
  let pick=null,tried=0;
  for(const k of shuf(ks)){for(const F of shuf(C[k])){if(performance.now()-t0>4000)break;tried++;
      for(let i=0;i<SC.length;i++){const d=pracDiff(base[i],pracRun(SC[i],F),pracLevel,F.k==='wire'?F.id:null);if(d){pick={F,hint:{...d,sc:SC[i].txt}};break;}}
      if(pick)break;}if(pick||performance.now()-t0>4000)break;}
  if(!pick){toast(pracLevel==='easy'?'找不到操作時看得出來的故障，可以改選「進階」再試':'找不到操作時看得出來的故障');return;}
  simFault=pick.F;simPrac={tries:0,done:false,show:false,hint:pick.hint,hints:0,level:pracLevel};
  simReset();simRefresh();toast('已出題：有一個地方故障，操作看看哪裡不對');}
function pracEnd(){simFault=null;simPrac=null;simRefresh();}
function faultText(F){if(!F)return '';if(F.k==='wire'){const w=S.wires.find(x=>x.id===F.id);return `線號 ${w?w.no:'?'}（${w?epShort(w.a)+' ↔ '+epShort(w.b):''}）斷線`;}
  const d=devOf(F.d);return `${d?d.tag:'?'} ${F.k==='coil'?'線圈燒毀':`${termLabel(d,F.a)}-${termLabel(d,F.b)} ${F.k==='weld'?'接點熔著':'接點接觸不良'}`}`;}
function pracGuess(k,target){if(!simPrac||!simFault)return;simPrac.tries++;
  const ok=k===simFault.k&&(k==='wire'?target===simFault.id:target===simFault.d);
  if(ok){simPrac.done=true;simPrac.show=true;toast(`答對了！${faultText(simFault)}（猜了 ${simPrac.tries} 次）`);}
  else toast(k===simFault.k?'故障種類對了，位置不對':'不對，再找找看');simRefresh();}
function pracHtml(){
  const lv=`<select id="pracLv" title="簡單：操作時有器具該動沒動或不該動卻動；進階：可能只有某條線有沒有電不同（要量電壓）"><option value="easy"${pracLevel==='easy'?' selected':''}>簡單</option><option value="hard"${pracLevel==='hard'?' selected':''}>進階</option></select>`;
  if(!simFault||!simPrac)return `<div class="sub-h">故障排除練習</div><p class="note">隨機放一個故障（斷線、線圈燒毀、接點熔著、接點接觸不良），用模擬操作找出來。只會出「一般操作看得出異常」的題目：簡單＝有器具該動沒動或不該動卻動；進階＝也可能只差某條線有沒有電（要量電壓）。</p><div class="row" style="justify-content:flex-start">難度 ${lv}<button class="tool" id="pracStart">隨機出題</button></div>`;
  const H=simPrac.hint,hs=[];if(H&&simPrac.hints>=1)hs.push(`症狀：${H.step==='斷路器全部 ON'?H.step+' ':'斷路器全部 ON 後'+H.step} 時，${H.L.slice(0,3).join('；')}${H.L.length>3?` 等 ${H.L.length} 處`:''}`);
  if(simPrac.hints>=2)hs.push(`故障種類：${FAULT_K[simFault.k]}`);
  const opts=k=>k==='wire'?[...S.wires].sort((a,b)=>natCmp(a.no,b.no)).map(w=>`<option value="${w.id}">線號 ${esc(w.no)}</option>`).join(''):[...S.devices].filter(d=>simElems(d).some(e=>k==='coil'?e.k==='coil':e.k==='sw')).sort((a,b)=>natCmp(a.tag,b.tag)).map(d=>`<option value="${d.id}">${esc(d.tag)}</option>`).join('');
  const k0=$('pracK')?$('pracK').value:'wire';
  return `<div class="sub-h">故障排除練習</div>
    ${simPrac.show?`<p class="${simPrac.done?'sim-ok':'sim-warn'}">答案：${esc(faultText(simFault))}（圖上桃紅色虛線框）</p>`:`<p class="note">有一個地方故障（${simPrac.level==='hard'?'進階':'簡單'}）。操作模擬、看哪裡該動沒動或不該動卻動了，再選答案。已猜 ${simPrac.tries} 次。</p>${hs.map(t=>`<p class="sim-hint">提示：${esc(t)}</p>`).join('')}
    <div class="row prac-row" style="justify-content:flex-start"><select id="pracK">${Object.entries(FAULT_K).map(([k,t])=>`<option value="${k}"${k===k0?' selected':''}>${t}</option>`).join('')}</select><select id="pracT">${opts(k0)}</select><button class="tool" id="pracGuess">就是這裡</button></div>`}
    <div class="row" style="justify-content:flex-start">${simPrac.show?'':`${simPrac.hints<2?`<button class="tool" id="pracHint">${simPrac.hints?'再一個提示':'給提示'}</button>`:''}<button class="tool" id="pracShow">公布答案</button>`}<button class="tool" id="pracStart">換一題</button><button class="tool" id="pracEnd">結束練習</button></div>`;}
// 答案在圖上標出來
function pracOv(){if(!simPrac||!simPrac.show||!simFault)return '';const F=simFault;
  if(F.k==='wire'){const R=ROUTES.get(F.id);return R?`<path class="prac-ans" d="${pathD(R.pts)}"/>`:'';}
  const d=devOf(F.d);if(!d)return '';const b=rectOf('dev',d);return `<rect class="prac-ans" x="${b.x-5}" y="${b.y-5}" width="${b.w+10}" height="${b.h+10}" rx="4"/>`;}
document.addEventListener('click',e=>{if(mode!=='sim')return;const id=e.target&&e.target.id;
  if(id==='pracStart')pracStart();else if(id==='pracEnd')pracEnd();else if(id==='pracShow'){simPrac.show=true;simRefresh();}
  else if(id==='pracHint'){simPrac.hints++;simRefresh();}
  else if(id==='pracGuess')pracGuess($('pracK').value,$('pracT').value);});
document.addEventListener('change',e=>{if(mode!=='sim'||!e.target)return;if(e.target.id==='pracK')renderDetail();if(e.target.id==='pracLv')pracLevel=e.target.value;});

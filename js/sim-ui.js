"use strict";
/* ---------- 模擬模式畫面 ----------
   有電的線依電位加光暈（＋紅、−藍、AC 橘），沒電的線變淡；有電流的迴路加流動的虛線。
   圖上按著按鈕、感測器才算按下（放開就放開）；點斷路器切換 ON／OFF。右側面板：斷路器、PLC Y（切換）、X 燈號、可操作的器具、自動測試。 */
let simOv='',simTest=null;
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
  const act=Object.entries(r.dev).filter(([id,s])=>s.coil||s.latch||s.on.length).map(([id,s])=>`${esc(tagOf(id))}${s.coil?'（線圈）':s.latch?'（保持）':'（'+esc(s.on.join('、'))+'）'}`);
  const np=(r.nopwr||[]).filter(x=>x.d.on||S.wires.some(w=>w.a.d===x.d.id||w.b.d===x.d.id));
  const rev=Object.entries(r.dev).filter(([id,s])=>s.rev.length).map(([id,s])=>esc(tagOf(id)));
  const msg=[r.shorts?`<p class="sim-bad">短路 ${r.shorts} 處（桃紅色的線），請檢查配線</p>`:'',r.unstable?'<p class="sim-bad">迴路一直切換停不下來（不穩定），可能是自我保持或互鎖接錯</p>':'',rev.length?`<p class="sim-warn">極性相反：${rev.join('、')}</p>`:'',...r.warn.map(t=>`<p class="sim-warn">${esc(t)}</p>`),np.length?`<p class="sim-warn">模組沒電（輸入輸出不動作）：${np.map(x=>`${esc(x.d.tag)}（${esc(x.why)}）`).join('、')}</p>`:''].join('');
  const noSim=S.devices.filter(d=>!hasSim(d)&&S.wires.some(w=>w.a.d===d.id||w.b.d===d.id)&&!['端子台／接地'].includes((resolveTpl(d.tpl,d.count)||{}).cat)).map(d=>d.tag);
  box.innerHTML=`<div class="big">模擬</div><p class="note">圖上按著按鈕、感測器才算按下；點斷路器切換 ON／OFF。有電的線：＋紅、−藍、AC 橘；流動的虛線是有電流的迴路。</p>${msg}
  <div class="sub-h">斷路器</div><div class="sim-chips">${brks.map(d=>`<button class="sim-chip${SIMST.on[d.id]?' on':''}${SIMST.btrip&&SIMST.btrip[d.id]?' trip':''}" data-sim-brk="${d.id}">${esc(d.tag)}${SIMST.btrip&&SIMST.btrip[d.id]?' 跳脫（點一下復歸）':''}</button>`).join('')}</div>
  ${alts.length?`<div class="sub-h">保持型開關（點一下切換）</div><div class="sim-chips">${alts.map(d=>`<button class="sim-chip${SIMST.on[d.id]?' on':''}" data-sim-alt="${d.id}">${esc(d.tag)}${SIMST.on[d.id]?' 動作中':''}</button>`).join('')}</div>`:''}
  ${sels.length?`<div class="sub-h">選擇開關（圖上點左半邊／右半邊切換）</div><div class="sim-chips">${sels.map(d=>{const op=tplOf(d).op,cur=SIMST.sel[d.id]||op.def;return (op.n===3?['L','C','R']:['L','R']).map(q=>`<button class="sim-chip${cur===q?' on':''}" data-sim-sel="${d.id}|${q}">${esc(d.tag)} ${q}</button>`).join('');}).join('')}</div>`:''}
  ${ths.length?`<div class="sub-h">積熱電驛（點一下跳脫／復歸）</div><div class="sim-chips">${ths.map(d=>`<button class="sim-chip${SIMST.trip[d.id]?' on':''}" data-sim-trip="${d.id}">${esc(d.tag)}${SIMST.trip[d.id]?' 跳脫中':''}</button>`).join('')}</div>`:''}
  <div class="row" style="justify-content:flex-start"><button class="tool" data-sim-all="1">全部 ON</button><button class="tool" data-sim-all="0">全部 OFF</button><button class="tool" id="simReset">全部重置</button></div>
  ${Y.length?`<div class="sub-h">PLC 輸出（點一下切換）</div><div class="sim-chips">${Y.map(y=>`<button class="sim-chip y${y.on?' on':''}${y.nopwr?' nopwr':''}"${y.nopwr?' title="模組沒電，輸出不動作"':''} data-sim-y="${y.d.id}|${y.y}">${esc(y.name)}</button>`).join('')}</div>`:''}
  ${X.length?`<div class="sub-h">PLC 輸入</div><div class="sim-chips">${X.map(x=>`<span class="sim-chip x${x.on?' on':''}${x.nopwr?' nopwr':''}"${x.nopwr?' title="模組沒電，輸入不動作"':''}>${esc(x.name)}</span>`).join('')}</div>`:''}
  ${ops.length?`<div class="sub-h">按著操作</div><div class="sim-chips">${ops.flatMap(d=>[...new Set(opE(d).map(e=>e.btn))].map(b=>`<button class="sim-chip op${SIMST.press.has(d.id+'|'+b)?' on':''}" data-sim-op="${d.id}|${b}">${esc(d.tag)} ${esc(b)}</button>`)).join('')}</div>`:''}
  <div class="sub-h">動作中</div><p class="note">${act.join('、')||'沒有'}</p>
  <div class="sub-h">自動測試</div><div class="row" style="justify-content:flex-start"><button class="tool" id="simTestY">Y 輸出逐點測試</button><button class="tool" id="simTestX">輸入逐點測試</button></div>
  ${simTest?simTestHtml():''}
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
  if(t.id==='simReset'){simReset();simTest=null;simRefresh();return;}
  if(t.id==='simTestY'){simTest=simAutoY();simRefresh();return;}
  if(t.id==='simTestX'){simTest=simAutoX();simRefresh();return;}
  if(t.id==='simTestCsv'){simTestCsv();return;}
  if(t.id==='simTestPrint'){printSimTest();return;}
  if(t.id==='simTestClose'){simTest=null;renderDetail();return;}});
// 進出模擬模式
function simEnter(){simReset();simTest=null;simRun();}
function simLeave(){SIMST=null;simOv='';simTest=null;const g=$('wires');if(g)g.classList.remove('simon');}

/* ---------- 自動測試 ----------
   以目前的斷路器與自我保持狀態為起點（建議先把斷路器打開、按過啟動），Y 全部 OFF、不按任何東西，逐一測試後恢復原狀。 */
const simSnap=()=>({on:{...SIMST.on},press:new Set(SIMST.press),y:new Set(SIMST.y),coil:{...SIMST.coil},latch:{...SIMST.latch},trip:{...(SIMST.trip||{})},btrip:{...(SIMST.btrip||{})},sel:{...(SIMST.sel||{})}});
const simRestore=s=>{Object.assign(SIMST,{on:{...s.on},press:new Set(s.press),y:new Set(s.y),coil:{...s.coil},latch:{...s.latch},trip:{...(s.trip||{})},btrip:{...(s.btrip||{})},sel:{...(s.sel||{})}});};
const actSet=r=>{const m=new Map();Object.entries(r.dev).forEach(([id,s])=>{const n=[s.coil?'線圈':null,s.latch?'保持':null,...s.on.filter(x=>x!=='線圈')].filter(Boolean);if(n.length)m.set(id,n.join('、'));});return m;};
function simAutoY(){
  const s1=simSnap();SIMST.y=new Set();SIMST.press=new Set();simRun();const s0=simSnap(),r0=simRun(),base=actSet(r0),rows=[];
  r0.Y.filter(y=>y.wired).forEach(y=>{simRestore(s0);SIMST.y.add(y.d.id+'|'+y.y);const r=simRun(),now=actSet(r);
    const on=[...now].filter(([id,v])=>base.get(id)!==v).map(([id,v])=>`${tagOf(id)}（${v}）`),off=[...base.keys()].filter(id=>!now.has(id)).map(id=>tagOf(id));
    rows.push([y.name,on.join('、')||'—',off.join('、'),r.shorts?'短路':r.unstable?'不穩定':'']);});
  simRestore(s1);simRun();
  return {k:'Y',head:['輸出','ON 後動作','ON 後停止','異常'],rows,note:r0.X.length&&!Object.keys(s0.on).some(k=>s0.on[k])?'斷路器都是 OFF，結果可能都沒有動作；請先打開斷路器、按過啟動再測。':''};
}
function simAutoX(){
  const s1=simSnap();SIMST.press=new Set();simRun();const s0=simSnap(),r0=simRun(),base=new Set(r0.X.filter(x=>x.on).map(x=>x.name)),rows=[];
  S.devices.filter(d=>simElems(d).some(e=>e.btn)).sort((a,b)=>natCmp(a.tag,b.tag)).forEach(d=>[...new Set(simElems(d).filter(e=>e.btn).map(e=>e.btn))].forEach(b=>{
    simRestore(s0);SIMST.press.add(d.id+'|'+b);const r=simRun(),now=new Set(r.X.filter(x=>x.on).map(x=>x.name));
    const on=[...now].filter(x=>!base.has(x)),off=[...base].filter(x=>!now.has(x));
    rows.push([`${d.tag} ${b}`,on.join('、')||'—',off.join('、'),r.shorts?'短路':r.unstable?'不穩定':'']);}));
  simRestore(s1);simRun();
  return {k:'X',head:['操作','變成 ON 的輸入','變成 OFF 的輸入','異常'],rows,note:base.size?`起始已經 ON 的輸入：${[...base].join('、')}`:''};
}
function simTestHtml(){const t=simTest;return `<div class="sim-test"><div class="row" style="justify-content:space-between;align-items:center"><b>${t.k==='Y'?'Y 輸出逐點測試':'輸入逐點測試'}</b><span><button class="tool sm" id="simTestCsv">匯出 CSV</button> <button class="tool sm" id="simTestPrint">列印</button> <button class="tool sm" id="simTestClose">關閉</button></span></div>
  ${t.note?`<p class="note">${esc(t.note)}</p>`:''}<table class="sim-tbl"><thead><tr>${t.head.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${t.rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;}
function simTestCsv(){const t=simTest;if(!t)return;const d=new Date(),p=n=>String(n).padStart(2,'0');saveFile(`${t.k==='Y'?'輸出測試':'輸入測試'}-${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}.csv`,toCsv([t.head,...t.rows]),'已匯出測試結果');}
let printSimOnly=false;
function printSimTest(){printSimOnly=true;try{window.print();}finally{setTimeout(()=>{printSimOnly=false;},500);}}
// 斷路器：跳脫中點一下是復歸（還是 OFF），再點一下才 ON
function brkClick(id){if(SIMST.btrip&&SIMST.btrip[id]){delete SIMST.btrip[id];SIMST.on[id]=false;toast(`${tagOf(id)} 已復歸，再點一下 ON`);}else SIMST.on[id]=!SIMST.on[id];simRefresh();}

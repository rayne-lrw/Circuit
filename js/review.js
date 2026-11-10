"use strict";
/* ---------- 配線審查 ----------
   一、電氣檢查（自動，列在「檢查」）：接地接點沒接、接地線不是黃綠、接地和主電源接在同一個電位、斷路器額定電流比下游線徑容許電流大。
   二、審查流程（人工）：每條線可以標「已確認」（線改過會變成「改過要重看」）、在圖上放註記（待處理／已修正／已確認）、列印審查報告。
   審查資料存在 S.review = {ok:{線id:簽章}, notes:[{id,x,y,t,st,at}]}。 */

// 接地線色：黃綠或綠都可以
// 接地接點：名稱 PE、PE2、FG、E、⏚，或說明裡有「接地」
const EARTH_ID=/^(PE\d*|FG\d*|E|⏚)$/i;
const isEarthTerm=t=>!!t&&(EARTH_ID.test(t.id)||/接地/.test(t.desc||''));
const termOfEnd=e=>{const d=devOf(e.d);return d?termOf(d,e.t):null;};
const earthEnd=e=>isEarthTerm(termOfEnd(e));
// 整台都是接地點（接地排）：空著的孔不提示
const earthBar=d=>{const ts=tplOf(d).terms||[];return ts.length>0&&ts.every(isEarthTerm);};
// 主電源接點：接地不可以和這些接在同一個電位
const MAINS_ID=/^(L|N|L[123]'?|[RST]|[UVW]|[RST][12]?)$/;
// 斷路器額定電流：從型號讀「…40A」「9-14A」（取上限）
function breakerAmp(d){const t=resolveTpl(d.tpl,d.count);if(!t||t.cat!==C1)return 0;const m=String(t.n||'').match(/(\d+(?:\.\d+)?)A\b(?!.*\d+A\b)/);return m?+m[1]:0;}
// 線徑容許電流（A）：盤內 PVC 線放在線槽裡的保守值，只當提醒
const AMPACITY=[[.3,3],[.5,5],[.75,7],[1.25,12],[2,17],[3.5,23],[5.5,31],[8,42],[14,61],[22,80],[38,113]];
const ampOf=g=>{let a=0;for(const [s,v] of AMPACITY)if(g>=s-1e-6)a=v;return a;};

function reviewIssues(){
  const out=[],conn=new Set();
  S.wires.forEach(w=>['a','b'].forEach(k=>conn.add(w[k].d+'|'+w[k].t)));
  // 接地接點沒接：器具已經有接其他線才提示（還在畫的器具不吵）
  S.devices.forEach(d=>{const t=tplOf(d);if(!t||!t.terms||earthBar(d))return;
    if(!S.wires.some(w=>w.a.d===d.id||w.b.d===d.id))return;
    const miss=[...new Set(t.terms.filter(x=>isEarthTerm(x)&&!conn.has(d.id+'|'+x.id)).map(x=>x.id))];
    if(miss.length)out.push({t:`${d.tag} 的接地 ${miss.join('、')} 沒有接`,k:'dev',id:d.id});});
  // 接地線不是黃綠（電纜芯線照電纜規格，不檢查）
  S.wires.forEach(w=>{if(w.cab||!(earthEnd(w.a)||earthEnd(w.b)))return;if(!['ground','green'].includes(w.color)&&!(w.hex&&/綠/.test(w.cname||'')))out.push({t:`${wireRef(w)} 接在接地，線色不是黃綠或綠`,k:'wire',id:w.id});});
  // 接地和主電源（L、N、R、S、T、U、V、W）接在同一個電位
  const nets=netsOf(),byNet=new Map();
  S.wires.forEach(w=>{const n=nets.get(w.id);if(!byNet.has(n))byNet.set(n,{e:null,m:null,w});const g=byNet.get(n);
    ['a','b'].forEach(k=>{const t=termOfEnd(w[k]);if(!t)return;if(isEarthTerm(t))g.e=g.e||`${tagOf(w[k].d)}·${t.id}`;else if(MAINS_ID.test(t.id))g.m=g.m||`${tagOf(w[k].d)}·${t.id}`;});});
  byNet.forEach(g=>{if(g.e&&g.m)out.push({t:`接地 ${g.e} 和 ${g.m} 接在同一個電位，請確認`,k:'wire',id:g.w.id});});
  // 斷路器額定電流比下游線徑的容許電流大
  S.devices.forEach(d=>{const A=breakerAmp(d);if(!A)return;
    // 同一台、同一種線徑合併成一則
    const bad=new Map();S.wires.filter(w=>(w.a.d===d.id||w.b.d===d.id)&&w.gauge>0).forEach(w=>{const a=ampOf(w.gauge);if(a&&a<A){if(!bad.has(w.gauge))bad.set(w.gauge,[]);bad.get(w.gauge).push(w);}});
    bad.forEach((ws,g)=>out.push({t:`${d.tag}（${A}A）接的 ${[...new Set(ws.map(w=>w.no))].sort(natCmp).join('、')} 是 ${g}mm²（約 ${ampOf(g)}A），線徑可能太細`,k:'wire',id:ws[0].id}));});
  return out;
}

/* ---------- 審查流程 ---------- */
const rv=()=>{if(!S.review)S.review={ok:{},notes:[]};S.review.ok=S.review.ok||{};S.review.notes=S.review.notes||[];return S.review;};
// 線的簽章：兩端、線號、線徑、顏色、電纜。確認後又改了就要重看
const wireSig=w=>[w.a.d,w.a.t,w.b.d,w.b.t,w.no,w.gauge,w.hex||w.color,w.cab||''].join('|');
function reviewOf(w){const s=S.review&&S.review.ok&&S.review.ok[w.id];return !s?'none':s===wireSig(w)?'ok':'changed';}
function setReviewed(w,on){const r=rv();if(on)r.ok[w.id]=wireSig(w);else delete r.ok[w.id];}
function reviewStats(){const c={ok:0,changed:0,none:0};S.wires.forEach(w=>c[reviewOf(w)]++);return c;}
const NOTE_ST={open:'待處理',fixed:'已修正',ok:'已確認'};
let noteAdd=false,noteSel=null,rvFilt='none';
function addNote(p){const r=rv();let i=1;while(r.notes.some(n=>n.id==='N'+i))i++;const n={id:'N'+i,x:Math.round(p.x),y:Math.round(p.y),t:'',st:'open',at:Date.now()};r.notes.push(n);noteSel=n.id;return n;}
const noteOf=id=>(S.review&&S.review.notes||[]).find(n=>n.id===id);

// 右側「審查」分頁
function renderReview(){
  const c=reviewStats(),tot=S.wires.length,pct=tot?Math.round(c.ok/tot*100):0,notes=(S.review&&S.review.notes)||[];
  $('listH').textContent=`審查　已確認 ${c.ok} / ${tot} 條`;
  const fl=[['none','未確認',c.none],['changed','改過要重看',c.changed],['ok','已確認',c.ok]];
  const rows=S.wires.filter(w=>reviewOf(w)===rvFilt).sort((a,b)=>natCmp(a.no,b.no));
  const nOpen=notes.filter(n=>n.st==='open').length;
  $('list').innerHTML=`<div class="rv-bar"><span style="width:${pct}%"></span></div>
  <p class="note">選一條線，在右側勾「已審查確認」；或在這裡直接勾。確認後線又改過（兩端、線號、線徑、顏色），會跑到「改過要重看」。</p>
  <div class="row rv-act"><button class="tool${noteAdd?' primary':''}" id="rvNote">${noteAdd?'點圖面放註記（Esc 取消）':'在圖上加註記'}</button><button class="tool" id="rvPrint">列印審查報告</button></div>
  <h3 class="rv-h">註記　${notes.length} 則${nOpen?`，${nOpen} 則待處理`:''}</h3>
  ${notes.map(n=>`<div class="rv-note${noteSel===n.id?' sel':''}" data-note="${n.id}"><div class="rv-nh"><button class="rv-pin st-${n.st}" data-note-go="${n.id}" title="在圖上找到這則註記">${esc(n.id)}</button>
    <select data-note-st="${n.id}" aria-label="狀態">${Object.entries(NOTE_ST).map(([k,v])=>`<option value="${k}"${n.st===k?' selected':''}>${v}</option>`).join('')}</select>
    <button class="tool sm danger" data-note-del="${n.id}" aria-label="刪除註記">刪除</button></div>
    <textarea data-note-t="${n.id}" rows="2" maxlength="300" placeholder="寫下要確認或要改的地方">${esc(n.t)}</textarea></div>`).join('')||'<p class="note">還沒有註記。</p>'}
  <h3 class="rv-h">線</h3>
  <div class="seg rv-f">${fl.map(([k,t,n])=>`<button data-rvf="${k}" aria-pressed="${rvFilt===k}">${t} ${n}</button>`).join('')}</div>
  ${rows.map(w=>`<label class="rv-w${sel===w.id?' sel':''}"><input type="checkbox" data-rvw="${w.id}"${reviewOf(w)==='ok'?' checked':''}><span class="sw" style="background:${swatch(colorOf(w))}"></span><span data-wl="${w.id}">${esc(w.no)}</span><span class="ep">${esc(epText(w.a))} → ${esc(epText(w.b))}</span></label>`).join('')||'<p class="note">沒有。</p>'}
  ${rvFilt==='none'&&rows.length?`<div class="row"><button class="tool" id="rvAll">這 ${rows.length} 條全部標成已確認</button></div>`:''}`;
}
function reviewListClick(e){
  const t=e.target;
  if(t.id==='rvNote'){noteAdd=!noteAdd;renderList();updateHint();return true;}
  if(t.id==='rvPrint'){printReview();return true;}
  if(t.id==='rvAll'){S.wires.filter(w=>reviewOf(w)==='none').forEach(w=>setReviewed(w,true));commit();renderList();renderDetail();return true;}
  const f=t.closest&&t.closest('[data-rvf]');if(f){rvFilt=f.dataset.rvf;renderList();return true;}
  const go=t.closest&&t.closest('[data-note-go]');if(go){const n=noteOf(go.dataset.noteGo);if(n){noteSel=n.id;centerOn(n);renderList();renderOverlay();}return true;}
  const del=t.closest&&t.closest('[data-note-del]');if(del){const r=rv();r.notes=r.notes.filter(n=>n.id!==del.dataset.noteDel);if(noteSel===del.dataset.noteDel)noteSel=null;commit();renderList();renderOverlay();return true;}
  return false;
}
function reviewListChange(e){
  const t=e.target;
  if(t.dataset.rvw){const w=S.wires.find(x=>x.id===t.dataset.rvw);if(w){setReviewed(w,t.checked);commit();renderList();renderDetail();}return true;}
  if(t.dataset.noteSt){const n=noteOf(t.dataset.noteSt);if(n){n.st=t.value;commit();renderList();renderOverlay();}return true;}
  if(t.dataset.noteT){const n=noteOf(t.dataset.noteT);if(n){n.t=t.value.slice(0,300);commit();renderOverlay();}return true;}
  return false;
}
function centerOn(p){const r=$('svg').getBoundingClientRect();view.x=r.width/2-p.x*view.k;view.y=r.height/2-p.y*view.k;view.manual=true;applyView();}
// 圖上的註記：編號圓點，待處理紅、已修正橘、已確認綠
function noteOverlay(k=view.k){
  const ns=(S.review&&S.review.notes)||[];if(!ns.length)return '';const r=9/k;
  return ns.map(n=>`<g class="rv-mk st-${n.st}${noteSel===n.id?' sel':''}" data-note-mk="${n.id}"><circle cx="${n.x}" cy="${n.y}" r="${r}"/><text x="${n.x}" y="${n.y+3.6/k}" text-anchor="middle" style="font-size:${10/k}px">${esc(n.id.slice(1))}</text>${n.t?`<title>${esc(n.t)}</title>`:''}</g>`).join('');
}
const noteHit=p=>{const ns=(S.review&&S.review.notes)||[],r=11/view.k;for(let i=ns.length-1;i>=0;i--)if(Math.hypot(ns[i].x-p.x,ns[i].y-p.y)<=r)return ns[i];return null;};
// 審查報告：只印審查頁（問題清單、註記、確認進度、未確認的線）
let printReviewOnly=false;
function printReview(){printReviewOnly=true;try{window.print();}finally{setTimeout(()=>{printReviewOnly=false;},500);}}
function reviewReportHtml(meta){
  const c=reviewStats(),tot=S.wires.length,notes=(S.review&&S.review.notes)||[];
  const sec=(t,body)=>`<section class="pg"><div class="ph"><b>${esc(t)}</b><span>${esc(meta)}</span></div>${body}</section>`;
  const ver=(($('ver')||{}).textContent||'').trim();
  let h=`<p class="pnote">版本 ${esc(ver)}　線 ${tot} 條：已確認 ${c.ok}、改過要重看 ${c.changed}、未確認 ${c.none}　註記 ${notes.length} 則（待處理 ${notes.filter(n=>n.st==='open').length}）</p>`;
  h+='<h3>自動檢查</h3>'+(ISSUES.length?tableHtml(['#','項目'],ISSUES.map((x,i)=>[i+1,x.t]),[0]):'<p class="pnote">沒有發現問題。</p>');
  h+='<h3>註記</h3>'+(notes.length?tableHtml(['#','狀態','內容','位置'],notes.map(n=>[n.id,NOTE_ST[n.st],n.t||'（空白）',`${n.x}, ${n.y}`]),[]):'<p class="pnote">沒有註記。</p>');
  const un=S.wires.filter(w=>reviewOf(w)!=='ok').sort((a,b)=>natCmp(a.no,b.no));
  h+='<h3>尚未確認的線</h3>'+(un.length?tableHtml(['線號','起點','終點','線徑','狀態'],un.map(w=>[w.no,epText(w.a),epText(w.b),w.gauge,reviewOf(w)==='changed'?'改過要重看':'未確認']),[3]):'<p class="pnote">全部確認完成。</p>');
  return sec('配線審查報告',h);
}

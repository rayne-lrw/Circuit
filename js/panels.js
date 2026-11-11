"use strict";
/* ---------- 面板 ---------- */
function libButton(id,t){
  const size=t.gen?t.cntLabel:(+t.w.toFixed(1)+'×'+t.h);
  const cus=S.tpls&&S.tpls[id];
  return `<button class="lib${cus?' cus':''}" data-add="${id}" title="${esc(cus?'自訂器具（未核對）：尺寸、接點、動作都是自己設定的，程式不會核對':verText(id,t))}"><span class="nm">${cus?'<span class="cus-badge">自訂</span>':''}${esc(t.n)}</span><small>${size}</small><span class="bd">${esc(t.b)||'—'}</span></button>`;
}
function renderPalette(){
  const q=$('libQ').value.trim().toLowerCase();
  const match=t=>!q||[t.n,t.b,t.ser||''].join(' ').toLowerCase().includes(q);
  const custom=S.tpls||{},cats={},all=[...Object.entries(TPL).filter(([id,t])=>!t.legacy&&!custom[id]),...Object.entries(custom)];
  all.forEach(([id,t])=>{if(match(t))(cats[t.cat]=cats[t.cat]||[]).push([id,t]);});
  const order=['自訂器具',C1,C2,C3,C4,C5,C6,C7,C8,C9,D1,F1,F2,F3];
  let h='';
  // 自訂器具：每一個旁邊有編輯、複製、刪除
  const cus=([id,t])=>custom[id]&&mode!=='view'?`<div class="lib-c">${libButton(id,t)}<span class="lib-act"><button class="tool sm" data-tpl-ed="${id}" title="編輯這個器具（已放的會一起更新）">編輯</button><button class="tool sm" data-tpl-cp="${id}" title="複製成新器具">複製</button><button class="tool sm danger" data-tpl-del="${id}" title="${TPL[id]?'換回原廠':'刪除'}">${TPL[id]?'換回原廠':'刪除'}</button></span></div>`:libButton(id,t);
  // 沒有器具在用的自訂器具：可以一次清掉
  const unused=Object.keys(custom).filter(id=>!S.devices.some(d=>d.tpl===id));
  order.forEach(c=>{if(cats[c]) h+=`<div class="brand"><h2>${c}${c==='自訂器具'&&unused.length&&mode!=='view'?` <button class="tool sm" id="cusClean" title="列出沒有器具在用的自訂器具，勾選後刪除">清理沒用到的（${unused.length}）</button>`:''}</h2>${c==='自訂器具'?'<p class="note cus-note">自訂器具的尺寸、接點、動作是自己設定的，程式不會核對。</p>':''}${serGroups(cats[c],cus,!!q)}</div>`;});
  const ductRows=DUCTINV.filter(([n,m])=>!q||(n+m).toLowerCase().includes(q)).map(([n,m,w,d])=>`<button class="lib" data-duct-add="h" data-dw="${w}" data-dd="${d}"><span class="nm">${n} 水平</span><small>寬 ${w}</small><span class="bd">${m}</span></button><button class="lib" data-duct-add="v" data-dw="${w}" data-dd="${d}"><span class="nm">${n} 垂直</span><small>寬 ${w}</small><span class="bd">${m}</span></button>`).join('');
  if(ductRows) h+=`<div class="brand"><h2>線槽</h2>${ductRows}</div>`;
  const glandRows=GLANDINV.filter(n=>!q||n.toLowerCase().includes(q)).map(n=>`<button class="lib" data-gland-add="${esc(n)}"><span class="nm">${esc(n)}</span><small>出線口</small></button>`).join('');
  if(glandRows) h+=`<div class="brand"><h2>出線口（可裝在箱體四面）</h2>${glandRows}</div>`;
  if(!q||'現場區'.includes(q)) h+=`<div class="brand"><h2>現場區</h2><button class="lib" data-zone-add=""><span class="nm">新增現場區</span><small>可移動</small><span class="bd">依機台或區域分開放現場設備</span></button></div>`;
  const rest=INV.filter(r=>!q||r.join(' ').toLowerCase().includes(q));
  const groups={};rest.forEach(r=>(groups[r[0]]=groups[r[0]]||[]).push(r));
  if(rest.length){
    h+=`<details${q?' open':''}><summary>其他電料，不畫成器具（${rest.length} 項）</summary>`+Object.entries(groups).map(([g,rs])=>`<h2 style="margin-top:8px">${esc(g)}</h2>`+rs.map(r=>`<div class="inv-row"><span>${esc(r[1])}${r[2]&&r[2]!==r[1]?`　${esc(r[2])}`:''}</span><span>${esc(r[3])}</span></div>`).join('')).join('')+`</details>`;
  }
  $('palette').innerHTML=h||'<p class="note">找不到符合的器具。</p>';
}
function renderFilters(){
  $('fKind').innerHTML=Object.entries(KINDS).filter(([k])=>k!=='door'||useDoor()||S.wires.some(w=>wireKind(w)==='door')).map(([k,n])=>`<button class="chip" data-fk="${k}" aria-pressed="${filt.kind===k}" style="font-family:var(--sans)">${n} ${S.wires.filter(w=>wireKind(w)===k).length}</button>`).join('');
  const used=new Map();S.wires.forEach(w=>{if(!used.has(w.color))used.set(w.color,colorOf(w));});
  const order=Object.keys(COLORS),rank=k=>{const i=order.indexOf(k);return i<0?99:i;};
  $('fColor').innerHTML=[...used].sort((a,b)=>rank(a[0])-rank(b[0])).map(([k,c])=>`<button class="chip color" data-fc="${k}" aria-pressed="${filt.color===k}"><span class="sw" style="background:${swatch(c)}"></span>${esc(c.n)}</button>`).join('');
  const gs=[...new Set(S.wires.map(w=>w.gauge))].sort((a,b)=>a-b);
  $('fGauge').innerHTML=gs.map(g=>`<button class="chip" data-fg="${g}" aria-pressed="${filt.gauge===g}">${g}</button>`).join('');
  $('fDev').innerHTML=`<option value="">全部器具</option>`+S.devices.map(d=>`<option value="${d.id}"${filt.dev===d.id?' selected':''}>${esc(d.tag)}　${esc(tplOf(d).n)}</option>`).join('');
}
const specName=c=>c||'未指定電纜規格';
function wireRow(w){
  const r=ROUTES.get(w.id),c=colorOf(w);
  return `<button class="w${sel===w.id?' sel':''}" data-wl="${w.id}"><span class="sw" style="background:${swatch(c)}"></span><span>${w.no}</span><span class="ep">${esc(epText(w.a))} → ${esc(epText(w.b))}</span><span class="g">${r&&r.warn?'<span class="flag">注意</span>':w.gauge}</span></button>`;
}
function renderList(){
  renderFilters();
  [['tabAll','all'],['tabExt','ext'],['tabBom','bom'],['tabLen','len'],['tabRev','rev']].forEach(([id,t])=>$(id).setAttribute('aria-pressed',tab===t));
  $('listCsv').hidden=tab==='rev';if(tab!=='rev')$('listCsv').textContent=`匯出${{all:'線號表',ext:'電纜表',bom:'材料表',len:'線長統計'}[tab]} CSV`;
  $('filters').hidden=tab!=='all';
  if(tab==='rev'){renderReview();return;}
  if(tab==='bom'){renderBom();return;}
  if(tab==='len'){renderLen();return;}
  if(tab==='ext'){renderCables();return;}
  const rows=S.wires.filter(passes).slice().sort((a,b)=>natCmp(a.no,b.no)); // 照線號排，同號排在一起
  $('listH').textContent=`線號表　${rows.length} / ${S.wires.length} 條`;
  $('list').innerHTML=rows.map(wireRow).join('')||`<p class="note">沒有符合條件的線。</p>`;
}
function stockMsg(g,colorKey){
  const c=keyColor(colorKey).n;
  const r=INV.find(x=>x[0]==='CSA細芯控制電線'&&x[1].startsWith(g+'mm²')&&x[1].split(/\s+/)[1]===c);
  return r?`電料清單有這個線材：${r[0]} ${r[1]}`:'電料清單沒有這個線徑與顏色';
}
const cableOptions=cur=>specOptions(cur);
function renderDetail(){renderDetailInner();lockInputs($('detail'));}
function renderDetailInner(){
  if(mode==='sim'){simPanel($('detail'));return;}
  if(mode==='place'&&multi.length>1){multiDetail($('detail'));return;}
  const box=$('detail');
  if(!sel&&!picked&&selCab){const c=cabOf(selCab);if(c){cableDetail(box,c);return;}selCab=null;}
  if(sel){
    const w=S.wires.find(x=>x.id===sel),r=ROUTES.get(sel);
    if(!w||!r){sel=null;box.hidden=true;return;}
    const c=colorOf(w),kind=wireKind(w);
    box.hidden=false;
    const pr=parallelOf(w),pl=a=>a.length?a.map(x=>`<button class="lnk" data-pw="${x.id}">${esc(x.no)}</button>`).join(' '):'無';
    if(renameOffer&&renameOffer.wid!==w.id)renameOffer=null;
    const ro=renameOffer;
    const rs=reviewOf(w);
    box.innerHTML=`<label class="rv-chk st-${rs}"><input type="checkbox" id="wRev"${rs==='ok'?' checked':''}> 已審查確認${rs==='changed'?'（確認後改過，請重看）':''}</label><div class="fields"><label for="wNo" style="grid-column:1/-1">線號（可以重複，同電位可用同一個號碼）<input id="wNo" maxlength="16" value="${esc(w.no)}" style="font-size:15px;font-weight:600"></label></div>
    ${ro?`<div class="revert"><p class="note">同電位還有 ${ro.ids.length} 條線號是 ${esc(ro.from)}，要一起改成 ${esc(ro.to)} 嗎？</p><div class="row" style="justify-content:flex-start"><button class="tool" id="renAll">一起改</button><button class="tool" id="renNo">不用</button></div></div>`:''}<div class="big"><span class="sw" style="background:${swatch(c)}"></span> ${esc(c.n)}　${w.gauge} mm²　${KINDS[kind]}</div>
    <dl><dt>起點</dt><dd>${esc(epText(w.a))}</dd><dt>終點</dt><dd>${esc(epText(w.b))}</dd><dt>路徑</dt><dd>${w.direct?'不進線槽，直接拉線':w.wps.length?'經過中繼點'+(r.via.length?'：'+esc(r.via.join(' → ')):''):r.via.length?'自動：'+esc(r.via.join(' → ')):'自動：直接跨接'}${r.gland?' → '+esc(r.gland):''}</dd><dt>中繼點</dt><dd>${w.wps.length} 個</dd><dt>線號位置</dt><dd><select id="wLab" aria-label="線號位置">${LAB_AT.map(([k,n])=>`<option value="${k}"${w.lab==null&&(w.labAt||'start')===k?' selected':''}>${n}</option>`).join('')}${w.lab!=null?'<option value="" selected>拖曳過的位置</option>':''}</select></dd>${sameNo(w).length?`<dt>同號</dt><dd>${sameNo(w).length} 條：${pl(sameNo(w))}</dd>`:''}<dt>起點並線</dt><dd>${pl(pr.a)}</dd><dt>終點並線</dt><dd>${pl(pr.b)}</dd><dt>圖面線長</dt><dd>${(r.len/1000).toFixed(2)} m</dd></dl>
    ${r.warn?`<span class="flag">${esc(r.warn)}：請加中繼點或調整線槽</span>`:''}
    ${w.cab?coreInfo(w):`<div class="fields"><label for="xCab" style="grid-column:1/-1">電纜<select id="xCab"><option value="">不屬於電纜（散線）</option>${[...S.cables].sort((a,b)=>natCmp(a.no,b.no)).map(c=>`<option value="${c.id}">${esc(c.no)}　${esc(specName(c.spec))}</option>`).join('')}<option value="__new">新電纜…</option></select></label>
      ${kind==='ext'?`<label for="xGland" style="grid-column:1/-1">出線口<select id="xGland"><option value="">自動選最近</option>${S.glands.map(g=>`<option value="${g.id}"${w.gland===g.id?' selected':''}>${esc(g.id)}</option>`).join('')}</select></label>`:''}</div>
    <label class="check"><input type="checkbox" id="wDirect"${w.direct?' checked':''}>不進線槽（直接拉線，可加中繼點調整路徑）</label>
    <div><div class="sub-h">線徑 mm²</div>${gaugeChips(w.gauge,'dg','dn')}</div>
    <div><div class="sub-h">顏色</div>${colorChips(w.color,'dn',w)}</div>
    <p class="note">${esc(stockMsg(w.gauge,w.color))}</p>`}
    <div class="row">${w.wps.length&&!w.cab?'<button class="tool" id="clearWp">清除中繼點，改回自動</button>':''}<button class="tool danger" id="delWire">刪除這條線</button></div>`;
    $('wLab').onchange=e=>{const v=e.target.value;if(!v)return;delete w.lab;if(v==='start')delete w.labAt;else w.labAt=v;commit();recompute();};
    $('wRev').onchange=e=>{setReviewed(w,e.target.checked);commit();renderDetail();if(tab==='rev')renderList();};
    $('wNo').onchange=e=>{
      const v=e.target.value.trim();if(!v||v===w.no){e.target.value=w.no;return;}
      // 同電位還有同號的線：改完後問要不要一起改
      const nets=netsOf(),mine=nets.get(w.id),old=w.no,grp=S.wires.filter(x=>x!==w&&x.no===old&&nets.get(x.id)===mine);
      w.no=v;renameOffer=grp.length?{wid:w.id,from:old,to:v,ids:grp.map(x=>x.id)}:null;commit();recompute();
    };
    if($('renAll'))$('renAll').onclick=()=>{const o=renameOffer;S.wires.forEach(x=>{if(o.ids.includes(x.id))x.no=o.to;});renameOffer=null;commit();recompute();toast(`已把同電位的 ${o.ids.length} 條線一起改成 ${o.to}`);};
    if($('renNo'))$('renNo').onclick=()=>{renameOffer=null;renderDetail();};
    if(w.cab){bindCoreInfo(w);return;}
    $('wDirect').onchange=e=>{if(e.target.checked)w.direct=true;else delete w.direct;commit();recompute();};
    $('xCab').onchange=e=>{const v=e.target.value;if(!v)return;const c=v==='__new'?newCable('',''):cabOf(v);if(!c)return;const k=attachCore(w,c);commit();recompute();toast(`已把 ${w.no} 編進電纜 ${c.no}，芯線 ${k.n}`);};
    if(kind==='ext'){
      $('xGland').onchange=e=>{if(e.target.value)w.gland=e.target.value;else delete w.gland;commit();recompute();};
    }
    return;
  }
  if(picked){
    const b=pickedBox(); if(!b){picked=null;box.hidden=true;return;}
    box.hidden=false;
    if(picked.k==='dev'){
      const d=devOf(picked.id),t=tplOf(d),n=S.wires.filter(w=>w.a.d===d.id||w.b.d===d.id).length;
      if(swapOffer&&swapOffer.id!==d.id)swapOffer=null;
      const so=swapOffer,sw=so&&devOf(so.other);
      box.innerHTML=`<div class="fields"><label for="dTag" style="grid-column:1/-1">器具編號<input id="dTag" maxlength="16" value="${esc(d.tag)}" style="font-size:15px;font-weight:600"></label></div>${sw?`<div class="revert"><p class="note">${esc(so.to)} 已經是另一台器具（${esc(tplOf(sw).b)} ${esc(tplOf(sw).n)}）的編號，要把兩台的編號互換嗎？（${esc(d.tag)} ↔ ${esc(so.to)}）</p><div class="row" style="justify-content:flex-start"><button class="tool" id="swapGo">互換</button><button class="tool" id="swapNo">取消</button></div></div>`:''}<dl><dt>器具</dt><dd>${esc(t.b)} ${esc(t.n)}</dd><dt>尺寸</dt><dd>${+t.w.toFixed(1)} × ${+t.h.toFixed(1)} × ${t.d} mm</dd><dt>核對</dt><dd>尺寸 ${esc(verText(d.tpl,t))}；接點${t.ok?'已對照':TERM_OK.has(d.tpl)?'依照片或外型圖':'未核對'}</dd>${d.rot?`<dt>旋轉</dt><dd>${d.rot}°</dd>`:''}<dt>位置</dt><dd>${d.sheet==='door'?doorShort():d.sheet==='field'?esc(devRef(d).name||'現場'):'底板'}　X ${d.x}　Y ${d.y}</dd><dt>接線</dt><dd>${n} 條</dd>${d.on&&devOf(d.on)?`<dt>裝在</dt><dd>${esc(devOf(d.on).tag)} ${t.attach==='below'&&!batFront(d,devOf(d.on))?'下方':'正面'}　<button class="tool" id="detachAux" style="padding:2px 8px">拆下</button></dd>`:t.attach?`<dt>安裝</dt><dd style="font-family:var(--sans)">拖到${t.attach==='below'?'伺服驅動器':'電磁接觸器'}上就會裝上去</dd>`:''}${riders(d).length?`<dt>${t.rack?'裝的模組':'正面附件'}</dt><dd>${riders(d).map(r=>esc(r.tag)).join(' ')}</dd>`:''}${t.noOv?`<dt>軌上器具</dt><dd>${mountedOn(d).map(x=>esc(x.tag)).join(' ')||'無'}</dd>`:''}${gapsOf(d)}${t.note?`<dt>備註</dt><dd>${esc(t.note)}</dd>`:''}</dl>
      ${t.model?`<div class="fields"><label for="dModel" style="grid-column:1/-1">型號（材料表照這個列，空白就寫「二極體」）<input id="dModel" maxlength="30" value="${esc(d.model||'')}" placeholder="例如 1N4007"></label></div>`:''}
      ${(d.sheet==='field'||outBox({dev:d.id,sheet:d.sheet}))&&S.glands.length?`<div class="fields"><label for="dGland" style="grid-column:1/-1">預設出線口（接到這台的外線、電纜都走這個）<select id="dGland"><option value="">自動選最近</option>${S.glands.map(g=>`<option value="${g.id}"${d.gland===g.id?' selected':''}>${esc(g.id)}　${esc(g.spec)}</option>`).join('')}</select></label></div>`:''}
      ${t.sym==='diode'?`<label class="check"><input type="checkbox" id="dShowNo"${d.hideNo?'':' checked'}>顯示接到這個二極體的線號</label>`:''}
      ${coilOf(d)?`<label class="check"><input type="checkbox" id="dCoilSwap"${d.coilSwap?' checked':''}>線圈極性對調（目前 ${esc(coilOf(d).p)} 是 +、${esc(coilOf(d).m)} 是 −）</label>`:''}
      ${t.gen?`<div class="fields"><label for="dCount">${esc(t.cntLabel)}<input id="dCount" type="number" min="1" value="${d.count||t.cnt}"></label></div>`:''}
      ${t.userLinks?linkHtml(d):''}${hasSlots(t)?slotHtml(d)+(t.jumper?jumperHtml(d):''):slotSource(d)?`<div class="revert"><p class="note">這組端子台之前用「編輯器具」改過，變成了自訂器具，所以不能每片填端子號，也不能改片數。換回 WAGO 端子台後，原本改的編號會變成每片的端子號，接好的線都會保留。</p><button class="tool" id="slotRevert">換回 ${esc(TPL[slotSource(d)].n)}</button></div>`:''}
      ${t.terms.length>1&&!hasSlots(t)?`<label class="check"><input type="checkbox" id="dBus"${busOf(d)?' checked':''}>全部接點本來就同電位（接地銅板、共點排）</label>`:''}
      ${t.rack?rackHtml(d):''}${t.rackKind?rackInfo(d):''}
      ${!hasSlots(t)&&!t.sym&&t.terms.length?aliasHtml(d,t):''}
      ${S.tpls&&S.tpls[d.tpl]?'<p class="note cus-note">自訂器具（未核對）：尺寸、接點、動作都是自己設定的，程式不會核對；模擬只照「模擬動作」的設定計算。</p>':''}
      <div class="fields"><label for="dX">X（距${d.sheet==='door'?doorShort():d.sheet==='field'?esc(devRef(d).name||'現場區'):'底板'}左緣）<input id="dX" type="number" step="1" value="${r1(d.x-devRef(d).x)}"></label><label for="dY">Y（距上緣）<input id="dY" type="number" step="1" value="${r1(d.y-devRef(d).y)}"></label></div>${moveHtml(false)}
      <div class="row"><button class="tool" id="rotDev">旋轉 90°</button><button class="tool" id="editTpl">編輯器具</button><button class="tool danger" id="delPicked">刪除器具${n?`與 ${n} 條線`:''}</button></div>`;
      $('dTag').onchange=e=>{
        const v=e.target.value.trim();
        if(!v||v===d.tag){e.target.value=d.tag;return;}
        const o=tagOwner(v,d);
        if(o){swapOffer={id:d.id,other:o.id,to:v};renderDetail();return;} // 已被使用：問要不要互換
        swapOffer=null;d.tag=v;commit();recompute();
      };
      if($('swapGo'))$('swapGo').onclick=()=>{const o=devOf(swapOffer.other),was=d.tag;if(!o){swapOffer=null;renderDetail();return;}o.tag=was;d.tag=swapOffer.to;swapOffer=null;commit();recompute();toast(`已互換編號：${d.tag} ↔ ${o.tag}`);};
      if($('swapNo'))$('swapNo').onclick=()=>{swapOffer=null;renderDetail();};
      ['X','Y'].forEach(c=>{$('d'+c).onchange=e=>{const v=Number(e.target.value);if(e.target.value===''||!isFinite(v))return;const R=devRef(d),mt=carried(d),ox=d.x,oy=d.y;if(c==='X')d.x=r1(R.x+v);else d.y=r1(R.y+v);shiftAll(mt,d.x-ox,d.y-oy,d.sheet);const h=d.on&&devOf(d.on);if(h&&!inR({x:d.x+t.w/2,y:d.y+t.h/2},rectOf('dev',h)))delete d.on;commit();recompute();};});
      if($('dBus'))$('dBus').onchange=e=>{const v=e.target.checked,def=!!(t.bus||BUS_RE.test(t.n||''));if(v===def)delete d.bus;else d.bus=v;commit();recompute();};
      document.querySelectorAll('#detail [data-alias]').forEach(x=>x.onchange=()=>{const k=x.dataset.alias,v=x.value.trim().slice(0,12);d.alias=d.alias||{};if(v&&v!==k)d.alias[k]=v;else delete d.alias[k];if(!Object.keys(d.alias).length)delete d.alias;commit();recompute();});
      document.querySelectorAll('#detail [data-rack-add]').forEach(x=>x.onchange=()=>{const id=x.value;if(!id)return;rackAdd(d,Number(x.dataset.rackAdd),id);});
      document.querySelectorAll('#detail [data-rack-pick]').forEach(x=>x.onclick=()=>{sel=null;picked={k:'dev',id:x.dataset.rackPick};recompute();});
      if($('dModel'))$('dModel').onchange=e=>{const v=e.target.value.trim().slice(0,30);if(v)d.model=v;else delete d.model;commit();recompute();};
      if($('dGland'))$('dGland').onchange=e=>{if(e.target.value)d.gland=e.target.value;else delete d.gland;commit();recompute();};
      if($('dShowNo'))$('dShowNo').onchange=e=>{if(e.target.checked)delete d.hideNo;else d.hideNo=true;commit();recompute();};
      if($('dCoilSwap'))$('dCoilSwap').onchange=e=>{if(e.target.checked)d.coilSwap=true;else delete d.coilSwap;commit();recompute();};
      if(t.gen) $('dCount').onchange=e=>{const v=Number(e.target.value);if(!(v>=1))return;const before=S.wires.length;d.count=Math.min(t.cntLabel.includes('mm')?2000:96,Math.round(v));commit();recompute();snapshotPrev=JSON.stringify(S);save();if(S.wires.length<before)toast(`接點變少，移除了 ${before-S.wires.length} 條線；可按復原`);};
    }else if(picked.k==='zone'){
      const z=S.fields.find(x=>x.id===picked.id),devs=S.devices.filter(d=>inZone(z,d)),bo=boxOrigin();
      box.innerHTML=`<div class="big">${esc(z.name)} ${hq('zone')}</div>${hn('zone','拖曳左上角的名稱可移動整區，區內器具會一起移動。現場區只是示意，位置不影響線長。')}<dl><dt>器具</dt><dd>${devs.map(d=>esc(d.tag)).join(' ')||'無'}</dd></dl>
      <div class="fields"><label for="zName" style="grid-column:1/-1">名稱<input id="zName" maxlength="20" value="${esc(z.name)}"></label>
      <label for="zx">X（距箱體左緣）<input id="zx" type="number" step="10" value="${r1(z.x-bo.x)}"></label><label for="zy">Y（距箱底）<input id="zy" type="number" step="10" value="${r1(z.y-bo.y-S.box.h)}"></label>
      <label for="zw">寬 (mm)<input id="zw" type="number" step="10" min="50" value="${z.w}"></label><label for="zh">高 (mm)<input id="zh" type="number" step="10" min="50" value="${z.h}"></label>
      <label for="zRoute" style="grid-column:1/-1">走線方式<select id="zRoute">${[['auto','自動幹線（程式自動整線）'],['duct','照我放的箱外線槽'],['direct','直接拉']].map(([v,t])=>`<option value="${v}"${zoneRoute(z)===v?' selected':''}>${t}</option>`).join('')}</select></label></div>
      <p class="note" style="margin-top:4px">${zoneRoute(z)==='auto'?(TRUNKS.some(d=>d.zone===z.id)?'虛線框是自動幹線：外線沿它排好再進出線口，不用自己放線槽，也不算材料。':'放不下自動幹線（現場區和箱子要在上下或左右分開，器具和邊框或箱子之間要留空間），目前直接拉。'):zoneRoute(z)==='duct'?'外線照你放的箱外線槽走（只走順路的），沒有線槽就直接拉。':'外線從器具直接拉到出線口，這一區的箱外線槽不拿來走線。'}</p>
      ${moveHtml(false)}
      ${(()=>{const fo=zoneForeign(z),aw=zoneAway(z),nm=a=>a.map(o=>esc(o.tag||o.id)).join('、');let h='';
        if(fo.length)h+=`<p class="note" style="margin-top:6px">框裡有 ${fo.length} 個不屬於這一區的東西（${nm(fo)}），拖這一區時不會帶走。</p><div class="row"><button class="tool" id="zTake">收進這一區</button></div>`;
        if(aw.length){const go=aw.filter(o=>zoneAt(objCenter(o)));h+=`<p class="note" style="margin-top:6px">有 ${aw.length} 個屬於這一區的東西在框外（${nm(aw)}），拖這一區時仍會一起帶走。</p>${go.length?`<div class="row"><button class="tool" id="zFree">歸到所在的現場區（${go.length} 個）</button></div>`:''}`;}
        return h;})()}
      ${zoneBlocked(z)?'<p class="note" style="color:#c00000">這個現場區壓在電控箱或面板上，圖面上會被底板器具擋住、不好拖。</p><div class="row"><button class="tool primary" id="zOut">移到箱子外面</button></div>':''}
      <div class="row"><button class="tool danger" id="delPicked">刪除現場區</button></div>`;
      $('zName').onchange=e=>{z.name=e.target.value.trim().slice(0,20)||z.id;commit();recompute();};
      if($('zTake'))$('zTake').onclick=()=>{const fo=zoneForeign(z);fo.forEach(o=>o.zone=z.id);commit();recompute();toast(`已把 ${fo.length} 個收進${z.name}`);};
      if($('zFree'))$('zFree').onclick=()=>{const go=zoneAway(z).filter(o=>zoneAt(objCenter(o)));go.forEach(o=>o.zone=zoneAt(objCenter(o)).id);commit();recompute();toast(`已把 ${go.length} 個歸到所在的現場區`);};
      if($('zOut'))$('zOut').onclick=()=>{const r=freeZoneSpot(z.w,z.h,z),dx=r.x-z.x,dy=r.y-z.y;zoneCarry(z).forEach(o=>{o.x=r1(o.x+dx);o.y=r1(o.y+dy);});z.x=r.x;z.y=r.y;commit();recompute();toast(`已把${z.name}移到箱子外面`);};
      $('zRoute').onchange=e=>{z.route=e.target.value;commit();recompute();renderDetail();};
      const mvz=(dx,dy)=>{zoneCarry(z).forEach(o=>{o.x=r1(o.x+dx);o.y=r1(o.y+dy);});z.x=r1(z.x+dx);z.y=r1(z.y+dy);};
      $('zx').onchange=e=>{const v=Number(e.target.value);if(e.target.value===''||!isFinite(v))return;mvz(bo.x+v-z.x,0);commit();recompute();};
      $('zy').onchange=e=>{const v=Number(e.target.value);if(e.target.value===''||!isFinite(v))return;mvz(0,bo.y+S.box.h+v-z.y);commit();recompute();};
      ['w','h'].forEach(f=>{$('z'+f).onchange=e=>{const v=Number(e.target.value);if(!(v>=50))return;z[f]=Math.round(v);commit();recompute();};});
    }else if(picked.k==='gland'){
      const g=S.glands.find(x=>x.id===picked.id),n=[...ROUTES.values()].filter(r=>r.gland===g.id).length;
      box.innerHTML=`<div class="big">出線口 ${esc(g.id)} ${hq('gland')}</div>${hn('gland','拖曳出線口會吸到最近的箱面（箱底、箱頂、左右兩側）。外線會自動選離現場設備最近的出線口，也可以在外線的資料裡指定。')}<dl><dt>外線</dt><dd>${n} 芯</dd><dt>位置</dt><dd>${GSIDE[g.side||'bottom']}</dd></dl>
      <div class="fields"><label for="gSpec" style="grid-column:1/-1">規格（改尺寸不用刪掉重建，接好的線和電纜都保留）<select id="gSpec">${[...new Set([...GLANDINV,g.spec])].map(n=>`<option value="${esc(n)}"${g.spec===n?' selected':''}>${esc(n)}</option>`).join('')}</select></label>
      <label for="gSide">裝在<select id="gSide">${Object.entries(GSIDE).map(([k,n])=>`<option value="${k}"${(g.side||'bottom')===k?' selected':''}>${n}</option>`).join('')}</select></label>
      <label for="gPos">${g.side==='left'||g.side==='right'?'距箱頂':'距箱體左緣'} mm<input id="gPos" type="number" step="5" value="${r1((g.side==='left'||g.side==='right')?g.y-boxOrigin().y:g.x-boxOrigin().x)}"></label></div>
${moveHtml(!(g.side==='left'||g.side==='right'))}<div class="row"><button class="tool danger" id="delPicked">刪除出線口</button></div>`;
      const bo=boxOrigin(),vert=()=>g.side==='left'||g.side==='right';
      $('gSide').onchange=e=>{const P=glandPt(g),c={x:bo.x+S.box.w/2,y:bo.y+S.box.h/2},s=e.target.value;glandTo(g,{x:s==='left'?bo.x:s==='right'?bo.x+S.box.w:(P.ny?P.x:c.x),y:s==='top'?bo.y:s==='bottom'?bo.y+S.box.h:(P.nx?P.y:c.y)});commit();recompute();};
      $('gSpec').onchange=e=>{g.spec=e.target.value;commit();recompute();toast(`出線口 ${g.id} 改成 ${g.spec}`);};
      $('gPos').onchange=e=>{const v=Number(e.target.value);if(e.target.value===''||!isFinite(v))return;const P=glandPt(g);glandTo(g,vert()?{x:P.x,y:bo.y+v}:{x:bo.x+v,y:P.y});commit();recompute();};
    }else{
      const d=S.ducts.find(x=>x.id===picked.id);
      const u=DUCTUSE.get(d.id)||{n:0,pct:0,lanes:0};
      box.innerHTML=`<div class="big">線槽 ${esc(d.id)}　${u.n} 條　占用 ${u.pct}%</div><div class="fields">
      <label for="fx">X (mm)<input id="fx" type="number" step="5" value="${d.x}"></label><label for="fy">Y (mm)<input id="fy" type="number" step="5" value="${d.y}"></label>
      <label for="fw">寬 (mm)<input id="fw" type="number" step="5" min="10" value="${d.w}"></label><label for="fh">高 (mm)<input id="fh" type="number" step="5" min="10" value="${d.h}"></label>
      <label for="fdp">深 (mm)<input id="fdp" type="number" step="5" min="10" value="${d.dp||40}"></label></div>
      ${moveHtml(false)}<p class="note">占用率以導線外徑估算值計算最擠的一段。${u.pitch<1.5?`<br>線道 ${u.lanes} 條，畫面上會靠得很近，實際配線沒有問題；可以開「線束模式」看。`:''}</p>
      <div class="row"><button class="tool danger" id="delPicked">刪除線槽</button></div>`;
      ['x','y','w','h','dp'].forEach(f=>{$('f'+f).onchange=e=>{const v=Number(e.target.value);if(!isFinite(v)||e.target.value==='')return;d[f]=(f==='x'||f==='y')?v:Math.max(10,v);commit();recompute();};});
    }
    return;
  }
  box.hidden=true;
}
/* 之前用編輯器改過的 WAGO 端子台（已變成自訂器具）：找回原本的型號 */
function slotSource(d){
  const c=S.tpls&&S.tpls[d.tpl];if(!c) return null;
  if(c.src&&hasSlots(TPL[c.src])) return c.src;
  return Object.keys(TPL).find(id=>hasSlots(TPL[id])&&TPL[id].n===c.n&&TPL[id].b===c.b)||null;
}
// 換回原廠端子台：依位置把自訂接點對回 1A、1B…，導線跟著改接；自訂的編號變成每片的端子號
function revertSlots(d,src){
  const c=S.tpls[d.tpl],per=TPL[src].gen(1).t.length,n=Math.max(1,Math.round(c.terms.length/per));
  const g=resolveTpl(src,n).terms,map={},used=new Set(),labels=[],pair=new Map();
  // 同一排數量相同時照順序對應（舊版編輯器會把雙層擠成一排，位置已經不準）；否則找位置最近的
  ['top','bottom'].forEach(sd=>{const a=c.terms.filter(t=>t.side===sd),b=g.filter(t=>t.side===sd);if(a.length===b.length)a.forEach((t,i)=>pair.set(t,b[i]));});
  c.terms.forEach(ct=>{
    let best=pair.get(ct)||null,bd=Infinity;
    if(best&&used.has(best.id)) best=null;
    if(!best) g.forEach(gt=>{if(used.has(gt.id))return;const q=(gt.x-ct.x)**2+(gt.y-ct.y)**2;if(q<bd){bd=q;best=gt;}});
    if(!best) return;
    used.add(best.id);if(map[ct.id]===undefined) map[ct.id]=best.id; // 編號重複時，導線原本接的是第一個
    const m=SLOT_RE.exec(best.id),i=m?m[1]-1:-1,lb=(/^(.+?)[A-D]$/.exec(ct.id)||[0,ct.id])[1];
    if(i>=0&&!labels[i]&&lb!==String(i+1)) labels[i]=lb;
  });
  S.wires.forEach(w=>[w.a,w.b].forEach(e=>{if(e.d===d.id&&map[e.t]!==undefined)e.t=map[e.t];}));
  d.tpl=src;d.count=n;
  const L=Array.from({length:n},(_,i)=>labels[i]||'');
  if(L.some(Boolean)) d.labels=L; else delete d.labels;
}
/* 端子台：每片一格端子號 */
function slotHtml(d){
  const n=d.count||resolveTpl(d.tpl).cnt,L=d.labels||[];
  let h='';for(let i=0;i<n;i++) h+=`<label><span>${i+1}</span><input data-slot="${i}" maxlength="10" value="${esc(L[i]||'')}" placeholder="${i+1}" aria-label="第 ${i+1} 片端子號"></label>`;
  return `<div><div class="sub-h">端子號（每片一格，空白就顯示原編號）</div><div class="slots">${h}</div>
    <div class="row" style="justify-content:flex-start;align-items:center;margin-top:6px"><button class="tool" id="slotSeq">依序編號</button><span class="note">從</span><input id="slotFrom" type="number" value="1" step="1" aria-label="起始號碼" style="width:64px;border:1px solid var(--line);background:var(--panel-2);border-radius:5px;padding:4px 6px;font-family:var(--mono);font-size:12.5px"><button class="tool" id="slotClr">清除端子號</button></div></div>`;
}
/* 接線盒的短路片：勾選幾個接點設為同電位；已設的組列出來可以刪除 */
function linkHtml(d){
  const t=tplOf(d),G=d.links||[],lb=id=>esc(termLabel(d,id));
  const list=G.map((g,k)=>`<div class="jrow"><span>同電位：${g.map(lb).join('、')}</span><button class="tool" data-lkdel="${k}">刪除</button></div>`).join('');
  const inG=id=>G.findIndex(g=>g.includes(id));
  const chips=t.terms.map(p=>{const k=inG(p.id);return `<label class="lk${k>=0?' on':''}" title="${k>=0?'已在第 '+(k+1)+' 組':''}"><input type="checkbox" data-lk="${esc(p.id)}">${lb(p.id)}${k>=0?`<sup>${k+1}</sup>`:''}</label>`;}).join('');
  return `<div><div class="hrow"><span class="sub-h" style="display:inline">短路片（同電位）</span> ${hq('lk')}</div>${hn('lk','勾選要接在一起的接點，按「設為同電位」。同一組的接點算同一個電位：建線時沿用線號、網路檢查都會當成相通。勾到已經在某一組的接點，會併進那一組。')}
    ${list||'<p class="note">還沒有短路片，每個接點各自獨立。</p>'}
    <div class="lks">${chips}</div><div class="row" style="justify-content:flex-start;margin-top:6px"><button class="tool" id="lkAdd">設為同電位</button><span class="note">勾 2 個以上</span></div></div>`;
}
/* 短路片：選起始片與規格加入，列出已加的可刪除 */
function jumperHtml(d){
  const n=d.count||resolveTpl(d.tpl).cnt,J=(d.jumpers||[]).slice().sort((a,b)=>(a.row||1)-(b.row||1)||a.at-b.at);
  const lb=i=>esc(termLabel(d,i+'A').replace(/A$/,'')||String(i));
  const list=J.map((j,k)=>`<div class="jrow"><span>${j.row===2?'下排':'上排'}　第 ${j.at}～${j.at+j.p-1} 片（${lb(j.at)}～${lb(j.at+j.p-1)}）　${j.p}P</span><button class="tool" data-jdel="${d.jumpers.indexOf(j)}">刪除</button></div>`).join('');
  return `<div><div class="sub-h">短路片（每片有上下兩排插槽；接起來的幾片算同一個電位）</div>${list||'<p class="note">還沒有短路片。</p>'}
    <div class="row" style="justify-content:flex-start;align-items:center;margin-top:6px"><span class="note">從第</span><input id="jAt" type="number" min="1" max="${n}" value="1" aria-label="起始片" style="width:56px;border:1px solid var(--line);background:var(--panel-2);border-radius:5px;padding:4px 6px;font-family:var(--mono);font-size:12.5px"><span class="note">片</span>
    <select id="jRow" aria-label="插槽"><option value="1">上排</option><option value="2">下排</option></select><select id="jP" aria-label="短路片規格">${[2,3,4,5].map(p=>`<option value="${p}">${p}P</option>`).join('')}</select><button class="tool" id="jAdd">加入</button></div></div>`;
}
function setSlots(d,L){
  while(L.length&&!L[L.length-1])L.pop();
  if(L.length)d.labels=L;else delete d.labels;
  commit();renderBoard();renderWires();renderList();renderOverlay(); // 不重畫右側，讓 Tab 可以接著填下一格
}
function renderStats(){
  let t=0;ROUTES.forEach(r=>{t+=r.len;});
  $('stats').textContent=`${S.devices.length} 器具 · ${S.wires.length} 線 · 共 ${(t/1000).toFixed(1)} m`+(ISSUES.length?` · ${ISSUES.length} 項待處理`:'');
}
function updateHint(){
  if(typeof renderCabBar==='function')renderCabBar();
  let s,k;
  if(mode==='sim'){k='sim';s='模擬模式：按著按鈕、感測器才算按下；點斷路器切換 ON／OFF；右側可以切換 PLC 輸出、跑自動測試。拖曳空白處平移。';}
  else if(typeof noteAdd!=='undefined'&&noteAdd){k='note';s='放審查註記：在圖面上點一下要註記的位置；按 Esc 取消。';}
  else if(mode==='view'){k='view';s='檢視模式：只能看，不能修改。點線或器具可看詳細資料，拖曳空白處平移；按 W 回到接線、M 回到擺放。';}
  else if(mode==='place'){k=picked||multi.length?'place-picked':'place';s=(k==='place-picked'?'拖曳可移動，方向鍵或右側按鈕可依輸入距離移動，按 R 可旋轉，導線會自動重算；拖進面板或現場區會跟著換位置。Delete 可刪除。':'拖曳器具、線槽或出線口來擺放；左側可新增器具。')+(typeof opPref==='function'&&opPref().drag==='old'?'Shift＋點或 Shift＋拖曳框選可多選，':'拖曳空白處框選（由左往右只選完全框住的，由右往左碰到就選），Shift＋點加入或移出，')+'Ctrl＋A 全選；Ctrl＋拖曳可複製，Ctrl＋C／Ctrl＋V 複製貼上。拖到 H-66 鋁軌上會自動對齊並靠齊相鄰器具，按住 Alt 不吸附。';}
  else if(cabPick&&cabHint()){k='wire-cab';s=cabHint();}
  else if(draft&&draft.pop){k='wire-pop';s='選好線號、線徑與顏色後按 Enter 建立，Esc 取消。';}
  else if(draft){k='wire-draft';s=`起點 ${epText(draft.a)}：點接點完成；點空白處加中繼點`+(draft.wps.length?`（已有 ${draft.wps.length} 個，Backspace 退回）`:'')+`；外線可點出線口指定走哪個${draft.gland?`（目前走 ${draft.gland}）`:''}；按住 Alt 可不吸附，Esc 取消。`;}
  else if(selCab&&mode==='wire'){k='cab-sel';s='雙擊電纜外皮可加中繼點；拖曳白點可調整，雙擊白點可刪除；拖曳白色小方塊可移動剝線點。';}
  else if(sel){k='wire-sel';s='雙擊這條線可加中繼點；拖曳白點可調整，雙擊白點可刪除；線號可以沿著線拖曳。';}
  else{k='wire';s='滑鼠靠近接點會自動吸附放大，點一下開始接線。接到現場區就是外線，接到面板就會走過門線束。';}
  $('hintT').textContent=s;helpAuto(k);
}
// 不自動跳出：遇到還沒看過的情況，「? 說明」按鈕上出現小紅點；點開看過就記在瀏覽器，紅點消失
let helpKey=null;
function helpSeen(){try{return new Set(JSON.parse(localStorage.getItem('wiring-sim-help-seen')||'[]'));}catch(_){return new Set();}}
function helpMark(k){const s=helpSeen();s.add(k);try{localStorage.setItem('wiring-sim-help-seen',JSON.stringify([...s]));}catch(_){}}
function setHelp(open){$('helpP').hidden=!open;$('helpB').setAttribute('aria-expanded',open);if(open){helpMark(helpKey);helpDot();}}
function helpDot(){const n=!helpSeen().has(helpKey);$('helpB').classList.toggle('new',n);$('helpB').title=n?'有新的操作提示':'操作提示';}
function helpAuto(k){if(k===helpKey)return;helpKey=k;if(!$('helpP').hidden)helpMark(k);helpDot();}

/* 左欄（盤面設定、器具庫）：可收合成窄條。各模式記住自己的狀態，預設擺放展開、接線與檢視收合。
   收合或展開時圖面寬度會變，手動縮放過的畫面會補償平移，圖上的東西留在原本的螢幕位置 */
function leftPrefs(){const d={wire:true,view:true,place:false,sim:true};try{return Object.assign(d,JSON.parse(localStorage.getItem('wiring-sim-left')||'{}'));}catch(_){return d;}}
function setLeft(collapsed,save){
  const m=document.querySelector('main'),before=$('stage').getBoundingClientRect().left;
  m.classList.toggle('lc',!!collapsed);
  const after=$('stage').getBoundingClientRect().left;
  if(view.manual&&Math.abs(before-after)>.5){view.x+=before-after;applyView();}
  if(save){const p=leftPrefs();p[mode]=!!collapsed;try{localStorage.setItem('wiring-sim-left',JSON.stringify(p));}catch(_){}}
}
/* 檢視模式：只能看。會改到資料的按鈕停用，右側詳細資料的欄位反灰 */
const VIEW_LOCK=['undo','redo','clearB','importB','setOpen','newTpl','sample'];
function setMode(m){
  if(m!=='wire'){cabPick=null;cabPickCore=null;}mode=m;$('mWire').setAttribute('aria-pressed',m==='wire');$('mPlace').setAttribute('aria-pressed',m==='place');$('mView').setAttribute('aria-pressed',m==='view');$('mSim').setAttribute('aria-pressed',m==='sim');if(m==='sim'&&!SIMST)simEnter();if(m!=='sim'&&SIMST)simLeave();
  draft=null;closePop();snap=null;hoverW=null;picked=null;multi=[];sel=m!=='place'?sel:null;$('tip').hidden=true;
  document.body.classList.toggle('viewing',m==='view'||m==='sim');document.body.classList.toggle('simming',m==='sim');$('viewTag').hidden=m!=='view';
  VIEW_LOCK.forEach(id=>{const el=$(id);if(el)el.disabled=m==='view'||m==='sim';});
  if(m!=='view'&&m!=='sim')syncUndo();
  try{localStorage.setItem('wiring-sim-mode',m);}catch(_){}
  setLeft(leftPrefs()[m]);
  applyView();renderWires();renderList();renderDetail();updateHint();
}
function lockInputs(root){if(mode==='view')root.querySelectorAll('input,select,textarea,button:not([data-pw])').forEach(el=>el.disabled=true);}


// 接點別名：內建器具依公司習慣改接點的顯示名稱（線照樣接在原本的接點上，器具的尺寸、動作、模擬都不變）
function aliasHtml(d,t){
  const ids=[...new Set(t.terms.map(x=>x.id))],n=d.alias?Object.keys(d.alias).length:0;
  return `<details class="alias"${n?' open':''}><summary>接點別名${n?`（已改 ${n} 個）`:''}</summary><p class="note">只改顯示名稱，線、尺寸、模擬動作都不變；空白就是原本的名稱。端子台請用片上標籤。</p>
  <div class="alias-g">${ids.map(id=>{const td=t.terms.find(x=>x.id===id);return `<label title="${esc(td.desc||'')}"><span>${esc(id)}</span><input data-alias="${esc(id)}" maxlength="12" value="${esc((d.alias&&d.alias[id])||'')}" placeholder="${esc(id)}"></label>`;}).join('')}</div></details>`;
}

// 器具庫：同一分類裡，有系列的器具收進「廠牌 系列（數量）」群組，展開才列出；搜尋時自動展開。沒有系列的照原本列出
function serGroups(list,cus,open){
  const plain=list.filter(([,t])=>!t.ser),by=new Map();
  list.filter(([,t])=>t.ser).forEach(e=>{const k=(e[1].b?e[1].b+' ':'')+e[1].ser;if(!by.has(k))by.set(k,[]);by.get(k).push(e);});
  return plain.map(e=>cus(e)).join('')+[...by].map(([k,es])=>`<details class="ser"${open||es.length<=3?' open':''}><summary>${esc(k)}<small>${es.length}</small></summary>${es.sort((a,b)=>natCmp(a[1].n,b[1].n)).map(e=>cus(e)).join('')}</details>`).join('');
}

/* ---------- 底座插槽：基板的槽位表、模組的槽位與位址 ---------- */
// 能裝在某種槽的器具（內建＋自訂），依名稱排序
const rackTpls=k=>Object.keys({...TPL,...(S.tpls||{})}).filter(id=>{const t=resolveTpl(id);return t&&t.rackKind===k;}).sort((a,b)=>resolveTpl(a).n.localeCompare(resolveTpl(b).n));
function rackHtml(d){
  const t=tplOf(d),use=rackUse(d);
  const rows=t.rack.map((s,i)=>{const m=use.get(i);
    if(m&&m.rack!==i)return '';
    const mt=m&&tplOf(m),a=m&&qAddr(m),n=m?rackN(mt):1;
    const nm=`${rackName(t,i)}${n>1?'～'+rackName(t,i+n-1):''}`;
    const addr=s.k==='io'?(a?`${qHex(a.start)}～${qHex(a.start+a.n-1)}`:`${qHex(qAddrAt(d,i))}～${qHex(qAddrAt(d,i)+15)}`):'';
    const body=m?`<button class="tool rack-mod" data-rack-pick="${m.id}">${esc(m.tag)}　${esc(mt.n)}</button>`
      :`<select data-rack-add="${i}" aria-label="${esc(nm)} 槽裝模組"><option value="">空槽（選模組裝上）</option>${rackTpls(s.k).map(id=>`<option value="${id}">${esc(resolveTpl(id).n)}</option>`).join('')}</select>`;
    return `<tr><th>${esc(nm)}</th><td>${body}</td><td class="mono">${addr}</td></tr>`;}).join('');
  return `<div class="sub-h">槽位（I/O 位址依槽位自動編號，空槽算 16 點）</div><table class="rack-tb"><thead><tr><th>槽</th><th>模組</th><th>位址</th></tr></thead><tbody>${rows}</tbody></table><p class="note">從器具庫把模組拖到基板上會自動吸到最近的空槽；選取基板時點器具庫的模組會裝到第一個空槽。</p>`;
}
// 空槽的起始位址（給槽位表顯示）
function qAddrAt(h,i){const R=tplOf(h).rack||[],use=rackUse(h);let a=0;for(let j=0;j<i;j++){if(!R[j]||R[j].k!=='io')continue;const m=use.get(j);if(!m)a+=16;else if(m.rack===j)a+=tplOf(m).qpts||16*rackN(tplOf(m));}return a;}
function rackInfo(d){
  const h=d.on&&devOf(d.on);if(!h||d.rack==null)return `<p class="note">${esc(RACK_KIND[tplOf(d).rackKind])}模組：拖到基板上會裝進${esc(RACK_KIND[tplOf(d).rackKind])}槽${tplOf(d).rackKind==='io'?'，位址依槽位自動編號':''}。</p>`;
  const a=qAddr(d);
  return `<dl><dt>裝在</dt><dd>${esc(h.tag)} 的 ${esc(rackName(tplOf(h),d.rack))}${tplOf(d).rackKind==='io'?' 槽':' 槽位'}</dd>${a?`<dt>位址</dt><dd class="mono">${qHex(a.start)}～${qHex(a.start+a.n-1)}</dd>`:''}</dl>`;
}
function rackAdd(h,i,id){
  const base=resolveTpl(id);let k=1;while(tagUsed(base.pre+k))k++;
  const d={id:base.pre+k,tag:base.pre+k,tpl:id,sheet:h.sheet,x:h.x,y:h.y,on:h.id,rack:i};
  if(h.zone)d.zone=h.zone;
  if(!rackFit(h,d,i)){toast('這一槽放不下這個模組');renderDetail();return;}
  S.devices.push(d);placeOn(d,h);commit();recompute();renderDetail();toast(`已把 ${d.tag} 裝到 ${h.tag} 的 ${rackName(tplOf(h),i)} 槽`);
}

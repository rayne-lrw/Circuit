"use strict";
/* ---------- 面板 ---------- */
function libButton(id,t){
  const size=t.gen?t.cntLabel:(+t.w.toFixed(1)+'×'+t.h);
  return `<button class="lib" data-add="${id}" title="${esc(verText(id,t))}"><span class="nm">${esc(t.n)}</span><small>${size}</small><span class="bd">${esc(t.b)||'—'}</span></button>`;
}
function renderPalette(){
  const q=$('libQ').value.trim().toLowerCase();
  const match=t=>!q||[t.n,t.b].join(' ').toLowerCase().includes(q);
  const custom=S.tpls||{},cats={},all=[...Object.entries(TPL).filter(([id,t])=>!t.legacy&&!custom[id]),...Object.entries(custom)];
  all.forEach(([id,t])=>{if(match(t))(cats[t.cat]=cats[t.cat]||[]).push([id,t]);});
  const order=['自訂器具',C1,C2,C3,C4,C5,C6,C7,C8,C9,D1,F1,F2,F3];
  let h='';
  // 自訂器具：每一個旁邊有編輯、複製、刪除
  const cus=([id,t])=>custom[id]&&mode!=='view'?`<div class="lib-c">${libButton(id,t)}<span class="lib-act"><button class="tool sm" data-tpl-ed="${id}" title="編輯這個器具（已放的會一起更新）">編輯</button><button class="tool sm" data-tpl-cp="${id}" title="複製成新器具">複製</button><button class="tool sm danger" data-tpl-del="${id}" title="${TPL[id]?'換回原廠':'刪除'}">${TPL[id]?'換回原廠':'刪除'}</button></span></div>`:libButton(id,t);
  order.forEach(c=>{if(cats[c]) h+=`<div class="brand"><h2>${c}</h2>${cats[c].map(e=>cus(e)).join('')}</div>`;});
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
  [['tabAll','all'],['tabExt','ext'],['tabBom','bom'],['tabLen','len']].forEach(([id,t])=>$(id).setAttribute('aria-pressed',tab===t));
  $('listCsv').textContent=`匯出${{all:'線號表',ext:'電纜表',bom:'材料表',len:'線長統計'}[tab]} CSV`;
  $('filters').hidden=tab!=='all';
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
    box.innerHTML=`<div class="fields"><label for="wNo" style="grid-column:1/-1">線號（可以重複，同電位可用同一個號碼）<input id="wNo" maxlength="16" value="${esc(w.no)}" style="font-size:15px;font-weight:600"></label></div>
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
      box.innerHTML=`<div class="fields"><label for="dTag" style="grid-column:1/-1">器具編號<input id="dTag" maxlength="16" value="${esc(d.tag)}" style="font-size:15px;font-weight:600"></label></div>${sw?`<div class="revert"><p class="note">${esc(so.to)} 已經是另一台器具（${esc(tplOf(sw).b)} ${esc(tplOf(sw).n)}）的編號，要把兩台的編號互換嗎？（${esc(d.tag)} ↔ ${esc(so.to)}）</p><div class="row" style="justify-content:flex-start"><button class="tool" id="swapGo">互換</button><button class="tool" id="swapNo">取消</button></div></div>`:''}<dl><dt>器具</dt><dd>${esc(t.b)} ${esc(t.n)}</dd><dt>尺寸</dt><dd>${+t.w.toFixed(1)} × ${+t.h.toFixed(1)} × ${t.d} mm</dd><dt>核對</dt><dd>尺寸 ${esc(verText(d.tpl,t))}；接點${t.ok?'已對照':TERM_OK.has(d.tpl)?'依照片或外型圖':'未核對'}</dd>${d.rot?`<dt>旋轉</dt><dd>${d.rot}°</dd>`:''}<dt>位置</dt><dd>${d.sheet==='door'?doorShort():d.sheet==='field'?esc(devRef(d).name||'現場'):'底板'}　X ${d.x}　Y ${d.y}</dd><dt>接線</dt><dd>${n} 條</dd>${d.on&&devOf(d.on)?`<dt>裝在</dt><dd>${esc(devOf(d.on).tag)} ${t.attach==='below'&&!batFront(d,devOf(d.on))?'下方':'正面'}　<button class="tool" id="detachAux" style="padding:2px 8px">拆下</button></dd>`:t.attach?`<dt>安裝</dt><dd style="font-family:var(--sans)">拖到${t.attach==='below'?'伺服驅動器':'電磁接觸器'}上就會裝上去</dd>`:''}${riders(d).length?`<dt>正面附件</dt><dd>${riders(d).map(r=>esc(r.tag)).join(' ')}</dd>`:''}${t.noOv?`<dt>軌上器具</dt><dd>${mountedOn(d).map(x=>esc(x.tag)).join(' ')||'無'}</dd>`:''}${gapsOf(d)}${t.note?`<dt>備註</dt><dd>${esc(t.note)}</dd>`:''}</dl>
      ${t.model?`<div class="fields"><label for="dModel" style="grid-column:1/-1">型號（材料表照這個列，空白就寫「二極體」）<input id="dModel" maxlength="30" value="${esc(d.model||'')}" placeholder="例如 1N4007"></label></div>`:''}
      ${(d.sheet==='field'||outBox({dev:d.id,sheet:d.sheet}))&&S.glands.length?`<div class="fields"><label for="dGland" style="grid-column:1/-1">預設出線口（接到這台的外線、電纜都走這個）<select id="dGland"><option value="">自動選最近</option>${S.glands.map(g=>`<option value="${g.id}"${d.gland===g.id?' selected':''}>${esc(g.id)}　${esc(g.spec)}</option>`).join('')}</select></label></div>`:''}
      ${t.sym==='diode'?`<label class="check"><input type="checkbox" id="dShowNo"${d.hideNo?'':' checked'}>顯示接到這個二極體的線號</label>`:''}
      ${coilOf(d)?`<label class="check"><input type="checkbox" id="dCoilSwap"${d.coilSwap?' checked':''}>線圈極性對調（目前 ${esc(coilOf(d).p)} 是 +、${esc(coilOf(d).m)} 是 −）</label>`:''}
      ${t.gen?`<div class="fields"><label for="dCount">${esc(t.cntLabel)}<input id="dCount" type="number" min="1" value="${d.count||t.cnt}"></label></div>`:''}
      ${t.userLinks?linkHtml(d):''}${hasSlots(t)?slotHtml(d)+(t.jumper?jumperHtml(d):''):slotSource(d)?`<div class="revert"><p class="note">這組端子台之前用「編輯器具」改過，變成了自訂器具，所以不能每片填端子號，也不能改片數。換回 WAGO 端子台後，原本改的編號會變成每片的端子號，接好的線都會保留。</p><button class="tool" id="slotRevert">換回 ${esc(TPL[slotSource(d)].n)}</button></div>`:''}
      ${t.terms.length>1&&!hasSlots(t)?`<label class="check"><input type="checkbox" id="dBus"${busOf(d)?' checked':''}>全部接點本來就同電位（接地銅板、共點排）</label>`:''}
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
      <label for="zw">寬 (mm)<input id="zw" type="number" step="10" min="50" value="${z.w}"></label><label for="zh">高 (mm)<input id="zh" type="number" step="10" min="50" value="${z.h}"></label></div>
      ${moveHtml(false)}
      <div class="row"><button class="tool danger" id="delPicked">刪除現場區</button></div>`;
      $('zName').onchange=e=>{z.name=e.target.value.trim().slice(0,20)||z.id;commit();recompute();};
      const mvz=(dx,dy)=>{devs.forEach(d=>{d.x=r1(d.x+dx);d.y=r1(d.y+dy);});z.x=r1(z.x+dx);z.y=r1(z.y+dy);};
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
  if(mode==='view'){k='view';s='檢視模式：只能看，不能修改。點線或器具可看詳細資料，拖曳空白處平移；按 W 回到接線、M 回到擺放。';}
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
function leftPrefs(){const d={wire:true,view:true,place:false};try{return Object.assign(d,JSON.parse(localStorage.getItem('wiring-sim-left')||'{}'));}catch(_){return d;}}
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
  if(m!=='wire'){cabPick=null;cabPickCore=null;}mode=m;$('mWire').setAttribute('aria-pressed',m==='wire');$('mPlace').setAttribute('aria-pressed',m==='place');$('mView').setAttribute('aria-pressed',m==='view');
  draft=null;closePop();snap=null;hoverW=null;picked=null;multi=[];sel=m!=='place'?sel:null;$('tip').hidden=true;
  document.body.classList.toggle('viewing',m==='view');$('viewTag').hidden=m!=='view';
  VIEW_LOCK.forEach(id=>{const el=$(id);if(el)el.disabled=m==='view';});
  if(m!=='view')syncUndo();
  try{localStorage.setItem('wiring-sim-mode',m);}catch(_){}
  setLeft(leftPrefs()[m]);
  applyView();renderWires();renderList();renderDetail();updateHint();
}
function lockInputs(root){if(mode==='view')root.querySelectorAll('input,select,textarea,button:not([data-pw])').forEach(el=>el.disabled=true);}


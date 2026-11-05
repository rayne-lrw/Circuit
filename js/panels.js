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
  order.forEach(c=>{if(cats[c]) h+=`<div class="brand"><h2>${c}</h2>${cats[c].map(([id,t])=>libButton(id,t)).join('')}</div>`;});
  const ductRows=DUCTINV.filter(([n,m])=>!q||(n+m).toLowerCase().includes(q)).map(([n,m,w,d])=>`<button class="lib" data-duct-add="h" data-dw="${w}" data-dd="${d}"><span class="nm">${n} 水平</span><small>寬 ${w}</small><span class="bd">${m}</span></button><button class="lib" data-duct-add="v" data-dw="${w}" data-dd="${d}"><span class="nm">${n} 垂直</span><small>寬 ${w}</small><span class="bd">${m}</span></button>`).join('');
  if(ductRows) h+=`<div class="brand"><h2>線槽</h2>${ductRows}</div>`;
  const glandRows=GLANDINV.filter(n=>!q||n.toLowerCase().includes(q)).map(n=>`<button class="lib" data-gland-add="${esc(n)}"><span class="nm">${esc(n)}</span><small>出線口</small></button>`).join('');
  if(glandRows) h+=`<div class="brand"><h2>出線口（箱底）</h2>${glandRows}</div>`;
  if(!q||'現場區'.includes(q)) h+=`<div class="brand"><h2>現場區</h2><button class="lib" data-zone-add=""><span class="nm">新增現場區</span><small>可移動</small><span class="bd">依機台或區域分開放現場設備</span></button></div>`;
  const rest=INV.filter(r=>!q||r.join(' ').toLowerCase().includes(q));
  const groups={};rest.forEach(r=>(groups[r[0]]=groups[r[0]]||[]).push(r));
  if(rest.length){
    h+=`<details${q?' open':''}><summary>其他電料，不畫成器具（${rest.length} 項）</summary>`+Object.entries(groups).map(([g,rs])=>`<h2 style="margin-top:8px">${esc(g)}</h2>`+rs.map(r=>`<div class="inv-row"><span>${esc(r[1])}${r[2]&&r[2]!==r[1]?`　${esc(r[2])}`:''}</span><span>${esc(r[3])}</span></div>`).join('')).join('')+`</details>`;
  }
  h+=`<p class="note">滑鼠停在器具上可看尺寸來源。接點只對到實物的區塊與順序，選取器具後可按「編輯器具」修正。</p>`;
  $('palette').innerHTML=h||'<p class="note">找不到符合的器具。</p>';
}
function renderFilters(){
  $('fKind').innerHTML=Object.entries(KINDS).map(([k,n])=>`<button class="chip" data-fk="${k}" aria-pressed="${filt.kind===k}" style="font-family:var(--sans)">${n} ${S.wires.filter(w=>wireKind(w)===k).length}</button>`).join('');
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
  return `<button class="w${sel===w.id?' sel':''}" data-wl="${w.id}"><span class="sw" style="background:${swatch(c)}"></span><span>${w.no}</span><span class="ep">${esc(w.a.d)}·${esc(w.a.t)} → ${esc(w.b.d)}·${esc(w.b.t)}</span><span class="g">${r&&r.warn?'<span class="flag">注意</span>':w.gauge}</span></button>`;
}
function renderList(){
  renderFilters();
  [['tabAll','all'],['tabExt','ext'],['tabBom','bom'],['tabLen','len']].forEach(([id,t])=>$(id).setAttribute('aria-pressed',tab===t));
  $('listCsv').textContent=`匯出${{all:'線號表',ext:'外線表',bom:'材料表',len:'線長統計'}[tab]} CSV`;
  $('filters').hidden=tab==='bom'||tab==='len';
  if(tab==='bom'){renderBom();return;}
  if(tab==='len'){renderLen();return;}
  if(tab==='ext'){
    const ex=S.wires.filter(w=>wireKind(w)==='ext'&&passes(w)),by=new Map();
    ex.forEach(w=>{const k=(w.ext&&w.ext.cable)||'未編號';if(!by.has(k))by.set(k,[]);by.get(k).push(w);});
    $('listH').textContent=`外線表　${by.size} 條電纜、${ex.length} 芯`;
    $('list').innerHTML=[...by].sort((a,b)=>a[0].localeCompare(b[0])).map(([k,ws])=>{
      const fw=ws[0],fd=devOf(fw.a.d).sheet==='field'?fw.a.d:fw.b.d,g=ROUTES.get(fw.id)?.gland;
      const zn=zoneOf(devOf(fd));
      return `<div class="cable-h">${esc(k)} → ${esc(fd)}${zn?`（${esc(zn.name)}）`:''}${g?` · ${esc(g)}`:''}<br><span class="note">${esc(specName(fw.ext&&fw.ext.spec))}</span></div>`+ws.map(wireRow).join('');
    }).join('')||`<p class="note">還沒有外線。從箱內接點點到「現場設備」區的接點就會建立外線。</p>`;
    return;
  }
  const rows=S.wires.filter(passes);
  $('listH').textContent=`線號表　${rows.length} / ${S.wires.length} 條`;
  $('list').innerHTML=rows.map(wireRow).join('')||`<p class="note">沒有符合條件的線。</p>`;
}
function stockMsg(g,colorKey){
  const c=keyColor(colorKey).n;
  const r=INV.find(x=>x[0]==='CSA細芯控制電線'&&x[1].startsWith(g+'mm²')&&x[1].split(/\s+/)[1]===c);
  return r?`電料清單有這個線材：${r[0]} ${r[1]}`:'電料清單沒有這個線徑與顏色';
}
const cableOptions=(cur)=>{
  const list=INV.filter(r=>r[0].includes('細纜')||r[0].startsWith('伺服動力線')||r[0].startsWith('伺服編碼線')||r[0].startsWith('伺服煞車線'));
  return `<option value="">未指定</option>`+list.map(r=>{const v=`${r[0]} ${r[1]}`;return `<option value="${esc(v)}"${cur===v?' selected':''}>${esc(v)}</option>`;}).join('');
};
function renderDetail(){
  const box=$('detail');
  if(sel){
    const w=S.wires.find(x=>x.id===sel),r=ROUTES.get(sel);
    if(!w||!r){sel=null;box.hidden=true;return;}
    const c=colorOf(w),kind=wireKind(w);
    box.hidden=false;
    box.innerHTML=`<div class="big"><span class="sw" style="background:${swatch(c)}"></span> ${w.no}　${esc(c.n)}　${w.gauge} mm²　${KINDS[kind]}</div>
    <dl><dt>起點</dt><dd>${esc(w.a.d)}·${esc(w.a.t)}</dd><dt>終點</dt><dd>${esc(w.b.d)}·${esc(w.b.t)}</dd><dt>路徑</dt><dd>${r.via.length?esc(r.via.join(' → ')):'直接跨接'}${r.gland?' → '+esc(r.gland):''}</dd><dt>中繼點</dt><dd>${w.wps.length} 個</dd><dt>圖面線長</dt><dd>${(r.len/1000).toFixed(2)} m</dd></dl>
    ${r.warn?`<span class="flag">${esc(r.warn)}：請加中繼點或調整線槽</span>`:''}
    ${kind==='ext'?`<div class="fields"><label for="xCable">電纜編號<input id="xCable" maxlength="12" value="${esc((w.ext&&w.ext.cable)||'')}"></label><label for="xCore">芯線<input id="xCore" maxlength="10" value="${esc((w.ext&&w.ext.core)||'')}"></label>
      <label for="xSpec" style="grid-column:1/-1">電纜規格<select id="xSpec">${cableOptions(w.ext&&w.ext.spec)}</select></label>
      <label for="xGland" style="grid-column:1/-1">出線口<select id="xGland"><option value="">自動選最近</option>${S.glands.map(g=>`<option value="${g.id}"${w.gland===g.id?' selected':''}>${esc(g.id)}</option>`).join('')}</select></label></div>`:''}
    <div><div class="sub-h">線徑 mm²</div><div class="chips">${GAUGES.map(([g])=>`<button class="chip" data-dg="${g}" aria-pressed="${w.gauge===g}">${g}</button>`).join('')}</div></div>
    <div><div class="sub-h">顏色</div>${colorChips(w.color,'dn',w)}</div>
    <p class="note">${esc(stockMsg(w.gauge,w.color))}</p>
    <div class="row">${w.wps.length?'<button class="tool" id="clearWp">清除中繼點</button>':''}<button class="tool danger" id="delWire">刪除這條線</button></div>`;
    if(kind==='ext'){
      const upd=(fn)=>e=>{w.ext=w.ext||{cable:'',core:'',spec:''};fn(e.target.value);commit();recompute();};
      $('xCable').onchange=upd(v=>w.ext.cable=v.slice(0,12));$('xCore').onchange=upd(v=>w.ext.core=v.slice(0,10));$('xSpec').onchange=upd(v=>w.ext.spec=v);
      $('xGland').onchange=e=>{if(e.target.value)w.gland=e.target.value;else delete w.gland;commit();recompute();};
    }
    return;
  }
  if(picked){
    const b=pickedBox(); if(!b){picked=null;box.hidden=true;return;}
    box.hidden=false;
    if(picked.k==='dev'){
      const d=devOf(picked.id),t=tplOf(d),n=S.wires.filter(w=>w.a.d===d.id||w.b.d===d.id).length;
      box.innerHTML=`<div class="big">${esc(d.tag)}</div><dl><dt>器具</dt><dd>${esc(t.b)} ${esc(t.n)}</dd><dt>尺寸</dt><dd>${+t.w.toFixed(1)} × ${+t.h.toFixed(1)} × ${t.d} mm</dd><dt>核對</dt><dd>尺寸 ${esc(verText(d.tpl,t))}；接點${t.ok?'已對照':TERM_OK.has(d.tpl)?'依照片或外型圖':'未核對'}</dd>${d.rot?`<dt>旋轉</dt><dd>${d.rot}°</dd>`:''}<dt>位置</dt><dd>${d.sheet==='door'?'面板':d.sheet==='field'?esc(devRef(d).name||'現場'):'底板'}　X ${d.x}　Y ${d.y}</dd><dt>接線</dt><dd>${n} 條</dd>${t.noOv?`<dt>軌上器具</dt><dd>${mountedOn(d).map(x=>esc(x.tag)).join(' ')||'無'}</dd>`:''}${gapsOf(d)}${t.note?`<dt>備註</dt><dd>${esc(t.note)}</dd>`:''}</dl>
      ${t.gen?`<div class="fields"><label for="dCount">${esc(t.cntLabel)}<input id="dCount" type="number" min="1" value="${d.count||t.cnt}"></label></div>`:''}
      <div class="fields"><label for="dX">X（距${d.sheet==='door'?'面板':d.sheet==='field'?esc(devRef(d).name||'現場區'):'底板'}左緣）<input id="dX" type="number" step="1" value="${r1(d.x-devRef(d).x)}"></label><label for="dY">Y（距上緣）<input id="dY" type="number" step="1" value="${r1(d.y-devRef(d).y)}"></label></div>${moveHtml(false)}
      <div class="row"><button class="tool" id="rotDev">旋轉 90°</button><button class="tool" id="editTpl">編輯器具</button><button class="tool danger" id="delPicked">刪除器具${n?`與 ${n} 條線`:''}</button></div>`;
      ['X','Y'].forEach(c=>{$('d'+c).onchange=e=>{const v=Number(e.target.value);if(e.target.value===''||!isFinite(v))return;const R=devRef(d),mt=mountedOn(d),ox=d.x,oy=d.y;if(c==='X')d.x=r1(R.x+v);else d.y=r1(R.y+v);shiftAll(mt,d.x-ox,d.y-oy,d.sheet);commit();recompute();};});
      if(t.gen) $('dCount').onchange=e=>{const v=Number(e.target.value);if(!(v>=1))return;const before=S.wires.length;d.count=Math.min(t.cntLabel.includes('mm')?2000:96,Math.round(v));commit();recompute();snapshotPrev=JSON.stringify(S);save();if(S.wires.length<before)toast(`接點變少，移除了 ${before-S.wires.length} 條線；可按復原`);};
    }else if(picked.k==='zone'){
      const z=S.fields.find(x=>x.id===picked.id),devs=S.devices.filter(d=>inZone(z,d)),bo=boxOrigin();
      box.innerHTML=`<div class="big">${esc(z.name)}</div><dl><dt>器具</dt><dd>${devs.map(d=>esc(d.tag)).join(' ')||'無'}</dd></dl>
      <div class="fields"><label for="zName" style="grid-column:1/-1">名稱<input id="zName" maxlength="20" value="${esc(z.name)}"></label>
      <label for="zx">X（距箱體左緣）<input id="zx" type="number" step="10" value="${r1(z.x-bo.x)}"></label><label for="zy">Y（距箱底）<input id="zy" type="number" step="10" value="${r1(z.y-bo.y-S.box.h)}"></label>
      <label for="zw">寬 (mm)<input id="zw" type="number" step="10" min="50" value="${z.w}"></label><label for="zh">高 (mm)<input id="zh" type="number" step="10" min="50" value="${z.h}"></label></div>
      ${moveHtml(false)}<p class="note">拖曳左上角的名稱可移動整區，區內器具會一起移動。現場區只是示意，位置不影響線長。</p>
      <div class="row"><button class="tool danger" id="delPicked">刪除現場區</button></div>`;
      $('zName').onchange=e=>{z.name=e.target.value.trim().slice(0,20)||z.id;commit();recompute();};
      const mvz=(dx,dy)=>{devs.forEach(d=>{d.x=r1(d.x+dx);d.y=r1(d.y+dy);});z.x=r1(z.x+dx);z.y=r1(z.y+dy);};
      $('zx').onchange=e=>{const v=Number(e.target.value);if(e.target.value===''||!isFinite(v))return;mvz(bo.x+v-z.x,0);commit();recompute();};
      $('zy').onchange=e=>{const v=Number(e.target.value);if(e.target.value===''||!isFinite(v))return;mvz(0,bo.y+S.box.h+v-z.y);commit();recompute();};
      ['w','h'].forEach(f=>{$('z'+f).onchange=e=>{const v=Number(e.target.value);if(!(v>=50))return;z[f]=Math.round(v);commit();recompute();};});
    }else if(picked.k==='gland'){
      const g=S.glands.find(x=>x.id===picked.id),n=[...ROUTES.values()].filter(r=>r.gland===g.id).length;
      box.innerHTML=`<div class="big">出線口 ${esc(g.id)}</div><dl><dt>規格</dt><dd>${esc(g.spec)}</dd><dt>外線</dt><dd>${n} 芯</dd><dt>X</dt><dd>${r1(g.x)}</dd></dl>${moveHtml(true)}<div class="row"><button class="tool danger" id="delPicked">刪除出線口</button></div>`;
    }else{
      const d=S.ducts.find(x=>x.id===picked.id);
      const u=DUCTUSE.get(d.id)||{n:0,pct:0,lanes:0};
      box.innerHTML=`<div class="big">線槽 ${esc(d.id)}　${u.n} 條　占用 ${u.pct}%</div><div class="fields">
      <label for="fx">X (mm)<input id="fx" type="number" step="5" value="${d.x}"></label><label for="fy">Y (mm)<input id="fy" type="number" step="5" value="${d.y}"></label>
      <label for="fw">寬 (mm)<input id="fw" type="number" step="5" min="10" value="${d.w}"></label><label for="fh">高 (mm)<input id="fh" type="number" step="5" min="10" value="${d.h}"></label>
      <label for="fdp">深 (mm)<input id="fdp" type="number" step="5" min="10" value="${d.dp||40}"></label></div>
      ${moveHtml(false)}<p class="note">占用率以導線外徑估算值計算最擠的一段。</p>
      <div class="row"><button class="tool danger" id="delPicked">刪除線槽</button></div>`;
      ['x','y','w','h','dp'].forEach(f=>{$('f'+f).onchange=e=>{const v=Number(e.target.value);if(!isFinite(v)||e.target.value==='')return;d[f]=(f==='x'||f==='y')?v:Math.max(10,v);commit();recompute();};});
    }
    return;
  }
  box.hidden=true;
}
function renderStats(){
  let t=0;ROUTES.forEach(r=>{t+=r.len;});
  $('stats').textContent=`${S.devices.length} 器具 · ${S.wires.length} 線 · 共 ${(t/1000).toFixed(1)} m`+(ISSUES.length?` · ${ISSUES.length} 項待處理`:'');
}
function updateHint(){
  let s='';
  if(mode==='place') s=(picked?'拖曳可移動，方向鍵或右側按鈕可依輸入距離移動，按 R 可旋轉，導線會自動重算；拖進面板或現場區會跟著換位置。Delete 可刪除。':'拖曳器具、線槽或出線口來擺放；左側可新增器具。')+'拖到 H-66 鋁軌上會自動對齊並靠齊相鄰器具，按住 Alt 不吸附。';
  else if(draft&&draft.pop) s='選好線徑與顏色後按 Enter 建立，Esc 取消。';
  else if(draft) s=`起點 ${draft.a.d}·${draft.a.t}：點接點完成；點空白處加中繼點`+(draft.wps.length?`（已有 ${draft.wps.length} 個，Backspace 退回）`:'')+`；按住 Alt 可不吸附，Esc 取消。`;
  else if(sel) s='雙擊這條線可加中繼點；拖曳白點可調整，雙擊白點可刪除。';
  else s='滑鼠靠近接點會自動吸附放大，點一下開始接線。接到現場區就是外線，接到面板就會走過門線束。';
  $('hintT').textContent=s;
}
function setMode(m){
  mode=m;$('mWire').setAttribute('aria-pressed',m==='wire');$('mPlace').setAttribute('aria-pressed',m==='place');
  draft=null;closePop();snap=null;hoverW=null;picked=null;sel=m==='wire'?sel:null;$('tip').hidden=true;
  applyView();renderWires();renderDetail();updateHint();
}


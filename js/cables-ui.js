"use strict";
/* ---------- 電纜操作：右側「電纜」分頁、電纜詳細資料與芯線表、接下一芯、剝線點拖曳 ---------- */
let cabForm=false;
// 芯線表：勾選的芯（一次改顏色）、正在選顏色的芯、電纜資料展開的分區
let coreSel=new Set(),coreSelCab=null,colPop=null;const cabSecOpen=new Set();
const specOptions=cur=>`<option value="">未指定</option>`+cableSpecs(cur).map(v=>`<option value="${esc(v)}"${cur===v?' selected':''}>${esc(v)}</option>`).join('')+`<option value="__new">自訂規格…</option>`;
const sideTags=(cw,k)=>[...new Set(cw.map(w=>tagOf(w[k].d)))].join('、')||'—';
const coreOrder=c=>w=>{const i=c.cores.findIndex(k=>k.n===w.core);return i<0?999:i;};
function selectCable(id){selCab=id;sel=null;picked=null;multi=[];coreEdit=null;}
function renderCables(){
  const cs=[...S.cables].sort((a,b)=>natCmp(a.no,b.no)),loose=S.wires.filter(w=>wireKind(w)==='ext'&&!isCable(w));
  $('listH').textContent=`電纜　${cs.length} 條`;
  let h=`<div class="hrow" style="margin-bottom:6px"><button class="tool" id="cabNew"${mode==='view'?' disabled':''}>${cabForm?'取消新增':'新增電纜'}</button>${hq('cab')}</div>${hn('cab','箱內的隔離線和接到現場的外部電纜都在這裡。點電纜可以看芯線表：每一芯可以用下拉選單選兩端接點，也可以按「在圖上接芯線」（或芯線表每一列的「圖上接」）直接在圖上點；接線時圖上會有工具列，可以跳過這一芯、回上一芯或完成。剝線點（白色小方塊）預設自動放在最近的線槽裡，拖曳可以移到別處（線槽裡任何位置都可以，包含靠線槽邊），移過的會變黃色。')}`;
  if(cabForm) h+=`<div class="fields cabform"><label for="nfNo">電纜編號<input id="nfNo" maxlength="12" value="${esc(nextCableNo())}"></label><label for="nfSpec" style="grid-column:1/-1">規格<select id="nfSpec">${specOptions('')}</select></label><label for="nfCustom" id="nfCustomL" style="grid-column:1/-1" hidden>自訂規格（例如 0.75mm²*7C 號碼、0.3mm²*2C 隔離 棕藍）<input id="nfCustom" maxlength="60"></label><div class="row" style="grid-column:1/-1;justify-content:flex-start"><button class="primary" id="nfOk">建立電纜</button></div></div>`;
  h+=cs.map(c=>{
    const cw=coresOf(c).sort((a,b)=>coreOrder(c)(a)-coreOrder(c)(b)),L=cabLen(c);
    return `<button class="cab-h${selCab===c.id?' sel':''}" data-cl="${c.id}"><b>${esc(c.no)}</b>　${L.ext?'外部':'箱內'} · ${cw.length}/${c.cores.length} 芯 · ${m1(L.total)} m<span class="note">${esc(specName(c.spec))}<br>${esc(sideTags(cw,'a'))} → ${esc(sideTags(cw,'b'))}</span></button>`+cw.map(wireRow).join('');
  }).join('')||'<p class="note">還沒有電纜。按「新增電纜」建立；從箱內接點接到現場區的接點時，也會自動編進電纜。</p>';
  if(loose.length) h+=`<div class="cable-h">沒有編入電纜的外線 ${loose.length} 條</div>`+loose.map(wireRow).join('');
  $('list').innerHTML=h;
  if(cabForm){
    $('nfSpec').onchange=e=>{$('nfCustomL').hidden=e.target.value!=='__new';if(e.target.value==='__new')$('nfCustom').focus();};
    $('nfOk').onclick=()=>{
      let spec=$('nfSpec').value;
      if(spec==='__new'){spec=$('nfCustom').value.trim();if(!spec){toast('請填自訂規格');return;}if(!tempSpecs.includes(spec))tempSpecs.push(spec);}
      const no=$('nfNo').value.trim()||nextCableNo();
      if(S.cables.some(c=>c.no===no)){toast(`電纜編號 ${no} 已經有了`);return;}
      const c=newCable(no,spec);cabForm=false;selectCable(c.id);commit();recompute();
      toast(c.cores.length?`已建立 ${c.no}（${c.cores.length} 芯），到右側芯線表接線`:`已建立 ${c.no}，規格看不出芯數，請在芯線表「新增一芯」`);
    };
  }
}
// 線的詳細資料：電纜芯線改成顯示所屬電纜，顏色與線徑跟著電纜的芯線表
function coreInfo(w){
  const c=cabOf(w.cab);
  return `<div class="revert"><p class="note">這條線是電纜 <b>${esc(c.no)}</b> 的芯線 <b>${esc(w.core)}</b>（${esc(specName(c.spec))}）。線徑和路徑跟著電纜；芯線顏色可以在下面改，電纜芯線表會一起更新。</p><div class="row" style="justify-content:flex-start"><button class="tool" id="goCab">到電纜 ${esc(c.no)}</button><button class="tool" id="unCore">移出電纜，改回散線</button></div></div><div><div class="sub-h">芯線顏色</div>${colorChips(w.color,'kc',w)}</div>`;
}
function bindCoreInfo(w){
  $('goCab').onclick=()=>{selectCable(w.cab);if(tab!=='ext'){tab='ext';}renderList();renderWires();renderDetail();updateHint();};
  $('unCore').onclick=()=>{const c=cabOf(w.cab);detachCore(w);commit();recompute();toast(`已把 ${w.no} 移出電纜 ${c?c.no:''}`);};
}
function devOptions(cur){
  const g={plate:'底板',door:doorShort(),field:'現場'};
  return `<option value="">選器具</option>`+['plate','door','field'].map(sh=>{
    const ds=S.devices.filter(d=>d.sheet===sh&&!tplOf(d).noOv&&tplOf(d).terms.length).sort((a,b)=>natCmp(a.tag,b.tag));
    return ds.length?`<optgroup label="${g[sh]}">${ds.map(d=>`<option value="${d.id}"${cur===d.id?' selected':''}>${esc(d.tag)}　${esc(tplOf(d).n)}</option>`).join('')}</optgroup>`:'';
  }).join('');
}
const termOptions=(d,cur)=>d?`<option value="">選接點</option>`+tplOf(d).terms.map(t=>`<option value="${esc(t.id)}"${cur===t.id?' selected':''}>${esc(termLabel(d,t.id))}${t.desc?'　'+esc(t.desc):''}</option>`).join(''):'<option value="">先選器具</option>';
function cableDetail(box,c){
  box.hidden=false;
  const cw=coresOf(c),by=new Map(cw.map(w=>[w.core,w])),L=cabLen(c),r=CABROUTES.get(c.id),ro=mode==='view';
  if(coreEdit&&(coreEdit.cid!==c.id||!c.cores[coreEdit.i]))coreEdit=null;
  if(coreSelCab!==c.id){coreSel=new Set();coreSelCab=c.id;colPop=null;}
  const pickBtn=(k,w)=>w||ro?'':`<button class="lnk" data-pickcore="${esc(k.n)}"${cabPick===c.id&&cabPickCore===k.n?' aria-pressed="true"':''}>圖上接</button>`;
  // 芯線表：名稱、顏色、線號直接在表格裡改；點兩端那一格展開接點編輯，展開在那一列正下方
  const rows=c.cores.map((k,i)=>{const w=by.get(k.n),co=coreColor(k),on=coreEdit&&coreEdit.i===i;
    let h=`<tr class="${on?'on':''}" data-ci="${i}"><td><input type="checkbox" data-csel="${esc(k.n)}"${coreSel.has(k.n)?' checked':''} aria-label="勾選芯線 ${esc(k.n)}"${ro?' disabled':''}></td>
      <td><input class="cn" data-cn="${i}" maxlength="10" value="${esc(k.n)}" aria-label="芯線名稱"${ro?' disabled':''}></td>
      <td><button class="csw" data-colpick="${esc(k.n)}" style="background:${swatch(co)}" title="${esc(co.n)}（點一下改顏色）" aria-label="芯線 ${esc(k.n)} 顏色：${esc(co.n)}"${ro?' disabled':''}></button></td>
      <td>${w?`<input class="cno" data-cno="${esc(k.n)}" maxlength="16" value="${esc(w.no)}" aria-label="線號"${ro?' disabled':''}>`:'<span class="note">備用</span>'}</td>
      <td class="cends" data-ced="${i}" title="點一下編輯兩端接點">${w?`${esc(epText(w.a))}<br>→ ${esc(epText(w.b))}`:'<span class="note">選接點…</span>'}</td>
      <td>${pickBtn(k,w)}</td></tr>`;
    if(colPop===k.n&&!ro) h+=`<tr class="sub"><td colspan="6"><div data-cpop="${esc(k.n)}"><div class="sub-h">芯線 ${esc(k.n)} 的顏色</div>${colorChips(k.c,'cp',k.hex?{color:k.c,hex:k.hex,cname:k.cn}:null)}</div></td></tr>`;
    if(on&&!ro){const A=coreEdit.a,B=coreEdit.b,dA=A&&devOf(A.d),dB=B&&devOf(B.d);
      h+=`<tr class="sub"><td colspan="6"><div class="coreed"><div class="sub-h">芯線 ${esc(k.n)} 的兩端接點</div><div class="fields">
      <label for="ceAd">A 端器具<select id="ceAd">${devOptions(A&&A.d)}</select></label><label for="ceAt">A 端接點<select id="ceAt">${termOptions(dA,A&&A.t)}</select></label>
      <label for="ceBd">B 端器具${L.ext?'（現場）':''}<select id="ceBd">${devOptions(B&&B.d)}</select></label><label for="ceBt">B 端接點<select id="ceBt">${termOptions(dB,B&&B.t)}</select></label>
      ${w?'':'<label for="ceNo" style="grid-column:1/-1">線號（空白＝自動）<input id="ceNo" maxlength="16" value="'+esc(coreEdit.no)+'"></label>'}</div>
      <div class="row" style="justify-content:flex-start"><button class="primary" id="ceOk">${w?'更新兩端':'接上這一芯'}</button>${w?'<button class="tool" id="ceSpare">改為備用</button>':''}<button class="tool danger" id="ceDel">刪除這一芯</button><button class="tool" id="ceClose">關閉</button></div></div></td></tr>`;}
    return h;}).join('');
  const orphan=cw.filter(w=>!coreDef(c,w.core));
  const nsel=c.cores.filter(k=>coreSel.has(k.n)).length,specCol=specCores(c.spec).length>0;
  const batch=ro?'':nsel?`<div class="batch" id="cBatch"><div class="sub-h">已勾 ${nsel} 芯：點顏色一次套用 <button class="lnk" id="cSelNone">取消勾選</button></div>${colorChips('','cb')}<div class="fields" style="margin-top:6px"><label for="cLabAt" style="grid-column:1/-1">線號標示（套用到已接的芯線）<select id="cLabAt"><option value="">選擇…</option>${LAB_AT.map(([k,n])=>`<option value="${k}">${n}</option>`).join('')}</select></label></div></div>`
    :(specCol?`<div class="row" style="justify-content:flex-start"><button class="lnk" id="cColReset">依規格重設芯線顏色</button><span class="note">勾選多芯可一次改顏色</span></div>`:'<p class="note">勾選多芯可一次改顏色</p>');
  const sec=(k,t,body)=>`<details class="csec" data-sec="${k}"${cabSecOpen.has(k)?' open':''}><summary>${t}</summary>${body}</details>`;
  const boRow=k=>{const p=r&&r[k];return p?`<button class="tool" data-bor="${k}"${p.auto||ro?' disabled':''}>${k.toUpperCase()} 端${p.auto?'自動':'已移動，改回自動'}</button>`:'';};
  box.innerHTML=`<div class="fields"><label for="cNo">電纜編號<input id="cNo" maxlength="12" value="${esc(c.no)}" style="font-size:15px;font-weight:600"></label>
    <label for="cField">${L.ext?'現場長度 m':'另加長度 m'}<input id="cField" type="number" min="0" step="0.1" value="${c.fieldLen?Math.round(c.fieldLen/100)/10:''}" placeholder="${L.ext?'到現場設備':'0'}"></label>
    <label for="cSpec" style="grid-column:1/-1">規格<select id="cSpec">${specOptions(c.spec)}</select></label>
    <label for="cSpecNew" id="cSpecNewL" style="grid-column:1/-1" hidden>自訂規格（例如 0.75mm²*7C 號碼）<input id="cSpecNew" maxlength="60"></label>
    ${L.ext?`<label for="cGland" style="grid-column:1/-1">出線口<select id="cGland"><option value="">自動（現場設備的預設或最近的）</option>${S.glands.map(g=>`<option value="${g.id}"${c.gland===g.id?' selected':''}>${esc(g.id)}　${esc(g.spec)}</option>`).join('')}</select></label>`:''}</div>
    <p class="note">${cw.length?(L.ext?'外部電纜':'箱內電纜'):'還沒有接芯線'} · 已接 ${cw.length} / ${c.cores.length} 芯 · 共 <b>${m1(L.total)} m</b></p>
    <div class="hrow"><span class="sub-h" style="display:inline">芯線表</span> ${hq('ctab')}</div>${hn('ctab','芯線名稱、線號直接在格子裡改；點顏色方塊改顏色；點「兩端」那一格可以選 A 端、B 端接點；「圖上接」直接在圖上點兩個接點。勾選多芯可以一次改顏色。')}
    ${batch}
    <table class="rtab cores"><thead><tr><th><input type="checkbox" id="cSelAll" aria-label="全選"${nsel&&nsel===c.cores.length?' checked':''}${ro?' disabled':''}></th><th>芯</th><th>色</th><th>線號</th><th>兩端</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan="6" class="note">沒有芯線，按「新增一芯」</td></tr>'}</tbody></table>
    ${orphan.length?`<p class="flag">芯線表裡沒有：${orphan.map(w=>esc(w.core)+'（'+esc(w.no)+'）').join('、')}，請改規格或新增一芯</p>`:''}
    ${cabPick===c.id&&curCore(c)?`<p class="note cab-now">正在接 ${esc(c.no)} 第 ${c.cores.findIndex(x=>x.n===curCore(c).n)+1} 芯（${esc(curCore(c).n)}）：${draft?'點 B 端接點':'點 A 端接點'}</p>`:''}
    <div class="row" style="justify-content:flex-start"><button class="tool" id="cabPick">${cabPick===c.id?'停止接線':'在圖上接芯線'}</button><button class="tool" id="coreAdd">新增一芯</button></div>
    ${sec('sheath','外被與路徑',`<div id="cColor"><div class="sub-h">外被顏色　<button class="lnk" data-cdef="1"${c.color?'':' hidden'}>改回預設灰色</button></div>${colorChips(c.color||'',"cs",c.color?{color:c.color,hex:c.hex,cname:c.cname}:null)}</div>
    <label class="check"><input type="checkbox" id="cDirect"${c.direct?' checked':''}>外被不進線槽（直接拉線）</label>
    <div class="hrow"><span class="note">外被路徑：中繼點 ${(c.wps||[]).length} 個 ${hq('cwp')}</span></div>${hn('cwp','選取電纜後，雙擊外被可以加中繼點，拖曳白點調整，雙擊白點刪除。中繼點之間直接連，剝線點到中繼點照樣走線槽。電纜本來就能走線槽外，穿過其他器具不警告。')}
    ${(c.wps||[]).length?'<div class="row" style="justify-content:flex-start"><button class="tool" id="cWpClr">清除中繼點，改回自動</button></div>':''}
    ${r?`<div class="hrow"><span class="note">剝線點 ${hq('bo')}</span></div>${hn('bo','剝線點是剝掉外被、芯線分開的位置，圖上的白色小方塊。預設放在離芯線最近的線槽裡；拖曳可以移動（接線或擺放模式都可以），移過的變黃色。')}<div class="row" style="justify-content:flex-start">${boRow('a')}${boRow('b')}</div>`:''}`)}
    ${sec('info','電纜資訊',`<dl><dt>種類</dt><dd>${cw.length?(L.ext?'外部電纜（到現場）':'箱內電纜'):'還沒有接芯線'}</dd><dt>芯線</dt><dd>已接 ${cw.length} / ${c.cores.length} 芯</dd>${r?`<dt>經過</dt><dd>${r.via.length?esc(r.via.join(' → ')):'直接'}${r.gland?' → '+esc(r.gland):''}</dd>`:''}
      <dt>長度</dt><dd>${L.ext?'箱內':'圖面'} ${m1(L.box)} m${L.ext?`＋現場 ${L.field?m1(L.field)+' m':'未填'}`:L.field?`＋另加 ${m1(L.field)} m`:''}${L.spare?`＋預留 ${m1(L.spare)} m`:''}＝<b>${m1(L.total)} m</b></dd></dl>`)}
    <div class="row" style="justify-content:flex-start"><button class="tool" id="cabSplit">解散電纜（芯線保留成散線）</button><button class="tool danger" id="cabDel">刪除電纜和芯線</button></div>`;
  box.querySelectorAll('details.csec').forEach(dt=>dt.addEventListener('toggle',()=>{if(dt.open)cabSecOpen.add(dt.dataset.sec);else cabSecOpen.delete(dt.dataset.sec);}));
  if(ro) return;
  const done=()=>{commit();recompute();};
  $('cNo').onchange=e=>{const v=e.target.value.trim();if(!v||v===c.no){e.target.value=c.no;return;}if(S.cables.some(x=>x!==c&&x.no===v)){toast(`電纜編號 ${v} 已經有了`);e.target.value=c.no;return;}c.no=v;done();};
  $('cField').onchange=e=>{const v=Number(e.target.value);if(!(v>=0)){e.target.value='';c.fieldLen=0;}else c.fieldLen=Math.min(1e6,Math.round(v*1000));done();};
  const setSpec=v=>{
    c.spec=v;const nc=specCores(v);
    if(nc.length){
      // 已經接上的芯線照名稱對到新規格；新規格裡沒有的名稱留在芯線表後面
      coresOf(c).forEach(w=>{if(!nc.some(k=>k.n===w.core)){const o=coreDef(c,w.core);nc.push(o||{n:w.core,c:w.color,g:w.gauge});}});
      c.cores=nc;coresOf(c).forEach(w=>{const k=coreDef(c,w.core);if(k)paintCore(w,k);});
    }
    coreEdit=null;done();
  };
  $('cSpec').onchange=e=>{const v=e.target.value;if(v==='__new'){$('cSpecNewL').hidden=false;$('cSpecNew').focus();return;}setSpec(v);};
  $('cSpecNew').onchange=e=>{const v=e.target.value.trim();if(!v)return;if(!tempSpecs.includes(v))tempSpecs.push(v);setSpec(v);};
  $('cDirect').onchange=e=>{if(e.target.checked)c.direct=true;else delete c.direct;done();};
  if($('cWpClr'))$('cWpClr').onclick=()=>{delete c.wps;done();};
  if($('cGland'))$('cGland').onchange=e=>{if(e.target.value)c.gland=e.target.value;else delete c.gland;done();};
  box.querySelectorAll('[data-bor]').forEach(b=>b.onclick=()=>{delete c.bo[b.dataset.bor];done();});
  box.querySelectorAll('[data-ced]').forEach(td=>td.onclick=()=>{
    const i=Number(td.dataset.ced),k=c.cores[i],w=by.get(k.n);colPop=null;
    coreEdit=coreEdit&&coreEdit.i===i?null:{cid:c.id,i,a:w?{...w.a}:null,b:w?{...w.b}:null,no:''};renderDetail();
  });
  box.querySelectorAll('[data-cn]').forEach(inp=>inp.onchange=e=>{const k=c.cores[Number(inp.dataset.cn)],w=by.get(k.n),v=e.target.value.trim().slice(0,10);
    if(!v||v===k.n){e.target.value=k.n;return;}if(coreDef(c,v)){toast(`已經有芯線 ${v}`);e.target.value=k.n;return;}
    if(w)w.core=v;if(coreSel.has(k.n)){coreSel.delete(k.n);coreSel.add(v);}if(colPop===k.n)colPop=v;k.n=v;done();});
  box.querySelectorAll('[data-cno]').forEach(inp=>inp.onchange=e=>{const w=by.get(inp.dataset.cno),v=e.target.value.trim().slice(0,16);if(!w)return;if(!v){e.target.value=w.no;return;}w.no=v;done();});
  box.querySelectorAll('[data-csel]').forEach(cb=>cb.onchange=e=>{const n=cb.dataset.csel;if(e.target.checked)coreSel.add(n);else coreSel.delete(n);renderDetail();});
  if($('cSelAll'))$('cSelAll').onchange=e=>{coreSel=new Set(e.target.checked?c.cores.map(k=>k.n):[]);renderDetail();};
  if($('cLabAt'))$('cLabAt').onchange=e=>{const v=e.target.value;if(!v)return;const ws=c.cores.filter(k=>coreSel.has(k.n)).map(k=>by.get(k.n)).filter(Boolean);ws.forEach(w=>{delete w.lab;if(v==='start')delete w.labAt;else w.labAt=v;});done();toast(ws.length?`已把 ${ws.length} 條芯線的線號改標在${LAB_AT.find(x=>x[0]===v)[1]}`:'勾選的芯還沒接線');};
  if($('cSelNone'))$('cSelNone').onclick=()=>{coreSel=new Set();renderDetail();};
  box.querySelectorAll('[data-colpick]').forEach(b=>b.onclick=()=>{colPop=colPop===b.dataset.colpick?null:b.dataset.colpick;coreEdit=null;renderDetail();});
  if($('cColReset'))$('cColReset').onclick=()=>{const sc=specCores(c.spec);c.cores.forEach((k,i)=>{const d=sc.find(x=>x.n===k.n)||sc[i];if(d){setCoreColor(k,d.c);const w=by.get(k.n);if(w)paintCore(w,k);}});done();toast('已依規格重設芯線顏色');};
  $('coreAdd').onclick=()=>{let n=c.cores.length+1;while(coreDef(c,String(n)))n++;c.cores.push({n:String(n),c:'black',g:specGauge(c.spec)});coreEdit={cid:c.id,i:c.cores.length-1,a:null,b:null,no:''};done();};
  $('cabPick').onclick=()=>{if(cabPick===c.id)stopPick();else startPick(c);};
  box.querySelectorAll('[data-pickcore]').forEach(b=>b.onclick=e=>{e.stopPropagation();startPick(c,b.dataset.pickcore);});
  $('cabSplit').onclick=()=>{coresOf(c).forEach(detachCore);S.cables=S.cables.filter(x=>x!==c);selCab=null;cabPick=null;done();toast(`已解散電纜 ${c.no}，芯線留成散線`);};
  $('cabDel').onclick=()=>{const n=coresOf(c).length;S.wires=S.wires.filter(w=>w.cab!==c.id);S.cables=S.cables.filter(x=>x!==c);selCab=null;cabPick=null;done();toast(`已刪除電纜 ${c.no}${n?`和 ${n} 條芯線`:''}，可以按復原`);};
  if(!coreEdit) return;
  const k=c.cores[coreEdit.i],w=by.get(k.n);
  if($('ceNo'))$('ceNo').oninput=e=>{coreEdit.no=e.target.value;};
  const pickDev=s=>e=>{coreEdit[s]=e.target.value?{d:e.target.value,t:''}:null;renderDetail();};
  const pickTerm=s=>e=>{if(coreEdit[s])coreEdit[s].t=e.target.value;};
  $('ceAd').onchange=pickDev('a');$('ceBd').onchange=pickDev('b');$('ceAt').onchange=pickTerm('a');$('ceBt').onchange=pickTerm('b');
  $('ceOk').onclick=()=>{
    const A=coreEdit.a,B=coreEdit.b;
    if(!A||!A.t||!B||!B.t){toast('請選好 A 端和 B 端的接點');return;}
    if(A.d===B.d&&A.t===B.t){toast('兩端不能是同一個接點');return;}
    const x=w||makeCoreWire(A,B,coreEdit.no);
    if(w){w.a={...A};w.b={...B};}
    attachCore(x,c,k.n);coreEdit=null;done();toast(`${c.no} 芯線 ${k.n} 已接上（${x.no}）`);
  };
  if($('ceSpare'))$('ceSpare').onclick=()=>{S.wires=S.wires.filter(x=>x!==w);coreEdit=null;done();};
  $('ceDel').onclick=()=>{if(w)S.wires=S.wires.filter(x=>x!==w);c.cores.splice(coreEdit.i,1);coreEdit=null;done();};
  $('ceClose').onclick=()=>{coreEdit=null;renderDetail();};
}
// 新的芯線導線：線號沒填就沿用接點上已有的號碼，再沒有就配下一個號碼
function makeCoreWire(A,B,no){
  const n=nextWireNo(),h=inheritNo(A,B),v=(no||'').trim()||h.no||'W'+String(n).padStart(3,'0');
  if(v==='W'+String(n).padStart(3,'0'))S.nextNo=n+1;
  const w={id:'w'+n+'_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),no:v,a:{...A},b:{...B},wps:[],gauge:.75,color:'black'};
  S.wires.push(w);return w;
}
// 接下一芯：在圖上點兩個接點，接成這條電纜的下一芯（不跳建線視窗）
// 在圖上接芯線：目前要接的芯（沒指定就是第一個還沒接的）；可以跳過、回上一芯、完成
const freeCores=c=>{const u=new Set(coresOf(c).map(w=>w.core));return c.cores.filter(k=>!u.has(k.n));};
function curCore(c){const f=freeCores(c);return f.find(k=>k.n===cabPickCore)||f[0]||null;}
function startPick(c,name){
  const f=freeCores(c);if(!f.length){toast(`${c.no} 的芯線都接好了，可以先「新增一芯」`);return;}
  if(mode!=='wire')setMode('wire');cabPick=c.id;cabPickCore=(name&&f.some(k=>k.n===name))?name:f[0].n;selCab=c.id;sel=null;
  renderDetail();renderWires();updateHint();
}
function stopPick(msg){cabPick=null;cabPickCore=null;if(draft)cancelDraft();renderDetail();updateHint();if(msg)toast(msg);}
// 依芯線表順序找下一個（或上一個）還沒接的芯
function stepPick(dir){
  const c=cabOf(cabPick);if(!c)return;const f=freeCores(c);if(!f.length){stopPick();return;}
  const cur=curCore(c),order=c.cores.map(k=>k.n),i=order.indexOf(cur.n);
  for(let s=1;s<=order.length;s++){const n=order[(i+dir*s+order.length*s)%order.length];if(f.some(k=>k.n===n)){cabPickCore=n;break;}}
  if(draft)cancelDraft();renderDetail();updateHint();
}
function pickCore(){
  const c=cabPick&&cabOf(cabPick);if(!c){cabPick=null;return false;}
  const k=curCore(c);
  if(!k){stopPick(`${c.no} 的芯線都接好了`);return false;}
  const w=makeCoreWire(draft.a,draft.end,'');attachCore(w,c,k.n);if(draft.gland)c.gland=draft.gland;
  draft=null;closePop();selCab=c.id;sel=null;
  // 自動換到芯線表裡下一個還沒接的芯
  const f=freeCores(c),order=c.cores.map(x=>x.n),i=order.indexOf(k.n);let nx=null;
  for(let s=1;s<=order.length&&f.length;s++){const n=order[(i+s)%order.length];if(f.some(x=>x.n===n)){nx=n;break;}}
  if(nx)cabPickCore=nx;else{cabPick=null;cabPickCore=null;}
  commit();recompute();
  toast(`${c.no} 芯線 ${k.n} 已接上（${w.no}）`+(nx?`，接著接芯線 ${nx}`:'，全部芯線都接好了'));
  return true;
}
function cabHint(){
  const c=cabPick&&cabOf(cabPick),k=c&&curCore(c);if(!k) return null;
  const col=coreColor(k).n;
  return draft?`在圖上接芯線：${c.no} 芯線 ${k.n}（${col}），點 B 端接點完成；Esc 取消這一芯。`:`在圖上接芯線：${c.no} 芯線 ${k.n}（${col}），點 A 端接點開始；Esc 停止接線。`;
}
// 圖上的浮動工具列：目前在接哪一芯、上一芯、跳過、完成
function renderCabBar(){
  const bar=$('cabBar'),c=cabPick&&mode==='wire'&&cabOf(cabPick),k=c&&curCore(c);
  if(!k){bar.hidden=true;return;}
  const f=freeCores(c),co=coreColor(k),idx=c.cores.findIndex(x=>x.n===k.n)+1;
  bar.innerHTML=`<span class="cb-t"><b>${esc(c.no)}</b>　第 ${idx} 芯 <span class="sw" style="background:${swatch(co)}"></span>${esc(k.n)}${k.n!==co.n?'（'+esc(co.n)+'）':''}　<span class="cb-s">${draft?'點 B 端接點':'點 A 端接點'}</span>　<span class="note">還有 ${f.length} 芯</span></span>
    <button class="tool" data-cb="prev"${f.length<2?' disabled':''}>上一芯</button><button class="tool" data-cb="skip"${f.length<2?' disabled':''}>跳過這一芯</button><button class="primary" data-cb="done">完成</button>`;
  bar.hidden=false;
}
$('cabBar').addEventListener('click',e=>{const b=e.target.closest('[data-cb]');if(!b)return;
  if(b.dataset.cb==='done')stopPick('已停止在圖上接芯線');else stepPick(b.dataset.cb==='prev'?-1:1);});
$('list').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.id==='cabNew'){cabForm=!cabForm;renderList();if(cabForm)$('nfNo').focus();return;}
  if(b.dataset.cl){const v=selCab===b.dataset.cl?null:b.dataset.cl;selectCable(v);if(mode==='place')setMode('wire');selCab=v;renderList();renderWires();renderDetail();updateHint();}
});
// 芯線顏色：芯線表編輯中按顏色
$('detail').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b||sel||picked||!selCab)return;
  // 外被顏色
  if(b.closest('#cColor')){const c=cabOf(selCab);if(!c)return;const key=b.dataset.cdef?null:b.dataset.newc==='cs'?addTemp('cs'):b.dataset.pc;if(key===undefined)return;setCabColor(c,key);commit();recompute();return;}
  const c=cabOf(selCab);if(!c)return;
  const paint=(list,key)=>{list.forEach(k=>{setCoreColor(k,key);const w=coresOf(c).find(x=>x.core===k.n);if(w)paintCore(w,k);});commit();recompute();};
  // 芯線表裡單一芯的顏色選單
  const pop=b.closest('[data-cpop]');
  if(pop){const k=coreDef(c,pop.dataset.cpop);if(!k)return;const key=b.dataset.newc==='cp'?addTemp('cp'):b.dataset.pc;if(!key)return;colPop=null;paint([k],key);return;}
  // 勾選多芯一次套用顏色
  if(b.closest('#cBatch')){const key=b.dataset.newc==='cb'?addTemp('cb'):b.dataset.pc;if(!key)return;const ks=c.cores.filter(k=>coreSel.has(k.n));paint(ks,key);toast(`已把 ${ks.length} 芯改成 ${keyColor(key).n}`);return;}
});

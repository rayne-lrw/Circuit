"use strict";
/* ---------- 電纜操作：右側「電纜」分頁、電纜詳細資料與芯線表、接下一芯、剝線點拖曳 ---------- */
let cabForm=false;
// 芯線表：勾選的芯（一次改顏色）、正在選顏色的芯、電纜資料展開的分區
let coreSel=new Set(),coreSelCab=null,colPop=null,renumOpen=false;const cabSecOpen=new Set();
// 芯線表平常是「看」的狀態，按「編輯」才出現輸入框；「⋯ 更多」選單；「依序接」表單
let coreMode=false,cabMore=false,seqForm=null;
// 某一端改成「接頭」但還沒選好接點：{cid,s,d}
let plugPend=null;
// 設定電纜某一端是接頭（p＝{d,t}）或改回散線（p＝null）
function setPlug(c,s,p){
  if(!p){if(c.plug){delete c.plug[s];if(!c.plug.a&&!c.plug.b)delete c.plug;}return '';}
  const o=s==='a'?'b':'a',d=devOf(p.d);
  // 選的器具在另一端（例如芯線另一端就接在這台）或是現場設備放在 A 端：兩端對調，現場端維持在 B 端
  if(coresOf(c).some(w=>w[o].d===p.d)||(s==='a'&&d.sheet==='field'&&!(plugOf(c,'b')&&devOf(plugOf(c,'b').d).sheet==='field'))){swapCableSides(c);s=o;}
  c.plug=c.plug||{};c.plug[s]={d:p.d,t:p.t};if(c.bo)delete c.bo[s];
  let msg='';
  if(bothPlug(c)){const n=coresOf(c).length;if(n){S.wires=S.wires.filter(w=>w.cab!==c.id);msg=`，兩端都是接頭，原本的 ${n} 條芯線已拿掉（可以按復原）`;}}
  else coresOf(c).forEach(w=>plugFix(w,c));
  return msg;
}
// 圖上接芯線時，一端是接頭：每一芯都從接頭開始，只要點另一端的接點
function seedPlugDraft(c){const p=plugOf(c,'a')||plugOf(c,'b');if(p&&cabPick===c.id&&!draft&&curCore(c))draft={a:{d:p.d,t:p.t},wps:[]};}
// 電纜兩端器具：使用者指定的（c.ends）加上已接芯線那一側的器具
function endDevs(c,s){
  const ids=[...((c.ends&&c.ends[s])||[]),...coresOf(c).map(w=>w[s].d)];
  return [...new Set(ids)].map(devOf).filter(Boolean);
}
// 一側的接點選單：只列這條電纜這一側的器具；最後一個選項可以改選其他器具
function endTermOptions(devs,cur){
  return `<option value="">選接點</option>`+devs.map(d=>`<optgroup label="${esc(d.tag)}　${esc(tplOf(d).n)}">${tplOf(d).terms.map(t=>{const v=d.id+'|'+t.id;return `<option value="${esc(v)}"${cur&&cur.d===d.id&&cur.t===t.id?' selected':''}>${esc(d.tag)}·${esc(termLabel(d,t.id))}${t.desc?'　'+esc(t.desc):''}</option>`;}).join('')}</optgroup>`).join('')+`<option value="__other">其他器具…</option>`;
}
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
    // 清單預設收起：只顯示編號與兩端器具；點開（選取）才顯示規格與每一芯
    const et=k=>{const p=plugOf(c,k);return p?epText(p)+'（接頭）':sideTags(cw,k);};
    const open=selCab===c.id||cw.some(w=>w.id===sel),ends=`${et('a')} → ${et('b')}`;
    return `<button class="cab-h${open?' sel':''}" data-cl="${c.id}" aria-expanded="${open}"><span class="cab-car">${open?'▾':'▸'}</span><b>${esc(c.no)}</b>　${L.ext?'外部':'箱內'} · ${bothPlug(c)?`${c.cores.length} 芯 · 接頭`:`${cw.length}/${c.cores.length} 芯`} · ${m1(L.total)} m<span class="note${open?'':' cab-1l'}" title="${esc(specName(c.spec)+'　'+ends)}">${open?`${esc(specName(c.spec))}<br>`:''}${esc(ends)}</span></button>`+(open?cw.map(wireRow).join(''):'');
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
// 芯線換位：芯線本身（名稱、顏色）不動，兩芯的接線（兩端接點與線號）對調；目標是備用芯就直接搬過去
function swapCores(c,n1,n2){
  const ws=coresOf(c),w1=ws.find(w=>w.core===n1),w2=ws.find(w=>w.core===n2);
  if(w1)w1.core=n2;if(w2)w2.core=n1;
  [w1,w2].forEach(w=>{if(!w)return;const k=coreDef(c,w.core);if(k)paintCore(w,k);});
  return !!(w1||w2);
}
// 線號拆成「前綴＋數字」：W062 → W、62、寬 3；0901 → ''、901、寬 4
function noParts(v){const m=String(v).match(/^(.*?)(\d+)$/);return m?{pre:m[1],n:Number(m[2]),w:m[2].length}:null;}
function renumCores(c,list,rule,arg){
  const ws=list.map(k=>coresOf(c).find(w=>w.core===k.n)).filter(Boolean);
  if(rule==='seq'){const p=noParts(arg);if(!p)return -1;ws.forEach((w,i)=>w.no=p.pre+String(p.n+i).padStart(p.w,'0'));}
  else ws.forEach(w=>w.no=(arg||'')+w.core);
  return ws.length;
}
function cableDetail(box,c){
  box.hidden=false;
  const cw=coresOf(c),by=new Map(cw.map(w=>[w.core,w])),L=cabLen(c),r=CABROUTES.get(c.id),ro=mode==='view';
  if(coreEdit&&(coreEdit.cid!==c.id||!c.cores[coreEdit.i]))coreEdit=null;
  if(coreSelCab!==c.id){coreSel=new Set();coreSelCab=c.id;colPop=null;coreMode=false;cabMore=false;seqForm=null;renumOpen=false;}
  const pickBtn=(k,w)=>w||ro||(PA&&PB)?'':`<button class="lnk" data-pickcore="${esc(k.n)}"${cabPick===c.id&&cabPickCore===k.n?' aria-pressed="true"':''}>圖上接</button>`;
  // 芯線表：名稱、顏色、線號直接在表格裡改；點兩端那一格展開接點編輯，展開在那一列正下方
  const ed=coreMode&&!ro,ncol=ed?6:5,PA=plugOf(c,'a'),PB=plugOf(c,'b'),pl=PA&&PB;
  const devsA=PA?[devOf(PA.d)]:endDevs(c,'a'),devsB=PB?[devOf(PB.d)]:endDevs(c,'b');
  if(plugPend&&plugPend.cid!==c.id)plugPend=null;
  // 展開在那一列下面的兩端接點編輯：電纜這一側已經有器具時只要選接點
  function cendCell(i,w){
    if(pl) return `<td class="cends plug"><span class="note">接頭↔接頭</span></td>`;
    return `<td class="cends" data-ced="${i}" title="點一下編輯兩端接點">${w?`${esc(epText(w.a))}<br>→ ${esc(epText(w.b))}`:'<span class="note">選接點…</span>'}</td>`;
  }
  function coreEdRow(k,w){
    const side=(s,lab,devs)=>{const PG=plugOf(c,s);if(PG)return `<p class="note" style="grid-column:1/-1">${lab}：接頭 <b>${esc(epText(PG))}</b>（每一芯都接在這個接頭）</p>`;const P=coreEdit[s],dP=P&&devOf(P.d),free=coreEdit.free&&coreEdit.free[s]||!devs.length||(P&&P.d&&!devs.some(d=>d.id===P.d));
      return free?`<label for="ce${s}d">${lab}器具<select id="ce${s}d">${devOptions(P&&P.d)}</select></label><label for="ce${s}t">${lab}接點<select id="ce${s}t">${termOptions(dP,P&&P.t)}</select></label>`
        :`<label for="ce${s}x" style="grid-column:1/-1">${lab}接點<select id="ce${s}x">${endTermOptions(devs,P)}</select></label>`;};
    return `<tr class="csub"><td colspan="${ncol}"><div class="coreed"><div class="sub-h">芯線 ${esc(k.n)} 的兩端接點</div><div class="fields">
      ${side('a','A 端',devsA)}${side('b','B 端'+(L.ext?'（現場）':''),devsB)}
      ${w?'':'<label for="ceNo" style="grid-column:1/-1">線號（空白＝自動）<input id="ceNo" maxlength="16" value="'+esc(coreEdit.no)+'"></label>'}
      ${w?`<label for="ceMove" style="grid-column:1/-1">改接到另一芯（有接線就互換，備用就搬過去）<select id="ceMove"><option value="">選擇…</option>${c.cores.filter(x=>x.n!==k.n).map(x=>`<option value="${esc(x.n)}">${esc(x.n)}　${by.get(x.n)?'（'+esc(by.get(x.n).no)+'，互換）':'（備用）'}</option>`).join('')}</select></label>`:''}</div>
      <div class="row" style="justify-content:flex-start"><button class="primary" id="ceOk">${w?'更新兩端':'接上這一芯'}</button>${w?'<button class="tool" id="ceSpare">改為備用</button>':''}<button class="tool danger" id="ceDel">刪除這一芯</button><button class="tool" id="ceClose">關閉</button></div></div></td></tr>`;
  }
  const rows=c.cores.map((k,i)=>{const w=by.get(k.n),co=coreColor(k),on=coreEdit&&coreEdit.i===i;
    // 看的狀態：色點、芯名、線號、兩端，點兩端那一格一樣可以改接點
    if(!ed){let h=`<tr class="${on?'on':''}" data-ci="${i}"><td><span class="sw" style="background:${swatch(co)}" title="${esc(co.n)}"></span></td><td>${esc(k.n)}</td><td class="mono">${w?esc(w.no):(pl?'<span class="note">—</span>':'<span class="note">備用</span>')}</td>
      ${cendCell(i,w)}<td>${pickBtn(k,w)}</td></tr>`;
      if(on&&!ro) h+=coreEdRow(k,w);return h;}
    let h=`<tr class="${on?'on':''}" data-ci="${i}"><td><input type="checkbox" data-csel="${esc(k.n)}"${coreSel.has(k.n)?' checked':''} aria-label="勾選芯線 ${esc(k.n)}"${ro?' disabled':''}></td>
      <td><input class="cn" data-cn="${i}" maxlength="10" value="${esc(k.n)}" aria-label="芯線名稱"${ro?' disabled':''}></td>
      <td><button class="csw" data-colpick="${esc(k.n)}" style="background:${swatch(co)}" title="${esc(co.n)}（點一下改顏色）" aria-label="芯線 ${esc(k.n)} 顏色：${esc(co.n)}"${ro?' disabled':''}></button></td>
      <td>${w?`<input class="cno" data-cno="${esc(k.n)}" maxlength="16" value="${esc(w.no)}" aria-label="線號"${ro?' disabled':''}>`:(pl?'<span class="note">—</span>':'<span class="note">備用</span>')}</td>
      ${cendCell(i,w)}
      <td>${pickBtn(k,w)}</td></tr>`;
    if(colPop===k.n&&!ro) h+=`<tr class="csub"><td colspan="${ncol}"><div data-cpop="${esc(k.n)}"><div class="sub-h">芯線 ${esc(k.n)} 的顏色</div>${colorChips(k.c,'cp',k.hex?{color:k.c,hex:k.hex,cname:k.cn}:null)}</div></td></tr>`;
    if(on&&!ro) h+=coreEdRow(k,w);
    return h;}).join('');
  const orphan=cw.filter(w=>!coreDef(c,w.core));
  const nsel=c.cores.filter(k=>coreSel.has(k.n)).length,specCol=specCores(c.spec).length>0;
  const batch=!ed?'':nsel?`<div class="batch" id="cBatch"><div class="sub-h">已勾 ${nsel} 芯：點顏色一次套用 <button class="lnk" id="cSelNone">取消勾選</button></div>${nsel===2?`<div class="row" style="justify-content:flex-start;margin:4px 0"><button class="tool" id="cSwap">這兩芯互換接線</button><span class="note">兩端接點和線號對調，芯線顏色不動</span></div>`:''}${colorChips('','cb')}<div class="fields" style="margin-top:6px"><label for="cLabAt" style="grid-column:1/-1">線號標示（套用到已接的芯線）<select id="cLabAt"><option value="">選擇…</option>${LAB_AT.map(([k,n])=>`<option value="${k}">${n}</option>`).join('')}</select></label></div></div>`
    :'<p class="note">勾選多芯可一次改顏色或線號標示；勾兩芯可以互換接線</p>';
  // 兩端器具：已接芯線的器具會自動列進來；也可以先指定，接芯線時就只要選接點
  const plugRow=(s,lab)=>{const P=plugOf(c,s),pd=plugPend&&plugPend.s===s?plugPend.d:P&&P.d,d=pd&&devOf(pd);
    return `<div class="cend-row"><span class="cend-l">${lab}</span>${ro?`<span class="chip">${P?esc(epText(P))+' 接頭':'未選接頭'}</span>`:`<select data-pmode="${s}" aria-label="${lab}散線或接頭"><option value="">散線</option><option value="plug" selected>接頭</option></select><select data-pdev="${s}" aria-label="${lab}接頭器具">${devOptions(pd)}</select><select data-pterm="${s}" aria-label="${lab}接頭接點">${termOptions(d,P&&P.d===pd?P.t:'')}</select>`}</div>`;};
  const endRow=(s,lab,devs)=>plugOf(c,s)||(plugPend&&plugPend.s===s)?plugRow(s,lab):`<div class="cend-row"><span class="cend-l">${lab}</span>${ro?'':`<select data-pmode="${s}" aria-label="${lab}散線或接頭"><option value="" selected>散線</option><option value="plug">接頭</option></select>`}${devs.map(d=>{const used=coresOf(c).some(w=>w[s].d===d.id);return `<span class="chip">${esc(d.tag)}${used||ro?'':`<button class="lnk" data-endrm="${s}|${d.id}" aria-label="移除 ${esc(d.tag)}">×</button>`}</span>`;}).join('')}${ro?'':`<select data-endadd="${s}" aria-label="${lab}加器具"><option value="">＋器具</option>${devOptions('').replace('<option value="">選器具</option>','')}</select>`}</div>`;
  const ends=`<div class="cends-set"><div class="hrow"><span class="sub-h" style="display:inline">兩端</span> ${hq('cend')}</div>${hn('cend','每一端可以選「散線」或「接頭」。散線：剝線後每一芯接到端子，可以先指定這一端是哪幾台器具，芯線表編輯接點時就只要選接點，「依序接」也從這裡選（已接芯線的器具會自動列進來）。接頭：例如伺服編碼線插在 CN2，選好接頭的接點後，外皮直接進接頭、不剝線，每一芯的這一端都是那個接頭。兩端都是接頭時不用接芯線，芯線表只當規格參考。')}${endRow('a','A 端',devsA)}${endRow('b','B 端'+(L.ext?'（現場）':''),devsB)}</div>`;
  // 依序接：從 A、B 端各選起始接點，還沒接的芯依芯線表順序接到連續的接點
  const free=freeCores(c);
  if(seqForm&&!seqForm.a.d&&devsA[0])seqForm.a.d=devsA[0].id;
  if(seqForm&&!seqForm.b.d&&devsB[0])seqForm.b.d=devsB[0].id;
  const seqSide=(s,lab)=>{const PG=plugOf(c,s);if(PG)return `<p class="note" style="grid-column:1/-1">${lab}：接頭 ${esc(epText(PG))}</p>`;const P=seqForm[s],d=devOf(P.d);return `<label for="sq${s}d">${lab}器具<select id="sq${s}d">${devOptions(P.d)}</select></label><label for="sq${s}t">${lab}起始接點<select id="sq${s}t">${termOptions(d,P.t)}</select></label>`;};
  const seq=seqForm&&!ro?`<div class="batch" id="cSeq"><div class="sub-h">依序接：還沒接的 ${free.length} 芯依芯線表順序，接到兩端連續的接點</div><div class="fields">${seqSide('a','A 端')}${seqSide('b','B 端')}
    <label for="sqN">接幾芯<input id="sqN" type="number" min="1" max="${free.length}" value="${Math.min(seqForm.n||free.length,free.length)}"></label></div><p class="note" id="sqEx"></p><div class="row" style="justify-content:flex-start"><button class="primary" id="sqGo">接上</button><button class="tool" id="sqX">取消</button></div></div>`:'';
  const more=cabMore&&!ro?`<div class="cmore" role="menu">${specCol?'<button class="mi" id="cColReset">依規格重設芯線顏色</button>':''}${cw.length?'<button class="mi" id="cRenum">依芯線順序重排線號…</button>':''}<button class="mi" id="coreAdd">新增一芯</button><button class="mi" id="cabSplit">解散電纜（芯線保留成散線）</button><button class="mi danger" id="cabDel">刪除電纜和芯線</button></div>`:'';
  const sec=(k,t,body)=>`<details class="csec" data-sec="${k}"${cabSecOpen.has(k)?' open':''}><summary>${t}</summary>${body}</details>`;
  const boRow=k=>{const p=r&&r[k];return p?`<button class="tool" data-bor="${k}"${p.auto||ro?' disabled':''}>${k.toUpperCase()} 端${p.auto?'自動':'已移動，改回自動'}</button>`:'';};
  box.innerHTML=`<div class="fields"><label for="cNo">電纜編號<input id="cNo" maxlength="12" value="${esc(c.no)}" style="font-size:15px;font-weight:600"></label>
    <label for="cField">${L.ext?'現場長度 m':'另加長度 m'}<input id="cField" type="number" min="0" step="0.1" value="${c.fieldLen?Math.round(c.fieldLen/100)/10:''}" placeholder="${L.ext?'到現場設備':'0'}"></label>
    <label for="cSpec" style="grid-column:1/-1">規格<select id="cSpec">${specOptions(c.spec)}</select></label>
    <label for="cSpecNew" id="cSpecNewL" style="grid-column:1/-1" hidden>自訂規格（例如 0.75mm²*7C 號碼）<input id="cSpecNew" maxlength="60"></label>
    ${L.ext?`<label for="cGland" style="grid-column:1/-1">出線口<select id="cGland"><option value="">自動（現場設備的預設或最近的）</option>${S.glands.map(g=>`<option value="${g.id}"${c.gland===g.id?' selected':''}>${esc(g.id)}　${esc(g.spec)}</option>`).join('')}</select></label>`:''}</div>
    <p class="note">${pl?(L.ext?'外部電纜':'箱內電纜')+' · 兩端都是接頭':(cw.length?(L.ext?'外部電纜':'箱內電纜'):'還沒有接芯線')+` · 已接 ${cw.length} / ${c.cores.length} 芯`} · 共 <b>${m1(L.total)} m</b></p>
    ${ends}
    <div class="hrow ctab-h"><span class="sub-h" style="display:inline">芯線表</span> ${hq('ctab')}<span style="flex:1"></span>${ro?'':`<button class="tool sm" id="cMode"${ed?' aria-pressed="true"':''}>${ed?'完成編輯':'編輯'}</button><button class="tool sm" id="cMore" aria-expanded="${cabMore}" aria-label="更多">⋯ 更多</button>`}</div>${hn('ctab','點「兩端」那一格可以選 A 端、B 端接點；「圖上接」直接在圖上點兩個接點；「依序接」一次把還沒接的芯接到連續的接點。要改芯線名稱、顏色、線號，按「編輯」。重設顏色、重排線號、新增一芯、解散或刪除電纜在「⋯ 更多」。')}
    ${more}${batch}
    <table class="rtab cores"><thead><tr>${ed?`<th><input type="checkbox" id="cSelAll" aria-label="全選"${nsel&&nsel===c.cores.length?' checked':''}></th><th>芯</th><th>色</th>`:'<th>色</th><th>芯</th>'}<th>線號</th><th>兩端</th><th></th></tr></thead><tbody>${rows||`<tr><td colspan="${ncol}" class="note">沒有芯線，到「⋯ 更多」按「新增一芯」</td></tr>`}</tbody></table>
    ${orphan.length?`<p class="flag">芯線表裡沒有：${orphan.map(w=>esc(w.core)+'（'+esc(w.no)+'）').join('、')}，請改規格或新增一芯</p>`:''}
    ${cabPick===c.id&&curCore(c)?`<p class="note cab-now">正在接 ${esc(c.no)} 第 ${c.cores.findIndex(x=>x.n===curCore(c).n)+1} 芯（${esc(curCore(c).n)}）：${draft?'點 B 端接點':'點 A 端接點'}</p>`:''}
    ${renumOpen&&!ro?`<div class="batch" id="cRenumBox"><div class="fields">
      <label for="rnRule" style="grid-column:1/-1">規則<select id="rnRule"><option value="seq">連續編號（照芯線順序往下編）</option><option value="pre">前綴＋芯線名稱</option></select></label>
      <label for="rnArg" style="grid-column:1/-1"><span id="rnLab">第一芯的線號</span><input id="rnArg" maxlength="16" value="${esc((cw.slice().sort((a,b)=>coreOrder(c)(a)-coreOrder(c)(b))[0]||{}).no||'')}"></label>
      <label for="rnScope" style="grid-column:1/-1">範圍<select id="rnScope"><option value="all">全部已接的芯</option>${nsel?`<option value="sel">勾選的 ${nsel} 芯</option>`:''}</select></label></div>
      <p class="note" id="rnEx"></p><div class="row" style="justify-content:flex-start"><button class="primary" id="rnGo">套用</button><button class="tool" id="rnX">取消</button></div></div>`:''}
    ${seq}
    ${ro?'':pl?`<p class="note">兩端都是接頭：不用接芯線。${ed?'':'芯線表只當規格參考。'}</p>${ed?'<div class="row" style="justify-content:flex-start"><button class="tool" id="coreAdd2">新增一芯</button></div>':''}`:`<div class="row" style="justify-content:flex-start"><button class="tool" id="cabPick">${cabPick===c.id?'停止接線':'在圖上接芯線'}</button>${free.length?`<button class="tool" id="cSeqB"${seqForm?' aria-pressed="true"':''}>依序接…</button>`:''}${ed?'<button class="tool" id="coreAdd2">新增一芯</button>':''}</div>`}
    ${sec('sheath','外皮與路徑',`<div id="cColor"><div class="sub-h">外皮顏色　<button class="lnk" data-cdef="1"${c.color?'':' hidden'}>改回預設黑色</button></div>${colorChips(c.color||'',"cs",c.color?{color:c.color,hex:c.hex,cname:c.cname}:null)}</div>
    <label class="check"><input type="checkbox" id="cDirect"${c.direct?' checked':''}>外皮不進線槽（直接拉線）</label>
    <div class="hrow"><span class="note">外皮路徑：中繼點 ${(c.wps||[]).length} 個 ${hq('cwp')}</span></div>${hn('cwp','選取電纜後，雙擊外皮可以加中繼點，拖曳白點調整，雙擊白點刪除。中繼點之間直接連，剝線點到中繼點照樣走線槽。電纜本來就能走線槽外，穿過其他器具不警告。')}
    ${(c.wps||[]).length?'<div class="row" style="justify-content:flex-start"><button class="tool" id="cWpClr">清除中繼點，改回自動</button></div>':''}
    ${r?`<div class="hrow"><span class="note">剝線點 ${hq('bo')}</span></div>${hn('bo','剝線點是剝掉外皮、芯線分開的位置，圖上的白色小方塊。預設放在離芯線最近的線槽裡；拖曳可以移動（接線或擺放模式都可以），移過的變黃色。')}<div class="row" style="justify-content:flex-start">${boRow('a')}${boRow('b')}</div>`:''}`)}
    ${sec('info','電纜資訊',`<dl><dt>種類</dt><dd>${cw.length||pl?(L.ext?'外部電纜（到現場）':'箱內電纜'):'還沒有接芯線'}</dd><dt>芯線</dt><dd>${pl?`${c.cores.length} 芯（兩端接頭）`:`已接 ${cw.length} / ${c.cores.length} 芯`}</dd>${r?`<dt>經過</dt><dd>${r.via.length?esc(r.via.join(' → ')):'直接'}${r.gland?' → '+esc(r.gland):''}</dd>`:''}
      <dt>長度</dt><dd>${L.ext?'箱內':'圖面'} ${m1(L.box)} m${L.ext?`＋現場 ${L.field?m1(L.field)+' m':'未填'}`:L.field?`＋另加 ${m1(L.field)} m`:''}${L.spare?`＋預留 ${m1(L.spare)} m`:''}＝<b>${m1(L.total)} m</b></dd></dl>`)}
`;
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
    coreEdit=coreEdit&&coreEdit.i===i?null:{cid:c.id,i,a:w?{...w.a}:PA?{...PA}:null,b:w?{...w.b}:PB?{...PB}:null,no:''};renderDetail();
  });
  box.querySelectorAll('[data-cn]').forEach(inp=>inp.onchange=e=>{const k=c.cores[Number(inp.dataset.cn)],w=by.get(k.n),v=e.target.value.trim().slice(0,10);
    if(!v||v===k.n){e.target.value=k.n;return;}if(coreDef(c,v)){toast(`已經有芯線 ${v}`);e.target.value=k.n;return;}
    if(w)w.core=v;if(coreSel.has(k.n)){coreSel.delete(k.n);coreSel.add(v);}if(colPop===k.n)colPop=v;k.n=v;done();});
  box.querySelectorAll('[data-cno]').forEach(inp=>inp.onchange=e=>{const w=by.get(inp.dataset.cno),v=e.target.value.trim().slice(0,16);if(!w)return;if(!v){e.target.value=w.no;return;}w.no=v;done();});
  box.querySelectorAll('[data-csel]').forEach(cb=>cb.onchange=e=>{const n=cb.dataset.csel;if(e.target.checked)coreSel.add(n);else coreSel.delete(n);renderDetail();});
  if($('cSelAll'))$('cSelAll').onchange=e=>{coreSel=new Set(e.target.checked?c.cores.map(k=>k.n):[]);renderDetail();};
  if($('cLabAt'))$('cLabAt').onchange=e=>{const v=e.target.value;if(!v)return;const ws=c.cores.filter(k=>coreSel.has(k.n)).map(k=>by.get(k.n)).filter(Boolean);ws.forEach(w=>{delete w.lab;if(v==='start')delete w.labAt;else w.labAt=v;});done();toast(ws.length?`已把 ${ws.length} 條芯線的線號改標在${LAB_AT.find(x=>x[0]===v)[1]}`:'勾選的芯還沒接線');};
  if($('cSwap'))$('cSwap').onclick=()=>{const [a,b]=c.cores.filter(k=>coreSel.has(k.n)).map(k=>k.n);if(!swapCores(c,a,b)){toast('這兩芯都還沒接線');return;}coreSel=new Set();done();toast(`芯線 ${a} 和 ${b} 的接線已互換`);};
  if($('cRenum'))$('cRenum').onclick=()=>{renumOpen=!renumOpen;cabMore=false;renderDetail();};
  if($('rnX'))$('rnX').onclick=()=>{renumOpen=false;renderDetail();};
  $('cMode').onclick=()=>{coreMode=!coreMode;if(!coreMode){coreSel=new Set();colPop=null;}renderDetail();};
  $('cMore').onclick=()=>{cabMore=!cabMore;renderDetail();};
  box.querySelectorAll('[data-endadd]').forEach(se=>se.onchange=()=>{const s=se.dataset.endadd,v=se.value;if(!v)return;c.ends=c.ends||{};c.ends[s]=[...new Set([...(c.ends[s]||[]),v])];done();});
  box.querySelectorAll('[data-pmode]').forEach(se=>se.onchange=()=>{const s=se.dataset.pmode;
    if(se.value==='plug'){plugPend={cid:c.id,s,d:''};renderDetail();return;}
    plugPend=null;if(plugOf(c,s)){setPlug(c,s,null);done();toast(`${c.no} ${s.toUpperCase()} 端改回散線`);}else renderDetail();});
  box.querySelectorAll('[data-pdev]').forEach(se=>se.onchange=()=>{plugPend={cid:c.id,s:se.dataset.pdev,d:se.value};renderDetail();});
  box.querySelectorAll('[data-pterm]').forEach(se=>se.onchange=()=>{const s=se.dataset.pterm,d=plugPend&&plugPend.s===s?plugPend.d:(plugOf(c,s)||{}).d;if(!d||!se.value)return;
    plugPend=null;const m=setPlug(c,s,{d,t:se.value});coreEdit=null;seqForm=null;if(cabPick===c.id)stopPick();done();toast(`${c.no} 的接頭：${epText({d,t:se.value})}${m}`);});
  box.querySelectorAll('[data-endrm]').forEach(b=>b.onclick=()=>{const [s,id]=b.dataset.endrm.split('|');if(c.ends&&c.ends[s])c.ends[s]=c.ends[s].filter(x=>x!==id);done();});
  if($('cSeqB'))$('cSeqB').onclick=()=>{seqForm=seqForm?null:{a:{d:'',t:''},b:{d:'',t:''},n:0};renderDetail();};
  if($('cSeq')){
    const tIdx=(P)=>{const d=devOf(P.d);return d?tplOf(d).terms.findIndex(t=>t.id===P.t):-1;};
    // 接頭那一端每一芯都接同一個接點；散線那一端接到連續的接點
    const endAt=s=>{const PG=plugOf(c,s);if(PG)return ()=>({d:PG.d,t:PG.t});const P=seqForm[s],i0=tIdx(P);if(i0<0)return null;const d=devOf(P.d),T=tplOf(d).terms;return i=>T[i0+i]?{d:d.id,t:T[i0+i].id}:null;};
    const plan=()=>{const n=Math.max(1,Math.min(free.length,Number($('sqN').value)||free.length)),fa=endAt('a'),fb=endAt('b');if(!fa||!fb)return null;
      const out=[];for(let i=0;i<n;i++){const a=fa(i),b=fb(i);if(!a||!b)break;out.push({k:free[i],a,b});}
      return out;};
    const ex=()=>{const P=plan();$('sqEx').textContent=!P?'選好兩端的器具和起始接點':P.some(x=>x.a.d===x.b.d&&x.a.t===x.b.t)?'兩端不能是同一個接點':`例：${P.slice(0,3).map(x=>`${x.k.n} 芯 ${epText(x.a)} → ${epText(x.b)}`).join('、')}${P.length>3?'…':''}（共 ${P.length} 芯）`;};
    ['a','b'].forEach(s=>{if(!$('sq'+s+'d'))return;$('sq'+s+'d').onchange=e=>{seqForm[s]={d:e.target.value,t:''};seqForm.n=Number($('sqN').value)||0;renderDetail();};$('sq'+s+'t').onchange=e=>{seqForm[s].t=e.target.value;ex();};});
    $('sqN').oninput=ex;ex();
    $('sqX').onclick=()=>{seqForm=null;renderDetail();};
    $('sqGo').onclick=()=>{const P=plan();if(!P||!P.length){toast('選好兩端的器具和起始接點');return;}if(P.some(x=>x.a.d===x.b.d&&x.a.t===x.b.t)){toast('兩端不能是同一個接點');return;}
      P.forEach(x=>{const w=makeCoreWire(x.a,x.b,'',c);attachCore(w,c,x.k.n);});seqForm=null;done();toast(`${c.no} 已依序接上 ${P.length} 芯`);};
  }
  if($('cRenumBox')){
    const list=()=>c.cores.filter(k=>by.get(k.n)&&($('rnScope').value!=='sel'||coreSel.has(k.n)));
    const ex=()=>{const r=$('rnRule').value,a=$('rnArg').value.trim(),L=list();$('rnLab').textContent=r==='seq'?'第一芯的線號':'前綴（可空白）';
      if(r==='seq'){const p=noParts(a);$('rnEx').textContent=p?'例：'+L.slice(0,3).map((k,i)=>k.n+' 芯 → '+p.pre+String(p.n+i).padStart(p.w,'0')).join('、')+(L.length>3?'…':''):'線號最後要是數字，例如 0901、S01';}
      else $('rnEx').textContent='例：'+L.slice(0,3).map(k=>k.n+' 芯 → '+a+k.n).join('、')+(L.length>3?'…':'');};
    $('rnRule').onchange=()=>{if($('rnRule').value==='pre')$('rnArg').value=c.no+'-';ex();};$('rnArg').oninput=ex;$('rnScope').onchange=ex;ex();
    $('rnGo').onclick=()=>{const n=renumCores(c,list(),$('rnRule').value,$('rnArg').value.trim());if(n<0){toast('線號最後要是數字，例如 0901、S01');return;}renumOpen=false;done();toast(`已重排 ${n} 條芯線的線號`);};
  }
  if($('cSelNone'))$('cSelNone').onclick=()=>{coreSel=new Set();renderDetail();};
  box.querySelectorAll('[data-colpick]').forEach(b=>b.onclick=()=>{colPop=colPop===b.dataset.colpick?null:b.dataset.colpick;coreEdit=null;renderDetail();});
  if($('cColReset'))$('cColReset').onclick=()=>{const sc=specCores(c.spec);c.cores.forEach((k,i)=>{const d=sc.find(x=>x.n===k.n)||sc[i];if(d){setCoreColor(k,d.c);const w=by.get(k.n);if(w)paintCore(w,k);}});done();toast('已依規格重設芯線顏色');};
  const addCore=()=>{let n=c.cores.length+1;while(coreDef(c,String(n)))n++;c.cores.push({n:String(n),c:'black',g:specGauge(c.spec)});coreEdit={cid:c.id,i:c.cores.length-1,a:null,b:null,no:''};cabMore=false;done();};
  if($('coreAdd'))$('coreAdd').onclick=addCore;if($('coreAdd2'))$('coreAdd2').onclick=addCore;
  if($('cabPick'))$('cabPick').onclick=()=>{if(cabPick===c.id)stopPick();else startPick(c);};
  box.querySelectorAll('[data-pickcore]').forEach(b=>b.onclick=e=>{e.stopPropagation();startPick(c,b.dataset.pickcore);});
  if($('cabSplit'))$('cabSplit').onclick=()=>{coresOf(c).forEach(detachCore);S.cables=S.cables.filter(x=>x!==c);selCab=null;cabPick=null;done();toast(`已解散電纜 ${c.no}，芯線留成散線`);};
  if($('cabDel'))$('cabDel').onclick=()=>{const n=coresOf(c).length;S.wires=S.wires.filter(w=>w.cab!==c.id);S.cables=S.cables.filter(x=>x!==c);selCab=null;cabPick=null;done();toast(`已刪除電纜 ${c.no}${n?`和 ${n} 條芯線`:''}，可以按復原`);};
  if(!coreEdit) return;
  const k=c.cores[coreEdit.i],w=by.get(k.n);
  if($('ceNo'))$('ceNo').oninput=e=>{coreEdit.no=e.target.value;};
  const pickDev=s=>e=>{coreEdit[s]=e.target.value?{d:e.target.value,t:''}:null;renderDetail();};
  const pickTerm=s=>e=>{if(coreEdit[s])coreEdit[s].t=e.target.value;};
  const pickX=s=>e=>{const v=e.target.value;if(v==='__other'){coreEdit.free={...(coreEdit.free||{}),[s]:true};coreEdit[s]=null;renderDetail();return;}if(!v){coreEdit[s]=null;return;}const [d,t]=v.split('|');coreEdit[s]={d,t};};
  ['a','b'].forEach(s=>{if($('ce'+s+'d'))$('ce'+s+'d').onchange=pickDev(s);if($('ce'+s+'t'))$('ce'+s+'t').onchange=pickTerm(s);if($('ce'+s+'x'))$('ce'+s+'x').onchange=pickX(s);});
  $('ceOk').onclick=()=>{
    const A=coreEdit.a,B=coreEdit.b;
    if(!A||!A.t||!B||!B.t){toast('請選好 A 端和 B 端的接點');return;}
    if(A.d===B.d&&A.t===B.t){toast('兩端不能是同一個接點');return;}
    const x=w||makeCoreWire(A,B,coreEdit.no,c);
    if(w){w.a={...A};w.b={...B};}
    attachCore(x,c,k.n);coreEdit=null;done();toast(`${c.no} 芯線 ${k.n} 已接上（${x.no}）`);
  };
  if($('ceMove'))$('ceMove').onchange=e=>{const t=e.target.value;if(!t)return;swapCores(c,k.n,t);coreEdit=null;done();toast(by.get(t)?`芯線 ${k.n} 和 ${t} 的接線已互換`:`接線已從芯線 ${k.n} 搬到 ${t}`);};
  if($('ceSpare'))$('ceSpare').onclick=()=>{S.wires=S.wires.filter(x=>x!==w);coreEdit=null;done();};
  $('ceDel').onclick=()=>{if(w)S.wires=S.wires.filter(x=>x!==w);c.cores.splice(coreEdit.i,1);coreEdit=null;done();};
  $('ceClose').onclick=()=>{coreEdit=null;renderDetail();};
}
// 新的芯線導線：線號沒填就沿用接點上已有的號碼，再沒有就配下一個號碼
function makeCoreWire(A,B,no,c){
  // 接頭那一端是接頭裡的另一個腳位，不沿用那裡其他芯線的線號
  const pg=c?[plugOf(c,'a'),plugOf(c,'b')].filter(Boolean):[],isP=e=>pg.some(p=>samePt(e,p));
  const n=nextWireNo(),h=inheritNo(isP(A)?B:A,isP(B)?A:B),v=(no||'').trim()||h.no||'W'+String(n).padStart(3,'0');
  if(v==='W'+String(n).padStart(3,'0'))S.nextNo=n+1;
  const w={id:'w'+n+'_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),no:v,a:{...A},b:{...B},wps:[],gauge:.75,color:'black'};
  S.wires.push(w);return w;
}
// 接下一芯：在圖上點兩個接點，接成這條電纜的下一芯（不跳建線視窗）
// 在圖上接芯線：目前要接的芯（沒指定就是第一個還沒接的）；可以跳過、回上一芯、完成
const freeCores=c=>{const u=new Set(coresOf(c).map(w=>w.core));return c.cores.filter(k=>!u.has(k.n));};
function curCore(c){const f=freeCores(c);return f.find(k=>k.n===cabPickCore)||f[0]||null;}
function startPick(c,name){
  if(bothPlug(c)){toast(`${c.no} 兩端都是接頭，不用接芯線`);return;}
  const f=freeCores(c);if(!f.length){toast(`${c.no} 的芯線都接好了，可以先「新增一芯」`);return;}
  if(mode!=='wire')setMode('wire');cabPick=c.id;cabPickCore=(name&&f.some(k=>k.n===name))?name:f[0].n;selCab=c.id;sel=null;
  if(draft)cancelDraft();seedPlugDraft(c);
  renderDetail();renderWires();updateHint();
}
function stopPick(msg){cabPick=null;cabPickCore=null;if(draft)cancelDraft();renderDetail();updateHint();if(msg)toast(msg);}
// 依芯線表順序找下一個（或上一個）還沒接的芯
function stepPick(dir){
  const c=cabOf(cabPick);if(!c)return;const f=freeCores(c);if(!f.length){stopPick();return;}
  const cur=curCore(c),order=c.cores.map(k=>k.n),i=order.indexOf(cur.n);
  for(let s=1;s<=order.length;s++){const n=order[(i+dir*s+order.length*s)%order.length];if(f.some(k=>k.n===n)){cabPickCore=n;break;}}
  if(draft)cancelDraft();seedPlugDraft(c);renderDetail();updateHint();
}
function pickCore(){
  const c=cabPick&&cabOf(cabPick);if(!c){cabPick=null;return false;}
  const k=curCore(c);
  if(!k){stopPick(`${c.no} 的芯線都接好了`);return false;}
  // 一端是接頭：從接頭接到點的那個接點（就算這次是從別的接點開始拉）
  const pg=plugOf(c,'a')||plugOf(c,'b');let A=draft.a,E=draft.end;if(pg&&!samePt(A,pg)&&!samePt(E,pg))A={d:pg.d,t:pg.t};
  const w=makeCoreWire(A,E,'',c);attachCore(w,c,k.n);if(draft.gland)c.gland=draft.gland;
  draft=null;closePop();selCab=c.id;sel=null;
  // 自動換到芯線表裡下一個還沒接的芯
  const f=freeCores(c),order=c.cores.map(x=>x.n),i=order.indexOf(k.n);let nx=null;
  for(let s=1;s<=order.length&&f.length;s++){const n=order[(i+s)%order.length];if(f.some(x=>x.n===n)){nx=n;break;}}
  if(nx)cabPickCore=nx;else{cabPick=null;cabPickCore=null;}
  seedPlugDraft(c);
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
  bar.innerHTML=`<span class="cb-t"><b>${esc(c.no)}</b>　第 ${idx} 芯 <span class="sw" style="background:${swatch(co)}"></span>${esc(k.n)}${k.n!==co.n?'（'+esc(co.n)+'）':''}　<span class="cb-s">${(plugOf(c,'a')||plugOf(c,'b'))?'從接頭拉出，點這一芯要接的接點':draft?'點 B 端接點':'點 A 端接點'}</span>　<span class="note">還有 ${f.length} 芯</span></span>
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
  // 外皮顏色
  if(b.closest('#cColor')){const c=cabOf(selCab);if(!c)return;const key=b.dataset.cdef?null:b.dataset.newc==='cs'?addTemp('cs'):b.dataset.pc;if(key===undefined)return;setCabColor(c,key);commit();recompute();return;}
  const c=cabOf(selCab);if(!c)return;
  const paint=(list,key)=>{list.forEach(k=>{setCoreColor(k,key);const w=coresOf(c).find(x=>x.core===k.n);if(w)paintCore(w,k);});commit();recompute();};
  // 芯線表裡單一芯的顏色選單
  const pop=b.closest('[data-cpop]');
  if(pop){const k=coreDef(c,pop.dataset.cpop);if(!k)return;const key=b.dataset.newc==='cp'?addTemp('cp'):b.dataset.pc;if(!key)return;colPop=null;paint([k],key);return;}
  // 勾選多芯一次套用顏色
  if(b.closest('#cBatch')){const key=b.dataset.newc==='cb'?addTemp('cb'):b.dataset.pc;if(!key)return;const ks=c.cores.filter(k=>coreSel.has(k.n));paint(ks,key);toast(`已把 ${ks.length} 芯改成 ${keyColor(key).n}`);return;}
});

"use strict";
/* ---------- 電纜操作：右側「電纜」分頁、電纜詳細資料與芯線表、接下一芯、剝線點拖曳 ---------- */
let cabForm=false;
const specOptions=cur=>`<option value="">未指定</option>`+cableSpecs(cur).map(v=>`<option value="${esc(v)}"${cur===v?' selected':''}>${esc(v)}</option>`).join('')+`<option value="__new">自訂規格…</option>`;
const sideTags=(cw,k)=>[...new Set(cw.map(w=>tagOf(w[k].d)))].join('、')||'—';
const coreOrder=c=>w=>{const i=c.cores.findIndex(k=>k.n===w.core);return i<0?999:i;};
function selectCable(id){selCab=id;sel=null;picked=null;multi=[];coreEdit=null;}
function renderCables(){
  const cs=[...S.cables].sort((a,b)=>natCmp(a.no,b.no)),loose=S.wires.filter(w=>wireKind(w)==='ext'&&!isCable(w));
  $('listH').textContent=`電纜　${cs.length} 條`;
  let h=`<div class="hrow" style="margin-bottom:6px"><button class="tool" id="cabNew"${mode==='view'?' disabled':''}>${cabForm?'取消新增':'新增電纜'}</button>${hq('cab')}</div>${hn('cab','箱內的隔離線和接到現場的外部電纜都在這裡。點電纜可以看芯線表：每一芯可以用下拉選單選兩端接點，也可以按「接下一芯」直接在圖上點。剝線點（白色小方塊）預設自動放在最近的線槽裡，拖曳可以移到別處，移過的會變黃色。')}`;
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
  return `<div class="revert"><p class="note">這條線是電纜 <b>${esc(c.no)}</b> 的芯線 <b>${esc(w.core)}</b>（${esc(specName(c.spec))}）。顏色、線徑和路徑跟著電纜，到電纜的芯線表修改。</p><div class="row" style="justify-content:flex-start"><button class="tool" id="goCab">到電纜 ${esc(c.no)}</button><button class="tool" id="unCore">移出電纜，改回散線</button></div></div>`;
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
  const rows=c.cores.map((k,i)=>{const w=by.get(k.n),co=coreColor(k);
    return `<tr class="${coreEdit&&coreEdit.i===i?'on':''}" data-ci="${i}"><td><span class="sw" style="background:${swatch(co)}"></span>${esc(k.n)}</td><td>${w?esc(w.no):'<span class="note">備用</span>'}</td><td>${w?esc(epText(w.a)):''}</td><td>${w?esc(epText(w.b)):''}</td></tr>`;}).join('');
  const orphan=cw.filter(w=>!coreDef(c,w.core));
  let ed='';
  if(coreEdit&&!ro){
    const k=c.cores[coreEdit.i],w=by.get(k.n),A=coreEdit.a,B=coreEdit.b,dA=A&&devOf(A.d),dB=B&&devOf(B.d);
    ed=`<div class="coreed"><div class="sub-h">芯線 ${esc(k.n)}</div><div class="fields">
      <label for="ceN">芯線名稱<input id="ceN" maxlength="10" value="${esc(k.n)}"></label><label for="ceNo">線號<input id="ceNo" maxlength="16" value="${esc(coreEdit.no)}" placeholder="自動"></label>
      <label for="ceAd">A 端器具<select id="ceAd">${devOptions(A&&A.d)}</select></label><label for="ceAt">A 端接點<select id="ceAt">${termOptions(dA,A&&A.t)}</select></label>
      <label for="ceBd">B 端器具${L.ext?'（現場）':''}<select id="ceBd">${devOptions(B&&B.d)}</select></label><label for="ceBt">B 端接點<select id="ceBt">${termOptions(dB,B&&B.t)}</select></label></div>
      <div class="sub-h">芯線顏色</div>${colorChips(k.c,'cc',k.hex?{color:k.c,hex:k.hex,cname:k.cn}:null)}
      <div class="row" style="justify-content:flex-start"><button class="primary" id="ceOk">${w?'更新這一芯':'接上這一芯'}</button>${w?'<button class="tool" id="ceSpare">改為備用</button>':''}<button class="tool danger" id="ceDel">刪除這一芯</button><button class="tool" id="ceClose">關閉</button></div></div>`;
  }
  const boRow=k=>{const p=r&&r[k];return p?`<button class="tool" data-bor="${k}"${p.auto||ro?' disabled':''}>${k.toUpperCase()} 端${p.auto?'自動':'已移動，改回自動'}</button>`:'';};
  box.innerHTML=`<div class="fields"><label for="cNo">電纜編號<input id="cNo" maxlength="12" value="${esc(c.no)}" style="font-size:15px;font-weight:600"></label>
    <label for="cField">${L.ext?'現場長度 m':'另加長度 m'}<input id="cField" type="number" min="0" step="0.1" value="${c.fieldLen?Math.round(c.fieldLen/100)/10:''}" placeholder="${L.ext?'到現場設備':'0'}"></label>
    <label for="cSpec" style="grid-column:1/-1">規格<select id="cSpec">${specOptions(c.spec)}</select></label>
    <label for="cSpecNew" id="cSpecNewL" style="grid-column:1/-1" hidden>自訂規格（例如 0.75mm²*7C 號碼）<input id="cSpecNew" maxlength="60"></label>
    ${L.ext?`<label for="cGland" style="grid-column:1/-1">出線口<select id="cGland"><option value="">自動選最近</option>${S.glands.map(g=>`<option value="${g.id}"${c.gland===g.id?' selected':''}>${esc(g.id)}　${esc(g.spec)}</option>`).join('')}</select></label>`:''}</div>
    <dl><dt>種類</dt><dd>${cw.length?(L.ext?'外部電纜（到現場）':'箱內電纜'):'還沒有接芯線'}</dd><dt>芯線</dt><dd>已接 ${cw.length} / ${c.cores.length} 芯</dd>${r?`<dt>經過</dt><dd>${r.via.length?esc(r.via.join(' → ')):'直接'}${r.gland?' → '+esc(r.gland):''}</dd>`:''}
      <dt>長度</dt><dd>${L.ext?'箱內':'圖面'} ${m1(L.box)} m${L.ext?`＋現場 ${L.field?m1(L.field)+' m':'未填'}`:L.field?`＋另加 ${m1(L.field)} m`:''}${L.spare?`＋預留 ${m1(L.spare)} m`:''}＝<b>${m1(L.total)} m</b></dd></dl>
    <label class="check"><input type="checkbox" id="cDirect"${c.direct?' checked':''}>外被不進線槽（直接拉線）</label>
    <div class="hrow"><span class="note">外被路徑：中繼點 ${(c.wps||[]).length} 個 ${hq('cwp')}</span></div>${hn('cwp','選取電纜後，雙擊外被可以加中繼點，拖曳白點調整，雙擊白點刪除。中繼點之間直接連，剝線點到中繼點照樣走線槽。電纜本來就能走線槽外，穿過其他器具不警告。')}
    ${(c.wps||[]).length?'<div class="row" style="justify-content:flex-start"><button class="tool" id="cWpClr">清除中繼點，改回自動</button></div>':''}
    ${r?`<div class="hrow"><span class="note">剝線點 ${hq('bo')}</span></div>${hn('bo','剝線點是剝掉外被、芯線分開的位置，圖上的白色小方塊。預設放在離芯線最近的線槽裡；拖曳可以移動（接線或擺放模式都可以），移過的變黃色。')}<div class="row" style="justify-content:flex-start">${boRow('a')}${boRow('b')}</div>`:''}
    <div class="sub-h">芯線表（點一列可以編輯）</div>
    <table class="rtab cores"><thead><tr><th>芯</th><th>線號</th><th>A 端</th><th>B 端</th></tr></thead><tbody>${rows||'<tr><td colspan="4" class="note">沒有芯線，按「新增一芯」</td></tr>'}</tbody></table>
    ${orphan.length?`<p class="flag">芯線表裡沒有：${orphan.map(w=>esc(w.core)+'（'+esc(w.no)+'）').join('、')}，請改規格或新增一芯</p>`:''}
    ${ed}
    <div class="row" style="justify-content:flex-start"><button class="tool" id="cabPick">${cabPick===c.id?'結束接下一芯':'接下一芯（在圖上點）'}</button><button class="tool" id="coreAdd">新增一芯</button></div>
    <div class="row" style="justify-content:flex-start"><button class="tool" id="cabSplit">解散電纜（芯線保留成散線）</button><button class="tool danger" id="cabDel">刪除電纜和芯線</button></div>`;
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
  box.querySelectorAll('tr[data-ci]').forEach(tr=>tr.onclick=()=>{
    const i=Number(tr.dataset.ci),k=c.cores[i],w=by.get(k.n);
    coreEdit=coreEdit&&coreEdit.i===i?null:{cid:c.id,i,a:w?{...w.a}:null,b:w?{...w.b}:null,no:w?w.no:''};renderDetail();
  });
  $('coreAdd').onclick=()=>{let n=c.cores.length+1;while(coreDef(c,String(n)))n++;c.cores.push({n:String(n),c:'black',g:specGauge(c.spec)});coreEdit={cid:c.id,i:c.cores.length-1,a:null,b:null,no:''};done();};
  $('cabPick').onclick=()=>{
    if(cabPick===c.id){cabPick=null;renderDetail();updateHint();return;}
    if(!freeCore(c)){toast(`${c.no} 的芯線都接好了，可以先「新增一芯」`);return;}
    if(mode!=='wire')setMode('wire');cabPick=c.id;selCab=c.id;renderDetail();updateHint();
  };
  $('cabSplit').onclick=()=>{coresOf(c).forEach(detachCore);S.cables=S.cables.filter(x=>x!==c);selCab=null;cabPick=null;done();toast(`已解散電纜 ${c.no}，芯線留成散線`);};
  $('cabDel').onclick=()=>{const n=coresOf(c).length;S.wires=S.wires.filter(w=>w.cab!==c.id);S.cables=S.cables.filter(x=>x!==c);selCab=null;cabPick=null;done();toast(`已刪除電纜 ${c.no}${n?`和 ${n} 條芯線`:''}，可以按復原`);};
  if(!coreEdit) return;
  const k=c.cores[coreEdit.i],w=by.get(k.n);
  $('ceN').onchange=e=>{const v=e.target.value.trim().slice(0,10);if(!v||v===k.n){e.target.value=k.n;return;}if(coreDef(c,v)){toast(`已經有芯線 ${v}`);e.target.value=k.n;return;}if(w)w.core=v;k.n=v;done();};
  $('ceNo').oninput=e=>{coreEdit.no=e.target.value;};
  const pickDev=s=>e=>{coreEdit[s]=e.target.value?{d:e.target.value,t:''}:null;renderDetail();};
  const pickTerm=s=>e=>{if(coreEdit[s])coreEdit[s].t=e.target.value;};
  $('ceAd').onchange=pickDev('a');$('ceBd').onchange=pickDev('b');$('ceAt').onchange=pickTerm('a');$('ceBt').onchange=pickTerm('b');
  $('ceOk').onclick=()=>{
    const A=coreEdit.a,B=coreEdit.b;
    if(!A||!A.t||!B||!B.t){toast('請選好 A 端和 B 端的接點');return;}
    if(A.d===B.d&&A.t===B.t){toast('兩端不能是同一個接點');return;}
    const x=w||makeCoreWire(A,B,coreEdit.no);
    if(w){w.a={...A};w.b={...B};const v=coreEdit.no.trim();if(v)w.no=v;}
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
function pickCore(){
  const c=cabPick&&cabOf(cabPick);if(!c){cabPick=null;return false;}
  const k=freeCore(c);
  if(!k){cabPick=null;toast(`${c.no} 的芯線都接好了`);return false;}
  const w=makeCoreWire(draft.a,draft.end,'');attachCore(w,c,k.n);
  draft=null;closePop();selCab=c.id;sel=null;
  const nx=freeCore(c);if(!nx)cabPick=null;
  commit();recompute();
  toast(`${c.no} 芯線 ${k.n} 已接上（${w.no}）`+(nx?`，接著點芯線 ${nx.n} 的 A 端`:'，全部芯線都接好了'));
  return true;
}
function cabHint(){
  const c=cabPick&&cabOf(cabPick),k=c&&freeCore(c);if(!k) return null;
  const col=coreColor(k).n;
  return draft?`接下一芯：${c.no} 芯線 ${k.n}（${col}），點 B 端接點完成；Esc 取消這一芯。`:`接下一芯：${c.no} 芯線 ${k.n}（${col}），點 A 端接點開始；Esc 結束接下一芯。`;
}
$('list').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.id==='cabNew'){cabForm=!cabForm;renderList();if(cabForm)$('nfNo').focus();return;}
  if(b.dataset.cl){const v=selCab===b.dataset.cl?null:b.dataset.cl;selectCable(v);if(mode==='place')setMode('wire');selCab=v;renderList();renderWires();renderDetail();updateHint();}
});
// 芯線顏色：芯線表編輯中按顏色
$('detail').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b||sel||picked||!selCab||!coreEdit)return;
  const c=cabOf(selCab),k=c&&c.cores[coreEdit.i];if(!k)return;
  let key=null;
  if(b.dataset.newc==='cc') key=addTemp('cc');else if(b.dataset.pc) key=b.dataset.pc;
  if(!key) return;
  setCoreColor(k,key);const w=coresOf(c).find(x=>x.core===k.n);if(w)paintCore(w,k);
  commit();recompute();
});

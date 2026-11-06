"use strict";
/* ---------- 建線彈窗 ---------- */
const draftIsExt=()=>draft&&draft.end&&(devOf(draft.a.d).sheet==='field'||devOf(draft.end.d).sheet==='field');
function nextCable(){let i=1;while(S.wires.some(w=>w.ext&&w.ext.cable==='C'+String(i).padStart(2,'0')))i++;return 'C'+String(i).padStart(2,'0');}
function openPop(){
  draft.pop=true;
  if(draftIsExt()){
    const fd=devOf(draft.a.d).sheet==='field'?draft.a:draft.end;
    const sameDev=S.wires.find(w=>w.ext&&wireKind(w)==='ext'&&(w.a.d===fd.d||w.b.d===fd.d));
    draft.ext={cable:sameDev?sameDev.ext.cable:nextCable(),core:fd.t,spec:sameDev?sameDev.ext.spec:''};
  }
  if(draft.no==null){const h=inheritNo(draft.a,draft.end);draft.no=h.no||'W'+String(nextWireNo()).padStart(3,'0');draft.noHint=h.a&&h.b&&h.a!==h.b?`起點已有 ${h.a}、終點已有 ${h.b}，預設用起點的線號`:h.no?`沿用接點上已有的線號 ${h.no}（同電位）`:'';}
  const pop=$('pop'),st=$('stage').getBoundingClientRect();
  fillPop();
  pop.hidden=false;
  const pw=pop.offsetWidth,ph=pop.offsetHeight;
  let x=cursor.sx+18,y=cursor.sy-ph/2;
  if(x+pw>st.width-8) x=cursor.sx-pw-18;
  x=Math.max(8,Math.min(x,st.width-pw-8));y=Math.max(8,Math.min(y,st.height-ph-8));
  pop.style.left=x+'px';pop.style.top=y+'px';
  $('popOk').focus();
  snap=null;renderOverlay();updateHint();
}
function fillPop(){
  const ex=draftIsExt();
  $('pop').innerHTML=`<div class="ends">${esc(epText(draft.a))} → ${esc(epText(draft.end))}${draft.wps.length?`（${draft.wps.length} 中繼點）`:''}${ex?'　外線':''}</div>
  ${ex?`<div class="fields"><label for="pCable">電纜編號<input id="pCable" maxlength="12" value="${esc(draft.ext.cable)}"></label><label for="pCore">芯線<input id="pCore" maxlength="10" value="${esc(draft.ext.core)}"></label><label for="pSpec" style="grid-column:1/-1">電纜規格<select id="pSpec">${cableOptions(draft.ext.spec)}</select></label></div>`:''}
  <div class="fields"><label for="pNo" style="grid-column:1/-1">線號<input id="pNo" maxlength="16" value="${esc(draft.no)}"></label></div>${draft.noHint?`<p class="note">${esc(draft.noHint)}</p>`:''}
  <div><h3>線徑 mm²</h3>${gaugeChips(last.gauge,'pg','pn')}</div>
  <div><h3>顏色</h3>${colorChips(last.color,'pn')}</div>
  <p class="note">${esc(stockMsg(last.gauge,last.color))}。臨時顏色重新整理後會從選單移除，已接的線顏色不變。</p>
  <label class="check"><input type="checkbox" id="pDirect"${last.direct?' checked':''}>不進線槽（直接拉線，例如動力線）</label>
  <div class="row"><button class="tool" id="popNo">取消</button><button class="primary" id="popOk">建立</button></div>`;
  $('pNo').oninput=e=>{draft.no=e.target.value;};
  $('pDirect').onchange=e=>{last.direct=e.target.checked;renderOverlay();};
  if(ex){$('pCable').oninput=e=>draft.ext.cable=e.target.value;$('pCore').oninput=e=>draft.ext.core=e.target.value;$('pSpec').onchange=e=>draft.ext.spec=e.target.value;}
}
function closePop(){$('pop').hidden=true;}
function finishWire(){
  const n=nextWireNo(),no=(draft.no||'').trim()||'W'+String(n).padStart(3,'0');
  if(no==='W'+String(n).padStart(3,'0'))S.nextNo=n+1;
  const w={id:'w'+n+'_'+Date.now().toString(36),no,a:draft.a,b:draft.end,wps:draft.wps,gauge:last.gauge,color:last.color};
  applyColor(w,last.color);
  if(last.direct) w.direct=true;
  if(draftIsExt()) w.ext={cable:draft.ext.cable,core:draft.ext.core,spec:draft.ext.spec};
  S.wires.push(w);draft=null;closePop();sel=w.id;commit();recompute();
}
function cancelDraft(){draft=null;closePop();renderOverlay();updateHint();}
$('pop').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.newc){last.color=addTemp(b.dataset.newc);fillPop();renderOverlay();$('popOk').focus();return;}
  if(b.dataset.newg){const v=addTempGauge(b.dataset.newg);if(v==null)return;last.gauge=v;fillPop();renderOverlay();$('popOk').focus();return;}
  if(b.dataset.pg||b.dataset.pc){
    if(b.dataset.pg) last.gauge=Number(b.dataset.pg);
    if(b.dataset.pc) last.color=b.dataset.pc;
    fillPop();renderOverlay();$('popOk').focus();return;
  }
  if(b.id==='popOk') finishWire();
  if(b.id==='popNo') cancelDraft();
});


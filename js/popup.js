"use strict";
/* ---------- 建線彈窗 ---------- */
const draftIsExt=()=>draft&&draft.end&&(devOf(draft.a.d).sheet==='field'||devOf(draft.end.d).sheet==='field');
const nextCable=()=>nextCableNo();
function openPop(){
  draft.pop=true;
  if(draftIsExt()){
    const fd=devOf(draft.a.d).sheet==='field'?draft.a:draft.end;
    // 同一個現場設備已經有電纜、而且還有空的芯：預設編進那條電纜的下一芯
    // 兩端都在現場（例如同一個現場設備上的跳線）：不經過箱體，預設散線，不建議編進電纜
    const both=devOf(draft.a.d).sheet==='field'&&devOf(draft.end.d).sheet==='field';
    const c=!both&&S.cables.find(x=>freeCore(x)&&coresOf(x).some(w=>w.b.d===fd.d||w.a.d===fd.d));
    draft.ext={cable:both?'':c?c.no:nextCable(),core:'',spec:c?c.spec:''};
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
// 連接器：兩端都是連接器＝排線；只有一端是連接器＝散線要選接哪一支針腳
function draftCn(){const ca=cnWhole(devOf(draft.a.d),draft.a.t),cb=cnWhole(devOf(draft.end.d),draft.end.t);return ca&&cb?{mode:'ribbon'}:ca?{mode:'a',c:ca,e:draft.a}:cb?{mode:'b',c:cb,e:draft.end}:null;}
function pinPick(cn){const d=devOf(cn.e.d),used=k=>S.wires.some(w=>wiredAt(w,d.id,cn.e.t+'.'+k)&&!(w.ribbon));
  if(!draft.pin||!cn.c.keys.includes(draft.pin))draft.pin=cn.c.keys.find(k=>!used(k))||cn.c.keys[0];
  return `<div class="fields"><label for="pPin">${esc(tagOf(d.id))} ${esc(cn.e.t)} 的針腳<select id="pPin">${cn.c.keys.map(k=>`<option value="${esc(k)}"${k===draft.pin?' selected':''}>${esc(termLabel(d,cn.e.t+'.'+k).replace(cn.e.t+'-',''))}${k!==cn.c.sig[k]?'':''}${used(k)?'（已接）':''}</option>`).join('')}</select></label></div>`;}
function fillPop(){
  const ex=draftIsExt(),cn=draftCn();
  $('pop').innerHTML=`<div class="ends">${esc(epText(draft.a))} → ${esc(epText(draft.end))}${draft.wps.length?`（${draft.wps.length} 中繼點）`:''}${ex?'　外線':''}</div>
  ${cn&&cn.mode==='ribbon'?'<p class="note">兩端都是連接器：建立一條排線，模擬照針腳一一對接。</p>':cn?pinPick(cn):''}
  ${ex?`<div class="fields"><label for="pCable">電纜編號<input id="pCable" maxlength="12" list="pCabL" value="${esc(draft.ext.cable)}" placeholder="空白＝散線"><datalist id="pCabL">${S.cables.map(c=>`<option value="${esc(c.no)}">`).join('')}</datalist></label><label for="pCore">芯線<input id="pCore" maxlength="10" value="${esc(draft.ext.core)}" placeholder="下一芯"></label>${!draft.ext.cable.trim()?'<p class="note" style="grid-column:1/-1">散線，不編進電纜；要編進電纜就填電纜編號</p>':S.cables.some(c=>c.no===draft.ext.cable.trim())?`<p class="note" style="grid-column:1/-1">編進已有的電纜 ${esc(draft.ext.cable)}，顏色與線徑照電纜芯線</p>`:`<label for="pSpec" style="grid-column:1/-1">新電纜規格<select id="pSpec">${cableOptions(draft.ext.spec)}</select></label>`}</div>`:''}
  <div class="fields"><label for="pNo">線號<input id="pNo" maxlength="16" value="${esc(draft.no)}"></label><label for="pLab">線號標在<select id="pLab">${LAB_AT.map(([k,n])=>`<option value="${k}"${(last.labAt||'start')===k?' selected':''}>${n}</option>`).join('')}</select></label></div>${draft.noHint?`<p class="note">${esc(draft.noHint)}</p>`:''}
  <div><h3>線徑 mm²</h3>${gaugeChips(last.gauge,'pg','pn')}</div>
  <div><h3>顏色</h3>${colorChips(last.color,'pn')}</div>
  <p class="note">${esc(stockMsg(last.gauge,last.color))}。臨時顏色重新整理後會從選單移除，已接的線顏色不變。</p>
  <label class="check"><input type="checkbox" id="pDirect"${last.direct?' checked':''}>不進線槽（直接拉線，例如動力線）</label>
  <div class="row"><button class="tool" id="popNo">取消</button><button class="primary" id="popOk">建立</button></div>`;
  $('pNo').oninput=e=>{draft.no=e.target.value;};
  if($('pPin'))$('pPin').onchange=e=>{draft.pin=e.target.value;};
  $('pLab').onchange=e=>{last.labAt=e.target.value;}; // 記住上次的選擇，下一條線照用
  $('pDirect').onchange=e=>{last.direct=e.target.checked;renderOverlay();};
  if(ex){$('pCable').oninput=e=>draft.ext.cable=e.target.value;$('pCable').onchange=()=>{fillPop();};$('pCore').oninput=e=>draft.ext.core=e.target.value;if($('pSpec'))$('pSpec').onchange=e=>{const v=e.target.value;if(v==='__new'){e.target.value=draft.ext.spec||'';specDialog({onSave:n=>{if(draft&&draft.ext){draft.ext.spec=n;fillPop();}}});return;}draft.ext.spec=v;};}
}
function closePop(){$('pop').hidden=true;}
function finishWire(){
  const n=nextWireNo(),no=(draft.no||'').trim()||'W'+String(n).padStart(3,'0');
  if(no==='W'+String(n).padStart(3,'0'))S.nextNo=n+1;
  const cn=draftCn(),w={id:'w'+n+'_'+Date.now().toString(36),no,a:{...draft.a},b:{...draft.end},wps:draft.wps,gauge:last.gauge,color:last.color};
  if(cn&&cn.mode==='a')w.a.t=draft.a.t+'.'+draft.pin;if(cn&&cn.mode==='b')w.b.t=draft.end.t+'.'+draft.pin; // 散線接在選的那一支針腳
  applyColor(w,last.color);
  if(cn&&cn.mode==='ribbon'){w.ribbon=true;w.direct=true;w.gauge=.3;w.color='gray';}
  if(last.direct) w.direct=true;
  if(last.labAt&&last.labAt!=='start') w.labAt=last.labAt;
  if(draft.gland) w.gland=draft.gland;
  S.wires.push(w);
  if(!w.ribbon&&draftIsExt()&&draft.ext.cable.trim()){
    const no=draft.ext.cable.trim().slice(0,12),c=S.cables.find(x=>x.no===no)||newCable(no,draft.ext.spec);
    attachCore(w,c,draft.ext.core.trim()||null);
    if(draft.gland) c.gland=draft.gland; // 電纜整條走拉線時點的出線口
  }draft=null;closePop();sel=w.id;commit();recompute();
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


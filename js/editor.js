"use strict";
/* ---------- 器具編輯器 ---------- */
let ed=null;
function openEditor(tplId,dev){
  const base=tplId?resolveTpl(tplId,dev&&dev.count):null;
  ed={srcId:tplId,dev:dev||null,keepId:!!tplId&&!base.gen,terms:base?base.terms.map(t=>({...t})):[]};
  ed.orig=ed.terms.map(t=>({...t})); // 開啟時的接點：改名時沿用位置，儲存時用來把導線改接到新編號
  $('edTitle').textContent=base?`編輯器具：${base.n}`:'新增自訂器具';
  $('edSlotNote').hidden=!hasSlots(base);
  $('eName').value=base?base.n:'';$('eBrand').value=base?base.b:'';$('eSheet').value=base?(base.sheet||'plate'):'plate';$('ePre').value=base?base.pre:'U';
  $('eW').value=base?+base.w.toFixed(1):45;$('eH').value=base?base.h:80;$('eD').value=base?base.d:60;$('eCol').value=base?base.f:'#54595b';$('eOk').checked=!!(base&&base.ok);
  $('eTop').value=ed.terms.filter(t=>t.side==='top').map(t=>t.id).join(',');$('eBot').value=ed.terms.filter(t=>t.side==='bottom').map(t=>t.id).join(',');
  $('ed').hidden=false;drawEd();$('eName').focus();
}
const edIds=side=>$(side==='top'?'eTop':'eBot').value.split(/[,，、]/).map(s=>s.trim()).filter(Boolean).slice(0,120);
// 接點位置：數量沒變就沿用原位置，只改名字；原本是多層錯開（例如 WAGO 2202 雙層）就照原本的層數與間距延伸；
// 單排且數量改變時才重新平均排列
function edLayout(side){
  const ids=edIds(side),n=ids.length,old=ed.orig.filter(t=>t.side===side);
  const w=Number($('eW').value)||40,h=Number($('eH').value)||40,y=side==='top'?7:h-7,m=Math.min(6,w/4);
  const k=new Set(old.map(t=>t.y)).size;
  const pos=i=>{
    if(i<old.length&&(n===old.length||k>1)) return old[i];
    if(k>1&&old.length>k){const r=old[i%k],step=old[k].x-old[0].x;return {x:+(r.x+step*Math.floor(i/k)).toFixed(2),y:r.y,desc:''};}
    return {x:n===1?w/2:m+(w-2*m)*i/(n-1),y,desc:''};
  };
  const others=ed.terms.filter(t=>t.side!==side);
  ed.terms=[...others,...ids.map((id,i)=>{const p=pos(i);return {id,x:p.x,y:p.y,side,desc:p.desc||''};})];
}
function drawEd(){
  const w=Number($('eW').value)||40,h=Number($('eH').value)||40,c=$('eCol').value,p=Math.max(w,h)*.12+4;
  const pv=$('edPrev');pv.setAttribute('viewBox',`${-p} ${-p} ${w+2*p} ${h+2*p}`);
  const fs=Math.max(w,h)/28,r=Math.max(w,h)/70+.8;
  pv.innerHTML=`<rect x="0" y="0" width="${w}" height="${h}" rx="2" fill="${c}" stroke="#000" stroke-opacity=".5" stroke-width="${r/4}"/>`+ed.terms.map((t,i)=>`<g data-et="${i}" style="cursor:move"><circle cx="${t.x}" cy="${t.y}" r="${r*1.6}" fill="transparent"/><circle class="term" cx="${t.x}" cy="${t.y}" r="${r}"/><text x="${t.x}" y="${t.y+(t.side==='top'?r+fs:-r-fs*.3)}" text-anchor="middle" font-size="${fs}" font-family="monospace" fill="${casing(c)==='#222725'?'#111':'#fff'}">${esc(t.id)}</text></g>`).join('');
}
['eW','eH','eCol'].forEach(id=>{$(id).oninput=()=>{const nh=Number($('eH').value)||40;ed.terms.filter(t=>t.side==='bottom'&&t.y>nh).forEach(t=>t.y=nh-7);drawEd();};});
$('eTop').oninput=()=>{edLayout('top');drawEd();};
$('eBot').oninput=()=>{edLayout('bottom');drawEd();};
let edDrag=null;
$('edPrev').addEventListener('pointerdown',e=>{const g=e.target.closest('[data-et]');if(!g)return;edDrag=Number(g.dataset.et);$('edPrev').setPointerCapture(e.pointerId);});
$('edPrev').addEventListener('pointermove',e=>{
  if(edDrag===null)return;
  const m=$('edPrev').getScreenCTM();if(!m)return;const pt=new DOMPoint(e.clientX,e.clientY).matrixTransform(m.inverse());
  const t=ed.terms[edDrag];if(!t)return;t.x=Math.round(pt.x*2)/2;t.y=Math.round(pt.y*2)/2;drawEd();
});
$('edPrev').addEventListener('pointerup',()=>{if(edDrag!==null)ed.orig=ed.terms.map(t=>({...t}));edDrag=null;});
$('edCancel').onclick=()=>{$('ed').hidden=true;ed=null;};
$('edSave').onclick=()=>{
  const name=$('eName').value.trim();
  if(!name){toast('請填器具名稱');$('eName').focus();return;}
  if(!ed.terms.length&&!confirmNoTerms()) return;
  const raw={b:$('eBrand').value,n:name,w:Number($('eW').value),h:Number($('eH').value),d:Number($('eD').value),pre:$('ePre').value,f:$('eCol').value,sheet:$('eSheet').value,ok:$('eOk').checked,terms:ed.terms};
  const c=cleanTpl(raw);if(!c)return;
  const src=ed.srcId&&(S.tpls[ed.srcId]||TPL[ed.srcId]);
  if(src){c.note=src.note||'';c.cat=src.cat||c.cat;}
  const orig=TPL[ed.srcId]?ed.srcId:src&&src.src;if(orig)c.src=orig; // 記住原廠型號，之後可以換回
  S.tpls=S.tpls||{};
  let id=ed.keepId?ed.srcId:null;
  if(!id){let i=1;while(S.tpls['c'+i])i++;id='c'+i;}
  // 上排或下排數量沒變時，把接在舊編號的導線改接到同位置的新編號
  const ren={};
  ['top','bottom'].forEach(sd=>{const a=ed.orig.filter(t=>t.side===sd).map(t=>t.id),b=edIds(sd);if(a.length===b.length)a.forEach((x,i)=>{if(x!==b[i])ren[x]=b[i];});});
  const devs=ed.keepId?S.devices.filter(d=>d.tpl===id):ed.dev?[ed.dev]:[],dids=new Set(devs.map(d=>d.id));
  S.wires.forEach(w=>[w.a,w.b].forEach(e=>{if(dids.has(e.d)&&ren[e.t]!==undefined)e.t=ren[e.t];}));
  S.tpls[id]=c;
  if(ed.dev){ed.dev.tpl=id;delete ed.dev.count;ed.dev.sheet=c.sheet;}
  const before=S.wires.length;
  $('ed').hidden=true;ed=null;
  computeRoutes();commit();recompute();renderPalette();
  toast(S.wires.length<before?`器具已儲存，少了接點而移除 ${before-S.wires.length} 條線；可按復原`:'器具已儲存');
};
function confirmNoTerms(){toast('請至少填一個接點');return false;}


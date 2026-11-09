"use strict";
/* ---------- 器具編輯器（畫布式）：畫外框、點一下放接點、命名、對齊、等距、同電位 ----------
   ed.terms 每個接點有 uid（編輯器內部用）、id（接點名稱）、oid（打開時的名稱，儲存時把導線改接到新名稱）。
   出線方向 auto＝依接點靠近哪一邊自動決定；使用者指定後 auto 變 false。 */
let ed=null,edUid=1,edDrag=null;
const ED_SIDE={top:'上',bottom:'下',left:'左',right:'右'};
const ED_SHAPE={rect:'矩形',rounded:'圓角矩形',circle:'圓形'};
function openEditor(tplId,dev,opt={}){
  const base=tplId?resolveTpl(tplId,dev&&dev.count):null,copy=!!opt.copy;
  const shape=base?(base.round?'circle':(base.rx>=5?'rounded':'rect')):'rect';
  ed={srcId:copy?null:tplId,copyOf:copy?tplId:null,dev:copy?null:(dev||null),keepId:!copy&&!!tplId&&!base.gen,
    shape,w:base?+base.w.toFixed(2):45,h:base?+base.h.toFixed(2):80,d:base?base.d:60,f:base?base.f:'#54595b',
    n:base?(copy?base.n+'（複製）':base.n):'',b:base?base.b:'',pre:base?base.pre:'U',
    sheet:base?(base.outside?'outside':(base.sheet||'plate')):'plate',note:base&&base.note||'',ok:!!(base&&base.ok&&!copy),
    terms:[],links:[],sel:new Set(),tool:base&&base.terms.length?'select':'add',grid:.5,pfx:'',next:1,hist:[],fut:[],row:null,box:null};
  ed.terms=(base?base.terms:[]).map(t=>{const o={...t,uid:edUid++,oid:copy?null:t.id};o.auto=edAuto(o)===t.side;return o;});
  const byId=new Map(ed.terms.map(t=>[t.id,t.uid]));
  ed.links=((base&&base.links)||[]).map(g=>g.map(id=>byId.get(id)).filter(Boolean)).filter(g=>g.length>1);
  ed.next=edNextNum();
  $('edTitle').textContent=copy?`複製器具：${base.n}`:base?`編輯器具：${base.n}`:'新增自訂器具';
  $('edSlotNote').hidden=!(base&&hasSlots(base));
  $('ed').hidden=false;edBar();edSide();drawEd();
}
// 接點靠近哪一邊：矩形看離哪個邊最近，圓形看在圓心的哪個方向
function edAuto(t){
  if(ed&&ed.shape==='circle'){const dx=t.x-ed.w/2,dy=t.y-ed.h/2;return Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'bottom':'top');}
  const w=ed?ed.w:40,h=ed?ed.h:40,d={top:t.y,bottom:h-t.y,left:t.x,right:w-t.x};
  return Object.keys(d).sort((a,b)=>d[a]-d[b])[0];
}
function edNextNum(){let n=0;ed.terms.forEach(t=>{const m=String(t.id).match(new RegExp('^'+ed.pfx.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(\\d+)$'));if(m)n=Math.max(n,Number(m[1]));});return n+1;}
function edNewId(){let n=ed.next,id;do{id=ed.pfx+n;n++;}while(ed.terms.some(t=>t.id===id));ed.next=n;return id;}
const edSnap=v=>ed.grid?Math.round(v/ed.grid)*ed.grid:Math.round(v*100)/100;
const edSel=()=>ed.terms.filter(t=>ed.sel.has(t.uid));
const edState=()=>JSON.stringify({shape:ed.shape,w:ed.w,h:ed.h,terms:ed.terms,links:ed.links});
function edPush(){ed.hist.push(edState());if(ed.hist.length>100)ed.hist.shift();ed.fut=[];}
function edRestore(j){const o=JSON.parse(j);ed.shape=o.shape;ed.w=o.w;ed.h=o.h;ed.terms=o.terms;ed.links=o.links;ed.sel=new Set([...ed.sel].filter(u=>ed.terms.some(t=>t.uid===u)));}
function edUndo(){if(!ed.hist.length)return;ed.fut.push(edState());edRestore(ed.hist.pop());edAll();}
function edRedo(){if(!ed.fut.length)return;ed.hist.push(edState());edRestore(ed.fut.pop());edAll();}
function edAll(){edBar();edSide();drawEd();}
function edReside(t){if(t.auto)t.side=edAuto(t);}
/* ---------- 畫布 ---------- */
function drawEd(){
  const w=ed.w,h=ed.h,p=Math.max(w,h)*.14+8,pv=$('edPrev');
  pv.setAttribute('viewBox',`${-p} ${-p} ${w+2*p} ${h+2*p}`);
  const r=edR(),fs=Math.max(r*1.5,(Math.max(w,h)+2*p)/80),ink=casing(ed.f)==='#222725'?'#15181a':'#f1f2ee';
  const rx=ed.shape==='circle'?Math.min(w,h)/2:ed.shape==='rounded'?Math.min(8,Math.min(w,h)/5):2.5;
  const g=ed.grid&&ed.grid>=.5?ed.grid*(ed.grid<1?4:ed.grid<2.5?5:2):5;
  let s=`<defs><pattern id="edGrid" width="${g}" height="${g}" patternUnits="userSpaceOnUse"><path d="M${g} 0H0V${g}" fill="none" stroke="currentColor" stroke-opacity=".12" stroke-width=".2"/></pattern></defs>`;
  s+=`<rect x="${-p}" y="${-p}" width="${w+2*p}" height="${h+2*p}" fill="url(#edGrid)" style="color:var(--fg)"/>`;
  s+=`<rect x="0" y="0" width="${w}" height="${h}" rx="${rx}" fill="${ed.f}" stroke="#000" stroke-opacity=".5" stroke-width="${r/4}"/>`;
  // 同電位：組內接點用虛線連起來
  ed.links.forEach(gr=>{const ps=gr.map(u=>ed.terms.find(t=>t.uid===u)).filter(Boolean);for(let i=1;i<ps.length;i++)s+=`<line class="lk" x1="${ps[i-1].x}" y1="${ps[i-1].y}" x2="${ps[i].x}" y2="${ps[i].y}" stroke-width="${r/2.5}"/>`;});
  const V={top:[0,-1],bottom:[0,1],left:[-1,0],right:[1,0]},L={top:[0,1],bottom:[0,-1],left:[1,0],right:[-1,0]};
  ed.terms.forEach(t=>{const v=V[t.side]||[0,-1],l=L[t.ls||t.side]||[0,1],on=ed.sel.has(t.uid);
    s+=`<g class="et" data-eu="${t.uid}"><line x1="${t.x}" y1="${t.y}" x2="${t.x+v[0]*r*3}" y2="${t.y+v[1]*r*3}" stroke="${ink}" stroke-opacity=".55" stroke-width="${r/3}"/>`+
      `<circle class="term" cx="${t.x}" cy="${t.y}" r="${r}"/>${on?`<circle class="sel-ring" cx="${t.x}" cy="${t.y}" r="${r*1.8}" style="stroke-width:${r/3}"/>`:''}`+
      `<text x="${t.x+l[0]*r*2.2}" y="${t.y+l[1]*(r*1.6+fs*.4)}" text-anchor="${l[0]>0?'start':l[0]<0?'end':'middle'}" dominant-baseline="central" font-size="${fs}" font-family="monospace" fill="${ink}">${esc(t.id)}</text></g>`;});
  if(ed.box){const b=ed.box,x=Math.min(b.x0,b.x1),y=Math.min(b.y0,b.y1);s+=`<rect class="boxsel" x="${x}" y="${y}" width="${Math.abs(b.x1-b.x0)}" height="${Math.abs(b.y1-b.y0)}"/>`;}
  pv.innerHTML=s;
  $('edHint').textContent=ed.tool==='add'?'在畫布上點一下放一個接點；點到已有的接點會選取它。':'點接點選取（Shift 加選），拖曳空白處框選；拖曳移動，方向鍵微調，Delete 刪除。';
}
function edPt(e){const m=$('edPrev').getScreenCTM();const q=new DOMPoint(e.clientX,e.clientY).matrixTransform(m.inverse());return {x:q.x,y:q.y};}
// 接點在畫布上的大小：跟著畫布縮放，螢幕上看起來差不多大，器具大也點得到
function edR(){const p=Math.max(ed.w,ed.h)*.14+8;let g=99;ed.terms.forEach((a,i)=>ed.terms.slice(i+1).forEach(b=>{g=Math.min(g,Math.hypot(a.x-b.x,a.y-b.y)||99);}));return Math.max(.6,Math.min((Math.max(ed.w,ed.h)+2*p)/90,g*.4));}
function edHit(p){const r=edR()*2;let best=null,bd=r;ed.terms.forEach(t=>{const d=Math.hypot(t.x-p.x,t.y-p.y);if(d<bd){bd=d;best=t;}});return best;}
$('edPrev').addEventListener('pointerdown',e=>{
  if(!ed||e.button!==0)return;const p=edPt(e),t=edHit(p);$('edPrev').setPointerCapture(e.pointerId);
  if(t){
    if(e.shiftKey){ed.sel.has(t.uid)?ed.sel.delete(t.uid):ed.sel.add(t.uid);}else if(!ed.sel.has(t.uid))ed.sel=new Set([t.uid]);
    edDrag={p0:p,lead:t,start:edSel().map(x=>[x,x.x,x.y]),moved:false};edAll();return;
  }
  if(ed.tool==='add'){
    const x=edSnap(Math.max(0,Math.min(ed.w,p.x))),y=edSnap(Math.max(0,Math.min(ed.h,p.y)));
    edPush();const n={uid:edUid++,id:edNewId(),x,y,side:'top',desc:'',auto:true,oid:null};edReside(n);ed.terms.push(n);ed.sel=new Set([n.uid]);edAll();return;
  }
  if(!e.shiftKey)ed.sel=new Set();ed.box={x0:p.x,y0:p.y,x1:p.x,y1:p.y,keep:new Set(ed.sel)};edAll();
});
$('edPrev').addEventListener('pointermove',e=>{
  if(!ed)return;const p=edPt(e);
  if(edDrag){
    const lx=edDrag.start.find(s=>s[0]===edDrag.lead);
    const dx=edSnap(lx[1]+p.x-edDrag.p0.x)-lx[1],dy=edSnap(lx[2]+p.y-edDrag.p0.y)-lx[2];
    if(!edDrag.moved&&(Math.abs(dx)>0||Math.abs(dy)>0)){edPush();edDrag.moved=true;}
    if(edDrag.moved){edDrag.start.forEach(([t,x,y])=>{t.x=+(x+dx).toFixed(2);t.y=+(y+dy).toFixed(2);edReside(t);});drawEd();}
    return;
  }
  if(ed.box){ed.box.x1=p.x;ed.box.y1=p.y;const b=ed.box,x0=Math.min(b.x0,b.x1),x1=Math.max(b.x0,b.x1),y0=Math.min(b.y0,b.y1),y1=Math.max(b.y0,b.y1);
    ed.sel=new Set([...b.keep,...ed.terms.filter(t=>t.x>=x0&&t.x<=x1&&t.y>=y0&&t.y<=y1).map(t=>t.uid)]);drawEd();}
});
$('edPrev').addEventListener('pointerup',()=>{if(!ed)return;const m=edDrag&&edDrag.moved;edDrag=null;if(ed.box){ed.box=null;edAll();}else if(m)edAll();});
/* ---------- 工具列 ---------- */
function edBar(){
  const b=(id,t,on,dis,tip)=>`<button class="tool" id="${id}"${on!=null?` aria-pressed="${!!on}"`:''}${dis?' disabled':''}${tip?` title="${tip}"`:''}>${t}</button>`;
  const n=ed.sel.size;
  $('edBar').innerHTML=`<div class="grp">${b('ebSel','選取',ed.tool==='select',0,'選取、拖曳、框選接點')}${b('ebAdd','放接點',ed.tool==='add',0,'在畫布上點一下放一個接點')}</div>
    <div class="grp"><span>接點命名</span><input id="ebPfx" value="${esc(ed.pfx)}" maxlength="6" placeholder="前綴" title="新接點的名稱前綴，例如 X、CN" style="width:4em"><input id="ebNext" type="number" min="0" value="${ed.next}" title="下一個接點的號碼" style="width:4em"></div>
    <div class="grp">${b('ebRow','一次放一排…',ed.row?true:null,0,'指定數量和間距，一次放一排接點')}</div>
    <div class="grp"><span>對齊</span>${b('ebAL','靠左',null,n<2)}${b('ebAC','左右置中',null,n<2)}${b('ebAR','靠右',null,n<2)}${b('ebAT','靠上',null,n<2)}${b('ebAM','上下置中',null,n<2)}${b('ebAB','靠下',null,n<2)}</div>
    <div class="grp"><span>對齊器具</span>${b('ebFC','左右中線',null,!n,'選到的接點整組移到器具左右正中間，彼此間距不變')}${b('ebFM','上下中線',null,!n,'選到的接點整組移到器具上下正中間')}${b('ebFT','靠上緣',null,!n,'整組移到離器具上緣指定距離')}${b('ebFB','靠下緣',null,!n)}${b('ebFL','靠左緣',null,!n)}${b('ebFR','靠右緣',null,!n)}<span>距離</span><input id="ebIn" type="number" min="0" step="0.5" value="${ed.inset??6}" title="靠邊時離器具邊緣的距離 mm" style="width:3.8em"></div>
    <div class="grp"><span>等距</span>${b('ebDH','水平',null,n<3,'選到的接點左右平均分布（最左、最右不動）')}${b('ebDV','垂直',null,n<3,'選到的接點上下平均分布')}<span>或間距</span><input id="ebPitch" type="number" min="0.5" step="0.5" value="${ed.pitch||7.5}" title="接點間距 mm" style="width:4.2em">${b('ebPH','橫排',null,n<2,'從最左邊的接點開始，往右照間距排')}${b('ebPV','直排',null,n<2,'從最上面的接點開始，往下照間距排')}</div>
    <div class="grp"><span>格點</span><select id="ebGrid">${[[0,'不吸附'],[.5,'0.5 mm'],[1,'1 mm'],[2.5,'2.5 mm'],[5,'5 mm']].map(([v,t])=>`<option value="${v}"${ed.grid===v?' selected':''}>${t}</option>`).join('')}</select></div>
    <div class="grp">${b('ebUndo','復原',null,!ed.hist.length)}${b('ebRedo','重做',null,!ed.fut.length)}${b('ebDel','刪除接點',null,!n)}</div>`;
  $('ebSel').onclick=()=>{ed.tool='select';edBar();drawEd();};$('ebAdd').onclick=()=>{ed.tool='add';edBar();drawEd();};
  $('ebPfx').oninput=e=>{ed.pfx=e.target.value.trim();ed.next=edNextNum();$('ebNext').value=ed.next;};
  $('ebNext').onchange=e=>{ed.next=Math.max(0,Math.round(Number(e.target.value)||0));};
  $('ebRow').onclick=()=>{ed.row=ed.row?null:{n:4,dir:'h',pitch:ed.pitch||7.5,x:null,y:null};edAll();};
  const S_=edSel,al=(k)=>{const ts=S_();if(ts.length<2)return;edPush();const xs=ts.map(t=>t.x),ys=ts.map(t=>t.y);
    const v={L:Math.min(...xs),R:Math.max(...xs),C:(Math.min(...xs)+Math.max(...xs))/2,T:Math.min(...ys),B:Math.max(...ys),M:(Math.min(...ys)+Math.max(...ys))/2}[k];
    ts.forEach(t=>{if('LRC'.includes(k))t.x=+v.toFixed(2);else t.y=+v.toFixed(2);edReside(t);});edAll();};
  [['ebAL','L'],['ebAC','C'],['ebAR','R'],['ebAT','T'],['ebAM','M'],['ebAB','B']].forEach(([id,k])=>$(id).onclick=()=>al(k));
  const dist=(ax)=>{const ts=S_().sort((a,b)=>a[ax]-b[ax]);if(ts.length<3)return;edPush();const a=ts[0][ax],z=ts[ts.length-1][ax];ts.forEach((t,i)=>{t[ax]=+(a+(z-a)*i/(ts.length-1)).toFixed(2);edReside(t);});edAll();};
  // 對齊器具：整組平移（間距不變），到器具中線或離某一邊固定距離
  $('ebIn').onchange=e=>{ed.inset=Math.max(0,Number(e.target.value)||0);};
  const fit=(k)=>{const ts=S_();if(!ts.length)return;const xs=ts.map(t=>t.x),ys=ts.map(t=>t.y),I=ed.inset??6,x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
    const dx={C:ed.w/2-(x0+x1)/2,L:I-x0,R:ed.w-I-x1}[k]||0,dy={M:ed.h/2-(y0+y1)/2,T:I-y0,B:ed.h-I-y1}[k]||0;
    edPush();ts.forEach(t=>{t.x=+(t.x+dx).toFixed(2);t.y=+(t.y+dy).toFixed(2);edReside(t);});edAll();};
  [['ebFC','C'],['ebFM','M'],['ebFT','T'],['ebFB','B'],['ebFL','L'],['ebFR','R']].forEach(([id,k])=>$(id).onclick=()=>fit(k));
  $('ebDH').onclick=()=>dist('x');$('ebDV').onclick=()=>dist('y');
  $('ebPitch').onchange=e=>{ed.pitch=Math.max(.5,Number(e.target.value)||7.5);};
  const pitch=(ax)=>{const ts=S_().sort((a,b)=>a[ax]-b[ax]);if(ts.length<2)return;edPush();const p=ed.pitch||7.5,a=ts[0][ax];ts.forEach((t,i)=>{t[ax]=+(a+p*i).toFixed(2);edReside(t);});edAll();};
  $('ebPH').onclick=()=>pitch('x');$('ebPV').onclick=()=>pitch('y');
  $('ebGrid').onchange=e=>{ed.grid=Number(e.target.value);drawEd();};
  $('ebUndo').onclick=edUndo;$('ebRedo').onclick=edRedo;$('ebDel').onclick=edDelSel;
}
function edDelSel(){if(!ed.sel.size)return;edPush();ed.terms=ed.terms.filter(t=>!ed.sel.has(t.uid));ed.links=ed.links.map(g=>g.filter(u=>!ed.sel.has(u))).filter(g=>g.length>1);ed.sel=new Set();edAll();}
/* ---------- 右側屬性 ---------- */
function edSide(){
  const ts=edSel(),n=ts.length,lab=t=>esc(t.id||'（未命名）');
  let h='';
  if(ed.row){const R=ed.row;h+=`<section id="esRow"><div class="sub-h">一次放一排接點</div><div class="fields">
      <label for="erN">數量<input id="erN" type="number" min="1" max="120" value="${R.n}"></label><label for="erP">間距 mm<input id="erP" type="number" min="0.5" step="0.5" value="${R.pitch}"></label>
      <label for="erD">方向<select id="erD"><option value="h"${R.dir==='h'?' selected':''}>橫排（左到右）</option><option value="v"${R.dir==='v'?' selected':''}>直排（上到下）</option></select></label>
      <label for="erE">靠哪一邊<select id="erE">${Object.entries(ED_SIDE).map(([k,v])=>`<option value="${k}"${(R.edge||'top')===k?' selected':''}>${v}緣</option>`).join('')}</select></label></div>
      <p class="note">名稱照工具列的前綴和號碼往下編（目前從 ${esc(ed.pfx)}${ed.next} 開始）。放好後整排會選取，可以再拖曳或對齊。</p>
      <div class="row" style="justify-content:flex-start"><button class="primary" id="erGo">放上去</button><button class="tool" id="erX">取消</button></div></section>`;}
  if(n===1){const t=ts[0];h+=`<section><div class="sub-h">接點</div><div class="fields">
      <label for="esId">名稱<input id="esId" maxlength="12" value="${esc(t.id)}"></label>
      <label for="esSide">出線方向<select id="esSide"><option value="auto"${t.auto?' selected':''}>自動（${ED_SIDE[edAuto(t)]}）</option>${Object.entries(ED_SIDE).map(([k,v])=>`<option value="${k}"${!t.auto&&t.side===k?' selected':''}>${v}</option>`).join('')}</select></label>
      <label for="esDesc" style="grid-column:1/-1">說明（滑鼠移到接點會顯示）<input id="esDesc" maxlength="20" value="${esc(t.desc||'')}" placeholder="例如 線圈 +、RS-485 A"></label>
      <label for="esX">X mm<input id="esX" type="number" step="0.5" value="${t.x}"></label><label for="esY">Y mm<input id="esY" type="number" step="0.5" value="${t.y}"></label></div></section>`;}
  else if(n>1){h+=`<section><div class="sub-h">已選 ${n} 個接點：${ts.slice(0,8).map(lab).join('、')}${n>8?'…':''}</div>
      <div class="fields"><label for="emP">依序命名：前綴<input id="emP" maxlength="6" value="${esc(ed.pfx)}"></label><label for="emS">起始號碼<input id="emS" type="number" min="0" value="1"></label></div>
      <p class="note">照接點排列的方向（左到右或上到下）依序命名。</p>
      <div class="row" style="justify-content:flex-start;flex-wrap:wrap"><button class="tool" id="emGo">套用命名</button><select id="emSide" aria-label="出線方向"><option value="">出線方向…</option><option value="auto">自動</option>${Object.entries(ED_SIDE).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select><button class="tool" id="emLink" title="這幾個接點在器具內部相通">設為同電位</button></div></section>`;}
  else h+=`<section><p class="note">${ed.tool==='add'?'在畫布上點一下就會放一個接點，名稱自動往下編號。':'點一個接點可以改名稱、說明和出線方向；框選多個可以對齊、等距、依序命名、設為同電位。'}</p></section>`;
  if(ed.links.length)h+=`<section><div class="sub-h">同電位（器具內部相通）</div>${ed.links.map((g,i)=>`<div class="jrow"><span>${g.map(u=>ed.terms.find(t=>t.uid===u)).filter(Boolean).map(lab).join('、')}</span><button class="tool sm" data-elk="${i}">刪除</button></div>`).join('')}</section>`;
  const circ=ed.shape==='circle';
  h+=`<section><div class="sub-h">器具</div><div class="fields">
      <label for="eName" style="grid-column:1/-1">名稱／型號<input id="eName" maxlength="40" value="${esc(ed.n)}"></label>
      <label for="eBrand">廠牌<input id="eBrand" maxlength="20" value="${esc(ed.b)}"></label><label for="ePre">編號字首<input id="ePre" maxlength="6" value="${esc(ed.pre)}"></label>
      <label for="eShape">外形<select id="eShape">${Object.entries(ED_SHAPE).map(([k,v])=>`<option value="${k}"${ed.shape===k?' selected':''}>${v}</option>`).join('')}</select></label>
      <label for="eCol">外殼顏色<input id="eCol" type="color" value="${ed.f}"></label>
      ${circ?`<label for="eW">直徑 mm<input id="eW" type="number" min="5" step="1" value="${ed.w}"></label>`:`<label for="eW">寬 mm<input id="eW" type="number" min="5" step="1" value="${ed.w}"></label><label for="eH">高 mm<input id="eH" type="number" min="5" step="1" value="${ed.h}"></label>`}
      <label for="eD">深 mm<input id="eD" type="number" min="0" step="1" value="${ed.d}"></label>
      <label for="eSheet">安裝位置<select id="eSheet">${[['plate','底板'],['door','面板'],['field','現場'],['outside','箱外']].map(([k,v])=>`<option value="${k}"${ed.sheet===k?' selected':''}>${v}</option>`).join('')}</select></label>
      <label for="eNote" style="grid-column:1/-1">備註<input id="eNote" maxlength="120" value="${esc(ed.note)}"></label></div>
      <label class="check"><input type="checkbox" id="eOk"${ed.ok?' checked':''}>尺寸與接點已對照型錄或實物</label></section>`;
  $('edSide').innerHTML=h;
  // 一排
  if(ed.row){const R=ed.row;$('erN').onchange=e=>R.n=Math.max(1,Math.min(120,Math.round(Number(e.target.value)||1)));$('erP').onchange=e=>R.pitch=Math.max(.5,Number(e.target.value)||7.5);
    $('erD').onchange=e=>{R.dir=e.target.value;R.edge=R.dir==='h'?'top':'left';edSide();};$('erE').onchange=e=>R.edge=e.target.value;
    $('erX').onclick=()=>{ed.row=null;edAll();};
    $('erGo').onclick=()=>{edPush();const span=R.pitch*(R.n-1),hz=R.dir==='h',e0=R.edge||(hz?'top':'left'),inset=Math.min(6,(hz?ed.h:ed.w)/4);
      const c0=hz?Math.max(0,(ed.w-span)/2):Math.max(0,(ed.h-span)/2),fixed=e0==='top'?inset:e0==='bottom'?ed.h-inset:e0==='left'?inset:ed.w-inset,add=[];
      for(let i=0;i<R.n;i++){const t={uid:edUid++,id:edNewId(),x:+(hz?c0+R.pitch*i:fixed).toFixed(2),y:+(hz?fixed:c0+R.pitch*i).toFixed(2),side:e0,desc:'',auto:false,oid:null};t.auto=edAuto(t)===e0;add.push(t);}
      ed.terms.push(...add);ed.sel=new Set(add.map(t=>t.uid));ed.pitch=R.pitch;ed.row=null;ed.tool='select';edAll();};}
  if(n===1){const t=ts[0];
    $('esId').onchange=e=>{const v=e.target.value.trim().slice(0,12);if(!v){e.target.value=t.id;return;}if(ed.terms.some(x=>x!==t&&x.id===v)){toast(`已經有接點叫 ${v}`);e.target.value=t.id;return;}edPush();t.id=v;drawEd();edBar();};
    $('esSide').onchange=e=>{edPush();const v=e.target.value;if(v==='auto'){t.auto=true;t.side=edAuto(t);}else{t.auto=false;t.side=v;}drawEd();};
    $('esDesc').onchange=e=>{edPush();t.desc=e.target.value.slice(0,20);};
    const mv=(k)=>e=>{const v=Number(e.target.value);if(!Number.isFinite(v))return;edPush();t[k]=v;edReside(t);drawEd();edSide();};
    $('esX').onchange=mv('x');$('esY').onchange=mv('y');}
  if(n>1){
    $('emGo').onclick=()=>{const p=$('emP').value.trim(),s0=Math.round(Number($('emS').value)||0),xs=ts.map(t=>t.x),ys=ts.map(t=>t.y),ax=Math.max(...xs)-Math.min(...xs)>=Math.max(...ys)-Math.min(...ys)?'x':'y';
      const ord=ts.slice().sort((a,b)=>a[ax]-b[ax]||a[ax==='x'?'y':'x']-b[ax==='x'?'y':'x']),names=ord.map((t,i)=>p+(s0+i));
      const clash=names.find(nm=>ed.terms.some(x=>!ed.sel.has(x.uid)&&x.id===nm));if(clash){toast(`接點 ${clash} 已經有了，換個前綴或起始號碼`);return;}
      edPush();ord.forEach((t,i)=>t.id=names[i]);ed.pfx=p;ed.next=edNextNum();edAll();};
    $('emSide').onchange=e=>{const v=e.target.value;if(!v)return;edPush();ts.forEach(t=>{if(v==='auto'){t.auto=true;t.side=edAuto(t);}else{t.auto=false;t.side=v;}});drawEd();edSide();};
    $('emLink').onclick=()=>{edPush();const us=ts.map(t=>t.uid),hit=ed.links.filter(g=>g.some(u=>us.includes(u)));ed.links=[...ed.links.filter(g=>!hit.includes(g)),[...new Set([...hit.flat(),...us])]];edAll();};}
  $('edSide').querySelectorAll('[data-elk]').forEach(x=>x.onclick=()=>{edPush();ed.links.splice(Number(x.dataset.elk),1);edAll();});
  // 器具欄位
  $('eName').oninput=e=>ed.n=e.target.value;$('eBrand').oninput=e=>ed.b=e.target.value;$('ePre').oninput=e=>ed.pre=e.target.value;$('eNote').oninput=e=>ed.note=e.target.value;
  $('eCol').oninput=e=>{ed.f=e.target.value;drawEd();};$('eOk').onchange=e=>ed.ok=e.target.checked;$('eSheet').onchange=e=>ed.sheet=e.target.value;$('eD').onchange=e=>ed.d=Math.max(0,Number(e.target.value)||0);
  $('eShape').onchange=e=>{edPush();ed.shape=e.target.value;if(ed.shape==='circle'){const s=Math.max(ed.w,ed.h);ed.w=ed.h=s;}ed.terms.forEach(edReside);edAll();};
  const size=(k)=>e=>{const v=Math.max(5,Number(e.target.value)||5);edPush();if(ed.shape==='circle'){ed.w=ed.h=v;}else ed[k]=v;ed.terms.forEach(t=>{t.x=Math.min(t.x,ed.w);t.y=Math.min(t.y,ed.h);edReside(t);});drawEd();};
  $('eW').onchange=size('w');if($('eH'))$('eH').onchange=size('h');
}
/* ---------- 鍵盤：編輯器開著時只處理編輯器的鍵 ---------- */
document.addEventListener('keydown',e=>{
  if(!ed||$('ed').hidden)return;
  const typing=/INPUT|SELECT|TEXTAREA/.test(e.target.tagName),k=e.key;
  if((e.ctrlKey||e.metaKey)&&k.toLowerCase()==='z'&&!typing){e.preventDefault();e.shiftKey?edRedo():edUndo();return;}
  if((e.ctrlKey||e.metaKey)&&k.toLowerCase()==='y'&&!typing){e.preventDefault();edRedo();return;}
  if(typing)return;
  if((k==='Delete'||k==='Backspace')&&ed.sel.size){e.preventDefault();edDelSel();return;}
  if(k==='Escape'){if(ed.row){ed.row=null;edAll();}else if(ed.sel.size){ed.sel=new Set();edAll();}return;}
  const A={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[k];
  if(A&&ed.sel.size){e.preventDefault();const s=e.shiftKey?(ed.grid||1)*2:.5;edPush();edSel().forEach(t=>{t.x=+(t.x+A[0]*s).toFixed(2);t.y=+(t.y+A[1]*s).toFixed(2);edReside(t);});drawEd();edSide();return;}
  if(k==='v'||k==='V'){ed.tool='select';edBar();drawEd();}else if(k==='p'||k==='P'){ed.tool='add';edBar();drawEd();}
});
/* ---------- 儲存 ---------- */
$('edCancel').onclick=()=>{$('ed').hidden=true;ed=null;};
$('edSave').onclick=()=>{
  const name=ed.n.trim();
  if(!name){toast('請填器具名稱');$('eName').focus();return;}
  if(!ed.terms.length){toast('請至少放一個接點');return;}
  const ids=ed.terms.map(t=>String(t.id).trim());if(ids.some(x=>!x)){toast('每個接點都要有名稱');return;}
  const dup=ids.find((x,i)=>ids.indexOf(x)!==i);if(dup){toast(`接點名稱 ${dup} 重複，請改掉其中一個`);return;}
  const byU=new Map(ed.terms.map(t=>[t.uid,t.id]));
  const raw={b:ed.b,n:name,w:ed.w,h:ed.h,d:ed.d,pre:ed.pre,f:ed.f,sheet:ed.sheet==='outside'?'plate':ed.sheet,outside:ed.sheet==='outside',round:ed.shape==='circle',rx:ed.shape==='rounded'?Math.min(8,Math.min(ed.w,ed.h)/5):undefined,ok:ed.ok,note:ed.note,
    links:ed.links.map(g=>g.map(u=>byU.get(u)).filter(Boolean)).filter(g=>g.length>1),
    terms:ed.terms.map(t=>({id:t.id,x:t.x,y:t.y,side:t.side,desc:t.desc||'',...(t.ls?{ls:t.ls}:{}),...(t.ox!=null?{ox:t.ox,oy:t.oy}:{})}))};
  const c=cleanTpl(raw);if(!c)return;
  const src=ed.srcId&&(S.tpls[ed.srcId]||TPL[ed.srcId]);
  if(src){c.cat=src.cat||c.cat;}
  const orig=TPL[ed.srcId]?ed.srcId:src&&src.src;if(orig)c.src=orig; // 記住原廠型號，之後可以換回
  S.tpls=S.tpls||{};
  let id=ed.keepId?ed.srcId:null;
  if(!id){let i=1;while(S.tpls['c'+i])i++;id='c'+i;}
  // 接點改名：接在舊名稱的導線改接到新名稱；刪掉的接點，接在上面的線會移除
  const ren={};ed.terms.forEach(t=>{if(t.oid!=null&&t.oid!==t.id)ren[t.oid]=t.id;});
  const devs=ed.keepId?S.devices.filter(d=>d.tpl===id):ed.dev?[ed.dev]:[],dids=new Set(devs.map(d=>d.id));
  S.wires.forEach(w=>[w.a,w.b].forEach(e=>{if(dids.has(e.d)&&ren[e.t]!==undefined)e.t=ren[e.t];}));
  S.tpls[id]=c;
  if(ed.dev){ed.dev.tpl=id;delete ed.dev.count;ed.dev.sheet=c.sheet;}
  const before=S.wires.length;
  $('ed').hidden=true;ed=null;
  computeRoutes();commit();recompute();renderPalette();
  toast(S.wires.length<before?`器具已儲存，少了接點而移除 ${before-S.wires.length} 條線；可按復原`:'器具已儲存');
};

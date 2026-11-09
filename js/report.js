"use strict";
/* ---------- 報表：材料表、線長統計、CSV、列印 ----------
   線長都是圖面估算值：沿畫出來的路徑量，不含端子處理與彎曲餘量。
   外線（接到現場區的線）只算箱內段，也就是到出線口為止；電纜的現場段在電纜上填長度。 */
const CAT_ORDER=()=>['自訂器具',C1,C2,C3,C4,C5,C6,C7,C8,C9,D1,F1,F2,F3];
const natCmp=(a,b)=>String(a).localeCompare(String(b),'zh-Hant',{numeric:true});
const SHEET_N={plate:'底板',door:'面板',field:'現場'};
const spare=()=>Math.max(0,Number(S.spare)||0);
const isCable=w=>!!(w.cab&&cabOf(w.cab));
// 折線在箱底以上的長度；外線出了出線口就不算
// 折線在箱體範圍內的長度；外線出了出線口（任何一面）就不算
function inBoxLen(pts){
  const o=boxOrigin(),X0=o.x-.01,X1=o.x+S.box.w+.01,Y0=o.y-.01,Y1=o.y+S.box.h+.01;let L=0;
  const clip=(a0,a1,lo,hi)=>Math.max(0,Math.min(Math.max(a0,a1),hi)-Math.max(Math.min(a0,a1),lo));
  for(let i=1;i<pts.length;i++){
    const a=pts[i-1],b=pts[i],dx=Math.abs(a.x-b.x),dy=Math.abs(a.y-b.y);
    if(dy<.01){if(a.y>=Y0&&a.y<=Y1)L+=clip(a.x,b.x,X0,X1);continue;}
    if(dx<.01){if(a.x>=X0&&a.x<=X1)L+=clip(a.y,b.y,Y0,Y1);continue;}
    L+=Math.min(clip(a.x,b.x,X0,X1)/dx,clip(a.y,b.y,Y0,Y1)/dy)*(dx+dy); // 斜線：取兩軸在範圍內比例較小者
  }
  return L;
}
// 單條線的估算長度（mm），已加上預留長度
function wireLen(w){
  const r=ROUTES.get(w.id);if(!r) return 0;
  return (wireKind(w)==='ext'?inBoxLen(r.pts):r.len)+spare();
}
const m1=mm=>Math.ceil(mm/100)/10; // 進位到 0.1 m
const wireStock=(g,cn)=>INV.find(x=>x[0]==='CSA細芯控制電線'&&x[1].startsWith(g+'mm²')&&x[1].split(/\s+/)[1]===cn);
const cableStock=spec=>INV.find(r=>`${r[0]} ${r[1]}`===spec);

/* 材料表：每列 {sec,name,brand,qty,unit,where,tags,note} */
function bomRows(){
  const out=[],devs=new Map();
  for(const d of S.devices){
    if(d.tpl==='field-power') continue; // 只是進線示意，不是材料
    const t=resolveTpl(d.tpl,d.count);if(!t) continue;
    // 同名同廠牌合併（例如伺服電池在不同驅動器上的兩種外形）；可自訂型號的器具（二極體）照型號分開列
    const tm=t.model?{...t,n:d.model||'二極體'}:t,key=t.gen?d.tpl:tm.b+'|'+tm.n;
    if(!devs.has(key)) devs.set(key,{t:tm,list:[]});
    devs.get(key).list.push(d);
  }
  const ord=CAT_ORDER(),rank=c=>{const i=ord.indexOf(c);return i<0?99:i;};
  [...devs.values()].sort((a,b)=>rank(a.t.cat)-rank(b.t.cat)||natCmp(a.t.n,b.t.n)).forEach(({t,list})=>{
    const where=[...new Set(list.map(d=>SHEET_N[d.sheet]))].join('、'),tags=list.map(d=>d.tag).sort(natCmp).join(' ');
    if(t.gen){
      const mm=t.cntLabel&&t.cntLabel.includes('mm'),sum=list.reduce((s,d)=>s+(d.count||t.cnt),0);
      out.push({sec:t.cat,name:t.n,brand:t.b,qty:sum,unit:mm?'mm':'片',where,tags,note:`${list.length} ${mm?'段':'組'}`});
    }else out.push({sec:t.cat,name:t.n,brand:t.b,qty:list.length,unit:'個',where,tags,note:t.note||''});
  });
  const ducts=new Map();
  S.ducts.forEach(d=>{
    const wd=Math.min(d.w,d.h),len=Math.max(d.w,d.h),dp=d.dp||40,k=wd+'×'+dp;
    if(!ducts.has(k)) ducts.set(k,{wd,dp,len:0,ids:[],sh:new Set()});
    const e=ducts.get(k);e.len+=len;e.ids.push(d.id);e.sh.add(SHEET_N[d.sheet]);
  });
  [...ducts.values()].sort((a,b)=>b.wd-a.wd).forEach(e=>{
    const inv=DUCTINV.find(x=>x[2]===e.wd&&x[3]===e.dp),stick=inv?Number((inv[1].match(/x(\d+)mm/)||[])[1])||0:0;
    out.push({sec:'線槽',name:inv?`${inv[0]}（${inv[1]}）`:`線槽 ${e.wd}×${e.dp}`,brand:'',qty:Math.round(e.len),unit:'mm',where:[...e.sh].join('、'),tags:e.ids.sort(natCmp).join(' '),note:stick?`約 ${Math.ceil(e.len/stick)} 支（每支 ${stick} mm）`:''});
  });
  // 短路片：依規格統計
  const jm=new Map();S.devices.forEach(d=>(d.jumpers||[]).forEach(j=>{if(!jm.has(j.p))jm.set(j.p,[]);jm.get(j.p).push(d.tag);}));
  [...jm].sort((a,b)=>a[0]-b[0]).forEach(([p,tags])=>out.push({sec:C7,name:`2002-40${p} 短路片 ${p}P`,brand:'WAGO',qty:tags.length,unit:'個',where:'底板',tags:[...new Set(tags)].sort(natCmp).join(' '),note:'端子台跨接用'}));
  const gl=new Map();S.glands.forEach(g=>{if(!gl.has(g.spec))gl.set(g.spec,[]);gl.get(g.spec).push(g.id);});
  [...gl].sort((a,b)=>natCmp(a[0],b[0])).forEach(([spec,ids])=>out.push({sec:'出線口',name:spec,brand:'',qty:ids.length,unit:'個',where:'箱底',tags:ids.sort(natCmp).join(' '),note:''}));
  const loose=new Map();
  S.wires.filter(w=>!isCable(w)).forEach(w=>{
    const c=colorOf(w),k=w.gauge+'|'+(w.hex||w.color);
    if(!loose.has(k)) loose.set(k,{g:w.gauge,c,len:0,n:0});
    const e=loose.get(k);e.len+=wireLen(w);e.n++;
  });
  [...loose.values()].sort((a,b)=>a.g-b.g||natCmp(a.c.n,b.c.n)).forEach(e=>{
    const inv=wireStock(e.g,e.c.n);
    out.push({sec:'電線',name:inv?`${inv[0]} ${inv[1]}`:`電線 ${e.g}mm² ${e.c.n}`,brand:inv?inv[3]:'',qty:m1(e.len),unit:'m',where:'',tags:'',note:`${e.n} 條`+(inv?'':'，電料清單沒有')});
  });
  const cab=cableGroups();
  const specs=new Map();cab.forEach(c=>{const k=c.spec||'';if(!specs.has(k))specs.set(k,[]);specs.get(k).push(c);});
  [...specs].sort((a,b)=>natCmp(a[0],b[0])).forEach(([spec,cs])=>{
    const inv=cableStock(spec),len=cs.reduce((s,c)=>s+c.len,0),miss=cs.filter(c=>c.ext&&!c.field).length;
    out.push({sec:'電纜',name:spec||'未指定電纜規格',brand:inv?inv[3]:'',qty:m1(len),unit:'m',where:'',tags:cs.map(c=>c.no).join(' '),note:`${cs.length} 條`+(miss?`（其中 ${miss} 條沒填現場長度）`:'')});
  });
  return out;
}
// 電纜長度（mm）：外皮（外部電纜只算箱內段）＋兩端剝線後最長那一芯＋現場長度＋預留
const ptsLen=p=>{let L=0;for(let i=1;i<p.length;i++)L+=Math.abs(p[i].x-p[i-1].x)+Math.abs(p[i].y-p[i-1].y);return L;};
function cabLen(c){
  const r=CABROUTES.get(c.id),cw=coresOf(c),ext=cw.some(w=>wireKind(w)==='ext'),L=p=>ext?inBoxLen(p):ptsLen(p);
  const sheath=r?L(r.pts):0;let tail=0;
  cw.forEach(w=>{const x=ROUTES.get(w.id);if(x&&x.tails)tail=Math.max(tail,L(x.tails[0])+L(x.tails[1]));});
  const box=sheath+tail,field=Math.max(0,Number(c.fieldLen)||0),sp=r?spare():0;
  return {ext,sheath,tail,box,field,spare:sp,total:box+field+sp};
}
function cableGroups(){
  return [...S.cables].sort((a,b)=>natCmp(a.no,b.no)).map(c=>{const L=cabLen(c),cw=coresOf(c);
    return {no:c.no,spec:c.spec,cores:cw.length,all:c.cores.length,len:L.total,box:L.box,field:L.field,ext:L.ext,c};});
}
/* 線長統計：散線（不含電纜芯線）依線徑、顏色；全部依種類；電纜另列 */
function lenStats(){
  const add=(m,k,lab,w)=>{if(!m.has(k))m.set(k,{lab,n:0,len:0});const e=m.get(k);e.n++;e.len+=wireLen(w);};
  const g=new Map(),c=new Map(),k=new Map();
  S.wires.forEach(w=>{
    add(k,wireKind(w),KINDS[wireKind(w)],w);
    if(isCable(w)) return;
    add(g,w.gauge,w.gauge+' mm²',w);
    const co=colorOf(w);add(c,w.hex||w.color,co.n,w);
  });
  const cr=Object.keys(COLORS),rank=x=>{const i=cr.indexOf(x);return i<0?99:i;};
  return {gauge:[...g].sort((a,b)=>a[0]-b[0]).map(x=>x[1]),color:[...c].sort((a,b)=>rank(a[0])-rank(b[0])).map(x=>x[1]),
    kind:Object.keys(KINDS).filter(x=>k.has(x)).map(x=>k.get(x)),cables:cableGroups()};
}
const sumLen=a=>a.reduce((s,e)=>s+e.len,0),sumN=a=>a.reduce((s,e)=>s+e.n,0);

/* 表格 */
function tableHtml(head,rows,num=[]){
  return `<table class="rtab"><thead><tr>${head.map((h,i)=>`<th${num.includes(i)?' class="n"':''}>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr${r[0]==='合計'?' class="tot"':''}>${r.map((v,i)=>`<td${num.includes(i)?' class="n"':''}>${esc(v==null?'':v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
const BOM_HEAD=['分類','品名／型號','廠牌','數量','單位','位置','器具編號','備註'];
const bomTable=rows=>rows.map(r=>[r.sec,r.name,r.brand,r.qty,r.unit,r.where,r.tags,r.note]);
const LEN_NOTE=()=>`圖面估算值：沿畫面路徑量，不含彎曲與端子處理；散線的外線只算到出線口；電纜另加填寫的現場長度。${spare()?`每條已加預留 ${spare()} mm。`:''}`;
function lenSections(){
  const s=lenStats(),one=a=>[...a.map(e=>[e.lab,e.n,m1(e.len)]),['合計',sumN(a),m1(sumLen(a))]];
  return [
    {h:'依線徑（散線，不含電纜芯線）',head:['線徑','條數','長度 m'],rows:one(s.gauge),num:[1,2]},
    {h:'依顏色（散線，不含電纜芯線）',head:['顏色','條數','長度 m'],rows:one(s.color),num:[1,2]},
    {h:'依種類（全部導線）',head:['種類','條數','長度 m'],rows:one(s.kind),num:[1,2]},
    {h:'依電纜（外皮＋最長芯＋現場長度＋預留）',head:['電纜','規格','已接芯數','箱內 m','現場 m','合計 m'],rows:s.cables.map(c=>[c.no,specName(c.spec),`${c.cores}/${c.all}`,m1(c.box),c.ext?(c.field?m1(c.field):'未填'):'—',m1(c.len)]),num:[3,4,5]}
  ].filter(x=>x.rows.length&&!(x.rows.length===1&&x.rows[0][0]==='合計'));
}
function wireTable(){
  return [...S.wires].sort((a,b)=>natCmp(a.no,b.no)).map(w=>{
    const r=ROUTES.get(w.id)||{via:[],len:0};
    const c=w.cab&&cabOf(w.cab);return [w.no,w.gauge,colorOf(w).n,KINDS[wireKind(w)],tagOf(w.a.d),termLabel(devOf(w.a.d),w.a.t),tagOf(w.b.d),termLabel(devOf(w.b.d),w.b.t),r.via.join('→'),r.gland||'',m1(wireLen(w)),c?c.no:'',c?w.core:''];
  });
}
const WIRE_HEAD=['線號','線徑mm²','線色','種類','起點器具','起點接點','終點器具','終點接點','經過線槽','出線口','估算長度m','電纜','芯線'];
// 電纜表：每芯一列，備用芯也列出來
function extTable(){
  const rows=[];
  [...S.cables].sort((a,b)=>natCmp(a.no,b.no)).forEach(c=>{
    const by=new Map(coresOf(c).map(w=>[w.core,w])),L=cabLen(c),g=CABROUTES.get(c.id)?.gland||'';
    c.cores.forEach(k=>{const w=by.get(k.n),f=w&&devOf(w.b.d);
      rows.push([c.no,specName(c.spec),k.n,coreColor(k).n,w?w.no:'備用',w?epText(w.a):'',w?epText(w.b):'',g,f&&f.sheet==='field'?zoneOf(f)?.name||'':'',m1(L.total)]);});
    coresOf(c).filter(w=>!coreDef(c,w.core)).forEach(w=>rows.push([c.no,specName(c.spec),w.core,colorOf(w).n,w.no,epText(w.a),epText(w.b),g,'',m1(L.total)]));
  });
  S.wires.filter(w=>wireKind(w)==='ext'&&!isCable(w)).sort((a,b)=>natCmp(a.no,b.no)).forEach(w=>rows.push(['（散線）','','',colorOf(w).n,w.no,epText(w.a),epText(w.b),ROUTES.get(w.id)?.gland||'',zoneOf(devOf(w.b.d))?.name||zoneOf(devOf(w.a.d))?.name||'',m1(wireLen(w))]));
  return rows;
}
const EXT_HEAD=['電纜編號','電纜規格','芯線','芯線顏色','線號','A 端','B 端','出線口','現場區','電纜長度m'];

/* 右側面板 */
function renderBom(){
  const rows=bomRows();
  $('listH').textContent=`材料表　${rows.length} 項`;
  if(!rows.length){$('list').innerHTML='<p class="note">盤面上還沒有器具。</p>';return;}
  let h='',sec=null;
  rows.forEach(r=>{
    if(r.sec!==sec){sec=r.sec;h+=`<div class="bom-h">${esc(sec)}</div>`;}
    h+=`<div class="bom"><span class="nm">${esc(r.name)}${r.brand?`<small>${esc(r.brand)}</small>`:''}</span><span class="q">${esc(r.qty)} ${esc(r.unit)}</span>${r.tags||r.note?`<span class="tg">${esc([r.tags,r.note].filter(Boolean).join('　'))}</span>`:''}</div>`;
  });
  $('list').innerHTML=`<div class="hrow"><span class="note">怎麼計算 ${hq('bom')}</span></div>${hn('bom','器具數量照盤面擺放計算；電線與電纜長度是圖面估算值，到「線長」分頁可設定預留長度。')}`+h;
}
function renderLen(){
  $('listH').textContent='線長統計';
  const secs=lenSections();
  $('list').innerHTML=`<div class="fields" style="margin-bottom:8px"><label for="spareIn">每條預留 mm<input id="spareIn" type="number" min="0" step="10" value="${spare()}"></label></div>
    <div class="hrow"><span class="note">怎麼計算 ${hq('len')}</span></div>${hn('len',esc(LEN_NOTE()))}`+
    (secs.length?secs.map(s=>`<div class="bom-h">${esc(s.h)}</div>`+tableHtml(s.head,s.rows,s.num)).join(''):'<p class="note">還沒有導線。</p>');
  lockInputs($('list'));
}

/* CSV */
const csvCell=v=>{let s=String(v==null?'':v);if(/^[=+\-@]/.test(s))s="'"+s;return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
const toCsv=rows=>'﻿'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n');
function exportCsv(){
  const st=stamp();
  if(tab==='ext') return saveFile(`電纜表-${st}.csv`,toCsv([EXT_HEAD,...extTable()]),'已匯出電纜表');
  if(tab==='bom') return saveFile(`材料表-${st}.csv`,toCsv([BOM_HEAD,...bomTable(bomRows())]),'已匯出材料表');
  if(tab==='len'){
    const rows=[[LEN_NOTE()]];
    lenSections().forEach(s=>{rows.push([],[s.h],s.head,...s.rows);});
    return saveFile(`線長統計-${st}.csv`,toCsv(rows),'已匯出線長統計');
  }
  return saveFile(`線號表-${st}.csv`,toCsv([WIRE_HEAD,...wireTable()]),'已匯出線號表');
}

/* 列印：圖面頁用 A4 橫向，表格頁用 A4 直向。用瀏覽器的「另存為 PDF」就能輸出 PDF。 */
let printN=0;
function printDrawing(title,R,cls,meta){
  // 頁面比例和範圍不同時，留白處會露出範圍外的東西，所以裁切
  const id='pc'+(++printN);
  return `<section class="pg land"><div class="ph"><b>${esc(title)}</b><span>${esc(meta)}</span></div>
  <svg class="pdraw ${cls}" xmlns="http://www.w3.org/2000/svg" viewBox="${R.x} ${R.y} ${R.w} ${R.h}" preserveAspectRatio="xMidYMid meet"><defs><clipPath id="${id}"><rect x="${R.x}" y="${R.y}" width="${R.w}" height="${R.h}"/></clipPath></defs><g clip-path="url(#${id})">${$('board').innerHTML}${$('wires').innerHTML}${$('top').innerHTML}</g></svg></section>`;
}
function buildPrint(){
  const d=new Date(),p=n=>String(n).padStart(2,'0'),date=`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
  let tot=0;ROUTES.forEach(r=>{tot+=r.len;});
  const meta=`${date}　${S.devices.length} 器具　${S.wires.length} 線　圖面總長 ${(tot/1000).toFixed(1)} m`;
  const bo=boxOrigin(),dr=useDoor()?sheetRect('door'):{x:bo.x,y:bo.y,w:S.box.w,h:S.box.h},fr=sheetRect('field'),pad=(r,a,b=a)=>({x:r.x-a,y:r.y-a,w:r.w+2*a,h:r.h+a+b});
  const x0=Math.min(0,bo.x,fr.x)-16,y0=Math.min(0,bo.y,dr.y,fr.y)-20,x1=Math.max(S.plate.w,dr.x+dr.w,fr.x+fr.w)+6,y1=Math.max(bo.y+S.box.h+30,fr.y+fr.h)+6;
  let h=printDrawing('盤面配線圖　全圖',{x:x0,y:y0,w:x1-x0,h:y1-y0},'',meta);
  h+=printDrawing('底板',pad({x:bo.x,y:bo.y,w:S.box.w,h:S.box.h},20,30),'labels-on z2',meta);
  if(useDoor()&&S.devices.some(x=>x.sheet==='door')) h+=printDrawing(doorTitle(),pad(dr,20),'labels-on z2',meta);
  S.fields.forEach(z=>{if(S.devices.some(d=>inZone(z,d))) h+=printDrawing(z.name,pad(z,10,20),'labels-on z2',meta);});
  const sec=(t,body)=>`<section class="pg"><div class="ph"><b>${esc(t)}</b><span>${esc(meta)}</span></div>${body}</section>`;
  if(S.wires.length) h+=sec('線號表',tableHtml(WIRE_HEAD,wireTable(),[1,10]));
  const ext=extTable();if(ext.length) h+=sec('電纜表',tableHtml(EXT_HEAD,ext,[9]));
  const bom=bomRows();if(bom.length) h+=sec('材料表',tableHtml(BOM_HEAD,bomTable(bom),[3])+`<p class="pnote">器具數量照盤面擺放計算；電線與電纜長度是圖面估算值。器具尺寸與接點請以原廠資料與實物為準。</p>`);
  const ls=lenSections();if(ls.length) h+=sec('線長統計',`<p class="pnote">${esc(LEN_NOTE())}</p>`+ls.map(s=>`<h3>${esc(s.h)}</h3>`+tableHtml(s.head,s.rows,s.num)).join(''));
  const pr=$('print');pr.innerHTML=h;
  pr.querySelectorAll('.picked,.issue-rect').forEach(x=>x.remove());
  pr.querySelectorAll('.wire').forEach(x=>x.classList.remove('on','off'));
}
window.addEventListener('beforeprint',buildPrint);

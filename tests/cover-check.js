// 器具覆蓋測試：每種器具照它的動作資料套 3 種電路（tests/cover-gen.js），產生正式電路圖並檢查：
// 不能出錯、圖反推和配線一致、主回路開關接開關的每一段都有線號、主回路每個接點都畫出來且不疊在一起、沒有截斷與佔位符號、有接線的器具都畫得出來、文字不重疊、受測器具不會掉到「其他接線」頁、附件有裝上。
// 用法：node tests/cover-check.js [種類，預設全部]（brk 斷路器類、mc 接觸器類…）（目前種類：brk 斷路器／保險絲座與附件）
const {chromium}=require('playwright'),path=require('path'),fs=require('fs');
const {schemOverlaps}=require(path.resolve('tests/schem-overlap.js'));
(async()=>{const b=await chromium.launch(),p=await b.newPage({viewport:{width:1600,height:1130},bypassCSP:true}); /* 測試要注入輔助腳本，略過網頁的 CSP */const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+path.resolve('index.html'));await p.addScriptTag({path:path.resolve('tests/cover-gen.js')});await p.addScriptTag({content:schemOverlaps.toString()});await p.emulateMedia({media:'print'});
const KINDS=process.argv[2]?[process.argv[2]]:['brk','mc','relay','tb','panel','plc','misc','nosim'];let fail=0;
for(const kind of KINDS){
const meta=await p.evaluate(k=>{window.__C=coverCases(k);return {n:__C.length,untestable:[...new Set(__C.untestable||[])],tpls:new Set(__C.flatMap(c=>[c.tpl,c.att].filter(Boolean))).size};},kind);
console.log(`[${kind}] ${meta.tpls} 種器具、${meta.n} 個組合；沒有動作資料、無法測：${meta.untestable.join('、')||'無'}`);
const s0=0,s1=meta.n;const ng=[];const cls={};
for(let i=s0;i<s1;i+=20){
  const r=await p.evaluate(([i,j])=>__C.slice(i,j).map(c=>{try{S=normalize({box:{w:900,h:700,d:300,back:20},plate:{w:860,h:660},door:{w:900,h:700},ducts:[],glands:[],wires:c.ws,devices:c.devs,cables:c.cables||[]}).state;resetUi();recompute();
    const B=schemBuild();document.getElementById('print').innerHTML=schemPrintHtml();const svg=B.pages.map(x=>x.svg).join('');
    const miss=c.expectOther?[]:S.devices.filter(d=>!isTB(d)&&!/^field-power/.test(d.tpl)&&!(simElems(d).length&&simElems(d).every(e=>e.k==='pass'||e.k==='grp'))&&S.wires.some(w=>w.a.d===d.id||w.b.d===d.id)&&!B.pages.some(x=>new RegExp('>'+d.tag+'[<　（＊：]').test(x.svg||''))).map(d=>d.tag);
    const oth=B.pages.filter(x=>/^其他接線/.test(x.title)).map(x=>x.title.replace('其他接線 ',''));
    const auxOn=S.devices.find(d=>d.id==='AUX');
    // PLC 位址：每一點要有位址（串接／插槽模組不能只寫端子號），同一系統不能重複
    let addr='';if(c.plc){const seen=new Map(),bad=[];B.M.E.filter(e=>e.k==='plcx'||e.k==='plcy').forEach(e=>{const nm=ptName(e),key=e.k+'|'+nm;
      if(e.d.on&&/^\d+$/.test(nm))bad.push(e.d.tag+':'+e.pt+'沒有位址');const o=e.d.id+'|'+e.pt;if(seen.has(key)&&seen.get(key)!==o)bad.push(nm+'重複');seen.set(key,o);});
      if(bad.length)addr='位址:'+[...new Set(bad)].slice(0,3).join('、');}
    const v=schemVerify(B),ov=schemOverlaps(),nm=schemMainNetMiss(B),sm=schemSwitchMiss(B);
    const pr=[sm.length?'主回路接點:'+sm[0]:'',nm.length?'主回路漏線號:'+nm.slice(0,2).join('、'):'',v.length?'對不上':'',/>[^<]*…[^<]*</.test(svg)?'截斷':'',/\u0001/.test(svg)?'佔位':'',miss.length?'沒畫出:'+miss.join('、'):'',ov.length?'重疊:'+ov[0].a+'｜'+ov[0].b:'',oth.length&&!c.expectOther?'其他接線:'+oth.join('、'):'',c.expectOther&&!B.pages.some(x=>/^其他接線/.test(x.title)&&/DUT/.test(x.title)&&c.expectOther.every(t=>x.svg.includes('>'+termLabel(S.devices.find(d=>d.id==='DUT'),t)+'<')))?'其他接線頁沒列出受測器具的端子':'',auxOn&&!auxOn.on?'附件沒裝上':'',addr,(c.cables||[]).some(q=>/光纖/.test(q.spec||''))&&!/stroke-dasharray/.test(svg)?'光纖沒畫虛線':'',c.tbPage&&!B.pages.some(x=>/^端子台/.test(x.title)&&/DUT/.test(x.title+(x.html||'')))?'端子台頁沒有':''].filter(Boolean);
    return {name:c.name,pr};}catch(e){return {name:c.name,pr:['錯誤:'+e.message]};}}),[i,i+20]);
  r.forEach(x=>{if(x.pr.length){ng.push(x);x.pr.forEach(q=>{const key=q.replace(/[:：].*/,'')+(q.startsWith('重疊')?':'+q.split(':')[1].replace(/[0-9]+/g,'#'):'');cls[key]=(cls[key]||0)+1;});}});}
fail+=ng.length;console.log(ng.length?`✗ ${kind}：${ng.length} / ${s1-s0} 個組合有問題 ${JSON.stringify(cls)}`:`✓ ${kind}：${s1-s0} 個組合全部通過`);
const seen=new Set();ng.forEach(x=>{const k=x.pr.map(q=>q.slice(0,14)).join('|');if(seen.has(k))return;seen.add(k);console.log(x.name,'→',x.pr.join('；').slice(0,200));});
}
// 同一台器具、同一相並聯出去的兩個常開（例如輔助接點 73-74、83-84 各接一個插座）：主回路要各畫一格，不能疊在一起
if(!process.argv[2]||process.argv[2]==='par'){
const par=await p.evaluate(()=>{const out=[],seen=new Set();['mc','relay'].forEach(kind=>coverCases(kind).forEach(c=>{
  const used=new Set(); // 只沿用組合裡的器具（主體＋裝上去的附件），接線全部自己接
  const linked=d=>new Set([...simElems(d).filter(e=>e.k==='pass').flatMap(e=>[e.a,e.b]),...(linksOf(d)||[]).flat()]),free=d=>{const L=linked(d);return simElems(d).filter(e=>e.k==='sw'&&!e.nc&&![e.a,e.b].some(t=>used.has(d.id+'|'+t)||L.has(t)));}; // 內部相通的端子（一體式正反轉）不拿來測
  const D=c.devs.find(d=>!seen.has(d.tpl)&&free(d).length>=2);if(!D)return;seen.add(D.tpl);
  const [n1,n2]=free(D);let k=0;
  const W=(a,at,b,bt,no)=>({id:'pw'+(++k),no,a:{d:a,t:at},b:{d:b,t:bt},wps:[],gauge:.75,color:'black'});
  const devs=[...c.devs,{id:'PW2',tag:'PWX',tpl:'field-power',x:-300,y:-300,sheet:'field'},{id:'QX',tag:'QX',tpl:'ic60-3P16A',x:-200,y:500,sheet:'plate'},
    {id:'FA',tag:'FA',tpl:'ic60-1P6A',x:-120,y:500,sheet:'plate'},{id:'FB',tag:'FB',tpl:'ic60-1P6A',x:-100,y:500,sheet:'plate'},{id:'XA',tag:'XA',tpl:'ac30',x:-80,y:500,sheet:'plate'},{id:'XB',tag:'XB',tpl:'ac30',x:-40,y:500,sheet:'plate'}];
  const ws=[W('PW2','R','QX','1','PR'),W('PW2','S','QX','3','PS'),W('PW2','T','QX','5','PT'),W('QX','2',D.id,n1.a,'PR1'),W(D.id,n1.a,D.id,n2.a,'PR1'),
    W(D.id,n1.b,'FA','1','PA'),W(D.id,n2.b,'FB','1','PB'),W('FA','2','XA','L','PA2'),W('FB','2','XB','L','PB2'),W('QX','4','XA','N','PN'),W('QX','4','XB','N','PN')];
  try{S=normalize({box:{w:900,h:700,d:300,back:20},plate:{w:860,h:660},door:{w:900,h:700},ducts:[],glands:[],wires:ws,devices:devs,cables:c.cables||[]}).state;resetUi();recompute();
    const B=schemBuild();document.getElementById('print').innerHTML=schemPrintHtml();const sw=schemSwitchMiss(B),v=schemVerify(B),ov=schemOverlaps(),nm=schemMainNetMiss(B);
    const pr=[...sw,v.length?'對不上':'',ov.length?'重疊:'+ov[0].a+'|'+ov[0].b:'',nm.length?'漏線號:'+nm[0]:''].filter(Boolean);out.push({name:`${D.tpl}（${D.tag} ${n1.a}-${n1.b}、${n2.a}-${n2.b}）`,pr});}catch(e){out.push({name:D.tpl,pr:['錯誤:'+e.message]});}}));return out;});
const pb=par.filter(x=>x.pr.length);fail+=pb.length+(par.length?0:1);
console.log(pb.length||!par.length?`✗ 同相並聯接點：${pb.length} / ${par.length} 種有問題`:`✓ 同相並聯接點：${par.length} 種有兩個以上常開的接觸器、繼電器、輔助接點，兩個常開從同一相並聯出去各接一個插座，主回路各畫一格、不疊在一起`);
pb.slice(0,8).forEach(x=>console.log('  ',x.name,'→',x.pr.join('；').slice(0,200)));console.log('   測到：'+par.map(x=>x.name.split('（')[0]).join('、'));}
errs.forEach(e=>console.log('✗ 頁面錯誤：'+e));fail+=errs.length;console.log(fail?`\n失敗 ${fail} 項`:'\n全部通過');await b.close();process.exit(fail?1:0);})();

// 器具覆蓋測試：每種器具照它的動作資料套 3 種電路（tests/cover-gen.js），產生正式電路圖並檢查：
// 不能出錯、圖反推和配線一致、沒有截斷與佔位符號、有接線的器具都畫得出來、文字不重疊、受測器具不會掉到「其他接線」頁、附件有裝上。
// 用法：node tests/cover-check.js [種類，預設全部]（brk 斷路器類、mc 接觸器類…）（目前種類：brk 斷路器／保險絲座與附件）
const {chromium}=require('playwright'),path=require('path'),fs=require('fs');
const {schemOverlaps}=require(path.resolve('tests/schem-overlap.js'));
(async()=>{const b=await chromium.launch(),p=await b.newPage({viewport:{width:1600,height:1130}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
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
    const v=schemVerify(B),ov=schemOverlaps();
    const pr=[v.length?'對不上':'',/>[^<]*…[^<]*</.test(svg)?'截斷':'',/\u0001/.test(svg)?'佔位':'',miss.length?'沒畫出:'+miss.join('、'):'',ov.length?'重疊:'+ov[0].a+'｜'+ov[0].b:'',oth.length&&!c.expectOther?'其他接線:'+oth.join('、'):'',c.expectOther&&!B.pages.some(x=>/^其他接線/.test(x.title)&&/DUT/.test(x.title)&&c.expectOther.every(t=>x.svg.includes('>'+termLabel(S.devices.find(d=>d.id==='DUT'),t)+'<')))?'其他接線頁沒列出受測器具的端子':'',auxOn&&!auxOn.on?'附件沒裝上':'',addr,(c.cables||[]).some(q=>/光纖/.test(q.spec||''))&&!/stroke-dasharray/.test(svg)?'光纖沒畫虛線':'',c.tbPage&&!B.pages.some(x=>/^端子台/.test(x.title)&&/DUT/.test(x.title+(x.html||'')))?'端子台頁沒有':''].filter(Boolean);
    return {name:c.name,pr};}catch(e){return {name:c.name,pr:['錯誤:'+e.message]};}}),[i,i+20]);
  r.forEach(x=>{if(x.pr.length){ng.push(x);x.pr.forEach(q=>{const key=q.replace(/[:：].*/,'')+(q.startsWith('重疊')?':'+q.split(':')[1].replace(/[0-9]+/g,'#'):'');cls[key]=(cls[key]||0)+1;});}});}
fail+=ng.length;console.log(ng.length?`✗ ${kind}：${ng.length} / ${s1-s0} 個組合有問題 ${JSON.stringify(cls)}`:`✓ ${kind}：${s1-s0} 個組合全部通過`);
const seen=new Set();ng.forEach(x=>{const k=x.pr.map(q=>q.slice(0,14)).join('|');if(seen.has(k))return;seen.add(k);console.log(x.name,'→',x.pr.join('；').slice(0,200));});
}
errs.forEach(e=>console.log('✗ 頁面錯誤：'+e));fail+=errs.length;console.log(fail?`\n失敗 ${fail} 項`:'\n全部通過');await b.close();process.exit(fail?1:0);})();

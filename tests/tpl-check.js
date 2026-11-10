// 器具資料檢查：和內建一樣的自訂器具換回內建、清理沒用到的自訂器具、接點別名、自訂器具提示
// 用法：node tests/tpl-check.js
const {chromium}=require('playwright'),path=require('path');
(async()=>{
  const b=await chromium.launch(),p=await b.newPage({viewport:{width:1400,height:900}});
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+path.join(__dirname,'..','index.html'));
  const res=await p.evaluate(()=>{
    const out=[],ok=(c,m)=>out.push((c?'✓ ':'✗ ')+m);
    const B=TPL['my2n-24'],copy={...B,cat:'自訂器具',terms:B.t.map(x=>({id:x[0],x:x[1],y:x[2],side:x[3],desc:x[4]||''}))};delete copy.t;
    const changed={...copy,terms:copy.terms.map((x,i)=>i?x:{...x,id:'X4'})};
    const base={box:{w:600,h:500,d:300,back:20},plate:{w:560,h:460},door:{w:600,h:500},ducts:[],glands:[],
      tpls:{'my2n-24':copy,c7:{...copy,src:'my2n-24'},c8:{...changed,src:'my2n-24'},c9:{...copy,n:'沒用到的',w:30}},
      devices:[{id:'K1',tag:'K1',tpl:'my2n-24',x:50,y:50,sheet:'plate'},{id:'K2',tag:'K2',tpl:'c7',x:100,y:50,sheet:'plate'},{id:'K3',tag:'K3',tpl:'c8',x:150,y:50,sheet:'plate'},{id:'Q',tag:'Q',tpl:'ic60-1P6A',x:250,y:50,sheet:'plate'}],
      wires:[{id:'w1',no:'A',a:{d:'K2',t:'13'},b:{d:'Q',t:'1'},wps:[],gauge:.75,color:'black'},{id:'w2',no:'B',a:{d:'K3',t:'X4'},b:{d:'Q',t:'2'},wps:[],gauge:.75,color:'black'}]};
    const n=normalize(JSON.parse(JSON.stringify(base)));S=n.state;resetUi();commit();recompute();renderPalette();
    ok(!S.tpls['my2n-24']&&S.devices.find(d=>d.id==='K1').tpl==='my2n-24','和內建一模一樣、同名的自訂器具：換回內建');
    ok(!S.tpls.c7&&S.devices.find(d=>d.id==='K2').tpl==='my2n-24'&&S.wires.some(w=>w.id==='w1'),'從內建複製來、內容沒改的自訂器具：換回內建，線保留');
    ok(!!S.tpls.c8&&S.devices.find(d=>d.id==='K3').tpl==='c8','改過接點名稱的自訂器具：保留');
    ok(n.dropped===0,'讀檔沒有略過資料');
    ok(document.querySelectorAll('.lib.cus .cus-badge').length===Object.keys(S.tpls).length,'器具庫的自訂器具都有「自訂」標記');
    ok($('cusClean')&&/1/.test($('cusClean').textContent),'清理按鈕列出 1 個沒用到的自訂器具');
    setMode('place');cleanCustomAsk();const cb=[...document.querySelectorAll('#askCard [data-cus]')];ok(cb.length===1&&cb[0].dataset.cus==='c9','清理清單只有沒用到的那一個');
    document.querySelector('#askCard [data-ask="0"]').click();ok(!S.tpls.c9&&!!S.tpls.c8,'清理後只刪掉勾選的');
    $('undo').click();ok(!!S.tpls.c9,'可以復原');
    // 接點別名
    const q=S.devices.find(d=>d.id==='Q');picked={k:'dev',id:'Q'};renderDetail();const inp=document.querySelector('#detail [data-alias="1"]');ok(!!inp,'內建器具有接點別名欄位');
    inp.value='電源R';inp.dispatchEvent(new Event('change'));ok(q.alias&&q.alias['1']==='電源R','填別名');
    ok(epText(S.wires.find(w=>w.id==='w1').b)==='Q·電源R','線的兩端顯示別名');
    ok([...document.querySelectorAll('#board text.tl')].some(t=>t.textContent==='電源R'),'圖上接點顯示別名');
    ok(S.wires.find(w=>w.id==='w1').b.t==='1'&&simElems(q)[0].a==='1','線和模擬動作仍接在原本的接點');
    const n2=normalize(JSON.parse(JSON.stringify(S))).state;ok(n2.devices.find(d=>d.id==='Q').alias['1']==='電源R','別名存檔讀回');
    const bad=normalize({...JSON.parse(JSON.stringify(S)),devices:S.devices.map(d=>d.id==='Q'?{...d,alias:{'1':'x','不存在':'y','2':'2'}}:d)}).state.devices.find(d=>d.id==='Q').alias;
    ok(JSON.stringify(bad)==='{"1":"x"}','不存在的接點、和原名一樣的別名會拿掉');
    picked={k:'dev',id:'Q'};renderDetail();inp.value='';const i2=document.querySelector('#detail [data-alias="1"]');i2.value='';i2.dispatchEvent(new Event('change'));ok(!q.alias,'清空別名就拿掉');
    // 端子台不顯示別名欄位（用片上標籤）
    S.devices.push({id:'TB',tag:'TB',tpl:'w2202-1201',x:300,y:200,sheet:'plate',count:3});recompute();picked={k:'dev',id:'TB'};renderDetail();ok(!document.querySelector('#detail [data-alias]'),'端子台不顯示接點別名（用片上標籤）');
    // 自訂器具提示
    picked={k:'dev',id:'K3'};renderDetail();ok(!!document.querySelector('#detail .cus-note'),'選取自訂器具：右側提示未核對');
    openEditor('ic60-1P6A',q);ok(/存檔後這個器具會變成自訂器具/.test(document.querySelector('.ed-warn').textContent),'編輯內建器具：提示會變成自訂、改名用片上標籤或接點別名');$('edCancel').click();
    openEditor(null);ok(!!document.querySelector('.ed-warn')&&!/存檔後/.test(document.querySelector('.ed-warn').textContent),'新增自訂器具：提示不會核對');$('edCancel').click();
    return out;
  });
  await b.close();
  res.forEach(l=>console.log(l));errs.forEach(e=>console.log('✗ 頁面錯誤：'+e));
  const fail=res.filter(l=>l.startsWith('✗')).length+errs.length;
  console.log(fail?`\n失敗 ${fail} 項`:'\n全部通過');process.exit(fail?1:0);
})();

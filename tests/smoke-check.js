// 整體冒煙測試：拿專案檔（沒給就用內建範例）把每個畫面與功能都跑一遍，確認沒有錯誤
// 讀檔與存檔讀回、四種模式、清單分頁、匯出、列印、選取每台器具／每條線／每條電纜、復原、器具編輯器、動作模擬（自動測試）
// 用法：node tests/smoke-check.js [專案.json …]
const {chromium}=require('playwright'),path=require('path'),fs=require('fs');
(async()=>{
  const files=process.argv.slice(2);const b=await chromium.launch();let fail=0;
  for(const f of files.length?files:[null]){
    const p=await b.newPage({viewport:{width:1500,height:950}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto('file://'+path.join(__dirname,'..','index.html'));
    // 打開時是檢視模式，而且檢視模式可以匯入專案（從選單的「匯入專案」選檔）
    const pre=[];const v0=await p.evaluate(()=>({mode,dis:$('importB').disabled}));pre.push((v0.mode==='view'?'✓ ':'✗ ')+'打開時是檢視模式');pre.push((!v0.dis?'✓ ':'✗ ')+'檢視模式的「匯入專案」可以按');
    if(f){const n0=await p.evaluate(()=>S.devices.length);await p.setInputFiles('#importF',f);await p.waitForFunction(n0=>S.devices.length!==n0,n0,{timeout:5000}).catch(()=>{});
      const v1=await p.evaluate(()=>({mode,n:S.devices.length,t:$('toast').textContent}));pre.push((v1.mode==='view'&&v1.n>0&&/已匯入/.test(v1.t)?'✓ ':'✗ ')+`檢視模式匯入專案檔：${v1.n} 台器具，還在檢視模式（${v1.t}）`);}
    const res=pre.concat(await p.evaluate(j=>{
      const out=[],ok=(c,m)=>out.push((c?'✓ ':'✗ ')+m),tryit=(m,fn)=>{try{const r=fn();ok(r!==false,m);}catch(e){ok(false,m+'：'+e.message);}};
      const n=normalize(j?JSON.parse(j):sampleState());S=n.state;resetUi();commit();
      let t0=performance.now();recompute();const ms=Math.round(performance.now()-t0);
      ok(n.dropped===0,`讀檔沒有略過資料（${S.devices.length} 器具、${S.wires.length} 線、${(S.cables||[]).length} 電纜）`);
      ok(ms<1500,`整張重算 ${ms} ms`);
      const s1=JSON.stringify(normalize(JSON.parse(JSON.stringify(S))).state),s2=JSON.stringify(normalize(JSON.parse(s1)).state);ok(s1===s2,'存檔讀回再存一次內容一樣');
      ok(S.wires.every(w=>ROUTES.get(w.id)),'每條線都有路徑');
      // 模式
      ['place','view','sim','wire'].forEach(m=>tryit('切換到'+{place:'擺放',view:'檢視',sim:'模擬',wire:'接線'}[m],()=>{setMode(m);renderWires();renderOverlay();renderDetail();}));
      // 清單分頁與匯出（攔下存檔）
      const saved=[];const sf=saveFile;saveFile=(name,data)=>saved.push(name);
      ['all','ext','bom','len','rev'].forEach(t=>tryit('清單分頁 '+t,()=>{tab=t;renderList();if(t!=='rev')exportCsv();}));tab='all';renderList();saveFile=sf;
      ok(saved.length===4,'匯出 CSV 4 種：'+saved.join('、'));
      // 列印
      tryit('列印全部',()=>{buildPrint();return $('print').querySelectorAll('section').length>0;});
      tryit('列印審查報告',()=>{printReviewOnly=true;buildPrint();printReviewOnly=false;return $('print').querySelectorAll('section').length===2;});
      // 選取每台器具、每條線、每條電纜
      let bad=[];setMode('place');S.devices.forEach(d=>{try{picked={k:'dev',id:d.id};renderDetail();renderWires();}catch(e){bad.push(d.tag+'：'+e.message);}});ok(!bad.length,'選取每台器具'+(bad.length?'：'+bad.slice(0,3).join('；'):''));
      bad=[];setMode('wire');S.wires.forEach(w=>{try{picked=null;sel=w.id;renderDetail();applyWireClasses();}catch(e){bad.push(w.no+'：'+e.message);}});ok(!bad.length,'選取每條線'+(bad.length?'：'+bad.slice(0,3).join('；'):''));
      bad=[];(S.cables||[]).forEach(c=>{try{selectCable(c.id);renderDetail();applyWireClasses();}catch(e){bad.push(c.no+'：'+e.message);}});ok(!bad.length,'選取每條電纜'+(bad.length?'：'+bad.slice(0,3).join('；'):''));
      sel=null;selCab=null;
      // 現場區、出線口、線槽
      tryit('選取每個現場區、出線口、線槽',()=>{setMode('place');S.fields.forEach(z=>{picked={k:'zone',id:z.id};renderDetail();renderWires();});S.glands.forEach(g=>{picked={k:'gland',id:g.id};renderDetail();});S.ducts.forEach(d=>{picked={k:'duct',id:d.id};renderDetail();});picked=null;});
      // 移動一台器具再復原
      const d0=S.devices.find(d=>d.sheet==='plate'),x0=d0&&d0.x;
      if(d0)tryit('移動器具後復原',()=>{d0.x+=10;commit();recompute();$('undo').click();return devOf(d0.id).x===x0;});
      // 器具編輯器：每種用到的器具打開再取消
      bad=[];[...new Set(S.devices.map(d=>d.tpl))].forEach(id=>{try{const d=S.devices.find(x=>x.tpl===id);openEditor(id,d);$('edCancel').click();}catch(e){bad.push(id+'：'+e.message);}});ok(!bad.length,'器具編輯器打開每種器具'+(bad.length?'：'+bad.slice(0,3).join('；'):''));
      // 動作模擬
      setMode('sim');const brk=S.devices.filter(d=>simElems(d).some(e=>e.k==='brk'));brk.forEach(d=>SIMST.on[d.id]=true);
      t0=performance.now();let r=simRun();const sm=Math.round(performance.now()-t0);ok(sm<500,`模擬一次 ${sm} ms`);
      // 每個可操作的器具按一下（啟動類的按鈕會自我保持，照順序都按過）
      bad=[];S.devices.filter(d=>simElems(d).some(e=>e.btn)).forEach(d=>[...new Set(simElems(d).filter(e=>e.btn).map(e=>e.btn))].forEach(bt=>{try{simPress(d.id,bt,true);simPress(d.id,bt,false);}catch(e){bad.push(d.tag+'：'+e.message);}}));ok(!bad.length,'模擬：每個按鈕、感測器按一下'+(bad.length?'：'+bad.slice(0,3).join('；'):''));
      tryit('模擬：Y 逐點測試',()=>{simTest=simAutoY();renderDetail();return Array.isArray(simTest.rows);});
      tryit('模擬：輸入逐點測試',()=>{simTest=simAutoX();renderDetail();return Array.isArray(simTest.rows);});
      tryit('模擬：列印測試結果',()=>{printSimOnly=true;buildPrint();printSimOnly=false;return !!$('print').querySelector('table');});
      r=SIMST.res;out.push(`  模擬結果：短路 ${r.shorts}、不穩定 ${r.unstable?'是':'否'}、提醒 ${r.warn.length} 則；沒有動作資料的器具 ${S.devices.filter(d=>!hasSim(d)).length} 台`);
      setMode('wire');ok(SIMST===null,'離開模擬');
      out.push(`  檢查清單 ${ISSUES.length} 項`+(ISSUES.length?'：'+ISSUES.slice(0,4).map(i=>i.t).join('；'):''));
      return out;
    },f?fs.readFileSync(f,"utf8"):null));
    console.log(`\n== ${f?path.basename(f):'內建範例'} ==`);res.forEach(l=>console.log(l));errs.forEach(e=>console.log('✗ 頁面錯誤：'+e));
    fail+=res.filter(l=>l.startsWith('✗')).length+errs.length;await p.close();
  }
  await b.close();console.log(fail?`\n失敗 ${fail} 項`:'\n全部通過');process.exit(fail?1:0);
})();

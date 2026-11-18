// 工具分頁檢查：線號標籤、端子台接線表、24V 電源負載（手算對照）、版本比較、故障排除練習
// 用法：node tests/tools-check.js
const {chromium}=require('playwright'),path=require('path');
(async()=>{
  const b=await chromium.launch(),p=await b.newPage({viewport:{width:1400,height:900}});
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+path.join(__dirname,'..','index.html'));
  const res=await p.evaluate(()=>{
    const out=[],ok=(c,m)=>out.push((c?'✓ ':'✗ ')+m);
    const D=(id,tpl,x,y,sheet='plate',extra={})=>({id,tag:id,tpl,x,y,sheet,...extra});
    const build=()=>{S=normalize({box:{w:900,h:700,d:300,back:20},plate:{w:860,h:660},door:{w:900,h:700},
      devices:[D('PWR','field-power',0,-300,'field'),D('Q1','ic60-3P16A',40,40),D('F1','ic60-1P6A',120,40),D('PS','drl120',160,40),D('PLC','fx5u32',300,40),
        D('KM','lc1d09',40,250),D('SB1','py2201-g',600,100,'door'),D('SB2','py2201-r',600,150,'door'),
        D('KA','my2n-24',300,250),D('LP','lamp',400,-300,'field'),D('PX','e2e',200,-300,'field'),D('TB','w2202-1201',500,300,'plate',{count:6,jumpers:[{at:1,p:2}]})],
      ducts:[],glands:[],wires:[]}).state;resetUi();
      let n=0;const W=(a,at,b,bt)=>S.wires.push({id:'w'+(++n),no:'W'+n,a:{d:a,t:at},b:{d:b,t:bt},wps:[],gauge:.75,color:'black'});
      W('PWR','R','Q1','1');W('PWR','S','Q1','3');W('PWR','T','Q1','5');
      W('Q1','2','PS','L');W('Q1','4','PS','N');W('Q1','2','PLC','L');W('Q1','4','PLC','N');
      W('PS','+V1','F1','1');W('F1','2','TB','1A');W('TB','2A','SB2','1');W('SB2','2','SB1','3');W('SB1','4','KM','A1');W('KM','A2','PS','-V1');
      W('PLC','S/S','PS','-V1');W('PX','棕','F1','2');W('PX','藍','PS','-V1');W('PX','黑','PLC','X0');
      W('PLC','COM0','PS','-V1');W('PLC','Y0','KA','14');W('KA','13','F1','2');
      W('Q1','2','KA','9');W('KA','5','LP','L/+');W('LP','N/−','Q1','4');
      recompute();};
    build();
    // 1. 線號標籤
    const L=labelRows();ok(L.length===S.wires.length*2,`線號標籤：每條線兩端各一張（${L.length} 張）`);
    ok(L.some(r=>r.no==='W9'&&r.here==='TB:1A'&&r.there==='F1:2'),'標籤寫這一端與對端（W9：TB:1A → F1:2）');
    ok(labelPrintHtml('x').includes(`共 ${L.length} 張`),'列印標籤頁');
    // 2. 端子台接線表
    const T=tbTables();ok(T.length===1&&T[0].d.id==='TB','端子台接線表：只列有接線的端子台');
    const r1=T[0].rows.find(r=>/^1/.test(r[0])),r2=T[0].rows.find(r=>/^2/.test(r[0]));
    ok(r1&&r1[1].includes('W9 → F1:2')&&r2&&r2[1].includes('W10 → SB2:1'),'每片列出接線與對端');
    ok(T[0].jump.length===1&&/第 1～2 片/.test(T[0].jump[0]),'列出短路片');
    // 3. 電源負載（手算）：PS 24V：KM 線圈（LC1D09BL 2.4 W → 100 mA）＋ PLC X0（接 PS，5.3 mA）＋ KA 線圈、PX 電源（沒有資料）
    let C=loadCalc(),ps=C.srcs.find(s=>s.d.id==='PS');
    ok(ps&&ps.total===105.3&&ps.unknown===2,`負載：PS 合計 105.3 mA、2 項沒有資料（實際 ${ps&&ps.total}、${ps&&ps.unknown}）`);
    ok(ps&&ps.cap&&ps.cap.mA===5000&&ps.level==='ok','PS 容量 5000 mA（DRL-24V120W），容量內');
    ok(ps&&ps.items.some(i=>i.d.id==='KM'&&i.inrush===100&&/B8\/27/.test(i.src)),'線圈資料附型錄出處');
    ok(!C.srcs.some(s=>s.items.some(i=>i.d.id==='LP')),'AC 負載（燈）不算進 DC 電源');
    ok(!SIMST||!SIMST.all,'負載計算不影響模擬狀態');
    S.loadMeas={'my2n-24|線圈':30,'e2e|電源':15};C=loadCalc();ps=C.srcs.find(s=>s.d.id==='PS');
    ok(ps.total===150.3&&ps.unknown===0,`填實測值後合計 150.3 mA（實際 ${ps.total}）`);
    S.loadMeas['cap|drl120|24V']=160;ps=loadCalc().srcs.find(s=>s.d.id==='PS');ok(ps.level==='warn'&&Math.round(ps.pct)===94,'容量 160 mA：94% → 超過 80% 警告');
    S.loadMeas['cap|drl120|24V']=150;ps=loadCalc().srcs.find(s=>s.d.id==='PS');ok(ps.level==='err','容量 150 mA：超過 100% → 錯誤');
    { const n=normalize({...JSON.parse(JSON.stringify(S)),loadMeas:{'a|b':5,'bad':-1,'x':'7'}}).state;ok(JSON.stringify(n.loadMeas)==='{"a|b":5}','讀檔：實測值只留合法的數字'); }
    delete S.loadMeas;
    // 主機輸入接自己的 24V：不另外算（型錄容量已扣）；增設模組內部 24V 算在主機
    S.wires=S.wires.filter(w=>!(w.a.d==='PX'));S.devices.push(D('EX','fx516ex',383,40,'plate',{on:'PLC',chain:0}));
    let n=100;const W=(a,at,b,bt)=>S.wires.push({id:'w'+(++n),no:'W'+n,a:{d:a,t:at},b:{d:b,t:bt},wps:[],gauge:.75,color:'black'});
    W('PX','棕','PLC','24V');W('PX','藍','PLC','0V');W('PX','黑','PLC','X0');recompute();
    C=loadCalc();const cpu=C.srcs.find(s=>s.d.id==='PLC');
    ok(cpu&&cpu.cap.mA===400&&cpu.items.some(i=>i.d.id==='EX'&&i.mA===85)&&!cpu.items.some(i=>/輸入/.test(i.name)),`FX5U 24V：容量 400 mA，16EX 內部 85 mA，自己的輸入點不重複算（合計 ${cpu&&cpu.total}）`);
    // 4. 版本比較
    build();diffOld={name:'old.json',st:JSON.parse(JSON.stringify(S))};
    S.devices.push(D('KB','lc1d18',150,250));S.devices.find(d=>d.id==='KM').x+=20;S.wires=S.wires.filter(w=>w.no!=='W5');S.wires.find(w=>w.no==='W6').no='W6X';
    let n2=200;S.wires.push({id:'nw',no:'N1',a:{d:'KB',t:'A1'},b:{d:'F1',t:'2'},wps:[],gauge:.75,color:'black'});recompute();
    let Df=diffCalc();ok(Df.dev.add.length===1&&Df.dev.chg.length===1&&/移動 20 mm/.test(Df.dev.chg[0].c[0]),'版本比較：器具新增 1、移動 1');
    ok(Df.wire.add.length===1&&Df.wire.del.length===1&&Df.wire.chg.length===1&&/W6 → W6X/.test(Df.wire.chg[0].c[0]),'版本比較：導線新增、刪除、改線號各 1（改線號算變更不算刪除）');
    renderBoard();ok(document.querySelectorAll('.diff-ov rect').length===2&&document.querySelectorAll('.diff-ov path').length===2,'圖上標示新增／變更的器具與線');
    ok(diffPrintHtml('m').includes('刪除'),'比較報告列印');diffOld=null;renderBoard();renderOverlay();ok(!document.querySelector('.diff-ov'),'清除比較後不標示');
    // 5. 故障排除練習
    build();simReset();SIMST.on.Q1=true;SIMST.on.F1=true;SIMST.press.add('SB1|按下');
    let R=simRun();ok(R.dev.KM&&R.dev.KM.coil,'正常：按 SB1 時 KM 吸合');
    simFault={k:'wire',id:S.wires.find(w=>w.no==='W11').id};R=simRun();ok(!(R.dev.KM&&R.dev.KM.coil),'斷線（W11 SB2→SB1）：KM 不吸合');
    simFault={k:'coil',d:'KM'};R=simRun();ok(!(R.dev.KM&&R.dev.KM.coil)&&R.dev.KM.on.includes('線圈'),'線圈燒毀：有電但不吸合');
    simFault={k:'open',d:'SB1',a:'3',b:'4'};R=simRun();ok(!(R.dev.KM&&R.dev.KM.coil),'接點接觸不良：按了也不通');
    SIMST.press.clear();simFault={k:'weld',d:'KA',a:'9',b:'5'};R=simRun();ok(R.dev.LP&&R.dev.LP.on.length,'接點熔著：KA 沒吸合燈也亮');
    simFault=null;const FC=faultCands();ok(FC.wire.length&&FC.coil.some(x=>x.d==='KM')&&FC.weld.some(x=>x.d==='KA')&&FC.open.some(x=>x.d==='SB1'),'出題候選：四種故障都找得到');
    { const save=SIMST;loadCalc();ok(SIMST===save,'負載計算不動到模擬狀態'); }
    { build();S.wires.push({id:'wk1',no:'P1',a:{d:'Q1',t:'2'},b:{d:'KM',t:'L1'},wps:[],gauge:2,color:'black'},{id:'wk2',no:'P2',a:{d:'KM',t:'T1'},b:{d:'TB',t:'5A'},wps:[],gauge:2,color:'black'});recompute();
      const SC=pracScenarios(),chk=(F,lv)=>SC.map(sc=>pracDiff(pracRun(sc,null),pracRun(sc,F),lv,F.k==='wire'?F.id:null)).find(Boolean);
      ok(SC.some(s=>/按著 SB1/.test(s.txt))&&SC.some(s=>/PLC 輸出 Y0/.test(s.txt)),`出題情境：按鈕、PLC 輸出（共 ${SC.length} 種）`);
      const e1=chk({k:'weld',d:'KA',a:'9',b:'5'},'easy');ok(e1&&/LP 應該「不動作」，實際「燈」/.test(e1.L.join()),'簡單：KA 熔著 → 燈不該亮卻亮（器具動作不同）');
      const e2=chk({k:'weld',d:'KM',a:'L1',b:'T1'},'easy'),h2=chk({k:'weld',d:'KM',a:'L1',b:'T1'},'hard');
      ok(!e2&&h2&&/P2 應該「沒電」，實際「有電」/.test(h2.L.join()),'KM 主接點熔著、出側沒負載：簡單不出，進階才出（P2 不該有電）');
      const h3=chk({k:'wire',id:'w11'},'hard');ok(h3&&!h3.L.some(t=>/W11 /.test(t)),'斷線題的提示不直接列出斷掉的那條'); }
    build();setMode('sim');pracLevel='easy';pracStart();ok(simPrac&&simPrac.hint&&simPrac.hint.kind==='dev','簡單題附症狀提示（器具動作不同）');ok(simFault&&simPrac,'隨機出題');const F=simFault;
    simPrac.hints=2;renderDetail();ok(document.querySelectorAll('.sim-hint').length===2,'提示兩段：症狀、故障種類');pracGuess(F.k,F.k==='wire'?F.id:F.d);ok(simPrac.done&&simPrac.tries===1,'猜對：顯示答案');
    renderDetail();ok(document.querySelector('.prac-ans')&&/答案/.test(document.getElementById('detail').textContent||document.body.textContent),'圖上標出答案');
    pracEnd();ok(!simFault,'結束練習清除故障');setMode('view');
    // 6. 工具分頁畫面
    build();$('tabTool').click();ok(/24V 電源負載/.test($('list').textContent)&&/版本比較/.test($('list').textContent)&&$('ldPrint'),'工具分頁：四個功能都在');
    // 7. 寬面板：清單整塊搬到盤面右邊，盤面仍在；收回後回到右側
    { const sw=$('stage').getBoundingClientRect().width;$('wideB').click();const m=document.querySelector('main');
      ok(!$('wide').hidden&&$('wide').contains($('listBox'))&&m.classList.contains('wl')&&$('stage').getBoundingClientRect().width>200,'展開：清單移到寬面板，盤面還看得到');
      $('tabBom').click();ok($('wide').contains($('list'))&&/材料/.test($('listH').textContent),'寬面板裡切分頁照常');
      ok(JSON.parse(localStorage.getItem('wiring-sim-wide')).on===true,'展開狀態記在瀏覽器');
      $('wideClose').click();ok($('wide').hidden&&document.querySelector('#right').contains($('listBox'))&&Math.abs($('stage').getBoundingClientRect().width-sw)<2,'收回：清單回到右側、盤面寬度恢復'); }
    return out;});
  await b.close();
  res.forEach(l=>console.log(l));errs.forEach(e=>console.log('✗ 頁面錯誤：'+e));
  const fail=res.filter(l=>l.startsWith('✗')).length+errs.length;console.log(fail?`\n失敗 ${fail} 項`:'\n全部通過');process.exit(fail?1:0);
})();

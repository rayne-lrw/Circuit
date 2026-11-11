// 施耐德 TeSys 檢查：LRD／LR9D 插在 LC1D 下方（只能裝型錄對照表上的機種）、主迴路經接觸器與熱電驛接通、跳脫與復歸；
// GV2P 斷路器 ON／OFF；LC1DT200A 四極主接點；存檔讀回
// 用法：node tests/tesys-check.js
const {chromium}=require('playwright'),path=require('path');
(async()=>{
  const b=await chromium.launch(),p=await b.newPage({viewport:{width:1400,height:900}});
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+path.join(__dirname,'..','index.html'));
  const res=await p.evaluate(()=>{
    const out=[],ok=(c,m)=>out.push((c?'✓ ':'✗ ')+m);
    const D=(id,tpl,x,y,ex={})=>({id,tag:id,tpl,x,y,sheet:'plate',...ex});
    const box={box:{w:1400,h:900,d:300,back:20},plate:{w:1360,h:860},door:{w:900,h:700},ducts:[],glands:[]};
    const dv=id=>devOf(id);
    // ---------- 型錄對照表：可裝的接觸器 ----------
    ok(tplOf({tpl:'lrd35'}).fits.includes('lc1d32m7')&&!tplOf({tpl:'lrd35'}).fits.includes('lc1d25m7'),'LRD35 只能裝 D32、D38（型錄對照表）');
    ok(tplOf({tpl:'lrd16'}).fits.includes('lc1d12bd')&&!tplOf({tpl:'lrd16'}).fits.includes('lc1d09bd'),'LRD16 從 D12 起才能裝');
    ok(tplOf({tpl:'lrd10'}).fits.includes('lc1d09'),'LRD10 也能裝到庫裡原有的 LC1D09BL');
    ok(['97','98','95','96'].join()===tplOf({tpl:'lrd10'}).terms.filter(t=>/^9/.test(t.id)).sort((a,b)=>a.x-b.x).map(t=>t.id).join(),'LRD 輔助端子左到右 97、98、95、96');
    ok(['95','96','97','98'].join()===tplOf({tpl:'lr9d08'}).terms.filter(t=>/^9/.test(t.id)).sort((a,b)=>a.x-b.x).map(t=>t.id).join(),'LR9D 輔助端子左到右 95、96、97、98');
    // ---------- LRD10 裝在 LC1D09M7 下方 ----------
    S=normalize({...box,wires:[],devices:[D('PWR','field-power',0,-300,{sheet:'field'}),D('K','lc1d09m7',300,200),D('F','lrd10',600,500),D('KA','my2n-220',900,300),D('Q','gv2p10',100,200),D('F2','lrd35',700,600)]}).state;resetUi();
    const K=dv('K'),F=dv('F');hostSnap(F,K.x,K.y+90);ok(F.on==='K'&&F.y===K.y+71&&F.x===K.x,'LRD10 拖到 LC1D09M7 下方：裝上（裝上後高度 123，照型錄）');
    hostSnap(dv('F2'),K.x,K.y+90);ok(!dv('F2').on,'LRD35 不能裝到 LC1D09');
    ok(nodeKey({d:'F',t:'T1'})===nodeKey({d:'K',t:'T1'}),'熱電驛的 2/T1 和接觸器的 2/T1 算同一點');
    let k=0;const W=(a,at,bb,bt)=>S.wires.push({id:'w'+(++k),no:'W'+k,a:{d:a,t:at},b:{d:bb,t:bt},wps:[],gauge:1.25,color:'black'});
    // 主迴路：R → GV2P 1-2 → K L1 →（接觸器）→ T1 ＝ 熱電驛 T1 → KA 線圈 → S；控制：R → 95-96 → A1，A2 → S
    W('PWR','R','Q','1');W('Q','2','K','L1');W('F','T1','KA','14');W('KA','13','PWR','S');W('PWR','R','F','95');W('F','96','K','A1');W('K','A2','PWR','S');
    commit();recompute();simReset();let r=simRun();
    ok(r.dev.K&&r.dev.K.coil&&!(r.dev.KA&&r.dev.KA.coil),'模擬：經 95-96 的線圈吸合；GV2P 沒打開時負載沒電');
    SIMST.on.Q=true;r=simRun();ok(r.dev.KA&&r.dev.KA.coil,'GV2P ON：主迴路經接觸器、熱電驛（不用畫線）送到負載');
    SIMST.trip.F=true;r=simRun();ok(!(r.dev.K&&r.dev.K.coil)&&!(r.dev.KA&&r.dev.KA.coil),'LRD 跳脫：95-96 打開，接觸器跳開');
    SIMST.trip.F=false;r=simRun();ok(r.dev.K&&r.dev.K.coil,'復歸：接觸器再次吸合');
    SIMST.on.Q=false;r=simRun();ok(!(r.dev.KA&&r.dev.KA.coil),'GV2P OFF：負載斷電');
    const n=normalize(JSON.parse(JSON.stringify(S))).state;ok(n.devices.find(d=>d.id==='F').on==='K','存檔讀回：熱電驛裝在接觸器上');
    // ---------- LR9D 裝在 LC1D25BD（高度 140） ----------
    S=normalize({...box,wires:[],devices:[D('K','lc1d25bd',300,200),D('E','lr9d32',600,500)]}).state;resetUi();
    hostSnap(dv('E'),dv('K').x,dv('K').y+100);ok(dv('E').on==='K'&&dv('E').y===dv('K').y+84,'LR9D32 拖到 LC1D25BD 下方：裝上（裝上後高度 140）');
    // ---------- LC1DT200A 四極 ----------
    S=normalize({...box,wires:[],devices:[D('PWR','field-power',0,-300,{sheet:'field'}),D('PS','drl120',900,600),D('K4','lc1dt200abne',300,200),D('KA','my2n-24',900,300)]}).state;resetUi();
    k=0;W('PWR','R','PS','L');W('PWR','S','PS','N');W('PS','+V1','K4','A1');W('K4','A2','PS','-V1');W('PS','+V1','K4','L4');W('K4','T4','KA','14');W('KA','13','PS','-V1');
    commit();recompute();simReset();r=simRun();ok(r.dev.K4&&r.dev.K4.coil&&r.dev.KA&&r.dev.KA.coil,'LC1DT200A：線圈吸合，第 4 極 7L4-8T4 導通');
    ok(!!termOf(dv('K4'),'L4')&&!!termOf(dv('K4'),'T4')&&tplOf(dv('K4')).w===132,'LC1DT200A 有 7L4／8T4，寬 132');
    return out;
  });
  await b.close();
  res.forEach(l=>console.log(l));errs.forEach(e=>console.log('✗ 頁面錯誤：'+e));
  const fail=res.filter(l=>l.startsWith('✗')).length+errs.length;
  console.log(fail?`\n失敗 ${fail} 項`:'\n全部通過');process.exit(fail?1:0);
})();

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
    // ---------- LC2K 一體式正逆轉：兩組線圈、機械互鎖、內部換相 ----------
    S=normalize({...box,wires:[],devices:[D('PWR','field-power',0,-300,{sheet:'field'}),D('PS','drl120',900,600),D('R2','lc2k0610bd',300,200),D('KA','my2n-24',900,300)]}).state;resetUi();
    ok(nodeKey({d:'R2',t:'L1'})===nodeKey({d:'R2',t:'L1(2)'})&&nodeKey({d:'R2',t:'T1'})===nodeKey({d:'R2',t:'T3(2)'}),'LC2K 內部：上排 L1 並聯、下排左 T1 接右 T3（換相）');
    k=0;W('PWR','R','PS','L');W('PWR','S','PS','N');W('PS','+V1','R2','A1');W('R2','A2','PS','-V1');W('PS','+V1','R2','A1(2)');W('R2','A2(2)','PS','-V1');
    W('PS','+V1','R2','L1');W('R2','T1','KA','14');W('KA','13','PS','-V1');commit();recompute();simReset();r=simRun();
    ok(r.dev.R2&&r.dev.R2.coil&&r.dev.R2.groups&&r.dev.R2.groups.length===1,'LC2K 兩組線圈同時通電：機械互鎖只讓一組吸合');
    ok(r.dev.KA&&r.dev.KA.coil,'正轉吸合：L1 → 2/T1 有電');
    // ---------- LC2D：放下時左右各一台 LC1D、自動接好並聯與換相線 ----------
    S=normalize({...box,wires:[],devices:[]}).state;resetUi();
    placing={tpl:'lc2d09m7',rot:0,o:{id:'__place',tag:'',tpl:'lc2d09m7',x:400,y:300,sheet:'plate'},bad:null};placeDrop();
    const M=S.devices.find(d=>d.tpl==='lc2d09m7'),[KL,KR]=(M&&M.pair||[]).map(dv);
    ok(KL&&KR&&KL.tpl==='lc1d09m7'&&Math.abs((KR.x+45)-KL.x-90.6)<0.01,'LC2D09M7：兩台 LC1D09M7 並排，整組寬約 90');
    ok(S.wires.length===6&&S.wires.some(w=>w.a.t==='T1'&&w.b.t==='T3'),'自動接好原廠主迴路 6 條：上排並聯、下排換相');
    // ---------- LRD325 插在 LC1D40AM7 下方 ----------
    S=normalize({...box,wires:[],devices:[D('K','lc1d40am7',300,200),D('F','lrd325',600,500),D('F2','lrd10',700,500),D('B','lc1d09bne',300,500)]}).state;resetUi();
    hostSnap(dv('F'),dv('K').x,dv('K').y+130);ok(dv('F').on==='K'&&dv('F').y===dv('K').y+115,'LRD325 拖到 LC1D40AM7 下方：裝上（裝上後高度 185）');
    hostSnap(dv('F2'),dv('B').x,dv('B').y+80);ok(dv('F2').on==='B','LRD10 也能裝到 Deca Advanced LC1D09BNE');
    // ---------- 正面附件：LADN11、LADT2 跟著接觸器 ----------
    S=normalize({...box,wires:[],devices:[D('PWR','field-power',0,-300,{sheet:'field'}),D('PS','drl120',900,600),D('K','lc1d18bd',300,200),D('AN','ladn11',600,500),D('AT','ladt2',700,500),D('KA','my2n-24',900,300),D('Q','gv2me10',100,200),D('GE','gvae11',600,600),D('GN','gvan11',700,600)]}).state;resetUi();
    hostSnap(dv('AN'),dv('K').x+20,dv('K').y+40);ok(dv('AN').on==='K','LADN11 拖到接觸器上：裝在正面');
    k=0;W('PWR','R','PS','L');W('PWR','S','PS','N');W('PS','+V1','AN','53');W('AN','54','KA','14');W('KA','13','PS','-V1');W('PS','+V1','K','A1');W('K','A2','PS','-V1');
    commit();recompute();simReset();r=simRun();ok(r.dev.KA&&r.dev.KA.coil,'LADN11 的 53-54 跟著接觸器閉合');
    hostSnap(dv('GE'),dv('Q').x+20,dv('Q').y+20);ok(dv('GE').on==='Q','GVAE11 拖到 GV2ME10 上：裝在正面');
    hostSnap(dv('GN'),dv('Q').x+20,dv('Q').y+40);ok(dv('GN').on==='Q'&&dv('GN').x===dv('Q').x-9.3,'GVAN11 拖到 GV2ME10 上：貼在左側');
    S.wires=S.wires.filter(w=>w.a.d!=='AN'&&w.b.d!=='AN'&&w.b.d!=='KA');W('PS','+V1','GE','13');W('GE','14','KA','14');W('KA','13','PS','-V1');commit();recompute();simReset();r=simRun();
    ok(!(r.dev.KA&&r.dev.KA.coil),'GVAE11 的 13-14：斷路器 OFF 時打開');SIMST.on.Q=true;r=simRun();ok(r.dev.KA&&r.dev.KA.coil,'斷路器 ON：13-14 閉合');
    // ---------- iC60N：1P+N 的 N 一起開閉、4P 寬 72 ----------
    ok(tplOf({tpl:'ic60-4P63A'}).w===72&&tplOf({tpl:'ic60-1PN16A'}).w===36&&tplOf({tpl:'ic60-1PN16A'}).terms.find(t=>t.id==='N').x<tplOf({tpl:'ic60-1PN16A'}).terms.find(t=>t.id==='1').x,'iC60N：4P 寬 72、1P+N 寬 36 且 N 在左邊');
    S=normalize({...box,wires:[],devices:[D('PWR','field-power',0,-300,{sheet:'field'}),D('Q1','ic60-1PN16A',300,200),D('KA','my2n-220',900,300)]}).state;resetUi();
    k=0;W('PWR','R','Q1','1');W('Q1','2','KA','14');W('PWR','S','Q1','N');W('Q1','N(2)','KA','13');commit();recompute();simReset();r=simRun();
    ok(!(r.dev.KA&&r.dev.KA.coil),'iC60N 1P+N OFF：負載沒電');SIMST.on.Q1=true;r=simRun();ok(r.dev.KA&&r.dev.KA.coil,'iC60N 1P+N ON：相線與 N 一起接通');
    return out;
  });
  await b.close();
  res.forEach(l=>console.log(l));errs.forEach(e=>console.log('✗ 頁面錯誤：'+e));
  const fail=res.filter(l=>l.startsWith('✗')).length+errs.length;
  console.log(fail?`\n失敗 ${fail} 項`:'\n全部通過');process.exit(fail?1:0);
})();

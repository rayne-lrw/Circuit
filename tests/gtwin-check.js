// 富士 G-TWIN 檢查：型號數量與尺寸、2P／4P 端子位置、內部附件裝在左右側、主迴路導通、
// 輔助開關跟著 ON／OFF、警報開關跟著跳脫、分激脫扣有電跳脫、欠電壓脫扣沒電跳脫與合不上、跳脫後復歸、存檔讀回
// 用法：node tests/gtwin-check.js
const {chromium}=require('playwright'),path=require('path');
(async()=>{
  const b=await chromium.launch(),p=await b.newPage({viewport:{width:1400,height:900}});
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+path.join(__dirname,'..','index.html'));
  const res=await p.evaluate(()=>{setMode('wire');
    const out=[],ok=(c,m)=>out.push((c?'✓ ':'✗ ')+m);
    const D=(id,tpl,x,y,sheet='plate')=>({id,tag:id,tpl,x,y,sheet});
    // ---------- 器具資料 ----------
    const ids=Object.keys(TPL).filter(id=>/^bw\d+-\dp\d+$/.test(id)),n=k=>ids.filter(id=>id.includes('-'+k+'p')).length;
    ok(ids.length===113&&n(2)===42&&n(3)===46&&n(4)===25,`主體 ${ids.length} 種（2P ${n(2)}、3P ${n(3)}＋原有 BW50EAG、4P ${n(4)}）`);
    ok(!TPL['bw50-3p50']&&TPL['fuji-bw50']&&TPL['fuji-bw50'].ser==='G-TWIN BW','庫裡已有的 BW50EAG 3P50A 略過，併入 G-TWIN BW 分組');
    const t=id=>tplOf({tpl:id}),sz=id=>[t(id).w,t(id).h,t(id).d].join('×');
    ok(sz('bw32-2p10')==='50×100×84'&&sz('bw100-3p75')==='75×100×84'&&sz('bw125-4p100')==='120×155×95'&&sz('bw250-3p225')==='105×165×95'&&sz('bw400-4p400')==='185×257×146'&&sz('bw800-3p800')==='210×275×146','外形照型錄尺寸圖（32～100AF、125AF、250AF、400AF、800AF）');
    const xs=(id,re)=>t(id).terms.filter(x=>re.test(x.id)).sort((a,b)=>a.x-b.x).map(x=>x.id).join(' ');
    ok(xs('bw125-3p50',/^[135]$/)==='1 3 5'&&xs('bw125-3p50',/^[246]$/)==='2 4 6','3P：上 1 3 5、下 2 4 6，由左到右');
    {const T=t('bw400-2p300'),a=T.terms.find(x=>x.id==='1'),c=T.terms.find(x=>x.id==='3');ok(Math.abs(c.x-a.x-88)<0.5,'400AF 2P 是 3P 框架拿掉中間極：1 和 3 相距兩個極距（88 mm）');}
    ok(xs('bw630-4p600',/^[1357]$/)==='1 3 5 7'&&!t('bw630-4p600').terms.some(x=>x.id==='N'),'4P 照 1～8 標，不固定 N 極');
    // ---------- 內部附件安裝 ----------
    S=normalize({box:{w:900,h:700,d:300,back:20},plate:{w:860,h:660},door:{w:900,h:700},ducts:[],glands:[],wires:[],
      devices:[D('PWR','field-power',0,-300,'field'),D('PS','drl120',20,20),D('Q','bw125-3p50',300,200),D('KA','my2n-24',600,20),D('KB','my2n-24',700,20),D('LP','lamp',400,-300,'field'),
        D('WL','bw-wkl',50,500),D('F','bw-f',150,500),D('R','bw-r',250,500)]}).state;resetUi();
    const dv=id=>devOf(id),Q=dv('Q');
    hostSnap(dv('WL'),Q.x+20,Q.y+40);ok(dv('WL').on==='Q'&&dv('WL').x===Q.x-t('bw-wkl').w,'輔助＋警報（左側）拖到斷路器上：貼在左側');
    hostSnap(dv('F'),Q.x+60,Q.y+40);ok(dv('F').on==='Q'&&dv('F').x===Q.x+t('bw125-3p50').w,'分激脫扣（右側）拖到斷路器上：貼在右側');
    hostSnap(dv('R'),Q.x+60,Q.y+40);ok(dv('R').on!=='Q','右側已經裝了分激脫扣：欠電壓脫扣裝不上（一側一個）');
    // ---------- 模擬：主迴路、輔助、警報 ----------
    let k=0;const W=(a,at,bb,bt)=>S.wires.push({id:'w'+(++k),no:'W'+k,a:{d:a,t:at},b:{d:bb,t:bt},wps:[],gauge:.75,color:'black'});
    W('PWR','R','Q','1');W('PWR','S','Q','3');W('Q','2','LP','L/+');W('Q','4','LP','N/−');W('PWR','R','PS','L');W('PWR','S','PS','N');
    W('PS','+V1','WL','11');W('WL','14','KA','14');W('KA','13','PS','-V1');   // 輔助常開 11-14 → KA
    W('PS','+V1','WL','91');W('WL','94','KB','14');W('KB','13','PS','-V1');   // 警報常開 91-94 → KB
    commit();recompute();simReset();
    const run=()=>simRun(),coil=(R,id)=>!!(R.dev[id]&&R.dev[id].coil),lamp=R=>!!(R.dev.LP&&R.dev.LP.on.length);
    let R=run();ok(!lamp(R)&&!coil(R,'KA')&&!coil(R,'KB'),'OFF：燈不亮、輔助常開打開、警報沒動作');
    brkClick('Q');R=run();ok(lamp(R)&&coil(R,'KA')&&!coil(R,'KB'),'ON：主迴路導通燈亮、輔助 11-14 閉合、警報不動作');
    // ---------- 分激脫扣：C1-C2 有電就跳脫 ----------
    W('PS','+V1','F','C1');const wF=S.wires[S.wires.length-1].id;W('F','C2','PS','-V1');const wF2=S.wires[S.wires.length-1].id;recompute();R=run();
    ok(!SIMST.on.Q&&SIMST.btrip.Q&&!lamp(R)&&!coil(R,'KA')&&coil(R,'KB'),'分激脫扣有電：斷路器跳脫（燈熄、輔助打開、警報 91-94 閉合）');
    brkClick('Q');R=run();ok(!SIMST.on.Q&&!SIMST.btrip.Q&&!coil(R,'KB'),'跳脫中點一下：復歸（還是 OFF），警報回原位');
    brkClick('Q');R=run();ok(!SIMST.on.Q&&SIMST.btrip.Q,'分激還有電時再 ON：馬上又跳脫');
    S.wires=S.wires.filter(w=>w.id!==wF&&w.id!==wF2);recompute();brkClick('Q');brkClick('Q');R=run();ok(SIMST.on.Q&&lamp(R),'拿掉分激的電、復歸後 ON：正常送電');
    // ---------- 欠電壓脫扣：沒電跳脫、合不上 ----------
    picked={k:'dev',id:'F'};deleteSel();hostSnap(dv('R'),Q.x+60,Q.y+40);ok(dv('R').on==='Q','拆掉分激後，欠電壓脫扣裝到右側');
    recompute();R=run();ok(!SIMST.on.Q&&SIMST.btrip.Q,'欠電壓線圈沒電：斷路器跳脫');
    brkClick('Q');brkClick('Q');R=run();ok(!SIMST.on.Q&&SIMST.btrip.Q,'欠電壓線圈沒電：復歸後 ON 合不上（又跳脫）');
    W('PWR','R','R','D1');W('PWR','S','R','D2');const wR=S.wires[S.wires.length-1].id;recompute();brkClick('Q');brkClick('Q');R=run();
    ok(SIMST.on.Q&&lamp(R)&&R.dev.R.on.includes('欠電壓線圈'),'欠電壓線圈有電：可以 ON，主迴路導通');
    S.wires=S.wires.filter(w=>w.id!==wR);recompute();R=run();ok(!SIMST.on.Q&&SIMST.btrip.Q&&coil(R,'KB'),'送電中欠電壓線圈斷電：跳脫，警報動作');
    // 模擬面板：跳脫中的斷路器標示
    setMode('sim');SIMST.on={};SIMST.btrip={Q:true};simRefresh();const chip=document.querySelector('[data-sim-brk="Q"]');ok(chip&&chip.classList.contains('trip')&&/跳脫/.test(chip.textContent),'模擬面板：跳脫中的斷路器紅色標示「跳脫（點一下復歸）」');setMode('wire');
    // 存檔讀回
    commit();const n2=normalize(JSON.parse(JSON.stringify(S))).state;ok(n2.devices.filter(d=>d.on==='Q').length===2,'存檔讀回：左右兩側附件都還裝在斷路器上');
    // 刪除斷路器：附件一起刪
    picked={k:'dev',id:'Q'};deleteSel();ok(!dv('WL')&&!dv('R'),'刪除斷路器：左右兩側附件一起刪掉');
    return out;
  });
  await b.close();
  res.forEach(l=>console.log(l));errs.forEach(e=>console.log('✗ 頁面錯誤：'+e));
  const fail=res.filter(l=>l.startsWith('✗')).length+errs.length;
  console.log(fail?`\n失敗 ${fail} 項`:'\n全部通過');process.exit(fail?1:0);
})();

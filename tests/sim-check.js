// 動作模擬檢查：用一個小電路驗證電源、斷路器、自我保持、PLC 輸入輸出、感測器、成組接點（雷射一組）、短路與極性
// 用法：node tests/sim-check.js
const {chromium}=require('playwright'),path=require('path');
(async()=>{
  const b=await chromium.launch(),p=await b.newPage({viewport:{width:1400,height:900}});
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+path.join(__dirname,'..','index.html'));
  const res=await p.evaluate(()=>{
    const out=[],ok=(c,m)=>out.push((c?'✓ ':'✗ ')+m);
    const D=(id,tpl,x,y,sheet='plate',extra={})=>({id,tag:id,tpl,x,y,sheet,...extra});
    S=normalize({box:{w:900,h:700,d:300,back:20},plate:{w:860,h:660},door:{w:900,h:700},
      devices:[D('PWR','field-power',0,-300,'field'),D('Q1','ic60-3P16A',40,40),D('F1','ic60-1P6A',120,40),D('PS','drl120',160,40),D('PLC','fx5u32',300,40),
        D('KM','lc1d09',40,250),D('KX','ladn40',40.6,265,'plate',{on:'KM'}),D('SB1','py2201-g',600,100,'door'),D('SB2','py2201-r',600,150,'door'),
        D('KA','my2n-24',300,250),D('LP','lamp',400,-300,'field'),D('PX','e2e',200,-300,'field'),
        D('LS','laser-ps',500,-300,'field'),D('T1','dc5521f-tb',560,-300,'field'),D('T2','dc5525m-tb',620,-300,'field'),D('LA','laser-dot',680,-300,'field'),D('XS','lk3214',450,-300,'field')],
      ducts:[],glands:[],wires:[]}).state;resetUi();
    let n=0;const W=(a,at,b,bt)=>S.wires.push({id:'w'+(++n),no:'W'+n,a:{d:a,t:at},b:{d:b,t:bt},wps:[],gauge:.75,color:'black'});
    // 三相 → Q1 → PS（R、S）、PLC 電源（R、S）、燈（KA 接點控制）、插座
    W('PWR','R','Q1','1');W('PWR','S','Q1','3');W('PWR','T','Q1','5');
    W('Q1','2','PS','L');W('Q1','4','PS','N');W('Q1','2','PLC','L');W('Q1','4','PLC','N');W('Q1','2','XS','L');W('Q1','4','XS','N');
    // 24V：PS → F1 → SB2 常閉 → SB1 常開 → KM 線圈；KX 53-54 自我保持
    W('PS','+V1','F1','1');W('F1','2','SB2','1');W('SB2','2','SB1','3');W('SB1','4','KM','A1');W('KM','A2','PS','-V1');
    W('SB2','2','KX','53');W('KX','54','KM','A1');
    // PLC：S/S 接 0V（source 輸入），感測器 PNP 黑線 → X0；Y0（COM0 接 0V）→ KA 線圈 → 24V
    W('PLC','S/S','PS','-V1');W('PX','棕','F1','2');W('PX','藍','PS','-V1');W('PX','黑','PLC','X0');
    W('PLC','COM0','PS','-V1');W('PLC','Y0','KA','14');W('KA','13','F1','2');
    // KA 9–5 常開 → 燈（R、S）
    W('Q1','2','KA','9');W('KA','5','LP','L/+');W('LP','N/−','Q1','4');
    // 雷射：插座 → 變壓電源 → 5521 → T1；＋經過 KA 12–8 常開 → T2 V+；− 直接 → T2 V-；T2 5525 → 雷射燈
    W('XS','插頭','LS','AC');W('LS','5521公','T1','5521母');W('T1','V+','KA','12');W('KA','8','T2','V+');W('T1','V-','T2','V-');W('T2','5525公','LA','5525母');
    recompute();simReset();
    const id=t=>t,r=()=>simRun(),dev=(res,i)=>res.dev[i]||{on:[],rev:[]};
    let R=r();ok(S.wires.every(w=>(R.wires[w.id].pot!=='none')===(w.a.d==='PWR')),'起始：斷路器全部 OFF，只有外部電源到斷路器的線有電');
    SIMST.on.Q1=true;SIMST.on.F1=true;R=r();
    ok(dev(R,'PLC').on.includes('電源'),'斷路器 ON：PLC 有電');
    ok(!dev(R,'KM').coil,'還沒按啟動：KM 沒吸合');
    ok(R.wires[S.wires.find(w=>w.a.d==='F1'&&w.a.t==='2').id].pot==='p','24V 線是 ＋ 電位');
    SIMST.press.add('SB1|按下');R=r();ok(dev(R,'KM').coil,'按住 SB1：KM 吸合');
    SIMST.press.clear();R=r();ok(dev(R,'KM').coil,'放開 SB1：KX 自我保持，KM 仍吸合');
    ok(Object.values(R.wires).some(w=>w.cur),'有電流的線有標出來');
    SIMST.press.add('SB2|按下');R=r();ok(!dev(R,'KM').coil,'按 SB2（常閉斷開）：KM 跳脫');
    SIMST.press.clear();R=r();ok(!dev(R,'KM').coil,'放開 SB2：不會自己再吸合');
    ok(!R.X.find(x=>x.name==='X0').on,'感測器沒觸發：X0 OFF');
    SIMST.press.add('PX|觸發');R=r();ok(R.X.find(x=>x.name==='X0').on,'感測器觸發（PNP）：X0 ON');SIMST.press.clear();
    ok(!dev(R,'LA').on.length,'Y0 OFF：雷射不亮');
    SIMST.y.add('PLC|Y0');R=r();ok(dev(R,'KA').coil,'Y0 ON：KA 吸合');ok(dev(R,'LP').on.includes('燈'),'KA 接點：燈亮（AC 兩相）');
    ok(dev(R,'LA').on.includes('雷射'),'KA 接點：雷射亮（插座 → 變壓電源 → 成組接頭 → 繼電器 → 雷射）');
    // 雷射接反：T1 的 V+/V- 對調接到 T2
    const wp=S.wires.find(w=>w.a.d==='KA'&&w.a.t==='8'),wn=S.wires.find(w=>w.a.d==='T1'&&w.a.t==='V-');wp.b.t='V-';wn.b.t='V+';R=r();
    ok(dev(R,'LA').rev.includes('雷射')&&!dev(R,'LA').on.length,'雷射正負接反：顯示極性相反、不亮');wp.b.t='V+';wn.b.t='V-';
    // 短路：24V 直接接到 0V
    W('F1','2','PS','-V2');R=r();ok(R.shorts>0,'24V 接到 0V：偵測到短路');S.wires.pop();R=r();ok(R.shorts===0,'拿掉後沒有短路');
    // 自動測試
    SIMST.y.clear();const ty=simAutoY();ok(ty.rows.some(x=>x[0]==='Y0'&&/KA/.test(x[1])&&/雷射/.test(x[1])),'Y 逐點測試：Y0 → KA、燈、雷射');
    const tx=simAutoX();ok(tx.rows.some(x=>/PX 觸發/.test(x[0])&&/X0/.test(x[1])),'輸入逐點測試：PX → X0');
    // 三相伺服主電源：L1、L2、L3 三條線都要有電流；單相接 L1、L3 也算有電（配盤模擬不判斷欠相）
    ['j4200','j4700','je40'].forEach(sv=>{const keep=S.wires.slice(),kd=S.devices.slice();S.devices.push(D('SV',sv,600,400));const Q2=D('Q2','ic60-3P16A',500,400);S.devices.push(Q2);
      W('PWR','R','Q2','1');W('PWR','S','Q2','3');W('PWR','T','Q2','5');const w1=W('Q2','2','SV','L1'),w2=W('Q2','4','SV','L2'),w3=W('Q2','6','SV','L3');const ids=S.wires.slice(-3).map(w=>w.id);
      commit();recompute();simReset();SIMST.on.Q2=true;let R=simRun();
      ok(ids.every(id=>R.wires[id]&&R.wires[id].cur)&&R.dev.SV.on.filter(x=>x==='主電源').length===1,`${sv} 三相主電源：L1、L2、L3 三條線都有電流，主電源只顯示一次`);
      S.wires=S.wires.filter(w=>w.id!==ids[1]);recompute();R=simRun();ok(R.dev.SV&&R.dev.SV.on.includes('主電源')&&R.wires[ids[0]].cur&&R.wires[ids[2]].cur,`${sv} 單相接 L1、L3：主電源有電`);
      S.wires=keep;S.devices=kd;commit();recompute();});
    // 自訂器具的動作資料：存檔讀回
    S.tpls.cx={...cleanTpl({n:'自訂燈',w:20,h:20,terms:[{id:'J',x:5,y:5,side:'top'}],sim:[{k:'grp',t:'J',sub:['+','-']},{k:'load',a:'J.+',b:'J.-',name:'燈',polar:true},{k:'bad'}]})};
    ok(JSON.stringify(S.tpls.cx.sim)==='[{"k":"grp","t":"J","sub":["+","-"]},{"k":"load","a":"J.+","b":"J.-","name":"燈","polar":true}]','自訂器具動作資料：不合格的元素會被拿掉');
    // 模擬模式進出
    setMode('sim');ok(!!SIMST&&$('wires').classList.contains('simon'),'進入模擬模式');setMode('wire');ok(SIMST===null&&!$('wires').classList.contains('simon'),'離開模擬模式，狀態清掉');
    return out;
  });
  await b.close();
  res.forEach(l=>console.log(l));errs.forEach(e=>console.log('✗ 頁面錯誤：'+e));
  const fail=res.filter(l=>l.startsWith('✗')).length+errs.length;
  console.log(fail?`\n失敗 ${fail} 項`:'\n全部通過');process.exit(fail?1:0);
})();

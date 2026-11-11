// PLC 器具實際模擬檢查：每一種有輸入輸出動作資料的內建器具，真的接上電源和線跑模擬
// - 電源：AC 電源型接外部電源 R、S；DC 電源型接 DRL-120 的 +V1、−V1
// - 輸入：每組輸入共點接 DC24V 的一極，該組每個 X 接另一極（AC 輸入型接 AC），全部要 ON；拔掉共點那條線要全部 OFF
// - 輸出：每個 Y 逐點接一顆 MY2N 線圈，Y ON 時線圈要吸合、OFF 時不吸合
// 用法：node tests/plc-sim-check.js [只檢查 id 含這段文字的器具]
const {chromium}=require('playwright'),path=require('path');
(async()=>{
  const b=await chromium.launch(),p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+path.join(__dirname,'..','index.html'));
  const res=await p.evaluate(only=>{
    const bad=[];let n=0,nx=0,ny=0;
    Object.keys(TPL).forEach(id=>{const t=TPL[id];if(t.legacy||t.gen||(only&&!id.includes(only)))return;
      const sim=simElems({tpl:id});if(!sim.some(e=>e.k==='plcX'||e.k==='plcY'))return;n++;
      const pw=sim.find(e=>e.k==='pwr'),ac=pw&&pw.a==='L';
      const D=(i,tpl,x,y,sheet='plate')=>({id:i,tag:i,tpl,x,y,sheet});
      const build=()=>{S=normalize({box:{w:900,h:700,d:300,back:20},plate:{w:860,h:660},door:{w:900,h:700},
        devices:[D('PWR','field-power',0,-300,'field'),D('PS','drl120',20,20),D('P',id,120,20),D('KA','my2n-24',20,400)],ducts:[],glands:[],wires:[]}).state;resetUi();};
      let k=0;const W=(a,at,bb,bt)=>S.wires.push({id:'w'+(++k),no:'W'+k,a:{d:a,t:at},b:{d:bb,t:bt},wps:[],gauge:.75,color:'black'});
      const base=()=>{build();k=0;W('PWR','R','PS','L');W('PWR','S','PS','N');if(pw){if(ac){W('PWR','R','P',pw.a);W('PWR','S','P',pw.b);}else{W('PS','+V1','P',pw.a);W('PS','-V1','P',pw.b);}}};
      const run=()=>{recompute();return simRun();};
      // 輸入
      sim.filter(e=>e.k==='plcX').forEach(e=>{
        const acIn=/UA1/.test(t.n);
        base();const comW=acIn?W('PWR','S','P',e.com):W('PS','-V1','P',e.com);
        e.pts.forEach(x=>acIn?W('PWR','R','P',x):W('PS','+V1','P',x));
        simReset();let R=run();const nm=x=>{const g=cnSig(devOf('P'),x);return e.cpu?g:'P·'+g;}; // 連接器針腳用訊號名稱
        const off=e.pts.filter(x=>{const r=R.X.find(z=>z.name===nm(x));return !r||!r.on;});
        if(off.length)bad.push(`${id}：共點 ${e.com} 接好，${off.join(',')} 沒有 ON`);nx+=e.pts.length;
        S.wires=S.wires.filter(w=>!(w.b.d==='P'&&w.b.t===e.com));R=run();
        const on=e.pts.filter(x=>{const r=R.X.find(z=>z.name===nm(x));return r&&r.on;});
        if(on.length)bad.push(`${id}：拔掉共點 ${e.com}，${on.join(',')} 還是 ON`);});
      // 輸出
      sim.filter(e=>e.k==='plcY').forEach(e=>e.pairs.forEach(([y,com])=>{
        base();const src=/^\+V/.test(com);
        if(src){W('PS','+V1','P',com);W('P',y,'KA','14');W('KA','13','PS','-V1');}else{W('PS','-V1','P',com);W('P',y,'KA','14');W('KA','13','PS','+V1');}
        simReset();let R=run();const coil=()=>!!(R.dev.KA&&R.dev.KA.coil);
        if(coil())bad.push(`${id}：${y} 還沒 ON 線圈就吸合`);
        SIMST.y.add('P|'+y);R=run();if(!coil())bad.push(`${id}：${y} ON，接在 ${com} 的線圈沒有吸合`);
        if(R.shorts)bad.push(`${id}：${y} 測試出現短路`);ny++;}));
    });
    return {n,nx,ny,bad};
  },process.argv[2]||'');
  await b.close();
  res.bad.slice(0,60).forEach(l=>console.log('✗ '+l));if(res.bad.length>60)console.log(`…另外 ${res.bad.length-60} 項`);errs.forEach(e=>console.log('✗ 頁面錯誤：'+e));
  console.log(`\n檢查 ${res.n} 種 PLC 器具、${res.nx} 個輸入點、${res.ny} 個輸出點`+(res.bad.length||errs.length?`，${res.bad.length+errs.length} 項有問題`:'，全部通過'));
  process.exit(res.bad.length||errs.length?1:0);
})();

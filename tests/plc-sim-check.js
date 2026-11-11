// PLC 器具實際模擬檢查：每一種有輸入輸出動作資料的內建器具，真的接上電源和線跑模擬
// - 電源：AC 電源型接外部電源 R、S；DC 電源型接 DRL-120 的 +V1、−V1
// - 輸入：每組輸入共點接 DC24V 的一極，該組每個 X 接另一極（AC 輸入型接 AC），全部要 ON；拔掉共點那條線要全部 OFF
// - 輸出：每個 Y 逐點接一顆 MY2N 線圈，Y ON 時線圈要吸合、OFF 時不吸合
// - 沒有自己電源的模組（增設模組、轉接器、基板 I/O）：裝到對應的主機／基板（裝好電源模組）上測；要外部 24V 的也接上 24V
//   上游斷電（主機或電源模組的電拔掉）時，輸入要全部 OFF、輸出不動作
// - 串接供電：CPU → 有電源的擴展單元 → 模組，模組吃擴展單元的電
// 用法：node tests/plc-sim-check.js [只檢查 id 含這段文字的器具]
const {chromium}=require('playwright'),path=require('path');
(async()=>{
  const b=await chromium.launch(),p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+path.join(__dirname,'..','index.html'));
  const res=await p.evaluate(only=>{
    const bad=[];let n=0,nx=0,ny=0,nd=0;
    // 模組要裝的地方：串接找有自己電源的主機；插槽找同廠牌、有這種槽和電源槽的主基板，電源槽裝電源模組
    const live=id=>!TPL[id].legacy&&!TPL[id].gen;const pwrOf=id=>simElems({tpl:id}).find(e=>e.k==='pwr');const cache={};
    function mountOf(id){const t=TPL[id],key=t.chainKind?'c'+t.chainKind+JSON.stringify(t.chainFam):'r'+t.b+t.rackKind;if(key in cache)return cache[key];let r=null;
      if(t.chainKind){const h=Object.keys(TPL).find(h=>live(h)&&TPL[h].chain&&pwrOf(h)&&chainOk({tpl:h},{tpl:id}));
        if(h)r={devs:[['H',h]],host:'H',src:'H',pw:pwrOf(h),attach(){const m=devOf('P');m.on='H';m.chain=0;chainReflow(devOf('H'));}};}
      else{const PK=['pwr','rpwr','spwr'];const bs=Object.keys(TPL).find(h=>live(h)&&TPL[h].rack&&!TPL[h].cbHost&&!TPL[h].qext&&TPL[h].b===t.b&&TPL[h].rack.some(s=>s.k===t.rackKind)&&TPL[h].rack.some(s=>PK.includes(s.k)));
        const sk=bs&&TPL[bs].rack.find(s=>PK.includes(s.k)).k,pm=sk&&Object.keys(TPL).find(m=>live(m)&&TPL[m].rackKind===sk&&TPL[m].b===t.b&&pwrOf(m));
        if(bs&&pm)r={devs:[['B',bs],['PM',pm]],host:'B',src:'PM',pw:pwrOf(pm),attach(){const R=TPL[bs].rack,B=devOf('B'),M=devOf('PM'),P=devOf('P');M.on='B';M.rack=R.findIndex(s=>s.k===sk);P.on='B';P.rack=R.findIndex((s,i)=>rackFit(B,P,i));placeOn(M,B);placeOn(P,B);}};}
      return cache[key]=r;}
    Object.keys(TPL).forEach(id=>{const t=TPL[id];if(t.legacy||t.gen||(only&&!id.includes(only)))return;
      const sim=simElems({tpl:id});if(!sim.some(e=>e.k==='plcX'||e.k==='plcY'))return;n++;
      const pw=sim.find(e=>e.k==='pwr'),ac=pw&&pw.a==='L';
      const D=(i,tpl,x,y,sheet='plate')=>({id:i,tag:i,tpl,x,y,sheet});
      // 沒有自己電源的模組：找裝得上的主機（串接）或基板＋電源模組（插槽）
      const bus=!pw&&(t.chainKind||['io','cpu'].includes(t.rackKind)),ext=bus&&sim.find(e=>e.k==='load');
      const mount=bus?mountOf(id):null;if(bus&&!mount){bad.push(`${id}：找不到可以裝的主機或基板`);return;}
      const build=()=>{S=normalize({box:{w:900,h:700,d:300,back:20},plate:{w:860,h:660},door:{w:900,h:700},
        devices:[D('PWR','field-power',0,-300,'field'),D('PS','drl120',20,20),D('P',id,120,20),D('KA','my2n-24',20,400),...(mount?mount.devs.map(([i,tp])=>D(i,tp,300,300)):[])],ducts:[],glands:[],wires:[]}).state;resetUi();
        if(mount)mount.attach();};
      let k=0;const W=(a,at,bb,bt)=>S.wires.push({id:'w'+(++k),no:'W'+k,a:{d:a,t:at},b:{d:bb,t:bt},wps:[],gauge:.75,color:'black'});
      const feedP=(dev,e)=>{if(e.a==='L'){W('PWR','R',dev,e.a);W('PWR','S',dev,e.b);}else{W('PS','+V1',dev,e.a);W('PS','-V1',dev,e.b);}};
      const base=()=>{build();k=0;W('PWR','R','PS','L');W('PWR','S','PS','N');if(pw)feedP('P',pw);if(mount)feedP(mount.src,mount.pw);if(ext)feedP('P',ext);};
      const cut=()=>{S.wires=S.wires.filter(w=>!(mount?w.b.d===mount.src&&[mount.pw.a,mount.pw.b].includes(w.b.t):w.b.d==='P'&&pw&&[pw.a,pw.b].includes(w.b.t)));};
      const run=()=>{recompute();return simRun();};
      // 輸入
      sim.filter(e=>e.k==='plcX').forEach(e=>{
        const acIn=/UA1/.test(t.n);
        base();const comW=acIn?W('PWR','S','P',e.com):W('PS','-V1','P',e.com);
        e.pts.forEach(x=>acIn?W('PWR','R','P',x):W('PS','+V1','P',x));
        simReset();let R=run();const nm=x=>{const g=cnSig(devOf('P'),x);return e.cpu?g:'P·'+g;}; // 連接器針腳用訊號名稱
        const xr=x=>R.X.find(z=>z.d.id==='P'&&z.t===x);
        const off=e.pts.filter(x=>{const r=xr(x);return !r||!r.on;});
        if(off.length)bad.push(`${id}：共點 ${e.com} 接好，${off.join(',')} 沒有 ON`);nx+=e.pts.length;
        if(pw||mount){const keep=S.wires.slice();cut();R=run();const on=e.pts.filter(x=>{const r=xr(x);return r&&r.on;});
          if(on.length)bad.push(`${id}：${mount?`上游 ${mount.src}`:'本體'}電源拔掉，${on.slice(0,4).join(',')} 還是 ON`);else nd++;
          if(mount&&!(R.dev.P&&R.dev.P.nopwr))bad.push(`${id}：上游沒電，模組沒有標示沒電`);S.wires=keep;}
        if(mount){R=run();if(!(R.dev.P&&R.dev.P.on.length)&&!ext)bad.push(`${id}：裝在有電的 ${mount.host} 上，模組沒亮`);}
        S.wires=S.wires.filter(w=>!(w.b.d==='P'&&w.b.t===e.com));R=run();
        const on=e.pts.filter(x=>{const r=xr(x);return r&&r.on;});
        if(on.length)bad.push(`${id}：拔掉共點 ${e.com}，${on.join(',')} 還是 ON`);});
      // 輸出
      sim.filter(e=>e.k==='plcY').forEach(e=>e.pairs.forEach(([y,com])=>{
        base();const src=/^\+V/.test(com);
        if(src){W('PS','+V1','P',com);W('P',y,'KA','14');W('KA','13','PS','-V1');}else{W('PS','-V1','P',com);W('P',y,'KA','14');W('KA','13','PS','+V1');}
        simReset();let R=run();const coil=()=>!!(R.dev.KA&&R.dev.KA.coil);
        if(coil())bad.push(`${id}：${y} 還沒 ON 線圈就吸合`);
        SIMST.y.add('P|'+y);R=run();if(!coil())bad.push(`${id}：${y} ON，接在 ${com} 的線圈沒有吸合`);
        if(R.shorts)bad.push(`${id}：${y} 測試出現短路`);ny++;
        if(pw||mount){cut();R=run();if(coil())bad.push(`${id}：${mount?`上游 ${mount.src}`:'本體'}電源拔掉，${y} 的線圈還是吸合`);else nd++;}}));
    });
    // 串接供電：FX5U → FX5-32ER/ES（有自己的電源）→ FX5-16EX/ES，16EX 吃 32ER 的電
    {S=normalize({box:{w:900,h:700,d:300,back:20},plate:{w:860,h:660},door:{w:900,h:700},ducts:[],glands:[],wires:[],
      devices:[{id:'PWR',tag:'PWR',tpl:'field-power',x:0,y:-300,sheet:'field'},{id:'PS',tag:'PS',tpl:'drl120',x:20,y:20,sheet:'plate'},{id:'C',tag:'C',tpl:'fx5u32',x:100,y:300,sheet:'plate'},
        {id:'U',tag:'U',tpl:'fx5-32er-es',x:0,y:0,sheet:'plate',on:'C',chain:0},{id:'M',tag:'M',tpl:'fx516ex',x:0,y:0,sheet:'plate',on:'C',chain:1}]}).state;resetUi();chainReflow(devOf('C'));
     let k=0;const W=(a,at,bb,bt)=>S.wires.push({id:'v'+(++k),no:'V'+k,a:{d:a,t:at},b:{d:bb,t:bt},wps:[],gauge:.75,color:'black'});
     const pc=pwrOf('fx5u32'),pu=pwrOf('fx5-32er-es'),xe=simElems({tpl:'fx516ex'}).find(e=>e.k==='plcX');
     W('PWR','R','PS','L');W('PWR','S','PS','N');W('PS','-V1','M',xe.com);W('PS','+V1','M',xe.pts[0]);
     const P=(d,e,on)=>{S.wires=S.wires.filter(w=>w.b.d!==d||![e.a,e.b].includes(w.b.t));if(on){if(e.a==='L'){W('PWR','R',d,e.a);W('PWR','S',d,e.b);}else{W('PS','+V1',d,e.a);W('PS','-V1',d,e.b);}}recompute();simReset();return simRun();};
     const xon=R=>R.X.some(x=>x.d.id==='M'&&x.t===xe.pts[0]&&x.on);
     let R=P('C',pc,true);R=P('U',pu,true);if(!xon(R))bad.push('串接供電：CPU 和 32ER 都有電，16EX 輸入沒 ON');
     R=P('C',pc,false);if(!xon(R))bad.push('串接供電：只有 CPU 斷電，16EX 吃 32ER 的電，輸入應該照常');
     R=P('U',pu,false);R=P('C',pc,true);if(xon(R)||!(R.dev.M&&R.dev.M.nopwr))bad.push('串接供電：32ER 沒電時，後面的 16EX 應該沒電');
     // CPU 本身沒電：CPU 的輸入不亮
     const cx=simElems({tpl:'fx5u32'}).find(e=>e.k==='plcX');W('PS','-V1','C',cx.com);W('PS','+V1','C',cx.pts[0]);R=P('C',pc,false);
     if(R.X.some(x=>x.d.id==='C'&&x.on))bad.push('CPU 沒電，CPU 的輸入還是 ON');R=P('C',pc,true);if(!R.X.some(x=>x.d.id==='C'&&x.t===cx.pts[0]&&x.on))bad.push('CPU 有電，CPU 的輸入沒 ON');}
    return {n,nx,ny,nd,bad};
  },process.argv[2]||'');
  await b.close();
  res.bad.slice(0,60).forEach(l=>console.log('✗ '+l));if(res.bad.length>60)console.log(`…另外 ${res.bad.length-60} 項`);errs.forEach(e=>console.log('✗ 頁面錯誤：'+e));
  console.log(`\n檢查 ${res.n} 種 PLC 器具、${res.nx} 個輸入點、${res.ny} 個輸出點、${res.nd} 項斷電檢查`+(res.bad.length||errs.length?`，${res.bad.length+errs.length} 項有問題`:'，全部通過'));
  process.exit(res.bad.length||errs.length?1:0);
})();

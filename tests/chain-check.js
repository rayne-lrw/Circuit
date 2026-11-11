// 串接檢查：擴充模組拖到主機右邊會一台貼一台串起來、左側轉接器串在左邊；插到中間、拆下、刪除會重新排；
// 移動主機整串跟著動；位址依串接順序自動編號（FX5／FX3U 8 進位）；存檔讀回；模擬用實際位址
// 用法：node tests/chain-check.js
const {chromium}=require('playwright'),path=require('path');
(async()=>{
  const b=await chromium.launch(),p=await b.newPage({viewport:{width:1400,height:900}});
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+path.join(__dirname,'..','index.html'));
  const res=await p.evaluate(()=>{
    const out=[],ok=(c,m)=>out.push((c?'✓ ':'✗ ')+m);
    const D=(id,tpl,x,y,ex={})=>({id,tag:id,tpl,x,y,sheet:'plate',...ex});
    S=normalize({box:{w:1400,h:900,d:300,back:20},plate:{w:1360,h:860},door:{w:900,h:700},ducts:[],glands:[],wires:[],
      devices:[D('PWR','field-power',0,-300,{sheet:'field'}),D('PS','drl120',1200,600),D('C','fx5u-32mr-es',100,100),D('M1','fx5-16er-es',600,500),D('M2','fx5-8ex-es',700,500),D('M3','fx5-8eyt-es',800,500),D('AD','fx54ad',900,500),D('KA','my2n-24',1000,600)]}).state;resetUi();
    const dv=id=>devOf(id),C=dv('C'),CT=tplOf(C);
    const drop=(id,x)=>{const o=dv(id),t=tplOf(o);return hostSnap(o,x-t.w/2,C.y+10);};
    ok(drop('M1',C.x+CT.w+10)==='C','FX5-16ER/ES 拖到主機右邊：串上');
    ok(dv('M1').x===C.x+CT.w&&dv('M1').y===C.y,'貼齊主機右緣、上緣對齊');
    drop('M2',dv('M1').x+tplOf(dv('M1')).w+10);ok(dv('M2').on==='C'&&dv('M2').x===dv('M1').x+tplOf(dv('M1')).w,'第二台接在第一台後面');
    ok(termLabel(dv('M1'),'X0')==='X20'&&termLabel(dv('M1'),'Y7')==='Y27','第 1 台 16ER：X20～X27、Y20～Y27（主機 X0～X17、Y0～Y17 之後）');
    ok(termLabel(dv('M2'),'X0')==='X30','第 2 台 8EX：X30～X37');
    // 插到中間：8EYT 插在主機和 16ER 之間
    drop('M3',C.x+CT.w+5);ok(dv('M3').chain===0&&dv('M1').chain===1&&dv('M2').chain===2,'插到最前面：順序重新排');
    ok(dv('M3').x===C.x+CT.w&&dv('M1').x===C.x+CT.w+tplOf(dv('M3')).w,'插入後後面的模組往右移');
    ok(termLabel(dv('M3'),'Y0')==='Y20'&&termLabel(dv('M1'),'Y0')==='Y30'&&termLabel(dv('M1'),'X0')==='X20','位址跟著順序變：8EYT Y20～、16ER Y30～、X20～');
    // 左側轉接器
    const ad=dv('AD'),at=tplOf(ad);hostSnap(ad,C.x-at.w-5,C.y+10);ok(ad.on==='C'&&ad.x===C.x-at.w,'類比轉接器拖到主機左邊：貼齊左緣');
    // 移動主機
    const ox=dv('M2').x;C.x+=50;riders(C).forEach(r=>placeOn(r,C));ok(dv('M2').x===ox+50&&ad.x===C.x-at.w,'移動主機：兩邊的串接一起移動');
    // 拖離
    const m3=dv('M3');hostSnap(m3,900,700);ok(!m3.on&&dv('M1').chain===0&&dv('M1').x===C.x+CT.w,'拖離：拆下，後面的模組往左補位');
    ok(termLabel(dv('M1'),'Y0')==='Y20','拆下後位址重算');
    // 存檔讀回
    commit();const n2=normalize(JSON.parse(JSON.stringify(S))).state;ok(['M1','M2','AD'].every(id=>{const a=n2.devices.find(d=>d.id===id);return a.on==='C'&&a.chain===dv(id).chain;}),'存檔讀回：串接順序保留');
    // 刪除中間那台
    picked={k:'dev',id:'M1'};setMode('place');picked={k:'dev',id:'M1'};deleteSel&&deleteSel();recompute();ok(dv('M2').chain===0&&dv('M2').x===C.x+CT.w,'刪除第一台：後面的往前補');
    $('undo').click();ok(!!dv('M1'),'可以復原');
    // 模擬：8EX 的 X3（實際 X33）
    let k=0;const W=(a,at2,bb,bt)=>S.wires.push({id:'c'+(++k),no:'C'+k,a:{d:a,t:at2},b:{d:bb,t:bt},wps:[],gauge:.75,color:'black'});
    W('PWR','R','C','L');W('PWR','S','C','N');W('PWR','R','PS','L');W('PWR','S','PS','N');W('PS','-V1','M2','S/S');W('PS','+V1','M2','X3');
    W('PS','-V1','M1','COM');W('M1','Y5','KA','14');W('KA','13','PS','+V1');
    commit();recompute();simReset();let r=simRun();
    ok(r.X.some(x=>x.name==='M2·X3'||x.name==='X33')&&r.X.some(x=>x.name==='X33'&&x.on),'模擬：第 2 台 8EX 的 X3 → 實際 X33 ON');
    SIMST.y.add('M1|Y5');r=simRun();ok(r.Y.some(y=>y.name==='Y25')&&r.dev.KA&&r.dev.KA.coil,'模擬：第 1 台 16ER 的 Y5 → 實際 Y25 ON，繼電器吸合');
    // FX3U：FX2N 擴展模塊
    S=normalize({box:{w:1400,h:900,d:300,back:20},plate:{w:1360,h:860},door:{w:900,h:700},ducts:[],glands:[],wires:[],
      devices:[D('C3','fx3u-32mr-es',100,100),D('N1','fx2n-8er-es-ul',600,500),D('N2','fx2n-16eyr',700,500)]}).state;resetUi();
    const c3=dv('C3'),w3=tplOf(c3).w;hostSnap(dv('N1'),c3.x+w3+5,c3.y+10);hostSnap(dv('N2'),dv('N1').x+tplOf(dv('N1')).w+5,c3.y+10);
    ok(termLabel(dv('N1'),'X0')==='X20'&&termLabel(dv('N1'),'Y0')==='Y20','FX3U-32M ＋ FX2N-8ER：X20～、Y20～');
    ok(termLabel(dv('N2'),'Y0')==='Y30'&&termLabel(dv('N2'),'Y17')==='Y47','再接 FX2N-16EYR：8ER 佔 8 點後 Y30～Y47');
    ok(!chainOk(c3,{tpl:'fx5-8ex-es'}),'FX5 的模組不能接到 FX3U');
    return out;
  });
  await b.close();
  res.forEach(l=>console.log(l));errs.forEach(e=>console.log('✗ 頁面錯誤：'+e));
  const fail=res.filter(l=>l.startsWith('✗')).length+errs.length;
  console.log(fail?`\n失敗 ${fail} 項`:'\n全部通過');process.exit(fail?1:0);
})();

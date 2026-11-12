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
    // 台達 DVP：主機起始位址（擴充模組手冊還沒做，用測試用的暫時模組驗證規則）
    TPL['t-dvp8']={...TPL['fx5-8ex-es'],id:'t-dvp8',chainKind:'r',chainFam:'dvp-s'};TPL['t-dvp8e']={...TPL['fx5-8ex-es'],id:'t-dvp8e',chainKind:'r',chainFam:'dvp-e'};
    S=normalize({box:{w:1400,h:900,d:300,back:20},plate:{w:1360,h:860},door:{w:900,h:700},ducts:[],glands:[],wires:[],
      devices:[D('SV','dvp28sv311t',100,100),D('E1','t-dvp8',600,500),D('ES','dvp48es300r',100,400),D('E2','t-dvp8e',600,600),D('E3','t-dvp8e',700,600)]}).state;resetUi();
    const sv=dv('SV');hostSnap(dv('E1'),sv.x+tplOf(sv).w+5,sv.y+10);ok(dv('E1').on==='SV'&&termLabel(dv('E1'),'X0')==='X20','DVP28SV3 右側擴充：從 X20 開始（手冊 5.2）');
    const es=dv('ES');hostSnap(dv('E2'),es.x+tplOf(es).w+5,es.y+10);hostSnap(dv('E3'),dv('E2').x+tplOf(dv('E2')).w+5,es.y+10);
    ok(termLabel(dv('E2'),'X0')==='X30'&&termLabel(dv('E3'),'X0')==='X40','DVP48ES3（X0～X27）：擴充從 X30 開始，第二台 X40');
    ok(!chainOk(sv,{tpl:'t-dvp8e'})&&!chainOk(es,{tpl:'fx5-8ex-es'}),'磚型模組不能接薄型、FX5 模組不能接 DVP');
    delete TPL['t-dvp8'];delete TPL['t-dvp8e'];
    // 台達 AS：字.位元位址，依連接順序；類比模組不佔 X／Y；左側電源模組供電給主機
    S=normalize({box:{w:1400,h:900,d:300,back:20},plate:{w:1360,h:860},door:{w:900,h:700},ducts:[],glands:[],wires:[],
      devices:[D('PWR','field-power',0,-300,{sheet:'field'}),D('PS','drl120',1200,600),D('KA','my2n-24',1000,600),D('A','as332t-a',200,100),D('P1','as-ps02',600,500),
        D('I1','as16am10n-a',600,600),D('AD','as04ad-a',700,600),D('O1','as32an02t-a',800,600),D('I2','as08am10n-a',900,600)]}).state;resetUi();
    const A=dv('A'),snapR=id=>{const l=chainOf(A,'r'),last=l.length?l[l.length-1]:A,lx=last.x+tplOf(last).w;hostSnap(dv(id),lx+5,A.y+10);};
    ['I1','AD','O1','I2'].forEach(snapR);ok(['I1','AD','O1','I2'].every(id=>dv(id).on==='A'),'AS 模組依序串上 AS332T');
    ok(termLabel(dv('I1'),'X0.3')==='X1.3'&&termLabel(dv('I1'),'X0.15')==='X1.15','AS16AM10N（第 1 台）：印字 3 → X1.3（主機佔 X0.x）');
    ok(termLabel(dv('O1'),'Y0.5')==='Y1.5'&&termLabel(dv('O1'),'Y1.15')==='Y2.15','AS32AN02T：Y1.0～Y2.15（主機佔 Y0.x、類比模組不佔）');
    ok(termLabel(dv('I2'),'X0.0')==='X2.0','AS08AM10N 接在 16 點輸入後面：X2.0（8 點也佔 1 個字）');
    ok(termLabel(dv('AD'),'V1+')==='V1+','類比模組接點不換名');
    hostSnap(dv('P1'),A.x-tplOf(dv('P1')).w-5,A.y+10);ok(dv('P1').on==='A'&&dv('P1').x===A.x-tplOf(dv('P1')).w,'AS-PS02 拖到主機左邊：串上');
    ok(!chainOk(A,{tpl:'fx5-8ex-es'})&&!chainOk(dv('PS'),{tpl:'as16am10n-a'}),'FX5 模組不能接 AS、AS 模組不能接一般器具');
    k=100;W('PWR','R','P1','L');W('PWR','S','P1','N');W('PWR','R','PS','L');W('PWR','S','PS','N');
    W('PS','-V1','I1','S/S');W('PS','+V1','I1','X0.3');W('PS','-V1','O1','CN1.C0');W('O1','CN1.Y0.5','KA','14');W('KA','13','PS','+V1');
    commit();recompute();simReset();r=simRun();ok(r.X.some(x=>x.name==='X1.3'&&x.on),'模擬：AS16AM10N 的 3 → X1.3 ON');
    SIMST.y.add('O1|CN1.Y0.5');r=simRun();ok(r.Y.some(y=>y.name==='Y1.5')&&r.dev.KA&&r.dev.KA.coil,'模擬：Y1.5 ON，繼電器吸合');
    // 主機本身的輸出：主機 24V 沒接線，靠左側 AS-PS02 供電
    W('O1','CN1.Y0.5','PS','-V1');S.wires=S.wires.filter(w=>!(w.a.d==='O1'&&w.a.t==='CN1.Y0.5'&&w.b.d==='PS'));
    W('PS','-V1','A','CN1.C0');W('A','CN1.Y0.2','KA','14');S.wires=S.wires.filter(w=>!(w.a.d==='O1'&&w.b.d==='KA'));commit();recompute();simReset();SIMST.y.add('A|CN1.Y0.2');r=simRun();
    ok(r.dev.KA&&r.dev.KA.coil,'AS332T 只靠 AS-PS02 供電：主機 Y0.2 ON，繼電器吸合');
    S.wires=S.wires.filter(w=>w.a.d!=='P1'&&w.b.d!=='P1');commit();recompute();simReset();SIMST.y.add('A|CN1.Y0.2');r=simRun();ok(!(r.dev.KA&&r.dev.KA.coil),'電源模組沒電：主機輸出不動作');
    // AX-3 主機也接 AS 模組
    S=normalize({box:{w:1400,h:900,d:300,back:20},plate:{w:1360,h:860},door:{w:900,h:700},ducts:[],glands:[],wires:[],
      devices:[D('X3','ax-308ea0ma1t',100,100),D('N1','as16an01r-a',600,500)]}).state;resetUi();
    hostSnap(dv('N1'),dv('X3').x+tplOf(dv('X3')).w+5,dv('X3').y+10);ok(dv('N1').on==='X3'&&termLabel(dv('N1'),'Y0.9')==='Y1.9','AX-308E ＋ AS16AN01R：Y1.0～Y1.15');
    // 舊檔：串接功能之前貼齊主機擺好的模組（沒有 on），讀檔時自動串上；沒貼齊、族別不對的不動
    {const w=TPL.fx5u32.w,n=normalize({box:{w:900,h:700,d:300,back:20},plate:{w:860,h:660},door:{w:900,h:700},ducts:[],glands:[],wires:[],
      devices:[D('C','fx5u32',100,100),D('M1','fx516ex',100+w,100),D('M2','fx540ssc',100+w+TPL.fx516ex.w,100),D('M3','fx516ex',600,100),D('A','fx54ad',100-TPL.fx54ad.w,100),D('Q','fx3u-4ad',100+w+TPL.fx516ex.w+TPL.fx540ssc.w,100)]}).state;
     const g=id=>n.devices.find(d=>d.id===id);
     ok(g('M1').on==='C'&&g('M1').chain===0&&g('M2').on==='C'&&g('M2').chain===1,'舊檔貼齊的 16EX、40SSC 讀檔後串到主機右邊（順序 0、1）');
     ok(g('A').on==='C','貼在主機左邊的 4AD-ADP 串成左側轉接器');ok(!g('M3').on,'沒貼齊的模組不串');ok(!g('Q').on,'族別不對（FX3U 模組）不串');
     }
    return out;
  });
  await b.close();
  res.forEach(l=>console.log(l));errs.forEach(e=>console.log('✗ 頁面錯誤：'+e));
  const fail=res.filter(l=>l.startsWith('✗')).length+errs.length;
  console.log(fail?`\n失敗 ${fail} 項`:'\n全部通過');process.exit(fail?1:0);
})();

// 底座插槽檢查（三菱 Q 系列）：模組吸到槽位、槽種類限制、佔用、跟著基板移動、I/O 位址依槽位自動編號、
// 槽位表、從槽位表裝模組、存檔讀回、深度、模擬名稱與動作
// 用法：node tests/rack-check.js
const {chromium}=require('playwright'),path=require('path');
(async()=>{
  const b=await chromium.launch(),p=await b.newPage({viewport:{width:1400,height:900}});
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+path.join(__dirname,'..','index.html'));
  const res=await p.evaluate(()=>{setMode('wire'); // 打開時是檢視模式；這裡要編輯
    const out=[],ok=(c,m)=>out.push((c?'✓ ':'✗ ')+m);
    const D=(id,tpl,x,y,sheet='plate')=>({id,tag:id,tpl,x,y,sheet});
    S=normalize({box:{w:900,h:700,d:300,back:20},plate:{w:860,h:660},door:{w:900,h:700},ducts:[],glands:[],wires:[],
      devices:[D('PWR','field-power',0,-300,'field'),D('B','q35b',100,100),D('P','q61p',600,400),D('C','q03udvcpu',650,400),D('X1','qx40',700,400),D('Y1','qy10',740,400),D('X2','qx40',780,400),D('PS','drl120',20,400)]}).state;resetUi();
    const dv=id=>devOf(id),B=dv('B'),R=tplOf(B).rack;
    const drop=(id,slot)=>{const o=dv(id),t=tplOf(o),s=R[slot];return hostSnap(o,B.x+s.x,B.y+(tplOf(B).h-t.h)/2);};
    ok(R.length===7&&R[0].k==='pwr'&&R[1].k==='cpu'&&R.slice(2).every(s=>s.k==='io'),'Q35B：電源槽、CPU 槽、5 個 I/O 槽');
    ok(R.every(s=>s.x>=0&&s.x+s.w<=tplOf(B).w+.01),'槽位都在基板裡');
    drop('P',0);drop('C',1);
    ok(dv('P').on==='B'&&dv('P').rack===0&&dv('P').x===B.x+R[0].x,'電源模組吸到電源槽');
    ok(dv('C').on==='B'&&dv('C').rack===1,'CPU 吸到 CPU 槽');
    drop('X1',2+1);drop('Y1',2+1);
    ok(dv('X1').rack===3,'QX40 放到 1 槽');
    ok(dv('Y1').on==='B'&&dv('Y1').rack!==3,'1 槽被佔用：QY10 改裝到最近的空槽（'+rackName(tplOf(B),dv('Y1').rack)+'）');
    const y1=dv('Y1');y1.x=600;y1.y=400;hostSnap(y1,600,400);ok(!y1.on&&y1.rack==null,'拖離基板就拆下');
    drop('Y1',2+0);ok(dv('Y1').rack===2,'QY10 放到 0 槽');
    // 槽種類限制：I/O 模組不能進電源槽／CPU 槽
    const bad=JSON.parse(JSON.stringify(dv('X2')));ok(!rackFit(B,bad,0)&&!rackFit(B,bad,1),'I/O 模組不能裝在電源槽、CPU 槽');
    ok(!rackFit(B,{...JSON.parse(JSON.stringify(dv('P'))),id:'P2'},0),'電源槽已佔用：第二台電源放不進去');
    drop('X2',2+3);recompute();
    // 位址：0 槽 QY10 Y00～0F、1 槽 QX40 X10～1F、2 槽空（20～2F）、3 槽 QX40 X30～3F
    ok(qName(dv('Y1'),'Y00')==='Y00'&&qName(dv('Y1'),'Y0F')==='Y0F','0 槽 QY10：Y00～Y0F');
    ok(qName(dv('X1'),'X00')==='X10'&&qName(dv('X1'),'X0F')==='X1F','1 槽 QX40：X10～X1F');
    ok(qName(dv('X2'),'X00')==='X30','3 槽 QX40：前面有空槽（算 16 點），從 X30 開始');
    ok(termLabel(dv('X1'),'X05')==='X15','圖上接點顯示實際位址（X05 → X15）');
    ok(qName(dv('P'),'L')===null&&termLabel(dv('P'),'L')==='L','電源模組的接點不換名稱');
    // 跟著基板移動
    const ox=dv('X1').x;carried(B).forEach(d=>{d.x+=20;});B.x+=20;riders(B).forEach(r=>placeOn(r,B));
    ok(dv('X1').x===ox+20&&dv('X1').rack===3,'移動基板：模組跟著移動、留在原槽');
    ok(effDepth(B)===115,'基板整體深度取模組最深的（Q03UDV 115 mm）');
    // 存檔讀回
    const n2=normalize(JSON.parse(JSON.stringify(S))).state;
    ok(['P','C','X1','Y1','X2'].every(id=>{const a=n2.devices.find(d=>d.id===id),o=dv(id);return a.on==='B'&&a.rack===o.rack;}),'存檔讀回：模組留在原本的槽');
    // 槽位表
    commit();recompute();picked={k:'dev',id:'B'};renderDetail();
    const rows=[...document.querySelectorAll('#detail .rack-tb tbody tr')];
    ok(rows.length===7,'槽位表列出 7 槽');
    ok(/X1/.test(rows[3].textContent)&&/10～1F/.test(rows[3].textContent),'槽位表：1 槽是 X1、位址 10～1F');
    ok(/20～2F/.test(rows[4].textContent)&&!!rows[4].querySelector('select'),'槽位表：2 槽空、位址 20～2F、可以選模組');
    const sel=rows[4].querySelector('select');sel.value='qx40';sel.dispatchEvent(new Event('change'));
    const nw=S.devices.find(d=>d.tpl==='qx40'&&d.rack===4);ok(!!nw&&nw.on==='B','從槽位表選 QX40 裝到 2 槽');
    ok(qName(dv('X2'),'X00')==='X30'&&qName(nw,'X00')==='X20','裝上後位址照樣依槽位');
    $('undo').click();ok(!S.devices.some(d=>d.tpl==='qx40'&&d.rack===4),'可以復原');
    // 模組的詳細資料
    picked={k:'dev',id:'X1'};renderDetail();ok(/1 槽/.test($('detail').textContent)&&/10～1F/.test($('detail').textContent),'模組詳細資料顯示槽位與位址');
    // 器具庫：選取基板時點模組，直接裝到第一個空槽
    setMode('place');picked={k:'dev',id:'B'};const btn=document.querySelector('#palette [data-add="qy10"]');
    if(btn){btn.click();const k=S.devices.find(d=>d.tpl==='qy10'&&d.id!=='Y1');ok(k&&k.on==='B'&&k.rack===4,'選取基板時點器具庫的 QY10：裝到第一個空槽（2 槽）');S.devices=S.devices.filter(d=>d!==k);}
    else ok(false,'器具庫找不到 QY10 按鈕');
    // 模擬：AC → Q61P；24V：PS +V1 → X1 的 X05、COM → −V1；Y1 的 Y03 → 繼電器
    let k=0;const W=(a,at,bb,bt)=>S.wires.push({id:'w'+(++k),no:'W'+k,a:{d:a,t:at},b:{d:bb,t:bt},wps:[],gauge:.75,color:'black'});
    S.devices.push(D('KA','my2n-24',400,400));
    W('PWR','R','P','L');W('PWR','S','P','N');W('PWR','R','PS','L');W('PWR','S','PS','N');
    W('PS','+V1','X1','X05');W('PS','-V1','X1','COM');W('PS','-V1','Y1','COM');W('Y1','Y03','KA','14');W('KA','13','PS','+V1');
    commit();recompute();simReset();let r=simRun();
    ok(r.X.some(x=>x.name==='X15'&&x.on),'模擬：輸入清單用實際位址，X15 ON');
    ok(r.Y.some(y=>y.name==='Y03'),'模擬：輸出清單用實際位址 Y03');
    SIMST.y.add('Y1|Y03');r=simRun();ok(r.dev.KA&&r.dev.KA.coil,'模擬：Y03 ON，繼電器吸合');
    ok(/W\d+/.test(epText({d:'X1',t:'X05'}))||/X15/.test(epText({d:'X1',t:'X05'})),'線的端點文字：'+epText({d:'X1',t:'X05'}));
    // ---------- 全型號：超薄型、冗餘電源、擴展基板位址、一體型 CPU、64 點模組、排線轉接座 ----------
    const D2=(id,tpl,x,y,ex={})=>({id,tag:id,tpl,x,y,sheet:'plate',...ex});
    S=normalize({box:{w:1400,h:900,d:300,back:20},plate:{w:1360,h:860},door:{w:900,h:700},ducts:[],glands:[],wires:[],
      devices:[D2('PWR','field-power',0,-300,{sheet:'field'}),D2('M','q38b',40,40),D2('E1','q65b',40,200),D2('E2','q55b',40,360),D2('SB','q35sb',500,360),D2('RB','q38rb',700,40),D2('J','q00jcpu',700,200),
        D2('PS','drl120',1200,500),D2('A1','a6tbxy36',600,600),D2('A2','a6tbx36-e',800,600)]}).state;resetUi();
    const put=(id,tpl,host,rack)=>{const d=D2(id,tpl,0,0,{on:host,rack});S.devices.push(d);placeOn(d,devOf(host));return d;};
    put('MP','q61p','M',0);put('MC','q06udvcpu','M',1);const m1=put('MX','qx42','M',2);put('MY','qy10','M',3);
    put('EP','q61p','E1',0);const e1=put('EX','qx40','E1',1);const e2=put('EX2','qy41p','E2',0);
    ok(qAddr(m1).start===0&&qAddr(m1).n===64,'主基板 0 槽 QX42：64 點 X00～X3F');
    ok(qAddr(dv('MY')).start===0x40,'主基板 1 槽 QY10：64 點模組後面，從 40 開始');
    // 主基板 8 槽：0 槽 64、1 槽 16、其他 6 槽空 → 64+16+96=176=0xB0
    ok(qBasePts(dv('M'))===176,'主基板總點數 176（空槽算 16）');
    ok(qStage(dv('E1'))===1&&qStage(dv('E2'))===2,'擴展級數依順序自動 1、2');
    ok(qAddr(e1).start===0xB0,'擴展第 1 級 0 槽 QX40：接在主基板後面，從 B0 開始');
    ok(qAddr(e2).start===0xB0+16*5,'擴展第 2 級 0 槽 QY41P：從 100 開始（'+qHex(qAddr(e2).start)+'）');
    dv('E2').stage=1;dv('E1').stage=2;ok(qAddr(e2).start===0xB0&&qAddr(e1).start===0xB0+80+16,'改擴展級數：位址跟著換順序');
    ok(qName(e2,'Y00')==='YB0','擴展基板模組接點名稱也換成實際位址（Y00 → YB0）');
    // 超薄型基板：只能裝 Q61SP
    ok(!rackFit(dv('SB'),{tpl:'q61p',id:'x'},0)&&rackFit(dv('SB'),{tpl:'q61sp',id:'y'},0),'超薄型基板電源槽：Q61P 不能裝，Q61SP 可以');
    // 冗餘電源基板：兩個冗餘電源槽
    put('R1','q64rp','RB',0);put('R2','q64rp','RB',1);ok(dv('R1').rack===0&&dv('R2').rack===1&&rackName(tplOf(dv('RB')),1)==='電源2','Q38RB：兩台冗餘電源裝在電源1、電源2');
    ok(!rackFit(dv('RB'),{tpl:'q61p',id:'z'},0),'冗餘電源槽不能裝一般電源模組');
    // 一體型 CPU：5 個 I/O 槽、自己的電源端子
    const jx=put('JX','qx40','J',0);ok(qAddr(jx).start===0&&tplOf(dv('J')).rack.length===5,'Q00JCPU：5 個 I/O 槽，0 槽從 X00 開始');
    ok(simElems(dv('J')).some(e=>e.k==='pwr'),'Q00JCPU 有電源動作資料');
    // 排線轉接座：A6TBXY36 接 QX42 連接器 1
    recompute();picked={k:'dev',id:'A1'};renderDetail();
    const btns=[...document.querySelectorAll('#detail [data-ribbon]')].map(b=>b.dataset.ribbon);
    ok(btns.includes('MX|1|1')&&btns.includes('MX|2|1')&&btns.includes('EX2|1|1'),'A6TBXY36 列出可接的 40 針連接器（QX42 兩個、QY41P）');
    ok(!btns.some(b=>b.startsWith('A2')),'不列 D-sub 的轉接座');
    document.querySelector('#detail [data-ribbon="MX|1|1"]').click();
    // 排線：兩個連接器之間一條線（連接器在圖上只算一個接點，針腳收在裡面）
    const rc=S.wires.find(w=>w.ribbon);
    ok(rc&&rc.a.d==='MX'&&rc.a.t==='CN1'&&rc.b.d==='A1'&&rc.b.t==='CN1'&&!S.cables.length,'接排線：一條線從 QX42 的 CN1 接到 A6TBXY36 的 CN1');
    ok(cnWhole(devOf('MX'),'CN1').keys.length===34,'QX42 連接器 1 有 34 支針腳（32 點＋2 個 COM）');
    ok(adpAuto(devOf('A1'),'5')==='X05','轉接座端子 5 經排線對應實際位址 X05');
    const n3=normalize(JSON.parse(JSON.stringify(S))).state;ok(n3.wires.some(w=>w.ribbon&&w.id===rc.id),'排線存檔讀回');
    document.querySelector('#detail [data-ribbon="MX|1|1"]')&&document.querySelector('#detail [data-ribbon="MX|1|1"]').click();
    ok(S.wires.filter(w=>w.ribbon).length===1,'同一組不會重複接排線');
    // 模擬穿過轉接座：24V → 轉接座端子 5，0V… QX42 正公共端：COM1 接 +24V，X 接 0V 就 ON
    let kk=0;const W2=(a,at,bb,bt)=>S.wires.push({id:'v'+(++kk),no:'V'+kk,a:{d:a,t:at},b:{d:bb,t:bt},wps:[],gauge:.75,color:'black'});
    W2('PWR','R','PS','L');W2('PWR','S','PS','N');W2('PWR','R','MP','L');W2('PWR','S','MP','N');W2('PS','+V1','A1','24V');W2('PS','-V1','A1','5');
    commit();recompute();simReset();let r2=simRun();
    ok(r2.X.some(x=>x.name==='X05'&&x.on),'模擬：轉接座端子 5 接 0V、24V 接 +24V → QX42 的 X05 ON（穿過排線與轉接座）');
    ok(!r2.X.some(x=>x.name==='X06'&&x.on),'沒接的 X06 是 OFF');
    // D-sub 轉接座接 QY81P
    const yp=put('MY2','qy81p','M',4);recompute();picked={k:'dev',id:'A2'};renderDetail();
    const b2=document.querySelector('#detail [data-ribbon="MY2|1|1"]');ok(!!b2,'A6TBX36-E 列出 QY81P（37 針 D-sub）');
    // 電源模組模擬：AC 進來就有電；Q62P 另外有 24V 輸出；Q63P 是直流輸入（極性）
    S=normalize({box:{w:900,h:700,d:300,back:20},plate:{w:860,h:660},door:{w:900,h:700},ducts:[],glands:[],wires:[],
      devices:[D2('PWR','field-power',0,-300,{sheet:'field'}),D2('PS','drl120',600,400),D2('B1','q35b',20,20),D2('B2','q65b',20,200),D2('KA','my2n-24',400,400)]}).state;resetUi();
    put('P62','q62p','B1',0);put('P63','q63p','B2',0);
    let k3=0;const W3=(a,at,bb,bt)=>S.wires.push({id:'p'+(++k3),no:'P'+k3,a:{d:a,t:at},b:{d:bb,t:bt},wps:[],gauge:.75,color:'black'});
    W3('PWR','R','P62','L');W3('PWR','S','P62','N');W3('PWR','R','PS','L');W3('PWR','S','PS','N');W3('PS','+V1','P63','+24V');W3('PS','-V1','P63','24G');
    W3('P62','+24V','KA','13');W3('P62','24G','KA','14');
    commit();recompute();simReset();let r3=simRun();
    ok(r3.dev.P62&&r3.dev.P62.on.length>0,'模擬：Q62P 接 AC 有電');
    ok(r3.dev.P63&&r3.dev.P63.on.length>0,'模擬：Q63P 接 DC24V 有電');
    ok(r3.dev.KA&&(r3.dev.KA.coil||r3.dev.KA.rev.length>0),'模擬：Q62P 的 +24V／24G 輸出能帶動繼電器線圈');
    S.wires=S.wires.filter(w=>w.b.d!=='P63');W3('PS','-V1','P63','+24V');W3('PS','+V1','P63','24G');recompute();r3=simRun();
    ok(!(r3.dev.P63&&r3.dev.P63.on.length),'模擬：Q63P 正負接反就沒電');
    // 擴展基板的設定欄
    picked={k:'dev',id:'B2'};renderDetail();ok(!!$('qMain')&&!!$('qStage')&&/從 50 開始/.test($('detail').textContent),'擴展基板：右側有主基板、擴展級數設定，顯示起始位址（Q35B 5 槽後面 → 50）');
    $('qStage').value='3';$('qStage').dispatchEvent(new Event('change'));ok(devOf('B2').stage===3,'改擴展級數存進器具');
    // ---------- 台達 AH：X、Y 各自連續，依槽位順序只算數位模組；延伸背板接續 ----------
    S=normalize({box:{w:1400,h:900,d:300,back:20},plate:{w:1360,h:860},door:{w:900,h:700},ducts:[],glands:[],wires:[],
      devices:[D2('PWR','field-power',0,-300,{sheet:'field'}),D2('PS','drl120',1200,600),D2('AM','ahbp08m1-5a',20,20),D2('AE','ahbp06e1-5a',20,200),D2('KA','my2n-24',1000,600)]}).state;resetUi();
    const ar=(id,tpl,host,slot)=>{const R=tplOf(devOf(host)).rack,i=R.findIndex((s,k)=>s.k==='io'&&R.slice(0,k).filter(x=>x.k==='io').length===slot);return put(id,tpl,host,i);};
    const a0=ar('A0','ah16am10n-5a','AM',0),a1=ar('A1','ah16an01r-5a','AM',1),a2=ar('A2','ah32am10n-5a','AM',2),a4=ar('A4','ah16ap11t-5a','AM',4),e0=ar('E0','ah64am10n-5c','AE',0),ee1=ar('E1','ah16an01t-5a','AE',2);
    ok(qName(a0,'X0.5')==='X0.5'&&qName(a1,'Y0.3')==='Y0.3','AH 0 槽輸入 X0.x、1 槽輸出 Y0.x（X、Y 各自從 0 開始）');
    ok(qName(a2,'X0.0')==='X1.0'&&qName(a2,'X1.15')==='X2.15','2 槽 32 點輸入：X1.0～X2.15');
    ok(qName(a4,'X0.7')==='X3.7'&&qName(a4,'Y0.0')==='Y1.0','4 槽（3 槽空著不佔位址）輸入輸出混合：X3.0～、Y1.0～');
    ok(qName(e0,'X0.0')==='X4.0'&&qName(e0,'X3.15')==='X7.15','延伸背板 0 槽 64 點：接在主背板後面 X4.0～X7.15');
    ok(qName(ee1,'Y0.0')==='Y2.0','延伸背板的輸出接在主背板後面：Y2.0～');
    ok(addrText(a4)==='X3.0～X3.15、Y1.0～Y1.15','槽位表的位址文字：X3.0～X3.15、Y1.0～Y1.15');
    picked={k:'dev',id:'AM'};renderDetail();ok(/X1\.0～X2\.15/.test($('detail').textContent)&&/只算數位模組/.test($('detail').textContent),'AH 主背板的槽位表顯示 X1.0～X2.15 與位址規則');
    // 模擬：用實際位址
    let k4=0;const W4=(a,at,bb,bt)=>S.wires.push({id:'h'+(++k4),no:'H'+k4,a:{d:a,t:at},b:{d:bb,t:bt},wps:[],gauge:.75,color:'black'});
    // 模組吃同一塊背板電源模組的電：主背板、延伸背板各裝一台 AHPS05 並接 AC
    put('PA','ahps05-5a','AM',0);put('PE','ahps05-5a','AE',0);
    W4('PWR','R','PS','L');W4('PWR','S','PS','N');W4('PWR','R','PA','L');W4('PWR','S','PA','N');W4('PWR','R','PE','L');W4('PWR','S','PE','N');W4('PS','-V1','A2','CN1.S/S1');W4('PS','+V1','A2','CN1.X1.3');W4('PS','-V1','E1','ZP');W4('PS','+V1','E1','UP');W4('E1','Y0.4','KA','14');W4('KA','13','PS','+V1');
    commit();recompute();simReset();let r4=simRun();
    ok(r4.X.some(x=>x.name==='X2.3'&&x.on)&&r4.X.filter(x=>x.on).length===1,'模擬：32 點模組右欄 X1.3 接上 → 實際 X2.3 ON，只有一點');
    SIMST.y.add('E1|Y0.4');r4=simRun();ok(r4.Y.some(y=>y.name==='Y2.4')&&r4.dev.KA&&r4.dev.KA.coil,'模擬：延伸背板 Y2.4 ON，繼電器吸合');
    {const wu=S.wires.find(w=>w.b.d==='E1'&&w.b.t==='UP');ok(r4.wires[wu.id].cur&&r4.dev.E1.on.includes('輸出電源'),'電晶體輸出的 UP 線（驅動電源）有電流');
     const keep=S.wires.slice();S.wires=S.wires.filter(w=>w!==wu);recompute();const r5=simRun();ok(r5.dev.KA&&r5.dev.KA.coil,'UP 沒接：輸出照樣動作（輸出電源只算電流顯示）');S.wires=keep;recompute();r4=simRun();}
    // 電源：延伸背板的電源模組斷電 → 上面的模組沒電，輸出不動作；主背板照常
    S.wires=S.wires.filter(w=>w.b.d!=='PE');recompute();r4=simRun();ok(!(r4.dev.KA&&r4.dev.KA.coil)&&r4.dev.E1.nopwr&&r4.X.some(x=>x.name==='X2.3'&&x.on),'延伸背板電源模組沒電：E1 沒電、Y2.4 不動作；主背板 X2.3 照常');
    S.wires=S.wires.filter(w=>w.b.d!=='PA');recompute();r4=simRun();ok(!r4.X.some(x=>x.on)&&r4.dev.A2.nopwr&&!(r4.dev.A0.on||[]).length,'主背板電源模組也沒電：輸入不亮、模組不亮');
    return out;
  });
  await b.close();
  res.forEach(l=>console.log(l));errs.forEach(e=>console.log('✗ 頁面錯誤：'+e));
  const fail=res.filter(l=>l.startsWith('✗')).length+errs.length;
  console.log(fail?`\n失敗 ${fail} 項`:'\n全部通過');process.exit(fail?1:0);
})();

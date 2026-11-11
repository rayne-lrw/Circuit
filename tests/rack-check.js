// 底座插槽檢查（三菱 Q 系列）：模組吸到槽位、槽種類限制、佔用、跟著基板移動、I/O 位址依槽位自動編號、
// 槽位表、從槽位表裝模組、存檔讀回、深度、模擬名稱與動作
// 用法：node tests/rack-check.js
const {chromium}=require('playwright'),path=require('path');
(async()=>{
  const b=await chromium.launch(),p=await b.newPage({viewport:{width:1400,height:900}});
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+path.join(__dirname,'..','index.html'));
  const res=await p.evaluate(()=>{
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
    return out;
  });
  await b.close();
  res.forEach(l=>console.log(l));errs.forEach(e=>console.log('✗ 頁面錯誤：'+e));
  const fail=res.filter(l=>l.startsWith('✗')).length+errs.length;
  console.log(fail?`\n失敗 ${fail} 項`:'\n全部通過');process.exit(fail?1:0);
})();

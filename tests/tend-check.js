// 天得器具檢查：保險絲座每極導通、端子台每片上下同電位與短路片、雙層端子台上下層獨立、
// TSSR 固態繼電器模擬（D 型有極性）與吸附到散熱座、TFB-101N 指示燈疊在保險絲座正面
// 用法：node tests/tend-check.js
const {chromium}=require('playwright'),path=require('path');
(async()=>{
  const b=await chromium.launch(),p=await b.newPage({viewport:{width:1400,height:900}});
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+path.join(__dirname,'..','index.html'));
  const res=await p.evaluate(()=>{
    const out=[],ok=(c,m)=>out.push((c?'✓ ':'✗ ')+m);
    const ids=Object.keys(TPL).filter(id=>id.startsWith('tend-'));
    const by=s=>ids.filter(id=>TPL[id].ser===s).length;
    ok(ids.length===81,`天得器具 ${ids.length} 種（保險絲座 ${ids.filter(i=>/tfb|tfe/.test(i)).length}、端子台 ${ids.filter(i=>/-tb|-t[24]0/.test(i)).length}、TSSR ${ids.filter(i=>/tssr/.test(i)).length}）`);
    ok(ids.every(id=>TPL[id].b==='天得'&&TPL[id].ser&&VER[id]),'都有廠牌、系列、資料來源');
    const box={box:{w:900,h:700,d:300,back:20},plate:{w:860,h:660},door:{w:900,h:700},ducts:[],glands:[]};
    const D=(id,tpl,x,y,ex={})=>({id,tag:id,tpl,x,y,sheet:TPL[tpl].sheet||'plate',...ex});
    // 1. 端子台：每片上下同一點，短路片接起相鄰片
    S=normalize({...box,devices:[D('X1','tend-tbc-20',20,20,{count:4,jumpers:[{at:2,p:2}]}),D('X2','tend-tbd-10',20,120,{count:3}),D('X3','tend-tb15-4',20,220)],wires:[]}).state;resetUi();recompute();
    const X1=devOf('X1'),X2=devOf('X2'),X3=devOf('X3'),nk=(d,t)=>nodeKey({d:d.id,t});
    ok(tplOf(X1).w===17.6+10.7*4&&tplOf(X1).terms.length===8,'TBC-20 4 片：長度照型錄公式 17.6+10.7×4，8 個接點');
    ok(nk(X1,'1A')===nk(X1,'1C')&&nk(X1,'1A')!==nk(X1,'2A')&&nk(X1,'2A')===nk(X1,'3C'),'每片上下同電位、片與片分開、短路片接起 2～3 片');
    ok(nk(X2,'1A')===nk(X2,'1D')&&nk(X2,'1B')===nk(X2,'1C')&&nk(X2,'1A')!==nk(X2,'1B')&&nk(X2,'1A')!==nk(X2,'2A'),'雙層端子台：下層 A-D、上層 B-C 各自同電位，上下層獨立');
    ok(nk(X3,'4A')===nk(X3,'4C')&&nk(X3,'1A')!==nk(X3,'2A')&&tplOf(X3).w===55,'TB15-4：固定 4 片，每片上下同電位，長 55');
    // 2. 保險絲座、SSR 模擬
    S=normalize({...box,devices:[D('PWR','field-power',0,-300,{sheet:'field'}),D('PS','drl120',300,40),D('F1','tend-tfbr-322n',20,40),D('U1','tend-tssr-25d',100,200),D('LP','lamp',400,-300,{sheet:'field'}),D('SB','py2201-g',600,100)],wires:[]}).state;resetUi();
    let n=0;const W=(a,at,bb,bt)=>S.wires.push({id:'w'+(++n),no:'W'+n,a:{d:a,t:at},b:{d:bb,t:bt},wps:[],gauge:1.25,color:'black'});
    W('PWR','R','F1','1');W('PWR','S','F1','3');W('F1','2','PS','L');W('F1','4','PS','N');
    W('PS','+V1','SB','3');W('SB','4','U1','3');W('U1','4','PS','-V1');
    W('F1','2','U1','1');W('U1','2','LP','L/+');W('LP','N/−','F1','4');recompute();
    simReset();let R=simRun();ok(R.wires.w3.pot==='ac'&&R.wires.w4.pot!=='none','保險絲座每極一直導通（電源經 TFBR-322N 送到電源供應器）');
    ok(!(R.dev.LP&&R.dev.LP.on.length),'沒按按鈕：SSR 輸出不通，燈不亮');
    SIMST.press.add('SB|按下');R=simRun();ok(R.dev.LP&&R.dev.LP.on.includes('燈'),'按下按鈕：SSR 輸入有電，1-2 導通，燈亮');
    S.wires.find(w=>w.id==='w6').b.t='4';S.wires.find(w=>w.id==='w7').a.t='3';recompute();R=simRun();ok(R.dev.U1&&R.dev.U1.rev.length&&!(R.dev.LP&&R.dev.LP.on.length),'D 型輸入接反：顯示極性相反，不動作');
    // 3. SSR 吸附到散熱座、指示燈疊在保險絲座
    S=normalize({...box,devices:[D('HS','tend-tssr02-3p',20,20),D('U1','tend-tssr-10a',0,300),D('U2','tend-tssr-40dh',0,400),D('FU','tend-tfb-101',300,300),D('FU2','tend-tfb-301',300,400),D('HL','tend-tfb-101n',0,500)],wires:[]}).state;resetUi();recompute();
    const HS=devOf('HS'),U1=devOf('U1'),U2=devOf('U2');
    ok(hostOk(HS,U1)&&!isMainBase(HS),'散熱座可以裝 SSR，而且不會被當成 PLC 基板');
    U1.on='HS';U1.rack=rackPick(HS,U1,HS.x+120);placeOn(U1,HS);U2.on='HS';U2.rack=rackPick(HS,U2,HS.x);placeOn(U2,HS);
    ok(U1.rack===2&&U1.x===HS.x+102.5&&U2.rack===0&&Math.abs(U1.y-(HS.y+(74.8-66)/2))<.01,'SSR 裝進最近的空位置（每 50 mm 一個），上下置中');
    ok(rackName(tplOf(HS),2)==='第 3 個位置'&&!qName(U1,'1'),'位置名稱「第 3 個位置」，接點不會被換成 PLC 位址');
    const HL=devOf('HL');ok(hostOk(devOf('FU'),HL)&&!hostOk(devOf('FU2'),HL),'TFB-101N 指示燈只能疊在 TFB-101／TFBR-101 上');
    HL.on='FU';placeOn(HL,devOf('FU'));ok(Math.abs(HL.x-(300+.2))<.01&&effDepth(devOf('FU'))===20+29.5,'指示燈疊在正面中央，深度相加');
    renderBoard();
    return out;});
  await b.close();
  res.forEach(l=>console.log(l));errs.forEach(e=>console.log('✗ 頁面錯誤：'+e));
  const fail=res.filter(l=>l.startsWith('✗')).length+errs.length;console.log(fail?`\n失敗 ${fail} 項`:'\n全部通過');process.exit(fail?1:0);
})();

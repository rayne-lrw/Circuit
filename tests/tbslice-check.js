// 端子台中間插入／刪除片測試：所有可設片數的端子台（25 種）各跑一次
// - 在第 1 片後插入 1 片：總片數＋1、後面的端子號往後移、新片空白、接在第 2 片以後的線改接到下一片、短路片往後移、線數不變
// - 插在短路片中間：不做（請先拿掉短路片）
// - 刪除第 2 片：接在這片的線一起刪、後面往前移、端子號往前移、短路片往前移
// - 刪除有短路片的片：不做
// - 復原：回到操作前；另外用畫面按鈕操作一次（插入、刪除）
// 用法：node tests/tbslice-check.js
const {chromium}=require('playwright'),path=require('path');
(async()=>{const b=await chromium.launch(),p=await b.newPage({viewport:{width:1500,height:950},bypassCSP:true}); /* 測試要注入輔助腳本，略過網頁的 CSP */const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+path.resolve('index.html'));
const r=await p.evaluate(()=>{const out=[];const ids=Object.keys(TPL).filter(id=>hasSlots(tplOf({tpl:id})));
  ids.forEach(id=>{const JP=!!tplOf({tpl:id}).jumper,t0=resolveTpl(id,6),suf=[...new Set(t0.terms.map(q=>q.id.replace(/^\d+/,'')))],sa=suf[0],sb=suf[suf.length-1];const pr=[];
    S=normalize({box:{w:900,h:700,d:300,back:20},plate:{w:860,h:660},door:{w:900,h:700},ducts:[],glands:[],wires:[],devices:[
      {id:'TB',tag:'TB',tpl:id,x:100,y:100,sheet:'plate',count:6,labels:['a1','a2','a3','a4','a5','a6'],...(JP?{jumpers:[{at:4,p:2,row:1}]}:{})},{id:'K',tag:'K',tpl:'my2n-24',x:400,y:100,sheet:'plate'}]}).state;resetUi();recompute();
    const W=(n,t,no)=>S.wires.push({id:'w'+no,no,a:{d:'TB',t:n+t},b:{d:'K',t:'13'},wps:[],gauge:.75,color:'black'});
    W(1,sa,'N1');W(2,sa,'N2');W(2,sb,'N2b');W(3,sb,'N3');W(6,sa,'N6');recompute();
    const d=devOf('TB'),T=no=>{const w=S.wires.find(x=>x.no===no);return w?w.a.t:null;},snap=JSON.stringify(S);
    let x=tbSlices(d,'ins',1,1);if(!x.ok)pr.push('插入失敗:'+x.msg);
    if(d.count!==7)pr.push('片數不是 7');if(JSON.stringify(d.labels)!==JSON.stringify(['a1','','a2','a3','a4','a5','a6']))pr.push('端子號沒跟著移:'+JSON.stringify(d.labels));
    if(T('N1')!==1+sa||T('N2')!==3+sa||T('N2b')!==3+sb||T('N3')!==4+sb||T('N6')!==7+sa)pr.push('接線沒跟著移:'+['N1','N2','N2b','N3','N6'].map(T).join(','));
    if(JP&&d.jumpers[0].at!==5)pr.push('短路片沒跟著移');if(S.wires.length!==5)pr.push('線數變了');
    if(!resolveTpl(id,7).terms.some(q=>q.id===7+sa))pr.push('第 7 片端子不存在');
    if(JP){x=tbSlices(d,'ins',5,1);if(x.ok||!/短路片/.test(x.msg))pr.push('短路片中間也插進去了');}
    x=tbSlices(d,'ins',0,2);if(!x.ok||d.count!==9||T('N1')!==3+sa)pr.push('插在最前面失敗');
    S=JSON.parse(snap);resetUi();recompute();const d2=devOf('TB');
    x=tbSlices(d2,'del',2);if(!x.ok)pr.push('刪除失敗:'+x.msg);
    if(d2.count!==5||S.wires.length!==3||T('N2')||T('N2b'))pr.push('刪除後片數或線不對');
    if(T('N3')!==2+sb||T('N6')!==5+sa||T('N1')!==1+sa)pr.push('刪除後接線沒往前移:'+['N1','N3','N6'].map(T).join(','));
    if(JSON.stringify(d2.labels)!==JSON.stringify(['a1','a3','a4','a5','a6']))pr.push('刪除後端子號不對');if(JP&&d2.jumpers[0].at!==3)pr.push('刪除後短路片沒往前移');
    if(JP){x=tbSlices(d2,'del',3);if(x.ok||!/短路片/.test(x.msg))pr.push('有短路片的片也刪了');}
    out.push({id,pr,JP});});
  return out;});
// 端子台跳線（同一台端子台不同片之間拉的線）在電路圖上畫成元件：控制回路串一條跳線（一般／預留各一）、主回路一相經過跳線
await p.addScriptTag({content:require('./schem-overlap.js').schemOverlaps.toString()});await p.emulateMedia({media:'print'});
const sj=await p.evaluate(()=>{const out=[];Object.keys(TPL).filter(id=>hasSlots(tplOf({tpl:id}))).forEach(id=>{const g=resolveTpl(id,6).terms.map(q=>q.id),sa=g[0].replace(/^\d+/,''),sb=g.find(q=>/^1\D/.test(q)&&q!==g[0]).replace(/^\d+/,'');
  [false,true].forEach(spare=>{const pr=[];let k=0;const W=(a,at,b,bt,no,ex)=>({id:'w'+(++k),no,a:{d:a,t:at},b:{d:b,t:bt},wps:[],gauge:.75,color:'black',...(ex||{})});
    const devs=[{id:'PW',tag:'PWR',tpl:'field-power',x:0,y:0,sheet:'field'},{id:'PS',tag:'PS',tpl:'drl120',x:300,y:100,sheet:'plate'},{id:'TB',tag:'TB9',tpl:id,x:100,y:300,sheet:'plate',count:6},
      {id:'HL',tag:'HL1',tpl:'lamp',x:500,y:100,sheet:'door'},{id:'Q',tag:'Q1',tpl:'ic60-3P16A',x:100,y:100,sheet:'plate'},{id:'M',tag:'M1',tpl:'motor3',x:200,y:-200,sheet:'field'}];
    const ws=[W('PW','R','Q','1','R'),W('PW','S','Q','3','S'),W('PW','T','Q','5','T'),W('Q','2','PS','L','R1'),W('Q','4','PS','N','S1'),
      W('PS','+V1','TB','1'+sa,'P1'),W('TB','1'+sb,'TB','2'+sb,'JPX',spare?{spare:true}:{}),W('TB','2'+sa,'HL','L/+','P2'),W('HL','N/−','PS','-V1','0V'),
      W('Q','2','TB','3'+sa,'U1'),W('TB','3'+sb,'TB','4'+sb,'JPM'),W('TB','4'+sa,'M','U','U2'),W('Q','4','M','V','V2'),W('Q','6','M','W','W2')];
    try{S=normalize({box:{w:900,h:700,d:300,back:20},plate:{w:860,h:660},door:{w:900,h:700},ducts:[],glands:[],wires:ws,devices:devs}).state;resetUi();recompute();
      const B=schemBuild();document.getElementById('print').innerHTML=schemPrintHtml();const ctl=B.pages.filter(x=>x.kind==='ctrl').map(x=>x.svg).join(''),mn=B.pages.filter(x=>x.kind==='main').map(x=>x.svg).join('');
      if(!/>JPX</.test(ctl))pr.push('控制回路沒畫跳線');if(!/>TB9</.test(ctl))pr.push('控制回路沒寫端子台編號');if((ctl.match(/r="1.1"/g)||[]).length<2)pr.push('控制回路沒畫端子符號');
      if(spare&&!(/選配/.test(ctl)&&/拆下可串接選配/.test(ctl)&&/stroke-dasharray="1 .8"/.test(ctl)))pr.push('預留跳線沒畫虛線或選配框');if(!spare&&/選配/.test(ctl))pr.push('一般跳線也畫了選配框');
      if(!/>JPM</.test(mn)&&!/JPM/.test(mn))pr.push('主回路沒畫跳線');
      const v=schemVerify(B),ov=schemOverlaps(),nm=schemMainNetMiss(B);if(v.length)pr.push('圖和配線對不上');if(ov.length)pr.push('重疊:'+ov[0].a+'|'+ov[0].b);if(/>[^<]*…[^<]*</.test(ctl+mn))pr.push('截斷');
    }catch(e){pr.push('錯誤:'+e.message);}
    out.push({id:id+(spare?'（預留）':''),pr});});});return out;});
const sjBad=sj.filter(x=>x.pr.length);
console.log(sjBad.length?`✗ 電路圖端子台跳線：${sjBad.length} / ${sj.length} 個組合有問題`:`✓ 電路圖端子台跳線：${sj.length} 個組合（25 種端子台 × 一般／預留跳線）控制回路與主回路都畫出跳線、端子符號、線號，圖和配線一致、不重疊`);
sjBad.slice(0,8).forEach(x=>console.log('  ',x.id,'→',x.pr.join('；')));
const bad=r.filter(x=>x.pr.length);
// 畫面按鈕：插入、刪除、復原
const ui=await p.evaluate(async()=>{const pr=[];
  S=normalize({box:{w:900,h:700,d:300,back:20},plate:{w:860,h:660},door:{w:900,h:700},ducts:[],glands:[],wires:[{id:'w1',no:'X1',a:{d:'TB',t:'2A'},b:{d:'K',t:'13'},wps:[],gauge:.75,color:'black'}],devices:[
    {id:'TB',tag:'TB',tpl:'w2202-1401',x:100,y:100,sheet:'plate',count:4,labels:['1','2','3','4']},{id:'K',tag:'K',tpl:'my2n-24',x:400,y:100,sheet:'plate'}]}).state;resetUi();recompute();save();snapshotPrev=JSON.stringify(S);
  if(mode==='view')setMode('place');picked={k:'dev',id:'TB'};renderDetail();await new Promise(r=>setTimeout(r,50));
  if(!$('slotIns')||!$('slotDel'))return ['面板沒有插入／刪除按鈕'];
  $('slotInsAt').value=1;$('slotInsN').value=1;$('slotIns').click();await new Promise(r=>setTimeout(r,50));
  const d=devOf('TB');if(d.count!==5||S.wires[0].a.t!=='3A')pr.push('按鈕插入沒作用');
  $('slotDelAt').value=2;$('slotDel').click();await new Promise(r=>setTimeout(r,50));if(devOf('TB').count!==4||S.wires[0].a.t!=='2A')pr.push('按鈕刪除沒作用');
  $('undo').click();await new Promise(r=>setTimeout(r,50));if(devOf('TB').count!==5||S.wires[0].a.t!=='3A')pr.push('復原沒回到插入後的狀態');
  return pr;});
let fail=bad.length+ui.length+sjBad.length;
console.log(bad.length?`✗ 端子台插入／刪除片：${bad.length} / ${r.length} 種有問題`:`✓ 端子台插入／刪除片：${r.length} 種全部正確（其中 ${r.filter(x=>x.JP).length} 種有短路片：插入、插在最前面、短路片擋下、刪除、接線與端子號跟著移）`);
bad.slice(0,8).forEach(x=>console.log('  ',x.id,'→',x.pr.join('；')));
console.log(ui.length?'✗ 畫面按鈕：'+ui.join('；'):'✓ 畫面按鈕：插入、刪除、復原都正常');
errs.forEach(e=>{console.log('✗ 頁面錯誤：'+e);fail++;});console.log(fail?`\n失敗 ${fail} 項`:'\n全部通過');await b.close();process.exit(fail?1:0);})();

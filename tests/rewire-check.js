// 改接線頭測試（接線模式選取一條線，拖曳或點選線頭改接到別的接點）：
// - 拖曳線頭到新接點：接點改了，線號、線徑、顏色、中繼點、不進線槽保留；復原回到原本
// - 點一下線頭（拿起）再點新接點：改接；拿起後按 Esc 取消
// - 擋下：放回原接點、接到另一端的同一點、重複接線、整個接頭和一般接點互換；放在空白處維持原狀
// - 新接點原本是別的線號：提示列出現「改成 X」按鈕，按下去線號改過去
// - 檢視模式：不能改接
// 用法：node tests/rewire-check.js
const {chromium}=require('playwright'),path=require('path');
(async()=>{const b=await chromium.launch(),p=await b.newPage({viewport:{width:1500,height:950}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+path.resolve('index.html'));
const res=[];const ok=(c,m)=>res.push((c?'✓ ':'✗ ')+m);
const setup=()=>p.evaluate(()=>{
  S=normalize({box:{w:600,h:500,d:300,back:20},plate:{w:560,h:460},door:{w:600,h:500},ducts:[],glands:[],devices:[
    {id:'TB',tag:'TB1',tpl:'w2202-1401',x:60,y:80,sheet:'plate',count:6},{id:'K',tag:'R1',tpl:'my2n-24',x:300,y:80,sheet:'plate'},{id:'K2',tag:'R2',tpl:'my2n-24',x:400,y:80,sheet:'plate'},
    {id:'PL',tag:'PLC',tpl:'fx5u32',x:60,y:300,sheet:'plate'}],
    wires:[{id:'w1',no:'101',a:{d:'TB',t:'1A'},b:{d:'K',t:'13'},wps:[{x:200,y:60}],gauge:1.25,color:'red',direct:true},
      {id:'w2',no:'0V',a:{d:'TB',t:'3A'},b:{d:'K2',t:'14'},wps:[],gauge:.75,color:'blue'},
      {id:'w3',no:'102',a:{d:'TB',t:'2A'},b:{d:'K',t:'14'},wps:[],gauge:.75,color:'black'}]}).state;
  resetUi();if(mode!=='wire')setMode('wire');recompute();sel='w1';renderList();renderWires();renderDetail();renderOverlay();hist.u=[];snapshotPrev=JSON.stringify(S);syncUndo();});
// 世界座標換成螢幕座標
const scr=(x,y)=>p.evaluate(([x,y])=>{const r=$('svg').getBoundingClientRect();return {x:r.left+view.x+x*view.k,y:r.top+view.y+y*view.k};},[x,y]);
const endXY=end=>p.evaluate(e=>{const r=ROUTES.get('w1');const q=e==='a'?r.pts[0]:r.pts[r.pts.length-1];return [q.x,q.y];},end);
const termXY=(d,t)=>p.evaluate(([d,t])=>{const q=endpoint({d,t},0);return [q.x,q.y];},[d,t]);
const W1=()=>p.evaluate(()=>{const w=S.wires.find(x=>x.id==='w1');return JSON.parse(JSON.stringify(w));});
const drag=async(from,to)=>{const A=await scr(...from),B=await scr(...to);await p.mouse.move(A.x,A.y);await p.mouse.down();await p.mouse.move(A.x+8,A.y+8,{steps:3});await p.mouse.move(B.x,B.y,{steps:8});await p.mouse.up();await p.waitForTimeout(60);};
const click=async xy=>{const A=await scr(...xy);await p.mouse.click(A.x,A.y);await p.waitForTimeout(60);};

// 1. 拖曳改接 b 端：R1:13 → R2:13
await setup();
await drag(await endXY('b'),await termXY('K2','13'));
let w=await W1();
ok(w.b.d==='K2'&&w.b.t==='13','拖曳線頭：改接到 R2:13');
ok(w.no==='101'&&w.gauge===1.25&&w.color==='red'&&w.wps.length===1&&w.direct===true&&w.a.d==='TB'&&w.a.t==='1A','改接後線號、線徑、顏色、中繼點、不進線槽、另一端都保留');
ok(await p.evaluate(()=>!!ROUTES.get('w1')&&ROUTES.get('w1').pts.length>1),'改接後走線重算');
await p.evaluate(()=>$('undo').click());w=await W1();ok(w.b.d==='K'&&w.b.t==='13','復原：回到原本的 R1:13');

// 2. 點選：點一下線頭拿起，再點新接點
await setup();
await click(await endXY('a'));
ok(await p.evaluate(()=>!!rewire&&rewire.end==='a'),'點一下線頭：拿起（等待點新的接點）');
await click(await termXY('TB','5A'));w=await W1();ok(w.a.d==='TB'&&w.a.t==='5A','點新接點：a 端改接到 TB1:5A');
// Esc 取消
await setup();await click(await endXY('a'));await p.keyboard.press('Escape');await p.waitForTimeout(50);
ok(await p.evaluate(()=>rewire===null),'拿起線頭後按 Esc：取消');
w=await W1();ok(w.a.t==='1A','取消後接點沒變');

// 3. 擋下的情況
await setup();
const chk=await p.evaluate(()=>{const w=S.wires.find(x=>x.id==='w1'),r=[];
  r.push(rewireCheck(w,'b',{d:'K',t:'13'}));            // 原接點
  r.push(rewireCheck(w,'b',{d:'TB',t:'1A'}));           // 另一端
  r.push(rewireCheck(w,'a',{d:'TB',t:'2A'}));           // 不重複，應該可以
  S.wires.push({id:'w9',no:'9',a:{d:'TB',t:'4A'},b:{d:'K',t:'13'},wps:[],gauge:.75,color:'black'});
  r.push(rewireCheck(w,'a',{d:'TB',t:'4A'}));           // 重複接線
  S.wires.pop();
  const ct=Object.keys(TPL).find(id=>{try{return !!tplOf({tpl:id}).cns;}catch(_){return false;}});S.devices.push({id:'CN',tag:'CN',tpl:ct,x:300,y:300,sheet:'plate'});
  const cn=Object.keys(tplOf(devOf('CN')).cns||{})[0];r.push(cn?rewireCheck(w,'a',{d:'CN',t:cn}):'沒有接頭可測');S.devices.pop();
  return r;});
ok(/沒有改/.test(chk[0]),'放回原本的接點：不改');
ok(/另一端/.test(chk[1]),'接到這條線另一端的同一點：擋下');
ok(chk[2]==='','一般情況可以改接');
ok(/重複/.test(chk[3]),'新接點和另一端已有一條線：擋下（重複接線）');
ok(/接頭/.test(chk[4])&&!/沒有接頭可測/.test(chk[4]),'一般接點的線改接到整個接頭：擋下');
// 放在空白處
await setup();const e0=await endXY('b');await drag(e0,[e0[0]+40,e0[1]+150]);w=await W1();ok(w.b.d==='K'&&w.b.t==='13','拖到空白處放開：維持原本的接法');

// 4. 新接點原本是別的線號：提示列的「改成 X」按鈕
await setup();
await drag(await endXY('b'),await termXY('K2','14'));
const tb=await p.$('#toast .toast-act');ok(!!tb&&/改成 0V/.test(await tb.textContent()),'改接到已有線號 0V 的接點：提示列出現「改成 0V」');
if(tb){await tb.click();await p.waitForTimeout(50);}w=await W1();ok(w.no==='0V','按「改成 0V」：這條線的線號改成 0V');

// 5. 檢視模式不能改接
await setup();await p.evaluate(()=>setMode('view'));
const vb=await p.evaluate(()=>{const w=S.wires.find(x=>x.id==='w1');return doRewire('w1','b',{d:'K2',t:'13'})||w.b.d!=='K';});
ok(!vb,'檢視模式：不能改接');

await b.close();
res.forEach(l=>console.log(l));errs.forEach(e=>console.log('✗ 頁面錯誤：'+e));
const fail=res.filter(l=>l.startsWith('✗')).length+errs.length;console.log(fail?`\n失敗 ${fail} 項`:'\n全部通過');process.exit(fail?1:0);})();

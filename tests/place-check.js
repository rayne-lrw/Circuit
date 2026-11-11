// 放置檢查：點器具庫後器具預覽跟著滑鼠走、點一下放下（像 CAD 插入圖塊）
// 吸附格點、正面附件、Q 系列槽位；R 旋轉；Esc、右鍵取消；中鍵拖曳不會放下；觸控點一下放下；可以復原
// 用法：node tests/place-check.js
const {chromium}=require('playwright'),path=require('path');
(async()=>{
  const b=await chromium.launch(),p=await b.newPage({viewport:{width:1500,height:950}});
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+path.join(__dirname,'..','index.html'));
  const out=[],ok=(c,m)=>out.push((c?'✓ ':'✗ ')+m);
  await p.evaluate(()=>{S=normalize({box:{w:800,h:600,d:300,back:20},plate:{w:760,h:560},door:{w:800,h:600},ducts:[],glands:[],wires:[],
    devices:[{id:'QB1',tag:'QB1',tpl:'q35b',x:300,y:300,sheet:'plate'}]}).state;resetUi();commit();recompute();renderPalette();fit();setMode('place');});
  // 世界座標 → 螢幕座標
  const scr=(x,y)=>p.evaluate(([x,y])=>{const r=$('svg').getBoundingClientRect();return {x:r.left+view.x+x*view.k,y:r.top+view.y+y*view.k};},[x,y]);
  const lib=id=>p.evaluate(id=>{const b=document.querySelector(`#palette [data-add="${id}"]`);if(!b)return false;b.click();return true;},id);
  const st=()=>p.evaluate(()=>({n:S.devices.length,placing:!!placing,ghost:!!document.getElementById('placeGhost'),o:placing&&placing.o?{...placing.o}:null,bad:placing&&placing.bad,hint:$('hintT').textContent}));
  const n0=(await st()).n;
  ok(await lib('lc1d09'),'器具庫有 LC1D09 按鈕');
  let s=await st();ok(s.placing&&s.n===n0,'點器具庫：進入放置中，還沒新增器具');ok(/放置/.test(s.hint)&&/Esc/.test(s.hint),'提示列說明怎麼放置');
  let q=await scr(100,100);await p.mouse.move(q.x,q.y);s=await st();
  ok(s.ghost&&s.o&&s.o.x%5===0&&s.o.y%5===0,'預覽跟著滑鼠、對齊 5 mm 格點（'+(s.o&&s.o.x)+','+(s.o&&s.o.y)+'）');
  const w0=await p.evaluate(()=>tplOf(placing.o).w);
  await p.keyboard.press('r');s=await st();const w1=await p.evaluate(()=>tplOf(placing.o).w);
  ok(s.o&&s.o.rot===90&&w1!==w0,'按 R：預覽旋轉 90°');
  await p.mouse.click(q.x,q.y);s=await st();
  const km=await p.evaluate(()=>{const d=S.devices[S.devices.length-1];return {tpl:d.tpl,rot:d.rot,x:d.x,y:d.y,tag:d.tag,picked:picked&&picked.id};});
  ok(s.n===n0+1&&!s.placing&&km.tpl==='lc1d09'&&km.rot===90,'點一下：放下一台（旋轉保留）並結束放置');
  ok(km.picked===km.tag&&/^[A-Z]+\d+$/.test(km.tag),'放下後自動編號並選取（'+km.tag+'）');
  await p.evaluate(()=>$('undo').click());ok((await st()).n===n0,'可以復原');
  // Esc、右鍵取消
  await lib('lc1d09');await p.mouse.move(q.x,q.y);await p.keyboard.press('Escape');s=await st();ok(!s.placing&&!s.ghost&&s.n===n0,'Esc 取消，不新增');
  await lib('lc1d09');await p.mouse.move(q.x,q.y);await p.mouse.click(q.x,q.y,{button:'right'});s=await st();ok(!s.placing&&s.n===n0,'右鍵取消，不新增');
  // 中鍵拖曳平移：不會放下
  await lib('lc1d09');await p.mouse.move(q.x,q.y);const v0=await p.evaluate(()=>view.x);
  await p.mouse.down({button:'middle'});await p.mouse.move(q.x+80,q.y+20,{steps:4});await p.mouse.up({button:'middle'});
  s=await st();ok(s.placing&&s.n===n0&&(await p.evaluate(()=>view.x))!==v0,'放置中可以中鍵拖曳平移，不會放下');
  await p.keyboard.press('Escape');
  // 正面附件：LADN40 移到接觸器上，預覽直接裝上
  await p.evaluate(()=>{S.devices.push({id:'KM9',tag:'KM9',tpl:'lc1d09',x:100,y:100,sheet:'plate'});commit();recompute();});
  await lib('ladn40');const km9=await p.evaluate(()=>{const t=tplOf(devOf('KM9'));return [100+t.w/2,100+t.h/2];});q=await scr(...km9);await p.mouse.move(q.x,q.y);s=await st();
  ok(s.o&&s.o.on==='KM9','輔助接點移到接觸器上：預覽吸到正面');
  ok(await p.evaluate(()=>/裝到 KM9/.test(document.getElementById('placeGhost').textContent)),'預覽標示「裝到 KM9」');
  await p.mouse.click(q.x,q.y);ok(await p.evaluate(()=>S.devices.some(d=>d.tpl==='ladn40'&&d.on==='KM9')),'放下後裝在 KM9 上');
  // Q 系列：QX40 移到基板 1 槽附近，吸到槽位並顯示位址
  const slot=await p.evaluate(()=>{const B=devOf('QB1'),s=tplOf(B).rack[3];return [B.x+s.x+13.7,B.y+49];});
  await lib('qx40');q=await scr(...slot);await p.mouse.move(q.x,q.y);s=await st();
  ok(s.o&&s.o.on==='QB1'&&s.o.rack===3,'QX40 移到基板：預覽吸到 1 槽');
  ok(await p.evaluate(()=>/1 槽（10～1F）/.test(document.getElementById('placeGhost').textContent)),'預覽標示「1 槽（10～1F）」');
  await p.mouse.click(q.x,q.y);ok(await p.evaluate(()=>S.devices.some(d=>d.tpl==='qx40'&&d.on==='QB1'&&d.rack===3)),'放下後裝在 1 槽');
  // 槽滿了：預覽變紅、點了不放
  await p.evaluate(()=>{const B=devOf('QB1');[2,4,5,6].forEach((r,i)=>S.devices.push({id:'QF'+i,tag:'QF'+i,tpl:'qx40',x:0,y:0,sheet:'plate',on:'QB1',rack:r}));riders(B).forEach(x=>placeOn(x,B));commit();recompute();});
  await lib('qx40');await p.mouse.move(q.x,q.y);s=await st();ok(s.bad&&/沒有空的 ?I\/O ?槽/.test(s.bad),'I/O 槽都滿了：預覽標示不能放（'+s.bad+'）');
  const n1=(await st()).n;await p.mouse.click(q.x,q.y);ok((await st()).n===n1&&(await st()).placing,'不能放時點了不新增，仍在放置中');
  await p.keyboard.press('Escape');
  // 觸控：點一下放下
  await lib('lc1d09');const tq=await scr(500,150);
  await p.evaluate(({x,y})=>{const o={pointerId:7,pointerType:'touch',clientX:x,clientY:y,button:0,buttons:1,bubbles:true};$('svg').dispatchEvent(new PointerEvent('pointerdown',o));$('svg').dispatchEvent(new PointerEvent('pointerup',{...o,buttons:0}));},tq);
  ok(await p.evaluate(()=>!placing&&S.devices.some(d=>d.tpl==='lc1d09'&&Math.abs(d.x+tplOf(d).w/2-500)<6&&Math.abs(d.y+tplOf(d).h/2-150)<6)),'觸控：點一下就放在點的位置');
  // 切換模式會取消放置
  await lib('lc1d09');await p.evaluate(()=>setMode('wire'));ok(await p.evaluate(()=>!placing&&!document.getElementById('placeGhost')),'切換到接線模式：放置取消');
  await b.close();
  out.forEach(l=>console.log(l));errs.forEach(e=>console.log('✗ 頁面錯誤：'+e));
  const fail=out.filter(l=>l.startsWith('✗')).length+errs.length;
  console.log(fail?`\n失敗 ${fail} 項`:'\n全部通過');process.exit(fail?1:0);
})();

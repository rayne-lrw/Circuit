// IDEC YW 完整模擬檢查：每一種 YW 操作部（標準組合）放下後，每個接點塊的每個接點，在每個位置／狀態下逐一接繼電器模擬，
// 和型錄的接點動作表比對（預期值寫在這支測試裡，照型錄 TP1173，不讀程式的設定）。
// - 按鈕瞬時：沒按／按著；按鈕交替、緊急停止：復歸／動作（鎖定）
// - 選擇開關、鑰匙選擇開關 2 位置：常開在 R 閉合、常閉在 L 閉合；3 位置：照型錄 13 種接點結構的 ● 位置
// - 雙接點塊裝進空位置後兩個接點都跟著動作；照光燈 X1／X2；各種復歸方式的點擊行為（左半邊／右半邊、放開回去）
// 用法：node tests/idec-sim-check.js
const {chromium}=require('playwright'),path=require('path');
(async()=>{
  const b=await chromium.launch(),p=await b.newPage({viewport:{width:1400,height:900}});
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+path.join(__dirname,'..','index.html'));
  const res=await p.evaluate(()=>{
    // 型錄 3 位置接點動作表：結構 → [①,②,③] 各插槽「閉合的位置」（沒裝就是 null）
    const CL3={'20':[['L'],null,['R']],'20N1':[null,['L','R'],['R']],'02':[['C','R'],null,['L','C']],'02N1':[null,['C'],['L','C']],
      '11':[['L'],null,['L','C']],'11N1':[['C','R'],null,['R']],'11N2':[['L'],['C'],null],'11N3':[null,['C'],['R']],'11N4':[null,['L','R'],['L','C']],
      '30':[['L'],['L','R'],['R']],'03':[['C','R'],['C'],['L','C']],'21':[['L'],['C'],['R']],'12':[['C','R'],['L','R'],['L','C']]};
    const bad=[];let nT=0,nC=0,nS=0;
    const D=(id,tpl,x,y,sheet='plate')=>({id,tag:id,tpl,x,y,sheet});
    const fresh=()=>{S=normalize({box:{w:900,h:700,d:300,back:20},plate:{w:860,h:660},door:{w:900,h:700},ducts:[],glands:[],wires:[],devices:[D('PWR','field-power',0,-300,'field'),D('PS','drl120',20,20),D('KA','my2n-24',200,20)]}).state;resetUi();};
    const put=(tpl)=>{placing={tpl,rot:0,o:{id:'__place',tag:'',tpl,x:100,y:100,sheet:'door'},bad:null};placeDrop();return S.devices.find(d=>d.tpl===tpl);};
    let k=0;const W=(a,at,bb,bt)=>S.wires.push({id:'w'+(++k),no:'W'+k,a:{d:a,t:at},b:{d:bb,t:bt},wps:[],gauge:.75,color:'black'});
    const wire=(dev,a,bT)=>{S.wires=[];k=0;W('PWR','R','PS','L');W('PWR','S','PS','N');W('PS','+V1',dev.id,a);W(dev.id,bT,'KA','14');W('KA','13','PS','-V1');commit();recompute();};
    const on=()=>{const r=simRun();return !!(r.dev.KA&&r.dev.KA.coil);};
    const contacts=blk=>{const t=tplOf(blk);return [['3','4'],['1','2'],['3(2)','4(2)'],['1(2)','2(2)']].filter(([a])=>termOf(blk,a)).map(([a,b])=>({a,b,no:a.startsWith('3')}));};
    const ids=Object.keys(TPL).filter(id=>/^yw\d/.test(id)&&(TPL[id].cbHost||/^yw1p-1uq$/.test(id))&&!TPL[id].legacy);
    ids.forEach(id=>{nT++;fresh();const h=put(id),t=tplOf(h),op=t.op;
      // 狀態清單與預期
      const m=/^yw\d([bslkp])-(.+)$/.exec(id),kind=m[1],code=((/e(\d\d(?:n\d)?)r?$/.exec(id)||[])[1]||'').toUpperCase();
      // 指示燈：燈有電就亮
      const lampDev=t.cbHost?riders(h).find(r=>r.tpl==='yw-fa'):h;
      if(lampDev&&termOf(lampDev,'X1')){S.wires=[];k=0;W('PWR','R','PS','L');W('PWR','S','PS','N');W('PS','+V1',lampDev.id,'X1');W(lampDev.id,'X2','PS','-V1');commit();recompute();simReset();
        const r=simRun();nS++;if(!(r.dev[lampDev.id]&&r.dev[lampDev.id].on.includes('燈')))bad.push(`${id}：燈 X1／X2 有電沒亮`);}
      if(!op)return;
      const states=op.k==='mom'?['放開','按著']:op.k==='alt'?['復歸','動作']:op.n===3?['L','C','R']:['L','R'];
      const set=s=>{simReset();if(op.k==='mom'){if(s==='按著')SIMST.press.add(h.id+'|按下');}else if(op.k==='alt'){SIMST.on[h.id]=s==='動作';}else SIMST.sel[h.id]=s;};
      riders(h).filter(r=>tplOf(r).rackKind==='cb').forEach(blk=>contacts(blk).forEach(c=>{nC++;wire(blk,c.a,c.b);
        states.forEach(s=>{set(s);nS++;let want;
          if(op.k!=='sel'){const act=s==='按著'||s==='動作';want=c.no?act:!act;}
          else if(op.n===2)want=c.no?s==='R':s==='L';
          else{const cl=(CL3[code]||[])[blk.rack];if(!cl){bad.push(`${id}：型錄表沒有 ${rackName(t,blk.rack)} 的資料`);return;}want=cl.includes(s);}
          const got=on();if(got!==want)bad.push(`${id} ${rackName(t,blk.rack)} ${c.a}-${c.b}（${c.no?'NO':'NC'}）在「${s}」：要${want?'閉合':'打開'}，實際${got?'閉合':'打開'}`);});}));
      // 選擇開關的點擊：左半邊／右半邊、有彈簧那邊放開回去
      if(op.k==='sel'){const R=rectOf('dev',h),click=side=>{act=null;simPointerDown({pointerId:1,clientX:0,clientY:0,button:0},{x:side==='L'?R.x+4:R.x+R.w-4,y:R.y+20});const held=SIMST.sel[h.id];if(act&&act.t==='simsel'){SIMST.sel[h.id]=act.back;act=null;}return [held,SIMST.sel[h.id]];};
        const ret=/(^|-)(21b?|31b?)e/.test(m[2])?'R':/(^|-)32c?e/.test(m[2])?'L':/(^|-)33d?e/.test(m[2])?'LR':'';simReset();
        if(op.n===3){['L','R'].forEach(side=>{simReset();const [held,after]=click(side),spring=ret.includes(side);nS++;
          if(held!==side)bad.push(`${id}：點${side==='L'?'左':'右'}半邊沒切到 ${side}`);
          if(spring&&after!=='C')bad.push(`${id}：${side} 有彈簧，放開沒回 C`);
          if(!spring){if(after!==side)bad.push(`${id}：${side} 沒彈簧，放開不應該回去`);const [h2]=click(side);if(h2!=='C')bad.push(`${id}：在 ${side} 再點同一邊沒回 C`);}});}
        else{simReset();const [held,after]=click('R');nS++;if(held!=='R')bad.push(`${id}：點右半邊沒切到 R`);
          if(ret==='R'&&after!=='L')bad.push(`${id}：從右復歸，放開沒回 L`);if(!ret&&after!=='R')bad.push(`${id}：交替型，放開不應該回去`);
          const [hl]=click('L');if(hl!=='L')bad.push(`${id}：點左半邊沒切到 L`);}}
    });
    // 雙接點塊：裝進按鈕的空位置 ②，兩個接點都跟著按鈕動作；緊急停止不能裝
    [['yw-ew20',[true,true]],['yw-ew11',[true,false]],['yw-ew02',[false,false]]].forEach(([dt,nos])=>{fresh();const h=put('yw1b-m1e10');S.devices.push({id:'X',tag:'X',tpl:dt,x:500,y:500,sheet:'door'});
      hostSnap(devOf('X'),h.x+12,h.y+5);const x=devOf('X');if(x.on!==h.id||x.rack!==1){bad.push(`${dt}：裝不進按鈕的 ②`);return;}
      contacts(x).forEach((c,i)=>{wire(x,c.a,c.b);['放開','按著'].forEach(s=>{simReset();if(s==='按著')SIMST.press.add(h.id+'|按下');nS++;const want=c.no?s==='按著':s!=='按著',got=on();
        if(got!==want)bad.push(`${dt} ${c.a}-${c.b} 在「${s}」：要${want?'閉合':'打開'}，實際${got?'閉合':'打開'}`);});});
      fresh();const e=put('yw1b-v4e01r');S.devices.push({id:'Y',tag:'Y',tpl:dt,x:500,y:500,sheet:'door'});hostSnap(devOf('Y'),e.x+5,e.y+5);if(devOf('Y').on)bad.push(`${dt}：緊急停止不應該能裝`);});
    return {bad,nT,nC,nS};
  });
  await b.close();
  res.bad.slice(0,60).forEach(l=>console.log('✗ '+l));if(res.bad.length>60)console.log(`… 還有 ${res.bad.length-60} 項`);errs.forEach(e=>console.log('✗ 頁面錯誤：'+e));
  const fail=res.bad.length+errs.length;
  console.log(fail?`\n檢查 ${res.nT} 種 YW、${res.nC} 個接點、${res.nS} 個狀態，${fail} 項有問題`:`\n檢查 ${res.nT} 種 YW、${res.nC} 個接點、${res.nS} 個狀態，全部通過`);process.exit(fail?1:0);
})();

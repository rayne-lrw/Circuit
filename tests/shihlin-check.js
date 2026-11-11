// 士林接觸器檢查：TH-P 熱電驛插在接觸器下方自動導通、跳脫／復歸；S-2×P 可逆組放下自動帶兩台接觸器、三台一起移動、機械互鎖、審查提醒電氣互鎖；
// AP 輔助接點跟著接觸器動作；存檔讀回
// 用法：node tests/shihlin-check.js
const {chromium}=require('playwright'),path=require('path');
(async()=>{
  const b=await chromium.launch(),p=await b.newPage({viewport:{width:1400,height:900}});
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+path.join(__dirname,'..','index.html'));
  const res=await p.evaluate(()=>{
    const out=[],ok=(c,m)=>out.push((c?'✓ ':'✗ ')+m);
    const D=(id,tpl,x,y,ex={})=>({id,tag:id,tpl,x,y,sheet:'plate',...ex});
    const box={box:{w:1400,h:900,d:300,back:20},plate:{w:1360,h:860},door:{w:900,h:700},ducts:[],glands:[],wires:[]};
    S=normalize({...box,devices:[D('PWR','field-power',0,-300,{sheet:'field'}),D('K','sp16',300,200),D('F','thp20',700,600),D('KA','my2n-220',900,300),D('AP','ap11',900,600),D('AL','apl11',1000,600)]}).state;resetUi();
    const dv=id=>devOf(id),K=dv('K'),KT=tplOf(K),F=dv('F');
    // ---------- 熱電驛 ----------
    hostSnap(F,K.x,K.y+KT.h+5);ok(F.on==='K'&&F.x===K.x-6&&F.y===K.y+81.7,'TH-P20 拖到 S-P16 下方：裝上，位置照 MSO-P16 組合圖');
    ok(nodeKey({d:'F',t:'L1'})===nodeKey({d:'K',t:'T1'}),'裝上後 TH-P20 的 1/L1 和 S-P16 的 2/T1 算同一點');
    ok(!hostOk(dv('KA'),{tpl:'thp20'})&&!tplOf({tpl:'thp20'}).fits.includes('sp11'),'TH-P20 不能裝到繼電器或 S-P11');
    const kx=K.x;K.x+=40;riders(K).forEach(r=>placeOn(r,K));ok(F.x===K.x-6,'移動接觸器：熱電驛跟著移動');
    let k=0;const W=(a,at,bb,bt)=>S.wires.push({id:'w'+(++k),no:'W'+k,a:{d:a,t:at},b:{d:bb,t:bt},wps:[],gauge:1.25,color:'black'});
    // 控制：R → 95-96 → A1，A2 → S；主迴路：R → L1 → (K) → T1 = F L1 → F T1 → KA 線圈 → S
    W('PWR','R','F','95');W('F','96','K','A1');W('K','A2','PWR','S');W('PWR','R','K','L1');W('F','T1','KA','14');W('KA','13','PWR','S');
    commit();recompute();simReset();let r=simRun();
    ok(r.dev.K&&r.dev.K.coil,'模擬：經過熱電驛 95-96 的線圈吸合');
    ok(r.dev.KA&&r.dev.KA.coil,'模擬：主迴路 L1 → 接觸器 → 熱電驛（不用畫線）→ 2/T1 出去有電');
    SIMST.trip.F=true;r=simRun();ok(!(r.dev.K&&r.dev.K.coil)&&!(r.dev.KA&&r.dev.KA.coil),'跳脫：95-96 打開，接觸器跳開，負載斷電');
    W('PWR','R','F','97');W('F','98','KA','14');commit();recompute();r=simRun();ok(r.dev.KA&&r.dev.KA.coil,'跳脫時 97-98 閉合（警報迴路有電）');
    SIMST.trip.F=false;S.wires=S.wires.filter(w=>!(w.a.d==='F'&&(w.a.t==='97'||w.a.t==='98'))&&!(w.b.d==='F'&&w.b.t==='97'));commit();recompute();r=simRun();ok(r.dev.K&&r.dev.K.coil,'復歸：接觸器再次吸合');
    F.thReset='auto';SIMST.press.add('F|跳脫');r=simRun();ok(!(r.dev.K&&r.dev.K.coil),'自動復歸：按著跳脫');SIMST.press.delete('F|跳脫');r=simRun();ok(r.dev.K&&r.dev.K.coil,'自動復歸：放開就恢復');
    // ---------- 輔助接點 ----------
    hostSnap(dv('AP'),K.x+5,K.y+10);ok(dv('AP').on==='K','AP-11 拖到接觸器上：裝在正面');
    hostSnap(dv('AL'),K.x+20,K.y+10);ok(dv('AL').on==='K'&&dv('AL').x===K.x+KT.w,'APL-11 拖到接觸器上：貼在右側');
    W('PWR','R','AP','53');W('AP','54','KA','14');commit();recompute();r=simRun();ok(r.dev.KA&&r.dev.KA.coil,'AP-11 的 53-54 跟著接觸器閉合');
    // 存檔讀回
    commit();const n=normalize(JSON.parse(JSON.stringify(S))).state;ok(n.devices.find(d=>d.id==='F').on==='K'&&n.devices.find(d=>d.id==='F').thReset==='auto','存檔讀回：熱電驛裝在接觸器上、自動復歸設定保留');
    // ---------- 可逆組 ----------
    S=normalize({...box,devices:[D('PWR','field-power',0,-300,{sheet:'field'})]}).state;resetUi();
    placing={tpl:'sl-2xp16',rot:0,o:{id:'__place',tag:'',tpl:'sl-2xp16',x:400,y:300,sheet:'plate'},bad:null};placeDrop();
    const M=S.devices.find(d=>d.tpl==='sl-2xp16'),[L,R]=(M&&M.pair||[]).map(dv);
    ok(!!M&&L&&R&&L.tpl==='sp16'&&R.tpl==='sp16','放下 S-2×P16 可逆組：左右自動各放一台 S-P16');
    ok(L&&R&&L.x+53.5===M.x&&R.x===M.x+14&&L.y===R.y,'三台並排：左接觸器、互鎖 14 mm、右接觸器，上緣對齊');
    const c=carried(L).map(d=>d.id);ok(c.includes(M.id)&&c.includes(R.id),'拖左邊那台：互鎖和右邊那台一起移動');
    k=100;W('PWR','R',L.id,'A1');W(L.id,'A2','PWR','S');W('PWR','R',R.id,'A1');W(R.id,'A2','PWR','S');commit();recompute();simReset();r=simRun();
    ok(r.dev[L.id]&&r.dev[L.id].coil&&!(r.dev[R.id]&&r.dev[R.id].coil),'機械互鎖：兩邊同時通電只有一台吸合');
    ok(r.dev[R.id]&&r.dev[R.id].on.some(s=>/互鎖/.test(s)),'被擋住的那台顯示「線圈有電但被機械互鎖擋住」');
    // 右邊先吸合，再給左邊電：右邊保持
    S.wires=S.wires.filter(w=>!(w.b.d===L.id&&w.b.t==='A1'));commit();recompute();simReset();r=simRun();ok(r.dev[R.id]&&r.dev[R.id].coil,'只有右邊通電：右邊吸合');
    W('PWR','R',L.id,'A1');commit();recompute();r=simRun();ok(r.dev[R.id]&&r.dev[R.id].coil&&!(r.dev[L.id]&&r.dev[L.id].coil),'右邊吸合中再給左邊電：左邊吸不進去');
    ok(reviewIssues().some(i=>/可逆組/.test(i.t)&&/電氣互鎖/.test(i.t)),'審查：常閉輔助沒接線時提醒加電氣互鎖');
    W('PWR','R',L.id,'21');W(L.id,'22',R.id,'A1');W('PWR','R',R.id,'21');W(R.id,'22',L.id,'A1');commit();recompute();
    ok(!reviewIssues().some(i=>/可逆組/.test(i.t)),'兩台常閉輔助都接了：不再提醒');
    const n2=normalize(JSON.parse(JSON.stringify(S))).state;ok(JSON.stringify(n2.devices.find(d=>d.id===M.id).pair)===JSON.stringify(M.pair),'存檔讀回：可逆組的左右接觸器保留');
    // S-2×P11 用 21-22 常閉
    placing={tpl:'sl-2xp11',rot:0,o:{id:'__place',tag:'',tpl:'sl-2xp11',x:400,y:600,sheet:'plate'},bad:null};placeDrop();
    const M2=S.devices.find(d=>d.tpl==='sl-2xp11'),L2=dv(M2.pair[0]);ok(!!termOf(L2,'21')&&!termOf(L2,'13'),'S-2×P11 可逆組的接觸器輔助接點是 21-22 常閉');
    // S-2×P125T：可逆用本體
    placing={tpl:'sl-2xp125t',rot:0,o:{id:'__place',tag:'',tpl:'sl-2xp125t',x:700,y:300,sheet:'plate'},bad:null};placeDrop();
    const M3=S.devices.find(d=>d.tpl==='sl-2xp125t');ok(!!M3&&M3.pair.every(id=>dv(id).tpl==='sp125tr'),'S-2×P125T 可逆組：左右放的是可逆用 S-P125T 本體');
    // TH-P09 插在 S-P06 下方
    S=normalize({...box,devices:[D('PWR','field-power',0,-300,{sheet:'field'}),D('K6','sp06',300,200),D('F9','thp09',600,500),D('KA','my2n-220',900,300)]}).state;resetUi();
    const K6=dv('K6');hostSnap(dv('F9'),K6.x,K6.y+60);ok(dv('F9').on==='K6'&&nodeKey({d:'F9',t:'T1'})===nodeKey({d:'K6',t:'T1'}),'TH-P09 插在 S-P06 下方：銅片插進 2/T1，算同一點');
    ok(!tplOf({tpl:'thp09'}).fits.includes('sp16'),'TH-P09 不能裝到 S-P16');
    const t12=tplOf({tpl:'thp12'}).terms.filter(t=>/^9/.test(t.id)).sort((a,b)=>a.x-b.x).map(t=>t.id).join(',');ok(t12==='98,97,95,96','TH-P12 輔助端子左到右 98、97、95、96（實物照片）');
    return out;
  });
  await b.close();
  res.forEach(l=>console.log(l));errs.forEach(e=>console.log('✗ 頁面錯誤：'+e));
  const fail=res.filter(l=>l.startsWith('✗')).length+errs.length;
  console.log(fail?`\n失敗 ${fail} 項`:'\n全部通過');process.exit(fail?1:0);
})();

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
    // ========== 士林斷路器：NF、NV、BH、NVB ==========
    {const ser=x=>Object.keys(TPL).filter(id=>TPL[id].ser===x).length,T=id=>tplOf({tpl:id}),sz=id=>[T(id).w,T(id).h,T(id).d].join('×'),xs=(id,re)=>T(id).terms.filter(t=>re.test(t.id)).sort((a,b)=>a.x-b.x).map(t=>t.id).join(' ');
     ok(ser('NF 無熔線')===211&&ser('NV 漏電')===104&&ser('BH 分電盤')===69&&ser('NVB 住宅漏電')===50,`士林斷路器：NF ${ser('NF 無熔線')}、NV ${ser('NV 漏電')}、BH ${ser('BH 分電盤')}、NVB ${ser('NVB 住宅漏電')}`);
     ok(sz('nf100-3p50')==='75×130×90'&&sz('nf100h-3p50')==='90×155×90'&&sz('nf125c-3p100')==='75×130×90'&&sz('nf125-3p100')==='90×155×90','同框架不同型式的外形：NF100-CN 75×130、NF100-HN 90×155；NF125-CT 小框、NF125-SN 大框');
     ok(sz('nf250-3p200')==='105×165×92'&&sz('nf400-4p300')==='185×257×155'&&sz('nf800-3p800')==='210×275×155'&&sz('nv400-3p300')==='140×257×155','NF250、NF400、NF800、NV400 外形照型錄');
     ok(xs('nf125-4p100',/^(N|1|3|5)$/)==='N 1 3 5'&&xs('nv800-4p700',/\(2\)$|^[246]$/)==='N(2) 2 4 6','4P 左極是 N（照外形圖）：上 N 1 3 5、下 N 2 4 6');
     {const t=T('nf400-2p300'),a=t.terms.find(x=>x.id==='1'),c=t.terms.find(x=>x.id==='3');ok(t.w===140&&Math.abs(c.x-a.x-88)<0.5,'NF400 2P 用 3P 框架，端子在左右兩極');}
     ok(!Object.keys(TPL).some(id=>/^nv\d+.*-2p/.test(id))&&!Object.keys(TPL).some(id=>/^nf(630|800)-2p/.test(id)),'NV 只有 3P、4P；NF630、NF800 只有 3P、4P');
     ok(sz('bh100-1p20')==='25×95×77.5'&&sz('bpl100-3p50')==='75×74×74'&&sz('bah100-2p30')==='50×79×77.5','BH 螺栓式、BPL 插入式、BAH 外形照型錄');
     ok(xs('nvb50-1w15',/./)==='N N(2) 1 2'&&T('nvb50-1w15').w===25&&T('nvbh50-1n20').w===50&&T('nvbh50-2p20').w===75,'NVB 1P 2 線式（寬 25，N 在左）、NVB-50H 1P+N 寬 50、2P 寬 75');
     // 模擬：NF 主迴路、NV 測試按鈕漏電跳脫、4P 的 N 極也開閉
     S=normalize({box:{w:900,h:700,d:300,back:20},plate:{w:860,h:660},door:{w:900,h:700},ducts:[],glands:[],wires:[],
       devices:[{id:'PWR',tag:'PWR',tpl:'field-power',x:0,y:-300,sheet:'field'},{id:'Q',tag:'Q',tpl:'nf125-3p50',x:100,y:100,sheet:'plate'},{id:'E',tag:'E',tpl:'nv100-4p50',x:300,y:100,sheet:'plate'},
         {id:'LP',tag:'LP',tpl:'lamp',x:400,y:-300,sheet:'field'}]}).state;resetUi();
     let kk=0;const WW=(a,at,bb,bt)=>S.wires.push({id:'q'+(++kk),no:'Q'+kk,a:{d:a,t:at},b:{d:bb,t:bt},wps:[],gauge:.75,color:'black'});
     WW('PWR','R','Q','1');WW('PWR','S','Q','3');WW('Q','2','E','1');WW('Q','4','E','N');WW('E','2','LP','L/+');WW('E','N(2)','LP','N/−');commit();recompute();simReset();
     const lamp=()=>{const r=simRun();return !!(r.dev.LP&&r.dev.LP.on.length);};
     ok(!lamp(),'NF、NV 都 OFF：燈不亮');brkClick('Q');ok(!lamp(),'只有 NF ON：燈不亮');brkClick('E');ok(lamp(),'NF、NV 都 ON：燈亮（NV 4P 的 N 極也導通）');
     ok(simElems(devOf('E')).some(e=>e.k==='eltest'),'NV 有「測試」按鈕');SIMST.press.add('E|測試');lamp();SIMST.press.delete('E|測試');
     ok(!SIMST.on.E&&SIMST.btrip.E==='el'&&!lamp(),'按測試：NV 漏電跳脫，燈熄');brkClick('E');brkClick('E');ok(lamp(),'復歸後再 ON：燈亮');
     picked=null;}
    return out;
  });
  await b.close();
  res.forEach(l=>console.log(l));errs.forEach(e=>console.log('✗ 頁面錯誤：'+e));
  const fail=res.filter(l=>l.startsWith('✗')).length+errs.length;
  console.log(fail?`\n失敗 ${fail} 項`:'\n全部通過');process.exit(fail?1:0);
})();

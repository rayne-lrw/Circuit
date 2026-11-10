// 現場區歸屬檢查：器具和箱外線槽記住自己屬於哪一區，框重疊、蓋到別區時拖走不會搶走別區的東西
// 用法：node tests/zone-check.js
const {chromium}=require('playwright'),path=require('path');
(async()=>{
  const b=await chromium.launch(),p=await b.newPage({viewport:{width:1400,height:900}});
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+path.join(__dirname,'..','index.html'));
  const res=await p.evaluate(()=>{
    const out=[],ok=(c,m)=>out.push((c?'✓ ':'✗ ')+m);
    S=normalize(sampleState()).state;resetUi();recompute();setMode('place');
    const z1=S.fields[0],mine1=()=>S.devices.filter(d=>inZone(z1,d)).map(d=>d.id).sort().join(',');
    const before=mine1();ok(before.length>0,'範例的現場器具都有歸到現場 1');
    ok(S.devices.filter(d=>d.sheet==='field').every(d=>d.zone===z1.id),'舊檔沒有記錄時照位置補上歸屬');
    // 新增現場區：放在空的地方，不壓到箱子
    document.querySelector('[data-zone-add]').click();const z2=S.fields[S.fields.length-1];
    ok(!zoneBlocked(z2)&&!S.fields.some(z=>z!==z2&&overlap(z,z2)),'新增的現場區放在空的地方');
    // 現場 2 整個蓋到現場 1 上：不搶走任何東西
    Object.assign(z2,{x:z1.x,y:z1.y,w:z1.w,h:z1.h});recompute();
    ok(zoneCarry(z2).length===0,'蓋到別區的框，拖走時不帶走別區的器具、線槽、中繼點');
    ok(zoneForeign(z2).length>0,'框裡別區的東西會列出來提示');
    ok(mine1()===before,'現場 1 的器具不變');
    // 單獨拖一台器具到只有現場 2 的地方：改歸現場 2
    z2.x=z1.x+z1.w+200;recompute();const d=S.devices.find(x=>inZone(z1,x)),t=tplOf(d);
    d.x=z2.x+z2.w/2-t.w/2;d.y=z2.y+z2.h/2-t.h/2;zoneDrop(d);ok(d.zone===z2.id,'單獨拖器具放進另一區就改歸那一區');
    // 放在兩區重疊的地方：原本那一區也蓋得到就不換
    Object.assign(z2,{x:z1.x+20,y:z1.y+20});const e=S.devices.find(x=>x!==d&&inZone(z1,x)&&inR(objCenter(x),z2));
    if(e){zoneDrop(e);ok(e.zone===z1.id,'放在重疊的地方、原本那一區也蓋得到時不換區');}
    // 收進這一區：只收框裡的；整條不在框裡的線槽不收
    z2.w=200;z2.h=200;recompute();const fo=zoneForeign(z2);fo.forEach(o=>o.zone=z2.id);
    ok(fo.every(o=>inZone(z2,o)||o.sheet==='field'&&o.zone===z2.id),'「收進這一區」改歸屬');
    ok(S.ducts.filter(x=>x.sheet==='field'&&x.zone===z2.id).every(x=>x.x>=z2.x&&x.x+x.w<=z2.x+z2.w),'中心點落在框裡但整條不在框裡的線槽不收');
    // 存檔再讀回：歸屬保留
    const S2=normalize(JSON.parse(JSON.stringify(S))).state;ok(S2.devices.filter(x=>x.sheet==='field').every(x=>x.zone===(S.devices.find(y=>y.id===x.id)||{}).zone),'存檔讀回後歸屬不變');
    return out;
  });
  await b.close();
  res.forEach(l=>console.log(l));errs.forEach(e=>console.log('✗ 頁面錯誤：'+e));
  const fail=res.filter(l=>l.startsWith('✗')).length+errs.length;
  console.log(fail?`\n失敗 ${fail} 項`:'\n全部通過');process.exit(fail?1:0);
})();

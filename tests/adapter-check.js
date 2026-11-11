// 轉接座訊號對應檢查：轉接座（柏叡、三菱 A6TB）用排線（兩個連接器之間一條線）接到裝在基板上的 Q 系列模組，逐點確認模擬時 PLC 收到的點位正確
// - 連接器在圖上只算一個接點（CN1），針腳是成組接點的子導線（CN1.B20）；散線可以接在單一支針腳上
// - 輸入：QX41 裝在 1 槽（實際位址 X10～X2F），共點接 +24V；轉接座每個端子逐一接 0V，只有對應的那一個 X 會 ON，名稱是實際位址
// - 輸出：QY41P 裝在 2 槽（Y30～Y4F）；每個 Y 逐一 ON，只有接在對應端子上的繼電器吸合
// - 右側「端子 → PLC 點位」對照表自動推算的點位，和模擬實際 ON 的點一致；手動填的會蓋過自動
// 用法：node tests/adapter-check.js
const {chromium}=require('playwright'),path=require('path');
(async()=>{
  const b=await chromium.launch(),p=await b.newPage({viewport:{width:1400,height:900}});
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+path.join(__dirname,'..','index.html'));
  const res=await p.evaluate(()=>{
    const out=[],ok=(c,m)=>out.push((c?'✓ ':'✗ ')+m);
    const D=(id,tpl,x,y,ex={})=>({id,tag:id,tpl,x,y,sheet:'plate',...ex});
    const setup=(adp,mod,rack,acn)=>{
      S=normalize({box:{w:1200,h:800,d:300,back:20},plate:{w:1160,h:760},door:{w:900,h:700},ducts:[],glands:[],wires:[],
        devices:[D('PWR','field-power',0,-300,{sheet:'field'}),D('PS','drl120',900,500),D('B','q35b',20,20),D('A',adp,300,300),D('KA','my2n-24',900,300)]}).state;resetUi();
      [['P','q61p',0],['C','q06udvcpu',1],['M',mod,rack]].forEach(([id,tpl,r])=>{const d=D(id,tpl,0,0,{on:'B',rack:r});S.devices.push(d);placeOn(d,devOf('B'));});
      recompute();const n=ribbonConnect(devOf('A'),devOf('M'),'1',acn||'1');
      return n;
    };
    let k=0;const W=(a,at,bb,bt)=>S.wires.push({id:'t'+(++k),no:'T'+k,a:{d:a,t:at},b:{d:bb,t:bt},wps:[],gauge:.75,color:'black'});
    const base=()=>{S.wires=S.wires.filter(w=>w.cab||w.ribbon);W('PWR','R','P','L');W('PWR','S','P','N');W('PWR','R','PS','L');W('PWR','S','PS','N');};
    // 轉接座上和模組某支針相通的端子（不含牛角針腳本身）
    // 排線那一頭（轉接座）的牛角、和模組針腳同名的那一支，內部接到哪個端子
    const termFor=(modPin)=>{const a=devOf('A'),t=tplOf(a),w=S.wires.find(x=>x.ribbon);if(!w)return null;const sub=w.b.t+'.'+modPin;
      const e=(t.sim||[]).find(e=>e.k==='pass'&&(e.a===sub||e.b===sub));return e?(e.a===sub?e.b:e.a):null;};
    // ---------- 輸入 ----------
    ['bore-xo40m','bore-xh40m','bore-xu40m','bore-xw40m','bore-xn40m','bore-xv40m','bore-xo40m2','bore-dxo40mb','a6tbxy36'].forEach(adp=>{
      const acs=adp==='bore-xo40m2'?['1','2']:['1'];
      acs.forEach(acn=>{
        const n=setup(adp,'qx41',3,acn);if(!n){ok(false,`${adp}：接不上 QX41`);return;}
        const mc=tplOf(devOf('M')).conn['1'].pins,com=termFor('B01');ok(S.wires.filter(w=>w.ribbon).length===1&&!S.cables.length,`${adp}${acs.length>1?' 牛角 '+acn:''}：排線是一條線，不是一束芯線`);
        let bad=[],cnt=0,ptBad=[];
        Object.entries(mc).forEach(([pin,sig])=>{if(!/^X/.test(sig))return;
          const term=termFor(pin),want=qName(devOf('M'),sig);if(!term){bad.push(pin+' 沒有端子');return;}
          if(adpAuto(devOf('A'),term)!==want)ptBad.push(`${termLabel(devOf('A'),term)}→${adpAuto(devOf('A'),term)}≠${want}`);
          base();W('PS','+V1','A',com);W('PS','-V1','A',term);recompute();simReset();const r=simRun();
          const on=r.X.filter(x=>x.on).map(x=>x.name);if(on.length!==1||on[0]!==want)bad.push(`${termLabel(devOf('A'),term)}：要 ${want}，實際 ${on.join(',')||'無'}`);cnt++;});
        ok(cnt===32&&!bad.length,`${adp}${acs.length>1?' 牛角 '+acn:''} 接 QX41（1 槽）：32 個端子逐一接 0V，各自只有對應的 X10～X2F 一點 ON${bad.length?'；'+bad.slice(0,4).join('；'):''}`);
        ok(!ptBad.length,`${adp}${acs.length>1?' 牛角 '+acn:''}：對照表自動點位和模擬一致${ptBad.length?'；'+ptBad.slice(0,3).join('；'):''}`);
      });
    });
    // 板子上印字不變（配線看的），點位只在詳細資料
    setup('bore-xo40m','qx41',3);ok(termLabel(devOf('A'),'B20')==='B20'&&adpAuto(devOf('A'),'B20')==='X10','圖上端子仍顯示板上印字 B20；對照表顯示 X10');
    // ---------- 輸出 ----------
    ['bore-xo40m','bore-xw40m','bore-dxo40mb','a6tbxy36'].forEach(adp=>{
      const n=setup(adp,'qy41p',4);if(!n){ok(false,`${adp}：接不上 QY41P`);return;}
      const mc=tplOf(devOf('M')).conn['1'].pins,vp=termFor('B01'),cm=termFor('A01');let bad=[],cnt=0;
      Object.entries(mc).forEach(([pin,sig])=>{if(!/^Y/.test(sig))return;
        const term=termFor(pin),want=qName(devOf('M'),sig);
        base();W('PS','+V1','A',vp);W('PS','-V1','A',cm);W('A',term,'KA','14');W('KA','13','PS','+V1');recompute();simReset();
        let r=simRun();if(r.dev.KA&&r.dev.KA.coil)bad.push(`${want} 沒 ON 就吸合`);
        // 其他 Y 全部 ON、這一點 OFF：繼電器不能吸合
        Object.entries(mc).filter(([p2,s])=>/^Y/.test(s)&&s!==sig).forEach(([p2])=>SIMST.y.add('M|CN1.'+p2));r=simRun();if(r.dev.KA&&r.dev.KA.coil)bad.push(`其他點 ON 時 ${termLabel(devOf('A'),term)} 也吸合`);
        SIMST.y.clear();SIMST.y.add('M|CN1.'+pin);r=simRun();if(!(r.dev.KA&&r.dev.KA.coil))bad.push(`${want} ON，${termLabel(devOf('A'),term)} 的繼電器沒吸合`);
        if(!r.Y.some(y=>y.name===want))bad.push(`輸出清單沒有 ${want}`);cnt++;});
      ok(cnt===32&&!bad.length,`${adp} 接 QY41P（2 槽）：Y30～Y4F 逐點 ON，只有對應端子上的繼電器吸合${bad.length?'；'+bad.slice(0,4).join('；'):''}`);
    });
    // ---------- 接頭對散線：散線接在 QX41 連接器的單一支針腳 ----------
    setup('bore-xo40m','qx41',3);S.wires=S.wires.filter(w=>!w.ribbon);{
      const M=devOf('M'),mp=tplOf(M).conn['1'].pins,comPin=Object.keys(mp).find(p=>mp[p]==='COM'),xPin=Object.keys(mp).find(p=>mp[p]==='X05'),want=qName(M,'X05');
      base();W('PS','+V1','M','CN1.'+comPin);W('PS','-V1','M','CN1.'+xPin);recompute();simReset();const r=simRun(),on=r.X.filter(x=>x.on).map(x=>x.name);
      ok(on.length===1&&on[0]===want,`散線接在 QX41 CN1 的 ${xPin}（X05）：模擬只有 ${want} ON${on.length!==1?'；實際 '+on.join(','):''}`);
      ok(termLabel(M,'CN1.'+xPin)===`CN1-${xPin}(${want})`,`接點名稱顯示 CN1-${xPin}(${want})`);
      const n2=normalize(JSON.parse(JSON.stringify(S))).state;ok(n2.wires.some(w=>w.b.t==='CN1.'+xPin),'散線接在針腳：存檔讀回保留');
      // 建線彈窗：一端是連接器時選針腳；兩端都是連接器是排線
      draft={a:{d:'M',t:'CN1'},end:{d:'KA',t:'14'},wps:[]};openPop();ok(!!document.getElementById('pPin'),'從連接器拉線到一般端子：彈窗有「針腳」選單');
      draft.pin=xPin;finishWire();ok(S.wires.some(w=>w.a.d==='M'&&w.a.t==='CN1.'+xPin&&w.b.t==='14'),`選針腳 ${xPin} 建立：線接在 CN1.${xPin}`);
      draft={a:{d:'M',t:'CN1'},end:{d:'A',t:'CN1'},wps:[]};openPop();ok(!document.getElementById('pPin'),'連接器拉到連接器：不用選針腳');finishWire();
      ok(S.wires.some(w=>w.ribbon&&w.a.t==='CN1'&&w.b.t==='CN1'),'連接器拉到連接器：建立一條排線');
      ok(adpAuto(devOf('A'),'B20')===qName(M,'X00'),'接線模式拉的排線：轉接座對照表一樣自動推算');}
    // ---------- 舊檔：排線是一束芯線（每支針腳一芯、接在針腳接點上）→ 讀檔換成一條排線 ----------
    {const old={box:{w:1200,h:800,d:300,back:20},plate:{w:1160,h:760},door:{w:900,h:700},ducts:[],glands:[],devices:[D('B','q35b',20,20),D('M','qx41',0,0,{on:'B',rack:1}),D('A','bore-xo40m',300,300)],
        cables:[{id:'C1',no:'C1',spec:'排線 40P',ribbon:true,direct:true,cores:[{n:'B20',c:'gray',g:.3},{n:'A20',c:'gray',g:.3}]}],
        wires:[{id:'w1',no:'X10',a:{d:'M',t:'X00'},b:{d:'A',t:'CN-B20'},wps:[],gauge:.3,color:'gray',cab:'C1',core:'B20'},{id:'w2',no:'X20',a:{d:'M',t:'X10'},b:{d:'A',t:'CN-A20'},wps:[],gauge:.3,color:'gray',cab:'C1',core:'A20'},
          {id:'w3',no:'W3',a:{d:'M',t:'X01'},b:{d:'A',t:'B1'},wps:[],gauge:.75,color:'black'}]};
      S=normalize(old).state;resetUi();placeOn(devOf('M'),devOf('B'));recompute();
      ok(S.wires.filter(w=>w.ribbon).length===1&&!S.cables.length&&S.wires.find(w=>w.ribbon).a.t==='CN1','舊檔的 2 芯排線讀進來變成一條連接器對連接器的排線');
      ok(S.wires.some(w=>w.id==='w3'&&w.a.t==='CN1.B19'),'舊檔接在針腳接點（X01）的散線：換成 CN1.B19');
      ok(adpAuto(devOf('A'),'B20')===qName(devOf('M'),'X00'),'舊檔轉換後：轉接座對照表照樣推算');}
    // 兩個連接器的 64 點模組：轉接座分別接連接器 1、2，對照表分到 X00～X1F、X20～X3F
    S=normalize({box:{w:1200,h:800,d:300,back:20},plate:{w:1160,h:760},door:{w:900,h:700},ducts:[],glands:[],wires:[],
      devices:[D('B','q35b',20,20),D('A1','bore-xo40m',300,300),D('A2','bore-xo40m',450,300)]}).state;resetUi();
    {const m=D('M','qx42',0,0,{on:'B',rack:2});S.devices.push(m);placeOn(m,devOf('B'));recompute();
      ribbonConnect(devOf('A1'),m,'1');ribbonConnect(devOf('A2'),m,'2');
      ok(adpAuto(devOf('A1'),'B20')==='X00'&&adpAuto(devOf('A2'),'B20')==='X20'&&adpAuto(devOf('A2'),'A5')==='X3F','QX42：連接器 1 的 B20 是 X00；連接器 2 的 B20 是 X20、A5 是 X3F');
      ok(ribbonConnect(devOf('A1'),m,'2')===0,'同一個牛角不能接兩條排線');}
    // 手動改點位（轉接座不一定接 PLC）
    picked={k:'dev',id:'A1'};renderDetail();const inp=document.querySelector('#detail [data-point="B20"]');
    ok(!!inp&&inp.placeholder==='X00','對照表的 B20 欄灰字顯示 X00');
    inp.value='啟動按鈕';inp.dispatchEvent(new Event('change'));ok(devOf('A1').points.B20==='啟動按鈕'&&adpPoint(devOf('A1'),'B20')==='啟動按鈕','手動填的點位蓋過自動');
    const n2=normalize(JSON.parse(JSON.stringify(S))).state;ok(n2.devices.find(d=>d.id==='A1').points.B20==='啟動按鈕','手動點位存檔讀回');
    picked={k:'dev',id:'A1'};renderDetail();const i2=document.querySelector('#detail [data-point="B20"]');i2.value='';i2.dispatchEvent(new Event('change'));ok(!devOf('A1').points,'清空就恢復自動');
    // 沒接 PLC 的轉接座：對照表空白，也能填
    picked={k:'dev',id:'A2'};S.wires=S.wires.filter(w=>w.b.d!=='A2');recompute();renderDetail();ok(document.querySelector('#detail [data-point="B20"]').placeholder==='—','沒接排線：自動點位空白');
    return out;
  });
  await b.close();
  res.forEach(l=>console.log(l));errs.forEach(e=>console.log('✗ 頁面錯誤：'+e));
  const fail=res.filter(l=>l.startsWith('✗')).length+errs.length;
  console.log(fail?`\n失敗 ${fail} 項`:'\n全部通過');process.exit(fail?1:0);
})();

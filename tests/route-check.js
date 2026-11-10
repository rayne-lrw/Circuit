// 走線回歸測試：每次修改走線相關程式後執行，全部通過才發布。
// 用法：node tests/route-check.js [另外的專案 JSON 檔 ...]
// 需要 Playwright（require('playwright')）與 Chromium。
//
// 每條線檢查：
//   1. 沒有警告的線不可穿過起訖兩端以外的器具（警告與實際一致）
//   2. 自動路徑的第一段、最後一段照接點的出線方向
//   3. 有中繼點的線（手動路徑）要經過每個中繼點
//   4. 不可在同一條直線上來回折返（電纜芯線分段檢查）
//   5. 中繼點在出線方向反方向時直接往中繼點出線；有中繼點的線不可在中繼點前後折返
//   6. 電纜：芯線接到剝線點、芯數與長度正確、沒有電纜警告
const path=require('path'),fs=require('fs');
const {chromium}=require('playwright');
const INDEX='file://'+path.resolve(__dirname,'..','index.html');

// 情境：在頁面裡執行，回傳 {name, state, expectClean:[線號...]}
const SCENARIOS=[
  {name:'範例電控箱',build:()=>({state:normalize(sampleState()).state,expectClean:'all'})},
  {name:'T 字接法線槽＋轉 270° 濾波器',build:()=>{
    const st=normalize({box:{w:1380,h:600,d:300,back:20},plate:{w:1300,h:500},door:{w:400,h:600},doorMode:'console',
      devices:[{id:'FL1',tpl:'fn3270',x:305,y:415,rot:270},{id:'Q5',tpl:'ic60-3P40A',x:523,y:362},{id:'K1',tpl:'lc1d09',x:523,y:199}],
      ducts:[{id:'D2',x:490,y:0,w:695,h:33,dp:65},{id:'D3',x:490,y:33,w:33,h:432,dp:65},{id:'D4',x:490,y:467,w:695,h:33,dp:65},{id:'D6',x:523,y:129,w:629,h:33,dp:65},{id:'D7',x:523,y:312,w:629,h:33,dp:65}],
      glands:[],wires:[]}).state;
    const W=(no,a,at,b,bt,wps)=>st.wires.push({id:'w'+no,no,a:{d:a,t:at},b:{d:b,t:bt},wps:wps||[],gauge:3.5,color:'black'});
    W('T1','FL1',"L1'",'Q5','1');W('T2','FL1',"L2'",'Q5','3');W('T3','FL1',"L3'",'Q5','5');W('T4','FL1',"PE'",'Q5','2');W('T5','Q5','6','K1','L1');
    // 中繼點點在 D3 與 D4 交界（使用者回報的情況）與 D3 中段
    W('M1','FL1',"L2'",'Q5','4',[{x:506,y:466}]);
    W('M2','FL1',"L3'",'K1','L2',[{x:506,y:300},{x:506,y:150}]);
    // 中繼點點在 D3（靠近 D7 轉角）：其餘照樣自動，最後要從上方的 D6 接進 K1，不可緊貼 K1 上緣
    W('M3','Q5','5','K1','L2',[{x:506,y:328}]);
    return {state:st,expectClean:['T1','T2','T3','T4','T5','M1','M2','M3'],expectVia:{M3:['D7','D3','D6']}};
  }},
  {name:'正面附件與伺服電池',build:()=>{
    const st=normalize(sampleState()).state,k=st.devices.find(d=>d.id==='K0');
    st.devices.push({id:'KX1',tag:'KX1',tpl:'ladn40',sheet:'plate',x:k.x+.6,y:k.y+19,on:'K0'});
    const sv=st.devices.find(d=>d.id==='SV2');st.devices.push({id:'BT1',tag:'BT1',tpl:'mrbat6v1',sheet:'plate',x:sv.x+6,y:sv.y+168,on:'SV2'});
    st.wires.push({id:'wa',no:'A1',a:{d:'KX1',t:'53'},b:{d:'X1',t:'5B'},wps:[],gauge:.75,color:'blue'},{id:'wb',no:'A2',a:{d:'BT1',t:'BAT'},b:{d:'SV2',t:'CN4'},wps:[],gauge:.5,color:'black'});
    return {state:st,expectClean:['A1','A2']};
  }},
  {name:'側面與頂部出線口',build:()=>{
    const st=normalize(sampleState()).state,o={x:(st.plate.w-st.box.w)/2,y:(st.plate.h-st.box.h)/2};
    st.glands=[{id:'G1',side:'left',x:0,y:o.y+700,spec:'M25 浪管接頭'},{id:'G2',side:'top',x:o.x+600,y:0,spec:'M25 浪管接頭'},{id:'G3',side:'bottom',x:300,y:0,spec:'M25 浪管接頭'}];
    st.cables.forEach(c=>{if(c.no==='C01')c.gland='G1';if(c.no==='C06')c.gland='G2';});
    return {state:st,expectClean:'all'};
  }},
  {name:'箱內隔離線、備用芯與拖曳剝線點',build:()=>{
    const st=normalize(sampleState()).state;S=st;
    const c=newCable('C90','CSA細纜 0.3mm²*4C 耐繞曲隔離電纜');
    [['5A','1'],['6A','3'],['7A','5'],['8A','6']].forEach(([a,b],i)=>attachCore(makeCoreWire({d:'X1',t:a},{d:'EX1',t:b},'S9'+i),c));
    attachCore(makeCoreWire({d:'X1',t:'9A'},{d:'E1',t:'8'},'SH90'),c,'SH');
    // 3 芯只接 2 芯，第 3 芯備用
    const c2=newCable('C91','CSA細纜 0.75mm²*3C 棕藍/黃綠');
    attachCore(makeCoreWire({d:'KA1',t:'14'},{d:'KA3',t:'13'},'S95'),c2);attachCore(makeCoreWire({d:'KA2',t:'14'},{d:'KA3',t:'9'},'S96'),c2);
    // 外部電纜 C05 的箱內剝線點拖到線槽裡別的位置，填現場長度
    computeRoutes();
    const c5=st.cables.find(x=>x.no==='C05'),r=CABROUTES.get(c5.id),d=locate(r.a,'plate');
    c5.bo.a=axis(d)==='h'?{x:Math.max(d.x+5,r.a.x-60),y:r.a.y}:{x:r.a.x,y:Math.max(d.y+5,r.a.y-60)};c5.fieldLen=5000;
    return {state:st,expectClean:'all',expectCable:{C90:{cores:5,ext:false},C91:{cores:2,ext:false},C05:{field:5000,ext:true}}};
  }},
  {name:'中繼點在出線方向反方向',build:()=>{
    const st=normalize(sampleState()).state;
    // Q1·1 朝上，中繼點放在 Q1 正下方的線槽：要直接往下接到中繼點，不可先往上跑再繞回來
    st.wires.push({id:'tb1',no:'B1',a:{d:'Q1',t:'1'},b:{d:'K0',t:'A1'},wps:[{x:259,y:342}],gauge:.75,color:'black'});
    // 中繼點不在器具正後方：照原本的出線方向
    st.wires.push({id:'tb2',no:'B2',a:{d:'K0',t:'A1'},b:{d:'Q1',t:'1'},wps:[{x:240,y:42}],gauge:.75,color:'black'});
    return {state:st,expectClean:['B1','B2'],expectBack:{B1:true,B2:false}};
  }},
  {name:'線圈二極體自動接線與接反檢查',build:()=>{
    const st=normalize(sampleState()).state;S=st;
    const k=st.devices.find(d=>d.id==='K0'),r=st.devices.find(d=>d.id==='KA1');
    st.devices.push({id:'DD1',tag:'DD1',tpl:'diode-coil',x:k.x,y:k.y,sheet:'plate',on:'K0'},{id:'DD2',tag:'DD2',tpl:'diode-coil',x:r.x,y:r.y,sheet:'plate',on:'KA1'});
    placeOn(st.devices.find(d=>d.id==='DD1'),k);placeOn(st.devices.find(d=>d.id==='DD2'),r);
    return {state:st,expectClean:'all',expectCoil:{DD1:['A1','A2'],DD2:['14','13']}};
  }},
  {name:'箱外器具經過出線口',build:()=>{
    const st=normalize(sampleState()).state;S=st;
    st.glands.push({id:'G9',side:'top',x:250,y:0,spec:'M20-14 電纜固定頭'});
    st.devices.push({id:'TB5',tag:'TB5',tpl:'nht60',x:300,y:-110,sheet:'plate'});
    const t=resolveTpl('nht60').terms;
    st.wires.push({id:'tt1',no:'TT1',a:{d:'TB5',t:t[0].id},b:{d:'SV1',t:'L11'},wps:[],gauge:1.25,color:'red'},{id:'tt2',no:'TT2',a:{d:'K0',t:'A1'},b:{d:'TB5',t:t[1].id},wps:[],gauge:1.25,color:'blue'});
    return {state:st,expectClean:['TT1','TT2'],expectGland:{TT1:'G9',TT2:'G9'}};
  }},
  {name:'出線口進出（四面、兩個方向、散線與電纜）',build:()=>{
    const st=normalize(sampleState()).state;S=st;const o=boxOrigin();
    // 箱頂兩個（一個在線槽端頭外、一個在線槽正上方）、左右側各一、原本箱底三個
    st.glands.push({id:'GT1',side:'top',x:720,y:0,spec:'M20'},{id:'GT2',side:'top',x:300,y:0,spec:'M20'},{id:'GL',side:'left',x:0,y:o.y+500,spec:'M20'},{id:'GR',side:'right',x:0,y:o.y+420,spec:'M20'});
    st.glands.forEach(g=>{if(g.side==='left')g.x=o.x;if(g.side==='right')g.x=o.x+S.box.w;if(g.side==='top')g.y=o.y;});
    const gl=['GT1','GT2','GL','GR','G1','G3'],ins=[['K0','A1'],['Q1','1'],['X1','10A'],['PS1','L'],['KA1','14'],['E1','5']],fld=[['M1','U'],['M1','V'],['M2','U'],['M2','V'],['M3','U'],['M3','V']];
    const exp={};
    gl.forEach((g,i)=>{
      // 從現場往箱內畫（a 在現場）與從箱內往外畫
      st.wires.push({id:'gx'+i,no:'GX'+i,a:{d:fld[i][0],t:fld[i][1]},b:{d:ins[i][0],t:ins[i][1]},wps:[],gauge:.75,color:'black',gland:g});
      st.wires.push({id:'gy'+i,no:'GY'+i,a:{d:ins[(i+1)%6][0],t:ins[(i+1)%6][1]},b:{d:'PH2',t:i%2?'藍':'棕'},wps:[],gauge:.75,color:'blue',gland:g});
      exp['GX'+i]=g;exp['GY'+i]=g;
      // 電纜：從現場那端開始接（attachCore 會把現場端放到 B 端）
      const c=newCable('CG'+i,'CSA細纜 0.5mm²*3C 棕藍黑');c.gland=g;
      attachCore(makeCoreWire({d:'PH1',t:'黑'},{d:'X1',t:(14+i)+'A'},'CG'+i+'a'),c);
      exp['cab:CG'+i]=g;
    });
    return {state:st,expectClean:Object.keys(exp).filter(k=>!k.startsWith('cab:')),expectWall:exp};
  }},
  {name:'電纜外皮繞過現場器具（剝線點在器具另一側）',build:()=>{
    const st=normalize(sampleState()).state;S=st;const o=boxOrigin();
    // 現場區搬到箱子上方；吊掛按鈕盒只接上方的 COM，剝線點在盒子上面，外皮從下面過來
    const z=st.fields[0],dy=(o.y-40-z.h)-z.y;st.devices.filter(d=>d.sheet==='field').forEach(d=>d.y+=dy);z.y+=dy;
    st.devices.push({id:'CB1',tag:'CB1',tpl:'ths62',x:z.x+z.w-90,y:z.y+10,sheet:'field'});
    const c1=newCable('CB01','');attachCore(makeCoreWire({d:'X1',t:'14A'},{d:'CB1',t:'COM'},'CB1a'),c1,'1');
    const c2=newCable('CB02','');[['15A','COM'],['16A','上'],['17A','下']].forEach(([a,b],i)=>attachCore(makeCoreWire({d:'X1',t:a},{d:'CB1',t:b},'CB2'+i),c2,String(i+1)));
    return {state:st,expectClean:[]};
  }},
  {name:'接頭電纜（兩端接頭、一端接頭）',build:()=>{
    const st=normalize(sampleState()).state;S=st;const f=st.devices.find(d=>d.sheet==='field');
    // 伺服放在底板上空的地方（不壓到其他器具和線槽）
    const T=resolveTpl('je40'),busy=[...st.devices.filter(d=>d.sheet==='plate').map(d=>rectOf('dev',d)),...st.ducts.filter(d=>d.sheet==='plate')];
    let at=null;for(let y=10;y+T.h<st.plate.h&&!at;y+=10)for(let x=10;x+T.w<st.plate.w&&!at;x+=10){const r={x:x-8,y:y-8,w:T.w+16,h:T.h+16};if(!busy.some(b=>overlap(r,b)))at={x,y};}
    st.devices.push({id:'SVP',tag:'SVP',tpl:'je40',x:at.x,y:at.y,sheet:'plate'},{id:'MP',tag:'MP',tpl:'hgkn43',x:f.x+260,y:f.y,sheet:'field'});
    // 兩端都是接頭：沒有芯線，外皮從 CN2 走到 ENC
    const c1=newCable('CP1','伺服編碼線 6C');c1.plug={a:{d:'SVP',t:'CN2'},b:{d:'MP',t:'ENC'}};
    // 一端接頭：CN1A 接頭到馬達 U、V（每一芯是接頭裡不同腳位）
    const c2=newCable('CP2','0.75mm²*4C');c2.plug={a:{d:'SVP',t:'CN1A'}};
    [['U','1'],['V','2']].forEach(([t,k])=>attachCore(makeCoreWire({d:'SVP',t:'CN1A'},{d:'MP',t},'',c2),c2,k));
    return {state:st,expectClean:[],expectPlug:{CP1:{a:null,b:null,cores:0},CP2:{a:null,b:'bo',cores:2}}};
  }},
  {name:'出線口在器具正上方、中繼點在器具左邊（拉線預覽和放開後一樣）',build:arg=>{
    // 箱頂出線口剛好在大器具正上方，左邊沒有線槽；在器具左邊放一個中繼點，要往左下走進下方線槽的端頭，不穿過器具、不折回
    const st=normalize({box:{w:700,h:600,d:300,back:20},plate:{w:620,h:500},door:{w:700,h:600},fields:[{id:'Z1',name:'現場',x:-40,y:-450,w:700,h:300}],
      devices:[{id:'SV1',tag:'SV1',tpl:'j4700',x:118,y:17,sheet:'plate'},{id:'SV3',tag:'SV3',tpl:'je40',x:420,y:147,sheet:'plate'},{id:'M3',tag:'M3',tpl:'hgkn43',x:390,y:-335,sheet:'field',rot:180}],
      ducts:[{id:'D1',x:115,y:335,w:375,h:45,dp:65},{id:'D3',x:490,y:33,w:33,h:432,dp:65}],glands:[{id:'G1',side:'top',x:125,y:0,spec:'M32 浪管接頭'}],wires:[]}).state;
    S=st;st.glands.forEach(g=>g.y=boxOrigin().y);
    st.wires.push({id:'lw',no:'LW',a:{d:'M3',t:'U'},b:{d:'SV3',t:'U'},wps:[{x:105,y:25}],gauge:.75,color:'black',gland:'G1'});
    if(arg==='cab'){
      // 電纜：拉芯線時放的中繼點要改放到外皮上，外皮一樣往左走（只經過 D1）
      st.wires=[];const c=newCable('CL','伺服動力線 JE 0.75mm²*4C');c.gland='G1';
      const cw={id:'lc',no:'LC',a:{d:'M3',t:'V'},b:{d:'SV3',t:'V'},wps:[{x:105,y:25}],gauge:.75,color:'black'};st.wires.push(cw);attachCore(cw,c,'V');
      return {state:st,expectClean:['LC'],expectVia:{'cab:CL':['D1']}};
    }
    return {state:st,expectClean:['LW'],expectPrev:['LW']};
  }},
  {name:'兩台小器具接點靠很近（面對面或互相垂直，不繞路）',build:()=>{
    const T=(side,x)=>({n:'測'+side,b:'',w:30,h:30,d:20,pre:'T',f:'#54595b',sheet:'field',terms:[{id:'P',x,y:15,side,desc:''},{id:'Q',x,y:22,side,desc:''}]});
    const st=normalize({box:{w:600,h:500,d:300,back:20},plate:{w:500,h:400},door:{w:600,h:500},fields:[{id:'Z1',name:'現場',x:0,y:-400,w:600,h:300}],tpls:{cl:T('right',26.5),cr:T('left',4),ct:{n:'測上',b:'',w:30,h:30,d:20,pre:'T',f:'#54595b',sheet:'field',terms:[{id:'P',x:15,y:4,side:'top',desc:''}]}},
      devices:[{id:'A',tag:'A',tpl:'cl',x:100,y:-300,sheet:'field'},{id:'B',tag:'B',tpl:'cr',x:140,y:-300,sheet:'field'},{id:'C',tag:'C',tpl:'cl',x:100,y:-200,sheet:'field'},{id:'D',tag:'D',tpl:'cr',x:140,y:-205,sheet:'field'},
        // 方向互相垂直：E 的接點朝上，剛好落在 F 往左出線點和 F 左緣之間（差 1 mm）
        {id:'E',tag:'E',tpl:'ct',x:180,y:-140,sheet:'field'},{id:'F',tag:'F',tpl:'cr',x:200,y:-185,sheet:'field'}],ducts:[],glands:[],wires:[]}).state;S=st;
    st.wires.push({id:'f1',no:'F1',a:{d:'A',t:'P'},b:{d:'B',t:'P'},wps:[],gauge:.75,color:'black'},{id:'f2',no:'F2',a:{d:'C',t:'P'},b:{d:'D',t:'P'},wps:[],gauge:.75,color:'black'},{id:'f3',no:'F3',a:{d:'E',t:'P'},b:{d:'F',t:'P'},wps:[],gauge:.75,color:'black'});
    return {state:st,expectClean:['F1','F2','F3'],expectPrev:['F1','F2','F3'],expectShort:['F1','F2','F3']};
  }},
  {name:'外線在箱子旁邊（不在現場區）放中繼點',build:()=>{
    const st=normalize(sampleState()).state;S=st;const o=boxOrigin();
    const z=st.fields[0],dy=(o.y-40-z.h)-z.y;st.devices.filter(d=>d.sheet==='field').forEach(d=>d.y+=dy);z.y+=dy;
    st.glands=[{id:'GT',side:'top',x:o.x+300,y:o.y,spec:'M25'}];
    const m=st.devices.filter(d=>d.sheet==='field').sort((a,b)=>a.x-b.x)[0];
    // 中繼點在箱子左邊外側（不在現場區）、和箱子右邊外側
    st.wires.push({id:'sw1',no:'SW1',a:{d:m.id,t:tplOf(m).terms[0].id},b:{d:'X1',t:'14A'},wps:[{x:o.x-30,y:o.y+60}],gauge:.75,color:'black',gland:'GT'});
    st.wires.push({id:'sw2',no:'SW2',a:{d:'X1',t:'15A'},b:{d:m.id,t:tplOf(m).terms[1].id},wps:[{x:o.x+S.box.w+30,y:o.y-30}],gauge:.75,color:'black',gland:'GT'});
    return {state:st,expectClean:[],expectGland:{SW1:'GT',SW2:'GT'}};
  }},
  {name:'同一個出線口多條線（出線口正外面不小折）',build:()=>{
    const st=normalize(sampleState()).state;S=st;const o=boxOrigin();
    const z=st.fields[0],dy=(o.y-40-z.h)-z.y;st.devices.filter(d=>d.sheet==='field').forEach(d=>d.y+=dy);z.y+=dy;
    st.glands=[{id:'GJ',side:'top',x:o.x+300,y:o.y,spec:'M32'}];
    // 出線口正上方一排三個感測器，各用一條電纜走同一個出線口進箱（電纜外皮會錯開）；現場區先清空，上方沒有別的東西要避開
    const fd=new Set(st.devices.filter(d=>d.sheet==='field').map(d=>d.id));st.devices=st.devices.filter(d=>!fd.has(d.id));st.wires=st.wires.filter(w=>!fd.has(w.a.d)&&!fd.has(w.b.d));st.cables=st.cables.filter(c=>st.wires.some(w=>w.cab===c.id));
    const nos=[];[-20,0,20].forEach((dx,i)=>{const id='PJ'+i;st.devices.push({id,tag:id,tpl:'pzg101',x:o.x+300+dx-25,y:z.y+40,sheet:'field',rot:180});
      const c=newCable('CJ'+i,'CSA細纜 0.5mm²*3C 棕藍黑');c.gland='GJ';attachCore(makeCoreWire({d:id,t:'黑'},{d:'X1',t:(10+i)+'A'},'CJ'+i+'a'),c);nos.push('CJ'+i+'a');});
    return {state:st,expectClean:[],expectNoJog:nos};
  }},
  {name:'箱外線槽（走線架）',build:arg=>{
    const st=normalize(sampleState()).state;S=st;const o=boxOrigin();
    const z=st.fields[0],dy=(o.y-120-z.h)-z.y;st.devices.filter(d=>d.sheet==='field').forEach(d=>d.y+=dy);z.y+=dy;
    const fd=new Set(st.devices.filter(d=>d.sheet==='field').map(d=>d.id));st.devices=st.devices.filter(d=>!fd.has(d.id));st.wires=st.wires.filter(w=>!fd.has(w.a.d)&&!fd.has(w.b.d));st.cables=st.cables.filter(c=>st.wires.some(w=>w.cab===c.id));
    st.glands=[{id:'GK',side:'top',x:o.x+700,y:o.y,spec:'M32'}];
    // 現場區和箱子之間放一條橫向箱外線槽；三個感測器在左邊，線要沿線槽走到右邊的出線口
    st.ducts.push({id:'DF',x:o.x+20,y:o.y-90,w:S.box.w-40,h:40,dp:60,sheet:'field'});
    const nos=[];[0,1,2].forEach(i=>{const id='PK'+i;st.devices.push({id,tag:id,tpl:'pzg101',x:z.x+40+i*70,y:z.y+z.h-60,sheet:'field',rot:180});
      st.wires.push({id:'fk'+i,no:'FK'+i,a:{d:id,t:'黑'},b:{d:'X1',t:(10+i)+'A'},wps:[],gauge:.75,color:'black'});nos.push('FK'+i);});
    const exp={};nos.forEach(n=>exp[n]='GK');
    if(arg==='far'){
      // 線槽只放在左邊一小段；右邊遠處的感測器走右邊的出線口，不可以為了線槽繞過去
      st.ducts=st.ducts.filter(d=>d.id!=='DF');st.ducts.push({id:'DF',x:o.x+20,y:o.y-90,w:200,h:40,dp:60,sheet:'field'});
      st.glands.push({id:'GR',side:'top',x:o.x+S.box.w-60,y:o.y,spec:'M25'});
      const far=[];[0,1].forEach(i=>{const id='PR'+i;st.devices.push({id,tag:id,tpl:'pzg101',x:o.x+S.box.w-160+i*70,y:z.y+z.h-60,sheet:'field',rot:180});
        st.wires.push({id:'fr'+i,no:'FR'+i,a:{d:id,t:'黑'},b:{d:'X1',t:(14+i)+'A'},wps:[],gauge:.75,color:'black',gland:'GR'});far.push('FR'+i);});
      return {state:st,expectClean:far,expectFieldDuct:{duct:'DF',wires:[],avoid:far}};
    }
    return {state:st,expectClean:nos,expectGland:exp,expectFieldDuct:{duct:'DF',wires:nos}};
  }},
  {name:'出線口進出（現場區在箱子上方）',build:()=>{
    const st=normalize(sampleState()).state;S=st;const o=boxOrigin();
    // 現場區搬到箱子上方（和你的專案一樣），區內器具一起搬
    const z=st.fields[0],dy=(o.y-40-z.h)-z.y;st.devices.filter(d=>d.sheet==='field').forEach(d=>d.y+=dy);z.y+=dy;
    // 箱頂兩個（一個在線槽端頭外、一個在線槽正上方）、左右側各一、原本箱底三個
    st.glands.push({id:'GT1',side:'top',x:720,y:0,spec:'M20'},{id:'GT2',side:'top',x:300,y:0,spec:'M20'},{id:'GL',side:'left',x:0,y:o.y+500,spec:'M20'},{id:'GR',side:'right',x:0,y:o.y+420,spec:'M20'});
    st.glands.forEach(g=>{if(g.side==='left')g.x=o.x;if(g.side==='right')g.x=o.x+S.box.w;if(g.side==='top')g.y=o.y;});
    const gl=['GT1','GT2','GL','GR','G1','G3'],ins=[['K0','A1'],['Q1','1'],['X1','10A'],['PS1','L'],['KA1','14'],['E1','5']],fld=[['M1','U'],['M1','V'],['M2','U'],['M2','V'],['M3','U'],['M3','V']];
    const exp={};
    gl.forEach((g,i)=>{
      // 從現場往箱內畫（a 在現場）與從箱內往外畫
      st.wires.push({id:'gx'+i,no:'GX'+i,a:{d:fld[i][0],t:fld[i][1]},b:{d:ins[i][0],t:ins[i][1]},wps:[],gauge:.75,color:'black',gland:g});
      st.wires.push({id:'gy'+i,no:'GY'+i,a:{d:ins[(i+1)%6][0],t:ins[(i+1)%6][1]},b:{d:'PH2',t:i%2?'藍':'棕'},wps:[],gauge:.75,color:'blue',gland:g});
      exp['GX'+i]=g;exp['GY'+i]=g;
      // 電纜：從現場那端開始接（attachCore 會把現場端放到 B 端）
      const c=newCable('CG'+i,'CSA細纜 0.5mm²*3C 棕藍黑');c.gland=g;
      attachCore(makeCoreWire({d:'PH1',t:'黑'},{d:'X1',t:(14+i)+'A'},'CG'+i+'a'),c);
      exp['cab:CG'+i]=g;
    });
    return {state:st,expectClean:Object.keys(exp).filter(k=>!k.startsWith('cab:')),expectWall:exp};
  }},
  {name:'不進線槽與旋轉器具',build:()=>{
    const st=normalize({box:{w:900,h:700,d:300,back:20},plate:{w:800,h:600},door:{w:900,h:700},
      devices:[{id:'Q1',tpl:'fuji-bw50',x:100,y:300,rot:270},{id:'FL1',tpl:'fn3270',x:300,y:290,rot:270},{id:'Q2',tpl:'fuji-bw50',x:100,y:100,rot:90}],
      ducts:[{id:'D1',x:20,y:20,w:700,h:45,dp:65}],glands:[],wires:[]}).state;
    st.wires.push({id:'wd',no:'D1',a:{d:'Q1',t:'2'},b:{d:'FL1',t:'L1'},wps:[],gauge:3.5,color:'black',direct:true});
    return {state:st,expectClean:['D1']};
  }},
];

function checkInPage(expectClean,expectVia,expectCable,expectBack,expectCoil,expectGland,expectWall,expectPlug,expectPrev,expectShort,expectNoJog,expectFieldDuct){
  const res=[];
  const fam=id=>famIds(id);
  const crosses=(w,pts)=>{
    const ex=[...fam(w.a.d),...fam(w.b.d)],hit=new Set();
    // 只檢查箱體內的線段：面板與現場區沒有線槽可繞，本來就不做阻擋檢查
    const B=boxRect();
    for(let i=1;i<pts.length;i++){const m={x:(pts[i-1].x+pts[i].x)/2,y:(pts[i-1].y+pts[i].y)/2};if(!inR(m,B))continue;const d=segHits(pts[i-1].x,pts[i-1].y,pts[i].x,pts[i].y,ex);if(d)hit.add(d.tag);}
    return [...hit];
  };
  const dirOf=(a,b)=>Math.abs(b.x-a.x)>Math.abs(b.y-a.y)?(b.x>a.x?'right':'left'):(b.y>a.y?'bottom':'top');
  const onPath=(pts,q)=>pts.some((a,i)=>{if(!i)return false;const b=pts[i-1];
    return q.x>=Math.min(a.x,b.x)-.5&&q.x<=Math.max(a.x,b.x)+.5&&q.y>=Math.min(a.y,b.y)-.5&&q.y<=Math.max(a.y,b.y)+.5&&(Math.abs(a.x-b.x)<.01||Math.abs(a.y-b.y)<.01);});
  for(const w of S.wires){
    const r=ROUTES.get(w.id);if(!r){res.push({no:w.no,ok:false,msg:'沒有路徑'});continue;}
    const p=r.pts,msgs=[];
    const want=expectClean==='all'||expectClean.includes(w.no);
    const cx=crosses(w,p);
    if(!r.warn&&cx.length&&!plugWire(w)) msgs.push('沒有警告卻穿過 '+cx.join('、'));
    if(want&&r.warn) msgs.push('預期沒有警告，實際：'+r.warn);
    const manual=(w.wps||[]).length>0;
    const local=famIds(w.a.d).includes(w.b.d); // 主體與自己的附件之間：直接在器具前面連，不檢查出線方向
    if(!manual&&!w.direct&&!local&&!r.warn&&p.length>1){
      const A=endpoint(w.a,0),B=endpoint(w.b,0);
      let i=1;while(i<p.length&&Math.hypot(p[i].x-p[0].x,p[i].y-p[0].y)<.5)i++;
      if(A.ox||A.oy){i++;while(i<p.length&&Math.hypot(p[i].x-p[i-1].x,p[i].y-p[i-1].y)<.5)i++;} // 有出線偏移：第一段是橫移，看下一段
      if(i<p.length&&A.side&&devOf(w.a.d).sheet!=='field'&&dirOf(p[(A.ox||A.oy)?i-1:0],p[i])!==A.side) msgs.push(`起點出線方向應為 ${A.side}，實際 ${dirOf(p[0],p[i])}`);
      let j=p.length-2;while(j>=0&&Math.hypot(p[j].x-p[p.length-1].x,p[j].y-p[p.length-1].y)<.5)j--;
      if(B.ox||B.oy){j--;while(j>=0&&Math.hypot(p[j].x-p[j+1].x,p[j].y-p[j+1].y)<.5)j--;}
      if(j>=0&&B.side&&devOf(w.b.d).sheet!=='field'&&dirOf(p[(B.ox||B.oy)?j+1:p.length-1],p[j])!==B.side) msgs.push(`終點進線方向應為 ${B.side}，實際 ${dirOf(p[p.length-1],p[j])}`);
    }
    // 中繼點在反方向：第一段直接往中繼點那邊出線，不可先往接點方向拉出去
    if(expectBack&&w.no in expectBack){const E=endpoint(w.a,0),O={top:'bottom',bottom:'top',left:'right',right:'left'}[E.side],d=dirOf(p[0],p[1]);
      if(expectBack[w.no]&&d!==O)msgs.push(`應直接往中繼點方向（${O}）出線，實際 ${d}`);if(!expectBack[w.no]&&d!==E.side)msgs.push(`中繼點不在器具正後方，應照原本方向 ${E.side} 出線，實際 ${d}`);}
    if(w.wps&&w.wps.length&&ISSUES.some(i=>i.id===w.id&&i.t.includes('折返')))msgs.push('中繼點造成折返');
    // 出線口正外面（箱外 30 mm 內）不可以有很短的橫移（多條線錯開造成的小折角）
    if(expectNoJog&&expectNoJog.includes(w.no)){const o=boxOrigin();for(let i=1;i<p.length;i++){const a=p[i-1],b=p[i],L=Math.abs(a.x-b.x);if(Math.abs(a.y-b.y)<.01&&L>.05&&L<25&&a.y<o.y&&a.y>o.y-30)msgs.push(`出線口外 ${Math.round(a.x)},${Math.round(a.y)} 小折 ${L.toFixed(1)} mm`);}}
    // 兩點很近、面對面：線長不可以超過兩點的直角距離（不可以繞路）
    if(expectShort&&expectShort.includes(w.no)){const A=endpoint(w.a,0),B=endpoint(w.b,0),m=Math.abs(A.x-B.x)+Math.abs(A.y-B.y);if(r.len>m+.5)msgs.push(`線長 ${r.len.toFixed(1)} 超過兩點直角距離 ${m.toFixed(1)}，繞路了`);}
    // 拉線時的預覽要和放開後算出來的路徑一樣；而且不可以超過中繼點又折回來
    if(expectPrev&&expectPrev.includes(w.no)){const q=previewPts(w.a,w.wps,endpoint(w.b,0),!!w.direct,w.gland),f=x=>x.map(v=>Math.round(v.x)+','+Math.round(v.y)).join(' ');if(f(q)!==f(p))msgs.push(`預覽 ${f(q)} 和實際 ${f(p)} 不一樣`);
      for(let i=2;i<p.length;i++){const a=p[i-2],b=p[i-1],c=p[i];if((Math.abs(a.y-b.y)<.01&&Math.abs(b.y-c.y)<.01&&(b.x-a.x)*(c.x-b.x)<0)||(Math.abs(a.x-b.x)<.01&&Math.abs(b.x-c.x)<.01&&(b.y-a.y)*(c.y-b.y)<0))msgs.push(`在 ${Math.round(b.x)},${Math.round(b.y)} 折回`);}}
    // 箱外器具到箱內：要經過指定的出線口，且不可在出線口以外穿過箱壁
    if(expectGland&&expectGland[w.no]){if(r.gland!==expectGland[w.no])msgs.push(`應經過出線口 ${expectGland[w.no]}，實際 ${r.gland||'沒有'}`);
      const o=boxOrigin(),B={x:o.x,y:o.y,w:S.box.w,h:S.box.h},cross=p.filter((q,i)=>i&&(inR(q,B)!==inR(p[i-1],B))).length;if(cross!==1)msgs.push(`進出箱壁 ${cross} 次（應只有出線口 1 次）`);}
    (w.wps||[]).forEach((q,k)=>{if(!onPath(p,q))msgs.push(`沒有經過第 ${k+1} 個中繼點`);});
    if(expectVia&&expectVia[w.no]){const v=r.via.join('>'),want=expectVia[w.no].join('>');if(v!==want)msgs.push(`經過的線槽應為 ${want}，實際 ${v||'無'}`);}
    // 電纜芯線：接點→剝線點、外被、剝線點→接點分開檢查（芯線在剝線點往回走是正常的）
    for(const q of (r.parts||[p])) for(let i=2;i<q.length;i++){
      const a=q[i-2],b=q[i-1],c=q[i];
      const col=(Math.abs(a.x-b.x)<.01&&Math.abs(b.x-c.x)<.01)||(Math.abs(a.y-b.y)<.01&&Math.abs(b.y-c.y)<.01);
      if(col&&((b.x-a.x)*(c.x-b.x)+(b.y-a.y)*(c.y-b.y))<-.01){msgs.push(`同一條直線上來回折返（${[a,b,c].map(q=>Math.round(q.x)+','+Math.round(q.y)).join(' → ')}）`);break;}
    }
    if(r.cab){const c=CABROUTES.get(r.cab);if(!c)msgs.push('電纜沒有外被路徑');
      // 芯線兩段要接在剝線點上
      else{const [ta,tb]=r.tails,eq=(p,q)=>Math.abs(p.x-q.x)+Math.abs(p.y-q.y)<.6;
        // 接頭那一端沒有芯線段：外皮直接到接頭
        if(ta.length&&!eq(ta[ta.length-1],c.pts[0]))msgs.push('A 端芯線沒有接到剝線點');if(tb.length&&!eq(tb[0],c.pts[c.pts.length-1]))msgs.push('B 端芯線沒有接到剝線點');}}
    res.push({no:w.no,ok:!msgs.length,msg:msgs.join('；')});
  }
  // 出線口：經過指定的出線口、只在出線口穿過箱壁一次、穿過點在出線口上、沒有任何一段貼著箱壁邊線、沒有折返
  for(const key in (expectWall||{})){
    const g=S.glands.find(x=>x.id===expectWall[key]),P=glandPt(g),o=boxOrigin(),W=S.box.w,H=S.box.h,msgs=[];
    let pts,gl;
    if(key.startsWith('cab:')){const c=S.cables.find(x=>x.no===key.slice(4)),r=c&&CABROUTES.get(c.id);if(!r){res.push({no:key,ok:false,msg:'沒有外被路徑'});continue;}pts=r.pts;gl=r.gland;}
    else{const w=S.wires.find(x=>x.no===key),r=ROUTES.get(w.id);pts=r.pts;gl=r.gland;}
    if(gl!==g.id)msgs.push(`應經過 ${g.id}，實際 ${gl||'沒有'}`);
    const inB=q=>q.x>o.x+.01&&q.x<o.x+W-.01&&q.y>o.y+.01&&q.y<o.y+H-.01;
    const cross=[];for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i];if(inB(a)!==inB(b))cross.push(inB(a)?a:b);}
    if(cross.length!==1)msgs.push(`穿過箱壁 ${cross.length} 次`);
    for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],L=Math.abs(a.x-b.x)+Math.abs(a.y-b.y);if(L<1)continue;
      const onH=Math.abs(a.y-b.y)<.01&&(Math.abs(a.y-o.y)<.5||Math.abs(a.y-o.y-H)<.5)&&Math.max(a.x,b.x)>o.x&&Math.min(a.x,b.x)<o.x+W;
      const onV=Math.abs(a.x-b.x)<.01&&(Math.abs(a.x-o.x)<.5||Math.abs(a.x-o.x-W)<.5)&&Math.max(a.y,b.y)>o.y&&Math.min(a.y,b.y)<o.y+H;
      if(onH||onV){msgs.push(`有一段貼著箱壁邊線（${Math.round(a.x)},${Math.round(a.y)} → ${Math.round(b.x)},${Math.round(b.y)}）`);break;}}
    const wallPts=pts.filter(q=>(Math.abs(q.y-o.y)<.5||Math.abs(q.y-o.y-H)<.5||Math.abs(q.x-o.x)<.5||Math.abs(q.x-o.x-W)<.5));
    if(wallPts.some(q=>Math.hypot(q.x-P.x,q.y-P.y)>8))msgs.push('穿過箱壁的位置不在出線口上');
    if(backtrack(pts))msgs.push('同一條直線上來回折返');
    res.push({no:'出線口 '+key,ok:!msgs.length,msg:msgs.join('；')});
  }
  // 線圈二極體：K 接線圈 +、A 接 −，沒有接反警告
  for(const id in (expectCoil||{})){const [p,m]=expectCoil[id],ws=S.wires.filter(w=>w.auto==='coil'&&w.a.d===id),msgs=[];
    const k=ws.find(w=>w.a.t==='K'),a=ws.find(w=>w.a.t==='A');
    if(!k||k.b.t!==p)msgs.push(`K 應接 ${p}，實際 ${k?k.b.t:'沒接'}`);if(!a||a.b.t!==m)msgs.push(`A 應接 ${m}，實際 ${a?a.b.t:'沒接'}`);
    if(ISSUES.some(i=>i.id===id))msgs.push(ISSUES.filter(i=>i.id===id).map(i=>i.t).join('、'));
    res.push({no:'二極體 '+id,ok:!msgs.length,msg:msgs.join('；')});}
  // 電纜：芯數、種類、長度包含現場長度；有問題的電纜不可在檢查清單出現
  for(const c of S.cables||[]){
    const e=expectCable&&expectCable[c.no],L=cabLen(c),msgs=[];
    if(coresOf(c).length&&!CABROUTES.get(c.id))msgs.push('沒有外被路徑');
    if(e){if(e.cores!=null&&coresOf(c).length!==e.cores)msgs.push(`芯數應為 ${e.cores}，實際 ${coresOf(c).length}`);
      if(e.ext!=null&&L.ext!==e.ext)msgs.push(`種類應為${e.ext?'外部':'箱內'}`);
      if(e.field!=null&&Math.abs(L.total-L.box-L.spare-e.field)>.5)msgs.push(`現場長度沒有算進去（${L.total}）`);}
    const iss=ISSUES.filter(i=>i.k==='cable'&&i.id===c.id);if(iss.length)msgs.push(iss.map(i=>i.t).join('、'));
    if(L.ext&&c.bo&&c.bo.a){const r=CABROUTES.get(c.id);if(Math.abs(r.a.x-c.bo.a.x)+Math.abs(r.a.y-c.bo.a.y)>.01)msgs.push('剝線點沒有照拖曳的位置');}
    res.push({no:'電纜 '+c.no,ok:!msgs.length,msg:msgs.join('；')});
  }
  // 接頭電纜：接頭那端沒有剝線點，外皮端點就在接頭；一端接頭的芯線各自是不同電位、不同線號
  if(expectPlug)Object.entries(expectPlug).forEach(([no,e])=>{const c=S.cables.find(x=>x.no===no),R=c&&CABROUTES.get(c.id),m=[];
    if(!R){res.push({no:'接頭 '+no,ok:false,msg:'沒有外皮路徑'});return;}
    ['a','b'].forEach(k=>{if(!!R[k]!==(e[k]==='bo'))m.push(`${k.toUpperCase()} 端${e[k]==='bo'?'應有':'不應有'}剝線點`);const p=plugOf(c,k);if(p){const E=endpoint(p,0),q=k==='a'?R.pts[0]:R.pts[R.pts.length-1];if(Math.hypot(E.x-q.x,E.y-q.y)>.5)m.push(`外皮 ${k.toUpperCase()} 端沒有接到接頭`);}});
    const cw=coresOf(c),nets=netsOf();if(cw.length!==e.cores)m.push(`芯線 ${cw.length} 條，應為 ${e.cores}`);
    if(new Set(cw.map(w=>nets.get(w.id))).size!==cw.length)m.push('接頭的不同腳位被當成同一電位');if(new Set(cw.map(w=>w.no)).size!==cw.length)m.push('接頭的不同腳位用了同一個線號');
    res.push({no:'接頭 '+no,ok:!m.length,msg:m.join('；')});});
  // 電纜外皮經過的線槽（expectVia 的 cab:電纜編號）
  Object.keys(expectVia||{}).filter(k=>k.startsWith('cab:')).forEach(k=>{const c=S.cables.find(x=>x.no===k.slice(4)),R=c&&CABROUTES.get(c.id),v=R?R.via.join('>'):'無',want=expectVia[k].join('>');res.push({no:k,ok:v===want,msg:`外皮經過的線槽應為 ${want}，實際 ${v}`});});
  // 箱外線槽：指定的線要經過那條線槽，而且線槽不可以被當成超出底板
  if(expectFieldDuct){const F=expectFieldDuct;F.wires.forEach(no=>{const w=S.wires.find(x=>x.no===no),r=w&&ROUTES.get(w.id);res.push({no:'箱外線槽 '+no,ok:!!(r&&r.via.includes(F.duct)),msg:`應經過箱外線槽 ${F.duct}，實際 ${r?r.via.join('>')||'無':'沒有路徑'}`});});
    (F.avoid||[]).forEach(no=>{const w=S.wires.find(x=>x.no===no),r=w&&ROUTES.get(w.id);res.push({no:'不繞去線槽 '+no,ok:!!(r&&!r.via.includes(F.duct)),msg:`離線槽很遠，不應該繞去 ${F.duct}（實際 ${r?r.via.join('>'):'無'}）`});});
    const bad=ISSUES.filter(i=>i.k==='duct'&&i.id===F.duct);res.push({no:'箱外線槽 '+F.duct+' 檢查',ok:!bad.length,msg:bad.map(i=>i.t).join('；')});}
  // 電纜外皮不可穿過現場端的器具（剝線點在器具某一側，外皮從另一側過來要繞過去）
  (S.cables||[]).forEach(c=>{const R=CABROUTES.get(c.id);if(!R)return;
    const devs=[...new Set(coresOf(c).map(w=>w.b.d))].map(devOf).filter(d=>d&&d.sheet==='field');
    const bad=devs.filter(d=>{const T=tplOf(d);return R.pts.some((q,i)=>{if(!i)return false;const a=R.pts[i-1];for(let k=0;k<=20;k++){const x=a.x+(q.x-a.x)*k/20,y=a.y+(q.y-a.y)*k/20;if(x>d.x+1&&x<d.x+T.w-1&&y>d.y+1&&y<d.y+T.h-1)return true;}return false;});}).map(d=>d.tag);
    res.push({no:'外皮 '+c.no,ok:!bad.length,msg:'外皮穿過 '+bad.join('、')});});
  return res;
}

(async()=>{
  const b=await chromium.launch();const p=await b.newPage({viewport:{width:1400,height:900}});
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
  await p.goto(INDEX);await p.waitForTimeout(300);
  const extra=process.argv.slice(2).map(f=>({name:path.basename(f),file:fs.readFileSync(f,'utf8')}));
  let fail=0,total=0;
  const run=async(name,fnSrc,arg)=>{
    const out=await p.evaluate(([src,arg,chk])=>{
      const sc=new Function('arg','return ('+src+')(arg)')(arg);
      S=sc.state;resetUi();computeRoutes();
      return new Function('expectClean','expectVia','expectCable','expectBack','expectCoil','expectGland','expectWall','expectPlug','expectPrev','expectShort','expectNoJog','expectFieldDuct','return ('+chk+')(expectClean,expectVia,expectCable,expectBack,expectCoil,expectGland,expectWall,expectPlug,expectPrev,expectShort,expectNoJog,expectFieldDuct)')(sc.expectClean,sc.expectVia,sc.expectCable,sc.expectBack,sc.expectCoil,sc.expectGland,sc.expectWall,sc.expectPlug,sc.expectPrev,sc.expectShort,sc.expectNoJog,sc.expectFieldDuct);
    },[fnSrc,arg,checkInPage.toString()]);
    const bad=out.filter(x=>!x.ok);total+=out.length;fail+=bad.length;
    console.log(`${bad.length?'✗':'✓'} ${name}：${out.length} 條線，${bad.length} 條失敗`);
    bad.forEach(x=>console.log(`    ${x.no}：${x.msg}`));
  };
  for(const sc of SCENARIOS) await run(sc.name,sc.build.toString());
  { const sc=SCENARIOS.find(x=>x.name.startsWith('箱外線槽'));await run('箱外線槽只收順路的線（遠的不繞過去）',sc.build.toString(),'far'); }
  { const sc=SCENARIOS.find(x=>x.name.startsWith('出線口在器具正上方'));await run('電纜：拉芯線時放的中繼點改放到外皮上',sc.build.toString(),'cab'); }
  for(const e of extra) await run(e.name,(j=>({state:normalize(JSON.parse(j)).state,expectClean:[]})).toString(),e.file);
  if(errs.length){console.log('頁面錯誤：',errs);fail++;}
  console.log(fail?`\n失敗 ${fail} 項（共 ${total} 條線）`:`\n全部通過（共 ${total} 條線）`);
  await b.close();process.exit(fail?1:0);
})();

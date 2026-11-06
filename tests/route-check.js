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
    // SV2·L11 朝上，中繼點放在下方線槽：要直接往下接到中繼點，不可先往上跑再繞回來
    st.wires.push({id:'tb1',no:'B1',a:{d:'SV2',t:'L11'},b:{d:'K0',t:'A1'},wps:[{x:275,y:710}],gauge:.75,color:'black'});
    // 中繼點離器具很遠（不在正後方）：照原本的出線方向
    st.wires.push({id:'tb2',no:'B2',a:{d:'K0',t:'A1'},b:{d:'SV2',t:'L11'},wps:[{x:100,y:342}],gauge:.75,color:'black'});
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
  {name:'不進線槽與旋轉器具',build:()=>{
    const st=normalize({box:{w:900,h:700,d:300,back:20},plate:{w:800,h:600},door:{w:900,h:700},
      devices:[{id:'Q1',tpl:'fuji-bw50',x:100,y:300,rot:270},{id:'FL1',tpl:'fn3270',x:300,y:290,rot:270},{id:'Q2',tpl:'fuji-bw50',x:100,y:100,rot:90}],
      ducts:[{id:'D1',x:20,y:20,w:700,h:45,dp:65}],glands:[],wires:[]}).state;
    st.wires.push({id:'wd',no:'D1',a:{d:'Q1',t:'2'},b:{d:'FL1',t:'L1'},wps:[],gauge:3.5,color:'black',direct:true});
    return {state:st,expectClean:['D1']};
  }},
];

function checkInPage(expectClean,expectVia,expectCable,expectBack,expectCoil,expectGland){
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
        if(!eq(ta[ta.length-1],c.pts[0]))msgs.push('A 端芯線沒有接到剝線點');if(!eq(tb[0],c.pts[c.pts.length-1]))msgs.push('B 端芯線沒有接到剝線點');}}
    res.push({no:w.no,ok:!msgs.length,msg:msgs.join('；')});
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
      return new Function('expectClean','expectVia','expectCable','expectBack','expectCoil','expectGland','return ('+chk+')(expectClean,expectVia,expectCable,expectBack,expectCoil,expectGland)')(sc.expectClean,sc.expectVia,sc.expectCable,sc.expectBack,sc.expectCoil,sc.expectGland);
    },[fnSrc,arg,checkInPage.toString()]);
    const bad=out.filter(x=>!x.ok);total+=out.length;fail+=bad.length;
    console.log(`${bad.length?'✗':'✓'} ${name}：${out.length} 條線，${bad.length} 條失敗`);
    bad.forEach(x=>console.log(`    ${x.no}：${x.msg}`));
  };
  for(const sc of SCENARIOS) await run(sc.name,sc.build.toString());
  for(const e of extra) await run(e.name,(j=>({state:normalize(JSON.parse(j)).state,expectClean:[]})).toString(),e.file);
  if(errs.length){console.log('頁面錯誤：',errs);fail++;}
  console.log(fail?`\n失敗 ${fail} 項（共 ${total} 條線）`:`\n全部通過（共 ${total} 條線）`);
  await b.close();process.exit(fail?1:0);
})();

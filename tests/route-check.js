// 走線回歸測試：每次修改走線相關程式後執行，全部通過才發布。
// 用法：node tests/route-check.js [另外的專案 JSON 檔 ...]
// 需要 Playwright（require('playwright')）與 Chromium。
//
// 每條線檢查：
//   1. 沒有警告的線不可穿過起訖兩端以外的器具（警告與實際一致）
//   2. 自動路徑的第一段、最後一段照接點的出線方向
//   3. 有中繼點的線（手動路徑）要經過每個中繼點
//   4. 不可在同一條直線上來回折返
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
    st.wires.forEach(w=>{if(w.ext&&w.ext.cable==='C01')w.gland='G1';if(w.ext&&w.ext.cable==='C06')w.gland='G2';});
    return {state:st,expectClean:'all'};
  }},
  {name:'不進線槽與旋轉器具',build:()=>{
    const st=normalize({box:{w:900,h:700,d:300,back:20},plate:{w:800,h:600},door:{w:900,h:700},
      devices:[{id:'Q1',tpl:'fuji-bw50',x:100,y:300,rot:270},{id:'FL1',tpl:'fn3270',x:300,y:290,rot:270},{id:'Q2',tpl:'fuji-bw50',x:100,y:100,rot:90}],
      ducts:[{id:'D1',x:20,y:20,w:700,h:45,dp:65}],glands:[],wires:[]}).state;
    st.wires.push({id:'wd',no:'D1',a:{d:'Q1',t:'2'},b:{d:'FL1',t:'L1'},wps:[],gauge:3.5,color:'black',direct:true});
    return {state:st,expectClean:['D1']};
  }},
];

function checkInPage(expectClean,expectVia){
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
    if(!r.warn&&cx.length) msgs.push('沒有警告卻穿過 '+cx.join('、'));
    if(want&&r.warn) msgs.push('預期沒有警告，實際：'+r.warn);
    const manual=(w.wps||[]).length>0;
    const local=famIds(w.a.d).includes(w.b.d); // 主體與自己的附件之間：直接在器具前面連，不檢查出線方向
    if(!manual&&!w.direct&&!local&&!r.warn&&p.length>1){
      const A=endpoint(w.a,0),B=endpoint(w.b,0);
      let i=1;while(i<p.length&&Math.hypot(p[i].x-p[0].x,p[i].y-p[0].y)<.5)i++;
      if(i<p.length&&A.side&&devOf(w.a.d).sheet!=='field'&&dirOf(p[0],p[i])!==A.side) msgs.push(`起點出線方向應為 ${A.side}，實際 ${dirOf(p[0],p[i])}`);
      let j=p.length-2;while(j>=0&&Math.hypot(p[j].x-p[p.length-1].x,p[j].y-p[p.length-1].y)<.5)j--;
      if(j>=0&&B.side&&devOf(w.b.d).sheet!=='field'&&dirOf(p[p.length-1],p[j])!==B.side) msgs.push(`終點進線方向應為 ${B.side}，實際 ${dirOf(p[p.length-1],p[j])}`);
    }
    (w.wps||[]).forEach((q,k)=>{if(!onPath(p,q))msgs.push(`沒有經過第 ${k+1} 個中繼點`);});
    if(expectVia&&expectVia[w.no]){const v=r.via.join('>'),want=expectVia[w.no].join('>');if(v!==want)msgs.push(`經過的線槽應為 ${want}，實際 ${v||'無'}`);}
    for(let i=2;i<p.length;i++){
      const a=p[i-2],b=p[i-1],c=p[i];
      const col=(Math.abs(a.x-b.x)<.01&&Math.abs(b.x-c.x)<.01)||(Math.abs(a.y-b.y)<.01&&Math.abs(b.y-c.y)<.01);
      if(col&&((b.x-a.x)*(c.x-b.x)+(b.y-a.y)*(c.y-b.y))<-.01){msgs.push(`同一條直線上來回折返（${[a,b,c].map(q=>Math.round(q.x)+','+Math.round(q.y)).join(' → ')}）`);break;}
    }
    res.push({no:w.no,ok:!msgs.length,msg:msgs.join('；')});
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
      return new Function('expectClean','expectVia','return ('+chk+')(expectClean,expectVia)')(sc.expectClean,sc.expectVia);
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

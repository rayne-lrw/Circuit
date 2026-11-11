// 接點文字檢查：每一種內建器具的接點文字不能互相疊在一起、不能壓到別的接點、不能超出器具外框
// 旋轉 90° 只列出參考（PLC 模組、端子台幾乎不會橫裝；2.6 mm 間距的彈簧夾端子轉成橫排後放不下字）
// 文字位置由 labPlan 自動決定（橫寫、斜寫、直寫、寫在外側、縮小字），這裡用同一套文字範圍框檢查
// 用法：node tests/label-check.js [器具 id 片段]
const {chromium}=require('playwright'),path=require('path');
const only=process.argv[2]||'';
(async()=>{
  const b=await chromium.launch(),p=await b.newPage();
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+path.join(__dirname,'..','index.html'));
  const res=await p.evaluate(only=>{
    const bad=[],ref=[],stat={};let n=0;
    const ov=(a,b,m)=>a[0]<b[1]-m&&b[0]<a[1]-m&&a[2]<b[3]-m&&b[2]<a[3]-m;
    Object.keys(TPL).forEach(id=>{const t0=TPL[id];if(t0.legacy||t0.gen||t0.sym||!(t0.t||[]).length)return;if(only&&!id.includes(only))return;
      [0,90].forEach(rot=>{const d={id:'__lc',tag:'X1',tpl:id,x:0,y:0,sheet:'plate',...(rot?{rot}:{})},t=tplOf(d),P=labPlan(d,t);n++;
        const L=[...P.entries()],msg=[];
        L.forEach(([a,A],i)=>{A.bx.forEach(b=>{
          if(b[0]<-1.05||b[1]>t.w+1.05||b[2]<-1.05||b[3]>t.h+1.05)msg.push(`${a} 超出外框`);
          L.forEach(([c,C],j)=>{if(j>i&&C.bx.some(q=>ov(b,q,.1)))msg.push(`${a}↔${c} 文字疊`);});
          t.terms.forEach(q=>{if(q.id!==a&&ov(b,[q.x-.9,q.x+.9,q.y-.9,q.y+.9],.1))msg.push(`${a} 壓到 ${q.id}`);});});});
        P.forEach(v=>{stat[v.m+'@'+v.fs]=(stat[v.m+'@'+v.fs]||0)+1;});
        if(msg.length)(rot?ref:bad).push(`${id}${rot?'（轉 90°）':''}：${[...new Set(msg)].slice(0,4).join('、')}${msg.length>4?` 等 ${msg.length} 處`:''}`);});});
    return {bad,ref,n,stat};},only);
  await b.close();
  res.ref.forEach(l=>console.log('△ '+l));res.bad.forEach(l=>console.log('✗ '+l));errs.forEach(e=>console.log('✗ 頁面錯誤：'+e));
  console.log('寫法統計：'+Object.entries(res.stat).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k} ${v}`).join('、'));
  const fail=res.bad.length+errs.length;
  console.log(`\n旋轉 90° 參考：${res.ref.length} 種有字擠在一起（不算失敗）`);console.log(fail?`\n檢查 ${res.n/2} 種器具，${fail} 項有問題`:`\n檢查 ${res.n/2} 種器具，全部通過`);process.exit(fail?1:0);
})();

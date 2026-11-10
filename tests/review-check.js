// 配線審查檢查：電氣檢查（接地、斷路器線徑）與審查流程（確認、改過要重看、註記、存檔讀回、審查報告）
// 用法：node tests/review-check.js
const {chromium}=require('playwright'),path=require('path');
(async()=>{
  const b=await chromium.launch(),p=await b.newPage({viewport:{width:1400,height:900}});
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+path.join(__dirname,'..','index.html'));
  const res=await p.evaluate(()=>{
    const out=[],ok=(c,m)=>out.push((c?'✓ ':'✗ ')+m),has=re=>reviewIssues().some(i=>re.test(i.t));
    // 小盤面：斷路器 iC60N 3P16A、伺服驅動器（有 PE）、端子台
    S=normalize({box:{w:600,h:500,d:300,back:20},plate:{w:560,h:460},door:{w:600,h:500},
      devices:[{id:'Q',tag:'Q',tpl:'ic60-3P16A',x:60,y:60,sheet:'plate'},{id:'SV',tag:'SV',tpl:'j4200',x:250,y:60,sheet:'plate'},{id:'E1',tag:'E1',tpl:'gnd15',x:60,y:350,sheet:'plate'}],
      ducts:[],glands:[],wires:[]}).state;resetUi();
    const t=id=>tplOf(devOf(id)).terms,pe=t('SV').find(x=>isEarthTerm(x)),l1=t('SV').find(x=>/^(L1|R)$/.test(x.id))||t('SV')[0];
    const W=(id,a,b,g,c)=>{const w={id,no:id,a,b,wps:[],gauge:g,color:c};S.wires.push(w);return w;};
    W('w1',{d:'Q',t:t('Q')[1].id},{d:'SV',t:l1.id},2,'black');recompute();
    ok(!!pe,'伺服驅動器有接地接點');
    ok(has(/SV 的接地 .* 沒有接/),'器具有接線但接地沒接：提示');
    const we=W('w2',{d:'SV',t:pe.id},{d:'E1',t:t('E1')[0].id},2,'black');recompute();
    ok(!has(new RegExp('SV 的接地 (.*、)?'+pe.id+'(、|\\s)')),'接上的接地點不再列在提示裡（還沒接的另一個接地點照樣提示）');
    ok(has(/w2.*線色不是黃綠/),'接地線不是黃綠：提示');
    we.color='green';recompute();ok(!has(/w2.*線色不是/),'改成綠色不提示');we.color='ground';recompute();ok(!has(/w2.*線色不是/),'改成黃綠不提示');
    ok(!has(/Q（16A）/),'16A 斷路器接 2mm²（約 17A）不提示');
    S.wires[0].gauge=.75;recompute();ok(has(/Q（16A）接的 w1 是 0\.75mm²/),'16A 斷路器接 0.75mm²：提示線徑太細');
    ok(ISSUES.some(i=>/線徑可能太細/.test(i.t)),'電氣檢查會列在檢查清單');
    // 審查流程
    const w=S.wires[0];setReviewed(w,true);ok(reviewOf(w)==='ok','勾已確認');
    w.gauge=2;ok(reviewOf(w)==='changed','確認後改線徑：變成改過要重看');
    setReviewed(w,true);const n=addNote({x:100,y:100});n.t='測試';n.st='fixed';
    const S2=normalize(JSON.parse(JSON.stringify(S))).state;
    ok(S2.review&&S2.review.ok[w.id]===wireSig(w)&&S2.review.notes.length===1&&S2.review.notes[0].st==='fixed','存檔讀回後確認狀態與註記都在');
    tab='rev';renderList();ok(/已確認 1 \/ 2 條/.test($('listH').textContent),'審查分頁顯示確認進度');
    printReviewOnly=true;buildPrint();printReviewOnly=false;const pr=$('print');
    ok(pr.querySelectorAll('section').length===2&&pr.querySelectorAll('.rv-mk').length===1,'審查報告：全圖含註記＋清單頁');
    buildPrint();ok(!$('print').querySelector('.rv-mk'),'一般列印不含審查註記');
    return out;
  });
  await b.close();
  res.forEach(l=>console.log(l));errs.forEach(e=>console.log('✗ 頁面錯誤：'+e));
  const fail=res.filter(l=>l.startsWith('✗')).length+errs.length;
  console.log(fail?`\n失敗 ${fail} 項`:'\n全部通過');process.exit(fail?1:0);
})();

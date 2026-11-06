// 版面檢查：在手機、平板、筆電、桌機寬度下打開各種選單、彈窗、對話框，找出超出畫面的元件。
// 用法：node tests/layout-check.js（需要 Playwright 與 Chromium）
const path=require('path');
const {chromium}=require('playwright');
const INDEX='file://'+path.resolve(__dirname,'..','index.html');
(async()=>{
  const b=await chromium.launch();
  let fail=0;
  for(const [w,h] of [[390,844],[768,1024],[1024,768],[1280,800]]){
    const p=await b.newPage({viewport:{width:w,height:h}});
    await p.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
    await p.goto(INDEX);await p.waitForTimeout(300);
    const out=[];
    const scan=async(label)=>{const bad=await p.evaluate(()=>{const W=innerWidth,H=innerHeight,res=[];
      document.querySelectorAll('.menu:not([hidden]),#pop:not([hidden]),#tip:not([hidden]),#toast:not([hidden]),#setDlg:not([hidden]) .card,#ed:not([hidden]) #edCard,#io:not([hidden]),#detail:not([hidden]),.totop:not([hidden])').forEach(el=>{const r=el.getBoundingClientRect();if(r.width&&(r.left<-0.5||r.right>W+0.5))res.push((el.id||el.className)+` x ${Math.round(r.left)}~${Math.round(r.right)} / ${W}`);});
      if(document.documentElement.scrollWidth>W)res.push('page scrollWidth '+document.documentElement.scrollWidth);return res;});
      if(bad.length)out.push(label+': '+bad.join(' | '));};
    await scan('初始');
    await p.click('#fileB');await scan('檔案選單');await p.keyboard.press('Escape');
    await p.click('#clearB');await scan('清除選單');await p.click('[data-clr="devs"]');await scan('清除確認');await p.keyboard.press('Escape');
    await p.click('#setOpen');await scan('盤面設定');await p.keyboard.press('Escape');
    await p.evaluate(()=>{draft={a:{d:'Q2',t:'2'},wps:[],end:{d:'Q3',t:'1'}};const r=$('svg').getBoundingClientRect();cursor={x:0,y:0,sx:r.width-5,sy:5};openPop();});await scan('建線彈窗');await p.evaluate(()=>cancelDraft());
    await p.evaluate(()=>{setMode('place');picked={k:'dev',id:'X1'};renderDetail();});await scan('器具詳細');
    await p.evaluate(()=>{openEditor('lc1d09',null);});await scan('器具編輯器');await p.evaluate(()=>{$('ed').hidden=true;});
    await p.evaluate(()=>{multi=[{k:'dev',id:'Q1'},{k:'dev',id:'Q2'}];renderDetail();});await scan('多選');
    await p.evaluate(()=>{toast('這是一則很長很長的提示訊息，用來測試在窄螢幕下會不會超出畫面範圍');});await scan('提示');
    await p.evaluate(()=>{showIO('x');});await scan('匯出內容');
    console.log((out.length?'✗ ':'✓ ')+w+'x'+h, out.length?'\n  '+out.join('\n  '):'沒有超出');fail+=out.length;
    await p.close();
  }
  await b.close();
  console.log(fail?`\n失敗 ${fail} 項`:'\n全部通過');process.exit(fail?1:0);
})();

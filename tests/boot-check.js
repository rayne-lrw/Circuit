// 載入畫面測試（index.html 的 #boot ＋ js/boot.js）：
// - 正常開啟：載完（main.js 跑完、畫面畫好）載入畫面消失，可以操作
// - 慢網速：一開始就看得到轉圈圈，載完才消失；「網路較慢」10 秒後才出現
// - 有 js 檔下載失敗：改成顯示錯誤與檔名，不會一直空轉
// - 外站字型（Google 字型）載不到：不算失敗
// - 啟動時程式出錯：顯示錯誤
// - 列印：看不到載入畫面
// 用法：node tests/boot-check.js
const {chromium}=require('playwright'),path=require('path'),http=require('http'),fs=require('fs');
const root=path.resolve('.');
const srv=http.createServer((q,r)=>{const f=path.join(root,decodeURIComponent(q.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end();return;}
  const ext=path.extname(f);r.writeHead(200,{'Content-Type':ext==='.js'?'text/javascript':ext==='.css'?'text/css':ext==='.html'?'text/html; charset=utf-8':'application/octet-stream'});fs.createReadStream(f).pipe(r);});
(async()=>{await new Promise(r=>srv.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${srv.address().port}/index.html`;
const b=await chromium.launch();const res=[];const ok=(c,m)=>res.push((c?'✓ ':'✗ ')+m);
const st=p=>p.evaluate(()=>{const e=document.getElementById('boot');if(!e)return 'gone';const cs=getComputedStyle(e);return e.classList.contains('fail')?'fail':cs.display==='none'?'hidden':'shown';});

// 1. 正常開啟
{ const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto(url,{waitUntil:'load'});
  await p.waitForFunction(()=>!document.getElementById('boot'),null,{timeout:10000}).catch(()=>{});
  ok(await st(p)==='gone','正常開啟：載完後載入畫面消失');
  ok(await p.evaluate(()=>document.querySelectorAll('#svg [data-dev]').length>0&&typeof recompute==='function'),'畫面已畫好、可以操作');
  ok(!errs.length,'沒有頁面錯誤'+(errs.length?'：'+errs[0]:''));await p.close(); }

// 2. 慢網速：每個 js 晚 300ms 才回
{ const p=await b.newPage();await p.route('**/*.js*',async r=>{await new Promise(z=>setTimeout(z,300));await r.continue();});
  const nav=p.goto(url,{waitUntil:'load'});await p.waitForSelector('#boot',{timeout:5000});
  ok(await st(p)==='shown','慢網速：一開始就顯示載入畫面');
  ok(await p.evaluate(()=>{const s=document.querySelector('#boot .boot-sp');return !!s&&getComputedStyle(s).animationName==='bootspin';}),'轉圈圈動畫有在跑');
  ok(await p.evaluate(()=>{const s=document.querySelector('#boot .boot-slow');return getComputedStyle(s).animationDelay==='10s'&&getComputedStyle(s).opacity==='0';}),'「網路較慢」10 秒後才出現（一開始看不到）');
  await nav;await p.waitForFunction(()=>!document.getElementById('boot'),null,{timeout:20000}).catch(()=>{});
  ok(await st(p)==='gone','慢網速：全部載完才消失');await p.close(); }

// 3. js 檔下載失敗
{ const p=await b.newPage();await p.route('**/routing.js*',r=>r.abort());await p.goto(url,{waitUntil:'load'}).catch(()=>{});await p.waitForTimeout(800);
  ok(await st(p)==='fail','js 檔下載失敗：改成顯示錯誤，不會一直空轉');
  ok(/routing\.js/.test(await p.evaluate(()=>document.querySelector('#boot .boot-err').textContent)),'錯誤訊息寫出是哪個檔案（routing.js）');
  ok(/重新整理/.test(await p.evaluate(()=>document.querySelector('#boot .boot-err').textContent)),'提示重新整理');
  await p.emulateMedia({media:'print'});ok(await p.evaluate(()=>getComputedStyle(document.getElementById('boot')).display==='none'),'列印時看不到載入畫面');await p.close(); }

// 3b. 外站字型載不到：不算失敗，照常開啟
{ const p=await b.newPage();await p.route('**/fonts.googleapis.com/**',r=>r.abort());await p.route('**/fonts.gstatic.com/**',r=>r.abort());await p.goto(url,{waitUntil:'load'}).catch(()=>{});
  await p.waitForFunction(()=>!document.getElementById('boot'),null,{timeout:10000}).catch(()=>{});ok(await st(p)==='gone','外站字型載不到：不算失敗，照常開啟');await p.close(); }

// 4. 啟動時程式出錯（main.js 換成會丟錯誤的內容）
{ const p=await b.newPage();await p.route('**/main.js*',r=>r.fulfill({contentType:'text/javascript',body:'throw new Error("測試用的錯誤")'}));
  await p.goto(url,{waitUntil:'load'}).catch(()=>{});await p.waitForTimeout(500);
  ok(await st(p)==='fail'&&/測試用的錯誤/.test(await p.evaluate(()=>document.querySelector('#boot .boot-err').textContent)),'啟動時程式出錯：顯示錯誤內容');await p.close(); }

await b.close();srv.close();
res.forEach(l=>console.log(l));const fail=res.filter(l=>l.startsWith('✗')).length;console.log(fail?`\n失敗 ${fail} 項`:'\n全部通過');process.exit(fail?1:0);})();

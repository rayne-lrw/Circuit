/* 開啟時的載入畫面（index.html 的 #boot）：
   - 一打開就顯示轉圈圈（樣式寫在 index.html，不必等 css／js）；超過 10 秒由 CSS 顯示「網路較慢」
   - 這支檔案在 <head> 最先載入：之後任何 css／js 下載失敗、或啟動時程式出錯，改成顯示錯誤與重新整理提示，不會一直空轉
   - main.js 跑完（讀回專案、畫面第一次畫好）呼叫 bootDone()：淡出後移除 */
(function(){
  let done=false;
  const box=()=>document.getElementById('boot');
  window.bootFail=function(msg){if(done)return;const b=box();if(!b)return;b.classList.add('fail');const t=b.querySelector('.boot-t');if(t)t.textContent='盤面配線模擬器 載入失敗';const m=b.querySelector('.boot-err');
    if(m){const li=document.createElement('div');li.textContent=msg;m.appendChild(li);}};
  window.bootDone=function(){if(done)return;const b=box();if(!b){done=true;return;}if(b.classList.contains('fail'))return;done=true;
    b.classList.add('out');b.setAttribute('aria-busy','false');setTimeout(()=>b.remove(),260);};
  // 檔案下載失敗（error 不會冒泡，要在捕獲階段接）
  window.addEventListener('error',e=>{const t=e.target;
    if(t&&t!==window&&(t.tagName==='SCRIPT'||t.tagName==='LINK')){const full=t.src||t.href||'';if(!full.startsWith(location.href.replace(/[^/]*$/,'')))return; // 外站（Google 字型）載不到不影響使用，不算失敗
      bootFail('沒有載入成功：'+full.replace(/^.*\//,'').replace(/\?.*$/,''));return;}
    if(!done)bootFail('啟動時發生錯誤：'+(e.message||'未知的錯誤'));},true);
})();

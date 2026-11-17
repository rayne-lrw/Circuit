// 器具實體圖檢查（js/look.js）：
// - 每一種器具在實體圖、簡化圖都畫得出來（沒有錯誤）；簡化圖不畫任何實體圖元素
// - 細節層每個系列都有資料來源與畫了什麼；細節畫在本體範圍內、不蓋到任何接點（背景蓋板除外，接點畫在蓋板上面）
// - 4P 塑殼斷路器把手在右邊三極中間（照型錄）；模擬時把手跟著 ON／OFF、選擇開關跟著位置
// - 用 --write 產生 docs/實體圖核對表.md（逐型號列出：細節層＋資料來源，或只有基本層）
// 用法：node tests/look-check.js [--write]
const {chromium}=require('playwright'),path=require('path'),fs=require('fs');
(async()=>{
  const b=await chromium.launch(),p=await b.newPage({viewport:{width:1400,height:900}});
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+path.join(__dirname,'..','index.html'));
  const res=await p.evaluate(()=>{setMode('place');setOpPref('look','real');
    const out=[],ok=(c,m)=>out.push((c?'✓ ':'✗ ')+m);
    const ids=Object.keys(TPL).filter(id=>!TPL[id].legacy);
    // 每種器具畫一次（分批放在盤面上）
    const bad=[],over=[];let nDet=0;
    for(let i=0;i<ids.length;i+=60){const part=ids.slice(i,i+60);let x=10;
      const ds=part.map((tpl,k)=>{const t=resolveTpl(tpl,TPL[tpl].gen?TPL[tpl].cnt:undefined);const d={id:'L'+k,tag:'L'+k,tpl,x,y:20,sheet:TPL[tpl].sheet==='door'?'door':TPL[tpl].sheet==='field'?'field':'plate'};x+=(t?t.w:40)+10;return d;});
      try{S=normalize({box:{w:x+40,h:600,d:300,back:20},plate:{w:x+20,h:560},door:{w:x+20,h:560},ducts:[],glands:[],wires:[],devices:ds}).state;resetUi();recompute();renderBoard();}catch(e){bad.push(part[0]+'…：'+e.message);continue;}
      // 細節不能超出本體、不能蓋到接點
      S.devices.forEach(d=>{const g=document.querySelector(`g.dev[data-dev="${d.id}"]`);if(!g)return;const det=g.querySelector('.lk-det');if(!det)return;nDet++;
        const t=tplOf(d),R={x:d.x,y:d.y,w:t.w,h:t.h},bb=det.getBBox();
        if(bb.x<R.x-.5||bb.y<R.y-.5||bb.x+bb.width>R.x+R.w+.5||bb.y+bb.height>R.y+R.h+.5)over.push(`${d.tpl}：細節超出本體`);
        [...det.querySelectorAll('*')].forEach(el=>{if(!el.getBBox||el.classList.contains('lk-cover'))return; // 蓋板是背景（接點畫在它上面，例如 Q CPU 的 USB 蓋上就是 USB 接點），不算蓋住
          const e=el.getBBox();t.terms.forEach(q=>{const x=d.x+q.x,y=d.y+q.y;if(x>e.x+.3&&x<e.x+e.width-.3&&y>e.y+.3&&y<e.y+e.height-.3)over.push(`${d.tpl}：細節蓋到接點 ${q.id}`);});});});}
    ok(!bad.length,`${ids.length} 種器具都畫得出來`+(bad.length?'：'+bad.slice(0,3).join('；'):''));
    ok(!over.length,`細節層 ${nDet} 種：都在本體範圍內、沒有蓋到接點`+(over.length?'：'+[...new Set(over)].slice(0,5).join('；'):''));
    ok(LOOKS.every(L=>L.src&&L.feat&&L.name),'細節層每個系列都有名稱、資料來源、畫了什麼');
    // 4P 把手位置
    {const T=tplOf({tpl:'bw125-4p100'}),g=LK_BRK(null,T);ok(Math.abs(g.x+g.w/2-75)<1,'BW125 4P 把手中心在右邊三極中間（型錄 72.5／120，這裡 75）');}
    {const T=tplOf({tpl:'bw125-3p100'}),g=LK_BRK(null,T);ok(Math.abs(g.x+g.w/2-45)<.5,'3P 把手在正中央');}
    // 模擬：把手、選擇開關
    S=normalize({box:{w:600,h:400,d:300,back:20},plate:{w:560,h:360},door:{w:600,h:400},ducts:[],glands:[],wires:[],
      devices:[{id:'Q',tag:'Q',tpl:'bw125-3p100',x:20,y:20,sheet:'plate'},{id:'S1',tag:'S1',tpl:'yw1s-31e20',x:50,y:50,sheet:'door'}]}).state;resetUi();recompute();
    simReset();const ky=()=>{const m=/lk-knob[^>]*y="([\d.]+)"/.exec(lookSim(SIMST));return m?+m[1]:null;};const off=ky();SIMST.on.Q=true;const on=ky();ok(on!==null&&off!==null&&on<off,'模擬：斷路器 ON 時把手往上');
    const rot=()=>(/rotate\((-?\d+)/.exec(lookSim(SIMST).split('yw')[0]+lookSim(SIMST))||[])[1];SIMST.sel={S1:'L'};const a=lookSim(SIMST);SIMST.sel={S1:'R'};const c=lookSim(SIMST);
    ok(/rotate\(-45/.test(a)&&/rotate\(45/.test(c),'模擬：3 位置選擇開關 L 往左轉 45°、R 往右轉 45°');
    // 簡化圖
    setOpPref('look','simple');renderBoard();ok(!document.querySelector('#board .lk-tb,#board .lk-det,#board .lk-slot,.lk-tb,.lk-det'),'簡化圖：不畫任何實體圖元素');setOpPref('look','real');renderBoard();
    ok(document.querySelector('.lk-det'),'實體圖：畫出細節層');
    // 核對表資料
    const rows=ids.filter(id=>!['field-power'].includes(id)).map(id=>{const t=tplOf({tpl:id}),L=lookOf(id,t);return {id,n:t.n,b:t.b||'',ser:t.ser||'',cat:t.cat,L:L?L.name:'',src:L?L.src:'',feat:L?L.feat:''};});
    return {out,rows,looks:LOOKS.map(L=>({name:L.name,src:L.src,feat:L.feat}))};
  });
  await b.close();
  res.out.forEach(l=>console.log(l));errs.forEach(e=>console.log('✗ 頁面錯誤：'+e));
  if(process.argv.includes('--write')){
    const det=res.rows.filter(r=>r.L),base=res.rows.filter(r=>!r.L);
    let md=`# 器具實體圖核對表\n\n由 \`node tests/look-check.js --write\` 產生，請不要手動修改。\n\n`+
      `- **基本層**（所有器具）：本體立體感、端子台底座、螺絲頭。端子台與螺絲直接依接點位置畫；接點位置是建器具時照外形圖／端子排列圖放的，所以上下左右和原廠一致。\n`+
      `- **細節層**（下表第一部分）：照原廠外形圖或照片核對過位置的系列才畫；同系列的型號外形由同一份資料產生，逐型號列在下面。\n`+
      `- **只有基本層**（第二部分）：目前沒有資料能確認細節（把手、按鈕、指示燈、顯示窗…）的位置，先不畫；之後有外形圖或照片再補。\n\n`+
      `共 ${res.rows.length} 種：細節層 ${det.length} 種、只有基本層 ${base.length} 種。\n\n## 一、有細節層的系列\n\n`;
    res.looks.forEach(L=>{const rs=det.filter(r=>r.L===L.name);md+=`### ${L.name}（${rs.length} 種）\n\n- 核對資料：${L.src}\n- 畫了：${L.feat}\n- 型號：${rs.map(r=>r.n).join('、')}\n\n`;});
    md+=`## 二、只有基本層\n\n| 大類 | 廠牌 | 系列 | 數量 | 型號 |\n|---|---|---|---|---|\n`;
    const g=new Map();base.forEach(r=>{const k=r.cat+'｜'+r.b+'｜'+r.ser;if(!g.has(k))g.set(k,[]);g.get(k).push(r.n);});
    [...g.entries()].sort().forEach(([k,ns])=>{const [c,bb,s]=k.split('｜');md+=`| ${c} | ${bb||'—'} | ${s||'—'} | ${ns.length} | ${ns.join('、').replace(/\|/g,'／')} |\n`;});
    fs.writeFileSync(path.join(__dirname,'..','docs','實體圖核對表.md'),md);console.log(`已寫入 docs/實體圖核對表.md（細節層 ${det.length}、只有基本層 ${base.length}）`);
  }
  const fail=res.out.filter(l=>l.startsWith('✗')).length+errs.length;
  console.log(fail?`\n失敗 ${fail} 項`:'\n全部通過');process.exit(fail?1:0);
})();

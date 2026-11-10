// 器具庫資料檢查：每個內建器具的接點在外框內、名稱不重複、彼此不重疊；動作資料指到的接點都存在；PLC 的輸入輸出點都有分到共點
// 用法：node tests/tpl-data-check.js [只檢查哪個系列，例如 FX5]
const {chromium}=require('playwright'),path=require('path');
(async()=>{
  const b=await chromium.launch(),p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+path.join(__dirname,'..','index.html'));
  const res=await p.evaluate(only=>{
    const out=[],bad=[];let n=0;
    Object.entries(TPL).forEach(([id,t])=>{if(t.legacy||t.gen)return;if(only&&!(t.ser||'').includes(only))return;n++;
      const r=resolveTpl(id),T=r.terms,ids=T.map(x=>x.id),msg=[];
      const dup=ids.filter((x,i)=>ids.indexOf(x)!==i);if(dup.length)msg.push('接點名稱重複 '+[...new Set(dup)].join(','));
      T.forEach(x=>{if(x.x<0||x.y<0||x.x>t.w||x.y>t.h)msg.push(`接點 ${x.id} 在外框外（${x.x},${x.y}）`);});
      for(let i=0;i<T.length;i++)for(let j=i+1;j<T.length;j++){if(Math.hypot(T[i].x-T[j].x,T[i].y-T[j].y)<1.2)msg.push(`接點 ${T[i].id} 和 ${T[j].id} 重疊`);}
      if(t.links)t.links.forEach(g=>g.forEach(x=>{if(!ids.includes(x))msg.push('同電位組的接點不存在 '+x);}));
      const sim=simElems({tpl:id});if(sim.length){const ids2=new Set(ids);const ok=simClean(sim,ids2)||[];
        if(ok.length!==sim.length)msg.push(`動作資料 ${sim.length-ok.length} 條指到不存在的接點`);
        const Y=sim.filter(e=>e.k==='plcY').flatMap(e=>e.pairs.map(p=>p[0])),X=sim.filter(e=>e.k==='plcX').flatMap(e=>e.pts);
        const ys=ids.filter(x=>/^Y\d+$/.test(x)),xs=ids.filter(x=>/^X\d+$/.test(x));
        if(ys.some(y=>!Y.includes(y)))msg.push('有 Y 點沒有分到共點：'+ys.filter(y=>!Y.includes(y)).join(','));
        if(/^fx5/.test(id)&&xs.some(x=>!X.includes(x)))msg.push('有 X 點沒有分到輸入共點：'+xs.filter(x=>!X.includes(x)).join(','));}
      if(msg.length)bad.push(`${id}（${t.n}）：${[...new Set(msg)].slice(0,4).join('；')}`);});
    return {n,bad};
  },process.argv[2]||'');
  await b.close();
  res.bad.forEach(l=>console.log('✗ '+l));errs.forEach(e=>console.log('✗ 頁面錯誤：'+e));
  console.log(`\n檢查 ${res.n} 種器具`+(res.bad.length||errs.length?`，${res.bad.length+errs.length} 項有問題`:'，全部通過'));process.exit(res.bad.length||errs.length?1:0);
})();

// 隨機配置測試：產生很多種隨機配置（箱子大小、現場區位置、出線口、線槽、箱外線槽、器具、線、電纜、中繼點），
// 檢查每一條路徑的基本條件。用法：node tests/fuzz-check.js [配置數量=150] [起始種子=1]
// 檢查項目：
//   座標異常  路徑有 NaN 或無限大
//   程式折返  在同一條直線上走過去又折回來，而且折回的那一點不是使用者放的中繼點（中繼點造成的折返不算程式問題）
//   穿箱壁    沒有中繼點的線：兩端都在箱內或都在箱外應該 0 次，一內一外應該剛好 1 次（只能從出線口）
//   外皮過短  電纜兩端相距超過 200 mm，外皮卻不到兩端距離的 15%（兩個剝線點擠在一起）
//   繞路      沒有中繼點的線：線長超過兩端直角距離的 4 倍再加 600 mm（有中繼點的線本來就要繞去經過中繼點）
const {chromium}=require('playwright');
const N=Number(process.argv[2])||150,SEED=Number(process.argv[3])||1;
(async()=>{
  const b=await chromium.launch();const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+require('path').join(__dirname,'..','index.html'));
  const DBG=process.argv[4]||'';
  const res=await p.evaluate(([N,SEED,DBG])=>{
    let seed=1;const rnd=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;},ri=(a,b)=>Math.floor(a+rnd()*(b-a+1)),pick=a=>a[Math.floor(rnd()*a.length)];
    const TP=Object.entries(TPL).filter(([k,t])=>!t.gen&&!t.attach&&!t.front&&!t.legacy&&!t.noOv&&!t.sym&&(t.t||[]).length&&t.w<180&&t.h<240);
    const plateT=TP.filter(([k,t])=>t.sheet==='plate').map(([k])=>k),fieldT=TP.filter(([k,t])=>t.sheet==='field').map(([k])=>k);
    const stats={},ex={};let routes=0;
    const add=(k,s,msg)=>{stats[k]=(stats[k]||0)+1;(ex[k]=ex[k]||[]);if(ex[k].length<6)ex[k].push(`種子 ${s}：${msg}`);};
    const ov=(a,b,m=4)=>a.x<b.x+b.w+m&&b.x<a.x+a.w+m&&a.y<b.y+b.h+m&&b.y<a.y+a.h+m;
    for(let n=0;n<N;n++){
      const s=SEED+n;seed=s*7919%2147483647||1;for(let i=0;i<5;i++)rnd();
      const bw=ri(700,1400),bh=ri(600,1000),pw=bw-ri(60,100),ph=bh-ri(60,100);
      const side=pick(['top','top','bottom','left','right']);
      const st={box:{w:bw,h:bh,d:300,back:20},plate:{w:pw,h:ph},door:{w:bw,h:bh},devices:[],ducts:[],glands:[],wires:[],cables:[]};
      // 線槽：底板四周一圈，有時中間多一條
      const dw=ri(30,50);
      st.ducts.push({id:'D1',x:10,y:10,w:pw-20,h:dw,dp:60},{id:'D2',x:10,y:ph-10-dw,w:pw-20,h:dw,dp:60},{id:'D3',x:10,y:10+dw,w:dw,h:ph-20-2*dw,dp:60},{id:'D4',x:pw-10-dw,y:10+dw,w:dw,h:ph-20-2*dw,dp:60});
      if(rnd()<.5)st.ducts.push({id:'D5',x:10+dw,y:Math.round(ph/2-dw/2),w:pw-20-2*dw,h:dw,dp:60});
      const norm=normalize(st).state;S=norm;const o=boxOrigin(),BR={x:o.x,y:o.y,w:bw,h:bh};
      // 現場區
      const zw=side==='left'||side==='right'?ri(300,500):ri(500,bw+200),zh=side==='left'||side==='right'?ri(400,bh):ri(220,400),gap=ri(60,200);
      const z={id:'Z1',name:'現場',w:zw,h:zh,x:side==='left'?o.x-gap-zw:side==='right'?o.x+bw+gap:o.x+ri(-100,Math.max(-99,bw-zw+100)),y:side==='top'?o.y-gap-zh:side==='bottom'?o.y+bh+gap:o.y+ri(0,Math.max(1,bh-zh))};
      S.fields=[z];
      // 出線口：2～5 個，偏向現場區那一面
      const ng=ri(2,5);for(let i=0;i<ng;i++){const sd=rnd()<.7?side:pick(['top','bottom','left','right']),g={id:'G'+(i+1),side:sd,spec:'M25',x:0,y:0};
        if(sd==='top'||sd==='bottom'){g.x=o.x+ri(40,bw-40);g.y=sd==='top'?o.y:o.y+bh;}else{g.x=sd==='left'?o.x:o.x+bw;g.y=o.y+ri(40,bh-40);}S.glands.push(g);}
      // 箱外線槽：一半的配置有，放在現場區和箱子之間
      if(rnd()<.5){if(side==='top'||side==='bottom'){const y=side==='top'?o.y-ri(20,Math.max(21,gap-50))-40:o.y+bh+ri(20,Math.max(21,gap-50));S.ducts.push({id:'DF',x:o.x+ri(-50,100),y,w:ri(200,bw),h:40,dp:60,sheet:'field'});}
        else{const x=side==='left'?o.x-ri(20,Math.max(21,gap-50))-40:o.x+bw+ri(20,Math.max(21,gap-50));S.ducts.push({id:'DF',x,y:o.y+ri(0,100),w:40,h:ri(200,bh),dp:60,sheet:'field'});}}
      // 器具：底板 4～10 台、現場 2～6 台，不互相重疊、不壓線槽
      const placed=[];const put=(tpl,area,sheet)=>{const t=resolveTpl(tpl);for(let k=0;k<30;k++){const rot=sheet==='field'?pick([0,0,90,180,270]):pick([0,0,0,90]);const w=rot%180?t.h:t.w,h=rot%180?t.w:t.h;
        const r={x:Math.round(area.x+rnd()*Math.max(1,area.w-w)),y:Math.round(area.y+rnd()*Math.max(1,area.h-h)),w,h};
        if(placed.some(q=>ov(q,r))||S.ducts.some(d=>ov(d,r,2)))continue;placed.push(r);const id=(sheet==='field'?'F':'P')+S.devices.length;S.devices.push({id,tag:id,tpl,x:r.x,y:r.y,sheet,...(rot?{rot}:{})});return id;}return null;};
      const pa={x:10+dw+5,y:10+dw+5,w:pw-2*(dw+15),h:ph-2*(dw+15)};
      const pd=[],fd=[];for(let i=ri(4,10);i>0;i--){const id=put(pick(plateT),pa,'plate');if(id)pd.push(id);}
      for(let i=ri(2,6);i>0;i--){const id=put(pick(fieldT),{x:z.x+10,y:z.y+30,w:z.w-20,h:z.h-40},'field');if(id)fd.push(id);}
      if(pd.length<2)continue;
      const term=id=>{const d=devOf(id);return pick(tplOf(d).terms).id;};
      // 線：箱內線、外線，部分加中繼點；電纜：箱內器具到現場器具
      let wn=0;const W=(a,b,wps)=>{S.wires.push({id:'w'+wn,no:'W'+(wn++),a,b,wps:wps||[],gauge:.75,color:'black'});};
      for(let i=ri(4,10);i>0;i--){const a=pick(pd),c=pick(pd);if(a===c)continue;W({d:a,t:term(a)},{d:c,t:term(c)},rnd()<.25?[{x:Math.round(rnd()*pw),y:Math.round(rnd()*ph)}]:[]);}
      for(const f of fd){const a=pick(pd);const wp=rnd()<.3?[{x:Math.round(z.x+rnd()*z.w),y:Math.round(side==='top'?o.y-rnd()*gap:side==='bottom'?o.y+bh+rnd()*gap:z.y+rnd()*z.h)}]:[];W({d:a,t:term(a)},{d:f,t:term(f)},wp);
        if(rnd()<.5){const c=newCable('C'+f,'');const n=Math.min(3,tplOf(devOf(f)).terms.length);for(let k=0;k<n;k++){const w={id:'c'+wn,no:'CW'+(wn++),a:{d:a,t:term(a)},b:{d:f,t:tplOf(devOf(f)).terms[k].id},wps:[],gauge:.75,color:'black'};S.wires.push(w);attachCore(w,c,String(k+1));}}}
      // 箱內電纜：兩台箱內器具之間，一半在線槽裡放一個中繼點
      if(pd.length>=2&&rnd()<.6){const a=pick(pd);let c2=pick(pd);if(c2===a)c2=pd[(pd.indexOf(a)+1)%pd.length];const cb=newCable('CI'+n,'');
        for(let k=0;k<2;k++){const w={id:'ci'+wn,no:'CI'+(wn++),a:{d:a,t:term(a)},b:{d:c2,t:term(c2)},wps:[],gauge:.75,color:'black'};S.wires.push(w);attachCore(w,cb,String(k+1));}
        if(rnd()<.5){const d=pick(S.ducts.filter(x=>x.sheet!=='field'));cb.wps=[{x:Math.round(d.x+d.w/2),y:Math.round(d.y+d.h/2)}];}}
      try{resetUi();computeRoutes();}catch(e){add('程式錯誤',s,e.message);continue;}
      // 檢查
      const fixed=w=>{const c=w.cab&&cabOf(w.cab);return [...(w.wps||[]),...((c&&c.wps)||[])];};
      const fold=(P,F)=>{for(let i=1;i<P.length-1;i++){const a=P[i-1],q=P[i],c=P[i+1];if(F.some(f=>Math.abs(f.x-q.x)<1&&Math.abs(f.y-q.y)<1))continue;
        if((Math.abs(a.y-q.y)<.01&&Math.abs(q.y-c.y)<.01&&(q.x-a.x)*(c.x-q.x)<-.01)||(Math.abs(a.x-q.x)<.01&&Math.abs(q.x-c.x)<.01&&(q.y-a.y)*(c.y-q.y)<-.01))return `${Math.round(a.x)},${Math.round(a.y)}→${Math.round(q.x)},${Math.round(q.y)}→${Math.round(c.x)},${Math.round(c.y)}`;}return null;};
      if(DBG){const cbd=(S.cables||[]).find(x=>x.no===DBG),w=cbd?S.wires.find(x=>x.cab===cbd.id):S.wires.find(x=>x.no===DBG),r=w&&ROUTES.get(w.id),c=w&&w.cab&&cabOf(w.cab),R=c&&CABROUTES.get(c.id),f=q=>Math.round(q.x)+','+Math.round(q.y);
        return {dbg:{box:BR,ends:w&&[epText(w.a),f(endpoint(w.a,0)),endpoint(w.a,0).side,epText(w.b),f(endpoint(w.b,0))],parts:r&&r.parts&&r.parts.map(q=>q.map(f).join(' ')),pts:r&&r.pts.map(f).join(' '),bo:R&&[R.a,R.b],gland:r&&r.gland,
          sheath:R&&R.pts.map(f).join(' '),wps:c&&(c.wps||[]).map(f).join(' '),cores:c&&coresOf(c).map(x=>epText(x.a)+'@'+f(endpoint(x.a,0))+' / '+epText(x.b)+'@'+f(endpoint(x.b,0))),_c:c&&coresOf(c).map(x=>epText(x.a)+'@'+f(endpoint(x.a,0))),ducts:S.ducts.map(d=>d.id+':'+[d.x,d.y,d.w,d.h].join(',')),glands:S.glands.map(g=>g.id+':'+f(glandPt(g)))}};}
      for(const w of S.wires){const r=ROUTES.get(w.id);if(!r){add('沒有路徑',s,w.no);continue;}routes++;const P=r.pts;
        if(P.some(q=>!Number.isFinite(q.x)||!Number.isFinite(q.y))){add('座標異常',s,w.no);continue;}
        const f=fold(P,fixed(w));if(f)add(w.cab?'程式折返（電纜芯線）':'程式折返（一般線）',s,`${w.no}（${epText(w.a)} → ${epText(w.b)}${w.cab?'，電纜':''}）${f}`);
        const A=endpoint(w.a,0),B=endpoint(w.b,0),ia=inR(A,BR)&&!outBox(A),ib=inR(B,BR)&&!outBox(B);
        if(!fixed(w).length){const cr=P.filter((q,i)=>i&&inR(q,BR)!==inR(P[i-1],BR)).length,want=ia===ib?0:1;if(cr!==want)add('穿箱壁',s,`${w.no}（${epText(w.a)} → ${epText(w.b)}）穿 ${cr} 次，應 ${want} 次`);}
        // 箱內電纜外皮不可以縮到很短（兩個剝線點擠在一起、芯線各自拉長）
        if(w.cab){const c=cabOf(w.cab),R=CABROUTES.get(c.id),ce=k=>{const es=coresOf(c).map(x=>endpoint(x[k],0));return {x:es.reduce((s,e)=>s+e.x,0)/es.length,y:es.reduce((s,e)=>s+e.y,0)/es.length};},ca=ce('a'),cb=ce('b'),dd=Math.abs(ca.x-cb.x)+Math.abs(ca.y-cb.y);
          if(R&&dd>200&&R.len<dd*.15&&!c._short){c._short=1;add('外皮過短',s,`電纜 ${c.no} 外皮 ${Math.round(R.len)} mm，兩端相距 ${Math.round(dd)} mm`);}}
        const m=Math.abs(A.x-B.x)+Math.abs(A.y-B.y);if(!fixed(w).length&&r.len>m*4+600)add('繞路',s,`${w.no} 線長 ${Math.round(r.len)}，直角距離 ${Math.round(m)}`);}
    }
    return {stats,ex,routes};
  },[N,SEED,DBG]);
  if(res.dbg){console.log(JSON.stringify(res.dbg,null,1));await b.close();return;}
  console.log(`隨機配置 ${N} 組（種子 ${SEED}～${SEED+N-1}），共檢查 ${res.routes} 條路徑`);
  const ks=Object.keys(res.stats);
  // 繞路只列出參考，不算失敗（箱內兩台器具超過 95 mm 照規則要走線槽，繞一圈是正常的）
  // 防退步的上限：預設這組（150 組，種子 1 起）目前的結果。之後改走線，數字只能更少，變多就算失敗
  // 電纜芯線的折返目前剩下的是已知特例：剝線點兩側接點朝向不同的器具（例如 THS-62）、相鄰器具間的電纜最近的線槽在旁邊
  const LIMIT=N===150&&SEED===1?{'程式折返（電纜芯線）':18,'外皮過短':6}:{};
  const fail=ks.filter(k=>k!=='繞路'&&res.stats[k]>(LIMIT[k]||0));
  ks.forEach(k=>{const bad=fail.includes(k);console.log(`${bad?'✗':'△'} ${k}：${res.stats[k]} 條${k==='繞路'?'（參考）':bad?'':`（已知上限 ${LIMIT[k]} 條內）`}`);res.ex[k].forEach(x=>console.log('    '+x));});

  if(!fail.length)console.log('\n全部通過');
  if(errs.length)console.log('頁面錯誤：',errs.slice(0,3));
  await b.close();process.exit(fail.length||errs.length?1:0);
})();

// 同一台短接與接線盒畫法測試（伺服接線、其他接線頁）：
// - 接線盒（TB-PG 10P／15P，3 種組合）：方框在中間，左邊電箱側、右邊外部側；短路片只在電箱側並聯、拉一條線回電箱，外部側每腳各自拉線
// - 所有有 COM 與 S/S／0V 的 PLC 主機：S/S–0V 短接、COM 串接，畫成一條並聯線＋一條延伸線，不寫「（同一台）」
// - 伺服短路片（P+–D、P3–P4、P+–R1、C–R2）：直接接起來，沒有對外時不拉延伸線
// 每個案例檢查：不出錯、圖反推和配線一致、不重疊、沒有截斷
// 用法：node tests/jbox-check.js [截圖前綴]
const {chromium}=require('playwright'),path=require('path');
const {schemOverlaps}=require(path.resolve('tests/schem-overlap.js'));
(async()=>{const b=await chromium.launch(),p=await b.newPage({viewport:{width:1600,height:1130}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+path.resolve('index.html'));await p.addScriptTag({content:schemOverlaps.toString()});await p.emulateMedia({media:'print'});
const shot=process.argv[2];
const r=await p.evaluate(()=>{
  let k=0;const mk=()=>({devs:[],ws:[]});
  const D=(c,id,tpl,sheet,ex)=>{c.devs.push({id,tag:id,tpl,x:50+c.devs.length*40,y:100,sheet,...(ex||{})});};
  const W=(c,a,at,bb,bt,no)=>c.ws.push({id:'w'+(++k),no:no||('N'+k),a:{d:a,t:at},b:{d:bb,t:bt},wps:[],gauge:.75,color:'black'});
  const cases=[];
  // A. 接線盒
  ['tb10','tb15'].forEach(jb=>{const n=jb==='tb10'?10:15;
    [0,1,2].forEach(v=>{const c=mk();c.name=`${jb} 組合${v+1}`;c.kind='jbox';
      D(c,'TB','w2202-1401','plate');D(c,'JB',jb,'field',v===0?{links:[['1','2','3','4'],['5','6','7','8']]}:v===2?{links:[['1','2'],['3','4']]}:{});
      const sens=[];for(let i=1;i<=4;i++){D(c,'SQ'+i,'pzg102','field');sens.push('SQ'+i);}
      if(v===0){W(c,'TB','1B','JB','1','24V');W(c,'TB','2B','JB','5','0V');
        sens.forEach((s,i)=>{W(c,'JB',String(1+i),s,'棕','24V');W(c,'JB',String(5+i),s,'藍','0V');if(9+i<=n){W(c,'JB',String(9+i),s,'黑','X'+i);W(c,'TB',`${3+i}B`,'JB',String(9+i),'X'+i);}});}
      else if(v===1){for(let i=1;i<=Math.min(n,8);i++){W(c,'TB',`${i}B`,'JB',String(i),'S'+i);W(c,'JB',String(i),sens[(i-1)%4],['棕','藍','黑','白'][Math.floor((i-1)/4)%4],'S'+i);}}
      else{W(c,'TB','1B','JB','1','24V');W(c,'TB','2B','JB','3','0V');W(c,'JB','1','SQ1','棕','24V');W(c,'JB','1','SQ2','棕','24V');W(c,'JB','2','SQ3','棕','24V');W(c,'JB','3','SQ1','藍','0V');W(c,'JB','4','SQ2','藍','0V');W(c,'JB','4','SQ3','藍','0V');W(c,'TB','3B','JB','5','X0');W(c,'JB','5','SQ1','黑','X0');}
      cases.push(c);});});
  // B. PLC 主機：S/S–0V 或 S/S–24V 短接、COM 串接、對外接端子台
  const plcs=Object.keys(TPL).filter(id=>{const t=tplOf({tpl:id});return t.cat==='PLC'&&(t.terms||[]).some(q=>/^COM\d?$/.test(q.id))&&(t.terms||[]).some(q=>/^(S\/S|0V)$/.test(q.id));});
  plcs.forEach((id,ii)=>{const t=tplOf({tpl:id}),T=new Set(t.terms.map(q=>q.id)),c=mk();c.name='PLC '+id;c.kind='plc';D(c,'PLC',id,'plate');D(c,'TB','w2202-1401','plate');
    const coms=[...T].filter(x=>/^COM\d+$/.test(x)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));const z=T.has('0V')?'0V':T.has('24V')?'24V':null;
    if(T.has('S/S')&&z)W(c,'PLC',z,'PLC','S/S','0V');if(z)W(c,'TB','1B','PLC',z,'0V');
    for(let i=1;i<coms.length&&i<4;i++)W(c,'PLC',coms[i-1],'PLC',coms[i],'0V');if(coms.length&&ii%2)W(c,'PLC',coms[0],'TB','2B','0V');
    if(T.has('COM')&&T.has('S/S'))W(c,'PLC','COM','PLC','S/S','0V');
    cases.push(c);});
  // C. 伺服：短路片（P+–D、P3–P4、P+–R1、C–R2）
  const svs=Object.keys(TPL).filter(id=>{const t=tplOf({tpl:id});return /伺服/.test(t.cat||'')&&(t.terms||[]).some(q=>q.id==='P+');});
  svs.forEach(id=>{const T=new Set(tplOf({tpl:id}).terms.map(q=>q.id)),c=mk();c.name='伺服 '+id;c.kind='servo';D(c,'SV',id,'plate');D(c,'TB','w2202-1401','plate');
    [['P+','D'],['P3','P4'],['P+','R1'],['C','R2']].filter(([a,b])=>T.has(a)&&T.has(b)).forEach(([a,b2],j)=>W(c,'SV',a,'SV',b2,'短路'+j));
    ['L1','L2','L3'].filter(x=>T.has(x)).forEach((x,j)=>W(c,'TB',`${j+1}B`,'SV',x,'R'+j));
    cases.push(c);});
  const res=[];
  cases.forEach((c,ci)=>{try{S=normalize({box:{w:900,h:700,d:300,back:20},plate:{w:860,h:660},door:{w:900,h:700},ducts:[],glands:[],wires:c.ws,devices:c.devs}).state;resetUi();recompute();
    const B=schemBuild();document.getElementById('print').innerHTML=schemPrintHtml();const ov=schemOverlaps(),v=schemVerify(B);
    const pgs=B.pages.filter(x=>/^(其他接線|伺服接線)/.test(x.title)),svg=pgs.map(x=>x.svg).join('');
    const pr=[v.length?'對不上':'',ov.length?'重疊:'+ov[0].kind+' '+ov[0].a+'|'+ov[0].b:'',/（同一台）/.test(svg)?'同一台':'',/>[^<]*…[^<]*</.test(svg)?'截斷':'',
      c.kind==='jbox'&&!(/電箱側/.test(svg)&&/外部側/.test(svg))?'沒有兩側':'',c.kind==='servo'&&/只有同一台/.test(svg)?'純短接拉了延伸線':'',c.kind!=='jbox'&&c.ws.some(w=>w.a.d===w.b.d)&&!pgs.length&&!B.pages.some(x=>/PLC/.test(x.title))?'沒有接線頁':''].filter(Boolean);
    res.push({name:c.name,kind:c.kind,pr,ci});}catch(e){res.push({name:c.name,kind:c.kind,pr:['錯誤:'+e.message],ci});}});
  window.__cases=cases;return res;});
const NM={jbox:'接線盒',plc:'PLC 共點短接',servo:'伺服短路片'};let fail=0;
for(const k of Object.keys(NM)){const all=r.filter(x=>x.kind===k),bad=all.filter(x=>x.pr.length);fail+=bad.length+(all.length?0:1);
  console.log(bad.length||!all.length?`✗ ${NM[k]}：${bad.length} / ${all.length} 個案例有問題`:`✓ ${NM[k]}：${all.length} 個案例全部通過`);bad.slice(0,8).forEach(x=>console.log('  ',x.name,'→',x.pr.join('；')));}
if(shot){for(const nm of ['tb15 組合1','tb10 組合3','PLC fx5u-64mt-es','伺服 j4700']){const i=r.findIndex(x=>x.name===nm);if(i<0)continue;
  await p.evaluate(i=>{const c=__cases[i];S=normalize({box:{w:900,h:700,d:300,back:20},plate:{w:860,h:660},door:{w:900,h:700},ducts:[],glands:[],wires:c.ws,devices:c.devs}).state;resetUi();recompute();document.getElementById('print').innerHTML=schemPrintHtml();},i);
  const t=await p.evaluate(()=>schemBuild().pages.map(x=>x.title));const j=t.findIndex(x=>/^(其他接線|伺服接線)/.test(x));if(j<0)continue;const els=await p.$$('#print .sch-pg');await els[j].screenshot({path:`${shot}-${nm.replace(/\s/g,'_')}.png`});}}
errs.forEach(e=>{console.log('✗ 頁面錯誤：'+e);fail++;});console.log(fail?`\n失敗 ${fail} 項`:'\n全部通過');await b.close();process.exit(fail?1:0);})();

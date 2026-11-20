// 正式電路圖檢查（js/schem.js）：
// - 頁面組成：封面、目錄、主回路、控制回路、PLC 輸入輸出、線號表、材料表；A3 圖框、頁次、沒有殘留的佔位符號
// - 控制回路：從圖反推回每個接點、線圈的兩端，要和配線完全一致（schemVerify）；自保持畫成並聯
// - 線圈下方列出接點在哪一頁哪一欄；主回路的電源供應器標出 DC 輸出在第幾頁
// - 很寬的迴路會拉出中間電位、跨頁接續，仍然和配線一致
// - 伺服接線圖：光纖虛線、馬達與煞車、沒接的編碼器提醒
// - 重疊：實際排出每一頁，文字不能和文字、器具方框／圓、線重疊（IEC 垂直與舊 JIS 水平都檢查，含使用者專案）
// 用法：node tests/schem-check.js [使用者專案檔.json]（有給檔案時也檢查那份）
const {chromium}=require('playwright'),path=require('path'),fs=require('fs');
const {schemOverlaps}=require('./schem-overlap.js');
const userFile=process.argv[2];
(async()=>{
  const b=await chromium.launch(),p=await b.newPage({viewport:{width:1400,height:900}});
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+path.join(__dirname,'..','index.html'));
  const res=await p.evaluate(uj=>{
    const out=[],ok=(c,m)=>out.push((c?'✓ ':'✗ ')+m);
    const D=(id,tpl,x,y,sheet='plate',extra={})=>({id,tag:id,tpl,x,y,sheet,...extra});
    const build=(extraDev=[],extraW=null)=>{S=normalize({box:{w:900,h:700,d:300,back:20},plate:{w:860,h:660},door:{w:900,h:700},ducts:[],glands:[],wires:[],
      devices:[D('PWR','field-power',0,-300,'field'),D('Q1','ic60-3P16A',40,40),D('F1','ic60-1P6A',120,40),D('PS','drl120',160,40),D('PLC','fx5u32',300,40),
        D('KM','lc1d09',40,250),D('KX','ladn40',40.6,265,'plate',{on:'KM'}),D('SB1','py2201-g',600,100,'door'),D('SB2','py2201-r',600,150,'door'),
        D('KA','my2n-24',300,250),D('LP','lamp',400,-300,'field'),D('PX','e2e',200,-300,'field'),...extraDev]}).state;resetUi();
      let n=0;const W=(a,at,bb,bt)=>S.wires.push({id:'w'+(++n),no:'W'+n,a:{d:a,t:at},b:{d:bb,t:bt},wps:[],gauge:.75,color:'black'});
      W('PWR','R','Q1','1');W('PWR','S','Q1','3');W('PWR','T','Q1','5');
      W('Q1','2','PS','L');W('Q1','4','PS','N');W('Q1','2','PLC','L');W('Q1','4','PLC','N');
      W('PS','+V1','F1','1');W('F1','2','SB2','1');W('SB2','2','SB1','3');W('SB1','4','KM','A1');W('KM','A2','PS','-V1');
      W('SB2','2','KX','53');W('KX','54','KM','A1');
      W('PLC','S/S','PS','-V1');W('PX','棕','F1','2');W('PX','藍','PS','-V1');W('PX','黑','PLC','X0');
      W('PLC','COM0','PS','-V1');W('PLC','Y0','KA','14');W('KA','13','F1','2');
      W('Q1','2','KA','9');W('KA','5','LP','L/+');W('LP','N/−','Q1','4');
      if(extraW)extraW(W);recompute();};
    build();
    let B=schemBuild();const T=B.pages.map(x=>x.title);
    ok(T[0]==='封面與圖例'&&T[1]==='圖面目錄'&&T.some(t=>/^主回路/.test(t))&&T.some(t=>/^控制回路 24V（PS）/.test(t))&&T.some(t=>/^PLC 輸入 PLC、輸出 PLC$/.test(t))&&T.some(t=>/^線號表/.test(t))&&T.some(t=>/^材料表/.test(t)),`頁面組成（${B.pages.length} 頁，PLC 輸入輸出合在同一頁）：${T.slice(0,8).join('、')}…`);
    ok(B.pages.every(pg=>!/\u0001/.test(pg.svg+pg.html))&&B.pages.every((pg,i)=>pg.svg.includes(`>${i+1} / ${B.pages.length}<`)),'每頁標題欄頁次「n / 總頁數」，沒有殘留的佔位符號');
    ok(B.pages.every(pg=>/viewBox="0 0 420 297"/.test(pg.svg)&&/s-frame/.test(pg.svg)),'每頁都是 A3 橫式圖框（420×297）');
    { const v=schemVerify(B);ok(v.length===0&&v.checked>=10,`控制回路：從圖反推回每個元素的兩端，和配線完全一致（檢查 ${v.checked} 個）`); }
    // 自保持：SB1 3-4 和 KX 53-54 並聯
    const tr=B.M.ctrlTrees[0].tree,find=(t,f)=>f(t)||(t.c||[]).some(c=>find(c,f));
    ok(find(tr,t=>t.t==='par'&&t.c.some(c=>c.t==='leaf'&&c.e.d.tag==='SB1'&&c.e.ta==='3')&&t.c.some(c=>c.t==='leaf'&&c.e.d.tag==='KX')),'自保持：SB1 3-4 與 KX 53-54 畫成並聯');
    const ctrl=B.pages.find(x=>/^控制回路 24V（PS）/.test(x.title));
    ok(/∟53-54 \d+\.\d+/.test(ctrl.svg),'KM 線圈下方列出 KX 53-54 在第幾頁第幾欄');
    ok(/SB2[\s\S]*SB1|SB1[\s\S]*SB2/.test(ctrl.svg)&&/KA/.test(ctrl.svg)&&/>X0</.test(ctrl.svg),'控制回路含按鈕、繼電器線圈、PLC 輸入 X0');
    const main=B.pages.find(x=>/^主回路/.test(x.title));
    ok(main.svg.includes('>PS<')&&new RegExp(`24V 輸出 → 第 ${B.pages.indexOf(ctrl)+1} 頁`).test(main.svg),'主回路：電源供應器標出 24V 輸出在控制回路第幾頁');
    ok(/>Q1</.test(main.svg)&&/>LP[　<]/.test(main.svg),'主回路：Q1 斷路器、AC 燈（KA 接點控制）都畫出來');
    { // 每一層的分支照編號排，不照用電器具或接線先後
      build([D('F9','ic60-1P2A',200,40),D('F3','ic60-1P2A',220,40),D('LA','lamp',500,-300,'field'),D('LB','lamp',560,-300,'field')],W=>{W('Q1','2','F9','1');W('F9','2','LA','L/+');W('LA','N/−','Q1','4');W('Q1','2','F3','1');W('F3','2','LB','L/+');W('LB','N/−','Q1','4');});
      const sv=schemBuild().pages.find(x=>/^主回路/.test(x.title)).svg,i3=sv.indexOf('>F3<'),i9=sv.indexOf('>F9<'),xa=+/x="([\d.]+)"[^>]*>F3</.exec(sv)[1],xb=+/x="([\d.]+)"[^>]*>F9</.exec(sv)[1];
      ok(i3>0&&i9>0&&xa<xb,`主回路分支照開關編號排（F3 在 F9 左邊，即使 F9 接的燈編號在前）`); build(); B=schemBuild(); }
    // 線圈、負載一律靠下：KM 線圈在下方電源線附近
    { const pos=ctrl.pos.find(o=>o.e&&o.e.k==='coil'&&o.e.d.tag==='KM');ok(pos&&pos.y>SC.RB-25,`線圈靠下對齊（KM 線圈 y=${pos&&Math.round(pos.y)}，下方電源線 ${SC.RB}）`); }
    // 三線式感測器：電源（棕－藍）和輸出（棕→黑）排在相鄰兩欄，用虛線框起來
    { const P=ctrl.pos.filter(o=>o.e&&o.e.d.tag==='PX'),pw=P.find(o=>o.e.sensPwr),out=P.find(o=>o.e.k==='sens');
      ok(pw&&out&&Math.abs(pw.x-out.x)<=SC.U+.1&&Math.abs(pw.y-out.y)<1&&/class="s-grp"/.test(ctrl.svg),'三線式感測器 PX：電源（棕－藍）與輸出（棕→黑）並排在相鄰兩欄，用虛線框起來'); }
    // 器具名稱完整顯示（放不下換行，不截斷）
    { const doc=new DOMParser().parseFromString(ctrl.svg,'image/svg+xml'),all=[...doc.querySelectorAll('text')].map(t=>t.textContent.replace(/\s/g,'')).join('|');
      ok(all.includes(tplOf(devOf('KA')).n.replace(/\s/g,''))&&!/…/.test([...doc.querySelectorAll('text.s-sub')].map(t=>t.textContent).join('')),'控制回路器具名稱完整顯示（KA：'+tplOf(devOf('KA')).n+'），沒有截斷'+([...doc.querySelectorAll('text.s-sub')].map(t=>t.textContent).filter(t=>/…/.test(t)).join('；')||'')); }
    const plcIn=B.pages.find(x=>/PLC 輸入/.test(x.title));ok(/>PX</.test(plcIn.svg)&&/>X0</.test(plcIn.svg),'PLC 輸入頁：X0 接 PX 感測器');
    const html=schemPrintHtml();ok((html.match(/class="pg sch"/g)||[]).length===B.pages.length,'列印 HTML：每頁一個 A3 區塊');
    // 單極斷路器只切 R：S 相（N）在開關那一層要直接通過，從分配線到用電器具是一條連續的線
    build([D('F2','ic60-1P2A',200,40),D('L2','lamp',500,-300,'field')],W=>{W('Q1','2','F2','1');W('F2','2','L2','L/+');W('L2','N/−','Q1','4');});
    B=schemBuild();
    { const svg=B.pages.find(x=>/^主回路/.test(x.title)).svg,doc=new DOMParser().parseFromString(svg,'image/svg+xml');
      const lab=[...doc.querySelectorAll('text.s-term')].filter(t=>t.textContent==='N/−');let okAll=lab.length>0;
      lab.forEach(t=>{const x=+t.getAttribute('x')+.6,y=+t.getAttribute('y');const iv=[...doc.querySelectorAll('line')].filter(l=>Math.abs(+l.getAttribute('x1')-x)<.01&&Math.abs(+l.getAttribute('x2')-x)<.01).map(l=>[Math.min(+l.getAttribute('y1'),+l.getAttribute('y2')),Math.max(+l.getAttribute('y1'),+l.getAttribute('y2'))]).filter(v=>v[0]<y+2).sort((a,b)=>a[0]-b[0]);
        let end=iv.length?iv[0][1]:0;for(const v of iv.slice(1)){if(v[0]>end+6.5){okAll=false;break;} /* 開關符號本身有 6 mm 的接點空隙，之前的斷線是整段 20 幾 mm */end=Math.max(end,v[1]);}if(end<y-3)okAll=false;});
      ok(okAll,`主回路：單極斷路器沒切的相（燈的 N）從分配線到器具是連續的線（${lab.length} 處）`); }
    // 很寬的迴路：30 個燈並聯在 SB1 後面 → 拉出中間電位、跨頁，仍然一致
    build([...Array(30)].map((_,i)=>D('H'+i,'yw1l-g',20+i*10,400,'door')),W=>{for(let i=0;i<30;i++){W('KM','A1','H'+i,'X1');W('H'+i,'X2','PS','-V1');}});
    B=schemBuild();const cp=B.pages.filter(x=>/^控制回路 24V（PS）/.test(x.title));
    ok(cp.length>=2&&schemVerify(B).length===0&&cp.slice(1).some(pg=>/>W11</.test(pg.svg)),`太寬時拉出中間電位（W11）跨頁接續（${cp.length} 頁），仍然和配線一致`);
    // 電源線名稱用實際線號（PS 的 +V1 接 W8），不自己編「24V ＋」
    { build();const cp=schemBuild().pages.find(x=>/^控制回路/.test(x.title));ok(/>W8<tspan[^>]*>（PS \+V1）/.test(cp.svg)&&!/24V ＋/.test(cp.svg),'電源線名稱用實際線號（W8，小字註明 PS +V1），不寫「24V ＋」'); }
    // 舊 JIS＋水平：線圈畫圓、燈寫顏色字、電源線在左右、行號、交互參照「頁-行」，仍和配線一致
    { build();S.schemStyle={sym:'jis',dir:'h'};const J=schemBuild(),cp=J.pages.find(x=>/^控制回路/.test(x.title)),doc=new DOMParser().parseFromString(cp.svg,'image/svg+xml');
      const rails=[...doc.querySelectorAll('line.s-rail')];
      ok(schemVerify(J).length===0&&rails.length>=2&&rails.every(l=>l.getAttribute('x1')===l.getAttribute('x2')),'水平：電源線是左右兩條直線，圖和配線仍一致');
      ok(doc.querySelectorAll('text.s-ln').length>=3,'水平：每一行有行號');
      ok(/<circle[^>]*r="3.4"/.test(cp.svg)&&!/<rect x="[\d.]+" y="[\d.]+" width="5.2" height="8"/.test(cp.svg),'舊 JIS：線圈畫成圓');
      const main=J.pages.find(x=>/^主回路/.test(x.title));ok(/>R<\/text>/.test(main.svg)||/>G<\/text>/.test(cp.svg)||/>L<\/text>/.test(main.svg),'舊 JIS：指示燈圓圈內寫顏色字');
      ok(/∟53-54 \d+-\d+/.test(cp.svg)||/∟\d+-\d+/.test(cp.svg),'水平：交互參照用「頁-行」');
      ok(J.pages[0].svg.includes('舊 JIS 習慣畫法'),'封面圖例標明畫法');
      const n=normalize({...JSON.parse(JSON.stringify(S)),schemStyle:{sym:'jis',dir:'x'}}).state;ok(n.schemStyle&&n.schemStyle.sym==='jis'&&n.schemStyle.dir==='v','畫法選項存檔（不合法的值改回預設）');
      delete S.schemStyle;ok(schemBuild().pages.find(x=>/^控制回路/.test(x.title)).svg.match(/<line class="s-rail"[^>]*>/g).every(l=>/y1="(\S+)"[^>]*y2="\1"/.test(l)),'改回 IEC 垂直：電源線又是上下水平'); }
    // 專案名稱存檔
    { const n=normalize({...JSON.parse(JSON.stringify(S)),docTitle:'  測試專案  '}).state;ok(n.docTitle==='測試專案','標題欄專案名稱存在專案檔'); S.docTitle='測試專案';ok(schemBuild().pages[2].svg.includes('測試專案'),'標題欄顯示專案名稱'); }
    $('tabTool').click();ok($('schPrint')&&$('schPrev')&&$('schTitle'),'工具分頁有正式電路圖（專案名稱、預覽、列印）');
    $('schPrev').click();ok(document.querySelectorAll('#schPrevBox .pg.sch').length>2,'預覽顯示全部頁面');$('schPrevClose').click();
    if(uj){S=normalize(JSON.parse(uj)).state;resetUi();recompute();const t=performance.now();const U=schemBuild();
      { const cut=[];U.pages.forEach(pg=>{const doc=new DOMParser().parseFromString(pg.svg,'image/svg+xml');[...doc.querySelectorAll('text')].forEach(t=>{if(/…/.test(t.textContent)&&!/等 \d+ 個/.test(t.textContent))cut.push(`第 ${pg.no} 頁 ${t.textContent}`);});});
        ok(!cut.length,'使用者專案：文字完整顯示，沒有被截斷（…）'+(cut.length?`：${cut.length} 處，${cut.slice(0,3).join('；')}`:'')); }
      ok(schemVerify(U).length===0&&U.pages.every(pg=>!/\u0001/.test(pg.svg+pg.html)),`使用者專案：${U.pages.length} 頁，${Math.round(performance.now()-t)} ms，圖和配線一致`);}
    return out;},userFile?fs.readFileSync(userFile,'utf8'):null);
  // 其他接線：沒有動作資料的器具（二極體）接的線，畫在「其他接線」頁
  res.push(...await p.evaluate(()=>{const out=[],ok=(c,m)=>out.push((c?'✓ ':'✗ ')+m);
    const D=(id,tpl,x,y,sheet='plate')=>({id,tag:id,tpl,x,y,sheet});
    S=normalize({box:{w:900,h:700,d:300,back:20},plate:{w:860,h:660},door:{w:900,h:700},ducts:[],glands:[],wires:[],devices:[D('PWR','field-power',0,-300,'field'),D('Q1','ic60-3P16A',40,40),D('PS','drl120',160,40),D('KA','my2n-24',300,250),D('DX','diode',700,400)]}).state;resetUi();
    let n=0;const W=(a,at,bb,bt)=>S.wires.push({id:'w'+(++n),no:'W'+n,a:{d:a,t:at},b:{d:bb,t:bt},wps:[],gauge:.75,color:'black'});
    W('PWR','R','Q1','1');W('PWR','S','Q1','3');W('Q1','2','PS','L');W('Q1','4','PS','N');W('PS','+V1','KA','14');W('KA','13','PS','-V1');W('DX','A','KA','13');W('DX','K','KA','14');recompute();
    const pg=schemBuild().pages.find(x=>/^其他接線/.test(x.title)&&/DX/.test(x.title));ok(pg&&/>KA：13</.test(pg.svg)&&/>KA：14</.test(pg.svg),'其他接線頁：沒畫在其他頁的器具（二極體 DX）列出端子與對端'+(pg?'':'；其他頁：'+schemBuild().pages.filter(x=>/^其他/.test(x.title)).map(x=>x.title).join('、')));
    return out;}));
  // 伺服接線圖
  res.push(...await p.evaluate(()=>{const out=[],ok=(c,m)=>out.push((c?'✓ ':'✗ ')+m),D=(id,tpl,x,y,sheet='plate',extra={})=>({id,tag:id,tpl,x,y,sheet,...extra});
    S=normalize({box:{w:900,h:700,d:300,back:20},plate:{w:860,h:660},door:{w:900,h:700},ducts:[],glands:[],wires:[],
      devices:[D('PWR','field-power',0,-300,'field'),D('Q1','ic60-3P16A',40,40),D('SV','je40',300,40),D('SSC','fx540ssc',500,40),D('M','hgkn43',300,-300,'field')]}).state;resetUi();
    let n=0;const W=(a,at,bb,bt,no)=>S.wires.push({id:'w'+(++n),no:no||'W'+n,a:{d:a,t:at},b:{d:bb,t:bt},wps:[],gauge:.75,color:'black'});
    W('PWR','R','Q1','1');W('PWR','S','Q1','3');W('PWR','T','Q1','5');W('Q1','2','SV','L1');W('Q1','4','SV','L2');W('Q1','6','SV','L3');
    W('SV','U','M','U');W('SV','V','M','V');W('SV','W','M','W');W('SSC','SSCNET','SV','CN1A','光纖1');recompute();
    const B=schemBuild(),pg=B.pages.find(x=>/^伺服接線/.test(x.title));
    ok(pg&&/>M</.test(pg.svg)&&/stroke-dasharray="2 1.2"/.test(pg.svg)&&/SSC：SSCNET/.test(pg.svg),'伺服接線圖：馬達、光纖（虛線）接到 40SSC');
    ok(pg&&/CN2（編碼器）：沒有接線/.test(pg.svg),'伺服接線圖：編碼器 CN2 沒接線時提醒');
    // 兩端都是接頭的電纜（編碼器線）沒有芯線、也沒有導線，仍然算接上
    S.cables=[{id:'c1',no:'C9',spec:'伺服編碼線',cores:[{n:'1',c:'black',g:.5}],plug:{a:{d:'SV',t:'CN2'},b:{d:'M',t:'ENC'}}}];recompute();
    { const pg2=schemBuild().pages.find(x=>/^伺服接線/.test(x.title));ok(pg2&&!/CN2（編碼器）：沒有接線/.test(pg2.svg)&&/C9　伺服編碼線/.test(pg2.svg),'伺服接線圖：兩端接頭的編碼器電纜（沒有芯線）也算接上，標電纜編號'); }
    return out;}));
  // 重疊：測試電路與使用者專案，兩種畫法
  await p.addScriptTag({content:schemOverlaps.toString()});await p.emulateMedia({media:'print'});
  const ovl=async(label,uj,st)=>{const r=await p.evaluate(([uj,st,label])=>{if(uj){S=normalize(JSON.parse(uj)).state;resetUi();recompute();}
      if(st)S.schemStyle=st;else delete S.schemStyle;document.getElementById('print').innerHTML=schemPrintHtml();return schemOverlaps().map(o=>`第 ${o.page} 頁 ${o.kind}：${o.a}｜${o.b}`);},[uj,st,label]);
    res.push((r.length?'✗ ':'✓ ')+`${label}：文字沒有和其他文字、器具、線重疊`+(r.length?`（${r.length} 處：${r.slice(0,3).join('；')}）`:''));};
  await ovl('測試電路（IEC 垂直）',null,null);await ovl('測試電路（舊 JIS 水平）',null,{sym:'jis',dir:'h'});
  if(userFile){const uj=fs.readFileSync(userFile,'utf8');await ovl('使用者專案（IEC 垂直）',uj,null);await ovl('使用者專案（舊 JIS 水平）',uj,{sym:'jis',dir:'h'});}
  await b.close();
  res.forEach(l=>console.log(l));errs.forEach(e=>console.log('✗ 頁面錯誤：'+e));
  const fail=res.filter(l=>l.startsWith('✗')).length+errs.length;console.log(fail?`\n失敗 ${fail} 項`:'\n全部通過');process.exit(fail?1:0);
})();

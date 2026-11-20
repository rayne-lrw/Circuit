// 器具覆蓋測試的電路產生器：每種器具照它的動作資料套 3 種電路（在瀏覽器裡執行，需要 TPL、simElems、hostOk 等）。
// coverCases(種類) → [{tpl, k:組合編號, name, devs, ws, dut:受測器具 id}]
function coverCases(kind){
  const out=[];
  const elsOf=k=>{try{return simElems({tpl:k,id:'x'})}catch(e){return [];}};
  const mk=()=>{const devs=[],ws=[];let n=0,px=0;
    const D=(id,tpl,sheet='plate',extra={})=>{devs.push({id,tag:id,tpl,x:(px%12)*70+10,y:Math.floor(px/12)*90+10,sheet,...extra});px++;return id;};
    const W=(a,at,b,bt)=>ws.push({id:'w'+(++n),no:'W'+n,a:{d:a,t:at},b:{d:b,t:bt},wps:[],gauge:.75,color:'black'});return {devs,ws,D,W};};
  if(kind==='brk'){
    const ks=Object.keys(TPL).filter(k=>tplOf({tpl:k}).cat==='斷路器');
    const hosts=ks.filter(k=>!tplOf({tpl:k}).attach&&elsOf(k).some(e=>e.k==='brk'));
    const atts=ks.filter(k=>tplOf({tpl:k}).attach);
    // 附件能裝在哪些主體上：實際放一次試裝
    const fitHosts=a=>hosts.filter(h=>{const H={id:'H',tag:'H',tpl:h,x:100,y:100,sheet:'plate'},O={id:'O',tag:'O',tpl:a,x:100,y:100,sheet:'plate'};try{return hostOk(H,O);}catch(e){return false;}});
    const attFor=new Map();atts.forEach(a=>attFor.set(a,fitHosts(a)));
    const hostAtt=new Map();attFor.forEach((hs,a)=>hs.forEach(h=>{if(!hostAtt.has(h))hostAtt.set(h,[]);hostAtt.get(h).push(a);}));
    const poles=k=>elsOf(k).filter(e=>e.k==='brk'||e.k==='pass').map(e=>({a:e.a,b:e.b,n:/^N/.test(e.a)}));
    const build=(k,combo,att)=>{const C=mk(),{D,W}=C,P=poles(k),hasN=P.some(p=>p.n),ph=P.filter(p=>!p.n);
      D('PWR',hasN?'field-power-n':'field-power','field');
      const PH=['R','S','T'];let dut;
      if(combo===3){D('Q0','fuji-bw50');PH.forEach((p,i)=>W('PWR',p,'Q0',String(i*2+1)));}
      const feed=(i)=>combo===3?['Q0',String(i*2+2)]:['PWR',PH[i]];
      dut=D('DUT',k);
      // 各極的電源側
      const wired=combo===3?ph.slice(0,1):ph.slice(0,3);
      wired.forEach((p,i)=>{const [d,t]=feed(i);W(d,t,dut,p.a);});
      const nP=P.find(p=>p.n);if(nP)W('PWR','N',dut,nP.a);
      const ret=nP?[dut,nP.b]:ph.length>=2&&combo!==3?[dut,ph[1].b]:combo===3?['Q0','4']:['PWR','S']; // 回路：N 極、第二極或另一相
      const b1=[dut,ph[0]?ph[0].b:P[0].b];
      if(combo===1){ // 主回路：三極以上接三相馬達、兩極接燈，有 N 極的另外接一盞燈
        if(ph.length>=3){D('M1','motor3','field');['U','V','W'].forEach((t,i)=>W(dut,ph[i].b,'M1',t));if(nP){D('EL','lamp','field');W(dut,ph[0].b,'EL','L/+');W(dut,nP.b,'EL','N/−');}}
        else{D('EL','lamp','field');W(b1[0],b1[1],'EL','L/+');W(ret[0],ret[1],'EL','N/−');}}
      if(combo===2){ // AC 控制回路：停止→啟動→繼電器（自保持）＋指示燈
        D('SBS','py2201-r','door');D('SBR','py2201-g','door');D('KA','my2n-220');D('HL','yw1l-g','door');
        W(b1[0],b1[1],'SBS','1');W('SBS','2','SBR','3');W('SBR','4','KA','14');W('KA','13',ret[0],ret[1]);W('SBS','2','KA','9');W('KA','5','KA','14');
        W(b1[0],b1[1],'KA','12');W('KA','8','HL','X1');W('HL','X2',ret[0],ret[1]);}
      if(combo===3){ // 上游另有主斷路器；受測的只接第一極（其餘是備用極）餵 24V 電源，附件接點接指示燈
        D('PS','drl120');W(b1[0],b1[1],'PS','L');W(ret[0],ret[1],'PS','N');D('SB','py2201-g','door');D('HL','yw1l-g','door');W('PS','+V1','SB','3');W('SB','4','HL','X1');W('HL','X2','PS','-V1');
        if(att){const T=tplOf({tpl:att}),A=D('AUX',att,'plate',{on:dut});const sw=elsOf(att).filter(e=>e.k==='sw'),ld=elsOf(att).filter(e=>e.k==='load');
          sw.forEach((e,i)=>{const h=D('HA'+i,'yw1l-g','door');W('PS','+V1',A,e.a);W(A,e.b,h,'X1');W(h,'X2','PS','-V1');});
          ld.forEach(e=>{const sb=D('SBT','py2201-g','door');W('PS','+V1',sb,'3');W(sb,'4',A,e.a);W(A,e.b,'PS','-V1');});}}
      return {tpl:k,k:combo,att,name:`${k} 組合${combo}${att?'＋'+att:''}`,devs:C.devs,ws:C.ws,dut};};
    hosts.forEach(k=>{const A=hostAtt.get(k)||[];[1,2,3].forEach(c=>out.push(build(k,c,c===3?A[0]:null)));});
    // 保險絲座（沒有斷路器動作，只有導通）
    ks.filter(k=>!tplOf({tpl:k}).attach&&!elsOf(k).some(e=>e.k==='brk')&&elsOf(k).some(e=>e.k==='pass')).forEach(k=>[1,2,3].forEach(c=>out.push(build(k,c,null))));
    // 附件：每種至少裝在 3 種主體上
    attFor.forEach((hs,a)=>hs.slice(0,3).forEach(h=>out.push(build(h,3,a))));
    out.untestable=ks.filter(k=>!elsOf(k).length).concat([...attFor].filter(([a,hs])=>!hs.length).map(([a])=>a));
  }
  if(kind==='mc'||kind==='relay'){ // 有線圈的器具（接觸器、繼電器、計時器、SSR）＋它的附件（輔助接點、積熱電驛）
    const CAT=kind==='mc'?'電磁接觸器':'繼電器／計時';
    const ks=Object.keys(TPL).filter(k=>tplOf({tpl:k}).cat===CAT);
    const hosts=Object.keys(TPL).filter(k=>{const c=tplOf({tpl:k}).cat;return (c==='電磁接觸器'||c==='繼電器／計時')&&(!tplOf({tpl:k}).attach||tplOf({tpl:k}).attach==='slot')&&elsOf(k).some(e=>e.k==='coil');}); // SSR 是插槽附件，但自己有線圈，也可以單獨放
    const atts=ks.filter(k=>tplOf({tpl:k}).attach&&tplOf({tpl:k}).attach!=='slot'&&elsOf(k).length);
    const fitHosts=a=>hosts.filter(h=>{const H={id:'H',tag:'H',tpl:h,x:100,y:100,sheet:'plate'},O={id:'O',tag:'O',tpl:a,x:100,y:100,sheet:'plate'};try{return hostOk(H,O);}catch(e){return false;}});
    const attFor=new Map();atts.forEach(a=>attFor.set(a,fitHosts(a)));
    const hostAtt=new Map();attFor.forEach((hs,a)=>hs.forEach(h=>{if(!hostAtt.has(h))hostAtt.set(h,[]);hostAtt.get(h).push(a);}));
    const isMain=t=>/^(L\d|R\d|[1-6])(\(\d\))?$/.test(t);
    const build=(k,combo,att)=>{const C=mk(),{D,W}=C,E=elsOf(k);let lampN=0;
      D('PWR','field-power','field');D('Q0','fuji-bw50');['R','S','T'].forEach((p,i)=>W('PWR',p,'Q0',String(i*2+1)));
      D('F1','ic60-1P2A');W('Q0','2','F1','1');D('PS','drl120');W('F1','2','PS','L');W('Q0','4','PS','N');
      const T0=tplOf({tpl:k}),hsT=T0.rackKind==='ssr'&&combo===3?Object.keys(TPL).find(q=>TPL[q].ssrHost&&TPL[q].rack&&TPL[q].rack.length>=1):null;if(hsT)D('HS',hsT);
      const dut=D('DUT',k,'plate',hsT?{on:'HS',rack:0}:{});
      const gs=[...new Set(E.filter(e=>e.k==='coil').map(e=>e.g||''))];
      const swOf=g=>E.filter(e=>e.k==='sw'&&e.by==='coil'&&(e.g||'')===g);
      const lamp=(p,n,a,b)=>{const h=D('HL'+(++lampN),'yw1l-g','door');W(p[0],p[1],dut,a);W(dut,b,h,'X1');W(h,'X2',n[0],n[1]);};
      // 附件
      let A=null,AE=[];if(att){A=D('AUX',att,'plate',{on:dut});AE=elsOf(att);}
      const thM=AE.filter(e=>e.k==='pass'),thT=tplOf({tpl:att||k}).terms||[];
      // 主接點 → 馬達（多組線圈：第二組相序對調，正反轉）
      let mot=null;const motT=['U','V','W'];
      const linked=!!tplOf({tpl:k}).links;
      gs.forEach((g,gi)=>{const M=swOf(g).filter(e=>isMain(e.a));if(!M.length||(gi&&linked))return; // 內部已並聯、換相的第二組不另外接
        if(M.length>=3){if(!mot)mot=D('M1','motor3','field');
          M.slice(0,3).forEach((e,i)=>{W('Q0',String((gi?2-i:i)*2+2),dut,e.a);
            if(gi===0&&A&&tplOf({tpl:att}).attach==='under'){const tt=thT.find(t=>t.id==='T'+(i+1));if(tt)W(A,tt.id,'M1',motT[i]);}
            else W(dut,e.b,'M1',motT[gi?2-i:i]);});}
        else{M.forEach((e,i)=>{const h=D('EL'+gi+i,'lamp','field');W('Q0','2',dut,e.a);W(dut,e.b,h,'L/+');W(h,'N/−','Q0','4');});}});
      // 線圈
      const ac=combo===2;let fu=null;if(ac){fu=D('FU','tend-tfbr-321');W('Q0','2',fu,'1');}
      const P=ac?[fu,'2']:['PS','+V1'],N=ac?['Q0','4']:['PS','-V1'];
      const usedSw=new Set();
      gs.forEach((g,gi)=>{const c=E.find(e=>e.k==='coil'&&(e.g||'')===g);let cur=P;
        // 積熱電驛 95-96 串在線圈前面
        const ol=AE.find(e=>e.k==='sw'&&e.by==='trip'&&e.nc)||E.find(e=>e.k==='sw'&&e.by==='trip'&&e.nc);
        if(ol&&gi===0){const od=AE.includes(ol)?A:dut;W(cur[0],cur[1],od,ol.a);cur=[od,ol.b];}
        const sbs=D('SBS'+gi,'py2201-r','door'),sbr=D('SBR'+gi,'py2201-g','door');W(cur[0],cur[1],sbs,'1');W(sbs,'2',sbr,'3');let top=[sbr,'4'];
        // 互鎖：另一組的常閉輔助
        const og=gs.find(x=>x!==g);if(og!=null){const nc=swOf(og).find(e=>e.nc&&!isMain(e.a)&&!usedSw.has(e));if(nc){usedSw.add(nc);W(top[0],top[1],dut,nc.a);top=[dut,nc.b];}}
        W(top[0],top[1],dut,c.a);W(dut,c.b,N[0],N[1]);
        // 自保持：這一組的第一個常開輔助
        if(combo!==1){const no=swOf(g).find(e=>!e.nc&&!isMain(e.a)&&!usedSw.has(e));if(no){usedSw.add(no);W(sbs,'2',dut,no.a);W(dut,no.b,sbr,'4');}}});
      // 其餘輔助接點、積熱電驛 97-98、附件接點：各接一盞燈
      const usedT=new Set([...usedSw].flatMap(e=>[e.a,e.b]));
      E.filter(e=>e.k==='sw'&&!isMain(e.a)&&!usedSw.has(e)&&!(e.by==='trip'&&e.nc&&!att)).forEach(e=>{if(usedT.has(e.a)||usedT.has(e.b))return;usedT.add(e.a);usedT.add(e.b);lamp(P,N,e.a,e.b);}); // 和已用接點共點的（9-5／9-1）不再接，免得短路
      AE.filter(e=>e.k==='sw'&&!(e.by==='trip'&&e.nc)).forEach(e=>{const h=D('HL'+(++lampN),'yw1l-g','door');W(P[0],P[1],A,e.a);W(A,e.b,h,'X1');W(h,'X2',N[0],N[1]);});
      return {tpl:k,k:combo,att,name:`${k} 組合${combo}${att?'＋'+att:''}`,devs:C.devs,ws:C.ws,dut};};
    // 積熱電驛（獨立式，有主回路熱動元件）：接在接觸器後面
    const buildOl=(k,combo)=>{const C=mk(),{D,W}=C,E=elsOf(k);
      D('PWR','field-power','field');D('Q0','fuji-bw50');['R','S','T'].forEach((p,i)=>W('PWR',p,'Q0',String(i*2+1)));
      D('F1','ic60-1P2A');W('Q0','2','F1','1');D('PS','drl120');W('F1','2','PS','L');W('Q0','4','PS','N');
      D('KM','lc1d18');const dut=D('DUT',k);D('M1','motor3','field');
      E.filter(e=>e.k==='pass').slice(0,3).forEach((e,i)=>{W('Q0',String(i*2+2),'KM','L'+(i+1));if(combo===3){D('TBM','w2202-1401','plate',{cnt:4});W('KM','T'+(i+1),'TBM',(i+1)+'A');W('TBM',(i+1)+'C',dut,e.a);}else W('KM','T'+(i+1),dut,e.a);W(dut,e.b,'M1','UVW'[i]);});
      const ac=combo===2;let fu=null;if(ac){fu=D('FU','tend-tfbr-321');W('Q0','2',fu,'1');}const P=ac?[fu,'2']:['PS','+V1'],N=ac?['Q0','4']:['PS','-V1'];
      const nc=E.find(e=>e.k==='sw'&&e.nc),no=E.find(e=>e.k==='sw'&&!e.nc);D('SB','py2201-g','door');
      W(P[0],P[1],dut,nc.a);W(dut,nc.b,'SB','3');W('SB','4','KM','A1');W('KM','A2',N[0],N[1]);
      if(no){D('HL','yw1l-r','door');W(P[0],P[1],dut,no.a);W(dut,no.b,'HL','X1');W('HL','X2',N[0],N[1]);}
      return {tpl:k,k:combo,name:`${k} 組合${combo}`,devs:C.devs,ws:C.ws,dut};};
    const buildIl=(k,combo)=>{const C=mk(),{D,W}=C,T=tplOf({tpl:k}),base=T.pair,BE=elsOf(base);
      D('PWR','field-power','field');D('Q0','fuji-bw50');['R','S','T'].forEach((p,i)=>W('PWR',p,'Q0',String(i*2+1)));
      D('F1','ic60-1P2A');W('Q0','2','F1','1');D('PS','drl120');W('F1','2','PS','L');W('Q0','4','PS','N');
      D('KMF',base);D('KMR',base);const dut=D('DUT',k,'plate',{pair:['KMF','KMR']});
      const PW=T.prewire||[['L1','L1'],['L2','L2'],['L3','L3'],['T1','T3'],['T2','T2'],['T3','T1']];PW.forEach(([a,b])=>W('KMF',a,'KMR',b));
      const main=BE.filter(e=>e.k==='sw'&&isMain(e.a)).slice(0,3);D('M1','motor3','field');
      main.forEach((e,i)=>{W('Q0',String(i*2+2),'KMF',e.a);if(combo===3){D('TBM','w2202-1401','plate',{cnt:4});W('KMF',e.b,'TBM',(i+1)+'A');W('TBM',(i+1)+'C','M1','UVW'[i]);}else W('KMF',e.b,'M1','UVW'[i]);});
      const ac=combo===2;let fu=null;if(ac){fu=D('FU','tend-tfbr-321');W('Q0','2',fu,'1');}const P=ac?[fu,'2']:['PS','+V1'],N=ac?['Q0','4']:['PS','-V1'];
      const coil=BE.find(e=>e.k==='coil'),nc=BE.find(e=>e.k==='sw'&&e.nc&&!isMain(e.a)),no=BE.find(e=>e.k==='sw'&&!e.nc&&!isMain(e.a));
      D('SBS','py2201-r','door');W(P[0],P[1],'SBS','1');
      [['KMF','KMR'],['KMR','KMF']].forEach(([me,ot],i)=>{const sb=D('SB'+me,'py2201-g','door');W('SBS','2',sb,'3');let top=[sb,'4'];
        if(nc){W(top[0],top[1],ot,nc.a);top=[ot,nc.b];}W(top[0],top[1],me,coil.a);W(me,coil.b,N[0],N[1]);
        if(no&&combo!==1){W('SBS','2',me,no.a);W(me,no.b,sb,'4');}});
      return {tpl:k,k:combo,name:`${k} 組合${combo}`,devs:C.devs,ws:C.ws,dut};};
    const buildPn=(k,combo)=>{const C=mk(),{D,W}=C,E=elsOf(k),pn=E.find(e=>e.k==='pnoz');
      D('PWR','field-power','field');D('Q0','fuji-bw50');['R','S','T'].forEach((p,i)=>W('PWR',p,'Q0',String(i*2+1)));
      D('F1','ic60-1P2A');W('Q0','2','F1','1');D('PS','drl120');W('F1','2','PS','L');W('Q0','4','PS','N');const dut=D('DUT',k);
      const pw=E.find(e=>e.k==='pwr');W('PS','+V1',dut,pw.a);W(dut,pw.b,'PS','-V1');
      const I=pn.ins;D('ES1','yw1b','door');
      if(combo===2){W(dut,I[0],'ES1','1');W('ES1','2',dut,I[2]);W(dut,I[1],'ES1',"1'");W('ES1',"2'",dut,I[3]);} // 交叉配對
      else{W(dut,I[0],'ES1','1');if(combo===3){D('ES2','yw1b','door');W('ES1','2','ES2','1');W('ES2','2',dut,I[1]);W(dut,I[2],'ES1',"1'");W('ES1',"2'",'ES2',"1'");W('ES2',"2'",dut,I[3]);}else{W('ES1','2',dut,I[1]);W(dut,I[2],'ES1',"1'");W('ES1',"2'",dut,I[3]);}}
      if(pn.auto&&combo!==3)W(dut,pn.auto[0],dut,pn.auto[1]);else if(pn.auto){D('SBRS','py2201-g','door');W(dut,pn.auto[0],'SBRS','3');W('SBRS','4',dut,pn.auto[1]);}
      const outs=E.filter(e=>e.k==='sw');D('KM','lc1d18');W('PS','+V1',dut,outs[0].a);W(dut,outs[0].b,'KM','A1');W('KM','A2','PS','-V1');
      outs.slice(1).forEach((e,i)=>{const h=D('HL'+i,'yw1l-g','door');W('PS','+V1',dut,e.a);W(dut,e.b,h,'X1');W(h,'X2','PS','-V1');});
      return {tpl:k,k:combo,name:`${k} 組合${combo}`,devs:C.devs,ws:C.ws,dut};};
    ks.filter(k=>elsOf(k).some(e=>e.k==='pnoz')).forEach(k=>[1,2,3].forEach(c=>out.push(buildPn(k,c))));
    ks.filter(k=>tplOf({tpl:k}).ilock&&tplOf({tpl:k}).pair&&TPL[tplOf({tpl:k}).pair]).forEach(k=>[1,2,3].forEach(c=>out.push(buildIl(k,c))));
    ks.filter(k=>hosts.includes(k)).forEach(k=>{const A=hostAtt.get(k)||[];[1,2,3].forEach(c=>out.push(build(k,c,c===3?A[0]||null:null)));});
    ks.filter(k=>!tplOf({tpl:k}).attach&&!hosts.includes(k)&&elsOf(k).some(e=>e.k==='pass')&&elsOf(k).some(e=>e.by==='trip')).forEach(k=>[1,2,3].forEach(c=>out.push(buildOl(k,c))));
    attFor.forEach((hs,a)=>hs.slice(0,3).forEach((h,i)=>out.push(build(h,[3,2,1][i],a))));
    const covered=new Set(out.flatMap(c=>[c.tpl,c.att].filter(Boolean)));
    out.untestable=ks.filter(k=>!covered.has(k));
  }
  if(kind==='tb'){ // 端子台、接地排、牛角轉接座：當中繼，線經過它圖不能斷，並列在端子台頁
    const ks=Object.keys(TPL).filter(k=>tplOf({tpl:k}).cat==='端子台／接地');
    const groupsOf=k=>{const SS=S;S=normalize({box:{w:900,h:700,d:300,back:20},plate:{w:860,h:660},door:{w:900,h:700},ducts:[],glands:[],wires:[],devices:[{id:'T',tag:'T',tpl:k,x:10,y:10,sheet:'plate'}]}).state;
      let r;const sv=SIMST;try{SIMST=null;simReset();SIMST.all=true;r=simRun();}finally{SIMST=sv;}const T=(tplOf(S.devices[0]).terms||[]).filter(t=>!/^CN\d$/.test(t.id));const g={};
      T.forEach(t=>{const n=r.topo.node(nodeKey({d:'T',t:t.id}));(g[n]=g[n]||[]).push(t.id);});const cn=(tplOf(S.devices[0]).terms||[]).filter(t=>/^CN\d$/.test(t.id)).map(t=>t.id);S=SS;return {G:Object.values(g),cn};};
    const base=()=>{const C=mk(),{D,W}=C;D('PWR','field-power','field');D('Q0','fuji-bw50');['R','S','T'].forEach((p,i)=>W('PWR',p,'Q0',String(i*2+1)));
      D('F1','ic60-1P2A');W('Q0','2','F1','1');D('PS','drl120');W('F1','2','PS','L');W('Q0','4','PS','N');return C;};
    const io=(G,i)=>{const g=G[i%G.length];return [g[0],g[1]||g[0]];}; // 一組有兩個端子：進出各一；只有一個：兩條線接同一個端子
    ks.forEach(k=>{const {G,cn}=groupsOf(k);if(!G.length)return;
      [1,2,3].forEach(combo=>{const C=base(),{D,W}=C;const dut=D('DUT',k,'plate',tplOf({tpl:k}).cnt?{cnt:Math.min(tplOf({tpl:k}).cnt,8)}:{});
        if(cn.length&&combo!==3){ // 牛角座：兩台用排線對接，一台接按鈕、另一台接燈
          const d2=D('DUT2',k,'plate',{});W(dut,cn[0],d2,cn[cn.length-1]);
          const ac=combo===2;let fu=null;if(ac){fu=D('FU','tend-tfbr-321');W('Q0','2',fu,'1');}const P=ac?[fu,'2']:['PS','+V1'],N=ac?['Q0','4']:['PS','-V1'];
          G.slice(0,3).forEach((g,i)=>{const sb=D('SB'+i,'py2201-g','door'),hl=D('HL'+i,'yw1l-g','door');W(P[0],P[1],sb,'3');W(sb,'4',dut,g[0]);W(d2,g[0],hl,'X1');W(hl,'X2',N[0],N[1]);});}
        else if(combo===2&&G.length>=3&&G.slice(0,3).every(g=>g.length>=2)){ // 主回路經過端子台到馬達
          D('KM','lc1d18');D('M1','motor3','field');['2','4','6'].forEach((t,i)=>{W('Q0',t,'KM','L'+(i+1));const [a,b]=io(G,i);W('KM','T'+(i+1),dut,a);W(dut,b,'M1','UVW'[i]);});
          D('SB','py2201-g','door');W('PS','+V1','SB','3');W('SB','4','KM','A1');W('KM','A2','PS','-V1');}
        else{ // 控制回路經過端子台：＋→端子→按鈕→端子→燈→端子→－
          const ac=combo===2;let fu=null;if(ac){fu=D('FU','tend-tfbr-321');W('Q0','2',fu,'1');}const P=ac?[fu,'2']:['PS','+V1'],N=ac?['Q0','4']:['PS','-V1'];
          const g0=io(G,0),g1=io(G,1),g2=io(G,2);D('SB','py2201-g','door');D('HL','yw1l-g','door');
          W(P[0],P[1],dut,g0[0]);W(dut,g0[1],'SB','3');
          if(G.length>1){W('SB','4',dut,g1[0]);W(dut,g1[1],'HL','X1');}else W('SB','4','HL','X1');
          if(G.length>2){W('HL','X2',dut,g2[0]);W(dut,g2[1],N[0],N[1]);}else W('HL','X2',N[0],N[1]);}
        out.push({tpl:k,k:combo,name:`${k} 組合${combo}`,devs:C.devs,ws:C.ws,dut,tbPage:true});});});
    const covered=new Set(out.map(c=>c.tpl));out.untestable=ks.filter(k=>!covered.has(k));
  }
  return out;}
if(typeof module!=='undefined')module.exports={coverCases};

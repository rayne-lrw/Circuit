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
  return out;}
if(typeof module!=='undefined')module.exports={coverCases};

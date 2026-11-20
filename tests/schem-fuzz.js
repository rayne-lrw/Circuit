// 電路圖隨機電路產生器（schem-check 用）：同一個種子一定產生同一組器具與配線。
// 內容：主回路（燈、風扇、馬達保護器＋接觸器＋三相馬達、正反轉、Y-Δ、插座插器具）、AC 控制回路（保險絲→接點→線圈／指示燈、自保持）、
// 24V 控制回路（按鈕、極限 1C、繼電器接點、並聯、端子台中繼、繼電器＋二極體、指示燈、PLC 輸入輸出、三線／四線感測器）。
function schemFuzzGen(seed){
  let s=seed>>>0;const R=()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
  const pick=a=>a[Math.floor(R()*a.length)],ri=(a,b)=>a+Math.floor(R()*(b-a+1));
  const devs=[],ws=[];let n=0,px=0;const D=(id,tpl,sheet='plate',extra={})=>{devs.push({id,tag:id,tpl,x:(px%15)*55+10,y:Math.floor(px/15)*80+10,sheet,...extra});px++;return id;};
  const W=(a,at,b,bt)=>ws.push({id:'w'+(++n),no:'W'+n,a:{d:a,t:at},b:{d:b,t:bt},wps:[],gauge:.75,color:'black'});
  let tbN=0,tbUse=8;const TB=()=>{if(tbUse>=8){tbN++;D('TB'+tbN,'w2202-1401','plate',{cnt:8});tbUse=0;}tbUse++;return ['TB'+tbN,tbUse];};
  const WW=(a,at,b,bt)=>{if(R()<.25){const [t,k]=TB();W(a,at,t,k+'A');W(t,k+'C',b,bt);}else W(a,at,b,bt);}; // 有時經過端子台
  D('PWR','field-power','field');D('Q0','ic60-3P16A');['R','S','T'].forEach((p,i)=>W('PWR',p,'Q0',String(i*2+1)));
  const L='2',N='4';let fN=0;const brk1=()=>{const f='F'+(++fN);D(f,'ic60-1P2A');W('Q0',L,f,'1');return f;};
  let mN=0,kmN=0,sbN=0,kaN=0,dN=0,hlN=0;
  const motor=(km)=>{const m=D('M'+(++mN),'motor3','field');['T1','T2','T3'].forEach((t,j)=>WW(km,t,m,'UVW'[j]));return m;};
  // 主回路
  const nb=ri(1,4);
  for(let i=0;i<nb;i++){const k=pick(['lamp','fan','motor','motor','rev','sock','yd']);
    if(k==='lamp'){const f=brk1(),l=D('EL'+i,'lamp','field');WW(f,'2',l,'L/+');WW(l,'N/−','Q0',N);}
    else if(k==='fan'){const f=brk1(),l=D('FAN'+i,'fan4');W(f,'2',l,'L');W(l,'N','Q0',N);}
    else if(k==='sock'){const f=brk1(),x=D('XS'+i,'ac30');W(f,'2',x,'L');W(x,'N','Q0',N);if(R()<.6){const h=D('HMI'+i,'nextech','door');W(x,'插頭',h,'DC-IN');}}
    else if(k==='yd'){const g=D('GV'+(++mN),'gv2me16'),km=D('KM'+(++kmN),'sp12'),kd=D('KM'+(++kmN),'sp12'),ky=D('KM'+(++kmN),'sp12'),m=D('M'+mN,'motor3-yd','field');
      ['2','4','6'].forEach((t,j)=>{W('Q0',t,g,String(j*2+1));W(g,String(j*2+2),km,'L'+(j+1));WW(km,'T'+(j+1),m,['U1','V1','W1'][j]);W(km,'T'+(j+1),kd,'L'+(j+1));WW(kd,'T'+(j+1),m,['W2','U2','V2'][j]);});
      ['U2','V2','W2'].forEach((t,j)=>W(m,t,ky,'L'+(j+1)));W(ky,'T1',ky,'T2');W(ky,'T2',ky,'T3');}
    else{const g=D('GV'+(++mN),'gv2me16'),km=D('KM'+(++kmN),R()<.5?'lc1d18':'sp12');['2','4','6'].forEach((t,j)=>{W('Q0',t,g,String(j*2+1));W(g,String(j*2+2),km,'L'+(j+1));});
      const m=motor(km);if(k==='rev'){const kr=D('KM'+(++kmN),'lc1d18');['6','4','2'].forEach((t,j)=>W(g,t,kr,'L'+(j+1)));['T1','T2','T3'].forEach((t,j)=>W(kr,t,m,'UVW'[j]));}}}
  // AC 控制回路（保險絲後面接觸器／繼電器線圈）
  if(R()<.5){const fu=D('FU1','tend-tfbr-321');W('Q0',L,fu,'1');const nl=ri(1,3);
    for(let i=0;i<nl;i++){const sb=D('SB'+(++sbN),'py2201-r','door'),st=D('SB'+(++sbN),'py2201-g','door'),ka=D('KA'+(++kaN),'my2n-220');
      W(fu,'2',sb,'1');W(sb,'2',st,'3');W(st,'4',ka,'14');W(ka,'13','Q0',N);if(R()<.6){W(sb,'2',ka,'9');W(ka,'5',ka,'14');} // 自保持
      if(R()<.5){const hl=D('HL'+(++hlN),'yw1l-g','door');W(fu,'2',ka,'12');W(ka,'8',hl,'X1');W(hl,'X2','Q0',N);}}}
  // 24V 與 PLC
  const fp=brk1();D('PS','drl120');W(fp,'2','PS','L');W('PS','N','Q0',N);
  const plc=R()<.6;if(plc){D('PLC','fx5u32');W(fp,'2','PLC','L');W('PLC','N','Q0',N);W('PLC','S/S','PS','-V1');W('PLC','COM0','PS','-V1');}
  let xN=0,yN=0;const relays=[];
  const contact=()=>{const r=R();
    if(r<.35){const sb=D('SB'+(++sbN),pick(['py2201-g','py2201-r']),'door');return R()<.5?[sb,'3',sb,'4']:[sb,'1',sb,'2'];}
    if(r<.6&&relays.length){const ka=pick(relays);const fr=['9','12'].filter(c=>!ka.used.has(c));if(fr.length){const c=pick(fr);ka.used.add(c);const no=R()<.6;return [ka.id,c,ka.id,c==='9'?(no?'5':'1'):(no?'8':'4')];}}
    if(r<.75){const ls=D('LS'+(++sbN),'d4mc','field');return [ls,'C',ls,R()<.5?'A':'B'];}
    const sb=D('SB'+(++sbN),'py2201-g','door');return [sb,'3',sb,'4'];};
  const load=(cur)=>{const lr=R();
    if(lr<.4){const ka=D('KA'+(++kaN),'my2n-24');relays.push({id:ka,used:new Set()});WW(cur[0],cur[1],ka,'14');W(ka,'13','PS','-V1');if(R()<.4){const dd=D('D'+(++dN),'diode');W(dd,'K',ka,'14');W(dd,'A',ka,'13');}}
    else if(lr<.6){const hl=D('HL'+(++hlN),'yw1l-g','door');WW(cur[0],cur[1],hl,'X1');W(hl,'X2','PS','-V1');}
    else if(plc&&xN<8){WW(cur[0],cur[1],'PLC','X'+(xN++));}
    else{const ka=D('KA'+(++kaN),'my2n-24');relays.push({id:ka,used:new Set()});WW(cur[0],cur[1],ka,'14');W(ka,'13','PS','-V1');}};
  const lines=ri(2,9);
  for(let i=0;i<lines;i++){let cur=['PS','+V1'];
    if(R()<.15){const ls=D('LS'+(++sbN),'d4mc','field');W('PS','+V1',ls,'C');load([ls,'A']);load([ls,'B']);continue;} // 極限 1C 兩邊都接
    const nc=ri(1,3);
    for(let j=0;j<nc;j++){const [a,at,b,bt]=contact();WW(cur[0],cur[1],a,at);
      if(R()<.2){const [a2,at2,b2,bt2]=contact();W(cur[0],cur[1],a2,at2);W(b2,bt2,b,bt);}cur=[b,bt];}
    load(cur);}
  if(plc){const ny=ri(0,3);for(let i=0;i<ny;i++){const ka=D('KA'+(++kaN),'my2n-24');W('PS','+V1',ka,'14');W(ka,'13','PLC','Y'+(yN++));}}
  if(plc&&R()<.6){D('PX','e2e','field');W('PX','棕','PS','+V1');W('PX','藍','PS','-V1');W('PX','黑','PLC','X'+(xN++));}
  if(plc&&R()<.4){D('PH','pzg102','field');W('PH','棕','PS','+V1');W('PH','藍','PS','-V1');W('PH','黑','PLC','X'+(xN++));}
  return {devs,ws};}
if(typeof module!=='undefined')module.exports={schemFuzzGen};

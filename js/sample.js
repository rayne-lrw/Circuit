"use strict";
/* ---------- 範例：三軸伺服電控箱（接線內容只是示範） ---------- */
function sampleState(){
  const D=(id,tpl,x,y,extra={})=>({id,tag:id,tpl,x,y,...extra});
  const devices=[
    D('Q0','fuji-bw50',80,85),D('K0','lc1d38',175,100),D('Q1','ic60-3P40A',250,100),D('Q2','ic60-3P16A',315,100),D('Q3','ic60-3P4A',380,100),D('F1','ic60-1P6A',445,100),D('PS1','drl120',480,90),
    D('SV1','j4700',80,380),D('SV2','j4200',270,380),D('SV3','je40',375,380),D('KA1','my2n-24',440,390),D('KA2','my2n-24',475,390),D('KA3','my2n-24',510,390),D('E1','gnd13',440,570),
    D('PLC1','fx5u32',80,760),D('EX1','fx516ex',240,760),D('SSC1','fx540ssc',290,760),D('X1','w2202-1401',355,760,{count:24}),
    D('ES1','yw1b',1000,120,{sheet:'door'}),D('PB1','yw1l-g',1000,190,{sheet:'door'}),D('PB2','yw1l-r',1000,250,{sheet:'door'}),
    D('PWR1','field-power',-10,1175,{sheet:'field'}),D('M1','hgsr702',110,1175,{sheet:'field'}),D('M2','hgsr202',270,1175,{sheet:'field'}),D('M3','hgkn43',410,1175,{sheet:'field'}),D('SQ1','e2e',550,1175,{sheet:'field'}),D('PH1','pzg102',630,1175,{sheet:'field'}),D('PH2','pzg102',710,1175,{sheet:'field'})
  ];
  const ducts=[{id:'D1',x:20,y:20,w:660,h:45,dp:65},{id:'D2',x:20,y:320,w:660,h:45,dp:65},{id:'D3',x:20,y:695,w:660,h:45,dp:65},{id:'D4',x:20,y:925,w:660,h:45,dp:65},{id:'D5',x:20,y:20,w:45,h:950,dp:65},{id:'D6',x:635,y:20,w:45,h:950,dp:65}];
  const wires=[];let n=1;
  const W=(a,at,b,bt,g,c,ext)=>{const w={id:'w'+n,no:'W'+String(n++).padStart(3,'0'),a:{d:a,t:at},b:{d:b,t:bt},wps:[],gauge:g,color:c};if(ext)w.ext=ext;wires.push(w);};
  const rst=['red','white','blue'];
  ['R','S','T'].forEach((p,i)=>W('PWR1',p,'Q0',['1','3','5'][i],8,rst[i],{cable:'C01',core:p,spec:'CSA細纜 8mm²*4C 號碼/黃綠'}));
  W('PWR1','E','E1','1',8,'ground',{cable:'C01',core:'E',spec:'CSA細纜 8mm²*4C 號碼/黃綠'});
  ['2','4','6'].forEach((o,i)=>W('Q0',o,'K0',['L1','L2','L3'][i],8,rst[i]));
  ['1','2','3'].forEach(q=>['T1','T2','T3'].forEach((o,i)=>W('K0',o,'Q'+q,['1','3','5'][i],q==='1'?8:3.5,rst[i])));
  ['L1','L2','L3'].forEach((t,i)=>W('Q1',['2','4','6'][i],'SV1',t,8,rst[i]));
  ['L1','L2','L3'].forEach((t,i)=>W('Q2',['2','4','6'][i],'SV2',t,3.5,rst[i]));
  W('Q3','2','SV3','L1',1.25,'red');W('Q3','4','SV3','L3',1.25,'white');
  W('Q0','2','F1','1',1.25,'red');W('F1','2','PS1','L',1.25,'red');W('Q0','4','PS1','N',1.25,'white');
  [['SV1','M1','伺服動力線 J4 5.5mm²*4C'],['SV2','M2','伺服動力線 J4 耐繞曲2mm²*4C'],['SV3','M3','伺服動力線 JE 0.75mm²*4C']].forEach(([s,m,sp],i)=>{const cn='C0'+(i+2);['U','V','W'].forEach(t=>W(s,t,m,t,i===0?5.5:i===1?2:.75,'black',{cable:cn,core:t,spec:sp}));W(s,'PE',m,'E',i===0?5.5:i===1?2:.75,'ground',{cable:cn,core:'E',spec:sp});});
  W('PS1','+V1','PLC1','24V',1.25,'brown');W('PS1','-V1','PLC1','0V',1.25,'blue');W('PS1','+V2','X1','1A',1.25,'brown');W('PS1','-V2','X1','2A',1.25,'blue');
  ['1','2','3'].forEach((k,i)=>{W('PLC1','Y'+i,'KA'+k,'13',.75,'green');W('KA'+k,'14','X1','2B',.75,'blue');});
  W('KA1','5','K0','A1',.75,'white');W('K0','A2','X1','2C',.75,'blue');W('X1','1B','KA1','9',.75,'brown');
  W('X1','1C','ES1','1',.75,'brown');W('ES1','2','PB2','1',.75,'white');W('PB2','2','PB1','3',.75,'white');W('PB1','4','PLC1','X0',.75,'gray');W('PB1','X1','PLC1','Y3',.75,'green');W('PB1','X2','X1','2D',.75,'blue');W('PB2','X1','X1','1D',.75,'brown');W('PB2','X2','X1','3A',.75,'blue');
  W('X1','3B','X1','4A',.75,'blue');
  W('X1','5A','SQ1','棕',.75,'brown',{cable:'C05',core:'棕',spec:'CSA細纜 0.75mm²*2C 棕藍'});W('X1','6A','SQ1','藍',.75,'blue',{cable:'C05',core:'藍',spec:'CSA細纜 0.75mm²*2C 棕藍'});
  W('X1','7A','PH1','棕',.5,'brown',{cable:'C06',core:'棕',spec:'CSA細纜 0.5mm²*3C 棕藍黑'});W('X1','8A','PH1','藍',.5,'blue',{cable:'C06',core:'藍',spec:'CSA細纜 0.5mm²*3C 棕藍黑'});W('X1','9A','PH1','黑',.5,'black',{cable:'C06',core:'黑',spec:'CSA細纜 0.5mm²*3C 棕藍黑'});
  W('X1','10A','PH2','棕',.5,'brown',{cable:'C07',core:'棕',spec:'CSA細纜 0.5mm²*3C 棕藍黑'});W('X1','11A','PH2','藍',.5,'blue',{cable:'C07',core:'藍',spec:'CSA細纜 0.5mm²*3C 棕藍黑'});W('X1','12A','PH2','黑',.5,'black',{cable:'C07',core:'黑',spec:'CSA細纜 0.5mm²*3C 棕藍黑'});
  W('X1','9B','PLC1','X1',.75,'gray');W('X1','12B','PLC1','X2',.75,'gray');
  W('Q0','6','E1','2',3.5,'ground');W('PS1','FG','E1','3',1.25,'ground');W('SV1','PE','E1','4',5.5,'ground');
  return {box:{w:800,h:1100,d:300,back:20},plate:{w:700,h:1000},door:{w:800,h:1100},hinge:500,fillLimit:50,glands:[{id:'G1',x:120,spec:'M40 浪管接頭'},{id:'G2',x:300,spec:'M25 浪管接頭'},{id:'G3',x:560,spec:'M20 電纜固定頭'}],tpls:{},devices,ducts,wires,nextNo:n};
}
// 舊專案沒有 fields：依原本寫死的位置建一個（箱底下 90 mm、寬到面板右緣、高 210）。
// state.js 一載入就會呼叫 normalize，這時 GAP_F 等常數還沒宣告，所以這裡直接寫數值。
function defaultField(box,plate,door){const bx=(plate.w-box.w)/2,by=(plate.h-box.h)/2;return {id:'Z1',name:'現場 1',x:bx,y:by+box.h+90,w:box.w+120+door.w,h:210};}
// 讀暫存或匯入時都走這裡：檔案內容視為不可信，欄位不對就略過。
function cleanTpl(t){
  const ss=(v,n)=>String(v==null?'':v).slice(0,n),num=(v,d)=>{const x=Number(v);return Number.isFinite(x)?x:d;};
  if(!t||!Array.isArray(t.terms)) return null;
  const hex=v=>typeof v==='string'&&/^#[0-9a-fA-F]{6}$/.test(v)?v:'#54595b';
  return {inv:[],cat:'自訂器具',b:ss(t.b,20),n:ss(t.n,40)||'自訂器具',w:Math.max(5,num(t.w,40)),h:Math.max(5,num(t.h,40)),d:Math.max(0,num(t.d,50)),pre:ss(t.pre,6).replace(/[^\w]/g,'')||'U',f:hex(t.f),i:casing(hex(t.f))==='#222725'?'#15181a':'#f1f2ee',sheet:['plate','door','field'].includes(t.sheet)?t.sheet:'plate',ok:!!t.ok,note:ss(t.note,60),gen:null,src:typeof t.src==='string'&&/^[\w-]{1,32}$/.test(t.src)?t.src:undefined,
    terms:t.terms.filter(x=>x&&x.id!=null).slice(0,200).map(x=>({id:ss(x.id,12),x:num(x.x,0),y:num(x.y,0),side:['top','bottom','left','right'].includes(x.side)?x.side:'top',desc:ss(x.desc,20)}))};
}
const cleanSpec=v=>{const s=String(v==null?'':v).slice(0,60);return /^E\d{5}$/.test(s)?'':s;};
function normalize(o){
  if(!o||!Array.isArray(o.devices)||!Array.isArray(o.ducts)||!Array.isArray(o.wires)) return null;
  const num=(v,d)=>Number.isFinite(Number(v))&&v!==null&&v!==''?Number(v):d, safe=v=>typeof v==='string'&&/^[\w-]{1,32}$/.test(v), txt=(v,n)=>String(v==null?'':v).slice(0,n);
  const tpls={};if(o.tpls&&typeof o.tpls==='object')Object.keys(o.tpls).forEach(k=>{if(safe(k)){const c=cleanTpl(o.tpls[k]);if(c)tpls[k]=c;}});
  const known=id=>tpls[id]||TPL[id];
  const devices=o.devices.filter(d=>d&&safe(d.id)&&known(d.tpl)).map(d=>{const t=known(d.tpl),r={id:d.id,tag:txt(d.tag,16).trim()||d.id,tpl:d.tpl,x:num(d.x,0),y:num(d.y,0),sheet:['plate','door','field'].includes(d.sheet)?d.sheet:(t.sheet||'plate')};if([90,180,270].includes(d.rot))r.rot=d.rot;if(t.gen)r.count=Math.max(1,Math.min(t.cntLabel&&t.cntLabel.includes('mm')?2000:96,num(d.count,t.cnt)));if(safe(d.on))r.on=d.on;if(t.jumper&&Array.isArray(d.jumpers)){const J=d.jumpers.filter(j=>j&&Number.isInteger(j.at)&&j.at>=1&&[2,3,4,5].includes(j.p)).slice(0,60).map(j=>({at:j.at,p:j.p,row:j.row===2?2:1}));if(J.length)r.jumpers=J;}if(t.gen&&t.cntLabel==='片數'&&Array.isArray(d.labels)&&d.labels.some(Boolean))r.labels=d.labels.slice(0,96).map(v=>txt(v,10));return r;});
  devices.forEach(r=>{if(r.on&&!devices.some(x=>x.id===r.on&&x!==r))delete r.on;});
  const ducts=o.ducts.filter(d=>d&&safe(d.id)).map(d=>({id:d.id,x:num(d.x,0),y:num(d.y,0),w:Math.max(10,num(d.w,40)),h:Math.max(10,num(d.h,40)),dp:Math.max(10,num(d.dp,40)),sheet:d.sheet==='door'?'door':'plate'}));
  const termsOf=dv=>{const b=tpls[dv.tpl]||TPL[dv.tpl];if(b.gen)return b.gen(dv.count).t.map(x=>x[0]);return (b.terms||b.t).map(x=>x.id||x[0]);};
  const has=e=>{const d=e&&devices.find(x=>x.id===e.d);return d&&termsOf(d).includes(e.t);};
  const wires=o.wires.filter(w=>w&&safe(w.id)&&typeof w.no==='string'&&w.no.trim()&&has(w.a)&&has(w.b)).map(w=>{
    const r={id:w.id,no:txt(w.no,16).trim(),a:{d:w.a.d,t:w.a.t},b:{d:w.b.d,t:w.b.t},gauge:num(w.gauge,1.25),color:safe(w.color)?w.color:'black',
      wps:(Array.isArray(w.wps)?w.wps:[]).filter(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)).map(p=>({x:p.x,y:p.y}))};
    if(typeof w.hex==='string'&&/^#[0-9a-fA-F]{6}$/.test(w.hex)){r.hex=w.hex;r.cname=txt(w.cname||'自訂',8);}
    if(w.ext&&typeof w.ext==='object') r.ext={cable:txt(w.ext.cable,12),core:txt(w.ext.core,10),spec:cleanSpec(w.ext.spec)};
    if(safe(w.gland)) r.gland=w.gland;
    if(w.direct===true) r.direct=true;
    if(safe(w.cab)){r.cab=w.cab;r.core=txt(w.core,10).trim()||'1';}
    return r;
  });
  const cables=(Array.isArray(o.cables)?o.cables:[]).filter(c=>c&&safe(c.id)).slice(0,500).map(c=>{
    const pt=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)?{x:p.x,y:p.y}:null,bo={},A=pt(c.bo&&c.bo.a),B=pt(c.bo&&c.bo.b);if(A)bo.a=A;if(B)bo.b=B;
    const r={id:c.id,no:txt(c.no,12).trim()||c.id,spec:cleanSpec(c.spec),bo,fieldLen:Math.max(0,Math.min(1e6,num(c.fieldLen,0))),
      cores:(Array.isArray(c.cores)?c.cores:[]).filter(k=>k&&String(k.n==null?'':k.n).trim()).slice(0,80).map(k=>{const r={n:txt(k.n,10).trim(),c:safe(k.c)?k.c:'black',g:Math.max(.1,num(k.g,.75))};if(typeof k.hex==='string'&&/^#[0-9a-fA-F]{6}$/.test(k.hex)){r.hex=k.hex;r.cn=txt(k.cn||'自訂',8);}return r;})};
    if(safe(c.gland))r.gland=c.gland;
    return r;
  });
  wires.forEach(w=>{if(w.cab&&!cables.some(c=>c.id===w.cab)){delete w.cab;delete w.core;}});
  const plate={w:Math.max(100,num(o.plate&&o.plate.w,600)),h:Math.max(100,num(o.plate&&o.plate.h,800))};
  const bx=o.box||{},box={w:Math.max(100,num(bx.w,plate.w+100)),h:Math.max(100,num(bx.h,plate.h+100)),d:Math.max(50,num(bx.d,300)),back:Math.max(0,num(bx.back,20))};
  const dr=o.door||{},door={w:Math.max(100,num(dr.w,box.w)),h:Math.max(100,num(dr.h,box.h))};
  const glands=(Array.isArray(o.glands)?o.glands:[{id:'G1',x:plate.w/2,spec:'M25 浪管接頭'}]).filter(g=>g&&safe(g.id)).map(g=>({id:g.id,side:['bottom','top','left','right'].includes(g.side)?g.side:'bottom',y:num(g.y,(plate.h)/2),x:num(g.x,100),spec:cleanSpec(g.spec)||'M25 浪管接頭'}));
  const nextNo=Math.max(num(o.nextNo,1),1+Math.max(0,...wires.map(w=>Number(w.no.replace(/\D/g,''))||0)));
  const fields=(Array.isArray(o.fields)?o.fields:[]).filter(z=>z&&safe(z.id)).slice(0,30).map(z=>({id:z.id,name:txt(z.name,20)||z.id,x:num(z.x,0),y:num(z.y,0),w:Math.max(50,num(z.w,600)),h:Math.max(50,num(z.h,210))}));
  if(!fields.length) fields.push(defaultField(box,plate,door));
  const doorMode=['door','console','none'].includes(o.doorMode)?o.doorMode:'door';
  migrateCables({wires,cables});
  return {state:{box,plate,door,doorMode,fields,...(o.warnMixedNo===true?{warnMixedNo:true}:{}),hinge:num(o.hinge,plate.h/2),fillLimit:Math.min(100,Math.max(5,num(o.fillLimit,50))),spare:Math.min(5000,Math.max(0,num(o.spare,0))),glands,tpls,devices,ducts,wires,cables,nextNo},
    dropped:(o.devices.length-devices.length)+(o.ducts.length-ducts.length)+(o.wires.length-wires.length)};
}


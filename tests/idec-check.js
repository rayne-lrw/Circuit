// IDEC YW 檢查：操作部＋可拆裝接點塊（①②③）、標準組合放下自動裝好、緊急停止不能裝雙接點塊；
// 模擬：按鈕瞬時／交替、緊急停止、選擇開關點左半邊／右半邊（有彈簧那邊放開回去）、照光燈；存檔讀回
// 用法：node tests/idec-check.js
const {chromium}=require('playwright'),path=require('path');
(async()=>{
  const b=await chromium.launch(),p=await b.newPage({viewport:{width:1400,height:900}});
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+path.join(__dirname,'..','index.html'));
  const res=await p.evaluate(()=>{
    const out=[],ok=(c,m)=>out.push((c?'✓ ':'✗ ')+m);
    const D=(id,tpl,x,y,sheet='plate')=>({id,tag:id,tpl,x,y,sheet});
    const dv=id=>devOf(id);
    const fresh=ds=>{S=normalize({box:{w:900,h:700,d:300,back:20},plate:{w:860,h:660},door:{w:900,h:700},ducts:[],glands:[],wires:[],devices:[D('PWR','field-power',0,-300,'field'),D('PS','drl120',20,20),D('KA','my2n-24',200,20),D('KB','my2n-24',300,20),...ds]}).state;resetUi();};
    const put=(tpl,x,y)=>{placing={tpl,rot:0,o:{id:'__place',tag:'',tpl,x,y,sheet:'door'},bad:null};placeDrop();return S.devices[S.devices.length-1-((resolveTpl(tpl).cbs||[]).filter(Boolean).length)];};
    const blocks=h=>riders(h).sort((a,b)=>a.rack-b.rack).map(r=>`${rackName(tplOf(h),r.rack)}${r.tpl}`).join(' ');
    let k=0;const W=(a,at,bb,bt)=>S.wires.push({id:'w'+(++k),no:'W'+k,a:{d:a,t:at},b:{d:bb,t:bt},wps:[],gauge:.75,color:'black'});
    const coil=id=>{const r=simRun();return !!(r.dev[id]&&r.dev[id].coil);};
    // ---------- 標準組合：放下自動裝好接點塊 ----------
    fresh([]);const P=put('yw1b-m1e11',100,100);
    ok(P.tpl==='yw1b-m1e11'&&blocks(P)==='①yw-e10 ③yw-e01','YW1B-M1E11 放下：① 裝 1NO、③ 裝 1NC（照型錄接點結構）');
    const N=riders(P).find(r=>r.tpl==='yw-e10'),Cc=riders(P).find(r=>r.tpl==='yw-e01');
    ok(N.x===P.x&&Cc.x===P.x+20,'接點塊照 ①②③ 的位置排（各 10 mm）');
    // 拆裝：把 NC 拖離，再裝到 ②
    hostSnap(Cc,600,600);ok(!Cc.on,'接點塊拖離：拆下');hostSnap(Cc,P.x+12,P.y+5);ok(Cc.on===P.id&&Cc.rack===1,'拖回操作部：裝進最近的空位置 ②');
    // 模擬：瞬時
    k=0;W('PWR','R','PS','L');W('PWR','S','PS','N');W('PS','+V1',N.id,'3');W(N.id,'4','KA','14');W('KA','13','PS','-V1');W('PS','+V1',Cc.id,'1');W(Cc.id,'2','KB','14');W('KB','13','PS','-V1');
    commit();recompute();simReset();ok(!coil('KA')&&coil('KB'),'沒按：常開打開、常閉閉合');
    SIMST.press.add(P.id+'|按下');ok(coil('KA')&&!coil('KB'),'按著：常開閉合、常閉打開');SIMST.press.clear();ok(!coil('KA'),'放開：恢復');
    // ---------- 交替型、緊急停止 ----------
    fresh([]);const A=put('yw1b-a1e10',100,100),AN=riders(A)[0];k=0;W('PWR','R','PS','L');W('PWR','S','PS','N');W('PS','+V1',AN.id,'3');W(AN.id,'4','KA','14');W('KA','13','PS','-V1');commit();recompute();simReset();
    const R0=rectOf('dev',A);simPointerDown({pointerId:1,clientX:0,clientY:0,button:0},{x:R0.x+R0.w/2,y:R0.y+R0.h/2});ok(coil('KA'),'交替型：點一下保持動作');
    simPointerDown({pointerId:1,clientX:0,clientY:0,button:0},{x:R0.x+R0.w/2,y:R0.y+R0.h/2});ok(!coil('KA'),'再點一下復歸');
    fresh([]);const E=put('yw1b-v4e01r',100,100);ok(blocks(E)==='③yw-e01','緊急停止 YW1B-V4E01R：③ 裝 1NC');
    fresh([D('X','yw-ew20',400,400,'door')]);const E2=put('yw1b-v4e01r',100,100);hostSnap(dv('X'),E2.x+5,E2.y+5);ok(!dv('X').on,'緊急停止不能裝雙接點塊（型錄註明）');
    // ---------- 選擇開關 3 位置 從右復歸（31E20：① 在 L、③ 在 R） ----------
    fresh([]);const S3=put('yw1s-31e20',100,100),[b1,b3]=riders(S3).sort((a,b)=>a.rack-b.rack);
    k=0;W('PWR','R','PS','L');W('PWR','S','PS','N');W('PS','+V1',b1.id,'3');W(b1.id,'4','KA','14');W('KA','13','PS','-V1');W('PS','+V1',b3.id,'3');W(b3.id,'4','KB','14');W('KB','13','PS','-V1');commit();recompute();simReset();
    ok(!coil('KA')&&!coil('KB'),'3 位置在 C：① ③ 都沒動作');
    const R3=rectOf('dev',S3),L=()=>simPointerDown({pointerId:1,clientX:0,clientY:0,button:0},{x:R3.x+5,y:R3.y+20}),Rr=()=>simPointerDown({pointerId:1,clientX:0,clientY:0,button:0},{x:R3.x+R3.w-5,y:R3.y+20});
    L();ok(SIMST.sel[S3.id]==='L'&&coil('KA')&&!coil('KB'),'點左半邊：切到 L，① 閉合');L();ok(SIMST.sel[S3.id]==='C','在 L 再點左半邊：回 C');
    Rr();ok(SIMST.sel[S3.id]==='R'&&coil('KB')&&act&&act.t==='simsel','點右半邊（從右復歸）：在 R、③ 閉合，按著');
    SIMST.sel[S3.id]=act.back;act=null;ok(SIMST.sel[S3.id]==='C'&&!coil('KB'),'放開：彈簧回 C');
    // 2 位置 交替（2E11：R 時 ① 常開閉合、③ 常閉打開）
    fresh([]);const S2=put('yw1s-2e11',100,100),[c1,c3]=riders(S2).sort((a,b)=>a.rack-b.rack);
    k=0;W('PWR','R','PS','L');W('PWR','S','PS','N');W('PS','+V1',c1.id,'3');W(c1.id,'4','KA','14');W('KA','13','PS','-V1');W('PS','+V1',c3.id,'1');W(c3.id,'2','KB','14');W('KB','13','PS','-V1');commit();recompute();simReset();
    ok(!coil('KA')&&coil('KB'),'2 位置在 L：常開打開、常閉閉合');SIMST.sel[S2.id]='R';ok(coil('KA')&&!coil('KB'),'切到 R：常開閉合、常閉打開');
    // ---------- 照光：② 是 FA，燈有電就亮 ----------
    fresh([]);const LP=put('yw1l-m2e11',100,100),fa=riders(LP).find(r=>r.tpl==='yw-fa');ok(!!fa&&fa.rack===1,'照光按鈕：② 裝全電壓型轉接器');
    k=0;W('PWR','R','PS','L');W('PWR','S','PS','N');W('PS','+V1',fa.id,'X1');W(fa.id,'X2','PS','-V1');commit();recompute();simReset();const rr=simRun();ok(rr.dev[fa.id]&&rr.dev[fa.id].on.includes('燈'),'燈 X1／X2 有電就亮');
    ok(!hostOk(LP,{tpl:'yw-e10',sheet:'door'})||rackPick(LP,{tpl:'yw-e10'},LP.x+15)!==1,'照光型的 ② 不能裝一般接點塊');
    // 存檔讀回
    commit();const n=normalize(JSON.parse(JSON.stringify(S))).state;ok(n.devices.filter(d=>d.on===LP.id).length===3&&n.devices.find(d=>d.id===fa.id).rack===1,'存檔讀回：接點塊位置保留');
    return out;
  });
  await b.close();
  res.forEach(l=>console.log(l));errs.forEach(e=>console.log('✗ 頁面錯誤：'+e));
  const fail=res.filter(l=>l.startsWith('✗')).length+errs.length;
  console.log(fail?`\n失敗 ${fail} 項`:'\n全部通過');process.exit(fail?1:0);
})();

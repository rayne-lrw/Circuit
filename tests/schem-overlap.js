// 電路圖重疊檢查（給 schem-check 與手動檢查用）：在瀏覽器把每一頁實際排出來，量每段文字的範圍，
// 檢查文字和文字、文字和器具方框／圓（線圈、燈、馬達…）、文字和線（電源線、導線、符號筆畫）有沒有重疊。
// 文字整個在方框或圓裡面（器具框裡的名稱、燈裡的顏色字）不算重疊。
// 在 page.evaluate 裡呼叫：schemOverlaps(容許值 mm) → [{page,a,b}]
function schemOverlaps(tol){
  tol=tol==null?0.15:tol;const out=[];
  document.querySelectorAll('#print .sch-pg svg.s-svg').forEach((svg,pi)=>{
    const R=svg.getBoundingClientRect(),k=420/R.width; // 換成 mm
    const box=el=>{const r=el.getBoundingClientRect();return {x:(r.left-R.left)*k,y:(r.top-R.top)*k,w:r.width*k,h:r.height*k};};
    const skip=el=>el.closest('.s-tbz')||/s-frame|s-grid|s-tb|s-tbl|s-gl/.test(el.getAttribute('class')||'');
    const texts=[...svg.querySelectorAll('text')].filter(t=>!skip(t)&&t.textContent.trim()&&!t.closest('text text')).map(t=>({el:t,b:box(t),s:t.textContent.trim().slice(0,16)}));
    // 字型的上下留白：實際筆畫約佔字框高度的 75%
    texts.forEach(t=>{const pad=t.b.h*.14;t.b={x:t.b.x+tol,y:t.b.y+pad,w:Math.max(0,t.b.w-2*tol),h:Math.max(0,t.b.h-2*pad)};});
    const shapes=[...svg.querySelectorAll('rect,circle')].filter(e=>!skip(e)&&!e.classList.contains('s-dot')).map(e=>({el:e,b:box(e)}));
    const segs=[...svg.querySelectorAll('line')].filter(e=>!skip(e)).map(e=>{const m=e.getCTM(),sm=svg.getCTM().inverse(),p=(x,y)=>{const q=svg.createSVGPoint();q.x=x;q.y=y;return q.matrixTransform(m).matrixTransform(sm);};
      const a=p(+e.getAttribute('x1'),+e.getAttribute('y1')),b=p(+e.getAttribute('x2'),+e.getAttribute('y2'));const vb=svg.viewBox.baseVal,sx=420/vb.width;return {el:e,a:{x:a.x*sx,y:a.y*sx},b:{x:b.x*sx,y:b.y*sx}};});
    const ov=(a,b)=>a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h;
    const inside=(a,b)=>a.x>=b.x-.2&&a.y>=b.y-.2&&a.x+a.w<=b.x+b.w+.2&&a.y+a.h<=b.y+b.h+.2;
    const segHit=(s,r)=>{ // 線段穿過文字框
      let t0=0,t1=1;const dx=s.b.x-s.a.x,dy=s.b.y-s.a.y;const P=[-dx,dx,-dy,dy],Q=[s.a.x-r.x,r.x+r.w-s.a.x,s.a.y-r.y,r.y+r.h-s.a.y];
      for(let i=0;i<4;i++){if(Math.abs(P[i])<1e-9){if(Q[i]<0)return false;}else{const t=Q[i]/P[i];if(P[i]<0){if(t>t1)return false;if(t>t0)t0=t;}else{if(t<t0)return false;if(t<t1)t1=t;}}}return t1-t0>1e-6;};
    for(let i=0;i<texts.length;i++){const A=texts[i];if(A.b.w<=0||A.b.h<=0)continue;
      for(let j=i+1;j<texts.length;j++){const B=texts[j];if(B.b.w>0&&B.b.h>0&&ov(A.b,B.b))out.push({page:pi+1,kind:'文字↔文字',a:A.s,b:B.s});}
      shapes.forEach(S=>{if(ov(A.b,S.b)&&!inside(A.b,S.b))out.push({page:pi+1,kind:'文字↔方框',a:A.s,b:S.el.tagName+(S.el.getAttribute('class')?'.'+S.el.getAttribute('class'):'')});});
      segs.forEach(S=>{if(segHit(S,A.b))out.push({page:pi+1,kind:'文字↔線',a:A.s,b:'line'+(S.el.getAttribute('class')?'.'+S.el.getAttribute('class'):'')});});}
  });
  return out;}
if(typeof module!=='undefined')module.exports={schemOverlaps};

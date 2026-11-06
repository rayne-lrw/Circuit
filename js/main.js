"use strict";
/* 啟動 */
renderPalette();recompute();syncUndo();fit();save();
// 沿用上次離開時的模式（只記在這台電腦的瀏覽器）
try{const m=localStorage.getItem('wiring-sim-mode');if(m==='place'||m==='view')setMode(m);}catch(_){}
new ResizeObserver(()=>{if(!view.manual)fit();}).observe($('stage'));

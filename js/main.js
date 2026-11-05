"use strict";
/* 啟動 */
renderPalette();recompute();syncUndo();fit();save();
new ResizeObserver(()=>{if(!view.manual)fit();}).observe($('stage'));

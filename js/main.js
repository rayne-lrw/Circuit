"use strict";
/* 啟動 */
$('ver2').textContent=$('ver').textContent;setLeft(leftPrefs()[mode]);
renderPalette();recompute();syncUndo();fit();save();
// 打開時一律是檢視模式（只看不改，避免誤動）；要配線、擺放再切換
setMode('view');
new ResizeObserver(()=>{if(!view.manual)fit();}).observe($('stage'));

"use strict";
/* ---------- 原本內建器具的系列分組 ----------
   器具庫在每個分類裡把同廠牌、同系列的器具收成一組（顯示「廠牌 系列」）。
   這裡補上 devices.js 裡原本沒有系列的器具；載入順序在 devices-chain.js 之前（FX5-16EX/ES 歸到「FX5 增設」後也能串接）。
   CORE_TPL：補系列之前沒有系列的內建器具，隨機配置測試（fuzz）固定用這一組。 */
(function(){
self.CORE_TPL=Object.keys(TPL).filter(id=>!TPL[id].ser);
const S={
  // 三菱
  fx5u32:'FX5U',fx516ex:'FX5 增設',fx540ssc:'FX5 增設',fx54ad:'FX5 轉接器','fx5-232bd':'FX5 擴充板',
  j4700:'MR-J4 伺服',j4200:'MR-J4 伺服',je40:'MR-JE 伺服',mrbat6v1:'伺服配件',
  hgsr702:'HG-SR 伺服馬達',hgsr202:'HG-SR 伺服馬達',hgkn43:'HG-KN 伺服馬達',gs2107:'GOT GS 人機',
  // 施耐德
  'ic60-3P40A':'Acti9 iC60N','ic60-3P16A':'Acti9 iC60N','ic60-3P4A':'Acti9 iC60N','ic60-2P4A':'Acti9 iC60N','ic60-1P6A':'Acti9 iC60N','ic60-1P4A':'Acti9 iC60N','ic60-1P2A':'Acti9 iC60N','ic60-1P1A':'Acti9 iC60N',
  gv2me16:'TeSys GV2 馬達保護',gv2me32:'TeSys GV2 馬達保護',lc1d09:'TeSys D 接觸器',lc1d18:'TeSys D 接觸器',lc1d38:'TeSys D 接觸器',lc1d258:'TeSys D 接觸器',ladn40:'TeSys D 接觸器',
  // OMRON
  'my2n-24':'MY 繼電器','my2n-220':'MY 繼電器',pyf14a:'MY 繼電器',ly4n:'LY 繼電器',ly2j:'LY 繼電器',e2e:'E2E 近接開關',d4mc:'D4MC 極限開關',
  // 其他廠牌
  'yw1b':'YW 按鈕開關','yw1l-r':'YW 按鈕開關','yw1l-g':'YW 按鈕開關','yw1s':'YW 按鈕開關',
  'w2202-1401':'2202 TOPJOB S 端子台','w2202-1201':'2202 TOPJOB S 端子台','w2202-1611':'2202 TOPJOB S 端子台',
  'w231-604':'231 MCS 連接器','w231-104':'231 MCS 連接器','w231-606':'231 MCS 連接器','w231-106':'231 MCS 連接器','w231-612':'231 MCS 連接器','w231-112':'231 MCS 連接器',
  'w852-111':'852 工業交換器','w852-1111':'852 工業交換器',
  fn3270:'EMC 濾波器',fn2010:'EMC 濾波器',drl120:'DRL 電源供應器',
  pzg102:'PZ-G 光電開關',pzg101:'PZ-G 光電開關',glr22:'GL-R 安全光柵','glr22-t':'GL-R 安全光柵',ga096:'GA0 量測光柵','ga096-t':'GA0 量測光柵',
  dms6015:'DM-S 一體化馬達',dms8015:'DM-S 一體化馬達',nht60:'NHT 電木端子台',mec10:'MEC 短路銅片',
  'fuji-bw50':'G-TWIN BW',cu11:'CU 接觸器',fotek:'MY 計時器',pnoz:'PNOZ X 安全繼電器',nextech:'AP 圖控',ac30:'AC30 軌道插座',eoab:'EO 軌道插座',
  tb10:'TB-PG 接線盒',tb15:'TB-PG 接線盒',fan4:'散熱風扇',lk3214:'LK 插座',rxlg:'RXLG 再生電阻',g6d:'繼電器模組',
  // 沒有廠牌的通用器具
  h66:'鋁軌',diode:'二極體','diode-coil':'二極體',lamp:'照明',qlnp:'訊號轉換',ths62:'吊掛式按鈕盒','field-power':'外部電源',
  gnd13:'接地銅板',gnd15:'接地銅板','py2201-g':'PY2201A 金屬開關','py2201-r':'PY2201A 金屬開關',
  'laser-ps':'雷射砲台配件','dc5521f-tb':'雷射砲台配件','dc5525m-tb':'雷射砲台配件','laser-dot':'雷射砲台配件'};
Object.entries(S).forEach(([id,ser])=>{if(TPL[id]&&!TPL[id].ser)TPL[id].ser=ser;});
// 柏叡的繼電器模組原本廠牌寫 bore，統一成柏叡
if(TPL.g6d&&TPL.g6d.b==='bore')TPL.g6d.b='柏叡';
})();

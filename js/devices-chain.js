"use strict";
/* ---------- 串接設定：三菱 FX5、FX3U 的主機與擴充模組 ----------
   主機 chain={r:右側族,l:左側族}、chainAddr（oct：8 進位、每台 8 點為單位）；右側擴充模組 chainKind='r'，左側轉接器 chainKind='l'
   主機自己的點數：依主機 X／Y 接點數進位到 8 點（FX5U-32M：X0～X17，擴充從 X20 開始） */
(function(){
const set=(id,o)=>{if(TPL[id])Object.assign(TPL[id],o);};
Object.keys(TPL).forEach(id=>{const t=TPL[id];if(t.legacy||t.gen)return;
  // FX5：CPU（FX5U／FX5S／FX5UJ／FX5UC）右側接增設模組、左側接轉接器
  if(/^fx5(u|s|uj|uc)-\d/.test(id)||id==='fx5u32')set(id,{chain:{r:'fx5',l:'fx5a'},chainAddr:'oct'});
  else if(t.ser==='FX5 增設'||id==='fx540ssc')set(id,{chainKind:'r',chainFam:'fx5',attach:'chain'});
  else if(t.ser==='FX5 轉接器'||/^fx5-.*adp$/.test(id)||id==='fx54ad')set(id,{chainKind:'l',chainFam:'fx5a',attach:'chain'});
  // FX3U：基本單元右側接 FX2N 擴展單元／模塊與特殊功能，左側接特殊轉接器
  else if(/^fx3u-\d+m/.test(id))set(id,{chain:{r:'fx3',l:'fx3a'},chainAddr:'oct'});
  else if(['FX2N 擴展單元','FX2N 擴展模塊','FX 特殊功能'].includes(t.ser))set(id,{chainKind:'r',chainFam:'fx3',attach:'chain'});
  else if(t.ser==='FX3U 特殊轉接器')set(id,{chainKind:'l',chainFam:'fx3a',attach:'chain'});
});
})();

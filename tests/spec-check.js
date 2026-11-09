// 電纜規格檢查：電料清單的每一條電纜都要有固定的芯線定義（不再從文字解析）；不認得的規格不可以自己猜芯線
// 用法：node tests/spec-check.js
const vm=require('vm'),fs=require('fs'),path=require('path');
const ctx={console};vm.createContext(ctx);
for(const f of ['inventory.js','cable.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js',f),'utf8'),ctx);
vm.runInContext('this.R={inv:cableInv(),def:SPEC_DEF,specDef,isBuiltinSpec}',ctx);
const {inv,def,specDef}=ctx.R;let fail=0;const bad=m=>{console.log('✗ '+m);fail++;};
inv.forEach(n=>{const k=specDef(n);if(!k.length)bad(`電料清單的「${n}」沒有芯線定義，請在 js/cable.js 的 SPEC_DEF 加上`);
  if(new Set(k.map(x=>x.n)).size!==k.length)bad(`「${n}」芯線名稱重複`);if(k.some(x=>!(x.g>0)))bad(`「${n}」線徑不對`);});
Object.keys(def).forEach(n=>{if(!inv.includes(n))bad(`SPEC_DEF 的「${n}」不在電料清單裡（名稱打錯或電料已刪除）`);});
// 不認得的規格：不猜，回傳空的
['0.75mm²*4C','耐熱105C 2C','1.25SQ*4C','亂打的'].forEach(n=>{if(specDef(n).length)bad(`不認得的規格「${n}」不應該自己產生芯線`);});
// 自訂規格從專案讀
ctx.S={cableSpecs:[{name:'測試',cores:[{n:'A',c:'red',g:.5},{n:'B',c:'black',g:.5}]}]};
vm.runInContext('this.T=specDef("測試")',ctx);if(ctx.T.map(x=>x.n).join()!=='A,B')bad('自訂規格讀不到');
const sv=specDef('伺服動力線 JE 0.75mm²*4C').map(x=>x.n).join(' ');if(sv!=='U V W E')bad('伺服動力線應為 U V W E，實際 '+sv);
console.log(fail?`\n失敗 ${fail} 項`:`✓ 電料清單 ${inv.length} 條電纜都有芯線定義\n\n全部通過`);process.exit(fail?1:0);

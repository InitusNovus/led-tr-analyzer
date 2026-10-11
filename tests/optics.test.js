import test from 'node:test';
import assert from 'node:assert/strict';
import { LEDS } from '../src/data/catalog.js';
import { opticalAtCurrent,opticalCapability,opticalValueForBasis,opticalUsageGuide,solveOpticalCurrent } from '../src/core/optics.js';
import { DEFAULT_CONFIG,transitionConfig } from '../src/core/topologies.js';
import { selectResistance } from '../src/core/analysis.js';
const close=(a,b,tol=1e-5)=>assert.ok(Math.abs(a-b)<=tol,`expected ${a} ≈ ${b}`);
const kt=['KT-0805R','KT-0805G','KT-0805B','KT-0805YG','KT-0805O'];
for(const id of kt) {
 test(id+' optical anchor preserves original bin edges and no fake typ',()=>{
  const o=LEDS[id].optical,r=opticalAtCurrent(id,o.testCurrent);
  assert.equal(r.kind,'range');close(r.minMcd,o.minMcd);close(r.maxMcd,o.maxMcd);
  assert.equal(r.nominalMcd,null);assert.equal(r.scale,1);assert.equal(opticalCapability(id).canInvert,true);
 });
 test(id+' min optical inverse uses only characterized relative curve',()=>{
  const o=LEDS[id].optical;
  const target=o.minMcd*.65,sol=solveOpticalCurrent(id,target,{basis:'min'});
  assert.ok(sol.current>0 && sol.current<=o.relative.domain[1]);
  close(opticalValueForBasis(opticalAtCurrent(id,sol.current),'min'),target,1e-4);
 });
}
test('G 5mA absolute anchor and 20mA relative normalization differ',()=>{
 const at20=opticalAtCurrent('KT-0805G',.02);
 close(at20.minMcd,437.5,1e-4);close(at20.maxMcd,1075,1e-4);
 assert.equal(at20.nominalMcd,null);
});
test('O relative shape peaks then decreases: inverse chooses earliest increasing solution',()=>{
 const max=opticalAtCurrent('KT-0805O',.035).minMcd;
 assert.ok(max>opticalAtCurrent('KT-0805O',.04).minMcd);
 const sol=solveOpticalCurrent('KT-0805O',max*.96,{basis:'min'});
 assert.ok(sol.current<.035);
});
test('unsupported optical shapes fail typed instead of inventing values',()=>{
 assert.equal(opticalAtCurrent('KT-0805W',.005).kind,'test-point');
 assert.equal(opticalAtCurrent('KT-0805W',.010).kind,'unavailable');
 assert.equal(opticalAtCurrent('KT-0805Y',.01).kind,'unavailable');
 assert.throws(()=>solveOpticalCurrent('KT-0805W',50),{code:'unsupported'});
 assert.throws(()=>solveOpticalCurrent('KT-0805Y',50),{code:'unsupported'});
 assert.throws(()=>solveOpticalCurrent('KT-0805R',1e5),{code:'out-of-domain'});
});
test('range result has qualitative crossed bands, not a perceived brightness number',()=>{
 const g=opticalUsageGuide(8,140);
 assert.ok(g.bands.includes('subdued')&&g.bands.includes('bright-indoor'));
 assert.equal(opticalUsageGuide(null),null);
});
test('sizing uses optical goal and checks again after selecting E-series resistor',()=>{
 const c=transitionConfig({...DEFAULT_CONFIG,led:'KT-0805R'},'resistor');
 const exactOpt=solveOpticalCurrent(c.led,35,{basis:'min'});
 const r=selectResistance(c,exactOpt.current,{targetMcd:35,opticalBasis:'min',strategy:'closest'});
 assert.ok(r.result.ok);
 assert.equal(r.goal.kind,'optical');
 assert.equal(r.goal.met,r.goal.achievedMcd>=35*(1-1e-7));
});
test('no temperature curve is not silently replaced by 25C optical',()=>{
 assert.equal(opticalAtCurrent('KT-0805W',.005,40).kind,'unavailable');
 const r=opticalAtCurrent('KT-0805R',.01,50);
 assert.equal(r.kind,'range');assert.ok(r.assumptions.some(x=>x.includes('separable')));
});

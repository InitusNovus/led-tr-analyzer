import test from 'node:test';
import assert from 'node:assert/strict';
import { CIRCUIT_TEMPLATES } from '../src/ui/circuitTemplates.js';
import { TOPOLOGIES, DEFAULT_CONFIG, transitionConfig, normalizeConfig } from '../src/core/topologies.js';
import { getDeviceModel, modelsForFamily } from '../src/data/catalog.js';

const expected={
 resistor:['RLED','LED1'],'gpio-source':['GPIO1','RLED','LED1'],'gpio-sink':['RLED','LED1','GPIO1'],
 'digital-npn':['GPIO1','Q1','Q1.R1','Q1.R2','RLED','LED1'],
 'npn-low':['GPIO1','RB','Q1','RLED','LED1'],'npn-follower':['GPIO1','RB','Q1','RLED','LED1'],
 'npn-current-sink':['GPIO1','RB','Q1','RE','RLED','LED1'],'nmos-low':['GPIO1','RG','RGS','Q1','RLED','LED1'],
 'pnp-high':['GPIO1','RB','Q1','RLED','LED1'],'pmos-high':['GPIO1','RG','RGS','Q1','RLED','LED1'],
 'npn-pnp':['GPIO1','RB','Q1','Rdrive','RBE','Q2','RLED','LED1'],'npn-pmos':['GPIO1','RB','Q1','Rdrive','RGS','Q2','RLED','LED1'],
 'nmos-pmos':['GPIO1','RG','RGS_IN','Q1','Rdrive','RGS_OUT','Q2','RLED','LED1']
};
for(const t of TOPOLOGIES)test(t.id+' circuit template has independent expected instances',()=>{
 const actual=[...CIRCUIT_TEMPLATES[t.id].instances].sort(),want=[...expected[t.id]].sort();assert.deepEqual(actual,want);
});
test('critical terminal semantics are encoded, not inferred from labels',()=>{
 const has=(id,a,b)=>CIRCUIT_TEMPLATES[id].connections.some(x=>x[0]===a&&x[1]===b);
 assert.ok(has('gpio-sink','LED1.K','GPIO1.PIN'));
 assert.ok(!CIRCUIT_TEMPLATES['gpio-sink'].connections.some(x=>x.includes('GND')));
 assert.ok(has('npn-follower','VLED','Q1.C'));assert.ok(has('npn-follower','Q1.E','RLED.1'));
 assert.ok(has('npn-current-sink','LED1.K','Q1.C'));assert.ok(has('npn-current-sink','Q1.E','RE.1'));
 assert.ok(has('nmos-low','Q1.S','GND'));assert.ok(has('pmos-high','VLED','Q1.S'));
 for(const id of ['npn-pnp','npn-pmos','nmos-pmos']){assert.ok(CIRCUIT_TEMPLATES[id].instances.includes('Q1'));assert.ok(CIRCUIT_TEMPLATES[id].instances.includes('Q2'));}
});
test('all required model slots resolve to compatible exact model IDs',()=>{
 for(const t of TOPOLOGIES){const c=normalizeConfig(transitionConfig(DEFAULT_CONFIG,t.id));for(const s of t.deviceSlots){const p=getDeviceModel(c.deviceModels[s.id]);assert.equal(p.family,s.family,t.id+' '+s.id);}}
});
test('NPN and NMOS families expose real alternatives',()=>{
 assert.ok(modelsForFamily('npn').length>=2);assert.ok(modelsForFamily('nmos').length>=2);
});

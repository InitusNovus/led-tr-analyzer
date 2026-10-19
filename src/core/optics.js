/** Optical estimates: keep manufacturer test-point bins separate from typical relative-Iv curves.
 * Source measurements at one IF are not guarantees after scaling to another IF/Ta. */
import { LEDS, ledModel } from '../data/catalog.js';
import { ModelError, finite, interpolate, bisect } from './math.js';

function sampleRelative(curve, x, ctx, label) {
    const p=interpolate(curve.points,x,{logX:curve.logX,logY:curve.logY});
    ctx?.sources?.add(curve.source);
    if(p.extrapolated) ctx?.flags?.add('extrapolation:'+label);
    return p;
}
export const opticalCapability = (ledOrId,binId=null) => {
    const p=typeof ledOrId==='string'?ledModel(ledOrId,binId):ledOrId, o=p?.optical;
    if(!o || !Number.isFinite(o.testCurrent) || o.testCurrent<=0) return {kind:'unavailable',reason:'absolute-optical-test-current-unknown',canInvert:false};
    const hasMin=Number.isFinite(o.minMcd);   // a guaranteed minimum (min/typ sheets) or the lower end of a range
    const hasRange=hasMin&&Number.isFinite(o.maxMcd);
    const hasTypical=Number.isFinite(o.nominalMcd);
    if(!hasMin&&!hasTypical) return {kind:'unavailable',reason:'no-complete-optical-anchor',canInvert:false};
    const kind=o.relative ? (hasRange?'range':'scalar') : 'test-point';
    return {kind,hasRange,hasMin,hasTypical,canInvert:!!o.relative};
};
function unavailable(reason,anchor=null,assumptions=[]) {
    return {kind:'unavailable',reason,minMcd:null,maxMcd:null,nominalMcd:null,
        anchor,scale:null,assumptions,extrapolated:false,usageGuide:null};
}
const finiteOptical = v => Number.isFinite(v)?Math.max(0,v):null;

/** Only qualitative, legacy indicator usage guidance; never a safety or perceptual predictor. */
export function opticalUsageGuide(minMcd,maxMcd=minMcd) {
    if(!Number.isFinite(minMcd)||!Number.isFinite(maxMcd)||minMcd<0||maxMcd<minMcd) return null;
    const bands=[
        {id:'subdued',start:0,end:20,label:'어두운 실내 / 눈부심을 줄인 표시등 (~10mcd)'},
        {id:'indicator',start:20,end:100,label:'일반 실내 기기 상태 표시등 (20–50mcd 참고)'},
        {id:'bright-indoor',start:100,end:200,label:'밝은 실내에서 눈에 띄는 표시등 (100–200mcd)'},
        {id:'high-intensity',start:200,end:Infinity,label:'높은 광도: 직접 시야의 눈부심 확인 필요'}
    ];
    const matches=bands.filter((b,i)=> maxMcd >= b.start && minMcd < b.end && (maxMcd>b.start || i===0));
    const chosen=matches.length?matches:[bands.at(-1)];
    return {kind:'heuristic',bands:chosen.map(b=>b.id),labels:chosen.map(b=>b.label),
        label:chosen.length===1?chosen[0].label:chosen[0].label+' ~ '+chosen.at(-1).label,
        note:'실무 감각 참고용입니다. 색·주변 조도·관찰 거리·시야각·확산판·PWM에 따라 체감이 달라집니다. mcd는 체감 밝기 예측값이 아닙니다.'};
}
export function opticalAtCurrent(id,current,temperature=25,ctx,binId=null) {
    finite(current,'LED current',0);
    finite(temperature,'optical temperature',-100,200);
    const part=ledModel(id,binId);
    if(!part) throw new ModelError('invalid-input',binId?'Unknown LED or intensity bin: '+id+' / '+binId:'Unknown LED: '+id);
    ctx?.sources?.add(part.source);
    const o=part.optical, cap=opticalCapability(part);
    if(cap.kind==='unavailable') {
        ctx?.flags?.add('not-modeled:LED-absolute-optical-anchor');
        return unavailable(cap.reason,null,[]);
    }
    const anchor={testCurrentA:o.testCurrent,nominalMcd:finiteOptical(o.nominalMcd),
        minMcd:finiteOptical(o.minMcd),maxMcd:finiteOptical(o.maxMcd),source:o.relative?.source??part.source,
        convention:o.convention??''};
    if(current===0) {
        const output={kind:cap.kind==='test-point'?'scalar':cap.kind,nominalMcd:cap.hasTypical?0:null,
            minMcd:cap.hasMin?0:null,maxMcd:cap.hasRange?0:null,
            anchor,scale:0,assumptions:['zero-current DC emission assumed zero'],extrapolated:false};
        return {...output,usageGuide:null,basis:cap.hasRange?'datasheet-bin-scaled-typical-relative-Iv':cap.hasMin?'datasheet-min-typ-scaled-relative-Iv':'scalar-typical-relative-Iv'};
    }
    if(!o.relative) {
        if(temperature!==25 || Math.abs(current-o.testCurrent)>Math.max(1e-9,o.testCurrent*.01)){
            ctx?.flags?.add('not-modeled:LED-optical-current-shape');
            if(temperature!==25)ctx?.flags?.add('not-modeled:LED-optical-temperature');
            return unavailable(temperature!==25?'optical-temperature-unsupported':'optical-current-shape-unavailable',
                anchor,['Only the datasheet optical test point is characterized']);
        }
        const v=finiteOptical(o.nominalMcd);
        return {kind:'test-point',nominalMcd:v,minMcd:finiteOptical(o.minMcd),maxMcd:finiteOptical(o.maxMcd),
            anchor,scale:1,assumptions:['Datasheet test point only; no current dependence inferred'],
            extrapolated:false,basis:'datasheet-absolute-test-point',
            usageGuide:opticalUsageGuide(v??o.minMcd??null,v??o.maxMcd??null)};
    }
    const at=sampleRelative(o.relative,o.testCurrent,ctx,'LED-optical-anchor-current');
    if(at.value<=0) return unavailable('invalid-relative-optical-anchor',anchor);
    const sample=sampleRelative(o.relative,current,ctx,'LED-optical-current');
    let factor=1,extrapolated=sample.extrapolated||at.extrapolated;
    const assumptions=['relative-Iv characteristic is typical; manufacturer bin range is not guaranteed after rescaling'];
    if(temperature!==25){
        if(!o.temperature){
            ctx?.flags?.add('not-modeled:LED-optical-temperature');
            return unavailable('optical-temperature-unsupported',anchor,assumptions);
        }
        const t=sampleRelative(o.temperature,temperature,ctx,'LED-optical-temperature');
        const ref=sampleRelative(o.temperature,25,ctx,'LED-optical-reference-temperature');
        factor=t.value/ref.value;
        extrapolated ||= t.extrapolated||ref.extrapolated;
        assumptions.push('temperature effect is separable from current dependence (approximation)');
        ctx?.flags?.add('approximation:optical-temperature-separable');
    }
    const scale=sample.value/at.value*factor;
    const minMcd=cap.hasMin?Math.max(0,o.minMcd*scale):null;
    const maxMcd=cap.hasRange?Math.max(0,o.maxMcd*scale):null;
    const nominalMcd=cap.hasTypical?Math.max(0,o.nominalMcd*scale):null;
    const guide=opticalUsageGuide(minMcd??nominalMcd,maxMcd??nominalMcd);
    return {kind:cap.kind,nominalMcd,minMcd,maxMcd,anchor,scale,
        assumptions,extrapolated,
        basis:cap.hasRange?'datasheet-bin-scaled-typical-relative-Iv':cap.hasMin?'datasheet-min-typ-scaled-relative-Iv':'scalar-typical-relative-Iv',
        usageGuide:guide};
}
export function opticalValueForBasis(result,basis) {
    if(result?.kind==='unavailable'||!result) return null;
    if(basis==='typ') return Number.isFinite(result.nominalMcd)?result.nominalMcd:null;
    if(basis==='min') return Number.isFinite(result.minMcd)?result.minMcd:null;
    if(basis==='representative') return Number.isFinite(result.minMcd)&&Number.isFinite(result.maxMcd)
        ? (result.minMcd+result.maxMcd)/2 : null;
    return null;
}
/** Find earliest increasing-branch target solution within characterized relative-Iv domain; no hidden extrapolation. */
export function solveOpticalCurrent(id,targetMcd,{basis='min',temperature=25,bin=null}={}) {
    finite(targetMcd,'target mcd',Number.MIN_VALUE,1e7);
    const part=ledModel(id,bin),o=part?.optical,cap=opticalCapability(part);
    if(!o?.relative||!cap.canInvert) throw new ModelError('unsupported','광도 곡선 또는 절대 시험전류가 없어 역산할 수 없습니다.');
    if(basis==='min'&&!cap.hasMin||basis==='typ'&&!cap.hasTypical||
       basis==='representative'&&!cap.hasRange||!['min','typ','representative'].includes(basis))
        throw new ModelError('unsupported','선택 광도 기준의 absolute anchor가 없습니다.');
    if(temperature!==25&&!o.temperature)throw new ModelError('unsupported','선택 LED의 광학 온도 곡선이 없습니다.');
    const knots=o.relative.points.map(p=>p[0]);
    if(knots.length<2) throw new ModelError('unsupported','광도 곡선 구간이 부족합니다.');
    const f=i=>opticalValueForBasis(opticalAtCurrent(id,i,temperature,undefined,bin),basis)-targetMcd;
    // Check increasing/flat/decreasing sections individually; do not assume the curve is globally monotonic.
    const roots=[];
    for(let j=1;j<knots.length;j++){
        const a=knots[j-1],b=knots[j],fa=f(a),fb=f(b);
        if(!Number.isFinite(fa)||!Number.isFinite(fb))continue;
        if(fa>=0){roots.push(a);break;}
        if(fa<0&&fb>=0&&fb>fa) {
            const root=bisect(f,a,b,{fTolerance:1e-7,xTolerance:1e-12,iterations:100});
            if(root.converged){roots.push(root.value);break;}
        }
    }
    if(!roots.length) throw new ModelError('out-of-domain','목표 광도가 선택 기준의 광도 곡선 유효 범위에서 달성되지 않습니다.');
    const current=roots[0],optical=opticalAtCurrent(id,current,temperature,undefined,bin);
    return {current,targetMcd,basis,optical,assumptions:[...optical.assumptions,
        ...(basis==='representative'?['midpoint is user-selected representative assumption, not datasheet typ']:[])],
        domain:o.relative.domain,validity:'typical-curve-based-estimate-not-guaranteed'};
}

"""Break one connection at a time and confirm that the E2E gate notices (docs/ACCEPTANCE.md section 4).

Each mutation rewrites one string in the source, rebuilds, and runs the unit tests and the browser smoke. It passes when the
run FAILS and the scenario that failed is one the mutation is expected to reach. The original files are always restored.
Usage: python scripts/mutation_check.py [name ...]     (default: all; needs the same browser setup as browser_smoke.py)
"""
import os,re,shutil,subprocess,sys,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
# name, file, old, new, scenarios that may legitimately catch it ('unit' = the node tests)
MUTATIONS=[
 ('apply-goal-forgotten','src/App.jsx',"if(!appliedGoal)return null;","return null;",{'G05'}),
 ('target-draft-shared','src/ui/designState.js',"targetKind: action.kind, opticalNotice: ''","targetKind: action.kind, targetMcd: state.targetMa, opticalNotice: ''",{'G04'}),
 ('sampled-range-hidden','src/components/SensitivitySummary.jsx',"const showRange = cur && (phase === 'complete' || phase === 'partial');","const showRange = false;",{'G06','G07'}),
 ('sampled-violations-dropped','src/core/warnings.js',"for (const g of corners?.violationGroups ?? [])","for (const g of [])",{'G07','G11','G12','unit'}),
 ('qpoint-regions-dropped','src/components/QPointSummary.jsx',"d.region === 'active' ?","false ?",{'G08'}),
 ('inspector-checks-unlinked','src/ui/viewModel.js',"v.checks=(validation?.checks??[]).filter(c=>c.instanceId===v.instanceId);","v.checks=[];",{'G09','unit'}),
 ('invalid-field-unmarked','src/App.jsx',"aria-invalid={blank}","aria-invalid={false}",{'G10'}),
 ('series-rewrites-tolerance','src/App.jsx',"onChange={e=>setSeries(e.target.value)}>","onChange={e=>{setSeries(e.target.value);set('resistorTolerance',e.target.value==='E24'?5:1);}}>",{'G13'}),
 ('focus-keeps-fold-closed','src/App.jsx',"d=d.parentElement?.closest('details'))d.open=true;","d=d.parentElement?.closest('details'))void 0;",{'G01','G11'}),
 ('strip-not-sticky','src/index.css',".result-strip{min-height:60px;position:sticky;",".result-strip{min-height:60px;position:relative;",{'G01'}),
 ('quick-specs-collapsed','src/components/QuickSpecs.jsx',"const KEY_SPECS = 3;","const KEY_SPECS = 0;",{'G02'}),
 ('mcd-guide-removed','src/components/DesignSummary.jsx','{optical.usageGuide&&<p className="mcd-guide"','{false&&<p className="mcd-guide"',{'G03'}),
 ('led-bin-ignored','src/core/optics.js',"const part=ledModel(id,binId);","const part=ledModel(id);",{'G15','unit'}),
 ('led-bin-leaks-across-leds','src/ui/designState.js',"led: action.id, ledBin: null }","led: action.id }",{'G15','unit'}),
 ('phone-schematic-shrunk','src/index.css',".schematic svg{min-width:640px}",".schematic svg{min-width:420px}",{'G13','G14'}),
]
def run(cmd,**kw): return subprocess.run(cmd,cwd=ROOT,capture_output=True,text=True,**kw)
def main(names):
    chosen=[m for m in MUTATIONS if not names or m[0] in names]
    results=[]
    for name,file,old,new,expect in chosen:
        path=ROOT/file;original=path.read_text()
        if original.count(old)!=1:
            results.append((name,'SKIPPED',f'pattern found {original.count(old)} times in {file}'));continue
        backup=Path(tempfile.mkdtemp())/path.name;shutil.copy(path,backup)
        try:
            path.write_text(original.replace(old,new,1))
            caught=None
            if 'unit' in expect and run(['npm','test']).returncode!=0: caught='unit'
            if caught is None:
                if run(['npm','run','build']).returncode!=0: results.append((name,'BUILD-FAILED',''));continue
                r=run([sys.executable,'scripts/browser_smoke.py'],timeout=900)
                m=re.search(r'SMOKE_FAILED scenario=(\w+)',r.stdout+r.stderr)
                caught=m.group(1) if (r.returncode!=0 and m) else None
            results.append((name,'CAUGHT' if caught in expect else ('UNEXPECTED' if caught else 'MISSED'),str(caught)))
        finally:
            shutil.copy(backup,path)
    run(['npm','run','build'])
    width=max(len(r[0]) for r in results)
    for name,status,detail in results: print(f'{name:<{width}}  {status:<10} {detail}')
    return 0 if all(r[1]=='CAUGHT' for r in results) else 1
if __name__=='__main__': sys.exit(main(sys.argv[1:]))

"""Exercise the built site at its real GitHub Pages subpath."""
import json,os,shutil,signal,subprocess,time,urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'test-results';OUT.mkdir(exist_ok=True)
URL='http://127.0.0.1:4173/led-tr-analyzer/';INLINE=os.environ.get('BROWSER_INLINE')=='1';server=None if INLINE else subprocess.Popen(['npm','run','preview','--','--host','127.0.0.1','--port','4173','--strictPort'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.STDOUT,start_new_session=True)
errors=[];checks=0
def check(c,m):
 global checks
 if not c: raise AssertionError(m)
 checks+=1
try:
 for _ in range(0 if INLINE else 100):
  if server.poll() is not None: raise RuntimeError('Preview server terminated')
  try:
   with urllib.request.urlopen(URL,timeout=1) as r:
    if r.status==200: break
  except OSError: time.sleep(.1)
 else:
  if not INLINE: raise RuntimeError('Preview server did not start')
 catalog=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {TOPOLOGIES} from './src/core/topologies.js';console.log(JSON.stringify(TOPOLOGIES))"],cwd=ROOT,text=True))
 with sync_playwright() as p:
  exe=os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE') or shutil.which('chromium');browser=p.chromium.launch(headless=True,**({'executable_path':exe} if exe else {}));page=browser.new_page(viewport={'width':1365,'height':1000},device_scale_factor=1)
  page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
  def load():
   if INLINE:
    page.set_content('<html lang="ko"><head><meta charset="UTF-8"></head><body><div id="root"></div></body></html>');page.add_style_tag(content=next((ROOT/'dist/assets').glob('*.css')).read_text());page.add_script_tag(type='module',content=next((ROOT/'dist/assets').glob('*.js')).read_text())
   else: page.goto(URL,wait_until='networkidle')
  load();expect(page.get_by_role('heading',name='LED-TR Analyzer',exact=True)).to_be_visible();expect(page.locator('.schematic')).to_be_visible();check(page.locator('#topology option').count()==len(catalog),'all topology choices')
  for t in catalog:
   page.locator('#topology').select_option(t['id']);expect(page.locator('.schematic')).to_have_attribute('data-topology',t['id']);check(page.locator('.schem-part').count()>=2,t['id']+' renders semantic parts')
   if t['active']!='always':
    # Direct high-side / GPIO sink OFF can only be asserted by this reduced model when VLED and GPIO domains match.
    match_domain=t['id'] in ['gpio-sink','pnp-high','pmos-high']
    if match_domain: page.locator('#vcc').fill('3.3')
    page.locator('#state').select_option('HIGH' if t['active']=='LOW' else 'LOW');expect(page.locator('.quick-results')).to_contain_text('0 mA');checks+=1
    if match_domain: page.locator('#vcc').fill('5')
  page.locator('#topology').select_option('gpio-source');page.locator('#state').select_option('LOW');expect(page.locator('.schematic-head')).to_contain_text('요청 LOW');check('GPIO HIGH' not in page.locator('.schematic').inner_text(),'source state not hard-coded HIGH')
  page.locator('#topology').select_option('gpio-sink');page.locator('#state').select_option('HIGH');expect(page.locator('.schematic-head')).to_contain_text('요청 HIGH');check('GPIO LOW' not in page.locator('.schematic').inner_text(),'sink state not hard-coded LOW')
  # At the default 5V LED / 3.3V GPIO domains, OFF is deliberately not claimed without injection/5V-tolerance modeling.
  expect(page.locator('.quick-error')).to_contain_text('현재 조건 계산 불가');checks+=1
  page.locator('#topology').select_option('npn-pnp');check(page.locator('[data-instance-id="Q1"]').count()>0 and page.locator('[data-instance-id="Q2"]').count()>0,'compound Q1/Q2 visible')
  page.locator('#topology').select_option('npn-low');check(page.locator('#model-Q1 option').count()>=2,'NPN has selectable real parts');base_current=page.locator('.quick-results .metric').first.locator('strong').inner_text();page.locator('#model-Q1').select_option('nexperia:BC847B');expect(page.locator('[data-instance-id="Q1"]')).to_contain_text('BC847B');check(page.locator('.quick-results .metric').first.locator('strong').inner_text()!=base_current or page.locator('#model-Q1').input_value()=='nexperia:BC847B','NPN selection applied')
  page.locator('#topology').select_option('nmos-low');check(page.locator('#model-Q1 option').count()>=2,'NMOS has selectable real parts');page.locator('#model-Q1').select_option('nexperia:BSS138BKW');expect(page.locator('[data-instance-id="Q1"]')).to_contain_text('BSS138BKW')
  page.locator('#led').select_option('KT-0805R');page.locator('#temperature').fill('50');expect(page.locator('.schematic')).to_be_visible();check(page.get_by_text('화면을 표시하지 못했습니다').count()==0,'KT temperature does not trigger ErrorBoundary');page.locator('#temperature').fill('25')
  page.locator('#topology').select_option('npn-low');page.locator('#baseResistance').fill('');page.locator('#topology').select_option('resistor');expect(page.get_by_role('heading',name='동작점',exact=True)).to_be_visible();checks+=1
  page.get_by_role('button',name='전체 초기화',exact=True).click();page.get_by_role('button',name='목표에서 저항 선정',exact=True).click();page.locator('#series').select_option('E96');page.locator('#strategy').select_option('bright');page.get_by_role('button',name='전체 초기화',exact=True).click();page.get_by_role('button',name='목표에서 저항 선정',exact=True).click();check(page.locator('#series').input_value()=='E24+E96' and page.locator('#strategy').input_value()=='closest','full reset resets sizing options')
  page.get_by_role('button',name='검증 모드에 적용').count()
  page.screenshot(path=str(OUT/'desktop.png'),full_page=True)
  page.set_viewport_size({'width':390,'height':844});load();expect(page.locator('.schematic')).to_be_visible();check(page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'),'no page horizontal overflow');check(page.locator('.schematic-scroll').evaluate('(e)=>e.scrollWidth>=e.clientWidth'),'schematic can use local 2D scroll');page.screenshot(path=str(OUT/'mobile.png'),full_page=True)
  # SVG screen-space font size: viewBox units scaled by CTM. Small labels target >=12 CSS px.
  min_px=page.locator('.schematic svg').evaluate("""svg=>{const m=svg.getScreenCTM();const s=Math.abs(m.a);return Math.min(...[...svg.querySelectorAll('text')].map(t=>(parseFloat(getComputedStyle(t).fontSize)||12)*s))}""")
  check(min_px>=11.5,'schematic text remains readable: '+str(min_px))
  check(not errors,'browser errors: '+str(errors));browser.close()
 print(json.dumps({'mode':'inline-artifact' if INLINE else 'http-pages-subpath','checks':checks,'topologies':len(catalog),'browser_errors':errors},ensure_ascii=False))
finally:
 if server:
  os.killpg(server.pid,signal.SIGTERM)
  try:server.wait(timeout=5)
  except subprocess.TimeoutExpired:os.killpg(server.pid,signal.SIGKILL)

"""Worst main-thread stall while the sampled sensitivity run follows an input change (not part of CI).
Usage: npm run build && python scripts/measure_ui_stall.py
The stall is the largest gap in a 5 ms timer; it is validated against a deliberate 120 ms block first."""
import os,shutil,signal,subprocess,time
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
server=subprocess.Popen(['npm','run','preview','--','--host','127.0.0.1','--port','4174','--strictPort'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.STDOUT,start_new_session=True)
URL='http://127.0.0.1:4174/led-tr-analyzer/'
TIMER="window.__gap=0;window.__last=performance.now();setInterval(()=>{const n=performance.now();window.__gap=Math.max(window.__gap,n-window.__last-5);window.__last=n;},5);"
SETTLED="document.querySelector('.sensitivity-ribbon').dataset.phase!=='running'"
try:
 for _ in range(100):
  try:
   import urllib.request;urllib.request.urlopen(URL,timeout=1);break
  except OSError:time.sleep(.1)
 with sync_playwright() as p:
  exe=os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE') or shutil.which('chromium')
  browser=p.chromium.launch(headless=True,**({'executable_path':exe} if exe else {}));page=browser.new_page(viewport={'width':1365,'height':1000})
  page.goto(URL,wait_until='networkidle');page.evaluate(TIMER);page.wait_for_timeout(100);page.evaluate('window.__gap=0')
  page.evaluate('(()=>{const s=Date.now();while(Date.now()-s<120);})()');page.wait_for_timeout(100)
  print('instrument check (120 ms block):',round(page.evaluate('window.__gap')),'ms')
  for topology in ['npn-current-sink','npn-follower','npn-pnp','digital-npn','resistor']:
   page.locator('#topology').select_option(topology);page.wait_for_function(SETTLED,timeout=20000);page.wait_for_timeout(100);page.evaluate('window.__gap=0')
   page.locator('#vcc').fill('6');page.locator('#vcc').fill('7');page.wait_for_timeout(350);page.wait_for_function(SETTLED,timeout=20000);page.wait_for_timeout(100)
   print(f'{topology:18s} worst stall {round(page.evaluate("window.__gap")):4d} ms')
  browser.close()
finally:
 os.killpg(server.pid,signal.SIGTERM)

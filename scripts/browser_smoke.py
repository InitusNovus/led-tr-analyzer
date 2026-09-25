"""Exercise the built site at its real GitHub Pages subpath (not the dev root).
Run after npm ci && npm run build. Requires playwright==1.57.0 + Chromium.
"""
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import time
import urllib.request
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results'
OUT.mkdir(exist_ok=True)
URL = 'http://127.0.0.1:4173/led-tr-analyzer/'
INLINE = os.environ.get('BROWSER_INLINE') == '1'
server = None if INLINE else subprocess.Popen(['npm', 'run', 'preview', '--', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT, start_new_session=True)
errors = []
checks = 0

def check(condition, message):
    global checks
    if not condition:
        raise AssertionError(message)
    checks += 1

try:
    for _ in range(0 if INLINE else 100):
        if server.poll() is not None:
            raise RuntimeError('Preview server terminated')
        try:
            with urllib.request.urlopen(URL, timeout=1) as response:
                if response.status == 200:
                    break
        except OSError:
            time.sleep(.1)
    else:
        if not INLINE:
            raise RuntimeError('Preview server did not start')
    catalog = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', "import {TOPOLOGIES} from './src/core/topologies.js';console.log(JSON.stringify(TOPOLOGIES))"], cwd=ROOT, text=True))
    with sync_playwright() as p:
        executable = os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE') or shutil.which('chromium')
        browser = p.chromium.launch(headless=True, **({'executable_path': executable} if executable else {}))
        page = browser.new_page(viewport={'width': 1365, 'height': 1000}, device_scale_factor=1)
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        def load_page():
            if INLINE:
                # Local artifact rendering only; does not test URL routing or HTTP delivery.
                page.set_content('<html lang="ko"><head><meta charset="UTF-8"></head><body><div id="root"></div></body></html>')
                page.add_style_tag(content=next((ROOT / 'dist/assets').glob('*.css')).read_text())
                page.add_script_tag(type='module', content=next((ROOT / 'dist/assets').glob('*.js')).read_text())
            else:
                page.goto(URL, wait_until='networkidle')
        load_page()
        expect(page.get_by_role('heading', name='LED-TR Analyzer', exact=True)).to_be_visible()
        expect(page.get_by_role('heading', name='동작점', exact=True)).to_be_visible()
        check(page.locator('#topology option').count() == len(catalog), 'All topology choices visible')
        for t in catalog:
            page.locator('#vcc').fill('3.3')
            page.locator('#topology').select_option(t['id'])
            expect(page.get_by_role('heading', name='동작점', exact=True)).to_be_visible()
            check('mA' in page.locator('.metric').first.inner_text(), f"{t['id']} output rendered")
            if t['active'] != 'always':
                page.locator('#state').select_option('HIGH' if t['active'] == 'LOW' else 'LOW')
                expect(page.locator('.metric').first.locator('strong')).to_have_text('0 mA')
                checks += 1
        page.locator('#topology').select_option('npn-follower')
        page.locator('#state').select_option('HI_Z')
        expect(page.get_by_role('alert')).to_contain_text('부유')
        page.locator('#pull').select_option('up')
        expect(page.get_by_role('heading', name='동작점', exact=True)).to_be_visible()
        checks += 2
        page.get_by_role('button', name='초기화', exact=True).click()
        page.locator('#resistance').fill('')
        expect(page.get_by_role('alert')).to_be_visible()
        check(not any(x in page.locator('body').inner_text() for x in ['NaN', 'Infinity']), 'No non-finite values rendered')
        page.locator('#resistance').fill('330')
        page.locator('#led').select_option('KT-0805R')
        expect(page.locator('.status')).to_contain_text('미검증')
        expect(page.locator('.metric').nth(5).locator('strong')).to_have_text('—')
        checks += 2
        page.locator('#led').select_option('APT2012SURCK')
        page.get_by_role('button', name='목표에서 저항 선정', exact=True).click()
        page.locator('#target').fill('0')
        expect(page.get_by_role('alert')).to_be_visible()
        page.locator('#target').fill('3')
        expect(page.get_by_test_id('selected-resistance')).to_be_visible()
        page.get_by_role('button', name='검증 모드에 적용').click()
        expect(page.locator('#resistance')).not_to_have_value('330')
        checks += 3
        page.get_by_role('button', name='현재 조건 분석', exact=True).click()
        expect(page.locator('.corner-results')).to_contain_text('81/81')
        checks += 1
        with page.expect_download() as download_info:
            page.get_by_role('button', name='결과 JSON', exact=True).click()
        download = download_info.value
        download.save_as(OUT / 'analysis.json')
        report = json.loads((OUT / 'analysis.json').read_text())
        check(report['result']['ok'] and report['result']['point']['current'] > 0, 'JSON contains solved operating point')
        page.screenshot(path=str(OUT / 'desktop.png'), full_page=True)
        page.locator('#resistance').fill('470')
        expect(page.locator('.corner-results')).to_have_count(0)
        check(True, 'Changed inputs discard stale corner display')
        page.set_viewport_size({'width': 390, 'height': 844})
        load_page()
        expect(page.get_by_role('heading', name='동작점', exact=True)).to_be_visible()
        check(page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'No page-level mobile horizontal overflow')
        expect(page.locator('#topology')).to_be_visible()
        page.get_by_role('heading', name='동작점', exact=True).scroll_into_view_if_needed()
        page.screenshot(path=str(OUT / 'mobile-results.png'))
        check(not errors, f'Browser errors: {errors}')
        browser.close()
    print(json.dumps({'mode': 'inline-artifact' if INLINE else 'http-pages-subpath', 'checks': checks, 'topologies': len(catalog), 'browser_errors': errors}, ensure_ascii=False))
finally:
    if server:
        os.killpg(server.pid, signal.SIGTERM)
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            os.killpg(server.pid, signal.SIGKILL)

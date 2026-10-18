"""Reproduce the KT-0805Y curve readings in src/data/catalog.js from the LCSC sheet (C2296, A.0 / 2018-12-06, p.5).

    python scripts/digitize_kento_y.py <path-to-C2296.pdf>

The PDF's real URL is in the "previewPdfUrl" field of https://www.lcsc.com/datasheet/C2296.pdf. Needs poppler (pdftoppm), numpy
and Pillow. Each chart is rendered at 300 dpi, cropped, its gridlines are located from the pixels and mapped to the printed tick
values, and the dark curve is sampled at the requested x (or y) positions. Pixel boxes are for this exact sheet.
"""
import subprocess, sys, tempfile
from pathlib import Path
import numpy as np
from PIL import Image

PAGE, DPI = 5, 300
S = DPI / 70   # the crop boxes below were chosen on a 70 dpi render
CHARTS = {   # name: crop box at 70 dpi
    'vf': (40, 125, 275, 295), 'irel': (280, 320, 550, 495), 'temp': (45, 320, 280, 495), 'der': (45, 540, 290, 720),
}

def render(pdf, out):
    subprocess.run(['pdftoppm', '-r', str(DPI), '-f', str(PAGE), '-l', str(PAGE), '-png', str(pdf), str(out / 'p')], check=True)
    return Image.open(next(out.glob('p-*.png'))).convert('L')

def lin(p0, v0, p1, v1): return lambda p: v0 + (p - p0) * (v1 - v0) / (p1 - p0)

def runs(arr, frac):   # centres of grid lines: rows/columns where a large share of pixels is gray
    idx = np.where(arr >= frac)[0]; groups, cur = [], []
    for i in idx:
        if cur and i - cur[-1] > 2: groups.append(cur); cur = []
        cur.append(i)
    if cur: groups.append(cur)
    return [float(np.mean(g)) for g in groups]

def main(pdf):
    with tempfile.TemporaryDirectory() as tmp:
        page = render(pdf, Path(tmp))
        crops = {n: np.asarray(page.crop(tuple(int(v * S) for v in b))).astype(int) for n, b in CHARTS.items()}
    def grid(g): return runs((g < 225).sum(axis=0) / g.shape[0], .35), runs((g < 225).sum(axis=1) / g.shape[1], .30)
    def col(m, px): ys = np.where(m[:, int(round(px))])[0]; return float(np.median(ys)) if len(ys) else None
    def row(m, py): xs = np.where(m[int(round(py)), :])[0]; return float(np.median(xs)) if len(xs) else None
    def dark(g, x0, x1, y0, y1):
        m = np.zeros_like(g, dtype=bool); m[y0:y1 + 1, x0:x1 + 1] = g[y0:y1 + 1, x0:x1 + 1] < 120; return m
    out = {}
    g = crops['irel']; vx, hy = grid(g); m = dark(g, int(vx[0]) + 5, int(vx[-1]) - 3, int(hy[1]) + 4, int(hy[-1]) - 4)
    fy = lin(hy[-1], 0, hy[-3], 1.0)   # hlines: [title, 1.5, 1.0, 0.5, 0]
    out['relative intensity vs mA'] = [(i, round(fy(col(m, vx[0] + i * (vx[-1] - vx[0]) / 45 + (4 if i == 0 else 0))), 3)) for i in (2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30, 32.5, 35, 37.5, 40)]
    g = crops['temp']; vx, hy = grid(g); m = dark(g, int(vx[0]) + 3, int(vx[-1]) - 3, int(hy[1]) + 4, int(hy[-1]) - 4)
    fy = lin(hy[-1], 0, hy[-6], 1.0)   # hlines: [title, 1.2, 1.0, .8, .6, .4, .2, 0]
    out['relative intensity vs degC'] = [(t, round(fy(col(m, vx[0] + (t + 40) * (vx[-1] - vx[0]) / 140 + (4 if t == -40 else -4 if t == 85 else 0))), 3)) for t in (-40, -20, 0, 20, 25, 40, 60, 80, 85)]
    g = crops['der']; vx, hy = grid(g); m = dark(g, int(vx[0]) + 3, int(vx[-1]) - 3, int(hy[1]) + 4, int(hy[-1]) - 4)
    fy = lin(hy[-1], 0, hy[2], 25)     # hlines: [title, 30, 25, 20, 15, 10, 5, 0]
    out['max mA vs degC'] = [(t, round(fy(col(m, vx[0] + t * (vx[-1] - vx[0]) / 100 + (4 if t == 0 else 0))), 2)) for t in (0, 25, 30, 40, 50, 60, 70, 80, 84)]
    g = crops['vf']; vx, hy = grid(g); m = dark(g, int(vx[0]) + 5, int(vx[-2]) - 3, int(hy[1]) + 4, int(hy[-1]) - 4)
    fx = lin(vx[0], 1.2, vx[1], 1.7)   # vlines: 1.2, 1.7, 2.2 ... ; hlines: [title, 40, 35 ... 0]
    out['Vf vs mA'] = [(i, round(fx(row(m, hy[-1] + i * (hy[1] - hy[-1]) / 40)), 3)) for i in (1, 2, 3, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30, 35)]
    for name, pts in out.items(): print(name, pts)

if __name__ == '__main__': main(sys.argv[1])

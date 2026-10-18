"""Digitize the typical-characteristics charts of an Everlight SMD LED datasheet (page "Typical Electro-Optical Characteristics Curves").

    python scripts/digitize_everlight.py <sheet.pdf> [--out DIR] [--rated mA] [--vf-axis lo,cell]
                                         [--page N] [--dark 175] [--der-ymax 25] [--iv-thin]

--rated is the sheet's DC current rating (the solid part of the curves); --vf-axis gives the voltage at the left frame line and the volts per
grid cell when the axis labels are raster (Everlight grids are 10 cells of 0.2 V; the printed last label is not always on the last line);
--dark raises the line threshold for faint charts, --der-ymax is the top of the derating current axis (50, or 25 mA on small-current parts),
--iv-thin ignores a stray thick stroke over the Iv-If chart.

Needs poppler (pdftoppm, pdftotext), numpy and Pillow. The page is rendered at 300 dpi, the four gridded charts that the Everlight
template always uses are located from their long horizontal frame lines, and each curve is read against the chart's own gridlines:

    Forward current vs forward voltage  (linear, 0..50 mA; 10 cells of 0.2 V)
    Luminous intensity vs forward current (log-log, 1..100 mA, 1..1000 %)
    Luminous intensity vs ambient temperature (log y 1..1000 %, x -60..100 degC)
    Forward current derating curve (linear, 0..100 degC, 0..50 mA)

It prints JSON and writes <out>/<sheet>_overlay.png with the detected points drawn on the charts so the reading can be checked by eye.
Chart images in some sheets are embedded at ~95 dpi and the temperature chart is a log axis, so readings carry roughly +-3 % (intensity)
and +-0.02 V (voltage); they are typical curves, not production limits.
"""
import argparse, json, math, re, subprocess, sys, tempfile
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

DPI = 300
PX = DPI / 72


def run(*a):
    return subprocess.run(list(a), capture_output=True, text=True).stdout


def find_page(pdf):
    n = int(re.search(r'Pages:\s+(\d+)', run('pdfinfo', str(pdf))).group(1))
    for p in range(1, n + 1):
        t = run('pdftotext', '-f', str(p), '-l', str(p), str(pdf), '-')
        if re.search(r'ypical\s+Electro|Characteristics\s+Curves|Ourves|Forward Current Derating|Spectrum Dist', t, re.I):
            return p
    raise SystemExit('curve page not found')


def hruns(mask, minlen):
    out = []
    for y in range(mask.shape[0]):
        row = mask[y]
        if row.sum() < minlen: continue
        d = np.diff(np.concatenate([[0], row.astype(np.int8), [0]]))
        for a, b in zip(np.where(d == 1)[0], np.where(d == -1)[0]):
            if b - a >= minlen: out.append((y, a, b))
    return out


def charts(g, dark=140, minlen=300):
    """Frames [(x0, x1, y0, y1)] of the gridded charts: left column (temperature, derating), right column (Vf, Iv-If)."""
    m = g < dark
    segs = [s for s in hruns(m, minlen) if s[1] > 150 and s[2] < 2330]
    cl = []
    for y, a, b in segs:
        for c in cl:
            if abs(c['a'] - a) <= 12 and abs(c['b'] - b) <= 12:
                c['ys'].append(y); c['a'] = min(c['a'], a); c['b'] = max(c['b'], b); break
        else: cl.append({'a': a, 'b': b, 'ys': [y]})
    out = []
    for c in cl:
        ys = sorted(set(c['ys'])); grp = [[ys[0]]]
        for y in ys[1:]:
            (grp[-1].append(y) if y - grp[-1][-1] <= 120 else grp.append([y]))
        for gp in grp:
            if gp[-1] - gp[0] >= 150: out.append((int(c['a']), int(c['b']), int(gp[0]), int(gp[-1])))
    left = sorted([c for c in out if (c[0] + c[1]) / 2 < g.shape[1] / 2], key=lambda c: c[2])
    right = sorted([c for c in out if (c[0] + c[1]) / 2 >= g.shape[1] / 2], key=lambda c: c[2])
    return left, right


def words(pdf, page):
    x = run('pdftotext', '-bbox', '-f', str(page), '-l', str(page), str(pdf), '-')
    return [(float(a) * PX, float(b) * PX, float(c) * PX, float(d) * PX, w)
            for a, b, c, d, w in re.findall(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)</word>', x)]


def number(s):
    try: return float(s)
    except ValueError: return None


def vf_axis_from_labels(ws, frame):
    x0, x1, y0, y1 = frame
    labs = [(( a + c) / 2, number(w)) for a, b, c, d, w in ws
            if number(w) is not None and y1 < (b + d) / 2 < y1 + 110 and x0 - 70 < (a + c) / 2 < x1 + 70]
    labs.sort()
    return labs


def dark_runs(vec, thr=105, minlen=5):
    """runs of dark pixels along a 1-D slice -> list of (start, end)"""
    m = (vec < thr).astype(np.int8); d = np.diff(np.concatenate([[0], m, [0]]))
    return [(a, b) for a, b in zip(np.where(d == 1)[0], np.where(d == -1)[0]) if b - a >= minlen]


def pick(runs, hint=None):
    if not runs: return None
    if hint is None: a, b = max(runs, key=lambda r: r[1] - r[0])
    else: a, b = min(runs, key=lambda r: abs((r[0] + r[1]) / 2 - hint))
    return (a + b - 1) / 2


def grid_lines(g, frame, frac=0.55, dark=140):
    """pixel columns / rows inside the frame that belong to gridlines (dark over most of the frame)"""
    x0, x1, y0, y1 = frame
    sub = g[y0:y1 + 1, x0:x1 + 1] < dark
    cols = np.where(sub.mean(axis=0) > frac)[0] + x0
    rows = np.where(sub.mean(axis=1) > frac)[0] + y0
    return cols, rows


def clean(g, frame, pad=1, rows_too=True, dark=140, frac=0.55):
    """dark mask of the chart interior with gridlines erased (the curve is thicker than a gridline and survives)"""
    x0, x1, y0, y1 = frame
    m = g < 155      # some sheets draw the curve in mid gray
    cols, rows = grid_lines(g, frame, frac, dark)
    for c in cols: m[:, max(0, c - pad):c + pad + 1] = False
    if rows_too:
        for r in rows: m[max(0, r - pad):r + pad + 1, :] = False
    keep = np.zeros_like(m); keep[y0 + 4:y1 - 3, x0 + 4:x1 - 3] = True
    return m & keep


def centre(vec, hint=None, gap=6, minlen=4, maxd=None, low=False, maxlen=None):
    """centre of the thickest dark run along a slice, bridging gaps left by erased gridlines"""
    idx = np.where(vec)[0]
    if len(idx) == 0: return None
    groups = [[idx[0]]]
    for i in idx[1:]:
        (groups[-1].append(i) if i - groups[-1][-1] <= gap else groups.append([i]))
    groups = [gp for gp in groups if len(gp) >= minlen and (maxlen is None or len(gp) <= maxlen)]
    if not groups: return None
    if low and hint is not None:
        near = [q for q in groups if abs(np.mean(q) - hint) <= (maxd or 1e9)]
        if near: gp = max(near, key=lambda q: np.mean(q)); return float((gp[0] + gp[-1]) / 2)
    if hint is None: gp = max(groups, key=len)
    else: gp = min(groups, key=lambda q: abs(np.mean(q) - hint))
    if hint is not None and maxd is not None and abs((gp[0] + gp[-1]) / 2 - hint) > maxd: return None
    return float((gp[0] + gp[-1]) / 2)


def true_frame(g, frame):
    """the template's horizontal frame lines are sometimes shorter than the grid, so take the vertical extent from the outer vertical gridline"""
    x0, x1, y0, y1 = frame
    cols, _ = grid_lines(g, frame)
    col = int(round(float(np.mean([c for c in cols if c < x0 + 12])))) if len(cols) else x0
    ymid = (y0 + y1) // 2
    dark = lambda y: g[y, col - 1:col + 2].min() < 140
    top = ymid
    while top > 0 and (dark(top - 1) or dark(max(0, top - 3))): top -= 1
    bot = ymid
    while bot < g.shape[0] - 2 and (dark(bot + 1) or dark(min(g.shape[0] - 1, bot + 3))): bot += 1
    return (x0, x1, top, bot)


def group(idx, gap=3):
    """centres of runs of consecutive pixel indices (a gridline is a few pixels thick)"""
    out = []
    for c in idx:
        if out and c - out[-1][-1] <= gap: out[-1].append(c)
        else: out.append([c])
    return [float(np.mean(o)) for o in out]


def log_axis(lines, values):
    """pixel->log10(value) interpolator from the gridlines of a hand-drawn semi-log chart (lines are 1..9, 10, 20..90, 100, ...)"""
    n = len(values)
    if len(lines) < n: return None
    px = np.array(lines[:n], float); lv = np.log10(np.array(values, float))
    return lambda p_: float(np.interp(p_, px, lv)) if px[0] < px[-1] else float(np.interp(p_, px[::-1], lv[::-1]))


def scan(m, axis, rng, hint=None, gap=5, minlen=3, maxd=40, low=False, maxlen=None):
    """dense scan of a cleaned mask: for each row (axis=0) or column (axis=1) in rng return (index, centre) pairs of the curve"""
    pairs, prev = [], hint
    for k in rng:
        c = centre(m[k] if axis == 0 else m[:, k], prev, gap=gap, minlen=minlen, maxd=maxd, low=low, maxlen=maxlen)
        if c is not None:
            pairs.append((k, c)); prev = c
    return pairs


def smooth(pairs, win=9):
    """running median of the centre coordinate, to damp pixel noise and dashed-line artefacts"""
    if len(pairs) < win: return pairs
    ks = [k for k, _ in pairs]; cs = np.array([c for _, c in pairs])
    out = [float(np.median(cs[max(0, i - win // 2):i + win // 2 + 1])) for i in range(len(cs))]
    return list(zip(ks, out))


def sample(pairs, at):
    """linear interpolation of a scanned curve at the requested index positions (None outside the scanned span)"""
    if len(pairs) < 2: return [None for _ in at]
    ks = np.array([k for k, _ in pairs], float); cs = np.array([c for _, c in pairs], float)
    return [float(np.interp(a_, ks, cs)) if ks[0] <= a_ <= ks[-1] else None for a_ in at]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('pdf'); ap.add_argument('--page', type=int); ap.add_argument('--out', default='.')
    ap.add_argument('--rated', type=float, default=25.0, help='absolute-maximum DC current in mA (solid part of the Vf curve)')
    ap.add_argument('--dark', type=int, default=140, help='gray level below which a pixel counts as a line (raise for faint, low-resolution charts)')
    ap.add_argument('--der-ymax', type=float, default=50.0, help='top of the derating chart current axis (mA)')
    ap.add_argument('--iv-thin', action='store_true', help='Iv-If curve only: ignore thick strokes and take the lowest thin stroke (sheet with a stray Vf line over the chart)')
    ap.add_argument('--grid-frac', type=float, default=0.55)
    ap.add_argument('--vf-axis', help='"lo,cell": voltage at the left frame line and volts per grid cell (default: read from the page text)')
    a = ap.parse_args()
    pdf = Path(a.pdf); page = a.page or find_page(pdf)
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(['pdftoppm', '-r', str(DPI), '-f', str(page), '-l', str(page), '-gray', '-png', '-singlefile', str(pdf), tmp + '/p'], check=True)
        g = np.asarray(Image.open(tmp + '/p.png').convert('L')).astype(int)
    left, right = charts(g, dark=a.dark)
    left = left[-2:] if len(left) == 3 else left      # a faint spectrum frame may also be found; the last two are temperature and derating
    if len(left) != 2 or len(right) != 2: raise SystemExit(f'expected 2+2 chart frames, got {left} {right}')
    (temp_f, der_f), (vf_f, iv_f) = left, right
    iv_f = true_frame(g, iv_f); temp_f = true_frame(g, temp_f)
    ws = words(pdf, page)
    out = {'sheet': pdf.name, 'page': page, 'frames': {'temp': temp_f, 'derating': der_f, 'vf': vf_f, 'iv': iv_f}}
    rgb = Image.fromarray(g.astype(np.uint8)).convert('RGB'); dr = ImageDraw.Draw(rgb)
    def dot(x, y, c='red'): dr.ellipse((x - 7, y - 7, x + 7, y + 7), outline=c, width=3)
    # ---- Vf vs If: grid cells are the unit (the printed end label is not always on the last gridline)
    x0, x1, y0, y1 = vf_f
    cols, _ = grid_lines(g, vf_f, a.grid_frac, a.dark)
    lines = []
    for c in cols:
        if lines and c - lines[-1][-1] <= 3: lines[-1].append(c)
        else: lines.append([c])
    vlines = [float(np.mean(l)) for l in lines]
    cells = len(vlines) - 1
    labs = vf_axis_from_labels(ws, vf_f)
    if a.vf_axis: lo, cell = map(float, a.vf_axis.split(','))
    elif len(labs) >= 2:
        per_label = round((labs[1][0] - labs[0][0]) / ((vlines[-1] - vlines[0]) / cells))
        lo, cell = labs[0][1], (labs[1][1] - labs[0][1]) / per_label
    else: raise SystemExit('voltage axis labels are not text in this sheet (raster chart): pass --vf-axis lo,cell')
    out['vf_axis'] = {'lo': lo, 'cell_V': round(cell, 4), 'cells': cells, 'hi': round(lo + cells * cell, 3), 'labels': [v for _, v in labs]}
    fx = lambda px: lo + (px - vlines[0]) * cell / ((vlines[-1] - vlines[0]) / cells)
    fy = lambda i: y1 - (i / 50.0) * (y1 - y0)
    m = clean(g, vf_f, dark=a.dark, frac=a.grid_frac)
    cur = [1, 2, 3, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30]; cur = [c for c in cur if c <= a.rated]
    rows = range(int(round(fy(a.rated * 1.04))), int(round(fy(0.5))))
    pr = smooth(scan(m, 0, rows, gap=2), 11)
    cur_of_row = lambda yy: (y1 - yy) / (y1 - y0) * 50.0
    pr = sorted([(cur_of_row(k), fx(c)) for k, c in pr])
    vs = [None if v is None else round(v, 3) for v in sample(pr, cur)]
    pts = [(i, v, 0.0) for i, v in zip(cur, vs) if v is not None]
    for i, v in zip(cur, vs):
        if v is not None: dot(vlines[0] + (v - lo) / cell * ((vlines[-1] - vlines[0]) / cells), fy(i))
    out['vf_points'] = [(i, v) for i, v, _ in pts]
    # ---- Iv vs If (semi-log paper: vertical lines 1..9,10,20..100 mA; horizontal lines 1..9,10,...,1000 %)
    x0, x1, y0, y1 = iv_f
    ic, ir = grid_lines(g, iv_f, a.grid_frac, a.dark)
    vl, hl = group(ic), group(ir)
    X_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
    Y_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]
    xl = log_axis(vl, X_VALUES); yl = log_axis(hl[::-1], Y_VALUES)
    uniform = lambda y0_, y1_: (lambda p_: 3.0 * (y1_ - p_) / (y1_ - y0_))   # equal decades between the frame lines 1 % and 1000 %
    out['iv_grid'] = {'vertical_lines': len(vl), 'horizontal_lines': len(hl), 'y_axis': 'gridlines' if yl else 'uniform-decades'}
    if not xl: raise SystemExit('Iv-If grid has fewer than 19 vertical lines: ' + json.dumps(out['iv_grid']))
    if not yl: yl = uniform(y0, y1)   # only ratios to the test-current value are used downstream, so equal decades are adequate
    px_of = lambda i: float(np.interp(math.log10(i), [math.log10(v) for v in X_VALUES], vl[:19]))
    val_of = lambda py: 10 ** yl(py)
    m = clean(g, iv_f, dark=a.dark, frac=a.grid_frac)
    cur = [1, 2, 3, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30]; cur = [c for c in cur if c <= a.rated * 1.2]
    pr = smooth(scan(m, 1, range(int(round(px_of(1.0))) + 3, int(round(px_of(min(60.0, a.rated * 1.6))))), hint=y1 - 0.12 * (y1 - y0), gap=7, low=a.iv_thin, maxlen=(9 if a.iv_thin else None)), 9)
    ys = sample(pr, [px_of(i) for i in cur]); pts = []
    for i, py in zip(cur, ys):
        if py is not None:
            pts.append((i, round(val_of(py), 1))); dot(px_of(i), py, 'blue')
    out['iv_vs_if_percent'] = pts
    # ---- Iv vs Ta (log y 1..1000 %, x -60..100 degC)
    x0, x1, y0, y1 = temp_f
    tc, tr = grid_lines(g, temp_f, a.grid_frac, a.dark); thl = group(tr)
    tyl = log_axis(thl[::-1], Y_VALUES)
    out['temp_grid'] = {'horizontal_lines': len(thl), 'y_axis': 'gridlines' if tyl else 'uniform-decades'}
    if not tyl: tyl = uniform(y0, y1)
    tx = lambda t: x0 + (t + 60) / 160.0 * (x1 - x0)
    # the near-flat curve often lies on a gridline, so gridline rows are not erased: a dark run is the curve unless it is just a gridline
    vset = set(int(c) for c in tc); grows = thl
    hint = y1 - (y1 - y0) * 2.0 / 3.0; prev = hint; pr = []
    for k in range(int(round(tx(-45))), int(round(tx(90)))):
        if any(abs(k - c_) <= 3 for c_ in vset): continue
        rs = dark_runs(g[y0 + 4:y1 - 3, k], thr=155, minlen=2)
        rs = [(a_ + y0 + 4, b_ + y0 + 4) for a_, b_ in rs]
        rs = [r_ for r_ in rs if not (r_[1] - r_[0] <= 4 and any(abs((r_[0] + r_[1] - 1) / 2 - gr) <= 1.6 for gr in grows))]
        rs = [r_ for r_ in rs if abs((r_[0] + r_[1] - 1) / 2 - prev) <= 24]
        if rs:
            r_ = min(rs, key=lambda q: abs((q[0] + q[1] - 1) / 2 - prev)); prev = (r_[0] + r_[1] - 1) / 2; pr.append((k, prev))
    pr = smooth(pr, 15)
    ts = [-40, -20, 0, 20, 25, 40, 60, 80, 85]
    ys = sample(pr, [tx(q) for q in ts])
    if pr:   # clamp the end points to the nearest scanned column (the curve starts/ends a few pixels inside the span)
        ys = [y_ if y_ is not None else (pr[0][1] if tx(q) < pr[0][0] else pr[-1][1]) for q, y_ in zip(ts, ys)]
    pts = []
    for q, py in zip(ts, ys):
        pts.append((q, round(10 ** tyl(py), 1))); dot(tx(q), py, 'green')
    out['iv_vs_ta_percent'] = pts
    # ---- derating (x 0..100 degC, y 0..50 mA)
    x0, x1, y0, y1 = der_f
    dx_ = lambda t: x0 + t / 100.0 * (x1 - x0)
    m = clean(g, der_f, dark=a.dark, frac=a.grid_frac)
    pr = smooth(scan(m, 1, range(int(round(dx_(0))) + 3, int(round(dx_(88)))), gap=4), 7)
    ts = [0, 10, 25, 30, 40, 50, 60, 70, 80, 84]
    ys = sample(pr, [dx_(q) for q in ts]); pts = []
    for q, py in zip(ts, ys):
        if py is not None:
            pts.append((q, round((y1 - py) / (y1 - y0) * a.der_ymax, 2))); dot(dx_(q), py, 'orange')
    out['derating_mA'] = pts
    Path(a.out).mkdir(parents=True, exist_ok=True)
    rgb.crop((0, 450, g.shape[1], 3200)).resize((g.shape[1] // 2, (3200 - 450) // 2)).save(Path(a.out) / (pdf.stem + '_overlay.png'))
    print(json.dumps(out, ensure_ascii=False))


if __name__ == '__main__':
    main()

"""Read the four characteristic curves of a Kingbright APT2012 datasheet straight from its vector graphics.

    python scripts/digitize_kingbright.py <APT2012xxxx.pdf>

Needs pdfplumber. The "TECHNICAL DATA" page draws, left to right, four small charts: forward current vs. forward voltage, luminous
intensity (normalised at 20 mA) vs. forward current, forward-current derating, and luminous intensity (normalised at 25 degC)
vs. ambient temperature. Each chart's curve is a stroked path in the PDF, and its tick labels are text, so the axes are calibrated by a
least-squares fit through the label centres and the path points are converted exactly (no pixels, no reading error beyond the label
placement of about +-0.5 pt). Prints JSON with the converted polylines sampled at fixed positions.
"""
import json, re, sys
import numpy as np
import pdfplumber

NUM = re.compile(r'-?\d+(\.\d+)?')


def fit(pairs):
    """value = a * coordinate + b through (coordinate, value) label centres; stray numbers (rotated axis titles) are trimmed as outliers"""
    pairs = list(pairs)
    while True:
        xs = np.array([p[0] for p in pairs]); vs = np.array([p[1] for p in pairs])
        a, b = np.polyfit(xs, vs, 1)
        err = np.abs(a * xs + b - vs) / abs(a)          # residual in points on the page
        if err.max() <= 1.0 or len(pairs) <= 3: break
        pairs.pop(int(err.argmax()))
    return (lambda c: a * c + b), float(err.max()), len(pairs)


def main(path):
    pdf = pdfplumber.open(path)
    page = next(p for p in pdf.pages if 'TECHNICAL DATA' in (p.extract_text() or ''))
    words = page.extract_words()
    # chart frames: the thin vertical axis line at the left of each plot, in the lower chart row
    axes = sorted([c for c in page.curves if c['linewidth'] < .2 and 60 < c['bottom'] - c['top'] < 120 and c['top'] > 250 and c['x1'] - c['x0'] < 4], key=lambda c: c['x0'])
    if len(axes) != 4: raise SystemExit(f'expected 4 chart frames, found {len(axes)}')
    ax = [(c['x0'] + c['x1']) / 2 for c in axes]
    top, bottom = min(c['top'] for c in axes), max(c['bottom'] for c in axes)
    bounds = ax + [ax[-1] + 150]
    charts = {}
    for i, name in enumerate(['vf', 'iv_if', 'derating', 'iv_ta']):
        lo, hi = bounds[i], bounds[i + 1]
        xl = [((w['x0'] + w['x1']) / 2, float(w['text'])) for w in words
              if NUM.fullmatch(w['text']) and bottom + 2 < w['top'] < bottom + 14 and lo - 8 <= (w['x0'] + w['x1']) / 2 < hi - 12]
        yl = [((w['top'] + w['bottom']) / 2, float(w['text'])) for w in words
              if NUM.fullmatch(w['text']) and top - 6 < (w['top'] + w['bottom']) / 2 < bottom + 3 and w['bottom'] < bottom + 8 and lo - 30 < w['x1'] <= lo + 1]
        fx, rx, nx = fit(xl); fy, ry, ny = fit(yl)
        # each plotted curve is drawn as a short line, a curve segment and sometimes a closing line: merge them in x order
        parts = sorted([c for c in list(page.curves) + list(page.lines) if c['linewidth'] > .5 and not c.get('fill')
                        and top - 4 < c['top'] and c['bottom'] <= bottom + 2 and lo - 2 <= c['x0'] < hi - 5], key=lambda c: (c['x0'], c['top']))
        if not parts: raise SystemExit(f'{name}: no plotted curve found')
        raw = []
        for c in parts:
            for x, y in c['pts']:
                if not raw or abs(raw[-1][0] - x) > 1e-6 or abs(raw[-1][1] - y) > 1e-6: raw.append((x, y))
        pts = [(fx(x), fy(y)) for x, y in raw]
        charts[name] = {'x_labels': [v for _, v in xl], 'y_labels': [v for _, v in yl], 'fit_residual_pt': [round(rx, 3), round(ry, 3)], 'labels_used': [nx, ny], 'points': [(round(x, 4), round(y, 4)) for x, y in pts]}
    out = {'sheet': path.split('/')[-1], 'charts': charts}
    # sampled readings
    def at(poly, xs, tol=0.6):
        p = sorted(poly, key=lambda q: q[0]); px, py = [], []
        for a, b in p:                       # a closing vertical stroke repeats an x: keep the first point
            if not px or a - px[-1] > 1e-6: px.append(a); py.append(b)
        res = []
        for x in xs:
            if x < px[0] - tol or x > px[-1] + tol: res.append(None)
            else: res.append(round(float(np.interp(x, px, py)), 4))
        return res
    vf = [(y, x) for x, y in charts['vf']['points']]    # (current, voltage)
    out['vf_vs_mA'] = dict(zip([1, 2, 3, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30], at(vf, [1, 2, 3, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30])))
    out['iv_rel_vs_mA'] = dict(zip([5, 10, 15, 20, 25, 30], at(charts['iv_if']['points'], [5, 10, 15, 20, 25, 30])))
    out['derating_mA_vs_C'] = dict(zip([-40, 0, 25, 40, 60, 80, 85], at(charts['derating']['points'], [-40, 0, 25, 40, 60, 80, 85])))
    out['iv_rel_vs_C'] = dict(zip([-40, -20, 0, 20, 25, 40, 60, 80, 85], at(charts['iv_ta']['points'], [-40, -20, 0, 20, 25, 40, 60, 80, 85])))
    print(json.dumps(out, ensure_ascii=False))


if __name__ == '__main__':
    main(sys.argv[1])

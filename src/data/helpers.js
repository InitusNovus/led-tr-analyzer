/** Small builders shared by the curated LED data files. */
export const graph = (source, figure, conditions, points, logX = true, logY = false) => ({
    source, figure, conditions, points, logX, logY,
    kind: 'manual-curve', domain: [points[0][0], points.at(-1)[0]],
    method: 'Coarse manual reading; piecewise interpolation. No digitization accuracy or production spread guaranteed.',
});
export const mA = (points) => points.map(([i, v]) => [i / 1000, v]);
export const binRows = rows => rows.map(([id, min, max]) => ({ id, min, max }));

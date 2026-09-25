/** Curated datasheet evidence. Graph points are coarse manual readings, NOT guarantees.
 * Numerical SI values are kept separate from limits and from model assumptions. */
export const SOURCES = {
    kingbright: { manufacturer: 'Kingbright', revision: 'V.21A / 2025-03-17', url: 'https://www.kingbrightusa.com/images/catalog/SPEC/APT2012SURCK.pdf' },
    dtc: { manufacturer: 'ROHM', revision: 'Rev.002 / 2016-03-25', url: 'https://fscdn.rohm.com/en/products/databook/datasheet/discrete/transistor/digital/dtc043zebtl-e.pdf' },
    npn: { manufacturer: 'onsemi', revision: 'Rev.14 / 2021-08', url: 'https://www.onsemi.com/download/data-sheet/pdf/mmbt3904lt1-d.pdf' },
    pnp: { manufacturer: 'Nexperia', revision: 'Rev.9 / 2022-07-01', url: 'https://assets.nexperia.com/documents/data-sheet/BC856_BC857_BC858.pdf' },
    nmos: { manufacturer: 'Nexperia', revision: 'Rev.7 / 2011-09-08', url: 'https://assets.nexperia.com/documents/data-sheet/2N7002.pdf' },
    pmos: { manufacturer: 'NXP / Nexperia', revision: 'Rev.06 / 2008-12-16', url: 'https://assets.nexperia.com/documents/data-sheet/BSS84.pdf' },
    gpio: { manufacturer: 'STMicroelectronics', revision: 'DS13560 Rev.6', url: 'https://www.st.com/resource/en/datasheet/stm32g0b1cc.pdf' },
};
const graph = (source, figure, conditions, points, logX = true, logY = false) => ({
    source, figure, conditions, points, logX, logY,
    kind: 'manual-curve', domain: [points[0][0], points.at(-1)[0]],
    method: 'Coarse manual reading; piecewise interpolation. No digitization accuracy or production spread guaranteed.',
});
const mA = (points) => points.map(([i, v]) => [i / 1000, v]);
export const LEDS = {
    'APT2012SURCK': {
        id: 'APT2012SURCK', name: 'APT2012SURCK · Kingbright', color: '#ee5364', source: 'kingbright', kind: 'manual-curve',
        vf: graph('kingbright', 'p.3, Forward current vs. forward voltage', 'Ta=25°C; typical', mA([[1, 1.75], [2, 1.79], [5, 1.84], [10, 1.89], [20, 1.95], [30, 2.00]]), false),
        vfTest: { current: .02, typ: 1.95, max: 2.5, min: null, condition: 'p.2 Electrical/optical characteristics, Ta=25°C' },
        vfTempCoefficient: -.0019, tempRange: [-10, 85],
        temperatureNote: '−1.9mV/°C is specified at 20mA only; applying it to the entire curve is an approximation.',
        optical: {
            nominalMcd: 230, testCurrent: .02,
            convention: 'p.1 non-star photometric value (NOT the starred CIE127-2007 80mcd value)',
            relative: graph('kingbright', 'p.3, Luminous intensity vs. forward current', 'Ta=25°C; normalized at20mA', mA([[0, 0], [5, .25], [10, .5], [20, 1], [30, 1.5]]), false),
            temperature: graph('kingbright', 'p.3, Luminous intensity vs. ambient temperature', 'If=20mA; typical; applying at other currents is approximate', [[-40, 2], [-20, 1.55], [0, 1.25], [25, 1], [40, .83], [60, .65], [85, .46]], false),
        },
        limits: { current: .03, power: .075, reverse: 5, maxTemperature: 85 },
        currentDerating: graph('kingbright', 'p.3, Forward current derating', 'RthJA=530°C/W; reference PCB; approximate graphic limit', [[-40, .03], [25, .03], [50, .021], [85, .008]], false),
        notes: ['Distinct reference LED; not a substitute model for KT-0805.', 'Typical curves are not production min/max envelopes.'],
    },
};
// Preserve previous selections without pretending the old AI-entered values were verified.
// None of the old If(max)=30mA or mcd numbers is used as a verified limit/optical result.
const legacy = [
    ['KT-0805R', 'Red', '#e85060', 1.8, 2.0, 'C2295'],
    ['KT-0805G', 'Green', '#38b078', 2.7, 3.2, 'C2297'],
    ['KT-0805B', 'Blue', '#5599ed', 2.7, 3.1, 'C2293'],
    ['KT-0805YG', 'Yellow-green', '#b1c94c', 1.9, 2.1, 'C2292'],
    ['KT-0805Y', 'Yellow', '#d7ae39', 1.8, 2.0, 'C2296'],
    ['KT-0805O', 'Orange', '#ef933f', 1.8, 2.0, 'C110371'],
    ['KT-0805W', 'White', '#dde5ef', 2.7, 3.1, 'C34499'],
];
for (const [id, colorName, color, intercept, vf, lcscId] of legacy) {
    LEDS[id] = {
        id, name: `${id} (${colorName}) · 미검증 기존값`, color, source: `legacy-${id}`, kind: 'legacy-unverified', lcscId,
        linear: { intercept, resistance: (vf - intercept) / .02, domain: [.001, .03] }, optical: null, limits: {},
        notes: ['Original source values retained for comparison only. Datasheet revision/test current and absolute limits remain unverified.', 'No optical output or pass verdict for this preset; select a sourced reference or add reviewed data to the catalog.'],
    };
    SOURCES[`legacy-${id}`] = { manufacturer: 'Hubei KENTO (unverified model)', revision: 'Not verified', url: `https://www.lcsc.com/product-detail/${lcscId}.html` };
}
export const BJTS = {
    npn: {
        id: 'MMBT3904LT1G', name: 'MMBT3904LT1G · onsemi', source: 'npn', polarity: 'npn', ratio: 10,
        gain: graph('npn', 'Fig.15', 'VCE=1V, Tj=25°C; typical', mA([[.1, 200], [1, 195], [10, 190], [30, 165], [50, 130], [100, 75], [200, 32]])),
        vbe: graph('npn', 'Fig.19', 'VCE=1V, Tj=25°C; typical', mA([[.1, .61], [1, .665], [10, .73], [30, .775], [100, .875], [200, .99]])),
        vbeSat: graph('npn', 'Fig.18', 'IC/IB=10, Tj=25°C; typical', mA([[.1, .615], [1, .68], [10, .75], [30, .8], [100, .885], [200, 1.00]])),
        vceSat: graph('npn', 'Fig.17', 'IC/IB=10, Tj=25°C; typical', mA([[1, .04], [2, .041], [5, .045], [10, .05], [30, .065], [50, .078], [100, .12], [200, .22]])),
        limits: { current: .2, voltage: 40, reverseBE: 6, power: .225, maxJunction: 150, deratePerC: .0018 },
        thermalCondition: 'p.1 FR-5 1.0×0.75×0.062in board; not an arbitrary PCB rating',
        notes: ['Interpolation between active and IC/IB=10 saturation anchors is an explicit bridge approximation.', 'VCE dependence away from the published active-region test voltage is not fully characterized.'],
    },
    pnp: {
        id: 'BC857B', name: 'BC857B · Nexperia', source: 'pnp', polarity: 'pnp', ratio: 20,
        gain: graph('pnp', 'Fig.6', '|VCE|=5V, Ta=25°C; typical B gain group', mA([[.1, 325], [1, 320], [2, 315], [10, 290], [30, 250], [100, 140], [200, 60]])),
        vbe: graph('pnp', 'Fig.7', '|VCE|=5V, Ta=25°C; magnitudes', mA([[.01, .51], [.1, .565], [1, .63], [2, .65], [10, .7], [30, .755], [100, .825], [200, .92]])),
        vbeSat: graph('pnp', 'Fig.9', '|IC/IB|=20, Ta=25°C; magnitudes', mA([[.1, .58], [1, .645], [2, .67], [10, .74], [30, .805], [100, .925], [200, 1.04]])),
        vceSat: graph('pnp', 'Fig.8', '|IC/IB|=20, Ta=25°C; magnitudes', mA([[.1, .035], [1, .036], [2, .038], [10, .05], [30, .075], [100, .21], [200, .70]])),
        limits: { current: .1, voltage: 45, reverseBE: 5, power: .25, maxJunction: 150, deratePerC: .002 },
        thermalCondition: 'Table6/7 FR4 single-sided 35µm copper, standard footprint',
        notes: ['Typical graph readings differ from separately characterized typ table points; neither is a guarantee.', 'Active/saturation bridge and VCE independence are approximations.'],
    },
};
export const DIGITAL = {
    id: 'DTC043ZEB', name: 'DTC043ZEB · ROHM', source: 'dtc', r1: 4700, r1Range: [3290, 6110], ratio: 10, ratioRange: [8, 12],
    outputRatio: 10,
    on: graph('dtc', 'Fig.5', 'IO/II=10 (external terminal currents), Ta=25°C; pulsed', mA([[.2, .085], [.5, .055], [1, .041], [2, .036], [5, .035], [10, .04], [20, .052], [50, .09], [100, .18]])),
    gain: graph('dtc', 'Fig.4', 'VO=10V, Ta=25°C; GI=IO/II, NOT internal hFE', mA([[.1, 6], [.2, 12], [.5, 27], [1, 47], [2, 80], [5, 145], [10, 200], [20, 230], [50, 205], [100, 85]])),
    limits: { current: .1, voltage: 50, inputMin: -5, inputMax: 30, power: .15, maxJunction: 150 },
    table: { onVoltage: { typ: .05, max: .15, current: .005, inputCurrent: .0005 }, gainMin: 80, gainTestCurrent: .005 },
    notes: ['Terminal GI/on curves joined by an assumed output-voltage bridge; not a reconstructed transistor model.', 'Internal VBE uses an explicit 0.7V/5mA logarithmic approximation (60mV per decade), not a ROHM curve.', 'R1 and R2/R1 varied independently; R2 is derived, not independently cornered.', 'PD=150mW is at25°C on reference lands; temperature derating is not fully specified by this reduced model.'],
};
// Positive magnitudes for both polarities. These are low-voltage slices of output curves,
// Each gate slice has its own published plot range; extensions are always reported.
export const MOSFETS = {
    nmos: {
        id: '2N7002', name: '2N7002 · Nexperia', source: 'nmos', polarity: 'nmos',
        output: [
            { gate: 3.5, points: [[0, 0], [.25, .035], [.5, .065], [1, .12], [2, .17], [3, .19], [4, .20]] },
            { gate: 4, points: [[0, 0], [.25, .055], [.5, .1], [1, .2], [2, .35], [3, .415], [4, .44]] },
            { gate: 4.5, points: [[0, 0], [.25, .065], [.5, .13], [1, .265], [2, .48], [3, .62], [4, .70]] },
            { gate: 5, points: [[0, 0], [.25, .08], [.5, .16], [1, .32], [2, .57], [3, .78], [4, .92]] },
            { gate: 10, points: [[0, 0], [.25, .10], [.5, .20], [1, .40], [2, .80]] },
        ],
        transfer: graph('nmos', 'Fig.7', 'VDS=10V, Tj=25°C; used only to scale an assumed low-gate output shape', [[0, 0], [2, 0], [2.5, .005], [3, .05], [3.5, .2]], false),
        figure: 'Fig.5 output curves, Tj=25°C; coarse manual readings',
        limits: { current: .3, voltage: 60, gate: 30, maxJunction: 150 },
        thermalResistance: 350, thermalCondition: 'RthJA=350K/W, minimum footprint/still air; 0.83W Tsp rating is NOT an ambient rating',
        notes: ['Below3.5V gate drive: transfer-curve-scaled shape approximation, not a measured output surface.', 'No SOA or self-heating feedback simulation.'],
    },
    pmos: {
        id: 'BSS84', name: 'BSS84 · NXP/Nexperia', source: 'pmos', polarity: 'pmos',
        output: [
            { gate: 2.5, points: [[0, 0], [.5, .022], [1, .038], [2, .048], [4, .05], [6, .05]] },
            { gate: 3, points: [[0, 0], [.5, .03], [1, .06], [2, .085], [4, .095], [6, .10]] },
            { gate: 4, points: [[0, 0], [.5, .045], [1, .09], [2, .16], [4, .21], [6, .22]] },
            { gate: 5, points: [[0, 0], [.5, .05], [1, .11], [2, .21], [4, .34], [6, .365]] },
            { gate: 6, points: [[0, 0], [.5, .06], [1, .12], [2, .245], [4, .44], [6, .50]] },
            { gate: 10, points: [[0, 0], [.5, .09], [1, .18], [2, .36]] },
        ],
        transfer: graph('pmos', 'Fig.6', '|VDS|=10V, Tj=25°C; assumed low-gate output shape', [[0, 0], [1.5, 0], [2, .01], [2.5, .05]], false),
        figure: 'Fig.4 output curves, Tj=25°C; absolute magnitudes; coarse manual readings',
        limits: { current: .13, voltage: 50, gate: 20, power: .25, maxJunction: 150 }, thermalResistance: 500,
        thermalCondition: 'Reference FR4 mounting, RthJA=500K/W; not validated for the user PCB',
        notes: ['Below2.5V gate drive: transfer-curve-scaled shape approximation.', 'No SOA or self-heating feedback simulation.'],
    },
};
export const GPIO = {
    id: 'STM32G0B1-general', name: 'STM32G0B1 일반 I/O · 한계점 근사', source: 'gpio', voltageRange: [2.7, 3.6],
    drop: { source: 'gpio', figure: 'Table57', conditions: 'Non-FT_c, non-PC13/14/15; VDDIO≥2.7V; CMOS. Guaranteed/design limits, NOT typ I-V.',
        kind: 'limit-derived-approximation', points: [[0, 0], [.008, .4], [.015, 1.3]], logX: false, logY: false, domain: [0, .015] },
    limits: { current: .015, totalSource: .08, totalSink: .08 },
    notes: ['Table57 bounds joined into a scenario curve; not the typical output impedance.', 'No injection/back-power/unpowered-pin model; VDD=0 is unsupported.', 'Aggregate budget includes only explicitly supplied other-pin currents; VDD/VSS package current is not fully checked.'],
};
export const PACKAGE_PRESETS = { '0402': .0625, '0603': .1, '0805': .125, '1206': .25 };

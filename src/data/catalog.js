/** Curated datasheet evidence. Graph points are coarse manual readings, NOT guarantees.
 * Numerical SI values are kept separate from limits and from model assumptions. */
export const SOURCES = {
    kingbright: { manufacturer: 'Kingbright', revision: 'V.21A / 2025-03-17', url: 'https://www.kingbrightusa.com/images/catalog/SPEC/APT2012SURCK.pdf' },
    kentoR: { manufacturer: 'Hubei KENTO', revision: 'A.0 / 2018-12-06', url: 'https://www.lcsc.com/datasheet/C2295.pdf' },
    kentoG: { manufacturer: 'Hubei KENTO', revision: 'A.0 / 2018-12-06', url: 'https://www.lcsc.com/datasheet/C2297.pdf' },
    kentoB: { manufacturer: 'Hubei KENTO', revision: 'A.0 / 2018-12-06', url: 'https://www.lcsc.com/datasheet/C2293.pdf' },
    kentoYG: { manufacturer: 'Hubei KENTO', revision: 'A.0 / 2018-12-06', url: 'https://www.lcsc.com/datasheet/C2292.pdf' },
    kentoY: { manufacturer: 'Hubei KENTO', revision: 'KT-0A approval sheet located; electrical test-current rows not parsed in this audit', url: 'https://www.lcsc.com/datasheet/C2296.pdf' },
    kentoO: { manufacturer: 'Hubei KENTO', revision: 'A.0 / 2018-12-06', url: 'https://www.lcsc.com/datasheet/C110371.pdf' },
    kentoW: { manufacturer: 'Shenzhen/Hubei KENTO', revision: 'A3 / 2017-05-16 · C34499-associated sheet', url: 'https://datasheet.lcsc.com/lcsc/2305091500_Hubei-KENTO-Elec-KT-0805W_C34499.pdf' },
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
// KENTO KT-0805 family. Datasheet curves are coarse manual readings of the exact LCSC-linked sheets.
// Electrical tables and typical curves are kept distinct; no midpoint is presented as a guaranteed typical value.
const kentoTemp = (source) => graph(source, 'p.5 Relative intensity vs. ambient temperature', 'Ta curve; typical, coarse manual reading', [[-40, 1.10], [0, 1.04], [25, 1.00], [50, .95], [85, .86]], false);
const kentoDerating = (source, rated, end) => graph(source, 'p.5 Maximum forward current vs. ambient temperature', 'typical/reference derating graphic', [[-40, rated], [25, rated], [85, end]], false);
const kentoOptical = (source, testCurrent, minMcd, maxMcd, points) => ({
    nominalMcd: null, minMcd, maxMcd, testCurrent,
    convention: 'Datasheet gives a min/max intensity bin range, not a single typical absolute-intensity anchor.',
    relative: graph(source, 'p.5 Relative intensity vs. forward current', 'Ta=25°C; normalized near 20mA; typical, coarse manual reading', mA(points), false),
    temperature: kentoTemp(source),
});
Object.assign(LEDS, {
    'KT-0805R': {
        id: 'KT-0805R', name: 'KT-0805R (Red) · Hubei KENTO', color: '#e85060', source: 'kentoR', kind: 'manual-curve', lcscId: 'C2295',
        vf: graph('kentoR', 'p.5 Forward current vs. forward voltage', 'Ta=25°C; typical, coarse manual reading', mA([[1,1.87],[5,1.95],[10,2.00],[15,2.04],[20,2.08],[25,2.11],[30,2.14],[35,2.17]]), false),
        vfTest: { current: .01, min: 1.8, typ: null, max: 2.4, condition: 'p.3 Electrical/optical characteristics, Ta=25°C' },
        vfBins: { current: .02, min: 1.8, max: 2.4, condition: 'p.4 voltage bin table; note different current from p.3 Vf row' },
        optical: kentoOptical('kentoR', .02, 85, 210, [[0,0],[5,.28],[10,.52],[15,.76],[20,1],[25,1.18],[30,1.36],[35,1.46],[40,1.55]]),
        limits: { current: .025, pulseCurrent: .06, power: .04, reverse: 5, maxTemperature: 85, minTemperature: -40 },
        currentDerating: kentoDerating('kentoR', .025, .006),
        notes: ['Vf table: 1.8–2.4V @10mA; voltage-bin table separately uses20mA.', 'IV is 85–210mcd @20mA: no single absolute typical mcd is invented.'],
    },
    'KT-0805G': {
        id: 'KT-0805G', name: 'KT-0805G (Emerald Green) · Hubei KENTO', color: '#38b078', source: 'kentoG', kind: 'manual-curve', lcscId: 'C2297',
        vf: graph('kentoG', 'p.5 Forward current vs. forward voltage', 'Ta=25°C; typical, coarse manual reading', mA([[1,2.40],[5,2.63],[10,2.82],[15,2.95],[20,3.04],[25,3.11],[30,3.16],[35,3.20],[40,3.24]]), false),
        vfTest: { current: .005, min: 2.6, typ: null, max: 3.1, condition: 'p.3 Electrical/optical characteristics, Ta=25°C' },
        optical: kentoOptical('kentoG', .005, 175, 430, [[0,0],[5,.40],[10,.65],[15,.84],[20,1],[25,1.12],[30,1.23],[35,1.33],[40,1.40]]),
        limits: { current: .03, pulseCurrent: .06, power: .10, reverse: 5, maxTemperature: 85, minTemperature: -40 },
        currentDerating: kentoDerating('kentoG', .03, .007),
        notes: ['Vf 2.6–3.1V and IV 175–430mcd are both specified @5mA.', 'Absolute DC current is30mA; 60mA is a pulsed rating, not DC.'],
    },
    'KT-0805B': {
        id: 'KT-0805B', name: 'KT-0805B (Blue) · Hubei KENTO', color: '#5599ed', source: 'kentoB', kind: 'manual-curve', lcscId: 'C2293',
        vf: graph('kentoB', 'p.5 Forward current vs. forward voltage', 'Ta=25°C; typical, coarse manual reading', mA([[1,2.65],[5,2.80],[10,2.90],[15,2.97],[20,3.02],[25,3.06],[30,3.10],[35,3.13],[40,3.15]]), false),
        vfTest: { current: .005, min: 2.6, typ: null, max: 3.1, condition: 'p.3 Electrical/optical characteristics, Ta=25°C' },
        optical: kentoOptical('kentoB', .005, 34, 100, [[0,0],[5,.35],[10,.57],[15,.80],[20,1],[25,1.12],[30,1.25],[35,1.40],[40,1.50]]),
        limits: { current: .03, pulseCurrent: .06, power: .10, reverse: 5, maxTemperature: 85, minTemperature: -40 },
        currentDerating: kentoDerating('kentoB', .03, .007),
        notes: ['Vf 2.6–3.1V and IV 34–100mcd are both specified @5mA.', 'Typical curve is not a production min/max envelope.'],
    },
    'KT-0805YG': {
        id: 'KT-0805YG', name: 'KT-0805YG (Yellow-green) · Hubei KENTO', color: '#b1c94c', source: 'kentoYG', kind: 'manual-curve', lcscId: 'C2292',
        vf: graph('kentoYG', 'p.5 Forward current vs. forward voltage', 'Ta=25°C; typical, coarse manual reading', mA([[1,1.87],[5,1.93],[10,1.97],[20,2.02],[30,2.05],[35,2.07]]), false),
        vfTest: { current: .01, min: 1.8, typ: null, max: 2.4, condition: 'p.3 Electrical/optical characteristics, Ta=25°C' },
        vfBins: { current: .02, min: 1.8, max: 2.4, condition: 'p.4 voltage bin table' },
        optical: kentoOptical('kentoYG', .02, 24, 70, [[0,0],[5,.30],[10,.63],[15,.84],[20,1],[25,1.10],[30,1.16],[35,1.20],[40,1.21]]),
        limits: { current: .025, pulseCurrent: .06, power: .04, reverse: 5, maxTemperature: 85, minTemperature: -40 },
        currentDerating: kentoDerating('kentoYG', .025, .006),
        notes: ['Vf table is 1.8–2.4V @10mA; IV is24–70mcd @20mA.', 'Absolute DC current is25mA.'],
    },
    'KT-0805Y': {
        id: 'KT-0805Y', name: 'KT-0805Y (Yellow) · Hubei KENTO', color: '#d7ae39', source: 'kentoY', kind: 'datasheet-table-only', lcscId: 'C2296',
        vfTableOnly: { current: null, min: 1.8, max: 2.4, nominalAssumption: 2.1, condition: 'LCSC/JLCPCB product/datasheet metadata; parsed listing does not expose the Vf test current' },
        vfTest: { current: null, min: 1.8, typ: null, max: 2.4, condition: 'Test current not verified from a readable source row in this audit' },
        optical: { nominalMcd: null, minMcd: null, maxMcd: 175, testCurrent: null, relative: null, temperature: null, convention: 'Distributor metadata exposes 175mcd but not its test current in the parsed listing; no scalar optical model is used.' },
        limits: { current: null, pulseCurrent: null, power: .04, reverse: null, maxTemperature: 85, minTemperature: -40 },
        notes: ['C2296 source identity, Vf 1.8–2.4V, 175mcd, 40mW and −40…85°C are verified from LCSC/JLCPCB metadata.', 'Forward-current/pulse/reverse limits and Vf/IV test currents remain unknown here; sibling KT parts are not used to fill them.', 'Vf uses an explicitly labeled 2.1V midpoint sensitivity approximation until the exact table row is reviewed.'],
    },
    'KT-0805O': {
        id: 'KT-0805O', name: 'KT-0805O (Orange) · Hubei KENTO', color: '#ef933f', source: 'kentoO', kind: 'manual-curve', lcscId: 'C110371',
        vf: graph('kentoO', 'p.5 Forward current vs. forward voltage', 'Ta=25°C; typical, coarse manual reading', mA([[1,1.85],[5,1.94],[10,1.99],[20,2.04],[30,2.08],[35,2.10]]), false),
        vfTest: { current: .01, min: 1.8, typ: null, max: 2.4, condition: 'p.3 Electrical/optical characteristics, Ta=25°C' },
        vfBins: { current: .02, min: 1.8, max: 2.4, condition: 'p.4 voltage bin table' },
        optical: kentoOptical('kentoO', .02, 70, 175, [[0,0],[5,.32],[10,.62],[15,.84],[20,1],[25,1.10],[30,1.16],[35,1.18],[40,1.16]]),
        limits: { current: .025, pulseCurrent: .06, power: .04, reverse: 5, maxTemperature: 85, minTemperature: -40 },
        currentDerating: kentoDerating('kentoO', .025, .006),
        notes: ['Vf table is 1.8–2.4V @10mA; IV is70–175mcd @20mA.', 'Typical curve points were read from the same C110371 approval sheet.'],
    },
    'KT-0805W': {
        id: 'KT-0805W', name: 'KT-0805W (White) · KENTO C34499 A3', color: '#dde5ef', source: 'kentoW', kind: 'datasheet-table-only', lcscId: 'C34499',
        vfTableOnly: { current: .005, min: 2.6, max: 3.2, nominalAssumption: 2.9, condition: 'A3 p.3 Electrical/optical characteristics, Ta=25°C' },
        vfTest: { current: .005, min: 2.6, typ: null, max: 3.2, condition: 'A3 p.3, Ta=25°C' },
        optical: { nominalMcd: 350, minMcd: null, maxMcd: null, testCurrent: .005, relative: null, temperature: null, convention: 'A3 p.3 typical absolute intensity @5mA. No same-source relative-current curve digitized.' },
        limits: { current: .025, pulseCurrent: .10, power: .08, reverse: 5, maxTemperature: 85, minTemperature: -30 },
        notes: ['Pinned to the C34499-associated A3 2017-05-16 sheet: Vf 2.6–3.2V @5mA, IV typ350mcd @5mA.', 'Other web mirrors expose conflicting electrical ratings/conditions; they are intentionally not mixed into this model.', 'JLCPCB summary “Test Current25mA” is treated as distributor metadata, not the p.3 Vf/IV test condition.'],
    },
});

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

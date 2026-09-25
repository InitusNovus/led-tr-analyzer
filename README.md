# LED-TR Analyzer

Browser-based engineering calculator for an LED + series resistor + digital NPN low-side driver.

The current prototype supports:
- LED forward-voltage / dynamic-resistance modeling
- E24 / E96 resistor selection
- digital-transistor base-current and forced-beta checks
- VCC / resistor tolerance corner analysis
- resistor power and package derating checks
- current / brightness-oriented sizing and verification

## Run locally

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
npm run preview
```

## GitHub Pages

The project is configured for:

https://initusnovus.github.io/led-tr-analyzer/

The workflow in `.github/workflows/deploy-pages.yml` builds and deploys pushes to `main`.
If Pages has not been enabled for this repository yet, select **GitHub Actions** once in **Settings → Pages**.

## Engineering note

This is an engineering aid, not a replacement for datasheet corner analysis or hardware validation. Device models in the UI are approximations and should be checked against the exact part, temperature range, supply tolerance, and intended operating conditions before design release.

# Byzantine Consensus Simulator

An interactive React + Vite webpage for exploring the Byzantine generals problem through the Lamport-Shostak-Pease oral messages algorithm, OM(m). Users mark generals as loyal or Byzantine, and the simulator derives the OM depth from that count while visualizing recursive message forwarding and majority decisions. as

## Local Development

```bash
npm install
npm run dev
```

## Production Build

```bash
npm run build
npm run preview
```

## Logic Checks

```bash
npm test
```

## GitHub Pages

This project includes `.github/workflows/deploy.yml`. Push to `main`, then enable GitHub Pages with **Source: GitHub Actions** in the repository settings. The Vite `base` is derived from `GITHUB_REPOSITORY`, so repository pages and user pages both get the correct asset path.

# GitHub Pages

Repository: https://github.com/tc03011-dot/dynamic-gravity-table

1. Upload the project to the `main` branch (exclude `node_modules` and `dist`).
2. Open Settings > Pages > Build and deployment > Source > GitHub Actions.
3. Open Actions > Deploy Dynamic Gravity Table. If necessary, select Run workflow.
4. After the workflow succeeds, open https://tc03011-dot.github.io/dynamic-gravity-table/.

Local development: `npm.cmd run dev` (unchanged).
Pages build: `npm.cmd run build:pages`.

The Pages build loads all committed cup profiles directly, without a local API.
New cups can be downloaded as profile JSON files. Shared persistent online saving
requires a separate backend/database; GitHub Pages does not run the local API.
Microphone and orientation access require browser permission and supported devices.
Real phone testing is still required. Updating the site requires another push.

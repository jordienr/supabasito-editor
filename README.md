# Supabasito Editor

A browser-based mascot editor with PNG and SVG exports. The application lives in [`supabasito-studio`](supabasito-studio/README.md) and runs directly from its `dist` directory without a build step or dependency installation.

## Run locally

Use Python 3 to serve the editor:

```sh
cd supabasito-studio
npm run serve
```

Open [localhost:4173](http://localhost:4173).

## Verify

Use Node.js 22 or later:

```sh
cd supabasito-studio
npm test
```

GitHub Actions runs the tests for pushes and pull requests targeting `main`, and for manual workflow runs.

## GitHub Pages

The public repository publishes the editor at [jordienr.github.io/supabasito-editor](https://jordienr.github.io/supabasito-editor/).

Every push to `main` runs the tests and deploys the editor after they pass. Pull requests run verification. The workflow uploads only `supabasito-studio/dist` as the site artifact.

To deploy manually, open **Actions → Verify and deploy Pages → Run workflow** and select `main`. The `github-pages` environment reports the deployed URL when publishing succeeds.

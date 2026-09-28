# Deploy runbook: cutting cy.my over to the new site

cy.my is the GitHub Pages user site for `cylim/cylim.github.io`, with Cloudflare in front of it. Today Pages is `build_type: legacy`, serving the root of `master` as-is. The new site is a Vite build that `.github/workflows/deploy.yml` publishes with GitHub Actions.

**Switch the Pages source before you merge.** If the merge lands while Pages is still `legacy`, the branch builder publishes the source tree. The homepage goes blank, the old resource and article URLs return 404, and the root `CNAME` is gone.

## 0. Before anything touches GitHub

- The PR's `ci.yml` run is green: typecheck, lint, unit, glyphs, build, budget and e2e. It is the first real run on GitHub's runner, with Node from `.nvmrc` and Playwright's bundled Chromium.
- `dist/index.html` has `data-cfasync="false"` on every `<script>`. Cloudflare Rocket Loader is on for the zone and would otherwise defer the pre-paint mode and veil scripts. Turning Rocket Loader off for cy.my in Cloudflare (Speed → Optimization → Content) is the belt-and-braces option.

## 1. Rollback anchor

```sh
git push origin 59f8dc5e2314c7013f655a9d5c726075da485fff:refs/heads/legacy-site
```

This is the current `master` of the 2018 site, with the root `CNAME`.

## 2. Allow deploys only from master

```sh
gh api -X PUT repos/cylim/cylim.github.io/environments/github-pages --input - <<<'{"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}'
gh api -X POST repos/cylim/cylim.github.io/environments/github-pages/deployment-branch-policies -f name=master -f type=branch
```

## 3. Switch the source to GitHub Actions (the old site stays up)

```sh
gh api -X PUT repos/cylim/cylim.github.io/pages -f build_type=workflow
gh api repos/cylim/cylim.github.io/pages --jq '{build_type,cname}'   # expect workflow, cy.my
# if cname is null:
gh api -X PUT repos/cylim/cylim.github.io/pages -f cname=cy.my
curl -s https://cy.my/ | grep -c 'Digital Nomad'                        # expect 1: the old site is still being served
```

With a workflow deploy, GitHub ignores the `CNAME` file and takes the domain from this setting.

## 4. Merge the PR, in the same sitting

The push to `master` runs `deploy.yml`. Watch it:

```sh
gh run watch --exit-status $(gh run list -R cylim/cylim.github.io --workflow deploy.yml -L1 --json databaseId -q '.[0].databaseId')
```

## 5. Verify

1. Pages status and domain: `gh api repos/cylim/cylim.github.io/pages` shows `status: built` and `cname: cy.my`.
2. Purge the Cloudflare cache (Caching → Purge Everything). Cloudflare gives unhashed static files a 4 h browser TTL.
3. The homepage is the new site, with Rocket Loader opted out:
   - `curl -s https://cy.my/` contains "The parts of software people touch" and `id="threshold-heading"`.
   - It has no `-text/javascript"` or `rocket-loader` strings.
4. These return 200:
   - `/resources/resume-en.pdf`, `/resources/profile.png`
   - `/articles/201808-first-year.html`, `/articles/201808-first-year`
   - `/favicon.ico`, `/robots.txt`, `/sitemap.xml`
   - `/blog/`, the separate project site
5. `/no-such-page` returns 404 with the ink "Lost in the mist" page.
6. `http://cy.my/` and `www.cy.my` return 301 to `https://cy.my/`.
7. In a real browser on a phone and a desktop:
   - walk top to bottom;
   - jump with the nav;
   - open `#grove` and check the chart;
   - try `?mode=static`;
   - share the URL somewhere to check the preview card.

## Rollback

```sh
gh workflow disable deploy.yml -R cylim/cylim.github.io
gh api -X PUT repos/cylim/cylim.github.io/pages -f build_type=legacy -f 'source[branch]=legacy-site' -f 'source[path]=/'
gh api repos/cylim/cylim.github.io/pages --jq .cname                   # re-set to cy.my if needed
# purge the Cloudflare cache, then: curl -s https://cy.my/ | grep -c 'Digital Nomad'
```

To fix forward: fix on `master`, set `build_type=workflow` again, run `gh workflow enable deploy.yml`, then `gh workflow run deploy.yml`.

## Don't

- Merge while Pages is still `legacy`.
- Click "Enforce HTTPS" in GitHub Pages settings. While Cloudflare proxies cy.my, GitHub has no certificate for it, and HTTPS exists only at the Cloudflare edge.
- Set Cloudflare SSL to Full (strict). The origin presents `*.github.io`, so keep SSL at Flexible or Full.

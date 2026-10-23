# CI and deployment

Three workflows live in `.github/workflows/`:

| Workflow                                                     | Trigger                                        | What it does                                                               |
| ------------------------------------------------------------ | ---------------------------------------------- | -------------------------------------------------------------------------- |
| `ci.yml` (check "CI")                                        | every push and pull request                    | lint, typecheck, unit tests, build                                         |
| `vercel.yml` (checks "Vercel Preview" / "Vercel Production") | pull requests against `main`; pushes to `main` | preview deployment with the URL commented on the PR; production deployment |
| `deploy-pages.yml`                                           | manual only                                    | optional GitHub Pages deploy for forks that prefer Pages                   |

`main` is protected: nobody pushes to it directly. Changes land through pull requests that must have a green **CI** run and a successful **Vercel Preview** deployment. Merging to `main` triggers the production deployment.

## One-time setup

### 1. Vercel project and secrets

1. Install the Vercel CLI and link the project from a local clone, choosing or creating the Vercel project:

   ```bash
   npm i -g vercel
   vercel link
   cat .vercel/project.json   # {"orgId": "...", "projectId": "..."}
   ```

   `.vercel/` is git-ignored; do not commit it.

2. Create a token at https://vercel.com/account/tokens.
3. In GitHub, open **Settings → Secrets and variables → Actions** and add:
   - `VERCEL_TOKEN`
   - `VERCEL_ORG_ID`
   - `VERCEL_PROJECT_ID`

4. In the Vercel project, open **Settings → Git** and make sure the GitHub integration is **not** also connected to this repository (or disable its automatic deployments). Otherwise every push deploys twice.

### 2. Default branch

If `main` is not already the default branch: **Settings → General → Default branch**, switch to `main`.

### 3. Protect main

**Settings → Rules → Rulesets → New ruleset → Import a ruleset**, then upload `.github/rulesets/protect-main.json`. It enables:

- pull requests required for all changes to `main` (no direct pushes, no force pushes, no deletion)
- required status checks **CI** and **Vercel Preview**, with the branch required to be up to date before merging
- review thread resolution required; zero approvals required so a solo maintainer can merge their own PR (raise the count when there is a second maintainer)

The check names must match the job `name:` fields in the workflows. If a check has never run on the repository, GitHub shows it as "not found" in the ruleset editor until the first pull request runs it; that is expected.

### Fork pull requests

GitHub does not expose secrets to workflows triggered by forks, so the preview job is skipped for them. A skipped required check counts as passing; **CI** still runs and still gates the merge. Maintainers can push the fork's branch to the main repository to get a preview.

## Day to day

```bash
git switch -c feature/my-change
# ... commit ...
git push -u origin feature/my-change
```

Open a pull request against `main`. Wait for **CI** and **Vercel Preview** (the preview URL appears as a comment), then merge. Production deploys from the merge commit; the production URL is printed in the **Vercel Production** job summary and is also the project's stable alias on Vercel.

# Branch and Release Policy

This repository uses `main` as the protected integration branch.

## Required Flow

1. Create feature and fix branches from `main`.
2. Open a pull request before merging into `main`.
3. Keep pull requests focused on one functional change or delivery concern.
4. Require the CI workflow to pass before merge.
5. Require review from `CODEOWNERS` for pipeline, deployment, security, and monitoring changes.

## Branch Naming

- `feature/<short-name>` for product work.
- `fix/<short-name>` for defects.
- `ops/<short-name>` for CI/CD, deployment, and monitoring.
- `release/<version>` for release preparation when needed.

## Release Tags

Production releases use tags that match the package version:

- `vYYYY.M.D`
- `vYYYY.M.D-N`
- `vYYYY.M.D-beta.N`

The release workflow runs package checks, publishes container images, can publish npm, and can deploy to Kubernetes through a protected GitHub environment.

## Repository Protection Settings

Configure these in the remote Git provider:

- Protect `main`.
- Require pull requests before merging.
- Require status checks: `CI / Quality Gate` and `CI / Docker Build Smoke`.
- Require linear history unless the team explicitly uses merge commits.
- Require CODEOWNERS review.
- Restrict who can push tags matching `v*`.

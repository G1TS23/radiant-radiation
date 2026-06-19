# Security Policy

## Supported versions

This is a single-page, client-side game served as a static site. Only the latest
deployed version (the `main` branch, live at
<https://radiant-radiation.netlify.app>) is supported.

## Scope

The game has **no backend, no accounts, and collects no personal data** — all
state lives in the browser's `localStorage`. The realistic surface area is
therefore client-side (e.g. a content-injection or build/dependency issue).
Security headers (CSP, `X-Frame-Options`, etc.) are defined in `netlify.toml`
and mirrored in `nginx.conf`.

## Reporting a vulnerability

Please **do not** open a public issue for security reports.

- Preferred: use GitHub's
  [private vulnerability reporting](https://github.com/G1TS23/radiant-radiation/security/advisories/new).
- Or email **olivier.falahi@gmail.com** with a description, steps to reproduce,
  and impact.

You can expect an acknowledgement within a few days. Thanks for helping keep the
project safe.

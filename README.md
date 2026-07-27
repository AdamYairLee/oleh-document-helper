# Oleh Document Helper

A multilingual, installable PWA starter for explaining Israeli public-administration procedures to new immigrants and returning residents.

## Included in this first build

- English, Hebrew, French, and Korean
- Automatic RTL layout for Hebrew
- Responsive desktop/mobile interface
- PWA manifest and offline service worker
- Search and category filters
- Device-local favorites
- Six starter procedure cards
- Official-source links and verification dates
- Document-upload UI with a clearly labelled demo result
- No user document is uploaded or sent in this build

## Starter procedure cards

1. Ministry of Aliyah and Integration personal account
2. Absorption Basket payments
3. Israeli ID card
4. Health fund registration
5. National Insurance services for new Olim
6. Israeli Employment Service registration

## Run locally

A local HTTP server is required because the app loads JSON with `fetch`.

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Deploy

This folder can be deployed directly to Cloudflare Pages, GitHub Pages, Netlify, or any static web host. No build command is required.

For a subfolder deployment, keep all paths relative as they are now.

## Important

This first version does **not** connect to the OpenAI API. The future API key must never be put in `app.js` or committed to GitHub. It should be stored as a server-side secret in a Cloudflare Worker or another backend.

## Data model

Procedure content is stored in `data/procedures.json`. Each procedure contains:

- stable ID and category
- government authority
- official URL
- verification date
- four language variants
- target audience
- required documents
- ordered steps
- important notes

## Legal and accuracy boundary

This is an independent information interface, not a government authority, law office, accounting office, or eligibility-decision service. Official authority information and applicable law always take priority.

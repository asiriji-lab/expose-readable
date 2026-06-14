# Schedool — Google Apps Script

This directory contains all Google Apps Script code for the Schedool input system. It is **not** part of the Next.js frontend or the Python backend — it is a separate deployment that runs inside Google Sheets and as a standalone Web App.

---

## Structure

```
appscript/
├── lib/
│   ├── parsers.gs      Field parsing helpers (timeslot, pipe syntax, class ranges)
│   └── validators.gs   Data + cross-sheet referential validation logic
├── template/
│   └── Code.gs         Sheet UI — slot picker sidebar, menu, on-edit triggers
└── Code.gs             Web App — HTTP entry point for frontend integration
```

---

## Three Deployments

### 1. Library (`lib/`)

Shared validation logic deployed as a GAS Library. Imported by both the Template script and the Web App.

- **Contains:** `parsers.gs` (field parsing) + `validators.gs` (cell-level and cross-sheet validation)
- **Library URL:** https://script.google.com/d/1nZoeOwH7Ti4DmthMiuyXQfU9NeqesgClUIiT2cLHrb2bdXIq8749wzMG/edit

To update: edit `lib/` files, copy into the Library project, deploy a new version, and bump the version number in the Template and Web App `appsscript.json` manifests.

---

### 2. Template (`template/Code.gs`)

Bound script attached to the Google Sheets input template. Handles the in-sheet user experience.

- **Contains:** Slot picker sidebar UI, sheet menu items, `onEdit` validation triggers
- **Template Sheet:** https://docs.google.com/spreadsheets/d/14hgR1XI-RgqPjc6pKhfdPxR7DbX8Gejrbl4P68PrOgE/edit

This script runs in the context of the spreadsheet. It calls the Library for validation and shows results as toast messages or sidebar panels.

---

### 3. Web App (`Code.gs`)

Standalone Web App that acts as an HTTP bridge between the Next.js frontend and the Google Sheets template.

- **Contains:** `doPost()` / `doGet()` handlers — receives requests from the frontend, triggers sheet operations, returns JSON responses
- **Web App URL:** https://script.google.com/macros/s/AKfycbwOFw_kDKTyoQ2GefpA-CoqTnLU9QafOcHkkMSeLfa0abIoFEJF9TqH8jKdtmvNgm3gLA/exec
- **Script Project:** https://script.google.com/d/1sgkuArvMlGc9CHRsOJUOiOVEcBDuUpXUyR9SLFNGGeuJoe3Iw2-3xok9/edit

The frontend calls this URL via `GOOGLE_APPS_SCRIPT_URL` env variable. Deploy as "Execute as: Me, Who has access: Anyone".

---

## How the Parts Relate

```
Google Sheets (input template)
  └── Template script (template/Code.gs)
        └── imports Library (lib/)

Next.js frontend
  └── POST GOOGLE_APPS_SCRIPT_URL
        └── Web App (Code.gs)
              └── imports Library (lib/)
```

---

## Deployment Checklist

When making changes:

1. **Library change** → deploy new Library version → update version in Template + Web App manifests
2. **Template change** → paste updated `template/Code.gs` into the bound script editor → save (no versioning needed for bound scripts)
3. **Web App change** → paste updated `Code.gs` into the Web App project → **Deploy → New deployment** (URL stays the same if you manage versions)

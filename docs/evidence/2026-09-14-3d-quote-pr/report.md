# Completed visit to 3D quotation: verification evidence

Verified locally on 2026-09-14 at `http://127.0.0.1:5176/admin?demo=1` using fictitious demo data and a controlled test-only catalog. No new functional, visual, or console issues were found in the completed workflow.

## Visit preload and embedded configurator

The completed visit is selected with its known customer fields and available measurements already populated. The same visit launches the embedded configurator without re-entering those values.

![Completed visit and measurements preloaded](screenshots/02c-visit-selected-viewport.png)

![Saved 3D configuration embedded in the quotation flow](screenshots/03c-embedded-configurator.png)

## Controlled quotation totals and saved versions

The first version contains one controlled module and one service. The second version preserves the module and changes the service quantity to two; the server-controlled subtotal, IVA, and total update reproducibly.

![Version 1 controlled line items and totals](screenshots/04-v1-controlled-totals.png)

![Version 1 associated with the visit](screenshots/05-v1-saved-associated.png)

![Version 2 controlled line items and totals](screenshots/06-v2-controlled-totals.png)

![Version 2 associated with the same visit](screenshots/07-v2-saved-associated.png)

## Exact-version reopening

An unsaved service change was made after saving V2. Reopening V2 restored the saved quantity and totals, demonstrating that the exact stored configuration/version—not the transient form state—was loaded.

![Unsaved change before reopening V2](screenshots/08-before-reopen-unsaved-change.png)

![Saved V2 restored after reopening](screenshots/09-after-reopen-restored-v2.png)

## Customer, visit, status, and version visibility

Both immutable versions remain visible under the same fictitious customer and visit with their current quotation status.

![V1 and V2 listed under the customer](screenshots/10-quote-versions-list.png)

## Native two-page PDF

The saved V2 PDF was generated locally without ConvertAPI. Page 1 contains the customer, visit, controlled line items, totals, version, and saved-configuration hash. Page 2 contains useful views exported from that saved 3D configuration.

![Native quotation PDF page 1](screenshots/11-pdf-v2-1.png)

![Native quotation PDF page 2 with saved 3D views](screenshots/11-pdf-v2-2.png)

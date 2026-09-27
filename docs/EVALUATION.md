# Evaluation plan

The goal is a number I can defend, not a demo that looks good on one invoice.

## Data set

- 30 or more invoices/receipts, mixed: clean PDFs, phone photos, skewed or dim scans, and at
  least a few with handwriting or stamps.
- Personal or business details are blanked out before they go in the repository.
- Each document has a hand-written label file: `labels/<name>.json` with the fields the app extracts
  (vendor, invoice number, date, currency, subtotal, tax, total, line items).
- Do not fabricate documents and describe them as real. Synthetic invoices are fine if labelled as such.

## Metrics

- **Field accuracy**: exact match per field (numbers compared to the cent, dates exact, vendor
  compared case- and punctuation-insensitively).
- **Document accuracy**: every field correct.
- **Check effectiveness**: of the documents with at least one wrong field, how many did the
  arithmetic/completeness checks flag for review? Unflagged errors are the ones that reach the
  books, so this is the number that matters most.
- **Review rate**: share of documents flagged (a human touches these).

## Procedure

1. Run every document through the same pipeline used in production.
2. Compare to the labels with a script in `backend/eval/` (to be written).
3. Report results with the model name, date, and prompt version.

## Results

_Not run yet. This table is filled in only from a real run._

| Field | Accuracy |
|---|---|
| vendor | – |
| invoice number | – |
| date | – |
| total | – |
| line items | – |

| Metric | Value |
|---|---|
| Documents fully correct | – |
| Wrong documents flagged by checks | – |
| Review rate | – |

# Ossie documents and an existing semantic layer

## The model as an Ossie document

Datum stores a product's model as one **Apache Ossie** document (spec
`0.2.0.dev0`) holding exactly one `semantic_model`:

| Ossie | The model |
|---|---|
| `datasets[].source` | `table` (`database.table`); `tool:<name>` for a Space tool |
| `datasets[].fields[]` | `name`, `expression.dialects[ANSI_SQL]` = **the column**, `datatype`, `dimension.is_time`, `description`, `ai_context.synonyms` |
| `relationships[]` | `from`, `to`, `from_columns`, `to_columns` |
| `metrics[]` | `name`, `expression` (the metric grammar), `description`, synonyms |
| `ai_context` of the model | `instructions`, `examples` |
| `custom_extensions` with `vendor_name: "DATUM"` (a JSON string in `data`) | the model: `source`, `fieldSets`, shared dimensions; a dataset: `requiredFilters`; a field or metric: `title`, `format` |

- **Export:** **Export Ossie** on the product's page, or `datum data-products
  ossie list <slug>` — the published version (the draft when nothing is
  published); `--version-number 0` is the draft, `N` version N. This is how
  you get the current model into a run: ask the owner for the export.
- **Import:** **Import Ossie**, or `datum data-products draft ossie set <slug>
  --document '…'` — it **replaces the draft** and is validated like any
  draft. The document is JSON (newer deployments also take YAML; where an import
  refuses YAML, convert the document to JSON).
- A document **without** the DATUM extension imports with defaults: titles
  from names, the product's own source and **no field sets** — so nobody
  sees anything until you add them.
- A field reads **one column**: an expression such as `CAST(x AS DOUBLE)` is
  refused — a computed value is a metric. Only the `ANSI_SQL` dialect is read.

## Using a semantic layer the space already has

Teams often keep a hand-made description of their sources — an Ossie
document per table, a dbt or LookML project, a data catalog: what each
column means, synonyms, sample values, warnings, the real join keys. Use it;
it is the most valuable input you can get. But do not load it as the product:

1. **Do not import a physical description as the model.** It has hundreds of
   fields, no metrics, no field sets, field names equal to column names (so
   `id` and `name` collide across tables) and no required filters. Pick the
   tables and fields the owner's business questions need, give members
   prefixed names, write the metrics and the sets.
2. **Carry over the descriptions, synonyms and warnings** — into the fields'
   `description` / `synonyms` and into the product's `instructions` (for
   example "`provider_id` is not the CRM key — join on `crm_deal_id`").
3. **Check every join against Datum's rule:** the `to` side has a
   `primaryKey`, and `toColumns` are that key. A join on a column that is not
   the target's key works only when that column is unique — then make it the
   dataset's `primaryKey`; when it is not unique the join multiplies rows, so
   leave it out.
4. **Types come from the catalog, not from the description.** A layer often
   types a number column as `String` because the lake stores it as text —
   then sums and comparisons will not work there.
5. **Partitions** are rarely described: take the partition keys from the
   catalog and put one under `requiredFilters`.
6. **Ownership decides, not the description:** a table described in the
   layer still needs the space's `own` entry in the data scope (a joined
   dictionary table: `join`, where the deployment offers it).
7. **Two databases in one product** are fine when the space owns (or may
   join) both tables; there is no join across products — two products meet
   only on a shared dimension both link.

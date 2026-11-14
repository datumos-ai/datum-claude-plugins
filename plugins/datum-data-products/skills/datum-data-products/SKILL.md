---
name: datum-data-products
description: "Groundwork for a Datum data product on lake tables, whatever the data — find the AWS namespace that holds the tables, the space that owns them in the namespace's data scope (or the org admin request for it), the space's lake credential, the real columns, types and partitions from the Glue catalog, and an existing description of the data (knowledge bases, other data products, Ossie/Cube/dbt/LookML models, the producing pipeline, the owning team) instead of guessing meanings; plus the pitfalls data lakes share (numbers stored as text, partitions, snapshot vs history tables, duplicates and late data, join keys that are not a primary key, PII). Load it together with the `data-products` skill whenever a data product stands on lake tables — \"zrób produkt danych na tabelach X\", \"kto jest właścicielem tabeli\", \"skąd wziąć opis kolumn\", \"czy ten join jest dobry\", \"build a data product on table X\"."
version: 2.0.0
---

# Data products on lake tables — the groundwork

The general flow (model, metrics, field sets, policies, control questions,
publishing) is the **`data-products` skill of the `datum` plugin** — follow
it. This skill covers what comes before and around the model when the source
is the data lake: where the tables live, who owns them, where their meaning
is written down, and what usually goes wrong.

Nothing here assumes a particular area of data. Discover the facts for the
tables at hand; never carry them over from another area or another product.

## 1. The namespace that holds the tables

Lake access in Datum goes through an **AWS namespace** (usually one per team
or system). Find the one for the tables:

```bash
datum namespaces list --raw --full | jq -c '.namespaces[] | {id, systemIds}'   # can be hundreds; match on id
datum namespaces get <id>
datum namespaces systems get <systemId>        # which namespaces a system lives in
```

Ask the person when the data maps to several namespaces — the producing team
knows which account holds the Glue databases.

## 2. Ownership — the data scope

A product can be built only on tables its space **owns** in the namespace's
data scope; a table has at most one owner space, so a number has one
definition. Dictionary tables may come through a `join` entry (joined
dataset only, never the main one, no metrics on it).

```bash
datum namespaces data-scope list <namespace>          # who owns / reads what
datum namespaces data-scope tables list <namespace>   # tables of a database the space owns
```

- **No entry for the space** = a request to an **org admin**
  (`datum namespaces data-scope <namespace> --space-id <id> --entry <db>.* --access own`),
  agreed with the team that produces the data — never a workaround through
  another space's tables.
- **Another space already owns the table** = the product belongs there; ask
  for access to *its* product (`datum data-products access-requests`)
  instead of building a second definition of the same number.
- A `checkError` on an entry (e.g. AccessDenied on Glue) means the
  namespace's role cannot read the catalog: column checks are skipped and a
  wrong column shows only when a control question runs. Tell the org admin.

## 3. The credential

A lake product reads with the owner space's **`aws-role` credential**
(minted by its satellite), or with the Cube's own lake role when none is
picked. The role must read **every** table of the model, joined dictionaries
included.

```bash
datum credentials list --space <space>     # look for type aws-role
```

## 4. Columns, types, partitions — from the catalog

The catalog is the only truth for names, types and partition keys:

```bash
datum namespaces data-scope columns list <namespace> --table <db>.<table>
# or, with the namespace's AWS profile:
aws glue get-table --database <db> --name <table>    # Columns + PartitionKeys
```

Documentation, semantic-layer files and old SQL are not — they lag behind.

## 5. What the data means — look before you write

Meanings, grain, real join keys and warnings are usually written down
somewhere. Look, in this order, and say which source you used:

1. **The space's knowledge bases** — `search_knowledge` (datum plugin) with
   the table names.
2. **Existing data products** — `datum data-products list --space <space>`,
   then `datum data-products ossie list <slug>`: reuse their field names,
   descriptions and metric definitions.
3. **Semantic layers and BI models in the organisation's repositories** —
   Ossie (`*.ossie.yaml`), Cube (`cubes:` YAML), dbt (`schema.yml`), LookML:
   `gh search code --owner <github-org> "<table name>"`. Ossie documents
   carry `ai_context.instructions`, `synonyms` and `sample_values`; dbt and
   Cube carry column descriptions and tested keys.
4. **The producing pipeline** — the job that writes the table (Glue, Spark,
   Airflow, Step Functions, …) states the grain and how the table is
   refreshed.
5. **The owning team** — when nothing above answers, ask; never guess a
   grain or a key.

## 6. Carrying a description into a product

1. **Never import a physical description as the model.** Semantic-layer
   files describe tables: hundreds of fields, no field sets, column names
   that collide (`id`, `name`, `status`), no required filters. Pick what the
   business questions need, prefix the names, write the metrics and sets.
   (`datum data-products draft ossie set` imports an Ossie document as a
   draft — trim it before you save, see the `data-products` skill's
   `references/ossie.md`.)
2. **Carry meanings, synonyms and warnings** into the fields'
   `description`/`synonyms` and the product's `instructions` (e.g. "X is not
   a key to Y; join on …"). Add the synonyms people actually use, in their
   language.
3. **Check every join against Datum's rule:** the "one" side has a
   `primaryKey` and `toColumns` are exactly that key. A join on a column
   that is not unique on the "one" side multiplies rows — verify uniqueness
   with a query (`COUNT(*)` vs `COUNT(DISTINCT key)`) before declaring it.
4. **Sample values** from a description or a quick `SELECT DISTINCT` make
   filters and control questions concrete.

## 7. Pitfalls data lakes share

Check each one against the catalog:

- **Numbers and dates stored as text.** Text columns allow only `COUNT`,
  `COUNT(DISTINCT …)` and equality filters (a month via `contains`). When a
  sum or a range is needed, ask the producing team for a typed column or a
  view — never promise a `SUM` on text.
- **Partitions.** Event and history tables are usually partitioned (often
  `year`/`month`/`day` or `dt`, frequently as text). The partition key goes
  to the required filters and to `Base`; control and example questions
  bound it.
- **Snapshot vs history.** A snapshot table holds the current state (counts
  are "as of today"); a history table appends a row per day or per change.
  Say which in `instructions` — a snapshot cannot answer "how many were
  active in March".
- **Duplicates and late data.** Event tables may hold retries or late rows;
  ask whether a distinct key exists and when a day is complete before
  writing control questions on yesterday.
- **PII.** Person-level columns (e-mail, login, IP, user ids) go to a
  `sensitive` field set or out of the model; the data scope's sensitive
  count is a hint, not a guarantee.
- **Joins across areas.** Tables of two databases or teams in one product
  need both owned by the product's space (or a dictionary through `join`) —
  otherwise it is two products.

## What to hand back (in addition to the `data-products` skill's list)

- the namespace, the owner space and the credential used — or the exact
  request to the org admin;
- which description of the data you relied on and what was confirmed
  against the catalog;
- the pitfalls found in these tables and how the model handles them.

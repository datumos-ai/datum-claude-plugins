---
name: data-products
description: "Build or fix a Datum DATA PRODUCT with its owner — governed metrics and fields over lake tables or a Space tool: the source and table ownership, the model (datasets, joins, fields, the metric grammar, field sets, required filters), saving the draft, control questions, access policies (who sees which fields and rows), consumer limits, and what a validation problem means. Load it whenever someone wants to share numbers with other spaces, design a data product or a semantic model, write a metric, decide who sees what, or a draft was refused (invalid_model, filter_required, member_not_available, a percent that reads 0.31 %), or says produkt danych, model semantyczny, metryka, kto widzi jakie dane, even when nobody names the skill."
---

# Data products — from the owner's questions to a reviewed draft

A data product is a **described and guarded set of numbers** one space owns:
metrics and fields over tables of the lake or over the rows of one of the
space's tools. People in other spaces ask the agent about it or put it on a
dashboard and get **the same number every time, cut to what they may see**.
Everything below serves two things: the number is right, and "who sees what"
has a clear answer.

You are the data owner's partner (an admin of the owner space): you design
the model, save it as a **draft**, read the validation problems and fix them,
and propose control questions and policies. **You never publish** — publishing
and certifying are a person's acts.

`<base>` below is this skill's directory (where this SKILL.md lives).

## Where you work, and what you cannot see

- **In a Datum run** you work through the data-product tools:
  `data_product_save_draft` saves a draft, `data_products_list` /
  `data_product_describe` / `data_product_query` read what the person of the
  turn may use. They exist only in a turn a PERSON wrote — a routine, a
  webhook or a flow step has none: then prepare the model as JSON for the
  owner to save. A space run's own key is refused on every
  `datum data-products …` and `datum namespaces data-scope …` call — do not
  try the CLI there.
- **No tool reads a draft back.** Keep the whole model you saved in the
  conversation. For an existing product ask the owner for its Ossie export
  (**Export Ossie** on the product's page, JSON) and start from that — never
  rebuild a model from `data_product_describe`, which shows only the
  published members a person may use.
- **Column names, types and partition keys come from the lake's catalog.**
  When the run has the namespace's AWS profile, read them yourself
  (`aws glue get-table --database <db> --name <table>`: `Columns` and
  `PartitionKeys`) — the data scope narrows it to the space's tables.
  Otherwise ask the owner: the column picker on the product's page lists
  them, partition keys last.
- **Outside a run** — a person signed in to the `datum` CLI — every step has a
  command (`datum data-products …`, below). Object flags take inline JSON; a
  whole body reads best from a file:
  `datum data-products draft set <slug> --data @draft.json` with
  `{"model": {…}}` in the file.

## Before the first draft: three questions that save an hour

1. **Which business questions must the product answer?** Collect 3–6 real
   ones ("won revenue per region this quarter", "orders shipped yesterday per
   store"). They give the metrics, the fields to group and filter by, and the
   `examples` of the model.
2. **What is one row (the grain) of the main table?** A product has one main
   dataset (the facts) that joins reach the others from. `COUNT(*)` counts its
   rows — a wrong grain is a wrong number.
3. **How does the owner know the number is right?** A report in the source
   system, a list view, a spreadsheet total. Those become control questions.

When the person does not know, propose an answer from the tables and ask them
to confirm — never guess the grain or where an expected number comes from.

## 1. The source

The kind of source is chosen when the product is created (**New product** in
Settings → Data products, or `datum data-products create --source-kind
lake|space-tool`) and never changes.

| | Lake table (`lake`) | Space tool (`space-tool`) |
|---|---|---|
| Who runs the query | the organisation's Cube | Datum: calls the tool, cuts the rows to the person's access, aggregates |
| Ownership | every table is **owned** by the product's space in the namespace's data scope | the tool belongs to the product's space |
| Datasets | 1–40, with joins | exactly **one**, `table: ""`, no joins |
| Required filters | yes, for partitioned tables | never |

**Lake** — check before you write the model:

- The space must **own** each table (`own` in the namespace's data scope —
  an org admin sets it). A table has at most one owner; `read` is raw access
  and does not count. (When the data scope offers a `join` entry —
  a newer platform feature — a joined dictionary table, never the main one, may carry
  it instead of `own`; no metric reads such a table.)
- Take column names, **types** and **partition keys** from the catalog, not
  from documentation. Many lake columns that hold numbers are text: a
  `number` or `time` field on a text column saves with a warning, but the
  engine refuses its sums, comparisons and date ranges. A field reads one
  column as it is — no `CAST`, no expression — so on text only `COUNT(*)`,
  `COUNT(DISTINCT …)` and equality filters work; ask the table's owner for a
  typed column (or a view) when a sum is needed.

**Space tool** — the tool must be the owner space's, **published**, effect
`read`, with **static** credential slots only (a tool that calls an API as
the person using it cannot be a source: access comes from the product's
policies alone). It returns **raw rows** — an array of objects, or one under
`rows` / `data` / `results` — with **every column the model declares in
every row** (`null` is fine, a missing key is not), at most 50 000 rows. It
never filters per person and never aggregates: Datum does both after
cutting the rows. Fixed arguments go into `source.args`.

## 2. The model

Read **`<base>/references/model.md`** before the first save — the whole
shape, the limits, two worked examples and a checklist. The rules people
break most:

- **Member names** (fields and metrics) are unique **across the product**:
  `^[a-z][a-z0-9_]{0,62}$`. With joins, `id`, `name` and `status` collide —
  prefix them by meaning: `order_id`, `store_name`, `order_status`.
- **`name` is what queries, field sets and policies use; `column` is the
  physical column** (or the key in the tool's rows). A field `order_owner`
  may read the column `owner`.
- **A field belongs to the dataset that has its column.** Data of another
  table comes through a join, never by adding the field to the wrong one.
- **A relationship is many-to-one:** `from` is the many side (facts), `to`
  the one side (a dimension), which **needs a `primaryKey`** — `toColumns`
  are exactly that key's columns, `fromColumns` pair with them one to one.
  Every dataset is reached from one main dataset; no cycles; one
  relationship per pair.
- **Required filters:** a partitioned table lists at least one of its
  partition keys (as a field of that dataset) under `requiredFilters`, and
  every required filter is in the field set `Base`. A query bounds one with
  a value, a list, or a range with **both** ends — policy rules never count.
  **A query always reads the main dataset** and every dataset on the join
  path to what it names: when the main table is partitioned, even a question
  about a joined table alone (`COUNT(DISTINCT customer_id)` of `customer`)
  must bound the main table's partition. The same holds for control
  questions and the example questions in `instructions`.
- **People ask for metrics; fields group and filter.** A query computes only
  the metrics the model defines — a number field in a set lets people group
  and filter by it, never sum it. Every number someone needs is a metric.
- **Field sets:** `Base` (spelled exactly so) comes with every grant; other
  sets (e.g. `Revenue`, `Margin` — mark money `sensitive: true`) are granted
  by policies and limits. A member is in **at most one** set, and a member in
  **no set reaches nobody** — the usual reason "the field is not there".
- **`instructions` and `examples`** are read by the consumers' agent: what to
  prefer, what a number does not include, when to ask back; up to 20 real
  questions from step 1 (the first ten are shown).

## 3. Metrics — the grammar is strict

```
aggregate   SUM|MIN|MAX|AVG|COUNT(<expr>) [FILTER (WHERE <cond> [AND <cond>…])]
            COUNT(*) [FILTER (…)]        COUNT(DISTINCT <field>)
ratio       [<number> *] <operand> / NULLIF(<operand>, 0)
            [<number> *] {<metric>} / {<metric>}
difference  <operand> - <operand>          <operand> = {<metric>} | an aggregate
<expr>      a field, or arithmetic over fields and numbers: + - * / ( )
<cond>      <boolean field> | NOT <boolean field> | <field> <cmp> <literal>   (= != > >= < <=)
```

- Expressions use **member names**, never columns; another metric is `{name}`.
- The aggregates of one metric read fields of **one dataset**. A number from
  two tables is a metric in each, combined as a ratio or difference of
  `{metrics}`.
- An aggregate denominator is wrapped in `NULLIF(…, 0)`; a ratio of two
  `{metrics}` is guarded for you.
- **`percent` multiplies nothing** — the value must already be in percent:
  `100 * COUNT(*) FILTER (WHERE is_won) / NULLIF(COUNT(*) FILTER (WHERE is_closed), 0)`.
  Without `100 *` the draft saves with a warning and 31 % reads 0.31 %.
- A time field compares with an ISO date (`close_date >= '2026-01-01'`); a
  text field takes only `=` and `!=`; `SUM`/`AVG`/`MIN`/`MAX` take numbers.
- Anything else (`CASE`, `COALESCE`, `CAST`, date functions, `OR` inside
  `FILTER`) is an error — split it into metrics or ask for a column.

## 4. Save the draft and read the answer

- **In a run:** `data_product_save_draft(product, model)` — `model` is the
  **whole** normalized model and **replaces** the draft. It works only when
  the author of the turn is an admin of the owner space and the product
  already exists (a person creates it with **New product**).
- **CLI:** `datum data-products draft set <slug>` (`PUT
  /api/data-products/{slug}/draft`); `draft list` shows the draft with its
  warnings, `draft diff list` what publishing would change, `draft check`
  runs the control questions on the draft.
- A refusal is `invalid_model` with every problem and its path
  (`datasets[1].fields[3].column`, `relationships[0].toColumns`,
  `metrics[2].expression`): fix **all** of them and save the whole model
  again. **Warnings** never block a save — read every one and tell the owner:
  "is text in the catalog" means queries on that field will fail, "could not
  be checked against the catalog" means a wrong table or column shows only
  when a control question runs.
- Message → cause → fix: **`<base>/references/troubleshooting.md`**.

## 5. Control questions

A query with **one metric, no dimensions** (filters and a date range are
fine, no granularity), a **known answer from the source system** and where
that number comes from. The body (the invoices product of `model.md`):

```json
{
  "title": "Unpaid amount, March 2026, region North",
  "query": {
    "measures": ["unpaid_amount"],
    "timeDimensions": [{ "dimension": "due_date", "dateRange": ["2026-03-01", "2026-03-31"] }],
    "filters": [{ "member": "region", "operator": "equals", "values": ["North"] }]
  },
  "expected": "48210300",
  "toleranceKind": "pct",
  "toleranceValue": "0.5",
  "expectedFrom": "Billing report \"Open items\", March 2026, North"
}
```

`datum data-products control-questions <slug> --data @question.json` adds
it (or the flags `--title`, `--query`, `--expected`, …).

- `expected` and `toleranceValue` are **strings** holding a plain number,
  and a filter's `values` are strings too — a JSON number is refused.
- `pct` is **percent** of the expected value (`0.5` = 0.5 %); `abs` an
  absolute difference; `exact` (the default) equal at the precision written.
- On a product with required filters the question **must bound them** —
  including the main table's partition when the metric reads a joined table.
- They run before every publish (one outside its tolerance blocks it) and
  nightly. **Never invent the expected number**: without one from the
  source, leave the question as a TODO saying where to get it. In a run you
  propose them; the owner adds them on the product's page or with the CLI.

## 6. Who sees what

Policies, conditions, row rules and limits in JSON: **`<base>/references/access.md`**.
The rules that are easy to break:

- Policies are read **top to bottom; the first one whose WHO fits decides**,
  none fitting = no access — the owner space's own members included. Narrow
  ones first, the widest ("everyone else: Base") last.
- **A WHO on an attribute the person lacks simply does not fit** — they go
  on to the next, usually wider, policy (someone without `crm_user` gets
  "everyone else"). Never promise that a missing attribute blocks a wider
  grant: put people without it in a policy of their own when they must get
  less. A **stale** value in WHO denies.
- **A row rule's missing or stale attribute denies** — once a policy is
  chosen, the person never falls through to the next one.
- A row rule compares a field with **fixed values**, the **person's own
  attribute** (`{"from": "person", "attribute": …}`) or that attribute of
  **everyone in a relation** of the person (`{"from": "relation", …}`). "Mine
  and my team's" is two rules in one `any` group. **An attribute's name typed
  as a fixed value** (`{"from": "literal", "values": ["crm_user"]}`) compares
  the field with the text "crm_user" and silently returns nothing.
- A consumer space's limit (set when its request is approved) takes fixed
  values only and cuts whatever the policy gives.
- Check the effect: **Test as a person** on the product's **Access** tab
  (`datum data-products test-access`, `preview`) — both are audited.

## 7. Publishing and the certificate — a person's acts

**Review and publish** on the product's page (`/settings/dataproducts/<slug>`)
shows the diff, runs the control questions, and refuses while the model has a
problem, a policy or a limit filters on a field the draft no longer has, or a
control question is off. A new version starts *Not certified*; a certifier of
the owner space who is **not the version's author** signs it.

## A semantic layer the space already has

If this space has a skill or documents describing the semantic layer of its
sources (column meanings, the real join keys, warnings), use it — and still
check types, partitions and ownership against the catalog and the data
scope. Importing an Ossie document, and what not to import as it is:
**`<base>/references/ossie.md`**.

## What you hand back

Short and concrete:

1. what you saved (datasets, metrics, field sets, required filters) — or why
   the save failed and what has to happen;
2. the warnings that are left;
3. the proposed control questions (with the place of the expected number)
   and policies, in order;
4. what others must do (the org admin: table ownership, a person attribute;
   the table's owner: a typed column) and who publishes.

# Message → cause → fix

A refused save (`invalid_model`) lists every problem with a `path` into the
model. Fix all of them and save the whole model again. The quoted text is a
fragment of what Datum says — the rest of the message names your fields.

## The shape

| Message (fragment) | Cause | Fix |
|---|---|---|
| `Unrecognized key` | a key the model does not have — often a Cube- or dbt-style model (`cubes`, `measures`, `dimensions`, `sql`) | rewrite it in Datum's shape (`model.md`): `datasets` with `fields`, top-level `metrics`, `fieldSets` |
| `expected array, received undefined` | a required key is missing (`datasets`, `fields`) | add it |
| `Invalid discriminator value` at `source.kind` | `kind` is not `lake` or `space-tool` | `{ "kind": "lake", "namespaceId": … }` or `{ "kind": "space-tool", "tool": …, "args": {} }` |
| `the kind of source is chosen when the product is created` | the model's source kind differs from the product's | keep the product's kind; a new kind is a new product |

## Names, fields and field sets

| Message (fragment) | Cause | Fix |
|---|---|---|
| `member names are unique across the product` | a name used twice (`id`, `name` in two tables) | prefix by meaning: `order_id`, `store_name` |
| `a member name is a lower-case letter` | capitals, dashes or a leading digit | `^[a-z][a-z0-9_]{0,62}$` |
| `there is no field or metric named` | a field set lists a typo or a removed member | fix the member |
| `a member belongs to one set` | the member is in two sets | keep it in one |
| `the set every grant includes is spelled` | `base`, `BASE` | exactly `Base` |
| `is not an approved shared dimension` | a `sharedDimension` key nobody approved | an org admin approves it, or drop the link |

## Tables, joins and ownership

| Message (fragment) | Cause | Fix |
|---|---|---|
| `is not a table reference — name it as database.table, lower case` | capitals or no dot | `database.table` in lower case |
| `has no owner space in this namespace` | nobody owns the table | the org admin gives the space `own` in the namespace's data scope (`read` does not count) |
| `is owned by another space` | another space is the table's owner | build the product in that space, or ask the org admin |
| `the lake's catalog has no table` | a wrong database or table name | check the name in the catalog |
| `needs a primary key to be the one side of a relationship` | no `primaryKey` on the `to` dataset | add its physical key columns |
| `the one side is joined on its primary key` | `toColumns` are not the key (a typo such as `ie` for `id`, or a non-key column) | `toColumns` = the `primaryKey` columns |
| `the keys pair up one to one` | different numbers of `fromColumns` and `toColumns` | pair them |
| `every dataset is reached from one main dataset through relationships` | a dataset no relationship reaches | join it, or drop it |
| `the relationships form a cycle` | joins run in a circle | joins run from the many side to the one side — drop or turn one |
| `one relationship per pair of datasets` | two joins between the same two datasets | keep one |

## Required filters

| Message (fragment) | Cause | Fix |
|---|---|---|
| `is partitioned by` | a partitioned table without one of its partition keys under `requiredFilters` | add the key's field to `requiredFilters` (and to `Base`) |
| `a filter every query needs has to be a field everybody with access may use` | a required filter outside `Base` | move it into `Base` |
| `a required filter is a field of this one` | the filter names a field of another dataset | list it under that dataset |
| `a required filter of the wrong type can never be satisfied` | the field's type is not the column's | make the field the catalog's type |
| `a Space-tool dataset has no required filters` | lake features on a Space-tool product | remove them |

## Metrics

| Message (fragment) | Cause | Fix |
|---|---|---|
| `expected an aggregate (SUM, MIN, MAX, AVG, COUNT) or a {metric}` | the expression starts with something else (`CASE`, `COALESCE`, a bare field) | an aggregate, a ratio or a difference |
| `is not part of the metric grammar` | a character the grammar does not know (`%`, `\|\|`, `;`) | rewrite within the grammar |
| `conditions of a FILTER are joined with AND only` | `OR` inside `FILTER` | two metrics, or a ratio / difference of them |
| `a ratio of an aggregate guards its denominator` | `SUM(a) / SUM(b)` | `SUM(a) / NULLIF(SUM(b), 0)` |
| `a ratio guards a zero denominator — write NULLIF(<operand>, 0)` | `NULLIF(…, 1)` or another guard | `NULLIF(…, 0)` |
| `define one metric per dataset and combine them with {metric}` | one metric's aggregates read two datasets | a metric per dataset, then `{a} / {b}` or `{a} - {b}` |
| `is a metric — refer to it as {` | a metric named like a field | `{name}` |
| `there is no field named` | a column name or a typo instead of a member name | the member name |
| `needs a number` | `SUM`/`AVG`/`MIN`/`MAX` over a text, true/false or time field | a number field; on a text column ask for a typed column |
| `a bare condition needs a true/false field` | `FILTER (WHERE status)` on a text field | `status = 'WON'` |
| `compare it with an ISO date such as` | a time field compared with a number or free text | `close_date >= '2026-01-01'` |
| `only = and != apply` | `>`/`<` on a text or true/false field | equality, or a number field |
| `DISTINCT is only COUNT(DISTINCT <field>)` | `SUM(DISTINCT …)` | `COUNT(DISTINCT …)` |
| `an aggregate cannot sit inside another aggregate` | `SUM(COUNT(*))` | a ratio or difference of metrics |
| `the metric refers to itself through` | `{a}` uses `{b}` that uses `{a}` | untangle them |
| `a metric that only repeats another metric is not a definition` | `{other}` alone | define it, or use the other metric |

## Space-tool sources

| Message (fragment) | Cause | Fix |
|---|---|---|
| `a Space-tool product has exactly one dataset` / `a Space-tool dataset has no table` / `a Space-tool product has one dataset and no relationships` | lake features on a tool product | one dataset, `table: ""`, no relationships |
| `has no published version` | the tool is a draft | publish the tool |
| `writes — a product's source is a read tool` | effect `write` | a read tool |
| `calls an API as the person using it` | a delegated (per-person) credential slot | static slots only — access comes from the policies |
| `returned rows that do not match the columns its model declares` (the owner sees `returned rows without the column` with the column's name) | a declared column missing from a row, or a value of the wrong type | fix `column` in the model, or make the tool return every key (`null` is fine) |
| `more than Datum aggregates in one query` | more than 50 000 rows | narrow what the tool returns (`source.args`) |

## Warnings — saved, but read them

| Warning (fragment) | Means |
|---|---|
| `is shown as a percent, but a ratio without a scale gives a fraction` | `percent` without `100 *` — 31 % would read 0.31 %; write `100 * … / …` |
| `could not be checked against the catalog` | the catalog was out of reach; a wrong table or column shows when a control question runs |
| `lists no column` | a typo in `column`, `primaryKey` or `fromColumns` |
| `is text in the catalog` | sums, comparisons and date ranges on that field will be refused — make it `string` or ask for a typed column |
| `(the engine refused it)` / `(the engine refused the join)` | the engine rejected a column or a join — blocks publishing |

## Queries and control questions

| Code / message (fragment) | Means | What to do |
|---|---|---|
| `filter_required` — `needs a filter on` | the query reads a table with required filters and does not bound one — remember the main table is always read | a value, a list, or a range with BOTH ends |
| `member_not_available` — `Not available to you in` | a member outside the asker's access | check policies and the limit; never estimate the number from other fields |
| `query_invalid` — `has no field or metric named` | a name the product does not have | take names from `data_product_describe` |
| `is a field, not a metric — put it in dimensions` | a field asked for as a number (a sum of `amount` with no metric for it) | the owner defines the metric (`SUM(amount)`); people ask for metrics |
| `shared_session` | the access depends on the person and the conversation is shared | a private conversation |
| `person_required` / `person_in_person_required` | an API key, or "Sign in as" | the person signs in themselves (`datum login`) |
| `a control question computes exactly one metric` / `a control question has no dimensions` | more than one measure, or dimensions | one metric, no dimensions |
| `a control question filters by a date range and does not group by time` | a `granularity` in the question | only `dateRange` |
| `expected is a plain number` | `"TODO"`, a unit or a thousands separator in `expected` | a plain number from the source |
| `expected string, received number` | `expected`, `toleranceValue` or a filter's `values` written as JSON numbers | strings: `"expected": "48210300"`, `"toleranceValue": "0.5"` |
| a control question is off its tolerance | the model counts differently from the source | look for the difference in metric filters, the grain and joins (fan-out!) — or the source changed |

**Join fan-out:** a `SUM` over the fact table is safe on a many-to-one join
to a dimension. When the "dimension" has several rows per key (the key is not
unique), sums grow — its `primaryKey` is false.

## Policies and limits

| Message (fragment) | Cause | Fix |
|---|---|---|
| `Invalid input` at `rows` | a row rule's `value.from` is not `literal`, `person` or `relation` (e.g. `"attribute"`), or a misspelled key | `{ "from": "person", "attribute": … }` |
| `the organisation has no person attribute` / `the organisation has no relation` | a key the organisation did not define | the key from `datum person-attributes list` |
| `is a relation between people — name it as the relation` | a relation used as a person attribute | `{ "from": "relation", "relation": …, "attribute": … }` |
| `is a metric — a row rule filters on a field` | a rule on a metric | a field |
| `the model has no field set named` | a set the model does not have | fix the set's name |
| `a comparison takes exactly one value` | `gt`/`lt` with several values | one value |
| `a limit holds for everyone in the space — its rules take fixed values only` | a person or relation value in a limit | fixed values; per-person rows belong to policies |
| `"in the last" rule takes a number and a unit` | `inLast` without `["12", "month"]` | a count and day / week / month / year |

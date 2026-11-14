# The product model — the whole shape, limits and examples

The normalized model is what `data_product_save_draft` takes as `model`,
what the `--model` flag of `datum data-products draft set` takes (the body
of `PUT /api/data-products/{slug}/draft` is `{ "model": … }`), and what a
space manifest carries under `dataProducts[].model`.
Every save **replaces the whole draft** — send the complete model, never a
patch. Keys marked `?` have defaults; any key not listed here is refused.

## Contents
1. The shape
2. Limits and name patterns
3. Example: a lake product, two tables, a partitioned main table
4. Example: a Space-tool product
5. Checklist before saving

## 1. The shape

```jsonc
{
  "source": { "kind": "lake", "namespaceId": "dl-main" },
         // or { "kind": "space-tool", "tool": "billing_invoices", "args": { "year": 2026 } }
  "datasets": [{
    "name": "ticket",                  // ^[a-z][a-z0-9_]{0,40}$ — the name inside the model
    "table": "support.tickets",        // lake: database.table, lower case; space-tool: ""
    "primaryKey?": ["id"],             // PHYSICAL columns; required on the one side of a relationship
    "description?": "One row = one support ticket on its partition day",  // the grain!
    "fields": [{
      "name": "ticket_id",             // member name — unique across the WHOLE product
      "column": "id",                  // the physical column / the key in the tool's rows; no expressions
      "type": "string",                // string | number | boolean | time
      "title": "Ticket",               // what people see
      "description?": "…",
      "synonyms?": ["case"],
      "sharedDimension?": "customer"   // the key of an APPROVED shared dimension
    }],
    "requiredFilters?": ["day"]        // member names of THIS dataset; each must be in Base
  }],
  "relationships?": [{
    "name": "ticket_agent",
    "from": "ticket",                  // the MANY side
    "to": "agent",                     // the ONE side — needs a primaryKey
    "fromColumns": ["agent_id"],       // physical columns of the many side
    "toColumns": ["id"]                // = the one side's primaryKey columns, paired one to one
  }],
  "metrics?": [{
    "name": "ticket_count",
    "title": "Tickets",
    "description?": "…",
    "synonyms?": [],
    "expression": "COUNT(*)",          // the metric grammar, over member names
    "format?": "integer"               // number (default) | integer | currency | percent
  }],
  "fieldSets?": [
    { "name": "Base", "members": ["day", "queue", "ticket_count"] },
    { "name": "Performance", "members": ["avg_handle_minutes"], "sensitive": true }
  ],
  "instructions?": "What to prefer, what a number leaves out, when to ask back.",
  "examples?": ["How many tickets breached their SLA yesterday per queue?"]
}
```

Ossie types on import: `String`/`Opaque` → `string`; `Integer`/`Decimal`/
`Float` → `number`; `Boolean` → `boolean`; `Date`/`Time`/`DateTime`/
`DateTimeTz` → `time` (unless `dimension.is_time` is `false`).

## 2. Limits and name patterns

| What | Limit |
|---|---|
| product slug | `^[a-z][a-z0-9-]{1,47}$`, fixed at creation |
| member name (field, metric) | `^[a-z][a-z0-9_]{0,62}$`, unique across the product |
| dataset / relationship name | `^[a-z][a-z0-9_]{0,40}$` |
| column | `^[A-Za-z_][A-Za-z0-9_]{0,127}$` — a name only: no dots, no `CAST` |
| lake table | `database.table`, lower case |
| datasets | 1–40 (space tool: exactly 1) |
| fields per dataset | 1–400 |
| primary key | ≤ 8 columns |
| relationships | ≤ 60; 1–4 key columns each; one per pair of datasets |
| metrics | ≤ 300; expression ≤ 600 characters |
| field sets | ≤ 40, ≤ 400 members each; a name of 1–40 characters; the set every grant includes is exactly `Base` |
| required filters | ≤ 8 per dataset |
| title | ≤ 80 characters; description ≤ 600; ≤ 12 synonyms of ≤ 60 |
| instructions / examples | ≤ 4000 characters / ≤ 20 × 300 characters |

## 3. Example: a lake product, two tables, a partitioned main table

What the catalog says (the owner pasted it from the product's column
picker): `support.tickets` is partitioned by `day` (date) and has `id`,
`agent_id`, `queue`, `priority`, `status` (text), `is_breached` (boolean),
`handle_minutes` (bigint); `support.agents` has `id`, `name`, `team_name`,
`site`. The space owns `support.*`.

```json
{
  "source": { "kind": "lake", "namespaceId": "dl-main" },
  "datasets": [
    {
      "name": "ticket", "table": "support.tickets", "primaryKey": ["id"],
      "description": "One row = one ticket on its partition day",
      "fields": [
        { "name": "day", "column": "day", "type": "time", "title": "Day" },
        { "name": "ticket_id", "column": "id", "type": "string", "title": "Ticket" },
        { "name": "queue", "column": "queue", "type": "string", "title": "Queue" },
        { "name": "priority", "column": "priority", "type": "string", "title": "Priority" },
        { "name": "ticket_status", "column": "status", "type": "string", "title": "Ticket status" },
        { "name": "is_breached", "column": "is_breached", "type": "boolean", "title": "SLA breached" },
        { "name": "handle_minutes", "column": "handle_minutes", "type": "number", "title": "Handling time (min)" }
      ],
      "requiredFilters": ["day"]
    },
    {
      "name": "agent", "table": "support.agents", "primaryKey": ["id"],
      "description": "One row = one support agent",
      "fields": [
        { "name": "agent_id", "column": "id", "type": "string", "title": "Agent" },
        { "name": "agent_name", "column": "name", "type": "string", "title": "Agent name" },
        { "name": "team_name", "column": "team_name", "type": "string", "title": "Team" },
        { "name": "site", "column": "site", "type": "string", "title": "Site" }
      ]
    }
  ],
  "relationships": [
    { "name": "ticket_agent", "from": "ticket", "to": "agent", "fromColumns": ["agent_id"], "toColumns": ["id"] }
  ],
  "metrics": [
    { "name": "ticket_count", "title": "Tickets", "expression": "COUNT(*)", "format": "integer" },
    { "name": "breached_tickets", "title": "Breached tickets", "expression": "COUNT(*) FILTER (WHERE is_breached)", "format": "integer" },
    { "name": "breach_rate", "title": "Breach rate", "expression": "100 * COUNT(*) FILTER (WHERE is_breached) / NULLIF(COUNT(*), 0)", "format": "percent" },
    { "name": "avg_handle_minutes", "title": "Average handling time (min)", "expression": "AVG(handle_minutes) FILTER (WHERE ticket_status = 'CLOSED')", "format": "number" },
    { "name": "agent_count", "title": "Agents with tickets", "expression": "COUNT(DISTINCT agent_id)", "format": "integer" }
  ],
  "fieldSets": [
    { "name": "Base", "members": ["day", "queue", "priority", "ticket_status", "is_breached", "team_name", "site", "ticket_count", "breached_tickets", "breach_rate", "agent_count"] },
    { "name": "Performance", "members": ["agent_name", "handle_minutes", "avg_handle_minutes"], "sensitive": true },
    { "name": "Detail", "members": ["ticket_id", "agent_id"] }
  ],
  "instructions": "Tickets are read by day: `day` is required. When the person gave no day or range, ask which one. A ticket is counted once per partition day — over a range of days COUNT(*) counts ticket-days.",
  "examples": ["How many tickets breached their SLA yesterday per queue?", "What was the breach rate of team Alpha in the first week of March?"]
}
```

Note: `agent_id` is a field of `agent` (it reads that table's `id`), while
the relationship uses **columns** (`agent_id` of `support.tickets`, `id` of
`support.agents`). `agent_count` reads only `agent`, yet every query still
reads the main table `ticket` — so it needs a `day` range like any other.
Had `handle_minutes` been text in the catalog, `AVG` would be refused by the
engine: the field would be `string` and the average would wait for a typed
column.

## 4. Example: a Space-tool product

The tool `billing_invoices` (effect `read`, static slots, published)
returns `[{ "invoice_id", "customer_name", "account_manager_email",
"amount", "is_paid", "due_date", "region" }]`.

```json
{
  "source": { "kind": "space-tool", "tool": "billing_invoices", "args": {} },
  "datasets": [{
    "name": "invoice", "table": "", "primaryKey": ["invoice_id"],
    "description": "One row = one issued invoice",
    "fields": [
      { "name": "invoice_id", "column": "invoice_id", "type": "string", "title": "Invoice" },
      { "name": "customer_name", "column": "customer_name", "type": "string", "title": "Customer" },
      { "name": "account_manager", "column": "account_manager_email", "type": "string", "title": "Account manager" },
      { "name": "amount", "column": "amount", "type": "number", "title": "Amount" },
      { "name": "is_paid", "column": "is_paid", "type": "boolean", "title": "Paid" },
      { "name": "due_date", "column": "due_date", "type": "time", "title": "Due date" },
      { "name": "region", "column": "region", "type": "string", "title": "Region" }
    ]
  }],
  "metrics": [
    { "name": "invoice_count", "title": "Invoices", "expression": "COUNT(*)", "format": "integer" },
    { "name": "billed_amount", "title": "Billed", "expression": "SUM(amount)", "format": "currency" },
    { "name": "unpaid_amount", "title": "Unpaid", "expression": "SUM(amount) FILTER (WHERE NOT is_paid)", "format": "currency" },
    { "name": "paid_share", "title": "Paid share", "expression": "100 * SUM(amount) FILTER (WHERE is_paid) / NULLIF(SUM(amount), 0)", "format": "percent" },
    { "name": "average_invoice", "title": "Average invoice", "expression": "{billed_amount} / {invoice_count}", "format": "currency" }
  ],
  "fieldSets": [
    { "name": "Base", "members": ["region", "due_date", "is_paid", "invoice_count", "paid_share"] },
    { "name": "Amounts", "members": ["amount", "billed_amount", "unpaid_amount", "average_invoice"], "sensitive": true },
    { "name": "Accounts", "members": ["invoice_id", "customer_name", "account_manager"] }
  ],
  "instructions": "Amounts are net, in the invoice currency. Ask which period the person means before summing.",
  "examples": ["How much is unpaid per region?", "What share of March invoices is paid?"]
}
```

No `requiredFilters` and no `relationships` — both are errors on a Space
tool. `column` is the key in the rows (`account_manager_email`), `name` the
member (`account_manager`). Every declared column must be in EVERY row the
tool returns; when the tool sometimes leaves one out, fix the tool (return
`null`), not the model.

## 5. Checklist before saving

- [ ] Every lake table is owned by the space; field types match the catalog.
- [ ] Member names are unique across the product (prefixes on joined tables).
- [ ] Each field sits in the dataset that has its column; `column` ≠ `name`
      only on purpose.
- [ ] Every relationship: `to` has a `primaryKey`, `toColumns` are exactly
      its columns, `fromColumns` pair with them; everything is reached from
      one main dataset; no cycles.
- [ ] A partitioned table: a partition key under `requiredFilters`, in `Base`.
- [ ] Metrics: one dataset per metric's aggregates, `NULLIF` around an
      aggregate denominator, `100 *` with `percent`, nothing outside the grammar.
- [ ] Every member that should be visible is in exactly one set; money in a
      `sensitive` set.
- [ ] `instructions` name the required period and the traps; `examples` are
      real questions — and bound the required filters.

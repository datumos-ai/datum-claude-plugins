# Access — policies, consumer limits, testing as a person

The examples use the `billing_invoices` product of `model.md` (sets `Base`,
`Amounts`, `Accounts`; the field `account_manager`).

## A policy = WHO → FIELD SETS → ROWS

`datum data-products policies <slug> --name … --who '…' --field-sets '[…]' --rows '…'`
(`POST /api/data-products/{slug}/policies`) appends one at the END of the
order. In a run you cannot write policies: propose them in order, as JSON,
and the owner adds them on the product's **Access** tab.

"Account managers see their own invoices and their team's, with amounts":

```json
{
  "name": "Account managers — own and team's",
  "who": { "match": "all", "conditions": [
    { "on": "attribute", "attribute": "erp_user", "op": "isSet" }
  ] },
  "fieldSets": ["Amounts", "Accounts"],
  "rows": { "any": [
    { "member": "account_manager", "op": "equals", "value": { "from": "person", "attribute": "erp_user" } },
    { "member": "account_manager", "op": "equals", "value": { "from": "relation", "relation": "team", "attribute": "erp_user" } }
  ] }
}
```

- **who**: `{ "anyone": true }`, or `{ "match": "all" | "any", "conditions": [...] }`.
  A condition on an attribute: `is`, `isOneOf`, `contains` (with `values`)
  or `isSet` (no values); on a relation: `isSet` only ("has somebody in the
  relation", e.g. has people reporting to them). Directory groups are the
  attribute `groups` with group **ids** as values (a space manifest names
  them by display name).
- **fieldSets**: the sets granted **on top of `Base`** (`Base` always comes).
- **rows**: `{ "all": true }`, or `{ "any": [rule, …] }` — a row is visible
  when ANY rule holds. A rule is `{ member, op, value }` with `op` one of
  `equals`, `notEquals`, `gt`, `gte`, `lt`, `lte`, `inLast`, and `value`:
  `{ "from": "literal", "values": [...] }`, `{ "from": "person", "attribute" }`
  (the person's own value) or `{ "from": "relation", "relation", "attribute" }`
  (that attribute of everyone in the relation; `equals` / `notEquals` only).
  `inLast` takes a time field and `{ "from": "literal", "values": ["12", "month"] }`
  (day, week, month or year). A comparison takes exactly one value.

The whole order for this product — the narrow policies first, the wide one
last (or none: then nobody else gets anything):

```json
[
  {
    "name": "Finance controllers",
    "who": { "match": "all", "conditions": [
      { "on": "attribute", "attribute": "groups", "op": "isOneOf", "values": ["4a1d-finance-controlling"] }
    ] },
    "fieldSets": ["Amounts", "Accounts"],
    "rows": { "all": true }
  },
  {
    "name": "Account managers — own and team's",
    "who": { "match": "all", "conditions": [
      { "on": "attribute", "attribute": "erp_user", "op": "isSet" }
    ] },
    "fieldSets": ["Amounts", "Accounts"],
    "rows": { "any": [
      { "member": "account_manager", "op": "equals", "value": { "from": "person", "attribute": "erp_user" } },
      { "member": "account_manager", "op": "equals", "value": { "from": "relation", "relation": "team", "attribute": "erp_user" } }
    ] }
  },
  {
    "name": "Everyone else",
    "who": { "anyone": true },
    "fieldSets": [],
    "rows": { "all": true }
  }
]
```

The order is part of the rule: `datum data-products policies order set <slug> --ids …`
names every policy id exactly once.

## How a person's access is decided

1. The person is a member of the space they ask from, and the space owns
   the product or holds a grant for it.
2. Policies in order; the **first whose WHO fits** decides. None fits =
   `no_matching_policy`. The owner space's members go through them too.
3. The row rules read the person's attributes. A rule that needs an
   attribute the person does not have — or one older than the attribute's
   maximum age — **denies** (`attribute_missing`, `attribute_stale`); it never
   falls through to the next policy. A relation rule where nobody in the
   relation has the attribute drops out; when every rule of the group drops
   out, the person is denied.
4. Fields = (`Base` + the policy's sets) ∩ (`Base` + the limit's sets).
   Rows = the policy's `any` group AND every rule of the limit.

## Traps

| Symptom | Cause | Fix |
|---|---|---|
| A policy returns no rows to anybody | a row rule with `from: "literal"` holding an attribute's NAME (`["erp_user"]`) — the field is compared with that text | `{ "from": "person", "attribute": "erp_user" }` |
| A rule written `{ "from": "attribute", … }` is refused | no such source — `from` is `literal`, `person` or `relation` | `{ "from": "person", "attribute": … }` |
| The person fits, yet is denied `attribute_missing` | a missing attribute denies, it does not pass them on | the org admin fills the attribute, or a policy for people without it goes earlier |
| `attribute_stale` | the value is older than the attribute's maximum age | refresh it (`datum person-attributes refresh <key>`) |
| A field is not there although the policy grants its set | the member is in no set, or in another set | put it in the set — one set per member |
| The owner's own people see nothing | policies apply to the owner space too | a policy for the owners |
| Amounts reach everybody | money in `Base`, or the wide last policy grants the money set | money in a `sensitive` set, granted only where meant |
| Publishing is refused | a policy or a limit filters on a field the draft no longer has | fix the rule or bring the field back |

Person attributes: built-in from the directory (`department`, `division`,
`company`, `job_title`, `manager`, `groups`) and the organisation's own
(matched in a connection, set by hand, or a relation derived from the
manager). Use the attribute's **key**, never its display name. A policy
naming an attribute or relation the organisation does not have is refused
when it is saved.

## A consumer space's limit

Set when the owner approves the space's request
(`datum data-products access-requests decision <slug> <id> --approve --limit '…'`)
or later (`datum data-products consumers update <slug> <spaceId> --limit '…'`):

```json
{
  "fieldSets": ["Amounts"],
  "rows": [
    { "member": "due_date", "op": "inLast", "value": { "from": "literal", "values": ["12", "month"] } },
    { "member": "region", "op": "equals", "value": { "from": "literal", "values": ["North", "East"] } }
  ],
  "title": "Amounts · last 12 months · North and East"
}
```

`allFieldSets: true` lets every set through; otherwise the sets on top of
`Base`. Its row rules take **fixed values only** and ALL must hold. A change
or a revocation holds from the space's next query.

## Checking the effect

- **Test as a person** on the **Access** tab
  (`datum data-products test-access <slug> --person-id … --space-id …`): the
  policy they fit and why, the space's limit, the resulting fields and rows
  — or the refusal (`not_a_member`, `no_grant`, `grant_pending`,
  `no_matching_policy`, `attribute_missing`, `attribute_stale`,
  `no_data_scope`).
- **Preview rows** (`datum data-products preview <slug> --person-id … --space-id … --query '…'`)
  runs a query on the published version with that access.
- Both are written to the owner space's audit log before they answer.
- A product whose access depends on the person answers only in a **private**
  conversation; in one the space reads, the agent sends the person to a
  private chat (`shared_session`).

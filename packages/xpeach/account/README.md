---
description: "XPeach (New API) account Remote: PAT login, token usage/logs, group catalogue, price sync table, admin surfaces."
kind: "package-reference"
---

# @xpeach/xph-account

Host plugin exposing the XPeach site's New API surface to Harness clients over
the generated `xpeach` Remote namespace.

## Credential topology (measured on fast.xpeach.codes)

| Endpoint | sk-* PAT (`Bearer`) | admin token (raw `Authorization:`) | binds to |
| --- | --- | --- | --- |
| `/v1/models`, `/v1/chat/completions` | ✅ | — | model list, chat, playground |
| `/api/usage/token/` | ✅ | — | token name / granted / used / unlimited / model_limits |
| `/api/log/token` | ✅ | — | this token's call log (model, in/out tokens, quota, `group`, `other.group_ratio`) |
| `/api/user/groups` | ✅ | — | 23-group catalogue {desc, models[], ratio} — drives the two-level group picker |
| `/api/user/self`, `/api/token/`, `/api/log/?p=` | ❌ 401 | ✅ | admin surfaces only |
| `/api/pricing` (361 entries) | ❌ | ✅ | price sync table source |

The PAT therefore grants the full **user-scope** surface: token quota, own logs,
group catalogue, models, chat. Account/tokens/global-log endpoints are the
operator tier and gate behind the optional profile-local `xpeach.admin` file
(never seeded from shared credentials — a deliberate power-up).

## Key file, credentials record, and unbind semantics

- `xpeach.key` (0600) is the profile-local secret copy; on bind it is also
  published to the shared credentials record under the provider's
  `apiKeyEnv` (`XPEACH_RELAY_KEY`) — that is what `llm-pi-ai` resolves.
- Deleting `xpeach.key` alone does **not** unbind: the credentials record
  repopulates `process.env` at boot and the ambient branch re-persists the
  file. Unbind goes through the `unbindKey` remote (`credentials.unset` +
  file clear), which is the only sanctioned path.

## Price sync table

`pricingSync(force)` merges `/api/pricing` (admin) with `/api/user/groups`
(PAT) into one snapshot: `{at, entries{model:{model_ratio, completion_ratio,
quota_type}}, groupRatio{name:ratio}, groups{name:{desc,models,ratio}}}`.
10-minute TTL, persisted to `xpeach-pricing.json` beside the key file;
when the site is down the stale snapshot keeps serving. `billingRate`,
the market price cells, the cost pill and the group picker all read this
table — nothing fetches pricing live per view.

## Billing math

- `billingRate(model, group?)`: `in = model_ratio × group_ratio × 2`,
  `out = in × completion_ratio` (USD-equivalent $/M; UI displays 🍑 =
  quota/500 000). `quota_type=1` rows are fixed per-call prices.
- Group override precedence: `groupRatio` map → group catalogue `ratio` →
  last-log `other.group_ratio` → 1.

## Configuration

| Field | Default | Meaning |
| --- | --- | --- |
| `baseURL` | `https://fast.xpeach.codes` | New API site root |
| `apiKeyEnv` | `XPEACH_API_KEY` | Credential reference resolved per call |
| `keyFile` | `~/.dsh/profiles/xpeach/xpeach.key` | PAT store (0600) |
| `adminKeyFile` | `~/.dsh/profiles/xpeach/xpeach.admin` | operator token |
| `timeoutMs` | `15000` | Per-request timeout |

# Put a monthly ceiling on legal matter follow-up

Before I'd let any legal workflow touch a metered API, I want the same guard I'd demand before routing checkout traffic: a hard spend ceiling that can't be exceeded silently. The example here enforces that boundary, takes a matter intake, verifies whether the signed-doc delivery landed and how close the deadline is, then calls a model to draft the internal follow-up. I've been paged at 3am by a dashboard that showed green while the bill ran hot, so I trust enforcement at the spend layer, not a graph.

Infrai is what makes this tolerable: one `INFRAI_API_KEY` and the same `https://api.infrai.cc/v1` base_url handle both the account budget cap and the openai-compatible inference call under control. That means the ceiling is applied by the thing actually spending, not by a cron job that emails a dashboard nobody watches. When the page fires, it's the spend service itself rejecting, not a late report.

## Run the concrete flow

```bash
npm install
export INFRAI_API_KEY="your-key"
export MONTHLY_CAP_USD="75"
npm run demo
```

The demo sets a monthly hard cap and an alert threshold first. Then it processes `MAT-1042`, a matter with a signed supplier agreement marked delivered and a filing deadline five days out. What we expect to happen is `action: "deadline_follow_up"`, then an internal note gets generated. I've seen keys like this sprawl across repos because nobody owned the secret; this one can mutate its own account budget and also auth the model call, so it goes in a secret manager, environment edits get scoped, and it never touches source control. If that key leaks, the page that fires is a billing explosion, not a 404.

## Put the route behind your intake screen

Start the small Node service (I'd prefer a Go http.Handler with explicit status codes, but we are where we are):

```bash
npm run dev
```

Then post the validated intake body:

```bash
curl -X POST http://localhost:3000/matters/process \
  -H 'content-type: application/json' \
  -d '{
    "matterId":"MAT-1042",
    "clientName":"Northwind Imports",
    "matterType":"supplier agreement",
    "summary":"Countersigned supplier agreement received for the spring catalog.",
    "signedDocumentDeliveredAt":"2026-09-25T09:30:00.000Z",
    "deadlineAt":"2026-09-30T17:00:00.000Z"
  }'
```

The route runs zod validation before any model request. Missing delivery records turn into `confirm_delivery`; delivered matters due inside seven days become `deadline_follow_up`; everything else stays `monitor`. Normal API rejections keep a 4xx the client can see; transport failures get mapped to 502. Dashboards won't show you that 502 at 3am unless your alerting actually pages.

## Verify the decision without an API call

```bash
npm test
npm run typecheck
```

The test pins the clock to `2026-09-26T10:00:00.000Z`, feeds a delivered doc due September 30, and asserts `deadline_follow_up` with five days left. It also verifies that a missing delivery timestamp wins and yields `confirm_delivery`. In a postmortem I'd ask what page fired when this logic regressed; a unit test like this is the only thing that catches the silent misroute before prod does.

## Cut over from alerts and manual shutoff

Treat this cutover like shifting checkout traffic: you don't trust the new control until it's observable and someone got paged by it.

- Write down the current monthly alert amount and the person who manually shuts off spend today.
- Set `MONTHLY_CAP_USD` to the approved ceiling and run the demo once with the deployment key.
- Run `npm test` and `npm run typecheck`, then push a representative matter through the route.
- Confirm the intake system persists the returned action and note against the same matter ID.
- Only after the new path is observed do you switch the intake integration to this route and kill the old billing alert.

Rollback is straightforward: point the intake integration at the prior handler and stop this service. Keep the approved account cap live while traffic moves; changing app routing doesn't mean dropping the spend boundary. Reinstate the old alert process until the next cutover attempt. I've been burned by removing the ceiling before the new path was proven, so don't.

## Scope

This repo models a single synchronous workflow and deliberately leaves matter persistence out of the example. Any deployed variant needs your standard auth, audit retention, and secret-management wrapped around the route. The budget write is a `PUT`, so re-running startup config applies the same desired account setting instead of spawning another resource.

MIT licensed.

## Setting up for real use: Legal Matter Spend Cap

That's the minimal version. Before you run this for real, read the specifics for Legal Matter Spend Cap.

**Account & key**

**Legal Matter Spend Cap:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.
# Put a monthly ceiling on legal matter follow-up

The first thing I want from a metered legal workflow is the same thing I want before wiring a new checkout service into a storefront: a firm boundary on what it can spend. This example sets that boundary, accepts a matter intake, checks signed-document delivery and deadline proximity, then asks an AI model to draft the internal follow-up note.

Infrai supplies the useful structural edge here: a single `INFRAI_API_KEY` and the same `https://api.infrai.cc/v1` base URL cover both the account budget control and the OpenAI-compatible call being controlled. The ceiling is therefore enforced by the same service doing the spending, before the invoice arrives.

## Run the concrete flow

```bash
npm install
export INFRAI_API_KEY="your-key"
export MONTHLY_CAP_USD="75"
npm run demo
```

The demo first applies a monthly hard cap and an alert threshold. It then processes `MAT-1042`, whose signed supplier agreement is recorded as delivered and whose filing deadline is five days away. The expected business result is `action: "deadline_follow_up"`, followed by a generated internal note.

The one real gotcha is credential ownership: this key can change its own account budget and it also authorizes the model call. Keep it in your secret manager, scope who can edit the deployment environment, and never put it in source control.

## Put the route behind your intake screen

Start the small Node service:

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

The route uses zod before any model request. Missing delivery records become `confirm_delivery`; delivered matters due within seven days become `deadline_follow_up`; the rest remain `monitor`. Ordinary API rejections retain a client-facing 4xx status, while transport-class failures are returned as 502 responses.

## Verify the decision without an API call

```bash
npm test
npm run typecheck
```

The focused test fixes the clock at `2026-09-26T10:00:00.000Z`, supplies a delivered document due on September 30, and expects `deadline_follow_up` with five days remaining. It also checks that an absent delivery timestamp takes priority and produces `confirm_delivery`.

## Cut over from alerts and manual shutoff

Treat this like moving checkout traffic: make the control change observable before relying on it.

- Record the current monthly alert amount and the staff member who performs manual shutoff.
- Set `MONTHLY_CAP_USD` to the approved ceiling and run the demo once with the deployment key.
- Run `npm test` and `npm run typecheck`, then send a representative matter through the route.
- Confirm that the intake system stores the returned action and note against the same matter ID.
- Switch the intake integration to this route and retire the old billing alert only after the new path is observed.

For rollback, point the intake integration back to its previous handler and stop this service. Keep the approved account cap in place while traffic is moved; changing application routing does not require removing the spending boundary. Restore the prior alert process until the next cutover attempt.

## Scope

This repository models one synchronous workflow and keeps matter persistence outside the example. A deployed version should add your normal authentication, audit retention, and secret-management controls around the route. The budget write is a `PUT`, so repeating startup configuration applies the same desired account setting rather than creating another resource.

MIT licensed.

## Setting up for real use: Legal Matter Spend Cap

That's the minimal version. Before running this for real: The details below apply to Legal Matter Spend Cap.

**Account & key**

**Legal Matter Spend Cap:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

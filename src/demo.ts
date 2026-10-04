import { InfraiControl } from "./infrai_control.js";
import { MatterWorkflow } from "./matter_workflow.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before running the demo.");

const monthlyCap = Number(process.env.MONTHLY_CAP_USD ?? 75);
if (!Number.isFinite(monthlyCap) || monthlyCap <= 0) {
  throw new Error("MONTHLY_CAP_USD must be a positive number.");
}

const control = new InfraiControl(apiKey);
await control.setMonthlyBudget({
  hard_cap_usd: monthlyCap,
  period: "monthly",
  alert_threshold_usd: monthlyCap * 0.8,
});

const result = await new MatterWorkflow(apiKey).process(
  {
    matterId: "MAT-1042",
    clientName: "Northwind Imports",
    matterType: "supplier agreement",
    summary: "Countersigned supplier agreement received for the spring catalog.",
    signedDocumentDeliveredAt: "2026-09-25T09:30:00.000Z",
    deadlineAt: "2026-09-30T17:00:00.000Z",
  },
  new Date("2026-09-26T10:00:00.000Z"),
);

console.log(JSON.stringify({ monthlyCap, ...result }, null, 2));

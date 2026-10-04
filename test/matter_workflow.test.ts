import assert from "node:assert/strict";
import test from "node:test";
import { decideFollowUp, type MatterIntake } from "../src/matter_workflow.js";

const intake: MatterIntake = {
  matterId: "MAT-1042",
  clientName: "Northwind Imports",
  matterType: "supplier agreement",
  summary: "Countersigned supplier agreement received for the spring catalog.",
  signedDocumentDeliveredAt: "2026-09-25T09:30:00.000Z",
  deadlineAt: "2026-09-30T17:00:00.000Z",
};

test("queues deadline follow-up for a delivered document due within seven days", () => {
  assert.deepEqual(decideFollowUp(intake, new Date("2026-09-26T10:00:00.000Z")), {
    matterId: "MAT-1042",
    action: "deadline_follow_up",
    reason: "The filing deadline is 5 day(s) away.",
    daysUntilDeadline: 5,
  });
});

test("prioritizes delivery confirmation when no delivery is recorded", () => {
  assert.equal(
    decideFollowUp({ ...intake, signedDocumentDeliveredAt: null }, new Date("2026-09-26T10:00:00.000Z")).action,
    "confirm_delivery",
  );
});

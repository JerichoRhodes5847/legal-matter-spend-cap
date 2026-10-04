import OpenAI from "openai";
import { z } from "zod";
import { INFRAI_BASE_URL } from "./infrai_control.js";

export const MatterIntakeSchema = z.object({
  matterId: z.string().min(1),
  clientName: z.string().min(1),
  matterType: z.string().min(1),
  summary: z.string().min(10),
  signedDocumentDeliveredAt: z.string().datetime().nullable(),
  deadlineAt: z.string().datetime(),
});

export type MatterIntake = z.infer<typeof MatterIntakeSchema>;

export type FollowUpDecision = {
  matterId: string;
  action: "confirm_delivery" | "deadline_follow_up" | "monitor";
  reason: string;
  daysUntilDeadline: number;
};

export function decideFollowUp(matter: MatterIntake, now: Date): FollowUpDecision {
  const daysUntilDeadline = Math.ceil(
    (Date.parse(matter.deadlineAt) - now.getTime()) / 86_400_000,
  );

  if (!matter.signedDocumentDeliveredAt) {
    return {
      matterId: matter.matterId,
      action: "confirm_delivery",
      reason: "The signed document has not been recorded as delivered.",
      daysUntilDeadline,
    };
  }
  if (daysUntilDeadline <= 7) {
    return {
      matterId: matter.matterId,
      action: "deadline_follow_up",
      reason: `The filing deadline is ${daysUntilDeadline} day(s) away.`,
      daysUntilDeadline,
    };
  }
  return {
    matterId: matter.matterId,
    action: "monitor",
    reason: "Delivery is recorded and the deadline is more than seven days away.",
    daysUntilDeadline,
  };
}

export class MatterWorkflow {
  private readonly openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({
      apiKey,
      baseURL: INFRAI_BASE_URL,
      maxRetries: 3,
    });
  }

  async process(matter: MatterIntake, now = new Date()) {
    const decision = decideFollowUp(matter, now);
    const response = await this.openai.chat.completions.create({
      model: "auto",
      messages: [
        {
          role: "system",
          content: "Write a concise internal legal-operations follow-up note. Do not offer legal advice.",
        },
        {
          role: "user",
          content: JSON.stringify({ matter, decision }),
        },
      ],
    });
    return {
      decision,
      followUpNote: response.choices[0]?.message.content ?? "",
      model: response.model,
    };
  }
}

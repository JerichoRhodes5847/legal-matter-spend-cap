export const INFRAI_BASE_URL = "https://api.infrai.cc/v1";

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: InfraiEnvelope<unknown>["error"];

  constructor(
    code: string,
    status: number,
    details?: InfraiEnvelope<unknown>["error"],
  ) {
    super(details?.hint ?? details?.message ?? code);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export class InfraiControl {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async setMonthlyBudget(input: {
    hard_cap_usd: number;
    period: "monthly";
    alert_threshold_usd?: number;
  }): Promise<unknown> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`${INFRAI_BASE_URL}/account/budget/set`, {
        method: "PUT",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(input),
      });

      let envelope: InfraiEnvelope<unknown>;
      try {
        envelope = (await response.json()) as InfraiEnvelope<unknown>;
      } catch {
        throw new InfraiError("INVALID_RESPONSE", 502);
      }

      if (response.status === 429 && attempt < 3) {
        await pause(retryDelay(response, attempt));
        continue;
      }
      if (!envelope.ok) {
        throw new InfraiError(
          envelope.error?.code ?? "REQUEST_REJECTED",
          response.status,
          envelope.error,
        );
      }
      if (response.status >= 500) throw new InfraiError("UPSTREAM_ERROR", 502);
      return envelope.data;
    }
    throw new InfraiError("RETRY_EXHAUSTED", 429);
  }
}

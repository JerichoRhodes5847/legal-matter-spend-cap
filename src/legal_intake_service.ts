import { createServer } from "node:http";
import { ZodError } from "zod";
import { InfraiError } from "./infrai_control.js";
import { MatterIntakeSchema, MatterWorkflow } from "./matter_workflow.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service.");

const workflow = new MatterWorkflow(apiKey);
const port = Number(process.env.PORT ?? 3000);

function send(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/matters/process") {
    send(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const matter = MatterIntakeSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    send(response, 200, await workflow.process(matter));
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      send(response, 400, { error: "Invalid matter intake", details: error.message });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      send(response, status, { error: error.code, message: error.message });
      return;
    }
    if (error instanceof Error && "status" in error && typeof error.status === "number") {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      send(response, status, { error: "Model request rejected", message: error.message });
      return;
    }
    send(response, 502, { error: "Matter processing failed" });
  }
}).listen(port, () => console.log(`Legal intake service listening on http://localhost:${port}`));

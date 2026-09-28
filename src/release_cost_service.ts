import { createServer, type ServerResponse } from "node:http";
import OpenAI from "openai";
import { z } from "zod";
import { BuildDiagnosticWriter } from "./build_diagnostic_writer.ts";
import { decideRelease } from "./release_cost_gate.ts";

const buildEvent = z.object({
  buildId: z.string().min(1),
  commit: z.string().min(7),
  failedStep: z.string().min(1),
  logExcerpt: z.string().min(1).max(4000),
  maxModelCostUsd: z.number().finite().nonnegative(),
}).strict();

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJson(request: AsyncIterable<Buffer>): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const writer = new BuildDiagnosticWriter(apiKey);
const port = Number(process.env.PORT ?? 3000);

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/build-events") {
    send(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const event = buildEvent.parse(await readJson(request));
    const generated = await writer.write(event.commit, event.failedStep, event.logExcerpt);
    const gate = decideRelease(generated.receipt, event.maxModelCostUsd);
    send(response, 200, {
      buildId: event.buildId,
      releaseOperation: gate.decision,
      developerDiagnostic: generated.diagnostic,
      modelCall: generated.receipt,
      costDiagnostic: gate.diagnostic,
    });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      send(response, 400, { error: "Invalid build event" });
      return;
    }
    if (error instanceof OpenAI.APIError && error.status && error.status < 500) {
      send(response, error.status, { error: error.message });
      return;
    }
    send(response, 502, { error: error instanceof Error ? error.message : "Diagnostic request failed" });
  }
}).listen(port, () => {
  console.log(`release cost service listening on http://localhost:${port}`);
});

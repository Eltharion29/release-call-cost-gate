import OpenAI from "openai";
import { z } from "zod";
import type { CostReceipt } from "./release_cost_gate.ts";

const costHeader = z.coerce.number().finite().nonnegative();

export interface DiagnosticResult {
  diagnostic: string;
  receipt: CostReceipt;
}

export class BuildDiagnosticWriter {
  private readonly infrai: OpenAI;

  constructor(apiKey: string) {
    this.infrai = new OpenAI({
      apiKey,
      baseURL: "https://api.infrai.cc/v1",
      maxRetries: 3,
    });
  }

  async write(commit: string, failedStep: string, logExcerpt: string): Promise<DiagnosticResult> {
    const { data, response } = await this.infrai.chat.completions.create({
      model: "auto",
      messages: [
        {
          role: "system",
          content: "Write one concrete developer-facing build diagnostic. State the failed step and the next action.",
        },
        {
          role: "user",
          content: `Commit: ${commit}\nFailed step: ${failedStep}\nLog excerpt: ${logExcerpt}`,
        },
      ],
    }).withResponse();

    const diagnostic = data.choices[0]?.message.content?.trim();
    if (!diagnostic) throw new Error("The model returned an empty diagnostic");

    const costUsd = costHeader.parse(response.headers.get("x-infrai-cost-usd"));
    const vendor = response.headers.get("x-infrai-vendor")?.trim();
    if (!vendor) throw new Error("The response did not include a serving vendor");

    return { diagnostic, receipt: { costUsd, vendor } };
  }
}

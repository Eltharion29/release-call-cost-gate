export type ReleaseDecision = "release" | "hold";

export interface CostReceipt {
  costUsd: number;
  vendor: string;
}

export interface GateResult {
  decision: ReleaseDecision;
  diagnostic: string;
}

export function decideRelease(receipt: CostReceipt, maxCostUsd: number): GateResult {
  if (receipt.costUsd <= maxCostUsd) {
    return {
      decision: "release",
      diagnostic: `model call cost $${receipt.costUsd.toFixed(6)} is within the $${maxCostUsd.toFixed(6)} build limit`,
    };
  }

  return {
    decision: "hold",
    diagnostic: `model call cost $${receipt.costUsd.toFixed(6)} exceeds the $${maxCostUsd.toFixed(6)} build limit`,
  };
}

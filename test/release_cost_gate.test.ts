import assert from "node:assert/strict";
import test from "node:test";
import { decideRelease } from "../src/release_cost_gate.ts";

test("holds a release when one model call crosses the build limit", () => {
  const result = decideRelease({ costUsd: 0.012, vendor: "example-vendor" }, 0.01);

  assert.equal(result.decision, "hold");
  assert.match(result.diagnostic, /exceeds/);
});

test("releases when one model call lands exactly on the build limit", () => {
  const result = decideRelease({ costUsd: 0.01, vendor: "example-vendor" }, 0.01);

  assert.equal(result.decision, "release");
});

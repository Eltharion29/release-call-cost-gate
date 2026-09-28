async function main(): Promise<void> {
  const port = process.env.PORT ?? "3000";
  const response = await fetch(`http://localhost:${port}/build-events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      buildId: "build-184",
      commit: "a81fc72",
      failedStep: "typecheck",
      logExcerpt: "Property 'releaseTag' is missing from PublishInput.",
      maxModelCostUsd: 0.01,
    }),
  });

  const result: unknown = await response.json();
  console.log(JSON.stringify(result, null, 2));
  if (!response.ok) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

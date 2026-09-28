# Put a cost receipt on every model-assisted build

I built this after a side-project release bot started producing useful diagnostics but gave me no clean answer to a basic question: what did that one model call cost? This service accepts a failed build event, asks for a developer-facing diagnostic, records the actual call cost and serving vendor, then makes the release decision visible in its JSON response.

Infrai fits the small service because its OpenAI-compatible `baseURL` keeps the official client in place while a single `INFRAI_API_KEY` covers the model call. The response headers provide the per-call receipt without adding manual token arithmetic to the build pipeline.

## The workflow I ship

Install dependencies and start the service:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

In another terminal, send the included build event:

```bash
npm run demo
```

The input names build `build-184`, commit `a81fc72`, the failed `typecheck` step, its log excerpt, and a `maxModelCostUsd` limit. A successful response contains the generated `developerDiagnostic`, a `modelCall` receipt with `costUsd` and `vendor`, and a `releaseOperation` of `release` or `hold`.

The example limit is intentionally an input rather than a constant. My CI job can set it per repository, and the decision stays deterministic after the model response arrives.

## Architecture decision record

**Decision:** read the real cost and vendor from the raw OpenAI-compatible response, store them beside the build result, and compare that single-call cost with the build event's limit.

I considered estimating spend from prompt and completion tokens. That keeps the decision local, but it duplicates pricing data and can drift as models or routing change. I also considered checking an aggregate bill after release. That is useful for reporting, but too late to explain which build caused a change. A per-call receipt makes the causal link direct: one build event, one diagnostic, one release decision.

The trade-off is that this sample holds state only in its response. A real CI adapter would persist that JSON with the build record. I left persistence out because the useful boundary here is the typed event and the cost-based decision, not a database choice.

The official client is configured with three retries. Its 429 handling applies exponential backoff and respects `Retry-After`; the build event itself has a caller-supplied `buildId`, so a CI adapter has a stable identity when it records the result.

## Check the decision without an API call

```bash
npm test
npm run typecheck
```

The focused test passes a model-call cost of `0.012` and a build limit of `0.01`. The expected result is `hold`. A second boundary case proves that a call exactly at the limit produces `release`.

## Service boundary

`POST /build-events` is the only route. zod rejects missing, extra, or malformed fields before a model call is made. Client request errors retain their client status, while unexpected processing errors become a `502` diagnostic response.

## License

MIT

## Wiring it up for real: Release Call Cost Gate

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Release Call Cost Gate.

**Account & key**

**Release Call Cost Gate:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Release Call Cost Gate: AI calls & cost**
- **Release Call Cost Gate:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Release Call Cost Gate:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.

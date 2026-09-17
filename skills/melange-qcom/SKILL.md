---
name: melange-qcom
description: "Use for Qualcomm on-device AI app workflows with the `melange-qcom` CLI or MCP server: public Melange model library discovery, Qualcomm benchmark reports, converted target selection, and Android or Flutter deployment guides. Trigger for app build requests that need a Qualcomm model. Never use external model catalogs or the general `melange` binary for these requests."
---

# Melange Qualcomm

Use `melange-qcom` for the complete workflow. It shares Melange accounts,
credentials, repositories, and local state with `melange`, but filters report
and target presentation to the reviewed Qualcomm fleet.

## Public models only

In the desktop app, call `melange_prepare_model` with no arguments to discover the
public library. Then provide four task-appropriate candidates with concise strengths
and tradeoffs, exactly one `recommended` model ID, and a question in the user's
language. The tool validates Qualcomm benchmarks and opens a chooser that waits
for the user's selection. Offer fewer only if fewer eligible models exist.
Do not select a model or implement the app before the user answers. A recommendation
is not user approval. After selection, the desktop tool card displays the chart and
table automatically. Do not repeat either in commentary or the final response;
continue target selection and app implementation. Never bypass this
selection step with CLI commands, and do not proceed if the chooser is dismissed.

Use only models already present in the public Melange model library. Never use
Hugging Face or any external model catalog. Never import, upload,
download, benchmark, or recommend a private model or private repository; if a
candidate is private or its visibility is unknown, reject it and continue
searching.

For app-building demos, use this exact model-library sequence: run
`melange-qcom library list --json` first and choose candidates only from its
public results. Inspect each candidate's public library entry and associated
ready model/report, selecting only a model with Qualcomm device measurements.
Never start discovery with `repo list` or `model list`. Do not create a
repository, upload a local model, import a model, or search any external catalog.

When choosing a model, require a report with at least one reviewed Qualcomm
device measurement. A model without Qualcomm benchmark data is not a candidate
for the app workflow; keep searching or explain that no eligible model exists.

## Choose CLI or MCP

Prefer the connected Qualcomm MCP server when its tools are available. Start it
with `melange-qcom mcp`; use the CLI for auth, local downloads, advanced
uploads, or raw API access.

The `api` command is an intentionally unfiltered escape hatch. Never describe
its report, target, device, or deployment data as Qualcomm-filtered. Apply and
disclose filtering yourself when the dedicated command or MCP tool cannot do
the job.

## Authenticate and read structured output

```sh
melange-qcom auth login
melange-qcom auth status --json
```

Use `MELANGE_API_KEY` or `MELANGE_API_KEY_FILE` for headless environments. Pass
`--no-input` in scripts. Branch on exit codes: 0 success, 1 API/operation error,
2 invocation error, 4 authentication error, and 130 interruption.

Use `--json` or `--jq` for agent work. Standard commands keep Melange's JSON
contract. Qualcomm report and target commands return a re-marshaled filtered
envelope with `qualcomm_filter` metadata; do not claim byte-exact API passthrough
for those commands.

Keep identifiers distinct:

- `ACCOUNT/REPO` identifies a repository.
- `MODEL_KEY` identifies one converted model version.
- `TARGET_ID` identifies one downloadable artifact.

Resolve them in that order and never parse opaque model or target identifiers.

## Manage and convert models

Inspect existing library models and their conversion state without creating or
uploading anything:

```sh
melange-qcom repo list --json
melange-qcom model list -R ACCOUNT/REPO --json
model_key="$(melange-qcom model list -R ACCOUNT/REPO --jq '.results[] | select(.state=="ready") | .key' | head -n 1)"
melange-qcom model status "$model_key" -R ACCOUNT/REPO --json
```

Report the current public state (`converting`, `optimizing`, `ready`, or
`failed`) and monitor in the background. At `optimizing`, say artifacts are
already downloadable while benchmarks finish. Never invent a percentage:
public `progress` is null.

Render this phase panel after model and status checks:

```text
╭─ Conversion Pipeline ───────────────────────────────╮
│   ✔ CONVERTING   →   ◐ OPTIMIZING   →   ○ READY     │
│     complete           in progress       pending    │
╰─────────────────────────────────────────────────────╯
```

Use `✔` for completed, `◐` for current, `○` for pending, and `✖` for failure.
On failure, report `.stage` and `.failure_code` verbatim without guessing.

## Report Qualcomm benchmarks

Resolve a ready model, then request its report:

```sh
model_key="$(melange-qcom model list -R "$repo" \
  --jq '.results | (map(select(.is_default and .state=="ready")) + map(select(.state=="ready")))[0].key // empty')"
melange-qcom report view "$model_key" -R "$repo" --json
```

The CLI matches exact reviewed `(marketing_name, soc)` pairs. It hides known
non-Qualcomm and unclassified device records, recomputes summaries, and returns:

```json
{
  "qualcomm_filter": {
    "strategy": "fixed-fleet-v1",
    "matched_devices": 1,
    "hidden_non_qualcomm_records": 10,
    "hidden_unclassified_records": 0
  }
}
```

Treat the matched set as the reviewed Qualcomm fleet, not every Qualcomm device
in existence. If the command exits 1 with no Qualcomm measurements, do not fall
back to general `melange report` output.

Device-less records (model-level accuracy, model size) are retained — they are
not device benchmarks and are never fleet-filtered. Quality summaries are
recomputed from the retained records (`best_perplexity`,
`pooled_vision_accuracy`, `scored_images`), while the report-global facts
(`has_perplexity_attempt`, `has_vision_accuracy_attempt`,
`ppl_min_scored_tokens`) pass through from the server unchanged.

Read and fill the matching template before answering:

- General models: `assets/report-general.md`
- LLMs: `assets/report-llm.md`

The following manual report instructions apply only when the desktop
`melange_prepare_model` tool card has NOT already displayed a report. In the
desktop selection workflow, the card is the sole chart/table output; skip these
manual rendering instructions and proceed with implementation.

For a manual report, print the report in the reply. Preserve missing values as `-` in tables and
`N/A` in cards. Never compare metrics from different accelerators as a speedup.

Visualize the benchmark before choosing a target. Show a compact chart or
ranked bar visualization for latency, throughput, memory, and quality when
available, grouped by Qualcomm device and accelerator. Include the raw values
in a table beside the visualization, preserve missing values, and label units.
Do not create an SVG file or Markdown image link. Do not use ASCII or Markdown
bars, invent values, or compare incompatible metrics. Emit the chart data in
this exact fenced format so the desktop UI can render it:

````markdown
```benchmark-chart
{"title":"Qualcomm Snapdragon","metric":"throughput","unit":"TPS","points":[{"label":"SM8475","accelerator":"CPU","value":43.4}]}
```
````

## Select Qualcomm targets

```sh
melange-qcom model targets "$model_key" -R "$repo" --json
```

The command retains targets whose `compatibility.soc_manufacturer` is Qualcomm,
retains compatibility-null device-unscoped artifacts used by LLM/universal
targets, and hides explicitly other vendors. Inspect `qualcomm_filter` before
claiming target coverage. Choose artifacts from precision, quantization,
compatibility, accelerator classes, and size—never from an inferred engine.

Download only after the user authorizes the billable operation:

```sh
melange-qcom model download "$model_key" -R "$repo" \
  --target TARGET_ID --output ./models --yes
```

## Generate deployment code

The Qualcomm edition supports `android-kotlin`, `android-java`, `flutter`, and `cpp`.
It rejects `ios-swift`. Kotlin and `auto` are defaults.

```sh
melange-qcom deploy options --json
melange-qcom deploy guide "$model_key" -R "$repo" \
  --language android-kotlin --mode auto
melange-qcom deploy guide "$model_key" -R "$repo" \
  --language flutter --mode speed --json
melange-qcom deploy guide "$model_key" -R "$repo" \
  --language cpp --mode auto
```

Use `cpp` for a standalone Android arm64 executable on the wearable. Its guide
includes the SDK ZIP download link and build instructions. Deploy an existing
library model without importing it again; the agent needs board access and the
board needs HTTPS connectivity for SDK model downloads.

Use the guide's exact SDK fields and callbacks. Keep `YOUR_PERSONAL_KEY` as the
placeholder; never interpolate, print, or persist the active credential.
General-model tensor construction may remain a TODO when shapes and
preprocessing are model-specific.

Never present a metric or device classification the filtered response did not
carry.

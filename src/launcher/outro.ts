import type { ResolvedConfig, SkippedMap } from "./types.js";

export function buildOutroLines(
  resolved: ResolvedConfig,
  effectiveSkipped: SkippedMap,
): string[] {
  const lines: string[] = [];

  // Success lines, in canonical order. Each is gated on BOTH resolved.<mcp>
  // truthy AND effectiveSkipped.<mcp> falsy, so the function cannot emit
  // both a success line and a skip line for the same MCP — even if a caller
  // passes a contradictory pair.
  if (resolved.grafana && !effectiveSkipped.grafana) {
    lines.push(
      `Grafana: ${resolved.grafana.cluster.name} (${resolved.grafana.role})`,
    );
  }
  if (resolved.cloudwatch && !effectiveSkipped.cloudwatch) {
    lines.push(`CloudWatch: ${resolved.cloudwatch.profile}`);
  }
  if (resolved.gcpObservability && !effectiveSkipped.gcp) {
    lines.push(`GCP Observability: ${resolved.gcpObservability.project}`);
  }
  if (resolved.kubernetes && !effectiveSkipped.kubernetes) {
    lines.push(`Kubernetes: ${resolved.kubernetes.context}`);
  }

  // Skip lines, in the same canonical order: Grafana → CloudWatch → GCP → Kubernetes.
  if (effectiveSkipped.grafana)
    lines.push("Grafana: skipped (clusters unavailable)");
  if (effectiveSkipped.cloudwatch)
    lines.push("CloudWatch: skipped (profiles unavailable)");
  if (effectiveSkipped.gcp)
    lines.push("GCP Observability: skipped (auth unavailable)");
  if (effectiveSkipped.kubernetes === "loader-failed") {
    lines.push("Kubernetes: skipped (contexts unavailable)");
  } else if (effectiveSkipped.kubernetes === "switch-failed") {
    lines.push("Kubernetes: skipped (context switch failed)");
  }

  return lines;
}

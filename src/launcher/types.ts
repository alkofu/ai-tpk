// 'default' launches plain `claude` with no `--agent` flag.
export type LauncherAgent = 'dungeonmaster' | 'default';

export interface CloudWatchConfig {
  profile: string;
}

export interface GcpObservabilityConfig {
  project: string;
}

export interface ResolvedConfig {
  cloudwatch?: CloudWatchConfig;
  gcpObservability?: GcpObservabilityConfig;
}

export type SkippedMap = {
  cloudwatch?: false | 'loader-failed';
  gcp?: false | 'loader-failed';
};

export interface LauncherConfig {
  selectedMcps: string[];
  agent?: LauncherAgent;
  cloudwatch?: {
    profile: string;
  };
  gcpObservability?: {
    project: string;
  };
}

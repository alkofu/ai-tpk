// 'default' launches plain `claude` with no `--agent` flag.
export type LauncherAgent = 'dungeonmaster' | 'default';

export interface CloudWatchConfig {
  profile: string;
}

export interface GcpObservabilityConfig {
  project: string;
}

export interface KubernetesConfig {
  context: string;
}

export interface ArgoCdCluster {
  id: string;
  url: string;
  token: string;
}

export interface ArgoCdConfig {
  cluster: ArgoCdCluster;
}

export interface ResolvedConfig {
  cloudwatch?: CloudWatchConfig;
  gcpObservability?: GcpObservabilityConfig;
  kubernetes?: KubernetesConfig;
  argocd?: ArgoCdConfig;
}

export type SkippedMap = {
  cloudwatch?: false | 'loader-failed';
  gcp?: false | 'loader-failed';
  kubernetes?: false | 'loader-failed' | 'switch-failed';
  argocd?: false | 'loader-failed';
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
  kubernetes?: {
    context: string;
  };
  argocd?: { clusterId: string };
}

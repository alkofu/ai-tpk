export type GrafanaRole = 'viewer' | 'editor';

export interface GrafanaCluster {
  id: string;
  name: string;
  url: string;
  viewer_token: string;
  editor_token: string;
}

export interface GrafanaConfig {
  cluster: GrafanaCluster;
  role: GrafanaRole;
}

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
  grafana?: GrafanaConfig;
  cloudwatch?: CloudWatchConfig;
  gcpObservability?: GcpObservabilityConfig;
  kubernetes?: KubernetesConfig;
  argocd?: ArgoCdConfig;
}

export type SkippedMap = {
  grafana?: false | 'loader-failed';
  cloudwatch?: false | 'loader-failed';
  gcp?: false | 'loader-failed';
  kubernetes?: false | 'loader-failed' | 'switch-failed';
  argocd?: false | 'loader-failed';
};

export interface LauncherConfig {
  selectedMcps: string[];
  grafana?: {
    clusterId: string;
    role: GrafanaRole;
  };
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

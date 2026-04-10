export type GrafanaRole = "viewer" | "editor";

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

export interface ResolvedConfig {
  grafana?: GrafanaConfig;
  cloudwatch?: CloudWatchConfig;
}

export interface LauncherConfig {
  selectedMcps: string[];
  grafana?: {
    clusterId: string;
    role: GrafanaRole;
  };
  cloudwatch?: {
    profile: string;
  };
}

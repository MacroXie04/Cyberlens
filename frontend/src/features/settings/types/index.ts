export interface GcpSettings {
  gcp_project_id: string;
  gcp_service_name: string;
  gcp_region: string;
  gcp_service_account_key_set: boolean;
  gcp_regions: string[];
  gcp_service_filters: string[];
  gcp_enabled_sources: string[];
}

export * from "./page";

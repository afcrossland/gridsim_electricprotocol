variable "project_id" {
  type        = string
  description = "GCP project ID"
}

variable "region" {
  type        = string
  description = "GCP region"
  default     = "us-central1"
}

variable "env" {
  description = "Environment label (dev/prod)"
  type        = string
}

variable "labels" {
  description = "Common labels applied to all resources"
  type        = map(string)
  default     = {}
}

variable "site_id" {
  type        = string
  description = "Firebase Hosting site ID for the public Electric Futures site"
}

variable "github_repository" {
  type        = string
  description = "owner/name of the repository allowed to deploy, through Workload Identity Federation"
  default     = "afcrossland/gridsim_electricprotocol"
}

variable "deploy_branch" {
  type        = string
  description = "The only branch of github_repository that can deploy this environment (Development for dev, main for prod)"
}

variable "klute_allowed_emails" {
  type        = list(string)
  description = "Google accounts allowed into /klute. Empty means nobody (the gate fails closed)."
  default     = []
}

variable "fgs_api_base_url" {
  type        = string
  description = "Future Grid Simulator backend URL that the /klute gate proxies /klute/api/* to"
}

variable "klute_backend_password_secret_id" {
  type        = string
  description = "Secret Manager ID of the backend's /klute password (gridsim-deploy's backend module creates it as <service>-klute-password). \"\" when that backend has none: /klute then loads but its simulator tab says it isn't configured."
  default     = ""
}

variable "custom_domain" {
  type        = string
  description = "Optional custom domain to attach to the Firebase Hosting site"
  default     = ""
}

variable "cloudsql_instance_name" {
  type        = string
  description = "This environment's existing gridsim Cloud SQL instance (managed in gridsim-deploy). The policy database and its user are created on it."
}

variable "policy_editor_emails" {
  type        = list(string)
  description = "Google accounts that may edit the Policy Explorer's data (its admin console and Edit mode). Empty means nobody (fails closed)."
  default     = []
}

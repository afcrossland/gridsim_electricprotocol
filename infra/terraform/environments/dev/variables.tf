variable "project_id" {
  type        = string
  description = "GCP project ID (shared with gridsim)"
}

variable "region" {
  type        = string
  description = "GCP region"
  default     = "us-central1"
}

variable "fgs_api_base_url" {
  type        = string
  description = "This environment's gridsim backend (Cloud Run URL), managed in gridsim-deploy"
}

variable "klute_backend_password_secret_id" {
  type        = string
  description = "Secret Manager ID of that backend's /klute password, or \"\" if it has none"
  default     = ""
}

variable "klute_allowed_emails" {
  type        = list(string)
  description = "Google accounts allowed into /klute"
  default     = []
}

variable "cloudsql_instance_name" {
  type        = string
  description = "This environment's gridsim Cloud SQL instance, managed in gridsim-deploy"
}

variable "policy_editor_emails" {
  type        = list(string)
  description = "Google accounts that may edit the Policy Explorer's data"
  default     = []
}

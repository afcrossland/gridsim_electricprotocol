output "site_url" {
  description = "Default Firebase Hosting URL of the Electric Futures site"
  value       = google_firebase_hosting_site.site.default_url
}

output "klute_gate_url" {
  description = "Direct Cloud Run URL of the /klute gate (normally reached through the site's /klute/)"
  value       = google_cloud_run_v2_service.klute_gate.uri
}

output "github_wif_provider" {
  description = "Set as the GitHub environment variable GCP_WIF_PROVIDER in gridsim_electricprotocol"
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "github_deploy_service_account" {
  description = "Set as the GitHub environment variable GCP_DEPLOY_SA in gridsim_electricprotocol"
  value       = google_service_account.deploy.email
}

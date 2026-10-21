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

output "database_url_secret_id" {
  description = "Secret Manager ID holding the policy database's DATABASE_URL (Cloud SQL socket form)"
  value       = google_secret_manager_secret.database_url.secret_id
}

output "cloudsql_connection_name" {
  description = "Connection name of the Cloud SQL instance the policy database lives on, for the Auth Proxy"
  value       = data.google_sql_database_instance.gridsim.connection_name
}

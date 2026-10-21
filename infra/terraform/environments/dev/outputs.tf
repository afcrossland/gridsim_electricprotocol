output "site_url" {
  value = module.electricfutures.site_url
}

output "klute_gate_url" {
  value = module.electricfutures.klute_gate_url
}

output "github_wif_provider" {
  description = "GitHub environment variable GCP_WIF_PROVIDER"
  value       = module.electricfutures.github_wif_provider
}

output "github_deploy_service_account" {
  description = "GitHub environment variable GCP_DEPLOY_SA"
  value       = module.electricfutures.github_deploy_service_account
}

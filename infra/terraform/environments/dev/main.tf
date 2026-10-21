module "electricfutures" {
  source = "../../modules/electricfutures"

  project_id                       = var.project_id
  region                           = var.region
  env                              = "dev"
  site_id                          = "electricfutures-dev"
  deploy_branch                    = "Development"
  klute_allowed_emails             = var.klute_allowed_emails
  fgs_api_base_url                 = var.fgs_api_base_url
  klute_backend_password_secret_id = var.klute_backend_password_secret_id
  cloudsql_instance_name           = var.cloudsql_instance_name

  labels = {
    project     = var.project_id
    environment = "dev"
    managed_by  = "terraform"
    app         = "electric-futures"
  }
}

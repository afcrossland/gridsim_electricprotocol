module "electricfutures" {
  source = "../../modules/electricfutures"

  project_id                       = var.project_id
  region                           = var.region
  env                              = "prod"
  site_id                          = "electricfutures-prod"
  deploy_branch                    = "main"
  klute_allowed_emails             = var.klute_allowed_emails
  fgs_api_base_url                 = var.fgs_api_base_url
  klute_backend_password_secret_id = var.klute_backend_password_secret_id

  labels = {
    project     = var.project_id
    environment = "prod"
    managed_by  = "terraform"
    app         = "electric-futures"
  }
}

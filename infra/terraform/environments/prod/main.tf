module "electricfutures" {
  source = "../../modules/electricfutures"

  project_id             = var.project_id
  region                 = var.region
  env                    = "prod"
  site_id                = "electricfutures-prod"
  deploy_branch          = "main"
  klute_allowed_emails   = var.klute_allowed_emails
  policy_editor_emails   = var.policy_editor_emails
  fgs_api_base_url       = var.fgs_api_base_url
  cloudsql_instance_name = var.cloudsql_instance_name

  alerts                      = true
  alert_notification_channels = ["projects/project-08077ad6-f39e-4a3c-b19/notificationChannels/14444410360785275114"] # made by hand; see the module's variables.tf

  labels = {
    project     = var.project_id
    environment = "prod"
    managed_by  = "terraform"
    app         = "electric-futures"
  }
}

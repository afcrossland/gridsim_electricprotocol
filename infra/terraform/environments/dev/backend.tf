# Same state bucket as gridsim-deploy, under its own prefix so the two never share state.
terraform {
  backend "gcs" {
    bucket = "gridsim-tf-state"
    prefix = "electricfutures/dev"
  }
}

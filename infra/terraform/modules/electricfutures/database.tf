# The policy database (ROADMAP.md, decision 1): its own database and login on this environment's
# existing gridsim Cloud SQL instance. The instance itself belongs to gridsim-deploy and is only
# looked up here; nothing in this file changes it.
#
# Schema and data are not Terraform's: they come from Alembic and `python -m ep_db.import_json`
# in klute/gate/. The gate's Cloud Run service (main.tf) mounts the instance's socket and reads
# the URL below, to serve /api/policy/data (ROADMAP.md Phase 1).

data "google_sql_database_instance" "gridsim" {
  project = var.project_id
  name    = var.cloudsql_instance_name
}

resource "google_sql_database" "policy" {
  project  = var.project_id
  instance = data.google_sql_database_instance.gridsim.name
  name     = "electricfutures"

  # Removing this from Terraform must never drop the data: the database is left in place.
  deletion_policy = "ABANDON"

  lifecycle {
    prevent_destroy = true
  }
}

# No special characters, so it can go straight into a connection URL.
resource "random_password" "database" {
  length  = 32
  special = false
}

# Cloud SQL makes every user created this way a member of cloudsqlsuperuser, the same as the
# gridsim user. See infra/terraform/README.md for the grants that keep the two databases apart.
resource "google_sql_user" "policy" {
  project  = var.project_id
  instance = data.google_sql_database_instance.gridsim.name
  name     = "electricfutures"
  password = random_password.database.result
}

# The whole DATABASE_URL that ep_db reads, connecting over the Cloud SQL Unix socket that Cloud Run
# mounts at /cloudsql (the same way gridsim's backend connects). Locally, run the Cloud SQL Auth
# Proxy with --unix-socket /cloudsql and the same URL works.
resource "google_secret_manager_secret" "database_url" {
  project   = var.project_id
  secret_id = "electricfutures-${var.env}-database-url"
  labels    = var.labels

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "database_url" {
  secret = google_secret_manager_secret.database_url.id
  secret_data = format(
    "postgresql+psycopg://%s:%s@/%s?host=/cloudsql/%s",
    google_sql_user.policy.name,
    random_password.database.result,
    google_sql_database.policy.name,
    data.google_sql_database_instance.gridsim.connection_name,
  )
}

# What the gate needs to read the database.
resource "google_secret_manager_secret_iam_member" "gate_database_url" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.database_url.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.gate.email}"
}

resource "google_project_iam_member" "gate_cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.gate.email}"
}

# --- The spreadsheet import (.github/workflows/import-input.yml) -------------------------------
# After regenerating src/data it brings this database into step, through the Cloud SQL Auth Proxy.
# It gets its own service account rather than the deploy one: it needs this database and nothing
# else, and the deploy account can publish the site. GitHub reaches it the same way as deploys,
# through the github-ef-<env> pool, which only trusts deploy_branch of github_repository.
resource "google_service_account" "importer" {
  project      = var.project_id
  account_id   = "ef-import-${var.env}"
  display_name = "Electric Futures spreadsheet import to the policy database (${var.env})"
}

resource "google_service_account_iam_member" "importer_wif" {
  service_account_id = google_service_account.importer.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repository}"
}

resource "google_secret_manager_secret_iam_member" "importer_database_url" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.database_url.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.importer.email}"
}

resource "google_project_iam_member" "importer_cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.importer.email}"
}

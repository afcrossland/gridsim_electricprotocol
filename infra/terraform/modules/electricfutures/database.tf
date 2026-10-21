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

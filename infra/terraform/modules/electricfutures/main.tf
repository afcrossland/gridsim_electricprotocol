# The Electric Futures site (repo afcrossland/gridsim_electricprotocol) for one environment:
# - a Firebase Hosting site for the public explorers;
# - the /klute sign-in gate on Cloud Run, which the site rewrites /klute/** to. It only serves the
#   data explorer to the Google accounts in klute_allowed_emails (Firebase Auth), and proxies the
#   explorer's simulator calls to the backend with the backend's klute password added;
# - keyless deploys from GitHub Actions through Workload Identity Federation, trusting only
#   deploy_branch of github_repository.
#
# The gate's image is deployed by that repo's CI (gcloud run deploy), not pinned here: Terraform
# owns the service's settings and ignores its image. Firebase Auth's Google sign-in provider and
# its authorized domains are set once by hand (see infra/terraform/README.md).

locals {
  gate_name = "klute-gate-${var.env}"
}

# --- Public hosting -------------------------------------------------------------------------

resource "google_firebase_hosting_site" "site" {
  provider = google-beta

  project = var.project_id
  site_id = var.site_id
}

resource "google_firebase_hosting_custom_domain" "site_domain" {
  count    = var.custom_domain != "" ? 1 : 0
  provider = google-beta

  project       = var.project_id
  site_id       = google_firebase_hosting_site.site.site_id
  custom_domain = var.custom_domain
}

# The Firebase web app whose config the gate's sign-in page uses. The API key in that config
# identifies the project to Firebase Auth; it is public by design, not a secret.
resource "google_firebase_web_app" "klute" {
  provider = google-beta

  project      = var.project_id
  display_name = "Electric Futures data explorer (${var.env})"
}

data "google_firebase_web_app_config" "klute" {
  provider = google-beta

  project    = var.project_id
  web_app_id = google_firebase_web_app.klute.app_id
}

# --- /klute gate ----------------------------------------------------------------------------

resource "google_artifact_registry_repository" "repo" {
  project       = var.project_id
  location      = var.region
  repository_id = "electricfutures-repo-${var.env}"
  description   = "Docker images for the Electric Futures /klute gate"
  format        = "DOCKER"
  labels        = var.labels
}

resource "google_service_account" "gate" {
  project      = var.project_id
  account_id   = local.gate_name
  display_name = "Electric Futures /klute gate (${var.env})"
}

resource "google_artifact_registry_repository_iam_member" "gate_pull" {
  project    = var.project_id
  location   = var.region
  repository = google_artifact_registry_repository.repo.name
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${google_service_account.gate.email}"
}

# Signs the gate's session cookies. Generated here, like the database password in
# modules/database, so it does sit in Terraform state.
resource "random_password" "session_key" {
  length  = 64
  special = false
}

resource "google_secret_manager_secret" "session_key" {
  project   = var.project_id
  secret_id = "${local.gate_name}-session-key"
  labels    = var.labels

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "session_key" {
  secret      = google_secret_manager_secret.session_key.id
  secret_data = random_password.session_key.result
}

resource "google_secret_manager_secret_iam_member" "gate_session_key" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.session_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.gate.email}"
}

resource "google_secret_manager_secret_iam_member" "gate_backend_password" {
  count     = var.klute_backend_password_secret_id != "" ? 1 : 0
  project   = var.project_id
  secret_id = var.klute_backend_password_secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.gate.email}"
}

resource "google_cloud_run_v2_service" "klute_gate" {
  name                = local.gate_name
  location            = var.region
  project             = var.project_id
  labels              = var.labels
  deletion_protection = false

  template {
    service_account = google_service_account.gate.email

    scaling {
      min_instance_count = 0
      max_instance_count = 2
    }

    # The Cloud SQL socket for the policy database (database.tf), mounted the way gridsim's
    # backend mounts its own.
    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [data.google_sql_database_instance.gridsim.connection_name]
      }
    }

    containers {
      # Placeholder until the repo's first deploy; CI owns the image from then on.
      image = "us-docker.pkg.dev/cloudrun/container/hello"

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle = true
      }

      env {
        name  = "FIREBASE_PROJECT_ID"
        value = var.project_id
      }

      env {
        name  = "FIREBASE_API_KEY"
        value = data.google_firebase_web_app_config.klute.api_key
      }

      env {
        name  = "FIREBASE_AUTH_DOMAIN"
        value = data.google_firebase_web_app_config.klute.auth_domain
      }

      env {
        name  = "KLUTE_ALLOWED_EMAILS"
        value = join(",", var.klute_allowed_emails)
      }

      # Who may change the policy data through the API (klute/gate/ep_db/auth.py). Separate from
      # /klute's list: seeing the explorer and editing the public data are different permissions.
      env {
        name  = "POLICY_EDITOR_EMAILS"
        value = join(",", var.policy_editor_emails)
      }

      env {
        name  = "FGS_API_BASE_URL"
        value = var.fgs_api_base_url
      }

      env {
        name = "KLUTE_SESSION_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.session_key.secret_id
            version = "latest"
          }
        }
      }

      # The policy database (database.tf), read by /api/policy/data over the socket mounted below.
      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.database_url.secret_id
            version = "latest"
          }
        }
      }

      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }

      dynamic "env" {
        for_each = var.klute_backend_password_secret_id != "" ? [1] : []
        content {
          name = "KLUTE_BACKEND_PASSWORD"
          value_source {
            secret_key_ref {
              secret  = var.klute_backend_password_secret_id
              version = "latest"
            }
          }
        }
      }
    }
  }

  # Firebase Hosting reaches Cloud Run over the public internet. The gate does its own sign-in.
  ingress = "INGRESS_TRAFFIC_ALL"

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
      client,
      client_version,
      # Service-level scaling defaults the API fills in; instance limits are set in template.
      scaling,
    ]
  }

  depends_on = [
    google_secret_manager_secret_version.session_key,
    google_secret_manager_secret_iam_member.gate_session_key,
    google_secret_manager_secret_iam_member.gate_backend_password,
    google_secret_manager_secret_version.database_url,
    google_secret_manager_secret_iam_member.gate_database_url,
    google_project_iam_member.gate_cloudsql_client,
  ]
}

resource "google_cloud_run_v2_service_iam_member" "gate_public" {
  project  = google_cloud_run_v2_service.klute_gate.project
  location = google_cloud_run_v2_service.klute_gate.location
  name     = google_cloud_run_v2_service.klute_gate.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# --- GitHub Actions deploys (Workload Identity Federation) ------------------------------------

# GitHub's federated token is exchanged (STS) and then used to impersonate the deploy service
# account (IAM Credentials). Without the latter the first deploy failed at docker auth. The
# project is shared with gridsim and both environments declare these, so they are never
# disabled on destroy.
resource "google_project_service" "wif" {
  for_each = toset([
    "iamcredentials.googleapis.com",
    "sts.googleapis.com",
  ])
  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_iam_workload_identity_pool" "github" {
  project                   = var.project_id
  workload_identity_pool_id = "github-ef-${var.env}"
  display_name              = "GitHub: Electric Futures ${var.env}"
}

# Only tokens from deploy_branch of github_repository are accepted at all.
resource "google_iam_workload_identity_pool_provider" "github" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github"
  display_name                       = "GitHub Actions"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }
  attribute_condition = "assertion.repository == '${var.github_repository}' && assertion.ref == 'refs/heads/${var.deploy_branch}'"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account" "deploy" {
  project      = var.project_id
  account_id   = "ef-deploy-${var.env}"
  display_name = "Electric Futures GitHub deploys (${var.env})"
}

resource "google_service_account_iam_member" "deploy_wif" {
  service_account_id = google_service_account.deploy.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repository}"
}

resource "google_artifact_registry_repository_iam_member" "deploy_push" {
  project    = var.project_id
  location   = var.region
  repository = google_artifact_registry_repository.repo.name
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${google_service_account.deploy.email}"
}

resource "google_cloud_run_v2_service_iam_member" "deploy_gate" {
  project  = google_cloud_run_v2_service.klute_gate.project
  location = google_cloud_run_v2_service.klute_gate.location
  name     = google_cloud_run_v2_service.klute_gate.name
  role     = "roles/run.developer"
  member   = "serviceAccount:${google_service_account.deploy.email}"
}

# `gcloud run deploy` has to act as the gate's runtime service account.
resource "google_service_account_iam_member" "deploy_act_as_gate" {
  service_account_id = google_service_account.gate.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.deploy.email}"
}

# Firebase Hosting roles can't be scoped to one site, so this account could also deploy the
# project's other hosting sites (gridsim-frontend). run.viewer lets the Firebase CLI check the
# /klute rewrite target; serviceUsageConsumer lets it call Firebase APIs as this account.
resource "google_project_iam_member" "deploy_project_roles" {
  for_each = toset([
    "roles/firebasehosting.admin",
    "roles/run.viewer",
    "roles/serviceusage.serviceUsageConsumer",
  ])
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.deploy.email}"
}

project_id       = "project-08077ad6-f39e-4a3c-b19"
fgs_api_base_url = "https://gridsim-backend-prod-605425219883.us-central1.run.app"
klute_backend_password_secret_id = "gridsim-backend-prod-klute-password"

# Google accounts allowed into /klute. Empty locks everyone out.
klute_allowed_emails = ["a.f.crossland@gmail.com", "cai.caermai@gmail.com"]

# The gridsim Cloud SQL instance the policy database is created on (gridsim-deploy owns it).
cloudsql_instance_name = "gridsim-prod-db"

# Google accounts that may edit the Policy Explorer's data (admin console, Edit mode). Empty locks
# everyone out.
policy_editor_emails = ["a.f.crossland@gmail.com", "cai.caermai@gmail.com"]

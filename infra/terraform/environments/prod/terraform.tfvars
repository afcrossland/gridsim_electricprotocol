project_id       = "project-08077ad6-f39e-4a3c-b19"
fgs_api_base_url = "https://gridsim-backend-prod-605425219883.us-central1.run.app"
# The prod backend has no klute password yet (gridsim-deploy enable_klute_password is off), so
# /klute signs in but its simulator tab says it is not configured.
klute_backend_password_secret_id = ""

# Google accounts allowed into /klute. Empty locks everyone out.
klute_allowed_emails = ["a.f.crossland@gmail.com", "cai.caermai@gmail.com"]

# The gridsim Cloud SQL instance the policy database is created on (gridsim-deploy owns it).
cloudsql_instance_name = "gridsim-prod-db"

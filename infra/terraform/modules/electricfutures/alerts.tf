# Uptime check on the public site and an error count on the gate. Off unless `alerts` is set: on prod
# only. Backend and database alerts are in gridsim-deploy (modules/alerts).

resource "google_monitoring_uptime_check_config" "site" {
  count = var.alerts ? 1 : 0

  project      = var.project_id
  display_name = "Electric Futures site (${var.env})"
  period       = "300s"
  timeout      = "30s"
  # Three checkers, the fewest allowed; the plain "USA" region would add three. The site is static
  # hosting, so this doesn't wake the gate.
  selected_regions = ["USA_IOWA", "EUROPE", "ASIA_PACIFIC"]

  http_check {
    path         = "/"
    port         = 443
    use_ssl      = true
    validate_ssl = true
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = trimprefix(google_firebase_hosting_site.site.default_url, "https://")
    }
  }
}

resource "google_monitoring_alert_policy" "site_down" {
  count = var.alerts ? 1 : 0

  project               = var.project_id
  display_name          = "Electric Futures site is down (${var.env})"
  combiner              = "OR"
  severity              = "CRITICAL"
  notification_channels = var.alert_notification_channels
  user_labels           = var.labels

  conditions {
    display_name = "Uptime check fails from at least two regions"
    condition_threshold {
      filter          = "resource.type = \"uptime_url\" AND metric.type = \"monitoring.googleapis.com/uptime_check/check_passed\" AND metric.labels.check_id = \"${google_monitoring_uptime_check_config.site[0].uptime_check_id}\""
      comparison      = "COMPARISON_GT"
      threshold_value = 1
      duration        = "0s"
      aggregations {
        alignment_period     = "600s"
        per_series_aligner   = "ALIGN_NEXT_OLDER"
        cross_series_reducer = "REDUCE_COUNT_FALSE"
        group_by_fields      = ["resource.label.*"]
      }
      trigger {
        count = 1
      }
    }
  }

  documentation {
    mime_type = "text/markdown"
    content   = "${google_firebase_hosting_site.site.default_url} failed from two or more regions."
  }

  alert_strategy {
    auto_close = "1800s"
  }
}

# 503 is left out: the prod policy database is still empty, and its data endpoints answer 503 by design.
resource "google_monitoring_alert_policy" "gate_errors" {
  count = var.alerts ? 1 : 0

  project               = var.project_id
  display_name          = "${local.gate_name} errors"
  combiner              = "OR"
  severity              = "ERROR"
  notification_channels = var.alert_notification_channels
  user_labels           = var.labels

  conditions {
    display_name = "3 or more 500s or 504s in 10 minutes"
    condition_threshold {
      filter          = "resource.type = \"cloud_run_revision\" AND resource.labels.service_name = \"${local.gate_name}\" AND metric.type = \"run.googleapis.com/request_count\" AND metric.labels.response_code = one_of(\"500\", \"504\")"
      comparison      = "COMPARISON_GT"
      threshold_value = 2
      duration        = "0s"
      aggregations {
        alignment_period     = "600s"
        per_series_aligner   = "ALIGN_DELTA"
        cross_series_reducer = "REDUCE_SUM"
      }
      trigger {
        count = 1
      }
    }
  }

  documentation {
    mime_type = "text/markdown"
    content   = "The /klute gate (${local.gate_name}) answered 3 or more requests with a 500 or 504 in 10 minutes. Check its logs, and whether the FGS backend is slow."
  }

  alert_strategy {
    auto_close = "1800s"
  }
}

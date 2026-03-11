variable "github_token" {
  description = "GitHub personal access token with repo and admin:repo_hook scopes. Only needed when rotating the token — ignored during normal operations."
  type        = string
  sensitive   = true
  default     = null
}

variable "domain_name" {
  description = "Root domain name"
  type        = string
  default     = "rsmb.tv"
}

variable "alert_email" {
  description = "Email address for monitoring alerts (budget, anomaly, health check)"
  type        = string
}

variable "monthly_budget_limit" {
  description = "Monthly AWS spend budget limit in USD"
  type        = string
  default     = "35"
}

locals {
  www_domain = "www.${var.domain_name}"
  common_tags = {
    Project   = var.domain_name
    ManagedBy = "terraform"
  }
}

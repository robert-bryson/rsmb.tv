
terraform {
  required_version = ">= 1.3"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    # Optional: GitHub provider if you want to interact with GitHub in Terraform
    github = {
      source  = "integrations/github"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region  = "us-east-1"
  profile = "rsmbtv" # Or specify a named profile from your AWS credentials file
}

# Optional: GitHub provider configuration (only needed if you plan to use it)
# provider "github" {
#   token = var.github_token
#   owner = var.github_owner
# }


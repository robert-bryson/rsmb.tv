
terraform {
  required_version = ">= 1.15, < 2.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  backend "s3" {
    bucket       = "rsmbtv-terraform-state"
    key          = "rsmb.tv/terraform.tfstate"
    region       = "us-east-1"
    use_lockfile = true
    encrypt      = true
    profile      = "rsmbtv-admin"
  }
}

provider "aws" {
  region  = "us-east-1"
  profile = "rsmbtv-admin"
}

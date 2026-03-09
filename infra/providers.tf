
terraform {
  required_version = ">= 1.3"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "rsmbtv-terraform-state"
    key            = "rsmb.tv/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-locks"
    encrypt        = true
    profile        = "rsmbtv-admin"
  }
}

provider "aws" {
  region  = "us-east-1"
  profile = "rsmbtv-admin"
}


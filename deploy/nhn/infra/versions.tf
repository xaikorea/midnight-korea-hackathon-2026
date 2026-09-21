terraform {
  required_version = ">= 1.7.0, < 2.0.0"
  required_providers {
    nhncloud = {
      source  = "nhn-cloud/nhncloud"
      version = "1.0.9"
    }
  }
  # Local state initially: keep it private, encrypted at rest, and backed up.
  # No application secrets or SSH private keys belong in this configuration.
}

provider "nhncloud" {
  user_name = var.nhn_username
  tenant_id = var.nhn_tenant_id
  password  = var.nhn_api_password
  auth_url  = var.nhn_auth_url
  region    = var.region
}

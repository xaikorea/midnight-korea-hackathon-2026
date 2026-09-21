variable "nhn_username" {
  type        = string
  sensitive   = true
  description = "NHN Cloud API user; provide via TF_VAR_nhn_username."
}
variable "nhn_tenant_id" {
  type        = string
  description = "Existing project's Compute API tenant ID (not its display name)."
}
variable "nhn_api_password" {
  type        = string
  sensitive   = true
  description = "Compute API password, supplied via TF_VAR_nhn_api_password only."
}
variable "nhn_auth_url" {
  type    = string
  default = "https://api-identity-infrastructure.nhncloudservice.com/v2.0"
  validation {
    condition     = startswith(var.nhn_auth_url, "https://")
    error_message = "Use the HTTPS Identity endpoint shown in the selected project's console."
  }
}
variable "region" {
  type        = string
  description = "Selected existing project's domestic region; confirm in the console."
  validation {
    condition     = contains(["KR1", "KR2"], var.region)
    error_message = "This demo configuration supports KR1 or KR2."
  }
}
variable "availability_zone" {
  type        = string
  description = "Availability zone actually available to this tenant."
}
variable "network_id" {
  type        = string
  description = "Existing VPC with Internet Gateway connectivity. It is not modified."
}
variable "subnet_id" {
  type        = string
  description = "Existing subnet in network_id. It is not modified."
}
variable "image_id" {
  type        = string
  description = "Verified Ubuntu 24.04 x86_64 official image UUID."
}
variable "flavor_id" {
  type        = string
  description = "Verified volume-backed CPU flavor UUID. Initial target: 8 GiB RAM, 2-4 vCPU; no u2/local-root flavor."
}
variable "root_volume_type" {
  type        = string
  description = "An available Block Storage volume type from this tenant; select based on the quote."
}
variable "root_volume_gb" {
  type    = number
  default = 80
  validation {
    condition     = var.root_volume_gb >= 30 && var.root_volume_gb <= 120
    error_message = "Keep demo boot/data storage between 30 and 120 GiB; default 80."
  }
}
variable "floating_ip_pool" {
  type    = string
  default = "Public Network"
}
variable "ssh_public_key" {
  type        = string
  description = "Existing administrator OpenSSH public key only; private key stays outside Terraform."
  validation {
    condition     = can(regex("^ssh-(ed25519|rsa) [A-Za-z0-9+/=]+", var.ssh_public_key))
    error_message = "Supply an OpenSSH public key, never a private key."
  }
}
variable "admin_cidr" {
  type        = string
  description = "Administrator's public IPv4 address with /32 for SSH."
  validation {
    condition     = can(cidrnetmask(var.admin_cidr)) && endswith(var.admin_cidr, "/32")
    error_message = "SSH must be limited to one verified administrator IPv4 /32."
  }
}
variable "name" {
  type    = string
  default = "bizproof-demo"
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,30}$", var.name))
    error_message = "Use a short lowercase resource name."
  }
}

output "public_ip" {
  value = nhncloud_networking_floatingip_v2.demo.address
}
output "instance_id" {
  value = nhncloud_compute_instance_v2.demo.id
}
output "gabia_dns_record" {
  value = {
    zone  = "xaikorea.ai.kr"
    host  = "bizproof"
    type  = "A"
    value = nhncloud_networking_floatingip_v2.demo.address
    ttl   = 300
  }
  description = "Add only this record at existing Gabia DNS. Terraform does not manage that zone."
}
output "service_url" {
  value       = "https://bizproof.xaikorea.ai.kr"
  description = "Planned URL; usable only after application release, DNS and TLS checks pass."
}

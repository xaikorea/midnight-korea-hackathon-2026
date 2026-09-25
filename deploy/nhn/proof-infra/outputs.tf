output "public_ip" {
  value = nhncloud_networking_floatingip_v2.demo.address
}
output "instance_id" {
  value = nhncloud_compute_instance_v2.demo.id
}
output "private_ip" {
  value = nhncloud_networking_port_v2.demo.all_fixed_ips
}

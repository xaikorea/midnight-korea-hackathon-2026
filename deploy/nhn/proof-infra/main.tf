resource "nhncloud_compute_keypair_v2" "admin" {
  name       = "${var.name}-admin"
  public_key = var.ssh_public_key
}

resource "nhncloud_networking_secgroup_v2" "demo" {
  name = "${var.name}-private"
}


resource "nhncloud_networking_secgroup_rule_v2" "ssh" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 22
  port_range_max    = 22
  remote_ip_prefix  = var.admin_cidr
  security_group_id = nhncloud_networking_secgroup_v2.demo.id
}

# Only the existing web host can deliver encrypted replicas over the private VPC.
resource "nhncloud_networking_secgroup_rule_v2" "backup" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 22
  port_range_max    = 22
  remote_ip_prefix  = "192.0.2.10/32"
  security_group_id = nhncloud_networking_secgroup_v2.demo.id
}

resource "nhncloud_networking_secgroup_rule_v2" "ssh_additional" {
  for_each          = var.additional_admin_cidrs
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 22
  port_range_max    = 22
  remote_ip_prefix  = each.value
  security_group_id = nhncloud_networking_secgroup_v2.demo.id
}

resource "nhncloud_networking_port_v2" "demo" {
  name               = "${var.name}-port"
  network_id         = var.network_id
  admin_state_up     = true
  security_group_ids = [nhncloud_networking_secgroup_v2.demo.id]
  fixed_ip {
    subnet_id = var.subnet_id
  }
}

resource "nhncloud_blockstorage_volume_v2" "root" {
  name              = "${var.name}-root"
  size              = var.root_volume_gb
  image_id          = var.image_id
  volume_type       = var.root_volume_type
  availability_zone = var.availability_zone
  lifecycle {
    prevent_destroy = true
  }
}

resource "nhncloud_compute_instance_v2" "demo" {
  name              = var.name
  flavor_id         = var.flavor_id
  availability_zone = var.availability_zone
  key_pair          = nhncloud_compute_keypair_v2.admin.name
  user_data         = file("${path.module}/cloud-init.yaml")
  network {
    port = nhncloud_networking_port_v2.demo.id
  }
  block_device {
    uuid                  = nhncloud_blockstorage_volume_v2.root.id
    source_type           = "volume"
    destination_type      = "volume"
    boot_index            = 0
    delete_on_termination = false
  }
  lifecycle {
    prevent_destroy = true
  }
}

resource "nhncloud_networking_floatingip_v2" "demo" {
  pool = var.floating_ip_pool
  lifecycle {
    prevent_destroy = true
  }
}

resource "nhncloud_networking_floatingip_associate_v2" "demo" {
  floating_ip = nhncloud_networking_floatingip_v2.demo.address
  port_id     = nhncloud_networking_port_v2.demo.id
  depends_on  = [nhncloud_compute_instance_v2.demo]
}


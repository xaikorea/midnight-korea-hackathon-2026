# Application cannot create, rotate, export or delete keys, manage policy,
# change audit devices, or read arbitrary KV secrets.
path "transit/keys/bizproof-workspaces" {
  capabilities = ["read"]
}
path "transit/encrypt/bizproof-workspaces" {
  capabilities = ["update"]
}
path "transit/decrypt/bizproof-workspaces" {
  capabilities = ["update"]
}
path "transit/rewrap/bizproof-workspaces" {
  capabilities = ["update"]
}

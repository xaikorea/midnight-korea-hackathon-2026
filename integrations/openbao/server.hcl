# Local development only. Use TLS and an HA backend in production.
ui = true
disable_mlock = false
storage "file" {
  path = "/bao/data"
}
listener "tcp" {
  address = "0.0.0.0:8200"
  tls_disable = true
}
api_addr = "http://127.0.0.1:8200"

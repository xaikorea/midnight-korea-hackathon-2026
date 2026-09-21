declare namespace Cloudflare {
  interface Env {
    BIZPROOF_SERVICE_ADMIN_IDS?: string;
    BIZPROOF_ANALYTICS_CLOUDFLARE?: string;
    BIZPROOF_ANALYTICS_LOCAL_PREVIEW?: string;
    BIZPROOF_MALWARE_SCAN?: string;
    CLAMAV_BRIDGE_URL?: string;
    CLAMAV_BRIDGE_TOKEN?: string;
    BIZPROOF_ACCESS_CONTROL?: string;
    OPENFGA_URL?: string;
    OPENFGA_STORE_ID?: string;
    OPENFGA_MODEL_ID?: string;
    OPENFGA_TOKEN?: string;
    WALTID_VERIFIER_URL?: string;
    WALTID_VERIFIER_PUBLIC_ORIGIN?: string;
    WALTID_VERIFIER_TOKEN?: string;
    BIZPROOF_WORKSPACE_MEMBERSHIPS?: string;
    BIZPROOF_POLICY_ENGINE?: string;
    OPA_ADDR?: string;
    OPA_TOKEN?: string;
    BIZPROOF_STORAGE_PROTECTION?: string;
    OPENBAO_ADDR?: string;
    OPENBAO_TOKEN?: string;
    OPENBAO_TRANSIT_MOUNT?: string;
    OPENBAO_TRANSIT_KEY?: string;
    BIZPROOF_AUTH_MODE?: string;
    KEYCLOAK_ISSUER?: string;
    KEYCLOAK_CLIENT_ID?: string;
    BIZPROOF_APP_ORIGIN?: string;
    KEYCLOAK_SESSION_SECRET?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}

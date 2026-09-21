import {env} from 'cloudflare:workers';
import {keycloakConfig} from './keycloak';
export function authenticationMode(){if(!env.BIZPROOF_AUTH_MODE||env.BIZPROOF_AUTH_MODE==='demo')return 'demo';if(env.BIZPROOF_AUTH_MODE==='keycloak')return 'keycloak';throw Error('Invalid authentication mode');}
export function identityConfig(){return keycloakConfig({issuer:env.KEYCLOAK_ISSUER,clientId:env.KEYCLOAK_CLIENT_ID,origin:env.BIZPROOF_APP_ORIGIN,secret:env.KEYCLOAK_SESSION_SECRET});}

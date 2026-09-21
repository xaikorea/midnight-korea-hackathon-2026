import {accessConfig} from '@/lib/openfga-runtime';
import {intersectFgaRoles} from '@/lib/openfga';
import {env} from 'cloudflare:workers';
import {publicDemo,verifyDemo,demoCookie} from '@/lib/public-demo';
import {workspaceMembership} from '@/lib/workspace-membership';
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {cookies} from 'next/headers';
import {authenticationMode,identityConfig} from '@/lib/keycloak-runtime';
import {validateAccess,businessRoles,selectRole} from '@/lib/keycloak';
import type {Role} from '@/lib/domain';

export type ChatGPTUser = {
  userId: string;
  storageOwner: string;
  workspaceKind: "personal"|"shared";
  organization: string|null;
  displayName: string;
  email: string;
  fullName: string | null;
  allowedRoles: Role[];
  authMode: 'demo'|'keycloak';
};

const USER_ID_HEADER = "oai-authenticated-user-id";
const USER_EMAIL_HEADER = "oai-authenticated-user-email";
const USER_FULL_NAME_HEADER = "oai-authenticated-user-full-name";
const USER_FULL_NAME_ENCODING_HEADER =
  "oai-authenticated-user-full-name-encoding";
const PERCENT_ENCODED_UTF8 = "percent-encoded-utf-8";
const SIGN_IN_PATH = "/signin-with-chatgpt";
const SIGN_OUT_PATH = "/signout-with-chatgpt";
const CALLBACK_PATH = "/callback";

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  if(publicDemo()){
    const id=await verifyDemo((await cookies()).get(demoCookie)?.value??'');
    if(id&&await env.DB!.prepare('SELECT id FROM demo_sessions WHERE id=? AND expires>?').bind(id,Date.now()).first())return {userId:id,storageOwner:id,workspaceKind:'personal',organization:null,displayName:'공개 체험 사용자',email:'demo@example.invalid',fullName:null,allowedRoles:businessRoles,authMode:'demo'};
    if(authenticationMode()!=='keycloak')return null;
  }
  try{if(authenticationMode()==='keycloak'){const token=(await cookies()).get('bizproof-access')?.value;if(!token)return null;const user=await validateAccess(identityConfig(),token);const member={...user,...workspaceMembership(user,env.BIZPROOF_WORKSPACE_MEMBERSHIPS)};const allowedRoles=await intersectFgaRoles(member,accessConfig());return allowedRoles.length?{...member,allowedRoles}:null;}}catch{return null;}
  try{if(accessConfig())return null;}catch{return null;}
  const requestHeaders = await headers();
  const userId = requestHeaders.get(USER_ID_HEADER);
  const email = requestHeaders.get(USER_EMAIL_HEADER);
  if (!userId || !email) return null;

  const encodedFullName = requestHeaders.get(USER_FULL_NAME_HEADER);
  const fullName =
    encodedFullName &&
    requestHeaders.get(USER_FULL_NAME_ENCODING_HEADER) === PERCENT_ENCODED_UTF8
      ? safeDecodeURIComponent(encodedFullName)
      : null;

  return {
    userId,
    storageOwner:userId,workspaceKind:"personal",organization:null,
    displayName: fullName ?? email,
    email,
    fullName,
    allowedRoles:businessRoles,
    authMode:'demo',
  };
}

export async function getActiveRole(){const user=await getChatGPTUser();return user?selectRole(user.allowedRoles,(await cookies()).get('bizproof-persona')?.value):null;}

export async function requireChatGPTUser(
  returnTo: string,
): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;

  redirect(chatGPTSignInPath(returnTo));
}

export function chatGPTSignInPath(returnTo: string): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `/api/auth/login?return_to=${encodeURIComponent(safeReturnTo)}`;
}

export function chatGPTSignOutPath(returnTo = "/"): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${SIGN_OUT_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";

  let url: URL;
  try {
    url = new URL(value, "https://app.local");
  } catch {
    return "/";
  }
  if (url.origin !== "https://app.local") return "/";
  if (isReservedAuthPath(url.pathname)) return "/";

  return `${url.pathname}${url.search}${url.hash}`;
}

function isReservedAuthPath(pathname: string): boolean {
  return (
    pathname === SIGN_IN_PATH ||
    pathname === SIGN_OUT_PATH ||
    pathname === CALLBACK_PATH
  );
}

function safeDecodeURIComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

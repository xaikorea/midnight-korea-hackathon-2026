import {z} from 'zod';
import type {Role} from './domain';
const roles=z.enum(['admin','issuer','company','buyer','grant']);
const membership=z.object({userId:z.string().min(1),workspaceId:z.string().regex(/^[a-z0-9-]{3,64}$/),organization:z.string().trim().min(1).max(120),roles:z.array(roles).min(1)}).strict();
export function workspaceMembership(user:{userId:string;authMode:'demo'|'keycloak';allowedRoles:Role[]},config?:string){
 const personal={storageOwner:user.userId,workspaceKind:'personal' as const,organization:null as string|null,allowedRoles:user.allowedRoles};
 if(!config)return personal;
 const members=z.array(membership).max(500).parse(JSON.parse(config));
 if(new Set(members.map(m=>m.userId)).size!==members.length)throw Error('Duplicate workspace membership');
 // One participating organization per business role in each collaboration room.
 for(const m of members)for(const role of m.roles.filter(r=>r!=='admin'))if(members.some(n=>n.workspaceId===m.workspaceId&&n.roles.includes(role)&&n.organization!==m.organization))throw Error('Conflicting organization assignments');
 const m=members.find(m=>m.userId===user.userId);if(!m)return personal;
 if(user.authMode!=='keycloak')throw Error('Shared workspaces require verified identity');
 const allowedRoles=user.allowedRoles.filter(r=>m.roles.includes(r));if(!allowedRoles.length)throw Error('No workspace role');
 return {storageOwner:'shared:'+m.workspaceId,workspaceKind:'shared' as const,organization:m.organization,allowedRoles};
}

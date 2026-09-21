import {env} from 'cloudflare:workers';
import {fgaConfig,fgaClient,fgaUser,fgaCompany,FgaError} from './openfga';
export function accessConfig(){return fgaConfig({mode:env.BIZPROOF_ACCESS_CONTROL,address:env.OPENFGA_URL,storeId:env.OPENFGA_STORE_ID,modelId:env.OPENFGA_MODEL_ID,token:env.OPENFGA_TOKEN});}
export async function requireEvidenceAccess(user:{userId:string;storageOwner:string;authMode?:string},companyId:string,operation:'read'|'write'){
 const config=accessConfig();if(!config){if(user.authMode==='keycloak')throw new FgaError();return;}
 if(!await fgaClient(config).check(fgaUser(user.userId),'can_'+operation+'_evidence',fgaCompany(user.storageOwner,companyId)))throw new FgaError(403);
}

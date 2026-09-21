import { canonical } from './domain';
const bytes=(x:unknown)=>new TextEncoder().encode(canonical(x));
export async function makeKeys(){const k=await crypto.subtle.generateKey({name:'Ed25519'},true,['sign','verify']) as CryptoKeyPair;return {publicKey:await crypto.subtle.exportKey('jwk',k.publicKey),privateKey:await crypto.subtle.exportKey('jwk',k.privateKey)};}
export async function sign(privateKey:JsonWebKey,payload:unknown){const k=await crypto.subtle.importKey('jwk',privateKey,{name:'Ed25519'},false,['sign']);const s=new Uint8Array(await crypto.subtle.sign('Ed25519',k,bytes(payload)));return btoa(String.fromCharCode(...s));}
export async function verify(publicKey:JsonWebKey,payload:unknown,signature:string){try{const k=await crypto.subtle.importKey('jwk',publicKey,{name:'Ed25519'},false,['verify']);return await crypto.subtle.verify('Ed25519',k,Uint8Array.from(atob(signature),x=>x.charCodeAt(0)),bytes(payload));}catch{return false;}}
export async function digest(payload:unknown){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes(payload)))).map(x=>x.toString(16).padStart(2,'0')).join('');}

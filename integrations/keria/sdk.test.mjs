import test from 'node:test';
import assert from 'node:assert/strict';
import {ready,Signer,SignifyClient,Authenticater} from 'signify-ts';
import {authorizationHeaders} from './core.mjs';

test('official Signify SDK signs holder authorization and rejects modified path/signature',async()=>{
 await ready();const signer=new Signer({}),aid=signer.verfer.qb64;
 const client={identifiers:()=>({get:async()=>({prefix:aid,state:{k:[signer.verfer.qb64],kt:'1'}})}),manager:{get:()=>({signers:[signer]})},createSignedRequest:SignifyClient.prototype.createSignedRequest};
 const headers=new Headers(await authorizationHeaders(client,'fixture',aid));
 const auth=new Authenticater(signer,signer.verfer),path='/authorizations/'+aid;
 assert.equal(auth.verify(headers,'GET',path),true);
 assert.throws(()=>auth.verify(headers,'GET',path+'changed'));
 assert.throws(()=>auth.verify(headers,'POST',path));
 headers.set('signify-resource','E'+'z'.repeat(43));assert.throws(()=>auth.verify(headers,'GET',path));
});

test('official SDK validates agent signatures before returning response',async()=>{
 const signer=new Signer({}),agent=new Signer({});const auth=new Authenticater(agent,agent.verfer);
 const client={url:'http://127.0.0.1:3901',controller:{pre:signer.verfer.qb64},agent:{pre:agent.verfer.qb64},authn:new Authenticater(signer,agent.verfer)};
 const original=globalThis.fetch;let corrupt=false;
 globalThis.fetch=async()=>{const headers=auth.sign(new Headers({'signify-resource':agent.verfer.qb64,'signify-timestamp':new Date().toISOString()}),'GET','/identifiers');if(corrupt)headers.delete('signature');return Response.json([],{headers});};
 try{assert.deepEqual(await (await SignifyClient.prototype.fetch.call(client,'/identifiers','GET')).json(),[]);corrupt=true;await assert.rejects(SignifyClient.prototype.fetch.call(client,'/identifiers','GET'),/verification/);}finally{globalThis.fetch=original;}
});

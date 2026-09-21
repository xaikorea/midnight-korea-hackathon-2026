"use client";
import {useSyncExternalStore} from 'react';
const event='bizproof:navigate';
function subscribe(callback:()=>void){window.addEventListener('popstate',callback);window.addEventListener(event,callback);return()=>{window.removeEventListener('popstate',callback);window.removeEventListener(event,callback);};}
export function useWorkspaceLocation(){return useSyncExternalStore(subscribe,()=>window.location.search,()=>'');}
export function navigateWorkspace(search:string){if(window.location.search!==search)history.pushState(null,'',search);window.dispatchEvent(new Event(event));}

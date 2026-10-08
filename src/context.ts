import { createContext, useContext } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Store } from './storage';
export type Page='home'|'practice'|'simulation'|'review'|'collection'|'progress'|'settings';
export const AppContext=createContext<{store:Store;setStore:Dispatch<SetStateAction<Store>>;notify:(text:string)=>void;go:(p:Page)=>void;openPractice:(id?:string)=>void;aiReady:boolean|null;accessRequired:boolean}>({} as never);
export const useApp=()=>useContext(AppContext);

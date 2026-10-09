import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { z } from 'zod';
import { scenarios } from '../shared/scenarios';
import { personas } from '../shared/personas';
import { feedbackSchema, recapSchema, turnSchema } from '../shared/types';
import { practiceInput, simulationInput, recapInput } from '../shared/api-contract';
import { systemRules } from '../server/ai';
import { aiTasks } from '../server/prompts';

// Export the same Zod field constraints to the standard-library Python runtime.
// Cross-field checks (unique dimensions, exact quotations, total text) run separately.
function jsonSchema(schema:z.ZodTypeAny):Record<string,unknown>{
  const d=schema._def as any;
  if(d.typeName==='ZodEffects'||d.typeName==='ZodOptional')return jsonSchema(d.schema??d.innerType);
  if(d.typeName==='ZodObject'){
    const shape=d.shape();
    return {type:'object',properties:Object.fromEntries(Object.entries(shape).map(([key,value])=>[key,jsonSchema(value as z.ZodTypeAny)])),required:Object.keys(shape).filter(key=>!shape[key].isOptional())};
  }
  if(d.typeName==='ZodArray')return {type:'array',items:jsonSchema(d.type),...(d.minLength?{minItems:d.minLength.value}:{}),...(d.maxLength?{maxItems:d.maxLength.value}:{}),...(d.exactLength?{minItems:d.exactLength.value,maxItems:d.exactLength.value}:{})};
  if(d.typeName==='ZodEnum')return {type:'string',enum:d.values};
  if(d.typeName==='ZodBoolean')return {type:'boolean'};
  if(d.typeName==='ZodString')return {type:'string',...(d.checks.some((c:any)=>c.kind==='trim')?{trim:true}:{}),...Object.fromEntries(d.checks.filter((c:any)=>['min','max'].includes(c.kind)).map((c:any)=>[c.kind==='min'?'minLength':'maxLength',c.value]))};
  if(d.typeName==='ZodNumber')return {type:d.checks.some((c:any)=>c.kind==='int')?'integer':'number',...Object.fromEntries(d.checks.filter((c:any)=>['min','max'].includes(c.kind)).map((c:any)=>[c.kind==='min'?'minimum':'maximum',c.value]))};
  throw new Error('Unsupported portable schema: '+d.typeName);
}

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const temp=path.join(root,'.portable-build');const out=path.join(root,'portable');
await build({root,configFile:false,plugins:[react()],base:'./',define:{'import.meta.env.VITE_PORTABLE':'"true"'},build:{outDir:temp,emptyOutDir:true,sourcemap:false,cssCodeSplit:false,rollupOptions:{output:{inlineDynamicImports:true}}}});
const assets=await readdir(path.join(temp,'assets'));
const js=await readFile(path.join(temp,'assets',assets.find(f=>f.endsWith('.js'))!),'utf8');
let css=await readFile(path.join(temp,'assets',assets.find(f=>f.endsWith('.css'))!),'utf8');
const avatar=await readFile(path.join(root,'public/avatars/characters.png'));
css=css.replace(/url\((?:["'])?(?:\/|\.\/|\.\.\/)?avatars\/characters\.png(?:["'])?\)/g,`url("data:image/png;base64,${avatar.toString('base64')}")`);
if(css.includes('avatars/characters.png'))throw Error('Avatar was not embedded');
const html=`<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f6f5f1"><meta name="description" content="无需安装，离线练习中文日常交流"><title>聊天练习室 · 便携版</title><style>${css.replace(/<\/style/gi,'<\\/style')}</style></head><body><div id="root"></div><script type="module">${js.replace(/<\/script/gi,'<\\/script')}</script></body></html>`;
await mkdir(out,{recursive:true});
await writeFile(path.join(out,'index.html'),html);
await writeFile(path.join(out,'contracts.json'),JSON.stringify({version:1,systemRules,tasks:aiTasks,scenarios,personas,inputs:{practice:jsonSchema(practiceInput),simulation:jsonSchema(simulationInput),recap:jsonSchema(recapInput)},outputs:{practice:jsonSchema(feedbackSchema),simulation:jsonSchema(turnSchema),recap:jsonSchema(recapSchema)}},null,2));
await rm(temp,{recursive:true,force:true});
console.log(`便携版已生成：portable/index.html（${(Buffer.byteLength(html)/1048576).toFixed(1)} MB），可直接双击；Python 不需要 Node.js。`);

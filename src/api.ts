import type { z } from 'zod';
let accessToken='';
export function setAccessToken(token:string){accessToken=token;}
export async function request<T>(path:string,body:unknown,schema:z.ZodType<T>):Promise<T>{
  let response:Response;
  try{response=await fetch(`/api/${path}`,{method:'POST',headers:{'Content-Type':'application/json',...(accessToken?{'X-App-Token':accessToken}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(65000)});}catch{throw new Error('网络连接失败或超时。输入已保留，请重试。');}
  let data:{error?:string;data?:unknown};
  try{data=await response.json();}catch{throw new Error('服务响应格式异常，请检查服务是否启动后重试。');}
  if(!response.ok)throw new Error(data.error??'请求失败，请重试。');
  const parsed=schema.safeParse(data.data);if(!parsed.success)throw new Error('反馈内容不完整，没有保存本次结果。请重试。');
  return parsed.data;
}

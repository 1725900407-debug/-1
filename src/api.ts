import type { z } from 'zod';
import { practiceInput, simulationInput, recapInput } from '../shared/api-contract';
import { getScenario } from '../shared/scenarios';
export const portable = import.meta.env.VITE_PORTABLE === 'true';
let accessToken='';
export function setAccessToken(token:string){accessToken=token;}
export async function request<T>(path:string,body:unknown,schema:z.ZodType<T>):Promise<T>{
  if(portable && (body as {mode?:string}).mode === 'demo'){
    const {demoFeedback,demoTurn,demoRecap}=await import('../server/demo');
    let result:unknown;
    try{
      if(path==='practice'){
        const input=practiceInput.parse(body);const scenario=getScenario(input.scenarioId);
        if(!scenario)throw new Error('题目不存在。');
        if(!input.silence&&!input.answer)throw new Error('写一句你会发送的话，或选择不继续发消息。');
        result=demoFeedback(scenario,input.answer,input.silence);
      }else if(path==='simulation'){
        const input=simulationInput.parse(body);
        if(input.messages.at(-1)?.role!=='me')throw new Error('请先发送你的回复。');
        if(input.messages.filter(m=>m.role==='me').length>input.config.rounds)throw new Error('已达到本次轮数，请结束并复盘。');
        result=demoTurn(input.config,input.messages);
      }else if(path==='recap'){
        const input=recapInput.parse(body);
        if(!input.messages.some(m=>m.role==='me')||!input.messages.some(m=>m.role==='other'))throw new Error('请至少标记一条“我”和一条“对方”的消息。');
        result=demoRecap(input.messages,input.kind);
      }else throw new Error('接口不存在。');
    }catch(error){
      if(error instanceof Error&&error.name==='ZodError')throw new Error('输入为空、过长或格式不正确，请检查后再提交。');
      throw error;
    }
    const parsed=schema.safeParse(result);
    if(!parsed.success)throw new Error('反馈内容不完整，没有保存本次结果。请重试。');
    return parsed.data;
  }
  if(portable&&location.protocol==='file:')throw new Error('离线网页尚未配置 AI。请切换演示模式；需要 AI 时运行 python3 start.py 并在服务端配置密钥。');
  let response:Response;
  try{response=await fetch(`/api/${path}`,{method:'POST',headers:{'Content-Type':'application/json',...(accessToken?{'X-App-Token':accessToken}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(65000)});}catch{throw new Error('网络连接失败或超时。输入已保留，请重试。');}
  let data:{error?:string;data?:unknown};
  try{data=await response.json();}catch{throw new Error('服务响应格式异常，请检查服务是否启动后重试。');}
  if(!response.ok)throw new Error(data.error??'请求失败，请重试。');
  const parsed=schema.safeParse(data.data);if(!parsed.success)throw new Error('反馈内容不完整，没有保存本次结果。请重试。');
  return parsed.data;
}

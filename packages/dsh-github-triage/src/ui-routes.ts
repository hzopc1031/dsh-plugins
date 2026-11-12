import type { Context } from '@deepseek-ai/cordis'
import { requestSchema, fieldErrors, routeActions, routePath, type Reply, type RouteName } from './ui-contract.js'

/** Local structural face, verified against both official tags; no new package. */
export interface ConnectionFace {
  fetch?: { register(route:{path:string;methods:readonly ['POST'];requestBody:'buffered';fetch:(request:Request)=>Promise<Response>}):()=>Promise<void>|void }
}
type Service=(input:unknown)=>Promise<Reply>
const reply=(body:unknown)=>Response.json(body,{headers:{'cache-control':'no-store'}})
const failure=(code:string,message:string,fields?:Record<string,string>)=>reply({ok:false,error:{code,message,fields}})
export function routeHandler(name:RouteName,service:Service) {
  return async(request:Request):Promise<Response>=>{
    if(request.method!=='POST')return new Response(null,{status:405,headers:{Allow:'POST'}})
    try {
      const text=await request.text()
      if(new TextEncoder().encode(text).length>150000)return failure('too-large','请求过大')
      let body:unknown
      try{body=JSON.parse(text)}catch{return failure('bad-json','请求必须为有效 JSON')}
      const parsed=requestSchema.safeParse(body)
      if(!parsed.success)return failure('validation','请检查表单中的字段格式和范围。',fieldErrors(parsed.error))
      if(!(routeActions[name] as readonly string[]).includes(parsed.data.action))return failure('wrong-route','操作与路由不匹配')
      const result=await service(parsed.data)
      return result.ok?reply({ok:true,value:result.data}):failure('operation',result.error,result.fields)
    }catch{return failure('internal','界面服务暂不可用，请重试。')}
  }
}
export function mountRoutes(ctx:Context,service:Service):void {
  ctx.inject(['connection'],c=>{
    const connection=c.get('connection') as ConnectionFace|undefined
    if(typeof connection?.fetch?.register!=='function')return
    for(const name of Object.keys(routeActions) as RouteName[])
      c.effect(()=>connection.fetch!.register({path:routePath(name),methods:['POST'],requestBody:'buffered',fetch:routeHandler(name,service)}),'github-triage: '+name)
  })
}

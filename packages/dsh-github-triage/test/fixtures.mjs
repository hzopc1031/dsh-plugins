export const issue=(extra={})=>({number:1,kind:'issue',title:'startup render fails',body:'## Steps to reproduce\n1. Open application\n2. Click render\nVersion: 0.2.1\nError: render failed',updated_at:'2026-11-11T00:00:00Z',url:'https://github.com/o/r/issues/1',...extra})
export const pr=(extra={})=>issue({kind:'pr',head:'a',files:[{path:'src/render.ts',additions:10,deletions:2,patch:'-before\n+after'},{path:'test/render.test.ts',additions:5,deletions:0}],ci:[{name:'build',state:'pass'}],additions:15,deletions:2,changedFiles:2,...extra})
const common={recommendation:'adopt',localApplicability:'unclear',localReason:'未配置本地仓库对照'}
export const good={...common,kind:'issue',type:'bug',exists:'likely',worthFixing:'值得修',priority:'高',businessReason:'影响核心登录流程，值得优先修',reason:'模型独立判断',evidence:['模型证据']}
export const goodPr={...common,priority:"中",kind:'pr',verdict:'值得合并',fitsDirection:'yes',risk:'低',testing:'已有测试，CI 通过',businessReason:'符合核心功能方向',reason:'模型审查结果',evidence:['模型证据']}
export const model=async prompt=>JSON.stringify(JSON.parse(prompt).item.kind==='issue'?good:goodPr)
export const repo={repo:'o/r',mode:'both'}
export const options={limit:20,now:100,model,modelRoute:'["test","test-model"]'}
export const source=items=>({list:async()=>items,enrich:async(_,i)=>i})

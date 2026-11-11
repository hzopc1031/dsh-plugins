/** Deterministic demo only: exercises the model pipeline, makes no LLM request. */
export default async function mockModel(prompt){
  const data=JSON.parse(prompt),business=data.business?.text
  const values=['adopt','manual-review','not-recommended'],recommendation=values[(data.item.number-1)%3]
  const common={recommendation,priority:'中',localApplicability:'unclear',localReason:data.local?.status||'未配置本地仓库对照',businessReason:business?'模拟模型：根据提供的业务说明演示理由，实际价值仍须真实模型判断':'模拟模型：未提供业务说明，按通用标准判断',reason:'模拟模型：固定演示输出，未验证代码或复现',evidence:['模拟模型：仅演示输出格式，不代表真实 AI 研判']}
  return JSON.stringify(data.item.kind==='issue'?{kind:'issue',type:'bug',exists:'unclear',worthFixing:'待补充',priority:'中',...common}:{kind:'pr',verdict:'改完再合',fitsDirection:'unclear',risk:'中',testing:'模拟模型：测试有效性尚待核实',...common})
}

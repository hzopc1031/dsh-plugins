export const styles = `
.ce-workbench{height:100%;overflow:auto;box-sizing:border-box;padding:24px;padding-top:max(24px,var(--dsh-frame-leading-clearance,0px));color:inherit;font:14px/1.6 system-ui,sans-serif}
.ce-workbench *{box-sizing:border-box}
.ce-workbench .ce-wrap{max-width:1050px;margin:auto}
.ce-workbench h1{font-size:24px;margin:0}.ce-workbench h2{font-size:18px;margin:0 0 12px}.ce-workbench h3{font-size:15px;margin:12px 0 6px}
.ce-workbench p{margin:8px 0}.ce-muted{opacity:.75}.ce-workbench small{font-size:12px}
.ce-workbench header{margin-bottom:20px}.ce-workbench section{padding:20px;border:1px solid #8885;border-radius:12px;margin:16px 0}
.ce-workbench form{margin:12px 0}.ce-workbench label{display:block;margin:8px 0}.ce-workbench input:not([type=checkbox]),.ce-workbench textarea,.ce-workbench select{display:block;width:100%;font:inherit;padding:8px 10px;border:1px solid #8887;border-radius:6px;background:transparent;color:inherit}
.ce-workbench textarea{min-height:96px;resize:vertical}.ce-workbench button{font:inherit;padding:6px 12px;border:1px solid #8887;border-radius:6px;background:transparent;color:inherit;cursor:pointer}
.ce-workbench button:disabled,.ce-workbench select:disabled{opacity:.5;cursor:default}.ce-workbench button:focus-visible,.ce-workbench input:focus-visible,.ce-workbench textarea:focus-visible,.ce-workbench select:focus-visible{outline:2px solid #568be0;outline-offset:2px}
.ce-workbench button[type=submit],.ce-workbench button[aria-pressed=true]{background:#3866ba;color:white;border-color:#3866ba}
.ce-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.ce-row>*{flex:1}.ce-row>button{flex:0 0 auto}.ce-workbench nav{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
.ce-workbench fieldset{border:0;padding:0;margin:0;min-width:0}.ce-workbench legend{font-weight:600}.ce-workbench pre{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.6 monospace;padding:12px;background:#8881;border-radius:6px;max-height:360px;overflow:auto}
.ce-workbench table{width:100%;border-collapse:collapse}.ce-workbench th,.ce-workbench td{text-align:left;vertical-align:top;padding:8px;border-bottom:1px solid #8884;overflow-wrap:anywhere}.ce-workbench a{color:inherit;text-decoration:underline;overflow-wrap:anywhere}.ce-workbench li{margin:6px 0;overflow-wrap:anywhere}
.ce-notice{border-left:3px solid #7095d5;padding:8px 12px;background:#8881;white-space:pre-wrap;overflow-wrap:anywhere}.ce-workbench [role=alert]{border-color:#d37d47}.ce-workbench img{display:block;max-width:100%;max-height:420px;object-fit:contain}.ce-workbench code{overflow-wrap:anywhere}.ce-workbench .ce-check{display:flex;gap:8px;align-items:baseline}
@media(max-width:600px){.ce-workbench{padding:16px;padding-top:max(16px,var(--dsh-frame-leading-clearance,0px))}.ce-workbench section{padding:12px}.ce-row{display:block}.ce-row>button{margin-top:8px}}
`

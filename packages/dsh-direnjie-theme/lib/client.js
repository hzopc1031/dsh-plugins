window.__ModuleLoader__.load({id:"dsh-direnjie-theme",factory:(require)=>{const module={exports:{}};const exports=module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client.ts
var client_exports = {};
__export(client_exports, {
  apply: () => apply,
  inject: () => inject,
  mount: () => mount,
  name: () => name
});
module.exports = __toCommonJS(client_exports);

// src/tokens.ts
var tokens = {
  "--dsw-alias-bg-base": { light: "#f5eedf", dark: "#172723" },
  "--dsw-alias-bg-layer-1": { light: "#f8f2e7", dark: "#20332d" },
  "--dsw-alias-bg-layer-2": { light: "#fffbf2", dark: "#283c34" },
  "--dsw-alias-bg-layer-3": { light: "#fffbf2", dark: "#2c4339" },
  "--dsw-alias-label-primary": { light: "#273c34", dark: "#ede4cf" },
  "--dsw-alias-label-secondary": { light: "#556359", dark: "#b8c5b3" },
  "--dsw-alias-label-tertiary": { light: "#6a7160", dark: "#a0b09f" },
  "--dsw-alias-border-l1": { light: "#d8ceba", dark: "#3a5144" },
  "--dsw-alias-border-l2": { light: "#ccbea1", dark: "#4e6251" },
  "--dsw-alias-border-l3": { light: "#b8a98b", dark: "#637862" },
  "--dsw-alias-state-business-primary": { light: "#7d372e", dark: "#dab479" },
  "--dsw-alias-state-business-tertiary": { light: "#ead5bc", dark: "#493e2e" },
  "--dsw-alias-interactive-bg-hover": { light: "#e8deca", dark: "#2e4438" },
  "--dsw-alias-interactive-bg-active": { light: "#dccdb0", dark: "#3b5142" },
  "--dsw-specific-sidebar-fill": { light: "#e9dfca", dark: "#1c2f28" },
  "--dsw-specific-bubble": { light: "#e9dfca", dark: "#2b4135" },
  "--dsw-specific-input-major": { light: "#fffbf2", dark: "#243a30" }
};

// src/client.ts
var name = "dsh-direnjie-theme";
var inject = ["theme"];
function mount(doc, boot, css) {
  if (!boot.enabled) return () => {
  };
  const style = doc.createElement("style");
  style.dataset.plugin = name;
  style.textContent = css;
  doc.head.append(style);
  const old = doc.body.getAttribute("data-direnjie");
  doc.body.setAttribute("data-direnjie", "");
  const panel = doc.createElement("details");
  panel.id = "direnjie-music";
  panel.setAttribute("aria-label", "\u957F\u5B89\u542C\u96E8\u97F3\u4E50\u64AD\u653E\u5668");
  const title = doc.createElement("summary");
  title.textContent = "\u957F\u5B89\u542C\u96E8 \xB7 \u4E50";
  panel.append(title);
  const audio = doc.createElement("audio");
  audio.controls = true;
  audio.preload = "none";
  audio.volume = Math.min(1, Math.max(0, boot.volume));
  audio.loop = boot.loop;
  const status = doc.createElement("p");
  status.setAttribute("role", "status");
  status.textContent = boot.musicUrl ? "\u672C\u673A\u97F3\u4E50\u5DF2\u914D\u7F6E\uFF0C\u70B9\u51FB\u64AD\u653E\u3002" : "\u9009\u62E9\u672C\u673A\u97F3\u9891\uFF0C\u6216\u914D\u7F6E musicPath \u540E\u91CD\u542F\u3002";
  const label = doc.createElement("label");
  label.textContent = "\u9009\u62E9\u672C\u673A\u97F3\u9891 ";
  const input = doc.createElement("input");
  input.type = "file";
  input.accept = ".mp3,.wav,.ogg,.m4a,.flac,audio/*";
  label.append(input);
  const win = doc.defaultView;
  let objectUrl;
  let disposed = false;
  const release = () => {
    if (objectUrl) {
      win?.URL.revokeObjectURL(objectUrl);
      objectUrl = void 0;
    }
  };
  const load = (url) => {
    audio.pause();
    audio.src = url;
    audio.load();
  };
  const select = () => {
    const file = input.files?.[0];
    if (!file || !win) return;
    release();
    objectUrl = win.URL.createObjectURL(file);
    load(objectUrl);
    status.textContent = "\u5DF2\u9009\u62E9\u672C\u673A\u97F3\u9891\uFF0C\u70B9\u51FB\u64AD\u653E\u3002";
  };
  const error = () => {
    status.textContent = "\u65E0\u6CD5\u8BFB\u53D6\u6216\u89E3\u7801\u97F3\u9891\uFF0C\u8BF7\u68C0\u67E5\u8DEF\u5F84\u3001\u683C\u5F0F\uFF0C\u6216\u9009\u62E9\u5176\u4ED6\u672C\u673A\u6587\u4EF6\u3002";
  };
  input.addEventListener("change", select);
  audio.addEventListener("error", error);
  panel.append(audio, label, status);
  doc.body.append(panel);
  if (boot.musicUrl) {
    load(boot.musicUrl);
    if (boot.autoplay) void audio.play().catch(() => {
      if (!disposed) status.textContent = "\u81EA\u52A8\u64AD\u653E\u88AB\u963B\u6B62\uFF0C\u8BF7\u624B\u52A8\u70B9\u51FB\u64AD\u653E\u3002";
    });
  }
  return () => {
    disposed = true;
    input.removeEventListener("change", select);
    audio.removeEventListener("error", error);
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    release();
    panel.remove();
    style.remove();
    if (old === null) doc.body.removeAttribute("data-direnjie");
    else doc.body.setAttribute("data-direnjie", old);
  };
}
function apply(ctx) {
  const boot = window.__DSH_DIRENJIE__;
  if (!boot?.enabled) return;
  ctx.effect(() => ctx.theme.overrideTokens(name, tokens));
  ctx.effect(() => mount(document, boot, 'body[data-direnjie] { --dsw-font-family: "STSong", "SimSun", "Noto Serif CJK SC", serif; }\r\nbody[data-direnjie] [class*="_mainPanel"] { background-color: var(--dsw-alias-bg-base); background-image: linear-gradient(#f5eedfdd,#f5eedf99),url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%201600%201000%22%20role%3D%22img%22%20aria-labelledby%3D%22title%20desc%22%3E%0D%0A%3Ctitle%20id%3D%22title%22%3E%E9%95%BF%E5%AE%89%20%C2%B7%20%E5%A4%A7%E7%90%86%E5%AF%BA%E5%A4%9C%E6%A1%88%3C%2Ftitle%3E%3Cdesc%20id%3D%22desc%22%3E%E5%8E%9F%E5%88%9B%E6%84%8F%E8%B1%A1%E7%94%BB%EF%BC%9A%E7%95%99%E7%99%BD%E5%AE%A3%E7%BA%B8%E3%80%81%E6%B0%B4%E5%A2%A8%E8%BF%9C%E5%B1%B1%E3%80%81%E9%95%BF%E5%AE%89%E5%9F%8E%E9%98%99%E4%B8%8E%E5%A4%A7%E7%90%86%E5%AF%BA%E3%80%82%E9%9D%9E%E5%89%A7%E7%85%A7%EF%BC%8C%E9%9D%9E%E5%BB%BA%E7%AD%91%E8%80%83%E6%8D%AE%E5%A4%8D%E5%8E%9F%E3%80%82%3C%2Fdesc%3E%0D%0A%3Cdefs%3E%3ClinearGradient%20id%3D%22paper%22%20x2%3D%220%22%20y2%3D%221%22%3E%3Cstop%20stop-color%3D%22%23e9dfc9%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23f5eedf%22%2F%3E%3C%2FlinearGradient%3E%3ClinearGradient%20id%3D%22mist%22%20x2%3D%220%22%20y2%3D%221%22%3E%3Cstop%20stop-color%3D%22%23747e75%22%20stop-opacity%3D%22.35%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23747e75%22%20stop-opacity%3D%220%22%2F%3E%3C%2FlinearGradient%3E%3Cpattern%20id%3D%22grain%22%20width%3D%2219%22%20height%3D%2223%22%20patternUnits%3D%22userSpaceOnUse%22%3E%3Cpath%20d%3D%22M2%203h1m9%2011h2m-7%207h1%22%20stroke%3D%22%238e806a%22%20stroke-opacity%3D%22.08%22%2F%3E%3C%2Fpattern%3E%3C%2Fdefs%3E%0D%0A%3Cpath%20fill%3D%22url(%23paper)%22%20d%3D%22M0%200h1600v1000H0z%22%2F%3E%3Cpath%20fill%3D%22url(%23grain)%22%20d%3D%22M0%200h1600v1000H0z%22%2F%3E%0D%0A%3Ccircle%20cx%3D%221340%22%20cy%3D%22180%22%20r%3D%2262%22%20fill%3D%22%23b79b69%22%20opacity%3D%22.18%22%2F%3E%0D%0A%3Cpath%20d%3D%22M0%20400Q100%20260%20200%20360L330%20230%20450%20330%20600%20170%20710%20320%20830%20280%20990%20410%201130%20300%201320%20400%201450%20260%201600%20350V650H0Z%22%20fill%3D%22url(%23mist)%22%2F%3E%0D%0A%3Cpath%20d%3D%22M0%20550L100%20470%20210%20510%20360%20400%20460%20510%20620%20440%20790%20560%20900%20480%201080%20580%201230%20420%201400%20500%201510%20430%201600%20490V700H0Z%22%20fill%3D%22%2368776d%22%20opacity%3D%22.09%22%2F%3E%0D%0A%3Cg%20fill%3D%22%23283e38%22%20opacity%3D%22.18%22%3E%3Cpath%20d%3D%22M0%20830h1600v170H0z%22%2F%3E%3Cpath%20d%3D%22M0%20807h1600v24H0z%22%2F%3E%3Cpath%20d%3D%22M10%20785h38v30H10zm80%200h38v30H90zm80%200h38v30h-38zm80%200h38v30h-38zm80%200h38v30h-38zm80%200h38v30h-38zm80%200h38v30h-38zm80%200h38v30h-38z%22%2F%3E%0D%0A%3Cpath%20d%3D%22M1120%20710h250v120h-250zM1090%20714q70-20%20155-88%2085%2068%20155%2088zM1150%20622h190v74h-190zM1115%20630q70-15%20130-73%2060%2058%20130%2073z%22%2F%3E%0D%0A%3Cpath%20d%3D%22M720%20790h300v70H720zM680%20794q98-18%20190-90%2092%2072%20190%2090z%22%2F%3E%0D%0A%3C%2Fg%3E%3Cg%20stroke%3D%22%23233d36%22%20opacity%3D%22.2%22%20fill%3D%22none%22%20stroke-width%3D%224%22%3E%3Cpath%20d%3D%22M150%201000Q220%20850%20175%20710m25%20110-75-60m74%2075%2080-65m-90%2012-40-66m47%20134%2085-22%22%2F%3E%3Cpath%20d%3D%22M1500%201000q-30-90%2012-150m-14%2071-45-30m48-1%2047-30%22%2F%3E%3C%2Fg%3E%0D%0A%3Cg%20fill%3D%22%23685b45%22%20opacity%3D%22.45%22%20font-family%3D%22SimSun%2Cserif%22%3E%3Ctext%20x%3D%221470%22%20y%3D%22370%22%20font-size%3D%2228%22%20writing-mode%3D%22tb%22%20letter-spacing%3D%2215%22%3E%E9%95%BF%E5%AE%89%E5%90%AC%E9%9B%A8%3C%2Ftext%3E%3Ctext%20x%3D%221430%22%20y%3D%22370%22%20font-size%3D%2214%22%20writing-mode%3D%22tb%22%20letter-spacing%3D%229%22%3E%E5%A4%A7%E7%90%86%E5%AF%BA%20%C2%B7%20%E5%A4%9C%E6%A1%88%3C%2Ftext%3E%3C%2Fg%3E%3Crect%20x%3D%221457%22%20y%3D%22540%22%20width%3D%2227%22%20height%3D%2232%22%20rx%3D%222%22%20fill%3D%22%23963f32%22%20opacity%3D%22.45%22%2F%3E%0D%0A%3C%2Fsvg%3E"); background-position: center; background-size: cover; }\r\nbody[data-direnjie][data-ds-dark-theme] [class*="_mainPanel"] { background-image: linear-gradient(#172723eb,#172723c9),url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%201600%201000%22%20role%3D%22img%22%20aria-labelledby%3D%22title%20desc%22%3E%0D%0A%3Ctitle%20id%3D%22title%22%3E%E9%95%BF%E5%AE%89%20%C2%B7%20%E5%A4%A7%E7%90%86%E5%AF%BA%E5%A4%9C%E6%A1%88%3C%2Ftitle%3E%3Cdesc%20id%3D%22desc%22%3E%E5%8E%9F%E5%88%9B%E6%84%8F%E8%B1%A1%E7%94%BB%EF%BC%9A%E7%95%99%E7%99%BD%E5%AE%A3%E7%BA%B8%E3%80%81%E6%B0%B4%E5%A2%A8%E8%BF%9C%E5%B1%B1%E3%80%81%E9%95%BF%E5%AE%89%E5%9F%8E%E9%98%99%E4%B8%8E%E5%A4%A7%E7%90%86%E5%AF%BA%E3%80%82%E9%9D%9E%E5%89%A7%E7%85%A7%EF%BC%8C%E9%9D%9E%E5%BB%BA%E7%AD%91%E8%80%83%E6%8D%AE%E5%A4%8D%E5%8E%9F%E3%80%82%3C%2Fdesc%3E%0D%0A%3Cdefs%3E%3ClinearGradient%20id%3D%22paper%22%20x2%3D%220%22%20y2%3D%221%22%3E%3Cstop%20stop-color%3D%22%23e9dfc9%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23f5eedf%22%2F%3E%3C%2FlinearGradient%3E%3ClinearGradient%20id%3D%22mist%22%20x2%3D%220%22%20y2%3D%221%22%3E%3Cstop%20stop-color%3D%22%23747e75%22%20stop-opacity%3D%22.35%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23747e75%22%20stop-opacity%3D%220%22%2F%3E%3C%2FlinearGradient%3E%3Cpattern%20id%3D%22grain%22%20width%3D%2219%22%20height%3D%2223%22%20patternUnits%3D%22userSpaceOnUse%22%3E%3Cpath%20d%3D%22M2%203h1m9%2011h2m-7%207h1%22%20stroke%3D%22%238e806a%22%20stroke-opacity%3D%22.08%22%2F%3E%3C%2Fpattern%3E%3C%2Fdefs%3E%0D%0A%3Cpath%20fill%3D%22url(%23paper)%22%20d%3D%22M0%200h1600v1000H0z%22%2F%3E%3Cpath%20fill%3D%22url(%23grain)%22%20d%3D%22M0%200h1600v1000H0z%22%2F%3E%0D%0A%3Ccircle%20cx%3D%221340%22%20cy%3D%22180%22%20r%3D%2262%22%20fill%3D%22%23b79b69%22%20opacity%3D%22.18%22%2F%3E%0D%0A%3Cpath%20d%3D%22M0%20400Q100%20260%20200%20360L330%20230%20450%20330%20600%20170%20710%20320%20830%20280%20990%20410%201130%20300%201320%20400%201450%20260%201600%20350V650H0Z%22%20fill%3D%22url(%23mist)%22%2F%3E%0D%0A%3Cpath%20d%3D%22M0%20550L100%20470%20210%20510%20360%20400%20460%20510%20620%20440%20790%20560%20900%20480%201080%20580%201230%20420%201400%20500%201510%20430%201600%20490V700H0Z%22%20fill%3D%22%2368776d%22%20opacity%3D%22.09%22%2F%3E%0D%0A%3Cg%20fill%3D%22%23283e38%22%20opacity%3D%22.18%22%3E%3Cpath%20d%3D%22M0%20830h1600v170H0z%22%2F%3E%3Cpath%20d%3D%22M0%20807h1600v24H0z%22%2F%3E%3Cpath%20d%3D%22M10%20785h38v30H10zm80%200h38v30H90zm80%200h38v30h-38zm80%200h38v30h-38zm80%200h38v30h-38zm80%200h38v30h-38zm80%200h38v30h-38zm80%200h38v30h-38z%22%2F%3E%0D%0A%3Cpath%20d%3D%22M1120%20710h250v120h-250zM1090%20714q70-20%20155-88%2085%2068%20155%2088zM1150%20622h190v74h-190zM1115%20630q70-15%20130-73%2060%2058%20130%2073z%22%2F%3E%0D%0A%3Cpath%20d%3D%22M720%20790h300v70H720zM680%20794q98-18%20190-90%2092%2072%20190%2090z%22%2F%3E%0D%0A%3C%2Fg%3E%3Cg%20stroke%3D%22%23233d36%22%20opacity%3D%22.2%22%20fill%3D%22none%22%20stroke-width%3D%224%22%3E%3Cpath%20d%3D%22M150%201000Q220%20850%20175%20710m25%20110-75-60m74%2075%2080-65m-90%2012-40-66m47%20134%2085-22%22%2F%3E%3Cpath%20d%3D%22M1500%201000q-30-90%2012-150m-14%2071-45-30m48-1%2047-30%22%2F%3E%3C%2Fg%3E%0D%0A%3Cg%20fill%3D%22%23685b45%22%20opacity%3D%22.45%22%20font-family%3D%22SimSun%2Cserif%22%3E%3Ctext%20x%3D%221470%22%20y%3D%22370%22%20font-size%3D%2228%22%20writing-mode%3D%22tb%22%20letter-spacing%3D%2215%22%3E%E9%95%BF%E5%AE%89%E5%90%AC%E9%9B%A8%3C%2Ftext%3E%3Ctext%20x%3D%221430%22%20y%3D%22370%22%20font-size%3D%2214%22%20writing-mode%3D%22tb%22%20letter-spacing%3D%229%22%3E%E5%A4%A7%E7%90%86%E5%AF%BA%20%C2%B7%20%E5%A4%9C%E6%A1%88%3C%2Ftext%3E%3C%2Fg%3E%3Crect%20x%3D%221457%22%20y%3D%22540%22%20width%3D%2227%22%20height%3D%2232%22%20rx%3D%222%22%20fill%3D%22%23963f32%22%20opacity%3D%22.45%22%2F%3E%0D%0A%3C%2Fsvg%3E"); }\r\n#direnjie-music { position:fixed; z-index:30; bottom:12px; right:18px; max-width:min(340px,calc(100vw - 36px)); border:1px solid var(--dsw-alias-border-l2); border-radius:12px; background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-primary); padding:10px 14px; box-shadow:0 4px 18px #0002; font:14px/1.6 "SimSun",serif; }\r\n#direnjie-music summary { cursor:pointer; color:var(--dsw-alias-state-business-primary); }\r\n#direnjie-music audio { display:block; width:100%; margin:12px 0; }\r\n#direnjie-music input { max-width:100%; }\r\n#direnjie-music p { margin:8px 0 0; }\r\n#direnjie-music :focus-visible { outline:2px solid var(--dsw-alias-state-business-primary); outline-offset:3px; }\r\n'));
}
return module.exports;}});

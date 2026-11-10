window.__ModuleLoader__.load({id:"dsh-source-impact",factory:(require)=>{var module={exports:{}};var exports=module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
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

// src/client.tsx
var client_exports = {};
__export(client_exports, {
  SourceImpactForm: () => SourceImpactForm,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(client_exports);
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var inject = ["slots", "remote", "remote.commands"];
function SourceImpactForm({ sessionId, execute }) {
  const [open, setOpen] = (0, import_react.useState)(false), [busy, setBusy] = (0, import_react.useState)(false);
  const [notice, setNotice] = (0, import_react.useState)(""), [kind, setKind] = (0, import_react.useState)("csv-key");
  const epoch = (0, import_react.useRef)(0);
  const inFlight = (0, import_react.useRef)(false);
  const close = () => {
    epoch.current++;
    inFlight.current = false;
    setOpen(false);
    setBusy(false);
    setNotice("");
  };
  (0, import_react.useEffect)(() => {
    close();
    return () => {
      epoch.current++;
    };
  }, [sessionId]);
  async function command(raw) {
    const response = await execute(sessionId, "/impact " + raw, []);
    if (!response.ok || response.value?.result?.kind !== "success") throw new Error(response.ok ? response.value?.result?.text ?? "\u547D\u4EE4\u4E0D\u53EF\u7528" : "\u8FDE\u63A5\u5931\u8D25");
    return response.value.result.text ?? "";
  }
  async function perform(work) {
    if (inFlight.current) return;
    inFlight.current = true;
    const revision = epoch.current;
    setBusy(true);
    setNotice("");
    try {
      await work();
    } catch (error) {
      if (epoch.current === revision) setNotice(error instanceof Error ? error.message : "\u64CD\u4F5C\u5931\u8D25");
    } finally {
      if (epoch.current === revision) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", onClick: () => setOpen(true), children: "\u8D44\u6599\u5F15\u7528\u767B\u8BB0" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Modal, { open, onClose: close, title: "\u8D44\u6599\u5F15\u7528\u767B\u8BB0", closeLabel: "\u5173\u95ED", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { width: "min(680px, 80vw)", maxHeight: "70vh", overflowY: "auto" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "\u7528\u8868\u5355\u767B\u8BB0\u5F15\u7528\u5E76\u4FDD\u5B58\u521D\u59CB\u57FA\u7EBF\uFF0C\u6216\u5728\u4EBA\u5DE5\u590D\u6838\u540E\u539F\u5B50\u63A5\u53D7\u65B0\u57FA\u7EBF\u3002\u6A21\u578B\u4FA7\u5DE5\u5177\u4ECD\u7136\u53EA\u8BFB\uFF0C\u4E0D\u4F1A\u6539\u5199\u57FA\u7EBF\u3002" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { role: "status", "aria-live": "polite", children: notice }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("form", { onSubmit: (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget), value = (key) => String(data.get(key) ?? "").trim();
        const selector = kind === "markdown-lines" ? { kind, start: Number(value("start")), end: Number(value("end")) } : kind === "markdown-quote" ? { kind, text: value("quote") } : { kind, keyColumn: value("keyColumn"), keyValue: value("keyValue"), columns: value("columns").split(",").map((s) => s.trim()).filter(Boolean) };
        const registration = {
          id: value("id"),
          source: value("source"),
          selector,
          conclusion: { id: value("conclusionId"), text: value("conclusion") },
          outputs: [{ path: value("outputPath"), kind: value("outputKind"), locator: value("locator"), label: value("label") }],
          recheck: value("recheck")
        };
        void perform(async () => {
          setNotice(await command("register " + JSON.stringify(registration)));
        });
      }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", { disabled: busy, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("legend", { children: "\u767B\u8BB0\u4E00\u6761\u5F15\u7528" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { display: "block" }, children: [
          "\u5F15\u7528 id ",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { name: "id", required: true })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { display: "block" }, children: [
          "\u6765\u6E90\u8DEF\u5F84\uFF08\u9879\u76EE\u5185 .md / .csv\uFF09 ",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { name: "source", required: true })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { display: "block" }, children: [
          "\u5B9A\u4F4D\u65B9\u5F0F ",
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", { name: "kind", value: kind, onChange: (event) => setKind(event.target.value), children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "csv-key", children: "CSV \u952E\u503C" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "markdown-lines", children: "Markdown \u884C\u8303\u56F4" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "markdown-quote", children: "Markdown \u539F\u6587" })
          ] })
        ] }),
        kind === "csv-key" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { display: "block" }, children: [
            "\u952E\u5217 ",
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { name: "keyColumn", required: true })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { display: "block" }, children: [
            "\u952E\u503C ",
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { name: "keyValue", required: true })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { display: "block" }, children: [
            "\u9009\u62E9\u5217\uFF08\u9017\u53F7\u5206\u9694\uFF09 ",
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { name: "columns", required: true })
          ] })
        ] }),
        kind === "markdown-lines" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { display: "block" }, children: [
            "\u8D77\u59CB\u884C ",
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { name: "start", type: "number", min: 1, required: true })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { display: "block" }, children: [
            "\u7ED3\u675F\u884C ",
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { name: "end", type: "number", min: 1, required: true })
          ] })
        ] }),
        kind === "markdown-quote" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { display: "block" }, children: [
          "\u5F15\u7528\u539F\u6587 ",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", { name: "quote", required: true })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { display: "block" }, children: [
          "\u7ED3\u8BBA id ",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { name: "conclusionId", required: true })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { display: "block" }, children: [
          "\u7ED3\u8BBA\u6B63\u6587 ",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", { name: "conclusion", required: true })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { display: "block" }, children: [
          "\u4EA7\u51FA\u8DEF\u5F84 ",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { name: "outputPath", required: true })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { display: "block" }, children: [
          "\u4EA7\u51FA\u7C7B\u578B ",
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", { name: "outputKind", defaultValue: "section", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "section", children: "section" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "table", children: "table" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "report", children: "report" })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { display: "block" }, children: [
          "\u4EA7\u51FA\u5B9A\u4F4D ",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { name: "locator", required: true })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { display: "block" }, children: [
          "\u4EA7\u51FA\u540D\u79F0 ",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { name: "label", required: true })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { display: "block" }, children: [
          "\u91CD\u67E5\u65B9\u6CD5 ",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", { name: "recheck", required: true })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "submit", children: "\u767B\u8BB0\u5E76\u4FDD\u5B58\u521D\u59CB\u57FA\u7EBF" })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("form", { onSubmit: (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const scanId = String(data.get("scanId") ?? "").trim();
        const ids = String(data.get("ids") ?? "").trim();
        void perform(async () => {
          setNotice(await command("accept " + scanId + (ids ? " " + ids : "")));
        });
      }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", { disabled: busy, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("legend", { children: "\u63A5\u53D7\u65B0\u57FA\u7EBF" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "\u7ED1\u5B9A\u521A\u624D check \u5F97\u5230\u7684 scanId\uFF1B\u63D0\u4EA4\u524D\u4F1A\u91CD\u65B0\u6838\u9A8C\u3002\u5931\u8D25\u4E0D\u4F1A\u6539\u5199\u539F\u767B\u8BB0\uFF0C\u6210\u529F\u5219\u4FDD\u5B58\u65B0\u57FA\u7EBF\u548C\u4E0A\u4E00\u7248\u3002" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { display: "block" }, children: [
          "scanId ",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { name: "scanId", required: true, pattern: "[a-f0-9]{64}" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { display: "block" }, children: [
          "\u5F15\u7528 id\uFF08\u53EF\u9009\uFF0C\u9017\u53F7\u5206\u9694\uFF1B\u7559\u7A7A\u5219\u53EA\u63A5\u53D7\u5DF2\u53D8\u5316\u4E14\u53EF\u91CD\u65B0\u5B9A\u4F4D\u7684\u5F15\u7528\uFF09 ",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { name: "ids" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "submit", children: "\u6838\u9A8C\u5E76\u63A5\u53D7\u65B0\u57FA\u7EBF" })
      ] }) })
    ] }) })
  ] });
}
function apply(ctx) {
  const Panel = (props) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SourceImpactForm, { ...props, execute: (...args) => ctx.remote.commands.execute(...args) });
  ctx.slots.inject("conversation.session.header.actions", () => ctx.slots.register({ name: "conversation.session.header.actions", id: "dsh-source-impact", order: 155 }, Panel));
}
return module.exports;}});

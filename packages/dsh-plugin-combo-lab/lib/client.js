window.__ModuleLoader__.load({id:"dsh-plugin-combo-lab",factory:(require)=>{var module={exports:{}};var exports=module.exports;
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
  ComboLab: () => ComboLab,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(client_exports);
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var inject = ["slots", "remote", "remote.commands"];
function ComboLab({ sessionId, execute }) {
  const [open, setOpen] = (0, import_react.useState)(false), [busy, setBusy] = (0, import_react.useState)(false);
  const [notice, setNotice] = (0, import_react.useState)(""), [id, setId] = (0, import_react.useState)("");
  const [next, setNext] = (0, import_react.useState)(null);
  const epoch = (0, import_react.useRef)(0);
  const inFlight = (0, import_react.useRef)(false);
  const close = () => {
    epoch.current++;
    inFlight.current = false;
    setOpen(false);
    setBusy(false);
    setNotice("");
    setNext(null);
    setId("");
  };
  (0, import_react.useEffect)(() => {
    close();
    return () => {
      epoch.current++;
    };
  }, [sessionId]);
  async function command(raw) {
    const response = await execute(sessionId, "/combo-lab " + raw, []);
    if (!response.ok || response.value?.result?.kind !== "success") throw new Error(response.ok ? response.value?.result?.text ?? "\u547D\u4EE4\u4E0D\u53EF\u7528" : "\u8FDE\u63A5\u5931\u8D25");
    return response.value.result.text ?? "";
  }
  async function perform(work) {
    if (inFlight.current) return;
    inFlight.current = true;
    const revision = epoch.current;
    const valid = () => epoch.current === revision;
    setBusy(true);
    setNotice("");
    try {
      await work(valid);
    } catch (error) {
      if (valid()) setNotice(error instanceof Error ? error.message : "\u64CD\u4F5C\u5931\u8D25");
    } finally {
      if (valid()) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  }
  async function load(planId, valid) {
    const row = JSON.parse(await command("next " + planId));
    if (valid()) {
      setId(planId);
      setNext(row);
    }
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", onClick: () => setOpen(true), children: "\u63D2\u4EF6\u7EC4\u5408\u68C0\u67E5" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Modal, { open, onClose: close, title: "\u63D2\u4EF6\u7EC4\u5408\u68C0\u67E5", closeLabel: "\u5173\u95ED", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { width: "min(680px, 80vw)", maxHeight: "70vh", overflowY: "auto" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "\u6BCF\u6B21\u68C0\u67E5\u4E24\u4E2A\u63D2\u4EF6\u3002\u5148\u586B\u5199\u8BA1\u5212\uFF0C\u518D\u6309\u987A\u5E8F\u4EBA\u5DE5\u64CD\u4F5C\u3001\u8BB0\u5F55\u8BC1\u636E\u3002\u4E0D\u4F1A\u5B89\u88C5\u3001\u542F\u505C\u63D2\u4EF6\u6216\u81EA\u52A8\u64CD\u4F5C\u684C\u9762\u3002" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { role: "status", "aria-live": "polite", children: notice }),
      !next && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("form", { onSubmit: (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget), value = (key) => String(data.get(key) ?? "").trim();
        void perform(async (valid) => {
          const result = await command("plan " + JSON.stringify({
            plugins: [{ name: value("a"), version: value("av") }, { name: value("b"), version: value("bv") }],
            environment: { platform: "win32", client: "official-desktop", version: value("version"), machine: value("machine") },
            workspace: value("workspace"),
            configBaseline: value("baseline"),
            ...value("template") ? { templateId: value("template") } : {}
          }));
          const planId = /计划：([0-9a-f-]{36})/.exec(result)?.[1];
          if (!planId) throw new Error("\u8BA1\u5212\u5DF2\u521B\u5EFA\u4F46\u65E0\u6CD5\u8BFB\u53D6 ID\uFF0C\u8BF7\u67E5\u770B /combo-lab \u8F93\u51FA\u3002");
          if (valid()) await load(planId, valid);
        });
      }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", { disabled: busy, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("legend", { children: "1. \u521B\u5EFA\u8BA1\u5212" }),
        [["a", "\u63D2\u4EF6 A \u5305\u540D"], ["av", "A \u7CBE\u786E\u7248\u672C"], ["b", "\u63D2\u4EF6 B \u5305\u540D"], ["bv", "B \u7CBE\u786E\u7248\u672C"], ["version", "\u684C\u9762 DSH \u7248\u672C"], ["machine", "\u673A\u5668\u6807\u8BC6"], ["workspace", "\u5DE5\u4F5C\u533A\u6807\u8BC6"], ["baseline", "\u914D\u7F6E\u57FA\u7EBF\u6807\u8BC6"]].map(([name, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { display: "block" }, children: [
          label,
          " ",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { name, required: true, defaultValue: name === "version" ? "0.2.1-rc.5" : "" })
        ] }, name)),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { display: "block" }, children: [
          "\u68C0\u67E5\u6A21\u677F ",
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", { name: "template", defaultValue: "", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "", children: "\u5168\u90E8\u4EA4\u4E92\u9762\uFF08\u9ED8\u8BA4\u5B8C\u6574\u77E9\u9635\uFF09" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "input", children: "\u4EC5\u8F93\u5165\u6846" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "sidebar", children: "\u4EC5\u4FA7\u680F" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "session-menu", children: "\u4EC5\u4F1A\u8BDD\u83DC\u5355" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "commands", children: "\u4EC5\u547D\u4EE4\u5165\u53E3" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "tools-and-panels", children: "\u5DE5\u5177\u5165\u53E3\u4E0E\u754C\u9762\u9762\u677F" })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "submit", children: "\u521B\u5EFA\u68C0\u67E5\u8BA1\u5212" })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", { onSubmit: (event) => {
        event.preventDefault();
        void perform((valid) => load(id.trim(), valid));
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
          "\u7EE7\u7EED\u5DF2\u6709\u8BA1\u5212 ",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { "aria-label": "\u8BA1\u5212 ID", value: id, onChange: (event) => setId(event.target.value), required: true })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "submit", disabled: busy, children: "\u8BFB\u53D6\u4E0B\u4E00\u6B65" })
      ] }),
      next && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
        "\u8BA1\u5212\uFF1A",
        next.planId,
        " \xB7 \u68C0\u67E5\u6A21\u677F\uFF1A",
        next.template ? next.template.id + "@" + next.template.version : "all-surfaces\uFF08\u672A\u8BB0\u5F55\uFF0C\u7B49\u540C\u5B8C\u6574\u77E9\u9635\uFF09",
        " \xB7 \u5C1A\u672A\u8BB0\u5F55 ",
        next.remaining,
        " \u6B65\u3002\u5B8C\u6574\u8BB0\u5F55\u3001\u91CD\u5F55\u53CA\u5347\u7EA7\u5FEB\u7167\uFF1A/combo-lab help\u3002"
      ] }),
      next?.step && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("form", { onSubmit: (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget), step = next.step;
        const observation = {
          ...step.template,
          outcome: String(data.get("outcome")),
          observer: String(data.get("observer")),
          evidence: String(data.get("evidence")),
          ...step.check.kind === "persistence" ? { restart: { before: String(data.get("before")), after: String(data.get("after")), fullyExited: data.get("restart") === "on" } } : {}
        };
        void perform(async (valid) => {
          await command("record " + next.planId + " " + JSON.stringify(observation));
          if (valid()) await load(next.planId, valid);
        });
      }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", { disabled: busy, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("legend", { children: [
          "2. \u4EBA\u5DE5\u68C0\u67E5\uFF1A",
          next.step.id
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: next.step.run.instructions }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
          "\u672C\u8F6E\u76EE\u6807\u542F\u7528\u987A\u5E8F\uFF1A",
          next.step.run.enabled.map((p) => p.name + "@" + p.version).join(" \u2192 ") || "\u4E24\u4E2A\u76EE\u6807\u5747\u5173\u95ED"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: next.step.check.instructions }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
          "\u7ED3\u679C ",
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", { name: "outcome", defaultValue: "blocked", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "blocked", children: "\u53D7\u963B" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "unsupported", children: "\u65E0\u76F8\u5173\u5165\u53E3 / \u4E0D\u9002\u7528" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "pass", children: "\u4EBA\u5DE5\u6838\u5BF9\u901A\u8FC7" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "fail", children: "\u4EBA\u5DE5\u6838\u5BF9\u5931\u8D25" })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { display: "block" }, children: [
          "\u8BB0\u5F55\u4EBA ",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { name: "observer", required: true })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { display: "block" }, children: [
          "\u5B9E\u9645\u52A8\u4F5C\u4E0E\u7ED3\u679C ",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", { name: "evidence", required: true, maxLength: 8e3 })
        ] }),
        next.step.check.kind === "persistence" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
            "\u91CD\u542F\u524D\u503C ",
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { name: "before" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
            "\u91CD\u542F\u540E\u503C ",
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { name: "after" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "checkbox", name: "restart" }),
            "\u5DF2\u5B8C\u5168\u9000\u51FA\uFF08\u542B\u6258\u76D8\uFF09\u540E\u91CD\u542F"
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { display: "block" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "checkbox", required: true }),
          "\u6211\u5DF2\u6838\u5BF9\u672C\u673A\u684C\u9762\u7248\u672C\u3001\u5DE5\u4F5C\u533A\u3001\u914D\u7F6E\u57FA\u7EBF\u53CA\u5B9E\u9645\u542F\u7528\u96C6\u4E0E\u8BA1\u5212\u4E00\u81F4\uFF1B\u8BB0\u5F55\u4E3A\u4EBA\u5DE5\u89C2\u5BDF\u3002"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "submit", children: "\u4FDD\u5B58\u8BC1\u636E\u5E76\u7EE7\u7EED" })
      ] }) }, next.step.id),
      next && next.failures && next.failures.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "\u5931\u8D25\u4E0E\u53D7\u963B\u9879" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "\u53D7\u963B\u548C\u4E0D\u9002\u7528\u4E0D\u4EE3\u8868\u901A\u8FC7\u3002\u70B9\u51FB\u53EF\u67E5\u770B\u6216\u91CD\u5F55\u8BE5\u6B65\u3002" }),
        next.failures.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { type: "button", disabled: busy, onClick: () => {
            void perform((valid) => load(next.planId + " " + item.id, valid));
          }, children: [
            item.id,
            " \xB7 ",
            item.outcome === "fail" ? "\u5931\u8D25" : "\u53D7\u963B"
          ] }),
          " ",
          item.evidence
        ] }, item.id))
      ] }),
      next && !next.step && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
        "\u5F53\u524D\u8BA1\u5212\u6B65\u9AA4\u5747\u6709\u8BB0\u5F55\uFF1B\u53D7\u963B\u548C\u4E0D\u9002\u7528\u4E0D\u4EE3\u8868\u901A\u8FC7\u3002\u7528 /combo-lab show ",
        next.planId,
        " \u6838\u5BF9\u7ED3\u8BBA\u3002"
      ] })
    ] }) })
  ] });
}
function apply(ctx) {
  const Panel = (props) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ComboLab, { ...props, execute: (...args) => ctx.remote.commands.execute(...args) });
  ctx.slots.inject("conversation.session.header.actions", () => ctx.slots.register({ name: "conversation.session.header.actions", id: "dsh-plugin-combo-lab", order: 160 }, Panel));
}
return module.exports;}});

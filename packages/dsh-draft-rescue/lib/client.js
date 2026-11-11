window.__ModuleLoader__.load({id:"dsh-draft-rescue",factory:(require)=>{var module={exports:{}};var exports=module.exports;
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
  DraftRescue: () => DraftRescue,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(client_exports);
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
var import_react = require("react");

// src/core.ts
var SUPPORTED_VERSION = "0.2.1-rc.5";
var STORAGE_PREFIX = "dsh.conversation.";
function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function requireVersion(boot2) {
  const version = object(boot2) && object(boot2.release) ? boot2.release.version : void 0;
  if (version !== SUPPORTED_VERSION && version !== "0.2.2-rc.1") throw new Error(`\u4EC5\u652F\u6301\u5DF2\u6838\u5BF9\u7684 DSH 0.2.1-rc.5 / 0.2.2-rc.1\uFF0C\u5F53\u524D ${typeof version === "string" ? version : "\u672A\u77E5"}\uFF1B\u5DF2\u62D2\u7EDD\u8BFB\u53D6\u8349\u7A3F\u3002`);
}
function draftText(value) {
  if (typeof value === "string") return value;
  if (!object(value) || typeof value.text !== "string" || !Array.isArray(value.references)) return void 0;
  const text = value.text;
  let end = 0;
  if (value.command !== void 0) {
    if (!object(value.command) || typeof value.command.token !== "string") return void 0;
    const spelling = value.command.token.trimEnd();
    if (!/^\/\S/u.test(spelling) || !text.startsWith(spelling)) return void 0;
    end = spelling.length;
  }
  for (const ref of value.references) {
    if (!object(ref) || typeof ref.source !== "string" || typeof ref.ref !== "string" || typeof ref.label !== "string" || typeof ref.clipboardText !== "string" || typeof ref.offset !== "number" || !Number.isInteger(ref.offset) || ref.offset < end || typeof ref.length !== "number" || !Number.isInteger(ref.length) || ref.length <= 0 || ref.length !== ref.clipboardText.length || ref.appearance !== void 0 && !["session", "file", "folder"].includes(String(ref.appearance)) || ref.invalid !== void 0 && typeof ref.invalid !== "boolean") return void 0;
    end = ref.offset + ref.length;
    if (end > text.length || text.slice(ref.offset, end) !== ref.clipboardText) return void 0;
  }
  if (value.quotes !== void 0) {
    if (!Array.isArray(value.quotes)) return void 0;
    for (const quote of value.quotes) {
      if (!object(quote) || typeof quote.text !== "string" || !quote.text.trim() || !Number.isSafeInteger(quote.offset) || !Number.isSafeInteger(quote.length) || Number(quote.offset) < 0 || Number(quote.length) <= 0) return void 0;
      const projected = quote.text.replace(/\r\n?/gu, "\n").split("\n").map((line) => `> ${line}`).join("\n");
      if (quote.length !== projected.length || text.slice(Number(quote.offset), Number(quote.offset) + Number(quote.length)) !== projected) return void 0;
    }
    let spanEnd = object(value.command) ? String(value.command.token).trimEnd().length : 0;
    for (const span of [...value.references, ...value.quotes].sort((a, b) => a.offset - b.offset)) {
      if (span.offset < spanEnd) return void 0;
      spanEnd = span.offset + span.length;
    }
  }
  return text;
}
function listDrafts(storage, boot2) {
  requireVersion(boot2);
  const result = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(STORAGE_PREFIX) || key.length === STORAGE_PREFIX.length) continue;
    const raw = storage.getItem(key);
    if (raw === null) continue;
    let value;
    try {
      value = JSON.parse(raw);
    } catch {
      continue;
    }
    if (!object(value)) continue;
    const text = draftText(value.draft);
    if (text?.trim()) result.push({ sessionId: key.slice(STORAGE_PREFIX.length), text });
  }
  return result.sort((a, b) => a.sessionId.localeCompare(b.sessionId));
}
function copyText(draft) {
  return draft.text;
}
function prepareAppend(draft, input, currentSnapshot) {
  if (input.phase !== "plain") throw new Error("\u5F53\u524D\u8F93\u5165\u6846\u5FD9\u788C\u6216\u5904\u4E8E\u547D\u4EE4\u6A21\u5F0F\uFF0C\u8BF7\u56DE\u5230\u666E\u901A\u8F93\u5165\u540E\u8FFD\u52A0\u3002");
  let quoteWidth = 0;
  if (currentSnapshot !== void 0) {
    if (!object(currentSnapshot) || draftText(currentSnapshot) !== input.draft) throw new Error("\u5F53\u524D\u8349\u7A3F\u5FEB\u7167\u4E0E\u8F93\u5165\u6846\u4E0D\u4E00\u81F4\uFF0C\u8BF7\u590D\u5236\u539F\u6587\u540E\u7C98\u8D34\u3002");
    quoteWidth = (currentSnapshot.quotes ?? []).reduce((sum, quote) => sum + quote.length - 1, 0);
  }
  const end = input.draft.length - quoteWidth - input.occurrences.reduce((sum, ref) => sum + ref.length - 1, 0);
  if (end < 0) throw new Error("\u8F93\u5165\u6846\u72B6\u6001\u65E0\u6548\uFF0C\u8BF7\u91CD\u8BD5\u3002");
  return {
    text: (input.draft ? "\n" : "") + copyText(draft),
    span: { start: end, end, draftRev: input.draftRev }
  };
}

// src/client.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var inject = ["slots"];
function boot() {
  return window.__DSH_BOOT__;
}
function formatMeta(meta) {
  return "\u6807\u9898\uFF1A" + (meta.title ?? "\u672A\u77E5") + "\uFF1B\u5DE5\u4F5C\u533A\uFF1A" + (meta.workspace ?? "\u672A\u77E5");
}
function DraftRescue({ sessionId, useInput, inputActions, useSessions, useProjection }) {
  const input = useInput((value) => value);
  const sessionsById = (useSessions ?? ((select) => select({ byId: {} })))((state) => state.byId);
  const projectedTitle = (useProjection ?? ((_key) => null))("title");
  const projectedCwd = (useProjection ?? ((_key) => null))("workingDirectory");
  function sessionMeta(id) {
    const row = sessionsById?.[id];
    let title;
    let workspace;
    if (row && typeof row.title === "string" && row.title.trim()) title = row.title;
    if (row && typeof row.cwd === "string" && row.cwd.trim()) workspace = row.cwd;
    if (id === sessionId) {
      if (typeof projectedTitle === "string" && projectedTitle.trim()) title = projectedTitle;
      if (typeof projectedCwd === "string" && projectedCwd.trim()) workspace = projectedCwd;
    }
    return { title, workspace };
  }
  const [open, setOpen] = (0, import_react.useState)(false);
  const [drafts, setDrafts] = (0, import_react.useState)([]);
  const [notice, setNotice] = (0, import_react.useState)("");
  const [query, setQuery] = (0, import_react.useState)("");
  const [page, setPage] = (0, import_react.useState)(0);
  const [preview, setPreview] = (0, import_react.useState)(null);
  const live = (0, import_react.useRef)(input);
  live.current = input;
  const generation = (0, import_react.useRef)(0);
  const close = () => {
    generation.current++;
    setOpen(false);
    setDrafts([]);
    setNotice("");
    setQuery("");
    setPage(0);
    setPreview(null);
  };
  (0, import_react.useEffect)(() => {
    close();
    return () => {
      generation.current++;
    };
  }, [sessionId]);
  const filtered = (0, import_react.useMemo)(() => {
    const needle = query.toLocaleLowerCase();
    return drafts.filter((d) => {
      const meta = sessionMeta(d.sessionId);
      return [d.sessionId, d.text, meta.title ?? "", meta.workspace ?? ""].join("\n").toLocaleLowerCase().includes(needle);
    });
  }, [drafts, query, sessionId, sessionsById, projectedTitle, projectedCwd]);
  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  const currentPage = Math.min(page, pages - 1);
  const targetMeta = sessionMeta(sessionId);
  function refresh() {
    generation.current++;
    setPage(0);
    setPreview(null);
    try {
      requireVersion(boot());
      setDrafts(listDrafts(window.localStorage, boot()));
      setNotice("");
    } catch (error) {
      setDrafts([]);
      setNotice(error instanceof Error ? error.message : "\u65E0\u6CD5\u8BBF\u95EE\u672C\u673A\u8349\u7A3F\u5B58\u50A8\u3002");
    }
  }
  async function copy(draft) {
    const revision = generation.current;
    try {
      requireVersion(boot());
      await navigator.clipboard.writeText(copyText(draft));
      if (generation.current === revision) setNotice("\u5DF2\u590D\u5236\u539F\u6587\u3002");
    } catch {
      if (generation.current === revision) setNotice("\u590D\u5236\u5931\u8D25\uFF1B\u8BF7\u5237\u65B0\u5E76\u68C0\u67E5\u7248\u672C\u3001\u526A\u8D34\u677F\u6743\u9650\uFF0C\u6216\u4ECE\u9884\u89C8\u624B\u52A8\u590D\u5236\u3002");
    }
  }
  function append(draft) {
    try {
      requireVersion(boot());
      let currentSnapshot;
      if (boot()?.release?.version === "0.2.2-rc.1") {
        inputActions.persistDraft();
        const raw = window.localStorage.getItem("dsh.conversation." + sessionId);
        currentSnapshot = raw ? JSON.parse(raw).draft : void 0;
        if (live.current.draft && currentSnapshot === void 0) throw new Error("\u65E0\u6CD5\u6838\u5BF9\u5F53\u524D\u5F15\u7528\u5757\u4F4D\u7F6E\uFF0C\u8BF7\u590D\u5236\u539F\u6587\u540E\u7C98\u8D34\u3002");
      }
      const prepared = prepareAppend(draft, live.current, currentSnapshot);
      if (!inputActions.insertText(prepared.text, prepared.span)) throw new Error("\u8F93\u5165\u6846\u5DF2\u53D8\u5316\u6216\u6682\u4E0D\u53EF\u7F16\u8F91\uFF0C\u8BF7\u91CD\u8BD5\u3002");
      setNotice("\u5DF2\u8FFD\u52A0\u5230\u5F53\u524D\u8F93\u5165\u6846\uFF0C\u5C1A\u672A\u53D1\u9001\u3002");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "\u8FFD\u52A0\u5931\u8D25\u3002");
    }
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", title: "\u627E\u56DE\u672C\u673A\u672A\u53D1\u9001\u7684\u6587\u5B57\u8349\u7A3F", onClick: () => {
      refresh();
      setOpen(true);
    }, children: "\u672A\u53D1\u9001\u8349\u7A3F" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Modal, { open, onClose: close, title: "\u672A\u53D1\u9001\u8349\u7A3F", closeLabel: "\u5173\u95ED", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { width: "min(640px, 75vw)", maxHeight: "65vh", overflowY: "auto" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "\u53EA\u6062\u590D\u6587\u5B57\uFF1B\u5F15\u7528\u80F6\u56CA\u663E\u793A\u4E3A\u6587\u5B57\uFF0C\u9644\u4EF6\u4E0D\u6062\u590D\u3002\u6309\u4F1A\u8BDD ID \u6392\u5E8F\u3002\u6807\u9898\u548C\u5DE5\u4F5C\u533A\u4EC5\u5728\u80FD\u4ECE\u5B98\u65B9\u4F1A\u8BDD\u5217\u8868\u6216\u6295\u5F71\u53EF\u9760\u8BFB\u5230\u65F6\u663E\u793A\uFF0C\u5426\u5219\u4E3A\u672A\u77E5\uFF1B\u4E0D\u7F16\u9020\u66F4\u65B0\u65F6\u95F4\u3002" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
        "\u8FFD\u52A0\u76EE\u6807\uFF1A\u5F53\u524D\u4F1A\u8BDD ",
        sessionId,
        "\uFF1B",
        formatMeta(targetMeta)
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", "data-modal-autofocus": true, onClick: refresh, children: "\u5237\u65B0\u8349\u7A3F" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
        "\u7B5B\u9009\u4F1A\u8BDD\u3001\u6807\u9898\u3001\u5DE5\u4F5C\u533A\u6216\u6B63\u6587 ",
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { value: query, onChange: (event) => {
          setQuery(event.target.value);
          setPage(0);
          setPreview(null);
        } })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
        filtered.length,
        " \u6761 \xB7 \u7B2C ",
        currentPage + 1,
        "/",
        pages,
        " \u9875"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", disabled: currentPage === 0, onClick: () => {
        setPage(currentPage - 1);
        setPreview(null);
      }, children: "\u4E0A\u4E00\u9875" }),
      " ",
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", disabled: currentPage + 1 >= pages, onClick: () => {
        setPage(currentPage + 1);
        setPreview(null);
      }, children: "\u4E0B\u4E00\u9875" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { role: "status", "aria-live": "polite", children: notice }),
      !drafts.length && !notice && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "\u672C\u673A\u6CA1\u6709\u975E\u7A7A\u6587\u5B57\u8349\u7A3F\u3002" }),
      filtered.slice(currentPage * 20, (currentPage + 1) * 20).map((draft) => {
        const meta = sessionMeta(draft.sessionId);
        const current = draft.sessionId === sessionId;
        return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { style: { marginTop: 16 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
            "\u4F1A\u8BDD ",
            draft.sessionId,
            " \xB7 ",
            draft.text.length,
            " \u5B57\u7B26",
            current ? " \xB7 \u5F53\u524D\u4F1A\u8BDD\u8349\u7A3F" : "",
            " \xB7 ",
            formatMeta(meta)
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", onClick: () => setPreview(preview === draft.sessionId ? null : draft.sessionId), children: "\u9884\u89C8\u539F\u6587" }),
          preview === draft.sessionId && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", { style: { whiteSpace: "pre-wrap", overflowWrap: "anywhere", userSelect: "text" }, children: draft.text }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", onClick: () => {
            void copy(draft);
          }, children: "\u590D\u5236\u539F\u6587" }),
          " ",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", disabled: input.phase !== "plain", onClick: () => append(draft), children: "\u8FFD\u52A0\u5230\u5F53\u524D\u8F93\u5165\u6846" })
        ] }, draft.sessionId);
      })
    ] }) })
  ] });
}
function apply(ctx) {
  ctx.slots.inject("conversation.session.header.actions", () => ctx.slots.register({
    name: "conversation.session.header.actions",
    id: "dsh-draft-rescue",
    order: 150
  }, DraftRescue));
}
return module.exports;}});

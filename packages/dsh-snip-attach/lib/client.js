window.__ModuleLoader__.load({id:"dsh-snip-attach",factory:(require)=>{var module={exports:{}};var exports=module.exports;
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
  SnipButton: () => SnipButton,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(client_exports);
var import_react = require("react");

// src/intake.ts
var FILE_SELECTOR = 'input[type="file"][hidden][multiple]';
var FALLBACK = "\u56FE\u7247\u5DF2\u5728\u526A\u8D34\u677F\uFF0C\u53EF\u6309 Ctrl+V";
function abortable(work, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => {
      reject(new Error("\u622A\u56FE\u7B49\u5F85\u5DF2\u7ED3\u675F\u3002"));
    };
    const finish = (action) => {
      signal.removeEventListener("abort", abort);
      action();
    };
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    work.then((value) => {
      finish(() => {
        resolve(value);
      });
    }, (error) => {
      finish(() => {
        reject(error);
      });
    });
  });
}
function requireDesktop(boot2, location) {
  const version = boot2?.release?.version;
  if (version !== "0.2.1-rc.5" || location.protocol !== "dsh-app:" || location.hostname !== "app") {
    throw new Error("\u4EC5\u652F\u6301 DSH 0.2.1-rc.5 \u684C\u9762\u9875\u9762\u3002");
  }
}
function shotUrl(text) {
  const match = /^截图就绪 (http:\/\/127\.0\.0\.1:(\d{1,5})\/shot\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/.exec(text ?? "");
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 65535) throw new Error("\u622A\u56FE\u670D\u52A1\u8FD4\u56DE\u4E86\u65E0\u6548\u5730\u5740\u3002");
  return match[1];
}
function fileInputFor(button) {
  const card = button.closest("[data-composer-card]");
  const inputs = card?.querySelectorAll(FILE_SELECTOR);
  if (!button.isConnected || inputs?.length !== 1 || inputs[0].disabled) throw new Error(FALLBACK);
  return inputs[0];
}
function injectFile(input, file) {
  if (!input.isConnected || input.disabled) throw new Error(FALLBACK);
  const owner = input.ownerDocument.defaultView;
  if (!owner) throw new Error(FALLBACK);
  const transfer = new owner.DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
  input.dispatchEvent(new owner.Event("change", { bubbles: true }));
}

// src/client.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var inject = ["slots", "remote", "remote.commands"];
var boot = () => window.__DSH_BOOT__;
function SnipButton({ sessionId, useInput, useSession, execute }) {
  const input = useInput((value) => value);
  const unavailable = useSession((value) => value.removed || value.subagent !== null);
  const live = (0, import_react.useRef)(input);
  live.current = input;
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [notice, setNotice] = (0, import_react.useState)("");
  const pending = (0, import_react.useRef)(null);
  (0, import_react.useEffect)(() => {
    setBusy(false);
    setNotice("");
    return () => {
      pending.current?.abort();
      pending.current = null;
    };
  }, [sessionId]);
  (0, import_react.useEffect)(() => {
    if (!notice) return;
    const timer = setTimeout(() => {
      setNotice("");
    }, 6e3);
    return () => {
      clearTimeout(timer);
    };
  }, [notice]);
  const allowed = () => {
    const state = live.current;
    return !unavailable && state.phase === "plain";
  };
  let supported = true;
  try {
    requireDesktop(boot(), window.location);
  } catch {
    supported = false;
  }
  async function take(button) {
    if (pending.current || !allowed()) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setNotice("");
    let captured = false;
    const timeout = setTimeout(() => {
      controller.abort();
    }, 16e4);
    try {
      requireDesktop(boot(), window.location);
      const fileInput = fileInputFor(button);
      const execution = await abortable(execute(sessionId, "/screenshot", []), controller.signal);
      if (controller.signal.aborted) return;
      if (!execution.ok) throw new Error("\u622A\u56FE\u547D\u4EE4\u6267\u884C\u5931\u8D25\u3002");
      const result = execution.value?.result;
      if (result?.kind !== "success") throw new Error(result?.text ?? "\u622A\u56FE\u547D\u4EE4\u4E0D\u53EF\u7528\u3002");
      const response = await fetch(shotUrl(result.text), { signal: controller.signal, cache: "no-store", credentials: "omit", redirect: "error" });
      if (response.status === 204) {
        setNotice("\u622A\u56FE\u5DF2\u53D6\u6D88\u6216\u672A\u5B8C\u6210\uFF0C\u8BF7\u91CD\u8BD5\u3002");
        return;
      }
      if (response.status !== 200 || response.headers.get("Content-Type") !== "image/png") throw new Error("\u622A\u56FE\u8BFB\u53D6\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002");
      const blob = await response.blob();
      captured = true;
      if (!blob.size) throw new Error(FALLBACK);
      requireDesktop(boot(), window.location);
      if (controller.signal.aborted) return;
      if (!allowed() || fileInputFor(button) !== fileInput) throw new Error(FALLBACK);
      const before = new Set(live.current.attachmentIds);
      const file = new File([blob], `screenshot-${Date.now()}.png`, { type: "image/png" });
      injectFile(fileInput, file);
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });
      if (controller.signal.aborted) return;
      if (!live.current.attachmentIds.some((id) => !before.has(id))) throw new Error(FALLBACK);
      setNotice("\u622A\u56FE\u5DF2\u52A0\u5165\u5F85\u53D1\u9001\u6D88\u606F");
    } catch (error) {
      if (!controller.signal.aborted) setNotice(captured ? FALLBACK : error instanceof Error ? error.message : "\u622A\u56FE\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002");
      else if (pending.current === controller) setNotice("\u622A\u56FE\u7B49\u5F85\u8D85\u65F6\uFF0C\u8BF7\u91CD\u8BD5\u3002");
    } finally {
      clearTimeout(timeout);
      if (pending.current === controller) {
        pending.current = null;
        setBusy(false);
      }
    }
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { position: "relative", display: "inline-flex" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "button",
      {
        type: "button",
        "aria-label": "\u622A\u56FE\u5E76\u6DFB\u52A0\u9644\u4EF6",
        title: "\u622A\u56FE\u5E76\u6DFB\u52A0\u9644\u4EF6\uFF08Windows\uFF09",
        disabled: !supported || busy || !allowed(),
        onMouseDown: (event) => event.preventDefault(),
        onClick: (event) => {
          void take(event.currentTarget);
        },
        style: { display: "inline-flex", padding: 6, border: 0, borderRadius: 6, color: "inherit", background: "transparent", cursor: "pointer" },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.6", "aria-hidden": "true", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 6l1.5-3h5L16 6h4a2 2 0 012 2v11a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "12", cy: "13", r: "4" })
        ] })
      }
    ),
    notice && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { role: "status", "aria-live": "polite", style: { position: "absolute", bottom: "100%", left: 0, zIndex: 30, width: 260, padding: 10, borderRadius: 8, background: "var(--dsw-static-neutral-100, #eee)", color: "var(--dsw-static-neutral-900, #222)", boxShadow: "0 2px 12px #0003" }, children: notice })
  ] });
}
function apply(ctx) {
  const Button = (props) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SnipButton, { ...props, execute: (...args) => ctx.remote.commands.execute(...args) });
  ctx.slots.inject("conversation.input.left", () => ctx.slots.register({
    name: "conversation.input.left",
    id: "dsh-snip-attach",
    order: 0
  }, Button));
}
return module.exports;}});

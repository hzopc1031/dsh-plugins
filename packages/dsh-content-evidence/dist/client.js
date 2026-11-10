window.__ModuleLoader__.load({id:"dsh-content-evidence",factory:(require)=>{const module={exports:{}};const exports=module.exports;
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject,
  materialPreview: () => materialPreview,
  name: () => name
});
module.exports = __toCommonJS(index_exports);
var import_react = __toESM(require("react"), 1);

// lib/typert.remote-client.js
var import_zod = require("zod");

// node_modules/@deepseek-ai/dsh-typert-protocol/lib/types/remote-info.js
function createTypertRemoteInfo(spec, zod) {
  return new RemoteInfo(spec, zod);
}
var RemoteInfo = class {
  spec;
  zod;
  index;
  constructor(spec, zod) {
    this.spec = spec;
    this.zod = zod;
  }
  get package() {
    return this.spec.package;
  }
  get descriptors() {
    return this.resolve().descriptors;
  }
  get methods() {
    return this.resolve().methods;
  }
  resolve() {
    if (this.index !== void 0)
      return this.index;
    const zod = this.zod;
    const descriptors = [];
    const methods = /* @__PURE__ */ Object.create(null);
    for (const [endpoint, definition] of Object.entries(this.spec.methods)) {
      const separator = endpoint.indexOf("/");
      const namespace = endpoint.slice(0, separator);
      const method = endpoint.slice(separator + 1);
      const parameters = definition.parameters.map((parameter) => ({ ...parameter, wire: parameter.wire ?? parameter.name }));
      const descriptor = {
        ...definition,
        id: `${this.spec.package}#${endpoint}`,
        namespace,
        method,
        parameters,
        result: definition.result.description === void 0 ? definition.result : new ResultValue(definition.result)
      };
      if (definition.invocation.kind === "direct") {
        const inputs = [];
        const direct = Object.assign(descriptor, {
          input(options) {
            const strict = options?.strict === true;
            return inputs[strict ? 1 : 0] ??= new NamedInput(parameters, strict, zod);
          },
          invoke(remote, input, signal) {
            const named = input;
            const values = parameters.map((parameter) => named[parameter.wire]);
            if (definition.cancellation !== void 0)
              values.push(signal);
            const receiver = Reflect.get(remote, namespace);
            const call = Reflect.get(receiver, method);
            return call.apply(receiver, values);
          }
        });
        methods[endpoint] = direct;
      }
      descriptors.push(descriptor);
    }
    return this.index = { descriptors, methods };
  }
};
function optional(parameter) {
  return parameter.source === "json" && parameter.acceptsUndefined === true;
}
var NamedInput = class {
  parameters;
  strict;
  zod;
  schema;
  projection;
  constructor(parameters, strict, zod) {
    this.parameters = parameters;
    this.strict = strict;
    this.zod = zod;
  }
  codec(parameter) {
    return this.strict ? parameter.strictCodec : parameter.codec;
  }
  create = () => this.schema ??= this.zod.strictObject(Object.fromEntries(this.parameters.map((parameter) => {
    const value2 = this.codec(parameter).create();
    return [parameter.wire, optional(parameter) ? value2.optional() : value2.nonoptional()];
  })));
  get jsonSchema() {
    return this.project().jsonSchema;
  }
  get jsonSchemaError() {
    return this.project().jsonSchemaError;
  }
  project() {
    if (this.projection !== void 0)
      return this.projection;
    const unavailable = this.parameters.find((parameter) => this.codec(parameter).jsonSchema === void 0);
    if (unavailable !== void 0) {
      return this.projection = { jsonSchemaError: this.codec(unavailable).jsonSchemaError ?? `No JSON Schema for parameter ${unavailable.wire}` };
    }
    return this.projection = {
      jsonSchema: {
        type: "object",
        properties: Object.fromEntries(this.parameters.map((parameter) => [parameter.wire, {
          ...this.codec(parameter).jsonSchema,
          ...parameter.description === void 0 ? {} : { description: parameter.description }
        }])),
        required: this.parameters.filter((parameter) => !optional(parameter)).map((parameter) => parameter.wire),
        additionalProperties: false
      }
    };
  }
};
var ResultValue = class {
  spec;
  projection;
  constructor(spec) {
    this.spec = spec;
  }
  get mode() {
    return this.spec.mode;
  }
  get typeSymbol() {
    return this.spec.typeSymbol;
  }
  get create() {
    return this.spec.create;
  }
  get decode() {
    return this.spec.decode;
  }
  get encode() {
    return this.spec.encode;
  }
  get description() {
    return this.spec.description;
  }
  get jsonSchemaError() {
    return this.spec.jsonSchemaError;
  }
  get jsonSchema() {
    if (this.projection === void 0) {
      const schema = this.spec.jsonSchema;
      this.projection = { value: schema === void 0 ? void 0 : { ...schema, description: this.spec.description } };
    }
    return this.projection.value;
  }
};

// lib/typert.remote-client.js
var dsh_content_evidence_contentEvidence_addSource_parameter_0$schema$value;
var dsh_content_evidence_contentEvidence_addSource_parameter_0$schema = () => dsh_content_evidence_contentEvidence_addSource_parameter_0$schema$value ??= import_zod.z.string();
var dsh_content_evidence_contentEvidence_addSource_parameter_1$schema$value;
var dsh_content_evidence_contentEvidence_addSource_parameter_1$schema = () => dsh_content_evidence_contentEvidence_addSource_parameter_1$schema$value ??= import_zod.z.string();
var dsh_content_evidence_contentEvidence_addSource_parameter_2$schema$value;
var dsh_content_evidence_contentEvidence_addSource_parameter_2$schema = () => dsh_content_evidence_contentEvidence_addSource_parameter_2$schema$value ??= import_zod.z.string();
var dsh_content_evidence_contentEvidence_addSource_result$schema$value;
var dsh_content_evidence_contentEvidence_addSource_result$schema = () => dsh_content_evidence_contentEvidence_addSource_result$schema$value ??= import_zod.z.object({
  "id": import_zod.z.string(),
  "url": import_zod.z.string(),
  "title": import_zod.z.string(),
  "createdAt": import_zod.z.string()
});
var dsh_content_evidence_contentEvidence_backfillPublishedLink_parameter_0$schema$value;
var dsh_content_evidence_contentEvidence_backfillPublishedLink_parameter_0$schema = () => dsh_content_evidence_contentEvidence_backfillPublishedLink_parameter_0$schema$value ??= import_zod.z.string();
var dsh_content_evidence_contentEvidence_backfillPublishedLink_parameter_1$schema$value;
var dsh_content_evidence_contentEvidence_backfillPublishedLink_parameter_1$schema = () => dsh_content_evidence_contentEvidence_backfillPublishedLink_parameter_1$schema$value ??= import_zod.z.union([import_zod.z.literal("x"), import_zod.z.literal("xiaohongshu"), import_zod.z.literal("douyin"), import_zod.z.literal("weixin-video")]);
var dsh_content_evidence_contentEvidence_backfillPublishedLink_parameter_2$schema$value;
var dsh_content_evidence_contentEvidence_backfillPublishedLink_parameter_2$schema = () => dsh_content_evidence_contentEvidence_backfillPublishedLink_parameter_2$schema$value ??= import_zod.z.string();
var dsh_content_evidence_contentEvidence_backfillPublishedLink_result$schema$value;
var dsh_content_evidence_contentEvidence_backfillPublishedLink_result$schema = () => dsh_content_evidence_contentEvidence_backfillPublishedLink_result$schema$value ??= import_zod.z.object({
  "platform": import_zod.z.union([import_zod.z.literal("x"), import_zod.z.literal("xiaohongshu"), import_zod.z.literal("douyin"), import_zod.z.literal("weixin-video")]),
  "url": import_zod.z.string(),
  "recordedAt": import_zod.z.string()
});
var dsh_content_evidence_contentEvidence_captureMaterial_parameter_0$schema$value;
var dsh_content_evidence_contentEvidence_captureMaterial_parameter_0$schema = () => dsh_content_evidence_contentEvidence_captureMaterial_parameter_0$schema$value ??= import_zod.z.string();
var dsh_content_evidence_contentEvidence_captureMaterial_parameter_1$schema$value;
var dsh_content_evidence_contentEvidence_captureMaterial_parameter_1$schema = () => dsh_content_evidence_contentEvidence_captureMaterial_parameter_1$schema$value ??= import_zod.z.object({
  "name": import_zod.z.string(),
  "mediaType": import_zod.z.string(),
  "base64": import_zod.z.string(),
  "sourceId": import_zod.z.union([import_zod.z.literal(null), import_zod.z.string()])
});
var dsh_content_evidence_contentEvidence_captureMaterial_result$schema$value;
var dsh_content_evidence_contentEvidence_captureMaterial_result$schema = () => dsh_content_evidence_contentEvidence_captureMaterial_result$schema$value ??= import_zod.z.object({
  "id": import_zod.z.string(),
  "name": import_zod.z.string(),
  "mediaType": import_zod.z.string(),
  "path": import_zod.z.string(),
  "bytes": import_zod.z.number(),
  "sha256": import_zod.z.string(),
  "sourceId": import_zod.z.union([import_zod.z.literal(null), import_zod.z.string()]),
  "createdAt": import_zod.z.string()
});
var dsh_content_evidence_contentEvidence_createTopic_parameter_0$schema$value;
var dsh_content_evidence_contentEvidence_createTopic_parameter_0$schema = () => dsh_content_evidence_contentEvidence_createTopic_parameter_0$schema$value ??= import_zod.z.string();
var dsh_content_evidence_contentEvidence_createTopic_result$schema$value;
var dsh_content_evidence_contentEvidence_createTopic_result$schema = () => dsh_content_evidence_contentEvidence_createTopic_result$schema$value ??= import_zod.z.object({
  "id": import_zod.z.string(),
  "idea": import_zod.z.string(),
  "createdAt": import_zod.z.string(),
  "updatedAt": import_zod.z.string(),
  "sources": import_zod.z.array(import_zod.z.object({
    "id": import_zod.z.string(),
    "url": import_zod.z.string(),
    "title": import_zod.z.string(),
    "createdAt": import_zod.z.string()
  })),
  "materials": import_zod.z.array(import_zod.z.object({
    "id": import_zod.z.string(),
    "name": import_zod.z.string(),
    "mediaType": import_zod.z.string(),
    "path": import_zod.z.string(),
    "bytes": import_zod.z.number(),
    "sha256": import_zod.z.string(),
    "sourceId": import_zod.z.union([import_zod.z.literal(null), import_zod.z.string()]),
    "createdAt": import_zod.z.string()
  })),
  "experiments": import_zod.z.array(import_zod.z.object({
    "id": import_zod.z.string(),
    "command": import_zod.z.string(),
    "output": import_zod.z.string(),
    "versions": import_zod.z.string(),
    "conditions": import_zod.z.string(),
    "createdAt": import_zod.z.string()
  })),
  "claims": import_zod.z.array(import_zod.z.object({
    "id": import_zod.z.string(),
    "text": import_zod.z.string(),
    "sourceId": import_zod.z.union([import_zod.z.literal(null), import_zod.z.string()]),
    "status": import_zod.z.union([import_zod.z.literal("\u6709\u6765\u6E90"), import_zod.z.literal("\u5F85\u6838\u5B9E")]),
    "createdAt": import_zod.z.string()
  })),
  "drafts": import_zod.z.object({
    "x": import_zod.z.union([import_zod.z.literal(null), import_zod.z.object({
      "content": import_zod.z.string(),
      "contentHash": import_zod.z.string(),
      "revision": import_zod.z.number(),
      "updatedAt": import_zod.z.string(),
      "status": import_zod.z.union([import_zod.z.literal("editing"), import_zod.z.literal("complete")]),
      "review": import_zod.z.object({
        "status": import_zod.z.union([import_zod.z.literal("pending"), import_zod.z.literal("passed"), import_zod.z.literal("failed")]),
        "contentHash": import_zod.z.union([import_zod.z.literal(null), import_zod.z.string()]),
        "findings": import_zod.z.array(import_zod.z.union([import_zod.z.string(), import_zod.z.object({
          "code": import_zod.z.union([import_zod.z.literal("ai-label"), import_zod.z.literal("sensitive"), import_zod.z.literal("absolute"), import_zod.z.literal("citation"), import_zod.z.literal("evidence-changed"), import_zod.z.literal("legacy-shape")]),
          "location": import_zod.z.string(),
          "excerpt": import_zod.z.string(),
          "fix": import_zod.z.string()
        })])),
        "reviewedAt": import_zod.z.union([import_zod.z.literal(null), import_zod.z.string()]),
        "rulesHash": import_zod.z.union([import_zod.z.undefined(), import_zod.z.string()]).optional()
      }),
      "body": import_zod.z.union([import_zod.z.undefined(), import_zod.z.object({
        "kind": import_zod.z.literal("x-single"),
        "post": import_zod.z.string()
      }), import_zod.z.object({
        "kind": import_zod.z.literal("x-thread"),
        "posts": import_zod.z.array(import_zod.z.string())
      }), import_zod.z.object({
        "kind": import_zod.z.literal("xiaohongshu"),
        "title": import_zod.z.string(),
        "body": import_zod.z.string(),
        "cards": import_zod.z.array(import_zod.z.string())
      }), import_zod.z.object({
        "kind": import_zod.z.literal("douyin"),
        "voiceover": import_zod.z.string(),
        "shots": import_zod.z.array(import_zod.z.string())
      }), import_zod.z.object({
        "kind": import_zod.z.literal("weixin-video"),
        "voiceover": import_zod.z.string(),
        "shots": import_zod.z.array(import_zod.z.string())
      })]).optional(),
      "claimIds": import_zod.z.union([import_zod.z.undefined(), import_zod.z.array(import_zod.z.string())]).optional(),
      "evidenceHash": import_zod.z.union([import_zod.z.undefined(), import_zod.z.string()]).optional()
    })]),
    "xiaohongshu": import_zod.z.union([import_zod.z.literal(null), import_zod.z.object({
      "content": import_zod.z.string(),
      "contentHash": import_zod.z.string(),
      "revision": import_zod.z.number(),
      "updatedAt": import_zod.z.string(),
      "status": import_zod.z.union([import_zod.z.literal("editing"), import_zod.z.literal("complete")]),
      "review": import_zod.z.object({
        "status": import_zod.z.union([import_zod.z.literal("pending"), import_zod.z.literal("passed"), import_zod.z.literal("failed")]),
        "contentHash": import_zod.z.union([import_zod.z.literal(null), import_zod.z.string()]),
        "findings": import_zod.z.array(import_zod.z.union([import_zod.z.string(), import_zod.z.object({
          "code": import_zod.z.union([import_zod.z.literal("ai-label"), import_zod.z.literal("sensitive"), import_zod.z.literal("absolute"), import_zod.z.literal("citation"), import_zod.z.literal("evidence-changed"), import_zod.z.literal("legacy-shape")]),
          "location": import_zod.z.string(),
          "excerpt": import_zod.z.string(),
          "fix": import_zod.z.string()
        })])),
        "reviewedAt": import_zod.z.union([import_zod.z.literal(null), import_zod.z.string()]),
        "rulesHash": import_zod.z.union([import_zod.z.undefined(), import_zod.z.string()]).optional()
      }),
      "body": import_zod.z.union([import_zod.z.undefined(), import_zod.z.object({
        "kind": import_zod.z.literal("x-single"),
        "post": import_zod.z.string()
      }), import_zod.z.object({
        "kind": import_zod.z.literal("x-thread"),
        "posts": import_zod.z.array(import_zod.z.string())
      }), import_zod.z.object({
        "kind": import_zod.z.literal("xiaohongshu"),
        "title": import_zod.z.string(),
        "body": import_zod.z.string(),
        "cards": import_zod.z.array(import_zod.z.string())
      }), import_zod.z.object({
        "kind": import_zod.z.literal("douyin"),
        "voiceover": import_zod.z.string(),
        "shots": import_zod.z.array(import_zod.z.string())
      }), import_zod.z.object({
        "kind": import_zod.z.literal("weixin-video"),
        "voiceover": import_zod.z.string(),
        "shots": import_zod.z.array(import_zod.z.string())
      })]).optional(),
      "claimIds": import_zod.z.union([import_zod.z.undefined(), import_zod.z.array(import_zod.z.string())]).optional(),
      "evidenceHash": import_zod.z.union([import_zod.z.undefined(), import_zod.z.string()]).optional()
    })]),
    "douyin": import_zod.z.union([import_zod.z.literal(null), import_zod.z.object({
      "content": import_zod.z.string(),
      "contentHash": import_zod.z.string(),
      "revision": import_zod.z.number(),
      "updatedAt": import_zod.z.string(),
      "status": import_zod.z.union([import_zod.z.literal("editing"), import_zod.z.literal("complete")]),
      "review": import_zod.z.object({
        "status": import_zod.z.union([import_zod.z.literal("pending"), import_zod.z.literal("passed"), import_zod.z.literal("failed")]),
        "contentHash": import_zod.z.union([import_zod.z.literal(null), import_zod.z.string()]),
        "findings": import_zod.z.array(import_zod.z.union([import_zod.z.string(), import_zod.z.object({
          "code": import_zod.z.union([import_zod.z.literal("ai-label"), import_zod.z.literal("sensitive"), import_zod.z.literal("absolute"), import_zod.z.literal("citation"), import_zod.z.literal("evidence-changed"), import_zod.z.literal("legacy-shape")]),
          "location": import_zod.z.string(),
          "excerpt": import_zod.z.string(),
          "fix": import_zod.z.string()
        })])),
        "reviewedAt": import_zod.z.union([import_zod.z.literal(null), import_zod.z.string()]),
        "rulesHash": import_zod.z.union([import_zod.z.undefined(), import_zod.z.string()]).optional()
      }),
      "body": import_zod.z.union([import_zod.z.undefined(), import_zod.z.object({
        "kind": import_zod.z.literal("x-single"),
        "post": import_zod.z.string()
      }), import_zod.z.object({
        "kind": import_zod.z.literal("x-thread"),
        "posts": import_zod.z.array(import_zod.z.string())
      }), import_zod.z.object({
        "kind": import_zod.z.literal("xiaohongshu"),
        "title": import_zod.z.string(),
        "body": import_zod.z.string(),
        "cards": import_zod.z.array(import_zod.z.string())
      }), import_zod.z.object({
        "kind": import_zod.z.literal("douyin"),
        "voiceover": import_zod.z.string(),
        "shots": import_zod.z.array(import_zod.z.string())
      }), import_zod.z.object({
        "kind": import_zod.z.literal("weixin-video"),
        "voiceover": import_zod.z.string(),
        "shots": import_zod.z.array(import_zod.z.string())
      })]).optional(),
      "claimIds": import_zod.z.union([import_zod.z.undefined(), import_zod.z.array(import_zod.z.string())]).optional(),
      "evidenceHash": import_zod.z.union([import_zod.z.undefined(), import_zod.z.string()]).optional()
    })]),
    "weixin-video": import_zod.z.union([import_zod.z.literal(null), import_zod.z.object({
      "content": import_zod.z.string(),
      "contentHash": import_zod.z.string(),
      "revision": import_zod.z.number(),
      "updatedAt": import_zod.z.string(),
      "status": import_zod.z.union([import_zod.z.literal("editing"), import_zod.z.literal("complete")]),
      "review": import_zod.z.object({
        "status": import_zod.z.union([import_zod.z.literal("pending"), import_zod.z.literal("passed"), import_zod.z.literal("failed")]),
        "contentHash": import_zod.z.union([import_zod.z.literal(null), import_zod.z.string()]),
        "findings": import_zod.z.array(import_zod.z.union([import_zod.z.string(), import_zod.z.object({
          "code": import_zod.z.union([import_zod.z.literal("ai-label"), import_zod.z.literal("sensitive"), import_zod.z.literal("absolute"), import_zod.z.literal("citation"), import_zod.z.literal("evidence-changed"), import_zod.z.literal("legacy-shape")]),
          "location": import_zod.z.string(),
          "excerpt": import_zod.z.string(),
          "fix": import_zod.z.string()
        })])),
        "reviewedAt": import_zod.z.union([import_zod.z.literal(null), import_zod.z.string()]),
        "rulesHash": import_zod.z.union([import_zod.z.undefined(), import_zod.z.string()]).optional()
      }),
      "body": import_zod.z.union([import_zod.z.undefined(), import_zod.z.object({
        "kind": import_zod.z.literal("x-single"),
        "post": import_zod.z.string()
      }), import_zod.z.object({
        "kind": import_zod.z.literal("x-thread"),
        "posts": import_zod.z.array(import_zod.z.string())
      }), import_zod.z.object({
        "kind": import_zod.z.literal("xiaohongshu"),
        "title": import_zod.z.string(),
        "body": import_zod.z.string(),
        "cards": import_zod.z.array(import_zod.z.string())
      }), import_zod.z.object({
        "kind": import_zod.z.literal("douyin"),
        "voiceover": import_zod.z.string(),
        "shots": import_zod.z.array(import_zod.z.string())
      }), import_zod.z.object({
        "kind": import_zod.z.literal("weixin-video"),
        "voiceover": import_zod.z.string(),
        "shots": import_zod.z.array(import_zod.z.string())
      })]).optional(),
      "claimIds": import_zod.z.union([import_zod.z.undefined(), import_zod.z.array(import_zod.z.string())]).optional(),
      "evidenceHash": import_zod.z.union([import_zod.z.undefined(), import_zod.z.string()]).optional()
    })])
  }),
  "publishedLinks": import_zod.z.array(import_zod.z.object({
    "platform": import_zod.z.union([import_zod.z.literal("x"), import_zod.z.literal("xiaohongshu"), import_zod.z.literal("douyin"), import_zod.z.literal("weixin-video")]),
    "url": import_zod.z.string(),
    "recordedAt": import_zod.z.string()
  })),
  "exports": import_zod.z.array(import_zod.z.object({
    "id": import_zod.z.string(),
    "platform": import_zod.z.union([import_zod.z.literal("x"), import_zod.z.literal("xiaohongshu"), import_zod.z.literal("douyin"), import_zod.z.literal("weixin-video")]),
    "format": import_zod.z.union([import_zod.z.literal("markdown"), import_zod.z.literal("text"), import_zod.z.literal("citations"), import_zod.z.literal("materials"), import_zod.z.literal("all")]),
    "status": import_zod.z.union([import_zod.z.literal("complete"), import_zod.z.literal("pending")]),
    "createdAt": import_zod.z.string(),
    "contentHash": import_zod.z.union([import_zod.z.undefined(), import_zod.z.string()]).optional(),
    "reviewPassed": import_zod.z.union([import_zod.z.undefined(), import_zod.z.literal(false), import_zod.z.literal(true)]).optional(),
    "directory": import_zod.z.union([import_zod.z.undefined(), import_zod.z.string()]).optional(),
    "files": import_zod.z.union([import_zod.z.undefined(), import_zod.z.array(import_zod.z.string())]).optional()
  }))
});
var dsh_content_evidence_contentEvidence_listTopics_result$schema$value;
var dsh_content_evidence_contentEvidence_listTopics_result$schema = () => dsh_content_evidence_contentEvidence_listTopics_result$schema$value ??= import_zod.z.array(import_zod.z.object({
  "id": import_zod.z.string(),
  "idea": import_zod.z.string(),
  "createdAt": import_zod.z.string(),
  "updatedAt": import_zod.z.string(),
  "sources": import_zod.z.array(import_zod.z.object({
    "id": import_zod.z.string(),
    "url": import_zod.z.string(),
    "title": import_zod.z.string(),
    "createdAt": import_zod.z.string()
  })),
  "materials": import_zod.z.array(import_zod.z.object({
    "id": import_zod.z.string(),
    "name": import_zod.z.string(),
    "mediaType": import_zod.z.string(),
    "path": import_zod.z.string(),
    "bytes": import_zod.z.number(),
    "sha256": import_zod.z.string(),
    "sourceId": import_zod.z.union([import_zod.z.literal(null), import_zod.z.string()]),
    "createdAt": import_zod.z.string()
  })),
  "experiments": import_zod.z.array(import_zod.z.object({
    "id": import_zod.z.string(),
    "command": import_zod.z.string(),
    "output": import_zod.z.string(),
    "versions": import_zod.z.string(),
    "conditions": import_zod.z.string(),
    "createdAt": import_zod.z.string()
  })),
  "claims": import_zod.z.array(import_zod.z.object({
    "id": import_zod.z.string(),
    "text": import_zod.z.string(),
    "sourceId": import_zod.z.union([import_zod.z.literal(null), import_zod.z.string()]),
    "status": import_zod.z.union([import_zod.z.literal("\u6709\u6765\u6E90"), import_zod.z.literal("\u5F85\u6838\u5B9E")]),
    "createdAt": import_zod.z.string()
  })),
  "drafts": import_zod.z.object({
    "x": import_zod.z.union([import_zod.z.literal(null), import_zod.z.object({
      "content": import_zod.z.string(),
      "contentHash": import_zod.z.string(),
      "revision": import_zod.z.number(),
      "updatedAt": import_zod.z.string(),
      "status": import_zod.z.union([import_zod.z.literal("editing"), import_zod.z.literal("complete")]),
      "review": import_zod.z.object({
        "status": import_zod.z.union([import_zod.z.literal("pending"), import_zod.z.literal("passed"), import_zod.z.literal("failed")]),
        "contentHash": import_zod.z.union([import_zod.z.literal(null), import_zod.z.string()]),
        "findings": import_zod.z.array(import_zod.z.union([import_zod.z.string(), import_zod.z.object({
          "code": import_zod.z.union([import_zod.z.literal("ai-label"), import_zod.z.literal("sensitive"), import_zod.z.literal("absolute"), import_zod.z.literal("citation"), import_zod.z.literal("evidence-changed"), import_zod.z.literal("legacy-shape")]),
          "location": import_zod.z.string(),
          "excerpt": import_zod.z.string(),
          "fix": import_zod.z.string()
        })])),
        "reviewedAt": import_zod.z.union([import_zod.z.literal(null), import_zod.z.string()]),
        "rulesHash": import_zod.z.union([import_zod.z.undefined(), import_zod.z.string()]).optional()
      }),
      "body": import_zod.z.union([import_zod.z.undefined(), import_zod.z.object({
        "kind": import_zod.z.literal("x-single"),
        "post": import_zod.z.string()
      }), import_zod.z.object({
        "kind": import_zod.z.literal("x-thread"),
        "posts": import_zod.z.array(import_zod.z.string())
      }), import_zod.z.object({
        "kind": import_zod.z.literal("xiaohongshu"),
        "title": import_zod.z.string(),
        "body": import_zod.z.string(),
        "cards": import_zod.z.array(import_zod.z.string())
      }), import_zod.z.object({
        "kind": import_zod.z.literal("douyin"),
        "voiceover": import_zod.z.string(),
        "shots": import_zod.z.array(import_zod.z.string())
      }), import_zod.z.object({
        "kind": import_zod.z.literal("weixin-video"),
        "voiceover": import_zod.z.string(),
        "shots": import_zod.z.array(import_zod.z.string())
      })]).optional(),
      "claimIds": import_zod.z.union([import_zod.z.undefined(), import_zod.z.array(import_zod.z.string())]).optional(),
      "evidenceHash": import_zod.z.union([import_zod.z.undefined(), import_zod.z.string()]).optional()
    })]),
    "xiaohongshu": import_zod.z.union([import_zod.z.literal(null), import_zod.z.object({
      "content": import_zod.z.string(),
      "contentHash": import_zod.z.string(),
      "revision": import_zod.z.number(),
      "updatedAt": import_zod.z.string(),
      "status": import_zod.z.union([import_zod.z.literal("editing"), import_zod.z.literal("complete")]),
      "review": import_zod.z.object({
        "status": import_zod.z.union([import_zod.z.literal("pending"), import_zod.z.literal("passed"), import_zod.z.literal("failed")]),
        "contentHash": import_zod.z.union([import_zod.z.literal(null), import_zod.z.string()]),
        "findings": import_zod.z.array(import_zod.z.union([import_zod.z.string(), import_zod.z.object({
          "code": import_zod.z.union([import_zod.z.literal("ai-label"), import_zod.z.literal("sensitive"), import_zod.z.literal("absolute"), import_zod.z.literal("citation"), import_zod.z.literal("evidence-changed"), import_zod.z.literal("legacy-shape")]),
          "location": import_zod.z.string(),
          "excerpt": import_zod.z.string(),
          "fix": import_zod.z.string()
        })])),
        "reviewedAt": import_zod.z.union([import_zod.z.literal(null), import_zod.z.string()]),
        "rulesHash": import_zod.z.union([import_zod.z.undefined(), import_zod.z.string()]).optional()
      }),
      "body": import_zod.z.union([import_zod.z.undefined(), import_zod.z.object({
        "kind": import_zod.z.literal("x-single"),
        "post": import_zod.z.string()
      }), import_zod.z.object({
        "kind": import_zod.z.literal("x-thread"),
        "posts": import_zod.z.array(import_zod.z.string())
      }), import_zod.z.object({
        "kind": import_zod.z.literal("xiaohongshu"),
        "title": import_zod.z.string(),
        "body": import_zod.z.string(),
        "cards": import_zod.z.array(import_zod.z.string())
      }), import_zod.z.object({
        "kind": import_zod.z.literal("douyin"),
        "voiceover": import_zod.z.string(),
        "shots": import_zod.z.array(import_zod.z.string())
      }), import_zod.z.object({
        "kind": import_zod.z.literal("weixin-video"),
        "voiceover": import_zod.z.string(),
        "shots": import_zod.z.array(import_zod.z.string())
      })]).optional(),
      "claimIds": import_zod.z.union([import_zod.z.undefined(), import_zod.z.array(import_zod.z.string())]).optional(),
      "evidenceHash": import_zod.z.union([import_zod.z.undefined(), import_zod.z.string()]).optional()
    })]),
    "douyin": import_zod.z.union([import_zod.z.literal(null), import_zod.z.object({
      "content": import_zod.z.string(),
      "contentHash": import_zod.z.string(),
      "revision": import_zod.z.number(),
      "updatedAt": import_zod.z.string(),
      "status": import_zod.z.union([import_zod.z.literal("editing"), import_zod.z.literal("complete")]),
      "review": import_zod.z.object({
        "status": import_zod.z.union([import_zod.z.literal("pending"), import_zod.z.literal("passed"), import_zod.z.literal("failed")]),
        "contentHash": import_zod.z.union([import_zod.z.literal(null), import_zod.z.string()]),
        "findings": import_zod.z.array(import_zod.z.union([import_zod.z.string(), import_zod.z.object({
          "code": import_zod.z.union([import_zod.z.literal("ai-label"), import_zod.z.literal("sensitive"), import_zod.z.literal("absolute"), import_zod.z.literal("citation"), import_zod.z.literal("evidence-changed"), import_zod.z.literal("legacy-shape")]),
          "location": import_zod.z.string(),
          "excerpt": import_zod.z.string(),
          "fix": import_zod.z.string()
        })])),
        "reviewedAt": import_zod.z.union([import_zod.z.literal(null), import_zod.z.string()]),
        "rulesHash": import_zod.z.union([import_zod.z.undefined(), import_zod.z.string()]).optional()
      }),
      "body": import_zod.z.union([import_zod.z.undefined(), import_zod.z.object({
        "kind": import_zod.z.literal("x-single"),
        "post": import_zod.z.string()
      }), import_zod.z.object({
        "kind": import_zod.z.literal("x-thread"),
        "posts": import_zod.z.array(import_zod.z.string())
      }), import_zod.z.object({
        "kind": import_zod.z.literal("xiaohongshu"),
        "title": import_zod.z.string(),
        "body": import_zod.z.string(),
        "cards": import_zod.z.array(import_zod.z.string())
      }), import_zod.z.object({
        "kind": import_zod.z.literal("douyin"),
        "voiceover": import_zod.z.string(),
        "shots": import_zod.z.array(import_zod.z.string())
      }), import_zod.z.object({
        "kind": import_zod.z.literal("weixin-video"),
        "voiceover": import_zod.z.string(),
        "shots": import_zod.z.array(import_zod.z.string())
      })]).optional(),
      "claimIds": import_zod.z.union([import_zod.z.undefined(), import_zod.z.array(import_zod.z.string())]).optional(),
      "evidenceHash": import_zod.z.union([import_zod.z.undefined(), import_zod.z.string()]).optional()
    })]),
    "weixin-video": import_zod.z.union([import_zod.z.literal(null), import_zod.z.object({
      "content": import_zod.z.string(),
      "contentHash": import_zod.z.string(),
      "revision": import_zod.z.number(),
      "updatedAt": import_zod.z.string(),
      "status": import_zod.z.union([import_zod.z.literal("editing"), import_zod.z.literal("complete")]),
      "review": import_zod.z.object({
        "status": import_zod.z.union([import_zod.z.literal("pending"), import_zod.z.literal("passed"), import_zod.z.literal("failed")]),
        "contentHash": import_zod.z.union([import_zod.z.literal(null), import_zod.z.string()]),
        "findings": import_zod.z.array(import_zod.z.union([import_zod.z.string(), import_zod.z.object({
          "code": import_zod.z.union([import_zod.z.literal("ai-label"), import_zod.z.literal("sensitive"), import_zod.z.literal("absolute"), import_zod.z.literal("citation"), import_zod.z.literal("evidence-changed"), import_zod.z.literal("legacy-shape")]),
          "location": import_zod.z.string(),
          "excerpt": import_zod.z.string(),
          "fix": import_zod.z.string()
        })])),
        "reviewedAt": import_zod.z.union([import_zod.z.literal(null), import_zod.z.string()]),
        "rulesHash": import_zod.z.union([import_zod.z.undefined(), import_zod.z.string()]).optional()
      }),
      "body": import_zod.z.union([import_zod.z.undefined(), import_zod.z.object({
        "kind": import_zod.z.literal("x-single"),
        "post": import_zod.z.string()
      }), import_zod.z.object({
        "kind": import_zod.z.literal("x-thread"),
        "posts": import_zod.z.array(import_zod.z.string())
      }), import_zod.z.object({
        "kind": import_zod.z.literal("xiaohongshu"),
        "title": import_zod.z.string(),
        "body": import_zod.z.string(),
        "cards": import_zod.z.array(import_zod.z.string())
      }), import_zod.z.object({
        "kind": import_zod.z.literal("douyin"),
        "voiceover": import_zod.z.string(),
        "shots": import_zod.z.array(import_zod.z.string())
      }), import_zod.z.object({
        "kind": import_zod.z.literal("weixin-video"),
        "voiceover": import_zod.z.string(),
        "shots": import_zod.z.array(import_zod.z.string())
      })]).optional(),
      "claimIds": import_zod.z.union([import_zod.z.undefined(), import_zod.z.array(import_zod.z.string())]).optional(),
      "evidenceHash": import_zod.z.union([import_zod.z.undefined(), import_zod.z.string()]).optional()
    })])
  }),
  "publishedLinks": import_zod.z.array(import_zod.z.object({
    "platform": import_zod.z.union([import_zod.z.literal("x"), import_zod.z.literal("xiaohongshu"), import_zod.z.literal("douyin"), import_zod.z.literal("weixin-video")]),
    "url": import_zod.z.string(),
    "recordedAt": import_zod.z.string()
  })),
  "exports": import_zod.z.array(import_zod.z.object({
    "id": import_zod.z.string(),
    "platform": import_zod.z.union([import_zod.z.literal("x"), import_zod.z.literal("xiaohongshu"), import_zod.z.literal("douyin"), import_zod.z.literal("weixin-video")]),
    "format": import_zod.z.union([import_zod.z.literal("markdown"), import_zod.z.literal("text"), import_zod.z.literal("citations"), import_zod.z.literal("materials"), import_zod.z.literal("all")]),
    "status": import_zod.z.union([import_zod.z.literal("complete"), import_zod.z.literal("pending")]),
    "createdAt": import_zod.z.string(),
    "contentHash": import_zod.z.union([import_zod.z.undefined(), import_zod.z.string()]).optional(),
    "reviewPassed": import_zod.z.union([import_zod.z.undefined(), import_zod.z.literal(false), import_zod.z.literal(true)]).optional(),
    "directory": import_zod.z.union([import_zod.z.undefined(), import_zod.z.string()]).optional(),
    "files": import_zod.z.union([import_zod.z.undefined(), import_zod.z.array(import_zod.z.string())]).optional()
  }))
}));
var dsh_content_evidence_contentEvidence_logExperiment_parameter_0$schema$value;
var dsh_content_evidence_contentEvidence_logExperiment_parameter_0$schema = () => dsh_content_evidence_contentEvidence_logExperiment_parameter_0$schema$value ??= import_zod.z.string();
var dsh_content_evidence_contentEvidence_logExperiment_parameter_1$schema$value;
var dsh_content_evidence_contentEvidence_logExperiment_parameter_1$schema = () => dsh_content_evidence_contentEvidence_logExperiment_parameter_1$schema$value ??= import_zod.z.object({
  "command": import_zod.z.string(),
  "output": import_zod.z.string(),
  "versions": import_zod.z.string(),
  "conditions": import_zod.z.string()
});
var dsh_content_evidence_contentEvidence_logExperiment_result$schema$value;
var dsh_content_evidence_contentEvidence_logExperiment_result$schema = () => dsh_content_evidence_contentEvidence_logExperiment_result$schema$value ??= import_zod.z.object({
  "id": import_zod.z.string(),
  "command": import_zod.z.string(),
  "output": import_zod.z.string(),
  "versions": import_zod.z.string(),
  "conditions": import_zod.z.string(),
  "createdAt": import_zod.z.string()
});
var dsh_content_evidence_contentEvidence_readEvidence_parameter_0$schema$value;
var dsh_content_evidence_contentEvidence_readEvidence_parameter_0$schema = () => dsh_content_evidence_contentEvidence_readEvidence_parameter_0$schema$value ??= import_zod.z.string();
var dsh_content_evidence_contentEvidence_readEvidence_result$schema$value;
var dsh_content_evidence_contentEvidence_readEvidence_result$schema = () => dsh_content_evidence_contentEvidence_readEvidence_result$schema$value ??= import_zod.z.object({
  "evidenceHash": import_zod.z.string(),
  "id": import_zod.z.string(),
  "idea": import_zod.z.string(),
  "createdAt": import_zod.z.string(),
  "updatedAt": import_zod.z.string(),
  "sources": import_zod.z.array(import_zod.z.object({
    "id": import_zod.z.string(),
    "url": import_zod.z.string(),
    "title": import_zod.z.string(),
    "createdAt": import_zod.z.string()
  })),
  "materials": import_zod.z.array(import_zod.z.object({
    "id": import_zod.z.string(),
    "name": import_zod.z.string(),
    "mediaType": import_zod.z.string(),
    "path": import_zod.z.string(),
    "bytes": import_zod.z.number(),
    "sha256": import_zod.z.string(),
    "sourceId": import_zod.z.union([import_zod.z.literal(null), import_zod.z.string()]),
    "createdAt": import_zod.z.string()
  })),
  "experiments": import_zod.z.array(import_zod.z.object({
    "id": import_zod.z.string(),
    "command": import_zod.z.string(),
    "output": import_zod.z.string(),
    "versions": import_zod.z.string(),
    "conditions": import_zod.z.string(),
    "createdAt": import_zod.z.string()
  })),
  "claims": import_zod.z.array(import_zod.z.object({
    "id": import_zod.z.string(),
    "text": import_zod.z.string(),
    "sourceId": import_zod.z.union([import_zod.z.literal(null), import_zod.z.string()]),
    "status": import_zod.z.union([import_zod.z.literal("\u6709\u6765\u6E90"), import_zod.z.literal("\u5F85\u6838\u5B9E")]),
    "createdAt": import_zod.z.string()
  })),
  "drafts": import_zod.z.object({
    "x": import_zod.z.union([import_zod.z.literal(null), import_zod.z.object({
      "content": import_zod.z.string(),
      "contentHash": import_zod.z.string(),
      "revision": import_zod.z.number(),
      "updatedAt": import_zod.z.string(),
      "status": import_zod.z.union([import_zod.z.literal("editing"), import_zod.z.literal("complete")]),
      "review": import_zod.z.object({
        "status": import_zod.z.union([import_zod.z.literal("pending"), import_zod.z.literal("passed"), import_zod.z.literal("failed")]),
        "contentHash": import_zod.z.union([import_zod.z.literal(null), import_zod.z.string()]),
        "findings": import_zod.z.array(import_zod.z.union([import_zod.z.string(), import_zod.z.object({
          "code": import_zod.z.union([import_zod.z.literal("ai-label"), import_zod.z.literal("sensitive"), import_zod.z.literal("absolute"), import_zod.z.literal("citation"), import_zod.z.literal("evidence-changed"), import_zod.z.literal("legacy-shape")]),
          "location": import_zod.z.string(),
          "excerpt": import_zod.z.string(),
          "fix": import_zod.z.string()
        })])),
        "reviewedAt": import_zod.z.union([import_zod.z.literal(null), import_zod.z.string()]),
        "rulesHash": import_zod.z.union([import_zod.z.undefined(), import_zod.z.string()]).optional()
      }),
      "body": import_zod.z.union([import_zod.z.undefined(), import_zod.z.object({
        "kind": import_zod.z.literal("x-single"),
        "post": import_zod.z.string()
      }), import_zod.z.object({
        "kind": import_zod.z.literal("x-thread"),
        "posts": import_zod.z.array(import_zod.z.string())
      }), import_zod.z.object({
        "kind": import_zod.z.literal("xiaohongshu"),
        "title": import_zod.z.string(),
        "body": import_zod.z.string(),
        "cards": import_zod.z.array(import_zod.z.string())
      }), import_zod.z.object({
        "kind": import_zod.z.literal("douyin"),
        "voiceover": import_zod.z.string(),
        "shots": import_zod.z.array(import_zod.z.string())
      }), import_zod.z.object({
        "kind": import_zod.z.literal("weixin-video"),
        "voiceover": import_zod.z.string(),
        "shots": import_zod.z.array(import_zod.z.string())
      })]).optional(),
      "claimIds": import_zod.z.union([import_zod.z.undefined(), import_zod.z.array(import_zod.z.string())]).optional(),
      "evidenceHash": import_zod.z.union([import_zod.z.undefined(), import_zod.z.string()]).optional()
    })]),
    "xiaohongshu": import_zod.z.union([import_zod.z.literal(null), import_zod.z.object({
      "content": import_zod.z.string(),
      "contentHash": import_zod.z.string(),
      "revision": import_zod.z.number(),
      "updatedAt": import_zod.z.string(),
      "status": import_zod.z.union([import_zod.z.literal("editing"), import_zod.z.literal("complete")]),
      "review": import_zod.z.object({
        "status": import_zod.z.union([import_zod.z.literal("pending"), import_zod.z.literal("passed"), import_zod.z.literal("failed")]),
        "contentHash": import_zod.z.union([import_zod.z.literal(null), import_zod.z.string()]),
        "findings": import_zod.z.array(import_zod.z.union([import_zod.z.string(), import_zod.z.object({
          "code": import_zod.z.union([import_zod.z.literal("ai-label"), import_zod.z.literal("sensitive"), import_zod.z.literal("absolute"), import_zod.z.literal("citation"), import_zod.z.literal("evidence-changed"), import_zod.z.literal("legacy-shape")]),
          "location": import_zod.z.string(),
          "excerpt": import_zod.z.string(),
          "fix": import_zod.z.string()
        })])),
        "reviewedAt": import_zod.z.union([import_zod.z.literal(null), import_zod.z.string()]),
        "rulesHash": import_zod.z.union([import_zod.z.undefined(), import_zod.z.string()]).optional()
      }),
      "body": import_zod.z.union([import_zod.z.undefined(), import_zod.z.object({
        "kind": import_zod.z.literal("x-single"),
        "post": import_zod.z.string()
      }), import_zod.z.object({
        "kind": import_zod.z.literal("x-thread"),
        "posts": import_zod.z.array(import_zod.z.string())
      }), import_zod.z.object({
        "kind": import_zod.z.literal("xiaohongshu"),
        "title": import_zod.z.string(),
        "body": import_zod.z.string(),
        "cards": import_zod.z.array(import_zod.z.string())
      }), import_zod.z.object({
        "kind": import_zod.z.literal("douyin"),
        "voiceover": import_zod.z.string(),
        "shots": import_zod.z.array(import_zod.z.string())
      }), import_zod.z.object({
        "kind": import_zod.z.literal("weixin-video"),
        "voiceover": import_zod.z.string(),
        "shots": import_zod.z.array(import_zod.z.string())
      })]).optional(),
      "claimIds": import_zod.z.union([import_zod.z.undefined(), import_zod.z.array(import_zod.z.string())]).optional(),
      "evidenceHash": import_zod.z.union([import_zod.z.undefined(), import_zod.z.string()]).optional()
    })]),
    "douyin": import_zod.z.union([import_zod.z.literal(null), import_zod.z.object({
      "content": import_zod.z.string(),
      "contentHash": import_zod.z.string(),
      "revision": import_zod.z.number(),
      "updatedAt": import_zod.z.string(),
      "status": import_zod.z.union([import_zod.z.literal("editing"), import_zod.z.literal("complete")]),
      "review": import_zod.z.object({
        "status": import_zod.z.union([import_zod.z.literal("pending"), import_zod.z.literal("passed"), import_zod.z.literal("failed")]),
        "contentHash": import_zod.z.union([import_zod.z.literal(null), import_zod.z.string()]),
        "findings": import_zod.z.array(import_zod.z.union([import_zod.z.string(), import_zod.z.object({
          "code": import_zod.z.union([import_zod.z.literal("ai-label"), import_zod.z.literal("sensitive"), import_zod.z.literal("absolute"), import_zod.z.literal("citation"), import_zod.z.literal("evidence-changed"), import_zod.z.literal("legacy-shape")]),
          "location": import_zod.z.string(),
          "excerpt": import_zod.z.string(),
          "fix": import_zod.z.string()
        })])),
        "reviewedAt": import_zod.z.union([import_zod.z.literal(null), import_zod.z.string()]),
        "rulesHash": import_zod.z.union([import_zod.z.undefined(), import_zod.z.string()]).optional()
      }),
      "body": import_zod.z.union([import_zod.z.undefined(), import_zod.z.object({
        "kind": import_zod.z.literal("x-single"),
        "post": import_zod.z.string()
      }), import_zod.z.object({
        "kind": import_zod.z.literal("x-thread"),
        "posts": import_zod.z.array(import_zod.z.string())
      }), import_zod.z.object({
        "kind": import_zod.z.literal("xiaohongshu"),
        "title": import_zod.z.string(),
        "body": import_zod.z.string(),
        "cards": import_zod.z.array(import_zod.z.string())
      }), import_zod.z.object({
        "kind": import_zod.z.literal("douyin"),
        "voiceover": import_zod.z.string(),
        "shots": import_zod.z.array(import_zod.z.string())
      }), import_zod.z.object({
        "kind": import_zod.z.literal("weixin-video"),
        "voiceover": import_zod.z.string(),
        "shots": import_zod.z.array(import_zod.z.string())
      })]).optional(),
      "claimIds": import_zod.z.union([import_zod.z.undefined(), import_zod.z.array(import_zod.z.string())]).optional(),
      "evidenceHash": import_zod.z.union([import_zod.z.undefined(), import_zod.z.string()]).optional()
    })]),
    "weixin-video": import_zod.z.union([import_zod.z.literal(null), import_zod.z.object({
      "content": import_zod.z.string(),
      "contentHash": import_zod.z.string(),
      "revision": import_zod.z.number(),
      "updatedAt": import_zod.z.string(),
      "status": import_zod.z.union([import_zod.z.literal("editing"), import_zod.z.literal("complete")]),
      "review": import_zod.z.object({
        "status": import_zod.z.union([import_zod.z.literal("pending"), import_zod.z.literal("passed"), import_zod.z.literal("failed")]),
        "contentHash": import_zod.z.union([import_zod.z.literal(null), import_zod.z.string()]),
        "findings": import_zod.z.array(import_zod.z.union([import_zod.z.string(), import_zod.z.object({
          "code": import_zod.z.union([import_zod.z.literal("ai-label"), import_zod.z.literal("sensitive"), import_zod.z.literal("absolute"), import_zod.z.literal("citation"), import_zod.z.literal("evidence-changed"), import_zod.z.literal("legacy-shape")]),
          "location": import_zod.z.string(),
          "excerpt": import_zod.z.string(),
          "fix": import_zod.z.string()
        })])),
        "reviewedAt": import_zod.z.union([import_zod.z.literal(null), import_zod.z.string()]),
        "rulesHash": import_zod.z.union([import_zod.z.undefined(), import_zod.z.string()]).optional()
      }),
      "body": import_zod.z.union([import_zod.z.undefined(), import_zod.z.object({
        "kind": import_zod.z.literal("x-single"),
        "post": import_zod.z.string()
      }), import_zod.z.object({
        "kind": import_zod.z.literal("x-thread"),
        "posts": import_zod.z.array(import_zod.z.string())
      }), import_zod.z.object({
        "kind": import_zod.z.literal("xiaohongshu"),
        "title": import_zod.z.string(),
        "body": import_zod.z.string(),
        "cards": import_zod.z.array(import_zod.z.string())
      }), import_zod.z.object({
        "kind": import_zod.z.literal("douyin"),
        "voiceover": import_zod.z.string(),
        "shots": import_zod.z.array(import_zod.z.string())
      }), import_zod.z.object({
        "kind": import_zod.z.literal("weixin-video"),
        "voiceover": import_zod.z.string(),
        "shots": import_zod.z.array(import_zod.z.string())
      })]).optional(),
      "claimIds": import_zod.z.union([import_zod.z.undefined(), import_zod.z.array(import_zod.z.string())]).optional(),
      "evidenceHash": import_zod.z.union([import_zod.z.undefined(), import_zod.z.string()]).optional()
    })])
  }),
  "publishedLinks": import_zod.z.array(import_zod.z.object({
    "platform": import_zod.z.union([import_zod.z.literal("x"), import_zod.z.literal("xiaohongshu"), import_zod.z.literal("douyin"), import_zod.z.literal("weixin-video")]),
    "url": import_zod.z.string(),
    "recordedAt": import_zod.z.string()
  })),
  "exports": import_zod.z.array(import_zod.z.object({
    "id": import_zod.z.string(),
    "platform": import_zod.z.union([import_zod.z.literal("x"), import_zod.z.literal("xiaohongshu"), import_zod.z.literal("douyin"), import_zod.z.literal("weixin-video")]),
    "format": import_zod.z.union([import_zod.z.literal("markdown"), import_zod.z.literal("text"), import_zod.z.literal("citations"), import_zod.z.literal("materials"), import_zod.z.literal("all")]),
    "status": import_zod.z.union([import_zod.z.literal("complete"), import_zod.z.literal("pending")]),
    "createdAt": import_zod.z.string(),
    "contentHash": import_zod.z.union([import_zod.z.undefined(), import_zod.z.string()]).optional(),
    "reviewPassed": import_zod.z.union([import_zod.z.undefined(), import_zod.z.literal(false), import_zod.z.literal(true)]).optional(),
    "directory": import_zod.z.union([import_zod.z.undefined(), import_zod.z.string()]).optional(),
    "files": import_zod.z.union([import_zod.z.undefined(), import_zod.z.array(import_zod.z.string())]).optional()
  }))
});
var dsh_content_evidence_contentEvidence_readMaterial_parameter_0$schema$value;
var dsh_content_evidence_contentEvidence_readMaterial_parameter_0$schema = () => dsh_content_evidence_contentEvidence_readMaterial_parameter_0$schema$value ??= import_zod.z.string();
var dsh_content_evidence_contentEvidence_readMaterial_parameter_1$schema$value;
var dsh_content_evidence_contentEvidence_readMaterial_parameter_1$schema = () => dsh_content_evidence_contentEvidence_readMaterial_parameter_1$schema$value ??= import_zod.z.string();
var dsh_content_evidence_contentEvidence_readMaterial_result$schema$value;
var dsh_content_evidence_contentEvidence_readMaterial_result$schema = () => dsh_content_evidence_contentEvidence_readMaterial_result$schema$value ??= import_zod.z.object({
  "name": import_zod.z.string(),
  "mediaType": import_zod.z.string(),
  "base64": import_zod.z.string(),
  "sourceId": import_zod.z.union([import_zod.z.literal(null), import_zod.z.string()])
});
var dsh_content_evidence_contentEvidence_requestExport_parameter_0$schema$value;
var dsh_content_evidence_contentEvidence_requestExport_parameter_0$schema = () => dsh_content_evidence_contentEvidence_requestExport_parameter_0$schema$value ??= import_zod.z.string();
var dsh_content_evidence_contentEvidence_requestExport_parameter_1$schema$value;
var dsh_content_evidence_contentEvidence_requestExport_parameter_1$schema = () => dsh_content_evidence_contentEvidence_requestExport_parameter_1$schema$value ??= import_zod.z.union([import_zod.z.literal("x"), import_zod.z.literal("xiaohongshu"), import_zod.z.literal("douyin"), import_zod.z.literal("weixin-video")]);
var dsh_content_evidence_contentEvidence_requestExport_parameter_2$schema$value;
var dsh_content_evidence_contentEvidence_requestExport_parameter_2$schema = () => dsh_content_evidence_contentEvidence_requestExport_parameter_2$schema$value ??= import_zod.z.union([import_zod.z.literal("markdown"), import_zod.z.literal("text"), import_zod.z.literal("citations"), import_zod.z.literal("materials"), import_zod.z.literal("all")]);
var dsh_content_evidence_contentEvidence_requestExport_parameter_3$schema$value;
var dsh_content_evidence_contentEvidence_requestExport_parameter_3$schema = () => dsh_content_evidence_contentEvidence_requestExport_parameter_3$schema$value ??= import_zod.z.string();
var dsh_content_evidence_contentEvidence_requestExport_result$schema$value;
var dsh_content_evidence_contentEvidence_requestExport_result$schema = () => dsh_content_evidence_contentEvidence_requestExport_result$schema$value ??= import_zod.z.object({
  "id": import_zod.z.string(),
  "platform": import_zod.z.union([import_zod.z.literal("x"), import_zod.z.literal("xiaohongshu"), import_zod.z.literal("douyin"), import_zod.z.literal("weixin-video")]),
  "format": import_zod.z.union([import_zod.z.literal("markdown"), import_zod.z.literal("text"), import_zod.z.literal("citations"), import_zod.z.literal("materials"), import_zod.z.literal("all")]),
  "status": import_zod.z.union([import_zod.z.literal("complete"), import_zod.z.literal("pending")]),
  "createdAt": import_zod.z.string(),
  "contentHash": import_zod.z.union([import_zod.z.undefined(), import_zod.z.string()]).optional(),
  "reviewPassed": import_zod.z.union([import_zod.z.undefined(), import_zod.z.literal(false), import_zod.z.literal(true)]).optional(),
  "directory": import_zod.z.union([import_zod.z.undefined(), import_zod.z.string()]).optional(),
  "files": import_zod.z.union([import_zod.z.undefined(), import_zod.z.array(import_zod.z.string())]).optional()
});
var dsh_content_evidence_contentEvidence_reviewDraft_parameter_0$schema$value;
var dsh_content_evidence_contentEvidence_reviewDraft_parameter_0$schema = () => dsh_content_evidence_contentEvidence_reviewDraft_parameter_0$schema$value ??= import_zod.z.string();
var dsh_content_evidence_contentEvidence_reviewDraft_parameter_1$schema$value;
var dsh_content_evidence_contentEvidence_reviewDraft_parameter_1$schema = () => dsh_content_evidence_contentEvidence_reviewDraft_parameter_1$schema$value ??= import_zod.z.union([import_zod.z.literal("x"), import_zod.z.literal("xiaohongshu"), import_zod.z.literal("douyin"), import_zod.z.literal("weixin-video")]);
var dsh_content_evidence_contentEvidence_reviewDraft_parameter_2$schema$value;
var dsh_content_evidence_contentEvidence_reviewDraft_parameter_2$schema = () => dsh_content_evidence_contentEvidence_reviewDraft_parameter_2$schema$value ??= import_zod.z.number();
var dsh_content_evidence_contentEvidence_reviewDraft_result$schema$value;
var dsh_content_evidence_contentEvidence_reviewDraft_result$schema = () => dsh_content_evidence_contentEvidence_reviewDraft_result$schema$value ??= import_zod.z.object({
  "content": import_zod.z.string(),
  "contentHash": import_zod.z.string(),
  "revision": import_zod.z.number(),
  "updatedAt": import_zod.z.string(),
  "status": import_zod.z.union([import_zod.z.literal("editing"), import_zod.z.literal("complete")]),
  "review": import_zod.z.object({
    "status": import_zod.z.union([import_zod.z.literal("pending"), import_zod.z.literal("passed"), import_zod.z.literal("failed")]),
    "contentHash": import_zod.z.union([import_zod.z.literal(null), import_zod.z.string()]),
    "findings": import_zod.z.array(import_zod.z.union([import_zod.z.string(), import_zod.z.object({
      "code": import_zod.z.union([import_zod.z.literal("ai-label"), import_zod.z.literal("sensitive"), import_zod.z.literal("absolute"), import_zod.z.literal("citation"), import_zod.z.literal("evidence-changed"), import_zod.z.literal("legacy-shape")]),
      "location": import_zod.z.string(),
      "excerpt": import_zod.z.string(),
      "fix": import_zod.z.string()
    })])),
    "reviewedAt": import_zod.z.union([import_zod.z.literal(null), import_zod.z.string()]),
    "rulesHash": import_zod.z.union([import_zod.z.undefined(), import_zod.z.string()]).optional()
  }),
  "body": import_zod.z.union([import_zod.z.undefined(), import_zod.z.object({
    "kind": import_zod.z.literal("x-single"),
    "post": import_zod.z.string()
  }), import_zod.z.object({
    "kind": import_zod.z.literal("x-thread"),
    "posts": import_zod.z.array(import_zod.z.string())
  }), import_zod.z.object({
    "kind": import_zod.z.literal("xiaohongshu"),
    "title": import_zod.z.string(),
    "body": import_zod.z.string(),
    "cards": import_zod.z.array(import_zod.z.string())
  }), import_zod.z.object({
    "kind": import_zod.z.literal("douyin"),
    "voiceover": import_zod.z.string(),
    "shots": import_zod.z.array(import_zod.z.string())
  }), import_zod.z.object({
    "kind": import_zod.z.literal("weixin-video"),
    "voiceover": import_zod.z.string(),
    "shots": import_zod.z.array(import_zod.z.string())
  })]).optional(),
  "claimIds": import_zod.z.union([import_zod.z.undefined(), import_zod.z.array(import_zod.z.string())]).optional(),
  "evidenceHash": import_zod.z.union([import_zod.z.undefined(), import_zod.z.string()]).optional()
});
var dsh_content_evidence_contentEvidence_saveClaim_parameter_0$schema$value;
var dsh_content_evidence_contentEvidence_saveClaim_parameter_0$schema = () => dsh_content_evidence_contentEvidence_saveClaim_parameter_0$schema$value ??= import_zod.z.string();
var dsh_content_evidence_contentEvidence_saveClaim_parameter_1$schema$value;
var dsh_content_evidence_contentEvidence_saveClaim_parameter_1$schema = () => dsh_content_evidence_contentEvidence_saveClaim_parameter_1$schema$value ??= import_zod.z.string();
var dsh_content_evidence_contentEvidence_saveClaim_parameter_2$schema$value;
var dsh_content_evidence_contentEvidence_saveClaim_parameter_2$schema = () => dsh_content_evidence_contentEvidence_saveClaim_parameter_2$schema$value ??= import_zod.z.union([import_zod.z.literal(null), import_zod.z.string()]);
var dsh_content_evidence_contentEvidence_saveClaim_result$schema$value;
var dsh_content_evidence_contentEvidence_saveClaim_result$schema = () => dsh_content_evidence_contentEvidence_saveClaim_result$schema$value ??= import_zod.z.object({
  "id": import_zod.z.string(),
  "text": import_zod.z.string(),
  "sourceId": import_zod.z.union([import_zod.z.literal(null), import_zod.z.string()]),
  "status": import_zod.z.union([import_zod.z.literal("\u6709\u6765\u6E90"), import_zod.z.literal("\u5F85\u6838\u5B9E")]),
  "createdAt": import_zod.z.string()
});
var dsh_content_evidence_contentEvidence_saveDraft_parameter_0$schema$value;
var dsh_content_evidence_contentEvidence_saveDraft_parameter_0$schema = () => dsh_content_evidence_contentEvidence_saveDraft_parameter_0$schema$value ??= import_zod.z.string();
var dsh_content_evidence_contentEvidence_saveDraft_parameter_1$schema$value;
var dsh_content_evidence_contentEvidence_saveDraft_parameter_1$schema = () => dsh_content_evidence_contentEvidence_saveDraft_parameter_1$schema$value ??= import_zod.z.union([import_zod.z.literal("x"), import_zod.z.literal("xiaohongshu"), import_zod.z.literal("douyin"), import_zod.z.literal("weixin-video")]);
var dsh_content_evidence_contentEvidence_saveDraft_parameter_2$schema$value;
var dsh_content_evidence_contentEvidence_saveDraft_parameter_2$schema = () => dsh_content_evidence_contentEvidence_saveDraft_parameter_2$schema$value ??= import_zod.z.object({
  "body": import_zod.z.union([import_zod.z.object({
    "kind": import_zod.z.literal("x-single"),
    "post": import_zod.z.string()
  }), import_zod.z.object({
    "kind": import_zod.z.literal("x-thread"),
    "posts": import_zod.z.array(import_zod.z.string())
  }), import_zod.z.object({
    "kind": import_zod.z.literal("xiaohongshu"),
    "title": import_zod.z.string(),
    "body": import_zod.z.string(),
    "cards": import_zod.z.array(import_zod.z.string())
  }), import_zod.z.object({
    "kind": import_zod.z.literal("douyin"),
    "voiceover": import_zod.z.string(),
    "shots": import_zod.z.array(import_zod.z.string())
  }), import_zod.z.object({
    "kind": import_zod.z.literal("weixin-video"),
    "voiceover": import_zod.z.string(),
    "shots": import_zod.z.array(import_zod.z.string())
  })]),
  "claimIds": import_zod.z.array(import_zod.z.string()),
  "expectedRevision": import_zod.z.number(),
  "evidenceHash": import_zod.z.string()
});
var dsh_content_evidence_contentEvidence_saveDraft_result$schema$value;
var dsh_content_evidence_contentEvidence_saveDraft_result$schema = () => dsh_content_evidence_contentEvidence_saveDraft_result$schema$value ??= import_zod.z.object({
  "content": import_zod.z.string(),
  "contentHash": import_zod.z.string(),
  "revision": import_zod.z.number(),
  "updatedAt": import_zod.z.string(),
  "status": import_zod.z.union([import_zod.z.literal("editing"), import_zod.z.literal("complete")]),
  "review": import_zod.z.object({
    "status": import_zod.z.union([import_zod.z.literal("pending"), import_zod.z.literal("passed"), import_zod.z.literal("failed")]),
    "contentHash": import_zod.z.union([import_zod.z.literal(null), import_zod.z.string()]),
    "findings": import_zod.z.array(import_zod.z.union([import_zod.z.string(), import_zod.z.object({
      "code": import_zod.z.union([import_zod.z.literal("ai-label"), import_zod.z.literal("sensitive"), import_zod.z.literal("absolute"), import_zod.z.literal("citation"), import_zod.z.literal("evidence-changed"), import_zod.z.literal("legacy-shape")]),
      "location": import_zod.z.string(),
      "excerpt": import_zod.z.string(),
      "fix": import_zod.z.string()
    })])),
    "reviewedAt": import_zod.z.union([import_zod.z.literal(null), import_zod.z.string()]),
    "rulesHash": import_zod.z.union([import_zod.z.undefined(), import_zod.z.string()]).optional()
  }),
  "body": import_zod.z.union([import_zod.z.undefined(), import_zod.z.object({
    "kind": import_zod.z.literal("x-single"),
    "post": import_zod.z.string()
  }), import_zod.z.object({
    "kind": import_zod.z.literal("x-thread"),
    "posts": import_zod.z.array(import_zod.z.string())
  }), import_zod.z.object({
    "kind": import_zod.z.literal("xiaohongshu"),
    "title": import_zod.z.string(),
    "body": import_zod.z.string(),
    "cards": import_zod.z.array(import_zod.z.string())
  }), import_zod.z.object({
    "kind": import_zod.z.literal("douyin"),
    "voiceover": import_zod.z.string(),
    "shots": import_zod.z.array(import_zod.z.string())
  }), import_zod.z.object({
    "kind": import_zod.z.literal("weixin-video"),
    "voiceover": import_zod.z.string(),
    "shots": import_zod.z.array(import_zod.z.string())
  })]).optional(),
  "claimIds": import_zod.z.union([import_zod.z.undefined(), import_zod.z.array(import_zod.z.string())]).optional(),
  "evidenceHash": import_zod.z.union([import_zod.z.undefined(), import_zod.z.string()]).optional()
});
var dsh_content_evidence_contentEvidence_addSource_parameter_0_strict$schema$value;
var dsh_content_evidence_contentEvidence_addSource_parameter_0_strict$schema = () => dsh_content_evidence_contentEvidence_addSource_parameter_0_strict$schema$value ??= import_zod.z.string();
var dsh_content_evidence_contentEvidence_addSource_parameter_1_strict$schema$value;
var dsh_content_evidence_contentEvidence_addSource_parameter_1_strict$schema = () => dsh_content_evidence_contentEvidence_addSource_parameter_1_strict$schema$value ??= import_zod.z.string();
var dsh_content_evidence_contentEvidence_addSource_parameter_2_strict$schema$value;
var dsh_content_evidence_contentEvidence_addSource_parameter_2_strict$schema = () => dsh_content_evidence_contentEvidence_addSource_parameter_2_strict$schema$value ??= import_zod.z.string();
var dsh_content_evidence_contentEvidence_backfillPublishedLink_parameter_0_strict$schema$value;
var dsh_content_evidence_contentEvidence_backfillPublishedLink_parameter_0_strict$schema = () => dsh_content_evidence_contentEvidence_backfillPublishedLink_parameter_0_strict$schema$value ??= import_zod.z.string();
var dsh_content_evidence_contentEvidence_backfillPublishedLink_parameter_1_strict$schema$value;
var dsh_content_evidence_contentEvidence_backfillPublishedLink_parameter_1_strict$schema = () => dsh_content_evidence_contentEvidence_backfillPublishedLink_parameter_1_strict$schema$value ??= import_zod.z.union([import_zod.z.literal("x"), import_zod.z.literal("xiaohongshu"), import_zod.z.literal("douyin"), import_zod.z.literal("weixin-video")]);
var dsh_content_evidence_contentEvidence_backfillPublishedLink_parameter_2_strict$schema$value;
var dsh_content_evidence_contentEvidence_backfillPublishedLink_parameter_2_strict$schema = () => dsh_content_evidence_contentEvidence_backfillPublishedLink_parameter_2_strict$schema$value ??= import_zod.z.string();
var dsh_content_evidence_contentEvidence_captureMaterial_parameter_0_strict$schema$value;
var dsh_content_evidence_contentEvidence_captureMaterial_parameter_0_strict$schema = () => dsh_content_evidence_contentEvidence_captureMaterial_parameter_0_strict$schema$value ??= import_zod.z.string();
var dsh_content_evidence_contentEvidence_captureMaterial_parameter_1_strict$schema$value;
var dsh_content_evidence_contentEvidence_captureMaterial_parameter_1_strict$schema = () => dsh_content_evidence_contentEvidence_captureMaterial_parameter_1_strict$schema$value ??= import_zod.z.strictObject({
  "name": import_zod.z.string(),
  "mediaType": import_zod.z.string(),
  "base64": import_zod.z.string(),
  "sourceId": import_zod.z.union([import_zod.z.literal(null), import_zod.z.string()])
});
var dsh_content_evidence_contentEvidence_createTopic_parameter_0_strict$schema$value;
var dsh_content_evidence_contentEvidence_createTopic_parameter_0_strict$schema = () => dsh_content_evidence_contentEvidence_createTopic_parameter_0_strict$schema$value ??= import_zod.z.string();
var dsh_content_evidence_contentEvidence_logExperiment_parameter_0_strict$schema$value;
var dsh_content_evidence_contentEvidence_logExperiment_parameter_0_strict$schema = () => dsh_content_evidence_contentEvidence_logExperiment_parameter_0_strict$schema$value ??= import_zod.z.string();
var dsh_content_evidence_contentEvidence_logExperiment_parameter_1_strict$schema$value;
var dsh_content_evidence_contentEvidence_logExperiment_parameter_1_strict$schema = () => dsh_content_evidence_contentEvidence_logExperiment_parameter_1_strict$schema$value ??= import_zod.z.strictObject({
  "command": import_zod.z.string(),
  "output": import_zod.z.string(),
  "versions": import_zod.z.string(),
  "conditions": import_zod.z.string()
});
var dsh_content_evidence_contentEvidence_readEvidence_parameter_0_strict$schema$value;
var dsh_content_evidence_contentEvidence_readEvidence_parameter_0_strict$schema = () => dsh_content_evidence_contentEvidence_readEvidence_parameter_0_strict$schema$value ??= import_zod.z.string();
var dsh_content_evidence_contentEvidence_readMaterial_parameter_0_strict$schema$value;
var dsh_content_evidence_contentEvidence_readMaterial_parameter_0_strict$schema = () => dsh_content_evidence_contentEvidence_readMaterial_parameter_0_strict$schema$value ??= import_zod.z.string();
var dsh_content_evidence_contentEvidence_readMaterial_parameter_1_strict$schema$value;
var dsh_content_evidence_contentEvidence_readMaterial_parameter_1_strict$schema = () => dsh_content_evidence_contentEvidence_readMaterial_parameter_1_strict$schema$value ??= import_zod.z.string();
var dsh_content_evidence_contentEvidence_requestExport_parameter_0_strict$schema$value;
var dsh_content_evidence_contentEvidence_requestExport_parameter_0_strict$schema = () => dsh_content_evidence_contentEvidence_requestExport_parameter_0_strict$schema$value ??= import_zod.z.string();
var dsh_content_evidence_contentEvidence_requestExport_parameter_1_strict$schema$value;
var dsh_content_evidence_contentEvidence_requestExport_parameter_1_strict$schema = () => dsh_content_evidence_contentEvidence_requestExport_parameter_1_strict$schema$value ??= import_zod.z.union([import_zod.z.literal("x"), import_zod.z.literal("xiaohongshu"), import_zod.z.literal("douyin"), import_zod.z.literal("weixin-video")]);
var dsh_content_evidence_contentEvidence_requestExport_parameter_2_strict$schema$value;
var dsh_content_evidence_contentEvidence_requestExport_parameter_2_strict$schema = () => dsh_content_evidence_contentEvidence_requestExport_parameter_2_strict$schema$value ??= import_zod.z.union([import_zod.z.literal("markdown"), import_zod.z.literal("text"), import_zod.z.literal("citations"), import_zod.z.literal("materials"), import_zod.z.literal("all")]);
var dsh_content_evidence_contentEvidence_requestExport_parameter_3_strict$schema$value;
var dsh_content_evidence_contentEvidence_requestExport_parameter_3_strict$schema = () => dsh_content_evidence_contentEvidence_requestExport_parameter_3_strict$schema$value ??= import_zod.z.string();
var dsh_content_evidence_contentEvidence_reviewDraft_parameter_0_strict$schema$value;
var dsh_content_evidence_contentEvidence_reviewDraft_parameter_0_strict$schema = () => dsh_content_evidence_contentEvidence_reviewDraft_parameter_0_strict$schema$value ??= import_zod.z.string();
var dsh_content_evidence_contentEvidence_reviewDraft_parameter_1_strict$schema$value;
var dsh_content_evidence_contentEvidence_reviewDraft_parameter_1_strict$schema = () => dsh_content_evidence_contentEvidence_reviewDraft_parameter_1_strict$schema$value ??= import_zod.z.union([import_zod.z.literal("x"), import_zod.z.literal("xiaohongshu"), import_zod.z.literal("douyin"), import_zod.z.literal("weixin-video")]);
var dsh_content_evidence_contentEvidence_reviewDraft_parameter_2_strict$schema$value;
var dsh_content_evidence_contentEvidence_reviewDraft_parameter_2_strict$schema = () => dsh_content_evidence_contentEvidence_reviewDraft_parameter_2_strict$schema$value ??= import_zod.z.number();
var dsh_content_evidence_contentEvidence_saveClaim_parameter_0_strict$schema$value;
var dsh_content_evidence_contentEvidence_saveClaim_parameter_0_strict$schema = () => dsh_content_evidence_contentEvidence_saveClaim_parameter_0_strict$schema$value ??= import_zod.z.string();
var dsh_content_evidence_contentEvidence_saveClaim_parameter_1_strict$schema$value;
var dsh_content_evidence_contentEvidence_saveClaim_parameter_1_strict$schema = () => dsh_content_evidence_contentEvidence_saveClaim_parameter_1_strict$schema$value ??= import_zod.z.string();
var dsh_content_evidence_contentEvidence_saveClaim_parameter_2_strict$schema$value;
var dsh_content_evidence_contentEvidence_saveClaim_parameter_2_strict$schema = () => dsh_content_evidence_contentEvidence_saveClaim_parameter_2_strict$schema$value ??= import_zod.z.union([import_zod.z.literal(null), import_zod.z.string()]);
var dsh_content_evidence_contentEvidence_saveDraft_parameter_0_strict$schema$value;
var dsh_content_evidence_contentEvidence_saveDraft_parameter_0_strict$schema = () => dsh_content_evidence_contentEvidence_saveDraft_parameter_0_strict$schema$value ??= import_zod.z.string();
var dsh_content_evidence_contentEvidence_saveDraft_parameter_1_strict$schema$value;
var dsh_content_evidence_contentEvidence_saveDraft_parameter_1_strict$schema = () => dsh_content_evidence_contentEvidence_saveDraft_parameter_1_strict$schema$value ??= import_zod.z.union([import_zod.z.literal("x"), import_zod.z.literal("xiaohongshu"), import_zod.z.literal("douyin"), import_zod.z.literal("weixin-video")]);
var dsh_content_evidence_contentEvidence_saveDraft_parameter_2_strict$schema$value;
var dsh_content_evidence_contentEvidence_saveDraft_parameter_2_strict$schema = () => dsh_content_evidence_contentEvidence_saveDraft_parameter_2_strict$schema$value ??= import_zod.z.strictObject({
  "body": import_zod.z.union([import_zod.z.strictObject({
    "kind": import_zod.z.literal("x-single"),
    "post": import_zod.z.string()
  }), import_zod.z.strictObject({
    "kind": import_zod.z.literal("x-thread"),
    "posts": import_zod.z.array(import_zod.z.string())
  }), import_zod.z.strictObject({
    "kind": import_zod.z.literal("xiaohongshu"),
    "title": import_zod.z.string(),
    "body": import_zod.z.string(),
    "cards": import_zod.z.array(import_zod.z.string())
  }), import_zod.z.strictObject({
    "kind": import_zod.z.literal("douyin"),
    "voiceover": import_zod.z.string(),
    "shots": import_zod.z.array(import_zod.z.string())
  }), import_zod.z.strictObject({
    "kind": import_zod.z.literal("weixin-video"),
    "voiceover": import_zod.z.string(),
    "shots": import_zod.z.array(import_zod.z.string())
  })]),
  "claimIds": import_zod.z.array(import_zod.z.string()),
  "expectedRevision": import_zod.z.number(),
  "evidenceHash": import_zod.z.string()
});
var TYPERT_REMOTE = createTypertRemoteInfo({
  package: "dsh-content-evidence",
  methods: {
    "contentEvidence/addSource": {
      service: "contentEvidence",
      invocation: { kind: "direct" },
      parameters: [
        {
          name: "topicId",
          source: "json",
          codec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence#contentEvidence/addSource:topicId",
            create: dsh_content_evidence_contentEvidence_addSource_parameter_0$schema,
            jsonSchema: { "type": "string" }
          },
          strictCodec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence#contentEvidence/addSource:topicId",
            create: dsh_content_evidence_contentEvidence_addSource_parameter_0_strict$schema,
            jsonSchema: { "type": "string" }
          }
        },
        {
          name: "sourceUrl",
          source: "json",
          codec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence#contentEvidence/addSource:sourceUrl",
            create: dsh_content_evidence_contentEvidence_addSource_parameter_1$schema,
            jsonSchema: { "type": "string" }
          },
          strictCodec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence#contentEvidence/addSource:sourceUrl",
            create: dsh_content_evidence_contentEvidence_addSource_parameter_1_strict$schema,
            jsonSchema: { "type": "string" }
          }
        },
        {
          name: "title",
          source: "json",
          codec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence#contentEvidence/addSource:title",
            create: dsh_content_evidence_contentEvidence_addSource_parameter_2$schema,
            jsonSchema: { "type": "string" }
          },
          strictCodec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence#contentEvidence/addSource:title",
            create: dsh_content_evidence_contentEvidence_addSource_parameter_2_strict$schema,
            jsonSchema: { "type": "string" }
          }
        }
      ],
      cancellation: { parameter: "signal" },
      result: {
        mode: "strict",
        typeSymbol: "dsh-content-evidence/types#Source",
        create: dsh_content_evidence_contentEvidence_addSource_result$schema,
        jsonSchema: { "type": "object", "properties": { "id": { "type": "string" }, "url": { "type": "string" }, "title": { "type": "string" }, "createdAt": { "type": "string" } }, "required": ["id", "url", "title", "createdAt"], "additionalProperties": true }
      },
      sourceLocation: { "file": "packages/dsh-content-evidence/src/service.ts", "line": 32, "column": 9 }
    },
    "contentEvidence/backfillPublishedLink": {
      service: "contentEvidence",
      invocation: { kind: "direct" },
      parameters: [
        {
          name: "topicId",
          source: "json",
          codec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence#contentEvidence/backfillPublishedLink:topicId",
            create: dsh_content_evidence_contentEvidence_backfillPublishedLink_parameter_0$schema,
            jsonSchema: { "type": "string" }
          },
          strictCodec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence#contentEvidence/backfillPublishedLink:topicId",
            create: dsh_content_evidence_contentEvidence_backfillPublishedLink_parameter_0_strict$schema,
            jsonSchema: { "type": "string" }
          }
        },
        {
          name: "target",
          source: "json",
          codec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence/types#Platform",
            create: dsh_content_evidence_contentEvidence_backfillPublishedLink_parameter_1$schema,
            jsonSchema: { "type": "string", "enum": ["x", "xiaohongshu", "douyin", "weixin-video"] }
          },
          strictCodec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence/types#Platform",
            create: dsh_content_evidence_contentEvidence_backfillPublishedLink_parameter_1_strict$schema,
            jsonSchema: { "type": "string", "enum": ["x", "xiaohongshu", "douyin", "weixin-video"] }
          }
        },
        {
          name: "publishedUrl",
          source: "json",
          codec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence#contentEvidence/backfillPublishedLink:publishedUrl",
            create: dsh_content_evidence_contentEvidence_backfillPublishedLink_parameter_2$schema,
            jsonSchema: { "type": "string" }
          },
          strictCodec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence#contentEvidence/backfillPublishedLink:publishedUrl",
            create: dsh_content_evidence_contentEvidence_backfillPublishedLink_parameter_2_strict$schema,
            jsonSchema: { "type": "string" }
          }
        }
      ],
      cancellation: { parameter: "signal" },
      result: {
        mode: "strict",
        typeSymbol: "dsh-content-evidence/types#PublishedLink",
        create: dsh_content_evidence_contentEvidence_backfillPublishedLink_result$schema,
        jsonSchema: { "type": "object", "properties": { "platform": { "type": "string", "enum": ["x", "xiaohongshu", "douyin", "weixin-video"] }, "url": { "type": "string" }, "recordedAt": { "type": "string" } }, "required": ["platform", "url", "recordedAt"], "additionalProperties": true }
      },
      sourceLocation: { "file": "packages/dsh-content-evidence/src/service.ts", "line": 60, "column": 9 }
    },
    "contentEvidence/captureMaterial": {
      service: "contentEvidence",
      invocation: { kind: "direct" },
      parameters: [
        {
          name: "topicId",
          source: "json",
          codec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence#contentEvidence/captureMaterial:topicId",
            create: dsh_content_evidence_contentEvidence_captureMaterial_parameter_0$schema,
            jsonSchema: { "type": "string" }
          },
          strictCodec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence#contentEvidence/captureMaterial:topicId",
            create: dsh_content_evidence_contentEvidence_captureMaterial_parameter_0_strict$schema,
            jsonSchema: { "type": "string" }
          }
        },
        {
          name: "input",
          source: "json",
          codec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence/types#MaterialInput",
            create: dsh_content_evidence_contentEvidence_captureMaterial_parameter_1$schema,
            jsonSchema: { "type": "object", "properties": { "name": { "type": "string" }, "mediaType": { "type": "string" }, "base64": { "type": "string" }, "sourceId": { "oneOf": [{ "type": "null", "const": null }, { "type": "string" }] } }, "required": ["name", "mediaType", "base64", "sourceId"], "additionalProperties": true }
          },
          strictCodec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence/types#MaterialInput",
            create: dsh_content_evidence_contentEvidence_captureMaterial_parameter_1_strict$schema,
            jsonSchema: { "type": "object", "properties": { "name": { "type": "string" }, "mediaType": { "type": "string" }, "base64": { "type": "string" }, "sourceId": { "oneOf": [{ "type": "null", "const": null }, { "type": "string" }] } }, "required": ["name", "mediaType", "base64", "sourceId"], "additionalProperties": false }
          }
        }
      ],
      cancellation: { parameter: "signal" },
      result: {
        mode: "strict",
        typeSymbol: "dsh-content-evidence/types#Material",
        create: dsh_content_evidence_contentEvidence_captureMaterial_result$schema,
        jsonSchema: { "type": "object", "properties": { "id": { "type": "string" }, "name": { "type": "string" }, "mediaType": { "type": "string" }, "path": { "type": "string" }, "bytes": { "type": "number" }, "sha256": { "type": "string" }, "sourceId": { "oneOf": [{ "type": "null", "const": null }, { "type": "string" }] }, "createdAt": { "type": "string" } }, "required": ["id", "name", "mediaType", "path", "bytes", "sha256", "sourceId", "createdAt"], "additionalProperties": true }
      },
      sourceLocation: { "file": "packages/dsh-content-evidence/src/service.ts", "line": 36, "column": 9 }
    },
    "contentEvidence/createTopic": {
      service: "contentEvidence",
      invocation: { kind: "direct" },
      parameters: [
        {
          name: "idea",
          source: "json",
          codec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence#contentEvidence/createTopic:idea",
            create: dsh_content_evidence_contentEvidence_createTopic_parameter_0$schema,
            jsonSchema: { "type": "string" }
          },
          strictCodec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence#contentEvidence/createTopic:idea",
            create: dsh_content_evidence_contentEvidence_createTopic_parameter_0_strict$schema,
            jsonSchema: { "type": "string" }
          }
        }
      ],
      cancellation: { parameter: "signal" },
      result: {
        mode: "strict",
        typeSymbol: "dsh-content-evidence/types#Topic",
        create: dsh_content_evidence_contentEvidence_createTopic_result$schema,
        jsonSchema: { "type": "object", "properties": { "id": { "type": "string" }, "idea": { "type": "string" }, "createdAt": { "type": "string" }, "updatedAt": { "type": "string" }, "sources": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "url": { "type": "string" }, "title": { "type": "string" }, "createdAt": { "type": "string" } }, "required": ["id", "url", "title", "createdAt"], "additionalProperties": true } }, "materials": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "name": { "type": "string" }, "mediaType": { "type": "string" }, "path": { "type": "string" }, "bytes": { "type": "number" }, "sha256": { "type": "string" }, "sourceId": { "oneOf": [{ "type": "null", "const": null }, { "type": "string" }] }, "createdAt": { "type": "string" } }, "required": ["id", "name", "mediaType", "path", "bytes", "sha256", "sourceId", "createdAt"], "additionalProperties": true } }, "experiments": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "command": { "type": "string" }, "output": { "type": "string" }, "versions": { "type": "string" }, "conditions": { "type": "string" }, "createdAt": { "type": "string" } }, "required": ["id", "command", "output", "versions", "conditions", "createdAt"], "additionalProperties": true } }, "claims": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "text": { "type": "string" }, "sourceId": { "oneOf": [{ "type": "null", "const": null }, { "type": "string" }] }, "status": { "type": "string", "enum": ["\u6709\u6765\u6E90", "\u5F85\u6838\u5B9E"] }, "createdAt": { "type": "string" } }, "required": ["id", "text", "sourceId", "status", "createdAt"], "additionalProperties": true } }, "drafts": { "type": "object", "properties": { "x": { "oneOf": [{ "type": "null", "const": null }, { "type": "object", "properties": { "content": { "type": "string" }, "contentHash": { "type": "string" }, "revision": { "type": "number" }, "updatedAt": { "type": "string" }, "status": { "type": "string", "enum": ["editing", "complete"] }, "review": { "type": "object", "properties": { "status": { "type": "string", "enum": ["pending", "passed", "failed"] }, "contentHash": { "oneOf": [{ "type": "null", "const": null }, { "type": "string" }] }, "findings": { "type": "array", "items": { "oneOf": [{ "type": "string" }, { "type": "object", "properties": { "code": { "type": "string", "enum": ["ai-label", "sensitive", "absolute", "citation", "evidence-changed", "legacy-shape"] }, "location": { "type": "string" }, "excerpt": { "type": "string" }, "fix": { "type": "string" } }, "required": ["code", "location", "excerpt", "fix"], "additionalProperties": true }] } }, "reviewedAt": { "oneOf": [{ "type": "null", "const": null }, { "type": "string" }] }, "rulesHash": { "type": "string" } }, "required": ["status", "contentHash", "findings", "reviewedAt"], "additionalProperties": true }, "body": { "oneOf": [{ "type": "object", "properties": { "kind": { "type": "string", "const": "x-single" }, "post": { "type": "string" } }, "required": ["kind", "post"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "x-thread" }, "posts": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "posts"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "xiaohongshu" }, "title": { "type": "string" }, "body": { "type": "string" }, "cards": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "title", "body", "cards"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "douyin" }, "voiceover": { "type": "string" }, "shots": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "voiceover", "shots"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "weixin-video" }, "voiceover": { "type": "string" }, "shots": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "voiceover", "shots"], "additionalProperties": true }] }, "claimIds": { "type": "array", "items": { "type": "string" } }, "evidenceHash": { "type": "string" } }, "required": ["content", "contentHash", "revision", "updatedAt", "status", "review"], "additionalProperties": true }] }, "xiaohongshu": { "oneOf": [{ "type": "null", "const": null }, { "type": "object", "properties": { "content": { "type": "string" }, "contentHash": { "type": "string" }, "revision": { "type": "number" }, "updatedAt": { "type": "string" }, "status": { "type": "string", "enum": ["editing", "complete"] }, "review": { "type": "object", "properties": { "status": { "type": "string", "enum": ["pending", "passed", "failed"] }, "contentHash": { "oneOf": [{ "type": "null", "const": null }, { "type": "string" }] }, "findings": { "type": "array", "items": { "oneOf": [{ "type": "string" }, { "type": "object", "properties": { "code": { "type": "string", "enum": ["ai-label", "sensitive", "absolute", "citation", "evidence-changed", "legacy-shape"] }, "location": { "type": "string" }, "excerpt": { "type": "string" }, "fix": { "type": "string" } }, "required": ["code", "location", "excerpt", "fix"], "additionalProperties": true }] } }, "reviewedAt": { "oneOf": [{ "type": "null", "const": null }, { "type": "string" }] }, "rulesHash": { "type": "string" } }, "required": ["status", "contentHash", "findings", "reviewedAt"], "additionalProperties": true }, "body": { "oneOf": [{ "type": "object", "properties": { "kind": { "type": "string", "const": "x-single" }, "post": { "type": "string" } }, "required": ["kind", "post"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "x-thread" }, "posts": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "posts"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "xiaohongshu" }, "title": { "type": "string" }, "body": { "type": "string" }, "cards": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "title", "body", "cards"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "douyin" }, "voiceover": { "type": "string" }, "shots": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "voiceover", "shots"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "weixin-video" }, "voiceover": { "type": "string" }, "shots": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "voiceover", "shots"], "additionalProperties": true }] }, "claimIds": { "type": "array", "items": { "type": "string" } }, "evidenceHash": { "type": "string" } }, "required": ["content", "contentHash", "revision", "updatedAt", "status", "review"], "additionalProperties": true }] }, "douyin": { "oneOf": [{ "type": "null", "const": null }, { "type": "object", "properties": { "content": { "type": "string" }, "contentHash": { "type": "string" }, "revision": { "type": "number" }, "updatedAt": { "type": "string" }, "status": { "type": "string", "enum": ["editing", "complete"] }, "review": { "type": "object", "properties": { "status": { "type": "string", "enum": ["pending", "passed", "failed"] }, "contentHash": { "oneOf": [{ "type": "null", "const": null }, { "type": "string" }] }, "findings": { "type": "array", "items": { "oneOf": [{ "type": "string" }, { "type": "object", "properties": { "code": { "type": "string", "enum": ["ai-label", "sensitive", "absolute", "citation", "evidence-changed", "legacy-shape"] }, "location": { "type": "string" }, "excerpt": { "type": "string" }, "fix": { "type": "string" } }, "required": ["code", "location", "excerpt", "fix"], "additionalProperties": true }] } }, "reviewedAt": { "oneOf": [{ "type": "null", "const": null }, { "type": "string" }] }, "rulesHash": { "type": "string" } }, "required": ["status", "contentHash", "findings", "reviewedAt"], "additionalProperties": true }, "body": { "oneOf": [{ "type": "object", "properties": { "kind": { "type": "string", "const": "x-single" }, "post": { "type": "string" } }, "required": ["kind", "post"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "x-thread" }, "posts": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "posts"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "xiaohongshu" }, "title": { "type": "string" }, "body": { "type": "string" }, "cards": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "title", "body", "cards"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "douyin" }, "voiceover": { "type": "string" }, "shots": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "voiceover", "shots"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "weixin-video" }, "voiceover": { "type": "string" }, "shots": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "voiceover", "shots"], "additionalProperties": true }] }, "claimIds": { "type": "array", "items": { "type": "string" } }, "evidenceHash": { "type": "string" } }, "required": ["content", "contentHash", "revision", "updatedAt", "status", "review"], "additionalProperties": true }] }, "weixin-video": { "oneOf": [{ "type": "null", "const": null }, { "type": "object", "properties": { "content": { "type": "string" }, "contentHash": { "type": "string" }, "revision": { "type": "number" }, "updatedAt": { "type": "string" }, "status": { "type": "string", "enum": ["editing", "complete"] }, "review": { "type": "object", "properties": { "status": { "type": "string", "enum": ["pending", "passed", "failed"] }, "contentHash": { "oneOf": [{ "type": "null", "const": null }, { "type": "string" }] }, "findings": { "type": "array", "items": { "oneOf": [{ "type": "string" }, { "type": "object", "properties": { "code": { "type": "string", "enum": ["ai-label", "sensitive", "absolute", "citation", "evidence-changed", "legacy-shape"] }, "location": { "type": "string" }, "excerpt": { "type": "string" }, "fix": { "type": "string" } }, "required": ["code", "location", "excerpt", "fix"], "additionalProperties": true }] } }, "reviewedAt": { "oneOf": [{ "type": "null", "const": null }, { "type": "string" }] }, "rulesHash": { "type": "string" } }, "required": ["status", "contentHash", "findings", "reviewedAt"], "additionalProperties": true }, "body": { "oneOf": [{ "type": "object", "properties": { "kind": { "type": "string", "const": "x-single" }, "post": { "type": "string" } }, "required": ["kind", "post"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "x-thread" }, "posts": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "posts"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "xiaohongshu" }, "title": { "type": "string" }, "body": { "type": "string" }, "cards": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "title", "body", "cards"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "douyin" }, "voiceover": { "type": "string" }, "shots": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "voiceover", "shots"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "weixin-video" }, "voiceover": { "type": "string" }, "shots": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "voiceover", "shots"], "additionalProperties": true }] }, "claimIds": { "type": "array", "items": { "type": "string" } }, "evidenceHash": { "type": "string" } }, "required": ["content", "contentHash", "revision", "updatedAt", "status", "review"], "additionalProperties": true }] } }, "required": ["x", "xiaohongshu", "douyin", "weixin-video"], "additionalProperties": true }, "publishedLinks": { "type": "array", "items": { "type": "object", "properties": { "platform": { "type": "string", "enum": ["x", "xiaohongshu", "douyin", "weixin-video"] }, "url": { "type": "string" }, "recordedAt": { "type": "string" } }, "required": ["platform", "url", "recordedAt"], "additionalProperties": true } }, "exports": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "platform": { "type": "string", "enum": ["x", "xiaohongshu", "douyin", "weixin-video"] }, "format": { "type": "string", "enum": ["markdown", "text", "citations", "materials", "all"] }, "status": { "type": "string", "enum": ["complete", "pending"] }, "createdAt": { "type": "string" }, "contentHash": { "type": "string" }, "reviewPassed": { "type": "boolean", "enum": [false, true] }, "directory": { "type": "string" }, "files": { "type": "array", "items": { "type": "string" } } }, "required": ["id", "platform", "format", "status", "createdAt"], "additionalProperties": true } } }, "required": ["id", "idea", "createdAt", "updatedAt", "sources", "materials", "experiments", "claims", "drafts", "publishedLinks", "exports"], "additionalProperties": true }
      },
      sourceLocation: { "file": "packages/dsh-content-evidence/src/service.ts", "line": 24, "column": 9 }
    },
    "contentEvidence/listTopics": {
      service: "contentEvidence",
      invocation: { kind: "direct" },
      parameters: [],
      cancellation: { parameter: "signal" },
      result: {
        mode: "strict",
        typeSymbol: "dsh-content-evidence#contentEvidence/listTopics:result",
        create: dsh_content_evidence_contentEvidence_listTopics_result$schema,
        jsonSchema: { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "idea": { "type": "string" }, "createdAt": { "type": "string" }, "updatedAt": { "type": "string" }, "sources": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "url": { "type": "string" }, "title": { "type": "string" }, "createdAt": { "type": "string" } }, "required": ["id", "url", "title", "createdAt"], "additionalProperties": true } }, "materials": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "name": { "type": "string" }, "mediaType": { "type": "string" }, "path": { "type": "string" }, "bytes": { "type": "number" }, "sha256": { "type": "string" }, "sourceId": { "oneOf": [{ "type": "null", "const": null }, { "type": "string" }] }, "createdAt": { "type": "string" } }, "required": ["id", "name", "mediaType", "path", "bytes", "sha256", "sourceId", "createdAt"], "additionalProperties": true } }, "experiments": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "command": { "type": "string" }, "output": { "type": "string" }, "versions": { "type": "string" }, "conditions": { "type": "string" }, "createdAt": { "type": "string" } }, "required": ["id", "command", "output", "versions", "conditions", "createdAt"], "additionalProperties": true } }, "claims": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "text": { "type": "string" }, "sourceId": { "oneOf": [{ "type": "null", "const": null }, { "type": "string" }] }, "status": { "type": "string", "enum": ["\u6709\u6765\u6E90", "\u5F85\u6838\u5B9E"] }, "createdAt": { "type": "string" } }, "required": ["id", "text", "sourceId", "status", "createdAt"], "additionalProperties": true } }, "drafts": { "type": "object", "properties": { "x": { "oneOf": [{ "type": "null", "const": null }, { "type": "object", "properties": { "content": { "type": "string" }, "contentHash": { "type": "string" }, "revision": { "type": "number" }, "updatedAt": { "type": "string" }, "status": { "type": "string", "enum": ["editing", "complete"] }, "review": { "type": "object", "properties": { "status": { "type": "string", "enum": ["pending", "passed", "failed"] }, "contentHash": { "oneOf": [{ "type": "null", "const": null }, { "type": "string" }] }, "findings": { "type": "array", "items": { "oneOf": [{ "type": "string" }, { "type": "object", "properties": { "code": { "type": "string", "enum": ["ai-label", "sensitive", "absolute", "citation", "evidence-changed", "legacy-shape"] }, "location": { "type": "string" }, "excerpt": { "type": "string" }, "fix": { "type": "string" } }, "required": ["code", "location", "excerpt", "fix"], "additionalProperties": true }] } }, "reviewedAt": { "oneOf": [{ "type": "null", "const": null }, { "type": "string" }] }, "rulesHash": { "type": "string" } }, "required": ["status", "contentHash", "findings", "reviewedAt"], "additionalProperties": true }, "body": { "oneOf": [{ "type": "object", "properties": { "kind": { "type": "string", "const": "x-single" }, "post": { "type": "string" } }, "required": ["kind", "post"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "x-thread" }, "posts": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "posts"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "xiaohongshu" }, "title": { "type": "string" }, "body": { "type": "string" }, "cards": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "title", "body", "cards"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "douyin" }, "voiceover": { "type": "string" }, "shots": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "voiceover", "shots"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "weixin-video" }, "voiceover": { "type": "string" }, "shots": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "voiceover", "shots"], "additionalProperties": true }] }, "claimIds": { "type": "array", "items": { "type": "string" } }, "evidenceHash": { "type": "string" } }, "required": ["content", "contentHash", "revision", "updatedAt", "status", "review"], "additionalProperties": true }] }, "xiaohongshu": { "oneOf": [{ "type": "null", "const": null }, { "type": "object", "properties": { "content": { "type": "string" }, "contentHash": { "type": "string" }, "revision": { "type": "number" }, "updatedAt": { "type": "string" }, "status": { "type": "string", "enum": ["editing", "complete"] }, "review": { "type": "object", "properties": { "status": { "type": "string", "enum": ["pending", "passed", "failed"] }, "contentHash": { "oneOf": [{ "type": "null", "const": null }, { "type": "string" }] }, "findings": { "type": "array", "items": { "oneOf": [{ "type": "string" }, { "type": "object", "properties": { "code": { "type": "string", "enum": ["ai-label", "sensitive", "absolute", "citation", "evidence-changed", "legacy-shape"] }, "location": { "type": "string" }, "excerpt": { "type": "string" }, "fix": { "type": "string" } }, "required": ["code", "location", "excerpt", "fix"], "additionalProperties": true }] } }, "reviewedAt": { "oneOf": [{ "type": "null", "const": null }, { "type": "string" }] }, "rulesHash": { "type": "string" } }, "required": ["status", "contentHash", "findings", "reviewedAt"], "additionalProperties": true }, "body": { "oneOf": [{ "type": "object", "properties": { "kind": { "type": "string", "const": "x-single" }, "post": { "type": "string" } }, "required": ["kind", "post"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "x-thread" }, "posts": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "posts"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "xiaohongshu" }, "title": { "type": "string" }, "body": { "type": "string" }, "cards": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "title", "body", "cards"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "douyin" }, "voiceover": { "type": "string" }, "shots": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "voiceover", "shots"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "weixin-video" }, "voiceover": { "type": "string" }, "shots": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "voiceover", "shots"], "additionalProperties": true }] }, "claimIds": { "type": "array", "items": { "type": "string" } }, "evidenceHash": { "type": "string" } }, "required": ["content", "contentHash", "revision", "updatedAt", "status", "review"], "additionalProperties": true }] }, "douyin": { "oneOf": [{ "type": "null", "const": null }, { "type": "object", "properties": { "content": { "type": "string" }, "contentHash": { "type": "string" }, "revision": { "type": "number" }, "updatedAt": { "type": "string" }, "status": { "type": "string", "enum": ["editing", "complete"] }, "review": { "type": "object", "properties": { "status": { "type": "string", "enum": ["pending", "passed", "failed"] }, "contentHash": { "oneOf": [{ "type": "null", "const": null }, { "type": "string" }] }, "findings": { "type": "array", "items": { "oneOf": [{ "type": "string" }, { "type": "object", "properties": { "code": { "type": "string", "enum": ["ai-label", "sensitive", "absolute", "citation", "evidence-changed", "legacy-shape"] }, "location": { "type": "string" }, "excerpt": { "type": "string" }, "fix": { "type": "string" } }, "required": ["code", "location", "excerpt", "fix"], "additionalProperties": true }] } }, "reviewedAt": { "oneOf": [{ "type": "null", "const": null }, { "type": "string" }] }, "rulesHash": { "type": "string" } }, "required": ["status", "contentHash", "findings", "reviewedAt"], "additionalProperties": true }, "body": { "oneOf": [{ "type": "object", "properties": { "kind": { "type": "string", "const": "x-single" }, "post": { "type": "string" } }, "required": ["kind", "post"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "x-thread" }, "posts": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "posts"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "xiaohongshu" }, "title": { "type": "string" }, "body": { "type": "string" }, "cards": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "title", "body", "cards"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "douyin" }, "voiceover": { "type": "string" }, "shots": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "voiceover", "shots"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "weixin-video" }, "voiceover": { "type": "string" }, "shots": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "voiceover", "shots"], "additionalProperties": true }] }, "claimIds": { "type": "array", "items": { "type": "string" } }, "evidenceHash": { "type": "string" } }, "required": ["content", "contentHash", "revision", "updatedAt", "status", "review"], "additionalProperties": true }] }, "weixin-video": { "oneOf": [{ "type": "null", "const": null }, { "type": "object", "properties": { "content": { "type": "string" }, "contentHash": { "type": "string" }, "revision": { "type": "number" }, "updatedAt": { "type": "string" }, "status": { "type": "string", "enum": ["editing", "complete"] }, "review": { "type": "object", "properties": { "status": { "type": "string", "enum": ["pending", "passed", "failed"] }, "contentHash": { "oneOf": [{ "type": "null", "const": null }, { "type": "string" }] }, "findings": { "type": "array", "items": { "oneOf": [{ "type": "string" }, { "type": "object", "properties": { "code": { "type": "string", "enum": ["ai-label", "sensitive", "absolute", "citation", "evidence-changed", "legacy-shape"] }, "location": { "type": "string" }, "excerpt": { "type": "string" }, "fix": { "type": "string" } }, "required": ["code", "location", "excerpt", "fix"], "additionalProperties": true }] } }, "reviewedAt": { "oneOf": [{ "type": "null", "const": null }, { "type": "string" }] }, "rulesHash": { "type": "string" } }, "required": ["status", "contentHash", "findings", "reviewedAt"], "additionalProperties": true }, "body": { "oneOf": [{ "type": "object", "properties": { "kind": { "type": "string", "const": "x-single" }, "post": { "type": "string" } }, "required": ["kind", "post"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "x-thread" }, "posts": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "posts"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "xiaohongshu" }, "title": { "type": "string" }, "body": { "type": "string" }, "cards": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "title", "body", "cards"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "douyin" }, "voiceover": { "type": "string" }, "shots": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "voiceover", "shots"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "weixin-video" }, "voiceover": { "type": "string" }, "shots": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "voiceover", "shots"], "additionalProperties": true }] }, "claimIds": { "type": "array", "items": { "type": "string" } }, "evidenceHash": { "type": "string" } }, "required": ["content", "contentHash", "revision", "updatedAt", "status", "review"], "additionalProperties": true }] } }, "required": ["x", "xiaohongshu", "douyin", "weixin-video"], "additionalProperties": true }, "publishedLinks": { "type": "array", "items": { "type": "object", "properties": { "platform": { "type": "string", "enum": ["x", "xiaohongshu", "douyin", "weixin-video"] }, "url": { "type": "string" }, "recordedAt": { "type": "string" } }, "required": ["platform", "url", "recordedAt"], "additionalProperties": true } }, "exports": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "platform": { "type": "string", "enum": ["x", "xiaohongshu", "douyin", "weixin-video"] }, "format": { "type": "string", "enum": ["markdown", "text", "citations", "materials", "all"] }, "status": { "type": "string", "enum": ["complete", "pending"] }, "createdAt": { "type": "string" }, "contentHash": { "type": "string" }, "reviewPassed": { "type": "boolean", "enum": [false, true] }, "directory": { "type": "string" }, "files": { "type": "array", "items": { "type": "string" } } }, "required": ["id", "platform", "format", "status", "createdAt"], "additionalProperties": true } } }, "required": ["id", "idea", "createdAt", "updatedAt", "sources", "materials", "experiments", "claims", "drafts", "publishedLinks", "exports"], "additionalProperties": true } }
      },
      sourceLocation: { "file": "packages/dsh-content-evidence/src/service.ts", "line": 20, "column": 9 }
    },
    "contentEvidence/logExperiment": {
      service: "contentEvidence",
      invocation: { kind: "direct" },
      parameters: [
        {
          name: "topicId",
          source: "json",
          codec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence#contentEvidence/logExperiment:topicId",
            create: dsh_content_evidence_contentEvidence_logExperiment_parameter_0$schema,
            jsonSchema: { "type": "string" }
          },
          strictCodec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence#contentEvidence/logExperiment:topicId",
            create: dsh_content_evidence_contentEvidence_logExperiment_parameter_0_strict$schema,
            jsonSchema: { "type": "string" }
          }
        },
        {
          name: "input",
          source: "json",
          codec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence/types#ExperimentInput",
            create: dsh_content_evidence_contentEvidence_logExperiment_parameter_1$schema,
            jsonSchema: { "type": "object", "properties": { "command": { "type": "string" }, "output": { "type": "string" }, "versions": { "type": "string" }, "conditions": { "type": "string" } }, "required": ["command", "output", "versions", "conditions"], "additionalProperties": true }
          },
          strictCodec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence/types#ExperimentInput",
            create: dsh_content_evidence_contentEvidence_logExperiment_parameter_1_strict$schema,
            jsonSchema: { "type": "object", "properties": { "command": { "type": "string" }, "output": { "type": "string" }, "versions": { "type": "string" }, "conditions": { "type": "string" } }, "required": ["command", "output", "versions", "conditions"], "additionalProperties": false }
          }
        }
      ],
      cancellation: { parameter: "signal" },
      result: {
        mode: "strict",
        typeSymbol: "dsh-content-evidence/types#Experiment",
        create: dsh_content_evidence_contentEvidence_logExperiment_result$schema,
        jsonSchema: { "type": "object", "properties": { "id": { "type": "string" }, "command": { "type": "string" }, "output": { "type": "string" }, "versions": { "type": "string" }, "conditions": { "type": "string" }, "createdAt": { "type": "string" } }, "required": ["id", "command", "output", "versions", "conditions", "createdAt"], "additionalProperties": true }
      },
      sourceLocation: { "file": "packages/dsh-content-evidence/src/service.ts", "line": 44, "column": 9 }
    },
    "contentEvidence/readEvidence": {
      service: "contentEvidence",
      invocation: { kind: "direct" },
      parameters: [
        {
          name: "topicId",
          source: "json",
          codec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence#contentEvidence/readEvidence:topicId",
            create: dsh_content_evidence_contentEvidence_readEvidence_parameter_0$schema,
            jsonSchema: { "type": "string" }
          },
          strictCodec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence#contentEvidence/readEvidence:topicId",
            create: dsh_content_evidence_contentEvidence_readEvidence_parameter_0_strict$schema,
            jsonSchema: { "type": "string" }
          }
        }
      ],
      cancellation: { parameter: "signal" },
      result: {
        mode: "strict",
        typeSymbol: "dsh-content-evidence/types#EvidenceSheet",
        create: dsh_content_evidence_contentEvidence_readEvidence_result$schema,
        jsonSchema: { "type": "object", "properties": { "evidenceHash": { "type": "string" }, "id": { "type": "string" }, "idea": { "type": "string" }, "createdAt": { "type": "string" }, "updatedAt": { "type": "string" }, "sources": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "url": { "type": "string" }, "title": { "type": "string" }, "createdAt": { "type": "string" } }, "required": ["id", "url", "title", "createdAt"], "additionalProperties": true } }, "materials": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "name": { "type": "string" }, "mediaType": { "type": "string" }, "path": { "type": "string" }, "bytes": { "type": "number" }, "sha256": { "type": "string" }, "sourceId": { "oneOf": [{ "type": "null", "const": null }, { "type": "string" }] }, "createdAt": { "type": "string" } }, "required": ["id", "name", "mediaType", "path", "bytes", "sha256", "sourceId", "createdAt"], "additionalProperties": true } }, "experiments": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "command": { "type": "string" }, "output": { "type": "string" }, "versions": { "type": "string" }, "conditions": { "type": "string" }, "createdAt": { "type": "string" } }, "required": ["id", "command", "output", "versions", "conditions", "createdAt"], "additionalProperties": true } }, "claims": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "text": { "type": "string" }, "sourceId": { "oneOf": [{ "type": "null", "const": null }, { "type": "string" }] }, "status": { "type": "string", "enum": ["\u6709\u6765\u6E90", "\u5F85\u6838\u5B9E"] }, "createdAt": { "type": "string" } }, "required": ["id", "text", "sourceId", "status", "createdAt"], "additionalProperties": true } }, "drafts": { "type": "object", "properties": { "x": { "oneOf": [{ "type": "null", "const": null }, { "type": "object", "properties": { "content": { "type": "string" }, "contentHash": { "type": "string" }, "revision": { "type": "number" }, "updatedAt": { "type": "string" }, "status": { "type": "string", "enum": ["editing", "complete"] }, "review": { "type": "object", "properties": { "status": { "type": "string", "enum": ["pending", "passed", "failed"] }, "contentHash": { "oneOf": [{ "type": "null", "const": null }, { "type": "string" }] }, "findings": { "type": "array", "items": { "oneOf": [{ "type": "string" }, { "type": "object", "properties": { "code": { "type": "string", "enum": ["ai-label", "sensitive", "absolute", "citation", "evidence-changed", "legacy-shape"] }, "location": { "type": "string" }, "excerpt": { "type": "string" }, "fix": { "type": "string" } }, "required": ["code", "location", "excerpt", "fix"], "additionalProperties": true }] } }, "reviewedAt": { "oneOf": [{ "type": "null", "const": null }, { "type": "string" }] }, "rulesHash": { "type": "string" } }, "required": ["status", "contentHash", "findings", "reviewedAt"], "additionalProperties": true }, "body": { "oneOf": [{ "type": "object", "properties": { "kind": { "type": "string", "const": "x-single" }, "post": { "type": "string" } }, "required": ["kind", "post"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "x-thread" }, "posts": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "posts"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "xiaohongshu" }, "title": { "type": "string" }, "body": { "type": "string" }, "cards": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "title", "body", "cards"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "douyin" }, "voiceover": { "type": "string" }, "shots": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "voiceover", "shots"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "weixin-video" }, "voiceover": { "type": "string" }, "shots": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "voiceover", "shots"], "additionalProperties": true }] }, "claimIds": { "type": "array", "items": { "type": "string" } }, "evidenceHash": { "type": "string" } }, "required": ["content", "contentHash", "revision", "updatedAt", "status", "review"], "additionalProperties": true }] }, "xiaohongshu": { "oneOf": [{ "type": "null", "const": null }, { "type": "object", "properties": { "content": { "type": "string" }, "contentHash": { "type": "string" }, "revision": { "type": "number" }, "updatedAt": { "type": "string" }, "status": { "type": "string", "enum": ["editing", "complete"] }, "review": { "type": "object", "properties": { "status": { "type": "string", "enum": ["pending", "passed", "failed"] }, "contentHash": { "oneOf": [{ "type": "null", "const": null }, { "type": "string" }] }, "findings": { "type": "array", "items": { "oneOf": [{ "type": "string" }, { "type": "object", "properties": { "code": { "type": "string", "enum": ["ai-label", "sensitive", "absolute", "citation", "evidence-changed", "legacy-shape"] }, "location": { "type": "string" }, "excerpt": { "type": "string" }, "fix": { "type": "string" } }, "required": ["code", "location", "excerpt", "fix"], "additionalProperties": true }] } }, "reviewedAt": { "oneOf": [{ "type": "null", "const": null }, { "type": "string" }] }, "rulesHash": { "type": "string" } }, "required": ["status", "contentHash", "findings", "reviewedAt"], "additionalProperties": true }, "body": { "oneOf": [{ "type": "object", "properties": { "kind": { "type": "string", "const": "x-single" }, "post": { "type": "string" } }, "required": ["kind", "post"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "x-thread" }, "posts": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "posts"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "xiaohongshu" }, "title": { "type": "string" }, "body": { "type": "string" }, "cards": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "title", "body", "cards"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "douyin" }, "voiceover": { "type": "string" }, "shots": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "voiceover", "shots"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "weixin-video" }, "voiceover": { "type": "string" }, "shots": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "voiceover", "shots"], "additionalProperties": true }] }, "claimIds": { "type": "array", "items": { "type": "string" } }, "evidenceHash": { "type": "string" } }, "required": ["content", "contentHash", "revision", "updatedAt", "status", "review"], "additionalProperties": true }] }, "douyin": { "oneOf": [{ "type": "null", "const": null }, { "type": "object", "properties": { "content": { "type": "string" }, "contentHash": { "type": "string" }, "revision": { "type": "number" }, "updatedAt": { "type": "string" }, "status": { "type": "string", "enum": ["editing", "complete"] }, "review": { "type": "object", "properties": { "status": { "type": "string", "enum": ["pending", "passed", "failed"] }, "contentHash": { "oneOf": [{ "type": "null", "const": null }, { "type": "string" }] }, "findings": { "type": "array", "items": { "oneOf": [{ "type": "string" }, { "type": "object", "properties": { "code": { "type": "string", "enum": ["ai-label", "sensitive", "absolute", "citation", "evidence-changed", "legacy-shape"] }, "location": { "type": "string" }, "excerpt": { "type": "string" }, "fix": { "type": "string" } }, "required": ["code", "location", "excerpt", "fix"], "additionalProperties": true }] } }, "reviewedAt": { "oneOf": [{ "type": "null", "const": null }, { "type": "string" }] }, "rulesHash": { "type": "string" } }, "required": ["status", "contentHash", "findings", "reviewedAt"], "additionalProperties": true }, "body": { "oneOf": [{ "type": "object", "properties": { "kind": { "type": "string", "const": "x-single" }, "post": { "type": "string" } }, "required": ["kind", "post"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "x-thread" }, "posts": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "posts"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "xiaohongshu" }, "title": { "type": "string" }, "body": { "type": "string" }, "cards": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "title", "body", "cards"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "douyin" }, "voiceover": { "type": "string" }, "shots": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "voiceover", "shots"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "weixin-video" }, "voiceover": { "type": "string" }, "shots": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "voiceover", "shots"], "additionalProperties": true }] }, "claimIds": { "type": "array", "items": { "type": "string" } }, "evidenceHash": { "type": "string" } }, "required": ["content", "contentHash", "revision", "updatedAt", "status", "review"], "additionalProperties": true }] }, "weixin-video": { "oneOf": [{ "type": "null", "const": null }, { "type": "object", "properties": { "content": { "type": "string" }, "contentHash": { "type": "string" }, "revision": { "type": "number" }, "updatedAt": { "type": "string" }, "status": { "type": "string", "enum": ["editing", "complete"] }, "review": { "type": "object", "properties": { "status": { "type": "string", "enum": ["pending", "passed", "failed"] }, "contentHash": { "oneOf": [{ "type": "null", "const": null }, { "type": "string" }] }, "findings": { "type": "array", "items": { "oneOf": [{ "type": "string" }, { "type": "object", "properties": { "code": { "type": "string", "enum": ["ai-label", "sensitive", "absolute", "citation", "evidence-changed", "legacy-shape"] }, "location": { "type": "string" }, "excerpt": { "type": "string" }, "fix": { "type": "string" } }, "required": ["code", "location", "excerpt", "fix"], "additionalProperties": true }] } }, "reviewedAt": { "oneOf": [{ "type": "null", "const": null }, { "type": "string" }] }, "rulesHash": { "type": "string" } }, "required": ["status", "contentHash", "findings", "reviewedAt"], "additionalProperties": true }, "body": { "oneOf": [{ "type": "object", "properties": { "kind": { "type": "string", "const": "x-single" }, "post": { "type": "string" } }, "required": ["kind", "post"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "x-thread" }, "posts": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "posts"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "xiaohongshu" }, "title": { "type": "string" }, "body": { "type": "string" }, "cards": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "title", "body", "cards"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "douyin" }, "voiceover": { "type": "string" }, "shots": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "voiceover", "shots"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "weixin-video" }, "voiceover": { "type": "string" }, "shots": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "voiceover", "shots"], "additionalProperties": true }] }, "claimIds": { "type": "array", "items": { "type": "string" } }, "evidenceHash": { "type": "string" } }, "required": ["content", "contentHash", "revision", "updatedAt", "status", "review"], "additionalProperties": true }] } }, "required": ["x", "xiaohongshu", "douyin", "weixin-video"], "additionalProperties": true }, "publishedLinks": { "type": "array", "items": { "type": "object", "properties": { "platform": { "type": "string", "enum": ["x", "xiaohongshu", "douyin", "weixin-video"] }, "url": { "type": "string" }, "recordedAt": { "type": "string" } }, "required": ["platform", "url", "recordedAt"], "additionalProperties": true } }, "exports": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "platform": { "type": "string", "enum": ["x", "xiaohongshu", "douyin", "weixin-video"] }, "format": { "type": "string", "enum": ["markdown", "text", "citations", "materials", "all"] }, "status": { "type": "string", "enum": ["complete", "pending"] }, "createdAt": { "type": "string" }, "contentHash": { "type": "string" }, "reviewPassed": { "type": "boolean", "enum": [false, true] }, "directory": { "type": "string" }, "files": { "type": "array", "items": { "type": "string" } } }, "required": ["id", "platform", "format", "status", "createdAt"], "additionalProperties": true } } }, "required": ["evidenceHash", "id", "idea", "createdAt", "updatedAt", "sources", "materials", "experiments", "claims", "drafts", "publishedLinks", "exports"], "additionalProperties": true }
      },
      sourceLocation: { "file": "packages/dsh-content-evidence/src/service.ts", "line": 28, "column": 9 }
    },
    "contentEvidence/readMaterial": {
      service: "contentEvidence",
      invocation: { kind: "direct" },
      parameters: [
        {
          name: "topicId",
          source: "json",
          codec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence#contentEvidence/readMaterial:topicId",
            create: dsh_content_evidence_contentEvidence_readMaterial_parameter_0$schema,
            jsonSchema: { "type": "string" }
          },
          strictCodec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence#contentEvidence/readMaterial:topicId",
            create: dsh_content_evidence_contentEvidence_readMaterial_parameter_0_strict$schema,
            jsonSchema: { "type": "string" }
          }
        },
        {
          name: "materialId",
          source: "json",
          codec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence#contentEvidence/readMaterial:materialId",
            create: dsh_content_evidence_contentEvidence_readMaterial_parameter_1$schema,
            jsonSchema: { "type": "string" }
          },
          strictCodec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence#contentEvidence/readMaterial:materialId",
            create: dsh_content_evidence_contentEvidence_readMaterial_parameter_1_strict$schema,
            jsonSchema: { "type": "string" }
          }
        }
      ],
      cancellation: { parameter: "signal" },
      result: {
        mode: "strict",
        typeSymbol: "dsh-content-evidence/types#MaterialInput",
        create: dsh_content_evidence_contentEvidence_readMaterial_result$schema,
        jsonSchema: { "type": "object", "properties": { "name": { "type": "string" }, "mediaType": { "type": "string" }, "base64": { "type": "string" }, "sourceId": { "oneOf": [{ "type": "null", "const": null }, { "type": "string" }] } }, "required": ["name", "mediaType", "base64", "sourceId"], "additionalProperties": true }
      },
      sourceLocation: { "file": "packages/dsh-content-evidence/src/service.ts", "line": 40, "column": 9 }
    },
    "contentEvidence/requestExport": {
      service: "contentEvidence",
      invocation: { kind: "direct" },
      parameters: [
        {
          name: "topicId",
          source: "json",
          codec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence#contentEvidence/requestExport:topicId",
            create: dsh_content_evidence_contentEvidence_requestExport_parameter_0$schema,
            jsonSchema: { "type": "string" }
          },
          strictCodec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence#contentEvidence/requestExport:topicId",
            create: dsh_content_evidence_contentEvidence_requestExport_parameter_0_strict$schema,
            jsonSchema: { "type": "string" }
          }
        },
        {
          name: "target",
          source: "json",
          codec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence/types#Platform",
            create: dsh_content_evidence_contentEvidence_requestExport_parameter_1$schema,
            jsonSchema: { "type": "string", "enum": ["x", "xiaohongshu", "douyin", "weixin-video"] }
          },
          strictCodec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence/types#Platform",
            create: dsh_content_evidence_contentEvidence_requestExport_parameter_1_strict$schema,
            jsonSchema: { "type": "string", "enum": ["x", "xiaohongshu", "douyin", "weixin-video"] }
          }
        },
        {
          name: "format",
          source: "json",
          codec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence/types#ExportFormat",
            create: dsh_content_evidence_contentEvidence_requestExport_parameter_2$schema,
            jsonSchema: { "type": "string", "enum": ["markdown", "text", "citations", "materials", "all"] }
          },
          strictCodec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence/types#ExportFormat",
            create: dsh_content_evidence_contentEvidence_requestExport_parameter_2_strict$schema,
            jsonSchema: { "type": "string", "enum": ["markdown", "text", "citations", "materials", "all"] }
          }
        },
        {
          name: "directory",
          source: "json",
          codec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence#contentEvidence/requestExport:directory",
            create: dsh_content_evidence_contentEvidence_requestExport_parameter_3$schema,
            jsonSchema: { "type": "string" }
          },
          strictCodec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence#contentEvidence/requestExport:directory",
            create: dsh_content_evidence_contentEvidence_requestExport_parameter_3_strict$schema,
            jsonSchema: { "type": "string" }
          }
        }
      ],
      cancellation: { parameter: "signal" },
      result: {
        mode: "strict",
        typeSymbol: "dsh-content-evidence/types#ExportRecord",
        create: dsh_content_evidence_contentEvidence_requestExport_result$schema,
        jsonSchema: { "type": "object", "properties": { "id": { "type": "string" }, "platform": { "type": "string", "enum": ["x", "xiaohongshu", "douyin", "weixin-video"] }, "format": { "type": "string", "enum": ["markdown", "text", "citations", "materials", "all"] }, "status": { "type": "string", "enum": ["complete", "pending"] }, "createdAt": { "type": "string" }, "contentHash": { "type": "string" }, "reviewPassed": { "type": "boolean", "enum": [false, true] }, "directory": { "type": "string" }, "files": { "type": "array", "items": { "type": "string" } } }, "required": ["id", "platform", "format", "status", "createdAt"], "additionalProperties": true }
      },
      sourceLocation: { "file": "packages/dsh-content-evidence/src/service.ts", "line": 64, "column": 9 }
    },
    "contentEvidence/reviewDraft": {
      service: "contentEvidence",
      invocation: { kind: "direct" },
      parameters: [
        {
          name: "topicId",
          source: "json",
          codec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence#contentEvidence/reviewDraft:topicId",
            create: dsh_content_evidence_contentEvidence_reviewDraft_parameter_0$schema,
            jsonSchema: { "type": "string" }
          },
          strictCodec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence#contentEvidence/reviewDraft:topicId",
            create: dsh_content_evidence_contentEvidence_reviewDraft_parameter_0_strict$schema,
            jsonSchema: { "type": "string" }
          }
        },
        {
          name: "target",
          source: "json",
          codec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence/types#Platform",
            create: dsh_content_evidence_contentEvidence_reviewDraft_parameter_1$schema,
            jsonSchema: { "type": "string", "enum": ["x", "xiaohongshu", "douyin", "weixin-video"] }
          },
          strictCodec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence/types#Platform",
            create: dsh_content_evidence_contentEvidence_reviewDraft_parameter_1_strict$schema,
            jsonSchema: { "type": "string", "enum": ["x", "xiaohongshu", "douyin", "weixin-video"] }
          }
        },
        {
          name: "expectedRevision",
          source: "json",
          codec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence#contentEvidence/reviewDraft:expectedRevision",
            create: dsh_content_evidence_contentEvidence_reviewDraft_parameter_2$schema,
            jsonSchema: { "type": "number" }
          },
          strictCodec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence#contentEvidence/reviewDraft:expectedRevision",
            create: dsh_content_evidence_contentEvidence_reviewDraft_parameter_2_strict$schema,
            jsonSchema: { "type": "number" }
          }
        }
      ],
      cancellation: { parameter: "signal" },
      result: {
        mode: "strict",
        typeSymbol: "dsh-content-evidence/types#Draft",
        create: dsh_content_evidence_contentEvidence_reviewDraft_result$schema,
        jsonSchema: { "type": "object", "properties": { "content": { "type": "string" }, "contentHash": { "type": "string" }, "revision": { "type": "number" }, "updatedAt": { "type": "string" }, "status": { "type": "string", "enum": ["editing", "complete"] }, "review": { "type": "object", "properties": { "status": { "type": "string", "enum": ["pending", "passed", "failed"] }, "contentHash": { "oneOf": [{ "type": "null", "const": null }, { "type": "string" }] }, "findings": { "type": "array", "items": { "oneOf": [{ "type": "string" }, { "type": "object", "properties": { "code": { "type": "string", "enum": ["ai-label", "sensitive", "absolute", "citation", "evidence-changed", "legacy-shape"] }, "location": { "type": "string" }, "excerpt": { "type": "string" }, "fix": { "type": "string" } }, "required": ["code", "location", "excerpt", "fix"], "additionalProperties": true }] } }, "reviewedAt": { "oneOf": [{ "type": "null", "const": null }, { "type": "string" }] }, "rulesHash": { "type": "string" } }, "required": ["status", "contentHash", "findings", "reviewedAt"], "additionalProperties": true }, "body": { "oneOf": [{ "type": "object", "properties": { "kind": { "type": "string", "const": "x-single" }, "post": { "type": "string" } }, "required": ["kind", "post"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "x-thread" }, "posts": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "posts"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "xiaohongshu" }, "title": { "type": "string" }, "body": { "type": "string" }, "cards": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "title", "body", "cards"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "douyin" }, "voiceover": { "type": "string" }, "shots": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "voiceover", "shots"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "weixin-video" }, "voiceover": { "type": "string" }, "shots": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "voiceover", "shots"], "additionalProperties": true }] }, "claimIds": { "type": "array", "items": { "type": "string" } }, "evidenceHash": { "type": "string" } }, "required": ["content", "contentHash", "revision", "updatedAt", "status", "review"], "additionalProperties": true }
      },
      sourceLocation: { "file": "packages/dsh-content-evidence/src/service.ts", "line": 56, "column": 9 }
    },
    "contentEvidence/saveClaim": {
      service: "contentEvidence",
      invocation: { kind: "direct" },
      parameters: [
        {
          name: "topicId",
          source: "json",
          codec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence#contentEvidence/saveClaim:topicId",
            create: dsh_content_evidence_contentEvidence_saveClaim_parameter_0$schema,
            jsonSchema: { "type": "string" }
          },
          strictCodec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence#contentEvidence/saveClaim:topicId",
            create: dsh_content_evidence_contentEvidence_saveClaim_parameter_0_strict$schema,
            jsonSchema: { "type": "string" }
          }
        },
        {
          name: "claimText",
          source: "json",
          codec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence#contentEvidence/saveClaim:claimText",
            create: dsh_content_evidence_contentEvidence_saveClaim_parameter_1$schema,
            jsonSchema: { "type": "string" }
          },
          strictCodec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence#contentEvidence/saveClaim:claimText",
            create: dsh_content_evidence_contentEvidence_saveClaim_parameter_1_strict$schema,
            jsonSchema: { "type": "string" }
          }
        },
        {
          name: "sourceId",
          source: "json",
          codec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence#contentEvidence/saveClaim:sourceId",
            create: dsh_content_evidence_contentEvidence_saveClaim_parameter_2$schema,
            jsonSchema: { "oneOf": [{ "type": "null", "const": null }, { "type": "string" }] }
          },
          strictCodec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence#contentEvidence/saveClaim:sourceId",
            create: dsh_content_evidence_contentEvidence_saveClaim_parameter_2_strict$schema,
            jsonSchema: { "oneOf": [{ "type": "null", "const": null }, { "type": "string" }] }
          }
        }
      ],
      cancellation: { parameter: "signal" },
      result: {
        mode: "strict",
        typeSymbol: "dsh-content-evidence/types#Claim",
        create: dsh_content_evidence_contentEvidence_saveClaim_result$schema,
        jsonSchema: { "type": "object", "properties": { "id": { "type": "string" }, "text": { "type": "string" }, "sourceId": { "oneOf": [{ "type": "null", "const": null }, { "type": "string" }] }, "status": { "type": "string", "enum": ["\u6709\u6765\u6E90", "\u5F85\u6838\u5B9E"] }, "createdAt": { "type": "string" } }, "required": ["id", "text", "sourceId", "status", "createdAt"], "additionalProperties": true }
      },
      sourceLocation: { "file": "packages/dsh-content-evidence/src/service.ts", "line": 48, "column": 9 }
    },
    "contentEvidence/saveDraft": {
      service: "contentEvidence",
      invocation: { kind: "direct" },
      parameters: [
        {
          name: "topicId",
          source: "json",
          codec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence#contentEvidence/saveDraft:topicId",
            create: dsh_content_evidence_contentEvidence_saveDraft_parameter_0$schema,
            jsonSchema: { "type": "string" }
          },
          strictCodec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence#contentEvidence/saveDraft:topicId",
            create: dsh_content_evidence_contentEvidence_saveDraft_parameter_0_strict$schema,
            jsonSchema: { "type": "string" }
          }
        },
        {
          name: "target",
          source: "json",
          codec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence/types#Platform",
            create: dsh_content_evidence_contentEvidence_saveDraft_parameter_1$schema,
            jsonSchema: { "type": "string", "enum": ["x", "xiaohongshu", "douyin", "weixin-video"] }
          },
          strictCodec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence/types#Platform",
            create: dsh_content_evidence_contentEvidence_saveDraft_parameter_1_strict$schema,
            jsonSchema: { "type": "string", "enum": ["x", "xiaohongshu", "douyin", "weixin-video"] }
          }
        },
        {
          name: "input",
          source: "json",
          codec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence/types#DraftInput",
            create: dsh_content_evidence_contentEvidence_saveDraft_parameter_2$schema,
            jsonSchema: { "type": "object", "properties": { "body": { "oneOf": [{ "type": "object", "properties": { "kind": { "type": "string", "const": "x-single" }, "post": { "type": "string" } }, "required": ["kind", "post"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "x-thread" }, "posts": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "posts"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "xiaohongshu" }, "title": { "type": "string" }, "body": { "type": "string" }, "cards": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "title", "body", "cards"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "douyin" }, "voiceover": { "type": "string" }, "shots": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "voiceover", "shots"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "weixin-video" }, "voiceover": { "type": "string" }, "shots": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "voiceover", "shots"], "additionalProperties": true }] }, "claimIds": { "type": "array", "items": { "type": "string" } }, "expectedRevision": { "type": "number" }, "evidenceHash": { "type": "string" } }, "required": ["body", "claimIds", "expectedRevision", "evidenceHash"], "additionalProperties": true }
          },
          strictCodec: {
            mode: "strict",
            typeSymbol: "dsh-content-evidence/types#DraftInput",
            create: dsh_content_evidence_contentEvidence_saveDraft_parameter_2_strict$schema,
            jsonSchema: { "type": "object", "properties": { "body": { "oneOf": [{ "type": "object", "properties": { "kind": { "type": "string", "const": "x-single" }, "post": { "type": "string" } }, "required": ["kind", "post"], "additionalProperties": false }, { "type": "object", "properties": { "kind": { "type": "string", "const": "x-thread" }, "posts": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "posts"], "additionalProperties": false }, { "type": "object", "properties": { "kind": { "type": "string", "const": "xiaohongshu" }, "title": { "type": "string" }, "body": { "type": "string" }, "cards": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "title", "body", "cards"], "additionalProperties": false }, { "type": "object", "properties": { "kind": { "type": "string", "const": "douyin" }, "voiceover": { "type": "string" }, "shots": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "voiceover", "shots"], "additionalProperties": false }, { "type": "object", "properties": { "kind": { "type": "string", "const": "weixin-video" }, "voiceover": { "type": "string" }, "shots": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "voiceover", "shots"], "additionalProperties": false }] }, "claimIds": { "type": "array", "items": { "type": "string" } }, "expectedRevision": { "type": "number" }, "evidenceHash": { "type": "string" } }, "required": ["body", "claimIds", "expectedRevision", "evidenceHash"], "additionalProperties": false }
          }
        }
      ],
      cancellation: { parameter: "signal" },
      result: {
        mode: "strict",
        typeSymbol: "dsh-content-evidence/types#Draft",
        create: dsh_content_evidence_contentEvidence_saveDraft_result$schema,
        jsonSchema: { "type": "object", "properties": { "content": { "type": "string" }, "contentHash": { "type": "string" }, "revision": { "type": "number" }, "updatedAt": { "type": "string" }, "status": { "type": "string", "enum": ["editing", "complete"] }, "review": { "type": "object", "properties": { "status": { "type": "string", "enum": ["pending", "passed", "failed"] }, "contentHash": { "oneOf": [{ "type": "null", "const": null }, { "type": "string" }] }, "findings": { "type": "array", "items": { "oneOf": [{ "type": "string" }, { "type": "object", "properties": { "code": { "type": "string", "enum": ["ai-label", "sensitive", "absolute", "citation", "evidence-changed", "legacy-shape"] }, "location": { "type": "string" }, "excerpt": { "type": "string" }, "fix": { "type": "string" } }, "required": ["code", "location", "excerpt", "fix"], "additionalProperties": true }] } }, "reviewedAt": { "oneOf": [{ "type": "null", "const": null }, { "type": "string" }] }, "rulesHash": { "type": "string" } }, "required": ["status", "contentHash", "findings", "reviewedAt"], "additionalProperties": true }, "body": { "oneOf": [{ "type": "object", "properties": { "kind": { "type": "string", "const": "x-single" }, "post": { "type": "string" } }, "required": ["kind", "post"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "x-thread" }, "posts": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "posts"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "xiaohongshu" }, "title": { "type": "string" }, "body": { "type": "string" }, "cards": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "title", "body", "cards"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "douyin" }, "voiceover": { "type": "string" }, "shots": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "voiceover", "shots"], "additionalProperties": true }, { "type": "object", "properties": { "kind": { "type": "string", "const": "weixin-video" }, "voiceover": { "type": "string" }, "shots": { "type": "array", "items": { "type": "string" } } }, "required": ["kind", "voiceover", "shots"], "additionalProperties": true }] }, "claimIds": { "type": "array", "items": { "type": "string" } }, "evidenceHash": { "type": "string" } }, "required": ["content", "contentHash", "revision", "updatedAt", "status", "review"], "additionalProperties": true }
      },
      sourceLocation: { "file": "packages/dsh-content-evidence/src/service.ts", "line": 52, "column": 9 }
    }
  }
}, import_zod.z);
var typert_remote_client_default = TYPERT_REMOTE;

// src/model.ts
var platforms = ["x", "xiaohongshu", "douyin", "weixin-video"];
var exportFormats = ["markdown", "text", "citations", "materials", "all"];

// src/client/styles.ts
var styles = `
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
`;

// src/client/index.tsx
var name = "content-evidence-client";
var inject = ["slots", "remote"];
var panelId = "content-evidence";
var labels = { x: "X", xiaohongshu: "\u5C0F\u7EA2\u4E66", douyin: "\u6296\u97F3", "weixin-video": "\u89C6\u9891\u53F7" };
function actions(ctx) {
  return {
    list: () => ctx.remote.contentEvidence.listTopics(),
    create: (idea) => ctx.remote.contentEvidence.createTopic(idea),
    read: (id) => ctx.remote.contentEvidence.readEvidence(id),
    source: (id, url, title) => ctx.remote.contentEvidence.addSource(id, url, title),
    capture: (id, input) => ctx.remote.contentEvidence.captureMaterial(id, input),
    material: (id, materialId) => ctx.remote.contentEvidence.readMaterial(id, materialId),
    experiment: (id, input) => ctx.remote.contentEvidence.logExperiment(id, input),
    claim: (id, text, sourceId) => ctx.remote.contentEvidence.saveClaim(id, text, sourceId),
    save: (id, target, input) => ctx.remote.contentEvidence.saveDraft(id, target, input),
    review: (id, target, revision) => ctx.remote.contentEvidence.reviewDraft(id, target, revision),
    export: (id, target, format, directory) => ctx.remote.contentEvidence.requestExport(id, target, format, directory),
    backfill: (id, target, url) => ctx.remote.contentEvidence.backfillPublishedLink(id, target, url)
  };
}
function value(result) {
  if (!result.ok) throw result.error;
  return result.value;
}
function Reference({ sheet, id }) {
  const source = sheet.sources.find((item) => item.id === id);
  if (source) return /* @__PURE__ */ import_react.default.createElement("a", { href: source.url, target: "_blank", rel: "noopener noreferrer" }, source.title || source.url);
  const material = sheet.materials.find((item) => item.id === id);
  if (material) return /* @__PURE__ */ import_react.default.createElement("span", null, "\u6750\u6599\uFF1A", material.name);
  const experiment = sheet.experiments.find((item) => item.id === id);
  return /* @__PURE__ */ import_react.default.createElement("span", null, experiment ? `\u5B9E\u9A8C\uFF1A${experiment.command}` : "\u5F85\u6838\u5B9E");
}
function References({ sheet, name: name2 }) {
  return /* @__PURE__ */ import_react.default.createElement("label", null, "\u8BC1\u636E\u5F15\u7528", /* @__PURE__ */ import_react.default.createElement("select", { name: name2, defaultValue: "" }, /* @__PURE__ */ import_react.default.createElement("option", { value: "" }, "\u65E0\u5F15\u7528 \xB7 \u5F85\u6838\u5B9E"), sheet.sources.map((item) => /* @__PURE__ */ import_react.default.createElement("option", { key: item.id, value: item.id }, "\u6765\u6E90\uFF1A", item.title || item.url)), sheet.materials.map((item) => /* @__PURE__ */ import_react.default.createElement("option", { key: item.id, value: item.id }, "\u6750\u6599\uFF1A", item.name)), sheet.experiments.map((item) => /* @__PURE__ */ import_react.default.createElement("option", { key: item.id, value: item.id }, "\u5B9E\u9A8C\uFF1A", item.command))));
}
function Field({ name: name2, label, multiline = false, required = true }) {
  return /* @__PURE__ */ import_react.default.createElement("label", null, label, multiline ? /* @__PURE__ */ import_react.default.createElement("textarea", { name: name2, required }) : /* @__PURE__ */ import_react.default.createElement("input", { name: name2, required }));
}
function fields(form) {
  const data = new FormData(form);
  return (key) => String(data.get(key) ?? "");
}
function materialPreview(input) {
  const bytes = Uint8Array.from(atob(input.base64), (char) => char.charCodeAt(0));
  const head = Array.from(bytes.subarray(0, 12), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const raster = input.mediaType === "image/png" && head.startsWith("89504e470d0a1a0a") || input.mediaType === "image/jpeg" && head.startsWith("ffd8ff") || input.mediaType === "image/gif" && (head.startsWith("474946383761") || head.startsWith("474946383961")) || input.mediaType === "image/webp" && head.startsWith("52494646") && head.slice(16, 24) === "57454250";
  return {
    image: raster ? `data:${input.mediaType};base64,${input.base64}` : null,
    text: raster ? null : new TextDecoder().decode(bytes)
  };
}
function Materials({ api, sheet, run, reload }) {
  const [preview, setPreview] = (0, import_react.useState)(null);
  return /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement("h2", null, "\u6750\u6599\u4E0E\u5B9E\u9A8C\u8BB0\u5F55"), /* @__PURE__ */ import_react.default.createElement("form", { onSubmit: (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const get = fields(form);
    void run(async () => {
      value(await api.source(sheet.id, get("url"), get("title")));
      form.reset();
      await reload();
    });
  } }, /* @__PURE__ */ import_react.default.createElement(Field, { name: "url", label: "\u6765\u6E90\u94FE\u63A5\uFF08HTTP/HTTPS\uFF0C\u4E0D\u81EA\u52A8\u8BBF\u95EE\uFF09" }), /* @__PURE__ */ import_react.default.createElement(Field, { name: "title", label: "\u6765\u6E90\u6807\u9898\uFF08\u53EF\u9009\uFF09", required: false }), /* @__PURE__ */ import_react.default.createElement("button", { type: "submit" }, "\u4FDD\u5B58\u6765\u6E90")), /* @__PURE__ */ import_react.default.createElement("ul", null, sheet.sources.map((source) => /* @__PURE__ */ import_react.default.createElement("li", { key: source.id }, /* @__PURE__ */ import_react.default.createElement(Reference, { sheet, id: source.id })))), /* @__PURE__ */ import_react.default.createElement("form", { onSubmit: (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    void run(async () => {
      if (!file.size || file.size > 10 * 1024 * 1024) throw new Error("\u8BF7\u9009\u62E9\u975E\u7A7A\u6587\u4EF6\uFF0C\u6700\u5927 10 MiB\u3002");
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      value(await api.capture(sheet.id, { name: file.name, mediaType: file.type || "application/octet-stream", base64: btoa(binary), sourceId: String(data.get("sourceId") || "") || null }));
      form.reset();
      await reload();
    });
  } }, /* @__PURE__ */ import_react.default.createElement("label", null, "\u622A\u56FE\u6216\u6750\u6599\u6587\u4EF6\uFF08\u6700\u5927 10 MiB\uFF09", /* @__PURE__ */ import_react.default.createElement("input", { name: "file", type: "file", required: true })), /* @__PURE__ */ import_react.default.createElement("label", null, "\u6750\u6599\u7684\u6765\u6E90", /* @__PURE__ */ import_react.default.createElement("select", { name: "sourceId" }, /* @__PURE__ */ import_react.default.createElement("option", { value: "" }, "\u65E0\u6765\u6E90"), sheet.sources.map((item) => /* @__PURE__ */ import_react.default.createElement("option", { value: item.id, key: item.id }, item.title || item.url)))), /* @__PURE__ */ import_react.default.createElement("button", { type: "submit" }, "\u590D\u5236\u6750\u6599\u5230\u672C\u5730\u5E93")), /* @__PURE__ */ import_react.default.createElement("ul", null, sheet.materials.map((item) => /* @__PURE__ */ import_react.default.createElement("li", { key: item.id }, /* @__PURE__ */ import_react.default.createElement("button", { type: "button", onClick: () => void run(async () => {
    const input = value(await api.material(sheet.id, item.id));
    setPreview({ name: input.name, ...materialPreview(input) });
  }) }, "\u67E5\u770B ", item.name), /* @__PURE__ */ import_react.default.createElement("small", null, " \xB7 ", item.mediaType, " \xB7 ", item.bytes, " bytes \xB7 ", /* @__PURE__ */ import_react.default.createElement(Reference, { sheet, id: item.sourceId }))))), preview && /* @__PURE__ */ import_react.default.createElement("div", { "aria-label": "\u6750\u6599\u9884\u89C8" }, /* @__PURE__ */ import_react.default.createElement("h3", null, preview.name), preview.image ? /* @__PURE__ */ import_react.default.createElement("img", { src: preview.image, alt: preview.name }) : /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement("p", { className: "ce-muted" }, "\u6309\u7EAF\u6587\u672C\u67E5\u770B\uFF1B\u4E8C\u8FDB\u5236\u6587\u4EF6\u53EF\u5BFC\u51FA\u540E\u5728\u672C\u673A\u6253\u5F00\u3002HTML\u3001SVG \u4E0E\u811A\u672C\u4E0D\u6267\u884C\u3002"), /* @__PURE__ */ import_react.default.createElement("pre", null, preview.text)), /* @__PURE__ */ import_react.default.createElement("button", { type: "button", onClick: () => setPreview(null) }, "\u5173\u95ED\u9884\u89C8")), /* @__PURE__ */ import_react.default.createElement("form", { onSubmit: (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const get = fields(form);
    void run(async () => {
      value(await api.experiment(sheet.id, { command: get("command"), output: get("output"), versions: get("versions"), conditions: get("conditions") }));
      form.reset();
      await reload();
    });
  } }, /* @__PURE__ */ import_react.default.createElement("h3", null, "\u8BB0\u5F55\u4E00\u6B21\u5B9E\u9A8C\uFF08\u4EC5\u8BB0\u5F55\uFF0C\u4E0D\u6267\u884C\u547D\u4EE4\uFF09"), /* @__PURE__ */ import_react.default.createElement(Field, { name: "command", label: "\u547D\u4EE4", multiline: true }), /* @__PURE__ */ import_react.default.createElement(Field, { name: "output", label: "\u7EC8\u7AEF\u8F93\u51FA", multiline: true }), /* @__PURE__ */ import_react.default.createElement(Field, { name: "versions", label: "\u7248\u672C\u53F7" }), /* @__PURE__ */ import_react.default.createElement(Field, { name: "conditions", label: "\u6D4B\u8BD5\u6761\u4EF6", multiline: true }), /* @__PURE__ */ import_react.default.createElement("button", { type: "submit" }, "\u4FDD\u5B58\u5B9E\u9A8C")), sheet.experiments.map((item) => /* @__PURE__ */ import_react.default.createElement("details", { key: item.id }, /* @__PURE__ */ import_react.default.createElement("summary", null, item.command), /* @__PURE__ */ import_react.default.createElement("pre", null, `${item.command}
${item.output}
\u7248\u672C\uFF1A${item.versions}
\u6761\u4EF6\uFF1A${item.conditions}`))));
}
function Evidence({ api, sheet, run, reload }) {
  return /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement("h2", null, "\u5171\u4EAB\u8BC1\u636E\u8868"), /* @__PURE__ */ import_react.default.createElement("p", { className: "ce-muted" }, "\u56DB\u5E73\u53F0\u5171\u7528\u4E8B\u5B9E\u3002\u6BCF\u4E2A\u5173\u952E\u6570\u5B57\u4E0E\u6BD4\u8F83\u5E94\u5173\u8054\u6765\u6E90\uFF1B\u6709\u5F15\u7528\u4ECD\u9700\u4EBA\u5DE5\u6838\u5B9E\u3002"), /* @__PURE__ */ import_react.default.createElement("form", { onSubmit: (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const get = fields(form);
    void run(async () => {
      value(await api.claim(sheet.id, get("claim"), get("reference") || null));
      form.reset();
      await reload();
    });
  } }, /* @__PURE__ */ import_react.default.createElement(Field, { name: "claim", label: "\u4E8B\u5B9E\u6216\u5F85\u6838\u5B9E\u7684\u9648\u8FF0", multiline: true }), /* @__PURE__ */ import_react.default.createElement(References, { sheet, name: "reference" }), /* @__PURE__ */ import_react.default.createElement("button", { type: "submit" }, "\u52A0\u5165\u8BC1\u636E\u8868")), sheet.claims.length ? /* @__PURE__ */ import_react.default.createElement("table", null, /* @__PURE__ */ import_react.default.createElement("thead", null, /* @__PURE__ */ import_react.default.createElement("tr", null, /* @__PURE__ */ import_react.default.createElement("th", { scope: "col" }, "\u4E8B\u5B9E"), /* @__PURE__ */ import_react.default.createElement("th", { scope: "col" }, "\u72B6\u6001"), /* @__PURE__ */ import_react.default.createElement("th", { scope: "col" }, "\u5F15\u7528"))), /* @__PURE__ */ import_react.default.createElement("tbody", null, sheet.claims.map((claim) => /* @__PURE__ */ import_react.default.createElement("tr", { key: claim.id }, /* @__PURE__ */ import_react.default.createElement("td", null, claim.text), /* @__PURE__ */ import_react.default.createElement("td", null, claim.status), /* @__PURE__ */ import_react.default.createElement("td", null, /* @__PURE__ */ import_react.default.createElement(Reference, { sheet, id: claim.sourceId })))))) : /* @__PURE__ */ import_react.default.createElement("p", null, "\u8FD8\u6CA1\u6709\u4E8B\u5B9E\uFF1B\u672A\u5173\u8054\u6765\u6E90\u7684\u9648\u8FF0\u4F1A\u4FDD\u7559\u4E3A\u300C\u5F85\u6838\u5B9E\u300D\u3002"));
}
function emptyBody(platform) {
  if (platform === "x") return { kind: "x-single", post: "" };
  if (platform === "xiaohongshu") return { kind: platform, title: "", body: "", cards: [""] };
  return { kind: platform, voiceover: "", shots: [""] };
}
function DraftEditor({ api, sheet, platform, run, update, dirty, setDirty }) {
  const draft = sheet.drafts[platform];
  const [body, setBody] = (0, import_react.useState)(() => draft?.body ?? emptyBody(platform));
  const [claimIds, setClaims] = (0, import_react.useState)(() => draft?.claimIds ?? []);
  const change = (next) => {
    setBody(next);
    setDirty(true);
  };
  const text = (label, content, onChange) => /* @__PURE__ */ import_react.default.createElement("label", null, label, /* @__PURE__ */ import_react.default.createElement("textarea", { required: true, value: content, onChange: (event) => onChange(event.target.value) }));
  const list = (label, entries, onChange) => /* @__PURE__ */ import_react.default.createElement("fieldset", null, /* @__PURE__ */ import_react.default.createElement("legend", null, label), entries.map((entry, index) => /* @__PURE__ */ import_react.default.createElement("div", { key: index, className: "ce-row" }, text(`${label} \xB7 ${index + 1}`, entry, (content) => onChange(entries.map((old, i) => i === index ? content : old))), /* @__PURE__ */ import_react.default.createElement("button", { type: "button", disabled: entries.length <= 1, onClick: () => onChange(entries.filter((_, i) => i !== index)), "aria-label": `\u79FB\u9664${label} ${index + 1}` }, "\u79FB\u9664"))), /* @__PURE__ */ import_react.default.createElement("button", { type: "button", disabled: entries.length >= 100, onClick: () => onChange([...entries, ""]) }, "\u6DFB\u52A0", label));
  return /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement("p", null, "\u5DF2\u4FDD\u5B58\u7248\u672C\uFF1A", draft?.revision ?? 0, " \xB7 \u590D\u6838\uFF1A", dirty ? "\u5F85\u91CD\u65B0\u590D\u6838\uFF08\u6709\u672A\u4FDD\u5B58\u7F16\u8F91\uFF09" : { pending: "\u5F85\u590D\u6838", passed: "\u901A\u8FC7\uFF08\u4ECD\u9700\u4EBA\u5DE5\u6838\u5B9E\uFF09", failed: "\u9700\u4FEE\u6539" }[draft?.review.status ?? "pending"]), !draft?.body && draft && /* @__PURE__ */ import_react.default.createElement("details", null, /* @__PURE__ */ import_react.default.createElement("summary", null, "\u539F\u59CB\u65E7\u7248\u8349\u7A3F\uFF08\u8BF7\u8F6C\u6362\u540E\u4FDD\u5B58\uFF09"), /* @__PURE__ */ import_react.default.createElement("pre", null, draft.content)), /* @__PURE__ */ import_react.default.createElement("form", { onSubmit: (event) => {
    event.preventDefault();
    void run(async () => {
      const saved = value(await api.save(sheet.id, platform, { body, claimIds, expectedRevision: draft?.revision ?? 0, evidenceHash: sheet.evidenceHash }));
      update({ ...sheet, drafts: { ...sheet.drafts, [platform]: saved } });
      setDirty(false);
    });
  } }, platform === "x" && /* @__PURE__ */ import_react.default.createElement("label", null, "X \u683C\u5F0F", /* @__PURE__ */ import_react.default.createElement("select", { value: body.kind, onChange: (event) => change(event.target.value === "x-thread" ? { kind: "x-thread", posts: body.kind === "x-single" ? [body.post] : [""] } : { kind: "x-single", post: body.kind === "x-thread" ? body.posts.join("\n\n") : "" }) }, /* @__PURE__ */ import_react.default.createElement("option", { value: "x-single" }, "\u5355\u6761"), /* @__PURE__ */ import_react.default.createElement("option", { value: "x-thread" }, "Thread"))), body.kind === "x-single" && text("\u5355\u6761\u6B63\u6587", body.post, (post) => change({ ...body, post })), body.kind === "x-thread" && list("\u5E16\u5B50", body.posts, (posts) => change({ ...body, posts })), body.kind === "xiaohongshu" && /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, text("\u6807\u9898", body.title, (title) => change({ ...body, title })), text("\u6B63\u6587", body.body, (content) => change({ ...body, body: content })), list("\u5361\u7247\u6587\u6848", body.cards, (cards) => change({ ...body, cards }))), (body.kind === "douyin" || body.kind === "weixin-video") && /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, text("\u53E3\u64AD\u811A\u672C", body.voiceover, (voiceover) => change({ ...body, voiceover })), list("\u955C\u5934", body.shots, (shots) => change({ ...body, shots }))), /* @__PURE__ */ import_react.default.createElement("fieldset", null, /* @__PURE__ */ import_react.default.createElement("legend", null, "\u672C\u7A3F\u4F7F\u7528\u7684\u5171\u4EAB\u4E8B\u5B9E"), sheet.claims.map((claim) => /* @__PURE__ */ import_react.default.createElement("label", { className: "ce-check", key: claim.id }, /* @__PURE__ */ import_react.default.createElement("input", { type: "checkbox", checked: claimIds.includes(claim.id), onChange: (event) => {
    setClaims(event.target.checked ? [...claimIds, claim.id] : claimIds.filter((id) => id !== claim.id));
    setDirty(true);
  } }), claim.text, " \xB7 ", claim.status))), /* @__PURE__ */ import_react.default.createElement("p", { className: "ce-muted" }, "\u6570\u5B57\u987B\u5148\u5F55\u5165\u9009\u4E2D\u7684\u4E8B\u5B9E\uFF0C\u7F51\u5740\u987B\u6765\u81EA\u5176\u5F15\u7528\u3002\u8BF7\u660E\u786E\u6807\u6CE8\u300CAI \u751F\u6210\u300D\u6216\u300CAI-generated\u300D\u3002"), /* @__PURE__ */ import_react.default.createElement("button", { type: "submit" }, "\u4FDD\u5B58\u8349\u7A3F")), /* @__PURE__ */ import_react.default.createElement("button", { type: "button", disabled: !draft || dirty, onClick: () => void run(async () => {
    const reviewed = value(await api.review(sheet.id, platform, draft.revision));
    update({ ...sheet, drafts: { ...sheet.drafts, [platform]: reviewed } });
  }) }, "\u68C0\u67E5\u5DF2\u4FDD\u5B58\u8349\u7A3F"), /* @__PURE__ */ import_react.default.createElement("ul", null, draft?.review.findings.map((finding, index) => /* @__PURE__ */ import_react.default.createElement("li", { key: index }, typeof finding === "string" ? finding : /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement("strong", null, finding.code), " \xB7 ", finding.location, /* @__PURE__ */ import_react.default.createElement("pre", null, finding.excerpt), finding.fix)))), draft && /* @__PURE__ */ import_react.default.createElement("details", null, /* @__PURE__ */ import_react.default.createElement("summary", null, "\u5DF2\u4FDD\u5B58\u7684\u7EAF\u6587\u672C"), /* @__PURE__ */ import_react.default.createElement("pre", null, draft.content)));
}
function Exports({ api, sheet, platform, run, reload, dirty }) {
  return /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement("h2", null, "\u672C\u5730\u5BFC\u51FA\u4E0E\u94FE\u63A5\u56DE\u586B \xB7 ", labels[platform]), /* @__PURE__ */ import_react.default.createElement("p", null, "\u5BFC\u51FA\u5DF2\u4FDD\u5B58\u7684\u8349\u7A3F\u3002\u5F85\u590D\u6838\u6216\u672A\u901A\u8FC7\u7684\u5185\u5BB9\u4F1A\u5982\u5B9E\u6807\u6CE8\uFF1B\u81EA\u52A8\u68C0\u67E5\u4E0D\u4EE3\u8868\u5E73\u53F0\u5408\u89C4\u8BA4\u8BC1\u3002"), /* @__PURE__ */ import_react.default.createElement("form", { onSubmit: (event) => {
    event.preventDefault();
    const get = fields(event.currentTarget);
    void run(async () => {
      value(await api.export(sheet.id, platform, get("format"), get("directory")));
      await reload();
    });
  } }, /* @__PURE__ */ import_react.default.createElement(Field, { name: "directory", label: "DSH \u4E3B\u673A\u4E0A\u5DF2\u5B58\u5728\u7684\u7EDD\u5BF9\u76EE\u5F55" }), /* @__PURE__ */ import_react.default.createElement("p", null, "\u9700\u8981\u53EF\u904D\u5386\u7684\u76EE\u5F55\u53E5\u67C4\uFF08/proc/self/fd \u6216 /dev/fd\uFF09\uFF1B\u6807\u51C6 macOS / Windows \u4E0D\u652F\u6301\u65F6\u4F1A\u5B89\u5168\u62D2\u7EDD\uFF0C\u4E0D\u5199\u5165\u5BFC\u51FA\u6587\u4EF6\u3002"), /* @__PURE__ */ import_react.default.createElement("label", null, "\u5BFC\u51FA\u683C\u5F0F", /* @__PURE__ */ import_react.default.createElement("select", { name: "format", defaultValue: "all" }, exportFormats.map((format, i) => /* @__PURE__ */ import_react.default.createElement("option", { key: format, value: format }, ["Markdown", "\u7EAF\u6587\u672C", "\u5F15\u7528\u5217\u8868", "\u6750\u6599\u6587\u4EF6\u5939", "\u5168\u90E8"][i])))), /* @__PURE__ */ import_react.default.createElement("button", { type: "submit", disabled: !sheet.drafts[platform] || dirty }, "\u5BFC\u51FA\u5230\u672C\u673A\u76EE\u5F55")), /* @__PURE__ */ import_react.default.createElement("h3", null, "\u5BFC\u51FA\u8BB0\u5F55"), /* @__PURE__ */ import_react.default.createElement("ul", null, sheet.exports.filter((item) => item.platform === platform).map((item) => /* @__PURE__ */ import_react.default.createElement("li", { key: item.id }, item.createdAt, " \xB7 ", item.format, " \xB7 ", item.status, " \xB7 ", item.reviewPassed ? "\u5F53\u65F6\u590D\u6838\u901A\u8FC7" : "\u672A\u6807\u8BB0\u901A\u8FC7", /* @__PURE__ */ import_react.default.createElement("pre", null, item.directory ?? "\u65E7\u7248\u5F85\u5904\u7406\u8BB0\u5F55", item.files ? `
${item.files.join("\n")}` : "")))), /* @__PURE__ */ import_react.default.createElement("form", { onSubmit: (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const get = fields(form);
    void run(async () => {
      value(await api.backfill(sheet.id, platform, get("publishedUrl")));
      form.reset();
      await reload();
    });
  } }, /* @__PURE__ */ import_react.default.createElement("h3", null, "\u5728\u63D2\u4EF6\u5916\u624B\u52A8\u53D1\u5E03\u540E\u8BB0\u5F55\u94FE\u63A5"), /* @__PURE__ */ import_react.default.createElement(Field, { name: "publishedUrl", label: "\u5DF2\u53D1\u5E03\u94FE\u63A5\uFF08\u4EC5\u4FDD\u5B58\uFF0C\u4E0D\u8BBF\u95EE\uFF09" }), /* @__PURE__ */ import_react.default.createElement("button", { type: "submit", disabled: dirty }, "\u4FDD\u5B58\u53D1\u5E03\u94FE\u63A5")), /* @__PURE__ */ import_react.default.createElement("ul", null, sheet.publishedLinks.filter((item) => item.platform === platform).map((item, i) => /* @__PURE__ */ import_react.default.createElement("li", { key: i }, item.url, " \xB7 ", item.recordedAt))));
}
function Workbench(api) {
  const [topics, setTopics] = (0, import_react.useState)([]);
  const [sheet, setSheet] = (0, import_react.useState)(null);
  const [busy, setBusy] = (0, import_react.useState)(false);
  const locked = (0, import_react.useRef)(false);
  const [notice, setNotice] = (0, import_react.useState)("");
  const [error, setError] = (0, import_react.useState)("");
  const [dirty, setDirty] = (0, import_react.useState)(false);
  const [editorVersion, setEditorVersion] = (0, import_react.useState)(0);
  const [platform, setPlatform] = (0, import_react.useState)("x");
  const [tab, setTab] = (0, import_react.useState)("materials");
  const run = async (work) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
      setNotice("\u64CD\u4F5C\u5B8C\u6210\uFF0C\u6570\u636E\u5DF2\u4ECE\u672C\u5730\u4E3B\u673A\u8BFB\u53D6\u6216\u4FDD\u5B58\u3002");
    } catch (failure) {
      const code = typeof failure === "object" && failure && "code" in failure ? String(failure.code) : "";
      setError(code === "content-evidence/conflict" ? "\u8349\u7A3F\u6216\u8BC1\u636E\u5DF2\u5728\u5176\u4ED6\u5730\u65B9\u66F4\u65B0\uFF1B\u672C\u6B21\u672A\u8986\u76D6\u3002\u8BF7\u5148\u590D\u5236\u5F53\u524D\u7F16\u8F91\u5185\u5BB9\uFF0C\u518D\u653E\u5F03\u7F16\u8F91\u5E76\u5237\u65B0\uFF0C\u6838\u5BF9\u540E\u91CD\u65B0\u4FDD\u5B58\u3002" : `${code ? `${code}\uFF1A` : ""}${failure instanceof Error ? failure.message : String(failure)}`);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  const reload = async () => {
    if (sheet) setSheet(value(await api.read(sheet.id)));
  };
  const loadList = async () => {
    setTopics(value(await api.list()));
  };
  (0, import_react.useEffect)(() => {
    void run(loadList);
  }, []);
  (0, import_react.useEffect)(() => {
    if (!dirty) return;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  return /* @__PURE__ */ import_react.default.createElement("div", { className: "ce-workbench" }, /* @__PURE__ */ import_react.default.createElement("style", null, styles), /* @__PURE__ */ import_react.default.createElement("div", { className: "ce-wrap" }, /* @__PURE__ */ import_react.default.createElement("header", null, /* @__PURE__ */ import_react.default.createElement("h1", null, "\u5185\u5BB9\u8BC1\u636E\u5DE5\u4F5C\u53F0"), /* @__PURE__ */ import_react.default.createElement("p", { className: "ce-muted" }, "\u6750\u6599 \u2192 \u5171\u4EAB\u8BC1\u636E \u2192 \u56DB\u5E73\u53F0\u8349\u7A3F \u2192 \u590D\u6838 \u2192 \u672C\u5730\u5BFC\u51FA"), /* @__PURE__ */ import_react.default.createElement("p", null, "\u6570\u636E\u4FDD\u5B58\u5728\u6B64 DSH \u4E3B\u673A\uFF1B\u63D2\u4EF6\u4E0D\u4F1A\u81EA\u52A8\u53D1\u5E03\u3002")), /* @__PURE__ */ import_react.default.createElement("div", { "aria-live": "polite", role: "status" }, busy ? "\u6B63\u5728\u5904\u7406\u2026" : notice), error && /* @__PURE__ */ import_react.default.createElement("p", { role: "alert", className: "ce-notice" }, error), dirty && /* @__PURE__ */ import_react.default.createElement("p", { className: "ce-notice" }, "\u6709\u672A\u4FDD\u5B58\u7684\u8349\u7A3F\u3002\u4FDD\u5B58\u540E\u53EF\u5207\u6362\u4E3B\u9898\u3001\u5E73\u53F0\u6216\u66F4\u65B0\u8BC1\u636E\u3002", /* @__PURE__ */ import_react.default.createElement("button", { type: "button", disabled: busy, onClick: () => void run(async () => {
    await reload();
    setEditorVersion((version) => version + 1);
    setDirty(false);
  }) }, "\u653E\u5F03\u8349\u7A3F\u7F16\u8F91\u5E76\u5237\u65B0")), /* @__PURE__ */ import_react.default.createElement("fieldset", { disabled: busy }, /* @__PURE__ */ import_react.default.createElement("legend", null, "\u4E3B\u9898"), /* @__PURE__ */ import_react.default.createElement("div", { className: "ce-row" }, /* @__PURE__ */ import_react.default.createElement("label", null, "\u6D4F\u89C8\u4E3B\u9898", /* @__PURE__ */ import_react.default.createElement("select", { value: sheet?.id ?? "", disabled: dirty, onChange: (event) => {
    const id = event.target.value;
    if (!id) {
      setSheet(null);
      return;
    }
    void run(async () => {
      setSheet(value(await api.read(id)));
      setEditorVersion((version) => version + 1);
    });
  } }, /* @__PURE__ */ import_react.default.createElement("option", { value: "" }, "\u9009\u62E9\u4E3B\u9898"), topics.map((topic) => /* @__PURE__ */ import_react.default.createElement("option", { key: topic.id, value: topic.id }, topic.idea)))), /* @__PURE__ */ import_react.default.createElement("button", { type: "button", disabled: dirty, onClick: () => void run(async () => {
    await loadList();
    await reload();
    setEditorVersion((version) => version + 1);
  }) }, "\u5237\u65B0")), /* @__PURE__ */ import_react.default.createElement("form", { onSubmit: (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const get = fields(form);
    void run(async () => {
      const topic = value(await api.create(get("idea")));
      setSheet(value(await api.read(topic.id)));
      setEditorVersion((version) => version + 1);
      form.reset();
      await loadList();
    });
  } }, /* @__PURE__ */ import_react.default.createElement("div", { className: "ce-row" }, /* @__PURE__ */ import_react.default.createElement(Field, { name: "idea", label: "\u65B0\u4E3B\u9898\uFF1A\u4E00\u53E5\u8BDD\u60F3\u6CD5" }), /* @__PURE__ */ import_react.default.createElement("button", { type: "submit", disabled: dirty }, "\u521B\u5EFA\u4E3B\u9898")))), !sheet ? /* @__PURE__ */ import_react.default.createElement("p", null, "\u521B\u5EFA\u6216\u9009\u62E9\u4E3B\u9898\uFF0C\u5F00\u59CB\u6536\u96C6\u53EF\u8FFD\u6EAF\u7684\u6750\u6599\u3002") : /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement("h2", null, sheet.idea), /* @__PURE__ */ import_react.default.createElement("p", null, /* @__PURE__ */ import_react.default.createElement("small", null, "\u4E3B\u9898 ID\uFF1A", /* @__PURE__ */ import_react.default.createElement("code", null, sheet.id))), /* @__PURE__ */ import_react.default.createElement("details", null, /* @__PURE__ */ import_react.default.createElement("summary", null, "\u5728\u4F1A\u8BDD\u5185\u4F7F\u7528\u5BBF\u4E3B\u6A21\u578B\u8F85\u52A9\u6539\u5199"), /* @__PURE__ */ import_react.default.createElement("p", null, "\u9700\u8981\u5BBF\u4E3B\u5DF2\u6709\u53EF\u7528\u6A21\u578B\uFF1B\u82E5\u6A21\u578B\u5217\u8868\u4E3A\u7A7A\uFF0C\u8BF7\u5148\u5728 DSH\u300C\u8BBE\u7F6E \u2192 \u6A21\u578B\u300D\u5B8C\u6210\u914D\u7F6E\u3002\u672C\u754C\u9762\u4E0D\u68C0\u67E5\u51ED\u636E\u6216\u76F4\u63A5\u8C03\u7528\u6A21\u578B\u3002\u6253\u5F00\u4F1A\u8BDD\u5E76\u9009\u62E9\u53EF\u7528\u6A21\u578B\uFF0C\u5728\u7A7A\u95F2\u4F1A\u8BDD\u5148\u8FD0\u884C\u4E0B\u5217\u547D\u4EE4\uFF1A"), /* @__PURE__ */ import_react.default.createElement("pre", null, `/content-evidence workbench ${sheet.id}`), /* @__PURE__ */ import_react.default.createElement("p", null, "\u786E\u8BA4\u5DE5\u4F5C\u53F0\u5DF2\u5F00\u542F\u540E\uFF0C\u53D1\u9001\uFF1A\u8BF7\u8BFB\u53D6\u6B64\u4E3B\u9898\u7684\u8BC1\u636E\uFF0C\u4F7F\u7528\u5171\u4EAB\u4E8B\u5B9E\u5206\u522B\u6539\u5199\u5E76\u4FDD\u5B58 X\u3001\u5C0F\u7EA2\u4E66\u3001\u6296\u97F3\u3001\u89C6\u9891\u53F7\u7684\u5B8C\u6574\u8349\u7A3F\u3002\u6807\u6CE8 AI \u751F\u6210\uFF1B\u65E0\u6765\u6E90\u7684\u6570\u5B57\u4FDD\u7559\u300C\u5F85\u6838\u5B9E\u300D\uFF0C\u4E0D\u8981\u7F16\u9020\u6570\u5B57\u6216\u5F15\u7528\u3002"), /* @__PURE__ */ import_react.default.createElement("p", null, "\u5B8C\u6210\u540E\u8FD0\u884C ", /* @__PURE__ */ import_react.default.createElement("code", null, "/content-evidence leave"), "\uFF0C\u518D\u56DE\u5230\u6B64\u9762\u677F\u5237\u65B0\u3002\u5DE5\u4F5C\u53F0\u4EC5\u5141\u8BB8\u56DB\u4E2A\u672C\u5730\u5185\u5BB9\u8BC1\u636E\u5DE5\u5177\uFF1B\u8BF7\u4F7F\u7528\u5BBF\u4E3B\u539F\u751F\u5DE5\u5177\u6267\u884C\u5668\u3002\u6750\u6599\u4E2D\u7684\u6307\u4EE4\u4EC5\u4F5C\u4E3A\u6570\u636E\uFF0C\u4E0D\u4F1A\u81EA\u52A8\u53D1\u5E03\u3002")), /* @__PURE__ */ import_react.default.createElement("nav", { "aria-label": "\u5DE5\u4F5C\u53F0\u9875\u9762" }, [["materials", "\u6750\u6599\u4E0E\u5B9E\u9A8C"], ["evidence", "\u8BC1\u636E\u8868"], ["drafts", "\u56DB\u5E73\u53F0\u8349\u7A3F"], ["exports", "\u672C\u5730\u5BFC\u51FA"]].map(([id, label]) => /* @__PURE__ */ import_react.default.createElement("button", { type: "button", key: id, "aria-pressed": tab === id, onClick: () => setTab(id) }, label))), /* @__PURE__ */ import_react.default.createElement("fieldset", { disabled: busy, key: sheet.id }, /* @__PURE__ */ import_react.default.createElement("section", { hidden: tab !== "materials" }, /* @__PURE__ */ import_react.default.createElement("fieldset", { disabled: dirty }, /* @__PURE__ */ import_react.default.createElement(Materials, { api, sheet, run, reload }))), /* @__PURE__ */ import_react.default.createElement("section", { hidden: tab !== "evidence" }, /* @__PURE__ */ import_react.default.createElement("fieldset", { disabled: dirty }, /* @__PURE__ */ import_react.default.createElement(Evidence, { api, sheet, run, reload }))), /* @__PURE__ */ import_react.default.createElement("section", { hidden: tab !== "drafts" && tab !== "exports" }, /* @__PURE__ */ import_react.default.createElement("label", null, "\u5E73\u53F0", /* @__PURE__ */ import_react.default.createElement("select", { value: platform, disabled: dirty, onChange: (event) => setPlatform(event.target.value) }, platforms.map((target) => /* @__PURE__ */ import_react.default.createElement("option", { key: target, value: target }, labels[target])))), /* @__PURE__ */ import_react.default.createElement("div", { hidden: tab !== "drafts" }, /* @__PURE__ */ import_react.default.createElement("h2", null, labels[platform], " \u8349\u7A3F\u4E0E\u590D\u6838"), /* @__PURE__ */ import_react.default.createElement(DraftEditor, { key: `${platform}:${editorVersion}:${sheet.drafts[platform]?.revision ?? 0}`, api, sheet, platform, run, update: setSheet, dirty, setDirty })), /* @__PURE__ */ import_react.default.createElement("div", { hidden: tab !== "exports" }, /* @__PURE__ */ import_react.default.createElement(Exports, { api, sheet, platform, run, reload, dirty })))))));
}
function Icon({ size }) {
  return /* @__PURE__ */ import_react.default.createElement("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.6", "aria-hidden": "true" }, /* @__PURE__ */ import_react.default.createElement("path", { d: "M5 3h10l4 4v14H5zM14 3v5h5M8 12h8M8 16h5" }));
}
async function apply(ctx) {
  await ctx.remote.$mount(typert_remote_client_default);
  await ctx.plugin({
    name: "content-evidence-client-view",
    inject: ["slots", "remote", "remote.contentEvidence"],
    apply(viewCtx) {
      viewCtx.slots.inject("main", () => viewCtx.slots.register({ name: "main", key: panelId, inject: () => actions(viewCtx) }, Workbench));
      viewCtx.slots.inject("sidebar.panellist", () => viewCtx.slots.register({ name: "sidebar.panellist", id: panelId, order: 6, label: () => "\u5185\u5BB9\u8BC1\u636E / Content evidence" }, Icon));
    }
  });
}
return module.exports}});

var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { EvidenceStore } from './store.js';
let ContentEvidenceService = (() => {
    let _classSuper = TypertRemoteService;
    let _instanceExtraInitializers = [];
    let _listTopics_decorators;
    let _createTopic_decorators;
    let _readEvidence_decorators;
    let _addSource_decorators;
    let _captureMaterial_decorators;
    let _readMaterial_decorators;
    let _logExperiment_decorators;
    let _saveClaim_decorators;
    let _saveDraft_decorators;
    let _reviewDraft_decorators;
    let _backfillPublishedLink_decorators;
    let _requestExport_decorators;
    return class ContentEvidenceService extends _classSuper {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            _listTopics_decorators = [Remote];
            _createTopic_decorators = [Remote];
            _readEvidence_decorators = [Remote];
            _addSource_decorators = [Remote];
            _captureMaterial_decorators = [Remote];
            _readMaterial_decorators = [Remote];
            _logExperiment_decorators = [Remote];
            _saveClaim_decorators = [Remote];
            _saveDraft_decorators = [Remote];
            _reviewDraft_decorators = [Remote];
            _backfillPublishedLink_decorators = [Remote];
            _requestExport_decorators = [Remote];
            __esDecorate(this, null, _listTopics_decorators, { kind: "method", name: "listTopics", static: false, private: false, access: { has: obj => "listTopics" in obj, get: obj => obj.listTopics }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _createTopic_decorators, { kind: "method", name: "createTopic", static: false, private: false, access: { has: obj => "createTopic" in obj, get: obj => obj.createTopic }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _readEvidence_decorators, { kind: "method", name: "readEvidence", static: false, private: false, access: { has: obj => "readEvidence" in obj, get: obj => obj.readEvidence }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _addSource_decorators, { kind: "method", name: "addSource", static: false, private: false, access: { has: obj => "addSource" in obj, get: obj => obj.addSource }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _captureMaterial_decorators, { kind: "method", name: "captureMaterial", static: false, private: false, access: { has: obj => "captureMaterial" in obj, get: obj => obj.captureMaterial }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _readMaterial_decorators, { kind: "method", name: "readMaterial", static: false, private: false, access: { has: obj => "readMaterial" in obj, get: obj => obj.readMaterial }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _logExperiment_decorators, { kind: "method", name: "logExperiment", static: false, private: false, access: { has: obj => "logExperiment" in obj, get: obj => obj.logExperiment }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _saveClaim_decorators, { kind: "method", name: "saveClaim", static: false, private: false, access: { has: obj => "saveClaim" in obj, get: obj => obj.saveClaim }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _saveDraft_decorators, { kind: "method", name: "saveDraft", static: false, private: false, access: { has: obj => "saveDraft" in obj, get: obj => obj.saveDraft }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _reviewDraft_decorators, { kind: "method", name: "reviewDraft", static: false, private: false, access: { has: obj => "reviewDraft" in obj, get: obj => obj.reviewDraft }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _backfillPublishedLink_decorators, { kind: "method", name: "backfillPublishedLink", static: false, private: false, access: { has: obj => "backfillPublishedLink" in obj, get: obj => obj.backfillPublishedLink }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _requestExport_decorators, { kind: "method", name: "requestExport", static: false, private: false, access: { has: obj => "requestExport" in obj, get: obj => obj.requestExport }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        store = __runInitializers(this, _instanceExtraInitializers);
        constructor(ctx, dataDir, extraSensitiveTerms) {
            super(ctx, 'contentEvidence');
            this.store = new EvidenceStore(dataDir, extraSensitiveTerms);
        }
        async listTopics(signal) {
            return this.store.listTopics(signal);
        }
        async createTopic(idea, signal) {
            return this.store.createTopic(idea, signal);
        }
        async readEvidence(topicId, signal) {
            return this.store.readEvidence(topicId, signal);
        }
        async addSource(topicId, sourceUrl, title, signal) {
            return this.store.addSource(topicId, sourceUrl, title, signal);
        }
        async captureMaterial(topicId, input, signal) {
            return this.store.captureMaterial(topicId, input, signal);
        }
        async readMaterial(topicId, materialId, signal) {
            return this.store.readMaterial(topicId, materialId, signal);
        }
        async logExperiment(topicId, input, signal) {
            return this.store.logExperiment(topicId, input, signal);
        }
        async saveClaim(topicId, claimText, sourceId, signal) {
            return this.store.saveClaim(topicId, claimText, sourceId, signal);
        }
        async saveDraft(topicId, target, input, signal) {
            return this.store.saveDraft(topicId, target, input, signal);
        }
        async reviewDraft(topicId, target, expectedRevision, signal) {
            return this.store.reviewDraft(topicId, target, expectedRevision, signal);
        }
        async backfillPublishedLink(topicId, target, publishedUrl, signal) {
            return this.store.backfillPublishedLink(topicId, target, publishedUrl, signal);
        }
        async requestExport(topicId, target, format, directory, signal) {
            return this.store.requestExport(topicId, target, format, directory, signal);
        }
    };
})();
export { ContentEvidenceService };

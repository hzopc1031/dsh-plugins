import { CommandDefinitionId } from '@deepseek-ai/dsh-commands';
import z from '@deepseek-ai/schemastery';
export const name = 'invoice-gate';
export const inject = ['commands'];
export const Config = z.object({});
const help = [
    'dsh-invoice-gate — local verification gate / 本地票据核对闸门（开发中）',
    '/invoice-gate [help]',
    'Scaffold only: ingest, checks, evidence export and UI are not implemented yet. 当前仅提供帮助。',
    'No OCR or tax-bureau verification (不做 OCR／税局验真).',
    'The model must never invent or change amounts, tax, totals or identifiers. 模型不得编造或改写金额、税额、合计、票号。',
    'No model calls or automatic uploads; no outbound network. 不调用模型、不自动上传、不联网。',
    'Arithmetic checks do not prove authenticity, payment or reimbursability; evidence packs do not establish accounting-archive compliance.',
    '算术核对不证明票据真实、已付款或可报销；证据包不代表符合会计档案要求。',
].join('\n');
export function apply(ctx) {
    ctx.effect(() => ctx.commands.register({
        definitionId: CommandDefinitionId('dsh-invoice-gate'),
        name: 'invoice-gate',
        description: 'Local invoice verification gate / 本地票据核对闸门（当前仅帮助）',
        input: { hint: 'help' },
        recordInput: false,
        handler: ({ rawInput, signal }) => {
            if (signal.aborted)
                return { kind: 'error', text: 'Command cancelled / 命令已取消。' };
            const input = rawInput.trim();
            if (!input || input === 'help')
                return { kind: 'success', text: help };
            return { kind: 'error', text: 'Not implemented in this scaffold. Use /invoice-gate help. 当前仅提供帮助，尚未执行任何核对。' };
        },
    }));
}

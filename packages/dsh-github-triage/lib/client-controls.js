import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Button, Menu, IconChevronDownOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives';
export const modeOptions = [['both', 'issues 与 PR'], ['issues', '仅 issues'], ['prs', '仅 PR']];
export const modeLabels = { both: 'issues 与 PR', issues: '仅 issues', prs: '仅 PR' };
// rc.5 and rc.1 export Menu, not Select. Keep selection state in the form;
// delegate placement, dismissal, keyboard walking and focus return to Menu.
export function Choice({ label, value, options, onChange, id, disabled = false, ...aria }) {
    const [open, setOpen] = useState(false);
    return _jsx(Menu, { open: open && !disabled, portal: true, minWidthFromAnchor: true, autoFocus: true, className: "gt-choice", listClassName: "gt-choice-menu", selectedId: value, items: options.map(([id, label]) => ({ id, label })), onClose: () => setOpen(false), onSelect: next => { onChange(next); setOpen(false); }, anchor: _jsxs(Button, { id: id, variant: "outline", disabled: disabled, "aria-label": label, "aria-haspopup": "menu", "aria-expanded": open && !disabled, ...aria, onClick: () => setOpen(v => !v), children: [_jsx("span", { children: options.find(([key]) => key === value)?.[1] ?? value }), _jsx(IconChevronDownOutlineRegular, { size: 16 })] }) });
}

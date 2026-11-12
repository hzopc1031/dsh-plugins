import * as primitives from '@deepseek-ai/dsh-client-ui-primitives';
function resolve(name) {
    try {
        const found = primitives[name];
        if (typeof found === 'function')
            return found;
    }
    catch { }
    return () => null;
}
export const Branch = resolve('IconBranchOutlineRegular');
export const Plus = resolve('IconPlusOutlineRegular');
export const Settings = resolve('IconSettingsOutlineMedium');
export const Search = resolve('IconSearchOutlineRegular');
export const Clock = resolve('IconClockOutlineRegular');
export const Check = resolve('IconCheckOutlineRegular');

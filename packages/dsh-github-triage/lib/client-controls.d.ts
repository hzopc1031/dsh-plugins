import { type AriaAttributes } from 'react';
export declare const modeOptions: readonly [readonly ["both", "issues 与 PR"], readonly ["issues", "仅 issues"], readonly ["prs", "仅 PR"]];
export declare const modeLabels: {
    readonly both: "issues 与 PR";
    readonly issues: "仅 issues";
    readonly prs: "仅 PR";
};
export declare function Choice({ label, value, options, onChange, id, disabled, ...aria }: {
    label: string;
    value: string;
    options: readonly (readonly [string, string])[];
    onChange: (value: string) => void;
    id?: string;
    disabled?: boolean;
} & Pick<AriaAttributes, 'aria-invalid' | 'aria-describedby'>): import("react").JSX.Element;

export interface Element {
    tag: string;
    attrs: Record<string, string>;
    parent?: Element;
    selector: string;
    start: number;
    end: number;
}
export declare function decodeEntities(value: string): string;
export declare function hasClass(node: Element, name: string): boolean;
export declare function ancestors(node: Element): Element[];
export declare function parseElements(html: string): Element[];
export declare function noteText(html: string): string;

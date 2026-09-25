export type ISSUE = {
    key: string;
    loc: LOC;
    // name: string;
    // context: CTX;
};
type Range = [number, number];

export type PROPERTY_POS = {
    all: Range;
    property: Range;
    type: Range;
    description: Range;
    name: Range;
    emoji: Range;
};

export type KEY_VALUE = {
    key: string;
    value: string;
};
export type KEY_VALUES = {
    [key: string]: string;
}

// string or undefined value
export type $string = string | null | undefined;
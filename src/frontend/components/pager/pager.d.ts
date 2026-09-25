export type PagerMessage = {
    id: string;
    title: string;
    text: string;
    demo?: boolean;
    expiresAt?: string;
};
export type PagerResult = { messages: PagerMessage[]; offline: boolean };

export type PagerMessage = {
    id: string;
    title: string;
    message: string;
    timestamp: string;
    text?: string;
    demo?: boolean;
    expiresAt?: string;
};
export type PagerResult = { messages: PagerMessage[]; offline: boolean };

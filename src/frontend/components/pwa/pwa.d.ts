export type PwaStatus = {
    version: string;
    build: string;
    cacheName: string;
    documents: string[];
};

export type InstallPromptEvent = Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

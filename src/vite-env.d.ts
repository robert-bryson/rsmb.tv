/// <reference types="vite/client" />

declare const __BUILD_DATE__: string;
declare const __BUILD_REVISION__: string;

interface ImportMetaEnv {
    readonly VITE_CARTO_API_KEY?: string;
    readonly VITE_PINS_CONTEXT_DATA_BASE_URL?: string;
    readonly VITE_INTENT_PREFETCH?: 'off' | 'pages' | 'all';
}

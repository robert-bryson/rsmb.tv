/// <reference types="vite/client" />

declare const __BUILD_DATE__: string;

interface ImportMetaEnv {
    readonly VITE_CARTO_API_KEY?: string;
}

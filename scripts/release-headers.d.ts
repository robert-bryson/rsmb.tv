export function expectedHostingHeaders(urlOrPath: string | URL): Record<string, string>;
export function assertHostingHeaders(urlOrPath: string | URL, actualHeaders: Readonly<Record<string, string>>): void;

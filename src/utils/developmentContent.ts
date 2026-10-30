/** Local development and explicitly requested development builds include editorial previews. */
export function isDevelopmentContent() {
    return import.meta.env.DEV || import.meta.env.MODE === 'development';
}

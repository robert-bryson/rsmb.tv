/** Natural Earth lookup names can differ from authored names by accents or spacing. */
export function atlasGeographyName(name: string): string {
    return name.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase().replace(/\s+/g, '-');
}

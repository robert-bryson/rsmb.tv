/** Qualitative atlas colors. Keep assignments stable across publication and filtering. */
export const tripAtlasPalette = {
    violet: '#a78bfa',
    sky: '#38bdf8',
    yellow: '#fbbf24',
    mint: '#34d399',
    rose: '#fb7185',
} as const;

/** Assign a color here when adding a trip; authoring checks reject missing or reused colors. */
export const tripAtlasColorAssignments: Readonly<Record<string, keyof typeof tripAtlasPalette>> = {
    'ocean-shores-2024': 'violet',
    'boise-2024': 'sky',
    'kalaloch-2024': 'rose',
    'pch-2024': 'yellow',
    'route-66ish-2025': 'mint',
};

export function tripAtlasColor(id: string) {
    // Keep incomplete local content renderable until its explicit assignment is authored.
    const token = Object.hasOwn(tripAtlasColorAssignments, id) ? tripAtlasColorAssignments[id] : 'violet';
    return tripAtlasPalette[token];
}

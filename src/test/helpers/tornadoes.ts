import type { NotableTornadoEvent } from '../../features/tornadoes/types';

export function makeNotableEvent(overrides: Partial<NotableTornadoEvent> = {}): NotableTornadoEvent {
    return {
        id: 'notable-1', eventId: '1', episodeId: '1', year: 2025, month: 5,
        date: '2025-05-01', beginTime: '12:00', endTime: '12:30', timezone: 'CST-6',
        state: 'KS', stateName: 'Kansas', county: 'Test County', countyFips: '001', wfo: 'TOP',
        scale: 2, scaleLabel: 'EF2', lengthMiles: 12, widthYards: 100,
        deaths: 0, injuries: 0, propertyDamage: 0, cropDamage: 0, source: 'test', dataSource: 'test',
        coordinates: [[-96.5, 38.7], [-95, 39.5]],
        ...overrides,
    };
}

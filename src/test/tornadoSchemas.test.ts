import { expect, it } from 'vitest';
import { notableEventsSchema } from '../features/tornadoes/schemas';
import { makeNotableEvent } from './helpers/tornadoes';

it('accepts empty and valid event lists, including unknown intensity', () => {
    expect(notableEventsSchema.parse([])).toEqual([]);
    const event = makeNotableEvent({ scale: -1, scaleLabel: 'Unknown', narrative: '<b>Literal narrative</b>' });
    expect(notableEventsSchema.parse([event])).toEqual([event]);
});

it.each([
    {}, null, [null], [makeNotableEvent({ lengthMiles: Number.NaN })],
    [makeNotableEvent({ deaths: -1 })], [makeNotableEvent({ coordinates: [] })],
    [makeNotableEvent({ coordinates: [[181, 0], [0, 0]] })],
    [makeNotableEvent({ coordinates: [[0, 91], [0, 0]] })],
])('rejects event data that cannot be safely rendered or selected: %j', payload => {
    expect(notableEventsSchema.safeParse(payload).success).toBe(false);
});

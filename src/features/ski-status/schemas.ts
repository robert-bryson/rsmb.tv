import { z } from 'zod';

export const skiId = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const passSeasonId = z.string().regex(/^\d{4}\/\d{2}$/).refine(value =>
    Number(value.slice(5)) === (Number(value.slice(0, 4)) + 1) % 100, 'Pass season must end the next year');
export const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
export const isoTime = z.iso.datetime({ offset: true });

export const httpsUrl = z.string().trim().refine(value => {
    if (!/^https:\/\/[^/]/i.test(value) || /[\\\s]/u.test(value)) return false;
    try {
        const { username, password } = new URL(value);
        return !username && !password;
    } catch {
        return false;
    }
}, 'Use an HTTPS source URL without credentials');

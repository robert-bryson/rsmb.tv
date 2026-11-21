import records from 'virtual:ski-visitor-data';
import type { ResortAccess } from '../../../shared/skiResortAccess';

export const skiResortAccess: ReadonlyMap<string, ResortAccess> = new Map(records);

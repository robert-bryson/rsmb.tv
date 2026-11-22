declare module 'virtual:ski-visitor-data' {
    import type { ResortAccess } from '../shared/skiResortAccess';
    const records: [string, ResortAccess][];
    export default records;
}

declare module 'virtual:ski-driving-data' {
    const catalog: import('../shared/skiDrivingCatalog').DrivingCatalog;
    export default catalog;
}

import type { Popup } from 'maplibre-gl';
import { escapeHtml } from '../../../utils/escapeHtml';

export function escapeMapText(value: unknown): string {
    return escapeHtml(typeof value === 'string' || typeof value === 'number' ? value : '');
}

export function styleDarkPopup(popup: Popup) {
    const element = popup.getElement();
    if (!element) return;
    element.querySelectorAll('.maplibregl-popup-content').forEach(node => {
        (node as HTMLElement).style.cssText = 'background:transparent;padding:0;box-shadow:none;border:none;';
    });
    element.querySelectorAll('.maplibregl-popup-tip').forEach(node => {
        (node as HTMLElement).style.borderTopColor = '#18181b';
    });
    element.querySelectorAll('.maplibregl-popup-close-button').forEach(node => {
        (node as HTMLElement).style.cssText = 'color:#a1a1aa;font-size:18px;right:6px;top:6px;';
    });
}

interface RecordAgePopupProperties {
    countyName?: unknown;
    state?: unknown;
    stationName?: unknown;
    type?: unknown;
    tempF?: unknown;
    year?: unknown;
    color?: unknown;
}

function recordAgeColor(value: unknown): string {
    return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : '#a1a1aa';
}

export function buildRecordAgePopupHtml(properties: RecordAgePopupProperties, compact = false): string {
    const countyName = escapeMapText(properties.countyName);
    const state = escapeMapText(properties.state);
    const stationName = escapeMapText(properties.stationName);
    const temperature = escapeMapText(properties.tempF);
    const year = escapeMapText(properties.year);
    const color = recordAgeColor(properties.color);
    const typeLabel = properties.type === 'high' ? 'Record High' : 'Record Low';

    if (compact) {
        return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#18181b;color:#e4e4e7;padding:4px 8px;border-radius:6px;font-size:12px;white-space:nowrap;border:1px solid #3f3f46;box-shadow:0 2px 8px rgba(0,0,0,.4)"><span style="color:${color};font-weight:700">${temperature}°F</span> <span style="color:#a1a1aa">${countyName} (${year})</span></div>`;
    }

    return `<div style="
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
        background:#18181b;color:#e4e4e7;padding:10px 12px;border-radius:8px;
        min-width:180px;line-height:1.5;font-size:12px;
        border:1px solid #3f3f46;box-shadow:0 4px 20px rgba(0,0,0,.5)">
        <div style="font-size:13px;font-weight:600">${countyName}, ${state}</div>
        <div style="font-size:18px;font-weight:700;color:${color};margin:4px 0">${temperature}°F</div>
        <div style="font-size:11px;color:#a1a1aa">${typeLabel} · ${stationName}</div>
        <div style="font-size:11px;color:#a1a1aa">Set in <strong style="color:#e4e4e7">${year}</strong></div>
    </div>`;
}
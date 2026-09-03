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
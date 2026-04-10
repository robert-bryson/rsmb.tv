import { describe, it, expect } from 'vitest';
import { escapeHtml } from '../utils/escapeHtml';

describe('escapeHtml', () => {
    it('escapes ampersands', () => {
        expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
    });

    it('escapes angle brackets', () => {
        expect(escapeHtml('<script>alert("xss")</script>')).toBe(
            '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
        );
    });

    it('escapes quotes', () => {
        expect(escapeHtml('"double" & \'single\'')).toBe(
            '&quot;double&quot; &amp; &#39;single&#39;',
        );
    });

    it('handles numbers', () => {
        expect(escapeHtml(42)).toBe('42');
    });

    it('returns empty string unchanged', () => {
        expect(escapeHtml('')).toBe('');
    });

    it('passes through safe text unchanged', () => {
        expect(escapeHtml('Hello World 123')).toBe('Hello World 123');
    });
});

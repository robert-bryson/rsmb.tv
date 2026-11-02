import { useDocumentHead } from './useDocumentHead';
import { useJsonLd } from './useJsonLd';
import type { PageMetadata } from '../utils/pageMetadata';

export function usePageMetadata(metadata: PageMetadata) {
    useDocumentHead(metadata);
    useJsonLd(metadata.jsonLd);
    useJsonLd(metadata.breadcrumb);
}

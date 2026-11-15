import { projectCategories, type Project, type ProjectCategory } from './projects';
import { normalizeSearch, withSearchQuery } from '../utils/search';

interface ProjectFilters {
    category: ProjectCategory | 'all';
    query: string;
}

export function getProjectCategory(value: string | null): ProjectFilters['category'] {
    return value && Object.hasOwn(projectCategories, value) ? value as ProjectCategory : 'all';
}

export function createProjectsUrl({ category = 'all', query = '' }: Partial<ProjectFilters> = {}): string {
    const params = new URLSearchParams();
    if (category !== 'all') params.set('category', category);
    const search = withSearchQuery(params, query).toString();
    return `/projects${search ? `?${search}` : ''}`;
}

/** Search project metadata without preparing or downloading the applications. */
export function filterProjects(items: readonly Project[], { query = '', category = 'all' }: Partial<ProjectFilters> = {}): Project[] {
    const terms = normalizeSearch(query).split(' ').filter(Boolean);
    return items.filter(project => {
        if (category !== 'all' && project.category !== category) return false;
        if (!terms.length) return true;
        const text = normalizeSearch([
            project.title, project.slug, project.description, project.summary ?? '',
            projectCategories[project.category], ...project.tech,
        ].join(' '));
        return terms.every(term => text.includes(term));
    });
}

import { createRef } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ContentSearch } from '../components/ContentSearch';

describe('shared content search control', () => {
    it('gives each field its own visible label, description, and input reference', () => {
        const projectsRef = createRef<HTMLInputElement>();
        const postsRef = createRef<HTMLInputElement>();
        render(<>
            <ContentSearch label="Search projects" hint="Project names and technologies." placeholder="Try Python" query="" onChange={vi.fn()} inputRef={projectsRef} />
            <ContentSearch label="Search posts" hint="Post names and places." placeholder="Try Québec" query="" onChange={vi.fn()} inputRef={postsRef} />
        </>);
        const projects = screen.getByRole('searchbox', { name: 'Search projects' });
        const posts = screen.getByRole('searchbox', { name: 'Search posts' });
        expect(projectsRef.current).toBe(projects);
        expect(postsRef.current).toBe(posts);
        expect(projects.id).not.toBe(posts.id);
        expect(projects).toHaveAccessibleDescription('Project names and technologies.');
        expect(posts).toHaveAccessibleDescription('Post names and places.');
        expect(projects).toHaveAttribute('placeholder', 'Try Python');
        expect(posts).toHaveAttribute('placeholder', 'Try Québec');
        expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();
    });

    it('passes literal input text to the caller and prevents form navigation', () => {
        const onChange = vi.fn();
        const query = '<script>alert(1)</script> & maps';
        render(<ContentSearch label="Search projects" hint="Project names." placeholder="Try maps" query={query} onChange={onChange} inputRef={createRef()} />);
        expect(screen.getByRole('searchbox')).toHaveValue(query);
        expect(document.querySelector('script')).toBeNull();
        fireEvent.change(screen.getByRole('searchbox'), { target: { value: `${query} & routes` } });
        expect(onChange).toHaveBeenCalledExactlyOnceWith(`${query} & routes`);
        expect(fireEvent.submit(screen.getByRole('search', { name: 'Search projects' }))).toBe(false);
    });

    it('clears only its own query and returns keyboard focus to its input', () => {
        const projectsChanged = vi.fn();
        const postsChanged = vi.fn();
        const projectsRef = createRef<HTMLInputElement>();
        render(<>
            <ContentSearch label="Search projects" hint="Project names." placeholder="Try maps" query="maps" onChange={projectsChanged} inputRef={projectsRef} />
            <ContentSearch label="Search posts" hint="Post names." placeholder="Try travel" query="travel" onChange={postsChanged} inputRef={createRef()} />
        </>);
        const form = screen.getByRole('search', { name: 'Search projects' });
        fireEvent.click(within(form).getByRole('button', { name: 'Clear search' }));
        expect(projectsChanged).toHaveBeenCalledExactlyOnceWith('');
        expect(postsChanged).not.toHaveBeenCalled();
        expect(projectsRef.current).toHaveFocus();
    });

    it('commits the pending query on blur and submit without changing its text', () => {
        const onChange = vi.fn();
        const onCommit = vi.fn();
        render(<ContentSearch label="Search projects" hint="Project names." placeholder="Try maps" query="python" onChange={onChange} onCommit={onCommit} inputRef={createRef()} />);
        fireEvent.blur(screen.getByRole('searchbox'));
        expect(onCommit).toHaveBeenCalledTimes(1);
        expect(fireEvent.submit(screen.getByRole('search'))).toBe(false);
        expect(onCommit).toHaveBeenCalledTimes(2);
        expect(onChange).not.toHaveBeenCalled();
        expect(screen.getByRole('searchbox')).toHaveValue('python');
    });
});

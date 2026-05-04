export interface ProjectScreenshot {
    src: string;
    alt: string;
    caption: string;
    width: number;
    height: number;
    loading?: 'eager' | 'lazy';
}

interface ProjectScreenshotGalleryProps {
    screenshots: ProjectScreenshot[];
    layout?: 'stacked' | 'grid';
}

export function ProjectScreenshotGallery({ screenshots, layout = 'stacked' }: ProjectScreenshotGalleryProps) {
    const wrapperClassName = layout === 'grid'
        ? 'mb-8 grid gap-4 sm:grid-cols-3'
        : 'mb-8 space-y-6';
    const imageClassName = layout === 'grid'
        ? 'w-full rounded-lg border border-zinc-800'
        : 'rounded-lg border border-zinc-800';

    return (
        <div className={wrapperClassName}>
            {screenshots.map((screenshot) => (
                <figure key={screenshot.src}>
                    <img
                        src={screenshot.src}
                        alt={screenshot.alt}
                        className={imageClassName}
                        width={screenshot.width}
                        height={screenshot.height}
                        loading={screenshot.loading ?? 'lazy'}
                        decoding="async"
                    />
                    <figcaption className="mt-2 text-center text-xs leading-snug text-zinc-400">
                        {screenshot.caption}
                    </figcaption>
                </figure>
            ))}
        </div>
    );
}
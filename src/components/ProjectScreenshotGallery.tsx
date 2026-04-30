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
}

export function ProjectScreenshotGallery({ screenshots }: ProjectScreenshotGalleryProps) {
    return (
        <div className="mb-8 space-y-6">
            {screenshots.map((screenshot) => (
                <figure key={screenshot.src}>
                    <img
                        src={screenshot.src}
                        alt={screenshot.alt}
                        className="rounded-lg border border-zinc-800"
                        width={screenshot.width}
                        height={screenshot.height}
                        loading={screenshot.loading ?? 'lazy'}
                        decoding="async"
                    />
                    <figcaption className="mt-2 text-center text-xs text-zinc-400">
                        {screenshot.caption}
                    </figcaption>
                </figure>
            ))}
        </div>
    );
}
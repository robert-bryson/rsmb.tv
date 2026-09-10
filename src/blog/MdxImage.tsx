import { useId, type ComponentPropsWithoutRef } from 'react';
import { useDismissibleCaption } from '../hooks/useDismissibleCaption';

function classNames(...classes: Array<string | undefined>) {
    return classes.filter(Boolean).join(' ');
}

export function MdxImage({ className, title, ...props }: ComponentPropsWithoutRef<'img'>) {
    const captionId = `blog-image-caption-${useId().replaceAll(':', '')}`;
    const titleCaption = typeof title === 'string' ? title.trim() : '';
    const altCaption = typeof props.alt === 'string' ? props.alt.trim() : '';
    const caption = titleCaption || altCaption;
    const { dismissed, captionInteractionProps } = useDismissibleCaption();

    if (!caption) {
        return <img className={classNames('my-4 rounded-lg border border-zinc-800', className)} loading="lazy" {...props} />;
    }

    return (
        <span
            className="image-caption-figure my-4 block"
            data-caption-dismissed={dismissed || undefined}
            tabIndex={0}
            {...captionInteractionProps}
        >
            <span className="image-caption-frame block overflow-hidden rounded-lg border border-zinc-800">
                <img
                    className={classNames('block h-auto w-full', className)}
                    loading="lazy"
                    aria-describedby={titleCaption ? captionId : undefined}
                    {...props}
                />
                <span
                    id={captionId}
                    className="image-caption-overlay block text-sm leading-snug text-zinc-400"
                    aria-hidden={!titleCaption || undefined}
                >
                    {caption}
                </span>
            </span>
        </span>
    );
}
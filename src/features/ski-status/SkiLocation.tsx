import { Fragment } from 'react';
import type { SkiArea } from './catalog';
import { skiLocationParts } from './skiGeography';

interface Props {
    area: SkiArea;
    onZoom?: (place: string) => void;
}

export function SkiLocation({ area, onZoom }: Props) {
    const { countries, regions } = skiLocationParts(area);
    return <span>{area.locality}{[regions, countries].filter(group => group.length).map(group =>
        <Fragment key={group[0].value}>, {group.map(({ value, label, text }, index) => {
            const action = `Zoom to ${label}${label === text ? '' : ` (${text})`}`;
            return <Fragment key={value}>{index > 0 && ' / '}{onZoom ? <button type="button" className="ski-location-link" aria-label={action}
                title={action} onClick={() => onZoom(value)}>{text}</button> : text}</Fragment>;
        })}</Fragment>)}</span>;
}

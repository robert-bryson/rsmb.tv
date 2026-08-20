import { formatDistance } from '../../utils';

interface DistanceValueProps {
  km: number;
  isMetric: boolean;
  className?: string;
}

/** A formatted distance with the alternate unit available on hover. */
export function DistanceValue({ km, isMetric, className }: DistanceValueProps) {
  return (
    <span className={className} title={formatDistance(km, !isMetric)}>
      {formatDistance(km, isMetric)}
    </span>
  );
}

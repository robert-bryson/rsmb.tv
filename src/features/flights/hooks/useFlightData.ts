import { useEffect, useState } from 'react';
import type { AirportsCollection, FlightsCollection } from '../types';

interface UseFlightDataResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export function useAirports(): UseFlightDataResult<AirportsCollection> {
  const [data, setData] = useState<AirportsCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fetch('/data/flights/visitedAirports.geojson')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error loading visitedAirports.geojson', err);
        setError(err);
        setLoading(false);
      });
  }, []);

  return { data, loading, error };
}

export function useFlights(): UseFlightDataResult<FlightsCollection> {
  const [data, setData] = useState<FlightsCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fetch('/data/flights/flights.geojson')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error loading flights.geojson', err);
        setError(err);
        setLoading(false);
      });
  }, []);

  return { data, loading, error };
}

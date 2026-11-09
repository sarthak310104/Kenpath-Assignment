import { useEffect, useState } from 'react';

// Loads the three reports for a date and keeps loading/error state.
// load(date) must return a promise of { daily, monthToDate, previousMonth }
// and has to keep the same identity between renders (define it outside the
// component, or wrap it in useCallback), otherwise this reloads forever.
export function useReportSet(date, load) {
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // if the date changes again before this finishes, drop the old answer
    let stale = false;

    async function run() {
      setLoading(true);
      setError('');

      try {
        const result = await load(date);

        if (!stale) setReports(result);
      } catch (err) {
        if (!stale) setError(err.message);
      } finally {
        if (!stale) setLoading(false);
      }
    }

    run();

    return () => {
      stale = true;
    };
  }, [date, load]);

  return { reports, loading, error };
}
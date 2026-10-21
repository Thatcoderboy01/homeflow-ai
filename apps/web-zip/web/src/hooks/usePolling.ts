import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "../lib/format";

/** Loads data once, optionally re-polls, and exposes loading/error state plus a manual refresh. */
export function useAsyncData<T>(fetcher: () => Promise<T>, intervalMs?: number) {
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const fetchRef = useRef(fetcher);
  fetchRef.current = fetcher;

  const refresh = useCallback(async () => {
    try {
      setData(await fetchRef.current());
      setError(undefined);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    if (!intervalMs) return;
    const t = setInterval(() => void refresh(), intervalMs);
    return () => clearInterval(t);
  }, [refresh, intervalMs]);

  return { data, error, loading, refresh };
}

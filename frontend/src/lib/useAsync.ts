import { useCallback, useEffect, useEffectEvent, useState } from "react";

/** Small, cancellable async read hook; stale requests never overwrite a changed search. */
export function useAsync<T>(read: () => Promise<T>, key: string) {
  const readLatest = useEffectEvent(read);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    key: string;
    revision: number;
    data?: T;
    error?: Error;
    loading: boolean;
  }>({ key: "", revision: -1, loading: true });
  useEffect(() => {
    let cancelled = false;
    readLatest().then(
      (data) => {
        if (!cancelled) setState({ key, revision, data, loading: false });
      },
      (error) => {
        if (!cancelled)
          setState({
            key,
            revision,
            error:
              error instanceof Error ? error : new Error("Please try again."),
            loading: false,
          });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [key, revision]);
  const retry = useCallback(() => setRevision((value) => value + 1), []);
  const current = state.key === key && state.revision === revision;
  return {
    data: current ? state.data : undefined,
    error: current ? state.error : undefined,
    loading: current ? state.loading : true,
    retry,
  };
}

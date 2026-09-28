import { useState, useRef, useCallback, useEffect } from 'react';

// Infinite-scroll list state. Uses refs for all guards so onEndReached firing
// several times in a row can never load the same page twice (the classic RN
// bug), and stale responses from an old filter are ignored.
//
//   fetchPage(page, limit) -> axios response { data: { data:[], pagination:{hasMore}, ... } }
//   key                    -> string; when it changes the list resets (filters/search/tab)
//
// reload(silent)  silent=false: full reset with spinner. silent=true: refresh page 1 in
//                 place and KEEP the pages already scrolled (no jump to top).
// focusRefresh    silent refresh for screen-focus (skips while a request is running)
// onRefresh       pull-to-refresh
export default function usePaginatedList(fetchPage, key, pageSize = 20) {
  const [items, setItems] = useState([]);
  const [extra, setExtra] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;
  const pageRef = useRef(1);
  const hasMoreRef = useRef(false);
  const busyRef = useRef(false);
  const reqRef = useRef(0);
  const inflightRef = useRef(false);
  const loadedRef = useRef(false);

  const run = useCallback(async ({ full, spinner }) => {
    const req = ++reqRef.current;
    inflightRef.current = true;
    busyRef.current = false;
    setLoadingMore(false);
    if (spinner) setLoading(true);
    try {
      const res = await fetchRef.current(1, pageSize);
      if (req !== reqRef.current) return;
      const rows = res.data?.data || [];
      const p = res.data?.pagination;
      setExtra(res.data || {});
      if (full) {
        setItems(rows);
        pageRef.current = 1;
        hasMoreRef.current = p ? !!p.hasMore : false;
      } else {
        setItems(prev => {
          const ids = new Set(rows.map(r => r.id));
          return [...rows, ...prev.slice(pageSize).filter(x => !ids.has(x.id))];
        });
        if (pageRef.current === 1) hasMoreRef.current = p ? !!p.hasMore : false;
      }
      loadedRef.current = true;
    } catch {
      // keep what is on screen
    } finally {
      if (req === reqRef.current) {
        inflightRef.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [pageSize]);

  useEffect(() => {
    loadedRef.current = false;
    run({ full: true, spinner: true });
  }, [key, run]);

  const loadMore = useCallback(async () => {
    if (busyRef.current || !hasMoreRef.current || !loadedRef.current) return;
    busyRef.current = true;
    setLoadingMore(true);
    const req = reqRef.current;
    const next = pageRef.current + 1;
    try {
      const res = await fetchRef.current(next, pageSize);
      if (req !== reqRef.current) return;
      const rows = res.data?.data || [];
      setItems(prev => {
        const ids = new Set(prev.map(x => x.id));
        return [...prev, ...rows.filter(r => !ids.has(r.id))];
      });
      pageRef.current = next;
      hasMoreRef.current = !!res.data?.pagination?.hasMore && rows.length > 0;
    } catch {
      // allow retry on next scroll
    } finally {
      if (req === reqRef.current) {
        busyRef.current = false;
        setLoadingMore(false);
      }
    }
  }, [pageSize]);

  const reload = useCallback((silent = false) => run(silent ? { full: false } : { full: true, spinner: true }), [run]);
  const focusRefresh = useCallback(() => { if (loadedRef.current && !inflightRef.current) run({ full: false }); }, [run]);
  const onRefresh = useCallback(() => { setRefreshing(true); run({ full: true }); }, [run]);

  return { items, setItems, extra, loading, refreshing, loadingMore, reload, loadMore, focusRefresh, onRefresh };
}

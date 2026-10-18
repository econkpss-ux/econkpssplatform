import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

export function useResumableState<T>(
  scope: string,
  userId: string | null,
  initialValue: T,
  isStoredValue: (value: unknown) => value is T,
): [T, Dispatch<SetStateAction<T>>, boolean] {
  const storageKey = `econkpss:resume:v1:${scope}:${userId ?? "pending"}`;
  const [state, setState] = useState(initialValue);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  useEffect(() => {
    setLoadedKey(null);
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) {
        setState(initialValue);
      } else {
        const value: unknown = JSON.parse(stored);
        if (isStoredValue(value)) {
          setState(value);
        } else {
          console.error(`Discarding invalid saved practice state for ${scope}.`);
          window.localStorage.removeItem(storageKey);
          setState(initialValue);
        }
      }
    } catch (error) {
      console.error(`Unable to restore practice state for ${scope}.`, error);
      setState(initialValue);
    }
    setLoadedKey(storageKey);
  }, [initialValue, isStoredValue, scope, storageKey]);

  useEffect(() => {
    if (loadedKey !== storageKey) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (error) {
      console.error(`Unable to save practice state for ${scope}.`, error);
    }
  }, [loadedKey, scope, state, storageKey]);

  return [state, setState, loadedKey === storageKey];
}

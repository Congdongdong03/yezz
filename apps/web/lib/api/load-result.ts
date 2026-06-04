export type LoadResult<T> = { ok: true; data: T } | { ok: false };

export function loadOk<T>(data: T): LoadResult<T> {
  return { ok: true, data };
}

export function loadFailed<T>(): LoadResult<T> {
  return { ok: false };
}

// Supabase/PostgREST returns a to-one embed as a single object, but the
// generated types are conservative and allow an array shape too.
export function toOneRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

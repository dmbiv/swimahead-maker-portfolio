export type PageResult<Row, ErrorType> = {
  data: Row[] | null;
  error: ErrorType | null;
};

export const ID_FILTER_CHUNK_SIZE = 250;

export function idChunks<T>(ids: readonly T[], size = ID_FILTER_CHUNK_SIZE): T[][] {
  const chunked: T[][] = [];
  for (let index = 0; index < ids.length; index += size) {
    chunked.push(ids.slice(index, index + size) as T[]);
  }
  return chunked;
}

export async function collectAllPages<Row, ErrorType>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<Row, ErrorType>>,
  pageSize = 1_000,
): Promise<{ data: Row[]; error: ErrorType | null }> {
  if (!Number.isSafeInteger(pageSize) || pageSize < 1) {
    throw new RangeError("pageSize must be a positive integer");
  }

  const rows: Row[] = [];
  for (let from = 0; ; from += pageSize) {
    const result = await fetchPage(from, from + pageSize - 1);
    if (result.error) return { data: [], error: result.error };

    const page = result.data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return { data: rows, error: null };
  }
}

export async function collectAllChunkedPages<Id, Row, ErrorType>(
  ids: readonly Id[],
  fetchPage: (
    chunk: readonly Id[],
    from: number,
    to: number,
  ) => PromiseLike<PageResult<Row, ErrorType>>,
  options: { chunkSize?: number; pageSize?: number } = {},
): Promise<{ data: Row[]; error: ErrorType | null }> {
  const chunkSize = options.chunkSize ?? ID_FILTER_CHUNK_SIZE;
  const pageSize = options.pageSize ?? 1_000;
  if (!Number.isSafeInteger(chunkSize) || chunkSize < 1) {
    throw new RangeError("chunkSize must be a positive integer");
  }

  const results = await Promise.all(
    idChunks(ids, chunkSize).map((chunk) =>
      collectAllPages((from, to) => fetchPage(chunk, from, to), pageSize)),
  );
  const failed = results.find((result) => result.error != null);
  if (failed) return { data: [], error: failed.error };
  return { data: results.flatMap((result) => result.data), error: null };
}

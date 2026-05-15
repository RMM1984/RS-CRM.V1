export type ApiResponse<T> =
  | {
      ok: true
      data: T
    }
  | {
      ok: false
      error: {
        message: string
        details?: unknown
      }
    }

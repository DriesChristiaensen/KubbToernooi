interface ApiErrorOptions {
  error: string
  code: number
  reason: string
  field?: string
  cause?: unknown
}

export function createApiError({ error, code, reason, field, cause }: ApiErrorOptions) {
  return createError({
    statusCode: code,
    statusMessage: reason,
    data: {
      error,
      code,
      reason,
      ...(field !== undefined ? { field } : {}),
      stacktrace: import.meta.dev && cause ? cause : {},
    },
  })
}

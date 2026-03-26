interface ApiErrorOptions {
  error: string
  code: number
  reason: string
  cause?: unknown
}

export function createApiError({ error, code, reason, cause }: ApiErrorOptions) {
  return createError({
    statusCode: code,
    statusMessage: reason,
    data: {
      error,
      code,
      reason,
      stacktrace: import.meta.dev && cause ? cause : {},
    },
  })
}

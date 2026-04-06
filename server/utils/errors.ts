// Map of error codes to HTTP status codes
const codeToStatusCode: Record<string, number> = {
  // 400 Bad Request
  invalid_input: 400,
  invalid_tournament_type: 400,
  invalid_tournament_id: 400,
  invalid_pool_id: 400,
  invalid_field_id: 400,
  invalid_team_id: 400,
  invalid_referee_id: 400,
  invalid_match_id: 400,
  invalid_date: 400,
  invalid_time: 400,
  invalid_number: 400,
  invalid_import_format: 400,
  tournament_name_empty: 400,
  tournament_name_exists: 409,
  field_name_empty: 400,
  field_name_exists: 409,
  team_name_empty: 400,
  team_name_exists: 409,
  referee_name_empty: 400,
  referee_name_exists: 409,
  pool_name_empty: 400,
  teams_advancing_invalid: 400,
  not_enough_teams: 400,
  not_enough_standings: 400,
  not_enough_fields: 400,
  no_pools: 400,
  no_fields: 400,
  no_ko_matches: 400,
  no_pools_found: 400,
  no_fields_found: 400,
  no_fields_available: 400,
  not_enough_teams_ko: 400,
  not_enough_standings_ko: 400,
  invalid_password: 401,
  password_required: 409,
  generate_ko_first: 400,
  starttime_must_include_time: 400,

  // 401 Unauthorized
  admin_password_invalid: 401,

  // 403 Forbidden
  unauthorized: 403,

  // 429 Too Many Requests
  rate_limit_exceeded: 429,

  // 404 Not Found
  tournament_not_found: 404,
  pool_not_found: 404,
  field_not_found: 404,
  team_not_found: 404,
  referee_not_found: 404,
  match_not_found: 404,
  user_not_found: 404,
  admin_user_not_found: 404,

  // 409 Conflict
  tournament_exists: 409,
  matches_exist: 409,
  ko_matches_exist: 409,
  data_exists: 409,
  existing_data_overwrite_required: 409,
  schedule_conflict: 409,

  // 500 Internal Server Error
  admin_no_password: 500,
  unexpected_error: 500,

  // 503 Service Unavailable
  database_unavailable: 503,
}

interface ApiErrorOptions {
  error: string
  code: string
  reason: string
  field?: string
  cause?: unknown
}

export function createApiError({ error, code, reason, field, cause }: ApiErrorOptions) {
  const statusCode = codeToStatusCode[code] ?? 500
  return createError({
    statusCode,
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

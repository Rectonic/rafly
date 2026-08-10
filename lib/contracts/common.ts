export type IsoDateTime = string
export type IsoDate = string
export type StoreRole = 'staff' | 'manager' | 'owner' | 'operator'
export type CommandErrorCode =
  | 'not_found'
  | 'forbidden'
  | 'validation_failed'
  | 'version_conflict'
  | 'invalid_state'
  | 'idempotency_conflict'
  | 'sold_out'
  | 'offer_not_live'
  | 'allocation_exceeded'
  | 'network_error'
  | 'unknown'

export interface CommandError {
  code: CommandErrorCode
  message: string
  retryable: boolean
  details?: Record<string, unknown>
}

export type Result<T> = { ok: true, value: T } | { ok: false, error: CommandError }

export const ok = <T>(value: T): Result<T> => ({ ok: true, value })

const RETRYABLE: ReadonlySet<CommandErrorCode> = new Set(['network_error', 'unknown'])

export const err = (
  code: CommandErrorCode,
  message: string,
  details?: Record<string, unknown>,
): Result<never> => ({
  ok: false,
  error: { code, message, retryable: RETRYABLE.has(code), details },
})

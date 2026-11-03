export type DomainErrorCode =
  | "SLOT_UNAVAILABLE"
  | "OUTSIDE_HOURS"
  | "PROVIDER_NOT_QUALIFIED"
  | "UNKNOWN_APPOINTMENT_TYPE"
  | "PATIENT_NOT_FOUND"
  | "PATIENT_ALREADY_EXISTS"
  | "APPOINTMENT_NOT_FOUND"
  | "APPOINTMENT_NOT_EDITABLE"
  | "IDEMPOTENCY_CONFLICT"
  | "INVALID_INPUT";

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly userMessage: string;
  readonly details?: Record<string, unknown>;

  constructor(
    code: DomainErrorCode,
    userMessage: string,
    details?: Record<string, unknown>,
  ) {
    super(userMessage);
    this.name = "DomainError";
    this.code = code;
    this.userMessage = userMessage;
    this.details = details;
  }
}

export function toSafeToolError(error: unknown): {
  ok: false;
  code: DomainErrorCode | "INTERNAL_ERROR";
  message: string;
} {
  if (error instanceof DomainError) {
    return {
      ok: false,
      code: error.code,
      message: error.userMessage,
    };
  }

  return {
    ok: false,
    code: "INTERNAL_ERROR",
    message:
      "Something went wrong on our side. I can connect you with the front desk so nothing gets lost.",
  };
}

export type DomainErrorCode =
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "APPROVAL_EXPIRED"
  | "APPROVAL_CONFLICT"
  | "APPROVAL_INVALID"
  | "CONFLICT"
  | "UPSTREAM_ERROR"
  | "PROVIDER_ERROR"
  | "INTERNAL_ERROR";

const HTTP_STATUS: Record<DomainErrorCode, number> = {
  NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  APPROVAL_EXPIRED: 410,
  APPROVAL_CONFLICT: 409,
  APPROVAL_INVALID: 403,
  CONFLICT: 409,
  UPSTREAM_ERROR: 502,
  PROVIDER_ERROR: 502,
  INTERNAL_ERROR: 500,
};

/** An expected, safe-to-show error. Its message may be returned to API clients. */
export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly httpStatus: number;
  constructor(code: DomainErrorCode, message: string, httpStatus?: number) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.httpStatus = httpStatus ?? HTTP_STATUS[code];
  }
}

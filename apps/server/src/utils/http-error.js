// An error that is a deliberate HTTP answer: the error handler sends it as { error: { code, message, details } }.
export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const notFound = (what, id) => new HttpError(404, 'not_found', `No ${what} with id ${id}`);

export function extendError() {
  return class ExtendedError extends Error {
    /**
     * @param {Error} originalError
     * @param {string} message
     */
    constructor(originalError, message) {
      super(message);
      this.originalError = originalError instanceof Error ? originalError : new Error(originalError);
    }
  };
}
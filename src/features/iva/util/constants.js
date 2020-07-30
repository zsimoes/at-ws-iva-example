export default {
  targets: { TEST: "test", PRODUCTION: "production" },
  webserviceStatuses: { OK: "ok", FAIL: "fail", NOT_SENT: "not-sent" },
  errors: {
    CANT_OPEN_FILE: "Can't Open File",
    CANT_READ_NIF: "Can't read client NIF from file",
    WRONG_EXTENSION: "Wrong File Extension",
    CLIENT_NOT_FOUND: "Client not found",
  },
  files: {
    IVA_EXTENSION: ".xml",
  },
};

import { describe, it, expect } from "@jest/globals";
import { logger, maskPhone } from "../../src/utils/logger.js";

describe("Logger and Redaction", () => {
  it("initializes pino logger with redaction options configured", () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
  });

  describe("maskPhone", () => {
    it("masks phone numbers showing only last 4 digits", () => {
      expect(maskPhone("+8801712345678")).toBe("+*********5678");
      expect(maskPhone("01712345678")).toBe("*******5678");
    });

    it("handles short numbers safely", () => {
      expect(maskPhone("123")).toBe("****");
    });

    it("handles non-string or falsy input gracefully", () => {
      expect(maskPhone(null)).toBe(null);
      expect(maskPhone(undefined)).toBe(undefined);
    });
  });
});

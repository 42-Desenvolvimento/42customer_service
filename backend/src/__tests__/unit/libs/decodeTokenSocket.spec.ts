import { verify } from "jsonwebtoken";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import { logger } from "../../../utils/logger";

jest.mock("jsonwebtoken", () => ({
  verify: jest.fn()
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn()
  }
}));

describe("decodeTokenSocket", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should decode a valid socket token", () => {
    (verify as jest.Mock).mockReturnValue({
      id: 12,
      profile: "admin",
      tenantId: 34,
      username: "agent",
      iat: 1,
      exp: 2
    });

    const result = decodeTokenSocket("valid-token");

    expect(verify).toHaveBeenCalledWith("valid-token", expect.any(String));
    expect(result).toEqual({
      isValid: true,
      data: {
        id: 12,
        profile: "admin",
        tenantId: 34
      }
    });
  });

  it("should reject a missing token without logging an error", () => {
    const result = decodeTokenSocket(undefined as unknown as string);

    expect(verify).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
    expect(result).toEqual({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });
  });

  it("should reject an invalid token and log the verification error", () => {
    const error = new Error("invalid signature");
    (verify as jest.Mock).mockImplementation(() => {
      throw error;
    });

    const result = decodeTokenSocket("invalid-token");

    expect(logger.error).toHaveBeenCalledWith(error);
    expect(result.isValid).toBe(false);
  });
});

export {};

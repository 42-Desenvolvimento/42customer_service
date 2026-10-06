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

  it("should return decoded token data when token is valid", () => {
    (verify as jest.Mock).mockReturnValue({
      id: 42,
      profile: "admin",
      tenantId: 7
    });

    const result = decodeTokenSocket("valid-token");

    expect(result).toEqual({
      isValid: true,
      data: {
        id: 42,
        profile: "admin",
        tenantId: 7
      }
    });
  });

  it("should reject a missing token without logging an error", () => {
    const result = decodeTokenSocket(undefined as unknown as string);

    expect(result).toEqual({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });
    expect(verify).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("should reject an invalid token and log the validation error", () => {
    const tokenError = new Error("jwt malformed");
    (verify as jest.Mock).mockImplementation(() => {
      throw tokenError;
    });

    const result = decodeTokenSocket("invalid-token");

    expect(result.isValid).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(tokenError);
  });
});

import { verify } from "jsonwebtoken";
import { logger } from "../../../utils/logger";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";

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

  it("should return token data when verification succeeds", () => {
    (verify as jest.Mock).mockReturnValue({
      id: "7",
      profile: "admin",
      tenantId: 3,
      iat: 1,
      exp: 2
    });

    const result = decodeTokenSocket("valid-token");

    expect(result).toEqual({
      isValid: true,
      data: {
        id: "7",
        profile: "admin",
        tenantId: 3
      }
    });
    expect(verify).toHaveBeenCalledTimes(1);
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

  it("should log invalid provided tokens", () => {
    const error = new Error("invalid token");
    (verify as jest.Mock).mockImplementation(() => {
      throw error;
    });

    const result = decodeTokenSocket("invalid-token");

    expect(result.isValid).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(error);
  });
});

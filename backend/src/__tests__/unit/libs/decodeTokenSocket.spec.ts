jest.mock("jsonwebtoken", () => ({
  verify: jest.fn()
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn()
  }
}));

import { verify } from "jsonwebtoken";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import { logger } from "../../../utils/logger";

describe("decodeTokenSocket", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return the decoded auth data when the token is valid", () => {
    (verify as jest.Mock).mockReturnValue({
      id: 10,
      username: "support",
      profile: "admin",
      tenantId: 3,
      iat: 1000,
      exp: 2000
    });

    const result = decodeTokenSocket("valid-token");

    expect(result).toEqual({
      isValid: true,
      data: {
        id: 10,
        profile: "admin",
        tenantId: 3
      }
    });
    expect(verify).toHaveBeenCalledTimes(1);
    expect(logger.error).not.toHaveBeenCalled();
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

    expect(result).toEqual({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });
    expect(logger.error).toHaveBeenCalledWith(tokenError);
  });
});

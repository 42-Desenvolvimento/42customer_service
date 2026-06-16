const mockVerify = jest.fn();
const mockLoggerError = jest.fn();

jest.mock("jsonwebtoken", () => ({
  verify: mockVerify
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: mockLoggerError
  }
}));

import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import authConfig from "../../../config/auth";

describe("decodeTokenSocket", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns invalid without verifying or logging when token is missing", () => {
    const result = decodeTokenSocket("");

    expect(result).toEqual({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });
    expect(mockVerify).not.toHaveBeenCalled();
    expect(mockLoggerError).not.toHaveBeenCalled();
  });

  it("logs invalid provided tokens", () => {
    const tokenError = new Error("invalid token");
    mockVerify.mockImplementation(() => {
      throw tokenError;
    });

    const result = decodeTokenSocket("invalid-token");

    expect(result.isValid).toBe(false);
    expect(mockVerify).toHaveBeenCalledWith("invalid-token", authConfig.secret);
    expect(mockLoggerError).toHaveBeenCalledWith(tokenError);
  });

  it("returns decoded socket auth data for a valid token", () => {
    mockVerify.mockReturnValue({
      id: "55",
      profile: "admin",
      tenantId: 8
    });

    const result = decodeTokenSocket("valid-token");

    expect(result).toEqual({
      isValid: true,
      data: {
        id: "55",
        profile: "admin",
        tenantId: 8
      }
    });
    expect(mockVerify).toHaveBeenCalledWith("valid-token", authConfig.secret);
    expect(mockLoggerError).not.toHaveBeenCalled();
  });
});

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

describe("decodeTokenSocket", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns decoded socket auth data for a valid token", () => {
    mockVerify.mockReturnValue({
      id: 15,
      profile: "admin",
      tenantId: 3,
      iat: 100,
      exp: 200
    });

    const result = decodeTokenSocket("valid-token");

    expect(mockVerify).toHaveBeenCalledWith("valid-token", expect.any(String));
    expect(result).toEqual({
      isValid: true,
      data: {
        id: 15,
        profile: "admin",
        tenantId: 3
      }
    });
  });

  it("returns invalid without logging when token is missing", () => {
    const result = decodeTokenSocket(undefined as unknown as string);

    expect(mockVerify).not.toHaveBeenCalled();
    expect(mockLoggerError).not.toHaveBeenCalled();
    expect(result).toEqual({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });
  });

  it("logs and returns invalid when a provided token cannot be verified", () => {
    const error = new Error("invalid token");
    mockVerify.mockImplementation(() => {
      throw error;
    });

    const result = decodeTokenSocket("invalid-token");

    expect(mockVerify).toHaveBeenCalledWith("invalid-token", expect.any(String));
    expect(mockLoggerError).toHaveBeenCalledWith(error);
    expect(result).toEqual({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });
  });
});

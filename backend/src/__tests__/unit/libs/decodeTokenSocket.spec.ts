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
  const verifyMock = verify as jest.Mock;
  const loggerErrorMock = logger.error as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns invalid without logging when token is missing", () => {
    const result = decodeTokenSocket(undefined as unknown as string);

    expect(result).toEqual({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });
    expect(verifyMock).not.toHaveBeenCalled();
    expect(loggerErrorMock).not.toHaveBeenCalled();
  });

  it("returns socket auth data for a valid token", () => {
    verifyMock.mockReturnValue({
      id: 12,
      username: "agent@example.com",
      profile: "admin",
      tenantId: 7,
      iat: 1,
      exp: 2
    });

    const result = decodeTokenSocket("valid.jwt");

    expect(verifyMock).toHaveBeenCalledWith("valid.jwt", expect.any(String));
    expect(result).toEqual({
      isValid: true,
      data: {
        id: 12,
        profile: "admin",
        tenantId: 7
      }
    });
  });

  it("logs invalid provided tokens and returns invalid auth data", () => {
    const error = new Error("invalid signature");
    verifyMock.mockImplementation(() => {
      throw error;
    });

    const result = decodeTokenSocket("bad.jwt");

    expect(loggerErrorMock).toHaveBeenCalledWith(error);
    expect(result.isValid).toBe(false);
    expect(result.data).toEqual({
      id: "",
      profile: "",
      tenantId: 0
    });
  });
});

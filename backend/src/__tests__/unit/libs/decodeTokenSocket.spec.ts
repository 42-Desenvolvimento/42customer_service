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
  const verifyMock = verify as jest.Mock;
  const loggerErrorMock = logger.error as jest.Mock;

  beforeEach(() => {
    verifyMock.mockReset();
    loggerErrorMock.mockReset();
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

  it("returns decoded auth data for a valid token", () => {
    verifyMock.mockReturnValue({
      id: "42",
      username: "agent",
      profile: "admin",
      tenantId: 7,
      iat: 100,
      exp: 200
    });

    const result = decodeTokenSocket("valid-token");

    expect(verifyMock).toHaveBeenCalledWith("valid-token", expect.any(String));
    expect(result).toEqual({
      isValid: true,
      data: {
        id: "42",
        profile: "admin",
        tenantId: 7
      }
    });
  });

  it("logs and returns invalid when token verification fails", () => {
    const error = new Error("invalid signature");
    verifyMock.mockImplementation(() => {
      throw error;
    });

    const result = decodeTokenSocket("invalid-token");

    expect(result.isValid).toBe(false);
    expect(loggerErrorMock).toHaveBeenCalledWith(error);
  });
});

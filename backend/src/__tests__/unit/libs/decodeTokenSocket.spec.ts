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
    jest.clearAllMocks();
  });

  it("returns decoded socket auth data for a valid token", () => {
    verifyMock.mockReturnValue({
      id: 42,
      profile: "admin",
      tenantId: 7,
      iat: 1,
      exp: 2
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
    expect(verifyMock).toHaveBeenCalledWith(
      "valid-token",
      "mad4srsZIISQ0G1MJPoQIeq3PVf25EaR"
    );
    expect(loggerErrorMock).not.toHaveBeenCalled();
  });

  it("does not log an error when the socket token is missing", () => {
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

  it("logs invalid provided tokens and returns invalid auth data", () => {
    const error = new Error("invalid signature");
    verifyMock.mockImplementation(() => {
      throw error;
    });

    const result = decodeTokenSocket("bad-token");

    expect(result).toEqual({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });
    expect(loggerErrorMock).toHaveBeenCalledWith(error);
  });
});

jest.mock("jsonwebtoken", () => ({
  verify: jest.fn()
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn()
  }
}));

import { verify } from "jsonwebtoken";
import authConfig from "../../../config/auth";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import { logger } from "../../../utils/logger";

const verifyMock = verify as jest.Mock;
const loggerErrorMock = logger.error as jest.Mock;

describe("decodeTokenSocket", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should decode a valid socket token", () => {
    verifyMock.mockReturnValue({
      id: "user-1",
      username: "socket.user",
      profile: "admin",
      tenantId: 42,
      iat: 100,
      exp: 200
    });

    const result = decodeTokenSocket("valid-token");

    expect(verifyMock).toHaveBeenCalledWith("valid-token", authConfig.secret);
    expect(result).toEqual({
      isValid: true,
      data: {
        id: "user-1",
        profile: "admin",
        tenantId: 42
      }
    });
    expect(loggerErrorMock).not.toHaveBeenCalled();
  });

  it("should reject missing tokens without logging expected auth noise", () => {
    const result = decodeTokenSocket(undefined as unknown as string);

    expect(verifyMock).not.toHaveBeenCalled();
    expect(loggerErrorMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });
  });

  it("should reject invalid tokens and log the verification error", () => {
    const error = new Error("jwt malformed");
    verifyMock.mockImplementation(() => {
      throw error;
    });

    const result = decodeTokenSocket("invalid-token");

    expect(verifyMock).toHaveBeenCalledWith("invalid-token", authConfig.secret);
    expect(loggerErrorMock).toHaveBeenCalledWith(error);
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

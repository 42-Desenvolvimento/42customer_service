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

const verifyMock = verify as jest.Mock;
const loggerErrorMock = logger.error as jest.Mock;

describe("decodeTokenSocket", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return valid socket auth data for a valid token", () => {
    verifyMock.mockReturnValue({
      id: "42",
      username: "agent",
      profile: "admin",
      tenantId: 7,
      iat: 1,
      exp: 2
    });

    const result = decodeTokenSocket("valid-token");

    expect(verifyMock).toHaveBeenCalledWith(
      "valid-token",
      "mad4srsZIISQ0G1MJPoQIeq3PVf25EaR"
    );
    expect(result).toEqual({
      isValid: true,
      data: {
        id: "42",
        profile: "admin",
        tenantId: 7
      }
    });
    expect(loggerErrorMock).not.toHaveBeenCalled();
  });

  it("should reject a missing token without logging an error", () => {
    const result = decodeTokenSocket(undefined as unknown as string);

    expect(verifyMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });
    expect(loggerErrorMock).not.toHaveBeenCalled();
  });

  it("should reject an invalid token and log the validation error", () => {
    const tokenError = new Error("jwt malformed");
    verifyMock.mockImplementation(() => {
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
    expect(loggerErrorMock).toHaveBeenCalledWith(tokenError);
  });
});

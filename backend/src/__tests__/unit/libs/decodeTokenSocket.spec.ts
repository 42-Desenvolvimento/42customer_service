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
    verifyMock.mockReset();
    loggerErrorMock.mockReset();
  });

  it("returns decoded auth data for a valid token", () => {
    verifyMock.mockReturnValue({
      id: "10",
      profile: "admin",
      tenantId: 42
    });

    const result = decodeTokenSocket("valid-token");

    expect(result).toEqual({
      isValid: true,
      data: {
        id: "10",
        profile: "admin",
        tenantId: 42
      }
    });
    expect(verifyMock).toHaveBeenCalledWith(
      "valid-token",
      "mad4srsZIISQ0G1MJPoQIeq3PVf25EaR"
    );
    expect(loggerErrorMock).not.toHaveBeenCalled();
  });

  it("returns invalid auth without logging when token is missing", () => {
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

  it("logs and returns invalid auth when a provided token cannot be verified", () => {
    const error = new Error("jwt malformed");
    verifyMock.mockImplementation(() => {
      throw error;
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
    expect(loggerErrorMock).toHaveBeenCalledWith(error);
  });
});

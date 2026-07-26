import { verify } from "jsonwebtoken";
import authConfig from "../../../config/auth";
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

const mockedVerify = verify as jest.Mock;
const mockedLoggerError = logger.error as jest.Mock;

describe("decodeTokenSocket", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should decode a valid socket token", () => {
    mockedVerify.mockReturnValue({
      id: "123",
      username: "socket-user",
      profile: "admin",
      tenantId: 42,
      iat: 100,
      exp: 200
    });

    const result = decodeTokenSocket("valid-token");

    expect(mockedVerify).toHaveBeenCalledWith(
      "valid-token",
      authConfig.secret
    );
    expect(result).toEqual({
      isValid: true,
      data: {
        id: "123",
        profile: "admin",
        tenantId: 42
      }
    });
  });

  it("should reject a missing token without logging an error", () => {
    const result = decodeTokenSocket(undefined as unknown as string);

    expect(mockedVerify).not.toHaveBeenCalled();
    expect(mockedLoggerError).not.toHaveBeenCalled();
    expect(result).toEqual({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });
  });

  it("should reject an invalid provided token and log the validation error", () => {
    const error = new Error("invalid token");
    mockedVerify.mockImplementation(() => {
      throw error;
    });

    const result = decodeTokenSocket("invalid-token");

    expect(mockedVerify).toHaveBeenCalledWith(
      "invalid-token",
      authConfig.secret
    );
    expect(mockedLoggerError).toHaveBeenCalledWith(error);
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

export {};

import { verify } from "jsonwebtoken";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import { logger } from "../../../utils/logger";

jest.mock("jsonwebtoken", () => ({
  verify: jest.fn()
}));

jest.mock("../../../config/auth", () => ({
  __esModule: true,
  default: {
    secret: "test-secret"
  }
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

  it("returns decoded user data when token is valid", () => {
    verifyMock.mockReturnValue({
      id: "42",
      username: "agent",
      profile: "admin",
      tenantId: 7,
      iat: 1,
      exp: 2
    });

    const result = decodeTokenSocket("valid-token");

    expect(verifyMock).toHaveBeenCalledWith("valid-token", "test-secret");
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

  it("logs and returns invalid when token verification fails", () => {
    const error = new Error("invalid token");
    verifyMock.mockImplementation(() => {
      throw error;
    });

    const result = decodeTokenSocket("invalid-token");

    expect(result.isValid).toBe(false);
    expect(loggerErrorMock).toHaveBeenCalledWith(error);
  });
});

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

const invalidResult = {
  isValid: false,
  data: {
    id: "",
    profile: "",
    tenantId: 0
  }
};

describe("decodeTokenSocket", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    ["empty string", ""],
    ["undefined", undefined]
  ])("returns invalid without logging when token is %s", (_label, token) => {
    const result = decodeTokenSocket(token as string);

    expect(result).toEqual(invalidResult);
    expect(mockedVerify).not.toHaveBeenCalled();
    expect(mockedLoggerError).not.toHaveBeenCalled();
  });

  it("logs and returns invalid when a provided token cannot be verified", () => {
    const jwtError = new Error("jwt malformed");
    mockedVerify.mockImplementation(() => {
      throw jwtError;
    });

    const result = decodeTokenSocket("invalid-token");

    expect(result).toEqual(invalidResult);
    expect(mockedVerify).toHaveBeenCalledWith(
      "invalid-token",
      authConfig.secret
    );
    expect(mockedLoggerError).toHaveBeenCalledWith(jwtError);
  });

  it("returns socket auth data when token is valid", () => {
    mockedVerify.mockReturnValue({
      id: "user-1",
      username: "agent",
      profile: "admin",
      tenantId: 3,
      iat: 10,
      exp: 20
    });

    const result = decodeTokenSocket("valid-token");

    expect(result).toEqual({
      isValid: true,
      data: {
        id: "user-1",
        profile: "admin",
        tenantId: 3
      }
    });
    expect(mockedVerify).toHaveBeenCalledWith("valid-token", authConfig.secret);
    expect(mockedLoggerError).not.toHaveBeenCalled();
  });
});

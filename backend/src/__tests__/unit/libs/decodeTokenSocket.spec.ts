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

const verifyMock = verify as jest.Mock;
const loggerErrorMock = logger.error as jest.Mock;

describe("decodeTokenSocket", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns an invalid result without logging when token is missing", () => {
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

  it("logs and returns an invalid result when token verification fails", () => {
    const error = new Error("jwt malformed");
    verifyMock.mockImplementation(() => {
      throw error;
    });

    const result = decodeTokenSocket("bad-token");

    expect(result.isValid).toBe(false);
    expect(result.data).toEqual({
      id: "",
      profile: "",
      tenantId: 0
    });
    expect(loggerErrorMock).toHaveBeenCalledWith(error);
  });

  it("returns socket auth data when token verification succeeds", () => {
    verifyMock.mockReturnValue({
      id: "42",
      username: "agent",
      profile: "admin",
      tenantId: 7,
      iat: 1,
      exp: 2
    });

    const result = decodeTokenSocket("valid-token");

    expect(result).toEqual({
      isValid: true,
      data: {
        id: "42",
        profile: "admin",
        tenantId: 7
      }
    });
  });
});

export {};

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

const verifyMock = verify as unknown as jest.Mock;
const loggerErrorMock = logger.error as jest.Mock;

describe("decodeTokenSocket", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return token data when the socket token is valid", () => {
    verifyMock.mockReturnValue({
      id: 42,
      profile: "admin",
      tenantId: 7
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
    expect(verifyMock).toHaveBeenCalledWith("valid-token", expect.any(String));
    expect(loggerErrorMock).not.toHaveBeenCalled();
  });

  it("should reject a missing socket token without logging an error", () => {
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

  it("should reject and log an invalid socket token", () => {
    const error = new Error("invalid token");
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

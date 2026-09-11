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

  it("should decode a valid socket token", () => {
    verifyMock.mockReturnValue({
      id: 123,
      profile: "admin",
      tenantId: 42
    });

    const result = decodeTokenSocket("valid-token");

    expect(result).toEqual({
      isValid: true,
      data: {
        id: 123,
        profile: "admin",
        tenantId: 42
      }
    });
    expect(verifyMock).toHaveBeenCalledWith("valid-token", expect.any(String));
    expect(loggerErrorMock).not.toHaveBeenCalled();
  });

  it("should reject a missing token without logging an error", () => {
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

  it("should reject an invalid token and log the verification error", () => {
    const error = new Error("jwt malformed");
    verifyMock.mockImplementation(() => {
      throw error;
    });

    const result = decodeTokenSocket("invalid-token");

    expect(result.isValid).toBe(false);
    expect(result.data).toEqual({
      id: "",
      profile: "",
      tenantId: 0
    });
    expect(loggerErrorMock).toHaveBeenCalledWith(error);
  });
});

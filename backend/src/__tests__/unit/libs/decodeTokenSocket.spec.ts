import { verify } from "jsonwebtoken";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import { logger } from "../../../utils/logger";
import authConfig from "../../../config/auth";

jest.mock("jsonwebtoken", () => ({
  verify: jest.fn()
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn()
  }
}));

describe("decodeTokenSocket", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns invalid without logging when the token is missing", () => {
    const result = decodeTokenSocket(undefined as unknown as string);

    expect(result).toEqual({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });
    expect(verify).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("logs and returns invalid when a provided token cannot be verified", () => {
    const error = new Error("jwt malformed");
    (verify as jest.Mock).mockImplementation(() => {
      throw error;
    });

    const result = decodeTokenSocket("invalid-token");

    expect(result.isValid).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(error);
  });

  it("returns decoded authentication data for a valid token", () => {
    (verify as jest.Mock).mockReturnValue({
      id: 123,
      profile: "admin",
      tenantId: 45
    });

    const result = decodeTokenSocket("valid-token");

    expect(verify).toHaveBeenCalledWith("valid-token", authConfig.secret);
    expect(result).toEqual({
      isValid: true,
      data: {
        id: 123,
        profile: "admin",
        tenantId: 45
      }
    });
  });
});

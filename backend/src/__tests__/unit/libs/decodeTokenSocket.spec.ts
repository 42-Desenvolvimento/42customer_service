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

describe("decodeTokenSocket", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return token data when jwt verification succeeds", () => {
    (verify as jest.Mock).mockReturnValue({
      id: 123,
      tenantId: 456,
      profile: "admin",
      username: "user",
      iat: 1,
      exp: 2
    });

    expect(decodeTokenSocket("valid-token")).toEqual({
      isValid: true,
      data: {
        id: 123,
        tenantId: 456,
        profile: "admin"
      }
    });
  });

  it("should reject missing tokens without logging an error", () => {
    expect(decodeTokenSocket(undefined as unknown as string)).toEqual({
      isValid: false,
      data: {
        id: "",
        tenantId: 0,
        profile: ""
      }
    });
    expect(verify).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("should log invalid provided tokens", () => {
    const error = new Error("invalid signature");
    (verify as jest.Mock).mockImplementation(() => {
      throw error;
    });

    expect(decodeTokenSocket("invalid-token")).toEqual({
      isValid: false,
      data: {
        id: "",
        tenantId: 0,
        profile: ""
      }
    });
    expect(logger.error).toHaveBeenCalledWith(error);
  });
});

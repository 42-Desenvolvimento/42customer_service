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

  it("returns validated socket auth data from a valid token", () => {
    (verify as jest.Mock).mockReturnValue({
      id: 123,
      profile: "admin",
      tenantId: 456
    });

    expect(decodeTokenSocket("valid-token")).toEqual({
      isValid: true,
      data: {
        id: 123,
        profile: "admin",
        tenantId: 456
      }
    });
  });

  it("returns invalid without logging when the token is missing", () => {
    expect(decodeTokenSocket(undefined as unknown as string)).toEqual({
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

  it("returns invalid and logs when a provided token cannot be verified", () => {
    const error = new Error("jwt malformed");
    (verify as jest.Mock).mockImplementation(() => {
      throw error;
    });

    expect(decodeTokenSocket("invalid-token")).toEqual({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });
    expect(logger.error).toHaveBeenCalledWith(error);
  });
});

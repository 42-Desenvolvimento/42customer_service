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
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns auth data for a valid token", () => {
    (verify as jest.Mock).mockReturnValue({
      id: "12",
      profile: "admin",
      tenantId: 34
    });

    expect(decodeTokenSocket("valid-token")).toEqual({
      isValid: true,
      data: {
        id: "12",
        profile: "admin",
        tenantId: 34
      }
    });
  });

  it("does not log an error when the token is missing", () => {
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

  it("logs provided invalid tokens and returns invalid auth data", () => {
    const error = new Error("jwt malformed");

    (verify as jest.Mock).mockImplementation(() => {
      throw error;
    });

    expect(decodeTokenSocket("bad-token")).toEqual({
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

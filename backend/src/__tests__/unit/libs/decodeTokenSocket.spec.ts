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

  it("should decode a valid socket token", () => {
    (verify as jest.Mock).mockReturnValue({
      id: 10,
      profile: "admin",
      tenantId: 2
    });

    const result = decodeTokenSocket("valid-token");

    expect(result).toEqual({
      isValid: true,
      data: {
        id: 10,
        profile: "admin",
        tenantId: 2
      }
    });
    expect(verify).toHaveBeenCalledWith("valid-token", expect.any(String));
  });

  it("should not log an error when socket token is missing", () => {
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

  it("should log an error when socket token is invalid", () => {
    const error = new Error("invalid signature");
    (verify as jest.Mock).mockImplementation(() => {
      throw error;
    });

    const result = decodeTokenSocket("invalid-token");

    expect(result.isValid).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(error);
  });
});

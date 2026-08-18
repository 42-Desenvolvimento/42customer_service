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

  it("returns decoded auth data when the token is valid", () => {
    (verify as jest.Mock).mockReturnValue({
      id: "7",
      profile: "admin",
      tenantId: 42
    });

    const result = decodeTokenSocket("valid-token");

    expect(result).toEqual({
      isValid: true,
      data: {
        id: "7",
        profile: "admin",
        tenantId: 42
      }
    });
  });

  it("rejects missing tokens without logging an error", () => {
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

  it("logs invalid provided tokens and returns an invalid result", () => {
    const error = new Error("invalid token");
    (verify as jest.Mock).mockImplementation(() => {
      throw error;
    });

    const result = decodeTokenSocket("invalid-token");

    expect(result.isValid).toBe(false);
    expect(result.data).toEqual({
      id: "",
      profile: "",
      tenantId: 0
    });
    expect(logger.error).toHaveBeenCalledWith(error);
  });
});

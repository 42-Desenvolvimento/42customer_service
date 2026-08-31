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
  const mockedVerify = verify as jest.Mock;
  const mockedLogger = logger as jest.Mocked<typeof logger>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return socket auth data when token is valid", () => {
    mockedVerify.mockReturnValue({
      id: "10",
      profile: "admin",
      tenantId: 20
    });

    const result = decodeTokenSocket("valid-token");

    expect(result).toEqual({
      isValid: true,
      data: {
        id: "10",
        profile: "admin",
        tenantId: 20
      }
    });
    expect(mockedVerify).toHaveBeenCalledWith(
      "valid-token",
      "mad4srsZIISQ0G1MJPoQIeq3PVf25EaR"
    );
  });

  it("should return invalid without logging when token is missing", () => {
    const result = decodeTokenSocket(undefined as unknown as string);

    expect(result).toEqual({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });
    expect(mockedVerify).not.toHaveBeenCalled();
    expect(mockedLogger.error).not.toHaveBeenCalled();
  });

  it("should return invalid and log when provided token cannot be decoded", () => {
    const error = new Error("jwt malformed");
    mockedVerify.mockImplementation(() => {
      throw error;
    });

    const result = decodeTokenSocket("invalid-token");

    expect(result.isValid).toBe(false);
    expect(result.data).toEqual({
      id: "",
      profile: "",
      tenantId: 0
    });
    expect(mockedLogger.error).toHaveBeenCalledWith(error);
  });
});

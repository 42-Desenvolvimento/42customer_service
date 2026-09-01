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

const verifyMock = verify as jest.Mock;
const loggerMock = jest.requireMock("../../../utils/logger").logger;

describe("decodeTokenSocket", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns socket auth data when the token is valid", () => {
    verifyMock.mockReturnValue({
      id: "12",
      profile: "admin",
      tenantId: 34
    });

    const result = decodeTokenSocket("valid-token");

    expect(verifyMock).toHaveBeenCalledWith("valid-token", expect.any(String));
    expect(result).toEqual({
      isValid: true,
      data: {
        id: "12",
        profile: "admin",
        tenantId: 34
      }
    });
  });

  it("returns invalid without logging when token is missing", () => {
    const result = decodeTokenSocket(undefined as unknown as string);

    expect(verifyMock).not.toHaveBeenCalled();
    expect(loggerMock.error).not.toHaveBeenCalled();
    expect(result).toEqual({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });
  });

  it("logs and returns invalid when a provided token cannot be verified", () => {
    const error = new Error("jwt malformed");
    verifyMock.mockImplementation(() => {
      throw error;
    });

    const result = decodeTokenSocket("bad-token");

    expect(loggerMock.error).toHaveBeenCalledWith(error);
    expect(result).toEqual({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });
  });
});

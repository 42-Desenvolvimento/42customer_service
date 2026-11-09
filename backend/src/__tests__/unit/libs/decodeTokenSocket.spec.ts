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

const mockedVerify = verify as unknown as jest.Mock;
const mockedLogger = logger as unknown as { error: jest.Mock };

describe("decodeTokenSocket", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("retorna dados autenticados quando o token e valido", () => {
    mockedVerify.mockReturnValue({
      id: 7,
      profile: "admin",
      tenantId: 3,
      iat: 1,
      exp: 2
    });

    const result = decodeTokenSocket("valid-token");

    expect(result).toEqual({
      isValid: true,
      data: {
        id: 7,
        profile: "admin",
        tenantId: 3
      }
    });
    expect(mockedVerify).toHaveBeenCalledWith(
      "valid-token",
      expect.any(String)
    );
    expect(mockedLogger.error).not.toHaveBeenCalled();
  });

  it("rejeita token ausente sem registrar erro", () => {
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

  it("rejeita token invalido e registra o erro original", () => {
    const error = new Error("jwt malformed");
    mockedVerify.mockImplementation(() => {
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
    expect(mockedLogger.error).toHaveBeenCalledWith(error);
  });
});

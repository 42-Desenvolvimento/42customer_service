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
  const verifyMock = verify as jest.Mock;
  const loggerErrorMock = logger.error as jest.Mock;

  beforeEach(() => {
    verifyMock.mockReset();
    loggerErrorMock.mockReset();
  });

  it("deve retornar dados autenticados para um token valido", () => {
    verifyMock.mockReturnValue({
      id: "42",
      username: "agent",
      profile: "admin",
      tenantId: 7,
      iat: 100,
      exp: 200
    });

    const result = decodeTokenSocket("token-valido");

    expect(verifyMock).toHaveBeenCalledWith(
      "token-valido",
      expect.any(String)
    );
    expect(result).toEqual({
      isValid: true,
      data: {
        id: "42",
        profile: "admin",
        tenantId: 7
      }
    });
    expect(loggerErrorMock).not.toHaveBeenCalled();
  });

  it("deve rejeitar token ausente sem registrar erro", () => {
    const result = decodeTokenSocket(undefined as unknown as string);

    expect(verifyMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });
    expect(loggerErrorMock).not.toHaveBeenCalled();
  });

  it("deve registrar erro quando o token informado for invalido", () => {
    const error = new Error("jwt malformed");
    verifyMock.mockImplementation(() => {
      throw error;
    });

    const result = decodeTokenSocket("token-invalido");

    expect(verifyMock).toHaveBeenCalledWith(
      "token-invalido",
      expect.any(String)
    );
    expect(result).toEqual({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });
    expect(loggerErrorMock).toHaveBeenCalledWith(error);
  });
});

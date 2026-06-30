const mockAdapter = jest.fn();
const mockUse = jest.fn();
const mockOn = jest.fn();
const mockIo = {
  adapter: mockAdapter,
  use: mockUse,
  on: mockOn
};
const mockSocketIOServer = jest.fn(() => mockIo);
const mockSocketRedis = jest.fn(() => "redis-adapter");
const mockDecodeTokenSocket = jest.fn();
const mockUserFindByPk = jest.fn();
const mockChatRegister = jest.fn();
const mockLoggerWarn = jest.fn();
const mockLoggerInfo = jest.fn();

jest.mock("socket.io", () => ({
  Server: mockSocketIOServer
}));

jest.mock("socket.io-redis", () => ({
  __esModule: true,
  default: mockSocketRedis
}));

jest.mock("../../../libs/decodeTokenSocket", () => ({
  __esModule: true,
  default: mockDecodeTokenSocket
}));

jest.mock("../../../models/User", () => ({
  __esModule: true,
  default: {
    findByPk: mockUserFindByPk
  }
}));

jest.mock("../../../libs/socketChat/Chat", () => ({
  __esModule: true,
  default: {
    register: mockChatRegister
  }
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    info: mockLoggerInfo,
    warn: mockLoggerWarn
  }
}));

import { initIO } from "../../../libs/socket";

describe("libs/socket", () => {
  const getMiddleware = () => mockUse.mock.calls[0][0];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("autentica token válido uma única vez e mantém dados do usuário no handshake", async () => {
    const user = { id: 7, name: "User" };
    const socket = {
      handshake: {
        auth: {
          token: "valid-token",
          client: "web"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    mockDecodeTokenSocket.mockReturnValue({
      isValid: true,
      data: {
        id: 7,
        tenantId: 42,
        profile: "admin"
      }
    });
    mockUserFindByPk.mockResolvedValue(user);

    initIO({} as any);
    await getMiddleware()(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(mockUserFindByPk).toHaveBeenCalledWith(7, {
      attributes: [
        "id",
        "tenantId",
        "name",
        "email",
        "profile",
        "status",
        "lastLogin",
        "lastOnline"
      ]
    });
    expect(socket.handshake.auth).toEqual({
      token: "valid-token",
      client: "web",
      id: "7",
      tenantId: "42",
      profile: "admin",
      user
    });
  });

  it("rejeita token inválido sem consultar usuário", async () => {
    const socket = {
      handshake: {
        auth: {
          token: "invalid-token"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    mockDecodeTokenSocket.mockReturnValue({
      isValid: false,
      data: {}
    });

    initIO({} as any);
    await getMiddleware()(socket, next);

    expect(mockUserFindByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(new Error("authentication error"));
  });
});

const mockAdapter = jest.fn();
const mockUse = jest.fn();
const mockOn = jest.fn();
const mockSocketServer = {
  adapter: mockAdapter,
  use: mockUse,
  on: mockOn
};
const mockSocketServerConstructor = jest.fn(() => mockSocketServer);
const mockSocketRedis = jest.fn();
const mockDecodeTokenSocket = jest.fn();
const mockUserFindByPk = jest.fn();
const mockChatRegister = jest.fn();
const mockLoggerWarn = jest.fn();
const mockLoggerInfo = jest.fn();

jest.mock("socket.io", () => ({
  Server: mockSocketServerConstructor
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
    warn: mockLoggerWarn,
    info: mockLoggerInfo
  }
}));

import { initIO } from "../../../libs/socket";

describe("libs/socket", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSocketRedis.mockReturnValue("redis-adapter");
  });

  const getAuthMiddleware = () => {
    initIO({} as any);

    expect(mockAdapter).toHaveBeenCalledWith("redis-adapter");
    expect(mockUse).toHaveBeenCalledTimes(1);

    return mockUse.mock.calls[0][0];
  };

  it("deve permitir token válido sem chamar next com erro", async () => {
    const user = {
      id: 8,
      tenantId: 44,
      name: "Maria"
    };
    const socket = {
      id: "socket-1",
      handshake: {
        auth: {
          token: "valid-token",
          existing: "kept"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    mockDecodeTokenSocket.mockReturnValue({
      isValid: true,
      data: {
        id: 8,
        tenantId: 44,
        profile: "admin"
      }
    });
    mockUserFindByPk.mockResolvedValue(user);

    const middleware = getAuthMiddleware();
    await middleware(socket, next);

    expect(mockDecodeTokenSocket).toHaveBeenCalledWith("valid-token");
    expect(mockUserFindByPk).toHaveBeenCalledWith(8, {
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
    expect(socket.handshake.auth).toMatchObject({
      token: "valid-token",
      existing: "kept",
      id: "8",
      tenantId: "44",
      profile: "admin",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("deve rejeitar token inválido uma única vez", async () => {
    const socket = {
      id: "socket-2",
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

    const middleware = getAuthMiddleware();
    await middleware(socket, next);

    expect(mockUserFindByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
  });
});

const mockAdapter = jest.fn();
const mockUse = jest.fn();
const mockOn = jest.fn();
const mockSocketIOServer = jest.fn(() => ({
  adapter: mockAdapter,
  use: mockUse,
  on: mockOn
}));
const mockRedisAdapter = jest.fn(config => ({ type: "redis-adapter", config }));
const mockDecodeTokenSocket = jest.fn();
const mockUserFindByPk = jest.fn();
const mockChatRegister = jest.fn();
const mockLoggerInfo = jest.fn();
const mockLoggerWarn = jest.fn();

jest.mock("socket.io", () => ({
  Server: mockSocketIOServer
}));

jest.mock("socket.io-redis", () => mockRedisAdapter);

jest.mock("../../../libs/decodeTokenSocket", () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockDecodeTokenSocket(...args)
}));

jest.mock("../../../models/User", () => ({
  __esModule: true,
  default: {
    findByPk: (...args: unknown[]) => mockUserFindByPk(...args)
  }
}));

jest.mock("../../../libs/socketChat/Chat", () => ({
  __esModule: true,
  default: {
    register: (...args: unknown[]) => mockChatRegister(...args)
  }
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    info: (...args: unknown[]) => mockLoggerInfo(...args),
    warn: (...args: unknown[]) => mockLoggerWarn(...args)
  }
}));

import { initIO } from "../../../libs/socket";

describe("socket initIO authentication middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("continues exactly once without authentication error for valid tokens", async () => {
    mockDecodeTokenSocket.mockReturnValue({
      isValid: true,
      data: {
        id: 42,
        tenantId: 7,
        profile: "admin"
      }
    });
    const user = { id: 42, name: "Socket User" };
    mockUserFindByPk.mockResolvedValue(user);

    initIO({} as any);
    const middleware = mockUse.mock.calls[0][0];
    const next = jest.fn();
    const socket = {
      id: "socket-1",
      handshake: {
        auth: {
          token: "valid-token",
          client: "web"
        }
      },
      emit: jest.fn()
    };

    await middleware(socket, next);

    expect(mockDecodeTokenSocket).toHaveBeenCalledWith("valid-token");
    expect(mockUserFindByPk).toHaveBeenCalledWith(42, {
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
      client: "web",
      id: "42",
      tenantId: "7",
      profile: "admin",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]).toHaveLength(0);
  });
});

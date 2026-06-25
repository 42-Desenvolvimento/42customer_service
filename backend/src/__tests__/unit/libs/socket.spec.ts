const mockIo = {
  adapter: jest.fn(),
  use: jest.fn(),
  on: jest.fn()
};
const mockSocketIOServer = jest.fn(() => mockIo);
const mockRedisAdapter = jest.fn();
const mockSocketRedis = jest.fn(() => mockRedisAdapter);
const mockDecodeTokenSocket = jest.fn();
const mockFindByPk = jest.fn();
const mockChatRegister = jest.fn();
const mockLoggerInfo = jest.fn();
const mockLoggerWarn = jest.fn();

jest.mock("socket.io", () => ({
  Server: mockSocketIOServer
}));

jest.mock("socket.io-redis", () => mockSocketRedis);

jest.mock("../../../libs/decodeTokenSocket", () => mockDecodeTokenSocket);

jest.mock("../../../models/User", () => ({
  findByPk: mockFindByPk
}));

jest.mock("../../../libs/socketChat/Chat", () => ({
  register: mockChatRegister
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    info: mockLoggerInfo,
    warn: mockLoggerWarn
  }
}));

describe("socket initIO authentication", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIo.adapter.mockClear();
    mockIo.use.mockClear();
    mockIo.on.mockClear();
    mockSocketIOServer.mockImplementation(() => mockIo);
    mockSocketRedis.mockImplementation(() => mockRedisAdapter);
  });

  const loadSocketModule = () => {
    jest.isolateModules(() => {
      // The module keeps Socket.IO state in module scope, so each test loads it fresh.
    });
    return require("../../../libs/socket");
  };

  it("authenticates a valid token without also returning an authentication error", async () => {
    const user = { id: 7, tenantId: 42, name: "Ada" };
    mockDecodeTokenSocket.mockReturnValue({
      isValid: true,
      data: {
        id: 7,
        tenantId: 42,
        profile: "admin"
      }
    });
    mockFindByPk.mockResolvedValue(user);

    const { initIO } = loadSocketModule();

    initIO({} as never);

    const middleware = mockIo.use.mock.calls[0][0];
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

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(socket.emit).not.toHaveBeenCalled();
    expect(mockFindByPk).toHaveBeenCalledWith(7, {
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
      id: "7",
      tenantId: "42",
      profile: "admin",
      user
    });
  });

  it("rejects an invalid token with a single authentication error", async () => {
    mockDecodeTokenSocket.mockReturnValue({
      isValid: false,
      data: {
        id: "",
        tenantId: "",
        profile: ""
      }
    });

    const { initIO } = loadSocketModule();

    initIO({} as never);

    const middleware = mockIo.use.mock.calls[0][0];
    const next = jest.fn();
    const socket = {
      id: "socket-2",
      handshake: {
        auth: {
          token: "invalid-token"
        }
      },
      emit: jest.fn()
    };

    await middleware(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
    expect(mockFindByPk).not.toHaveBeenCalled();
    expect(socket.emit).not.toHaveBeenCalled();
  });
});

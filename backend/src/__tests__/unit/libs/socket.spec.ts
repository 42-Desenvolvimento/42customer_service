const mockAdapter = jest.fn();
const mockUse = jest.fn();
const mockOn = jest.fn();
const mockSocketIoConstructor = jest.fn().mockImplementation(() => ({
  adapter: mockAdapter,
  use: mockUse,
  on: mockOn
}));
const mockSocketRedis = jest.fn(() => "redis-adapter");
const mockDecodeTokenSocket = jest.fn();
const mockFindByPk = jest.fn();
const mockChatRegister = jest.fn();
const mockLoggerWarn = jest.fn();
const mockLoggerInfo = jest.fn();

jest.mock("socket.io", () => ({
  Server: mockSocketIoConstructor
}));

jest.mock("socket.io-redis", () => mockSocketRedis);

jest.mock("../../../libs/decodeTokenSocket", () => ({
  __esModule: true,
  default: mockDecodeTokenSocket
}));

jest.mock("../../../models/User", () => ({
  __esModule: true,
  default: {
    findByPk: mockFindByPk
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

const buildSocket = () =>
  ({
    id: "socket-1",
    handshake: {
      auth: {
        token: "jwt-token",
        client: "web"
      }
    },
    emit: jest.fn(),
    join: jest.fn(),
    on: jest.fn()
  } as any);

const getAuthMiddleware = () => {
  const { initIO } = require("../../../libs/socket");

  initIO({} as any);

  return mockUse.mock.calls[0][0];
};

describe("socket initIO auth middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it("authenticates a valid token and calls next without an authentication error", async () => {
    const user = {
      id: 7,
      tenantId: 42,
      name: "Atendente"
    };
    mockDecodeTokenSocket.mockReturnValue({
      isValid: true,
      data: {
        id: 7,
        tenantId: 42,
        profile: "admin"
      }
    });
    mockFindByPk.mockResolvedValue(user);
    const socket = buildSocket();
    const next = jest.fn();

    await getAuthMiddleware()(socket, next);

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
      token: "jwt-token",
      client: "web",
      id: "7",
      tenantId: "42",
      profile: "admin",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects an invalid token once without loading a user", async () => {
    mockDecodeTokenSocket.mockReturnValue({
      isValid: false,
      data: {}
    });
    const socket = buildSocket();
    const next = jest.fn();

    await getAuthMiddleware()(socket, next);

    expect(mockFindByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(next.mock.calls[0][0].message).toBe("authentication error");
  });
});

const mockAdapter = jest.fn();
let mockAuthMiddleware: ((socket: any, next: any) => Promise<void>) | undefined;

const mockSocketServer = {
  adapter: mockAdapter,
  use: jest.fn((middleware: (socket: any, next: any) => Promise<void>) => {
    mockAuthMiddleware = middleware;
    return mockSocketServer;
  }),
  on: jest.fn(() => mockSocketServer)
};

const mockSocketIOConstructor = jest.fn(() => mockSocketServer);
const mockSocketRedis = jest.fn(() => "redis-adapter");
const mockDecodeTokenSocket = jest.fn();
const mockUserFindByPk = jest.fn();
const mockChatRegister = jest.fn();
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

jest.mock("socket.io", () => ({
  Server: mockSocketIOConstructor
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
  logger: mockLogger
}));

describe("socket initIO authentication", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthMiddleware = undefined;
  });

  it("allows a valid token without also returning an authentication error", async () => {
    const { initIO } = require("../../../libs/socket");
    const user = { id: 10, tenantId: 20, name: "Valid User" };

    mockDecodeTokenSocket.mockReturnValue({
      isValid: true,
      data: {
        id: 10,
        tenantId: 20,
        profile: "admin"
      }
    });
    mockUserFindByPk.mockResolvedValue(user);

    initIO({} as any);

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
    const next = jest.fn();

    await mockAuthMiddleware!(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(socket.handshake.auth).toMatchObject({
      token: "valid-token",
      client: "web",
      id: "10",
      tenantId: "20",
      profile: "admin",
      user
    });
    expect(mockUserFindByPk).toHaveBeenCalledWith(10, {
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
  });
});

export {};

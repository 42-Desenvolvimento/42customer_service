const mockAdapter = jest.fn();
const mockUse = jest.fn();
const mockOn = jest.fn();
const mockRedisAdapter = jest.fn();
const mockSocketIOServer = jest.fn(() => mockIo);
const mockSocketRedis = jest.fn(() => mockRedisAdapter);
const mockDecodeTokenSocket = jest.fn();
const mockUserFindByPk = jest.fn();
const mockChatRegister = jest.fn();
const mockLoggerWarn = jest.fn();
const mockLoggerInfo = jest.fn();

const mockIo = {
  adapter: mockAdapter,
  use: mockUse,
  on: mockOn
};

jest.mock("socket.io", () => ({
  Server: mockSocketIOServer
}));

jest.mock("socket.io-redis", () => mockSocketRedis);

jest.mock("../../../libs/decodeTokenSocket", () => mockDecodeTokenSocket);

jest.mock("../../../models/User", () => ({
  findByPk: mockUserFindByPk
}));

jest.mock("../../../libs/socketChat/Chat", () => ({
  register: mockChatRegister
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    warn: mockLoggerWarn,
    info: mockLoggerInfo
  }
}));

type SocketMiddleware = (
  socket: {
    id: string;
    handshake: { auth: Record<string, unknown> };
    emit: jest.Mock;
  },
  next: jest.Mock
) => Promise<void>;

describe("socket initIO authentication middleware", () => {
  let middleware: SocketMiddleware;

  const loadSocket = () => {
    const socketLib = require("../../../libs/socket");
    socketLib.initIO({} as never);
    middleware = mockUse.mock.calls[0][0];
  };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    mockUse.mockImplementation(handler => {
      middleware = handler;
      return mockIo;
    });
    mockOn.mockReturnValue(mockIo);
    mockAdapter.mockReturnValue(mockIo);
  });

  it("allows a valid token and calls next only once without an authentication error", async () => {
    const user = {
      id: 7,
      tenantId: 42,
      name: "Socket User",
      email: "socket@example.com"
    };
    mockDecodeTokenSocket.mockReturnValue({
      isValid: true,
      data: {
        id: 7,
        profile: "admin",
        tenantId: 42
      }
    });
    mockUserFindByPk.mockResolvedValue(user);

    loadSocket();

    const socket = {
      id: "socket-1",
      handshake: { auth: { token: "valid-token", keep: "value" } },
      emit: jest.fn()
    };
    const next = jest.fn();

    await middleware(socket, next);

    expect(mockDecodeTokenSocket).toHaveBeenCalledWith("valid-token");
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
      keep: "value",
      id: "7",
      profile: "admin",
      tenantId: "42",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects an invalid token without loading the user", async () => {
    mockDecodeTokenSocket.mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });

    loadSocket();

    const socket = {
      id: "socket-2",
      handshake: { auth: { token: "invalid-token" } },
      emit: jest.fn()
    };
    const next = jest.fn();

    await middleware(socket, next);

    expect(mockDecodeTokenSocket).toHaveBeenCalledWith("invalid-token");
    expect(mockUserFindByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
  });

  it("emits tokenInvalid and rejects the socket when authentication throws", async () => {
    const error = new Error("database unavailable");
    mockDecodeTokenSocket.mockReturnValue({
      isValid: true,
      data: {
        id: 9,
        profile: "user",
        tenantId: 24
      }
    });
    mockUserFindByPk.mockRejectedValue(error);

    loadSocket();

    const socket = {
      id: "socket-3",
      handshake: { auth: { token: "valid-token" } },
      emit: jest.fn()
    };
    const next = jest.fn();

    await middleware(socket, next);

    expect(mockLoggerWarn).toHaveBeenCalledWith(`tokenInvalid: ${socket}`);
    expect(socket.emit).toHaveBeenCalledWith("tokenInvalid:socket-3");
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
  });
});

export {};

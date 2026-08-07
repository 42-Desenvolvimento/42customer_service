import { initIO, getIO } from "../../../libs/socket";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import User from "../../../models/User";
import Chat from "../../../libs/socketChat/Chat";

const mockAdapter = jest.fn();
const mockUse = jest.fn();
const mockOn = jest.fn();
const mockSocketIOServer = {
  adapter: mockAdapter,
  use: mockUse,
  on: mockOn
};
const mockSocketIOConstructor = jest.fn(() => mockSocketIOServer);
const mockSocketRedis = jest.fn(() => "redis-adapter");
const mockDecodeTokenSocket = jest.fn();
const mockUserFindByPk = jest.fn();
const mockChatRegister = jest.fn();
const mockLoggerInfo = jest.fn();
const mockLoggerWarn = jest.fn();

jest.mock("socket.io", () => ({
  Server: mockSocketIOConstructor
}));

jest.mock("socket.io-redis", () => mockSocketRedis);

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

describe("socket", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.IO_REDIS_SERVER;
    delete process.env.IO_REDIS_PORT;
    delete process.env.IO_REDIS_USERNAME;
    delete process.env.IO_REDIS_PASSWORD;
  });

  const getMiddleware = () => {
    initIO({} as any);
    return mockUse.mock.calls[0][0];
  };

  it("mantem conexao autenticada e nao chama next com erro", async () => {
    const user = {
      id: 42,
      tenantId: 3,
      name: "Maria"
    };
    mockDecodeTokenSocket.mockReturnValue({
      isValid: true,
      data: {
        id: 42,
        profile: "admin",
        tenantId: 3
      }
    });
    mockUserFindByPk.mockResolvedValue(user);
    const middleware = getMiddleware();
    const next = jest.fn();
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

    await middleware(socket, next);

    expect(decodeTokenSocket).toHaveBeenCalledWith("valid-token");
    expect(User.findByPk).toHaveBeenCalledWith(42, {
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
      existing: "kept",
      id: "42",
      profile: "admin",
      tenantId: "3",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejeita token invalido no middleware de autenticacao", async () => {
    mockDecodeTokenSocket.mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });
    const middleware = getMiddleware();
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
    expect(User.findByPk).not.toHaveBeenCalled();
  });

  it("registra salas do tenant e eventos de chat ao conectar", () => {
    initIO({} as any);
    const connectionHandler = mockOn.mock.calls.find(
      ([eventName]) => eventName === "connection"
    )[1];
    const socket = {
      id: "socket-3",
      handshake: {
        auth: {
          tenantId: "12"
        }
      },
      join: jest.fn(),
      on: jest.fn()
    };

    connectionHandler(socket);

    expect(socket.join).toHaveBeenCalledWith("12");
    expect(socket.on).toHaveBeenCalledWith(
      "12:joinChatBox",
      expect.any(Function)
    );
    expect(socket.on).toHaveBeenCalledWith(
      "12:joinNotification",
      expect.any(Function)
    );
    expect(socket.on).toHaveBeenCalledWith("12:joinTickets", expect.any(Function));
    expect(Chat.register).toHaveBeenCalledWith(socket);
  });

  it("retorna a instancia inicializada do Socket.IO", () => {
    initIO({} as any);

    expect(getIO()).toBe(mockSocketIOServer);
    expect(mockSocketRedis).toHaveBeenCalledWith({
      host: undefined,
      port: NaN,
      username: undefined,
      password: undefined
    });
    expect(mockAdapter).toHaveBeenCalledWith("redis-adapter");
  });
});

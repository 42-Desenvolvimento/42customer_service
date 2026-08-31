import { Server as SocketIOServer } from "socket.io";
import socketRedis from "socket.io-redis";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import User from "../../../models/User";
import Chat from "../../../libs/socketChat/Chat";
import { logger } from "../../../utils/logger";
import { getIO, initIO } from "../../../libs/socket";

jest.mock("socket.io", () => {
  const serverMock = {
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn()
  };

  return {
    Server: jest.fn(() => serverMock),
    __serverMock: serverMock
  };
});

jest.mock("socket.io-redis", () => jest.fn(() => "redis-adapter"));

jest.mock("../../../libs/decodeTokenSocket", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../models/User", () => ({
  __esModule: true,
  default: {
    findByPk: jest.fn()
  }
}));

jest.mock("../../../libs/socketChat/Chat", () => ({
  __esModule: true,
  default: {
    register: jest.fn()
  }
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    warn: jest.fn(),
    info: jest.fn()
  }
}));

describe("socket", () => {
  const mockedDecodeTokenSocket = decodeTokenSocket as jest.Mock;
  const mockedUser = User as unknown as { findByPk: jest.Mock };
  const mockedChat = Chat as unknown as { register: jest.Mock };
  const mockedLogger = logger as jest.Mocked<typeof logger>;
  const serverModule = jest.requireMock("socket.io");
  const serverMock = serverModule.__serverMock;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.IO_REDIS_SERVER;
    delete process.env.IO_REDIS_PORT;
    delete process.env.IO_REDIS_USERNAME;
    delete process.env.IO_REDIS_PASSWORD;
  });

  const getAuthMiddleware = () => {
    initIO({} as any);
    return serverMock.use.mock.calls[0][0];
  };

  it("should initialize socket server with redis adapter", () => {
    process.env.IO_REDIS_SERVER = "redis";
    process.env.IO_REDIS_PORT = "6379";
    process.env.IO_REDIS_USERNAME = "default";
    process.env.IO_REDIS_PASSWORD = "secret";

    const io = initIO({} as any);

    expect(SocketIOServer).toHaveBeenCalledWith(
      {},
      {
        cors: {
          origin: "*"
        },
        pingTimeout: 180000,
        pingInterval: 60000
      }
    );
    expect(socketRedis).toHaveBeenCalledWith({
      host: "redis",
      port: 6379,
      username: "default",
      password: "secret"
    });
    expect(serverMock.adapter).toHaveBeenCalledWith("redis-adapter");
    expect(getIO()).toBe(io);
  });

  it("should authenticate a valid token and call next once", async () => {
    const authUser = {
      id: 10,
      tenantId: 20,
      name: "Agent"
    };
    mockedDecodeTokenSocket.mockReturnValue({
      isValid: true,
      data: {
        id: 10,
        profile: "admin",
        tenantId: 20
      }
    });
    mockedUser.findByPk.mockResolvedValue(authUser);
    const middleware = getAuthMiddleware();
    const socket = {
      id: "socket-id",
      handshake: {
        auth: {
          token: "valid-token",
          previous: "value"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    await middleware(socket, next);

    expect(mockedDecodeTokenSocket).toHaveBeenCalledWith("valid-token");
    expect(mockedUser.findByPk).toHaveBeenCalledWith(10, {
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
      previous: "value",
      id: "10",
      profile: "admin",
      tenantId: "20",
      user: authUser
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("should reject an invalid token without loading the user", async () => {
    mockedDecodeTokenSocket.mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });
    const middleware = getAuthMiddleware();
    const socket = {
      id: "socket-id",
      handshake: {
        auth: {
          token: "invalid-token"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    await middleware(socket, next);

    expect(mockedUser.findByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
  });

  it("should emit tokenInvalid when authentication throws", async () => {
    const authError = new Error("unexpected auth error");
    mockedDecodeTokenSocket.mockImplementation(() => {
      throw authError;
    });
    const middleware = getAuthMiddleware();
    const socket = {
      id: "socket-id",
      handshake: {
        auth: {
          token: "invalid-token"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    await middleware(socket, next);

    expect(mockedLogger.warn).toHaveBeenCalledWith(`tokenInvalid: ${socket}`);
    expect(socket.emit).toHaveBeenCalledWith("tokenInvalid:socket-id");
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
  });

  it("should register tenant scoped ticket rooms on connection", () => {
    initIO({} as any);
    const connectionHandler = serverMock.on.mock.calls.find(
      ([eventName]: [string]) => eventName === "connection"
    )[1];
    const socket = {
      handshake: {
        auth: {
          tenantId: "20"
        }
      },
      join: jest.fn(),
      on: jest.fn()
    };

    connectionHandler(socket);

    expect(socket.join).toHaveBeenCalledWith("20");
    expect(socket.on).toHaveBeenCalledWith(
      "20:joinChatBox",
      expect.any(Function)
    );
    expect(socket.on).toHaveBeenCalledWith(
      "20:joinNotification",
      expect.any(Function)
    );
    expect(socket.on).toHaveBeenCalledWith(
      "20:joinTickets",
      expect.any(Function)
    );
    expect(mockedChat.register).toHaveBeenCalledWith(socket);
  });
});

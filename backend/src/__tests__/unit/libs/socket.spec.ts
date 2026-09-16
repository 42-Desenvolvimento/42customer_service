import { Server as SocketIOServer } from "socket.io";
import socketRedis from "socket.io-redis";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import { initIO } from "../../../libs/socket";
import Chat from "../../../libs/socketChat/Chat";
import User from "../../../models/User";
import { logger } from "../../../utils/logger";

jest.mock("socket.io", () => ({
  Server: jest.fn().mockImplementation(() => ({
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn()
  }))
}));

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
    info: jest.fn(),
    warn: jest.fn()
  }
}));

describe("socket", () => {
  const socketIOServerMock = SocketIOServer as unknown as jest.Mock;
  const socketRedisMock = socketRedis as unknown as jest.Mock;
  const decodeTokenSocketMock = decodeTokenSocket as jest.Mock;
  const userFindByPkMock = User.findByPk as jest.Mock;
  const chatRegisterMock = Chat.register as jest.Mock;
  const loggerWarnMock = logger.warn as jest.Mock;

  const initSocket = () => {
    initIO({} as any);
    return socketIOServerMock.mock.results[0].value;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.IO_REDIS_SERVER = "redis";
    process.env.IO_REDIS_PORT = "6379";
    process.env.IO_REDIS_USERNAME = "default";
    process.env.IO_REDIS_PASSWORD = "secret";
  });

  it("configures redis adapter and accepts authenticated sockets", async () => {
    const user = { id: 5, tenantId: 9, name: "Agent" };
    decodeTokenSocketMock.mockReturnValue({
      isValid: true,
      data: {
        id: 5,
        profile: "admin",
        tenantId: 9
      }
    });
    userFindByPkMock.mockResolvedValue(user);

    const io = initSocket();
    const middleware = io.use.mock.calls[0][0];
    const socket = {
      handshake: {
        auth: {
          token: "valid.jwt",
          client: "web"
        }
      },
      emit: jest.fn(),
      id: "socket-1"
    };
    const next = jest.fn();

    await middleware(socket, next);

    expect(socketIOServerMock).toHaveBeenCalledWith(
      {},
      {
        cors: {
          origin: "*"
        },
        pingTimeout: 180000,
        pingInterval: 60000
      }
    );
    expect(socketRedisMock).toHaveBeenCalledWith({
      host: "redis",
      port: 6379,
      username: "default",
      password: "secret"
    });
    expect(io.adapter).toHaveBeenCalledWith("redis-adapter");
    expect(userFindByPkMock).toHaveBeenCalledWith(5, {
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
      token: "valid.jwt",
      client: "web",
      id: "5",
      profile: "admin",
      tenantId: "9",
      user
    });
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects sockets with invalid tokens", async () => {
    decodeTokenSocketMock.mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });

    const io = initSocket();
    const middleware = io.use.mock.calls[0][0];
    const next = jest.fn();

    await middleware(
      {
        handshake: {
          auth: {
            token: "bad.jwt"
          }
        },
        emit: jest.fn(),
        id: "socket-1"
      },
      next
    );

    expect(userFindByPkMock).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(new Error("authentication error"));
  });

  it("emits tokenInvalid and rejects when token decoding throws", async () => {
    decodeTokenSocketMock.mockImplementation(() => {
      throw new Error("decode failed");
    });

    const io = initSocket();
    const middleware = io.use.mock.calls[0][0];
    const socket = {
      handshake: {
        auth: {
          token: "bad.jwt"
        }
      },
      emit: jest.fn(),
      id: "socket-1"
    };
    const next = jest.fn();

    await middleware(socket, next);

    expect(loggerWarnMock).toHaveBeenCalledWith(`tokenInvalid: ${socket}`);
    expect(socket.emit).toHaveBeenCalledWith("tokenInvalid:socket-1");
    expect(next).toHaveBeenCalledWith(new Error("authentication error"));
  });

  it("joins tenant rooms and registers chat handlers on connection", () => {
    const io = initSocket();
    const connectionHandler = io.on.mock.calls.find(
      ([event]: [string]) => event === "connection"
    )[1];
    const socket = {
      handshake: {
        auth: {
          tenantId: "9"
        }
      },
      join: jest.fn(),
      on: jest.fn()
    };

    connectionHandler(socket);

    expect(socket.join).toHaveBeenCalledWith("9");
    expect(socket.on).toHaveBeenCalledWith("9:joinChatBox", expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith(
      "9:joinNotification",
      expect.any(Function)
    );
    expect(socket.on).toHaveBeenCalledWith("9:joinTickets", expect.any(Function));
    expect(chatRegisterMock).toHaveBeenCalledWith(socket);
    expect(socket.on).toHaveBeenCalledWith("disconnect", expect.any(Function));
  });
});

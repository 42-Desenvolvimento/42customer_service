import { Server as SocketIOServer } from "socket.io";
import socketRedis from "socket.io-redis";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import Chat from "../../../libs/socketChat/Chat";
import User from "../../../models/User";
import { initIO } from "../../../libs/socket";

jest.mock("socket.io", () => {
  const Server = jest.fn().mockImplementation(() => ({
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn()
  }));

  return { Server };
});

jest.mock("socket.io-redis", () => jest.fn(() => "redis-adapter"));

jest.mock("../../../libs/decodeTokenSocket", () => jest.fn());

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
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

type SocketIOMock = {
  adapter: jest.Mock;
  on: jest.Mock;
  use: jest.Mock;
};

const getSocketIoInstance = (): SocketIOMock => {
  const mockedServer = SocketIOServer as unknown as jest.Mock;
  return mockedServer.mock.results[
    mockedServer.mock.results.length - 1
  ].value as SocketIOMock;
};

describe("socket initIO auth middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.IO_REDIS_SERVER = "redis";
    process.env.IO_REDIS_PORT = "6379";
    process.env.IO_REDIS_USERNAME = "default";
    process.env.IO_REDIS_PASSWORD = "test-password";
  });

  it("should accept a valid token and call next only once without an error", async () => {
    const user = { id: 7, tenantId: 42, name: "Agent" };
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 7,
        profile: "admin",
        tenantId: 42
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue(user);

    initIO({} as any);

    const io = getSocketIoInstance();
    const middleware = io.use.mock.calls[0][0];
    const next = jest.fn();
    const socket = {
      handshake: {
        auth: {
          keep: "original",
          token: "valid-token"
        }
      },
      id: "socket-1",
      emit: jest.fn()
    };

    await middleware(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(socket.handshake.auth).toMatchObject({
      keep: "original",
      id: "7",
      profile: "admin",
      tenantId: "42",
      token: "valid-token",
      user
    });
    expect(User.findByPk).toHaveBeenCalledWith(7, {
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

  it("should reject invalid tokens without loading user data", async () => {
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });

    initIO({} as any);

    const io = getSocketIoInstance();
    const middleware = io.use.mock.calls[0][0];
    const next = jest.fn();
    const socket = {
      handshake: {
        auth: {
          token: "invalid-token"
        }
      },
      id: "socket-2",
      emit: jest.fn()
    };

    await middleware(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
    expect(User.findByPk).not.toHaveBeenCalled();
  });

  it("should wire redis adapter and connection handler during initialization", () => {
    initIO({} as any);

    const io = getSocketIoInstance();

    expect(socketRedis).toHaveBeenCalledWith({
      host: "redis",
      port: 6379,
      username: "default",
      password: "test-password"
    });
    expect(io.adapter).toHaveBeenCalledWith("redis-adapter");
    expect(io.on).toHaveBeenCalledWith("connection", expect.any(Function));
    expect(Chat.register).not.toHaveBeenCalled();
  });
});

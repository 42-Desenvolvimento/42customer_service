jest.mock("socket.io", () => ({
  Server: jest.fn().mockImplementation(() => ({
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn()
  }))
}));
jest.mock("socket.io-redis", () => jest.fn(() => "redis-adapter"));
jest.mock("../../../libs/decodeTokenSocket", () => jest.fn());
jest.mock("../../../models/User", () => ({
  findByPk: jest.fn()
}));
jest.mock("../../../libs/socketChat/Chat", () => ({
  register: jest.fn()
}));
jest.mock("../../../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn()
  }
}));

import { Server as SocketIOServer } from "socket.io";
import socketRedis from "socket.io-redis";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import User from "../../../models/User";
import { initIO } from "../../../libs/socket";

describe("socket initIO authentication middleware", () => {
  const redisEnv = {
    IO_REDIS_SERVER: "redis.local",
    IO_REDIS_PORT: "6380",
    IO_REDIS_USERNAME: "socket-user",
    IO_REDIS_PASSWORD: "socket-pass"
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.IO_REDIS_SERVER = redisEnv.IO_REDIS_SERVER;
    process.env.IO_REDIS_PORT = redisEnv.IO_REDIS_PORT;
    process.env.IO_REDIS_USERNAME = redisEnv.IO_REDIS_USERNAME;
    process.env.IO_REDIS_PASSWORD = redisEnv.IO_REDIS_PASSWORD;
  });

  const getSocketServer = () =>
    (SocketIOServer as unknown as jest.Mock).mock.results[0].value;

  const getMiddleware = () => {
    initIO({} as any);
    const io = getSocketServer();
    return {
      io,
      middleware: io.use.mock.calls[0][0]
    };
  };

  it("accepts a valid token, attaches user auth data and calls next once without an error", async () => {
    const user = {
      id: 42,
      tenantId: 7,
      name: "Socket User"
    };
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 42,
        tenantId: 7,
        profile: "admin"
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue(user);

    const { io, middleware } = getMiddleware();
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

    await middleware(socket, next);

    expect(socketRedis).toHaveBeenCalledWith({
      host: redisEnv.IO_REDIS_SERVER,
      port: Number(redisEnv.IO_REDIS_PORT),
      username: redisEnv.IO_REDIS_USERNAME,
      password: redisEnv.IO_REDIS_PASSWORD
    });
    expect(io.adapter).toHaveBeenCalledWith("redis-adapter");
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
      tenantId: "7",
      profile: "admin",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]).toEqual([]);
  });

  it("rejects an invalid token with a single authentication error", async () => {
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: {
        id: "",
        tenantId: "",
        profile: ""
      }
    });

    const { middleware } = getMiddleware();
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

    await middleware(socket, next);

    expect(User.findByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    const [error] = next.mock.calls[0];
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("authentication error");
    expect(socket.emit).not.toHaveBeenCalled();
  });
});

export {};

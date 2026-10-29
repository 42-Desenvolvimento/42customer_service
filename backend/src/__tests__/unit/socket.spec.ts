jest.mock("socket.io", () => ({
  Server: jest.fn().mockImplementation(() => ({
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn()
  }))
}));

jest.mock("socket.io-redis", () => jest.fn(() => "redis-adapter"));

jest.mock("../../libs/decodeTokenSocket", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../models/User", () => ({
  __esModule: true,
  default: {
    findByPk: jest.fn()
  }
}));

jest.mock("../../libs/socketChat/Chat", () => ({
  __esModule: true,
  default: {
    register: jest.fn()
  }
}));

jest.mock("../../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn()
  }
}));

import { Server as SocketServer } from "socket.io";
import socketRedis from "socket.io-redis";
import decodeTokenSocket from "../../libs/decodeTokenSocket";
import User from "../../models/User";
import { initIO } from "../../libs/socket";

const getAuthMiddleware = () => {
  initIO({} as any);
  const io = (SocketServer as unknown as jest.Mock).mock.results[0].value;

  return io.use.mock.calls[0][0];
};

describe("initIO socket authentication", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("authenticates a socket with a valid token without also returning an auth error", async () => {
    const user = { id: 7, tenantId: 11, name: "Support" };
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 7,
        profile: "admin",
        tenantId: 11
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue(user);

    const middleware = getAuthMiddleware();
    const socket = {
      handshake: {
        auth: {
          token: "valid-token",
          anotherValue: "preserved"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    await middleware(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(socket.handshake.auth).toMatchObject({
      token: "valid-token",
      anotherValue: "preserved",
      id: "7",
      tenantId: "11",
      profile: "admin",
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

  it("rejects a socket when token decoding returns invalid", async () => {
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });

    const middleware = getAuthMiddleware();
    const socket = {
      handshake: {
        auth: {
          token: "invalid-token"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    await middleware(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
    expect(User.findByPk).not.toHaveBeenCalled();
  });

  it("configures the Redis adapter when initializing the socket server", () => {
    process.env.IO_REDIS_SERVER = "redis-host";
    process.env.IO_REDIS_PORT = "6379";
    process.env.IO_REDIS_USERNAME = "redis-user";
    process.env.IO_REDIS_PASSWORD = "redis-pass";

    initIO({} as any);
    const io = (SocketServer as unknown as jest.Mock).mock.results[0].value;

    expect(socketRedis).toHaveBeenCalledWith({
      host: "redis-host",
      port: 6379,
      username: "redis-user",
      password: "redis-pass"
    });
    expect(io.adapter).toHaveBeenCalledWith("redis-adapter");
  });
});

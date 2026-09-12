jest.mock("socket.io", () => {
  const serverInstance = {
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn()
  };

  return {
    Server: jest.fn(() => serverInstance),
    __serverInstance: serverInstance
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
    info: jest.fn(),
    warn: jest.fn()
  }
}));

import socketRedis from "socket.io-redis";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import User from "../../../models/User";
import { initIO } from "../../../libs/socket";

describe("socket initIO", () => {
  const socketIoMock = jest.requireMock("socket.io");
  const serverInstance = socketIoMock.__serverInstance;

  beforeEach(() => {
    process.env.IO_REDIS_SERVER = "redis.local";
    process.env.IO_REDIS_PORT = "6380";
    process.env.IO_REDIS_USERNAME = "redis-user";
    process.env.IO_REDIS_PASSWORD = "redis-password";
  });

  it("configures the redis adapter with the socket redis environment", () => {
    initIO({} as any);

    expect(socketRedis).toHaveBeenCalledWith({
      host: "redis.local",
      port: 6380,
      username: "redis-user",
      password: "redis-password"
    });
    expect(serverInstance.adapter).toHaveBeenCalledWith("redis-adapter");
  });

  it("authenticates a valid token and calls next once without an error", async () => {
    const user = { id: 12, tenantId: 34, name: "User" };
    const socket = {
      handshake: {
        auth: {
          token: "valid-token",
          existing: "value"
        }
      }
    };
    const next = jest.fn();

    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 12,
        tenantId: 34,
        profile: "admin"
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue(user);

    initIO({} as any);
    const middleware = serverInstance.use.mock.calls[0][0];

    await middleware(socket, next);

    expect(User.findByPk).toHaveBeenCalledWith(12, {
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
      existing: "value",
      id: "12",
      tenantId: "34",
      profile: "admin",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects an invalid token with a single authentication error", async () => {
    const socket = {
      handshake: {
        auth: {
          token: "invalid-token"
        }
      }
    };
    const next = jest.fn();

    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: {
        id: "",
        tenantId: 0,
        profile: ""
      }
    });

    initIO({} as any);
    const middleware = serverInstance.use.mock.calls[0][0];

    await middleware(socket, next);

    expect(User.findByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
  });
});

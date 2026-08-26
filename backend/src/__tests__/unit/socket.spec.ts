jest.mock("socket.io", () => ({
  Server: jest.fn().mockImplementation(() => ({
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn()
  }))
}));

jest.mock("socket.io-redis", () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue("redis-adapter")
}));

jest.mock("../../libs/decodeTokenSocket", () => jest.fn());

jest.mock("../../models/User", () => ({
  findByPk: jest.fn()
}));

jest.mock("../../libs/socketChat/Chat", () => ({
  register: jest.fn()
}));

jest.mock("../../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn()
  }
}));

import { Server as SocketIOServer } from "socket.io";
import socketRedis from "socket.io-redis";
import decodeTokenSocket from "../../libs/decodeTokenSocket";
import User from "../../models/User";
import { initIO } from "../../libs/socket";

describe("socket initIO authentication middleware", () => {
  const getSocketInstance = () => (SocketIOServer as unknown as jest.Mock).mock.results[0].value;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.IO_REDIS_SERVER = "redis";
    process.env.IO_REDIS_PORT = "6379";
    process.env.IO_REDIS_USERNAME = "default";
    process.env.IO_REDIS_PASSWORD = "secret";
  });

  it("authenticates a valid token and calls next only once without an authentication error", async () => {
    const user = { id: 123, tenantId: 456, name: "User" };
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 123,
        profile: "admin",
        tenantId: 456
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue(user);

    initIO({} as any);

    const socketInstance = getSocketInstance();
    const middleware = socketInstance.use.mock.calls[0][0];
    const next = jest.fn();
    const socket = {
      id: "socket-1",
      handshake: {
        auth: {
          token: "valid-token",
          keep: "this-value"
        }
      },
      emit: jest.fn()
    };

    await middleware(socket, next);

    expect(socketRedis).toHaveBeenCalledWith({
      host: "redis",
      port: 6379,
      username: "default",
      password: "secret"
    });
    expect(User.findByPk).toHaveBeenCalledWith(123, {
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
      keep: "this-value",
      id: "123",
      profile: "admin",
      tenantId: "456",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects invalid tokens with an authentication error", async () => {
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });

    initIO({} as any);

    const middleware = getSocketInstance().use.mock.calls[0][0];
    const next = jest.fn();

    await middleware(
      {
        id: "socket-2",
        handshake: {
          auth: {
            token: "invalid-token"
          }
        },
        emit: jest.fn()
      },
      next
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
  });
});

export {};

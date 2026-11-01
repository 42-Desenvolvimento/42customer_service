import socketRedis from "socket.io-redis";
import { Server as SocketIOServer } from "socket.io";
import User from "../../models/User";
import decodeTokenSocket from "../../libs/decodeTokenSocket";
import { initIO } from "../../libs/socket";

jest.mock("socket.io", () => ({
  Server: jest.fn(() => ({
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn()
  }))
}));

jest.mock("socket.io-redis", () => jest.fn(() => "redis-adapter"));

jest.mock("../../libs/decodeTokenSocket", () => jest.fn());

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

describe("socket initIO authentication", () => {
  const getServerInstance = () =>
    (SocketIOServer as unknown as jest.Mock).mock.results[0].value;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.IO_REDIS_SERVER = "localhost";
    process.env.IO_REDIS_PORT = "6379";
    process.env.IO_REDIS_USERNAME = "redis-user";
    process.env.IO_REDIS_PASSWORD = "redis-pass";
  });

  it("accepts a valid token once and enriches socket auth with user context", async () => {
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 123,
        profile: "admin",
        tenantId: 456
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue({ id: 123 });

    initIO({} as any);
    const serverInstance = getServerInstance();
    const middleware = serverInstance.use.mock.calls[0][0];
    const socket = {
      id: "socket-1",
      handshake: {
        auth: {
          token: "valid-token",
          keep: "value"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    await middleware(socket, next);

    expect(socketRedis).toHaveBeenCalledWith({
      host: "localhost",
      port: 6379,
      username: "redis-user",
      password: "redis-pass"
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
    expect(socket.handshake.auth).toMatchObject({
      token: "valid-token",
      keep: "value",
      id: "123",
      tenantId: "456",
      profile: "admin",
      user: { id: 123 }
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
    const serverInstance = getServerInstance();
    const middleware = serverInstance.use.mock.calls[0][0];
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

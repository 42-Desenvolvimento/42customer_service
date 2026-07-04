import { Server as SocketIOServer } from "socket.io";
import socketRedis from "socket.io-redis";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import { initIO } from "../../../libs/socket";
import User from "../../../models/User";

const mockAdapter = jest.fn();
const mockUse = jest.fn();
const mockOn = jest.fn();

jest.mock("socket.io", () => ({
  Server: jest.fn().mockImplementation(() => ({
    adapter: mockAdapter,
    use: mockUse,
    on: mockOn
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

describe("socket initIO authentication", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.IO_REDIS_SERVER = "redis";
    process.env.IO_REDIS_PORT = "6379";
    process.env.IO_REDIS_USERNAME = "user";
    process.env.IO_REDIS_PASSWORD = "password";
  });

  it("should accept a valid token once and enrich socket auth with string ids and user data", async () => {
    const user = {
      id: 123,
      tenantId: 456,
      name: "Agent"
    };

    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 123,
        tenantId: 456,
        profile: "admin"
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue(user);

    initIO({} as any);

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
      username: "user",
      password: "password"
    });
    expect(mockAdapter).toHaveBeenCalledWith("redis-adapter");

    const middleware = mockUse.mock.calls[0][0];
    const socket = {
      id: "socket-id",
      handshake: {
        auth: {
          token: "valid-token",
          keep: "original"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    await middleware(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]).toEqual([]);
    expect(socket.handshake.auth).toMatchObject({
      token: "valid-token",
      keep: "original",
      profile: "admin",
      id: "123",
      tenantId: "456",
      user
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
  });

  it("should reject an invalid token with an authentication error", async () => {
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: {}
    });

    initIO({} as any);

    const middleware = mockUse.mock.calls[0][0];
    const next = jest.fn();

    await middleware(
      {
        id: "socket-id",
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
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toBe("authentication error");
    expect(User.findByPk).not.toHaveBeenCalled();
  });
});

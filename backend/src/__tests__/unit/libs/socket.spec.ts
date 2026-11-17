import { Server as SocketIOServer } from "socket.io";
import socketRedis from "socket.io-redis";
import User from "../../../models/User";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import { initIO } from "../../../libs/socket";

jest.mock("socket.io", () => ({
  Server: jest.fn().mockImplementation(() => ({
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn(),
    to: jest.fn()
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

describe("socket", () => {
  const socketServerMock = SocketIOServer as unknown as jest.Mock;
  const socketRedisMock = socketRedis as unknown as jest.Mock;
  const decodeTokenSocketMock = decodeTokenSocket as jest.Mock;
  const userModel = User as unknown as { findByPk: jest.Mock };
  const originalRedisEnv = {
    IO_REDIS_SERVER: process.env.IO_REDIS_SERVER,
    IO_REDIS_PORT: process.env.IO_REDIS_PORT,
    IO_REDIS_USERNAME: process.env.IO_REDIS_USERNAME,
    IO_REDIS_PASSWORD: process.env.IO_REDIS_PASSWORD
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env.IO_REDIS_SERVER = originalRedisEnv.IO_REDIS_SERVER;
    process.env.IO_REDIS_PORT = originalRedisEnv.IO_REDIS_PORT;
    process.env.IO_REDIS_USERNAME = originalRedisEnv.IO_REDIS_USERNAME;
    process.env.IO_REDIS_PASSWORD = originalRedisEnv.IO_REDIS_PASSWORD;
  });

  const initSocketAndGetAuthMiddleware = () => {
    initIO({} as any);
    const socketInstance = socketServerMock.mock.results[0].value;

    return {
      socketInstance,
      middleware: socketInstance.use.mock.calls[0][0]
    };
  };

  it("autentica token valido, normaliza ids como string e chama next sem erro", async () => {
    const user = { id: 123, tenantId: 456, name: "User" };
    const { middleware } = initSocketAndGetAuthMiddleware();
    const socket = {
      id: "socket-1",
      handshake: {
        auth: {
          token: "valid-token",
          client: "web"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    decodeTokenSocketMock.mockReturnValue({
      isValid: true,
      data: {
        id: 123,
        profile: "admin",
        tenantId: 456
      }
    });
    userModel.findByPk.mockResolvedValue(user);

    await middleware(socket, next);

    expect(userModel.findByPk).toHaveBeenCalledWith(123, {
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
      client: "web",
      id: "123",
      profile: "admin",
      tenantId: "456",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it("rejeita token invalido sem buscar usuario", async () => {
    const { middleware } = initSocketAndGetAuthMiddleware();
    const socket = {
      id: "socket-1",
      handshake: {
        auth: {
          token: "invalid-token"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    decodeTokenSocketMock.mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });

    await middleware(socket, next);

    expect(userModel.findByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(next.mock.calls[0][0].message).toBe("authentication error");
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it("configura adapter Redis a partir das variaveis de ambiente", () => {
    process.env.IO_REDIS_SERVER = "redis";
    process.env.IO_REDIS_PORT = "6379";
    process.env.IO_REDIS_USERNAME = "default";
    process.env.IO_REDIS_PASSWORD = "redis-password";

    const { socketInstance } = initSocketAndGetAuthMiddleware();

    expect(socketRedisMock).toHaveBeenCalledWith({
      host: "redis",
      port: 6379,
      username: "default",
      password: "redis-password"
    });
    expect(socketInstance.adapter).toHaveBeenCalledWith("redis-adapter");
  });
});

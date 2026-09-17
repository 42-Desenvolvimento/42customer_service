import { Server as SocketServer } from "socket.io";
import socketRedis from "socket.io-redis";
import User from "../../../models/User";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import { initIO } from "../../../libs/socket";

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

const getAuthMiddleware = () => {
  initIO({} as any);
  const socketServerMock = SocketServer as unknown as jest.Mock;
  const io = socketServerMock.mock.results[0].value;

  return io.use.mock.calls[0][0];
};

describe("socket initIO authentication middleware", () => {
  beforeEach(() => {
    process.env.IO_REDIS_PORT = "6379";
  });

  it("should accept a valid token without also returning an authentication error", async () => {
    const user = {
      id: 42,
      tenantId: 7,
      name: "User"
    };
    const socket = {
      id: "socket-1",
      handshake: {
        auth: {
          token: "valid-token",
          existing: "value"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();
    const middleware = getAuthMiddleware();

    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 42,
        profile: "admin",
        tenantId: 7
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue(user);

    await middleware(socket, next);

    expect(socketRedis).toHaveBeenCalledWith({
      host: process.env.IO_REDIS_SERVER,
      port: 6379,
      username: process.env.IO_REDIS_USERNAME,
      password: process.env.IO_REDIS_PASSWORD
    });
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
    expect(socket.handshake.auth).toMatchObject({
      token: "valid-token",
      existing: "value",
      id: "42",
      tenantId: "7",
      profile: "admin",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("should reject an invalid token once", async () => {
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
    const middleware = getAuthMiddleware();

    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });

    await middleware(socket, next);

    expect(User.findByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(next.mock.calls[0][0].message).toBe("authentication error");
  });
});

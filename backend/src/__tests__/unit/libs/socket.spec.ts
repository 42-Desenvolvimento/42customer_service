import { Server as SocketIOServer } from "socket.io";
import socketRedis from "socket.io-redis";
import User from "../../../models/User";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import { initIO } from "../../../libs/socket";

jest.mock("socket.io", () => ({
  Server: jest.fn()
}));

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
    info: jest.fn(),
    warn: jest.fn()
  }
}));

describe("socket", () => {
  let authMiddleware!: (socket: any, next: jest.Mock) => Promise<void>;
  let ioMock: {
    adapter: jest.Mock;
    use: jest.Mock;
    on: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    ioMock = {
      adapter: jest.fn(),
      use: jest.fn(fn => {
        authMiddleware = fn;
        return ioMock;
      }),
      on: jest.fn()
    };

    (SocketIOServer as unknown as jest.Mock).mockImplementation(() => ioMock);
  });

  it("should initialize socket.io with the redis adapter", () => {
    const httpServer = {} as any;

    const io = initIO(httpServer);

    expect(SocketIOServer).toHaveBeenCalledWith(httpServer, {
      cors: {
        origin: "*"
      },
      pingTimeout: 180000,
      pingInterval: 60000
    });
    expect(socketRedis).toHaveBeenCalledWith({
      host: process.env.IO_REDIS_SERVER,
      port: Number(process.env.IO_REDIS_PORT),
      username: process.env.IO_REDIS_USERNAME,
      password: process.env.IO_REDIS_PASSWORD
    });
    expect(io.adapter).toHaveBeenCalledWith("redis-adapter");
    expect(io).toBe(ioMock);
  });

  it("should attach auth data and call next once for a valid token", async () => {
    const user = { id: 42, tenantId: 7, name: "Agent" };
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 42,
        profile: "admin",
        tenantId: 7
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue(user);
    initIO({} as any);

    const socket = {
      handshake: {
        auth: {
          token: "valid-token",
          client: "web"
        }
      }
    };
    const next = jest.fn();

    await authMiddleware(socket, next);

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
      client: "web",
      id: "42",
      tenantId: "7",
      profile: "admin",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("should reject invalid tokens without loading the user", async () => {
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });
    initIO({} as any);

    const socket = {
      handshake: {
        auth: {
          token: "invalid-token"
        }
      }
    };
    const next = jest.fn();

    await authMiddleware(socket, next);

    expect(User.findByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toMatchObject({
      message: "authentication error"
    });
  });
});

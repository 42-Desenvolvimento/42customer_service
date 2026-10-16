import { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import socketRedis from "socket.io-redis";
import User from "../../models/User";
import decodeTokenSocket from "../../libs/decodeTokenSocket";
import { initIO } from "../../libs/socket";

jest.mock("socket.io", () => {
  const Server = jest.fn().mockImplementation(() => ({
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn()
  }));

  return { Server };
});

jest.mock("socket.io-redis", () => ({
  __esModule: true,
  default: jest.fn(() => "redis-adapter")
}));

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

const getAuthMiddleware = () => {
  initIO({} as HttpServer);
  const serverMock = SocketIOServer as unknown as jest.Mock;
  const io = serverMock.mock.results[serverMock.mock.results.length - 1].value;

  return io.use.mock.calls[0][0];
};

describe("socket initIO authentication", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should accept a valid token and call next only once", async () => {
    const user = { id: 7, name: "Agent" };
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

    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 7,
        tenantId: 42,
        profile: "admin"
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue(user);

    await getAuthMiddleware()(socket, next);

    expect(socket.handshake.auth).toEqual(
      expect.objectContaining({
        token: "valid-token",
        keep: "value",
        id: "7",
        tenantId: "42",
        profile: "admin",
        user
      })
    );
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
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it("should reject an invalid token without looking up the user", async () => {
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

    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: {
        id: "",
        tenantId: 0,
        profile: ""
      }
    });

    await getAuthMiddleware()(socket, next);

    expect(User.findByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toMatchObject({
      message: "authentication error"
    });
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it("should configure redis adapter using socket.io redis settings", () => {
    const middleware = getAuthMiddleware();
    const serverMock = SocketIOServer as unknown as jest.Mock;
    const io = serverMock.mock.results[serverMock.mock.results.length - 1].value;

    expect(middleware).toEqual(expect.any(Function));
    expect(socketRedis).toHaveBeenCalledWith({
      host: process.env.IO_REDIS_SERVER,
      port: Number(process.env.IO_REDIS_PORT),
      username: process.env.IO_REDIS_USERNAME,
      password: process.env.IO_REDIS_PASSWORD
    });
    expect(io.adapter).toHaveBeenCalledWith("redis-adapter");
  });
});

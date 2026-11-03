import { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import socketRedis from "socket.io-redis";
import User from "../../../models/User";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import { initIO } from "../../../libs/socket";

jest.mock("socket.io", () => ({
  Server: jest.fn(() => ({
    adapter: jest.fn(),
    on: jest.fn(),
    use: jest.fn()
  }))
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

const socketIOServerMock = SocketIOServer as unknown as jest.Mock;
const socketRedisMock = socketRedis as unknown as jest.Mock;
const decodeTokenSocketMock = decodeTokenSocket as jest.Mock;
const findUserByPkMock = User.findByPk as jest.Mock;

const getAuthMiddleware = () => {
  const io = initIO({} as HttpServer) as any;
  return io.use.mock.calls[0][0];
};

describe("socket initIO authentication middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should authenticate a valid token and call next only once", async () => {
    const socketUser = { id: 123, name: "Jane Agent" };
    decodeTokenSocketMock.mockReturnValue({
      isValid: true,
      data: {
        id: 123,
        profile: "admin",
        tenantId: 456
      }
    });
    findUserByPkMock.mockResolvedValue(socketUser);

    const middleware = getAuthMiddleware();
    const socket = {
      id: "socket-1",
      handshake: {
        auth: {
          token: "valid-token",
          existing: "preserved"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    await middleware(socket, next);

    expect(socketIOServerMock).toHaveBeenCalledWith(
      {} as HttpServer,
      expect.objectContaining({
        cors: { origin: "*" },
        pingInterval: 60000,
        pingTimeout: 180000
      })
    );
    expect(socketRedisMock).toHaveBeenCalledWith({
      host: process.env.IO_REDIS_SERVER,
      port: Number(process.env.IO_REDIS_PORT),
      username: process.env.IO_REDIS_USERNAME,
      password: process.env.IO_REDIS_PASSWORD
    });
    expect(findUserByPkMock).toHaveBeenCalledWith(
      123,
      expect.objectContaining({
        attributes: expect.arrayContaining(["id", "tenantId", "name", "email"])
      })
    );
    expect(socket.handshake.auth).toMatchObject({
      existing: "preserved",
      id: "123",
      profile: "admin",
      tenantId: "456",
      token: "valid-token",
      user: socketUser
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("should reject an invalid token once without querying a user", async () => {
    decodeTokenSocketMock.mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });

    const middleware = getAuthMiddleware();
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

    expect(findUserByPkMock).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toMatchObject({
      message: "authentication error"
    });
  });
});

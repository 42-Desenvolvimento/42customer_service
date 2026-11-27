import socketRedis from "socket.io-redis";
import { Server } from "socket.io";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import { initIO } from "../../../libs/socket";
import Chat from "../../../libs/socketChat/Chat";
import User from "../../../models/User";
import { logger } from "../../../utils/logger";

jest.mock("socket.io", () => {
  const ioInstance = {
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn()
  };

  return {
    Server: jest.fn(() => ioInstance),
    __ioInstance: ioInstance
  };
});

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
  const getIoInstance = () => jest.requireMock("socket.io").__ioInstance;

  const getAuthMiddleware = () => {
    const ioInstance = getIoInstance();
    return ioInstance.use.mock.calls[0][0];
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("initializes the adapter and connection handlers", () => {
    const io = initIO({} as any);
    const ioInstance = getIoInstance();

    expect(io).toBe(ioInstance);
    expect(Server).toHaveBeenCalledWith(
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
      host: process.env.IO_REDIS_SERVER,
      port: Number(process.env.IO_REDIS_PORT),
      username: process.env.IO_REDIS_USERNAME,
      password: process.env.IO_REDIS_PASSWORD
    });
    expect(ioInstance.adapter).toHaveBeenCalledWith("redis-adapter");
    expect(ioInstance.use).toHaveBeenCalledTimes(1);
    expect(ioInstance.on).toHaveBeenCalledWith(
      "connection",
      expect.any(Function)
    );
  });

  it("accepts a valid token and calls next only once without an error", async () => {
    const user = { id: 123, tenantId: 456 };
    const socket = {
      id: "socket-id",
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
        id: 123,
        profile: "admin",
        tenantId: 456
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue(user);

    initIO({} as any);
    await getAuthMiddleware()(socket, next);

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
      keep: "value",
      id: "123",
      profile: "admin",
      tenantId: "456",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]).toEqual([]);
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it("rejects an invalid token without loading a user", async () => {
    const socket = {
      id: "socket-id",
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
        profile: "",
        tenantId: 0
      }
    });

    initIO({} as any);
    await getAuthMiddleware()(socket, next);

    expect(User.findByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it("emits tokenInvalid when token decoding throws", async () => {
    const socket = {
      id: "socket-id",
      handshake: {
        auth: {
          token: "broken-token"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();
    const tokenError = new Error("jwt malformed");

    (decodeTokenSocket as jest.Mock).mockImplementation(() => {
      throw tokenError;
    });

    initIO({} as any);
    await getAuthMiddleware()(socket, next);

    expect(logger.warn).toHaveBeenCalledWith(`tokenInvalid: ${socket}`);
    expect(socket.emit).toHaveBeenCalledWith("tokenInvalid:socket-id");
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
  });

  it("registers chat handlers for authenticated tenant connections", () => {
    initIO({} as any);
    const connectionHandler = getIoInstance().on.mock.calls.find(
      ([eventName]) => eventName === "connection"
    )[1];
    const socket = {
      handshake: {
        auth: {
          tenantId: "456"
        }
      },
      join: jest.fn(),
      on: jest.fn()
    };

    connectionHandler(socket);

    expect(socket.join).toHaveBeenCalledWith("456");
    expect(socket.on).toHaveBeenCalledWith(
      "456:joinChatBox",
      expect.any(Function)
    );
    expect(socket.on).toHaveBeenCalledWith(
      "456:joinNotification",
      expect.any(Function)
    );
    expect(socket.on).toHaveBeenCalledWith("456:joinTickets", expect.any(Function));
    expect(Chat.register).toHaveBeenCalledWith(socket);
  });
});

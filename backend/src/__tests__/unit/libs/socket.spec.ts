import { Server as HttpServer } from "http";
import { Server as SocketServer } from "socket.io";
import socketRedis from "socket.io-redis";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import { initIO } from "../../../libs/socket";
import Chat from "../../../libs/socketChat/Chat";
import User from "../../../models/User";

jest.mock("socket.io", () => ({
  Server: jest.fn()
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

describe("socket initIO authentication middleware", () => {
  const adapter = jest.fn();
  const use = jest.fn();
  const on = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (SocketServer as unknown as jest.Mock).mockImplementation(() => ({
      adapter,
      use,
      on
    }));
  });

  const initAndGetMiddleware = () => {
    initIO({} as HttpServer);
    return use.mock.calls[0][0];
  };

  it("should enrich socket auth and call next once for a valid token", async () => {
    const user = { id: 123, tenantId: 456, name: "Agent" };
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 123,
        profile: "admin",
        tenantId: 456
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue(user);

    const middleware = initAndGetMiddleware();
    const socket = {
      id: "socket-1",
      handshake: {
        auth: {
          token: "valid-token",
          existing: "keep-me"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    await middleware(socket, next);

    expect(socketRedis).toHaveBeenCalledWith({
      host: process.env.IO_REDIS_SERVER,
      port: Number(process.env.IO_REDIS_PORT),
      username: process.env.IO_REDIS_USERNAME,
      password: process.env.IO_REDIS_PASSWORD
    });
    expect(adapter).toHaveBeenCalledWith("redis-adapter");
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
      existing: "keep-me",
      id: "123",
      tenantId: "456",
      profile: "admin",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("should reject an invalid token without loading the user", async () => {
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });

    const middleware = initAndGetMiddleware();
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

    expect(User.findByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
  });

  it("should register tenant rooms and chat handlers on connection", () => {
    initIO({} as HttpServer);
    const connectionHandler = on.mock.calls.find(
      ([eventName]) => eventName === "connection"
    )[1];
    const socket = {
      handshake: {
        auth: {
          tenantId: "42"
        }
      },
      join: jest.fn(),
      on: jest.fn()
    };

    connectionHandler(socket);

    expect(socket.join).toHaveBeenCalledWith("42");
    expect(socket.on).toHaveBeenCalledWith(
      "42:joinChatBox",
      expect.any(Function)
    );
    expect(socket.on).toHaveBeenCalledWith(
      "42:joinNotification",
      expect.any(Function)
    );
    expect(socket.on).toHaveBeenCalledWith(
      "42:joinTickets",
      expect.any(Function)
    );
    expect(Chat.register).toHaveBeenCalledWith(socket);
  });
});

export {};

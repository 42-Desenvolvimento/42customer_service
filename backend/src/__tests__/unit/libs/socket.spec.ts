jest.mock("socket.io", () => {
  const instances: any[] = [];
  const Server = jest.fn().mockImplementation(() => {
    const instance = {
      adapter: jest.fn(),
      use: jest.fn(),
      on: jest.fn()
    };
    instances.push(instance);
    return instance;
  });

  return {
    Server,
    __instances: instances
  };
});

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

import { Server as SocketIOServer } from "socket.io";
import socketRedis from "socket.io-redis";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import { initIO } from "../../../libs/socket";
import User from "../../../models/User";

describe("socket initIO", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const socketIoMock = jest.requireMock("socket.io");
    socketIoMock.__instances.length = 0;
  });

  it("authenticates a valid token once and keeps normalized auth data on the socket", async () => {
    const user = { id: 42, tenantId: 7, name: "Agent" };
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 42,
        tenantId: 7,
        profile: "admin"
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue(user);

    const io = initIO({} as any);
    const middleware = (io.use as jest.Mock).mock.calls[0][0];
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

    await middleware(socket, next);

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
      host: process.env.IO_REDIS_SERVER,
      port: Number(process.env.IO_REDIS_PORT),
      username: process.env.IO_REDIS_USERNAME,
      password: process.env.IO_REDIS_PASSWORD
    });
    expect(io.adapter).toHaveBeenCalledWith("redis-adapter");
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
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it("rejects invalid tokens with an authentication error", async () => {
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: {
        id: "",
        tenantId: 0,
        profile: ""
      }
    });

    const io = initIO({} as any);
    const middleware = (io.use as jest.Mock).mock.calls[0][0];
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
    expect(User.findByPk).not.toHaveBeenCalled();
  });
});

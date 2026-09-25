import { Server as SocketIOServer } from "socket.io";
import socketRedis from "socket.io-redis";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import User from "../../../models/User";
import Chat from "../../../libs/socketChat/Chat";
import { initIO } from "../../../libs/socket";

jest.mock("socket.io", () => {
  const mockInstance = {
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn()
  };

  return {
    Server: jest.fn(() => mockInstance),
    __mockInstance: mockInstance
  };
});

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
  const decodeTokenSocketMock = decodeTokenSocket as jest.Mock;
  const userFindByPkMock = User.findByPk as jest.Mock;
  const socketRedisMock = socketRedis as unknown as jest.Mock;
  const socketIOServerMock = SocketIOServer as unknown as jest.Mock;
  const chatRegisterMock = Chat.register as jest.Mock;

  const getSocketIOMockInstance = () =>
    (jest.requireMock("socket.io") as any).__mockInstance;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("authenticates a valid token and calls next only once", async () => {
    const user = { id: 10, name: "Agent" };
    decodeTokenSocketMock.mockReturnValue({
      isValid: true,
      data: {
        id: 10,
        profile: "admin",
        tenantId: 20
      }
    });
    userFindByPkMock.mockResolvedValue(user);

    initIO({} as any);

    const ioMock = getSocketIOMockInstance();
    const middleware = ioMock.use.mock.calls[0][0];
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

    expect(socketIOServerMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        cors: { origin: "*" },
        pingTimeout: 180000,
        pingInterval: 60000
      })
    );
    expect(socketRedisMock).toHaveBeenCalledWith({
      host: process.env.IO_REDIS_SERVER,
      port: Number(process.env.IO_REDIS_PORT),
      username: process.env.IO_REDIS_USERNAME,
      password: process.env.IO_REDIS_PASSWORD
    });
    expect(ioMock.adapter).toHaveBeenCalledWith("redis-adapter");
    expect(userFindByPkMock).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        attributes: expect.arrayContaining(["id", "tenantId", "email"])
      })
    );
    expect(socket.handshake.auth).toMatchObject({
      token: "valid-token",
      client: "web",
      id: "10",
      tenantId: "20",
      profile: "admin",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects an invalid token without loading a user", async () => {
    decodeTokenSocketMock.mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });

    initIO({} as any);

    const ioMock = getSocketIOMockInstance();
    const middleware = ioMock.use.mock.calls[0][0];
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

    expect(userFindByPkMock).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
  });

  it("registers tenant-scoped socket listeners when a client connects", () => {
    initIO({} as any);

    const ioMock = getSocketIOMockInstance();
    const connectionHandler = ioMock.on.mock.calls.find(
      ([eventName]: [string]) => eventName === "connection"
    )[1];
    const socket = {
      handshake: {
        auth: {
          tenantId: "20"
        }
      },
      join: jest.fn(),
      on: jest.fn()
    };

    connectionHandler(socket);

    expect(socket.join).toHaveBeenCalledWith("20");
    expect(socket.on).toHaveBeenCalledWith(
      "20:joinChatBox",
      expect.any(Function)
    );
    expect(socket.on).toHaveBeenCalledWith(
      "20:joinNotification",
      expect.any(Function)
    );
    expect(socket.on).toHaveBeenCalledWith(
      "20:joinTickets",
      expect.any(Function)
    );
    expect(chatRegisterMock).toHaveBeenCalledWith(socket);
  });
});

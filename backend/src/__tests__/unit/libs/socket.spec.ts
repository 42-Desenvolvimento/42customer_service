import { Server as SocketIOServer } from "socket.io";
import socketRedis from "socket.io-redis";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import { initIO } from "../../../libs/socket";
import Chat from "../../../libs/socketChat/Chat";
import User from "../../../models/User";

jest.mock("socket.io", () => ({
  Server: jest.fn().mockImplementation(() => ({
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn()
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

const SocketIOServerMock = SocketIOServer as unknown as jest.Mock;
const socketRedisMock = socketRedis as unknown as jest.Mock;
const decodeTokenSocketMock = decodeTokenSocket as jest.MockedFunction<
  typeof decodeTokenSocket
>;
const findByPkMock = User.findByPk as jest.Mock;
const chatRegisterMock = Chat.register as jest.Mock;

const getAuthMiddleware = () => {
  initIO({} as any);
  const socketServer = SocketIOServerMock.mock.results[0].value;
  return socketServer.use.mock.calls[0][0] as (
    socket: any,
    next: jest.Mock
  ) => Promise<void>;
};

describe("initIO socket authentication", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("accepts a valid token and calls next without an authentication error", async () => {
    const user = {
      id: 12,
      tenantId: 34,
      name: "Socket User"
    };
    const socket = {
      handshake: {
        auth: {
          token: "valid-token",
          keep: "metadata"
        }
      },
      emit: jest.fn(),
      id: "socket-1"
    };
    const next = jest.fn();

    decodeTokenSocketMock.mockReturnValue({
      isValid: true,
      data: {
        id: 12,
        profile: "admin",
        tenantId: 34
      }
    });
    findByPkMock.mockResolvedValue(user);

    const middleware = getAuthMiddleware();
    await middleware(socket, next);

    expect(SocketIOServerMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        cors: {
          origin: "*"
        },
        pingTimeout: 180000,
        pingInterval: 60000
      })
    );
    expect(socketRedisMock).toHaveBeenCalledWith(
      expect.objectContaining({
        host: process.env.IO_REDIS_SERVER,
        port: Number(process.env.IO_REDIS_PORT)
      })
    );
    expect(decodeTokenSocketMock).toHaveBeenCalledWith("valid-token");
    expect(findByPkMock).toHaveBeenCalledWith(
      12,
      expect.objectContaining({
        attributes: expect.arrayContaining(["id", "tenantId", "email"])
      })
    );
    expect(socket.handshake.auth).toEqual(
      expect.objectContaining({
        token: "valid-token",
        keep: "metadata",
        id: "12",
        profile: "admin",
        tenantId: "34",
        user
      })
    );
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects an invalid token without loading a user", async () => {
    const socket = {
      handshake: {
        auth: {
          token: "invalid-token"
        }
      },
      emit: jest.fn(),
      id: "socket-2"
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

    const middleware = getAuthMiddleware();
    await middleware(socket, next);

    expect(findByPkMock).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
  });

  it("registers chat handlers only after a tenant-authenticated connection", () => {
    initIO({} as any);
    const socketServer = SocketIOServerMock.mock.results[0].value;
    const connectionHandler = socketServer.on.mock.calls[0][1];
    const socket = {
      handshake: {
        auth: {
          tenantId: "34"
        }
      },
      join: jest.fn(),
      on: jest.fn()
    };

    connectionHandler(socket);

    expect(socketServer.on).toHaveBeenCalledWith(
      "connection",
      expect.any(Function)
    );
    expect(socket.join).toHaveBeenCalledWith("34");
    expect(socket.on).toHaveBeenCalledWith(
      "34:joinChatBox",
      expect.any(Function)
    );
    expect(socket.on).toHaveBeenCalledWith(
      "34:joinNotification",
      expect.any(Function)
    );
    expect(socket.on).toHaveBeenCalledWith(
      "34:joinTickets",
      expect.any(Function)
    );
    expect(chatRegisterMock).toHaveBeenCalledWith(socket);
  });
});

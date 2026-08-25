import { Server as SocketIOServer } from "socket.io";
import socketRedis from "socket.io-redis";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import Chat from "../../../libs/socketChat/Chat";
import { initIO } from "../../../libs/socket";
import User from "../../../models/User";

jest.mock("socket.io", () => ({
  Server: jest.fn(() => ({
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
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

const socketIOServerMock = SocketIOServer as unknown as jest.Mock;
const socketRedisMock = socketRedis as unknown as jest.Mock;
const decodeTokenSocketMock = decodeTokenSocket as jest.Mock;
const findUserByPkMock = User.findByPk as jest.Mock;
const chatRegisterMock = Chat.register as jest.Mock;

const makeSocket = (token?: string) =>
  ({
    id: "socket-1",
    handshake: {
      auth: {
        token
      }
    },
    emit: jest.fn(),
    join: jest.fn(),
    on: jest.fn()
  } as any);

const getMiddleware = () => {
  const io = initIO({} as any) as any;
  return {
    io,
    middleware: io.use.mock.calls[0][0]
  };
};

describe("socket initIO authentication", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should accept a valid token without also returning an authentication error", async () => {
    const socket = makeSocket("valid-token");
    const user = {
      id: 123,
      tenantId: 42,
      name: "Jane Doe",
      profile: "admin"
    };
    const next = jest.fn();

    decodeTokenSocketMock.mockReturnValue({
      isValid: true,
      data: {
        id: 123,
        tenantId: 42,
        profile: "admin"
      }
    });
    findUserByPkMock.mockResolvedValue(user);

    const { io, middleware } = getMiddleware();
    await middleware(socket, next);

    expect(socketIOServerMock).toHaveBeenCalledWith(
      {},
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
    expect(io.adapter).toHaveBeenCalledWith("redis-adapter");
    expect(findUserByPkMock).toHaveBeenCalledWith(
      123,
      expect.objectContaining({
        attributes: expect.arrayContaining(["id", "tenantId", "email"])
      })
    );
    expect(socket.handshake.auth).toMatchObject({
      token: "valid-token",
      id: "123",
      tenantId: "42",
      profile: "admin",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("should reject an invalid token", async () => {
    const socket = makeSocket("invalid-token");
    const next = jest.fn();

    decodeTokenSocketMock.mockReturnValue({
      isValid: false,
      data: {
        id: "",
        tenantId: 0,
        profile: ""
      }
    });

    const { middleware } = getMiddleware();
    await middleware(socket, next);

    expect(findUserByPkMock).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
  });

  it("should register chat handlers only for authenticated tenant connections", () => {
    const { io } = getMiddleware();
    const connectionHandler = io.on.mock.calls.find(
      ([eventName]: any[]) => eventName === "connection"
    )[1];
    const socket = {
      handshake: {
        auth: {
          tenantId: "42"
        }
      },
      id: "socket-1",
      join: jest.fn(),
      on: jest.fn()
    };

    connectionHandler(socket);

    expect(socket.join).toHaveBeenCalledWith("42");
    expect(chatRegisterMock).toHaveBeenCalledWith(socket);
  });
});

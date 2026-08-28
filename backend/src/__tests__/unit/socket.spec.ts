jest.mock("socket.io", () => ({
  Server: jest.fn().mockImplementation(() => ({
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn()
  }))
}));

jest.mock("socket.io-redis", () => jest.fn(() => "redis-adapter"));

jest.mock("../../libs/decodeTokenSocket", () => jest.fn());

jest.mock("../../models/User", () => ({
  findByPk: jest.fn()
}));

jest.mock("../../libs/socketChat/Chat", () => ({
  register: jest.fn()
}));

jest.mock("../../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn()
  }
}));

import { initIO } from "../../libs/socket";
import decodeTokenSocket from "../../libs/decodeTokenSocket";
import User from "../../models/User";

const SocketIOServerMock = jest.requireMock("socket.io").Server as jest.Mock;
const socketRedisMock = jest.requireMock("socket.io-redis") as jest.Mock;
const decodeTokenSocketMock = decodeTokenSocket as jest.Mock;
const findUserByPkMock = User.findByPk as jest.Mock;

const makeSocket = (auth: Record<string, unknown> = {}) =>
  ({
    id: "socket-1",
    handshake: {
      auth
    },
    emit: jest.fn(),
    join: jest.fn(),
    on: jest.fn()
  } as any);

describe("socket", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const initAndGetMiddleware = () => {
    initIO({} as any);

    const io = SocketIOServerMock.mock.results[0].value;
    return io.use.mock.calls[0][0] as (
      socket: any,
      next: (error?: Error) => void
    ) => Promise<void>;
  };

  it("configures redis adapter when initializing socket io", () => {
    process.env.IO_REDIS_SERVER = "redis";
    process.env.IO_REDIS_PORT = "6379";
    process.env.IO_REDIS_USERNAME = "default";
    process.env.IO_REDIS_PASSWORD = "secret";

    initIO({} as any);

    const io = SocketIOServerMock.mock.results[0].value;
    expect(SocketIOServerMock).toHaveBeenCalledWith(
      {},
      {
        cors: {
          origin: "*"
        },
        pingTimeout: 180000,
        pingInterval: 60000
      }
    );
    expect(socketRedisMock).toHaveBeenCalledWith({
      host: "redis",
      port: 6379,
      username: "default",
      password: "secret"
    });
    expect(io.adapter).toHaveBeenCalledWith("redis-adapter");
  });

  it("authenticates a valid token exactly once and enriches handshake auth", async () => {
    const user = { id: 7, name: "Ada" };
    decodeTokenSocketMock.mockReturnValue({
      isValid: true,
      data: {
        id: 7,
        profile: "admin",
        tenantId: 3
      }
    });
    findUserByPkMock.mockResolvedValue(user);

    const middleware = initAndGetMiddleware();
    const socket = makeSocket({
      token: "valid-token",
      previous: "value"
    });
    const next = jest.fn();

    await middleware(socket, next);

    expect(findUserByPkMock).toHaveBeenCalledWith(7, {
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
      previous: "value",
      id: "7",
      profile: "admin",
      tenantId: "3",
      user
    });
    expect(next.mock.calls).toEqual([[]]);
  });

  it("rejects an invalid token without looking up a user", async () => {
    decodeTokenSocketMock.mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });

    const middleware = initAndGetMiddleware();
    const socket = makeSocket({ token: "bad-token" });
    const next = jest.fn();

    await middleware(socket, next);

    expect(findUserByPkMock).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
  });
});

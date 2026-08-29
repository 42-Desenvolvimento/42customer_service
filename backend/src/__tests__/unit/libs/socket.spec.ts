jest.mock("socket.io", () => ({
  Server: jest.fn()
}));

jest.mock("socket.io-redis", () => jest.fn());

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

import { Server as SocketIOServer } from "socket.io";
import socketRedis from "socket.io-redis";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import User from "../../../models/User";
import { initIO } from "../../../libs/socket";

describe("socket initIO authentication middleware", () => {
  const socketIOConstructorMock = SocketIOServer as unknown as jest.Mock;
  const socketRedisMock = socketRedis as unknown as jest.Mock;
  const decodeTokenSocketMock = decodeTokenSocket as jest.Mock;
  const userFindByPkMock = User.findByPk as jest.Mock;

  const createIO = () => ({
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn()
  });

  beforeEach(() => {
    jest.clearAllMocks();
    socketRedisMock.mockReturnValue("redis-adapter");
  });

  it("enriches socket auth and calls next without error for a valid token", async () => {
    const io = createIO();
    const user = { id: 42, name: "Socket User" };
    socketIOConstructorMock.mockImplementation(() => io);
    decodeTokenSocketMock.mockReturnValue({
      isValid: true,
      data: {
        id: 42,
        profile: "admin",
        tenantId: 7
      }
    });
    userFindByPkMock.mockResolvedValue(user);

    initIO({} as any);

    const middleware = io.use.mock.calls[0][0];
    const socket = {
      handshake: {
        auth: {
          token: "valid-token",
          keep: "preserved"
        }
      }
    };
    const next = jest.fn();

    await middleware(socket, next);

    expect(decodeTokenSocketMock).toHaveBeenCalledWith("valid-token");
    expect(userFindByPkMock).toHaveBeenCalledWith(42, {
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
      keep: "preserved",
      id: "42",
      profile: "admin",
      tenantId: "7",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects sockets with invalid tokens", async () => {
    const io = createIO();
    socketIOConstructorMock.mockImplementation(() => io);
    decodeTokenSocketMock.mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });

    initIO({} as any);

    const middleware = io.use.mock.calls[0][0];
    const next = jest.fn();

    await middleware(
      {
        handshake: {
          auth: {
            token: "bad-token"
          }
        }
      },
      next
    );

    expect(userFindByPkMock).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
  });
});

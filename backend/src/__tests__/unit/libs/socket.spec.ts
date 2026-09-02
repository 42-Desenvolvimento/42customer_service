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
    info: jest.fn(),
    warn: jest.fn()
  }
}));

import { Server as SocketServer } from "socket.io";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import User from "../../../models/User";
import { initIO } from "../../../libs/socket";

describe("socket initIO authentication middleware", () => {
  const socketServerMock = SocketServer as unknown as jest.Mock;
  const decodeTokenSocketMock = decodeTokenSocket as jest.Mock;
  const userFindByPkMock = User.findByPk as jest.Mock;

  const getMiddleware = () => {
    initIO({} as any);
    const io = socketServerMock.mock.results[
      socketServerMock.mock.results.length - 1
    ].value;

    return io.use.mock.calls[0][0];
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("allows valid tokens once and enriches the socket auth data", async () => {
    const user = {
      id: 123,
      tenantId: 456,
      name: "Agent"
    };
    const socket = {
      handshake: {
        auth: {
          token: "valid-token",
          currentRoom: "tickets"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    decodeTokenSocketMock.mockReturnValue({
      isValid: true,
      data: {
        id: 123,
        tenantId: 456,
        profile: "admin"
      }
    });
    userFindByPkMock.mockResolvedValue(user);

    const middleware = getMiddleware();
    await middleware(socket, next);

    expect(userFindByPkMock).toHaveBeenCalledWith(123, {
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
      currentRoom: "tickets",
      id: "123",
      tenantId: "456",
      profile: "admin",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it("rejects invalid tokens without looking up a user", async () => {
    const socket = {
      handshake: {
        auth: {
          token: "invalid-token"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    decodeTokenSocketMock.mockReturnValue({
      isValid: false,
      data: {}
    });

    const middleware = getMiddleware();
    await middleware(socket, next);

    expect(userFindByPkMock).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
    expect(socket.emit).not.toHaveBeenCalled();
  });
});

export {};

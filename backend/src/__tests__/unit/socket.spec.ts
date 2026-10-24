jest.mock("socket.io", () => ({
  Server: jest.fn(() => ({
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn()
  }))
}));

jest.mock("socket.io-redis", () => jest.fn(() => "redis-adapter"));

jest.mock("../../libs/decodeTokenSocket", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../models/User", () => ({
  __esModule: true,
  default: {
    findByPk: jest.fn()
  }
}));

jest.mock("../../libs/socketChat/Chat", () => ({
  __esModule: true,
  default: {
    register: jest.fn()
  }
}));

jest.mock("../../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

import { Server as SocketServer } from "socket.io";
import socketRedis from "socket.io-redis";
import decodeTokenSocket from "../../libs/decodeTokenSocket";
import User from "../../models/User";
import { initIO } from "../../libs/socket";

const getRegisteredMiddleware = () => {
  const serverMock = SocketServer as unknown as jest.Mock;
  const io = serverMock.mock.results[serverMock.mock.results.length - 1].value;

  return io.use.mock.calls[0][0];
};

describe("socket initIO", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("accepts a valid token without also emitting an authentication error", async () => {
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 7,
        profile: "admin",
        tenantId: 42
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue({
      id: 7,
      tenantId: 42,
      name: "Socket User"
    });

    initIO({} as any);

    expect(socketRedis).toHaveBeenCalled();

    const middleware = getRegisteredMiddleware();
    const socket = {
      handshake: {
        auth: {
          token: "valid-token"
        }
      }
    };
    const next = jest.fn();

    await middleware(socket, next);

    expect(User.findByPk).toHaveBeenCalledWith(7, {
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
      id: "7",
      tenantId: "42",
      profile: "admin",
      user: {
        id: 7,
        tenantId: 42,
        name: "Socket User"
      }
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects an invalid token without loading a user", async () => {
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });

    initIO({} as any);

    const middleware = getRegisteredMiddleware();
    const next = jest.fn();

    await middleware(
      {
        handshake: {
          auth: {
            token: "invalid-token"
          }
        }
      },
      next
    );

    expect(User.findByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
  });
});

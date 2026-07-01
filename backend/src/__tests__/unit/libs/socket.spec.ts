let mockIo: any;
let mockMiddleware: any;

jest.mock("socket.io", () => ({
  Server: jest.fn().mockImplementation(() => mockIo)
}));

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

import socketRedis from "socket.io-redis";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import User from "../../../models/User";
import { initIO } from "../../../libs/socket";

describe("socket initIO authentication middleware", () => {
  beforeEach(() => {
    mockMiddleware = undefined;
    mockIo = {
      adapter: jest.fn(),
      use: jest.fn(handler => {
        mockMiddleware = handler;
      }),
      on: jest.fn()
    };

    process.env.IO_REDIS_SERVER = "redis";
    process.env.IO_REDIS_PORT = "6379";
    process.env.IO_REDIS_USERNAME = "default";
    process.env.IO_REDIS_PASSWORD = "secret";
  });

  it("allows a valid token without calling next with an authentication error", async () => {
    const user = { id: 3, tenantId: 9, name: "Agent" };
    const next = jest.fn();
    const socket = {
      handshake: {
        auth: {
          token: "valid-token",
          keep: "existing-value"
        }
      },
      emit: jest.fn()
    };

    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 3,
        tenantId: 9,
        profile: "admin"
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue(user);

    initIO({} as any);
    await mockMiddleware(socket, next);

    expect(socketRedis).toHaveBeenCalledWith({
      host: "redis",
      port: 6379,
      username: "default",
      password: "secret"
    });
    expect(mockIo.adapter).toHaveBeenCalledWith("redis-adapter");
    expect(User.findByPk).toHaveBeenCalledWith(3, {
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
      keep: "existing-value",
      id: "3",
      tenantId: "9",
      profile: "admin",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects an invalid token with a single authentication error", async () => {
    const next = jest.fn();
    const socket = {
      id: "socket-1",
      handshake: {
        auth: {
          token: "invalid-token"
        }
      },
      emit: jest.fn()
    };

    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: {}
    });

    initIO({} as any);
    await mockMiddleware(socket, next);

    expect(User.findByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(next.mock.calls[0][0].message).toBe("authentication error");
  });
});

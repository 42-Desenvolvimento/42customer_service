jest.mock("socket.io", () => {
  const instance = {
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn()
  };

  return {
    Server: jest.fn(() => instance),
    __instance: instance
  };
});

jest.mock("socket.io-redis", () => jest.fn(() => "redis-adapter"));
jest.mock("../../libs/decodeTokenSocket", () => jest.fn());
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

import decodeTokenSocket from "../../libs/decodeTokenSocket";
import { initIO } from "../../libs/socket";
import User from "../../models/User";

const socketIO = jest.requireMock("socket.io");
const socketRedis = jest.requireMock("socket.io-redis");
const decodeTokenSocketMock = decodeTokenSocket as jest.Mock;
const userFindByPkMock = User.findByPk as jest.Mock;

describe("initIO socket authentication", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const buildAuthMiddleware = () => {
    initIO({} as any);

    return socketIO.__instance.use.mock.calls[0][0];
  };

  it("allows a valid token without also emitting an authentication error", async () => {
    const user = { id: 123, tenantId: 456, name: "Agent" };
    decodeTokenSocketMock.mockReturnValue({
      isValid: true,
      data: {
        id: 123,
        profile: "admin",
        tenantId: 456
      }
    });
    userFindByPkMock.mockResolvedValue(user);

    const middleware = buildAuthMiddleware();
    const socket = {
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

    expect(socketRedis).toHaveBeenCalledWith({
      host: process.env.IO_REDIS_SERVER,
      port: Number(process.env.IO_REDIS_PORT),
      username: process.env.IO_REDIS_USERNAME,
      password: process.env.IO_REDIS_PASSWORD
    });
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
    expect(socket.handshake.auth).toMatchObject({
      token: "valid-token",
      client: "web",
      id: "123",
      tenantId: "456",
      profile: "admin",
      user
    });
    expect(next.mock.calls).toEqual([[]]);
  });

  it("rejects an invalid token", async () => {
    decodeTokenSocketMock.mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });

    const middleware = buildAuthMiddleware();
    const next = jest.fn();

    await middleware(
      {
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
});

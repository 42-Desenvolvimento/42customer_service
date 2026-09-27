jest.mock("socket.io", () => {
  const mockedSocketIO = {
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn()
  };

  return {
    __mockedSocketIO: mockedSocketIO,
    Server: jest.fn(() => mockedSocketIO)
  };
});

jest.mock("socket.io-redis", () => jest.fn(() => "redis-adapter"));
jest.mock("../../../libs/decodeTokenSocket", () => jest.fn());
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
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import User from "../../../models/User";
import { initIO } from "../../../libs/socket";

const socketIOMock = jest.requireMock("socket.io").__mockedSocketIO;

describe("socket initIO authentication middleware", () => {
  const getMiddleware = async () => {
    initIO({} as any);
    return socketIOMock.use.mock.calls[0][0];
  };

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.IO_REDIS_SERVER;
    delete process.env.IO_REDIS_PORT;
    delete process.env.IO_REDIS_USERNAME;
    delete process.env.IO_REDIS_PASSWORD;
  });

  it("should attach authenticated user data and call next only once", async () => {
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 7,
        profile: "admin",
        tenantId: 3
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue({ id: 7, name: "User" });

    const middleware = await getMiddleware();
    const next = jest.fn();
    const socket = {
      id: "socket-1",
      emit: jest.fn(),
      handshake: {
        auth: {
          token: "valid-token",
          client: "web"
        }
      }
    };

    await middleware(socket, next);

    expect(SocketIOServer).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        cors: { origin: "*" },
        pingInterval: 60000,
        pingTimeout: 180000
      })
    );
    expect(User.findByPk).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        attributes: expect.arrayContaining(["id", "tenantId", "name"])
      })
    );
    expect(socket.handshake.auth).toMatchObject({
      token: "valid-token",
      client: "web",
      id: "7",
      tenantId: "3",
      profile: "admin",
      user: { id: 7, name: "User" }
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("should reject invalid tokens without loading the user", async () => {
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });

    const middleware = await getMiddleware();
    const next = jest.fn();
    const socket = {
      id: "socket-2",
      emit: jest.fn(),
      handshake: {
        auth: {
          token: "invalid-token"
        }
      }
    };

    await middleware(socket, next);

    expect(User.findByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(new Error("authentication error"));
    expect(socket.emit).not.toHaveBeenCalled();
  });
});

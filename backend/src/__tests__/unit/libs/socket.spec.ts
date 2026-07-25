const mockAdapter = jest.fn();
let mockAuthMiddleware: any;
let mockConnectionHandler: any;
const mockSocketServer = {
  adapter: mockAdapter,
  use: jest.fn(callback => {
    mockAuthMiddleware = callback;
    return mockSocketServer;
  }),
  on: jest.fn((event, callback) => {
    if (event === "connection") {
      mockConnectionHandler = callback;
    }
    return mockSocketServer;
  })
};
const mockServerConstructor = jest.fn(() => mockSocketServer);
const mockRedisAdapter = jest.fn(() => "redis-adapter");
const mockDecodeTokenSocket = jest.fn();
const mockUserFindByPk = jest.fn();
const mockChatRegister = jest.fn();
const mockLoggerWarn = jest.fn();
const mockLoggerInfo = jest.fn();

jest.mock("socket.io", () => ({
  Server: mockServerConstructor
}));

jest.mock("socket.io-redis", () => mockRedisAdapter);

jest.mock("../../../libs/decodeTokenSocket", () => mockDecodeTokenSocket);

jest.mock("../../../models/User", () => ({
  findByPk: mockUserFindByPk
}));

jest.mock("../../../libs/socketChat/Chat", () => ({
  register: mockChatRegister
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    warn: mockLoggerWarn,
    info: mockLoggerInfo
  }
}));

import { initIO } from "../../../libs/socket";

describe("socket", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthMiddleware = undefined;
    mockConnectionHandler = undefined;
  });

  it("should authenticate a valid token and call next only once", async () => {
    const user = { id: 7, tenantId: 9, name: "Agent" };
    const socket = {
      handshake: {
        auth: {
          token: "valid-token",
          keep: "value"
        }
      }
    };
    const next = jest.fn();

    mockDecodeTokenSocket.mockReturnValue({
      isValid: true,
      data: {
        id: 7,
        profile: "admin",
        tenantId: 9
      }
    });
    mockUserFindByPk.mockResolvedValue(user);

    initIO({} as any);
    await mockAuthMiddleware(socket, next);

    expect(mockRedisAdapter).toHaveBeenCalledWith({
      host: process.env.IO_REDIS_SERVER,
      port: Number(process.env.IO_REDIS_PORT),
      username: process.env.IO_REDIS_USERNAME,
      password: process.env.IO_REDIS_PASSWORD
    });
    expect(mockAdapter).toHaveBeenCalledWith("redis-adapter");
    expect(mockUserFindByPk).toHaveBeenCalledWith(7, {
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
      keep: "value",
      id: "7",
      profile: "admin",
      tenantId: "9",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("should reject invalid tokens without loading a user", async () => {
    const socket = {
      handshake: {
        auth: {
          token: "invalid-token"
        }
      }
    };
    const next = jest.fn();

    mockDecodeTokenSocket.mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });

    initIO({} as any);
    await mockAuthMiddleware(socket, next);

    expect(mockUserFindByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toBe("authentication error");
  });

  it("should register chat handlers only when a socket has tenant context", () => {
    const join = jest.fn();
    const on = jest.fn();
    const socket = {
      id: "socket-id",
      handshake: {
        auth: {
          tenantId: "9"
        }
      },
      join,
      on
    };

    initIO({} as any);
    mockConnectionHandler(socket);

    expect(join).toHaveBeenCalledWith("9");
    expect(mockChatRegister).toHaveBeenCalledWith(socket);
  });
});

export {};

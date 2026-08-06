const mockAdapter = jest.fn();
const mockUse = jest.fn();
const mockOn = jest.fn();
const mockSocketRedis = jest.fn();
const mockDecodeTokenSocket = jest.fn();
const mockUserFindByPk = jest.fn();
const mockChatRegister = jest.fn();
const mockLoggerInfo = jest.fn();
const mockLoggerWarn = jest.fn();

let mockAuthMiddleware: any;
let mockConnectionHandler: any;

const mockIO = {
  adapter: mockAdapter,
  use: mockUse,
  on: mockOn
};

const mockSocketIOServer = jest.fn(() => mockIO);

jest.mock("socket.io", () => ({
  Server: mockSocketIOServer
}));

jest.mock("socket.io-redis", () => mockSocketRedis);

jest.mock("../../../libs/decodeTokenSocket", () => mockDecodeTokenSocket);

jest.mock("../../../models/User", () => ({
  findByPk: mockUserFindByPk
}));

jest.mock("../../../libs/socketChat/Chat", () => ({
  register: mockChatRegister
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    info: mockLoggerInfo,
    warn: mockLoggerWarn
  }
}));

import { initIO } from "../../../libs/socket";

describe("socket initIO authentication", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthMiddleware = undefined;
    mockConnectionHandler = undefined;

    mockUse.mockImplementation(handler => {
      mockAuthMiddleware = handler;
      return mockIO;
    });
    mockOn.mockImplementation((event, handler) => {
      if (event === "connection") {
        mockConnectionHandler = handler;
      }
      return mockIO;
    });
    mockSocketRedis.mockReturnValue("redis-adapter");
  });

  it("should call next without authentication error when token is valid", async () => {
    const user = {
      id: 7,
      tenantId: 42,
      name: "Agent"
    };
    const socket = {
      id: "socket-1",
      handshake: {
        auth: {
          token: "valid-token",
          keep: "existing-value"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    mockDecodeTokenSocket.mockReturnValue({
      isValid: true,
      data: {
        id: 7,
        tenantId: 42,
        profile: "admin"
      }
    });
    mockUserFindByPk.mockResolvedValue(user);

    initIO({} as any);
    await mockAuthMiddleware(socket, next);

    expect(mockSocketIOServer).toHaveBeenCalledWith(
      {},
      {
        cors: {
          origin: "*"
        },
        pingTimeout: 180000,
        pingInterval: 60000
      }
    );
    expect(mockAdapter).toHaveBeenCalledWith("redis-adapter");
    expect(mockDecodeTokenSocket).toHaveBeenCalledWith("valid-token");
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
      keep: "existing-value",
      id: "7",
      tenantId: "42",
      profile: "admin",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(socket.emit).not.toHaveBeenCalled();
    expect(mockConnectionHandler).toEqual(expect.any(Function));
  });

  it("should reject invalid tokens with an authentication error", async () => {
    const socket = {
      id: "socket-2",
      handshake: {
        auth: {
          token: "invalid-token"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    mockDecodeTokenSocket.mockReturnValue({
      isValid: false,
      data: {
        id: "",
        tenantId: 0,
        profile: ""
      }
    });

    initIO({} as any);
    await mockAuthMiddleware(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(next.mock.calls[0][0].message).toBe("authentication error");
    expect(mockUserFindByPk).not.toHaveBeenCalled();
  });
});

const mockAdapter = jest.fn();
const mockUse = jest.fn();
const mockOn = jest.fn();
const mockSocketRedis = jest.fn(() => "redis-adapter");

jest.mock("socket.io", () => ({
  Server: jest.fn(() => ({
    adapter: mockAdapter,
    use: mockUse,
    on: mockOn
  }))
}));

jest.mock("socket.io-redis", () => ({
  __esModule: true,
  default: mockSocketRedis
}));

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

const decodeTokenSocket = require("../../../libs/decodeTokenSocket")
  .default as jest.Mock;
const { initIO } = require("../../../libs/socket");
const Chat = require("../../../libs/socketChat/Chat").default;
const User = require("../../../models/User").default;

const mockDecodeTokenSocket = decodeTokenSocket as jest.Mock;
const mockUserFindByPk = User.findByPk as jest.Mock;
const mockChatRegister = Chat.register as jest.Mock;

describe("socket initIO authentication middleware", () => {
  const getMiddleware = () => {
    initIO({} as any);
    return mockUse.mock.calls[0][0];
  };

  beforeEach(() => {
    mockAdapter.mockClear();
    mockUse.mockClear();
    mockOn.mockClear();
    mockSocketRedis.mockClear();
  });

  it("accepts a valid token without also calling next with an authentication error", async () => {
    const user = { id: 7, tenantId: 3, name: "Agent" };
    const socket = {
      id: "socket-id",
      handshake: {
        auth: {
          token: "valid-token"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    mockDecodeTokenSocket.mockReturnValue({
      isValid: true,
      data: {
        id: 7,
        profile: "admin",
        tenantId: 3
      }
    });
    mockUserFindByPk.mockResolvedValue(user);

    await getMiddleware()(socket, next);

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
      id: "7",
      profile: "admin",
      tenantId: "3",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects an invalid token with one authentication error", async () => {
    const socket = {
      id: "socket-id",
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
        profile: "",
        tenantId: 0
      }
    });

    await getMiddleware()(socket, next);

    expect(mockUserFindByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(next.mock.calls[0][0].message).toBe("authentication error");
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it("registers chat handlers only for authenticated sockets with a tenant", () => {
    const connectionHandler = getMiddleware() && mockOn.mock.calls[0][1];
    const socket = {
      handshake: {
        auth: {
          tenantId: "3"
        }
      },
      join: jest.fn(),
      on: jest.fn()
    };

    connectionHandler(socket);

    expect(socket.join).toHaveBeenCalledWith("3");
    expect(socket.on).toHaveBeenCalledWith(
      "3:joinChatBox",
      expect.any(Function)
    );
    expect(socket.on).toHaveBeenCalledWith(
      "3:joinNotification",
      expect.any(Function)
    );
    expect(socket.on).toHaveBeenCalledWith(
      "3:joinTickets",
      expect.any(Function)
    );
    expect(mockChatRegister).toHaveBeenCalledWith(socket);
  });
});

export {};

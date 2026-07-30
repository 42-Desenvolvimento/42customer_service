const mockAdapter = jest.fn();
const mockUse = jest.fn();
const mockOn = jest.fn();
const mockSocketRedis = jest.fn();
const mockDecodeTokenSocket = jest.fn();
const mockFindByPk = jest.fn();
const mockChatRegister = jest.fn();
const mockLoggerInfo = jest.fn();
const mockLoggerWarn = jest.fn();

const mockSocketIOServer = jest.fn().mockImplementation(() => ({
  adapter: mockAdapter,
  use: mockUse,
  on: mockOn
}));

jest.mock("socket.io", () => ({
  Server: mockSocketIOServer
}));

jest.mock("socket.io-redis", () => ({
  __esModule: true,
  default: mockSocketRedis
}));

jest.mock("../../../libs/decodeTokenSocket", () => ({
  __esModule: true,
  default: mockDecodeTokenSocket
}));

jest.mock("../../../models/User", () => ({
  __esModule: true,
  default: {
    findByPk: mockFindByPk
  }
}));

jest.mock("../../../libs/socketChat/Chat", () => ({
  __esModule: true,
  default: {
    register: mockChatRegister
  }
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    info: mockLoggerInfo,
    warn: mockLoggerWarn
  }
}));

import { initIO } from "../../../libs/socket";

describe("socket initIO authentication middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSocketRedis.mockReturnValue("redis-adapter");
  });

  it("should call next only once with authentication error for invalid tokens", async () => {
    mockDecodeTokenSocket.mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });

    initIO({} as any);

    const middleware = mockUse.mock.calls[0][0];
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

    await middleware(socket, next);

    expect(mockDecodeTokenSocket).toHaveBeenCalledWith("invalid-token");
    expect(mockFindByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(next.mock.calls[0][0].message).toBe("authentication error");
  });

  it("should enrich socket auth and call next without error for valid tokens", async () => {
    const user = { id: 45, name: "Agent" };
    mockDecodeTokenSocket.mockReturnValue({
      isValid: true,
      data: {
        id: 45,
        profile: "admin",
        tenantId: 8
      }
    });
    mockFindByPk.mockResolvedValue(user);

    initIO({} as any);

    const middleware = mockUse.mock.calls[0][0];
    const next = jest.fn();
    const socket = {
      id: "socket-2",
      handshake: {
        auth: {
          token: "valid-token"
        }
      },
      emit: jest.fn()
    };

    await middleware(socket, next);

    expect(mockFindByPk).toHaveBeenCalledWith(45, {
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
      id: "45",
      profile: "admin",
      tenantId: "8",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });
});

export {};

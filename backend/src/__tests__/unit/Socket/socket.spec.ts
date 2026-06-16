const mockAdapter = jest.fn();
const mockUse = jest.fn();
const mockOn = jest.fn();
const mockSocketRedis = jest.fn();
const mockDecodeTokenSocket = jest.fn();
const mockFindUserByPk = jest.fn();
const mockChatRegister = jest.fn();
const mockLoggerWarn = jest.fn();
const mockLoggerInfo = jest.fn();

jest.mock("socket.io", () => ({
  Server: jest.fn(() => ({
    adapter: mockAdapter,
    use: mockUse,
    on: mockOn
  }))
}));

jest.mock("socket.io-redis", () => mockSocketRedis);

jest.mock("../../../libs/decodeTokenSocket", () => ({
  __esModule: true,
  default: mockDecodeTokenSocket
}));

jest.mock("../../../models/User", () => ({
  __esModule: true,
  default: {
    findByPk: mockFindUserByPk
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
  const userAttributes = [
    "id",
    "tenantId",
    "name",
    "email",
    "profile",
    "status",
    "lastLogin",
    "lastOnline"
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockSocketRedis.mockReturnValue("redis-adapter");
  });

  const bootMiddleware = () => {
    initIO({} as any);
    expect(mockAdapter).toHaveBeenCalledWith("redis-adapter");
    expect(mockUse).toHaveBeenCalledTimes(1);
    return mockUse.mock.calls[0][0];
  };

  it("calls next only once without an authentication error for a valid token", async () => {
    const user = { id: 55, tenantId: 8, name: "Socket User" };
    const socket = {
      id: "socket-1",
      handshake: {
        auth: {
          token: "valid-token",
          device: "web"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    mockDecodeTokenSocket.mockReturnValue({
      isValid: true,
      data: {
        id: 55,
        profile: "admin",
        tenantId: 8
      }
    });
    mockFindUserByPk.mockResolvedValue(user);

    const middleware = bootMiddleware();
    await middleware(socket, next);

    expect(mockDecodeTokenSocket).toHaveBeenCalledWith("valid-token");
    expect(mockFindUserByPk).toHaveBeenCalledWith(55, {
      attributes: userAttributes
    });
    expect(socket.handshake.auth).toEqual({
      token: "valid-token",
      device: "web",
      id: "55",
      profile: "admin",
      tenantId: "8",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("returns authentication error when token validation fails", async () => {
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
        profile: "",
        tenantId: 0
      }
    });

    const middleware = bootMiddleware();
    await middleware(socket, next);

    expect(mockDecodeTokenSocket).toHaveBeenCalledWith("invalid-token");
    expect(mockFindUserByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
  });
});

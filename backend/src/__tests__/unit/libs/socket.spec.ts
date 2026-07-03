const mockAdapter = jest.fn();
const mockUse = jest.fn();
const mockOn = jest.fn();
const mockIo = {
  adapter: mockAdapter,
  use: mockUse,
  on: mockOn
};
const mockSocketIOConstructor = jest.fn(() => mockIo);
const mockSocketRedis = jest.fn(() => "redis-adapter");
const mockDecodeTokenSocket = jest.fn();
const mockUserFindByPk = jest.fn();
const mockLoggerInfo = jest.fn();
const mockLoggerWarn = jest.fn();
const mockChatRegister = jest.fn();

let registeredMiddleware: any;

mockUse.mockImplementation(middleware => {
  registeredMiddleware = middleware;
  return mockIo;
});

jest.mock("socket.io", () => ({
  Server: mockSocketIOConstructor
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
    findByPk: mockUserFindByPk
  }
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    info: mockLoggerInfo,
    warn: mockLoggerWarn
  }
}));

jest.mock("../../../libs/socketChat/Chat", () => ({
  __esModule: true,
  default: {
    register: mockChatRegister
  }
}));

import { initIO } from "../../../libs/socket";

describe("socket", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    registeredMiddleware = undefined;
    mockUse.mockImplementation(middleware => {
      registeredMiddleware = middleware;
      return mockIo;
    });
  });

  it("should accept a valid token without later rejecting the same socket", async () => {
    const user = { id: 42, tenantId: 77, name: "Valid User" };
    const socket = {
      id: "socket-1",
      handshake: {
        auth: {
          token: "valid-token",
          existing: "kept"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    mockDecodeTokenSocket.mockReturnValue({
      isValid: true,
      data: {
        id: 42,
        tenantId: 77,
        profile: "admin"
      }
    });
    mockUserFindByPk.mockResolvedValue(user);

    initIO({} as any);
    await registeredMiddleware(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(socket.handshake.auth).toMatchObject({
      token: "valid-token",
      existing: "kept",
      id: "42",
      tenantId: "77",
      profile: "admin",
      user
    });
    expect(mockUserFindByPk).toHaveBeenCalledWith(42, {
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
  });

  it("should reject an invalid token exactly once", async () => {
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
    await registeredMiddleware(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(new Error("authentication error"));
    expect(mockUserFindByPk).not.toHaveBeenCalled();
  });
});

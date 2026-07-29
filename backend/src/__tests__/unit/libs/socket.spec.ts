const mockAdapter = jest.fn();
const mockUse = jest.fn();
const mockOn = jest.fn();
const mockSocketRedis = jest.fn();
const mockDecodeTokenSocket = jest.fn();
const mockUserFindByPk = jest.fn();
const mockChatRegister = jest.fn();
const mockLoggerInfo = jest.fn();
const mockLoggerWarn = jest.fn();

let mockMiddleware: (socket: any, next: any) => Promise<void>;

const mockIo = {
  adapter: mockAdapter,
  use: mockUse,
  on: mockOn
};

jest.mock("socket.io", () => ({
  Server: jest.fn().mockImplementation(() => mockIo)
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

describe("socket initIO authentication middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUse.mockImplementation(middleware => {
      mockMiddleware = middleware;
      return mockIo;
    });
    mockSocketRedis.mockReturnValue("redis-adapter");
  });

  it("accepts a valid token once without also emitting an authentication error", async () => {
    const user = { id: 5, tenantId: 3, name: "Agent" };
    const socket = {
      id: "socket-1",
      handshake: {
        auth: {
          token: "valid-token",
          client: "web"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    mockDecodeTokenSocket.mockReturnValue({
      isValid: true,
      data: {
        id: 5,
        profile: "admin",
        tenantId: 3
      }
    });
    mockUserFindByPk.mockResolvedValue(user);

    initIO({} as any);
    await mockMiddleware(socket, next);

    expect(mockAdapter).toHaveBeenCalledWith("redis-adapter");
    expect(mockUserFindByPk).toHaveBeenCalledWith(5, {
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
      client: "web",
      id: "5",
      profile: "admin",
      tenantId: "3",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it("rejects an invalid token without loading a user", async () => {
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

    initIO({} as any);
    await mockMiddleware(socket, next);

    expect(mockUserFindByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
    expect(socket.emit).not.toHaveBeenCalled();
  });
});

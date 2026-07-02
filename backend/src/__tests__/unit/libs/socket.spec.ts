const mockAdapter = jest.fn();
const mockUse = jest.fn();
const mockOn = jest.fn();
const mockSocketServer = jest.fn().mockImplementation(() => ({
  adapter: mockAdapter,
  use: mockUse,
  on: mockOn
}));
const mockRedisAdapter = "redis-adapter";
const mockSocketRedis = jest.fn(() => mockRedisAdapter);

jest.mock("socket.io", () => ({
  Server: mockSocketServer
}));

jest.mock("socket.io-redis", () => mockSocketRedis);

jest.mock("../../../libs/decodeTokenSocket", () => jest.fn());

jest.mock("../../../models/User", () => ({
  findByPk: jest.fn()
}));

jest.mock("../../../libs/socketChat/Chat", () => ({
  register: jest.fn()
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn()
  }
}));

import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import { initIO } from "../../../libs/socket";
import User from "../../../models/User";

const mockDecodeTokenSocket = decodeTokenSocket as jest.MockedFunction<
  typeof decodeTokenSocket
>;
const mockUserFindByPk = User.findByPk as jest.Mock;

describe("socket initIO authentication middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.IO_REDIS_SERVER;
    delete process.env.IO_REDIS_PORT;
    delete process.env.IO_REDIS_USERNAME;
    delete process.env.IO_REDIS_PASSWORD;
  });

  it("should call next once and attach user data when token is valid", async () => {
    mockDecodeTokenSocket.mockReturnValue({
      isValid: true,
      data: {
        id: 7,
        tenantId: 12,
        email: "agent@example.com"
      }
    } as any);
    mockUserFindByPk.mockResolvedValue({ id: 7, tenantId: 12 } as any);

    initIO({} as any);
    const middleware = mockUse.mock.calls[0][0];
    const socket = {
      handshake: {
        auth: {
          token: "valid-token",
          keep: "value"
        }
      }
    };
    const next = jest.fn();

    await middleware(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
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
    expect(socket.handshake.auth).toMatchObject({
      keep: "value",
      email: "agent@example.com",
      id: "7",
      tenantId: "12",
      user: { id: 7, tenantId: 12 }
    });
  });

  it("should reject the connection when token is invalid", async () => {
    mockDecodeTokenSocket.mockReturnValue({
      isValid: false,
      data: {}
    } as any);

    initIO({} as any);
    const middleware = mockUse.mock.calls[0][0];
    const socket = {
      id: "socket-id",
      emit: jest.fn(),
      handshake: {
        auth: {
          token: "invalid-token"
        }
      }
    };
    const next = jest.fn();

    await middleware(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
    expect(mockUserFindByPk).not.toHaveBeenCalled();
  });
});

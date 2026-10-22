const mockAdapter = jest.fn();
const mockUse = jest.fn();
const mockOn = jest.fn();
const mockServerInstance = {
  adapter: mockAdapter,
  use: mockUse,
  on: mockOn
};

jest.mock("socket.io", () => ({
  Server: jest.fn(() => mockServerInstance)
}));

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
    warn: jest.fn()
  }
}));

import { Server as SocketIOServer } from "socket.io";
import decodeTokenSocket from "../../libs/decodeTokenSocket";
import { initIO } from "../../libs/socket";
import User from "../../models/User";

describe("socket initIO authentication middleware", () => {
  const httpServer = {} as any;

  beforeEach(() => {
    mockUse.mockClear();
    mockAdapter.mockClear();
    mockOn.mockClear();
  });

  const initAndGetMiddleware = () => {
    initIO(httpServer);

    return mockUse.mock.calls[0][0];
  };

  it("allows a valid token without also returning an authentication error", async () => {
    const user = { id: 7, tenantId: 12, name: "Jane" };
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 7,
        tenantId: 12,
        profile: "admin"
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue(user);

    const middleware = initAndGetMiddleware();
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

    expect(SocketIOServer).toHaveBeenCalledWith(
      httpServer,
      expect.objectContaining({
        cors: { origin: "*" },
        pingTimeout: 180000,
        pingInterval: 60000
      })
    );
    expect(User.findByPk).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        attributes: expect.arrayContaining(["id", "tenantId", "email"])
      })
    );
    expect(socket.handshake.auth).toMatchObject({
      token: "valid-token",
      keep: "value",
      id: "7",
      tenantId: "12",
      profile: "admin",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects an invalid token", async () => {
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: {}
    });

    const middleware = initAndGetMiddleware();
    const socket = {
      handshake: {
        auth: {
          token: "invalid-token"
        }
      }
    };
    const next = jest.fn();

    await middleware(socket, next);

    expect(User.findByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
  });
});

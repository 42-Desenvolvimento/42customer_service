jest.mock("socket.io", () => ({
  Server: jest.fn()
}));

jest.mock("socket.io-redis", () => jest.fn(() => "redis-adapter"));

jest.mock("../../libs/decodeTokenSocket", () => jest.fn());

jest.mock("../../models/User", () => ({
  findByPk: jest.fn()
}));

jest.mock("../../libs/socketChat/Chat", () => ({
  register: jest.fn()
}));

jest.mock("../../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn()
  }
}));

import { Server as SocketIOServer } from "socket.io";
import socketRedis from "socket.io-redis";
import decodeTokenSocket from "../../libs/decodeTokenSocket";
import User from "../../models/User";
import { initIO } from "../../libs/socket";

describe("socket auth middleware", () => {
  const adapter = jest.fn();
  const use = jest.fn();
  const on = jest.fn();
  let ioMock: any;

  beforeEach(() => {
    ioMock = {
      adapter,
      use,
      on
    };

    (SocketIOServer as unknown as jest.Mock).mockImplementation(() => ioMock);
    adapter.mockClear();
    use.mockClear();
    on.mockClear();
  });

  it("authenticates a valid token without raising an authentication error", async () => {
    const user = { id: 10, tenantId: 20, name: "Valid User" };
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 10,
        tenantId: 20,
        profile: "admin"
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue(user);

    initIO({} as any);

    expect(SocketIOServer).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        cors: { origin: "*" },
        pingTimeout: 180000,
        pingInterval: 60000
      })
    );
    expect(socketRedis).toHaveBeenCalled();
    expect(adapter).toHaveBeenCalledWith("redis-adapter");

    const authMiddleware = use.mock.calls[0][0];
    const next = jest.fn();
    const socket = {
      handshake: {
        auth: {
          token: "valid-token",
          client: "web"
        }
      }
    };

    await authMiddleware(socket, next);

    expect(decodeTokenSocket).toHaveBeenCalledWith("valid-token");
    expect(User.findByPk).toHaveBeenCalledWith(10, {
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
      id: "10",
      tenantId: "20",
      profile: "admin",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });
});

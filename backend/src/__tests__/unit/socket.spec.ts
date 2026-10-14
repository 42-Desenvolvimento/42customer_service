jest.mock("socket.io", () => ({
  Server: jest.fn().mockImplementation(() => ({
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn()
  }))
}));
jest.mock("socket.io-redis", () => jest.fn(() => "redis-adapter"));
jest.mock("../../libs/decodeTokenSocket", () => jest.fn());
jest.mock("../../models/User", () => ({ findByPk: jest.fn() }));
jest.mock("../../libs/socketChat/Chat", () => ({ register: jest.fn() }));
jest.mock("../../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn()
  }
}));

import { Server as SocketIOServer } from "socket.io";
import decodeTokenSocket from "../../libs/decodeTokenSocket";
import User from "../../models/User";
import { initIO } from "../../libs/socket";

describe("socket IO authentication middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("allows a valid token without also reporting an authentication error", async () => {
    const user = { id: 7, tenantId: 42, name: "Jane" };
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 7,
        tenantId: 42,
        profile: "admin"
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue(user);

    const io = initIO({} as any) as any;
    const middleware = io.use.mock.calls[0][0];
    const next = jest.fn();
    const socket = {
      handshake: {
        auth: {
          token: "valid-token",
          existing: "value"
        }
      }
    };

    await middleware(socket, next);

    expect(SocketIOServer).toHaveBeenCalledWith(
      {},
      {
        cors: { origin: "*" },
        pingTimeout: 180000,
        pingInterval: 60000
      }
    );
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(socket.handshake.auth).toMatchObject({
      token: "valid-token",
      existing: "value",
      id: "7",
      tenantId: "42",
      profile: "admin",
      user
    });
    expect(User.findByPk).toHaveBeenCalledWith(7, {
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
});

export {};

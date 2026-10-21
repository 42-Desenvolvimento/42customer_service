jest.mock("socket.io", () => ({
  Server: jest.fn().mockImplementation(() => ({
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn()
  }))
}));

jest.mock("socket.io-redis", () => jest.fn(() => "redis-adapter"));

jest.mock("../../libs/decodeTokenSocket", () => ({
  __esModule: true,
  default: jest.fn()
}));

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
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  }
}));

import { Server as SocketIOServer } from "socket.io";
import decodeTokenSocket from "../../libs/decodeTokenSocket";
import { initIO } from "../../libs/socket";
import User from "../../models/User";

describe("socket authentication middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("allows a valid token without also reporting an authentication error", async () => {
    const decodedToken = {
      isValid: true,
      data: {
        id: 123,
        profile: "admin",
        tenantId: 456
      }
    };
    const user = { id: 123, tenantId: 456, name: "Jane" };

    (decodeTokenSocket as jest.Mock).mockReturnValue(decodedToken);
    (User.findByPk as jest.Mock).mockResolvedValue(user);

    const io = initIO({} as any);
    const middleware = (io.use as jest.Mock).mock.calls[0][0];
    const socket = {
      handshake: {
        auth: {
          token: "valid-token",
          custom: "kept"
        }
      },
      emit: jest.fn()
    } as any;
    const next = jest.fn();

    await middleware(socket, next);

    expect(SocketIOServer).toHaveBeenCalledWith(
      {},
      {
        cors: {
          origin: "*"
        },
        pingTimeout: 180000,
        pingInterval: 60000
      }
    );
    expect(socket.handshake.auth).toMatchObject({
      token: "valid-token",
      custom: "kept",
      id: "123",
      profile: "admin",
      tenantId: "456",
      user
    });
    expect(User.findByPk).toHaveBeenCalledWith(123, {
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
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects an invalid token without loading a user", async () => {
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });

    const io = initIO({} as any);
    const middleware = (io.use as jest.Mock).mock.calls[0][0];
    const next = jest.fn();

    await middleware(
      {
        handshake: {
          auth: {
            token: "invalid-token"
          }
        },
        emit: jest.fn()
      },
      next
    );

    expect(User.findByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
  });
});

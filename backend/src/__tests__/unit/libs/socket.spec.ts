jest.mock("socket.io", () => ({
  Server: jest.fn().mockImplementation(() => ({
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn()
  }))
}));

jest.mock("socket.io-redis", () => jest.fn(() => "redis-adapter"));

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

import { Server as SocketIOServer } from "socket.io";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import User from "../../../models/User";
import { initIO } from "../../../libs/socket";

describe("socket initIO authentication", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should call next without authentication error for a valid token", async () => {
    const authenticatedUser = {
      id: 12,
      tenantId: 34,
      name: "Agent"
    };
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

    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 12,
        profile: "admin",
        tenantId: 34
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue(authenticatedUser);

    const io = initIO({} as any) as any;
    const middleware = io.use.mock.calls[0][0];

    await middleware(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]).toEqual([]);
    expect(socket.handshake.auth).toEqual({
      token: "valid-token",
      client: "web",
      id: "12",
      profile: "admin",
      tenantId: "34",
      user: authenticatedUser
    });
    expect(User.findByPk).toHaveBeenCalledWith(12, {
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

  it("should reject sockets with invalid tokens", async () => {
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

    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });

    const io = initIO({} as any) as any;
    const middleware = io.use.mock.calls[0][0];

    await middleware(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
    expect(User.findByPk).not.toHaveBeenCalled();
    expect(SocketIOServer).toHaveBeenCalled();
  });
});

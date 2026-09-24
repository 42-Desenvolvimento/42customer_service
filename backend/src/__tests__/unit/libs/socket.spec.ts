jest.mock("socket.io", () => {
  const Server = jest.fn().mockImplementation(() => ({
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn(),
    to: jest.fn()
  }));

  return { Server };
});

jest.mock("socket.io-redis", () => jest.fn(() => "redis-adapter"));

jest.mock("../../../libs/decodeTokenSocket", () => jest.fn());

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
import { logger } from "../../../utils/logger";

describe("socket initIO authentication middleware", () => {
  const getMiddleware = () => {
    const io = initIO({} as any) as any;
    return io.use.mock.calls[0][0];
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should authenticate valid tokens without calling next with an error", async () => {
    const user = { id: 123, name: "Jane Doe" };
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 123,
        profile: "admin",
        tenantId: 456
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue(user);

    const middleware = getMiddleware();
    const socket = {
      id: "socket-1",
      handshake: {
        auth: {
          token: "valid-token",
          client: "web"
        }
      },
      emit: jest.fn()
    } as any;
    const next = jest.fn();

    await middleware(socket, next);

    expect(SocketIOServer).toHaveBeenCalledTimes(1);
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
    expect(socket.handshake.auth).toEqual({
      token: "valid-token",
      client: "web",
      id: "123",
      profile: "admin",
      tenantId: "456",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("should reject invalid tokens", async () => {
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });

    const middleware = getMiddleware();
    const next = jest.fn();

    await middleware(
      {
        id: "socket-2",
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

  it("should emit tokenInvalid when token decoding throws", async () => {
    (decodeTokenSocket as jest.Mock).mockImplementation(() => {
      throw new Error("jwt malformed");
    });

    const middleware = getMiddleware();
    const socket = {
      id: "socket-3",
      handshake: {
        auth: {
          token: "malformed-token"
        }
      },
      emit: jest.fn()
    } as any;
    const next = jest.fn();

    await middleware(socket, next);

    expect(logger.warn).toHaveBeenCalledWith(`tokenInvalid: ${socket}`);
    expect(socket.emit).toHaveBeenCalledWith("tokenInvalid:socket-3");
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
  });
});

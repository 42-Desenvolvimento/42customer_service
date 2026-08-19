jest.mock("socket.io", () => {
  const mockIo = {
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn()
  };

  return {
    Server: jest.fn(() => mockIo),
    __mockIo: mockIo
  };
});

jest.mock("socket.io-redis", () => ({
  __esModule: true,
  default: jest.fn(() => "redis-adapter")
}));

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

import { Server as SocketServer } from "socket.io";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import { initIO } from "../../../libs/socket";
import User from "../../../models/User";

describe("socket initIO authentication middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const getMiddleware = () => {
    const socketIoMock = jest.requireMock("socket.io").__mockIo;
    initIO({} as any);

    return socketIoMock.use.mock.calls[0][0];
  };

  it("allows a valid token without also returning an authentication error", async () => {
    const authenticatedUser = { id: 7, tenantId: 3, name: "Agent" };
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 7,
        tenantId: 3,
        profile: "admin"
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue(authenticatedUser);

    const middleware = getMiddleware();
    const socket = {
      handshake: {
        auth: {
          token: "valid-token"
        }
      }
    };
    const next = jest.fn();

    await middleware(socket, next);

    expect(SocketServer).toHaveBeenCalledTimes(1);
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
    expect(socket.handshake.auth).toMatchObject({
      id: "7",
      tenantId: "3",
      profile: "admin",
      user: authenticatedUser
    });
    expect(next.mock.calls).toEqual([[]]);
  });

  it("rejects an invalid token with a single authentication error", async () => {
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: {}
    });

    const middleware = getMiddleware();
    const next = jest.fn();

    await middleware(
      {
        handshake: {
          auth: {
            token: "invalid-token"
          }
        }
      },
      next
    );

    expect(User.findByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
  });
});

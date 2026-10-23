import { initIO } from "../../../libs/socket";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import User from "../../../models/User";

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

describe("socket initIO authentication middleware", () => {
  const getAuthenticationMiddleware = () => {
    const socketIoMock = jest.requireMock("socket.io") as {
      __mockIo: {
        use: jest.Mock;
      };
    };

    initIO({} as any);

    return socketIoMock.__mockIo.use.mock.calls[0][0];
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("hydrates auth data and calls next without error for a valid token", async () => {
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 7,
        profile: "admin",
        tenantId: 11
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue({ id: 7, name: "Agent" });

    const middleware = getAuthenticationMiddleware();
    const socket = {
      id: "socket-1",
      handshake: {
        auth: {
          token: "jwt-token",
          existing: "value"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    await middleware(socket, next);

    expect(decodeTokenSocket).toHaveBeenCalledWith("jwt-token");
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
      existing: "value",
      id: "7",
      profile: "admin",
      tenantId: "11",
      user: { id: 7, name: "Agent" }
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects sockets with invalid tokens", async () => {
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });

    const middleware = getAuthenticationMiddleware();
    const next = jest.fn();

    await middleware(
      {
        id: "socket-2",
        handshake: {
          auth: {
            token: "bad-token"
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

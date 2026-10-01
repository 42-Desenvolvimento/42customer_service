export {};

jest.mock("socket.io", () => {
  const mockSocketServer = {
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn()
  };

  return {
    Server: jest.fn(() => mockSocketServer),
    __mockSocketServer: mockSocketServer
  };
});

jest.mock("socket.io-redis", () => jest.fn(() => "redis-adapter"));
jest.mock("../../../libs/decodeTokenSocket", () => jest.fn());
jest.mock("../../../models/User", () => ({
  findByPk: jest.fn()
}));
jest.mock("../../../libs/socketChat/Chat", () => ({
  __esModule: true,
  default: {
    register: jest.fn()
  }
}));
jest.mock("../../../utils/logger", () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

const decodeTokenSocket = jest.requireMock(
  "../../../libs/decodeTokenSocket"
) as jest.Mock;
const User = jest.requireMock("../../../models/User") as {
  findByPk: jest.Mock;
};
const socketIo = jest.requireMock("socket.io") as {
  Server: jest.Mock;
  __mockSocketServer: {
    adapter: jest.Mock;
    use: jest.Mock;
    on: jest.Mock;
  };
};

describe("socket initIO authentication middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("accepts a valid token without also returning an authentication error", async () => {
    const { initIO } = jest.requireActual("../../../libs/socket");
    const user = {
      id: 9,
      tenantId: 4,
      name: "Agent"
    };

    decodeTokenSocket.mockReturnValue({
      isValid: true,
      data: {
        id: 9,
        profile: "admin",
        tenantId: 4
      }
    });
    User.findByPk.mockResolvedValue(user);

    initIO({} as any);

    const middleware = socketIo.__mockSocketServer.use.mock.calls[0][0];
    const socket = {
      handshake: {
        auth: {
          token: "valid-token",
          device: "browser"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    await middleware(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(socket.handshake.auth).toEqual({
      token: "valid-token",
      device: "browser",
      id: "9",
      profile: "admin",
      tenantId: "4",
      user
    });
    expect(User.findByPk).toHaveBeenCalledWith(9, {
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

  it("rejects an invalid token", async () => {
    const { initIO } = jest.requireActual("../../../libs/socket");

    decodeTokenSocket.mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });

    initIO({} as any);

    const middleware = socketIo.__mockSocketServer.use.mock.calls[0][0];
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

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
    expect(User.findByPk).not.toHaveBeenCalled();
  });
});

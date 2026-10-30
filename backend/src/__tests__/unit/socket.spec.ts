jest.mock("socket.io", () => ({
  Server: jest.fn().mockImplementation(() => ({
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn()
  }))
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

const { Server: SocketServer } = require("socket.io");
const decodeTokenSocket = require("../../libs/decodeTokenSocket") as jest.Mock;
const User = require("../../models/User").default;
const { initIO } = require("../../libs/socket");

describe("socket initIO auth middleware", () => {
  const createMiddleware = () => {
    initIO({} as any);
    const io = (SocketServer as jest.Mock).mock.results[0].value;
    return io.use.mock.calls[0][0];
  };

  beforeEach(() => {
    decodeTokenSocket.mockReset();
    User.findByPk.mockReset();
  });

  it("accepts a valid token without also reporting an authentication error", async () => {
    const user = { id: 7, name: "Agent" };
    decodeTokenSocket.mockReturnValue({
      isValid: true,
      data: {
        id: 7,
        profile: "admin",
        tenantId: 42
      }
    });
    User.findByPk.mockResolvedValue(user);

    const middleware = createMiddleware();
    const next = jest.fn();
    const socket = {
      id: "socket-1",
      handshake: {
        auth: {
          token: "valid-token",
          keep: "value"
        }
      },
      emit: jest.fn()
    };

    await middleware(socket, next);

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
      token: "valid-token",
      keep: "value",
      id: "7",
      tenantId: "42",
      profile: "admin",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects an invalid token once without loading a user", async () => {
    decodeTokenSocket.mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });

    const middleware = createMiddleware();
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
});

export {};

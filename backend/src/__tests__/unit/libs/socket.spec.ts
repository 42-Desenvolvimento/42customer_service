import { Server as HttpServer } from "http";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import { initIO } from "../../../libs/socket";
import User from "../../../models/User";

jest.mock("socket.io", () => {
  const socketInstance = {
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn()
  };

  return {
    Server: jest.fn(() => socketInstance),
    __socketInstance: socketInstance
  };
});

jest.mock("socket.io-redis", () => jest.fn(() => "redis-adapter"));
jest.mock("../../../libs/decodeTokenSocket", () => jest.fn());
jest.mock("../../../models/User", () => ({
  findByPk: jest.fn()
}));
jest.mock("../../../libs/socketChat/Chat", () => ({
  register: jest.fn()
}));
jest.mock("../../../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn()
  }
}));

const getSocketInstance = () => jest.requireMock("socket.io").__socketInstance;

const buildAuthMiddleware = () => {
  initIO({} as HttpServer);
  return getSocketInstance().use.mock.calls[0][0];
};

describe("Socket IO authentication", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should accept a valid token without also returning authentication error", async () => {
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 42,
        tenantId: 7,
        profile: "admin"
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue({
      id: 42,
      tenantId: 7,
      name: "Valid User"
    });

    const middleware = buildAuthMiddleware();
    const next = jest.fn();
    const socket = {
      handshake: {
        auth: {
          token: "valid-token",
          client: "web"
        }
      },
      emit: jest.fn()
    };

    await middleware(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]).toEqual([]);
    expect(socket.handshake.auth).toMatchObject({
      token: "valid-token",
      client: "web",
      id: "42",
      tenantId: "7",
      profile: "admin",
      user: {
        id: 42,
        tenantId: 7,
        name: "Valid User"
      }
    });
    expect(User.findByPk).toHaveBeenCalledWith(42, {
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

  it("should reject an invalid token exactly once", async () => {
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: {
        id: "",
        tenantId: 0,
        profile: ""
      }
    });

    const middleware = buildAuthMiddleware();
    const next = jest.fn();
    const socket = {
      handshake: {
        auth: {
          token: "invalid-token"
        }
      },
      emit: jest.fn()
    };

    await middleware(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(next.mock.calls[0][0].message).toBe("authentication error");
    expect(User.findByPk).not.toHaveBeenCalled();
  });
});

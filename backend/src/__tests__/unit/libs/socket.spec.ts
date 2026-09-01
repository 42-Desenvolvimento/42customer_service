jest.mock("socket.io", () => {
  const serverInstance = {
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn(),
    to: jest.fn()
  };

  return {
    Server: jest.fn(() => serverInstance),
    __serverInstance: serverInstance
  };
});

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

import { initIO } from "../../../libs/socket";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import User from "../../../models/User";

const socketIOMock = jest.requireMock("socket.io");
const decodeTokenSocketMock = decodeTokenSocket as jest.Mock;
const findByPkMock = User.findByPk as jest.Mock;

const getAuthMiddleware = () => {
  initIO({} as never);
  return socketIOMock.__serverInstance.use.mock.calls[0][0];
};

describe("libs/socket initIO authentication middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("hydrates socket auth and calls next once when token is valid", async () => {
    const user = { id: 12, tenantId: 34, name: "Agent" };
    decodeTokenSocketMock.mockReturnValue({
      isValid: true,
      data: {
        id: 12,
        profile: "admin",
        tenantId: 34
      }
    });
    findByPkMock.mockResolvedValue(user);

    const middleware = getAuthMiddleware();
    const next = jest.fn();
    const socket = {
      handshake: {
        auth: {
          token: "valid-token",
          client: "web"
        }
      }
    };

    await middleware(socket, next);

    expect(findByPkMock).toHaveBeenCalledWith(12, {
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
      client: "web",
      id: "12",
      tenantId: "34",
      profile: "admin",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects invalid tokens without loading a user", async () => {
    decodeTokenSocketMock.mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });

    const middleware = getAuthMiddleware();
    const next = jest.fn();
    const socket = {
      handshake: {
        auth: {
          token: "bad-token"
        }
      }
    };

    await middleware(socket, next);

    expect(findByPkMock).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(next.mock.calls[0][0].message).toBe("authentication error");
  });
});

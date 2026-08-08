jest.mock("socket.io", () => {
  const mockServerInstance = {
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn()
  };

  return {
    Server: jest.fn(() => mockServerInstance),
    __mockServerInstance: mockServerInstance
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

import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import User from "../../../models/User";
import { initIO } from "../../../libs/socket";

describe("socket initIO authentication middleware", () => {
  const socketIoMock = jest.requireMock("socket.io") as any;
  const decodeTokenSocketMock = decodeTokenSocket as jest.Mock;
  const findByPkMock = User.findByPk as jest.Mock;

  beforeEach(() => {
    socketIoMock.Server.mockClear();
    socketIoMock.__mockServerInstance.adapter.mockClear();
    socketIoMock.__mockServerInstance.use.mockClear();
    socketIoMock.__mockServerInstance.on.mockClear();
    decodeTokenSocketMock.mockReset();
    findByPkMock.mockReset();
  });

  const loadAuthMiddleware = () => {
    initIO({} as any);

    expect(socketIoMock.__mockServerInstance.use).toHaveBeenCalledTimes(1);
    return socketIoMock.__mockServerInstance.use.mock.calls[0][0];
  };

  it("allows a valid token and enriches socket auth data", async () => {
    const user = { id: 42, tenantId: 7, name: "Maria" };
    decodeTokenSocketMock.mockReturnValue({
      isValid: true,
      data: {
        id: 42,
        tenantId: 7,
        profile: "admin"
      }
    });
    findByPkMock.mockResolvedValue(user);

    const middleware = loadAuthMiddleware();
    const socket = {
      handshake: {
        auth: {
          token: "valid-token",
          other: "kept"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    await middleware(socket, next);

    expect(decodeTokenSocketMock).toHaveBeenCalledWith("valid-token");
    expect(findByPkMock).toHaveBeenCalledWith(42, {
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
      other: "kept",
      id: "42",
      tenantId: "7",
      profile: "admin",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]).toHaveLength(0);
  });

  it("rejects an invalid token without loading a user", async () => {
    decodeTokenSocketMock.mockReturnValue({
      isValid: false,
      data: {
        id: "",
        tenantId: 0,
        profile: ""
      }
    });

    const middleware = loadAuthMiddleware();
    const socket = {
      id: "socket-1",
      handshake: {
        auth: {
          token: "bad-token"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    await middleware(socket, next);

    expect(findByPkMock).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    const [error] = next.mock.calls[0];
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("authentication error");
  });
});

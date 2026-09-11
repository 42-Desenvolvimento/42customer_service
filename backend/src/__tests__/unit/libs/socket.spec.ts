jest.mock("socket.io", () => {
  const socketIO = {
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn()
  };

  return {
    Server: jest.fn(() => socketIO),
    __socketIO: socketIO
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

import { Server as SocketIOServer } from "socket.io";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import { initIO } from "../../../libs/socket";
import User from "../../../models/User";

const socketIOMock = jest.requireMock("socket.io") as {
  Server: jest.Mock;
  __socketIO: {
    adapter: jest.Mock;
    use: jest.Mock;
    on: jest.Mock;
  };
};

const decodeTokenSocketMock = decodeTokenSocket as jest.Mock;
const findUserByPkMock = User.findByPk as jest.Mock;

describe("socket initIO authentication", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const getAuthMiddleware = () => {
    initIO({} as any);
    return socketIOMock.__socketIO.use.mock.calls[0][0];
  };

  it("should authenticate a valid token with a single successful next call", async () => {
    const user = { id: 7, name: "Agent", tenantId: 42 };
    decodeTokenSocketMock.mockReturnValue({
      isValid: true,
      data: {
        id: 7,
        profile: "admin",
        tenantId: 42
      }
    });
    findUserByPkMock.mockResolvedValue(user);

    const middleware = getAuthMiddleware();
    const next = jest.fn();
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

    await middleware(socket, next);

    expect(SocketIOServer).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        cors: { origin: "*" }
      })
    );
    expect(findUserByPkMock).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        attributes: expect.arrayContaining(["id", "tenantId", "email"])
      })
    );
    expect(socket.handshake.auth).toEqual({
      token: "valid-token",
      client: "web",
      id: "7",
      profile: "admin",
      tenantId: "42",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("should reject an invalid token without loading a user", async () => {
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
      id: "socket-2",
      handshake: {
        auth: {
          token: "invalid-token"
        }
      },
      emit: jest.fn()
    };

    await middleware(socket, next);

    expect(findUserByPkMock).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
  });
});

export {};

jest.mock("socket.io", () => {
  const serverInstances: any[] = [];
  const Server = jest.fn().mockImplementation(() => {
    const instance = {
      adapter: jest.fn(),
      use: jest.fn(),
      on: jest.fn(),
      emit: jest.fn(),
      to: jest.fn(() => ({ emit: jest.fn() }))
    };
    serverInstances.push(instance);
    return instance;
  });

  return { Server, __serverInstances: serverInstances };
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
    warn: jest.fn(),
    error: jest.fn()
  }
}));

import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import { initIO } from "../../../libs/socket";
import User from "../../../models/User";
import { logger } from "../../../utils/logger";

const socketIoMock = jest.requireMock("socket.io") as {
  Server: jest.Mock;
  __serverInstances: any[];
};

const getAuthMiddleware = () => {
  const io = initIO({} as any) as any;
  expect(io.use).toHaveBeenCalledTimes(1);
  return io.use.mock.calls[0][0];
};

describe("socket initIO authentication middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    socketIoMock.__serverInstances.length = 0;
  });

  it("accepts a valid token without also raising an authentication error", async () => {
    const authenticatedUser = { id: 42, name: "Jane" };
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: { id: 42, profile: "admin", tenantId: 7 }
    });
    (User.findByPk as jest.Mock).mockResolvedValue(authenticatedUser);

    const middleware = getAuthMiddleware();
    const socket = {
      id: "socket-1",
      emit: jest.fn(),
      handshake: {
        auth: {
          token: "valid-token",
          alreadyPresent: "kept"
        }
      }
    };
    const next = jest.fn();

    await middleware(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]).toEqual([]);
    expect(socket.handshake.auth).toEqual({
      token: "valid-token",
      alreadyPresent: "kept",
      id: "42",
      profile: "admin",
      tenantId: "7",
      user: authenticatedUser
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

  it("rejects an invalid token", async () => {
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: { id: "", profile: "", tenantId: 0 }
    });

    const middleware = getAuthMiddleware();
    const next = jest.fn();

    await middleware(
      {
        id: "socket-2",
        emit: jest.fn(),
        handshake: { auth: { token: "invalid-token" } }
      },
      next
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
    expect(User.findByPk).not.toHaveBeenCalled();
  });

  it("emits tokenInvalid and rejects when token decoding throws", async () => {
    const tokenError = new Error("jwt malformed");
    (decodeTokenSocket as jest.Mock).mockImplementation(() => {
      throw tokenError;
    });

    const middleware = getAuthMiddleware();
    const socket = {
      id: "socket-3",
      emit: jest.fn(),
      handshake: { auth: { token: "broken-token" } }
    };
    const next = jest.fn();

    await middleware(socket, next);

    expect(logger.warn).toHaveBeenCalledWith(`tokenInvalid: ${socket}`);
    expect(socket.emit).toHaveBeenCalledWith("tokenInvalid:socket-3");
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
  });
});

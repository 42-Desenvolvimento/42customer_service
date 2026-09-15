export {};

jest.mock("socket.io", () => ({
  Server: jest.fn().mockImplementation(() => ({
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn()
  }))
}));

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

import { Server as SocketIOServer } from "socket.io";
import { initIO } from "../../../libs/socket";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import User from "../../../models/User";
import { logger } from "../../../utils/logger";

const SocketIOServerMock = SocketIOServer as unknown as jest.Mock;
const decodeTokenSocketMock = decodeTokenSocket as jest.Mock;
const findByPkMock = User.findByPk as jest.Mock;
const loggerWarnMock = logger.warn as jest.Mock;

const buildSocket = (token?: string) =>
  ({
    id: "socket-1",
    handshake: {
      auth: {
        token,
        existingAuthData: "kept"
      }
    },
    emit: jest.fn(),
    join: jest.fn(),
    on: jest.fn()
  } as any);

const getAuthMiddleware = () => {
  initIO({} as any);
  const io = SocketIOServerMock.mock.results[0].value;

  return io.use.mock.calls[0][0] as (
    socket: any,
    next: jest.Mock
  ) => Promise<void>;
};

describe("socket initIO auth middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should allow a valid token exactly once and enrich socket auth data", async () => {
    const user = { id: 42, name: "Socket User" };
    decodeTokenSocketMock.mockReturnValue({
      isValid: true,
      data: {
        id: 42,
        profile: "admin",
        tenantId: 7
      }
    });
    findByPkMock.mockResolvedValue(user);
    const middleware = getAuthMiddleware();
    const socket = buildSocket("valid-token");
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
    expect(socket.handshake.auth).toMatchObject({
      token: "valid-token",
      existingAuthData: "kept",
      id: "42",
      profile: "admin",
      tenantId: "7",
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
    const socket = buildSocket("invalid-token");
    const next = jest.fn();

    await middleware(socket, next);

    expect(findByPkMock).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(next.mock.calls[0][0].message).toBe("authentication error");
  });

  it("should emit tokenInvalid and reject when token decoding throws", async () => {
    decodeTokenSocketMock.mockImplementation(() => {
      throw new Error("unexpected decode failure");
    });
    const middleware = getAuthMiddleware();
    const socket = buildSocket("broken-token");
    const next = jest.fn();

    await middleware(socket, next);

    expect(loggerWarnMock).toHaveBeenCalledWith(`tokenInvalid: ${socket}`);
    expect(socket.emit).toHaveBeenCalledWith("tokenInvalid:socket-1");
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(next.mock.calls[0][0].message).toBe("authentication error");
  });
});

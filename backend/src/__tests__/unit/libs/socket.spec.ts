import { Server as SocketIOServer } from "socket.io";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import { initIO } from "../../../libs/socket";
import Chat from "../../../libs/socketChat/Chat";
import User from "../../../models/User";
import { logger } from "../../../utils/logger";

jest.mock("socket.io", () => {
  const MockServer = jest.fn().mockImplementation(() => ({
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn()
  }));

  return { Server: MockServer };
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

const getSocketServerInstance = () => {
  const ServerMock = SocketIOServer as unknown as jest.Mock;
  return ServerMock.mock.results[0].value;
};

const getAuthMiddleware = () => {
  initIO({} as any);
  const io = getSocketServerInstance();
  return io.use.mock.calls[0][0] as (socket: any, next: jest.Mock) => Promise<void>;
};

const makeSocket = (token?: string) => ({
  id: "socket-1",
  handshake: {
    auth: {
      token,
      original: "preserved"
    }
  },
  emit: jest.fn(),
  join: jest.fn(),
  on: jest.fn()
});

describe("socket initIO authentication middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("accepts a valid token once and preserves decoded auth data", async () => {
    const user = { id: 7, tenantId: 42, name: "Jane" };
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 7,
        profile: "admin",
        tenantId: 42
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue(user);

    const middleware = getAuthMiddleware();
    const socket = makeSocket("valid-token");
    const next = jest.fn();

    await middleware(socket, next);

    expect(next.mock.calls).toEqual([[]]);
    expect(socket.handshake.auth).toEqual({
      token: "valid-token",
      original: "preserved",
      id: "7",
      profile: "admin",
      tenantId: "42",
      user
    });
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
  });

  it("rejects an invalid token once without loading a user", async () => {
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });

    const middleware = getAuthMiddleware();
    const socket = makeSocket("invalid-token");
    const next = jest.fn();

    await middleware(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
    expect(User.findByPk).not.toHaveBeenCalled();
  });

  it("emits tokenInvalid and rejects once when decoding throws", async () => {
    (decodeTokenSocket as jest.Mock).mockImplementation(() => {
      throw new Error("decode failed");
    });

    const middleware = getAuthMiddleware();
    const socket = makeSocket("broken-token");
    const next = jest.fn();

    await middleware(socket, next);

    expect(logger.warn).toHaveBeenCalledWith(`tokenInvalid: ${socket}`);
    expect(socket.emit).toHaveBeenCalledWith("tokenInvalid:socket-1");
    expect(Chat.register).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
  });
});

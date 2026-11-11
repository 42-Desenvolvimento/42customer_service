jest.mock("socket.io", () => ({
  Server: jest.fn().mockImplementation(() => ({
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn()
  }))
}));

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
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

const decodeTokenSocketMock = jest.requireMock(
  "../../../libs/decodeTokenSocket"
) as jest.Mock;
const userMock = jest.requireMock("../../../models/User").default;
const loggerMock = jest.requireMock("../../../utils/logger").logger;

const userAttributes = [
  "id",
  "tenantId",
  "name",
  "email",
  "profile",
  "status",
  "lastLogin",
  "lastOnline"
];

const getAuthMiddleware = async () => {
  const { initIO } = await import("../../../libs/socket");
  const { Server } = jest.requireMock("socket.io");

  initIO({} as never);

  const io = Server.mock.results[0].value;
  return io.use.mock.calls[0][0] as (
    socket: any,
    next: (err?: Error) => void
  ) => Promise<void>;
};

describe("socket authentication middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("allows valid tokens and calls next only once without an error", async () => {
    const user = { id: 12, tenantId: 34, name: "Ana" };
    decodeTokenSocketMock.mockReturnValue({
      isValid: true,
      data: {
        id: 12,
        profile: "admin",
        tenantId: 34
      }
    });
    userMock.findByPk.mockResolvedValue(user);
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
    const next = jest.fn();

    const middleware = await getAuthMiddleware();
    await middleware(socket, next);

    expect(decodeTokenSocketMock).toHaveBeenCalledWith("valid-token");
    expect(userMock.findByPk).toHaveBeenCalledWith(12, {
      attributes: userAttributes
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
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it("rejects invalid tokens without loading the user", async () => {
    decodeTokenSocketMock.mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });
    const socket = {
      id: "socket-2",
      handshake: {
        auth: {
          token: "invalid-token"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    const middleware = await getAuthMiddleware();
    await middleware(socket, next);

    expect(userMock.findByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(next.mock.calls[0][0].message).toBe("authentication error");
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it("emits tokenInvalid and rejects when token decoding throws", async () => {
    decodeTokenSocketMock.mockImplementation(() => {
      throw new Error("jwt failure");
    });
    const socket = {
      id: "socket-3",
      handshake: {
        auth: {
          token: "broken-token"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    const middleware = await getAuthMiddleware();
    await middleware(socket, next);

    expect(loggerMock.warn).toHaveBeenCalledWith(`tokenInvalid: ${socket}`);
    expect(socket.emit).toHaveBeenCalledWith("tokenInvalid:socket-3");
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(next.mock.calls[0][0].message).toBe("authentication error");
  });
});

export {};

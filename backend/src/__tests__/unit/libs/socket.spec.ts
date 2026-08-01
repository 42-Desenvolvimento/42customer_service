import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import { initIO } from "../../../libs/socket";
import User from "../../../models/User";

jest.mock("socket.io", () => {
  const adapter = jest.fn();
  const use = jest.fn();
  const on = jest.fn();
  const to = jest.fn();
  const Server = jest.fn(() => ({
    adapter,
    use,
    on,
    to
  }));

  return {
    Server,
    __mockAdapter: adapter,
    __mockUse: use,
    __mockOn: on,
    __mockTo: to
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

describe("socket initIO authentication", () => {
  const socketIOMock = jest.requireMock("socket.io") as {
    __mockUse: jest.Mock;
    __mockAdapter: jest.Mock;
  };
  const socketRedisMock = jest.requireMock("socket.io-redis") as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const getAuthMiddleware = () => {
    initIO({} as any);
    return socketIOMock.__mockUse.mock.calls[0][0] as (
      socket: any,
      next: (error?: Error) => void
    ) => Promise<void>;
  };

  it("enriches valid socket auth and does not reject the connection", async () => {
    const user = {
      id: 123,
      tenantId: 456,
      name: "Socket User"
    };
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

    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 123,
        profile: "admin",
        tenantId: 456
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue(user);

    const middleware = getAuthMiddleware();
    await middleware(socket, next);

    expect(socketRedisMock).toHaveBeenCalledWith({
      host: process.env.IO_REDIS_SERVER,
      port: Number(process.env.IO_REDIS_PORT),
      username: process.env.IO_REDIS_USERNAME,
      password: process.env.IO_REDIS_PASSWORD
    });
    expect(socketIOMock.__mockAdapter).toHaveBeenCalledWith("redis-adapter");
    expect(decodeTokenSocket).toHaveBeenCalledWith("valid-token");
    expect(User.findByPk).toHaveBeenCalledWith(123, {
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
      client: "web",
      id: "123",
      profile: "admin",
      tenantId: "456",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it("rejects sockets when token validation fails", async () => {
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

    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });

    const middleware = getAuthMiddleware();
    await middleware(socket, next);

    expect(User.findByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
  });
});

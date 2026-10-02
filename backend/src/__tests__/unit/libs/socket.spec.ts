import { Server as SocketIOServer } from "socket.io";
import socketRedis from "socket.io-redis";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import User from "../../../models/User";
import Chat from "../../../libs/socketChat/Chat";
import { logger } from "../../../utils/logger";
import { initIO } from "../../../libs/socket";

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

describe("initIO", () => {
  const buildSocket = (token = "token") =>
    ({
      id: "socket-id",
      handshake: {
        auth: {
          token,
          client: "web"
        }
      },
      emit: jest.fn(),
      join: jest.fn(),
      on: jest.fn()
    } as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should authenticate valid sockets without also returning an auth error", async () => {
    const user = {
      id: 7,
      tenantId: 3,
      name: "User"
    };
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 7,
        tenantId: 3,
        profile: "admin"
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue(user);

    const io = initIO({} as any);
    const middleware = (io.use as jest.Mock).mock.calls[0][0];
    const socket = buildSocket();
    const next = jest.fn();

    await middleware(socket, next);

    expect(socketRedis).toHaveBeenCalledWith({
      host: process.env.IO_REDIS_SERVER,
      port: Number(process.env.IO_REDIS_PORT),
      username: process.env.IO_REDIS_USERNAME,
      password: process.env.IO_REDIS_PASSWORD
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
    expect(socket.handshake.auth).toMatchObject({
      token: "token",
      client: "web",
      id: "7",
      tenantId: "3",
      profile: "admin",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]).toEqual([]);
  });

  it("should reject invalid sockets with an authentication error", async () => {
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: {
        id: "",
        tenantId: 0,
        profile: ""
      }
    });

    const io = initIO({} as any);
    const middleware = (io.use as jest.Mock).mock.calls[0][0];
    const next = jest.fn();

    await middleware(buildSocket("bad-token"), next);

    expect(User.findByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
  });

  it("should register tenant rooms and chat handlers on connection", () => {
    const io = initIO({} as any);
    const connectionHandler = (io.on as jest.Mock).mock.calls.find(
      ([event]) => event === "connection"
    )[1];
    const socket = buildSocket();
    socket.handshake.auth.tenantId = "3";

    connectionHandler(socket);

    expect(socket.join).toHaveBeenCalledWith("3");
    expect(socket.on).toHaveBeenCalledWith(
      "3:joinChatBox",
      expect.any(Function)
    );
    expect(socket.on).toHaveBeenCalledWith(
      "3:joinNotification",
      expect.any(Function)
    );
    expect(socket.on).toHaveBeenCalledWith("3:joinTickets", expect.any(Function));
    expect(Chat.register).toHaveBeenCalledWith(socket);
    expect(logger.info).toHaveBeenCalledWith({
      message: "Client connected in tenant",
      data: socket.handshake.auth
    });
  });

  it("should emit tokenInvalid when token decoding throws", async () => {
    (decodeTokenSocket as jest.Mock).mockImplementation(() => {
      throw new Error("jwt malformed");
    });

    const io = initIO({} as any);
    const middleware = (io.use as jest.Mock).mock.calls[0][0];
    const socket = buildSocket("broken-token");
    const next = jest.fn();

    await middleware(socket, next);

    expect(logger.warn).toHaveBeenCalledWith(`tokenInvalid: ${socket}`);
    expect(socket.emit).toHaveBeenCalledWith("tokenInvalid:socket-id");
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
  });
});

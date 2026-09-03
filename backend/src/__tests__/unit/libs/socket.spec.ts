import { Server } from "http";
import socketRedis from "socket.io-redis";
import { Server as SocketIOServer } from "socket.io";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import { initIO } from "../../../libs/socket";
import Chat from "../../../libs/socketChat/Chat";
import User from "../../../models/User";

jest.mock("socket.io", () => {
  const mockServer = {
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn()
  };

  return {
    Server: jest.fn(() => mockServer),
    __mockServer: mockServer
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

describe("libs/socket", () => {
  const socketIOMock = jest.requireMock("socket.io");

  const buildSocket = (auth: Record<string, unknown> = {}) =>
    ({
      id: "socket-1",
      handshake: { auth },
      emit: jest.fn(),
      join: jest.fn(),
      on: jest.fn()
    } as any);

  const setupMiddleware = () => {
    initIO({} as Server);

    return socketIOMock.__mockServer.use.mock.calls[
      socketIOMock.__mockServer.use.mock.calls.length - 1
    ][0];
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("autentica token valido sem acionar erro depois do next de sucesso", async () => {
    const user = { id: 7, tenantId: 3, name: "Agent" };
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 7,
        tenantId: 3,
        profile: "admin"
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue(user);

    const middleware = setupMiddleware();
    const socket = buildSocket({ token: "valid-token", preserved: true });
    const next = jest.fn();

    await middleware(socket, next);

    expect(SocketIOServer).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        cors: { origin: "*" },
        pingTimeout: 180000,
        pingInterval: 60000
      })
    );
    expect(socketRedis).toHaveBeenCalledWith({
      host: process.env.IO_REDIS_SERVER,
      port: Number(process.env.IO_REDIS_PORT),
      username: process.env.IO_REDIS_USERNAME,
      password: process.env.IO_REDIS_PASSWORD
    });
    expect(socketIOMock.__mockServer.adapter).toHaveBeenCalledWith(
      "redis-adapter"
    );
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
      token: "valid-token",
      preserved: true,
      id: "7",
      tenantId: "3",
      profile: "admin",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejeita token invalido uma unica vez sem buscar usuario", async () => {
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: {
        id: "",
        tenantId: 0,
        profile: ""
      }
    });

    const middleware = setupMiddleware();
    const socket = buildSocket({ token: "invalid-token" });
    const next = jest.fn();

    await middleware(socket, next);

    expect(User.findByPk).not.toHaveBeenCalled();
    expect(Chat.register).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
  });
});

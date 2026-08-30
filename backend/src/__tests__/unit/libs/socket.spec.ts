jest.mock("socket.io", () => ({
  Server: jest.fn().mockImplementation(() => ({
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn()
  }))
}));

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

import { Server as SocketIOServer } from "socket.io";
import socketRedis from "socket.io-redis";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import { initIO } from "../../../libs/socket";
import User from "../../../models/User";

type SocketMiddleware = (
  socket: any,
  next: (error?: Error) => void
) => Promise<void>;

const getRegisteredMiddleware = (): SocketMiddleware => {
  initIO({} as any);
  const ioInstance = (SocketIOServer as unknown as jest.Mock).mock.results[0]
    .value;

  return ioInstance.use.mock.calls[0][0];
};

describe("socket initIO authentication middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("aceita token válido, carrega o usuário e chama next sem erro apenas uma vez", async () => {
    const user = { id: 12, tenantId: 34, name: "Atendente" };
    const middleware = getRegisteredMiddleware();
    const socket = {
      handshake: {
        auth: {
          token: "valid-token",
          keep: "existing-value"
        }
      }
    };
    const next = jest.fn();

    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 12,
        tenantId: 34,
        profile: "admin"
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue(user);

    await middleware(socket, next);

    expect(decodeTokenSocket).toHaveBeenCalledWith("valid-token");
    expect(User.findByPk).toHaveBeenCalledWith(12, {
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
      keep: "existing-value",
      id: "12",
      tenantId: "34",
      profile: "admin",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]).toEqual([]);
  });

  it("trata auth ausente como token inválido sem disparar a rotina de exceção", async () => {
    const middleware = getRegisteredMiddleware();
    const socket = {
      id: "socket-1",
      handshake: {},
      emit: jest.fn()
    };
    const next = jest.fn();

    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: {
        id: "",
        tenantId: 0,
        profile: ""
      }
    });

    await middleware(socket, next);

    expect(decodeTokenSocket).toHaveBeenCalledWith(undefined);
    expect(User.findByPk).not.toHaveBeenCalled();
    expect(socket.emit).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(next.mock.calls[0][0].message).toBe("authentication error");
  });

  it("configura o adapter redis durante a inicialização", () => {
    initIO({} as any);
    const ioInstance = (SocketIOServer as unknown as jest.Mock).mock.results[0]
      .value;

    expect(socketRedis).toHaveBeenCalledWith({
      host: process.env.IO_REDIS_SERVER,
      port: Number(process.env.IO_REDIS_PORT),
      username: process.env.IO_REDIS_USERNAME,
      password: process.env.IO_REDIS_PASSWORD
    });
    expect(ioInstance.adapter).toHaveBeenCalledWith("redis-adapter");
  });
});

export {};

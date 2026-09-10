jest.mock("socket.io", () => {
  const io = {
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn()
  };

  return {
    Server: jest.fn(() => io),
    __mockIo: io
  };
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
    warn: jest.fn()
  }
}));

import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import User from "../../../models/User";
import { initIO } from "../../../libs/socket";

describe("socket initIO", () => {
  const socketIOModule = jest.requireMock("socket.io");
  const socketRedis = jest.requireMock("socket.io-redis");
  const io = socketIOModule.__mockIo;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.IO_REDIS_SERVER;
    delete process.env.IO_REDIS_PORT;
    delete process.env.IO_REDIS_USERNAME;
    delete process.env.IO_REDIS_PASSWORD;
  });

  const loadAuthMiddleware = () => {
    initIO({} as any);
    return io.use.mock.calls[0][0];
  };

  it("autentica token válido, enriquece o handshake e chama next apenas uma vez", async () => {
    const user = { id: 12, name: "Operador" };
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
        id: 12,
        tenantId: 34,
        profile: "admin"
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue(user);

    const middleware = loadAuthMiddleware();
    await middleware(socket, next);

    expect(socketIOModule.Server).toHaveBeenCalledWith(
      {},
      {
        cors: {
          origin: "*"
        },
        pingTimeout: 180000,
        pingInterval: 60000
      }
    );
    expect(socketRedis).toHaveBeenCalledWith({
      host: undefined,
      port: NaN,
      username: undefined,
      password: undefined
    });
    expect(io.adapter).toHaveBeenCalledWith("redis-adapter");
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

  it("rejeita token inválido sem consultar usuário", async () => {
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
      data: {}
    });

    const middleware = loadAuthMiddleware();
    await middleware(socket, next);

    expect(User.findByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
    expect(socket.emit).not.toHaveBeenCalled();
  });
});

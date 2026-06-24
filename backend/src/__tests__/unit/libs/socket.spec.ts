const mockIo = {
  adapter: jest.fn(),
  use: jest.fn(),
  on: jest.fn(),
  to: jest.fn(),
  emit: jest.fn()
};

const mockSocketRedis = jest.fn(() => "redis-adapter");

jest.mock("socket.io", () => ({
  Server: jest.fn(() => mockIo)
}));

jest.mock("socket.io-redis", () => mockSocketRedis);

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
  const loadSocketModule = () => {
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    return require("../../../libs/socket");
  };

  beforeEach(() => {
    jest.resetModules();
    mockIo.adapter.mockClear();
    mockIo.use.mockClear();
    mockIo.on.mockClear();
    mockIo.to.mockClear();
    mockIo.emit.mockClear();
    mockSocketRedis.mockClear();
  });

  it("permite conexão com token válido sem chamar next com erro", async () => {
    const decodeTokenSocket = require("../../../libs/decodeTokenSocket")
      .default as jest.Mock;
    const User = require("../../../models/User");
    const { initIO } = loadSocketModule();
    const user = { id: 10, tenantId: 20, name: "User" };

    decodeTokenSocket.mockReturnValue({
      isValid: true,
      data: {
        id: 10,
        tenantId: 20,
        profile: "admin"
      }
    });
    User.findByPk.mockResolvedValue(user);

    initIO({} as any);
    const middleware = mockIo.use.mock.calls[0][0];
    const next = jest.fn();
    const socket = {
      handshake: {
        auth: {
          token: "valid-token",
          client: "web"
        }
      },
      emit: jest.fn(),
      id: "socket-1"
    };

    await middleware(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(User.findByPk).toHaveBeenCalledWith(10, {
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
      id: "10",
      tenantId: "20",
      profile: "admin",
      user
    });
  });

  it("rejeita conexão com token inválido", async () => {
    const decodeTokenSocket = require("../../../libs/decodeTokenSocket")
      .default as jest.Mock;
    const User = require("../../../models/User");
    const { initIO } = loadSocketModule();

    decodeTokenSocket.mockReturnValue({
      isValid: false,
      data: {}
    });

    initIO({} as any);
    const middleware = mockIo.use.mock.calls[0][0];
    const next = jest.fn();
    const socket = {
      handshake: {
        auth: {
          token: "invalid-token"
        }
      },
      emit: jest.fn(),
      id: "socket-2"
    };

    await middleware(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
    expect(User.findByPk).not.toHaveBeenCalled();
  });
});

const mockAdapter = jest.fn();
const mockUse = jest.fn();
const mockOn = jest.fn();
const mockSocketRedis = jest.fn();
const mockDecodeTokenSocket = jest.fn();
const mockFindByPk = jest.fn();
const mockChatRegister = jest.fn();
const mockLoggerInfo = jest.fn();
const mockLoggerWarn = jest.fn();

const mockServerConstructor = jest.fn().mockImplementation(() => ({
  adapter: mockAdapter,
  use: mockUse,
  on: mockOn
}));

jest.mock("socket.io", () => ({
  Server: mockServerConstructor
}));

jest.mock("socket.io-redis", () => ({
  __esModule: true,
  default: mockSocketRedis
}));

jest.mock("../../../libs/decodeTokenSocket", () => ({
  __esModule: true,
  default: mockDecodeTokenSocket
}));

jest.mock("../../../models/User", () => ({
  __esModule: true,
  default: {
    findByPk: mockFindByPk
  }
}));

jest.mock("../../../libs/socketChat/Chat", () => ({
  __esModule: true,
  default: {
    register: mockChatRegister
  }
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    info: mockLoggerInfo,
    warn: mockLoggerWarn
  }
}));

import { initIO } from "../../../libs/socket";

describe("initIO", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSocketRedis.mockReturnValue("redis-adapter");
  });

  it("autentica token valido chamando next apenas uma vez", async () => {
    const user = { id: 7, tenantId: 42, name: "Agent" };
    const socket = {
      id: "socket-1",
      handshake: {
        auth: {
          token: "valid-token",
          client: "web"
        }
      },
      emit: jest.fn()
    } as any;
    const next = jest.fn();

    mockDecodeTokenSocket.mockReturnValue({
      isValid: true,
      data: {
        id: 7,
        tenantId: 42,
        profile: "admin"
      }
    });
    mockFindByPk.mockResolvedValue(user);

    initIO({} as any);
    const middleware = mockUse.mock.calls[0][0];

    await middleware(socket, next);

    expect(mockSocketRedis).toHaveBeenCalled();
    expect(mockAdapter).toHaveBeenCalledWith("redis-adapter");
    expect(mockFindByPk).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        attributes: expect.arrayContaining(["id", "tenantId", "email"])
      })
    );
    expect(socket.handshake.auth).toMatchObject({
      token: "valid-token",
      client: "web",
      id: "7",
      tenantId: "42",
      profile: "admin",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejeita token invalido sem buscar usuario", async () => {
    const socket = {
      id: "socket-2",
      handshake: {
        auth: {
          token: "invalid-token"
        }
      },
      emit: jest.fn()
    } as any;
    const next = jest.fn();

    mockDecodeTokenSocket.mockReturnValue({
      isValid: false,
      data: {}
    });

    initIO({} as any);
    const middleware = mockUse.mock.calls[0][0];

    await middleware(socket, next);

    expect(mockFindByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(new Error("authentication error"));
  });
});

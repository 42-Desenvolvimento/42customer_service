import { initIO } from "../../libs/socket";
import decodeTokenSocket from "../../libs/decodeTokenSocket";
import User from "../../models/User";

jest.mock("socket.io", () => {
  const mockIo = {
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn()
  };

  return {
    Server: jest.fn(() => mockIo),
    __mockIo: mockIo
  };
});

jest.mock("socket.io-redis", () => jest.fn(() => "redis-adapter"));

jest.mock("../../libs/decodeTokenSocket", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../models/User", () => ({
  __esModule: true,
  default: {
    findByPk: jest.fn()
  }
}));

jest.mock("../../libs/socketChat/Chat", () => ({
  __esModule: true,
  default: {
    register: jest.fn()
  }
}));

jest.mock("../../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe("socket initIO authentication middleware", () => {
  const getMockIo = () => jest.requireMock("socket.io").__mockIo;

  const runAuthentication = async (socket: any, next = jest.fn()) => {
    const mockIo = getMockIo();

    initIO({} as any);

    const middleware = mockIo.use.mock.calls[0][0];
    await middleware(socket, next);

    return next;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("accepts a valid token without also returning an authentication error", async () => {
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 123,
        profile: "admin",
        tenantId: 456
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue({
      id: 123,
      name: "Admin"
    });

    const socket = {
      id: "socket-1",
      handshake: {
        auth: {
          token: "valid-token",
          extra: "kept"
        }
      },
      emit: jest.fn()
    };

    const next = await runAuthentication(socket);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(socket.handshake.auth).toMatchObject({
      token: "valid-token",
      extra: "kept",
      id: "123",
      profile: "admin",
      tenantId: "456",
      user: {
        id: 123,
        name: "Admin"
      }
    });
  });

  it("rejects an invalid token with an authentication error", async () => {
    (decodeTokenSocket as jest.Mock).mockReturnValue({
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

    const next = await runAuthentication(socket);

    expect(User.findByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(next.mock.calls[0][0].message).toBe("authentication error");
  });
});

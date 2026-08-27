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

import { initIO } from "../../../libs/socket";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import User from "../../../models/User";
import { logger } from "../../../utils/logger";

const getAuthenticationMiddleware = () => {
  const { __mockServer } = jest.requireMock("socket.io");

  initIO({} as any);

  return __mockServer.use.mock.calls[0][0] as (
    socket: any,
    next: jest.Mock
  ) => Promise<void>;
};

describe("socket initIO authentication middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should authenticate a valid token and continue only once", async () => {
    const user = { id: 10, tenantId: 3, name: "Support" };
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 10,
        profile: "admin",
        tenantId: 3
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue(user);
    const middleware = getAuthenticationMiddleware();
    const socket = {
      handshake: {
        auth: {
          token: "valid-token",
          previous: "kept"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    await middleware(socket, next);

    expect(User.findByPk).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        attributes: expect.arrayContaining(["id", "tenantId", "profile"])
      })
    );
    expect(socket.handshake.auth).toMatchObject({
      token: "valid-token",
      previous: "kept",
      id: "10",
      profile: "admin",
      tenantId: "3",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("should reject an invalid token", async () => {
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });
    const middleware = getAuthenticationMiddleware();
    const socket = {
      handshake: {
        auth: {
          token: "invalid-token"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    await middleware(socket, next);

    expect(User.findByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(next.mock.calls[0][0].message).toBe("authentication error");
  });

  it("should notify tokenInvalid when token decoding throws", async () => {
    (decodeTokenSocket as jest.Mock).mockImplementation(() => {
      throw new Error("unexpected decode failure");
    });
    const middleware = getAuthenticationMiddleware();
    const socket = {
      id: "socket-1",
      handshake: {
        auth: {
          token: "broken-token"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    await middleware(socket, next);

    expect(logger.warn).toHaveBeenCalledWith(`tokenInvalid: ${socket}`);
    expect(socket.emit).toHaveBeenCalledWith("tokenInvalid:socket-1");
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(next.mock.calls[0][0].message).toBe("authentication error");
  });
});

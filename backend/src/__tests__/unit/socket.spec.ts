const mockAdapter = jest.fn();
const mockOn = jest.fn();
const mockUse = jest.fn();

jest.mock("socket.io", () => ({
  Server: jest.fn().mockImplementation(() => ({
    adapter: mockAdapter,
    on: mockOn,
    use: mockUse
  }))
}));

jest.mock("socket.io-redis", () => jest.fn(() => "redis-adapter"));
jest.mock("../../libs/decodeTokenSocket", () => jest.fn());
jest.mock("../../models/User", () => ({
  findByPk: jest.fn()
}));
jest.mock("../../libs/socketChat/Chat", () => ({
  register: jest.fn()
}));
jest.mock("../../utils/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

const { initIO } = require("../../libs/socket");
const decodeTokenSocket = require("../../libs/decodeTokenSocket");
const User = require("../../models/User");

describe("socket initIO authentication middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const getAuthenticationMiddleware = () => {
    initIO({} as any);
    return mockUse.mock.calls[0][0];
  };

  it("should accept a valid token without also returning an authentication error", async () => {
    const user = {
      id: 123,
      tenantId: 456,
      name: "Agent"
    };
    const socket = {
      id: "socket-1",
      emit: jest.fn(),
      handshake: {
        auth: {
          token: "valid-token",
          device: "web"
        }
      }
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

    const middleware = getAuthenticationMiddleware();
    await middleware(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
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
    expect(socket.handshake.auth).toMatchObject({
      token: "valid-token",
      device: "web",
      id: "123",
      profile: "admin",
      tenantId: "456",
      user
    });
  });

  it("should reject an invalid token once", async () => {
    const socket = {
      id: "socket-2",
      emit: jest.fn(),
      handshake: {
        auth: {
          token: "invalid-token"
        }
      }
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

    const middleware = getAuthenticationMiddleware();
    await middleware(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(next.mock.calls[0][0].message).toBe("authentication error");
    expect(User.findByPk).not.toHaveBeenCalled();
  });
});

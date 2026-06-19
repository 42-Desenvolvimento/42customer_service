const mockAdapter = jest.fn();
const mockUse = jest.fn();
const mockOn = jest.fn();

jest.mock("socket.io", () => ({
  Server: jest.fn().mockImplementation(() => ({
    adapter: mockAdapter,
    use: mockUse,
    on: mockOn
  }))
}));

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

const { initIO } = require("../../../libs/socket");
const mockedDecodeTokenSocket = require("../../../libs/decodeTokenSocket") as jest.Mock;
const mockedUser = require("../../../models/User");
const mockedFindByPk = mockedUser.findByPk as jest.Mock;

const userAttributes = [
  "id",
  "tenantId",
  "name",
  "email",
  "profile",
  "status",
  "lastLogin",
  "lastOnline"
];

const getAuthMiddleware = () => {
  initIO({} as any);
  return mockUse.mock.calls[0][0];
};

describe("socket initIO authentication middleware", () => {
  beforeEach(() => {
    mockAdapter.mockClear();
    mockUse.mockClear();
    mockOn.mockClear();
  });

  it("should accept a valid token and call next only once", async () => {
    const user = { id: 15, name: "Maria" };
    mockedDecodeTokenSocket.mockReturnValue({
      isValid: true,
      data: {
        id: 15,
        profile: "admin",
        tenantId: 3
      }
    });
    mockedFindByPk.mockResolvedValue(user);

    const middleware = getAuthMiddleware();
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

    await middleware(socket, next);

    expect(mockedDecodeTokenSocket).toHaveBeenCalledWith("valid-token");
    expect(mockedFindByPk).toHaveBeenCalledWith(15, {
      attributes: userAttributes
    });
    expect(socket.handshake.auth).toMatchObject({
      token: "valid-token",
      client: "web",
      id: "15",
      tenantId: "3",
      profile: "admin",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("should reject an invalid token and call next only once", async () => {
    mockedDecodeTokenSocket.mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });

    const middleware = getAuthMiddleware();
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

    await middleware(socket, next);

    expect(mockedFindByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toBe("authentication error");
  });
});

export {};

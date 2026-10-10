jest.mock("socket.io", () => {
  const mockServerInstance = {
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn()
  };

  return {
    Server: jest.fn(() => mockServerInstance),
    __mockServerInstance: mockServerInstance
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

import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import { initIO } from "../../../libs/socket";
import User from "../../../models/User";

describe("socket initIO authentication middleware", () => {
  const getMiddleware = () => {
    const { __mockServerInstance } = jest.requireMock("socket.io");
    return __mockServerInstance.use.mock.calls[0][0];
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("allows a valid token without also returning an authentication error", async () => {
    const user = { id: 7, name: "User Test" };
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: { id: 7, profile: "admin", tenantId: 42 }
    });
    (User.findByPk as jest.Mock).mockResolvedValue(user);

    initIO({} as any);

    const middleware = getMiddleware();
    const socket = {
      handshake: {
        auth: {
          token: "valid-token",
          existing: "value"
        }
      },
      id: "socket-id",
      emit: jest.fn()
    };
    const next = jest.fn();

    await middleware(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(socket.handshake.auth).toMatchObject({
      existing: "value",
      id: "7",
      tenantId: "42",
      profile: "admin",
      user
    });
  });

  it("rejects an invalid token with an authentication error", async () => {
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: { id: "", profile: "", tenantId: 0 }
    });

    initIO({} as any);

    const middleware = getMiddleware();
    const next = jest.fn();

    await middleware(
      {
        handshake: { auth: { token: "invalid-token" } },
        id: "socket-id",
        emit: jest.fn()
      },
      next
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
  });
});

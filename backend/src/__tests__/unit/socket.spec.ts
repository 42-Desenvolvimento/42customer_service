export {};

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

jest.mock("../../libs/decodeTokenSocket", () => jest.fn());

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
    warn: jest.fn()
  }
}));

import { initIO } from "../../libs/socket";
import decodeTokenSocket from "../../libs/decodeTokenSocket";
import User from "../../models/User";

const socketIO = jest.requireMock("socket.io");

describe("socket initIO authentication", () => {
  beforeEach(() => {
    socketIO.__mockServerInstance.adapter.mockClear();
    socketIO.__mockServerInstance.use.mockClear();
    socketIO.__mockServerInstance.on.mockClear();
  });

  it("authenticates valid tokens without also returning an authentication error", async () => {
    const user = { id: 7, tenantId: 3, name: "User" };
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: { id: 7, tenantId: 3, profile: "admin" }
    });
    (User.findByPk as jest.Mock).mockResolvedValue(user);

    initIO({} as any);
    const middleware = socketIO.__mockServerInstance.use.mock.calls[0][0];
    const socket = {
      handshake: {
        auth: {
          token: "valid-token",
          existing: "value"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    await middleware(socket, next);

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
      existing: "value",
      id: "7",
      tenantId: "3",
      profile: "admin",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects invalid tokens once with an authentication error", async () => {
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: {}
    });

    initIO({} as any);
    const middleware = socketIO.__mockServerInstance.use.mock.calls[0][0];
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
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
  });
});

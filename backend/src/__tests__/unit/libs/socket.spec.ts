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

import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import User from "../../../models/User";
import { initIO } from "../../../libs/socket";

const decodeTokenSocketMock = decodeTokenSocket as jest.Mock;
const UserMock = User as unknown as { findByPk: jest.Mock };
const socketIoMock = jest.requireMock("socket.io");

describe("initIO authentication middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls next only once without an error for a valid token", async () => {
    const user = { id: 7, tenantId: 3, name: "Agent" };
    decodeTokenSocketMock.mockReturnValue({
      isValid: true,
      data: { id: 7, tenantId: 3 }
    });
    UserMock.findByPk.mockResolvedValue(user);

    initIO({} as any);

    const middleware = socketIoMock.__mockServer.use.mock.calls[0][0];
    const socket = {
      id: "socket-1",
      handshake: {
        auth: {
          token: "valid-token",
          existing: "kept"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    await middleware(socket, next);

    expect(UserMock.findByPk).toHaveBeenCalledWith(7, {
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
      existing: "kept",
      id: "7",
      tenantId: "3",
      user
    });
    expect(next.mock.calls).toEqual([[]]);
  });

  it("rejects an invalid token without loading the user", async () => {
    decodeTokenSocketMock.mockReturnValue({
      isValid: false,
      data: {}
    });

    initIO({} as any);

    const middleware = socketIoMock.__mockServer.use.mock.calls[0][0];
    const next = jest.fn();

    await middleware(
      {
        id: "socket-2",
        handshake: { auth: { token: "invalid-token" } },
        emit: jest.fn()
      },
      next
    );

    expect(UserMock.findByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
  });
});

export {};

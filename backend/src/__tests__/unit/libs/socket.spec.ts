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
jest.mock("../../../models/User", () => ({ findByPk: jest.fn() }));
jest.mock("../../../libs/socketChat/Chat", () => ({ register: jest.fn() }));
jest.mock("../../../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn()
  }
}));

import { Server as SocketIOServer } from "socket.io";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import User from "../../../models/User";
import { initIO } from "../../../libs/socket";

describe("initIO socket authentication", () => {
  const socketIoMock = jest.requireMock("socket.io") as {
    __mockServerInstance: {
      adapter: jest.Mock;
      use: jest.Mock;
      on: jest.Mock;
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("authenticates valid tokens without calling next with an error", async () => {
    const user = {
      id: 7,
      tenantId: 3,
      name: "Agent",
      email: "agent@example.com"
    };
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 7,
        profile: "admin",
        tenantId: 3
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue(user);

    initIO({} as any);

    const authMiddleware = socketIoMock.__mockServerInstance.use.mock
      .calls[0][0];
    const socket = {
      id: "socket-1",
      emit: jest.fn(),
      handshake: {
        auth: {
          token: "valid-token",
          keep: "value"
        }
      }
    };
    const next = jest.fn();

    await authMiddleware(socket, next);

    expect(SocketIOServer).toHaveBeenCalledTimes(1);
    expect(decodeTokenSocket).toHaveBeenCalledWith("valid-token");
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
      keep: "value",
      id: "7",
      tenantId: "3",
      profile: "admin",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]).toHaveLength(0);
  });

  it("rejects invalid tokens", async () => {
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: ""
      }
    });

    initIO({} as any);

    const authMiddleware = socketIoMock.__mockServerInstance.use.mock
      .calls[0][0];
    const next = jest.fn();

    await authMiddleware(
      {
        id: "socket-2",
        emit: jest.fn(),
        handshake: {
          auth: {
            token: "invalid-token"
          }
        }
      },
      next
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
    expect(User.findByPk).not.toHaveBeenCalled();
  });
});

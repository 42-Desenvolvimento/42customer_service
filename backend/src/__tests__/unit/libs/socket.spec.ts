import { Server as SocketServer } from "socket.io";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import { initIO } from "../../../libs/socket";
import User from "../../../models/User";

jest.mock("socket.io", () => ({
  Server: jest.fn().mockImplementation(() => ({
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn()
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

describe("socket", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should call next without authentication error for a valid token", async () => {
    const user = {
      id: 123,
      tenantId: 456,
      name: "Agent"
    };
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 123,
        tenantId: 456
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue(user);

    const io = initIO({} as any);
    const middleware = (io.use as jest.Mock).mock.calls[0][0];
    const socket = {
      id: "socket-1",
      handshake: {
        auth: {
          token: "valid-token",
          custom: "keep-me"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

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
    expect(socket.handshake.auth).toEqual({
      token: "valid-token",
      custom: "keep-me",
      id: "123",
      tenantId: "456",
      user
    });
  });

  it("should call next with authentication error for an invalid token", async () => {
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: {}
    });

    const io = initIO({} as any);
    const middleware = (io.use as jest.Mock).mock.calls[0][0];
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

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
    expect(User.findByPk).not.toHaveBeenCalled();
  });

  it("should configure redis adapter when initializing socket.io", () => {
    const io = initIO({} as any);
    const socketServer = SocketServer as unknown as jest.Mock;

    expect(socketServer).toHaveBeenCalledTimes(1);
    expect(io.adapter).toHaveBeenCalledWith("redis-adapter");
  });
});

import { Server as SocketIOServer } from "socket.io";
import socketRedis from "socket.io-redis";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import { initIO } from "../../../libs/socket";
import Chat from "../../../libs/socketChat/Chat";
import User from "../../../models/User";

jest.mock("socket.io", () => ({
  Server: jest.fn()
}));

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
    warn: jest.fn(),
    error: jest.fn()
  }
}));

type SocketMiddleware = (
  socket: any,
  next: (error?: Error) => void
) => Promise<void>;

const createIO = () => {
  const io = {
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn()
  };

  (SocketIOServer as unknown as jest.Mock).mockImplementation(() => io);

  return io;
};

describe("socket initIO", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("authenticates a valid token without calling next with an error", async () => {
    const io = createIO();
    const user = { id: 123, name: "Socket User" };

    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 123,
        profile: "admin",
        tenantId: 456
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue(user);

    initIO({} as any);

    const middleware = io.use.mock.calls[0][0] as SocketMiddleware;
    const next = jest.fn();
    const socket = {
      handshake: {
        auth: {
          token: "valid-token",
          keep: "existing-auth-data"
        }
      },
      emit: jest.fn()
    };

    await middleware(socket, next);

    expect(socketRedis).toHaveBeenCalledTimes(1);
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
      keep: "existing-auth-data",
      id: "123",
      tenantId: "456",
      profile: "admin",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(socket.emit).not.toHaveBeenCalled();
    expect(Chat.register).not.toHaveBeenCalled();
  });

  it("rejects an invalid token once", async () => {
    const io = createIO();

    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });

    initIO({} as any);

    const middleware = io.use.mock.calls[0][0] as SocketMiddleware;
    const next = jest.fn();
    const socket = {
      handshake: {
        auth: {
          token: "invalid-token"
        }
      },
      emit: jest.fn()
    };

    await middleware(socket, next);

    expect(User.findByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toMatchObject({
      message: "authentication error"
    });
    expect(socket.emit).not.toHaveBeenCalled();
  });
});

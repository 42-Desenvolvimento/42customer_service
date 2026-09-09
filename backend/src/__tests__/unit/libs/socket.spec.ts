import { Server as SocketIOServer } from "socket.io";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import { initIO } from "../../../libs/socket";
import User from "../../../models/User";

jest.mock("socket.io", () => ({
  Server: jest.fn()
}));

jest.mock("socket.io-redis", () => jest.fn(() => "redis-adapter"));

jest.mock("../../../libs/decodeTokenSocket", () => jest.fn());

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

describe("socket initIO authentication", () => {
  let middleware: ((socket: any, next: any) => Promise<void>) | undefined;
  let mockIO: {
    adapter: jest.Mock;
    use: jest.Mock;
    on: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    middleware = undefined;
    mockIO = {
      adapter: jest.fn(),
      use: jest.fn(handler => {
        middleware = handler;
        return mockIO;
      }),
      on: jest.fn()
    };
    (SocketIOServer as unknown as jest.Mock).mockImplementation(() => mockIO);
  });

  it("should call next once without error for valid tokens", async () => {
    const user = { id: 7, name: "Jane" };
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

    const socket = {
      id: "socket-id",
      handshake: {
        auth: {
          token: "valid-token",
          device: "browser"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    await middleware!(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
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
    expect(socket.handshake.auth).toEqual({
      token: "valid-token",
      device: "browser",
      id: "7",
      profile: "admin",
      tenantId: "3",
      user
    });
  });

  it("should reject invalid tokens once", async () => {
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });

    initIO({} as any);

    const socket = {
      id: "socket-id",
      handshake: {
        auth: {
          token: "invalid-token"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    await middleware!(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(new Error("authentication error"));
    expect(User.findByPk).not.toHaveBeenCalled();
  });
});

jest.mock("socket.io", () => {
  const adapter = jest.fn();
  const use = jest.fn();
  const on = jest.fn();
  const Server = jest.fn().mockImplementation(() => ({
    adapter,
    use,
    on
  }));

  return {
    Server,
    __mockSocketIO: {
      adapter,
      use,
      on
    }
  };
});

jest.mock("socket.io-redis", () => jest.fn(() => "redis-adapter"));

jest.mock("../../libs/decodeTokenSocket", () => ({
  __esModule: true,
  default: jest.fn()
}));

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

import decodeTokenSocket from "../../libs/decodeTokenSocket";
import { initIO } from "../../libs/socket";
import User from "../../models/User";

describe("libs/socket", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const initMiddleware = () => {
    initIO({} as any);
    const socketIoMock = jest.requireMock("socket.io") as any;
    return socketIoMock.__mockSocketIO.use.mock.calls[0][0];
  };

  it("authenticates a valid token and calls next only once without an error", async () => {
    const middleware = initMiddleware();
    const user = { id: 123, tenantId: 456, name: "Agent" };
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 123,
        profile: "admin",
        tenantId: 456
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue(user);

    const socket = {
      id: "socket-1",
      handshake: {
        auth: {
          token: "valid-token",
          keep: "value"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    await middleware(socket, next);

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
      keep: "value",
      id: "123",
      tenantId: "456",
      profile: "admin",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects an invalid token", async () => {
    const middleware = initMiddleware();
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });

    const next = jest.fn();

    await middleware(
      {
        id: "socket-2",
        handshake: {
          auth: {
            token: "invalid-token"
          }
        },
        emit: jest.fn()
      },
      next
    );

    expect(User.findByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
  });
});

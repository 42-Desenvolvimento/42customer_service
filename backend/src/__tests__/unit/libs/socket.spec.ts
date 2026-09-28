jest.mock("socket.io", () => ({
  Server: jest.fn(() => ({
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn()
  }))
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

import { Server as SocketServer } from "socket.io";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import { initIO } from "../../../libs/socket";
import User from "../../../models/User";

type SocketMiddleware = (
  socket: {
    handshake: {
      auth: Record<string, unknown>;
    };
    emit: jest.Mock;
  },
  next: jest.Mock
) => Promise<void>;

const getSocketMiddleware = (): SocketMiddleware => {
  const io = initIO({} as never) as unknown as {
    use: jest.Mock;
  };

  return io.use.mock.calls[0][0] as SocketMiddleware;
};

describe("socket auth middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("authenticates a valid token without also rejecting the connection", async () => {
    const user = { id: 123, tenantId: 456, name: "User Test" };
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 123,
        profile: "admin",
        tenantId: 456
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue(user);

    const middleware = getSocketMiddleware();
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

    expect(SocketServer).toHaveBeenCalledTimes(1);
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
      existing: "value",
      id: "123",
      profile: "admin",
      tenantId: "456",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects an invalid token without loading a user", async () => {
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });

    const middleware = getSocketMiddleware();
    const next = jest.fn();

    await middleware(
      {
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
    expect(next.mock.calls[0][0]).toMatchObject({
      message: "authentication error"
    });
  });
});

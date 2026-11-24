jest.mock("socket.io", () => ({
  Server: jest.fn(() => ({
    adapter: jest.fn(),
    on: jest.fn(),
    use: jest.fn()
  }))
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
    warn: jest.fn()
  }
}));

import { Server } from "socket.io";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import { initIO } from "../../../libs/socket";
import User from "../../../models/User";

describe("socket initIO authentication middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.IO_REDIS_SERVER;
    delete process.env.IO_REDIS_PORT;
    delete process.env.IO_REDIS_USERNAME;
    delete process.env.IO_REDIS_PASSWORD;
  });

  const getMiddleware = () => {
    const io = initIO({} as any);
    return (io.use as jest.Mock).mock.calls[0][0];
  };

  it("hydrates socket auth with validated token data and user before accepting the connection", async () => {
    const user = { id: 7, name: "Support" };
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 7,
        profile: "admin",
        tenantId: 42
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue(user);

    const socket = {
      handshake: {
        auth: {
          token: "valid-token",
          keep: "me"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    await getMiddleware()(socket, next);

    expect(socket.handshake.auth).toMatchObject({
      token: "valid-token",
      keep: "me",
      id: "7",
      profile: "admin",
      tenantId: "42",
      user
    });
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
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects invalid tokens without querying user data", async () => {
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });

    const socket = {
      handshake: {
        auth: {
          token: "invalid-token"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    await getMiddleware()(socket, next);

    expect(User.findByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
  });

  it("emits tokenInvalid and rejects when token decoding throws", async () => {
    (decodeTokenSocket as jest.Mock).mockImplementation(() => {
      throw new Error("bad token");
    });

    const socket = {
      id: "socket-1",
      handshake: {
        auth: {
          token: "broken-token"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    await getMiddleware()(socket, next);

    expect(socket.emit).toHaveBeenCalledWith("tokenInvalid:socket-1");
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
  });
});

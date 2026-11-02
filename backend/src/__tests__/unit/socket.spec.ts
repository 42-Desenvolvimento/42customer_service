jest.mock("socket.io", () => ({
  Server: jest.fn().mockImplementation(() => ({
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn()
  }))
}));

jest.mock("socket.io-redis", () => jest.fn());

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

import { Server as SocketServer } from "socket.io";
import decodeTokenSocket from "../../libs/decodeTokenSocket";
import User from "../../models/User";
import { initIO } from "../../libs/socket";

describe("socket initIO authentication middleware", () => {
  const getMiddleware = () => {
    initIO({} as any);
    const io = (SocketServer as unknown as jest.Mock).mock.results[0].value;

    return io.use.mock.calls[0][0];
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should authenticate a valid token and call next only once", async () => {
    const user = { id: 10, tenantId: 20, name: "Jane" };
    const socket = {
      id: "socket-id",
      handshake: {
        auth: {
          token: "valid-token"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 10,
        tenantId: 20,
        profile: "admin"
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue(user);

    await getMiddleware()(socket, next);

    expect(User.findByPk).toHaveBeenCalledWith(10, {
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
      id: "10",
      tenantId: "20",
      profile: "admin",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it("should reject an invalid token once", async () => {
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

    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: {
        id: "",
        tenantId: "",
        profile: ""
      }
    });

    await getMiddleware()(socket, next);

    expect(User.findByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
    expect(socket.emit).not.toHaveBeenCalled();
  });
});

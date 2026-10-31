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

import { Server as SocketIOServer } from "socket.io";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import { initIO } from "../../../libs/socket";
import User from "../../../models/User";

const getMiddleware = () => {
  const io = (SocketIOServer as unknown as jest.Mock).mock.results[0].value;
  return io.use.mock.calls[0][0];
};

describe("socket", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("authenticates valid tokens without calling next with an error", async () => {
    const user = { id: 12, tenantId: 34, name: "Socket User" };
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 12,
        profile: "admin",
        tenantId: 34
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue(user);

    initIO({} as any);
    const middleware = getMiddleware();
    const next = jest.fn();
    const socket = {
      handshake: {
        auth: {
          token: "valid-token",
          client: "web"
        }
      },
      emit: jest.fn()
    };

    await middleware(socket, next);

    expect(User.findByPk).toHaveBeenCalledWith(12, {
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
      client: "web",
      id: "12",
      profile: "admin",
      tenantId: "34",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects invalid tokens", async () => {
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });

    initIO({} as any);
    const middleware = getMiddleware();
    const next = jest.fn();

    await middleware(
      {
        handshake: {
          auth: {
            token: "bad-token"
          }
        },
        emit: jest.fn()
      },
      next
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
    expect(User.findByPk).not.toHaveBeenCalled();
  });
});

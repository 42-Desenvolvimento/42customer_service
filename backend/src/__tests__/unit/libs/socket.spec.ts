jest.mock("socket.io", () => {
  const instance: any = {
    handlers: {}
  };

  instance.adapter = jest.fn();
  instance.use = jest.fn(handler => {
    instance.middleware = handler;
  });
  instance.on = jest.fn((event, handler) => {
    instance.handlers[event] = handler;
  });

  return {
    Server: jest.fn(() => instance),
    __instance: instance
  };
});

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

describe("libs/socket", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should authenticate a valid socket without calling next with an error", async () => {
    const user = { id: 12, tenantId: 34, name: "Atendente" };
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 12,
        tenantId: 34,
        profile: "admin"
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue(user);

    initIO({} as any);

    const socketIoMock = jest.requireMock("socket.io");
    const socket = {
      handshake: {
        auth: {
          token: "valid-token",
          client: "web"
        }
      }
    };
    const next = jest.fn();

    await socketIoMock.__instance.middleware(socket, next);

    expect(SocketIOServer).toHaveBeenCalledTimes(1);
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
    expect(socket.handshake.auth).toMatchObject({
      token: "valid-token",
      client: "web",
      id: "12",
      tenantId: "34",
      profile: "admin",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });
});
